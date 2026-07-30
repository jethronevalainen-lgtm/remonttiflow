import { AlertTriangle, Scale } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import type { QuantityTakeoffLine } from '@/hooks/useFinanceFormsData';
import { formatQuantity, takeoffStats } from './takeoffUi';

interface TakeoffSummaryPanelProps {
  lines: QuantityTakeoffLine[];
}

export function TakeoffSummaryPanel({ lines }: TakeoffSummaryPanelProps) {
  const stats = takeoffStats(lines);
  if (lines.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Rivejä" value={String(stats.lineCount)} detail={`${stats.phaseCount} työvaihetta`} />
        <SummaryCard
          label="Puuttuvat määrät"
          value={String(stats.missingQuantity)}
          detail={stats.missingQuantity > 0 ? 'Täydennä ennen tarjousta' : 'Kaikki rivit täytetty'}
          warn={stats.missingQuantity > 0}
        />
        <SummaryCard
          label="Hukkalisä"
          value={formatQuantity(stats.wasteQuantity)}
          detail="Yksiköiden yhteenlaskettu hukka"
        />
        <SummaryCard
          label="Hukallinen yht."
          value={formatQuantity(stats.withWasteQuantity)}
          detail={`Perusmäärä ${formatQuantity(stats.baseQuantity)}`}
        />
      </div>

      {stats.byUnit.length > 0 && (
        <Card className="border-slate-200/80 shadow-none">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Scale size={16} className="text-orange-600" />
              <p className="font-semibold text-slate-900">Yhteensä yksiköittäin</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {stats.byUnit.map((item) => (
                <div key={item.unit} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="break-words text-xs font-medium uppercase tracking-wide text-slate-500">
                    {item.unit} · {item.lineCount} riviä
                  </p>
                  <p className="mt-1 break-words font-mono text-sm font-bold text-slate-900">
                    {formatQuantity(item.withWasteQuantity)} {item.unit}
                  </p>
                  <p className="mt-0.5 break-words text-xs text-slate-500">
                    Perus {formatQuantity(item.baseQuantity)}
                    {item.wasteQuantity > 0
                      ? ` · hukka +${formatQuantity(item.wasteQuantity)}`
                      : ''}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {stats.missingQuantity > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p className="break-words">
            {stats.missingQuantity} rivillä määrä on 0. Täydennä määrät ennen vientiä tarjoukseen.
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  warn = false,
}: {
  label: string;
  value: string;
  detail: string;
  warn?: boolean;
}) {
  return (
    <Card className="border-slate-200/80 shadow-none">
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className={`mt-1 break-words font-mono text-lg font-bold ${warn ? 'text-amber-700' : 'text-slate-900'}`}>
          {value}
        </p>
        <p className="mt-0.5 break-words text-xs text-slate-500">{detail}</p>
      </CardContent>
    </Card>
  );
}
