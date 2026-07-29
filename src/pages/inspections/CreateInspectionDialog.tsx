import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Home,
  Layers3,
  Loader2,
  Search,
  UserRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  createInspections, type InspectionTemplateSummary, type OrganizationPerson,
  type ProjectUnit,
} from '@/lib/supabase/inspectionEntities';
import { cn } from '@/lib/utils';
import { formatDate, todayIso } from './inspectionUi';

interface ProjectOption { id: string; name: string }
type TargetScope = 'project' | 'units';

interface Props {
  open: boolean;
  organizationId: string;
  currentUserId?: string;
  projects: ProjectOption[];
  templates: InspectionTemplateSummary[];
  units: ProjectUnit[];
  people: OrganizationPerson[];
  onClose: () => void;
  onCreated: (ids: string[]) => Promise<void>;
}

function templateIcon(template: InspectionTemplateSummary): LucideIcon {
  const text = `${template.name} ${template.category}`.toLocaleLowerCase('fi');
  if (text.includes('keittiö')) return Home;
  if (text.includes('kylpy') || text.includes('märkä')) return Wrench;
  if (text.includes('huoneisto')) return Building2;
  return ClipboardCheck;
}

export default function CreateInspectionDialog({
  open, organizationId, currentUserId, projects, templates, units, people,
  onClose, onCreated,
}: Props) {
  const [projectId, setProjectId] = useState('');
  const [templateVersionId, setTemplateVersionId] = useState('');
  const [title, setTitle] = useState('');
  const [scheduledDate, setScheduledDate] = useState(todayIso());
  const [inspectorId, setInspectorId] = useState(currentUserId ?? '');
  const [targetScope, setTargetScope] = useState<TargetScope>('project');
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [unitSearch, setUnitSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onlyProject = projects.length === 1 ? projects[0] : undefined;
    const onlyTemplate = templates.length === 1 ? templates[0] : undefined;
    setProjectId(onlyProject?.id ?? '');
    setTemplateVersionId(onlyTemplate?.versionId ?? '');
    setTitle(onlyTemplate?.name ?? '');
    setScheduledDate(todayIso());
    setInspectorId(currentUserId ?? '');
    setTargetScope('project');
    setSelectedUnitIds([]);
    setTemplateSearch('');
    setUnitSearch('');
    setError(null);
  }, [currentUserId, open, projects, templates]);

  const projectUnits = useMemo(
    () => units.filter((unit) => unit.projectId === projectId),
    [projectId, units],
  );

  useEffect(() => {
    if (targetScope === 'units' && projectUnits.length === 0) setTargetScope('project');
  }, [projectUnits.length, targetScope]);

  const selectedTemplate = templates.find((template) => template.versionId === templateVersionId);
  const selectedProject = projects.find((project) => project.id === projectId);
  const selectedInspector = people.find((person) => person.userId === inspectorId);
  const templateQuery = templateSearch.trim().toLocaleLowerCase('fi');
  const unitQuery = unitSearch.trim().toLocaleLowerCase('fi');
  const filteredTemplates = templates.filter((template) => (
    !templateQuery
    || `${template.name} ${template.category} ${template.description}`.toLocaleLowerCase('fi').includes(templateQuery)
  ));
  const filteredUnits = projectUnits.filter((unit) => (
    !unitQuery
    || `${unit.unitCode} ${unit.unitType} ${unit.floor} ${unit.status}`.toLocaleLowerCase('fi').includes(unitQuery)
  ));
  const allProjectUnitsSelected = projectUnits.length > 0 && selectedUnitIds.length === projectUnits.length;
  const createCount = targetScope === 'units' ? selectedUnitIds.length : 1;
  const targetValid = targetScope === 'project' || selectedUnitIds.length > 0;
  const valid = Boolean(projectId && templateVersionId && title.trim() && targetValid);

  const chooseTemplate = (template: InspectionTemplateSummary) => {
    setTemplateVersionId(template.versionId);
    setTitle(template.name);
  };

  const chooseProject = (value: string) => {
    setProjectId(value);
    setTargetScope('project');
    setSelectedUnitIds([]);
    setUnitSearch('');
  };

  const chooseScope = (scope: TargetScope) => {
    setTargetScope(scope);
    if (scope === 'project') setSelectedUnitIds([]);
  };

  const toggleUnit = (unitId: string, checked: boolean) => {
    setSelectedUnitIds((previous) => checked
      ? [...new Set([...previous, unitId])]
      : previous.filter((id) => id !== unitId));
  };

  const selectAll = (checked: boolean) => {
    setSelectedUnitIds(checked ? projectUnits.map((unit) => unit.id) : []);
  };

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const ids = await createInspections({
        organizationId,
        projectId,
        unitIds: targetScope === 'units' ? selectedUnitIds : [undefined],
        templateVersionId,
        title,
        scheduledDate,
        inspectorId: inspectorId || undefined,
      });
      await onCreated(ids);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tarkastusten luonti epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Uusi tarkastus</DialogTitle>
          <p className="text-sm text-text-secondary">
            Valitse pohja, projekti ja tarkastuksen kohdistus. Koko projektin tarkastus ja huoneistokohtaiset tarkastukset ovat eri valintoja.
          </p>
        </DialogHeader>

        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Label>1. Tarkastuspohja *</Label>
              <p className="mt-1 text-xs text-text-secondary">Pohja määrää tarkastuskohdat, ohjeet ja kuvavaatimukset.</p>
            </div>
            {templates.length > 4 && (
              <div className="relative w-full sm:w-72">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <Input value={templateSearch} onChange={(event) => setTemplateSearch(event.target.value)} className="pl-9" placeholder="Hae tarkastuspohjaa…" />
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {filteredTemplates.map((template) => {
              const Icon = templateIcon(template);
              const selected = template.versionId === templateVersionId;
              return (
                <button
                  key={template.versionId}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => chooseTemplate(template)}
                  className={cn(
                    'rounded-xl border p-4 text-left transition',
                    selected
                      ? 'border-primary bg-primary-light shadow-sm ring-1 ring-primary/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', selected ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600')}>
                      <Icon size={19} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{template.name}</p>
                        <Badge variant="outline">v{template.version}</Badge>
                        {selected && <CheckCircle2 size={16} className="text-primary" />}
                      </div>
                      <p className="mt-1 text-xs font-medium text-primary">{template.category}</p>
                      <p className="mt-2 text-sm text-text-secondary">{template.description || 'Organisaation tarkastuspohja.'}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {templates.length === 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Julkaistuja tarkastuspohjia ei löytynyt. Julkaise pohja ennen tarkastuksen luontia.</div>}
          {templates.length > 0 && filteredTemplates.length === 0 && <div className="rounded-xl border border-slate-200 p-4 text-sm text-text-secondary">Haulla ei löytynyt tarkastuspohjia.</div>}
        </section>

        <section className="grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2">
          <div>
            <Label>2. Projekti *</Label>
            <Select value={projectId} onValueChange={chooseProject}>
              <SelectTrigger><SelectValue placeholder="Valitse projekti" /></SelectTrigger>
              <SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tarkastuksen päivä</Label>
            <Input type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Tarkastuksen nimi *</Label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={selectedTemplate?.name || 'Itselleluovutus'} />
          </div>
          <div className="sm:col-span-2">
            <Label>Tarkastuksen suorittaja</Label>
            <Select value={inspectorId || 'none'} onValueChange={(value) => setInspectorId(value === 'none' ? '' : value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ei nimetty</SelectItem>
                {people.filter((person) => ['admin', 'supervisor', 'project_coordinator'].includes(person.role)).map((person) => (
                  <SelectItem key={person.userId} value={person.userId}>{person.name || person.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="space-y-3 border-t border-slate-200 pt-5">
          <div>
            <Label>3. Kohdistus *</Label>
            <p className="mt-1 text-xs text-text-secondary">Valitse tietoisesti, tehdäänkö yksi tarkastus koko projektille vai erillinen tarkastus valituille huoneistoille.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={!projectId}
              aria-pressed={targetScope === 'project'}
              onClick={() => chooseScope('project')}
              className={cn(
                'rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50',
                targetScope === 'project' ? 'border-primary bg-primary-light ring-1 ring-primary/20' : 'border-slate-200 hover:bg-slate-50',
              )}
            >
              <div className="flex items-start gap-3"><Layers3 size={20} className="mt-0.5 shrink-0 text-primary" /><div><p className="font-semibold">Koko projekti</p><p className="mt-1 text-sm text-text-secondary">Luo yksi tarkastus, joka koskee koko projektia.</p></div></div>
            </button>
            <button
              type="button"
              disabled={!projectId || projectUnits.length === 0}
              aria-pressed={targetScope === 'units'}
              onClick={() => chooseScope('units')}
              className={cn(
                'rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50',
                targetScope === 'units' ? 'border-primary bg-primary-light ring-1 ring-primary/20' : 'border-slate-200 hover:bg-slate-50',
              )}
            >
              <div className="flex items-start gap-3"><Building2 size={20} className="mt-0.5 shrink-0 text-primary" /><div><p className="font-semibold">Valitut huoneistot</p><p className="mt-1 text-sm text-text-secondary">Luo jokaiselle valitulle huoneistolle oma tarkastus.</p></div></div>
            </button>
          </div>

          {projectId && projectUnits.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-text-secondary">
              Projektilla ei ole huoneistorekisteriä, joten tarkastus voidaan kohdistaa vain koko projektiin.
            </div>
          )}

          {targetScope === 'units' && (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">Valitse huoneistot</p>
                  <p className="text-xs text-text-secondary">{selectedUnitIds.length}/{projectUnits.length} valittu</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {projectUnits.length > 6 && (
                    <div className="relative sm:w-64">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                      <Input value={unitSearch} onChange={(event) => setUnitSearch(event.target.value)} className="pl-9" placeholder="Hae huoneistoa…" />
                    </div>
                  )}
                  <label className="flex min-h-10 items-center gap-2 text-sm">
                    <Checkbox checked={allProjectUnitsSelected} onCheckedChange={(value) => selectAll(value === true)} /> Valitse kaikki
                  </label>
                </div>
              </div>
              <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                {filteredUnits.map((unit) => (
                  <label key={unit.id} className="flex cursor-pointer items-center gap-3 p-3 hover:bg-slate-50">
                    <Checkbox checked={selectedUnitIds.includes(unit.id)} onCheckedChange={(value) => toggleUnit(unit.id, value === true)} />
                    <div className="min-w-0 flex-1 break-words">
                      <p className="font-medium">{unit.unitCode}</p>
                      <p className="text-xs text-text-secondary">{unit.unitType || 'Huoneistotyyppi puuttuu'}{unit.floor ? ` · kerros ${unit.floor}` : ''} · {unit.status}</p>
                    </div>
                    {unit.plannedCompletionDate && <span className="hidden text-xs text-text-muted sm:block">Luovutus {formatDate(unit.plannedCompletionDate)}</span>}
                  </label>
                ))}
                {filteredUnits.length === 0 && <p className="p-4 text-sm text-text-secondary">Haulla ei löytynyt huoneistoja.</p>}
              </div>
            </div>
          )}
        </section>

        <div className={cn(
          'rounded-xl border p-4',
          valid ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-slate-50/70',
        )}>
          <div className="flex items-start gap-3">
            <CheckCircle2 size={19} className={cn('mt-0.5 shrink-0', valid ? 'text-emerald-700' : 'text-slate-400')} />
            <div className="min-w-0">
              <p className="font-semibold">Luonnin yhteenveto</p>
              <div className="mt-2 grid gap-2 text-sm text-text-secondary sm:grid-cols-2">
                <span className="flex items-center gap-2"><ClipboardCheck size={15} />{selectedTemplate?.name || 'Valitse tarkastuspohja'}</span>
                <span className="flex items-center gap-2"><Building2 size={15} />{selectedProject?.name || 'Valitse projekti'}</span>
                <span className="flex items-center gap-2"><Layers3 size={15} />{targetScope === 'project' ? 'Yksi tarkastus koko projektille' : `${selectedUnitIds.length} huoneistokohtaista tarkastusta`}</span>
                <span className="flex items-center gap-2"><CalendarDays size={15} />{formatDate(scheduledDate)}</span>
                <span className="flex items-center gap-2 sm:col-span-2"><UserRound size={15} />{selectedInspector?.name || selectedInspector?.email || 'Tarkastajaa ei ole nimetty'}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={onClose}>Peruuta</Button>
          <Button disabled={saving || !valid} onClick={() => void submit()}>
            {saving && <Loader2 size={16} className="mr-2 animate-spin" />}
            Luo {createCount > 1 ? `${createCount} tarkastusta` : 'tarkastus'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
