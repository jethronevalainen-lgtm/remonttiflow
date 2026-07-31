import { useMemo } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  normalizeProjectWorkTargetIdentity,
  projectUnitImportToTarget,
  type ProjectUnitImportSource,
} from '@/lib/projectWorkPlanBuilder';

interface Props {
  options: ProjectUnitImportSource[];
  loading: boolean;
  error: string;
  projectDates: { startDate: string; endDate: string };
  existingIdentities: Set<string>;
  selectedIds: Set<string>;
  availableSlots: number;
  onSelectedIdsChange: (next: Set<string>) => void;
  onReload: () => void;
}

function optionLocation(option: ProjectUnitImportSource): string {
  return [option.buildingName, option.stairwellName, option.floor].filter(Boolean).join(' · ') || option.unitCode;
}

export default function ProjectUnitImportPanel({
  options,
  loading,
  error,
  projectDates,
  existingIdentities,
  selectedIds,
  availableSlots,
  onSelectedIdsChange,
  onReload,
}: Props) {
  const rows = useMemo(() => options.map((option) => {
    const target = projectUnitImportToTarget(option, projectDates);
    return { option, alreadyOnList: existingIdentities.has(normalizeProjectWorkTargetIdentity(target)) };
  }), [existingIdentities, options, projectDates]);
  const selectableRows = useMemo(() => rows.filter((row) => !row.alreadyOnList), [rows]);
  const selectedCount = selectableRows.filter((row) => selectedIds.has(row.option.id)).length;

  const toggle = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    onSelectedIdsChange(next);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-sm text-text-secondary">
        <Loader2 size={17} className="animate-spin" /> Haetaan projektin huoneistoja…
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="break-words">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={onReload}>
          <RefreshCw size={15} className="mr-2" /> Yritä uudelleen
        </Button>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="space-y-3 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-text-secondary">
        <p className="font-semibold text-text-primary">Projektilla ei ole vielä huoneistoja</p>
        <p className="break-words">
          Huoneistot lisätään Tarkastukset-sivun kohderekisteriin. Muodosta kohteet siihen asti numerosarjana tai
          liittämällä lista.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onReload}>
          <RefreshCw size={15} className="mr-2" /> Päivitä rekisteri
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-secondary">
          Valittu {selectedCount} / {selectableRows.length} lisättävissä olevaa huoneistoa.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={selectableRows.length === 0 || availableSlots === 0}
            onClick={() => onSelectedIdsChange(new Set(selectableRows.slice(0, availableSlots).map((row) => row.option.id)))}
          >
            Valitse kaikki
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={selectedIds.size === 0}
            onClick={() => onSelectedIdsChange(new Set())}
          >
            Tyhjennä valinta
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onReload}>
            <RefreshCw size={15} className="mr-2" /> Päivitä
          </Button>
        </div>
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {rows.map(({ option, alreadyOnList }) => (
          <label
            key={option.id}
            className={`flex items-start gap-3 rounded-xl border bg-white p-3 ${alreadyOnList ? 'border-slate-200' : 'cursor-pointer border-slate-200 hover:border-primary/40'}`}
          >
            <Checkbox
              className="mt-0.5"
              checked={selectedIds.has(option.id)}
              disabled={alreadyOnList || availableSlots === 0}
              onCheckedChange={(value) => toggle(option.id, value === true)}
              aria-label={`Valitse huoneisto ${option.unitCode}`}
            />
            <span className="min-w-0 flex-1">
              <span className="block break-words font-semibold text-slate-950">{option.unitCode}</span>
              <span className="mt-1 block break-words text-sm text-slate-700">{optionLocation(option)}</span>
              {(option.renovationScope || option.notes) && (
                <span className="mt-1 block break-words text-xs text-slate-600">
                  {[option.renovationScope, option.notes].filter(Boolean).join(' · ')}
                </span>
              )}
            </span>
            {alreadyOnList && <Badge variant="secondary">Jo listalla</Badge>}
          </label>
        ))}
      </div>
    </div>
  );
}
