import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Award,
  Calendar,
  Download,
  Edit3,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserRoundCheck,
  Users,
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
import { useOrganizationAdmin } from '@/hooks/useOrganizationAdmin';
import { useResourceManagement } from '@/hooks/useResourceManagement';
import logger from '@/lib/logger';
import { localDateIso } from '@/lib/localDateTime';
import {
  listEmployeeSupervisorAssignments,
  setEmployeeSupervisor,
  type EmployeeSupervisorAssignment,
} from '@/lib/supabase/employeeSupervisors';
import {
  createEmployeeRecord,
  deleteEmployeeRecord,
  updateEmployeeRecord,
} from '@/lib/supabase/organizationEntities';
import {
  createEmployeeAbsence,
  createEmployeeCertification,
  deleteEmployeeAbsence,
  deleteEmployeeCertification,
  type EmployeeAbsence,
  type EmployeeCertification,
} from '@/lib/supabase/resourceManagement';
import type { Employee, EmployeeStatus } from '@/types';

const NONE = 'none';
const EMPLOYEE_STATUSES: EmployeeStatus[] = [
  'Aktiivinen',
  'Lomalla',
  'Sairas',
  'Koulutuksessa',
  'Eroonnut',
];
const CERTIFICATION_TYPES = [
  'Työturvallisuuskortti',
  'Tulityökortti',
  'Ensiapu',
  'Märkätila-asentaja',
  'Asbestityölupa',
  'Muu',
];
const ABSENCE_TYPES = ['Loma', 'Sairaus', 'Koulutus', 'Palkaton vapaa', 'Muu'];

