import { Edit3, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { calculateOfferLineTotals } from '@/lib/pricing/offerCalculator';
import type { OfferLine } from '@/lib/supabase/offers';
import { cn } from '@/lib/utils';
import { euro, marginTone } from './offerUi';

interface OfferLineCardProps {
  line: OfferLine;
  draft: boolean;
  onEdit: (line: OfferLine) => void;
  onDelete: (line: OfferLine) => void;
}

export function OfferLineCard({ line, draft, onEdit, onDelete }: OfferLineCardProps) {
  const totals = calculateOfferLineTotals({
    quantity: line.quantity,
    costUnitPriceCents: line.costUnitPriceCents,
    saleUnitPriceCents: line.saleUnitPriceCents,
    wastePercent: line.wastePercent,
    discountPercent: line.discountPercent,
    optional: line.optional,
  });

  return (
    <div className="border-b border-slate-100 px-4 py-4 last:border-b-0">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{line.category}</Badge>
            {line.optional && (
              <Badge className="border-amber-200 bg-amber-50 text-amber-800">Optio</Badge>
            )}
            {!line.customerVisible && (
              <Badge className="border-slate-200 bg-slate-100 text-slate-600">Sisäinen</Badge>
            )}
            {line.discountPercent > 0 && (
              <Badge variant="outline">Alennus {line.discountPercent} %</Badge>
            )}
            {line.wastePercent > 0 && (
              <Badge variant="outline">Hukka {line.wastePercent} %</Badge>
            )}
          </div>
          <p className="break-words text-sm font-semibold text-slate-900">{line.description}</p>
          {line.customerNote && (
            <p className="break-words text-xs text-slate-500">Asiakkaalle: {line.customerNote}</p>
          )}
          {line.internalNote && (
            <p className="break-words text-xs text-slate-400">Sisäinen: {line.internalNote}</p>
          )}
        </div>

        <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:min-w-[420px] lg:grid-cols-4">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Määrä</p>
            <p className="break-words font-mono text-sm font-semibold">
              {line.quantity} {line.unit}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Kustannus / yks.</p>
            <p className="break-words font-mono text-sm">{euro(line.costUnitPriceCents)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Myynti / yks.</p>
            <p className="break-words font-mono text-sm font-semibold">{euro(line.saleUnitPriceCents)}</p>
          </div>
          <div className="rounded-lg bg-orange-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-orange-700">Myynti yht.</p>
            <p className="break-words font-mono text-sm font-bold text-orange-900">
              {line.optional ? 'Ei perussummassa' : euro(totals.saleSubtotalCents)}
            </p>
            {!line.optional && totals.saleSubtotalCents > 0 && (
              <p className={cn('mt-0.5 text-xs font-semibold', marginTone(totals.grossMarginPercent))}>
                Kate {totals.grossMarginPercent.toFixed(1)} %
              </p>
            )}
          </div>
        </div>
      </div>

      {draft && (
        <div className="mt-3 flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(line)}>
            <Edit3 size={14} className="mr-1" /> Muokkaa
          </Button>
          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onDelete(line)}>
            <Trash2 size={14} className="mr-1" /> Poista
          </Button>
        </div>
      )}
    </div>
  );
}
