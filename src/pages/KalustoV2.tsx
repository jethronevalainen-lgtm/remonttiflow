import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Download,
  Edit3,
  Eye,
  History,
  MapPin,
  PackageCheck,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserRoundCheck,
  Users,
  Wrench,
  X,
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

type WorkspaceTab = 'equipment' | 'responsibility' | 'reservations' | 'maintenance' | 'history';
type AttentionFilter = 'all' | 'attention' | 'overdue' | 'unassigned';
type MaintenanceUrgency = 'overdue' | 'soon' | 'planned' | 'none';

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

interface MaintenanceInfo {
  urgency: MaintenanceUrgency;
  date?: string;
  source?: EquipmentMaintenance;
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
    Vapaa: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Käytössä: 'border-blue-200 bg-blue-50 text-blue-700',
    Huollossa: 'border-amber-200 bg-amber-50 text-amber-700',
    Vuokralla: 'border-purple-200 bg-purple-50 text-purple-700',
  };
  return <Badge variant="outline" className={classes[status]}>{status}</Badge>;
}

function maintenanceBadge(info: MaintenanceInfo) {
  if (info.urgency === 'overdue') {
    return <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Huolto myöhässä</Badge>;
  }
  if (info.urgency === 'soon') {
    return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Huolto lähestyy</Badge>;
  }
  if (info.urgency === 'planned') {
    return <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">Huolto suunniteltu</Badge>;
  }
  return null;
}

