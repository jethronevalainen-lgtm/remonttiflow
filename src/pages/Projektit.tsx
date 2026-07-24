import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  CheckCircle,
  ChevronRight,
  Download,
  FolderKanban,
  MapPin,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';

import { useAppDataContext } from '@/contexts/AppDataContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Project, ProjectStatus } from '@/types';

const ALL = 'Kaikki';
const PROJECT_STATUSES: ProjectStatus[] = ['Suunniteltu', 'Aktiivinen', 'Myöhässä', 'Valmis'];

interface ProjectForm {
  name: string;
  customer: string;
  location: string;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
  progress: string;
  budget: string;
  spent: string;
  description: string;
}

const emptyForm: ProjectForm = {
  name: '',
  customer: '',
  location: '',
  startDate: '',
  endDate: '',
  status: 'Suunniteltu',
  progress: '0',
  budget: '0',
  spent: '0',
  description: '',
};

function statusBadge(status: ProjectStatus) {
  switch (status) {
    case 'Aktiivinen':
      return <Badge className="border-0 bg-success-light text-success">Aktiivinen</Badge>;
    case 'Suunniteltu':
      return <Badge className="border-0 bg-info-light text-info">Suunniteltu</Badge>;
    case 'Valmis':
      return <Badge className="border border-slate-200 bg-slate-50 text-slate-600">Valmis</Badge>;
    case 'Myöhässä':
      return <Badge className="border-0 bg-danger-light text-danger">Myöhässä</Badge>;
  }
}

