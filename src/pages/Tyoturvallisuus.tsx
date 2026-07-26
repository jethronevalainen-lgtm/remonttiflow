import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Edit3,
  GraduationCap,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import logger from '@/lib/logger';
import {
  createSafetyItemRecord,
  deleteSafetyItemRecord,
  updateSafetyItemRecord,
} from '@/lib/supabase/workforceEntities';
import type { SafetyItem, SafetyItemSeverity, SafetyItemType } from '@/types';

const SAFETY_TYPES: Array<{ value: SafetyItemType; label: string }> = [
  { value: 'risk', label: 'Turvallisuushavainto' },
  { value: 'incident', label: 'Tapaturma / läheltä piti' },
  { value: 'inspection', label: 'Turvallisuustarkastus' },
  { value: 'training', label: 'Perehdytys / koulutus' },
];
const SEVERITIES: SafetyItemSeverity[] = ['Lievä', 'Keskitasoinen', 'Vakava'];
const STATUSES = [
  'Avoin',
  'Arvioitu',
  'Osoitettu',
  'Korjattavana',
  'Ilmoitettu korjatuksi',
  'Vahvistettu',
  'Suljettu',
] as const;

interface SafetyForm {
  type: SafetyItemType;
  title: string;
  description: string;
  date: string;
  projectId: string;
  project: string;
  location: string;
  severity: SafetyItemSeverity | 'Ei määritelty';
  status: string;
  assigneeUserId: string;
  assignee: string;
  dueDate: string;
  rootCause: string;
  correctiveAction: string;
  preventiveAction: string;
}

const emptyForm: SafetyForm = {
  type: 'risk',
  title: '',
  description: '',
  date: new Date().toISOString().slice(0, 10),
  projectId: '',
  project: '',
  location: '',
  severity: 'Keskitasoinen',
  status: 'Avoin',
  assigneeUserId: '',
  assignee: '',
  dueDate: '',
  rootCause: '',
  correctiveAction: '',
  preventiveAction: '',
};

function typeLabel(type: SafetyItemType) {
  return SAFETY_TYPES.find((item) => item.value === type)?.label ?? type;
}

function typeIcon(type: SafetyItemType) {
  switch (type) {
    case 'incident': return AlertTriangle;
    case 'inspection': return ClipboardCheck;
    case 'training': return GraduationCap;
    default: return ShieldCheck;
  }
}

function statusBadge(status: string) {
  const className = status === 'Suljettu' || status === 'Vahvistettu'
    ? 'bg-emerald-50 text-emerald-700'
    : status === 'Ilmoitettu korjatuksi' || status === 'Korjattavana'
      ? 'bg-amber-50 text-amber-700'
      : status === 'Avoin'
        ? 'bg-red-50 text-red-700'
        : 'bg-blue-50 text-blue-700';
  return <Badge className={`border-0 ${className}`}>{status || 'Avoin'}</Badge>;
}

function severityBadge(severity: SafetyItemSeverity | undefined) {
  if (!severity) return <span className="text-xs text-text-muted">—</span>;
  const classes: Record<SafetyItemSeverity, string> = {
    Lievä: 'bg-blue-50 text-blue-700',
    Keskitasoinen: 'bg-amber-50 text-amber-700',
    Vakava: 'bg-red-50 text-red-700',
  };
  return <Badge className={`border-0 ${classes[severity]}`}>{severity}</Badge>;
}

