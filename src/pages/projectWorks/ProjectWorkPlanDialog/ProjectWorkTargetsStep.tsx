import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Plus,
  SlidersHorizontal,
  Trash2,
  Users,
  Wand2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  addWorkdays,
  appendProjectWorkTargets,
  applyAssigneesToAllTargets,
  applyScheduleToAllTargets,
  describeProjectWorkTargetAddition,
  fillMissingProjectWorkTargetDates,
  generateProjectWorkTargets,
  isIsoDate,
  moveProjectWorkTarget,
  normalizeProjectWorkTargetIdentity,
  normalizeProjectWorkTargets,
  previewProjectWorkTargetAddition,
  projectUnitImportToTarget,
  type ProjectUnitImportSource,
  type ProjectWorkTargetDraft,
} from '@/lib/projectWorkPlanBuilder';
import type { OrganizationPerson } from '@/lib/supabase/workManagement';
import type { Project } from '@/types';
import { cn } from '@/lib/utils';

import AssigneeSelect from './AssigneeSelect';
import ProjectUnitImportPanel from './ProjectUnitImportPanel';
import { formatDate } from './workPlanFormatting';

type TargetSource = 'register' | 'sequence' | 'paste';

interface Props {
  project: Project;
  people: OrganizationPerson[];
  planName: string;
  planDescription: string;
  targets: ProjectWorkTargetDraft[];
  unitOptions: ProjectUnitImportSource[];
  unitsLoading: boolean;
  unitsError: string;
  onReloadUnits: () => void;
  onPlanNameChange: (value: string) => void;
  onPlanDescriptionChange: (value: string) => void;
  onTargetsChange: (next: ProjectWorkTargetDraft[]) => void;
}

