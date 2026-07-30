from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


root = Path(__file__).resolve().parents[1]
builder = root / 'src/lib/projectWorkPlanBuilder.ts'
dialog = root / 'src/pages/projectWorks/ProjectWorkPlanDialog/TargetFirstProjectWorkPlanDialog.tsx'
tests = root / 'src/lib/__tests__/projectWorkPlanBuilder.test.ts'

replace_once(
    builder,
    "export interface ProjectWorkPhaseDraft {\n",
    """export interface ProjectUnitImportSource {
  id: string;
  unitCode: string;
  buildingName?: string;
  stairwellName?: string;
  floor?: string;
  unitType?: string;
  areaM2?: number;
  renovationScope?: string;
  plannedCompletionDate?: string;
  notes?: string;
}

export interface AppendProjectWorkTargetsResult {
  targets: ProjectWorkTargetDraft[];
  addedCount: number;
  duplicateCount: number;
  limitReached: boolean;
}

export interface ProjectWorkPhaseDraft {
""",
)

replace_once(
    builder,
    """export function normalizeProjectWorkTargets(value: string): ProjectWorkTargetDraft[] {
""",
    """export function normalizeProjectWorkTargetIdentity(
  target: Pick<ProjectWorkTargetDraft, 'title' | 'location'>,
): string {
  const normalize = (value: string) => value
    .normalize('NFKC')
    .trim()
    .replace(/\\s+/g, ' ')
    .toLocaleLowerCase('fi');
  const title = normalize(target.title);
  const location = normalize(target.location || target.title);
  return `${title}|${location}`;
}

export function projectUnitImportToTarget(
  unit: ProjectUnitImportSource,
  projectDates: { startDate: string; endDate: string },
): ProjectWorkTargetDraft {
  const floor = unit.floor?.trim();
  const location = [
    unit.buildingName?.trim(),
    unit.stairwellName?.trim(),
    floor ? (/kerros/i.test(floor) ? floor : `${floor}. kerros`) : '',
  ].filter(Boolean).join(' · ') || unit.unitCode.trim();
  const details = [
    unit.renovationScope?.trim(),
    unit.unitType?.trim(),
    Number.isFinite(unit.areaM2) ? `${unit.areaM2} m²` : '',
    unit.notes?.trim(),
  ].filter(Boolean).join(' · ');
  return {
    id: `unit-${unit.id}`,
    key: `unit-${unit.id}`,
    title: unit.unitCode.trim(),
    location,
    description: details,
    startDate: projectDates.startDate,
    endDate: unit.plannedCompletionDate || projectDates.endDate || projectDates.startDate,
    assigneeUserIds: [],
  };
}

export function appendProjectWorkTargets(
  current: ProjectWorkTargetDraft[],
  incoming: ProjectWorkTargetDraft[],
  maxTargets = 100,
): AppendProjectWorkTargetsResult {
  const limit = Math.min(100, Math.max(0, Math.floor(maxTargets)));
  const targets = [...current];
  const seen = new Set(current.map(normalizeProjectWorkTargetIdentity));
  const usedIds = new Set(current.map((target) => target.id));
  let addedCount = 0;
  let duplicateCount = 0;
  let limitReached = current.length >= limit;

  for (const target of incoming) {
    const identity = normalizeProjectWorkTargetIdentity(target);
    if (!target.title.trim() || seen.has(identity)) {
      duplicateCount += 1;
      continue;
    }
    if (targets.length >= limit) {
      limitReached = true;
      break;
    }

    const index = targets.length;
    const baseId = target.id.trim() || `target-${index}`;
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    seen.add(identity);

    const keyTail = (target.key.trim() || normalizedKey(target.title, index)).replace(/^\\d+-/, '');
    targets.push({
      ...target,
      id,
      key: `${String(index + 1).padStart(3, '0')}-${keyTail || 'kohde'}`,
      assigneeUserIds: [...target.assigneeUserIds],
    });
    addedCount += 1;
  }

  return { targets, addedCount, duplicateCount, limitReached };
}

export function moveProjectWorkTarget(
  targets: ProjectWorkTargetDraft[],
  targetIdValue: string,
  direction: -1 | 1,
): ProjectWorkTargetDraft[] {
  const index = targets.findIndex((target) => target.id === targetIdValue);
  const destination = index + direction;
  if (index < 0 || destination < 0 || destination >= targets.length) return targets;
  const reordered = [...targets];
  [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
  return reordered;
}

export function normalizeProjectWorkTargets(value: string): ProjectWorkTargetDraft[] {
""",
)

