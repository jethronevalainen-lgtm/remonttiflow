import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Download,
  FolderKanban,
  MapPin,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  UsersRound,
} from 'lucide-react';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import { replaceProjectMembers } from '@/lib/supabase/workManagement';
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

const EMPTY_FORM: ProjectForm = {
  name: '', customer: '', location: '', startDate: '', endDate: '',
  status: 'Suunniteltu', progress: '0', budget: '0', spent: '0', description: '',
};

function statusBadge(status: ProjectStatus) {
  const styles: Record<ProjectStatus, string> = {
    Aktiivinen: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Suunniteltu: 'border-blue-200 bg-blue-50 text-blue-700',
    Valmis: 'border-slate-200 bg-slate-50 text-slate-600',
    Myöhässä: 'border-red-200 bg-red-50 text-red-700',
  };
  return <Badge variant="outline" className={styles[status]}>{status}</Badge>;
}

function money(value: number) {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(value);
}

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function Projektit() {
  const { currentOrg } = useOrganization();
  const {
    projects,
    addProject,
    updateProject,
    deleteProject,
    refresh: refreshDomain,
  } = useAppDataContext();
  const {
    people,
    projectMemberships,
    loading: workspaceLoading,
    error: workspaceError,
    refresh: refreshWorkspace,
  } = useRoleWorkspace();

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState(ALL);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [teamProject, setTeamProject] = useState<Project | null>(null);
  const [teamUserIds, setTeamUserIds] = useState<string[]>([]);
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [savingTeam, setSavingTeam] = useState(false);

  const membersByProject = useMemo(() => {
    const map = new Map<string, string[]>();
    projectMemberships.forEach((membership) => {
      map.set(membership.projectId, [
        ...(map.get(membership.projectId) ?? []),
        membership.userId,
      ]);
    });
    return map;
  }, [projectMemberships]);

  const personById = useMemo(
    () => new Map(people.map((person) => [person.userId, person])),
    [people],
  );

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fi');
    return projects.filter((project) => {
      const matchesSearch = !query || [
        project.name,
        project.customer,
        project.location ?? '',
      ].some((value) => value.toLocaleLowerCase('fi').includes(query));
      const matchesFilter = activeFilter === ALL
        || (activeFilter === 'Käynnissä' && project.status === 'Aktiivinen')
        || project.status === activeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [activeFilter, projects, search]);

  const totalBudget = projects.reduce((sum, project) => sum + project.budget, 0);
  const totalSpent = projects.reduce((sum, project) => sum + project.spent, 0);
  const statusFilters = [
    { key: ALL, count: projects.length, icon: FolderKanban },
    { key: 'Käynnissä', count: projects.filter((project) => project.status === 'Aktiivinen').length, icon: Play },
    { key: 'Suunniteltu', count: projects.filter((project) => project.status === 'Suunniteltu').length, icon: Calendar },
    { key: 'Valmis', count: projects.filter((project) => project.status === 'Valmis').length, icon: CheckCircle2 },
  ];

  const openCreate = () => {
    setEditingProject(null);
    setForm(EMPTY_FORM);
    setErrors([]);
    setOperationError(null);
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
    setOperationError(null);
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

  const openTeam = (project: Project) => {
    setTeamProject(project);
    setTeamUserIds(membersByProject.get(project.id) ?? []);
    setOperationError(null);
  };

  const toggleTeamUser = (userId: string, checked: boolean) => {
    setTeamUserIds((previous) => checked
      ? [...new Set([...previous, userId])]
      : previous.filter((id) => id !== userId));
  };

  const saveTeam = async () => {
    if (!currentOrg || !teamProject) return;
    setSavingTeam(true);
    setOperationError(null);
    try {
      await replaceProjectMembers({
        organizationId: currentOrg.id,
        projectId: teamProject.id,
        userIds: teamUserIds,
      });
      await Promise.all([refreshWorkspace(), refreshDomain()]);
      setTeamProject(null);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Projektitiimin tallennus epäonnistui.');
    } finally {
      setSavingTeam(false);
    }
  };

  const exportCsv = () => {
    const header = ['Nimi', 'Asiakas', 'Sijainti', 'Aloitus', 'Lopetus', 'Tila', 'Edistyminen %', 'Budjetti', 'Toteutunut', 'Tiimin koko'];
    const rows = projects.map((project) => [
      project.name, project.customer, project.location ?? '', project.startDate,
      project.endDate, project.status, project.progress, project.budget,
      project.spent, (membersByProject.get(project.id) ?? []).length,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `projektit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-[1500px] space-y-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-5 bg-gradient-to-r from-slate-950 to-slate-800 p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300"><FolderKanban size={16} /> Työnjohdon työtila</div>
            <h1 className="text-3xl font-bold tracking-tight">Projektit ja työmaatiimit</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Projektitiimi määrittää, ketkä työntekijät näkevät kohteen tiedot, yhteiset työmääräykset ja aikataulun.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={openCreate} className="gap-2 bg-orange-500 text-white hover:bg-orange-600"><Plus size={16} /> Uusi projekti</Button>
            <Button variant="outline" onClick={exportCsv} disabled={projects.length === 0} className="gap-2 border-slate-600 bg-slate-900/30 text-white hover:bg-slate-800"><Download size={16} /> CSV</Button>
          </div>
        </div>
      </div>

      {(workspaceError || operationError) && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={17} />{operationError ?? workspaceError}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Projektit', value: projects.length, detail: 'kaikki kohteet', icon: FolderKanban, tone: 'bg-blue-50 text-blue-700' },
          { label: 'Käynnissä', value: projects.filter((project) => project.status === 'Aktiivinen').length, detail: 'aktiivista kohdetta', icon: Play, tone: 'bg-orange-50 text-orange-700' },
          { label: 'Budjetti', value: money(totalBudget), detail: `${money(totalSpent)} toteutunut`, icon: Calendar, tone: 'bg-emerald-50 text-emerald-700' },
          { label: 'Tiimipaikat', value: projectMemberships.length, detail: 'käyttäjä–projekti-kohdistusta', icon: UsersRound, tone: 'bg-purple-50 text-purple-700' },
        ].map((item) => (
          <Card key={item.label} className="border-slate-200 shadow-sm"><CardContent className="p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wider text-slate-500">{item.label}</p><p className="mt-2 font-mono text-2xl font-bold text-slate-950">{item.value}</p><p className="mt-1 text-xs text-slate-500">{item.detail}</p></div><div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', item.tone)}><item.icon size={21} /></div></div></CardContent></Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-2">{statusFilters.map((filter) => <button key={filter.key} type="button" onClick={() => setActiveFilter(filter.key)} className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors', activeFilter === filter.key ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}><filter.icon size={15} />{filter.key}<span className="font-mono text-xs">{filter.count}</span></button>)}</div>
        <div className="relative lg:ml-auto lg:w-80"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hae projektia…" className="pl-9" /></div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {filteredProjects.map((project) => {
          const memberIds = membersByProject.get(project.id) ?? [];
          const memberPeople = memberIds.map((id) => personById.get(id)).filter(Boolean);
          const budgetUsage = project.budget > 0 ? Math.min(project.spent / project.budget * 100, 100) : 0;
          return (
            <Card key={project.id} className={cn('overflow-hidden border-slate-200 shadow-sm transition-shadow hover:shadow-md', project.status === 'Myöhässä' && 'border-l-4 border-l-red-500')}>
              <CardContent className="space-y-5 p-5">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="mb-2 flex flex-wrap gap-2">{statusBadge(project.status)}<Badge variant="outline" className="gap-1"><UsersRound size={12} /> {memberIds.length}</Badge></div><h2 className="text-lg font-semibold text-slate-950">{project.name}</h2><p className="mt-1 text-sm text-slate-500">{project.customer}</p></div><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => openEdit(project)} aria-label={`Muokkaa ${project.name}`}><Pencil size={16} /></Button><Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteTarget(project)} aria-label={`Poista ${project.name}`}><Trash2 size={16} /></Button></div></div>
                <div className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"><div className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 text-slate-400" /><div><p className="text-xs uppercase tracking-wide text-slate-400">Kohde</p><p className="text-sm font-medium text-slate-700">{project.location || 'Ei sijaintia'}</p></div></div><div className="flex items-start gap-2"><Calendar size={16} className="mt-0.5 text-slate-400" /><div><p className="text-xs uppercase tracking-wide text-slate-400">Aikataulu</p><p className="text-sm font-medium text-slate-700">{project.startDate || '—'} – {project.endDate || '—'}</p></div></div></div>
                <div><div className="mb-2 flex justify-between text-xs text-slate-500"><span>Edistyminen</span><span className="font-mono font-semibold text-slate-700">{project.progress}%</span></div><Progress value={project.progress} className="h-2" /></div>
                <div><div className="mb-2 flex justify-between text-xs text-slate-500"><span>Budjetin käyttö</span><span className="font-mono font-semibold text-slate-700">{budgetUsage.toFixed(1)} %</span></div><Progress value={budgetUsage} className="h-2" /><div className="mt-2 flex justify-between text-xs text-slate-500"><span>{money(project.spent)}</span><span>{money(project.budget)}</span></div></div>
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4"><div className="flex -space-x-2">{memberPeople.slice(0, 5).map((person) => <div key={person?.userId} title={person?.name} className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-xs font-bold text-white">{initials(person?.name ?? '')}</div>)}{memberIds.length === 0 && <span className="text-sm text-amber-700">Tiimiä ei ole määritetty</span>}{memberIds.length > 5 && <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-xs font-bold text-slate-700">+{memberIds.length - 5}</div>}</div><Button variant="outline" size="sm" onClick={() => openTeam(project)} className="gap-2"><UsersRound size={15} /> Hallitse tiimiä</Button></div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!workspaceLoading && filteredProjects.length === 0 && <Card className="border-dashed"><CardContent className="p-12 text-center"><FolderKanban size={46} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold">Projekteja ei löytynyt</p></CardContent></Card>}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editingProject ? 'Muokkaa projektia' : 'Uusi projekti'}</DialogTitle></DialogHeader>{errors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.map((item) => <p key={item}>{item}</p>)}</div>}<div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="project-name">Projektin nimi *</Label><Input id="project-name" value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="project-customer">Asiakas *</Label><Input id="project-customer" value={form.customer} onChange={(event) => setForm((previous) => ({ ...previous, customer: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="project-location">Sijainti</Label><Input id="project-location" value={form.location} onChange={(event) => setForm((previous) => ({ ...previous, location: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="project-start">Aloitus</Label><Input id="project-start" type="date" value={form.startDate} onChange={(event) => setForm((previous) => ({ ...previous, startDate: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="project-end">Valmistuminen</Label><Input id="project-end" type="date" value={form.endDate} onChange={(event) => setForm((previous) => ({ ...previous, endDate: event.target.value }))} /></div><div className="space-y-2"><Label>Tila</Label><Select value={form.status} onValueChange={(status: ProjectStatus) => setForm((previous) => ({ ...previous, status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PROJECT_STATUSES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="project-progress">Edistyminen %</Label><Input id="project-progress" type="number" min="0" max="100" value={form.progress} onChange={(event) => setForm((previous) => ({ ...previous, progress: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="project-budget">Budjetti €</Label><Input id="project-budget" type="number" min="0" value={form.budget} onChange={(event) => setForm((previous) => ({ ...previous, budget: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="project-spent">Toteutunut €</Label><Input id="project-spent" type="number" min="0" value={form.spent} onChange={(event) => setForm((previous) => ({ ...previous, spent: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="project-description">Kuvaus</Label><Textarea id="project-description" value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} rows={4} /></div></div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Peruuta</Button><Button onClick={saveProject}>Tallenna projekti</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(teamProject)} onOpenChange={(open) => !open && setTeamProject(null)}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Projektitiimi · {teamProject?.name}</DialogTitle></DialogHeader><p className="text-sm leading-6 text-slate-600">Valitut käyttäjät näkevät tämän projektin tiedot sekä projektitiimille kohdistetut työmääräykset.</p><div className="max-h-[420px] space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">{people.map((person) => <label key={person.userId} className="flex cursor-pointer items-center gap-3 rounded-lg p-3 hover:bg-slate-50"><Checkbox checked={teamUserIds.includes(person.userId)} onCheckedChange={(checked) => toggleTeamUser(person.userId, checked === true)} /><span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{initials(person.name)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-800">{person.name}</span><span className="block truncate text-xs text-slate-500">{person.email || person.role}</span></span><Badge variant="outline">{person.role === 'admin' ? 'Admin' : person.role === 'supervisor' ? 'Työnjohto' : 'Työntekijä'}</Badge></label>)}{people.length === 0 && <div className="p-6 text-center text-sm text-slate-500">Kutsu käyttäjät ensin organisaatioon Hallinta-näkymässä.</div>}</div><DialogFooter><Button variant="outline" onClick={() => setTeamProject(null)} disabled={savingTeam}>Peruuta</Button><Button onClick={() => void saveTeam()} disabled={savingTeam}>{savingTeam ? 'Tallennetaan…' : `Tallenna tiimi (${teamUserIds.length})`}</Button></DialogFooter></DialogContent></Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Poista projekti</AlertDialogTitle><AlertDialogDescription>Poistetaanko <strong>{deleteTarget?.name}</strong>? Projektiin liittyvät työmääräykset poistuvat tietokannan viite-ehtojen mukaisesti.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction onClick={() => { if (deleteTarget) deleteProject(deleteTarget.id); setDeleteTarget(null); }} className="bg-red-600 hover:bg-red-700">Poista</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </motion.div>
  );
}
