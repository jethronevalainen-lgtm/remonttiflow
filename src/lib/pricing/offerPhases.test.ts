import { describe, expect, it } from 'vitest';

import {
  buildCalculationStepsFromLines,
  getOfferPhaseTemplate,
  mergePhaseSelections,
  OFFER_PHASE_TEMPLATES,
} from './offerPhases';

describe('offerPhases', () => {
  it('sisältää käyttökelpoisia työvaihepohjia', () => {
    expect(OFFER_PHASE_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    const bathroom = getOfferPhaseTemplate('bathroom');
    expect(bathroom.phases.length).toBeGreaterThanOrEqual(5);
    expect(bathroom.phases[0]?.title).toMatch(/purku/i);
  });

  it('yhdistää pohjan ja omat vaiheet ilman kaksoiskappaleita', () => {
    const phases = mergePhaseSelections('interior', [
      { title: 'Maalaus ja pinnoitus', description: 'Duplikaatti' },
      { title: 'Parveke', description: 'Lisävaihe' },
    ]);
    expect(phases.filter((phase) => phase.title === 'Maalaus ja pinnoitus')).toHaveLength(1);
    expect(phases.some((phase) => phase.title === 'Parveke')).toBe(true);
  });

  it('rakentaa laskennan vaiheet kustannuksesta loppusummaan', () => {
    const steps = buildCalculationStepsFromLines([
      {
        quantity: 1,
        costUnitPriceCents: 10_000,
        saleUnitPriceCents: 15_000,
      },
    ], {
      vatRate: 25.5,
      overheadPercent: 10,
      riskPercent: 5,
      targetMarginPercent: 20,
    });

    expect(steps.map((step) => step.id)).toEqual([
      'direct',
      'overhead',
      'risk',
      'estimated',
      'sale',
      'margin',
      'vat',
      'total',
    ]);
    expect(steps.find((step) => step.id === 'estimated')?.amountCents).toBe(11_550);
    expect(steps.find((step) => step.id === 'total')?.amountCents).toBe(18_825);
  });
});