interface EmployeeForm {
  name: string;
  role: string;
  department: string;
  phone: string;
  email: string;
  startDate: string;
  status: EmployeeStatus;
  hourlyCost: string;
  employmentType: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

const emptyEmployee: EmployeeForm = {
  name: '',
  role: '',
  department: '',
  phone: '',
  email: '',
  startDate: '',
  status: 'Aktiivinen',
  hourlyCost: '',
  employmentType: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
};

function statusBadge(status: EmployeeStatus) {
  const classes: Record<EmployeeStatus, string> = {
    Aktiivinen: 'bg-emerald-50 text-emerald-700',
    Lomalla: 'bg-amber-50 text-amber-700',
    Sairas: 'bg-red-50 text-red-700',
    Koulutuksessa: 'bg-blue-50 text-blue-700',
    Eroonnut: 'bg-slate-100 text-slate-600',
  };
  return <Badge className={`border-0 ${classes[status]}`}>{status}</Badge>;
}

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function dateLabel(value?: string) {
  if (!value) return '—';
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

export default function HenkilostoIntegrated() {
  const { user } = useAuth();
  const { currentOrg, actualRole } = useOrganization();
  const { employees, refresh: refreshDomain } = useAppDataContext();
  const { members, loading: membersLoading, error: membersError } = useOrganizationAdmin();
  const resources = useResourceManagement();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Kaikki');
  const [employeeDialog, setEmployeeDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteEmployee, setDeleteEmployee] = useState<Employee | null>(null);
  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>(emptyEmployee);

  const [supervisorAssignments, setSupervisorAssignments] = useState<EmployeeSupervisorAssignment[]>([]);
  const [selectedSupervisorUserId, setSelectedSupervisorUserId] = useState(NONE);
  const [supervisorsLoading, setSupervisorsLoading] = useState(false);

  const [certDialog, setCertDialog] = useState(false);
  const [absenceDialog, setAbsenceDialog] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [certType, setCertType] = useState(CERTIFICATION_TYPES[0]);
  const [certNumber, setCertNumber] = useState('');
  const [certIssuer, setCertIssuer] = useState('');
  const [certIssuedAt, setCertIssuedAt] = useState('');
  const [certExpiresAt, setCertExpiresAt] = useState('');
  const [certNotes, setCertNotes] = useState('');

  const [absenceType, setAbsenceType] = useState(ABSENCE_TYPES[0]);
  const [absenceStart, setAbsenceStart] = useState('');
  const [absenceEnd, setAbsenceEnd] = useState('');
  const [absenceNotes, setAbsenceNotes] = useState('');

  const [deleteCertification, setDeleteCertification] = useState<EmployeeCertification | null>(null);
  const [deleteAbsence, setDeleteAbsence] = useState<EmployeeAbsence | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canManageSupervisors = actualRole === 'admin' || actualRole === 'supervisor';
  const today = localDateIso();
  const nextMonthDate = new Date();
  nextMonthDate.setDate(nextMonthDate.getDate() + 30);
  const nextMonthIso = localDateIso(nextMonthDate);

  const supervisors = useMemo(
    () => members
      .filter((member) => member.role === 'supervisor')
      .map((member) => ({
        userId: member.userId,
        name: member.profile?.full_name || member.profile?.email || 'Nimetön työnjohtaja',
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fi')),
    [members],
  );

  const supervisorNameByUserId = useMemo(
    () => new Map(supervisors.map((supervisor) => [supervisor.userId, supervisor.name])),
    [supervisors],
  );

  const supervisorByEmployeeId = useMemo(
    () => new Map(supervisorAssignments.map((assignment) => [
      assignment.employeeId,
      assignment.supervisorUserId,
    ])),
    [supervisorAssignments],
  );

  const refreshSupervisorAssignments = useCallback(async () => {
    if (!currentOrg || !canManageSupervisors) {
      setSupervisorAssignments([]);
      return;
    }

    setSupervisorsLoading(true);
    try {
      setSupervisorAssignments(await listEmployeeSupervisorAssignments(currentOrg.id));
    } catch (caught) {
      setOperationError(
        caught instanceof Error ? caught.message : 'Esihenkilösuhteiden haku epäonnistui.',
      );
    } finally {
      setSupervisorsLoading(false);
    }
  }, [canManageSupervisors, currentOrg]);

  useEffect(() => {
    void refreshSupervisorAssignments();
  }, [refreshSupervisorAssignments]);

  useEffect(() => {
    if (!employeeDialog || !editingEmployee) return;
    setSelectedSupervisorUserId(supervisorByEmployeeId.get(editingEmployee.id) ?? NONE);
  }, [editingEmployee, employeeDialog, supervisorByEmployeeId]);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fi');
    return employees.filter((employee) => {
      const supervisorName = supervisorNameByUserId.get(
        supervisorByEmployeeId.get(employee.id) ?? '',
      ) ?? '';
      const matchesSearch = !query || [
        employee.name,
        employee.role,
        employee.department,
        employee.email,
        supervisorName,
      ].some((value) => value.toLocaleLowerCase('fi').includes(query));
      return matchesSearch && (statusFilter === 'Kaikki' || employee.status === statusFilter);
    });
  }, [employees, search, statusFilter, supervisorByEmployeeId, supervisorNameByUserId]);

  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );

  const expiring = resources.certifications.filter(
    (item) => item.expiresAt && item.expiresAt >= today && item.expiresAt <= nextMonthIso,
  );
  const expired = resources.certifications.filter(
    (item) => item.expiresAt && item.expiresAt < today,
  );
  const activeAbsences = resources.absences.filter(
    (item) => item.startDate <= today && item.endDate >= today && item.status !== 'Peruttu',
  );

  const openEmployeeCreate = () => {
    setEditingEmployee(null);
    setEmployeeForm(emptyEmployee);
    setSelectedSupervisorUserId(NONE);
    setErrors([]);
    setOperationError(null);
    setEmployeeDialog(true);
  };

  const openEmployeeEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setEmployeeForm({
      name: employee.name,
      role: employee.role,
      department: employee.department,
      phone: employee.phone,
      email: employee.email,
      startDate: employee.startDate,
      status: employee.status,
      hourlyCost: employee.hourlyCostCents == null ? '' : String(employee.hourlyCostCents / 100),
      employmentType: employee.employmentType ?? '',
      emergencyContactName: employee.emergencyContactName ?? '',
      emergencyContactPhone: employee.emergencyContactPhone ?? '',
    });
    setSelectedSupervisorUserId(supervisorByEmployeeId.get(employee.id) ?? NONE);
    setErrors([]);
    setOperationError(null);
    setEmployeeDialog(true);
  };

  const saveEmployee = async () => {
    const hourlyCost = employeeForm.hourlyCost === ''
      ? undefined
      : Number(employeeForm.hourlyCost.replace(',', '.'));
    const nextErrors: string[] = [];

    if (!employeeForm.name.trim()) nextErrors.push('Nimi on pakollinen.');
    if (!employeeForm.role.trim()) nextErrors.push('Tehtävä on pakollinen.');
    if (!employeeForm.department.trim()) nextErrors.push('Osasto on pakollinen.');
    if (employeeForm.email && !/^\S+@\S+\.\S+$/.test(employeeForm.email)) {
      nextErrors.push('Sähköpostiosoite ei ole kelvollinen.');
    }
    if (hourlyCost !== undefined && (!Number.isFinite(hourlyCost) || hourlyCost < 0)) {
      nextErrors.push('Tuntikustannuksen pitää olla nolla tai positiivinen.');
    }
    setErrors(nextErrors);
    if (nextErrors.length || !currentOrg) return;

    const payload: Omit<Employee, 'id'> = {
      name: employeeForm.name.trim(),
      role: employeeForm.role.trim(),
      department: employeeForm.department.trim(),
      phone: employeeForm.phone.trim(),
      email: employeeForm.email.trim(),
      startDate: employeeForm.startDate,
      status: employeeForm.status,
      hourlyCostCents: hourlyCost == null ? undefined : Math.round(hourlyCost * 100),
      employmentType: employeeForm.employmentType.trim() || undefined,
      emergencyContactName: employeeForm.emergencyContactName.trim() || undefined,
      emergencyContactPhone: employeeForm.emergencyContactPhone.trim() || undefined,
      projects: editingEmployee?.projects ?? 0,
      hours: editingEmployee?.hours ?? 0,
      training: editingEmployee?.training ?? 0,
      certifications: editingEmployee?.certifications ?? [],
    };

    setSaving(true);
    setOperationError(null);
    try {
      if (editingEmployee) {
        await updateEmployeeRecord(currentOrg.id, editingEmployee.id, payload);
        if (canManageSupervisors) {
          await setEmployeeSupervisor({
            organizationId: currentOrg.id,
            employeeId: editingEmployee.id,
            supervisorUserId: selectedSupervisorUserId === NONE ? null : selectedSupervisorUserId,
          });
        }
      } else {
        await createEmployeeRecord(currentOrg.id, user?.id, payload);
      }
      await Promise.all([refreshDomain(), refreshSupervisorAssignments()]);
      setEmployeeDialog(false);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tallennus epäonnistui.');
      logger.error('Henkilön tallennus epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  const removeEmployee = async () => {
    if (!currentOrg || !deleteEmployee) return;
    setSaving(true);
    setOperationError(null);
    try {
      await deleteEmployeeRecord(currentOrg.id, deleteEmployee.id);
      await Promise.all([refreshDomain(), resources.refresh(), refreshSupervisorAssignments()]);
      setDeleteEmployee(null);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const openCertification = (employeeId = '') => {
    setSelectedEmployeeId(employeeId);
    setCertType(CERTIFICATION_TYPES[0]);
    setCertNumber('');
    setCertIssuer('');
    setCertIssuedAt('');
    setCertExpiresAt('');
    setCertNotes('');
    setOperationError(null);
    setCertDialog(true);
  };

  const saveCertification = async () => {
    if (!currentOrg || !selectedEmployeeId) {
      setOperationError('Valitse henkilö.');
      return;
    }
    if (certIssuedAt && certExpiresAt && certExpiresAt < certIssuedAt) {
      setOperationError('Voimassaolo ei voi päättyä ennen myöntämispäivää.');
      return;
    }

    setSaving(true);
    setOperationError(null);
    try {
      await createEmployeeCertification({
        organizationId: currentOrg.id,
        employeeId: selectedEmployeeId,
        userId: user?.id,
        certificationType: certType,
        certificationNumber: certNumber,
        issuer: certIssuer,
        issuedAt: certIssuedAt,
        expiresAt: certExpiresAt,
        notes: certNotes,
      });
      await resources.refresh();
      setCertDialog(false);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Pätevyyden tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const openAbsence = (employeeId = '') => {
    setSelectedEmployeeId(employeeId);
    setAbsenceType(ABSENCE_TYPES[0]);
    setAbsenceStart(today);
    setAbsenceEnd(today);
    setAbsenceNotes('');
    setOperationError(null);
    setAbsenceDialog(true);
  };

  const saveAbsence = async () => {
    if (!currentOrg || !selectedEmployeeId) {
      setOperationError('Valitse henkilö.');
      return;
    }
    if (!absenceStart || !absenceEnd || absenceEnd < absenceStart) {
      setOperationError('Anna kelvollinen poissaolojakso.');
      return;
    }

    setSaving(true);
    setOperationError(null);
    try {
      await createEmployeeAbsence({
        organizationId: currentOrg.id,
        employeeId: selectedEmployeeId,
        userId: user?.id,
        approvedBy: user?.id,
        absenceType,
        startDate: absenceStart,
        endDate: absenceEnd,
        notes: absenceNotes,
      });
      await resources.refresh();
      setAbsenceDialog(false);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poissaolon tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const removeCertification = async () => {
    if (!currentOrg || !deleteCertification) return;
    setSaving(true);
    try {
      await deleteEmployeeCertification(currentOrg.id, deleteCertification.id);
      await resources.refresh();
      setDeleteCertification(null);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const removeAbsence = async () => {
    if (!currentOrg || !deleteAbsence) return;
    setSaving(true);
    try {
      await deleteEmployeeAbsence(currentOrg.id, deleteAbsence.id);
      await resources.refresh();
      setDeleteAbsence(null);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const rows = employees.map((employee) => {
      const supervisorUserId = supervisorByEmployeeId.get(employee.id);
      return [
        employee.name,
        employee.role,
        employee.department,
        employee.phone,
        employee.email,
        employee.startDate,
        employee.status,
        employee.employmentType ?? '',
        supervisorUserId ? supervisorNameByUserId.get(supervisorUserId) ?? '' : '',
        (employee.hourlyCostCents ?? 0) / 100,
      ];
    });
    const csv = [
      ['Nimi', 'Tehtävä', 'Osasto', 'Puhelin', 'Sähköposti', 'Aloittanut', 'Tila', 'Työsuhde', 'Esihenkilö', 'Tuntikustannus EUR'],
      ...rows,
    ].map((row) => row.map(csvCell).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `henkilosto-${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-hero text-text-primary">Henkilöstö ja pätevyydet</h1>
          <p className="mt-1 text-body-sm text-text-secondary">Henkilörekisteri, osaamiset, kortit, voimassaolot ja poissaolot</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={openEmployeeCreate}><Plus size={16} className="mr-2" /> Lisää henkilö</Button>
          <Button variant="outline" onClick={exportCsv}><Download size={16} className="mr-2" /> CSV</Button>
        </div>
      </div>

      {(resources.error || operationError || membersError) && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} />{operationError ?? resources.error ?? membersError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Henkilöstö', value: employees.length, icon: Users },
          { label: 'Aktiivisena', value: employees.filter((item) => item.status === 'Aktiivinen').length, icon: UserCheck },
          { label: 'Pätevyyksiä vanhenee', value: expiring.length, icon: Award },
          { label: 'Poissa tänään', value: activeAbsences.length, icon: Calendar },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-5">
              <div className="flex justify-between text-sm text-text-secondary"><span>{item.label}</span><item.icon size={18} className="text-primary" /></div>
              <p className="mt-2 font-mono text-3xl font-bold">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="people" className="space-y-4">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="people">Henkilöt</TabsTrigger>
          <TabsTrigger value="certifications">Pätevyydet ({resources.certifications.length})</TabsTrigger>
          <TabsTrigger value="absences">Poissaolot ({resources.absences.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1 sm:max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hae nimellä, tehtävällä, osastolla tai esihenkilöllä…" className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Kaikki">Kaikki tilat</SelectItem>{EMPLOYEE_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Card className="overflow-hidden"><CardContent className="p-0">
            {filteredEmployees.map((employee) => {
              const certCount = resources.certifications.filter((item) => item.employeeId === employee.id).length;
              const absent = activeAbsences.some((item) => item.employeeId === employee.id);
              const supervisorUserId = supervisorByEmployeeId.get(employee.id);
              const supervisorName = supervisorUserId ? supervisorNameByUserId.get(supervisorUserId) ?? 'Työnjohtaja' : null;
              return (
                <div key={employee.id} className="grid gap-3 border-b px-5 py-4 lg:grid-cols-[1.2fr_1fr_1fr_130px_170px] lg:items-center">
                  <div><p className="font-semibold">{employee.name}</p><p className="text-xs text-text-secondary">{employee.email || 'Ei sähköpostia'}</p></div>
                  <div>
                    <p className="text-sm">{employee.role}</p>
                    <p className="text-xs text-text-secondary">{employee.department}{employee.employmentType ? ` · ${employee.employmentType}` : ''}</p>
                    {canManageSupervisors && <p className="mt-1 flex items-center gap-1 text-xs text-text-muted"><UserRoundCheck size={12} />Esihenkilö: {supervisorName ?? 'ei nimetty'}</p>}
                  </div>
                  <div className="text-xs text-text-secondary">{employee.phone && <p className="flex items-center gap-1"><Phone size={12} />{employee.phone}</p>}{employee.email && <p className="flex items-center gap-1"><Mail size={12} />{employee.email}</p>}</div>
                  <div>{statusBadge(employee.status)}{absent && <Badge className="ml-1 border-0 bg-amber-50 text-amber-700">Poissa</Badge>}<p className="mt-1 text-xs text-text-muted">{certCount} pätevyyttä</p></div>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button variant="ghost" size="sm" aria-label={`Lisää pätevyys henkilölle ${employee.name}`} onClick={() => openCertification(employee.id)}><Award size={14} /></Button>
                    <Button variant="ghost" size="sm" aria-label={`Lisää poissaolo henkilölle ${employee.name}`} onClick={() => openAbsence(employee.id)}><Calendar size={14} /></Button>
                    <Button variant="ghost" size="sm" aria-label={`Muokkaa henkilöä ${employee.name}`} onClick={() => openEmployeeEdit(employee)}><Edit3 size={14} /></Button>
                    <Button variant="ghost" size="sm" aria-label={`Poista henkilö ${employee.name}`} className="text-red-600" onClick={() => setDeleteEmployee(employee)}><Trash2 size={14} /></Button>
                  </div>
                </div>
              );
            })}
            {!filteredEmployees.length && <div className="p-12 text-center"><Users size={44} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei henkilöstöä</p></div>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="certifications" className="space-y-4">
          <div className="flex justify-end"><Button onClick={() => openCertification()}><Plus size={16} className="mr-2" /> Lisää pätevyys</Button></div>
          {(expired.length > 0 || expiring.length > 0) && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><strong>Huomio:</strong> {expired.length} pätevyyttä on vanhentunut ja {expiring.length} vanhenee 30 päivän sisällä.</div>}
          <Card><CardContent className="p-0">
            {resources.certifications.map((item) => {
              const employee = employeeById.get(item.employeeId);
              const isExpired = Boolean(item.expiresAt && item.expiresAt < today);
              const isExpiring = Boolean(item.expiresAt && item.expiresAt >= today && item.expiresAt <= nextMonthIso);
              return (
                <div key={item.id} className="grid gap-3 border-b px-5 py-4 lg:grid-cols-[1.2fr_1fr_160px_130px_60px] lg:items-center">
                  <div><p className="font-semibold">{item.certificationType}</p><p className="text-xs text-text-secondary">{employee?.name ?? 'Tuntematon henkilö'} · {item.certificationNumber || 'Ei numeroa'}</p></div>
                  <span className="text-sm">{item.issuer || '—'}</span>
                  <span className="text-sm">{dateLabel(item.issuedAt)} – {dateLabel(item.expiresAt)}</span>
                  <div>{isExpired ? <Badge className="border-0 bg-red-50 text-red-700">Vanhentunut</Badge> : isExpiring ? <Badge className="border-0 bg-amber-50 text-amber-700">Vanhenee pian</Badge> : <Badge className="border-0 bg-emerald-50 text-emerald-700">Voimassa</Badge>}</div>
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteCertification(item)}><Trash2 size={14} /></Button>
                </div>
              );
            })}
            {!resources.certifications.length && <div className="p-12 text-center"><Award size={44} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei pätevyyksiä</p></div>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="absences" className="space-y-4">
          <div className="flex justify-end"><Button onClick={() => openAbsence()}><Plus size={16} className="mr-2" /> Lisää poissaolo</Button></div>
          <Card><CardContent className="p-0">
            {resources.absences.map((item) => (
              <div key={item.id} className="grid gap-3 border-b px-5 py-4 lg:grid-cols-[1.2fr_1fr_180px_120px_60px] lg:items-center">
                <div><p className="font-semibold">{employeeById.get(item.employeeId)?.name ?? 'Tuntematon henkilö'}</p><p className="text-xs text-text-secondary">{item.notes || 'Ei lisätietoja'}</p></div>
                <span>{item.absenceType}</span>
                <span>{dateLabel(item.startDate)} – {dateLabel(item.endDate)}</span>
                <Badge variant="outline">{item.status}</Badge>
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteAbsence(item)}><Trash2 size={14} /></Button>
              </div>
            ))}
            {!resources.absences.length && <div className="p-12 text-center"><Calendar size={44} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei poissaoloja</p></div>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={employeeDialog} onOpenChange={setEmployeeDialog}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editingEmployee ? 'Henkilön asetukset' : 'Lisää henkilö'}</DialogTitle></DialogHeader>
          {errors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.map((item) => <p key={item}>{item}</p>)}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Nimi *</Label><Input value={employeeForm.name} onChange={(event) => setEmployeeForm((previous) => ({ ...previous, name: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Tehtävä *</Label><Input value={employeeForm.role} onChange={(event) => setEmployeeForm((previous) => ({ ...previous, role: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Osasto *</Label><Input value={employeeForm.department} onChange={(event) => setEmployeeForm((previous) => ({ ...previous, department: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Puhelin</Label><Input value={employeeForm.phone} onChange={(event) => setEmployeeForm((previous) => ({ ...previous, phone: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Sähköposti</Label><Input value={employeeForm.email} onChange={(event) => setEmployeeForm((previous) => ({ ...previous, email: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Aloituspäivä</Label><Input type="date" value={employeeForm.startDate} onChange={(event) => setEmployeeForm((previous) => ({ ...previous, startDate: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Tila</Label><Select value={employeeForm.status} onValueChange={(status: EmployeeStatus) => setEmployeeForm((previous) => ({ ...previous, status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EMPLOYEE_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Työsuhdetyyppi</Label><Input value={employeeForm.employmentType} onChange={(event) => setEmployeeForm((previous) => ({ ...previous, employmentType: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Tuntikustannus €</Label><Input inputMode="decimal" value={employeeForm.hourlyCost} onChange={(event) => setEmployeeForm((previous) => ({ ...previous, hourlyCost: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Hätäyhteyshenkilö</Label><Input value={employeeForm.emergencyContactName} onChange={(event) => setEmployeeForm((previous) => ({ ...previous, emergencyContactName: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Hätäyhteyshenkilön puhelin</Label><Input value={employeeForm.emergencyContactPhone} onChange={(event) => setEmployeeForm((previous) => ({ ...previous, emergencyContactPhone: event.target.value }))} /></div>

            {editingEmployee && canManageSupervisors && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:col-span-2">
                <div>
                  <div className="flex items-center gap-2 font-semibold"><UserRoundCheck size={17} className="text-primary" />Esihenkilö</div>
                  <p className="mt-1 text-sm text-text-secondary">Valitse henkilölle vastuullinen työnjohtaja. Projektikoordinaattoreita ei voi nimetä esihenkilöksi.</p>
                </div>
                <Select value={selectedSupervisorUserId} onValueChange={setSelectedSupervisorUserId} disabled={membersLoading || supervisorsLoading}>
                  <SelectTrigger><SelectValue placeholder="Valitse esihenkilö" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Ei nimettyä esihenkilöä</SelectItem>
                    {supervisors.map((supervisor) => <SelectItem key={supervisor.userId} value={supervisor.userId}>{supervisor.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!editingEmployee && canManageSupervisors && <p className="rounded-lg bg-slate-50 p-3 text-sm text-text-secondary sm:col-span-2">Esihenkilö voidaan valita henkilön asetuksista sen jälkeen, kun henkilö on luotu.</p>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEmployeeDialog(false)}>Peruuta</Button><Button onClick={() => void saveEmployee()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={certDialog} onOpenChange={setCertDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Lisää pätevyys</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Henkilö *</Label><Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}><SelectTrigger><SelectValue placeholder="Valitse henkilö" /></SelectTrigger><SelectContent>{employees.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Pätevyys</Label><Select value={certType} onValueChange={setCertType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CERTIFICATION_TYPES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Numero</Label><Input value={certNumber} onChange={(event) => setCertNumber(event.target.value)} /></div>
            <div className="space-y-2"><Label>Myönnetty</Label><Input type="date" value={certIssuedAt} onChange={(event) => setCertIssuedAt(event.target.value)} /></div>
            <div className="space-y-2"><Label>Voimassa asti</Label><Input type="date" value={certExpiresAt} onChange={(event) => setCertExpiresAt(event.target.value)} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Myöntäjä</Label><Input value={certIssuer} onChange={(event) => setCertIssuer(event.target.value)} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Huomiot</Label><Textarea value={certNotes} onChange={(event) => setCertNotes(event.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCertDialog(false)}>Peruuta</Button><Button onClick={() => void saveCertification()} disabled={saving}>Tallenna</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={absenceDialog} onOpenChange={setAbsenceDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Lisää poissaolo</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Henkilö *</Label><Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}><SelectTrigger><SelectValue placeholder="Valitse henkilö" /></SelectTrigger><SelectContent>{employees.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Poissaolotyyppi</Label><Select value={absenceType} onValueChange={setAbsenceType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ABSENCE_TYPES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Alkaa</Label><Input type="date" value={absenceStart} onChange={(event) => setAbsenceStart(event.target.value)} /></div>
            <div className="space-y-2"><Label>Päättyy</Label><Input type="date" value={absenceEnd} onChange={(event) => setAbsenceEnd(event.target.value)} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Huomiot</Label><Textarea value={absenceNotes} onChange={(event) => setAbsenceNotes(event.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAbsenceDialog(false)}>Peruuta</Button><Button onClick={() => void saveAbsence()} disabled={saving}>Tallenna</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteEmployee || deleteCertification || deleteAbsence)} onOpenChange={(open) => { if (!open) { setDeleteEmployee(null); setDeleteCertification(null); setDeleteAbsence(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Poistetaanko tieto?</AlertDialogTitle><AlertDialogDescription>Poistoa ei voi perua.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Peruuta</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteEmployee ? void removeEmployee() : deleteCertification ? void removeCertification() : void removeAbsence()}>Poista</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
