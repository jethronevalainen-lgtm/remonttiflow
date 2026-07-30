import { CheckCircle2, ClipboardList, FileText, Layers3, Ruler } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import type { QuantityTakeoff, QuantityTakeoffLine } from '@/hooks/useFinanceFormsData';

interface TakeoffKpiStripProps {
  takeoffs: QuantityTakeoff[];
  takeoffLines: QuantityTakeoffLine[];
}

export function TakeoffKpiStrip({ takeoffs, takeoffLines }: TakeoffKpiStripProps) {
  const drafts = takeoffs.filter((item) => item.status === 'Luonnos').length;
  const ready = takeoffs.filter((item) => item.status === 'Valmis').length;
  const linkedProjects = new Set(
    takeoffs.map((item) => item.projectId || item.projectName.trim()).filter(Boolean),
  ).size;
  const missingQty = takeoffLines.filter((line) => line.quantity <= 0).length;

  const items = [
    {
      label: 'Laskelmia',
      value: String(takeoffs.length),
      detail: `${drafts} luonnosta · ${ready} valmista`,
      icon: ClipboardList,
      tone: 'text-slate-800',
    },
    {
      label: 'Määrärivejä',
      value: String(takeoffLines.length),
      detail: missingQty > 0 ? `${missingQty} ilman määrää` : 'Kaikilla riveillä määrä',
      icon: Ruler,
      tone: missingQty > 0 ? 'text-amber-700' : 'text-emerald-700',
    },
    {
      label: 'Luonnokset',
      value: String(drafts),
      detail: 'Muokattavissa',
      icon: FileText,
      tone: 'text-amber-700',
    },
    {
      label: 'Valmiit',
      value: String(ready),
      detail: 'Valmiita tarjoukseen',
      icon: CheckCircle2,
      tone: 'text-emerald-700',
    },
    {
      label: 'Projektit',
      value: String(linkedProjects),
      detail: 'Linkitettyjä kohteita',
      icon: Layers3,
      tone: 'text-sky-700',
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label} className="border-slate-200/80 shadow-none">
            <CardContent className="flex items-start gap-3 p-4">
              <div className="rounded-xl bg-slate-50 p-2.5 text-slate-500">
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
                <p className={`mt-1 break-words font-mono text-lg font-bold ${item.tone}`}>{item.value}</p>
                <p className="mt-0.5 break-words text-xs text-slate-500">{item.detail}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
