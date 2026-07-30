import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Copy,
  Grid3X3,
  Layers3,
  ListPlus,
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
  applyAssigneesToAllTargets,
  applyScheduleToAllTargets,
  buildInternalResourceConflicts,
  buildScheduleWarnings,
  copyTargetPhaseSelection,
  createGenericProjectPhases,
  defaultPhaseDuration,
  generateProjectWorkTargets,
  isIsoDate,
  normalizeProjectWorkTargets,
  phaseKey,
  resolveWorkItemAssignees,
  scheduleAllAssignments,
  scheduleTargetAssignments,
  selectedWorkAssignments,
  setAllPhasesForTarget,
  setPhaseForAllTargets,
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
const DEFAULT_ASSIGNEE = '__default__';

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyTarget(project: Project): ProjectWorkTargetDraft {
  return {
    id: uniqueId('target'),
    key: uniqueId('kohde'),
    title: '',
    location: '',
    description: '',
    startDate: project.startDate || '',
    endDate: project.endDate || project.startDate || '',
    assigneeUserIds: [],
  };
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

function roleLabel(role: OrganizationPerson['role']): string {
  if (role === 'worker') return 'Työntekijä';
  if (role === 'supervisor') return 'Työnjohtaja';
  if (role === 'project_coordinator') return 'Projektikoordinaattori';
  return 'Ylläpitäjä';
}

function formatDate(value: string): string {
  if (!value) return 'Ei asetettu';
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

function stepClasses(active: boolean, complete: boolean): string {
  return cn(
    'flex min-w-0 items-center gap-3 rounded-xl border px-3 py-3 text-left transition',
    complete && 'border-emerald-200 bg-emerald-50',
    active && !complete && 'border-primary/40 bg-primary/5',
    !active && !complete && 'border-slate-200 bg-slate-50/60',
  );
}

function AssigneeSelect({
  value,
  people,
  fallbackText,
  onChange,
}: {
  value: string[];
  people: OrganizationPerson[];
  fallbackText: string;
  onChange: (userIds: string[]) => void;
}) {
  return (
    <Select
      value={value[0] || DEFAULT_ASSIGNEE}
      onValueChange={(next) => onChange(next === DEFAULT_ASSIGNEE ? [] : [next])}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={DEFAULT_ASSIGNEE}>{fallbackText}</SelectItem>
        {people.map((person) => (
          <SelectItem key={person.userId} value={person.userId}>
            {person.name} ({roleLabel(person.role)})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function ProjectWorkPlanDialog({
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
  const [targetInput, setTargetInput] = useState('');
  const [targets, setTargets] = useState<ProjectWorkTargetDraft[]>([]);
  const [phases, setPhases] = useState<ProjectWorkPhaseDraft[]>([]);
  const [assignments, setAssignments] = useState<ProjectWorkAssignmentDraft[]>([]);
  const [activeTargetId, setActiveTargetId] = useState('');
  const [matrixSourceTargetId, setMatrixSourceTargetId] = useState('');
  const [sequencePrefix, setSequencePrefix] = useState('Huoneisto ');
  const [sequenceStart, setSequenceStart] = useState('1');
  const [sequenceCount, setSequenceCount] = useState('10');
  const [sequenceFirstDate, setSequenceFirstDate] = useState('');
  const [sequenceDuration, setSequenceDuration] = useState('10');
  const [sequenceGap, setSequenceGap] = useState('0');
  const [bulkAssigneeId, setBulkAssigneeId] = useState('');
  const [bulkStartDate, setBulkStartDate] = useState('');
  const [bulkEndDate, setBulkEndDate] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<ProjectWorkPlanConflict[]>([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [conflictsAccepted, setConflictsAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  const availablePeople = useMemo(
    () => people.filter((person) => ['worker', 'supervisor', 'project_coordinator', 'admin'].includes(person.role)),
    [people],
  );
  const targetMap = useMemo(() => new Map(targets.map((target) => [target.id, target])), [targets]);
  const phaseMap = useMemo(() => new Map(phases.map((phase) => [phase.id, phase])), [phases]);
  const selectedAssignments = useMemo(() => selectedWorkAssignments(assignments), [assignments]);
  const activeTarget = targetMap.get(activeTargetId) ?? targets[0];
  const activeTargetAssignments = useMemo(
    () => activeTarget
      ? assignments.filter((item) => item.targetId === activeTarget.id && item.enabled)
      : [],
    [activeTarget, assignments],
  );
  const scheduleWarnings = useMemo(
    () => buildScheduleWarnings(targets, phases, assignments),
    [targets, phases, assignments],
  );
  const internalConflicts = useMemo(
    () => buildInternalResourceConflicts(targets, phases, assignments),
    [targets, phases, assignments],
  );

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setPlanName(`${project.name} – työkokonaisuus`);
    setPlanDescription('');
    setTargetInput('');
    setTargets([]);
    setPhases([]);
    setAssignments([]);
    setActiveTargetId('');
    setMatrixSourceTargetId('');
    setSequencePrefix('Huoneisto ');
    setSequenceStart('1');
    setSequenceCount('10');
    setSequenceFirstDate(project.startDate || '');
    setSequenceDuration('10');
    setSequenceGap('0');
    setBulkAssigneeId('');
    setBulkStartDate(project.startDate || '');
    setBulkEndDate(project.endDate || project.startDate || '');
    setErrors([]);
    setConflicts([]);
    setCheckingConflicts(false);
    setConflictsAccepted(false);
    setSaving(false);
  }, [open, project.endDate, project.name, project.startDate]);

  useEffect(() => {
    setAssignments((current) => synchronizeWorkAssignments(targets, phases, current, true));
  }, [targets, phases]);

  useEffect(() => {
    if (targets.length === 0) {
      setActiveTargetId('');
      setMatrixSourceTargetId('');
      return;
    }
    if (!targets.some((target) => target.id === activeTargetId)) setActiveTargetId(targets[0].id);
    if (!targets.some((target) => target.id === matrixSourceTargetId)) setMatrixSourceTargetId(targets[0].id);
  }, [activeTargetId, matrixSourceTargetId, targets]);

  useEffect(() => {
    setConflictsAccepted(false);
  }, [assignments, phases, targets]);

  const personName = (userId: string) =>
    availablePeople.find((person) => person.userId === userId)?.name ?? userId;

  const appendTargets = (next: ProjectWorkTargetDraft[]) => {
    setTargets((current) => {
      const seen = new Set(current.map((target) => target.title.trim().toLocaleLowerCase('fi')));
      const merged = [...current];
      for (const target of next) {
        const duplicateKey = target.title.trim().toLocaleLowerCase('fi');
        if (!duplicateKey || seen.has(duplicateKey)) continue;
        seen.add(duplicateKey);
        merged.push({
          ...target,
          id: uniqueId('target'),
          key: `${String(merged.length + 1).padStart(3, '0')}-${target.key.replace(/^\d+-/, '')}`,
        });
        if (merged.length >= 100) break;
      }
      return merged;
    });
  };

  const buildTargetsFromText = () => {
    const parsed = normalizeProjectWorkTargets(targetInput);
    if (parsed.length === 0) {
      setErrors(['Syötä vähintään yksi kohde. Muoto: nimi | sijainti | työseloste | aloitus | valmis']);
      return;
    }
    appendTargets(parsed);
    setTargetInput('');
    setErrors([]);
  };

  const buildTargetSequence = () => {
    const start = Number(sequenceStart);
    const count = Number(sequenceCount);
    const duration = Number(sequenceDuration);
    const gap = Number(sequenceGap);
    if (!Number.isFinite(start) || !Number.isFinite(count) || count < 1 || count > 100) {
      setErrors(['Anna kelvollinen aloitusnumero ja 1–100 kohteen määrä.']);
      return;
    }
    if (sequenceFirstDate && !isIsoDate(sequenceFirstDate)) {
      setErrors(['Numerosarjan ensimmäinen aloituspäivä on virheellinen.']);
      return;
    }
    if (!Number.isFinite(duration) || duration < 1 || duration > 60) {
      setErrors(['Kohteen keston pitää olla 1–60 työpäivää.']);
      return;
    }
    if (!Number.isFinite(gap) || gap < 0 || gap > 20) {
      setErrors(['Kohteiden välisen tauon pitää olla 0–20 työpäivää.']);
      return;
    }
    appendTargets(generateProjectWorkTargets({
      prefix: sequencePrefix,
      start,
      count,
      firstStartDate: sequenceFirstDate,
      workdayDuration: duration,
      gapWorkdays: gap,
    }));
    setErrors([]);
  };

  const updateTarget = (id: string, patch: Partial<ProjectWorkTargetDraft>) => {
    setTargets((current) => current.map((target) => target.id === id ? { ...target, ...patch } : target));
  };

  const updatePhase = (id: string, patch: Partial<ProjectWorkPhaseDraft>) => {
    setPhases((current) => current.map((phase) => phase.id === id ? { ...phase, ...patch } : phase));
  };

  const updateAssignment = (id: string, patch: Partial<ProjectWorkAssignmentDraft>) => {
    setAssignments((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const movePhase = (index: number, direction: -1 | 1) => {
    setPhases((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const applyBulkAssignee = () => {
    if (!bulkAssigneeId) {
      setErrors(['Valitse ensin kaikille kohteille asetettava oletustekijä.']);
      return;
    }
    setTargets((current) => applyAssigneesToAllTargets(current, [bulkAssigneeId]));
    setErrors([]);
  };

  const applyBulkSchedule = () => {
    if (!isIsoDate(bulkStartDate) || !isIsoDate(bulkEndDate) || bulkEndDate < bulkStartDate) {
      setErrors(['Anna kelvollinen yhteinen aloitus- ja tavoitevalmistumispäivä.']);
      return;
    }
    setTargets((current) => applyScheduleToAllTargets(current, bulkStartDate, bulkEndDate));
    setErrors([]);
  };

  const useGenericTemplate = () => {
    setPhases(createGenericProjectPhases({ startDate: project.startDate, endDate: project.endDate }));
    setErrors([]);
  };

  const selectedForTarget = (targetIdValue: string) =>
    assignments.filter((item) => item.targetId === targetIdValue && item.enabled).length;

  const selectedForPhase = (phaseIdValue: string) =>
    assignments.filter((item) => item.phaseId === phaseIdValue && item.enabled).length;

  const toggleCell = (targetIdValue: string, phaseIdValue: string, enabled: boolean) => {
    setAssignments((current) => current.map((item) =>
      item.targetId === targetIdValue && item.phaseId === phaseIdValue ? { ...item, enabled } : item,
    ));
  };

  const autoScheduleTarget = (targetIdValue: string, overwriteManual = false) => {
    const target = targetMap.get(targetIdValue);
    if (!target) return;
    setAssignments((current) => scheduleTargetAssignments(target, phases, current, { overwriteManual }));
  };

  const autoScheduleAll = (overwriteManual = false) => {
    setAssignments((current) => scheduleAllAssignments(targets, phases, current, { overwriteManual }));
  };

  const validateTargets = (): string[] => {
    const next: string[] = [];
    if (!planName.trim()) next.push('Työkokonaisuuden nimi on pakollinen.');
    if (targets.length === 0) next.push('Lisää vähintään yksi kohde.');
    targets.forEach((target, index) => {
      const label = target.title.trim() || `Kohde ${index + 1}`;
      if (!target.title.trim()) next.push(`Kohde ${index + 1}: nimi puuttuu.`);
      if (!isIsoDate(target.startDate) || !isIsoDate(target.endDate)) {
        next.push(`${label}: aloitus- tai tavoitevalmistumispäivä puuttuu.`);
      } else if (target.endDate < target.startDate) {
        next.push(`${label}: tavoitevalmistuminen ei voi olla ennen aloitusta.`);
      }
    });
    return next;
  };

  const validatePhases = (): string[] => {
    const next: string[] = [];
    if (phases.length === 0) next.push('Lisää vähintään yksi työvaihe.');
    if (phases.length > 20) next.push('Työvaiheita voi olla enintään 20.');
    phases.forEach((phase, index) => {
      const label = phase.title.trim() || `Työvaihe ${index + 1}`;
      if (!phase.title.trim()) next.push(`${label}: nimi puuttuu.`);
      const duration = Number(phase.durationWorkdays);
      if (!Number.isFinite(duration) || duration < 1 || duration > 60) {
        next.push(`${label}: keston pitää olla 1–60 työpäivää.`);
      }
      if (!phase.startTime || !phase.endTime || phase.endTime <= phase.startTime) {
        next.push(`${label}: päivittäinen työaika on virheellinen.`);
      }
    });
    return next;
  };

  const validateMatrix = (): string[] => {
    const next: string[] = [];
    targets.forEach((target) => {
      if (selectedForTarget(target.id) === 0) next.push(`${target.title}: valitse vähintään yksi työvaihe.`);
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

  const continueFromPhases = () => {
    const next = [...validateTargets(), ...validatePhases()];
    setErrors(next);
    if (next.length === 0) goToStep(3);
  };

  const continueFromMatrix = () => {
    const next = [...validateTargets(), ...validatePhases(), ...validateMatrix()];
    setErrors(next);
    if (next.length > 0) return;
    autoScheduleAll(false);
    goToStep(4);
  };

  const continueFromSchedule = async () => {
    const next = [...validateTargets(), ...validatePhases(), ...validateMatrix(), ...validateSchedules()];
    setErrors(next);
    if (next.length > 0) return;
    setCheckingConflicts(true);
    try {
      const serverConflicts = await previewProjectWorkPlanConflicts({
        organizationId,
        targets,
        phases,
        assignments,
      });
      setConflicts(serverConflicts);
      setConflictsAccepted(false);
      goToStep(5);
    } catch (caught) {
      setErrors([caught instanceof Error ? caught.message : 'Resurssitarkistus epäonnistui.']);
    } finally {
      setCheckingConflicts(false);
    }
  };

  const save = async () => {
    const next = [...validateTargets(), ...validatePhases(), ...validateMatrix(), ...validateSchedules()];
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
        phases,
        assignments,
      });
      await onCreated(
        `${planName.trim()} luotiin: ${result.targetCount} kohdetta, ${result.phaseCount} työvaihemallia ja ${result.workOrderCount} kalenteroitua työmääräystä.`,
      );
      onOpenChange(false);
    } catch (caught) {
      setErrors([caught instanceof Error ? caught.message : 'Työkokonaisuuden luonti epäonnistui.']);
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    { number: 1, title: 'Kohteet', description: `${targets.length} kohdetta`, icon: ClipboardList },
    { number: 2, title: 'Työvaiheet', description: `${phases.length} mallia`, icon: Layers3 },
    { number: 3, title: 'Kohdistus', description: `${selectedAssignments.length} valintaa`, icon: Grid3X3 },
    { number: 4, title: 'Aikataulu ja tekijät', description: 'kohdekohtainen', icon: CalendarDays },
    { number: 5, title: 'Tarkista ja luo', description: `${selectedAssignments.length} työmääräystä`, icon: CheckCircle2 },
  ];

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[96vh] overflow-y-auto sm:max-w-[96vw] xl:max-w-7xl">
        <DialogHeader>
          <DialogTitle className="break-words">Rakenna projektin työkokonaisuus</DialogTitle>
          <p className="break-words text-sm text-text-secondary">
            Määritä kohteet, mahdolliset työvaiheet ja valitse matriisista mitä kussakin kohteessa tehdään. Lopuksi tarkenna päivät ja tekijät. Vain valitut työt luodaan ja viedään kalentereihin.
          </p>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
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
                step > item.number
                  ? 'bg-emerald-600 text-white'
                  : step === item.number
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-slate-200 text-slate-600',
              )}>
                {step > item.number ? <CheckCircle2 size={17} /> : item.number}
              </span>
              <item.icon size={17} className="hidden shrink-0 text-text-muted 2xl:block" />
              <div className="min-w-0">
                <p className="break-words font-semibold">{item.title}</p>
                <p className="break-words text-xs text-text-secondary">{item.description}</p>
              </div>
            </button>
          ))}
        </div>

        {errors.length > 0 && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {errors.slice(0, 20).map((error) => <p key={error} className="break-words">• {error}</p>)}
            {errors.length > 20 && <p>• Lisäksi {errors.length - 20} muuta puutetta.</p>}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <section className="grid gap-4 rounded-2xl border border-slate-200 p-4 sm:grid-cols-2 sm:p-5">
              <div className="space-y-2">
                <Label htmlFor="plan-name">Työkokonaisuuden nimi *</Label>
                <Input id="plan-name" value={planName} onChange={(event) => setPlanName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-description">Kuvaus</Label>
                <Input id="plan-description" value={planDescription} onChange={(event) => setPlanDescription(event.target.value)} placeholder="Esim. Keittiöremontit, 14 huoneistoa" />
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <div>
                  <h3 className="font-semibold">Liitä kohdelista</h3>
                  <p className="mt-1 text-xs text-text-secondary">Yksi kohde per rivi. Päivät voi jättää tyhjäksi ja täydentää alempana.</p>
                </div>
                <Textarea
                  value={targetInput}
                  onChange={(event) => setTargetInput(event.target.value)}
                  rows={7}
                  placeholder={'A1 | 1. kerros | Keittiö + vinyyli | 2026-08-03 | 2026-08-14\nA2 | 1. kerros | Vain keittiö | 2026-08-17 | 2026-08-28'}
                />
                <p className="text-xs text-text-secondary">Muoto: kohde | sijainti | työseloste | aloitus YYYY-MM-DD | valmis YYYY-MM-DD</p>
                <Button type="button" variant="outline" onClick={buildTargetsFromText}>
                  <ListPlus size={16} className="mr-2" /> Muodosta listasta
                </Button>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <div>
                  <h3 className="font-semibold">Luo numerosarja</h3>
                  <p className="mt-1 text-xs text-text-secondary">Sopii samanlaisten asuntojen sarjatuotantoon. Viikonloput ohitetaan.</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="space-y-1"><Label className="text-xs">Nimen alku</Label><Input value={sequencePrefix} onChange={(event) => setSequencePrefix(event.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Alkaa numerosta</Label><Input type="number" value={sequenceStart} onChange={(event) => setSequenceStart(event.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Määrä</Label><Input type="number" min={1} max={100} value={sequenceCount} onChange={(event) => setSequenceCount(event.target.value)} /></div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="space-y-1"><Label className="text-xs">Ensimmäinen aloitus</Label><Input type="date" value={sequenceFirstDate} onChange={(event) => setSequenceFirstDate(event.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Kesto / kohde</Label><Input type="number" min={1} max={60} value={sequenceDuration} onChange={(event) => setSequenceDuration(event.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Väli työpäivinä</Label><Input type="number" min={0} max={20} value={sequenceGap} onChange={(event) => setSequenceGap(event.target.value)} /></div>
                </div>
                <Button type="button" variant="outline" onClick={buildTargetSequence}>
                  <Wand2 size={16} className="mr-2" /> Muodosta ja jaksota
                </Button>
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-slate-200 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Kohteet</h3>
                  <p className="mt-1 text-sm text-text-secondary">Täydennä nimi, sijainti ja tavoiteikkuna. Työvaiheet valitaan myöhemmin.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{targets.length}/100</Badge>
                  <Button type="button" variant="outline" size="sm" onClick={() => setTargets((current) => [...current, emptyTarget(project)])}>
                    <Plus size={16} className="mr-1.5" /> Lisää kohde
                  </Button>
                </div>
              </div>

              {targets.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-sm text-text-secondary">Ei vielä kohteita.</div>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[1fr_1fr_auto]">
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="min-w-[220px] flex-1 space-y-1"><Label className="text-xs">Oletustekijä kaikille</Label><Select value={bulkAssigneeId || undefined} onValueChange={setBulkAssigneeId}><SelectTrigger><SelectValue placeholder="Valitse henkilö" /></SelectTrigger><SelectContent>{availablePeople.map((person) => <SelectItem key={person.userId} value={person.userId}>{person.name}</SelectItem>)}</SelectContent></Select></div>
                      <Button type="button" variant="secondary" onClick={applyBulkAssignee}><Users size={16} className="mr-2" /> Aseta</Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1"><Label className="text-xs">Yhteinen aloitus</Label><Input type="date" value={bulkStartDate} onChange={(event) => setBulkStartDate(event.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-xs">Yhteinen tavoite</Label><Input type="date" value={bulkEndDate} onChange={(event) => setBulkEndDate(event.target.value)} /></div>
                    </div>
                    <Button type="button" variant="secondary" className="self-end" onClick={applyBulkSchedule}><CalendarDays size={16} className="mr-2" /> Aseta päivät</Button>
                  </div>

                  {targets.map((target, index) => (
                    <div key={target.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 lg:grid-cols-[56px_1fr_1fr_150px_150px_180px_40px] lg:items-end">
                      <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white lg:flex">{index + 1}</div>
                      <div className="space-y-1"><Label className="text-xs">Kohde *</Label><Input value={target.title} onChange={(event) => updateTarget(target.id, { title: event.target.value })} placeholder="A1" /></div>
                      <div className="space-y-1"><Label className="text-xs">Sijainti</Label><Input value={target.location} onChange={(event) => updateTarget(target.id, { location: event.target.value })} placeholder="1. kerros" /></div>
                      <div className="space-y-1"><Label className="text-xs">Aikaisin aloitus *</Label><Input type="date" value={target.startDate} onChange={(event) => updateTarget(target.id, { startDate: event.target.value })} /></div>
                      <div className="space-y-1"><Label className="text-xs">Tavoite valmis *</Label><Input type="date" min={target.startDate || undefined} value={target.endDate} onChange={(event) => updateTarget(target.id, { endDate: event.target.value })} /></div>
                      <div className="space-y-1"><Label className="text-xs">Oletustekijä</Label><AssigneeSelect value={target.assigneeUserIds} people={availablePeople} fallbackText="Työvaiheen oletus" onChange={(value) => updateTarget(target.id, { assigneeUserIds: value })} /></div>
                      <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={() => setTargets((current) => current.filter((item) => item.id !== target.id))} aria-label="Poista kohde"><Trash2 size={16} /></Button>
                      <div className="space-y-1 lg:col-start-2 lg:col-span-5"><Label className="text-xs">Kohteen työseloste</Label><Input value={target.description} onChange={(event) => updateTarget(target.id, { description: event.target.value })} placeholder="Esim. Keittiö + vinyyli, ei kylpyhuonetta" /></div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-blue-950">Määritä projektissa mahdollisesti käytettävät työvaiheet</p>
                <p className="mt-1 text-sm text-blue-900">Työvaihe on malli. Se ei vielä tarkoita, että vaihe tehdään kaikissa kohteissa. Kohdistus tehdään seuraavassa vaiheessa.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={useGenericTemplate}><Sparkles size={16} className="mr-2" /> Käytä yleistä runkoa</Button>
                <Button onClick={() => setPhases((current) => [...current, emptyPhase(project)])}><Plus size={16} className="mr-2" /> Lisää työvaihe</Button>
              </div>
            </div>

            {phases.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center">
                <Layers3 size={42} className="mx-auto text-slate-300" />
                <p className="mt-3 font-semibold">Työvaiheita ei ole vielä lisätty</p>
                <p className="mt-1 text-sm text-text-secondary">Käytä yleistä runkoa tai lisää vain tämän projektin tarvitsemat vaiheet.</p>
              </div>
            )}

            <div className="space-y-4">
              {phases.map((phase, index) => (
                <section key={phase.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">{index + 1}</span>
                      <div><p className="font-semibold">{phase.title || `Työvaihe ${index + 1}`}</p><p className="text-xs text-text-secondary">Oletuskesto {defaultPhaseDuration(phase)} työpäivää</p></div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" disabled={index === 0} onClick={() => movePhase(index, -1)} aria-label="Siirrä ylöspäin"><ArrowUp size={16} /></Button>
                      <Button variant="ghost" size="sm" disabled={index === phases.length - 1} onClick={() => movePhase(index, 1)} aria-label="Siirrä alaspäin"><ArrowDown size={16} /></Button>
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setPhases((current) => current.filter((item) => item.id !== phase.id))} aria-label="Poista työvaihe"><Trash2 size={16} /></Button>
                    </div>
                  </div>
                  <div className="grid gap-4 p-4 xl:grid-cols-[1.2fr_0.8fr]">
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1"><Label>Nimi *</Label><Input value={phase.title} onChange={(event) => updatePhase(phase.id, { title: event.target.value })} placeholder="Esim. Kalusteasennus" /></div>
                        <div className="space-y-1"><Label>Työlaji</Label><Input value={phase.type} onChange={(event) => updatePhase(phase.id, { type: event.target.value })} placeholder="Esim. Asennus" /></div>
                      </div>
                      <div className="space-y-1"><Label>Yhteinen työohje</Label><Textarea value={phase.description} onChange={(event) => updatePhase(phase.id, { description: event.target.value })} rows={3} placeholder="Ohje, joka tulee kaikkiin tämän vaiheen työmääräyksiin" /></div>
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div className="space-y-1"><Label>Oletuskesto *</Label><Input type="number" min={1} max={60} value={phase.durationWorkdays ?? 1} onChange={(event) => updatePhase(phase.id, { durationWorkdays: Number(event.target.value) })} /></div>
                        <div className="space-y-1"><Label>Alkaa</Label><Input type="time" value={phase.startTime || '07:00'} onChange={(event) => updatePhase(phase.id, { startTime: event.target.value })} /></div>
                        <div className="space-y-1"><Label>Päättyy</Label><Input type="time" value={phase.endTime || '15:30'} onChange={(event) => updatePhase(phase.id, { endTime: event.target.value })} /></div>
                        <div className="space-y-1"><Label>Prioriteetti</Label><Select value={phase.priority} onValueChange={(priority: WorkOrderPriority) => updatePhase(phase.id, { priority })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent></Select></div>
                      </div>
                    </div>
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div><p className="font-semibold">Oletustekijä</p><p className="mt-1 text-xs text-text-secondary">Käytetään, ellei kohteelle tai yksittäiselle työlle valita muuta tekijää.</p></div>
                      <AssigneeSelect value={phase.assigneeUserIds} people={availablePeople} fallbackText="Ei oletustekijää" onChange={(value) => updatePhase(phase.id, { assigneeUserIds: value })} />
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="font-semibold text-blue-950">Valitse mitä kussakin kohteessa tehdään</p>
              <p className="mt-1 text-sm text-blue-900">Jokainen valittu ruutu muodostaa yhden työmääräyksen. Poista valinta, jos työvaihe ei kuulu kyseiseen asuntoon.</p>
            </div>

            <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="min-w-[240px] flex-1 space-y-1">
                <Label className="text-xs">Kopioi kohteen työvaiherakenne kaikille</Label>
                <Select value={matrixSourceTargetId} onValueChange={setMatrixSourceTargetId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{targets.map((target) => <SelectItem key={target.id} value={target.id}>{target.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button variant="secondary" onClick={() => setAssignments((current) => copyTargetPhaseSelection(current, matrixSourceTargetId, targets.map((target) => target.id)))}>
                <Copy size={16} className="mr-2" /> Kopioi kaikille
              </Button>
              <Badge variant="secondary" className="ml-auto">{selectedAssignments.length} työmääräystä</Badge>
            </div>

            <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 md:block">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="sticky left-0 z-10 min-w-[190px] border-b border-r border-slate-200 bg-slate-50 p-3 text-left">Kohde</th>
                    {phases.map((phase) => (
                      <th key={phase.id} className="min-w-[150px] border-b border-r border-slate-200 p-3 text-left align-top last:border-r-0">
                        <p className="font-semibold">{phase.title}</p>
                        <p className="mt-1 text-xs font-normal text-text-secondary">{selectedForPhase(phase.id)}/{targets.length} kohdetta</p>
                        <div className="mt-2 flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setAssignments((current) => setPhaseForAllTargets(current, phase.id, true))}>Kaikki</Button>
                          <Button size="sm" variant="ghost" onClick={() => setAssignments((current) => setPhaseForAllTargets(current, phase.id, false))}>Ei mikään</Button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {targets.map((target) => (
                    <tr key={target.id} className="hover:bg-slate-50/60">
                      <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white p-3 text-left">
                        <p className="font-semibold">{target.title}</p>
                        <p className="mt-1 text-xs font-normal text-text-secondary">{selectedForTarget(target.id)}/{phases.length} vaihetta</p>
                        <div className="mt-2 flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setAssignments((current) => setAllPhasesForTarget(current, target.id, true))}>Kaikki</Button>
                          <Button size="sm" variant="ghost" onClick={() => setAssignments((current) => setAllPhasesForTarget(current, target.id, false))}>Tyhjennä</Button>
                        </div>
                      </th>
                      {phases.map((phase) => {
                        const item = assignments.find((candidate) => candidate.targetId === target.id && candidate.phaseId === phase.id);
                        return (
                          <td key={phase.id} className="border-b border-r border-slate-200 p-3 text-center last:border-r-0">
                            <label className={cn('mx-auto flex min-h-16 cursor-pointer items-center justify-center rounded-xl border p-3 transition', item?.enabled ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white')}>
                              <Checkbox checked={item?.enabled ?? false} onCheckedChange={(checked) => toggleCell(target.id, phase.id, checked === true)} />
                              <span className="ml-2 font-medium">{item?.enabled ? 'Tehdään' : 'Ei tehdä'}</span>
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {targets.map((target) => (
                <section key={target.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div><h3 className="font-semibold">{target.title}</h3><p className="text-xs text-text-secondary">{selectedForTarget(target.id)} valittua vaihetta</p></div>
                    <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setAssignments((current) => setAllPhasesForTarget(current, target.id, true))}>Kaikki</Button><Button size="sm" variant="ghost" onClick={() => setAssignments((current) => setAllPhasesForTarget(current, target.id, false))}>Tyhjennä</Button></div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {phases.map((phase) => {
                      const item = assignments.find((candidate) => candidate.targetId === target.id && candidate.phaseId === phase.id);
                      return (
                        <label key={phase.id} className={cn('flex cursor-pointer items-center gap-3 rounded-xl border p-3', item?.enabled ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200')}>
                          <Checkbox checked={item?.enabled ?? false} onCheckedChange={(checked) => toggleCell(target.id, phase.id, checked === true)} />
                          <span className="font-medium">{phase.title}</span>
                        </label>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-blue-950">Tarkenna kohdekohtainen työjärjestys</p>
                <p className="mt-1 text-sm text-blue-900">Automaattinen jaksotus käyttää työvaiheiden kestoja ja ohittaa viikonloput. Muuta tarvittaessa vain poikkeukset.</p>
              </div>
              <Button variant="outline" onClick={() => autoScheduleAll(true)}><RefreshCw size={16} className="mr-2" /> Jaksota kaikki uudelleen</Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
              <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-3 flex items-center justify-between"><p className="font-semibold">Kohteet</p><Badge variant="secondary">{targets.length}</Badge></div>
                <div className="max-h-[650px] space-y-2 overflow-y-auto pr-1">
                  {targets.map((target) => {
                    const warnings = scheduleWarnings.filter((warning) => warning.targetId === target.id).length;
                    return (
                      <button type="button" key={target.id} className={cn('w-full rounded-xl border p-3 text-left transition', activeTarget?.id === target.id ? 'border-primary/40 bg-white shadow-sm' : 'border-transparent hover:border-slate-200 hover:bg-white')} onClick={() => setActiveTargetId(target.id)}>
                        <span className="block font-semibold">{target.title}</span>
                        <span className="mt-1 block text-xs text-text-secondary">{selectedForTarget(target.id)} työvaihetta · tavoite {formatDate(target.endDate)}</span>
                        {warnings > 0 && <span className="mt-1 flex items-center gap-1 text-xs text-amber-700"><AlertTriangle size={13} /> {warnings} huomio</span>}
                      </button>
                    );
                  })}
                </div>
              </aside>

              {activeTarget && (
                <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Muokattava kohde</p>
                      <h3 className="mt-1 text-xl font-bold">{activeTarget.title}</h3>
                      <p className="mt-1 text-sm text-text-secondary">Aloitus {formatDate(activeTarget.startDate)} · tavoite {formatDate(activeTarget.endDate)}</p>
                    </div>
                    <Button variant="secondary" onClick={() => autoScheduleTarget(activeTarget.id, true)}><Wand2 size={16} className="mr-2" /> Jaksota kohde</Button>
                  </div>

                  {scheduleWarnings.filter((warning) => warning.targetId === activeTarget.id).map((warning) => (
                    <div key={warning.message} className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle size={17} className="mt-0.5 shrink-0" />{warning.message}</div>
                  ))}

                  <div className="space-y-3">
                    {activeTargetAssignments.length === 0 && <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-sm text-text-secondary">Tälle kohteelle ei ole valittu työvaiheita.</div>}
                    {activeTargetAssignments.map((item, index) => {
                      const phase = phaseMap.get(item.phaseId);
                      if (!phase) return null;
                      const effectiveUsers = resolveWorkItemAssignees(item, activeTarget, phase);
                      return (
                        <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 xl:grid-cols-[44px_1fr_150px_150px_240px] xl:items-end">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">{index + 1}</div>
                          <div>
                            <p className="font-semibold">{phase.title}</p>
                            <p className="mt-1 text-xs text-text-secondary">Oletuskesto {defaultPhaseDuration(phase)} työpäivää · {phase.startTime || '07:00'}–{phase.endTime || '15:30'}</p>
                          </div>
                          <div className="space-y-1"><Label className="text-xs">Aloitus *</Label><Input type="date" value={item.startDate} onChange={(event) => updateAssignment(item.id, { startDate: event.target.value, manualSchedule: true })} /></div>
                          <div className="space-y-1"><Label className="text-xs">Valmis *</Label><Input type="date" min={item.startDate || undefined} value={item.endDate} onChange={(event) => updateAssignment(item.id, { endDate: event.target.value, manualSchedule: true })} /></div>
                          <div className="space-y-1"><Label className="text-xs">Tekijä</Label><AssigneeSelect value={item.assigneeUserIds} people={availablePeople} fallbackText={effectiveUsers.length > 0 ? `Oletus: ${effectiveUsers.map(personName).join(', ')}` : 'Käytä oletusta'} onChange={(value) => updateAssignment(item.id, { assigneeUserIds: value })} /></div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                { label: 'Kohteita', value: targets.length, icon: ClipboardList },
                { label: 'Työvaihemalleja', value: phases.length, icon: Layers3 },
                { label: 'Työmääräyksiä', value: selectedAssignments.length, icon: CalendarCheck2 },
                { label: 'Aikatauluhuomioita', value: scheduleWarnings.length, icon: AlertTriangle },
                { label: 'Resurssipäällekkäisyyksiä', value: conflicts.length + internalConflicts.length, icon: Users },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <item.icon size={18} className="text-primary" />
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-text-muted">{item.label}</p>
                  <p className="mt-1 text-2xl font-bold">{item.value}</p>
                </div>
              ))}
            </section>

            {(conflicts.length > 0 || internalConflicts.length > 0) && (
              <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-2"><AlertTriangle size={19} className="mt-0.5 shrink-0 text-amber-700" /><div><h3 className="font-semibold text-amber-950">Tarkista resurssipäällekkäisyydet</h3><p className="mt-1 text-sm text-amber-900">Sama henkilö on varattu samalle päivälle useampaan työhön. Muuta aikataulua tai hyväksy tietoinen päällekkäisyys.</p></div></div>
                <div className="max-h-52 space-y-2 overflow-y-auto">
                  {conflicts.slice(0, 30).map((conflict, index) => (
                    <div key={`${conflict.userId}-${conflict.date}-${index}`} className="rounded-lg border border-amber-200 bg-white p-3 text-sm">
                      <p className="font-medium">{conflict.employeeName} · {formatDate(conflict.date)}</p>
                      <p className="mt-1 text-text-secondary">{conflict.targetTitle} – {conflict.phaseTitle} / päällekkäin: {conflict.conflictingTitle}</p>
                    </div>
                  ))}
                  {internalConflicts.slice(0, 20).map((conflict, index) => (
                    <div key={`${conflict.userId}-${conflict.date}-internal-${index}`} className="rounded-lg border border-amber-200 bg-white p-3 text-sm">
                      <p className="font-medium">{personName(conflict.userId)} · {formatDate(conflict.date)}</p>
                      <p className="mt-1 text-text-secondary">Kaksi tämän suunnitelman työmääräystä osuu samalle päivälle.</p>
                    </div>
                  ))}
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-300 bg-white p-3">
                  <Checkbox checked={conflictsAccepted} onCheckedChange={(checked) => setConflictsAccepted(checked === true)} />
                  <span className="text-sm font-medium text-amber-950">Olen tarkistanut päällekkäisyydet ja hyväksyn niiden luonnin.</span>
                </label>
              </section>
            )}

            {scheduleWarnings.length > 0 && (
              <section className="space-y-2 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <h3 className="font-semibold text-blue-950">Aikatauluhuomiot</h3>
                {scheduleWarnings.map((warning) => <p key={`${warning.targetId}-${warning.message}`} className="text-sm text-blue-900">• {warning.targetTitle}: {warning.message}</p>)}
              </section>
            )}

            <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
              <h3 className="font-semibold">Luotava tuotantosuunnitelma</h3>
              <div className="mt-4 space-y-4">
                {targets.map((target) => {
                  const items = selectedAssignments
                    .filter((item) => item.targetId === target.id)
                    .sort((a, b) => phases.findIndex((phase) => phase.id === a.phaseId) - phases.findIndex((phase) => phase.id === b.phaseId));
                  return (
                    <div key={target.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div><p className="font-semibold">{target.title}</p><p className="text-xs text-text-secondary">{target.location || target.title} · tavoite {formatDate(target.endDate)}</p></div>
                        <Badge variant="secondary">{items.length} työmääräystä</Badge>
                      </div>
                      <div className="mt-3 grid gap-2 lg:grid-cols-2">
                        {items.map((item) => {
                          const phase = phaseMap.get(item.phaseId);
                          if (!phase) return null;
                          const users = resolveWorkItemAssignees(item, target, phase);
                          return (
                            <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                              <p className="font-medium">{phase.title}</p>
                              <p className="mt-1 text-text-secondary">{formatDate(item.startDate)}–{formatDate(item.endDate)} · {users.map(personName).join(', ') || 'Tekijä puuttuu'}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
              <p className="font-semibold">Luonnin jälkeen</p>
              <p className="mt-1 leading-relaxed">Jokainen yllä näkyvä työ muodostuu omaksi työmääräykseksi. Päivät ja tekijät synkronoidaan automaattisesti VaKantin työvuorokalenteriin, resurssinäkymiin ja projektin aikataulutukseen.</p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {step > 1 && <Button variant="outline" disabled={saving || checkingConflicts} onClick={() => goToStep(step - 1)}><ArrowLeft size={16} className="mr-2" /> Edellinen</Button>}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="ghost" disabled={saving || checkingConflicts} onClick={() => onOpenChange(false)}>Peruuta</Button>
            {step === 1 && <Button onClick={continueFromTargets}>Jatka työvaiheisiin <ArrowRight size={16} className="ml-2" /></Button>}
            {step === 2 && <Button onClick={continueFromPhases}>Jatka kohdistukseen <ArrowRight size={16} className="ml-2" /></Button>}
            {step === 3 && <Button onClick={continueFromMatrix}>Jatka aikatauluun <ArrowRight size={16} className="ml-2" /></Button>}
            {step === 4 && <Button disabled={checkingConflicts} onClick={() => void continueFromSchedule()}>{checkingConflicts ? <Loader2 size={16} className="mr-2 animate-spin" /> : <UserRound size={16} className="mr-2" />} Tarkista resurssit <ArrowRight size={16} className="ml-2" /></Button>}
            {step === 5 && <Button disabled={saving} onClick={() => void save()}>{saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <CheckCircle2 size={16} className="mr-2" />} Luo {selectedAssignments.length} työmääräystä</Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