function money(value: number) {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function dateTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

function dateLabel(value?: string) {
  if (!value) return 'Ei asetettu';
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('fi-FI', { day: 'numeric', month: 'numeric', year: 'numeric' });
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

function daysUntil(date: string, today: string) {
  const target = new Date(`${date}T12:00:00`).getTime();
  const current = new Date(`${today}T12:00:00`).getTime();
  if (!Number.isFinite(target) || !Number.isFinite(current)) return Number.POSITIVE_INFINITY;
  return Math.ceil((target - current) / 86_400_000);
}

function reservationLabel(item: EquipmentReservation, now: number) {
  const start = new Date(item.startsAt).getTime();
  const end = new Date(item.endsAt).getTime();
  if (INACTIVE_RESERVATION_STATUSES.has(item.status)) return item.status;
  if (start <= now && end >= now) return 'Käynnissä';
  if (start > now) return 'Tulossa';
  return 'Päättynyt';
}

function reservationBadge(item: EquipmentReservation, now: number) {
  const label = reservationLabel(item, now);
  const classes = label === 'Käynnissä'
    ? 'border-blue-200 bg-blue-50 text-blue-700'
    : label === 'Tulossa'
      ? 'border-violet-200 bg-violet-50 text-violet-700'
      : label === 'Päättynyt'
        ? 'border-slate-200 bg-slate-50 text-slate-600'
        : 'border-slate-200 bg-white text-slate-600';
  return <Badge variant="outline" className={classes}>{label}</Badge>;
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'neutral',
  onClick,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Wrench;
  tone?: 'neutral' | 'warning' | 'danger' | 'success';
  onClick?: () => void;
}) {
  const toneClasses = {
    neutral: 'border-border bg-card',
    warning: 'border-amber-200 bg-amber-50/60',
    danger: 'border-red-200 bg-red-50/60',
    success: 'border-emerald-200 bg-emerald-50/60',
  };
  const iconClasses = {
    neutral: 'bg-primary/10 text-primary',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700',
    success: 'bg-emerald-100 text-emerald-700',
  };

  const content = (
    <CardContent className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">{label}</p>
          <p className="mt-2 break-words font-mono text-2xl font-bold text-text-primary sm:text-3xl">{value}</p>
          <p className="mt-1 text-xs text-text-secondary">{detail}</p>
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconClasses[tone]}`}>
          <Icon size={18} />
        </span>
      </div>
    </CardContent>
  );

  if (!onClick) return <Card className={toneClasses[tone]}>{content}</Card>;
  return (
    <Card className={`${toneClasses[tone]} transition-shadow hover:shadow-md`}>
      <button type="button" className="w-full text-left" onClick={onClick}>{content}</button>
    </Card>
  );
}

function EmptyState({ icon: Icon, title, description }: {
  icon: typeof Wrench;
  title: string;
  description: string;
}) {
  return (
    <div className="px-6 py-14 text-center">
      <Icon size={42} className="mx-auto mb-3 text-text-muted" />
      <p className="font-semibold text-text-primary">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-text-secondary">{description}</p>
    </div>
  );
}

export default function KalustoV2() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const {
    equipment,
    employees,
    projects,
    refresh: refreshDomain,
  } = useAppDataContext();
  const resources = useResourceManagement();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('equipment');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Kaikki');
  const [holderFilter, setHolderFilter] = useState('Kaikki');
  const [typeFilter, setTypeFilter] = useState('Kaikki');
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>('all');
  const [equipmentDialog, setEquipmentDialog] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [detailsEquipment, setDetailsEquipment] = useState<Equipment | null>(null);
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
  const equipmentTypes = useMemo(
    () => [...new Set(equipment.map((item) => item.type).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fi')),
    [equipment],
  );

  const reservationsByEquipment = useMemo(() => {
    const result = new Map<string, EquipmentReservation[]>();
    resources.reservations.forEach((item) => {
      const current = result.get(item.equipmentId) ?? [];
      current.push(item);
      result.set(item.equipmentId, current);
    });
    result.forEach((items) => items.sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
    return result;
  }, [resources.reservations]);

  const maintenanceByEquipment = useMemo(() => {
    const result = new Map<string, EquipmentMaintenance[]>();
    resources.maintenance.forEach((item) => {
      const current = result.get(item.equipmentId) ?? [];
      current.push(item);
      result.set(item.equipmentId, current);
    });
    result.forEach((items) => items.sort((a, b) => (b.scheduledAt ?? b.completedAt ?? b.createdAt)
      .localeCompare(a.scheduledAt ?? a.completedAt ?? a.createdAt)));
    return result;
  }, [resources.maintenance]);

  const maintenanceInfoByEquipment = useMemo(() => {
    const result = new Map<string, MaintenanceInfo>();
    equipment.forEach((item) => {
      const openMaintenance = (maintenanceByEquipment.get(item.id) ?? [])
        .filter((entry) => entry.scheduledAt && !CLOSED_MAINTENANCE_STATUSES.has(entry.status))
        .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''))[0];
      const date = openMaintenance?.scheduledAt ?? item.nextMaintenance;
      if (!date) {
        result.set(item.id, { urgency: 'none' });
        return;
      }
      const days = daysUntil(date, today);
      result.set(item.id, {
        urgency: days < 0 ? 'overdue' : days <= 30 ? 'soon' : 'planned',
        date,
        source: openMaintenance,
      });
    });
    return result;
  }, [equipment, maintenanceByEquipment, today]);

  const activeReservations = useMemo(
    () => resources.reservations.filter((item) =>
      !INACTIVE_RESERVATION_STATUSES.has(item.status)
      && isInstantWithinRange(item.startsAt, item.endsAt, now),
    ),
    [now, resources.reservations],
  );

  const upcomingReservations = useMemo(
    () => resources.reservations.filter((item) =>
      !INACTIVE_RESERVATION_STATUSES.has(item.status)
      && new Date(item.startsAt).getTime() > now,
    ),
    [now, resources.reservations],
  );

  const overdueEquipment = useMemo(
    () => equipment.filter((item) => maintenanceInfoByEquipment.get(item.id)?.urgency === 'overdue'),
    [equipment, maintenanceInfoByEquipment],
  );
  const dueSoonEquipment = useMemo(
    () => equipment.filter((item) => maintenanceInfoByEquipment.get(item.id)?.urgency === 'soon'),
    [equipment, maintenanceInfoByEquipment],
  );
  const responsibilityGapEquipment = useMemo(
    () => equipment.filter((item) =>
      (item.status === 'Käytössä' || item.status === 'Vuokralla')
      && !activeAssignmentByEquipment.has(item.id),
    ),
    [activeAssignmentByEquipment, equipment],
  );
  const missingLocationEquipment = useMemo(
    () => equipment.filter((item) => !item.location.trim()),
    [equipment],
  );
  const equipmentValue = equipment.reduce((sum, item) => sum + (item.acquisitionCostCents ?? 0), 0) / 100;
  const maintenanceCostTotal = resources.maintenance.reduce((sum, item) => sum + item.costCents, 0) / 100;

  const filteredEquipment = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fi');
    return equipment
      .filter((item) => {
        const assignment = activeAssignmentByEquipment.get(item.id);
        const holderName = assignment ? employeeById.get(assignment.employeeId)?.name ?? '' : '';
        const maintenanceInfo = maintenanceInfoByEquipment.get(item.id);
        const matchesSearch = !query || [
          item.name,
          item.type,
          item.serial,
          item.location,
          item.assetNumber ?? '',
          item.model ?? '',
          holderName,
          projectById.get(item.currentProjectId ?? '')?.name ?? '',
        ].some((value) => value.toLocaleLowerCase('fi').includes(query));
        const matchesStatus = statusFilter === 'Kaikki' || item.status === statusFilter;
        const matchesType = typeFilter === 'Kaikki' || item.type === typeFilter;
        const matchesHolder = holderFilter === 'Kaikki'
          || (holderFilter === 'assigned' && Boolean(assignment))
          || (holderFilter === 'unassigned' && !assignment)
          || assignment?.employeeId === holderFilter;
        const matchesAttention = attentionFilter === 'all'
          || (attentionFilter === 'overdue' && maintenanceInfo?.urgency === 'overdue')
          || (attentionFilter === 'unassigned' && responsibilityGapEquipment.some((entry) => entry.id === item.id))
          || (attentionFilter === 'attention'
            && (maintenanceInfo?.urgency === 'overdue'
              || maintenanceInfo?.urgency === 'soon'
              || responsibilityGapEquipment.some((entry) => entry.id === item.id)
              || !item.location.trim()));
        return matchesSearch && matchesStatus && matchesType && matchesHolder && matchesAttention;
      })
      .sort((a, b) => {
        const urgencyScore = (item: Equipment) => {
          const urgency = maintenanceInfoByEquipment.get(item.id)?.urgency;
          if (urgency === 'overdue') return 0;
          if (responsibilityGapEquipment.some((entry) => entry.id === item.id)) return 1;
          if (urgency === 'soon') return 2;
          return 3;
        };
        return urgencyScore(a) - urgencyScore(b) || a.name.localeCompare(b.name, 'fi');
      });
  }, [
    activeAssignmentByEquipment,
    attentionFilter,
    employeeById,
    equipment,
    holderFilter,
    maintenanceInfoByEquipment,
    projectById,
    responsibilityGapEquipment,
    search,
    statusFilter,
    typeFilter,
  ]);

  const responsibilityGroups = useMemo(() => {
    const groups = new Map<string, Equipment[]>();
    equipment.forEach((item) => {
      const employeeId = activeAssignmentByEquipment.get(item.id)?.employeeId ?? 'unassigned';
      const current = groups.get(employeeId) ?? [];
      current.push(item);
      groups.set(employeeId, current);
    });
    const employeeGroups = activeEmployees
      .filter((employee) => groups.has(employee.id))
      .map((employee) => ({ employee, equipment: groups.get(employee.id) ?? [] }))
      .sort((a, b) => b.equipment.length - a.equipment.length || a.employee.name.localeCompare(b.employee.name, 'fi'));
    return {
      employeeGroups,
      unassigned: groups.get('unassigned') ?? [],
    };
  }, [activeAssignmentByEquipment, activeEmployees, equipment]);

  const sortedReservations = useMemo(
    () => [...resources.reservations].sort((a, b) => {
      const rank = (item: EquipmentReservation) => {
        const label = reservationLabel(item, now);
        if (label === 'Käynnissä') return 0;
        if (label === 'Tulossa') return 1;
        if (label === 'Päättynyt') return 2;
        return 3;
      };
      return rank(a) - rank(b) || a.startsAt.localeCompare(b.startsAt);
    }),
    [now, resources.reservations],
  );

  const sortedMaintenance = useMemo(
    () => [...resources.maintenance].sort((a, b) => {
      const rank = (item: EquipmentMaintenance) => {
        if (!item.scheduledAt || CLOSED_MAINTENANCE_STATUSES.has(item.status)) return 3;
        const days = daysUntil(item.scheduledAt, today);
        if (days < 0) return 0;
        if (days <= 30) return 1;
        return 2;
      };
      return rank(a) - rank(b)
        || (a.scheduledAt ?? a.completedAt ?? a.createdAt)
          .localeCompare(b.scheduledAt ?? b.completedAt ?? b.createdAt);
    }),
    [resources.maintenance, today],
  );

  const filtersActive = Boolean(search)
    || statusFilter !== 'Kaikki'
    || holderFilter !== 'Kaikki'
    || typeFilter !== 'Kaikki'
    || attentionFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('Kaikki');
    setHolderFilter('Kaikki');
    setTypeFilter('Kaikki');
    setAttentionFilter('all');
  };

  const openEquipmentCreate = () => {
    setEditingEquipment(null);
    setEquipmentForm(emptyEquipment);
    setErrors([]);
    setOperationError(null);
    setEquipmentDialog(true);
  };

  const openEquipmentEdit = (item: Equipment) => {
    setDetailsEquipment(null);
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
    setDetailsEquipment(null);
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

  const openReturn = (assignment: EquipmentAssignment) => {
    setDetailsEquipment(null);
    setReturnAssignment(assignment);
    setReturnNotes('');
    setOperationError(null);
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
    setDetailsEquipment(null);
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
    setDetailsEquipment(null);
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
      const maintenanceInfo = maintenanceInfoByEquipment.get(item.id);
      return [
        item.name,
        item.type,
        item.assetNumber ?? '',
        item.serial,
        item.model ?? '',
        item.location,
        item.status,
        assignment ? employeeById.get(assignment.employeeId)?.name ?? '' : '',
        projectById.get(item.currentProjectId ?? '')?.name ?? '',
        item.lastMaintenance,
        maintenanceInfo?.date ?? '',
        (item.acquisitionCostCents ?? 0) / 100,
        (item.hourlyCostCents ?? 0) / 100,
      ];
    });
    const csv = [
      [
        'Nimi',
        'Tyyppi',
        'Kalustonumero',
        'Sarjanumero',
        'Malli',
        'Sijainti',
        'Tila',
        'Haltija',
        'Projekti',
        'Viimeisin huolto',
        'Seuraava huolto',
        'Hankintahinta EUR',
        'Tuntikustannus EUR',
      ],
      ...rows,
    ].map((row) => row.map(csvCell).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `kalusto-${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const focusEquipment = (filter: AttentionFilter) => {
    setAttentionFilter(filter);
    setActiveTab('equipment');
  };

  const detailAssignment = detailsEquipment
    ? activeAssignmentByEquipment.get(detailsEquipment.id)
    : undefined;
  const detailHolder = detailAssignment
    ? employeeById.get(detailAssignment.employeeId)
    : undefined;
  const detailMaintenance = detailsEquipment
    ? maintenanceInfoByEquipment.get(detailsEquipment.id)
    : undefined;
  const detailReservations = detailsEquipment
    ? reservationsByEquipment.get(detailsEquipment.id) ?? []
    : [];
  const detailHistory = detailsEquipment
    ? assignments.filter((item) => item.equipmentId === detailsEquipment.id)
    : [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-8 sm:space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <Boxes size={15} /> Kalustonhallinta
          </div>
          <h1 className="text-hero text-text-primary">Tiedä missä kalusto on ja kuka siitä vastaa</h1>
          <p className="mt-2 text-body-sm text-text-secondary">
            Hallitse työkalut ja koneet yhdestä näkymästä: haltijat, työmaat, varaukset, huollot ja kustannukset.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button variant="outline" onClick={exportCsv} className="w-full sm:w-auto">
            <Download size={16} className="mr-2" /> Vie CSV
          </Button>
          <Button onClick={openEquipmentCreate} className="w-full sm:w-auto">
            <Plus size={16} className="mr-2" /> Lisää kalusto
          </Button>
        </div>
      </div>

      {(resources.error || operationError) && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Toimintoa ei voitu suorittaa</p>
            <p className="mt-0.5 break-words">{operationError ?? resources.error}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOperationError(null)} className="h-8 w-8 p-0 text-red-700">
            <X size={16} />
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Kalustoa"
          value={equipment.length}
          detail={`${equipmentTypes.length} kalustotyyppiä`}
          icon={Boxes}
          onClick={() => focusEquipment('all')}
        />
        <MetricCard
          label="Työntekijöillä"
          value={activeAssignmentByEquipment.size}
          detail={`${responsibilityGroups.employeeGroups.length} haltijalla`}
          icon={Users}
          tone="success"
          onClick={() => setActiveTab('responsibility')}
        />
        <MetricCard
          label="Huolto vaatii huomiota"
          value={overdueEquipment.length + dueSoonEquipment.length}
          detail={`${overdueEquipment.length} myöhässä, ${dueSoonEquipment.length} lähestyy`}
          icon={Wrench}
          tone={overdueEquipment.length ? 'danger' : dueSoonEquipment.length ? 'warning' : 'success'}
          onClick={() => setActiveTab('maintenance')}
        />
        <MetricCard
          label="Vastuu puuttuu"
          value={responsibilityGapEquipment.length}
          detail="Käytössä ilman nimettyä haltijaa"
          icon={UserRoundCheck}
          tone={responsibilityGapEquipment.length ? 'warning' : 'success'}
          onClick={() => focusEquipment('unassigned')}
        />
        <MetricCard
          label="Varaukset"
          value={activeReservations.length + upcomingReservations.length}
          detail={`${activeReservations.length} käynnissä, ${upcomingReservations.length} tulossa`}
          icon={Calendar}
          onClick={() => setActiveTab('reservations')}
        />
        <MetricCard
          label="Hankinta-arvo"
          value={money(equipmentValue)}
          detail={`Huoltoihin kirjattu ${money(maintenanceCostTotal)}`}
          icon={PackageCheck}
        />
      </div>

      {(overdueEquipment.length > 0 || responsibilityGapEquipment.length > 0 || missingLocationEquipment.length > 0) ? (
        <Card className="overflow-hidden border-amber-200 bg-amber-50/40">
          <CardContent className="p-0">
            <div className="border-b border-amber-200 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-700" />
                <h2 className="font-semibold text-text-primary">Hoida nämä ensin</h2>
              </div>
              <p className="mt-1 text-sm text-text-secondary">Poikkeamat, joista syntyy seisokkia, katoamisriskiä tai epäselvää vastuuta.</p>
            </div>
            <div className="grid divide-y divide-amber-200 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
              <button
                type="button"
                className="flex items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-amber-50 sm:px-5"
                onClick={() => setActiveTab('maintenance')}
              >
                <div>
                  <p className="font-medium text-text-primary">Myöhässä olevat huollot</p>
                  <p className="text-sm text-text-secondary">{overdueEquipment.length} kalustoa ei ole huollettu ajallaan</p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-amber-700" />
              </button>
              <button
                type="button"
                className="flex items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-amber-50 sm:px-5"
                onClick={() => focusEquipment('unassigned')}
              >
                <div>
                  <p className="font-medium text-text-primary">Käytössä ilman haltijaa</p>
                  <p className="text-sm text-text-secondary">{responsibilityGapEquipment.length} kaluston vastuu pitää nimetä</p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-amber-700" />
              </button>
              <button
                type="button"
                className="flex items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-amber-50 sm:px-5"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('Kaikki');
                  setHolderFilter('Kaikki');
                  setTypeFilter('Kaikki');
                  setAttentionFilter('attention');
                  setActiveTab('equipment');
                }}
              >
                <div>
                  <p className="font-medium text-text-primary">Sijainti puuttuu</p>
                  <p className="text-sm text-text-secondary">{missingLocationEquipment.length} kalustoa ilman sijaintitietoa</p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-amber-700" />
              </button>
            </div>
          </CardContent>
        </Card>
      ) : equipment.length > 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 size={20} className="shrink-0" />
          <div>
            <p className="font-semibold">Kaluston perustiedot ovat hallinnassa</p>
            <p className="text-emerald-700">Ei myöhästyneitä huoltoja, puuttuvia sijainteja tai käytössä olevaa kalustoa ilman haltijaa.</p>
          </div>
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as WorkspaceTab)} className="space-y-4">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto min-w-max justify-start p-1">
            <TabsTrigger value="equipment">Kalusto ({equipment.length})</TabsTrigger>
            <TabsTrigger value="responsibility">Vastuut ({activeAssignmentByEquipment.size})</TabsTrigger>
            <TabsTrigger value="reservations">Varaukset ({resources.reservations.length})</TabsTrigger>
            <TabsTrigger value="maintenance">Huollot ({resources.maintenance.length})</TabsTrigger>
            <TabsTrigger value="history">Luovutushistoria ({assignments.length})</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="equipment" className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-4 sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Hae nimellä, numerolla, sijainnilla, projektilla tai haltijalla…"
                    className="pl-9"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="min-w-0 lg:w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Kaikki">Kaikki tilat</SelectItem>
                      {EQUIPMENT_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="min-w-0 lg:w-[170px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Kaikki">Kaikki tyypit</SelectItem>
                      {equipmentTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={holderFilter} onValueChange={setHolderFilter}>
                    <SelectTrigger className="min-w-0 lg:w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Kaikki">Kaikki haltijat</SelectItem>
                      <SelectItem value="assigned">Työntekijällä</SelectItem>
                      <SelectItem value="unassigned">Ei haltijaa</SelectItem>
                      {activeEmployees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={attentionFilter} onValueChange={(value) => setAttentionFilter(value as AttentionFilter)}>
                    <SelectTrigger className="min-w-0 lg:w-[170px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Kaikki tilanteet</SelectItem>
                      <SelectItem value="attention">Vaatii huomiota</SelectItem>
                      <SelectItem value="overdue">Huolto myöhässä</SelectItem>
                      <SelectItem value="unassigned">Vastuu puuttuu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-text-secondary">
                <span>Näytetään {filteredEquipment.length} / {equipment.length} kalustoa</span>
                {filtersActive && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8">
                    <X size={14} className="mr-1" /> Tyhjennä rajaukset
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            {filteredEquipment.map((item) => {
              const assignment = activeAssignmentByEquipment.get(item.id);
              const holder = assignment ? employeeById.get(assignment.employeeId) : undefined;
              const maintenanceInfo = maintenanceInfoByEquipment.get(item.id) ?? { urgency: 'none' as const };
              const reservations = reservationsByEquipment.get(item.id) ?? [];
              const activeReservation = reservations.find((entry) =>
                !INACTIVE_RESERVATION_STATUSES.has(entry.status)
                && isInstantWithinRange(entry.startsAt, entry.endsAt, now));
              const nextReservation = reservations
                .filter((entry) => !INACTIVE_RESERVATION_STATUSES.has(entry.status) && new Date(entry.startsAt).getTime() > now)
                .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
              const responsibilityGap = responsibilityGapEquipment.some((entry) => entry.id === item.id);
              return (
                <Card key={item.id} className={`overflow-hidden ${maintenanceInfo.urgency === 'overdue' ? 'border-red-200' : responsibilityGap ? 'border-amber-200' : ''}`}>
                  <CardContent className="p-0">
                    <div className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {statusBadge(item.status)}
                            {maintenanceBadge(maintenanceInfo)}
                            {responsibilityGap && (
                              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Vastuu puuttuu</Badge>
                            )}
                          </div>
                          <h3 className="mt-3 break-words text-lg font-semibold text-text-primary">{item.name}</h3>
                          <p className="mt-0.5 text-sm text-text-secondary">
                            {item.type}{item.model ? ` · ${item.model}` : ''}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setDetailsEquipment(item)} className="shrink-0">
                          <Eye size={16} className="mr-2" /> Tiedot
                        </Button>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl bg-surface-subtle p-3">
                          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
                            <UserRoundCheck size={14} /> Haltija
                          </div>
                          <p className="mt-2 text-sm font-semibold text-text-primary">{holder?.name ?? 'Ei nimettyä haltijaa'}</p>
                          <p className="mt-0.5 text-xs text-text-secondary">
                            {assignment ? `Luovutettu ${dateTime(assignment.assignedAt)}` : 'Yrityksen yhteinen kalusto'}
                          </p>
                        </div>
                        <div className="rounded-xl bg-surface-subtle p-3">
                          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
                            <MapPin size={14} /> Sijainti
                          </div>
                          <p className="mt-2 text-sm font-semibold text-text-primary">{item.location || 'Sijainti puuttuu'}</p>
                          <p className="mt-0.5 text-xs text-text-secondary">
                            {projectById.get(item.currentProjectId ?? '')?.name ?? 'Ei sidottu projektiin'}
                          </p>
                        </div>
                        <div className="rounded-xl bg-surface-subtle p-3">
                          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
                            <Wrench size={14} /> Huolto
                          </div>
                          <p className="mt-2 text-sm font-semibold text-text-primary">
                            {maintenanceInfo.date ? dateLabel(maintenanceInfo.date) : 'Ei suunniteltua huoltoa'}
                          </p>
                          <p className="mt-0.5 text-xs text-text-secondary">
                            {item.lastMaintenance ? `Viimeksi ${dateLabel(item.lastMaintenance)}` : 'Ei huoltohistoriaa'}
                          </p>
                        </div>
                      </div>

                      {(activeReservation || nextReservation) && (
                        <div className="mt-3 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm">
                          <Calendar size={16} className="mt-0.5 shrink-0 text-blue-700" />
                          <div>
                            <p className="font-medium text-blue-900">
                              {activeReservation ? 'Varaus käynnissä' : 'Seuraava varaus'}
                            </p>
                            <p className="text-blue-700">
                              {projectById.get((activeReservation ?? nextReservation)?.projectId ?? '')?.name ?? 'Ei projektia'} · {' '}
                              {dateTime((activeReservation ?? nextReservation)?.startsAt ?? '')}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 border-t bg-surface-subtle/50 p-3 sm:flex sm:flex-wrap sm:justify-end">
                      <Button variant="outline" size="sm" onClick={() => openAssignment(item.id)}>
                        <UserRoundCheck size={15} className="mr-2" /> {assignment ? 'Siirrä' : 'Luovuta'}
                      </Button>
                      {assignment && (
                        <Button variant="outline" size="sm" onClick={() => openReturn(assignment)}>
                          <RotateCcw size={15} className="mr-2" /> Palauta
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => openReservation(item.id)}>
                        <Calendar size={15} className="mr-2" /> Varaa
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openMaintenance(item.id)}>
                        <Wrench size={15} className="mr-2" /> Huolto
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {!filteredEquipment.length && (
            <Card>
              <EmptyState
                icon={Search}
                title={equipment.length ? 'Rajauksilla ei löytynyt kalustoa' : 'Kalustorekisteri on tyhjä'}
                description={equipment.length
                  ? 'Muuta hakua tai poista rajauksia.'
                  : 'Lisää ensimmäinen työkalu, kone tai ajoneuvo kalustorekisteriin.'}
              />
            </Card>
          )}
        </TabsContent>

        <TabsContent value="responsibility" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="Nimetty haltija"
              value={activeAssignmentByEquipment.size}
              detail={`${equipment.length ? Math.round((activeAssignmentByEquipment.size / equipment.length) * 100) : 0} % kalustosta`}
              icon={UserRoundCheck}
              tone="success"
            />
            <MetricCard
              label="Ilman haltijaa"
              value={responsibilityGroups.unassigned.length}
              detail="Yhteinen, vapaa tai vastuuttamaton kalusto"
              icon={Boxes}
              tone={responsibilityGapEquipment.length ? 'warning' : 'neutral'}
            />
            <MetricCard
              label="Haltijoita"
              value={responsibilityGroups.employeeGroups.length}
              detail="Työntekijöitä, joilla on kalustoa"
              icon={Users}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {responsibilityGroups.employeeGroups.map(({ employee, equipment: employeeEquipment }) => (
              <Card key={employee.id}>
                <CardContent className="p-0">
                  <div className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-5">
                    <div className="min-w-0">
                      <p className="font-semibold text-text-primary">{employee.name}</p>
                      <p className="text-sm text-text-secondary">{employee.role || 'Työntekijä'} · {employee.department || 'Ei osastoa'}</p>
                    </div>
                    <Badge variant="outline">{employeeEquipment.length} kpl</Badge>
                  </div>
                  <div className="divide-y">
                    {employeeEquipment.map((item) => {
                      const assignment = activeAssignmentByEquipment.get(item.id);
                      return (
                        <div key={item.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                          <button type="button" className="min-w-0 text-left" onClick={() => setDetailsEquipment(item)}>
                            <p className="font-medium text-text-primary">{item.name}</p>
                            <p className="text-xs text-text-secondary">{item.type} · {item.assetNumber || item.serial || 'Ei tunnistetta'}</p>
                          </button>
                          <div className="grid grid-cols-2 gap-2 sm:flex">
                            <Button variant="outline" size="sm" onClick={() => openAssignment(item.id)}>Siirrä</Button>
                            {assignment && <Button variant="outline" size="sm" onClick={() => openReturn(assignment)}>Palauta</Button>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card className={responsibilityGapEquipment.length ? 'border-amber-200' : ''}>
              <CardContent className="p-0">
                <div className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-5">
                  <div>
                    <p className="font-semibold text-text-primary">Yrityksen yhteinen / ei haltijaa</p>
                    <p className="text-sm text-text-secondary">Nimeä haltija, kun kalusto siirtyy työntekijän käyttöön.</p>
                  </div>
                  <Badge variant="outline">{responsibilityGroups.unassigned.length} kpl</Badge>
                </div>
                <div className="divide-y">
                  {responsibilityGroups.unassigned.slice(0, 12).map((item) => {
                    const gap = responsibilityGapEquipment.some((entry) => entry.id === item.id);
                    return (
                      <div key={item.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                        <button type="button" className="min-w-0 text-left" onClick={() => setDetailsEquipment(item)}>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-text-primary">{item.name}</p>
                            {gap && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Vastuu puuttuu</Badge>}
                          </div>
                          <p className="text-xs text-text-secondary">{item.type} · {item.location || 'Sijainti puuttuu'}</p>
                        </button>
                        <Button variant="outline" size="sm" onClick={() => openAssignment(item.id)}>
                          <UserRoundCheck size={14} className="mr-2" /> Luovuta
                        </Button>
                      </div>
                    );
                  })}
                  {!responsibilityGroups.unassigned.length && (
                    <EmptyState icon={CheckCircle2} title="Kaikella kalustolla on haltija" description="Kaluston henkilövastuut ovat ajan tasalla." />
                  )}
                  {responsibilityGroups.unassigned.length > 12 && (
                    <button type="button" className="w-full px-5 py-3 text-left text-sm font-medium text-primary hover:bg-surface-subtle" onClick={() => focusEquipment('unassigned')}>
                      Näytä kaikki ilman haltijaa <ArrowRight size={14} className="ml-1 inline" />
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reservations" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Kalustovaraukset</h2>
              <p className="text-sm text-text-secondary">Vältä päällekkäiset varaukset ja näe, milloin kalusto vapautuu.</p>
            </div>
            <Button onClick={() => openReservation()}><Plus size={16} className="mr-2" /> Uusi varaus</Button>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {sortedReservations.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {reservationBadge(item, now)}
                        <Badge variant="outline">{item.status}</Badge>
                      </div>
                      <button type="button" className="mt-3 text-left" onClick={() => {
                        const selected = equipmentById.get(item.equipmentId);
                        if (selected) setDetailsEquipment(selected);
                      }}>
                        <h3 className="font-semibold text-text-primary">{equipmentById.get(item.equipmentId)?.name ?? 'Tuntematon kalusto'}</h3>
                        <p className="text-sm text-text-secondary">{projectById.get(item.projectId ?? '')?.name ?? 'Ei projektia'}</p>
                      </button>
                    </div>
                    <Button variant="ghost" size="sm" className="h-9 w-9 shrink-0 p-0 text-red-600" onClick={() => setDeleteReservation(item)} title="Poista varaus">
                      <Trash2 size={15} />
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-surface-subtle p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Alkaa</p>
                      <p className="mt-1 text-sm font-medium text-text-primary">{dateTime(item.startsAt)}</p>
                    </div>
                    <div className="rounded-xl bg-surface-subtle p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Päättyy</p>
                      <p className="mt-1 text-sm font-medium text-text-primary">{dateTime(item.endsAt)}</p>
                    </div>
                  </div>
                  {item.notes && <p className="mt-3 rounded-xl border p-3 text-sm text-text-secondary">{item.notes}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
          {!sortedReservations.length && (
            <Card><EmptyState icon={Calendar} title="Ei kalustovarauksia" description="Luo varaus, kun kalusto tarvitaan tietylle projektille tai ajanjaksolle." /></Card>
          )}
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Huoltosuunnitelma ja historia</h2>
              <p className="text-sm text-text-secondary">Myöhästyneet ja lähestyvät huollot näytetään ensimmäisenä.</p>
            </div>
            <Button onClick={() => openMaintenance()}><Plus size={16} className="mr-2" /> Lisää huolto</Button>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {sortedMaintenance.map((item) => {
              const equipmentItem = equipmentById.get(item.equipmentId);
              const days = item.scheduledAt ? daysUntil(item.scheduledAt, today) : Number.POSITIVE_INFINITY;
              const overdue = days < 0 && !CLOSED_MAINTENANCE_STATUSES.has(item.status);
              const soon = days >= 0 && days <= 30 && !CLOSED_MAINTENANCE_STATUSES.has(item.status);
              return (
                <Card key={item.id} className={overdue ? 'border-red-200' : soon ? 'border-amber-200' : ''}>
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{item.status}</Badge>
                          {overdue && <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Myöhässä {Math.abs(days)} pv</Badge>}
                          {soon && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">{days === 0 ? 'Tänään' : `${days} pv`}</Badge>}
                        </div>
                        <button type="button" className="mt-3 text-left" onClick={() => {
                          if (equipmentItem) setDetailsEquipment(equipmentItem);
                        }}>
                          <h3 className="font-semibold text-text-primary">{equipmentItem?.name ?? 'Tuntematon kalusto'}</h3>
                          <p className="text-sm text-text-secondary">{item.maintenanceType}</p>
                        </button>
                      </div>
                      <Button variant="ghost" size="sm" className="h-9 w-9 shrink-0 p-0 text-red-600" onClick={() => setDeleteMaintenance(item)} title="Poista huolto">
                        <Trash2 size={15} />
                      </Button>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-surface-subtle p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Ajankohta</p>
                        <p className="mt-1 text-sm font-medium text-text-primary">{dateLabel(item.scheduledAt ?? item.completedAt)}</p>
                      </div>
                      <div className="rounded-xl bg-surface-subtle p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Kustannus</p>
                        <p className="mt-1 text-sm font-medium text-text-primary">{money(item.costCents / 100)}</p>
                      </div>
                      <div className="rounded-xl bg-surface-subtle p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Tekijä</p>
                        <p className="mt-1 break-words text-sm font-medium text-text-primary">{item.provider || 'Ei määritelty'}</p>
                      </div>
                    </div>
                    {item.description && <p className="mt-3 rounded-xl border p-3 text-sm text-text-secondary">{item.description}</p>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {!sortedMaintenance.length && (
            <Card><EmptyState icon={Wrench} title="Ei huoltotietoja" description="Lisää suunnitellut huollot ja kirjaa toteutuneet huollot kustannuksineen." /></Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              {assignments.map((item) => {
                const equipmentItem = equipmentById.get(item.equipmentId);
                const employee = employeeById.get(item.employeeId);
                return (
                  <div key={item.id} className="border-b px-4 py-4 last:border-b-0 sm:px-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <button type="button" className="text-left" onClick={() => {
                          if (equipmentItem) setDetailsEquipment(equipmentItem);
                        }}>
                          <p className="font-semibold text-text-primary">{equipmentItem?.name ?? 'Poistettu kalusto'}</p>
                          <p className="text-xs text-text-secondary">{equipmentItem?.assetNumber || equipmentItem?.serial || 'Ei tunnistetta'}</p>
                        </button>
                      </div>
                      <div className="min-w-0 lg:w-1/4">
                        <p className="text-sm font-medium text-text-primary">{employee?.name ?? 'Poistettu työntekijä'}</p>
                        <p className="text-xs text-text-secondary">{item.notes || 'Ei luovutushuomiota'}</p>
                      </div>
                      <div className="text-sm text-text-primary lg:w-1/3">
                        <p>Luovutettu {dateTime(item.assignedAt)}</p>
                        <p className="text-xs text-text-secondary">
                          {item.returnedAt ? `Palautettu ${dateTime(item.returnedAt)}` : 'Edelleen työntekijällä'}
                        </p>
                        {item.returnNotes && <p className="mt-1 text-xs text-text-secondary">Palautus: {item.returnNotes}</p>}
                      </div>
                      <Badge variant={item.returnedAt ? 'outline' : 'default'}>
                        {item.returnedAt ? 'Palautettu' : 'Aktiivinen'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
              {!assignments.length && !assignmentsLoading && (
                <EmptyState icon={History} title="Ei luovutushistoriaa" description="Työntekijöille tehdyt kalustoluovutukset ja palautukset tallentuvat tähän." />
              )}
              {assignmentsLoading && <div className="p-8 text-center text-sm text-text-secondary">Haltijatietoja ladataan…</div>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(detailsEquipment)} onOpenChange={(open) => { if (!open) setDetailsEquipment(null); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{detailsEquipment?.name ?? 'Kaluston tiedot'}</DialogTitle>
          </DialogHeader>
          {detailsEquipment && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                {statusBadge(detailsEquipment.status)}
                {detailMaintenance && maintenanceBadge(detailMaintenance)}
                <Badge variant="outline">{detailsEquipment.type}</Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl bg-surface-subtle p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Haltija</p>
                  <p className="mt-2 font-semibold text-text-primary">{detailHolder?.name ?? 'Ei nimettyä haltijaa'}</p>
                  <p className="mt-1 text-xs text-text-secondary">{detailAssignment ? dateTime(detailAssignment.assignedAt) : 'Yrityksen yhteinen kalusto'}</p>
                </div>
                <div className="rounded-xl bg-surface-subtle p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Sijainti ja projekti</p>
                  <p className="mt-2 font-semibold text-text-primary">{detailsEquipment.location || 'Sijainti puuttuu'}</p>
                  <p className="mt-1 text-xs text-text-secondary">{projectById.get(detailsEquipment.currentProjectId ?? '')?.name ?? 'Ei projektia'}</p>
                </div>
                <div className="rounded-xl bg-surface-subtle p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Seuraava huolto</p>
                  <p className="mt-2 font-semibold text-text-primary">{dateLabel(detailMaintenance?.date)}</p>
                  <p className="mt-1 text-xs text-text-secondary">Viimeksi {dateLabel(detailsEquipment.lastMaintenance)}</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-text-primary">Tunnisteet ja kustannukset</h3>
                <div className="mt-3 grid gap-x-6 gap-y-3 rounded-xl border p-4 text-sm sm:grid-cols-2">
                  <div><span className="text-text-secondary">Kalustonumero:</span> <span className="font-medium">{detailsEquipment.assetNumber || '—'}</span></div>
                  <div><span className="text-text-secondary">Sarjanumero:</span> <span className="font-medium">{detailsEquipment.serial || '—'}</span></div>
                  <div><span className="text-text-secondary">Malli:</span> <span className="font-medium">{detailsEquipment.model || '—'}</span></div>
                  <div><span className="text-text-secondary">Valmistusvuosi:</span> <span className="font-medium">{detailsEquipment.year ?? '—'}</span></div>
                  <div><span className="text-text-secondary">Hankintahinta:</span> <span className="font-medium">{detailsEquipment.acquisitionCostCents == null ? '—' : money(detailsEquipment.acquisitionCostCents / 100)}</span></div>
                  <div><span className="text-text-secondary">Tuntikustannus:</span> <span className="font-medium">{detailsEquipment.hourlyCostCents == null ? '—' : money(detailsEquipment.hourlyCostCents / 100)}</span></div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <h3 className="font-semibold text-text-primary">Varaukset</h3>
                  <div className="mt-3 space-y-2">
                    {detailReservations.slice(0, 4).map((item) => (
                      <div key={item.id} className="rounded-xl border p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{projectById.get(item.projectId ?? '')?.name ?? 'Ei projektia'}</span>
                          {reservationBadge(item, now)}
                        </div>
                        <p className="mt-1 text-xs text-text-secondary">{dateTime(item.startsAt)} – {dateTime(item.endsAt)}</p>
                      </div>
                    ))}
                    {!detailReservations.length && <p className="rounded-xl border border-dashed p-4 text-sm text-text-secondary">Ei varauksia.</p>}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-text-primary">Luovutushistoria</h3>
                  <div className="mt-3 space-y-2">
                    {detailHistory.slice(0, 4).map((item) => (
                      <div key={item.id} className="rounded-xl border p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{employeeById.get(item.employeeId)?.name ?? 'Poistettu työntekijä'}</span>
                          <Badge variant={item.returnedAt ? 'outline' : 'default'}>{item.returnedAt ? 'Palautettu' : 'Aktiivinen'}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-text-secondary">Luovutettu {dateTime(item.assignedAt)}</p>
                      </div>
                    ))}
                    {!detailHistory.length && <p className="rounded-xl border border-dashed p-4 text-sm text-text-secondary">Ei luovutuksia.</p>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t pt-4 sm:flex sm:flex-wrap sm:justify-end">
                <Button variant="outline" onClick={() => openEquipmentEdit(detailsEquipment)}><Edit3 size={15} className="mr-2" /> Muokkaa</Button>
                <Button variant="outline" onClick={() => openAssignment(detailsEquipment.id)}><UserRoundCheck size={15} className="mr-2" /> {detailAssignment ? 'Siirrä' : 'Luovuta'}</Button>
                {detailAssignment && <Button variant="outline" onClick={() => openReturn(detailAssignment)}><RotateCcw size={15} className="mr-2" /> Palauta</Button>}
                <Button variant="outline" onClick={() => openReservation(detailsEquipment.id)}><Calendar size={15} className="mr-2" /> Varaa</Button>
                <Button variant="outline" onClick={() => openMaintenance(detailsEquipment.id)}><Wrench size={15} className="mr-2" /> Huolto</Button>
                <Button variant="outline" className="text-red-600" onClick={() => {
                  setDetailsEquipment(null);
                  setDeleteEquipment(detailsEquipment);
                }}><Trash2 size={15} className="mr-2" /> Poista</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={equipmentDialog} onOpenChange={setEquipmentDialog}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editingEquipment ? 'Muokkaa kalustoa' : 'Lisää kalusto'}</DialogTitle></DialogHeader>
          {errors.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errors.map((item) => <p key={item}>{item}</p>)}
            </div>
          )}
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Perustiedot</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2"><Label>Nimi *</Label><Input value={equipmentForm.name} onChange={(event) => setEquipmentForm((previous) => ({ ...previous, name: event.target.value }))} placeholder="Esimerkiksi Akkuporakone Makita" /></div>
                <div className="space-y-2"><Label>Tyyppi *</Label><Input value={equipmentForm.type} onChange={(event) => setEquipmentForm((previous) => ({ ...previous, type: event.target.value }))} placeholder="Työkalu, kone, ajoneuvo…" /></div>
                <div className="space-y-2"><Label>Tila</Label><Select value={equipmentForm.status} onValueChange={(status: EquipmentStatus) => setEquipmentForm((previous) => ({ ...previous, status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EQUIPMENT_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Malli</Label><Input value={equipmentForm.model} onChange={(event) => setEquipmentForm((previous) => ({ ...previous, model: event.target.value }))} /></div>
                <div className="space-y-2"><Label>Valmistusvuosi</Label><Input inputMode="numeric" value={equipmentForm.year} onChange={(event) => setEquipmentForm((previous) => ({ ...previous, year: event.target.value }))} /></div>
              </div>
            </div>

            <div className="border-t pt-5">
              <h3 className="text-sm font-semibold text-text-primary">Tunnisteet ja sijainti</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Kalustonumero</Label><Input value={equipmentForm.assetNumber} onChange={(event) => setEquipmentForm((previous) => ({ ...previous, assetNumber: event.target.value }))} placeholder="Yrityksen oma tunniste" /></div>
                <div className="space-y-2"><Label>Sarjanumero</Label><Input value={equipmentForm.serial} onChange={(event) => setEquipmentForm((previous) => ({ ...previous, serial: event.target.value }))} /></div>
                <div className="space-y-2"><Label>Sijainti</Label><Input value={equipmentForm.location} onChange={(event) => setEquipmentForm((previous) => ({ ...previous, location: event.target.value }))} placeholder="Varasto, auto tai työmaa" /></div>
                <div className="space-y-2"><Label>Nykyinen projekti</Label><Select value={equipmentForm.currentProjectId || 'none'} onValueChange={(value) => setEquipmentForm((previous) => ({ ...previous, currentProjectId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei projektia</SelectItem>{projects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
              </div>
            </div>

            <div className="border-t pt-5">
              <h3 className="text-sm font-semibold text-text-primary">Huolto ja kustannukset</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Viimeisin huolto</Label><Input type="date" value={equipmentForm.lastMaintenance} onChange={(event) => setEquipmentForm((previous) => ({ ...previous, lastMaintenance: event.target.value }))} /></div>
                <div className="space-y-2"><Label>Seuraava huolto</Label><Input type="date" value={equipmentForm.nextMaintenance} onChange={(event) => setEquipmentForm((previous) => ({ ...previous, nextMaintenance: event.target.value }))} /></div>
                <div className="space-y-2"><Label>Hankintahinta €</Label><Input inputMode="decimal" value={equipmentForm.acquisitionCost} onChange={(event) => setEquipmentForm((previous) => ({ ...previous, acquisitionCost: event.target.value }))} /></div>
                <div className="space-y-2"><Label>Tuntikustannus €</Label><Input inputMode="decimal" value={equipmentForm.hourlyCost} onChange={(event) => setEquipmentForm((previous) => ({ ...previous, hourlyCost: event.target.value }))} /></div>
              </div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEquipmentDialog(false)}>Peruuta</Button><Button onClick={() => void saveEquipment()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna kalusto'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignmentDialog} onOpenChange={setAssignmentDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>{activeAssignmentByEquipment.get(selectedEquipmentId) ? 'Siirrä kalusto toiselle työntekijälle' : 'Luovuta kalusto työntekijälle'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border bg-surface-subtle p-4 text-sm">
              <p className="font-semibold text-text-primary">{equipmentById.get(selectedEquipmentId)?.name ?? 'Valitse kalusto'}</p>
              <p className="mt-1 text-text-secondary">Nykyinen haltija: {activeAssignmentByEquipment.get(selectedEquipmentId) ? employeeById.get(activeAssignmentByEquipment.get(selectedEquipmentId)?.employeeId ?? '')?.name ?? 'Tuntematon' : 'ei haltijaa'}</p>
            </div>
            <div className="space-y-2"><Label>Työntekijä / asentaja *</Label><Select value={assignmentEmployeeId} onValueChange={setAssignmentEmployeeId}><SelectTrigger><SelectValue placeholder="Valitse työntekijä" /></SelectTrigger><SelectContent>{activeEmployees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.name} · {employee.role || 'Työntekijä'}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Luovutushuomio</Label><Textarea value={assignmentNotes} onChange={(event) => setAssignmentNotes(event.target.value)} placeholder="Mukana olevat akut, laturi, laukku ja kunto luovutushetkellä" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAssignmentDialog(false)}>Peruuta</Button><Button onClick={() => void saveAssignment()} disabled={saving || !assignmentEmployeeId}>{saving ? 'Tallennetaan…' : 'Vahvista luovutus'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(returnAssignment)} onOpenChange={(open) => { if (!open) setReturnAssignment(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Palauta kalusto yritykselle</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border bg-surface-subtle p-4 text-sm">
              <p className="font-semibold text-text-primary">{equipmentById.get(returnAssignment?.equipmentId ?? '')?.name ?? 'Kalusto'}</p>
              <p className="mt-1 text-text-secondary">Haltija: {employeeById.get(returnAssignment?.employeeId ?? '')?.name ?? 'Tuntematon'}. Luovutus säilyy historiassa.</p>
            </div>
            <div className="space-y-2"><Label>Palautuskunto ja puutteet</Label><Textarea value={returnNotes} onChange={(event) => setReturnNotes(event.target.value)} placeholder="Kunto, puuttuvat osat, akut tai havaittu huoltotarve" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setReturnAssignment(null)}>Peruuta</Button><Button onClick={() => void saveReturn()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Vahvista palautus'}</Button></DialogFooter>
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
            <div className="space-y-2 sm:col-span-2"><Label>Huomiot</Label><Textarea value={reservationNotes} onChange={(event) => setReservationNotes(event.target.value)} placeholder="Käyttötarkoitus, noutopaikka tai muu varaukseen liittyvä tieto" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setReservationDialog(false)}>Peruuta</Button><Button onClick={() => void saveReservation()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna varaus'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={maintenanceDialog} onOpenChange={setMaintenanceDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Lisää huolto</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Kalusto *</Label><Select value={selectedEquipmentId} onValueChange={setSelectedEquipmentId}><SelectTrigger><SelectValue placeholder="Valitse kalusto" /></SelectTrigger><SelectContent>{equipment.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Huoltotyyppi *</Label><Input value={maintenanceType} onChange={(event) => setMaintenanceType(event.target.value)} placeholder="Määräaikaishuolto, korjaus…" /></div>
            <div className="space-y-2"><Label>Tila</Label><Select value={maintenanceStatus} onValueChange={setMaintenanceStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MAINTENANCE_STATUSES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Suunniteltu</Label><Input type="date" value={maintenanceScheduledAt} onChange={(event) => setMaintenanceScheduledAt(event.target.value)} /></div>
            <div className="space-y-2"><Label>Valmistunut</Label><Input type="date" value={maintenanceCompletedAt} onChange={(event) => setMaintenanceCompletedAt(event.target.value)} /></div>
            <div className="space-y-2"><Label>Kustannus €</Label><Input inputMode="decimal" value={maintenanceCost} onChange={(event) => setMaintenanceCost(event.target.value)} /></div>
            <div className="space-y-2"><Label>Huoltoliike / tekijä</Label><Input value={maintenanceProvider} onChange={(event) => setMaintenanceProvider(event.target.value)} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Kuvaus</Label><Textarea value={maintenanceDescription} onChange={(event) => setMaintenanceDescription(event.target.value)} placeholder="Mitä huolletaan, havaittu vika ja tehdyt toimenpiteet" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setMaintenanceDialog(false)}>Peruuta</Button><Button onClick={() => void saveMaintenance()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna huolto'}</Button></DialogFooter>
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
            <AlertDialogDescription>
              {deleteEquipment
                ? `Kalusto “${deleteEquipment.name}” poistetaan rekisteristä. Poistoa ei voi perua.`
                : deleteReservation
                  ? 'Varaus poistetaan. Poistoa ei voi perua.'
                  : 'Huoltotieto poistetaan. Poistoa ei voi perua.'}
            </AlertDialogDescription>
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
