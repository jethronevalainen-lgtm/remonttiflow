import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Download,
  Edit3,
  History,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserRoundCheck,
  Users,
  Wrench,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useResourceManagement } from '@/hooks/useResourceManagement';
import logger from '@/lib/logger';
import {
  isInstantWithinRange,
  localDateIso,
  localDateTimeInput,
} from '@/lib/localDateTime';
import {
  createEquipmentRecord,
  deleteEquipmentRecord,
  updateEquipmentRecord,
} from '@/lib/supabase/organizationEntities';
import {
  createEquipmentMaintenance,
  createEquipmentReservation,
  deleteEquipmentMaintenance,
  deleteEquipmentReservation,
  type EquipmentMaintenance,
  type EquipmentReservation,
} from '@/lib/supabase/resourceManagement';
import { supabase } from '@/lib/supabase/client';
import type { Equipment, EquipmentStatus } from '@/types';

const EQUIPMENT_STATUSES: EquipmentStatus[] = ['Vapaa', 'Käytössä', 'Huollossa', 'Vuokralla'];
const MAINTENANCE_STATUSES = ['Suunniteltu', 'Työn alla', 'Valmis', 'Peruttu'];
const RESERVATION_STATUSES = ['Varattu', 'Käytössä', 'Palautettu', 'Peruttu'];
const INACTIVE_RESERVATION_STATUSES = new Set(['Palautettu', 'Peruttu']);
const CLOSED_MAINTENANCE_STATUSES = new Set(['Valmis', 'Peruttu']);

interface EquipmentForm {
  name: string;
  type: string;
  serial: string;
  assetNumber: string;
  model: string;
  year: string;
  location: string;
  status: EquipmentStatus;
  lastMaintenance: string;
  nextMaintenance: string;
  acquisitionCost: string;
  hourlyCost: string;
  currentProjectId: string;
}

interface EquipmentAssignment {
  id: string;
  equipmentId: string;
  employeeId: string;
  assignedAt: string;
  returnedAt?: string;
  notes?: string;
  returnNotes?: string;
}

const emptyEquipment: EquipmentForm = {
  name: '',
  type: '',
  serial: '',
  assetNumber: '',
  model: '',
  year: '',
  location: '',
  status: 'Vapaa',
  lastMaintenance: '',
  nextMaintenance: '',
  acquisitionCost: '',
  hourlyCost: '',
  currentProjectId: '',
};

function statusBadge(status: EquipmentStatus) {
  const classes: Record<EquipmentStatus, string> = {
    Vapaa: 'bg-emerald-50 text-emerald-700',
    Käytössä: 'bg-blue-50 text-blue-700',
    Huollossa: 'bg-amber-50 text-amber-700',
    Vuokralla: 'bg-purple-50 text-purple-700',
  };
  return <Badge className={`border-0 ${classes[status]}`}>{status}</Badge>;
}

