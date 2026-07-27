export interface OfferPricingSettings {
  vatRate: number;
  overheadPercent: number;
  riskPercent: number;
  targetMarginPercent: number;
}

export interface OfferPricingLine {
  quantity: number;
  costUnitPriceCents: number;
  saleUnitPriceCents: number;
  wastePercent?: number;
  discountPercent?: number;
  optional?: boolean;
}

export interface OfferLineTotals {
  effectiveQuantity: number;
  directCostCents: number;
  saleSubtotalCents: number;
  grossMarginCents: number;
  grossMarginPercent: number;
}

export interface OfferVersionTotals {
  directCostCents: number;
  overheadCents: number;
  riskCents: number;
  estimatedCostCents: number;
  saleSubtotalCents: number;
  vatCents: number;
  totalCents: number;
  grossMarginCents: number;
  grossMarginPercent: number;
}

function finiteNonNegative(value: number, fallback = 0): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function percent(value: number, maximum = 100): number {
  return Math.min(maximum, finiteNonNegative(value));
}

export function calculateRecommendedSaleUnitCents(
  costUnitPriceCents: number,
  settings: Pick<OfferPricingSettings, 'overheadPercent' | 'riskPercent' | 'targetMarginPercent'>,
): number {
  const direct = finiteNonNegative(costUnitPriceCents);
  const overheadRate = percent(settings.overheadPercent) / 100;
  const riskRate = percent(settings.riskPercent) / 100;
  const targetMarginRate = percent(settings.targetMarginPercent, 99.99) / 100;

  const overheadAdjusted = direct * (1 + overheadRate);
  const riskAdjusted = overheadAdjusted * (1 + riskRate);
  return Math.round(riskAdjusted / (1 - targetMarginRate));
}

export function calculateOfferLineTotals(line: OfferPricingLine): OfferLineTotals {
  const quantity = finiteNonNegative(line.quantity);
  const wasteRate = percent(line.wastePercent ?? 0) / 100;
  const discountRate = percent(line.discountPercent ?? 0) / 100;
  const effectiveQuantity = quantity * (1 + wasteRate);

  if (line.optional) {
    return {
      effectiveQuantity,
      directCostCents: 0,
      saleSubtotalCents: 0,
      grossMarginCents: 0,
      grossMarginPercent: 0,
    };
  }

  const directCostCents = Math.round(
    effectiveQuantity * finiteNonNegative(line.costUnitPriceCents),
  );
  const saleSubtotalCents = Math.round(
    effectiveQuantity * finiteNonNegative(line.saleUnitPriceCents) * (1 - discountRate),
  );
  const grossMarginCents = saleSubtotalCents - directCostCents;
  const grossMarginPercent = saleSubtotalCents > 0
    ? Math.round((grossMarginCents / saleSubtotalCents) * 10_000) / 100
    : 0;

  return {
    effectiveQuantity,
    directCostCents,
    saleSubtotalCents,
    grossMarginCents,
    grossMarginPercent,
  };
}

export function calculateOfferVersionTotals(
  lines: OfferPricingLine[],
  settings: OfferPricingSettings,
): OfferVersionTotals {
  const lineTotals = lines.map(calculateOfferLineTotals);
  const directCostCents = lineTotals.reduce((sum, line) => sum + line.directCostCents, 0);
  const saleSubtotalCents = lineTotals.reduce((sum, line) => sum + line.saleSubtotalCents, 0);
  const overheadCents = Math.round(directCostCents * percent(settings.overheadPercent) / 100);
  const riskCents = Math.round(
    (directCostCents + overheadCents) * percent(settings.riskPercent) / 100,
  );
  const estimatedCostCents = directCostCents + overheadCents + riskCents;
  const vatCents = Math.round(saleSubtotalCents * percent(settings.vatRate) / 100);
  const grossMarginCents = saleSubtotalCents - estimatedCostCents;
  const grossMarginPercent = saleSubtotalCents > 0
    ? Math.round((grossMarginCents / saleSubtotalCents) * 10_000) / 100
    : 0;

  return {
    directCostCents,
    overheadCents,
    riskCents,
    estimatedCostCents,
    saleSubtotalCents,
    vatCents,
    totalCents: saleSubtotalCents + vatCents,
    grossMarginCents,
    grossMarginPercent,
  };
}
