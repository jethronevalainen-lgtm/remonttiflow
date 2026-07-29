import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
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

function money(value: number) {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
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

function statusBadge(status: ProjectStatus) {
  const styles: Record<ProjectStatus, string> = {
    Aktiivinen: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Suunniteltu: 'border-blue-200 bg-blue-50 text-blue-700',
    Valmis: 'border-slate-200 bg-slate-50 text-slate-600',
    Myöhässä: 'border-red-200 bg-red-50 text-red-700',
  };
  return <Badge variant="outline" className={styles[status]}>{status}</Badge>;
}

export default function Projektit() {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const {
    projects,
    addProject,
    updateProject,
    deleteProject,
    refresh: refreshDomain,
    operationError: domainOperationError,
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
      if (project.archivedAt) return false;
      const matchesSearch = !query || [
        project.name,
        project.customer,
        project.location ?? '',
        project.projectNumber ?? '',
      ].some((value) => value.toLocaleLowerCase('fi').includes(query));
      const matchesFilter = activeFilter === ALL
        || (activeFilter === 'Käynnissä' && project.status === 'Aktiivinen')
        || project.status === activeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [activeFilter, projects, search]);

  const totalBudget = projects.reduce((sum, project) => sum + project.budget, 0);
  const totalSpent = projects.reduce((sum, project) => sum + project.spent, 0);
  const visibleError = operationError ?? domainOperationError ?? workspaceError;
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
    const progress = Number(form.progress);
    const budget = Number(form.budget);
    const spent = Number(form.spent);
    if (!form.name.trim()) nextErrors.push('Projektin nimi on pakollinen.');
    if (!form.customer.trim()) nextErrors.push('Asiakas on pakollinen.');
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

  const removeProject = () => {
    if (!deleteTarget) return;
    deleteProject(deleteTarget.id);
    setDeleteTarget(null);
  };

  const exportCsv = () => {
    const header = ['Nimi', 'Asiakas', 'Sijainti', 'Aloitus', 'Lopetus', 'Tila', 'Edistyminen %', 'Budjetti', 'Toteutunut', 'Tiimin koko'];
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
      (membersByProject.get(project.id) ?? []).length,
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
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Avaa projektin työtila nähdäksesi tehtävät, tunnit, turvallisuuden, dokumentit, tapahtumat ja muutostyöt samassa kokonaisuudessa.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={openCreate} className="gap-2 bg-orange-500 text-white hover:bg-orange-600"><Plus size={16} /> Uusi projekti</Button>
            <Button variant="outline" onClick={exportCsv} disabled={projects.length === 0} className="gap-2 border-slate-600 bg-slate-900/30 text-white hover:bg-slate-800"><Download size={16} /> CSV</Button>
          </div>
        </div>
      </div>

      {visibleError && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={17} />{visibleError}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Projektit', value: projects.length, detail: 'kaikki kohteet', icon: FolderKanban },
          { label: 'Käynnissä', value: projects.filter((project) => project.status === 'Aktiivinen').length, detail: 'aktiivista kohdetta', icon: Play },
          { label: 'Budjetti', value: money(totalBudget), detail: `${money(totalSpent)} toteutunut`, icon: Calendar },
          { label: 'Tiimipaikat', value: projectMemberships.length, detail: 'käyttäjä–projekti-kohdistusta', icon: UsersRound },
        ].map((item) => <Card key={item.label} className="border-slate-200 shadow-sm"><CardContent className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wider text-slate-500">{item.label}</p><p className="mt-2 break-words font-mono text-2xl font-bold">{item.value}</p><p className="mt-1 text-xs text-slate-500">{item.detail}</p></div><item.icon size={20} className="text-orange-600" /></div></CardContent></Card>)}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Hae projektia, asiakasta tai sijaintia…" /></div>
        <div className="flex flex-wrap gap-2 pb-1">{statusFilters.map((filter) => <Button key={filter.key} variant={activeFilter === filter.key ? 'default' : 'outline'} size="sm" className="gap-2" onClick={() => setActiveFilter(filter.key)}><filter.icon size={14} />{filter.key}<Badge variant="secondary" className="ml-1">{filter.count}</Badge></Button>)}</div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {filteredProjects.map((project) => {
          const memberIds = membersByProject.get(project.id) ?? [];
          const memberNames = memberIds.map((id) => personById.get(id)?.name).filter(Boolean) as string[];
          const budgetUsage = project.budget > 0 ? Math.min(100, Math.round(project.spent / project.budget * 100)) : 0;
          return (
            <Card key={project.id} className="group flex h-full flex-col overflow-hidden border-slate-200 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardContent className="flex flex-1 flex-col p-0">
                <button type="button" className="flex-1 p-5 text-left" onClick={() => navigate(`/projektit/${project.id}`)}>
                  <div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-700"><FolderKanban size={20} /></div>{statusBadge(project.status)}</div>
                  <h2 className="mt-4 text-lg font-bold text-slate-950 group-hover:text-orange-700">{project.name}</h2>
                  <p className="mt-1 text-sm text-slate-600">{project.customer}</p>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><MapPin size={13} />{project.location || 'Sijaintia ei määritetty'}</p>
                  <div className="mt-5"><div className="mb-2 flex justify-between text-xs"><span className="text-slate-500">Eteneminen</span><strong>{project.progress}%</strong></div><Progress value={project.progress} className="h-2" /></div>
                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs"><div><p className="text-slate-500">Budjetti</p><p className="font-mono font-semibold">{money(project.budget)}</p></div><div><p className="text-slate-500">Käytetty</p><p className="font-mono font-semibold">{budgetUsage}%</p></div></div>
                  <div className="mt-4 flex items-center justify-between"><div className="flex -space-x-2">{memberNames.slice(0, 4).map((name) => <div key={name} title={name} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-[10px] font-bold text-white">{initials(name)}</div>)}{memberNames.length === 0 && <span className="text-xs text-slate-500">Ei tiimiä</span>}{memberNames.length > 4 && <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[10px] font-bold">+{memberNames.length - 4}</div>}</div><span className="flex items-center gap-1 text-sm font-semibold text-orange-700">Avaa työtila <ArrowRight size={15} /></span></div>
                </button>
                <div className="flex items-center justify-end gap-1 border-t border-slate-100 px-4 py-3">
                  <Button variant="ghost" size="sm" onClick={() => openTeam(project)}><UsersRound size={15} className="mr-1" /> Tiimi</Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(project)}><Pencil size={15} className="mr-1" /> Muokkaa</Button>
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteTarget(project)}><Trash2 size={15} /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!workspaceLoading && filteredProjects.length === 0 && <Card className="lg:col-span-2 xl:col-span-3"><CardContent className="p-12 text-center"><FolderKanban size={44} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold">Ei projekteja</p><p className="mt-1 text-sm text-slate-500">Luo ensimmäinen projekti tai muuta hakuehtoja.</p><Button className="mt-5" onClick={openCreate}><Plus size={16} className="mr-2" /> Uusi projekti</Button></CardContent></Card>}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editingProject ? 'Muokkaa projektia' : 'Uusi projekti'}</DialogTitle></DialogHeader>
          {errors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="project-name">Nimi *</Label><Input id="project-name" value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="project-customer">Asiakas *</Label><Input id="project-customer" value={form.customer} onChange={(event) => setForm((previous) => ({ ...previous, customer: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="project-location">Sijainti</Label><Input id="project-location" value={form.location} onChange={(event) => setForm((previous) => ({ ...previous, location: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="project-start">Aloitus</Label><Input id="project-start" type="date" value={form.startDate} onChange={(event) => setForm((previous) => ({ ...previous, startDate: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="project-end">Valmistuminen</Label><Input id="project-end" type="date" value={form.endDate} onChange={(event) => setForm((previous) => ({ ...previous, endDate: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Tila</Label><Select value={form.status} onValueChange={(status: ProjectStatus) => setForm((previous) => ({ ...previous, status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PROJECT_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="project-progress">Edistyminen %</Label><Input id="project-progress" type="number" min="0" max="100" value={form.progress} onChange={(event) => setForm((previous) => ({ ...previous, progress: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="project-budget">Budjetti €</Label><Input id="project-budget" type="number" min="0" step="0.01" value={form.budget} onChange={(event) => setForm((previous) => ({ ...previous, budget: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="project-spent">Toteutunut €</Label><Input id="project-spent" type="number" min="0" step="0.01" value={form.spent} onChange={(event) => setForm((previous) => ({ ...previous, spent: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="project-description">Kuvaus</Label><Textarea id="project-description" value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} rows={4} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Peruuta</Button><Button onClick={saveProject}>Tallenna</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(teamProject)} onOpenChange={(open) => { if (!open) setTeamProject(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Projektitiimi · {teamProject?.name}</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">Valitut käyttäjät näkevät projektitiimille osoitetut työmääräykset, vuorot ja projektin tiedot.</p>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2">
            {people.map((person) => { const checked = teamUserIds.includes(person.userId); return <label key={person.userId} className="flex cursor-pointer items-center gap-3 rounded-lg p-3 hover:bg-slate-50"><Checkbox checked={checked} onCheckedChange={(value) => toggleTeamUser(person.userId, value === true)} /><div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{initials(person.name)}</div><div><p className="font-medium">{person.name}</p><p className="text-xs text-slate-500">{person.role}</p></div></label>; })}
            {people.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Organisaatiossa ei ole kirjautuvia käyttäjiä.</p>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setTeamProject(null)}>Peruuta</Button><Button onClick={() => void saveTeam()} disabled={savingTeam}>{savingTeam ? 'Tallennetaan…' : 'Tallenna tiimi'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Poistetaanko projekti?</AlertDialogTitle><AlertDialogDescription>Projekti “{deleteTarget?.name}” poistetaan. Historialliset kirjaukset säilyvät, mutta niiden projektiviittaus irrotetaan.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={removeProject}>Poista projekti</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