function money(value: number) {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function dateTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function parseOptionalMoney(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : Number.NaN;
}

function mapAssignment(value: Record<string, unknown>): EquipmentAssignment {
  const text = (key: string) => typeof value[key] === 'string' ? value[key] as string : '';
  const optionalText = (key: string) => text(key) || undefined;
  return {
    id: text('id'),
    equipmentId: text('equipment_id'),
    employeeId: text('employee_id'),
    assignedAt: text('assigned_at'),
    returnedAt: optionalText('returned_at'),
    notes: optionalText('notes'),
    returnNotes: optionalText('return_notes'),
  };
}

export default function Kalusto() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const {
    equipment,
    employees,
    projects,
    refresh: refreshDomain,
  } = useAppDataContext();
  const resources = useResourceManagement();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Kaikki');
  const [holderFilter, setHolderFilter] = useState('Kaikki');
  const [equipmentDialog, setEquipmentDialog] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [deleteEquipment, setDeleteEquipment] = useState<Equipment | null>(null);
  const [equipmentForm, setEquipmentForm] = useState<EquipmentForm>(emptyEquipment);

  const [selectedEquipmentId, setSelectedEquipmentId] = useState('');
  const [reservationDialog, setReservationDialog] = useState(false);
  const [reservationProjectId, setReservationProjectId] = useState('');
  const [reservationStart, setReservationStart] = useState('');
  const [reservationEnd, setReservationEnd] = useState('');
  const [reservationStatus, setReservationStatus] = useState(RESERVATION_STATUSES[0]);
  const [reservationNotes, setReservationNotes] = useState('');

  const [maintenanceDialog, setMaintenanceDialog] = useState(false);
  const [maintenanceType, setMaintenanceType] = useState('Määräaikaishuolto');
  const [maintenanceStatus, setMaintenanceStatus] = useState(MAINTENANCE_STATUSES[0]);
  const [maintenanceScheduledAt, setMaintenanceScheduledAt] = useState('');
  const [maintenanceCompletedAt, setMaintenanceCompletedAt] = useState('');
  const [maintenanceCost, setMaintenanceCost] = useState('0');
  const [maintenanceProvider, setMaintenanceProvider] = useState('');
  const [maintenanceDescription, setMaintenanceDescription] = useState('');

  const [assignments, setAssignments] = useState<EquipmentAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentDialog, setAssignmentDialog] = useState(false);
  const [assignmentEmployeeId, setAssignmentEmployeeId] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [returnAssignment, setReturnAssignment] = useState<EquipmentAssignment | null>(null);
  const [returnNotes, setReturnNotes] = useState('');

  const [deleteReservation, setDeleteReservation] = useState<EquipmentReservation | null>(null);
  const [deleteMaintenance, setDeleteMaintenance] = useState<EquipmentMaintenance | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const today = localDateIso();
  const now = Date.now();

  const loadAssignments = useCallback(async () => {
    if (!currentOrg) {
      setAssignments([]);
      return;
    }

    setAssignmentsLoading(true);
    try {
      const { data, error } = await supabase
        .from('equipment_assignments')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('assigned_at', { ascending: false });
      if (error) throw new Error(`Kaluston haltijatietojen haku epäonnistui: ${error.message}`);
      setAssignments((Array.isArray(data) ? data : []).map((item) => mapAssignment(item)));
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Haltijatietojen haku epäonnistui.');
    } finally {
      setAssignmentsLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  const activeEmployees = useMemo(
    () => employees
      .filter((item) => item.status !== 'Eroonnut' && !item.archivedAt)
      .sort((a, b) => a.name.localeCompare(b.name, 'fi')),
    [employees],
  );
  const employeeById = useMemo(
    () => new Map(employees.map((item) => [item.id, item])),
    [employees],
  );
  const equipmentById = useMemo(
    () => new Map(equipment.map((item) => [item.id, item])),
    [equipment],
  );
  const projectById = useMemo(
    () => new Map(projects.map((item) => [item.id, item])),
    [projects],
  );
  const activeAssignmentByEquipment = useMemo(
    () => new Map(assignments.filter((item) => !item.returnedAt).map((item) => [item.equipmentId, item])),
    [assignments],
  );

  const filteredEquipment = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fi');
    return equipment.filter((item) => {
      const assignment = activeAssignmentByEquipment.get(item.id);
      const holderName = assignment ? employeeById.get(assignment.employeeId)?.name ?? '' : '';
      const matchesSearch = !query || [
        item.name,
        item.type,
        item.serial,
        item.location,
        item.assetNumber ?? '',
        item.model ?? '',
        holderName,
      ].some((value) => value.toLocaleLowerCase('fi').includes(query));
      const matchesStatus = statusFilter === 'Kaikki' || item.status === statusFilter;
      const matchesHolder = holderFilter === 'Kaikki'
        || (holderFilter === 'assigned' && Boolean(assignment))
        || (holderFilter === 'unassigned' && !assignment)
        || assignment?.employeeId === holderFilter;
      return matchesSearch && matchesStatus && matchesHolder;
    });
  }, [activeAssignmentByEquipment, employeeById, equipment, holderFilter, search, statusFilter]);

  const activeReservations = useMemo(
    () => resources.reservations.filter((item) =>
      !INACTIVE_RESERVATION_STATUSES.has(item.status)
      && isInstantWithinRange(item.startsAt, item.endsAt, now),
    ),
    [now, resources.reservations],
  );

  const nextMaintenanceByEquipment = useMemo(() => {
    const result = new Map<string, EquipmentMaintenance>();
    const scheduled = resources.maintenance
      .filter((item) => item.scheduledAt && !CLOSED_MAINTENANCE_STATUSES.has(item.status))
      .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''));
    scheduled.forEach((item) => {
      if (!result.has(item.equipmentId)) result.set(item.equipmentId, item);
    });
    return result;
  }, [resources.maintenance]);

  const maintenanceCostTotal = resources.maintenance
    .reduce((sum, item) => sum + item.costCents, 0) / 100;

  const openEquipmentCreate = () => {
    setEditingEquipment(null);
    setEquipmentForm(emptyEquipment);
    setErrors([]);
    setOperationError(null);
    setEquipmentDialog(true);
  };

  const openEquipmentEdit = (item: Equipment) => {
    setEditingEquipment(item);
    setEquipmentForm({
      name: item.name,
      type: item.type,
      serial: item.serial,
      assetNumber: item.assetNumber ?? '',
      model: item.model ?? '',
      year: item.year == null ? '' : String(item.year),
      location: item.location,
      status: item.status,
      lastMaintenance: item.lastMaintenance,
      nextMaintenance: item.nextMaintenance ?? '',
      acquisitionCost: item.acquisitionCostCents == null ? '' : String(item.acquisitionCostCents / 100),
      hourlyCost: item.hourlyCostCents == null ? '' : String(item.hourlyCostCents / 100),
      currentProjectId: item.currentProjectId ?? '',
    });
    setErrors([]);
    setOperationError(null);
    setEquipmentDialog(true);
  };

  const saveEquipment = async () => {
    const year = equipmentForm.year.trim() ? Number(equipmentForm.year) : undefined;
    const acquisitionCostCents = parseOptionalMoney(equipmentForm.acquisitionCost);
    const hourlyCostCents = parseOptionalMoney(equipmentForm.hourlyCost);
    const nextErrors: string[] = [];

    if (!equipmentForm.name.trim()) nextErrors.push('Kaluston nimi on pakollinen.');
    if (!equipmentForm.type.trim()) nextErrors.push('Kalustotyyppi on pakollinen.');
    if (year !== undefined && (!Number.isInteger(year) || year < 1900 || year > 2200)) {
      nextErrors.push('Valmistusvuosi ei ole kelvollinen.');
    }
    if (Number.isNaN(acquisitionCostCents) || Number.isNaN(hourlyCostCents)) {
      nextErrors.push('Kustannusten pitää olla kelvollisia euromääriä.');
    }
    setErrors(nextErrors);
    if (nextErrors.length || !currentOrg) return;

    const payload: Omit<Equipment, 'id'> = {
      name: equipmentForm.name.trim(),
      type: equipmentForm.type.trim(),
      serial: equipmentForm.serial.trim(),
      assetNumber: equipmentForm.assetNumber.trim() || undefined,
      model: equipmentForm.model.trim() || undefined,
      year,
      location: equipmentForm.location.trim(),
      status: equipmentForm.status,
      lastMaintenance: equipmentForm.lastMaintenance,
      nextMaintenance: equipmentForm.nextMaintenance || undefined,
      acquisitionCostCents,
      hourlyCostCents,
      currentProjectId: equipmentForm.currentProjectId || undefined,
    };

    setSaving(true);
    setOperationError(null);
    try {
      if (editingEquipment) {
        await updateEquipmentRecord(currentOrg.id, editingEquipment.id, payload);
      } else {
        await createEquipmentRecord(currentOrg.id, user?.id, payload);
      }
      await refreshDomain();
      setEquipmentDialog(false);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tallennus epäonnistui.');
      logger.error('Kaluston tallennus epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  const removeEquipment = async () => {
    if (!currentOrg || !deleteEquipment) return;
    setSaving(true);
    setOperationError(null);
    try {
      await deleteEquipmentRecord(currentOrg.id, deleteEquipment.id);
      await Promise.all([refreshDomain(), resources.refresh(), loadAssignments()]);
      setDeleteEquipment(null);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const openAssignment = (equipmentId: string) => {
    const assignment = activeAssignmentByEquipment.get(equipmentId);
    setSelectedEquipmentId(equipmentId);
    setAssignmentEmployeeId(assignment?.employeeId ?? '');
    setAssignmentNotes('');
    setOperationError(null);
    setAssignmentDialog(true);
  };

  const saveAssignment = async () => {
    if (!currentOrg || !selectedEquipmentId || !assignmentEmployeeId) {
      setOperationError('Valitse kalusto ja työntekijä.');
      return;
    }
    const currentAssignment = activeAssignmentByEquipment.get(selectedEquipmentId);
    if (currentAssignment?.employeeId === assignmentEmployeeId) {
      setOperationError('Kalusto on jo valitulla työntekijällä.');
      return;
    }

    setSaving(true);
    setOperationError(null);
    try {
      const { error } = await supabase.rpc('assign_equipment_to_employee', {
        p_organization_id: currentOrg.id,
        p_equipment_id: selectedEquipmentId,
        p_employee_id: assignmentEmployeeId,
        p_notes: assignmentNotes.trim() || null,
      });
      if (error) throw new Error(`Kaluston luovutus epäonnistui: ${error.message}`);
      await Promise.all([refreshDomain(), loadAssignments()]);
      setAssignmentDialog(false);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Kaluston luovutus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const saveReturn = async () => {
    if (!currentOrg || !returnAssignment) return;
    setSaving(true);
    setOperationError(null);
    try {
      const { error } = await supabase.rpc('return_equipment_from_employee', {
        p_organization_id: currentOrg.id,
        p_equipment_id: returnAssignment.equipmentId,
        p_return_notes: returnNotes.trim() || null,
      });
      if (error) throw new Error(`Kaluston palautus epäonnistui: ${error.message}`);
      await Promise.all([refreshDomain(), loadAssignments()]);
      setReturnAssignment(null);
      setReturnNotes('');
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Kaluston palautus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const openReservation = (equipmentId = '') => {
    const start = new Date();
    start.setSeconds(0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    setSelectedEquipmentId(equipmentId);
    setReservationProjectId('');
    setReservationStart(localDateTimeInput(start));
    setReservationEnd(localDateTimeInput(end));
    setReservationStatus('Varattu');
    setReservationNotes('');
    setOperationError(null);
    setReservationDialog(true);
  };

  const saveReservation = async () => {
    if (!currentOrg || !selectedEquipmentId) {
      setOperationError('Valitse kalusto.');
      return;
    }
    const start = new Date(reservationStart);
    const end = new Date(reservationEnd);
    if (!reservationStart || !reservationEnd || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setOperationError('Anna kelvollinen varauksen alku- ja päättymisaika.');
      return;
    }
    const overlaps = resources.reservations.some((item) => {
      if (item.equipmentId !== selectedEquipmentId || INACTIVE_RESERVATION_STATUSES.has(item.status)) return false;
      return new Date(item.startsAt).getTime() < end.getTime()
        && new Date(item.endsAt).getTime() > start.getTime();
    });
    if (overlaps) {
      setOperationError('Kalusto on jo varattu valitulla ajalla.');
      return;
    }

    setSaving(true);
    setOperationError(null);
    try {
      await createEquipmentReservation({
        organizationId: currentOrg.id,
        equipmentId: selectedEquipmentId,
        projectId: reservationProjectId || undefined,
        userId: user?.id,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        status: reservationStatus,
        notes: reservationNotes,
      });
      await resources.refresh();
      setReservationDialog(false);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Varauksen tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const openMaintenance = (equipmentId = '') => {
    setSelectedEquipmentId(equipmentId);
    setMaintenanceType('Määräaikaishuolto');
    setMaintenanceStatus('Suunniteltu');
    setMaintenanceScheduledAt(today);
    setMaintenanceCompletedAt('');
    setMaintenanceCost('0');
    setMaintenanceProvider('');
    setMaintenanceDescription('');
    setOperationError(null);
    setMaintenanceDialog(true);
  };

  const saveMaintenance = async () => {
    const cost = Number(maintenanceCost.replace(',', '.'));
    if (!currentOrg || !selectedEquipmentId) {
      setOperationError('Valitse kalusto.');
      return;
    }
    if (!maintenanceType.trim()) {
      setOperationError('Huoltotyyppi on pakollinen.');
      return;
    }
    if (!Number.isFinite(cost) || cost < 0) {
      setOperationError('Kustannuksen pitää olla nolla tai positiivinen.');
      return;
    }
    if (maintenanceScheduledAt && maintenanceCompletedAt && maintenanceCompletedAt < maintenanceScheduledAt) {
      setOperationError('Valmistumispäivä ei voi olla ennen suunniteltua päivää.');
      return;
    }

    setSaving(true);
    setOperationError(null);
    try {
      await createEquipmentMaintenance({
        organizationId: currentOrg.id,
        equipmentId: selectedEquipmentId,
        userId: user?.id,
        maintenanceType,
        status: maintenanceStatus,
        scheduledAt: maintenanceScheduledAt,
        completedAt: maintenanceCompletedAt,
        costCents: Math.round(cost * 100),
        provider: maintenanceProvider,
        description: maintenanceDescription,
      });
      await resources.refresh();
      setMaintenanceDialog(false);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Huollon tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const removeReservation = async () => {
    if (!currentOrg || !deleteReservation) return;
    setSaving(true);
    try {
      await deleteEquipmentReservation(currentOrg.id, deleteReservation.id);
      await resources.refresh();
      setDeleteReservation(null);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const removeMaintenance = async () => {
    if (!currentOrg || !deleteMaintenance) return;
    setSaving(true);
    try {
      await deleteEquipmentMaintenance(currentOrg.id, deleteMaintenance.id);
      await resources.refresh();
      setDeleteMaintenance(null);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const rows = equipment.map((item) => {
      const assignment = activeAssignmentByEquipment.get(item.id);
      return [
        item.name,
        item.type,
        item.assetNumber ?? '',
        item.serial,
        item.location,
        item.status,
        assignment ? employeeById.get(assignment.employeeId)?.name ?? '' : '',
        item.lastMaintenance,
        item.nextMaintenance ?? '',
        (item.hourlyCostCents ?? 0) / 100,
      ];
    });
    const csv = [
      ['Nimi', 'Tyyppi', 'Kalustonumero', 'Sarjanumero', 'Sijainti', 'Tila', 'Haltija', 'Viimeisin huolto', 'Seuraava huolto', 'Tuntikustannus EUR'],
      ...rows,
    ].map((row) => row.map(csvCell).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `kalusto-${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-hero text-text-primary">Kalusto, haltijat, varaukset ja huollot</h1>
          <p className="mt-1 text-body-sm text-text-secondary">
            Työkalujen ja koneiden sijainti, henkilövastuu, käyttö, varaukset, kustannukset ja huoltohistoria
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={openEquipmentCreate}><Plus size={16} className="mr-2" /> Lisää kalusto</Button>
          <Button variant="outline" onClick={exportCsv}><Download size={16} className="mr-2" /> CSV</Button>
        </div>
      </div>

      {(resources.error || operationError) && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} />{operationError ?? resources.error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: 'Kalustoa', value: equipment.length, icon: Wrench },
          { label: 'Työntekijöillä', value: activeAssignmentByEquipment.size, icon: Users },
          { label: 'Vapaana', value: equipment.filter((item) => item.status === 'Vapaa').length, icon: CheckCircle2 },
          { label: 'Aktiivisia varauksia', value: activeReservations.length, icon: Calendar },
          { label: 'Huoltokustannukset', value: money(maintenanceCostTotal), icon: Wrench },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-5">
              <div className="flex justify-between text-sm text-text-secondary">
                <span>{item.label}</span><item.icon size={18} className="text-primary" />
              </div>
              <p className="mt-2 break-words font-mono text-2xl font-bold">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="equipment" className="space-y-4">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="equipment">Kalusto</TabsTrigger>
          <TabsTrigger value="assignments">Haltijahistoria ({assignments.length})</TabsTrigger>
          <TabsTrigger value="reservations">Varaukset ({resources.reservations.length})</TabsTrigger>
          <TabsTrigger value="maintenance">Huollot ({resources.maintenance.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="equipment" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="relative sm:col-span-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Hae kalustoa tai haltijaa…"
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Kaikki">Kaikki tilat</SelectItem>
                {EQUIPMENT_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={holderFilter} onValueChange={setHolderFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Kaikki">Kaikki haltijat</SelectItem>
                <SelectItem value="assigned">Työntekijällä</SelectItem>
                <SelectItem value="unassigned">Ei haltijaa</SelectItem>
                {activeEmployees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {filteredEquipment.map((item) => {
                const reservation = activeReservations.find((entry) => entry.equipmentId === item.id);
                const nextMaintenance = nextMaintenanceByEquipment.get(item.id);
                const assignment = activeAssignmentByEquipment.get(item.id);
                const holder = assignment ? employeeById.get(assignment.employeeId) : undefined;
                return (
                  <div key={item.id} className="grid gap-3 border-b px-5 py-4 xl:grid-cols-[1.2fr_1fr_1fr_1fr_120px_220px] xl:items-center">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-text-secondary">
                        {item.type} · {item.assetNumber || item.serial || 'Ei tunnistetta'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm">{item.location || 'Ei sijaintia'}</p>
                      <p className="text-xs text-text-secondary">
                        {reservation
                          ? `Varattu: ${projectById.get(reservation.projectId ?? '')?.name ?? 'ei projektia'}`
                          : 'Ei aktiivista varausta'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{holder?.name ?? 'Ei henkilökohtaista haltijaa'}</p>
                      <p className="text-xs text-text-secondary">
                        {assignment ? `Luovutettu ${dateTime(assignment.assignedAt)}` : 'Yrityksen yhteinen kalusto'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm">Huollettu {item.lastMaintenance || '—'}</p>
                      <p className="text-xs text-text-secondary">
                        {nextMaintenance?.scheduledAt
                          ? `Seuraava ${nextMaintenance.scheduledAt}`
                          : item.nextMaintenance
                            ? `Seuraava ${item.nextMaintenance}`
                            : 'Ei suunniteltua huoltoa'}
                      </p>
                    </div>
                    <div>{statusBadge(item.status)}</div>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button variant="ghost" size="sm" title={assignment ? 'Siirrä toiselle työntekijälle' : 'Luovuta työntekijälle'} onClick={() => openAssignment(item.id)}>
                        <UserRoundCheck size={15} />
                      </Button>
                      {assignment && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Merkitse palautetuksi"
                          onClick={() => {
                            setReturnAssignment(assignment);
                            setReturnNotes('');
                            setOperationError(null);
                          }}
                        >
                          <RotateCcw size={15} />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" title="Varaa" onClick={() => openReservation(item.id)}><Calendar size={14} /></Button>
                      <Button variant="ghost" size="sm" title="Lisää huolto" onClick={() => openMaintenance(item.id)}><Wrench size={14} /></Button>
                      <Button variant="ghost" size="sm" title="Muokkaa" onClick={() => openEquipmentEdit(item)}><Edit3 size={14} /></Button>
                      <Button variant="ghost" size="sm" title="Poista" className="text-red-600" onClick={() => setDeleteEquipment(item)}><Trash2 size={14} /></Button>
                    </div>
                  </div>
                );
              })}
              {!filteredEquipment.length && (
                <div className="p-12 text-center">
                  <Wrench size={44} className="mx-auto mb-3 text-text-muted" />
                  <p className="font-semibold">Ei hakuehtoja vastaavaa kalustoa</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <Card><CardContent className="p-0">
            {assignments.map((item) => {
              const equipmentItem = equipmentById.get(item.equipmentId);
              const employee = employeeById.get(item.employeeId);
              return (
                <div key={item.id} className="grid gap-3 border-b px-5 py-4 lg:grid-cols-[1.2fr_1fr_1fr_130px] lg:items-center">
                  <div>
                    <p className="font-semibold">{equipmentItem?.name ?? 'Poistettu kalusto'}</p>
                    <p className="text-xs text-text-secondary">{equipmentItem?.assetNumber || equipmentItem?.serial || 'Ei tunnistetta'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{employee?.name ?? 'Poistettu työntekijä'}</p>
                    <p className="text-xs text-text-secondary">{item.notes || 'Ei luovutushuomiota'}</p>
                  </div>
                  <div className="text-sm">
                    <p>Luovutettu {dateTime(item.assignedAt)}</p>
                    <p className="text-xs text-text-secondary">
                      {item.returnedAt ? `Palautettu ${dateTime(item.returnedAt)}` : 'Edelleen työntekijällä'}
                    </p>
                  </div>
                  <Badge variant={item.returnedAt ? 'outline' : 'default'}>
                    {item.returnedAt ? 'Palautettu' : 'Aktiivinen'}
                  </Badge>
                </div>
              );
            })}
            {!assignments.length && !assignmentsLoading && (
              <div className="p-12 text-center">
                <History size={44} className="mx-auto mb-3 text-text-muted" />
                <p className="font-semibold">Ei kaluston luovutuksia</p>
              </div>
            )}
            {assignmentsLoading && <div className="p-8 text-center text-sm text-text-secondary">Haltijatietoja ladataan…</div>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="reservations" className="space-y-4">
          <div className="flex justify-end"><Button onClick={() => openReservation()}><Plus size={16} className="mr-2" /> Uusi varaus</Button></div>
          <Card><CardContent className="p-0">
            {resources.reservations.map((item) => (
              <div key={item.id} className="grid gap-3 border-b px-5 py-4 lg:grid-cols-[1.2fr_1fr_1.2fr_120px_60px] lg:items-center">
                <div>
                  <p className="font-semibold">{equipmentById.get(item.equipmentId)?.name ?? 'Tuntematon kalusto'}</p>
                  <p className="text-xs text-text-secondary">{projectById.get(item.projectId ?? '')?.name ?? 'Ei projektia'}</p>
                </div>
                <span className="text-sm">{dateTime(item.startsAt)}</span>
                <span className="text-sm">{dateTime(item.endsAt)}</span>
                <Badge variant="outline">{item.status}</Badge>
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteReservation(item)}><Trash2 size={14} /></Button>
              </div>
            ))}
            {!resources.reservations.length && <div className="p-12 text-center"><Calendar size={44} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei varauksia</p></div>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <div className="flex justify-end"><Button onClick={() => openMaintenance()}><Plus size={16} className="mr-2" /> Uusi huolto</Button></div>
          <Card><CardContent className="p-0">
            {resources.maintenance.map((item) => (
              <div key={item.id} className="grid gap-3 border-b px-5 py-4 lg:grid-cols-[1.2fr_1fr_130px_120px_60px] lg:items-center">
                <div>
                  <p className="font-semibold">{equipmentById.get(item.equipmentId)?.name ?? 'Tuntematon kalusto'}</p>
                  <p className="text-xs text-text-secondary">{item.maintenanceType} · {item.provider || 'Ei palveluntarjoajaa'}</p>
                </div>
                <span className="text-sm">{item.scheduledAt || item.completedAt || '—'}</span>
                <span className="font-mono text-sm">{money(item.costCents / 100)}</span>
                <Badge variant="outline">{item.status}</Badge>
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteMaintenance(item)}><Trash2 size={14} /></Button>
              </div>
            ))}
            {!resources.maintenance.length && <div className="p-12 text-center"><Wrench size={44} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei huoltoja</p></div>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={equipmentDialog} onOpenChange={setEquipmentDialog}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editingEquipment ? 'Muokkaa kalustoa' : 'Lisää kalusto'}</DialogTitle></DialogHeader>
          {errors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.map((item) => <p key={item}>{item}</p>)}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Nimi *</Label><Input value={equipmentForm.name} onChange={(event) => setEquipmentForm((previous) => ({ ...previous, name: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Tyyppi *</Label><Input value={equipmentForm.type} onChange={(event) => setEquipmentForm((previous) => ({ ...previous, type: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Kalustonumero</Label><Input value={equipmentForm.assetNumber} onChange={(event) => setEquipmentForm((previous) => ({ ...previous, assetNumber: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Sarjanumero</Label><Input value={equipmentForm.serial} onChange={(event) => setEquipmentForm((previous) => ({ ...previous, serial: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Malli</Label><Input value={equipmentForm.model} onChange={(event) => setEquipmentForm((previous) => ({ ...previous, model: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Valmistusvuosi</Label><Input inputMode="numeric" value={equipmentForm.year} onChange={(event) => setEquipmentForm((previous) => ({ ...previous, year: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Sijainti</Label><Input value={equipmentForm.location} onChange={(event) => setEquipmentForm((previous) => ({ ...previous, location: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Tila</Label><Select value={equipmentForm.status} onValueChange={(status: EquipmentStatus) => setEquipmentForm((previous) => ({ ...previous, status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EQUIPMENT_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Nykyinen projekti</Label><Select value={equipmentForm.currentProjectId || 'none'} onValueChange={(value) => setEquipmentForm((previous) => ({ ...previous, currentProjectId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei projektia</SelectItem>{projects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Viimeisin huolto</Label><Input type="date" value={equipmentForm.lastMaintenance} onChange={(event) => setEquipmentForm((previous) => ({ ...previous, lastMaintenance: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Seuraava huolto</Label><Input type="date" value={equipmentForm.nextMaintenance} onChange={(event) => setEquipmentForm((previous) => ({ ...previous, nextMaintenance: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Hankintahinta €</Label><Input inputMode="decimal" value={equipmentForm.acquisitionCost} onChange={(event) => setEquipmentForm((previous) => ({ ...previous, acquisitionCost: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Tuntikustannus €</Label><Input inputMode="decimal" value={equipmentForm.hourlyCost} onChange={(event) => setEquipmentForm((previous) => ({ ...previous, hourlyCost: event.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEquipmentDialog(false)}>Peruuta</Button><Button onClick={() => void saveEquipment()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignmentDialog} onOpenChange={setAssignmentDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Luovuta kalusto työntekijälle</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-surface-subtle p-3 text-sm">
              <p className="font-medium">{equipmentById.get(selectedEquipmentId)?.name ?? 'Valitse kalusto'}</p>
              <p className="text-text-secondary">Nykyinen haltija: {activeAssignmentByEquipment.get(selectedEquipmentId) ? employeeById.get(activeAssignmentByEquipment.get(selectedEquipmentId)?.employeeId ?? '')?.name ?? 'Tuntematon' : 'ei haltijaa'}</p>
            </div>
            <div className="space-y-2"><Label>Työntekijä / asentaja *</Label><Select value={assignmentEmployeeId} onValueChange={setAssignmentEmployeeId}><SelectTrigger><SelectValue placeholder="Valitse työntekijä" /></SelectTrigger><SelectContent>{activeEmployees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.name} · {employee.role || 'Työntekijä'}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Luovutushuomio</Label><Textarea value={assignmentNotes} onChange={(event) => setAssignmentNotes(event.target.value)} placeholder="Esimerkiksi mukana toimitetut akut, laturi tai kunto luovutushetkellä" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAssignmentDialog(false)}>Peruuta</Button><Button onClick={() => void saveAssignment()} disabled={saving || !assignmentEmployeeId}>{saving ? 'Tallennetaan…' : 'Luovuta'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(returnAssignment)} onOpenChange={(open) => { if (!open) setReturnAssignment(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Merkitse kalusto palautetuksi</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              {equipmentById.get(returnAssignment?.equipmentId ?? '')?.name ?? 'Kalusto'} poistetaan työntekijän {employeeById.get(returnAssignment?.employeeId ?? '')?.name ?? 'haltijan'} hallusta. Aiempi luovutus jää historiaan.
            </p>
            <div className="space-y-2"><Label>Palautushuomio</Label><Textarea value={returnNotes} onChange={(event) => setReturnNotes(event.target.value)} placeholder="Esimerkiksi palautuskunto, puutteet tai huoltotarve" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setReturnAssignment(null)}>Peruuta</Button><Button onClick={() => void saveReturn()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Merkitse palautetuksi'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reservationDialog} onOpenChange={setReservationDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Uusi kalustovaraus</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Kalusto *</Label><Select value={selectedEquipmentId} onValueChange={setSelectedEquipmentId}><SelectTrigger><SelectValue placeholder="Valitse kalusto" /></SelectTrigger><SelectContent>{equipment.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Projekti</Label><Select value={reservationProjectId || 'none'} onValueChange={(value) => setReservationProjectId(value === 'none' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei projektia</SelectItem>{projects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Tila</Label><Select value={reservationStatus} onValueChange={setReservationStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{RESERVATION_STATUSES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Alkaa</Label><Input type="datetime-local" value={reservationStart} onChange={(event) => setReservationStart(event.target.value)} /></div>
            <div className="space-y-2"><Label>Päättyy</Label><Input type="datetime-local" value={reservationEnd} onChange={(event) => setReservationEnd(event.target.value)} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Huomiot</Label><Textarea value={reservationNotes} onChange={(event) => setReservationNotes(event.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setReservationDialog(false)}>Peruuta</Button><Button onClick={() => void saveReservation()} disabled={saving}>Tallenna</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={maintenanceDialog} onOpenChange={setMaintenanceDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Uusi huolto</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Kalusto *</Label><Select value={selectedEquipmentId} onValueChange={setSelectedEquipmentId}><SelectTrigger><SelectValue placeholder="Valitse kalusto" /></SelectTrigger><SelectContent>{equipment.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Huoltotyyppi *</Label><Input value={maintenanceType} onChange={(event) => setMaintenanceType(event.target.value)} /></div>
            <div className="space-y-2"><Label>Tila</Label><Select value={maintenanceStatus} onValueChange={setMaintenanceStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MAINTENANCE_STATUSES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Suunniteltu</Label><Input type="date" value={maintenanceScheduledAt} onChange={(event) => setMaintenanceScheduledAt(event.target.value)} /></div>
            <div className="space-y-2"><Label>Valmistunut</Label><Input type="date" value={maintenanceCompletedAt} onChange={(event) => setMaintenanceCompletedAt(event.target.value)} /></div>
            <div className="space-y-2"><Label>Kustannus €</Label><Input inputMode="decimal" value={maintenanceCost} onChange={(event) => setMaintenanceCost(event.target.value)} /></div>
            <div className="space-y-2"><Label>Palveluntarjoaja</Label><Input value={maintenanceProvider} onChange={(event) => setMaintenanceProvider(event.target.value)} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Kuvaus</Label><Textarea value={maintenanceDescription} onChange={(event) => setMaintenanceDescription(event.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setMaintenanceDialog(false)}>Peruuta</Button><Button onClick={() => void saveMaintenance()} disabled={saving}>Tallenna</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteEquipment || deleteReservation || deleteMaintenance)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteEquipment(null);
            setDeleteReservation(null);
            setDeleteMaintenance(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poistetaanko tieto?</AlertDialogTitle>
            <AlertDialogDescription>Poistoa ei voi perua.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Peruuta</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteEquipment
                ? void removeEquipment()
                : deleteReservation
                  ? void removeReservation()
                  : void removeMaintenance()}
            >
              Poista
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
