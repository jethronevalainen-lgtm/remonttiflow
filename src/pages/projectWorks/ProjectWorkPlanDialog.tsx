import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
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
  createGenericProjectPhases,
  generateProjectWorkTargets,
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
      {people.length === 0 && (
        <p className="text-sm text-amber-800 break-words">{emptyMessage}</p>
      )}
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
  const [bulkAssigneeId, setBulkAssigneeId] = useState('');
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
    setBulkAssigneeId('');
    setActiveTargetId('');
    setPhases([]);
    setErrors([]);
    setSaving(false);
  }, [open, project.name]);

  const workOrderCount = projectWorkPlanSize(targets.length, phases.length);
  const availablePeople = useMemo(
    () => people.filter((person) => ['worker', 'supervisor', 'project_coordinator', 'admin'].includes(person.role)),
    [people],
  );

  const personName = (userId: string) =>
    availablePeople.find((person) => person.userId === userId)?.name ?? userId;
  const activeTarget = targets.find((target) => target.id === activeTargetId) ?? targets[0];

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
        current.map((target) =>
          `${target.title}|${target.location}|${target.description}`.toLocaleLowerCase('fi'),
        ),
      );
      const merged = [...current];
      for (const target of next) {
        const key = `${target.title}|${target.location}|${target.description}`.toLocaleLowerCase('fi');
        if (seen.has(key)) continue;
        seen.add(key);
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
      setErrors(['Syötä vähintään yksi huoneisto. Muoto: nimi | sijainti | työseloste']);
      return;
    }
    appendTargets(parsed);
    setTargetInput('');
    setErrors([]);
  };

  const buildTargetSequence = () => {
    const start = Number(sequenceStart);
    const count = Number(sequenceCount);
    if (!Number.isFinite(start) || !Number.isFinite(count) || count < 1 || count > 100) {
      setErrors(['Anna kelvollinen aloitusnumero ja 1–100 huoneiston määrä.']);
      return;
    }
    appendTargets(generateProjectWorkTargets({ prefix: sequencePrefix, start, count }));
    setErrors([]);
  };

  const updateTarget = (id: string, patch: Partial<ProjectWorkTargetDraft>) => {
    setTargets((current) =>
      current.map((target) => (target.id === id ? { ...target, ...patch } : target)),
    );
  };

  const toggleTargetAssignee = (targetIdValue: string, userId: string, checked: boolean) => {
    setTargets((current) =>
      current.map((target) => {
        if (target.id !== targetIdValue) return target;
        const assigneeUserIds = checked
          ? [...new Set([...target.assigneeUserIds, userId])]
          : target.assigneeUserIds.filter((item) => item !== userId);
        return { ...target, assigneeUserIds };
      }),
    );
  };

  const applyBulkAssignee = () => {
    if (!bulkAssigneeId) {
      setErrors(['Valitse ensin tekijä, joka asetetaan kaikille huoneistoille.']);
      return;
    }
    setTargets((current) => applyAssigneesToAllTargets(current, [bulkAssigneeId]));
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

  const toggleAssignee = (phaseIdValue: string, userId: string, checked: boolean) => {
    setPhases((current) =>
      current.map((phase) => {
        if (phase.id !== phaseIdValue) return phase;
        const assigneeUserIds = checked
          ? [...new Set([...phase.assigneeUserIds, userId])]
          : phase.assigneeUserIds.filter((item) => item !== userId);
        return { ...phase, assigneeUserIds };
      }),
    );
  };

  const validateStepOne = (): string[] => {
    const nextErrors: string[] = [];
    if (!planName.trim()) nextErrors.push('Työkokonaisuuden nimi on pakollinen.');
    if (targets.length === 0) nextErrors.push('Lisää vähintään yksi huoneisto tai muu työkohde.');
    if (targets.length > 100) nextErrors.push('Yhdessä kokonaisuudessa voi olla enintään 100 työkohdetta.');
    targets.forEach((target, index) => {
      if (!target.title.trim()) {
        nextErrors.push(`Huoneisto / kohde ${index + 1}: nimi puuttuu.`);
      }
    });
    return nextErrors;
  };

  const validateStepTwo = (): string[] => {
    const nextErrors: string[] = [];
    if (phases.length === 0) nextErrors.push('Lisää vähintään yksi työvaihe.');
    if (phases.length > 20) nextErrors.push('Yhdessä kokonaisuudessa voi olla enintään 20 työvaihetta.');
    phases.forEach((phase, index) => {
      const label = `Työvaihe ${index + 1}`;
      if (!phase.title.trim()) nextErrors.push(`${label}: nimi puuttuu.`);
      if (!phase.startDate || !phase.endDate) nextErrors.push(`${label}: aikataulu puuttuu.`);
      if (phase.startDate && phase.endDate && phase.endDate < phase.startDate) {
        nextErrors.push(`${label}: valmistuminen ei voi olla ennen aloitusta.`);
      }
    });

    const missingPairs: string[] = [];
    for (const target of targets) {
      for (const phase of phases) {
        if (resolveWorkPlanAssignees(target, phase).length === 0) {
          missingPairs.push(
            `${target.title.trim() || 'Nimetön kohde'} × ${phase.title.trim() || 'nimetön vaihe'}`,
          );
        }
      }
    }
    if (missingPairs.length > 0) {
      nextErrors.push(
        `Tekijä puuttuu näiltä yhdistelmiltä (aseta huoneistolle tai työvaiheelle): ${missingPairs.join('; ')}`,
      );
    }

    if (projectWorkPlanSize(targets.length, phases.length) > 500) {
      nextErrors.push('Kokonaisuus muodostaisi yli 500 työmääräystä. Jaa työ useampaan kokonaisuuteen.');
    }
    return nextErrors;
  };

  const continueFromStepOne = () => {
    const nextErrors = validateStepOne();
    setErrors(nextErrors);
    if (nextErrors.length === 0) setStep(2);
  };

  const continueFromStepTwo = () => {
    const nextErrors = validateStepOne();
    setErrors(nextErrors);
    if (nextErrors.length === 0) setStep(3);
  };

  const continueFromStepThree = () => {
    const nextErrors = validateStepTwo();
    setErrors(nextErrors);
    if (nextErrors.length === 0) setStep(4);
  };

  const save = async () => {
    const nextErrors = [...validateStepOne(), ...validateStepTwo()];
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
        `${planName.trim()} luotiin: ${result.targetCount} työkohdetta, ${result.phaseCount} työvaihetta ja ${result.workOrderCount} työmääräystä.`,
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
          <p className="text-sm text-text-secondary break-words">
            Luo kerralla kaikki huoneistot, anna kullekin tekijä ja työseloste, ja jaa yhteinen
            työvaiherakenne. Jokainen huoneisto × työvaihe = yksi työmääräys.
          </p>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
          {[
            { number: 1, title: 'Lisää kohteet', description: `${targets.length} kohdetta`, icon: ClipboardList },
            { number: 2, title: 'Kohteiden tiedot', description: 'sisältö ja tekijät', icon: Users },
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
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                  step > item.number
                    ? 'bg-emerald-600 text-white'
                    : step === item.number
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-slate-200 text-slate-600',
                )}
              >
                {step > item.number ? <CheckCircle2 size={17} /> : item.number}
              </span>
              <div className="min-w-0">
                <p className="font-semibold break-words">{item.title}</p>
                <p className="text-xs text-text-secondary break-words">{item.description}</p>
              </div>
            </button>
          ))}
        </div>

        {errors.length > 0 && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {errors.map((error) => (
              <p key={error} className="break-words">
                • {error}
              </p>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <section className="grid gap-4 rounded-2xl border border-slate-200 p-4 sm:grid-cols-2 sm:p-5">
              <div className="space-y-2">
                <Label htmlFor="plan-name">Työkokonaisuuden nimi *</Label>
                <Input
                  id="plan-name"
                  value={planName}
                  onChange={(event) => setPlanName(event.target.value)}
                  placeholder="Esim. Keittiöremontti – kaikki huoneistot"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-description">Kuvaus</Label>
                <Input
                  id="plan-description"
                  value={planDescription}
                  onChange={(event) => setPlanDescription(event.target.value)}
                  placeholder="Mitä kokonaisuudessa tehdään"
                />
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-slate-200 p-4 sm:p-5">
              <div>
                <h3 className="font-semibold break-words">1. Lisää huoneistot kerralla</h3>
                <p className="mt-1 text-sm text-text-secondary break-words">
                  Liitä lista tai muodosta numerosarja. Seuraavassa kohdassa täydennät tekijän ja
                  työselosteen jokaiselle huoneistolle.
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <Label htmlFor="target-list">Liitä huoneistolista</Label>
                  <Textarea
                    id="target-list"
                    value={targetInput}
                    onChange={(event) => setTargetInput(event.target.value)}
                    rows={7}
                    placeholder={'A1 | 1. kerros | Keittiö + kylpyhuone\nA2 | 1. kerros | Vain keittiö\nB12 | 3. kerros'}
                  />
                  <p className="text-xs text-text-secondary break-words">
                    Muoto: huoneisto | sijainti | työseloste. Sijainnin ja selosteen voi jättää pois.
                  </p>
                  <Button type="button" variant="outline" onClick={buildTargetsFromText}>
                    <ListPlus size={16} className="mr-2" />
                    Muodosta huoneistot listasta
                  </Button>
                </div>
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <Label>Luo numerosarja</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="seq-prefix" className="text-xs">
                        Nimen alku
                      </Label>
                      <Input
                        id="seq-prefix"
                        value={sequencePrefix}
                        onChange={(event) => setSequencePrefix(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="seq-start" className="text-xs">
                        Alkaa
                      </Label>
                      <Input
                        id="seq-start"
                        type="number"
                        value={sequenceStart}
                        onChange={(event) => setSequenceStart(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="seq-count" className="text-xs">
                        Määrä
                      </Label>
                      <Input
                        id="seq-count"
                        type="number"
                        min={1}
                        max={100}
                        value={sequenceCount}
                        onChange={(event) => setSequenceCount(event.target.value)}
                      />
                    </div>
                  </div>
                  <Button type="button" variant="outline" onClick={buildTargetSequence}>
                    <Wand2 size={16} className="mr-2" />
                    Muodosta numerosarja
                  </Button>
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900 break-words">
                    Sama työvaiherakenne monistetaan jokaiselle huoneistolle. Jokainen muodostuva
                    työvaihe on oma työmääräyksensä. Voit asettaa tekijän huoneistokohtaisesti tai
                    työvaiheelle yhteiseksi oletukseksi.
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold break-words">Luodut huoneistot / kohteet</h3>
                  <p className="mt-1 text-sm text-text-secondary break-words">
                    Tarkista määrä. Tiedot ja tekijät lisätään seuraavassa vaiheessa.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{targets.length}/100</Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTargets((current) => [...current, emptyTarget()])}
                  >
                    <Plus size={16} className="mr-1.5" />
                    Lisää yksittäin
                  </Button>
                </div>
              </div>
              {targets.length === 0 ? (
                <div className="mt-4 rounded-xl border-2 border-dashed border-slate-200 p-6 text-center text-sm text-text-secondary break-words">
                  Ei vielä huoneistoja. Liitä lista, muodosta numerosarja tai lisää yksi kohde.
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {targets.map((target, index) => (
                    <Badge key={target.id} variant="outline" className="whitespace-normal break-words px-3 py-1.5">
                      {target.title.trim() || `Nimetön kohde ${index + 1}`}
                    </Badge>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="font-semibold text-blue-950 break-words">
                Täydennä huoneistokohtaiset tiedot
              </p>
              <p className="mt-1 text-sm text-blue-900 break-words">
                Valitse vasemmalta kohde ja muokkaa sen tietoja oikealla. Tekijä on valinnainen:
                jos sitä ei aseteta tässä, käytetään seuraavassa vaiheessa valittua työvaiheen tekijää.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="min-w-[220px] flex-1 space-y-1">
                <Label className="text-xs">Aseta sama tekijä kaikille kohteille</Label>
                <Select value={bulkAssigneeId || undefined} onValueChange={setBulkAssigneeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Valitse henkilö" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePeople.map((person) => (
                      <SelectItem key={person.userId} value={person.userId}>
                        {person.name} ({roleLabel(person.role)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" variant="secondary" onClick={applyBulkAssignee}>
                <Users size={16} className="mr-2" />
                Aseta kaikille
              </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="font-semibold">Kohteet</p>
                  <Badge variant="secondary">{targets.length}</Badge>
                </div>
                <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                  {targets.map((target, index) => (
                    <button
                      type="button"
                      key={target.id}
                      className={cn(
                        'w-full rounded-lg border p-3 text-left transition',
                        activeTarget?.id === target.id
                          ? 'border-primary/40 bg-white shadow-sm'
                          : 'border-transparent hover:border-slate-200 hover:bg-white',
                      )}
                      onClick={() => setActiveTargetId(target.id)}
                    >
                      <span className="block text-xs font-semibold text-text-muted">
                        Kohde {index + 1}
                      </span>
                      <span className="mt-1 block font-medium break-words">
                        {target.title.trim() || 'Nimetön kohde'}
                      </span>
                      <span className="mt-1 block text-xs text-text-secondary break-words">
                        {target.assigneeUserIds.length > 0
                          ? target.assigneeUserIds.map(personName).join(', ')
                          : 'Tekijä työvaiheelta'}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {activeTarget && (
                <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                        Muokattava kohde
                      </p>
                      <h3 className="mt-1 text-lg font-semibold break-words">
                        {activeTarget.title.trim() || 'Nimetön kohde'}
                      </h3>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      onClick={() =>
                        setTargets((current) =>
                          current.filter((item) => item.id !== activeTarget.id),
                        )
                      }
                    >
                      <Trash2 size={16} className="mr-1.5" />
                      Poista kohde
                    </Button>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label>Nimi *</Label>
                          <Input
                            value={activeTarget.title}
                            onChange={(event) =>
                              updateTarget(activeTarget.id, { title: event.target.value })
                            }
                            placeholder="Esim. A12 tai Huoneisto 3"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Sijainti</Label>
                          <Input
                            value={activeTarget.location}
                            onChange={(event) =>
                              updateTarget(activeTarget.id, { location: event.target.value })
                            }
                            placeholder="Esim. 2. kerros, rappu B"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Mitä tässä huoneistossa tehdään</Label>
                        <Textarea
                          value={activeTarget.description}
                          onChange={(event) =>
                            updateTarget(activeTarget.id, { description: event.target.value })
                          }
                          rows={5}
                          placeholder="Esim. Keittiökaapistot + liedet, ei kylpyhuonetta"
                        />
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold">Kohteen tekijä(t)</p>
                          <p className="mt-1 text-xs text-text-secondary break-words">
                            Valinta ohittaa työvaiheen oletustekijän.
                          </p>
                        </div>
                        <Badge variant="secondary">{activeTarget.assigneeUserIds.length}</Badge>
                      </div>
                      <AssigneesList
                        people={availablePeople}
                        value={activeTarget.assigneeUserIds}
                        onToggle={(userId, checked) =>
                          toggleTargetAssignee(activeTarget.id, userId, checked)
                        }
                        emptyMessage="Projektitiimissä ei ole valittavia käyttäjiä."
                      />
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
                <p className="font-semibold text-blue-950 break-words">
                  Yhteinen työvaiherakenne kaikille {targets.length} huoneistolle
                </p>
                <p className="mt-1 text-sm text-blue-900 break-words">
                  Jos huoneistolla on jo tekijä, hänellä on etusija. Työvaiheen tekijää käytetään
                  vain niillä huoneistoilla, joilla tekijää ei ole asetettu.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={useGenericTemplate}>
                  <Sparkles size={16} className="mr-2" />
                  Käytä yleistä runkoa
                </Button>
                <Button onClick={() => setPhases((current) => [...current, initialPhase(project)])}>
                  <Plus size={16} className="mr-2" />
                  Lisää työvaihe
                </Button>
              </div>
            </div>

            {phases.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center">
                <Layers3 size={42} className="mx-auto text-slate-300" />
                <p className="mt-3 font-semibold">Työvaiheita ei ole vielä lisätty</p>
                <p className="mt-1 text-sm text-text-secondary break-words">
                  Lisää urakan oikeat työvaiheet tai käytä yleistä runkoa lähtökohtana.
                </p>
              </div>
            )}

            <div className="space-y-4">
              {phases.map((phase, index) => (
                <section key={phase.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-semibold break-words">
                          {phase.title || `Työvaihe ${index + 1}`}
                        </p>
                        <p className="text-xs text-text-secondary break-words">
                          Seuraava vaihe lukitaan tämän valmistumiseen asti.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={index === 0}
                        onClick={() => movePhase(index, -1)}
                        aria-label="Siirrä työvaihetta ylöspäin"
                      >
                        <ArrowUp size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={index === phases.length - 1}
                        onClick={() => movePhase(index, 1)}
                        aria-label="Siirrä työvaihetta alaspäin"
                      >
                        <ArrowDown size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={() =>
                          setPhases((current) => current.filter((item) => item.id !== phase.id))
                        }
                        aria-label="Poista työvaihe"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-4 p-4 lg:grid-cols-2">
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Nimi *</Label>
                          <Input
                            value={phase.title}
                            onChange={(event) => updatePhase(phase.id, { title: event.target.value })}
                            placeholder="Esim. Purkutyöt"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Työlaji</Label>
                          <Input
                            value={phase.type}
                            onChange={(event) => updatePhase(phase.id, { type: event.target.value })}
                            placeholder="Esim. Purku"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Työvaiheen ohje tai sisältö</Label>
                        <Textarea
                          value={phase.description}
                          onChange={(event) =>
                            updatePhase(phase.id, { description: event.target.value })
                          }
                          rows={3}
                          placeholder="Yhteinen ohje kaikille huoneistoille"
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Aloitus *</Label>
                          <Input
                            type="date"
                            value={phase.startDate}
                            onChange={(event) =>
                              updatePhase(phase.id, { startDate: event.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Valmistuminen *</Label>
                          <Input
                            type="date"
                            value={phase.endDate}
                            onChange={(event) =>
                              updatePhase(phase.id, { endDate: event.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Prioriteetti</Label>
                          <Select
                            value={phase.priority}
                            onValueChange={(priority: WorkOrderPriority) =>
                              updatePhase(phase.id, { priority })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PRIORITIES.map((priority) => (
                                <SelectItem key={priority} value={priority}>
                                  {priority}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold">Oletustekijä(t)</p>
                          <p className="mt-1 text-xs text-text-secondary break-words">
                            Käytetään vain jos huoneistolla ei ole omaa tekijää.
                          </p>
                        </div>
                        <Badge variant="secondary">{phase.assigneeUserIds.length}</Badge>
                      </div>
                      <div className="mt-3">
                        <AssigneesList
                          people={availablePeople}
                          value={phase.assigneeUserIds}
                          onToggle={(userId, checked) => toggleAssignee(phase.id, userId, checked)}
                          emptyMessage="Projektitiimissä ei ole valittavia käyttäjiä."
                        />
                      </div>
                    </div>
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
                { label: 'Huoneistoja', value: String(targets.length), icon: ClipboardList },
                { label: 'Työvaiheita', value: String(phases.length), icon: CalendarDays },
                { label: 'Työmääräyksiä', value: String(workOrderCount), icon: UsersRound },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <item.icon size={18} className="text-primary" />
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {item.label}
                  </p>
                  <p className="mt-1 break-words text-lg font-bold">{item.value}</p>
                </div>
              ))}
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                <h3 className="font-semibold">Huoneistot / kohteet</h3>
                <div className="mt-4 space-y-2">
                  {targets.map((target) => (
                    <div key={target.id} className="rounded-xl border border-slate-200 p-3">
                      <p className="font-medium break-words">
                        {target.title}
                        {target.location.trim() ? ` · ${target.location}` : ''}
                      </p>
                      {target.description.trim() ? (
                        <p className="mt-1 text-xs text-text-secondary break-words">
                          {target.description}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-text-secondary break-words">
                        Tekijä:{' '}
                        {target.assigneeUserIds.length > 0
                          ? target.assigneeUserIds.map(personName).join(', ')
                          : 'työvaiheen oletus'}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                <h3 className="font-semibold">Työvaiherakenne</h3>
                <div className="mt-4 space-y-2">
                  {phases.map((phase, index) => (
                    <div
                      key={phase.id}
                      className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[40px_1fr_auto] sm:items-center"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium break-words">{phase.title}</p>
                        <p className="mt-1 text-xs text-text-secondary break-words">
                          {phase.startDate}–{phase.endDate}
                          {phase.assigneeUserIds.length > 0
                            ? ` · oletus: ${phase.assigneeUserIds.map(personName).join(', ')}`
                            : ''}
                        </p>
                      </div>
                      <Badge variant="outline">{phase.priority}</Badge>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
              <p className="font-semibold">Luonnin jälkeen</p>
              <p className="mt-1 leading-relaxed break-words">
                Jokaiselle huoneistolle syntyy sama järjestetty työvaiheketju. Huoneiston työseloste
                ja työvaiheen ohje yhdistetään työmääräyksen kuvaukseen. Seuraavaa vaihetta ei voi
                käynnistää ennen edellisen vaiheen hyväksyttyä valmistumista tai peruuttamista.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {step > 1 && (
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setErrors([]);
                  setStep((current) => Math.max(1, current - 1));
                }}
              >
                <ArrowLeft size={16} className="mr-2" />
                Edellinen
              </Button>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>
              Peruuta
            </Button>
            {step === 1 && (
              <Button onClick={continueFromStepOne}>
                Jatka kohteiden tietoihin
                <ArrowRight size={16} className="ml-2" />
              </Button>
            )}
            {step === 2 && (
              <Button onClick={continueFromStepTwo}>
                Jatka työvaiheisiin
                <ArrowRight size={16} className="ml-2" />
              </Button>
            )}
            {step === 3 && (
              <Button onClick={continueFromStepThree}>
                Tarkista kokonaisuus
                <ArrowRight size={16} className="ml-2" />
              </Button>
            )}
            {step === 4 && (
              <Button disabled={saving} onClick={() => void save()}>
                {saving ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 size={16} className="mr-2" />
                )}
                Luo {workOrderCount} työmääräystä
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
