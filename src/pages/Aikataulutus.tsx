import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addDays, differenceInCalendarDays, format, startOfWeek } from 'date-fns';
import { fi } from 'date-fns/locale';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  FolderKanban,
  Layers3,
  List,
  Search,
  UsersRound,
} from 'lucide-react';

import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSchedulingData, type PhaseStatus, type ProjectPhase } from '@/hooks/useSchedulingData';
import { derivePhaseProgress } from '@/lib/phaseProgress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import logger from '@/lib/logger';
import { rescheduleProjectPhase, updateProjectPhase } from '@/lib/supabase/schedulingEntities';
import { cn } from '@/lib/utils';

const ALL_PROJECTS = '__all_projects__';
const ALL_HEALTH = '__all_health__';
const TIMELINE_DAYS = 42;

type ViewMode = 'overview' | 'timeline';
type ScheduleHealth = 'overdue' | 'blocked' | 'at-risk' | 'unscheduled' | 'unassigned' | 'untracked' | 'running' | 'planned' | 'done';

interface PhaseForm {
  name: string;
  startDate: string;
  endDate: string;
  status: PhaseStatus;
  notes: string;
}

interface PhaseOperationalView {
  health: ScheduleHealth;
  label: string;
  detail: string;
  expectedPercent: number;
  actualPercent: number | null;
}

const emptyForm: PhaseForm = {
  name: '',
  startDate: '',
  endDate: '',
  status: 'Suunniteltu',
  notes: '',
};

