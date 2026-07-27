import { describe, expect, it } from 'vitest';

import {
  createGenericProjectPhases,
  generateProjectWorkTargets,
  normalizeProjectWorkTargets,
  projectWorkPlanSize,
  spreadProjectPhaseDates,
} from '../projectWorkPlanBuilder';

describe('project work plan builder', () => {
  it('normalizes generic targets and preserves an optional location', () => {
    expect(normalizeProjectWorkTargets('A1 | 1. kerros\nA2\nA1 | 1. kerros')).toEqual([
      expect.objectContaining({ title: 'A1', location: '1. kerros' }),
      expect.objectContaining({ title: 'A2', location: 'A2' }),
    ]);
  });

  it('generates a bounded target sequence', () => {
    const targets = generateProjectWorkTargets({ prefix: 'Lohko ', start: 3, count: 3, padLength: 2 });
    expect(targets.map((target) => target.title)).toEqual(['Lohko 03', 'Lohko 04', 'Lohko 05']);
  });

  it('spreads phase dates over the project interval without gaps', () => {
    expect(spreadProjectPhaseDates('2026-08-03', '2026-08-12', 3)).toEqual([
      { startDate: '2026-08-03', endDate: '2026-08-05' },
      { startDate: '2026-08-06', endDate: '2026-08-08' },
      { startDate: '2026-08-09', endDate: '2026-08-12' },
    ]);
  });

  it('creates a genuinely generic five-phase template', () => {
    const phases = createGenericProjectPhases({ startDate: '2026-08-03', endDate: '2026-08-28' });
    expect(phases).toHaveLength(5);
    expect(phases[0].title.toLocaleLowerCase('fi')).toContain('valmistelu');
    expect(phases[2].title.toLocaleLowerCase('fi')).toContain('toteutus');
    expect(phases[4].title.toLocaleLowerCase('fi')).toContain('luovutus');
    expect(phases.every((phase) => phase.assigneeUserIds.length === 0)).toBe(true);
  });

  it('calculates the actual number of generated work orders', () => {
    expect(projectWorkPlanSize(15, 6)).toBe(90);
    expect(projectWorkPlanSize(-1, 5)).toBe(0);
  });
});
