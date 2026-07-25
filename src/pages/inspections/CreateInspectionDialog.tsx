import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

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
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Luo tarkastus tai itselleluovutus</DialogTitle></DialogHeader>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Projekti *</Label>
            <Select value={projectId} onValueChange={(value) => { setProjectId(value); setSelectedUnitIds([]); }}>
              <SelectTrigger><SelectValue placeholder="Valitse projekti" /></SelectTrigger>
              <SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tarkastuspohja *</Label>
            <Select value={templateVersionId} onValueChange={(value) => {
              setTemplateVersionId(value);
              const template = templates.find((item) => item.versionId === value);
              if (template) setTitle(template.name);
            }}>
              <SelectTrigger><SelectValue placeholder="Valitse pohja" /></SelectTrigger>
              <SelectContent>{templates.map((template) => <SelectItem key={template.versionId} value={template.versionId}>{template.name} · v{template.version}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2"><Label>Tarkastuksen nimi *</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} /></div>
          <div><Label>Suunniteltu päivä</Label><Input type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} /></div>
          <div>
            <Label>Tarkastaja</Label>
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
          <div className="flex items-center justify-between border-b border-slate-200 p-3">
            <div><p className="font-semibold">Huoneistot</p><p className="text-xs text-text-secondary">Ilman valintaa tarkastus luodaan koko kohteelle.</p></div>
            {projectUnits.length > 0 && <label className="flex items-center gap-2 text-sm"><Checkbox checked={selectedUnitIds.length === projectUnits.length} onCheckedChange={(value) => selectAll(value === true)} />Valitse kaikki</label>}
          </div>
          <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
            {projectUnits.map((unit) => (
              <label key={unit.id} className="flex cursor-pointer items-center gap-3 p-3 hover:bg-slate-50">
                <Checkbox checked={selectedUnitIds.includes(unit.id)} onCheckedChange={(value) => toggleUnit(unit.id, value === true)} />
                <div className="min-w-0"><p className="font-medium">{unit.unitCode}</p><p className="truncate text-xs text-text-secondary">{unit.unitType || 'Huoneistotyyppi puuttuu'} · {unit.status}</p></div>
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
