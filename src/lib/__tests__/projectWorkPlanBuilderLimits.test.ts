import { describe, expect, it } from 'vitest';

import {
  generateProjectWorkTargets,
  mergeProjectWorkTargets,
  normalizeProjectWorkTargets,
  parseProjectWorkTargetsCsv,
  projectWorkPlanSize,
} from '../projectWorkPlanBuilder';

describe('project work plan limits', () => {
  it('returns no targets for an empty pasted list', () => {
    expect(normalizeProjectWorkTargets('\n   \n')).toEqual([]);
  });

  it('removes exact duplicate target and location pairs', () => {
    const targets = normalizeProjectWorkTargets([
      'Rakennus A | Pohjoisjulkisivu',
      'Rakennus A | Pohjoisjulkisivu',
      'Rakennus A | Eteläjulkisivu',
    ].join('\n'));

    expect(targets).toHaveLength(2);
    expect(targets.map((target) => target.location)).toEqual([
      'Pohjoisjulkisivu',
      'Eteläjulkisivu',
    ]);
  });

  it('limits generated target sequences to one hundred targets', () => {
    const targets = generateProjectWorkTargets({
      prefix: 'Alue ',
      start: 1,
      count: 250,
    });

    expect(targets).toHaveLength(100);
    expect(targets[0].title).toBe('Alue 1');
    expect(targets[99].title).toBe('Alue 100');
  });

  it('caps merges at one hundred and reports skipped overflow', () => {
    const existing = generateProjectWorkTargets({ prefix: 'A', start: 1, count: 98 });
    const result = mergeProjectWorkTargets(
      existing,
      generateProjectWorkTargets({ prefix: 'B', start: 1, count: 5 }),
    );
    expect(result.targets).toHaveLength(100);
    expect(result.added).toBe(2);
    expect(result.skippedLimit).toBe(3);
  });

  it('returns no targets for blank CSV input', () => {
    expect(parseProjectWorkTargetsCsv(' \n\t\n')).toEqual([]);
  });

  it('exposes the work-order multiplication before database creation', () => {
    expect(projectWorkPlanSize(100, 5)).toBe(500);
    expect(projectWorkPlanSize(100, 6)).toBe(600);
  });
});
