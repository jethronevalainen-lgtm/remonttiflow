import { useCallback, useEffect, useMemo, useState } from 'react';
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