replace_once(
    builder,
    """    const duplicateKey = `${title}|${location}|${description}`.toLocaleLowerCase('fi');
""",
    """    const duplicateKey = normalizeProjectWorkTargetIdentity({ title, location });
""",
)

replace_once(
    dialog,
    """  ArrowLeft,
  ArrowRight,
""",
    """  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
""",
)

replace_once(
    dialog,
    """  applyAssigneesToAllTargets,
  applyScheduleToAllTargets,
""",
    """  appendProjectWorkTargets,
  applyAssigneesToAllTargets,
  applyScheduleToAllTargets,
""",
)

replace_once(
    dialog,
    """  normalizeProjectWorkTargets,
  resolveWorkItemAssignees,
""",
    """  moveProjectWorkTarget,
  normalizeProjectWorkTargets,
  resolveWorkItemAssignees,
""",
)

replace_once(
    dialog,
    """import type { OrganizationPerson } from '@/lib/supabase/workManagement';
""",
    """import type { OrganizationPerson } from '@/lib/supabase/workManagement';
import ProjectUnitImportPanel from './ProjectUnitImportPanel';
""",
)

replace_once(
    dialog,
    """  const appendTargets = (next: ProjectWorkTargetDraft[]) => {
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
          key: `${String(merged.length + 1).padStart(3, '0')}-${target.key.replace(/^\\d+-/, '')}`,
        });
        if (merged.length >= 100) break;
      }
      return merged;
    });
  };
""",
    """  const appendTargets = (next: ProjectWorkTargetDraft[]) => {
    const result = appendProjectWorkTargets(targets, next, 100);
    setTargets(result.targets);
    return result;
  };

  const moveTarget = (targetId: string, direction: -1 | 1) => {
    setTargets((current) => moveProjectWorkTarget(current, targetId, direction));
  };
""",
)

replace_once(
    dialog,
    """            <section className="grid gap-4 lg:grid-cols-2">
""",
    """            <ProjectUnitImportPanel
              organizationId={organizationId}
              project={project}
              currentTargets={targets}
              onImport={appendTargets}
            />

            <section className="grid gap-4 lg:grid-cols-2">
""",
)

replace_once(
    dialog,
    """                    <div key={target.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 lg:grid-cols-[48px_1fr_1fr_150px_150px_180px_40px] lg:items-end">
""",
    """                    <div key={target.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 lg:grid-cols-[48px_1fr_1fr_150px_150px_180px_96px_40px] lg:items-end">
""",
)

replace_once(
    dialog,
    """                      <div className="space-y-1"><Label className="text-xs">Oletustekijä</Label><AssigneeSelect value={target.assigneeUserIds} people={availablePeople} fallbackText="Työkohtainen" onChange={(value) => updateTarget(target.id, { assigneeUserIds: value })} /></div>
                      <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={() => setTargets((current) => current.filter((item) => item.id !== target.id))} aria-label="Poista kohde"><Trash2 size={16} /></Button>
                      <div className="space-y-1 lg:col-start-2 lg:col-span-5"><Label className="text-xs">Kohteen työseloste</Label><Input value={target.description} onChange={(event) => updateTarget(target.id, { description: event.target.value })} placeholder="Esim. Keittiö + vinyyli, ei kylpyhuonetta" /></div>
""",
    """                      <div className="space-y-1"><Label className="text-xs">Oletustekijä</Label><AssigneeSelect value={target.assigneeUserIds} people={availablePeople} fallbackText="Työkohtainen" onChange={(value) => updateTarget(target.id, { assigneeUserIds: value })} /></div>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={() => moveTarget(target.id, -1)} aria-label={`Siirrä ${target.title || `kohde ${index + 1}`} ylös`}><ArrowUp size={16} /></Button>
                        <Button type="button" variant="outline" size="sm" disabled={index === targets.length - 1} onClick={() => moveTarget(target.id, 1)} aria-label={`Siirrä ${target.title || `kohde ${index + 1}`} alas`}><ArrowDown size={16} /></Button>
                      </div>
                      <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={() => setTargets((current) => current.filter((item) => item.id !== target.id))} aria-label="Poista kohde"><Trash2 size={16} /></Button>
                      <div className="space-y-1 lg:col-start-2 lg:col-span-6"><Label className="text-xs">Kohteen työseloste</Label><Input value={target.description} onChange={(event) => updateTarget(target.id, { description: event.target.value })} placeholder="Esim. Keittiö + vinyyli, ei kylpyhuonetta" /></div>
""",
)