function money(value: number) {
  return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export default function Projektit() {
  const { projects, addProject, updateProject, deleteProject } = useAppDataContext();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState(ALL);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [errors, setErrors] = useState<string[]>([]);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesSearch =
        !query ||
        project.name.toLowerCase().includes(query) ||
        project.customer.toLowerCase().includes(query) ||
        (project.location ?? '').toLowerCase().includes(query);
      const matchesFilter =
        activeFilter === ALL ||
        (activeFilter === 'Käynnissä' && project.status === 'Aktiivinen') ||
        project.status === activeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [activeFilter, projects, search]);

  const totalBudget = projects.reduce((sum, project) => sum + project.budget, 0);
  const statusFilters = [
    { key: ALL, count: projects.length, icon: FolderKanban },
    { key: 'Käynnissä', count: projects.filter((project) => project.status === 'Aktiivinen').length, icon: Play },
    { key: 'Suunniteltu', count: projects.filter((project) => project.status === 'Suunniteltu').length, icon: Calendar },
    { key: 'Valmis', count: projects.filter((project) => project.status === 'Valmis').length, icon: CheckCircle },
  ];

  const openCreate = () => {
    setEditingProject(null);
    setForm(emptyForm);
    setErrors([]);
    setDialogOpen(true);
  };

  const openEdit = (project: Project) => {
    setEditingProject(project);
    setForm({
      name: project.name,
      customer: project.customer,
      location: project.location ?? '',
      startDate: project.startDate,
      endDate: project.endDate,
      status: project.status,
      progress: String(project.progress),
      budget: String(project.budget),
      spent: String(project.spent),
      description: project.description ?? '',
    });
    setErrors([]);
    setDialogOpen(true);
  };

  const saveProject = () => {
    const nextErrors: string[] = [];
    if (!form.name.trim()) nextErrors.push('Projektin nimi on pakollinen.');
    if (!form.customer.trim()) nextErrors.push('Asiakas on pakollinen.');
    const progress = Number(form.progress);
    const budget = Number(form.budget);
    const spent = Number(form.spent);
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) nextErrors.push('Edistymisen pitää olla 0–100 %.');
    if (!Number.isFinite(budget) || budget < 0) nextErrors.push('Budjetti ei voi olla negatiivinen.');
    if (!Number.isFinite(spent) || spent < 0) nextErrors.push('Toteutunut kustannus ei voi olla negatiivinen.');
    if (form.startDate && form.endDate && form.endDate < form.startDate) nextErrors.push('Päättymispäivä ei voi olla ennen aloituspäivää.');
    setErrors(nextErrors);
    if (nextErrors.length > 0) return;

    const payload: Omit<Project, 'id'> = {
      name: form.name.trim(),
      customer: form.customer.trim(),
      location: form.location.trim() || undefined,
      startDate: form.startDate,
      endDate: form.endDate,
      status: form.status,
      progress,
      budget,
      spent,
      description: form.description.trim() || undefined,
    };

    if (editingProject) updateProject(editingProject.id, payload);
    else addProject(payload);
    setDialogOpen(false);
  };

  const exportCsv = () => {
    const header = ['Nimi', 'Asiakas', 'Sijainti', 'Aloitus', 'Lopetus', 'Tila', 'Edistyminen %', 'Budjetti', 'Toteutunut'];
    const rows = projects.map((project) => [
      project.name,
      project.customer,
      project.location ?? '',
      project.startDate,
      project.endDate,
      project.status,
      project.progress,
      project.budget,
      project.spent,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `projektit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-body-sm text-text-secondary">
            <span>Dashboard</span><ChevronRight size={14} /><span className="font-medium text-text-primary">Projektit</span>
          </div>
          <h1 className="text-hero text-text-primary">Projektit</h1>
          <p className="mt-1 text-body-sm text-text-secondary">Organisaation projektit ja taloustilanne</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openCreate} className="gap-2 bg-primary text-white hover:bg-primary-hover"><Plus size={16} /> Uusi projekti</Button>
          <Button variant="outline" className="gap-2" onClick={exportCsv} disabled={projects.length === 0}><Download size={16} /> Vie CSV</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Yhteensä', value: projects.length, unit: 'projektia', icon: FolderKanban },
          { label: 'Käynnissä', value: projects.filter((project) => project.status === 'Aktiivinen').length, unit: 'projektia', icon: Play },
          { label: 'Valmiit', value: projects.filter((project) => project.status === 'Valmis').length, unit: 'projektia', icon: CheckCircle },
          { label: 'Budjetti', value: money(totalBudget), unit: 'yhteensä', icon: FolderKanban },
        ].map((stat) => (
          <Card key={stat.label} className="border border-slate-200 shadow-card">
            <CardContent className="p-5">
              <div className="mb-3 flex items-start justify-between">
                <span className="text-caption uppercase tracking-wider text-text-secondary">{stat.label}</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light"><stat.icon size={20} className="text-primary" /></div>
              </div>
              <p className="font-mono text-2xl font-bold text-text-primary">{stat.value}</p>
              <p className="mt-1 text-body-sm text-text-secondary">{stat.unit}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statusFilters.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => setActiveFilter(filter.key)}
            className={cn(
              'rounded-xl border-2 p-4 text-left transition-all hover:-translate-y-0.5',
              activeFilter === filter.key ? 'border-primary bg-primary-light text-primary' : 'border-slate-200 bg-white text-text-secondary',
            )}
          >
            <div className="mb-2 flex items-center gap-2"><filter.icon size={18} /><span className="text-sm font-medium">{filter.key}</span></div>
            <p className="font-mono text-2xl font-bold">{filter.count}</p>
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hae nimellä, asiakkaalla tai sijainnilla…" className="pl-9" />
      </div>

      <Card className="overflow-hidden border border-slate-200 shadow-card">
        <CardContent className="p-0">
          <div className="hidden grid-cols-[1fr_160px_110px_110px_150px_100px_110px] gap-3 border-b bg-slate-50 px-6 py-3 text-caption font-semibold uppercase tracking-wider text-text-muted lg:grid">
            <span>Projekti</span><span>Asiakas</span><span>Aloitus</span><span>Lopetus</span><span>Edistyminen</span><span>Tila</span><span className="text-right">Toiminnot</span>
          </div>
          {filteredProjects.map((project) => (
            <div key={project.id} className={cn('grid grid-cols-1 items-center gap-3 border-b border-slate-100 px-6 py-4 lg:grid-cols-[1fr_160px_110px_110px_150px_100px_110px]', project.status === 'Myöhässä' && 'border-l-4 border-l-danger')}>
              <div>
                <p className="font-semibold text-text-primary">{project.name}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-text-secondary"><MapPin size={12} />{project.location || 'Ei sijaintia'}</p>
              </div>
              <span className="text-sm text-text-secondary">{project.customer}</span>
              <span className="text-sm text-text-secondary">{project.startDate || '—'}</span>
              <span className="text-sm text-text-secondary">{project.endDate || '—'}</span>
              <div className="flex items-center gap-2"><Progress value={project.progress} className="h-2 w-20" /><span className="font-mono text-sm">{project.progress}%</span></div>
              <div>{statusBadge(project.status)}</div>
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(project)} aria-label={`Muokkaa ${project.name}`}><Pencil size={16} /></Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-danger" onClick={() => setDeleteTarget(project)} aria-label={`Poista ${project.name}`}><Trash2 size={16} /></Button>
              </div>
            </div>
          ))}
          {filteredProjects.length === 0 && (
            <div className="p-12 text-center"><FolderKanban size={44} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei projekteja</p><p className="mt-1 text-sm text-text-secondary">Luo ensimmäinen projekti tai muuta hakuehtoja.</p></div>
          )}
          <div className="border-t bg-slate-50 px-6 py-3 text-sm text-text-secondary">Näytetään {filteredProjects.length} / {projects.length}</div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editingProject ? 'Muokkaa projektia' : 'Uusi projekti'}</DialogTitle></DialogHeader>
          {errors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="project-name">Nimi *</Label><Input id="project-name" value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="project-customer">Asiakas *</Label><Input id="project-customer" value={form.customer} onChange={(event) => setForm((previous) => ({ ...previous, customer: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="project-location">Sijainti</Label><Input id="project-location" value={form.location} onChange={(event) => setForm((previous) => ({ ...previous, location: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="project-start">Aloitus</Label><Input id="project-start" type="date" value={form.startDate} onChange={(event) => setForm((previous) => ({ ...previous, startDate: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="project-end">Lopetus</Label><Input id="project-end" type="date" value={form.endDate} onChange={(event) => setForm((previous) => ({ ...previous, endDate: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Tila</Label><Select value={form.status} onValueChange={(value: ProjectStatus) => setForm((previous) => ({ ...previous, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PROJECT_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="project-progress">Edistyminen %</Label><Input id="project-progress" type="number" min="0" max="100" value={form.progress} onChange={(event) => setForm((previous) => ({ ...previous, progress: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="project-budget">Budjetti €</Label><Input id="project-budget" type="number" min="0" step="100" value={form.budget} onChange={(event) => setForm((previous) => ({ ...previous, budget: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="project-spent">Toteutunut €</Label><Input id="project-spent" type="number" min="0" step="100" value={form.spent} onChange={(event) => setForm((previous) => ({ ...previous, spent: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="project-description">Kuvaus</Label><Textarea id="project-description" value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Peruuta</Button><Button onClick={saveProject}>{editingProject ? 'Tallenna muutokset' : 'Luo projekti'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Poista projekti</DialogTitle></DialogHeader>
          <p className="text-sm text-text-secondary">Poistetaanko projekti <strong>{deleteTarget?.name}</strong>? Toimintoa ei voi perua.</p>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteTarget(null)}>Peruuta</Button><Button variant="destructive" onClick={() => { if (deleteTarget) deleteProject(deleteTarget.id); setDeleteTarget(null); }}>Poista</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
