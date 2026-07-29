import { describe, expect, it } from 'vitest';

import {
  calculateChangeOrderTotals,
  nextChangeOrderAction,
  type ChangeOrderDraftLineInput,
} from '@/lib/supabase/changeOrders';

const lines: ChangeOrderDraftLineInput[] = [
  {
    category: 'Työ',
    description: 'Asennustyö',
    quantity: 8,
    unit: 'h',
    costUnitPriceCents: 3200,
    saleUnitPriceCents: 6500,
    customerVisible: true,
  },
  {
    category: 'Materiaali',
    description: 'Lisämateriaali',
    quantity: 2,
    unit: 'kpl',
    costUnitPriceCents: 10000,
    saleUnitPriceCents: 18000,
    customerVisible: true,
  },
];

describe('change order commercial workflow', () => {
  it('calculates sale, cost and margin from line-level prices', () => {
    expect(calculateChangeOrderTotals(lines)).toEqual({
      saleCents: 88000,
      costCents: 45600,
      marginCents: 42400,
      marginPercent: expect.closeTo(48.1818, 3),
    });
  });

  it('uses the exact quantity when prices produce fractional cent totals', () => {
    expect(calculateChangeOrderTotals([{
      category: 'Materiaali',
      description: 'Listoitus',
      quantity: 2.5,
      unit: 'm',
      costUnitPriceCents: 111,
      saleUnitPriceCents: 199,
      customerVisible: true,
    }])).toMatchObject({
      saleCents: 498,
      costCents: 278,
      marginCents: 220,
    });
  });

  it('exposes only the next allowed action for every workflow state', () => {
    expect(nextChangeOrderAction('Luonnos')).toBe('submit');
    expect(nextChangeOrderAction('Lähetetty')).toBe('decision');
    expect(nextChangeOrderAction('Hylätty')).toBe('revise');
    expect(nextChangeOrderAction('Hyväksytty')).toBe('start');
    expect(nextChangeOrderAction('Toteutuksessa')).toBe('complete');
    expect(nextChangeOrderAction('Valmis')).toBe('none');
  });
});