replace_once(
    tests,
    """  applyAssigneesToAllTargets,
""",
    """  appendProjectWorkTargets,
  applyAssigneesToAllTargets,
""",
)

replace_once(
    tests,
    """  normalizeProjectWorkTargets,
  projectWorkPlanSize,
""",
    """  moveProjectWorkTarget,
  normalizeProjectWorkTargets,
  projectUnitImportToTarget,
  projectWorkPlanSize,
""",
)

replace_once(
    tests,
    """  it('applies the same assignees to every target', () => {
    const targets = generateProjectWorkTargets({ prefix: 'H', start: 1, count: 2 });
    expect(applyAssigneesToAllTargets(targets, ['u1']).map((target) => target.assigneeUserIds)).toEqual([
      ['u1'],
      ['u1'],
    ]);
  });
});
""",
    """  it('applies the same assignees to every target', () => {
    const targets = generateProjectWorkTargets({ prefix: 'H', start: 1, count: 2 });
    expect(applyAssigneesToAllTargets(targets, ['u1']).map((target) => target.assigneeUserIds)).toEqual([
      ['u1'],
      ['u1'],
    ]);
  });

  it('converts a project unit into a work target with project and unit dates', () => {
    expect(projectUnitImportToTarget({
      id: 'unit-1',
      unitCode: 'A12',
      buildingName: 'Talo 1',
      stairwellName: 'A',
      floor: '2',
      unitType: '3h+k',
      areaM2: 72.5,
      renovationScope: 'Keittiöremontti',
      plannedCompletionDate: '2026-08-14',
      notes: 'Asuttu',
    }, { startDate: '2026-08-03', endDate: '2026-08-28' })).toEqual(expect.objectContaining({
      title: 'A12',
      location: 'Talo 1 · A · 2. kerros',
      description: 'Keittiöremontti · 3h+k · 72.5 m² · Asuttu',
      startDate: '2026-08-03',
      endDate: '2026-08-14',
    }));
  });

  it('deduplicates appended targets by normalized title and location', () => {
    const current = normalizeProjectWorkTargets('A1 | 1. kerros');
    const incoming = normalizeProjectWorkTargets(' a1 |  1. KERROS  \\nA1 | 2. kerros');
    const result = appendProjectWorkTargets(current, incoming);
    expect(result.targets.map((target) => `${target.title}|${target.location}`)).toEqual([
      'A1|1. kerros',
      'A1|2. kerros',
    ]);
    expect(result.addedCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
  });

  it('keeps the target list at one hundred entries when importing', () => {
    const current = generateProjectWorkTargets({ prefix: 'H', start: 1, count: 99 });
    const incoming = generateProjectWorkTargets({ prefix: 'U', start: 1, count: 3 });
    const result = appendProjectWorkTargets(current, incoming);
    expect(result.targets).toHaveLength(100);
    expect(result.addedCount).toBe(1);
    expect(result.limitReached).toBe(true);
  });

  it('reorders targets without changing their dates, assignees or identity', () => {
    const targets = generateProjectWorkTargets({ prefix: 'H', start: 1, count: 3 });
    const middle = {
      ...targets[1],
      startDate: '2026-08-03',
      endDate: '2026-08-14',
      assigneeUserIds: ['u1'],
    };
    const source = [targets[0], middle, targets[2]];
    const moved = moveProjectWorkTarget(source, middle.id, -1);
    expect(moved.map((target) => target.id)).toEqual([middle.id, targets[0].id, targets[2].id]);
    expect(moved[0]).toEqual(middle);
  });
});
""",
)

