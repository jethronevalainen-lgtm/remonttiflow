import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ClipboardCopy,
  ClipboardList,
  Copy,
  Layers3,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  Wand2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  buildInternalResourceConflicts,
  buildScheduleWarnings,
  createGenericProjectPhases,
  defaultPhaseDuration,
  isIsoDate,
  resolveWorkItemAssignees,
  scheduleAllAssignments,
  scheduleTargetAssignments,
  selectedWorkAssignments,
  synchronizeWorkAssignments,
  type ProjectWorkAssignmentDraft,
  type ProjectWorkPhaseDraft,
  type ProjectWorkTargetDraft,
} from '@/lib/projectWorkPlanBuilder';
import {
  createProjectWorkPlan,
  previewProjectWorkPlanConflicts,
  type ProjectWorkPlanConflict,
} from '@/lib/supabase/projectWorkPlans';
import type { OrganizationPerson } from '@/lib/supabase/workManagement';
import AssigneeSelect from './AssigneeSelect';
import ProjectWorkTargetsStep from './ProjectWorkTargetsStep';
import { formatDate } from './workPlanFormatting';
import { useProjectUnitImportOptions } from './useProjectUnitImportOptions';
import type { Project, WorkOrderPriority } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  organizationId: string;
  project: Project;
  people: OrganizationPerson[];
  onOpenChange: (open: boolean) => void;
  onCreated: (message: string) => Promise<void> | void;
}

const PRIORITIES: WorkOrderPriority[] = ['Korkea', 'Normaali', 'Matala'];
const NO_SOURCE = '__none__';

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyPhase(project: Project): ProjectWorkPhaseDraft {
  return {
    id: uniqueId('phase'),
    key: uniqueId('vaihe'),
    title: '',
    type: '',
    description: '',
    startDate: project.startDate || '',
    endDate: project.endDate || project.startDate || '',
    durationWorkdays: 1,
    startTime: '07:00',
    endTime: '15:30',
    weekdays: [1, 2, 3, 4, 5],
    priority: 'Normaali',
    assigneeUserIds: [],
  };
}

function clonePhase(phase: ProjectWorkPhaseDraft): ProjectWorkPhaseDraft {
  return {
    ...phase,
    id: uniqueId('phase'),
    key: uniqueId('vaihe'),
    assigneeUserIds: [...phase.assigneeUserIds],
    weekdays: [...(phase.weekdays ?? [1, 2, 3, 4, 5])],
  };
}

function stepClasses(active: boolean, complete: boolean): string {
  return cn(
    'flex min-w-0 items-center gap-3 rounded-xl border px-3 py-3 text-left transition',
    complete && 'border-emerald-200 bg-emerald-50',
    active && !complete && 'border-primary/40 bg-primary/5',
    !active && !complete && 'border-slate-200 bg-slate-50/60',
  );
}