function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function formatDate(value: string): string {
  const parsed = parseDate(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

function durationDays(start: string, end: string): number {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
  return Math.max(1, differenceInCalendarDays(endDate, startDate) + 1);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function expectedProgress(startDate: string, endDate: string, today = todayIsoDate()): number {
  if (!startDate || !endDate || today < startDate) return 0;
  if (today > endDate) return 100;
  const totalDays = durationDays(startDate, endDate);
  const elapsedDays = durationDays(startDate, today);
  return clamp(Math.round((elapsedDays / totalDays) * 100), 0, 100);
}

function phaseProgress(phase: ProjectPhase) {
  return derivePhaseProgress({
    endDate: phase.endDate,
    status: phase.status,
    workOrderCount: phase.workOrderCount,
    completedWorkOrderCount: phase.completedWorkOrderCount,
    activeWorkOrderCount: phase.activeWorkOrderCount,
    storedProgress: phase.progress,
  });
}

function operationalView(phase: ProjectPhase, today = todayIsoDate()): PhaseOperationalView {
  const progress = phaseProgress(phase);
  const expectedPercent = expectedProgress(phase.startDate, phase.endDate, today);
  const actualPercent = progress.percent;

  if (progress.status === 'Valmis') {
    return { health: 'done', label: 'Valmis', detail: progress.detail, expectedPercent, actualPercent };
  }
  if (progress.status === 'Myöhässä' || (phase.endDate && phase.endDate < today)) {
    return {
      health: 'overdue',
      label: 'Myöhässä',
      detail: actualPercent === null
        ? `Valmistumispäivä ${formatDate(phase.endDate)} on ylitetty, eikä vaiheessa ole työmääräyksiä.`
        : `Valmistumispäivä ${formatDate(phase.endDate)} on ylitetty. Toteuma ${actualPercent} %.`,
      expectedPercent,
      actualPercent,
    };
  }
  if (phase.blockedWorkOrderCount > 0) {
    return {
      health: 'blocked',
      label: 'Estynyt',
      detail: `${phase.blockedWorkOrderCount} työmääräystä odottaa edeltävän työvaiheen valmistumista.`,
      expectedPercent,
      actualPercent,
    };
  }
  if (phase.workOrderCount === 0) {
    return {
      health: 'untracked',
      label: 'Ei työmääräyksiä',
      detail: 'Vaihe on vain aikataulumerkintä. Rakenna projektiin työkokonaisuus, jotta eteneminen seurataan automaattisesti.',
      expectedPercent,
      actualPercent,
    };
  }
  if (phase.unassignedWorkOrderCount > 0) {
    return {
      health: 'unassigned',
      label: 'Tekijä puuttuu',
      detail: `${phase.unassignedWorkOrderCount} työmääräykseltä puuttuu tekijä tai projektitiimi.`,
      expectedPercent,
      actualPercent,
    };
  }
  const unscheduledCount = phase.workOrderCount - phase.scheduledWorkOrderCount;
  if (unscheduledCount > 0) {
    return {
      health: 'unscheduled',
      label: 'Varaus puuttuu',
      detail: `${unscheduledCount} työmääräykseltä puuttuu kalenteriin vietävä työjakso.`,
      expectedPercent,
      actualPercent,
    };
  }
  if (actualPercent !== null && expectedPercent >= 30 && actualPercent + 20 < expectedPercent) {
    return {
      health: 'at-risk',
      label: 'Vaarassa',
      detail: `Aikataulun mukaan etenemisen pitäisi olla noin ${expectedPercent} %, mutta toteuma on ${actualPercent} %.`,
      expectedPercent,
      actualPercent,
    };
  }
  if (progress.status === 'Käynnissä' || (actualPercent ?? 0) > 0) {
    return {
      health: 'running',
      label: 'Käynnissä',
      detail: actualPercent === null ? progress.detail : `Toteuma ${actualPercent} %, aikataulun tavoite noin ${expectedPercent} %.`,
      expectedPercent,
      actualPercent,
    };
  }
  return {
    health: 'planned',
    label: 'Suunniteltu',
    detail: `Aloitus ${formatDate(phase.startDate)}.`,
    expectedPercent,
    actualPercent,
  };
}

function healthBadge(view: PhaseOperationalView) {
  const classes: Record<ScheduleHealth, string> = {
    overdue: 'bg-red-50 text-red-700',
    blocked: 'bg-rose-50 text-rose-700',
    'at-risk': 'bg-amber-50 text-amber-800',
    unscheduled: 'bg-orange-50 text-orange-700',
    unassigned: 'bg-violet-50 text-violet-700',
    untracked: 'bg-slate-100 text-slate-700',
    running: 'bg-blue-50 text-blue-700',
    planned: 'bg-sky-50 text-sky-700',
    done: 'bg-emerald-50 text-emerald-700',
  };
  return <Badge className={`border-0 ${classes[view.health]}`}>{view.label}</Badge>;
}

function timelineTone(health: ScheduleHealth): string {
  const tones: Record<ScheduleHealth, string> = {
    overdue: 'border-red-300 bg-red-100',
    blocked: 'border-rose-300 bg-rose-100',
    'at-risk': 'border-amber-300 bg-amber-100',
    unscheduled: 'border-orange-300 bg-orange-100',
    unassigned: 'border-violet-300 bg-violet-100',
    untracked: 'border-slate-300 bg-slate-100',
    running: 'border-blue-300 bg-blue-100',
    planned: 'border-sky-300 bg-sky-100',
    done: 'border-emerald-300 bg-emerald-100',
  };
  return tones[health];
}

function timelineFillTone(health: ScheduleHealth): string {
  if (health === 'done') return 'bg-emerald-500';
  if (health === 'overdue' || health === 'blocked') return 'bg-red-500';
  if (health === 'at-risk' || health === 'unscheduled') return 'bg-amber-500';
  if (health === 'unassigned') return 'bg-violet-500';
  if (health === 'untracked') return 'bg-slate-400';
  return 'bg-blue-500';
}

function timelinePosition(phase: ProjectPhase, rangeStart: Date): { left: number; width: number } | null {
  const start = parseDate(phase.startDate);
  const end = parseDate(phase.endDate);
  const rangeEnd = addDays(rangeStart, TIMELINE_DAYS - 1);
  if (end < rangeStart || start > rangeEnd) return null;
  const clippedStart = start < rangeStart ? rangeStart : start;
  const clippedEnd = end > rangeEnd ? rangeEnd : end;
  const startIndex = differenceInCalendarDays(clippedStart, rangeStart);
  const dayCount = differenceInCalendarDays(clippedEnd, clippedStart) + 1;
  return {
    left: (startIndex / TIMELINE_DAYS) * 100,
    width: Math.max((dayCount / TIMELINE_DAYS) * 100, 2),
  };
}

function healthPriority(health: ScheduleHealth): number {
  const priorities: Record<ScheduleHealth, number> = {
    overdue: 0,
    blocked: 1,
    'at-risk': 2,
    unassigned: 3,
    unscheduled: 4,
    untracked: 5,
    running: 6,
    planned: 7,
    done: 8,
  };
  return priorities[health];
}

export default function Aikataulutus() {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const { projects } = useAppDataContext();
  const { phases, loading, error, refresh } = useSchedulingData();
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState(ALL_PROJECTS);
  const [healthFilter, setHealthFilter] = useState(ALL_HEALTH);
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [timelineOffsetDays, setTimelineOffsetDays] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectPhase | null>(null);
  const [form, setForm] = useState<PhaseForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const projectOptions = useMemo(() => {
    const byId = new Map<string, string>();
    projects.forEach((project) => byId.set(project.id, project.name));
    phases.forEach((phase) => {
      if (phase.projectId) byId.set(phase.projectId, phase.projectName);
    });
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fi'));
  }, [phases, projects]);

  const filteredPhases = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fi');
    return phases.filter((phase) => {
      const view = operationalView(phase);
      const matchesSearch = !query
        || `${phase.projectName} ${phase.name} ${phase.notes}`.toLocaleLowerCase('fi').includes(query);
      const matchesProject = projectFilter === ALL_PROJECTS || phase.projectId === projectFilter;
      const matchesHealth = healthFilter === ALL_HEALTH || view.health === healthFilter;
      return matchesSearch && matchesProject && matchesHealth;
    });
  }, [healthFilter, phases, projectFilter, search]);

  const groupedPhases = useMemo(() => {
    const groups = new Map<string, ProjectPhase[]>();
    for (const phase of filteredPhases) {
      const key = phase.projectName || 'Projekti puuttuu';
      groups.set(key, [...(groups.get(key) ?? []), phase]);
    }
    return [...groups.entries()]
      .map(([projectName, items]) => ({
        projectName,
        projectId: items.find((item) => item.projectId)?.projectId,
        items: items.sort((a, b) => a.startDate.localeCompare(b.startDate)),
      }))
      .sort((a, b) => a.projectName.localeCompare(b.projectName, 'fi'));
  }, [filteredPhases]);

  const summary = useMemo(() => {
    const views = phases.map((phase) => ({ phase, view: operationalView(phase) }));
    return {
      running: views.filter((item) => item.view.health === 'running').length,
      overdue: views.filter((item) => item.view.health === 'overdue').length,
      atRisk: views.filter((item) => item.view.health === 'at-risk' || item.view.health === 'blocked').length,
      missingResources: views.filter((item) => item.view.health === 'unassigned' || item.view.health === 'unscheduled').length,
      done: views.filter((item) => item.view.health === 'done').length,
    };
  }, [phases]);

  const attentionPhases = useMemo(() => phases
    .map((phase) => ({ phase, view: operationalView(phase) }))
    .filter(({ view }) => ['overdue', 'blocked', 'at-risk', 'unassigned', 'unscheduled', 'untracked'].includes(view.health))
    .sort((a, b) => {
      const priority = healthPriority(a.view.health) - healthPriority(b.view.health);
      return priority || a.phase.endDate.localeCompare(b.phase.endDate);
    })
    .slice(0, 8), [phases]);

  const timelineStart = useMemo(
    () => startOfWeek(addDays(new Date(), timelineOffsetDays), { weekStartsOn: 1 }),
    [timelineOffsetDays],
  );
  const timelineEnd = addDays(timelineStart, TIMELINE_DAYS - 1);
  const timelineWeeks = Array.from({ length: 6 }, (_, index) => {
    const start = addDays(timelineStart, index * 7);
    const end = addDays(start, 6);
    return {
      key: format(start, 'yyyy-MM-dd'),
      label: `vko ${format(start, 'I')}`,
      detail: `${format(start, 'd.M.', { locale: fi })}–${format(end, 'd.M.', { locale: fi })}`,
    };
  });
  const timelinePhases = filteredPhases.filter((phase) => timelinePosition(phase, timelineStart));

  const openEdit = (phase: ProjectPhase) => {
    setEditing(phase);
    setForm({
      name: phase.name,
      startDate: phase.startDate,
      endDate: phase.endDate,
      status: phase.status,
      notes: phase.notes,
    });
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!editing || !currentOrg) return;
    const nextErrors: string[] = [];
    if (!form.name.trim()) nextErrors.push('Vaiheen nimi on pakollinen.');
    if (!form.startDate || !form.endDate) nextErrors.push('Aloitus- ja valmistumispäivä ovat pakollisia.');
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      nextErrors.push('Valmistumispäivä ei voi olla ennen aloituspäivää.');
    }
    setFormErrors(nextErrors);
    if (nextErrors.length > 0) return;

    setSaving(true);
    setOperationError(null);
    try {
      if (editing.workOrderCount > 0) {
        await rescheduleProjectPhase({
          organizationId: currentOrg.id,
          projectPhaseId: editing.id,
          startDate: form.startDate,
          endDate: form.endDate,
          notes: form.notes.trim(),
        });
      } else {
        await updateProjectPhase(currentOrg.id, editing.id, {
          name: form.name.trim(),
          startDate: form.startDate,
          endDate: form.endDate,
          status: form.status,
          notes: form.notes.trim(),
        });
      }
      await refresh();
      setDialogOpen(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Tallennus epäonnistui.';
      setOperationError(message);
      logger.error('Tuotannon aikataulun tallennus epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-hero text-text-primary">Tuotannon aikataulu</h1>
          <p className="mt-1 max-w-3xl break-words text-body-sm text-text-secondary">
            Projektien työvaiheet, määräajat ja poikkeamat yhdessä näkymässä. Eteneminen tulee
            työmääräyksistä, ja vaiheiden aikataulumuutokset päivittyvät myös resurssikalenteriin.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => navigate('/tyovuorokalenteri')} className="gap-2">
            <UsersRound size={16} /> Resurssikalenteri
          </Button>
          <Button onClick={() => navigate('/projektit')} className="gap-2">
            <FolderKanban size={16} /> Rakenna työkokonaisuus
          </Button>
        </div>
      </div>

      {(error || operationError) && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span className="break-words">{operationError ?? error}</span>
        </div>
      )}

      <Card className="border-blue-200 bg-blue-50/50 shadow-none">
        <CardContent className="grid gap-4 p-4 md:grid-cols-3 md:p-5">
          {[
            { number: '1', title: 'Rakenna projektiin työkokonaisuus', detail: 'Määritä kohteet, työvaiheet, tekijät ja päivämäärät.' },
            { number: '2', title: 'Työmääräykset ohjaavat toteumaa', detail: 'Valmistuneet työmääräykset päivittävät vaiheen etenemisen automaattisesti.' },
            { number: '3', title: 'Poikkeamat nousevat näkyviin', detail: 'Myöhästyminen, esteet sekä puuttuvat tekijät tai varaukset näkyvät ilman käsityötä.' },
          ].map((item) => (
            <div key={item.number} className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">{item.number}</span>
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-blue-950">{item.title}</p>
                <p className="mt-1 break-words text-xs text-blue-800">{item.detail}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Käynnissä', value: summary.running, detail: 'etenee ilman havaittua poikkeamaa', icon: Clock },
          { label: 'Myöhässä', value: summary.overdue, detail: 'valmistumispäivä ylitetty', icon: AlertTriangle },
          { label: 'Vaarassa tai estynyt', value: summary.atRisk, detail: 'vaatii työnjohdon toimenpiteen', icon: Layers3 },
          { label: 'Resurssi puuttuu', value: summary.missingResources, detail: 'tekijä tai kalenterivaraus puuttuu', icon: UsersRound },
          { label: 'Valmiina', value: summary.done, detail: 'kaikki työmääräykset päätetty', icon: CheckCircle2 },
        ].map((item) => (
          <Card key={item.label} className="border-slate-200 shadow-card">
            <CardContent className="p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <span className="break-words text-xs font-semibold uppercase tracking-wider text-text-secondary">{item.label}</span>
                <item.icon size={18} className="shrink-0 text-primary" />
              </div>
              <p className="font-mono text-3xl font-bold text-text-primary">{item.value}</p>
              <p className="mt-1 break-words text-xs text-text-secondary">{item.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_minmax(12rem,0.7fr)_minmax(12rem,0.7fr)]">
              <div className="space-y-2">
                <Label htmlFor="schedule-search">Haku</Label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <Input
                    id="schedule-search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Hae projektia tai työvaihetta…"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Projekti</Label>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_PROJECTS}>Kaikki projektit</SelectItem>
                    {projectOptions.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tilanne</Label>
                <Select value={healthFilter} onValueChange={setHealthFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_HEALTH}>Kaikki tilanteet</SelectItem>
                    <SelectItem value="overdue">Myöhässä</SelectItem>
                    <SelectItem value="blocked">Estynyt</SelectItem>
                    <SelectItem value="at-risk">Vaarassa</SelectItem>
                    <SelectItem value="unassigned">Tekijä puuttuu</SelectItem>
                    <SelectItem value="unscheduled">Varaus puuttuu</SelectItem>
                    <SelectItem value="untracked">Ei työmääräyksiä</SelectItem>
                    <SelectItem value="running">Käynnissä</SelectItem>
                    <SelectItem value="planned">Suunniteltu</SelectItem>
                    <SelectItem value="done">Valmis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button variant={viewMode === 'overview' ? 'default' : 'outline'} onClick={() => setViewMode('overview')} className="gap-2">
                <List size={16} /> Tilanne
              </Button>
              <Button variant={viewMode === 'timeline' ? 'default' : 'outline'} onClick={() => setViewMode('timeline')} className="gap-2">
                <CalendarDays size={16} /> 6 viikkoa
              </Button>
            </div>
          </div>
          <p className="break-words text-xs text-text-secondary">
            Näytetään {filteredPhases.length} / {phases.length} työvaihetta.
          </p>
        </CardContent>
      </Card>

      {viewMode === 'overview' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.7fr)]">
          <div className="space-y-5">
            {groupedPhases.map((group) => (
              <Card key={group.projectName} className="border-slate-200 shadow-card">
                <CardHeader className="border-b bg-slate-50/80 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <CardTitle className="break-words text-lg">{group.projectName}</CardTitle>
                      <p className="mt-1 break-words text-xs text-text-secondary">{group.items.length} työvaihetta</p>
                    </div>
                    {group.projectId && (
                      <Link to={`/projektit/${group.projectId}`} className="inline-flex min-h-9 items-center gap-1 self-start rounded-lg px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">
                        Avaa projekti <ArrowRight size={15} />
                      </Link>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="divide-y divide-slate-100 p-0">
                  {group.items.map((phase) => {
                    const progress = phaseProgress(phase);
                    const view = operationalView(phase);
                    return (
                      <div key={phase.id} className="grid grid-cols-1 gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.85fr)_minmax(0,1fr)_auto] lg:items-start">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="break-words font-semibold text-text-primary">{phase.name}</p>
                            {healthBadge(view)}
                          </div>
                          <p className="break-words text-xs text-text-secondary">{phase.notes || 'Ei lisätietoja'}</p>
                          <p className="break-words text-xs font-medium text-text-secondary">{view.detail}</p>
                        </div>
                        <div className="min-w-0 text-sm text-text-secondary">
                          <p className="break-words font-medium text-text-primary">{formatDate(phase.startDate)} – {formatDate(phase.endDate)}</p>
                          <p className="mt-1 text-xs">{durationDays(phase.startDate, phase.endDate)} kalenteripäivää</p>
                          <p className="mt-1 break-words text-xs">{phase.scheduledWorkOrderCount}/{phase.workOrderCount} työmääräystä kalenterissa</p>
                        </div>
                        <div className="min-w-0 space-y-2">
                          {progress.percent === null ? (
                            <p className="break-words text-sm font-medium text-slate-600">{progress.label}</p>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <Progress value={progress.percent} className="h-2" />
                                <span className="shrink-0 font-mono text-sm">{progress.label}</span>
                              </div>
                              <p className="break-words text-xs text-text-secondary">{progress.detail}</p>
                            </>
                          )}
                        </div>
                        <div className="flex justify-end">
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => openEdit(phase)}>
                            <Edit3 size={15} /> Aikataulu
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
            {!loading && groupedPhases.length === 0 && (
              <Card>
                <CardContent className="p-10 text-center sm:p-12">
                  <CalendarDays size={44} className="mx-auto mb-3 text-text-muted" />
                  <p className="font-semibold">Ei aikataulutettuja työvaiheita</p>
                  <p className="mx-auto mt-1 max-w-xl break-words text-sm text-text-secondary">
                    Työvaiheet luodaan projektin työkokonaisuudesta. Näin kohteet, työmääräykset, tekijät ja kalenterivaraukset pysyvät samassa rakenteessa.
                  </p>
                  <Button onClick={() => navigate('/projektit')} className="mt-4 gap-2">
                    <FolderKanban size={16} /> Avaa projektit
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="h-fit xl:sticky xl:top-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><AlertTriangle size={18} className="text-amber-600" /> Huomiota vaativat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {attentionPhases.map(({ phase, view }) => (
                <div key={phase.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">{healthBadge(view)}<span className="break-words text-xs text-text-secondary">{phase.projectName}</span></div>
                  <p className="mt-2 break-words text-sm font-semibold text-text-primary">{phase.name}</p>
                  <p className="mt-1 break-words text-xs text-text-secondary">{view.detail}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(phase)}>Korjaa aikataulu</Button>
                    {phase.projectId && <Button variant="ghost" size="sm" onClick={() => navigate(`/projektit/${phase.projectId}`)}>Avaa projekti <ArrowRight size={14} className="ml-1" /></Button>}
                  </div>
                </div>
              ))}
              {attentionPhases.length === 0 && (
                <div className="py-8 text-center">
                  <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-500" />
                  <p className="font-semibold">Ei havaittuja poikkeamia</p>
                  <p className="mt-1 break-words text-sm text-text-secondary">Aikataulut, tekijät ja kalenterivaraukset ovat kunnossa.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {viewMode === 'timeline' && (
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="break-words text-lg">Kuuden viikon tuotantosuunnitelma</CardTitle>
                <p className="mt-1 break-words text-xs text-text-secondary">{format(timelineStart, 'd.M.yyyy', { locale: fi })} – {format(timelineEnd, 'd.M.yyyy', { locale: fi })}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" onClick={() => setTimelineOffsetDays((value) => value - 14)} aria-label="Edelliset viikot"><ChevronLeft size={16} /></Button>
                <Button variant="outline" size="sm" onClick={() => setTimelineOffsetDays(0)}>Tänään</Button>
                <Button variant="outline" size="sm" onClick={() => setTimelineOffsetDays((value) => value + 14)} aria-label="Seuraavat viikot"><ChevronRight size={16} /></Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {timelineWeeks.map((week) => (
                <div key={week.key} className="rounded-lg bg-slate-50 px-3 py-2 text-center">
                  <p className="text-xs font-semibold text-text-primary">{week.label}</p>
                  <p className="break-words text-[11px] text-text-secondary">{week.detail}</p>
                </div>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {timelinePhases.map((phase) => {
              const position = timelinePosition(phase, timelineStart);
              const view = operationalView(phase);
              if (!position) return null;
              return (
                <div key={phase.id} className="grid gap-2 rounded-xl border border-slate-200 p-3 lg:grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)] lg:items-center">
                  <div className="min-w-0">
                    <p className="break-words text-xs text-text-secondary">{phase.projectName}</p>
                    <p className="break-words text-sm font-semibold text-text-primary">{phase.name}</p>
                    <div className="mt-1">{healthBadge(view)}</div>
                  </div>
                  <div className="relative h-12 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="absolute inset-0 grid grid-cols-6">
                      {timelineWeeks.map((week, index) => <div key={week.key} className={cn(index > 0 && 'border-l border-slate-200')} />)}
                    </div>
                    <div
                      className={cn('absolute top-2 h-8 overflow-hidden rounded-md border shadow-sm', timelineTone(view.health))}
                      style={{ left: `${position.left}%`, width: `${position.width}%` }}
                      title={`${phase.name}: ${formatDate(phase.startDate)}–${formatDate(phase.endDate)}`}
                    >
                      <div
                        className={cn('absolute inset-y-0 left-0 opacity-80', timelineFillTone(view.health))}
                        style={{ width: `${view.actualPercent ?? 0}%` }}
                      />
                      <span className="relative z-10 flex h-full items-center px-2 text-[11px] font-semibold text-slate-900">
                        {view.actualPercent === null ? view.label : `${view.actualPercent} %`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {!loading && timelinePhases.length === 0 && (
              <div className="py-10 text-center">
                <CalendarDays size={40} className="mx-auto mb-3 text-text-muted" />
                <p className="font-semibold">Valitulla kuuden viikon jaksolla ei ole työvaiheita</p>
                <p className="mt-1 break-words text-sm text-text-secondary">Siirry edellisiin tai seuraaviin viikkoihin tai muuta suodattimia.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Muokkaa tuotannon aikataulua</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="break-words text-xs text-text-secondary">Projekti</p>
              <p className="break-words font-semibold text-text-primary">{editing.projectName}</p>
            </div>
          )}
          {formErrors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formErrors.map((item) => <p key={item} className="break-words">{item}</p>)}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="phase-name">Työvaihe</Label>
              {editing && editing.workOrderCount > 0 ? (
                <div id="phase-name" className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">{form.name}</div>
              ) : (
                <Input id="phase-name" value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phase-start">Aloitus *</Label>
              <Input id="phase-start" type="date" value={form.startDate} onChange={(event) => setForm((previous) => ({ ...previous, startDate: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phase-end">Valmistuminen *</Label>
              <Input id="phase-end" type="date" value={form.endDate} onChange={(event) => setForm((previous) => ({ ...previous, endDate: event.target.value }))} />
            </div>
            {editing && editing.workOrderCount > 0 ? (
              <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 sm:col-span-2">
                <p className="break-words font-medium">Muutos päivittää koko työvaiheen</p>
                <p className="break-words text-xs text-blue-800">
                  Uudet päivämäärät siirretään {editing.workOrderCount - editing.completedWorkOrderCount} keskeneräiselle työmääräykselle ja niiden resurssikalenterivarauksille. Valmiiden ja peruttujen töiden historiaa ei muuteta.
                </p>
              </div>
            ) : (
              <div className="space-y-2 sm:col-span-2">
                <Label>Tila</Label>
                <Select value={form.status} onValueChange={(value: PhaseStatus) => setForm((previous) => ({ ...previous, status: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Suunniteltu">Suunniteltu</SelectItem>
                    <SelectItem value="Käynnissä">Käynnissä</SelectItem>
                    <SelectItem value="Myöhässä">Myöhässä</SelectItem>
                    <SelectItem value="Valmis">Valmis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="phase-notes">Lisätiedot</Label>
              <Textarea id="phase-notes" value={form.notes} onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Peruuta</Button>
            <Button onClick={() => void save()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna aikataulu'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
