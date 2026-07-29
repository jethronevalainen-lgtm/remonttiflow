import { ArrowRight, Equal, Plus } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CalculationStep } from '@/lib/pricing/offerPhases';
import { cn } from '@/lib/utils';
import { euro, marginTone } from './offerUi';

interface CalculationStepsPanelProps {
  steps: CalculationStep[];
  className?: string;
}

function toneClass(tone: CalculationStep['tone']): string {
  if (tone === 'cost') return 'border-slate-200 bg-slate-50';
  if (tone === 'sale') return 'border-sky-200 bg-sky-50';
  if (tone === 'tax') return 'border-violet-200 bg-violet-50';
  if (tone === 'total') return 'border-orange-300 bg-orange-50';
  if (tone === 'margin') return 'border-emerald-200 bg-emerald-50';
  return 'border-slate-200 bg-white';
}

function OperatorIcon({ operator }: { operator?: CalculationStep['operator'] }) {
  if (operator === '+') return <Plus size={14} className="text-slate-400" />;
  if (operator === '=') return <Equal size={14} className="text-slate-400" />;
  if (operator === '→') return <ArrowRight size={14} className="text-slate-400" />;
  return null;
}

export function CalculationStepsPanel({ steps, className }: CalculationStepsPanelProps) {
  const marginPercent = Number.parseFloat(
    steps.find((step) => step.id === 'margin')?.detail ?? '',
  );

  return (
    <Card className={cn('border-slate-200/80 shadow-none', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Laskennan vaiheet</CardTitle>
        <p className="break-words text-sm text-slate-500">
          Näet miten suorista kustannuksista muodostuu asiakkaan loppusumma.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step) => (
          <div
            key={step.id}
            className={cn(
              'flex items-start gap-3 rounded-xl border px-3 py-3',
              toneClass(step.tone),
            )}
          >
            <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/80">
              <OperatorIcon operator={step.operator} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="break-words font-semibold text-slate-900">{step.label}</p>
                <p
                  className={cn(
                    'break-words font-mono text-sm font-bold',
                    step.tone === 'margin' && Number.isFinite(marginPercent)
                      ? marginTone(marginPercent)
                      : step.tone === 'total'
                        ? 'text-orange-950'
                        : 'text-slate-900',
                  )}
                >
                  {euro(step.amountCents)}
                </p>
              </div>
              <p className="mt-0.5 break-words text-xs text-slate-500">{step.detail}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