service = root / 'src/lib/supabase/projectWorkTargetImport.ts'
service.write_text("""import type { ProjectUnitImportSource } from '../projectWorkPlanBuilder';
import { supabase } from './client';

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.filter((item): item is Row => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function text(row: Row, key: string): string {
  return typeof row[key] === 'string' ? row[key] as string : '';
}

function optionalNumber(row: Row, key: string): number | undefined {
  const value = row[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export async function loadProjectWorkTargetImportOptions(input: {
  organizationId: string;
  projectId: string;
}): Promise<ProjectUnitImportSource[]> {
  const [buildingResponse, stairwellResponse, unitResponse] = await Promise.all([
    supabase
      .from('project_buildings')
      .select('id, name, address')
      .eq('organization_id', input.organizationId)
      .eq('project_id', input.projectId)
      .order('name'),
    supabase
      .from('project_stairwells')
      .select('id, building_id, name')
      .eq('organization_id', input.organizationId)
      .eq('project_id', input.projectId)
      .order('name'),
    supabase
      .from('project_units')
      .select('id, building_id, stairwell_id, unit_code, floor, unit_type, area_m2, renovation_scope, planned_completion_date, notes')
      .eq('organization_id', input.organizationId)
      .eq('project_id', input.projectId)
      .order('unit_code'),
  ]);

  if (buildingResponse.error) throw new Error(`Rakennusten haku epäonnistui: ${buildingResponse.error.message}`);
  if (stairwellResponse.error) throw new Error(`Rappujen haku epäonnistui: ${stairwellResponse.error.message}`);
  if (unitResponse.error) throw new Error(`Huoneistojen haku epäonnistui: ${unitResponse.error.message}`);

  const buildingMap = new Map(rows(buildingResponse.data).map((row) => [text(row, 'id'), text(row, 'name')]));
  const stairwellMap = new Map(rows(stairwellResponse.data).map((row) => [text(row, 'id'), text(row, 'name')]));

  return rows(unitResponse.data).map((row) => ({
    id: text(row, 'id'),
    unitCode: text(row, 'unit_code'),
    buildingName: buildingMap.get(text(row, 'building_id')) || undefined,
    stairwellName: stairwellMap.get(text(row, 'stairwell_id')) || undefined,
    floor: text(row, 'floor') || undefined,
    unitType: text(row, 'unit_type') || undefined,
    areaM2: optionalNumber(row, 'area_m2'),
    renovationScope: text(row, 'renovation_scope') || undefined,
    plannedCompletionDate: text(row, 'planned_completion_date') || undefined,
    notes: text(row, 'notes') || undefined,
  })).filter((unit) => unit.id && unit.unitCode);
}
""", encoding='utf-8')

