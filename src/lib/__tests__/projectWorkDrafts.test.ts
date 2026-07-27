import { describe, expect, it } from 'vitest';

import {
  createProjectWorkDrafts,
  generateProjectWorkLabels,
  normalizeProjectWorkLines,
} from '@/lib/projectWorkDrafts';

describe('project work draft helpers', () => {
  it('normalizes pasted work labels and removes duplicates', () => {
    expect(normalizeProjectWorkLines('A1\n A2 \na1\n\nB3')).toEqual(['A1', 'A2', 'B3']);
  });

  it('generates a bounded numbered sequence', () => {
    expect(generateProjectWorkLabels({ prefix: 'A', start: 1, count: 3 })).toEqual(['A1', 'A2', 'A3']);
    expect(generateProjectWorkLabels({ prefix: 'K-', start: 8, count: 2, padLength: 2 })).toEqual(['K-08', 'K-09']);
  });

  it('builds project work drafts with a shared title prefix and installer', () => {
    expect(createProjectWorkDrafts(['A1', 'A2'], 'Keittiö', 'user-1')).toMatchObject([
      { title: 'Keittiö A1', location: 'A1', assigneeUserId: 'user-1' },
      { title: 'Keittiö A2', location: 'A2', assigneeUserId: 'user-1' },
    ]);
  });
});
