import { Card, CardContent } from '@/components/ui/card';
import type { QuantityTakeoffLine } from '@/hooks/useFinanceFormsData';
import { quantityWithWaste } from '@/lib/financeCalculations';
import { TakeoffLineCard } from './TakeoffLineCard';
import { formatQuantity, groupLinesByPhase } from './takeoffUi';

interface TakeoffPhaseGroupsProps {
  lines: QuantityTakeoffLine[];
  onEdit: (line: QuantityTakeoffLine) => void;
  onDelete: (line: QuantityTakeoffLine) => void;
}

export function TakeoffPhaseGroups({ lines, onEdit, onDelete }: TakeoffPhaseGroupsProps) {
  const groups = groupLinesByPhase(lines);

  if (groups.length === 0) {
    return (
      <Card className="border-slate-200/80 shadow-none">
        <CardContent className="p-10 text-center text-sm text-slate-500">
          Ei määrärivejä vielä. Lisää rivi tai tuo työvaihepohja.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(([phase, phaseLines]) => {
        const withWaste = phaseLines.reduce((sum, line) => sum + quantityWithWaste(line), 0);
        const units = [...new Set(phaseLines.map((line) => line.unit))];
        return (
          <Card key={phase} className="overflow-hidden border-slate-200/80 shadow-none">
            <CardContent className="p-0">
              <div className="border-b bg-slate-50 px-5 py-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="break-words font-semibold text-slate-900">{phase}</h3>
                    <p className="break-words text-xs text-slate-500">
                      {phaseLines.length} riviä
                      {units.length === 1
                        ? ` · hukallinen ${formatQuantity(withWaste)} ${units[0]}`
                        : ' · useita yksiköitä'}
                    </p>
                  </div>
                </div>
              </div>
              {phaseLines.map((line) => (
                <TakeoffLineCard
                  key={line.id}
                  line={line}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
