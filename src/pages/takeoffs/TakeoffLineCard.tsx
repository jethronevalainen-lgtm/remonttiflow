import { Edit3, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { quantityWithWaste } from '@/lib/financeCalculations';
import type { QuantityTakeoffLine } from '@/hooks/useFinanceFormsData';
import { cn } from '@/lib/utils';
import { formatQuantity } from './takeoffUi';

interface TakeoffLineCardProps {
  line: QuantityTakeoffLine;
  onEdit: (line: QuantityTakeoffLine) => void;
  onDelete: (line: QuantityTakeoffLine) => void;
}

export function TakeoffLineCard({ line, onEdit, onDelete }: TakeoffLineCardProps) {
  const withWaste = quantityWithWaste(line);
  const missing = line.quantity <= 0;

  return (
    <div className="border-b border-slate-100 px-4 py-4 last:border-b-0">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {line.wastePercent > 0 && (
              <Badge variant="outline">Hukka {formatQuantity(line.wastePercent, 1)} %</Badge>
            )}
            {missing && (
              <Badge className="border-amber-200 bg-amber-50 text-amber-800">Määrä puuttuu</Badge>
            )}
          </div>
          <p className="break-words text-sm font-semibold text-slate-900">{line.description}</p>
          {line.notes && (
            <p className="break-words text-xs text-slate-500">{line.notes}</p>
          )}
        </div>

        <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:min-w-[360px] lg:grid-cols-3">
          <div className={cn('rounded-lg px-3 py-2', missing ? 'bg-amber-50' : 'bg-slate-50')}>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Määrä</p>
            <p className="break-words font-mono text-sm font-semibold">
              {formatQuantity(line.quantity)} {line.unit}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Hukka</p>
            <p className="break-words font-mono text-sm">
              {formatQuantity(line.wastePercent, 1)} %
            </p>
          </div>
          <div className="rounded-lg bg-orange-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-orange-700">Hukallinen</p>
            <p className="break-words font-mono text-sm font-bold text-orange-900">
              {formatQuantity(withWaste)} {line.unit}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-end gap-1">
        <Button variant="ghost" size="sm" className="h-8 gap-1 px-2" onClick={() => onEdit(line)}>
          <Edit3 size={14} /> Muokkaa
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 px-2 text-danger"
          onClick={() => onDelete(line)}
        >
          <Trash2 size={14} /> Poista
        </Button>
      </div>
    </div>
  );
}