const MAX_TARGETS = 100;

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function ProjectWorkTargetsStep({
  project,
  people,
  planName,
  planDescription,
  targets,
  unitOptions,
  unitsLoading,
  unitsError,
  onReloadUnits,
  onPlanNameChange,
  onPlanDescriptionChange,
  onTargetsChange,
}: Props) {
  const [source, setSource] = useState<TargetSource | null>(null);
  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(new Set());
  const [sequencePrefix, setSequencePrefix] = useState('Huoneisto');
  const [sequenceStart, setSequenceStart] = useState('1');
  const [sequenceCount, setSequenceCount] = useState('10');
  const [sequenceStaggered, setSequenceStaggered] = useState(true);
  const [sequenceFirstDate, setSequenceFirstDate] = useState(project.startDate || '');
  const [sequenceDuration, setSequenceDuration] = useState('10');
  const [sequenceGap, setSequenceGap] = useState('0');
  const [pasteText, setPasteText] = useState('');
  const [notice, setNotice] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkAssigneeId, setBulkAssigneeId] = useState('');
  const [bulkStartDate, setBulkStartDate] = useState(project.startDate || '');
  const [bulkEndDate, setBulkEndDate] = useState(project.endDate || project.startDate || '');
  const [bulkMessage, setBulkMessage] = useState('');

  const projectDates = useMemo(() => ({
    startDate: project.startDate || '',
    endDate: project.endDate || project.startDate || '',
  }), [project.endDate, project.startDate]);
  const existingIdentities = useMemo(
    () => new Set(targets.map(normalizeProjectWorkTargetIdentity)),
    [targets],
  );
  const availableSlots = Math.max(0, MAX_TARGETS - targets.length);
  const activeSource: TargetSource = source ?? (unitOptions.length > 0 ? 'register' : 'sequence');

  const registerTargets = useMemo(
    () => unitOptions
      .filter((option) => selectedUnitIds.has(option.id))
      .map((option) => projectUnitImportToTarget(option, projectDates)),
    [projectDates, selectedUnitIds, unitOptions],
  );

  const sequenceValues = useMemo(() => ({
    start: Number(sequenceStart),
    count: Number(sequenceCount),
    duration: Number(sequenceDuration),
    gap: Number(sequenceGap),
  }), [sequenceCount, sequenceDuration, sequenceGap, sequenceStart]);

  const sequenceIssues = useMemo(() => {
    const issues: string[] = [];
    if (!Number.isFinite(sequenceValues.start) || sequenceValues.start < 0) {
      issues.push('Ensimmäisen numeron pitää olla 0 tai suurempi.');
    }
    if (!Number.isFinite(sequenceValues.count) || sequenceValues.count < 1 || sequenceValues.count > MAX_TARGETS) {
      issues.push('Kohteiden määrän pitää olla 1–100.');
    }
    if (sequenceStaggered) {
      if (!isIsoDate(sequenceFirstDate)) issues.push('Valitse ensimmäisen kohteen aloituspäivä.');
      if (!Number.isFinite(sequenceValues.duration) || sequenceValues.duration < 1 || sequenceValues.duration > 60) {
        issues.push('Yhden kohteen keston pitää olla 1–60 työpäivää.');
      }
      if (!Number.isFinite(sequenceValues.gap) || sequenceValues.gap < 0 || sequenceValues.gap > 20) {
        issues.push('Kohteiden välisen tauon pitää olla 0–20 työpäivää.');
      }
    }
    return issues;
  }, [sequenceFirstDate, sequenceStaggered, sequenceValues]);

  const sequenceTargets = useMemo(() => {
    if (sequenceIssues.length > 0) return [];
    const generated = generateProjectWorkTargets({
      prefix: sequencePrefix,
      start: sequenceValues.start,
      count: sequenceValues.count,
      firstStartDate: sequenceStaggered ? sequenceFirstDate : '',
      workdayDuration: sequenceStaggered ? sequenceValues.duration : 1,
      gapWorkdays: sequenceStaggered ? sequenceValues.gap : 0,
    });
    return sequenceStaggered
      ? generated
      : applyScheduleToAllTargets(generated, projectDates.startDate, projectDates.endDate);
  }, [
    projectDates,
    sequenceFirstDate,
    sequenceIssues.length,
    sequencePrefix,
    sequenceStaggered,
    sequenceValues,
  ]);

  const pasteTargets = useMemo(
    () => fillMissingProjectWorkTargetDates(
      normalizeProjectWorkTargets(pasteText),
      projectDates.startDate,
      projectDates.endDate,
    ),
    [pasteText, projectDates],
  );

  const pendingTargets = activeSource === 'register'
    ? registerTargets
    : activeSource === 'sequence' ? sequenceTargets : pasteTargets;
  const preview = useMemo(
    () => previewProjectWorkTargetAddition(targets, pendingTargets, MAX_TARGETS),
    [pendingTargets, targets],
  );
  const idleHint = activeSource === 'register'
    ? 'Valitse rekisteristä huoneistot, jotka lisätään kohdelistalle.'
    : activeSource === 'paste'
      ? 'Liitä kohderivit yllä olevaan kenttään, niin näet mitä lisätään.'
      : 'Tarkista numerosarjan tiedot, niin näet mitä lisätään.';

  const sourceOptions: Array<{
    id: TargetSource;
    title: string;
    description: string;
    icon: typeof Building2;
    hint: string;
  }> = [
    {
      id: 'register',
      title: 'Projektin huoneistoista',
      description: 'Poimi valmiit huoneistot projektin kohderekisteristä.',
      icon: Building2,
      hint: unitsLoading
        ? 'Haetaan rekisteriä…'
        : unitOptions.length > 0 ? `${unitOptions.length} huoneistoa rekisterissä` : 'Ei huoneistoja rekisterissä',
    },
    {
      id: 'sequence',
      title: 'Numerosarjana',
      description: 'Muodosta samanlaiset kohteet kerralla, esimerkiksi Huoneisto 1–10.',
      icon: Wand2,
      hint: 'Nopein tapa sarjatuotantoon',
    },
    {
      id: 'paste',
      title: 'Liittämällä lista',
      description: 'Kopioi rivit Excelistä tai muistiinpanoista.',
      icon: ClipboardList,
      hint: 'Yksi kohde per rivi',
    },
  ];

  const chooseSource = (next: TargetSource) => {
    setSource(next);
    setNotice('');
  };

  /** Sarjaa jatketaan seuraavasta numerosta ja päivästä, jotta toinen erä ei törmää kaksoiskappaleisiin. */
  const continueSequenceAfterAdd = () => {
    setSequenceStart(String(sequenceValues.start + sequenceValues.count));
    const lastEnd = sequenceTargets.at(-1)?.endDate ?? '';
    if (sequenceStaggered && isIsoDate(lastEnd)) {
      setSequenceFirstDate(addWorkdays(lastEnd, sequenceValues.gap + 1));
    }
  };

  const addPendingTargets = () => {
    const result = appendProjectWorkTargets(targets, pendingTargets, MAX_TARGETS);
    onTargetsChange(result.targets);
    const parts = [result.addedCount === 1 ? 'Lisättiin 1 kohde.' : `Lisättiin ${result.addedCount} kohdetta.`];
    if (result.duplicateCount > 0) parts.push(`${result.duplicateCount} oli jo listalla.`);
    if (result.limitReached) parts.push('Kohdelistan 100 kohteen raja täyttyi.');
    setNotice(parts.join(' '));
    if (activeSource === 'register') setSelectedUnitIds(new Set());
    if (activeSource === 'paste') setPasteText('');
    if (activeSource === 'sequence') continueSequenceAfterAdd();
  };

  const updateTarget = (id: string, patch: Partial<ProjectWorkTargetDraft>) => {
    onTargetsChange(targets.map((target) => target.id === id ? { ...target, ...patch } : target));
  };

  const addEmptyTarget = () => {
    onTargetsChange([...targets, {
      id: uniqueId('target'),
      key: uniqueId('kohde'),
      title: '',
      location: '',
      description: '',
      startDate: projectDates.startDate,
      endDate: projectDates.endDate,
      assigneeUserIds: [],
    }]);
    setNotice('');
  };

  const applyBulkAssignee = () => {
    if (!bulkAssigneeId) {
      setBulkMessage('Valitse ensin henkilö, joka asetetaan kaikille kohteille.');
      return;
    }
    onTargetsChange(applyAssigneesToAllTargets(targets, [bulkAssigneeId]));
    setBulkMessage(`Oletustekijä asetettiin ${targets.length} kohteelle.`);
  };

  const applyBulkSchedule = () => {
    if (!isIsoDate(bulkStartDate) || !isIsoDate(bulkEndDate) || bulkEndDate < bulkStartDate) {
      setBulkMessage('Anna kelvollinen aloitus- ja tavoitevalmistumispäivä.');
      return;
    }
    onTargetsChange(applyScheduleToAllTargets(targets, bulkStartDate, bulkEndDate));
    setBulkMessage(`Päivät asetettiin ${targets.length} kohteelle.`);
  };

  return (
    <div className="space-y-5">
      <section className="grid gap-4 rounded-2xl border border-slate-200 p-4 sm:grid-cols-2 sm:p-5">
        <div className="space-y-2">
          <Label htmlFor="work-plan-name">Työkokonaisuuden nimi *</Label>
          <Input id="work-plan-name" value={planName} onChange={(event) => onPlanNameChange(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="work-plan-description">Kuvaus</Label>
          <Input
            id="work-plan-description"
            value={planDescription}
            onChange={(event) => onPlanDescriptionChange(event.target.value)}
            placeholder="Esim. Keittiöremontit, 14 huoneistoa"
          />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold">Lisää kohteet</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Valitse yksi tapa kerrallaan. Näet ennen lisäämistä tarkalleen, mitkä kohteet listalle tulevat, ja voit
              käyttää useampaa tapaa peräkkäin.
            </p>
          </div>
          <Badge variant="secondary">{targets.length}/{MAX_TARGETS} kohdetta</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Kohteiden lisäystapa">
          {sourceOptions.map((option) => {
            const selected = activeSource === option.id;
            return (
              <button
                type="button"
                key={option.id}
                aria-pressed={selected}
                onClick={() => chooseSource(option.id)}
                className={cn(
                  'flex h-full flex-col gap-2 rounded-xl border p-4 text-left transition',
                  selected
                    ? 'border-primary bg-primary-light ring-1 ring-primary/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                <span className="flex items-center gap-2">
                  <span className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                    selected ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600',
                  )}>
                    <option.icon size={18} />
                  </span>
                  <span className="min-w-0 break-words font-semibold">{option.title}</span>
                </span>
                <span className="break-words text-sm text-text-secondary">{option.description}</span>
                <span className="mt-auto break-words text-xs font-medium text-text-muted">{option.hint}</span>
              </button>
            );
          })}
        </div>

        {activeSource === 'register' && (
          <ProjectUnitImportPanel
            options={unitOptions}
            loading={unitsLoading}
            error={unitsError}
            projectDates={projectDates}
            existingIdentities={existingIdentities}
            selectedIds={selectedUnitIds}
            availableSlots={availableSlots}
            onSelectedIdsChange={setSelectedUnitIds}
            onReload={onReloadUnits}
          />
        )}

        {activeSource === 'sequence' && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="sequence-prefix">Nimen alku</Label>
                <Input id="sequence-prefix" value={sequencePrefix} onChange={(event) => setSequencePrefix(event.target.value)} placeholder="Huoneisto" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sequence-start">Ensimmäinen numero</Label>
                <Input id="sequence-start" type="number" min={0} value={sequenceStart} onChange={(event) => setSequenceStart(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sequence-count">Montako kohdetta</Label>
                <Input id="sequence-count" type="number" min={1} max={MAX_TARGETS} value={sequenceCount} onChange={(event) => setSequenceCount(event.target.value)} />
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <Checkbox
                className="mt-0.5"
                checked={sequenceStaggered}
                onCheckedChange={(checked) => setSequenceStaggered(checked === true)}
              />
              <span className="min-w-0">
                <span className="block font-medium">Kohteet tehdään peräkkäin</span>
                <span className="mt-1 block break-words text-sm text-text-secondary">
                  Jokainen kohde saa oman aloituspäivänsä edellisen jälkeen ja viikonloput ohitetaan. Ilman valintaa
                  kaikki kohteet saavat projektin aikataulun.
                </span>
              </span>
            </label>

            {sequenceStaggered && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="sequence-first-date">Ensimmäinen aloituspäivä</Label>
                  <Input id="sequence-first-date" type="date" value={sequenceFirstDate} onChange={(event) => setSequenceFirstDate(event.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sequence-duration">Yhden kohteen kesto (työpäivää)</Label>
                  <Input id="sequence-duration" type="number" min={1} max={60} value={sequenceDuration} onChange={(event) => setSequenceDuration(event.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sequence-gap">Tauko kohteiden välissä (työpäivää)</Label>
                  <Input id="sequence-gap" type="number" min={0} max={20} value={sequenceGap} onChange={(event) => setSequenceGap(event.target.value)} />
                </div>
              </div>
            )}

            {sequenceIssues.length > 0 && (
              <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {sequenceIssues.map((issue) => <p key={issue} className="break-words">• {issue}</p>)}
              </div>
            )}
          </div>
        )}

        {activeSource === 'paste' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="target-paste">Liitä kohderivit</Label>
              <Textarea
                id="target-paste"
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
                rows={6}
                placeholder={'A1 | 1. kerros | Keittiö + vinyyli | 3.8.2026 | 14.8.2026\nA2 | 1. kerros | Vain keittiö'}
              />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-text-secondary">
              <p className="break-words">
                Yksi kohde per rivi. Sarakkeet erotellaan sarkaimella (suora Excel-liitos), pystyviivalla | tai
                puolipisteellä.
              </p>
              <p className="mt-2 break-words">
                Järjestys on: kohteen nimi, sijainti, työseloste, aloituspäivä, tavoitepäivä. Vain nimi on pakollinen –
                puuttuvat päivät täytetään projektin aikataululla ja päivämäärän voi kirjoittaa muodossa 3.8.2026 tai
                2026-08-03.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="break-words font-semibold">
              {pendingTargets.length === 0 ? idleHint : describeProjectWorkTargetAddition(preview)}
            </p>
            {preview.added.length > 0 && (
              <ul className="grid max-h-64 gap-1 overflow-y-auto pr-1 text-sm sm:grid-cols-2 xl:grid-cols-3">
                {preview.added.map((target) => (
                  <li key={target.id} className="break-words rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <span className="font-medium">{target.title}</span>
                    {target.location && target.location !== target.title && (
                      <span className="text-text-secondary"> · {target.location}</span>
                    )}
                    <span className="text-text-secondary"> · {formatDate(target.startDate)}–{formatDate(target.endDate)}</span>
                    {target.description && <span className="block text-xs text-text-secondary">{target.description}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button type="button" className="lg:shrink-0" disabled={preview.addedCount === 0} onClick={addPendingTargets}>
            <Plus size={16} className="mr-2" />
            {preview.addedCount > 0 ? `Lisää ${preview.addedCount} kohdetta listaan` : 'Lisää kohteet listaan'}
          </Button>
        </div>

        {notice && (
          <p role="status" className="break-words rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            {notice}
          </p>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold">Kohdelista</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Työt määritetään seuraavassa vaiheessa erikseen jokaiselle kohteelle.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {targets.length > 1 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setBulkOpen((current) => !current)} aria-expanded={bulkOpen}>
                <SlidersHorizontal size={16} className="mr-1.5" /> Aseta kaikille kerralla
                {bulkOpen ? <ChevronUp size={16} className="ml-1.5" /> : <ChevronDown size={16} className="ml-1.5" />}
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" disabled={availableSlots === 0} onClick={addEmptyTarget}>
              <Plus size={16} className="mr-1.5" /> Lisää tyhjä kohde
            </Button>
          </div>
        </div>

        {targets.length > 1 && bulkOpen && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm text-text-secondary">Muutos koskee kaikkia {targets.length} kohdetta.</p>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[200px] flex-1 space-y-1">
                  <Label className="text-xs">Oletustekijä kaikille</Label>
                  <Select value={bulkAssigneeId || undefined} onValueChange={setBulkAssigneeId}>
                    <SelectTrigger><SelectValue placeholder="Valitse henkilö" /></SelectTrigger>
                    <SelectContent>
                      {people.map((person) => <SelectItem key={person.userId} value={person.userId}>{person.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" variant="secondary" onClick={applyBulkAssignee}>
                  <Users size={16} className="mr-2" /> Aseta tekijä
                </Button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[140px] flex-1 space-y-1">
                  <Label className="text-xs">Yhteinen aloitus</Label>
                  <Input type="date" value={bulkStartDate} onChange={(event) => setBulkStartDate(event.target.value)} />
                </div>
                <div className="min-w-[140px] flex-1 space-y-1">
                  <Label className="text-xs">Yhteinen tavoite</Label>
                  <Input type="date" min={bulkStartDate || undefined} value={bulkEndDate} onChange={(event) => setBulkEndDate(event.target.value)} />
                </div>
                <Button type="button" variant="secondary" onClick={applyBulkSchedule}>
                  <CalendarDays size={16} className="mr-2" /> Aseta päivät
                </Button>
              </div>
            </div>
            {bulkMessage && <p role="status" className="break-words text-sm text-text-secondary">{bulkMessage}</p>}
          </div>
        )}

        {targets.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-sm text-text-secondary">
            Kohdelista on vielä tyhjä. Valitse yllä lisäystapa ja lisää ensimmäiset kohteet.
          </div>
        ) : (
          <div className="space-y-3">
            {targets.map((target, index) => (
              <article key={target.id} className="space-y-3 rounded-xl border border-slate-200 p-3">
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                      {index + 1}
                    </span>
                    <p className="min-w-0 break-words font-semibold">{target.title || `Kohde ${index + 1}`}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={index === 0}
                      onClick={() => onTargetsChange(moveProjectWorkTarget(targets, target.id, -1))}
                      aria-label={`Siirrä ${target.title || `kohde ${index + 1}`} ylös`}
                    >
                      <ArrowUp size={16} />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={index === targets.length - 1}
                      onClick={() => onTargetsChange(moveProjectWorkTarget(targets, target.id, 1))}
                      aria-label={`Siirrä ${target.title || `kohde ${index + 1}`} alas`}
                    >
                      <ArrowDown size={16} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      onClick={() => onTargetsChange(targets.filter((item) => item.id !== target.id))}
                      aria-label={`Poista ${target.title || `kohde ${index + 1}`}`}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </header>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Kohde *</Label>
                    <Input value={target.title} onChange={(event) => updateTarget(target.id, { title: event.target.value })} placeholder="A1" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Sijainti</Label>
                    <Input value={target.location} onChange={(event) => updateTarget(target.id, { location: event.target.value })} placeholder="1. kerros" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Aikaisin aloitus *</Label>
                    <Input type="date" value={target.startDate} onChange={(event) => updateTarget(target.id, { startDate: event.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tavoite valmis *</Label>
                    <Input type="date" min={target.startDate || undefined} value={target.endDate} onChange={(event) => updateTarget(target.id, { endDate: event.target.value })} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(200px,260px)]">
                  <div className="space-y-1">
                    <Label className="text-xs">Kohteen työseloste</Label>
                    <Input
                      value={target.description}
                      onChange={(event) => updateTarget(target.id, { description: event.target.value })}
                      placeholder="Esim. Keittiö + vinyyli, ei kylpyhuonetta"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Oletustekijä</Label>
                    <AssigneeSelect
                      value={target.assigneeUserIds}
                      people={people}
                      fallbackText="Työkohtainen"
                      onChange={(value) => updateTarget(target.id, { assigneeUserIds: value })}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
