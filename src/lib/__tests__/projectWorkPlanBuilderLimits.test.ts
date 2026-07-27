import { describe, expect, it } from 'vitest';

import {
  generateProjectWorkTargets,
  normalizeProjectWorkTargets,
  projectWorkPlanSize,
} from '../projectWorkPlanBuilder';

describe('project work plan limits', () => {
  it('returns no targets for an empty pasted list', () => {
    expect(normalizeProjectWorkTargets('\n   \n')).toEqual([]);
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

  it('exposes the work-order multiplication before database creation', () => {
    expect(projectWorkPlanSize(100, 5)).toBe(500);
    expect(projectWorkPlanSize(100, 6)).toBe(600);
  });
});
