import { useEffect, useMemo, useState } from 'react';
import { Building2, ClipboardCheck, Home, Loader2, Wrench, type LucideIcon } from 'lucide-react';

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
import { todayIso } from './inspectionUi';

interface ProjectOption { id: string; name: string }

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
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const firstProject = projects[0];
    const firstTemplate = templates[0];
    setProjectId(firstProject?.id ?? '');
    setTemplateVersionId(firstTemplate?.versionId ?? '');
    setTitle(firstTemplate?.name ?? '');
    setScheduledDate(todayIso());
    setInspectorId(currentUserId ?? '');
    setSelectedUnitIds([]);
    setError(null);
  }, [currentUserId, open, projects, templates]);

  const projectUnits = useMemo(
    () => units.filter((unit) => unit.projectId === projectId),
    [projectId, units],
  );

  const selectedTemplate = templates.find((template) => template.versionId === templateVersionId);

  const chooseTemplate = (template: InspectionTemplateSummary) => {
    setTemplateVersionId(template.versionId);
    setTitle(template.name);
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
    if (!projectId || !templateVersionId || !title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const ids = await createInspections({
        organizationId,
        projectId,
        unitIds: selectedUnitIds.length ? selectedUnitIds : [undefined],
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
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Uusi tarkastus tai itselleluovutus</DialogTitle>
          <p className="text-sm text-text-secondary">Valitse työn laajuuteen sopiva tarkastuspohja. Pohja määrää tarkastettavat työvaiheet ja luovutuksen hyväksyntäehdot.</p>
        </DialogHeader>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

        <div className="space-y-3">
          <Label>1. Valitse tarkastuspohja *</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map((template) => {
              const Icon = templateIcon(template);
              const selected = template.versionId === templateVersionId;
              return (
                <button
                  key={template.versionId}
                  type="button"
                  onClick={() => chooseTemplate(template)}
                  className={cn(
                    'rounded-xl border p-4 text-left transition',
                    selected
                      ? 'border-primary bg-primary-light shadow-sm ring-1 ring-primary/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', selected ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600')}><Icon size={19} /></span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{template.name}</p><span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] text-text-muted">v{template.version}</span></div>
                      <p className="mt-1 text-xs font-medium text-primary">{template.category}</p>
                      <p className="mt-2 text-sm text-text-secondary">{template.description || 'Organisaation tarkastuspohja.'}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {templates.length === 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Julkaistuja tarkastuspohjia ei löytynyt. Julkaise pohja ennen tarkastuksen luontia.</div>}
        </div>

        <div className="grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2">
          <div>
            <Label>2. Projekti *</Label>
            <Select value={projectId} onValueChange={(value) => { setProjectId(value); setSelectedUnitIds([]); }}>
              <SelectTrigger><SelectValue placeholder="Valitse projekti" /></SelectTrigger>
              <SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Tarkastuksen päivä</Label><Input type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Tarkastuksen nimi *</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={selectedTemplate?.name || 'Itselleluovutus'} /></div>
          <div className="sm:col-span-2">
            <Label>Tarkastuksen suorittaja</Label>
            <Select value={inspectorId || 'none'} onValueChange={(value) => setInspectorId(value === 'none' ? '' : value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ei nimetty</SelectItem>
                {people.filter((person) => ['admin', 'supervisor'].includes(person.role)).map((person) => <SelectItem key={person.userId} value={person.userId}>{person.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-semibold">3. Kohde tai huoneistot</p><p className="text-xs text-text-secondary">Valitse yksi tai useampi huoneisto. Ilman valintaa tarkastus luodaan koko kohteelle.</p></div>
            {projectUnits.length > 0 && <label className="flex items-center gap-2 text-sm"><Checkbox checked={selectedUnitIds.length === projectUnits.length} onCheckedChange={(value) => selectAll(value === true)} />Valitse kaikki</label>}
          </div>
          <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
            {projectUnits.map((unit) => (
              <label key={unit.id} className="flex cursor-pointer items-center gap-3 p-3 hover:bg-slate-50">
                <Checkbox checked={selectedUnitIds.includes(unit.id)} onCheckedChange={(value) => toggleUnit(unit.id, value === true)} />
                <div className="min-w-0 flex-1"><p className="font-medium">{unit.unitCode}</p><p className="truncate text-xs text-text-secondary">{unit.unitType || 'Huoneistotyyppi puuttuu'} · {unit.status}</p></div>
                {unit.plannedCompletionDate && <span className="text-xs text-text-muted">Luovutus {unit.plannedCompletionDate}</span>}
              </label>
            ))}
            {projectUnits.length === 0 && <p className="p-4 text-sm text-text-secondary">Projektilla ei ole huoneistorekisteriä. Tarkastus luodaan koko kohteelle.</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Peruuta</Button>
          <Button disabled={saving || !projectId || !templateVersionId || !title.trim()} onClick={() => void submit()}>
            {saving && <Loader2 size={16} className="mr-2 animate-spin" />}
            Luo {selectedUnitIds.length > 1 ? `${selectedUnitIds.length} tarkastusta` : 'tarkastus'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
