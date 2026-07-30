import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Layers3,
  ListPlus,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Users,
  UsersRound,
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
  buildTargetPhaseSchedule,
  createGenericProjectPhases,
  generateProjectWorkTargets,
  isIsoDate,
  normalizeProjectWorkTargets,
  projectWorkPlanSize,
  resolveWorkPlanAssignees,
  type ProjectWorkPhaseDraft,
  type ProjectWorkTargetDraft,
} from '@/lib/projectWorkPlanBuilder';
import { createProjectWorkPlan } from '@/lib/supabase/projectWorkPlans';
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

function phaseId(): string {
  return `phase-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function targetId(): string {
  return `target-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyTarget(): ProjectWorkTargetDraft {
  return {
    id: targetId(),
    key: `kohde-${Date.now()}`,
    title: '',
    location: '',
    description: '',
    startDate: '',
    endDate: '',
    assigneeUserIds: [],
  };
}

function initialPhase(project: Project): ProjectWorkPhaseDraft {
  return {
    id: phaseId(),
    title: '',
    type: '',
    description: '',
    startDate: project.startDate || '',
    endDate: project.endDate || project.startDate || '',
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
    'flex min-w-0 items-center gap-3 rounded-xl border px-3 py-3 text-left',
    complete && 'border-emerald-200 bg-emerald-50',
    active && !complete && 'border-primary/40 bg-primary/5',
    !active && !complete && 'border-slate-200 bg-slate-50/60',
  );
}

function AssigneesList({
  people,
  value,
  onToggle,
  emptyMessage,
}: {
  people: OrganizationPerson[];
  value: string[];
  onToggle: (userId: string, checked: boolean) => void;
  emptyMessage: string;
}) {
  return (
    <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
      {people.map((person) => {
        const selected = value.includes(person.userId);
        return (
          <label
            key={person.userId}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition',
              selected ? 'border-primary/35 bg-white' : 'border-transparent hover:bg-white',
            )}
          >
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) => onToggle(person.userId, checked === true)}
              className="mt-0.5"
            />
            <span className="min-w-0 break-words">
              <span className="block text-sm font-medium">{person.name}</span>
              <span className="block text-xs text-text-secondary">{roleLabel(person.role)}</span>
            </span>
          </label>
        );
      })}
      {people.length === 0 && <p className="break-words text-sm text-amber-800">{emptyMessage}</p>}
    </div>
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
  const [sequencePrefix, setSequencePrefix] = useState('Huoneisto ');
  const [sequenceStart, setSequenceStart] = useState('1');
  const [sequenceCount, setSequenceCount] = useState('10');
  const [sequenceFirstDate, setSequenceFirstDate] = useState('');
  const [sequenceDuration, setSequenceDuration] = useState('10');
  const [sequenceGap, setSequenceGap] = useState('0');
  const [bulkAssigneeId, setBulkAssigneeId] = useState('');
  const [bulkStartDate, setBulkStartDate] = useState('');
  const [bulkEndDate, setBulkEndDate] = useState('');
  const [activeTargetId, setActiveTargetId] = useState('');
  const [phases, setPhases] = useState<ProjectWorkPhaseDraft[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setPlanName(`${project.name} – työkokonaisuus`);
    setPlanDescription('');
    setTargetInput('');
    setTargets([]);
    setSequencePrefix('Huoneisto ');
    setSequenceStart('1');
    setSequenceCount('10');
    setSequenceFirstDate(project.startDate || '');
    setSequenceDuration('10');
    setSequenceGap('0');
    setBulkAssigneeId('');
    setBulkStartDate(project.startDate || '');
    setBulkEndDate(project.endDate || project.startDate || '');
    setActiveTargetId('');
    setPhases([]);
    setErrors([]);
    setSaving(false);
  }, [open, project.endDate, project.name, project.startDate]);

  const workOrderCount = projectWorkPlanSize(targets.length, phases.length);
  const availablePeople = useMemo(
    () => people.filter((person) => ['worker', 'supervisor', 'project_coordinator', 'admin'].includes(person.role)),
    [people],
  );
  const activeTarget = targets.find((target) => target.id === activeTargetId) ?? targets[0];

  const personName = (userId: string) =>
    availablePeople.find((person) => person.userId === userId)?.name ?? userId;

  useEffect(() => {
    if (targets.length === 0) {
      if (activeTargetId) setActiveTargetId('');
      return;
    }
    if (!targets.some((target) => target.id === activeTargetId)) {
      setActiveTargetId(targets[0].id);
    }
  }, [activeTargetId, targets]);

  const appendTargets = (next: ProjectWorkTargetDraft[]) => {
    setTargets((current) => {
      const seen = new Set(
        current.map((target) => `${target.title}|${target.location}|${target.description}`.toLocaleLowerCase('fi')),
      );
      const merged = [...current];
      for (const target of next) {
        const duplicateKey = `${target.title}|${target.location}|${target.description}`.toLocaleLowerCase('fi');
        if (seen.has(duplicateKey)) continue;
        seen.add(duplicateKey);
        merged.push({
          ...target,
          id: `${target.id}-${merged.length}`,
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
      setErrors(['Syötä vähintään yksi huoneisto. Muoto: nimi | sijainti | työseloste | aloitus | valmis']);
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
      setErrors(['Anna kelvollinen aloitusnumero ja 1–100 huoneiston määrä.']);
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
    setTargets((current) => current.map((target) => (target.id === id ? { ...target, ...patch } : target)));
  };

  const toggleTargetAssignee = (targetIdValue: string, userId: string, checked: boolean) => {
    setTargets((current) => current.map((target) => {
      if (target.id !== targetIdValue) return target;
      const assigneeUserIds = checked
        ? [...new Set([...target.assigneeUserIds, userId])]
        : target.assigneeUserIds.filter((item) => item !== userId);
      return { ...target, assigneeUserIds };
    }));
  };

  const applyBulkAssignee = () => {
    if (!bulkAssigneeId) {
      setErrors(['Valitse ensin tekijä, joka asetetaan kaikille kohteille.']);
      return;
    }
    setTargets((current) => applyAssigneesToAllTargets(current, [bulkAssigneeId]));
    setErrors([]);
  };

  const applyBulkSchedule = () => {
    if (!isIsoDate(bulkStartDate) || !isIsoDate(bulkEndDate)) {
      setErrors(['Anna kaikille asetettava aloitus- ja valmistumispäivä.']);
      return;
    }
    if (bulkEndDate < bulkStartDate) {
      setErrors(['Valmistumispäivä ei voi olla ennen aloituspäivää.']);
      return;
    }
    setTargets((current) => applyScheduleToAllTargets(current, bulkStartDate, bulkEndDate));
    setErrors([]);
  };

  const useGenericTemplate = () => {
    setPhases(createGenericProjectPhases({ startDate: project.startDate, endDate: project.endDate }));
    setErrors([]);
  };

  const updatePhase = (id: string, patch: Partial<ProjectWorkPhaseDraft>) => {
    setPhases((current) => current.map((phase) => (phase.id === id ? { ...phase, ...patch } : phase)));
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

  const togglePhaseAssignee = (phaseIdValue: string, userId: string, checked: boolean) => {
    setPhases((current) => current.map((phase) => {
      if (phase.id !== phaseIdValue) return phase;
      const assigneeUserIds = checked
        ? [...new Set([...phase.assigneeUserIds, userId])]
        : phase.assigneeUserIds.filter((item) => item !== userId);
      return { ...phase, assigneeUserIds };
    }));
  };

  const validateBase = (): string[] => {
    const nextErrors: string[] = [];
    if (!planName.trim()) nextErrors.push('Työkokonaisuuden nimi on pakollinen.');
    if (targets.length === 0) nextErrors.push('Lisää vähintään yksi huoneisto tai muu työkohde.');
    if (targets.length > 100) nextErrors.push('Yhdessä kokonaisuudessa voi olla enintään 100 työkohdetta.');
    return nextErrors;
  };

  const validateTargets = (): string[] => {
    const nextErrors: string[] = [];
    targets.forEach((target, index) => {
      const label = target.title.trim() || `Kohde ${index + 1}`;
      if (!target.title.trim()) nextErrors.push(`Kohde ${index + 1}: nimi puuttuu.`);
      if (!isIsoDate(target.startDate) || !isIsoDate(target.endDate)) {
        nextErrors.push(`${label}: aloitus- ja valmistumispäivä puuttuu.`);
      } else if (target.endDate < target.startDate) {
        nextErrors.push(`${label}: valmistuminen ei voi olla ennen aloitusta.`);
      }
    });
    return nextErrors;
  };

  const validatePhases = (): string[] => {
    const nextErrors: string[] = [];
    if (phases.length === 0) nextErrors.push('Lisää vähintään yksi työvaihe.');
    if (phases.length > 20) nextErrors.push('Yhdessä kokonaisuudessa voi olla enintään 20 työvaihetta.');
    phases.forEach((phase, index) => {
      const label = `Työvaihe ${index + 1}`;
      if (!phase.title.trim()) nextErrors.push(`${label}: nimi puuttuu.`);
      if (!isIsoDate(phase.startDate) || !isIsoDate(phase.endDate)) {
        nextErrors.push(`${label}: oletusaikataulu puuttuu.`);
      } else if (phase.endDate < phase.startDate) {
        nextErrors.push(`${label}: valmistuminen ei voi olla ennen aloitusta.`);
      }
    });

    const missingPairs: string[] = [];
    for (const target of targets) {
      for (const phase of phases) {
        if (resolveWorkPlanAssignees(target, phase).length === 0) {
          missingPairs.push(`${target.title.trim() || 'Nimetön kohde'} × ${phase.title.trim() || 'nimetön vaihe'}`);
        }
      }
    }
    if (missingPairs.length > 0) {
      nextErrors.push(`Tekijä puuttuu näiltä yhdistelmiltä: ${missingPairs.slice(0, 12).join('; ')}${missingPairs.length > 12 ? ` ja ${missingPairs.length - 12} muuta` : ''}`);
    }
    if (projectWorkPlanSize(targets.length, phases.length) > 500) {
      nextErrors.push('Kokonaisuus muodostaisi yli 500 työmääräystä. Jaa työ useampaan kokonaisuuteen.');
    }
    return nextErrors;
  };

  const nextFromBase = () => {
    const nextErrors = validateBase();
    setErrors(nextErrors);
    if (nextErrors.length === 0) setStep(2);
  };

  const nextFromTargets = () => {
    const nextErrors = [...validateBase(), ...validateTargets()];
    setErrors(nextErrors);
    if (nextErrors.length === 0) setStep(3);
  };

  const nextFromPhases = () => {
    const nextErrors = [...validateBase(), ...validateTargets(), ...validatePhases()];
    setErrors(nextErrors);
    if (nextErrors.length === 0) setStep(4);
  };

  const save = async () => {
    const nextErrors = [...validateBase(), ...validateTargets(), ...validatePhases()];
    setErrors(nextErrors);
    if (nextErrors.length > 0) return;

    setSaving(true);
    try {
      const result = await createProjectWorkPlan({
        organizationId,
        projectId: project.id,
        name: planName,
        description: planDescription,
        targets,
        phases,
      });
      await onCreated(
        `${planName.trim()} luotiin: ${result.targetCount} työkohdetta, ${result.phaseCount} työvaihetta ja ${result.workOrderCount} kalenteroitua työmääräystä.`,
      );
      onOpenChange(false);
    } catch (caught) {
      setErrors([caught instanceof Error ? caught.message : 'Työkokonaisuuden luonti epäonnistui.']);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="break-words">Rakenna projektin työkokonaisuus</DialogTitle>
          <p className="break-words text-sm text-text-secondary">
            Luo kohteet, anna jokaiselle oma aloitus ja valmistuminen sekä tekijä. Työmääräysten päivät viedään automaattisesti aikatauluihin ja tekijöiden työvuorokalenteriin.
          </p>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
          {[
            { number: 1, title: 'Lisää kohteet', description: `${targets.length} kohdetta`, icon: ClipboardList },
            { number: 2, title: 'Tiedot ja päivät', description: 'kohdekohtainen aikataulu', icon: Clock3 },
            { number: 3, title: 'Työvaiheet', description: `${phases.length} vaihetta`, icon: CalendarDays },
            { number: 4, title: 'Tarkista ja luo', description: `${workOrderCount} työmääräystä`, icon: CheckCircle2 },
          ].map((item) => (
            <button
              type="button"
              key={item.number}
              className={stepClasses(step === item.number, step > item.number)}
              onClick={() => {
                if (item.number < step) {
                  setErrors([]);
                  setStep(item.number);
                }
              }}
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
              <item.icon size={17} className="hidden shrink-0 text-text-muted lg:block" />
              <div className="min-w-0">
                <p className="break-words font-semibold">{item.title}</p>
                <p className="break-words text-xs text-text-secondary">{item.description}</p>
              </div>
            </button>
          ))}
        </div>

        {errors.length > 0 && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {errors.map((error) => <p key={error} className="break-words">• {error}</p>)}
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
                <Input id="plan-description" value={planDescription} onChange={(event) => setPlanDescription(event.target.value)} />
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-slate-200 p-4 sm:p-5">
              <div>
                <h3 className="font-semibold">1. Lisää huoneistot tai muut työkohteet</h3>
                <p className="mt-1 break-words text-sm text-text-secondary">
                  Päivämäärät voi tuoda listassa tai muodostaa numerosarjalle automaattisesti työpäivien mukaan.
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <Label htmlFor="target-list">Liitä kohdelista</Label>
                  <Textarea
                    id="target-list"
                    value={targetInput}
                    onChange={(event) => setTargetInput(event.target.value)}
                    rows={8}
                    placeholder={'A1 | 1. kerros | Keittiöremontti | 2026-08-03 | 2026-08-14\nA2 | 1. kerros | Keittiöremontti | 2026-08-17 | 2026-08-28'}
                  />
                  <p className="break-words text-xs text-text-secondary">
                    Muoto: kohde | sijainti | työseloste | aloitus YYYY-MM-DD | valmis YYYY-MM-DD.
                  </p>
                  <Button type="button" variant="outline" onClick={buildTargetsFromText}>
                    <ListPlus size={16} className="mr-2" /> Muodosta kohteet listasta
                  </Button>
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <Label>Luo numerosarja ja jaksota peräkkäin</Label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="space-y-1"><Label className="text-xs">Nimen alku</Label><Input value={sequencePrefix} onChange={(event) => setSequencePrefix(event.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Alkaa numerosta</Label><Input type="number" value={sequenceStart} onChange={(event) => setSequenceStart(event.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Määrä</Label><Input type="number" min={1} max={100} value={sequenceCount} onChange={(event) => setSequenceCount(event.target.value)} /></div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="space-y-1"><Label className="text-xs">Ensimmäinen aloitus</Label><Input type="date" value={sequenceFirstDate} onChange={(event) => setSequenceFirstDate(event.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Kesto / kohde, työpäivää</Label><Input type="number" min={1} max={60} value={sequenceDuration} onChange={(event) => setSequenceDuration(event.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Väli, työpäivää</Label><Input type="number" min={0} max={20} value={sequenceGap} onChange={(event) => setSequenceGap(event.target.value)} /></div>
                  </div>
                  <Button type="button" variant="outline" onClick={buildTargetSequence}>
                    <Wand2 size={16} className="mr-2" /> Muodosta ja aikatauluta
                  </Button>
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
                    Numerosarja ohittaa viikonloput. Seuraava kohde alkaa edellisen valmistumisen jälkeen annetulla työpäivävälillä.
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h3 className="font-semibold">Luodut kohteet</h3><p className="mt-1 text-sm text-text-secondary">Tiedot tarkennetaan seuraavassa vaiheessa.</p></div>
                <div className="flex items-center gap-2"><Badge variant="secondary">{targets.length}/100</Badge><Button type="button" variant="outline" size="sm" onClick={() => setTargets((current) => [...current, emptyTarget()])}><Plus size={16} className="mr-1.5" /> Lisää yksittäin</Button></div>
              </div>
              {targets.length === 0 ? (
                <div className="mt-4 rounded-xl border-2 border-dashed border-slate-200 p-6 text-center text-sm text-text-secondary">Ei vielä kohteita.</div>
              ) : (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {targets.map((target, index) => (
                    <div key={target.id} className="rounded-xl border border-slate-200 p-3">
                      <p className="font-medium">{target.title.trim() || `Nimetön kohde ${index + 1}`}</p>
                      <p className="mt-1 text-xs text-text-secondary">{formatDate(target.startDate)}–{formatDate(target.endDate)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="font-semibold text-blue-950">Anna jokaiselle kohteelle aloitus ja valmistuminen</p>
              <p className="mt-1 break-words text-sm text-blue-900">
                Nämä päivät määräävät työmääräysten todellisen aikataulun. Päivät jaetaan työvaiheille järjestyksessä ja synkronoidaan tekijöiden kalentereihin.
              </p>
            </div>

            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-2">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[220px] flex-1 space-y-1"><Label className="text-xs">Sama tekijä kaikille</Label><Select value={bulkAssigneeId || undefined} onValueChange={setBulkAssigneeId}><SelectTrigger><SelectValue placeholder="Valitse henkilö" /></SelectTrigger><SelectContent>{availablePeople.map((person) => <SelectItem key={person.userId} value={person.userId}>{person.name} ({roleLabel(person.role)})</SelectItem>)}</SelectContent></Select></div>
                <Button type="button" variant="secondary" onClick={applyBulkAssignee}><Users size={16} className="mr-2" /> Aseta kaikille</Button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[150px] flex-1 space-y-1"><Label className="text-xs">Sama aloitus kaikille</Label><Input type="date" value={bulkStartDate} onChange={(event) => setBulkStartDate(event.target.value)} /></div>
                <div className="min-w-[150px] flex-1 space-y-1"><Label className="text-xs">Sama valmistuminen kaikille</Label><Input type="date" value={bulkEndDate} onChange={(event) => setBulkEndDate(event.target.value)} /></div>
                <Button type="button" variant="secondary" onClick={applyBulkSchedule}><CalendarDays size={16} className="mr-2" /> Aseta päivät</Button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-3 flex items-center justify-between"><p className="font-semibold">Kohteet</p><Badge variant="secondary">{targets.length}</Badge></div>
                <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                  {targets.map((target, index) => {
                    const scheduleReady = isIsoDate(target.startDate) && isIsoDate(target.endDate) && target.endDate >= target.startDate;
                    return (
                      <button
                        type="button"
                        key={target.id}
                        className={cn('w-full rounded-lg border p-3 text-left transition', activeTarget?.id === target.id ? 'border-primary/40 bg-white shadow-sm' : 'border-transparent hover:border-slate-200 hover:bg-white')}
                        onClick={() => setActiveTargetId(target.id)}
                      >
                        <span className="block text-xs font-semibold text-text-muted">Kohde {index + 1}</span>
                        <span className="mt-1 block font-medium">{target.title.trim() || 'Nimetön kohde'}</span>
                        <span className={cn('mt-1 block text-xs', scheduleReady ? 'text-emerald-700' : 'text-red-600')}>{scheduleReady ? `${formatDate(target.startDate)}–${formatDate(target.endDate)}` : 'Aikataulu puuttuu'}</span>
                        <span className="mt-1 block text-xs text-text-secondary">{target.assigneeUserIds.length > 0 ? target.assigneeUserIds.map(personName).join(', ') : 'Tekijä työvaiheelta'}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {activeTarget && (
                <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Muokattava kohde</p><h3 className="mt-1 text-lg font-semibold">{activeTarget.title.trim() || 'Nimetön kohde'}</h3></div>
                    <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={() => setTargets((current) => current.filter((item) => item.id !== activeTarget.id))}><Trash2 size={16} className="mr-1.5" /> Poista kohde</Button>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5"><Label>Nimi *</Label><Input value={activeTarget.title} onChange={(event) => updateTarget(activeTarget.id, { title: event.target.value })} /></div>
                        <div className="space-y-1.5"><Label>Sijainti</Label><Input value={activeTarget.location} onChange={(event) => updateTarget(activeTarget.id, { location: event.target.value })} /></div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5"><Label>Aloitus *</Label><Input type="date" value={activeTarget.startDate} onChange={(event) => updateTarget(activeTarget.id, { startDate: event.target.value })} /></div>
                        <div className="space-y-1.5"><Label>Valmis viimeistään *</Label><Input type="date" min={activeTarget.startDate || undefined} value={activeTarget.endDate} onChange={(event) => updateTarget(activeTarget.id, { endDate: event.target.value })} /></div>
                      </div>
                      <div className="space-y-1.5"><Label>Mitä tässä kohteessa tehdään</Label><Textarea value={activeTarget.description} onChange={(event) => updateTarget(activeTarget.id, { description: event.target.value })} rows={5} /></div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-center justify-between"><div><p className="font-semibold">Kohteen tekijä(t)</p><p className="mt-1 text-xs text-text-secondary">Valinta ohittaa työvaiheen oletustekijän.</p></div><Badge variant="secondary">{activeTarget.assigneeUserIds.length}</Badge></div>
                      <AssigneesList people={availablePeople} value={activeTarget.assigneeUserIds} onToggle={(userId, checked) => toggleTargetAssignee(activeTarget.id, userId, checked)} emptyMessage="Projektitiimissä ei ole valittavia käyttäjiä." />
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-blue-950">Yhteinen työvaiherakenne kaikille kohteille</p>
                <p className="mt-1 break-words text-sm text-blue-900">
                  Kohteen oma aikaväli jaetaan näiden vaiheiden järjestykseen. Työvaiheen päivät toimivat projektitason oletuksena ja aikataulutusnäkymän lähtötietona.
                </p>
              </div>
              <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={useGenericTemplate}><Sparkles size={16} className="mr-2" /> Käytä yleistä runkoa</Button><Button onClick={() => setPhases((current) => [...current, initialPhase(project)])}><Plus size={16} className="mr-2" /> Lisää työvaihe</Button></div>
            </div>

            {phases.length === 0 && <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center"><Layers3 size={42} className="mx-auto text-slate-300" /><p className="mt-3 font-semibold">Työvaiheita ei ole vielä lisätty</p></div>}

            <div className="space-y-4">
              {phases.map((phase, index) => (
                <section key={phase.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">{index + 1}</span><div><p className="font-semibold">{phase.title || `Työvaihe ${index + 1}`}</p><p className="text-xs text-text-secondary">Seuraava vaihe lukitaan tämän valmistumiseen asti.</p></div></div>
                    <div className="flex gap-1"><Button variant="ghost" size="sm" disabled={index === 0} onClick={() => movePhase(index, -1)} aria-label="Siirrä työvaihetta ylöspäin"><ArrowUp size={16} /></Button><Button variant="ghost" size="sm" disabled={index === phases.length - 1} onClick={() => movePhase(index, 1)} aria-label="Siirrä työvaihetta alaspäin"><ArrowDown size={16} /></Button><Button variant="ghost" size="sm" className="text-red-600" onClick={() => setPhases((current) => current.filter((item) => item.id !== phase.id))} aria-label="Poista työvaihe"><Trash2 size={16} /></Button></div>
                  </div>
                  <div className="grid gap-4 p-4 lg:grid-cols-2">
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>Nimi *</Label><Input value={phase.title} onChange={(event) => updatePhase(phase.id, { title: event.target.value })} /></div><div className="space-y-2"><Label>Työlaji</Label><Input value={phase.type} onChange={(event) => updatePhase(phase.id, { type: event.target.value })} /></div></div>
                      <div className="space-y-2"><Label>Työvaiheen ohje tai sisältö</Label><Textarea value={phase.description} onChange={(event) => updatePhase(phase.id, { description: event.target.value })} rows={3} /></div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-2"><Label>Oletusaloitus *</Label><Input type="date" value={phase.startDate} onChange={(event) => updatePhase(phase.id, { startDate: event.target.value })} /></div>
                        <div className="space-y-2"><Label>Oletusvalmistuminen *</Label><Input type="date" min={phase.startDate || undefined} value={phase.endDate} onChange={(event) => updatePhase(phase.id, { endDate: event.target.value })} /></div>
                        <div className="space-y-2"><Label>Prioriteetti</Label><Select value={phase.priority} onValueChange={(priority: WorkOrderPriority) => updatePhase(phase.id, { priority })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent></Select></div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between"><div><p className="font-semibold">Oletustekijä(t)</p><p className="mt-1 text-xs text-text-secondary">Käytetään, jos kohteella ei ole omaa tekijää.</p></div><Badge variant="secondary">{phase.assigneeUserIds.length}</Badge></div><div className="mt-3"><AssigneesList people={availablePeople} value={phase.assigneeUserIds} onToggle={(userId, checked) => togglePhaseAssignee(phase.id, userId, checked)} emptyMessage="Projektitiimissä ei ole valittavia käyttäjiä." /></div></div>
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Työkokonaisuus', value: planName, icon: Layers3 },
                { label: 'Kohteita', value: String(targets.length), icon: ClipboardList },
                { label: 'Työvaiheita', value: String(phases.length), icon: CalendarDays },
                { label: 'Työmääräyksiä', value: String(workOrderCount), icon: UsersRound },
              ].map((item) => <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><item.icon size={18} className="text-primary" /><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-text-muted">{item.label}</p><p className="mt-1 break-words text-lg font-bold">{item.value}</p></div>)}
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                <h3 className="font-semibold">Kohteet ja todelliset päivät</h3>
                <div className="mt-4 space-y-2">
                  {targets.map((target) => {
                    const targetSchedule = buildTargetPhaseSchedule(target, phases);
                    return (
                      <div key={target.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-medium">{target.title}{target.location.trim() ? ` · ${target.location}` : ''}</p><Badge variant="outline">{formatDate(target.startDate)}–{formatDate(target.endDate)}</Badge></div>
                        <p className="mt-1 text-xs text-text-secondary">Tekijä: {target.assigneeUserIds.length > 0 ? target.assigneeUserIds.map(personName).join(', ') : 'työvaiheen oletus'}</p>
                        {phases.length > 1 && <div className="mt-2 grid gap-1 text-xs text-text-secondary">{targetSchedule.map((schedule, index) => <p key={`${target.id}-${phases[index]?.id ?? index}`}>{index + 1}. {phases[index]?.title || 'Työvaihe'}: {formatDate(schedule.startDate)}–{formatDate(schedule.endDate)}</p>)}</div>}
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                <h3 className="font-semibold">Työvaiherakenne</h3>
                <div className="mt-4 space-y-2">
                  {phases.map((phase, index) => <div key={phase.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[40px_1fr_auto] sm:items-center"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">{index + 1}</span><div><p className="font-medium">{phase.title}</p><p className="mt-1 text-xs text-text-secondary">Projektitason oletus {formatDate(phase.startDate)}–{formatDate(phase.endDate)}{phase.assigneeUserIds.length > 0 ? ` · ${phase.assigneeUserIds.map(personName).join(', ')}` : ''}</p></div><Badge variant="outline">{phase.priority}</Badge></div>)}
                </div>
              </section>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
              <p className="font-semibold">Kalenterit ja työvuorolistat päivittyvät automaattisesti</p>
              <p className="mt-1 break-words leading-relaxed">
                Jokaisesta kohde × työvaihe -yhdistelmästä syntyy suunnitelluilla päivillä työmääräys. Valituille tekijöille luodaan työvuorot jokaiselle maanantain ja perjantain väliselle työpäivälle klo 7.00–15.30. Projektin aikataulutusnäkymän työvaihe kattaa kaikkien kohteiden aikaisimman aloituksen ja myöhäisimmän valmistumisen.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div>{step > 1 && <Button variant="outline" disabled={saving} onClick={() => { setErrors([]); setStep((current) => Math.max(1, current - 1)); }}><ArrowLeft size={16} className="mr-2" /> Edellinen</Button>}</div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>Peruuta</Button>
            {step === 1 && <Button onClick={nextFromBase}>Jatka tietoihin ja päiviin <ArrowRight size={16} className="ml-2" /></Button>}
            {step === 2 && <Button onClick={nextFromTargets}>Jatka työvaiheisiin <ArrowRight size={16} className="ml-2" /></Button>}
            {step === 3 && <Button onClick={nextFromPhases}>Tarkista kokonaisuus <ArrowRight size={16} className="ml-2" /></Button>}
            {step === 4 && <Button disabled={saving} onClick={() => void save()}>{saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <CheckCircle2 size={16} className="mr-2" />} Luo {workOrderCount} työmääräystä</Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
