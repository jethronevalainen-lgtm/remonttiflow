import { describe, expect, it } from 'vitest';

import {
  calculateEstimateTotals,
  estimateLineTotalCents,
  quantityWithWaste,
} from '@/lib/financeCalculations';

describe('financeCalculations', () => {
  it('calculates line totals in integer cents', () => {
    expect(estimateLineTotalCents({ quantity: 2.5, unitPriceCents: 1_250 })).toBe(3_125);
  });

  it('calculates additions from direct costs and VAT from the tax-free total', () => {
    const totals = calculateEstimateTotals(
      { overheadPercent: 10, riskPercent: 5, marginPercent: 15, vatRate: 25.5 },
      [
        { quantity: 10, unitPriceCents: 1_000 },
        { quantity: 2, unitPriceCents: 2_500 },
      ],
    );

    expect(totals).toEqual({
      directCents: 15_000,
      overheadCents: 1_500,
      riskCents: 750,
      marginCents: 2_250,
      beforeVatCents: 19_500,
      vatCents: 4_973,
      totalCents: 24_473,
    });
  });

  it('does not propagate invalid or negative values', () => {
    const totals = calculateEstimateTotals(
      { overheadPercent: -10, riskPercent: Number.NaN, marginPercent: 0, vatRate: 0 },
      [{ quantity: -1, unitPriceCents: 500 }],
    );

    expect(totals.totalCents).toBe(0);
  });

  it('adds the waste percentage without mutating the base quantity', () => {
    expect(quantityWithWaste({ quantity: 80, wastePercent: 12.5 })).toBe(90);
  });
});
