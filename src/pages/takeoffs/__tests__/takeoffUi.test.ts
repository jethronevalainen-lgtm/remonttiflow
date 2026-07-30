import { describe, expect, it } from 'vitest';

import {
  filterTakeoffs,
  groupLinesByPhase,
  linesFromPhases,
  takeoffStats,
} from '@/pages/takeoffs/takeoffUi';
import { summarizeTakeoffByUnit } from '@/lib/financeCalculations';
import type { QuantityTakeoff, QuantityTakeoffLine } from '@/hooks/useFinanceFormsData';

const takeoffs: QuantityTakeoff[] = [
  {
    id: 't1',
    name: 'Demokatu kylpyhuone',
    projectName: 'Demokatu 12',
    status: 'Luonnos',
    notes: 'Mittaus tehty',
  },
  {
    id: 't2',
    name: 'Keittiö',
    projectName: 'Asunto B',
    status: 'Valmis',
    notes: '',
  },
];

const lines: QuantityTakeoffLine[] = [
  {
    id: 'l1',
    takeoffId: 't1',
    workPhase: 'Laatoitus',
    description: 'Seinälaatat',
    quantity: 20,
    unit: 'm²',
    wastePercent: 10,
    notes: '',
  },
  {
    id: 'l2',
    takeoffId: 't1',
    workPhase: 'Laatoitus',
    description: 'Lattialaatat',
    quantity: 0,
    unit: 'm²',
    wastePercent: 5,
    notes: '',
  },
  {
    id: 'l3',
    takeoffId: 't1',
    workPhase: 'Kalusteet',
    description: 'Allaskaappi',
    quantity: 1,
    unit: 'kpl',
    wastePercent: 0,
    notes: '',
  },
];

describe('takeoffUi helpers', () => {
  it('filters takeoffs by status and free-text search across lines', () => {
    expect(filterTakeoffs(takeoffs, lines, 'seinälaatat', 'all').map((item) => item.id)).toEqual(['t1']);
    expect(filterTakeoffs(takeoffs, lines, '', 'Valmis').map((item) => item.id)).toEqual(['t2']);
    expect(filterTakeoffs(takeoffs, lines, 'keittiö', 'Luonnos')).toEqual([]);
  });

  it('groups lines by phase in Finnish alphabetical order', () => {
    expect(groupLinesByPhase(lines).map(([phase]) => phase)).toEqual(['Kalusteet', 'Laatoitus']);
  });

  it('summarizes missing quantities and waste impact', () => {
    const stats = takeoffStats(lines);
    expect(stats.lineCount).toBe(3);
    expect(stats.phaseCount).toBe(2);
    expect(stats.missingQuantity).toBe(1);
    expect(stats.baseQuantity).toBe(21);
    expect(stats.withWasteQuantity).toBe(23);
    expect(stats.byUnit).toHaveLength(2);
  });

  it('builds seed lines from phase templates and skips existing phases', () => {
    const seeded = linesFromPhases(
      't1',
      [
        { title: 'Laatoitus', description: 'Seinät ja lattia' },
        { title: 'Siivous', description: 'Loppusiivous' },
      ],
      { skipExistingPhases: new Set(['laatoitus']), defaultWastePercent: 8, defaultUnit: 'm²' },
    );
    expect(seeded).toHaveLength(1);
    expect(seeded[0]).toMatchObject({
      takeoffId: 't1',
      workPhase: 'Siivous',
      description: 'Loppusiivous',
      quantity: 0,
      unit: 'm²',
      wastePercent: 8,
    });
  });
});

describe('summarizeTakeoffByUnit', () => {
  it('aggregates base and waste quantities per unit', () => {
    expect(summarizeTakeoffByUnit(lines)).toEqual([
      {
        unit: 'kpl',
        lineCount: 1,
        baseQuantity: 1,
        withWasteQuantity: 1,
        wasteQuantity: 0,
      },
      {
        unit: 'm²',
        lineCount: 2,
        baseQuantity: 20,
        withWasteQuantity: 22,
        wasteQuantity: 2,
      },
    ]);
  });
});
