import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Edit3,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSchedulingData, type PhaseStatus, type ProjectPhase } from '@/hooks/useSchedulingData';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import logger from '@/lib/logger';
import {
  createProjectPhase,
  deleteProjectPhase,
  updateProjectPhase,
} from '@/lib/supabase/schedulingEntities';

const PHASE_STATUSES: PhaseStatus[] = ['Suunniteltu', 'Käynnissä', 'Myöhässä', 'Valmis'];

interface PhaseForm {
  projectId: string;
  projectName: string;
  name: string;
  startDate: string;
  endDate: string;
  status: PhaseStatus;
  progress: string;
  notes: string;
}

const emptyForm: PhaseForm = {
  projectId: '',
  projectName: '',
  name: '',
  startDate: '',
  endDate: '',
  status: 'Suunniteltu',
  progress: '0',
  notes: '',
};

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

function durationDays(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
  return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1);
}

function statusBadge(status: PhaseStatus) {
  const classes: Record<PhaseStatus, string> = {
    Suunniteltu: 'bg-blue-50 text-blue-700',
    Käynnissä: 'bg-amber-50 text-amber-700',
    Myöhässä: 'bg-red-50 text-red-700',
    Valmis: 'bg-emerald-50 text-emerald-700',
  };
  return <Badge className={`border-0 ${classes[status]}`}>{status}</Badge>;
}