panel = root / 'src/pages/projectWorks/ProjectWorkPlanDialog/ProjectUnitImportPanel.tsx'
panel.write_text("""import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Loader2, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  normalizeProjectWorkTargetIdentity,
  projectUnitImportToTarget,
  type AppendProjectWorkTargetsResult,
  type ProjectUnitImportSource,
  type ProjectWorkTargetDraft,
} from '@/lib/projectWorkPlanBuilder';
import { loadProjectWorkTargetImportOptions } from '@/lib/supabase/projectWorkTargetImport';
import type { Project } from '@/types';

interface Props {
  organizationId: string;
  project: Project;
  currentTargets: ProjectWorkTargetDraft[];
  onImport: (targets: ProjectWorkTargetDraft[]) => AppendProjectWorkTargetsResult;
}

function optionLocation(option: ProjectUnitImportSource): string {
  return [option.buildingName, option.stairwellName, option.floor].filter(Boolean).join(' · ') || option.unitCode;
}

export default function ProjectUnitImportPanel({ organizationId, project, currentTargets, onImport }: Props) {
  const [options, setOptions] = useState<ProjectUnitImportSource[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadOptions = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const next = await loadProjectWorkTargetImportOptions({ organizationId, projectId: project.id });
      setOptions(next);
      setSelectedIds(new Set());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Huoneistorekisterin haku epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [organizationId, project.id]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const existingIdentities = useMemo(
    () => new Set(currentTargets.map(normalizeProjectWorkTargetIdentity)),
    [currentTargets],
  );
  const availableOptions = useMemo(() => options.filter((option) => !existingIdentities.has(
    normalizeProjectWorkTargetIdentity(projectUnitImportToTarget(option, {
      startDate: project.startDate || '',
      endDate: project.endDate || project.startDate || '',
    })),
  )), [existingIdentities, options, project.endDate, project.startDate]);
  const selectedOptions = useMemo(
    () => availableOptions.filter((option) => selectedIds.has(option.id)),
    [availableOptions, selectedIds],
  );
  const availableSlots = Math.max(0, 100 - currentTargets.length);

  const toggle = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(availableOptions.slice(0, availableSlots).map((option) => option.id)));
  };

  const importSelected = () => {
    const result = onImport(selectedOptions.map((option) => projectUnitImportToTarget(option, {
      startDate: project.startDate || '',
      endDate: project.endDate || project.startDate || '',
    })));
    setSelectedIds(new Set());
    const parts = [`Lisättiin ${result.addedCount} huoneistoa.`];
    if (result.duplicateCount > 0) parts.push(`${result.duplicateCount} oli jo listalla.`);
    if (result.limitReached) parts.push('Kohdelistan 100 kohteen raja täyttyi.');
    setNotice(parts.join(' '));
  };

  return (
    <section className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><Building2 size={19} className="text-blue-700" /><h3 className="font-semibold text-blue-950">Tuo projektin huoneistot</h3></div>
          <p className="mt-1 text-sm text-blue-900">Esikatsele ja valitse projektin huoneistorekisteristä lisättävät kohteet. Nykyinen lista säilyy.</p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void loadOptions()}>
          {loading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <RefreshCw size={16} className="mr-2" />} Päivitä rekisteri
        </Button>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-white p-3 text-sm text-red-800">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-white p-3 text-sm text-emerald-800">{notice}</div>}

      {!loading && !error && options.length === 0 && (
        <div className="rounded-xl border border-dashed border-blue-200 bg-white p-5 text-sm text-blue-900">Projektin huoneistorekisterissä ei ole vielä huoneistoja.</div>
      )}

      {options.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{options.length} rekisterissä</Badge>
              <Badge variant="secondary">{availableOptions.length} lisättävissä</Badge>
              <Badge variant="secondary">{availableSlots} paikkaa jäljellä</Badge>
            </div>
            <Button type="button" variant="secondary" size="sm" disabled={availableOptions.length === 0 || availableSlots === 0} onClick={selectAll}>Valitse lisättävät</Button>
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {options.map((option) => {
              const target = projectUnitImportToTarget(option, {
                startDate: project.startDate || '',
                endDate: project.endDate || project.startDate || '',
              });
              const duplicate = existingIdentities.has(normalizeProjectWorkTargetIdentity(target));
              const checked = selectedIds.has(option.id);
              return (
                <label key={option.id} className={`flex items-start gap-3 rounded-xl border bg-white p-3 ${duplicate ? 'border-slate-200 opacity-70' : 'border-blue-200'}`}>
                  <Checkbox checked={checked} disabled={duplicate || availableSlots === 0} onCheckedChange={(value) => toggle(option.id, value === true)} aria-label={`Valitse huoneisto ${option.unitCode}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-950">{option.unitCode}</span>
                    <span className="mt-1 block text-sm text-slate-700">{optionLocation(option)}</span>
                    {(option.renovationScope || option.notes) && <span className="mt-1 block text-xs text-slate-600">{[option.renovationScope, option.notes].filter(Boolean).join(' · ')}</span>}
                  </span>
                  {duplicate && <Badge variant="secondary">Jo listalla</Badge>}
                </label>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-blue-900">Valittu {selectedOptions.length}. Tuonti lisää kohteet listan loppuun ja poistaa kaksoiskappaleet.</p>
            <Button type="button" disabled={selectedOptions.length === 0 || availableSlots === 0} onClick={importSelected}>Tuo {Math.min(selectedOptions.length, availableSlots)} huoneistoa</Button>
          </div>
        </>
      )}
    </section>
  );
}
""", encoding='utf-8')

(root / '.github/workflows/finish-issue-187.yml').unlink(missing_ok=True)
Path(__file__).unlink(missing_ok=True)
