import type { Estimate, EstimateLine, QuantityTakeoffLine } from '@/hooks/useFinanceFormsData';

export interface EstimateTotals {
  directCents: number;
  overheadCents: number;
  riskCents: number;
  marginCents: number;
  beforeVatCents: number;
  vatCents: number;
  totalCents: number;
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function estimateLineTotalCents(line: Pick<EstimateLine, 'quantity' | 'unitPriceCents'>): number {
  return Math.round(finiteNonNegative(line.quantity) * finiteNonNegative(line.unitPriceCents));
}

export function calculateEstimateTotals(
  estimate: Pick<Estimate, 'overheadPercent' | 'riskPercent' | 'marginPercent' | 'vatRate'>,
  lines: Array<Pick<EstimateLine, 'quantity' | 'unitPriceCents'>>,
): EstimateTotals {
  const directCents = lines.reduce((sum, line) => sum + estimateLineTotalCents(line), 0);
  const overheadCents = Math.round(directCents * finiteNonNegative(estimate.overheadPercent) / 100);
  const riskCents = Math.round(directCents * finiteNonNegative(estimate.riskPercent) / 100);
  const marginCents = Math.round(directCents * finiteNonNegative(estimate.marginPercent) / 100);
  const beforeVatCents = directCents + overheadCents + riskCents + marginCents;
  const vatCents = Math.round(beforeVatCents * finiteNonNegative(estimate.vatRate) / 100);

  return {
    directCents,
    overheadCents,
    riskCents,
    marginCents,
    beforeVatCents,
    vatCents,
    totalCents: beforeVatCents + vatCents,
  };
}

export function quantityWithWaste(
  line: Pick<QuantityTakeoffLine, 'quantity' | 'wastePercent'>,
): number {
  const quantity = finiteNonNegative(line.quantity);
  const wastePercent = finiteNonNegative(line.wastePercent);
  return quantity * (1 + wastePercent / 100);
}

export interface TakeoffUnitSummary {
  unit: string;
  lineCount: number;
  baseQuantity: number;
  withWasteQuantity: number;
  wasteQuantity: number;
}

/** Aggregates takeoff lines by unit for overview cards and CSV summaries. */
export function summarizeTakeoffByUnit(
  lines: Array<Pick<QuantityTakeoffLine, 'quantity' | 'unit' | 'wastePercent'>>,
): TakeoffUnitSummary[] {
  const byUnit = new Map<string, TakeoffUnitSummary>();
  for (const line of lines) {
    const unit = line.unit.trim() || '—';
    const baseQuantity = finiteNonNegative(line.quantity);
    const withWasteQuantity = quantityWithWaste(line);
    const current = byUnit.get(unit) ?? {
      unit,
      lineCount: 0,
      baseQuantity: 0,
      withWasteQuantity: 0,
      wasteQuantity: 0,
    };
    current.lineCount += 1;
    current.baseQuantity += baseQuantity;
    current.withWasteQuantity += withWasteQuantity;
    current.wasteQuantity += withWasteQuantity - baseQuantity;
    byUnit.set(unit, current);
  }
  return [...byUnit.values()].sort((a, b) => a.unit.localeCompare(b.unit, 'fi'));
}
