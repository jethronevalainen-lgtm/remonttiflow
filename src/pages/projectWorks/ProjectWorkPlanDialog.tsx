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
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  UsersRound,
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
  createGenericProjectPhases,
  generateProjectWorkTargets,
  normalizeProjectWorkTargets,
  projectWorkPlanSize,
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

function stepClasses(active: boolean, complete: boolean): string {
  return cn(
    'flex min-w-0 items-center gap-3 rounded-xl border px-3 py-3 text-left',
    complete && 'border-emerald-200 bg-emerald-50',
    active && !complete && 'border-primary/40 bg-primary/5',
    !active && !complete && 'border-slate-200 bg-slate-50/60',
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
  const [sequencePrefix, setSequencePrefix] = useState('Kohde ');
  const [sequenceStart, setSequenceStart] = useState('1');
  const [sequenceCount, setSequenceCount] = useState('10');
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
    setSequencePrefix('Kohde ');
    setSequenceStart('1');
    setSequenceCount('10');
    setPhases([]);
    setErrors([]);
    setSaving(false);
  }, [open, project.name]);

  const workOrderCount = projectWorkPlanSize(targets.length, phases.length);
  const availablePeople = useMemo(
    () => people.filter((person) => ['worker', 'supervisor', 'project_coordinator', 'admin'].includes(person.role)),
    [people],
  );

  const buildTargetsFromText = () => {
    const parsed = normalizeProjectWorkTargets(targetInput);
    if (parsed.length === 0) {
      setErrors(['Syötä vähintään yksi työkohde. Käytä yhtä riviä per kohde.']);
      return;
    }
    setTargets(parsed);
    setErrors([]);
  };

  const buildTargetSequence = () => {
    const start = Number(sequenceStart);
    const count = Number(sequenceCount);
    if (!Number.isFinite(start) || !Number.isFinite(count) || count < 1 || count > 100) {
      setErrors(['Anna kelvollinen aloitusnumero ja 1–100 kohteen määrä.']);
      return;
    }
    setTargets(generateProjectWorkTargets({ prefix: sequencePrefix, start, count }));
    setErrors([]);
  };

  const useGenericTemplate = () => {
    setPhases(createGenericProjectPhases({ startDate: project.startDate, endDate: project.endDate }));
    setErrors([]);
  };

  const updatePhase = (id: string, patch: Partial<ProjectWorkPhaseDraft>) => {
    setPhases((current) => current.map((phase) => phase.id === id ? { ...phase, ...patch } : phase));
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
    setPhases((current) => current.map((phase) => {
      if (phase.id !== phaseIdValue) return phase;
      const assigneeUserIds = checked
        ? [...new Set([...phase.assigneeUserIds, userId])]
        : phase.assigneeUserIds.filter((item) => item !== userId);
      return { ...phase, assigneeUserIds };
    }));
  };

  const validateStepOne = (): string[] => {
    const nextErrors: string[] = [];
    if (!planName.trim()) nextErrors.push('Työkokonaisuuden nimi on pakollinen.');
    if (targets.length === 0) nextErrors.push('Muodosta vähintään yksi työkohde.');
    if (targets.length > 100) nextErrors.push('Yhdessä kokonaisuudessa voi olla enintään 100 työkohdetta.');
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
      if (phase.assigneeUserIds.length === 0) nextErrors.push(`${label}: valitse vähintään yksi tekijä.`);
    });
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
    const nextErrors = validateStepTwo();
    setErrors(nextErrors);
    if (nextErrors.length === 0) setStep(3);
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
          <DialogTitle>Rakenna projektin työkokonaisuus</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-3">
          {[
            { number: 1, title: 'Työkohteet', description: `${targets.length} kohdetta`, icon: ClipboardList },
            { number: 2, title: 'Työvaiheet ja tekijät', description: `${phases.length} vaihetta`, icon: UsersRound },
            { number: 3, title: 'Tarkista ja luo', description: `${workOrderCount} työmääräystä`, icon: CheckCircle2 },
          ].map((item) => (
            <div key={item.number} className={stepClasses(step === item.number, step > item.number)}>
              <span className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                step > item.number ? 'bg-emerald-600 text-white' : step === item.number ? 'bg-primary text-primary-foreground' : 'bg-slate-200 text-slate-600',
              )}>
                {step > item.number ? <CheckCircle2 size={17} /> : item.number}
              </span>
              <div className="min-w-0"><p className="font-semibold">{item.title}</p><p className="text-xs text-text-secondary">{item.description}</p></div>
            </div>
          ))}
        </div>

        {errors.length > 0 && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {errors.map((error) => <p key={error}>• {error}</p>)}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <section className="grid gap-4 rounded-2xl border border-slate-200 p-4 sm:grid-cols-2 sm:p-5">
              <div className="space-y-2"><Label htmlFor="plan-name">Työkokonaisuuden nimi *</Label><Input id="plan-name" value={planName} onChange={(event) => setPlanName(event.target.value)} placeholder="Esim. A-portaan huoneistoremontit" /></div>
              <div className="space-y-2"><Label htmlFor="plan-description">Kuvaus</Label><Input id="plan-description" value={planDescription} onChange={(event) => setPlanDescription(event.target.value)} placeholder="Mitä kokonaisuudessa tehdään" /></div>
            </section>

            <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
              <h3 className="font-semibold">Määritä työkohteet</h3>
              <p className="mt-1 text-sm text-text-secondary">Työkohde voi olla asunto, rakennus, kerros, julkisivulohko, huone, alue tai mikä tahansa työn selkeä kohde.</p>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="space-y-3 rounded-xl bg-slate-50 p-4">
                  <Label htmlFor="target-lines">Liitä kohdelista</Label>
                  <Textarea id="target-lines" rows={7} value={targetInput} onChange={(event) => setTargetInput(event.target.value)} placeholder={'A1 | 1. kerros\nA2 | 1. kerros\nPohjoisjulkisivu | Rakennus A'} />
                  <p className="text-xs text-text-secondary">Muoto: kohteen nimi | sijainti. Sijainnin voi jättää pois.</p>
                  <Button variant="outline" className="w-full" onClick={buildTargetsFromText}><ClipboardList size={16} className="mr-2" />Muodosta kohteet listasta</Button>
                </div>
                <div className="space-y-3 rounded-xl bg-slate-50 p-4">
                  <Label>Luo numerosarja</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-3 sm:col-span-1"><Label className="text-xs text-text-secondary">Nimen alku</Label><Input value={sequencePrefix} onChange={(event) => setSequencePrefix(event.target.value)} placeholder="Kohde " /></div>
                    <div><Label className="text-xs text-text-secondary">Alkaa</Label><Input type="number" value={sequenceStart} onChange={(event) => setSequenceStart(event.target.value)} /></div>
                    <div><Label className="text-xs text-text-secondary">Määrä</Label><Input type="number" min="1" max="100" value={sequenceCount} onChange={(event) => setSequenceCount(event.target.value)} /></div>
                  </div>
                  <Button variant="outline" className="w-full" onClick={buildTargetSequence}><Sparkles size={16} className="mr-2" />Muodosta numerosarja</Button>
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">Sama työvaiherakenne monistetaan jokaiselle kohteelle. Jokainen muodostuva työvaihe on oma työmääräyksensä ja tuntikirjauskohteensa.</div>
                </div>
              </div>
            </section>

            {targets.length > 0 && (
              <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Työkohteet</h3><Badge variant="secondary">{targets.length}/100</Badge></div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {targets.map((target) => <div key={target.id} className="rounded-xl border border-slate-200 bg-white p-3"><p className="font-medium">{target.title}</p><p className="mt-1 text-xs text-text-secondary">{target.location}</p></div>)}
                </div>
              </section>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-semibold text-blue-950">Työvaiheet ovat täysin muokattavia</p><p className="mt-1 text-sm text-blue-900">Voit aloittaa tyhjästä tai käyttää yleistä rakennustyön runkoa. Nimeä vaiheet kyseisen urakan mukaan.</p></div>
              <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={useGenericTemplate}><Sparkles size={16} className="mr-2" />Käytä yleistä runkoa</Button><Button onClick={() => setPhases((current) => [...current, initialPhase(project)])}><Plus size={16} className="mr-2" />Lisää työvaihe</Button></div>
            </div>

            {phases.length === 0 && <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center"><Layers3 size={42} className="mx-auto text-slate-300" /><p className="mt-3 font-semibold">Työvaiheita ei ole vielä lisätty</p><p className="mt-1 text-sm text-text-secondary">Lisää urakan oikeat työvaiheet tai käytä yleistä runkoa lähtökohtana.</p></div>}

            <div className="space-y-4">
              {phases.map((phase, index) => (
                <section key={phase.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">{index + 1}</span><div><p className="font-semibold">{phase.title || `Työvaihe ${index + 1}`}</p><p className="text-xs text-text-secondary">Seuraava vaihe lukitaan tämän valmistumiseen asti.</p></div></div>
                    <div className="flex gap-1"><Button variant="ghost" size="sm" disabled={index === 0} onClick={() => movePhase(index, -1)} aria-label="Siirrä työvaihetta ylöspäin"><ArrowUp size={16} /></Button><Button variant="ghost" size="sm" disabled={index === phases.length - 1} onClick={() => movePhase(index, 1)} aria-label="Siirrä työvaihetta alaspäin"><ArrowDown size={16} /></Button><Button variant="ghost" size="sm" className="text-red-600" onClick={() => setPhases((current) => current.filter((item) => item.id !== phase.id))} aria-label="Poista työvaihe"><Trash2 size={16} /></Button></div>
                  </div>
                  <div className="grid gap-4 p-4 lg:grid-cols-2">
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>Nimi *</Label><Input value={phase.title} onChange={(event) => updatePhase(phase.id, { title: event.target.value })} placeholder="Esim. Purkutyöt" /></div><div className="space-y-2"><Label>Työlaji</Label><Input value={phase.type} onChange={(event) => updatePhase(phase.id, { type: event.target.value })} placeholder="Esim. Purku" /></div></div>
                      <div className="space-y-2"><Label>Työvaiheen ohje tai sisältö</Label><Textarea value={phase.description} onChange={(event) => updatePhase(phase.id, { description: event.target.value })} rows={3} placeholder="Mitä tässä vaiheessa pitää tehdä ja millä ehdoin vaihe on valmis" /></div>
                      <div className="grid gap-3 sm:grid-cols-3"><div className="space-y-2"><Label>Aloitus *</Label><Input type="date" value={phase.startDate} onChange={(event) => updatePhase(phase.id, { startDate: event.target.value })} /></div><div className="space-y-2"><Label>Valmistuminen *</Label><Input type="date" value={phase.endDate} onChange={(event) => updatePhase(phase.id, { endDate: event.target.value })} /></div><div className="space-y-2"><Label>Prioriteetti</Label><Select value={phase.priority} onValueChange={(priority: WorkOrderPriority) => updatePhase(phase.id, { priority })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent></Select></div></div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-2"><div><p className="font-semibold">Tekijät *</p><p className="mt-1 text-xs text-text-secondary">Valitse yksi tai useampi tekijä tälle työvaiheelle.</p></div><Badge variant="secondary">{phase.assigneeUserIds.length}</Badge></div>
                      <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                        {availablePeople.map((person) => {
                          const selected = phase.assigneeUserIds.includes(person.userId);
                          return <label key={person.userId} className={cn('flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition', selected ? 'border-primary/35 bg-white' : 'border-transparent hover:bg-white')}><Checkbox checked={selected} onCheckedChange={(checked) => toggleAssignee(phase.id, person.userId, checked === true)} /><span className="min-w-0 break-words"><span className="block text-sm font-medium">{person.name}</span><span className="block text-xs text-text-secondary">{person.role === 'worker' ? 'Työntekijä' : person.role === 'supervisor' ? 'Työnjohtaja' : person.role === 'project_coordinator' ? 'Projektikoordinaattori' : 'Ylläpitäjä'}</span></span></label>;
                        })}
                        {availablePeople.length === 0 && <p className="text-sm text-amber-800">Projektitiimissä ei ole valittavia käyttäjiä.</p>}
                      </div>
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[{ label: 'Työkokonaisuus', value: planName, icon: Layers3 }, { label: 'Työkohteita', value: String(targets.length), icon: ClipboardList }, { label: 'Työvaiheita', value: String(phases.length), icon: CalendarDays }, { label: 'Työmääräyksiä', value: String(workOrderCount), icon: UsersRound }].map((item) => <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><item.icon size={18} className="text-primary" /><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-text-muted">{item.label}</p><p className="mt-1 break-words text-lg font-bold">{item.value}</p></div>)}
            </section>
            <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
              <h3 className="font-semibold">Työvaiherakenne</h3>
              <div className="mt-4 space-y-2">
                {phases.map((phase, index) => <div key={phase.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[40px_1fr_auto] sm:items-center"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">{index + 1}</span><div><p className="font-medium">{phase.title}</p><p className="mt-1 text-xs text-text-secondary">{phase.startDate}–{phase.endDate} · {phase.assigneeUserIds.map((id) => availablePeople.find((person) => person.userId === id)?.name).filter(Boolean).join(', ')}</p></div><Badge variant="outline">{phase.priority}</Badge></div>)}
              </div>
            </section>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><p className="font-semibold">Luonnin jälkeen</p><p className="mt-1 leading-relaxed">Jokaiselle työkohteelle syntyy sama järjestetty työvaiheketju. Tekijä käynnistää oman työvaiheensa, jolloin työaika alkaa. Seuraavaa vaihetta ei voi käynnistää ennen edellisen vaiheen hyväksyttyä valmistumista tai peruuttamista.</p></div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div>{step > 1 && <Button variant="outline" disabled={saving} onClick={() => { setErrors([]); setStep((current) => Math.max(1, current - 1)); }}><ArrowLeft size={16} className="mr-2" />Edellinen</Button>}</div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row"><Button variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>Peruuta</Button>{step === 1 && <Button onClick={continueFromStepOne}>Jatka työvaiheisiin<ArrowRight size={16} className="ml-2" /></Button>}{step === 2 && <Button onClick={continueFromStepTwo}>Tarkista kokonaisuus<ArrowRight size={16} className="ml-2" /></Button>}{step === 3 && <Button disabled={saving} onClick={() => void save()}>{saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <CheckCircle2 size={16} className="mr-2" />}Luo työkokonaisuus</Button>}</div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
