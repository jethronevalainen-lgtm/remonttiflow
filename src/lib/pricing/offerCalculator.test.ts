import { describe, expect, it } from 'vitest';

import {
  calculateOfferLineTotals,
  calculateOfferVersionTotals,
  calculateRecommendedSaleUnitCents,
} from './offerCalculator';

describe('offerCalculator', () => {
  it('laskee tavoitekatteen myyntihinnasta eikä kustannuslisänä', () => {
    expect(calculateRecommendedSaleUnitCents(10_000, {
      overheadPercent: 0,
      riskPercent: 0,
      targetMarginPercent: 20,
    })).toBe(12_500);
  });

  it('huomioi yleiskulut ja riskin ennen tavoitekatetta', () => {
    expect(calculateRecommendedSaleUnitCents(10_000, {
      overheadPercent: 10,
      riskPercent: 5,
      targetMarginPercent: 20,
    })).toBe(14_438);
  });

  it('huomioi määrän, hukan ja alennuksen rivillä', () => {
    expect(calculateOfferLineTotals({
      quantity: 10,
      wastePercent: 10,
      discountPercent: 5,
      costUnitPriceCents: 1_000,
      saleUnitPriceCents: 2_000,
    })).toEqual({
      effectiveQuantity: 11,
      directCostCents: 11_000,
      saleSubtotalCents: 20_900,
      grossMarginCents: 9_900,
      grossMarginPercent: 47.37,
    });
  });

  it('jättää option pois tarjouksen perussummasta', () => {
    const totals = calculateOfferVersionTotals([
      {
        quantity: 1,
        costUnitPriceCents: 10_000,
        saleUnitPriceCents: 15_000,
      },
      {
        quantity: 1,
        costUnitPriceCents: 5_000,
        saleUnitPriceCents: 8_000,
        optional: true,
      },
    ], {
      vatRate: 25.5,
      overheadPercent: 10,
      riskPercent: 5,
      targetMarginPercent: 20,
    });

    expect(totals).toEqual({
      directCostCents: 10_000,
      overheadCents: 1_000,
      riskCents: 550,
      estimatedCostCents: 11_550,
      saleSubtotalCents: 15_000,
      vatCents: 3_825,
      totalCents: 18_825,
      grossMarginCents: 3_450,
      grossMarginPercent: 23,
    });
  });
});
