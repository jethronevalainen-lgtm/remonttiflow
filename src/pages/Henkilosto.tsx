import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Calendar,
  Download,
  Edit3,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  createEmployeeRecord,
  deleteEmployeeRecord,
  updateEmployeeRecord,
} from '@/lib/supabase/organizationEntities';
import logger from '@/lib/logger';
import type { Employee, EmployeeStatus } from '@/types';

const ALL = 'Kaikki';
const EMPLOYEE_STATUSES: EmployeeStatus[] = [
  'Aktiivinen',
  'Lomalla',
  'Sairas',
  'Koulutuksessa',
  'Eroonnut',
];

interface EmployeeForm {
  name: string;
  role: string;
  department: string;
  phone: string;
  email: string;
  startDate: string;
  status: EmployeeStatus;
}

const emptyForm: EmployeeForm = {
  name: '',
  role: '',
  department: '',
  phone: '',
  email: '',
  startDate: '',
  status: 'Aktiivinen',
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

export default function Henkilosto() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { employees, refresh } = useAppDataContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);

  const filteredEmployees = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesSearch =
        !query ||
        employee.name.toLowerCase().includes(query) ||
        employee.role.toLowerCase().includes(query) ||
        employee.department.toLowerCase().includes(query) ||
        employee.email.toLowerCase().includes(query);
      const matchesStatus = statusFilter === ALL || employee.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [employees, searchQuery, statusFilter]);

  const departmentCount = new Set(
    employees.map((employee) => employee.department).filter(Boolean),
  ).size;
  const unavailableCount = employees.filter(
    (employee) => employee.status === 'Lomalla' || employee.status === 'Sairas',
  ).length;

  const openCreate = () => {
    setEditingEmployee(null);
    setForm(emptyForm);
    setErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const openEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setForm({
      name: employee.name,
      role: employee.role,
      department: employee.department,
      phone: employee.phone,
      email: employee.email,
      startDate: employee.startDate,
      status: employee.status,
    });
    setErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const saveEmployee = async () => {
    const nextErrors: string[] = [];
    if (!form.name.trim()) nextErrors.push('Nimi on pakollinen.');
    if (!form.role.trim()) nextErrors.push('Tehtävä on pakollinen.');
    if (!form.department.trim()) nextErrors.push('Osasto on pakollinen.');
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.push('Sähköpostiosoite ei ole kelvollinen.');
    setErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg) return;

    const payload: Omit<Employee, 'id'> = {
      name: form.name.trim(),
      role: form.role.trim(),
      department: form.department.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      startDate: form.startDate,
      status: form.status,
      projects: 0,
      hours: 0,
      training: 0,
      certifications: [],
    };

    setSaving(true);
    setOperationError(null);
    try {
      if (editingEmployee) {
        await updateEmployeeRecord(currentOrg.id, editingEmployee.id, payload);
      } else {
        await createEmployeeRecord(currentOrg.id, user?.id, payload);
      }
      await refresh();
      setDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tallennus epäonnistui.';
      setOperationError(message);
      logger.error('Henkilöstötietojen tallennus epäonnistui', { error });
    } finally {
      setSaving(false);
    }
  };

  const removeEmployee = async () => {
    if (!deleteTarget || !currentOrg) return;
    setSaving(true);
    setOperationError(null);
    try {
      await deleteEmployeeRecord(currentOrg.id, deleteTarget.id);
      await refresh();
      setDeleteTarget(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Poistaminen epäonnistui.';
      setOperationError(message);
      logger.error('Henkilön poistaminen epäonnistui', { error });
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const rows = employees.map((employee) => [
      employee.name,
      employee.role,
      employee.department,
      employee.phone,
      employee.email,
      employee.startDate,
      employee.status,
    ]);
    const csv = [
      ['Nimi', 'Tehtävä', 'Osasto', 'Puhelin', 'Sähköposti', 'Aloittanut', 'Tila'],
      ...rows,
    ].map((row) => row.map(csvCell).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `henkilosto-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-hero text-text-primary">Henkilöstö</h1>
          <p className="mt-1 text-body-sm text-text-secondary">Organisaation työntekijät ja yhteystiedot</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreate} className="gap-2"><Plus size={16} /> Lisää henkilö</Button>
          <Button variant="outline" onClick={exportCsv} disabled={employees.length === 0} className="gap-2"><Download size={16} /> Vie CSV</Button>
        </div>
      </div>

      {operationError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} /> {operationError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Henkilöstö yhteensä', value: employees.length, icon: Users },
          { label: 'Aktiivisena', value: employees.filter((employee) => employee.status === 'Aktiivinen').length, icon: UserCheck },
          { label: 'Poissa', value: unavailableCount, icon: Calendar },
          { label: 'Osastoja', value: departmentCount, icon: Users },
        ].map((item) => (
          <Card key={item.label} className="border-slate-200 shadow-card">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between"><span className="text-xs uppercase tracking-wider text-text-secondary">{item.label}</span><item.icon size={19} className="text-primary" /></div>
              <p className="font-mono text-3xl font-bold text-text-primary">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 sm:max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Hae nimellä, tehtävällä tai osastolla…" className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>Kaikki tilat</SelectItem>{EMPLOYEE_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden border-slate-200 shadow-card">
        <CardContent className="p-0">
          <div className="hidden grid-cols-[1.2fr_1fr_1fr_1fr_110px_90px] gap-4 border-b bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted lg:grid">
            <span>Henkilö</span><span>Tehtävä</span><span>Osasto</span><span>Yhteystiedot</span><span>Tila</span><span className="text-right">Toiminnot</span>
          </div>
          {filteredEmployees.map((employee) => (
            <div key={employee.id} className="grid grid-cols-1 items-center gap-3 border-b border-slate-100 px-6 py-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr_110px_90px] lg:gap-4">
              <div><p className="font-semibold text-text-primary">{employee.name}</p><p className="text-xs text-text-secondary">Aloittanut {employee.startDate || '—'}</p></div>
              <span className="text-sm text-text-primary">{employee.role}</span>
              <span className="text-sm text-text-secondary">{employee.department}</span>
              <div className="space-y-1 text-xs text-text-secondary">
                {employee.phone && <p className="flex items-center gap-1"><Phone size={12} />{employee.phone}</p>}
                {employee.email && <p className="flex items-center gap-1 truncate"><Mail size={12} />{employee.email}</p>}
                {!employee.phone && !employee.email && <span>Ei yhteystietoja</span>}
              </div>
              <div>{statusBadge(employee.status)}</div>
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(employee)} aria-label={`Muokkaa ${employee.name}`}><Edit3 size={15} /></Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-danger" onClick={() => setDeleteTarget(employee)} aria-label={`Poista ${employee.name}`}><Trash2 size={15} /></Button>
              </div>
            </div>
          ))}
          {filteredEmployees.length === 0 && <div className="p-12 text-center"><Users size={44} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei henkilöstöä</p><p className="mt-1 text-sm text-text-secondary">Lisää ensimmäinen henkilö tai muuta hakuehtoja.</p></div>}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>{editingEmployee ? 'Muokkaa henkilöä' : 'Lisää henkilö'}</DialogTitle></DialogHeader>
          {errors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="employee-name">Nimi *</Label><Input id="employee-name" value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="employee-role">Tehtävä *</Label><Input id="employee-role" value={form.role} onChange={(event) => setForm((previous) => ({ ...previous, role: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="employee-department">Osasto *</Label><Input id="employee-department" value={form.department} onChange={(event) => setForm((previous) => ({ ...previous, department: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="employee-phone">Puhelin</Label><Input id="employee-phone" value={form.phone} onChange={(event) => setForm((previous) => ({ ...previous, phone: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="employee-email">Sähköposti</Label><Input id="employee-email" type="email" value={form.email} onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="employee-start">Aloituspäivä</Label><Input id="employee-start" type="date" value={form.startDate} onChange={(event) => setForm((previous) => ({ ...previous, startDate: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Tila</Label><Select value={form.status} onValueChange={(value: EmployeeStatus) => setForm((previous) => ({ ...previous, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EMPLOYEE_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void saveEmployee()} disabled={saving}>{saving ? 'Tallennetaan…' : editingEmployee ? 'Tallenna muutokset' : 'Lisää henkilö'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Poista henkilö</DialogTitle></DialogHeader>
          <p className="text-sm text-text-secondary">Poistetaanko <strong>{deleteTarget?.name}</strong> henkilöstörekisteristä?</p>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={saving}>Peruuta</Button><Button variant="destructive" onClick={() => void removeEmployee()} disabled={saving}>{saving ? 'Poistetaan…' : 'Poista'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