export default function TargetFirstProjectWorkPlanDialog({
  open,
  organizationId,
  project,
  people,
  onOpenChange,
  onCreated,
}: Props) {
  const [step, setStep] = useState(1);
  const [planName, setPlanName] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [targets, setTargets] = useState<ProjectWorkTargetDraft[]>([]);
  const [phases, setPhases] = useState<ProjectWorkPhaseDraft[]>([]);
  const [assignments, setAssignments] = useState<ProjectWorkAssignmentDraft[]>([]);
  const [activeTargetId, setActiveTargetId] = useState('');
  const [copySourceTargetId, setCopySourceTargetId] = useState(NO_SOURCE);
  const [errors, setErrors] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<ProjectWorkPlanConflict[]>([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [conflictsAccepted, setConflictsAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  const units = useProjectUnitImportOptions({ organizationId, projectId: project.id, enabled: open });

  const availablePeople = useMemo(
    () => people.filter((person) => ['worker', 'supervisor', 'project_coordinator', 'admin'].includes(person.role)),
    [people],
  );
  const targetMap = useMemo(() => new Map(targets.map((target) => [target.id, target])), [targets]);
  const phaseMap = useMemo(() => new Map(phases.map((phase) => [phase.id, phase])), [phases]);
  const selectedAssignments = useMemo(() => selectedWorkAssignments(assignments), [assignments]);
  const selectedPhaseIds = useMemo(() => new Set(selectedAssignments.map((item) => item.phaseId)), [selectedAssignments]);
  const usedPhases = useMemo(() => phases.filter((phase) => selectedPhaseIds.has(phase.id)), [phases, selectedPhaseIds]);
  const activeTarget = targetMap.get(activeTargetId) ?? targets[0];
  const activeTargetAssignments = useMemo(() => {
    if (!activeTarget) return [];
    const order = new Map(phases.map((phase, index) => [phase.id, index]));
    return assignments
      .filter((item) => item.targetId === activeTarget.id && item.enabled)
      .sort((a, b) => (order.get(a.phaseId) ?? 0) - (order.get(b.phaseId) ?? 0));
  }, [activeTarget, assignments, phases]);
  const availableForActiveTarget = useMemo(() => {
    if (!activeTarget) return [];
    const enabled = new Set(activeTargetAssignments.map((item) => item.phaseId));
    return usedPhases.filter((phase) => !enabled.has(phase.id));
  }, [activeTarget, activeTargetAssignments, usedPhases]);
  const scheduleWarnings = useMemo(
    () => buildScheduleWarnings(targets, usedPhases, assignments),
    [targets, usedPhases, assignments],
  );
  const internalConflicts = useMemo(
    () => buildInternalResourceConflicts(targets, usedPhases, assignments),
    [targets, usedPhases, assignments],
  );

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setPlanName(`${project.name} – työkokonaisuus`);
    setPlanDescription('');
    setTargets([]);
    setPhases([]);
    setAssignments([]);
    setActiveTargetId('');
    setCopySourceTargetId(NO_SOURCE);
    setErrors([]);
    setConflicts([]);
    setCheckingConflicts(false);
    setConflictsAccepted(false);
    setSaving(false);
  }, [open, project.name]);

  useEffect(() => {
    setAssignments((current) => synchronizeWorkAssignments(targets, phases, current, false));
  }, [targets, phases]);

  useEffect(() => {
    if (targets.length === 0) {
      setActiveTargetId('');
      setCopySourceTargetId(NO_SOURCE);
      return;
    }
    if (!targets.some((target) => target.id === activeTargetId)) setActiveTargetId(targets[0].id);
    if (copySourceTargetId !== NO_SOURCE && !targets.some((target) => target.id === copySourceTargetId)) {
      setCopySourceTargetId(NO_SOURCE);
    }
  }, [activeTargetId, copySourceTargetId, targets]);

  useEffect(() => {
    setConflictsAccepted(false);
  }, [assignments, phases, targets]);

  const personName = (userId: string) => availablePeople.find((person) => person.userId === userId)?.name ?? userId;
  const selectedForTarget = (targetId: string) => assignments.filter((item) => item.targetId === targetId && item.enabled).length;
  const selectedForPhase = (phaseId: string) => assignments.filter((item) => item.phaseId === phaseId && item.enabled).length;

  const applyTargets = (next: ProjectWorkTargetDraft[]) => {
    setTargets(next);
    setErrors([]);
  };

  const updatePhase = (id: string, patch: Partial<ProjectWorkPhaseDraft>) => {
    setPhases((current) => current.map((phase) => phase.id === id ? { ...phase, ...patch } : phase));
  };

  const updateAssignment = (id: string, patch: Partial<ProjectWorkAssignmentDraft>) => {
    setAssignments((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const enablePhaseForTarget = (targetId: string, phaseId: string) => {
    setAssignments((current) => synchronizeWorkAssignments(targets, phases, current, false).map((item) => (
      item.targetId === targetId && item.phaseId === phaseId ? { ...item, enabled: true } : item
    )));
  };

  const addCustomJob = (targetId: string) => {
    const phase = emptyPhase(project);
    const nextPhases = [...phases, phase];
    setPhases(nextPhases);
    setAssignments((current) => synchronizeWorkAssignments(targets, nextPhases, current, false).map((item) => (
      item.targetId === targetId && item.phaseId === phase.id ? { ...item, enabled: true } : item
    )));
    setErrors([]);
  };

  const addGenericTemplateToTarget = (targetId: string) => {
    const templates = createGenericProjectPhases({ startDate: project.startDate, endDate: project.endDate });
    const nextPhases = [...phases];
    const phaseIds: string[] = [];
    for (const template of templates) {
      const existing = nextPhases.find((phase) => phase.title.trim().toLocaleLowerCase('fi') === template.title.trim().toLocaleLowerCase('fi'));
      if (existing) {
        phaseIds.push(existing.id);
      } else {
        const phase = clonePhase(template);
        nextPhases.push(phase);
        phaseIds.push(phase.id);
      }
    }
    const enabled = new Set(phaseIds);
    setPhases(nextPhases);
    setAssignments((current) => synchronizeWorkAssignments(targets, nextPhases, current, false).map((item) => (
      item.targetId === targetId && enabled.has(item.phaseId) ? { ...item, enabled: true } : item
    )));
    setErrors([]);
  };

  const copyJobsToActiveTarget = () => {
    if (!activeTarget || copySourceTargetId === NO_SOURCE || copySourceTargetId === activeTarget.id) return;
    const sourcePhaseIds = new Set(assignments
      .filter((item) => item.targetId === copySourceTargetId && item.enabled)
      .map((item) => item.phaseId));
    if (sourcePhaseIds.size === 0) {
      setErrors(['Valitulla lähdekohteella ei ole kopioitavia töitä.']);
      return;
    }
    setAssignments((current) => synchronizeWorkAssignments(targets, phases, current, false).map((item) => (
      item.targetId === activeTarget.id && sourcePhaseIds.has(item.phaseId) ? { ...item, enabled: true } : item
    )));
    setErrors([]);
  };

  const removeJobFromTarget = (targetId: string, phaseId: string) => {
    setAssignments((current) => current.map((item) => (
      item.targetId === targetId && item.phaseId === phaseId ? { ...item, enabled: false } : item
    )));
  };

  const makeJobTargetSpecific = (targetId: string, phaseId: string) => {
    const sourcePhase = phaseMap.get(phaseId);
    const sourceAssignment = assignments.find((item) => item.targetId === targetId && item.phaseId === phaseId);
    if (!sourcePhase || !sourceAssignment) return;
    const phase = clonePhase(sourcePhase);
    const nextPhases = [...phases, phase];
    setPhases(nextPhases);
    setAssignments((current) => synchronizeWorkAssignments(targets, nextPhases, current, false).map((item) => {
      if (item.targetId === targetId && item.phaseId === phaseId) return { ...item, enabled: false };
      if (item.targetId === targetId && item.phaseId === phase.id) {
        return {
          ...item,
          enabled: true,
          startDate: sourceAssignment.startDate,
          endDate: sourceAssignment.endDate,
          assigneeUserIds: [...sourceAssignment.assigneeUserIds],
          manualSchedule: sourceAssignment.manualSchedule,
        };
      }
      return item;
    }));
  };

  const autoScheduleTarget = (targetId: string, overwriteManual = false) => {
    const target = targetMap.get(targetId);
    if (!target) return;
    setAssignments((current) => scheduleTargetAssignments(target, usedPhases, current, { overwriteManual }));
  };

  const autoScheduleAll = (overwriteManual = false) => {
    setAssignments((current) => scheduleAllAssignments(targets, usedPhases, current, { overwriteManual }));
  };

  const validateTargets = (): string[] => {
    const next: string[] = [];
    if (!planName.trim()) next.push('Työkokonaisuuden nimi on pakollinen.');
    if (targets.length === 0) next.push('Lisää vähintään yksi kohde.');
    targets.forEach((target, index) => {
      const label = target.title.trim() || `Kohde ${index + 1}`;
      if (!target.title.trim()) next.push(`Kohde ${index + 1}: nimi puuttuu.`);
      if (!isIsoDate(target.startDate) || !isIsoDate(target.endDate)) next.push(`${label}: aloitus- tai tavoitevalmistumispäivä puuttuu.`);
      else if (target.endDate < target.startDate) next.push(`${label}: tavoitevalmistuminen ei voi olla ennen aloitusta.`);
    });
    return next;
  };

  const validateJobs = (): string[] => {
    const next: string[] = [];
    targets.forEach((target) => {
      if (selectedForTarget(target.id) === 0) next.push(`${target.title}: lisää vähintään yksi työ.`);
    });
    usedPhases.forEach((phase, index) => {
      const label = phase.title.trim() || `Työ ${index + 1}`;
      if (!phase.title.trim()) next.push(`${label}: nimi puuttuu.`);
      const duration = Number(phase.durationWorkdays);
      if (!Number.isFinite(duration) || duration < 1 || duration > 60) next.push(`${label}: keston pitää olla 1–60 työpäivää.`);
      if (!phase.startTime || !phase.endTime || phase.endTime <= phase.startTime) next.push(`${label}: päivittäinen työaika on virheellinen.`);
    });
    if (selectedAssignments.length > 500) next.push('Kokonaisuus muodostaisi yli 500 työmääräystä. Jaa työ useampaan kokonaisuuteen.');
    return next;
  };

  const validateSchedules = (): string[] => {
    const next: string[] = [];
    for (const item of selectedAssignments) {
      const target = targetMap.get(item.targetId);
      const phase = phaseMap.get(item.phaseId);
      if (!target || !phase) continue;
      const label = `${target.title} – ${phase.title}`;
      if (!isIsoDate(item.startDate) || !isIsoDate(item.endDate)) next.push(`${label}: aikataulu puuttuu.`);
      else if (item.endDate < item.startDate) next.push(`${label}: valmistuminen ei voi olla ennen aloitusta.`);
      if (resolveWorkItemAssignees(item, target, phase).length === 0) next.push(`${label}: tekijä puuttuu.`);
    }
    return next;
  };

  const goToStep = (nextStep: number) => {
    setErrors([]);
    setStep(nextStep);
  };

  const continueFromTargets = () => {
    const next = validateTargets();
    setErrors(next);
    if (next.length === 0) goToStep(2);
  };

  const continueFromJobs = () => {
    const next = [...validateTargets(), ...validateJobs()];
    setErrors(next);
    if (next.length > 0) return;
    autoScheduleAll(false);
    goToStep(3);
  };

  const continueFromSchedule = async () => {
    const next = [...validateTargets(), ...validateJobs(), ...validateSchedules()];
    setErrors(next);
    if (next.length > 0) return;
    setCheckingConflicts(true);
    try {
      const serverConflicts = await previewProjectWorkPlanConflicts({
        organizationId,
        targets,
        phases: usedPhases,
        assignments,
      });
      setConflicts(serverConflicts);
      setConflictsAccepted(false);
      goToStep(4);
    } catch (caught) {
      setErrors([caught instanceof Error ? caught.message : 'Resurssitarkistus epäonnistui.']);
    } finally {
      setCheckingConflicts(false);
    }
  };

  const save = async () => {
    const next = [...validateTargets(), ...validateJobs(), ...validateSchedules()];
    if ((conflicts.length > 0 || internalConflicts.length > 0) && !conflictsAccepted) {
      next.push('Hyväksy havaitut resurssipäällekkäisyydet ennen luontia.');
    }
    setErrors(next);
    if (next.length > 0) return;

    setSaving(true);
    try {
      const result = await createProjectWorkPlan({
        organizationId,
        projectId: project.id,
        name: planName,
        description: planDescription,
        targets,
        phases: usedPhases,
        assignments,
      });
      await onCreated(`${planName.trim()} luotiin: ${result.targetCount} kohdetta ja ${result.workOrderCount} kalenteroitua työmääräystä.`);
      onOpenChange(false);
    } catch (caught) {
      setErrors([caught instanceof Error ? caught.message : 'Työkokonaisuuden luonti epäonnistui.']);
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    { number: 1, title: 'Kohteet', description: `${targets.length} kohdetta`, icon: ClipboardList },
    { number: 2, title: 'Kohteiden työt', description: `${selectedAssignments.length} työtä`, icon: Layers3 },
    { number: 3, title: 'Aikataulu ja tekijät', description: 'kohdekohtainen', icon: CalendarDays },
    { number: 4, title: 'Tarkista ja luo', description: `${selectedAssignments.length} työmääräystä`, icon: CheckCircle2 },
  ];

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[96vh] overflow-y-auto sm:max-w-[96vw] xl:max-w-7xl">
        <DialogHeader>
          <DialogTitle>Rakenna projektin työkokonaisuus</DialogTitle>
          <p className="text-sm text-text-secondary">
            Lisää kohteet ja määritä jokaiselle suoraan sen omat työt. Kopiointia ja mallipohjia käytetään vain silloin, kun käyttäjä valitsee ne erikseen.
          </p>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map((item) => (
            <button
              type="button"
              key={item.number}
              className={stepClasses(step === item.number, step > item.number)}
              onClick={() => item.number < step && goToStep(item.number)}
              disabled={item.number > step}
            >
              <span className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                step > item.number ? 'bg-emerald-600 text-white' : step === item.number ? 'bg-primary text-white' : 'bg-slate-200 text-slate-600',
              )}>
                {step > item.number ? <CheckCircle2 size={17} /> : item.number}
              </span>
              <item.icon size={17} className="hidden shrink-0 text-text-muted 2xl:block" />
              <div className="min-w-0 text-left">
                <p className="font-semibold">{item.title}</p>
                <p className="text-xs text-text-secondary">{item.description}</p>
              </div>
            </button>
          ))}
        </div>

        {errors.length > 0 && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {errors.slice(0, 20).map((error) => <p key={error}>• {error}</p>)}
            {errors.length > 20 && <p>• Lisäksi {errors.length - 20} muuta puutetta.</p>}
          </div>
        )}

        {step === 1 && (
          <ProjectWorkTargetsStep
            project={project}
            people={availablePeople}
            planName={planName}
            planDescription={planDescription}
            targets={targets}
            unitOptions={units.options}
            unitsLoading={units.loading}
            unitsError={units.error}
            onReloadUnits={() => void units.reload()}
            onPlanNameChange={setPlanName}
            onPlanDescriptionChange={setPlanDescription}
            onTargetsChange={applyTargets}
          />
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="font-semibold text-blue-950">Määritä jokaisen kohteen omat työt</p>
              <p className="mt-1 text-sm text-blue-900">Uusi työ lisätään vain valittuun kohteeseen. Mallipohja tai kopiointi vaikuttaa muihin kohteisiin vain käyttäjän erillisestä valinnasta.</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
              <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-3 flex items-center justify-between"><p className="font-semibold">Kohteet</p><Badge variant="secondary">{targets.length}</Badge></div>
                <div className="max-h-[680px] space-y-2 overflow-y-auto pr-1">
                  {targets.map((target) => (
                    <button type="button" key={target.id} className={cn('w-full rounded-xl border p-3 text-left transition', activeTarget?.id === target.id ? 'border-primary/40 bg-white shadow-sm' : 'border-transparent hover:border-slate-200 hover:bg-white')} onClick={() => setActiveTargetId(target.id)}>
                      <span className="block font-semibold">{target.title}</span>
                      <span className="mt-1 block text-xs text-text-secondary">{selectedForTarget(target.id)} työtä · tavoite {formatDate(target.endDate)}</span>
                    </button>
                  ))}
                </div>
              </aside>

              {activeTarget && (
                <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Valittu kohde</p><h3 className="mt-1 text-xl font-bold">{activeTarget.title}</h3><p className="mt-1 text-sm text-text-secondary">Lisää tähän vain ne työt, jotka tässä kohteessa oikeasti tehdään.</p></div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => addGenericTemplateToTarget(activeTarget.id)}><Sparkles size={16} className="mr-2" /> Lisää perusrunko tähän</Button>
                      <Button onClick={() => addCustomJob(activeTarget.id)}><Plus size={16} className="mr-2" /> Lisää työ</Button>
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div className="space-y-1"><Label className="text-xs">Kopioi työt toisesta kohteesta tähän</Label><Select value={copySourceTargetId} onValueChange={setCopySourceTargetId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NO_SOURCE}>Valitse lähdekohde</SelectItem>{targets.filter((target) => target.id !== activeTarget.id).map((target) => <SelectItem key={target.id} value={target.id}>{target.title} ({selectedForTarget(target.id)} työtä)</SelectItem>)}</SelectContent></Select></div>
                    <Button variant="secondary" disabled={copySourceTargetId === NO_SOURCE} onClick={copyJobsToActiveTarget}><ClipboardCopy size={16} className="mr-2" /> Kopioi tähän</Button>
                  </div>

                  {availableForActiveTarget.length > 0 && (
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-sm font-semibold">Lisää projektissa jo käytetty työ</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {availableForActiveTarget.map((phase) => <Button key={phase.id} size="sm" variant="outline" onClick={() => enablePhaseForTarget(activeTarget.id, phase.id)}><Plus size={14} className="mr-1.5" /> {phase.title || 'Nimetön työ'}</Button>)}
                      </div>
                    </div>
                  )}

                  {activeTargetAssignments.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center">
                      <Layers3 size={42} className="mx-auto text-slate-300" />
                      <p className="mt-3 font-semibold">Tälle kohteelle ei ole vielä lisätty töitä</p>
                      <p className="mt-1 text-sm text-text-secondary">Lisää työ yksittäin, käytä perusrunkoa tai kopioi toisesta kohteesta.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activeTargetAssignments.map((item, index) => {
                        const phase = phaseMap.get(item.phaseId);
                        if (!phase) return null;
                        const usageCount = selectedForPhase(phase.id);
                        return (
                          <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                              <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">{index + 1}</span><div><p className="font-semibold">{phase.title || `Työ ${index + 1}`}</p><p className="text-xs text-text-secondary">{usageCount > 1 ? `Yhteinen määrittely ${usageCount} kohteessa` : 'Vain tässä kohteessa'}</p></div></div>
                              <div className="flex flex-wrap gap-2">
                                {usageCount > 1 && <Button size="sm" variant="outline" onClick={() => makeJobTargetSpecific(activeTarget.id, phase.id)}><Copy size={15} className="mr-1.5" /> Tee oma versio</Button>}
                                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => removeJobFromTarget(activeTarget.id, phase.id)}><Trash2 size={15} className="mr-1.5" /> Poista kohteesta</Button>
                              </div>
                            </div>
                            {usageCount > 1 && <div className="border-b border-blue-100 bg-blue-50 px-4 py-2 text-xs text-blue-900">Nimen, ohjeen tai keston muutos vaikuttaa kaikkiin tätä työtä käyttäviin kohteisiin. Valitse “Tee oma versio”, jos tämä asunto poikkeaa muista.</div>}
                            <div className="grid gap-4 p-4 xl:grid-cols-[1.2fr_0.8fr]">
                              <div className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label>Työn nimi *</Label><Input value={phase.title} onChange={(event) => updatePhase(phase.id, { title: event.target.value })} placeholder="Esim. Vinyylilattian asennus" /></div><div className="space-y-1"><Label>Työlaji</Label><Input value={phase.type} onChange={(event) => updatePhase(phase.id, { type: event.target.value })} placeholder="Esim. Lattiatyö" /></div></div>
                                <div className="space-y-1"><Label>Työohje tai sisältö</Label><Textarea value={phase.description} onChange={(event) => updatePhase(phase.id, { description: event.target.value })} rows={3} placeholder="Mitä työssä tehdään ja mitä pitää huomioida" /></div>
                                <div className="grid gap-3 sm:grid-cols-4">
                                  <div className="space-y-1"><Label>Oletuskesto *</Label><Input type="number" min={1} max={60} value={phase.durationWorkdays ?? 1} onChange={(event) => updatePhase(phase.id, { durationWorkdays: Number(event.target.value) })} /></div>
                                  <div className="space-y-1"><Label>Alkaa</Label><Input type="time" value={phase.startTime || '07:00'} onChange={(event) => updatePhase(phase.id, { startTime: event.target.value })} /></div>
                                  <div className="space-y-1"><Label>Päättyy</Label><Input type="time" value={phase.endTime || '15:30'} onChange={(event) => updatePhase(phase.id, { endTime: event.target.value })} /></div>
                                  <div className="space-y-1"><Label>Prioriteetti</Label><Select value={phase.priority} onValueChange={(priority: WorkOrderPriority) => updatePhase(phase.id, { priority })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent></Select></div>
                                </div>
                              </div>
                              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4"><div><p className="font-semibold">Oletustekijä</p><p className="mt-1 text-xs text-text-secondary">Kohteen tai työmääräyksen tekijä voi ohittaa tämän myöhemmin.</p></div><AssigneeSelect value={phase.assigneeUserIds} people={availablePeople} fallbackText="Ei oletustekijää" onChange={(value) => updatePhase(phase.id, { assigneeUserIds: value })} /></div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-semibold text-blue-950">Tarkenna päivät ja tekijät kohteittain</p><p className="mt-1 text-sm text-blue-900">Automaattinen jaksotus käyttää valittujen töiden kestoja ja ohittaa viikonloput. Muuta käsin vain poikkeukset.</p></div>
              <Button variant="outline" onClick={() => autoScheduleAll(true)}><RefreshCw size={16} className="mr-2" /> Jaksota kaikki uudelleen</Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
              <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-3 flex items-center justify-between"><p className="font-semibold">Kohteet</p><Badge variant="secondary">{targets.length}</Badge></div>
                <div className="max-h-[650px] space-y-2 overflow-y-auto pr-1">
                  {targets.map((target) => {
                    const warnings = scheduleWarnings.filter((warning) => warning.targetId === target.id).length;
                    return <button type="button" key={target.id} className={cn('w-full rounded-xl border p-3 text-left transition', activeTarget?.id === target.id ? 'border-primary/40 bg-white shadow-sm' : 'border-transparent hover:border-slate-200 hover:bg-white')} onClick={() => setActiveTargetId(target.id)}><span className="block font-semibold">{target.title}</span><span className="mt-1 block text-xs text-text-secondary">{selectedForTarget(target.id)} työtä · tavoite {formatDate(target.endDate)}</span>{warnings > 0 && <span className="mt-1 flex items-center gap-1 text-xs text-amber-700"><AlertTriangle size={13} /> {warnings} huomio</span>}</button>;
                  })}
                </div>
              </aside>

              {activeTarget && (
                <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Muokattava kohde</p><h3 className="mt-1 text-xl font-bold">{activeTarget.title}</h3><p className="mt-1 text-sm text-text-secondary">Aloitus {formatDate(activeTarget.startDate)} · tavoite {formatDate(activeTarget.endDate)}</p></div><Button variant="secondary" onClick={() => autoScheduleTarget(activeTarget.id, true)}><Wand2 size={16} className="mr-2" /> Jaksota kohde</Button></div>
                  {scheduleWarnings.filter((warning) => warning.targetId === activeTarget.id).map((warning) => <div key={warning.message} className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle size={17} className="mt-0.5 shrink-0" />{warning.message}</div>)}
                  <div className="space-y-3">
                    {activeTargetAssignments.map((item, index) => {
                      const phase = phaseMap.get(item.phaseId);
                      if (!phase) return null;
                      const effectiveUsers = resolveWorkItemAssignees(item, activeTarget, phase);
                      return <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 xl:grid-cols-[44px_1fr_150px_150px_240px] xl:items-end"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">{index + 1}</div><div><p className="font-semibold">{phase.title}</p><p className="mt-1 text-xs text-text-secondary">Oletuskesto {defaultPhaseDuration(phase)} työpäivää · {phase.startTime || '07:00'}–{phase.endTime || '15:30'}</p></div><div className="space-y-1"><Label className="text-xs">Aloitus *</Label><Input type="date" value={item.startDate} onChange={(event) => updateAssignment(item.id, { startDate: event.target.value, manualSchedule: true })} /></div><div className="space-y-1"><Label className="text-xs">Valmis *</Label><Input type="date" min={item.startDate || undefined} value={item.endDate} onChange={(event) => updateAssignment(item.id, { endDate: event.target.value, manualSchedule: true })} /></div><div className="space-y-1"><Label className="text-xs">Tekijä</Label><AssigneeSelect value={item.assigneeUserIds} people={availablePeople} fallbackText={effectiveUsers.length > 0 ? `Oletus: ${effectiveUsers.map(personName).join(', ')}` : 'Käytä oletusta'} onChange={(value) => updateAssignment(item.id, { assigneeUserIds: value })} /></div></div>;
                    })}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Kohteita', value: targets.length, icon: ClipboardList },
                { label: 'Työmääräyksiä', value: selectedAssignments.length, icon: CalendarCheck2 },
                { label: 'Aikatauluhuomioita', value: scheduleWarnings.length, icon: AlertTriangle },
                { label: 'Resurssipäällekkäisyyksiä', value: conflicts.length + internalConflicts.length, icon: Users },
              ].map((item) => <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><item.icon size={18} className="text-primary" /><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-text-muted">{item.label}</p><p className="mt-1 text-2xl font-bold">{item.value}</p></div>)}
            </section>

            {(conflicts.length > 0 || internalConflicts.length > 0) && (
              <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-2"><AlertTriangle size={19} className="mt-0.5 shrink-0 text-amber-700" /><div><h3 className="font-semibold text-amber-950">Tarkista resurssipäällekkäisyydet</h3><p className="mt-1 text-sm text-amber-900">Sama henkilö on varattu samalle päivälle useampaan työhön.</p></div></div>
                <div className="max-h-52 space-y-2 overflow-y-auto">
                  {conflicts.slice(0, 30).map((conflict, index) => <div key={`${conflict.userId}-${conflict.date}-${index}`} className="rounded-lg border border-amber-200 bg-white p-3 text-sm"><p className="font-medium">{conflict.employeeName} · {formatDate(conflict.date)}</p><p className="mt-1 text-text-secondary">{conflict.targetTitle} – {conflict.phaseTitle} / päällekkäin: {conflict.conflictingTitle}</p></div>)}
                  {internalConflicts.slice(0, 20).map((conflict, index) => <div key={`${conflict.userId}-${conflict.date}-internal-${index}`} className="rounded-lg border border-amber-200 bg-white p-3 text-sm"><p className="font-medium">{personName(conflict.userId)} · {formatDate(conflict.date)}</p><p className="mt-1 text-text-secondary">Kaksi tämän suunnitelman työmääräystä osuu samalle päivälle.</p></div>)}
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-300 bg-white p-3"><Checkbox checked={conflictsAccepted} onCheckedChange={(checked) => setConflictsAccepted(checked === true)} /><span className="text-sm font-medium text-amber-950">Olen tarkistanut päällekkäisyydet ja hyväksyn niiden luonnin.</span></label>
              </section>
            )}

            {scheduleWarnings.length > 0 && <section className="space-y-2 rounded-2xl border border-blue-200 bg-blue-50 p-4"><h3 className="font-semibold text-blue-950">Aikatauluhuomiot</h3>{scheduleWarnings.map((warning) => <p key={`${warning.targetId}-${warning.message}`} className="text-sm text-blue-900">• {warning.targetTitle}: {warning.message}</p>)}</section>}

            <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
              <h3 className="font-semibold">Luotava tuotantosuunnitelma</h3>
              <div className="mt-4 space-y-4">
                {targets.map((target) => {
                  const items = selectedAssignments.filter((item) => item.targetId === target.id);
                  return <div key={target.id} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{target.title}</p><p className="text-xs text-text-secondary">{target.location || target.title} · tavoite {formatDate(target.endDate)}</p></div><Badge variant="secondary">{items.length} työmääräystä</Badge></div><div className="mt-3 grid gap-2 lg:grid-cols-2">{items.map((item) => { const phase = phaseMap.get(item.phaseId); if (!phase) return null; const users = resolveWorkItemAssignees(item, target, phase); return <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"><p className="font-medium">{phase.title}</p><p className="mt-1 text-text-secondary">{formatDate(item.startDate)}–{formatDate(item.endDate)} · {users.map(personName).join(', ') || 'Tekijä puuttuu'}</p></div>; })}</div></div>;
                })}
              </div>
            </section>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><p className="font-semibold">Luonnin jälkeen</p><p className="mt-1 leading-relaxed">Jokainen yllä näkyvä työ muodostuu omaksi työmääräykseksi. Päivät ja tekijät synkronoidaan VaKantin työvuorokalenteriin, resurssinäkymiin ja projektin aikataulutukseen.</p></div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div>{step > 1 && <Button variant="outline" disabled={saving || checkingConflicts} onClick={() => goToStep(step - 1)}><ArrowLeft size={16} className="mr-2" /> Edellinen</Button>}</div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="ghost" disabled={saving || checkingConflicts} onClick={() => onOpenChange(false)}>Peruuta</Button>
            {step === 1 && <Button onClick={continueFromTargets}>Jatka kohteiden töihin <ArrowRight size={16} className="ml-2" /></Button>}
            {step === 2 && <Button onClick={continueFromJobs}>Jatka aikatauluun <ArrowRight size={16} className="ml-2" /></Button>}
            {step === 3 && <Button disabled={checkingConflicts} onClick={() => void continueFromSchedule()}>{checkingConflicts ? <Loader2 size={16} className="mr-2 animate-spin" /> : <UserRound size={16} className="mr-2" />} Tarkista resurssit <ArrowRight size={16} className="ml-2" /></Button>}
            {step === 4 && <Button disabled={saving} onClick={() => void save()}>{saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <CheckCircle2 size={16} className="mr-2" />} Luo {selectedAssignments.length} työmääräystä</Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