export default function Tyoturvallisuus() {
  const { user } = useAuth();
  const { currentOrg, currentRole } = useOrganization();
  const { safetyItems, projects, refresh } = useAppDataContext();
  const { people } = useRoleWorkspace();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('Kaikki');
  const [statusFilter, setStatusFilter] = useState('Kaikki');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SafetyItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SafetyItem | null>(null);
  const [form, setForm] = useState<SafetyForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canManage = currentRole === 'admin' || currentRole === 'supervisor';
  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fi');
    return safetyItems.filter((item) => {
      const matchesSearch = !query || [
        item.title,
        item.description ?? '',
        item.project ?? '',
        item.location ?? '',
        item.assignee ?? '',
      ].some((value) => value.toLocaleLowerCase('fi').includes(query));
      return matchesSearch
        && (typeFilter === 'Kaikki' || item.type === typeFilter)
        && (statusFilter === 'Kaikki' || item.status === statusFilter);
    });
  }, [safetyItems, search, statusFilter, typeFilter]);

  const openItems = safetyItems.filter((item) => !['Suljettu', 'Vahvistettu'].includes(item.status));
  const seriousCount = openItems.filter((item) => item.severity === 'Vakava').length;
  const overdueCount = openItems.filter((item) => item.dueDate && item.dueDate < new Date().toISOString().slice(0, 10)).length;
  const waitingVerification = safetyItems.filter((item) => item.status === 'Ilmoitettu korjatuksi').length;

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) });
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const openEdit = (item: SafetyItem) => {
    if (!canManage) return;
    setEditing(item);
    setForm({
      type: item.type,
      title: item.title,
      description: item.description ?? '',
      date: /^\d{4}-/.test(item.date) ? item.date : '',
      projectId: item.projectId ?? '',
      project: item.project ?? '',
      location: item.location ?? '',
      severity: item.severity ?? 'Ei määritelty',
      status: item.status || 'Avoin',
      assigneeUserId: item.assigneeUserId ?? '',
      assignee: item.assignee ?? '',
      dueDate: item.dueDate ?? '',
      rootCause: item.rootCause ?? '',
      correctiveAction: item.correctiveAction ?? '',
      preventiveAction: item.preventiveAction ?? '',
    });
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const selectProject = (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    setForm((previous) => ({ ...previous, projectId, project: project?.name ?? previous.project }));
  };

  const selectAssignee = (userId: string) => {
    const person = people.find((item) => item.userId === userId);
    setForm((previous) => ({ ...previous, assigneeUserId: userId, assignee: person?.name ?? '' }));
  };

  const save = async () => {
    const nextErrors: string[] = [];
    if (!form.title.trim()) nextErrors.push('Otsikko on pakollinen.');
    if (!form.description.trim()) nextErrors.push('Tapahtuma tai havainto on kuvattava.');
    if (!form.date) nextErrors.push('Päivämäärä on pakollinen.');
    if (!form.project.trim()) nextErrors.push('Projekti on pakollinen.');
    if (['Osoitettu', 'Korjattavana', 'Ilmoitettu korjatuksi'].includes(form.status) && !form.assigneeUserId) {
      nextErrors.push('Valitse vastuuhenkilö.');
    }
    if (form.status === 'Ilmoitettu korjatuksi' && !form.correctiveAction.trim()) {
      nextErrors.push('Kirjaa tehty korjaava toimenpide.');
    }
    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg) return;

    const payload: Omit<SafetyItem, 'id'> = {
      type: form.type,
      title: form.title.trim(),
      description: form.description.trim(),
      date: form.date,
      projectId: form.projectId || undefined,
      project: form.project.trim(),
      location: form.location.trim() || undefined,
      severity: form.severity === 'Ei määritelty' ? undefined : form.severity,
      status: canManage ? form.status : 'Avoin',
      assigneeUserId: form.assigneeUserId || undefined,
      assignee: form.assignee.trim() || undefined,
      dueDate: form.dueDate || undefined,
      rootCause: form.rootCause.trim() || undefined,
      correctiveAction: form.correctiveAction.trim() || undefined,
      preventiveAction: form.preventiveAction.trim() || undefined,
      resolvedAt: ['Ilmoitettu korjatuksi', 'Vahvistettu', 'Suljettu'].includes(form.status)
        ? editing?.resolvedAt ?? new Date().toISOString()
        : undefined,
      verifiedAt: ['Vahvistettu', 'Suljettu'].includes(form.status) ? new Date().toISOString() : undefined,
      verifiedBy: ['Vahvistettu', 'Suljettu'].includes(form.status) ? user?.id : undefined,
    };

    setSaving(true);
    setOperationError(null);
    try {
      if (editing) await updateSafetyItemRecord(currentOrg.id, editing.id, payload);
      else await createSafetyItemRecord(currentOrg.id, user?.id, payload);
      await refresh();
      setDialogOpen(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Tallennus epäonnistui.';
      setOperationError(message);
      logger.error('Turvallisuusasian tallennus epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  const quickStatus = async (item: SafetyItem, status: string) => {
    if (!currentOrg || !canManage) return;
    setSaving(true);
    setOperationError(null);
    try {
      await updateSafetyItemRecord(currentOrg.id, item.id, {
        status,
        verifiedAt: status === 'Vahvistettu' ? new Date().toISOString() : undefined,
        verifiedBy: status === 'Vahvistettu' ? user?.id : undefined,
      });
      await refresh();
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tilan päivitys epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async () => {
    if (!currentOrg || !deleteTarget || !canManage) return;
    setSaving(true);
    try {
      await deleteSafetyItemRecord(currentOrg.id, deleteTarget.id);
      await refresh();
      setDeleteTarget(null);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-hero text-text-primary">Työturvallisuus</h1><p className="mt-1 text-body-sm text-text-secondary">Havainnosta vastuuhenkilölle, korjaukseen ja varmennettuun sulkemiseen</p></div><Button onClick={openCreate} className="gap-2"><Plus size={16} /> Uusi havainto</Button></div>
      {operationError && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={16} />{operationError}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        { label: 'Avoimet asiat', value: openItems.length, icon: AlertTriangle },
        { label: 'Vakavat avoimet', value: seriousCount, icon: AlertCircle },
        { label: 'Myöhässä', value: overdueCount, icon: ClipboardCheck },
        { label: 'Varmennettavana', value: waitingVerification, icon: CheckCircle2 },
      ].map((item) => <Card key={item.label}><CardContent className="p-5"><div className="mb-2 flex justify-between text-sm text-text-secondary"><span>{item.label}</span><item.icon size={18} className="text-primary" /></div><p className="font-mono text-3xl font-bold">{item.value}</p></CardContent></Card>)}</div>

      <div className="grid gap-3 sm:grid-cols-[1fr_210px_230px]"><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hae kuvauksesta, projektista tai vastuuhenkilöstä…" className="pl-9" /></div><Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Kaikki">Kaikki tyypit</SelectItem>{SAFETY_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Kaikki">Kaikki tilat</SelectItem>{STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>

      <div className="space-y-3">{filteredItems.map((item) => { const Icon = typeIcon(item.type); const overdue = item.dueDate && item.dueDate < new Date().toISOString().slice(0, 10) && !['Vahvistettu','Suljettu'].includes(item.status); return <Card key={item.id} className={overdue ? 'border-red-200' : ''}><CardContent className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="flex min-w-0 gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light"><Icon size={18} className="text-primary" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{item.title}</h2>{severityBadge(item.severity)}{statusBadge(item.status)}{overdue && <Badge className="border-0 bg-red-600 text-white">Myöhässä</Badge>}</div><p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">{item.description || 'Ei tarkempaa kuvausta.'}</p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-muted"><span>{item.date}</span><span>{item.project || 'Ei projektia'}</span>{item.location && <span className="flex items-center gap-1"><MapPin size={12} />{item.location}</span>}{item.assignee && <span className="flex items-center gap-1"><UserRound size={12} />{item.assignee}</span>}{item.dueDate && <span>Määräaika {item.dueDate}</span>}</div>{item.correctiveAction && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm"><strong>Korjaava toimi:</strong> {item.correctiveAction}</div>}{item.rootCause && <p className="mt-2 text-xs text-text-secondary"><strong>Juurisyy:</strong> {item.rootCause}</p>}</div></div><div className="flex shrink-0 flex-wrap justify-end gap-1">{canManage && item.status === 'Ilmoitettu korjatuksi' && <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => void quickStatus(item, 'Vahvistettu')}><CheckCircle2 size={14} /> Vahvista</Button>}{canManage && <><Button variant="outline" size="sm" onClick={() => openEdit(item)}><Edit3 size={14} className="mr-1" /> Muokkaa</Button><Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteTarget(item)}><Trash2 size={15} /></Button></>}</div></div></CardContent></Card>; })}{filteredItems.length === 0 && <Card><CardContent className="p-12 text-center"><ShieldCheck size={44} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei turvallisuustietoja</p></CardContent></Card>}</div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{editing ? 'Muokkaa turvallisuusasiaa' : 'Uusi turvallisuushavainto'}</DialogTitle></DialogHeader>{formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((error) => <p key={error}>{error}</p>)}</div>}<div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Tyyppi</Label><Select value={form.type} onValueChange={(type: SafetyItemType) => setForm((previous) => ({ ...previous, type }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SAFETY_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="safety-date">Päivä *</Label><Input id="safety-date" type="date" value={form.date} onChange={(event) => setForm((previous) => ({ ...previous, date: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="safety-title">Otsikko *</Label><Input id="safety-title" value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="safety-description">Kuvaus *</Label><Textarea id="safety-description" value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} rows={4} /></div><div className="space-y-2"><Label>Projekti *</Label>{projects.length ? <Select value={form.projectId} onValueChange={selectProject}><SelectTrigger><SelectValue placeholder="Valitse projekti" /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select> : <Input value={form.project} onChange={(event) => setForm((previous) => ({ ...previous, project: event.target.value }))} />}</div><div className="space-y-2"><Label htmlFor="safety-location">Tarkka sijainti</Label><Input id="safety-location" value={form.location} onChange={(event) => setForm((previous) => ({ ...previous, location: event.target.value }))} placeholder="Esim. A-rappu, huoneisto 12" /></div><div className="space-y-2"><Label>Vakavuus</Label><Select value={form.severity} onValueChange={(severity: SafetyForm['severity']) => setForm((previous) => ({ ...previous, severity }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Ei määritelty">Ei määritelty</SelectItem>{SEVERITIES.map((severity) => <SelectItem key={severity} value={severity}>{severity}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Tila</Label><Select value={form.status} onValueChange={(status) => setForm((previous) => ({ ...previous, status }))} disabled={!canManage}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Vastuuhenkilö</Label><Select value={form.assigneeUserId || 'none'} onValueChange={(value) => value === 'none' ? setForm((previous) => ({ ...previous, assigneeUserId: '', assignee: '' })) : selectAssignee(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei vastuuhenkilöä</SelectItem>{people.map((person) => <SelectItem key={person.userId} value={person.userId}>{person.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="safety-due">Korjauksen määräaika</Label><Input id="safety-due" type="date" value={form.dueDate} onChange={(event) => setForm((previous) => ({ ...previous, dueDate: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="safety-root">Juurisyy</Label><Textarea id="safety-root" value={form.rootCause} onChange={(event) => setForm((previous) => ({ ...previous, rootCause: event.target.value }))} rows={2} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="safety-corrective">Korjaava toimenpide</Label><Textarea id="safety-corrective" value={form.correctiveAction} onChange={(event) => setForm((previous) => ({ ...previous, correctiveAction: event.target.value }))} rows={3} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="safety-preventive">Ehkäisevä toimenpide</Label><Textarea id="safety-preventive" value={form.preventiveAction} onChange={(event) => setForm((previous) => ({ ...previous, preventiveAction: event.target.value }))} rows={3} /></div></div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Peruuta</Button><Button onClick={() => void save()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna'}</Button></DialogFooter></DialogContent></Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Poistetaanko turvallisuusasia?</AlertDialogTitle><AlertDialogDescription>Poisto tallentuu organisaation audit-lokiin.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => void removeItem()}>Poista</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </motion.div>
  );
}