export default function Aikataulutus() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { projects } = useAppDataContext();
  const { phases, loading, error, refresh } = useSchedulingData();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectPhase | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectPhase | null>(null);
  const [form, setForm] = useState<PhaseForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filteredPhases = useMemo(() => {
    const query = search.trim().toLowerCase();
    return phases.filter((phase) =>
      !query ||
      phase.projectName.toLowerCase().includes(query) ||
      phase.name.toLowerCase().includes(query) ||
      phase.status.toLowerCase().includes(query),
    );
  }, [phases, search]);

  const groupedPhases = useMemo(() => {
    const groups = new Map<string, ProjectPhase[]>();
    for (const phase of filteredPhases) {
      const key = phase.projectName || 'Projekti puuttuu';
      groups.set(key, [...(groups.get(key) ?? []), phase]);
    }
    return [...groups.entries()].map(([projectName, items]) => ({
      projectName,
      items: items.sort((a, b) => a.startDate.localeCompare(b.startDate)),
    }));
  }, [filteredPhases]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const openEdit = (phase: ProjectPhase) => {
    setEditing(phase);
    setForm({
      projectId: phase.projectId ?? '',
      projectName: phase.projectName,
      name: phase.name,
      startDate: phase.startDate,
      endDate: phase.endDate,
      status: phase.status,
      progress: String(phase.progress),
      notes: phase.notes,
    });
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const selectProject = (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    setForm((previous) => ({
      ...previous,
      projectId,
      projectName: project?.name ?? previous.projectName,
    }));
  };

  const save = async () => {
    const progress = Number(form.progress);
    const nextErrors: string[] = [];
    if (!form.projectName.trim()) nextErrors.push('Projekti on pakollinen.');
    if (!form.name.trim()) nextErrors.push('Vaiheen nimi on pakollinen.');
    if (!form.startDate || !form.endDate) nextErrors.push('Aloitus- ja päättymispäivä ovat pakollisia.');
    if (form.startDate && form.endDate && form.endDate < form.startDate) nextErrors.push('Päättymispäivä ei voi olla ennen aloituspäivää.');
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) nextErrors.push('Edistymisen pitää olla 0–100 %.');
    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg) return;

    const payload: Omit<ProjectPhase, 'id'> = {
      projectId: form.projectId || undefined,
      projectName: form.projectName.trim(),
      name: form.name.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      status: form.status,
      progress,
      notes: form.notes.trim(),
    };

    setSaving(true);
    setOperationError(null);
    try {
      if (editing) await updateProjectPhase(currentOrg.id, editing.id, payload);
      else await createProjectPhase(currentOrg.id, user?.id, payload);
      await refresh();
      setDialogOpen(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Tallennus epäonnistui.';
      setOperationError(message);
      logger.error('Projektivaiheen tallennus epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  const removePhase = async () => {
    if (!deleteTarget || !currentOrg) return;
    setSaving(true);
    try {
      await deleteProjectPhase(currentOrg.id, deleteTarget.id);
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-hero text-text-primary">Aikataulutus</h1>
          <p className="mt-1 text-body-sm text-text-secondary">Projektien työvaiheet, määräajat ja eteneminen</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus size={16} /> Lisää vaihe</Button>
      </div>

      {(error || operationError) && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={16} />{operationError ?? error}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Vaiheita', value: phases.length, icon: CalendarDays },
          { label: 'Käynnissä', value: phases.filter((phase) => phase.status === 'Käynnissä').length, icon: Clock },
          { label: 'Myöhässä', value: phases.filter((phase) => phase.status === 'Myöhässä').length, icon: AlertTriangle },
          { label: 'Valmiina', value: phases.filter((phase) => phase.status === 'Valmis').length, icon: CheckCircle2 },
        ].map((item) => <Card key={item.label} className="border-slate-200 shadow-card"><CardContent className="p-5"><div className="mb-3 flex justify-between"><span className="text-xs uppercase tracking-wider text-text-secondary">{item.label}</span><item.icon size={18} className="text-primary" /></div><p className="font-mono text-3xl font-bold">{item.value}</p></CardContent></Card>)}
      </div>

      <div className="relative max-w-md"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hae projektia tai työvaihetta…" className="pl-9" /></div>

      <div className="space-y-5">
        {groupedPhases.map((group) => (
          <Card key={group.projectName} className="border-slate-200 shadow-card">
            <CardContent className="p-0">
              <div className="border-b bg-slate-50 px-5 py-3"><h2 className="font-semibold text-text-primary">{group.projectName}</h2><p className="text-xs text-text-secondary">{group.items.length} työvaihetta</p></div>
              <div className="divide-y divide-slate-100">
                {group.items.map((phase) => (
                  <div key={phase.id} className="grid grid-cols-1 items-center gap-3 px-5 py-4 lg:grid-cols-[1.2fr_220px_160px_1fr_100px]">
                    <div><p className="font-semibold text-text-primary">{phase.name}</p><p className="text-xs text-text-secondary">{phase.notes || 'Ei lisätietoja'}</p></div>
                    <div className="text-sm text-text-secondary">{formatDate(phase.startDate)} – {formatDate(phase.endDate)}<p className="text-xs">{durationDays(phase.startDate, phase.endDate)} kalenteripäivää</p></div>
                    <div>{statusBadge(phase.status)}</div>
                    <div className="flex items-center gap-2"><Progress value={phase.progress} className="h-2" /><span className="w-11 text-right font-mono text-sm">{phase.progress}%</span></div>
                    <div className="flex justify-end gap-1"><Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(phase)}><Edit3 size={15} /></Button><Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-danger" onClick={() => setDeleteTarget(phase)}><Trash2 size={15} /></Button></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
        {!loading && groupedPhases.length === 0 && <Card><CardContent className="p-12 text-center"><CalendarDays size={44} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei projektivaiheita</p><p className="mt-1 text-sm text-text-secondary">Lisää ensimmäinen aikataulutettava työvaihe.</p></CardContent></Card>}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>{editing ? 'Muokkaa vaihetta' : 'Lisää projektivaihe'}</DialogTitle></DialogHeader>
          {formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Projekti *</Label>{projects.length > 0 ? <Select value={form.projectId} onValueChange={selectProject}><SelectTrigger><SelectValue placeholder="Valitse projekti" /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select> : <Input value={form.projectName} onChange={(event) => setForm((previous) => ({ ...previous, projectName: event.target.value }))} />}</div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="phase-name">Vaiheen nimi *</Label><Input id="phase-name" value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="phase-start">Aloitus *</Label><Input id="phase-start" type="date" value={form.startDate} onChange={(event) => setForm((previous) => ({ ...previous, startDate: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="phase-end">Lopetus *</Label><Input id="phase-end" type="date" value={form.endDate} onChange={(event) => setForm((previous) => ({ ...previous, endDate: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Tila</Label><Select value={form.status} onValueChange={(value: PhaseStatus) => setForm((previous) => ({ ...previous, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PHASE_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="phase-progress">Edistyminen %</Label><Input id="phase-progress" type="number" min="0" max="100" value={form.progress} onChange={(event) => setForm((previous) => ({ ...previous, progress: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="phase-notes">Lisätiedot</Label><Textarea id="phase-notes" value={form.notes} onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void save()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}><DialogContent><DialogHeader><DialogTitle>Poista projektivaihe</DialogTitle></DialogHeader><p className="text-sm text-text-secondary">Poistetaanko vaihe <strong>{deleteTarget?.name}</strong>?</p><DialogFooter><Button variant="outline" onClick={() => setDeleteTarget(null)}>Peruuta</Button><Button variant="destructive" onClick={() => void removePhase()} disabled={saving}>Poista</Button></DialogFooter></DialogContent></Dialog>
    </motion.div>
  );
}
