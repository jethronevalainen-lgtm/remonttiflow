import { describe, expect, it } from 'vitest';

import {
  appendProjectWorkTargets,
  applyAssigneesToAllTargets,
  combineWorkPlanDescription,
  createGenericProjectPhases,
  describeProjectWorkTargetAddition,
  fillMissingProjectWorkTargetDates,
  generateProjectWorkTargets,
  moveProjectWorkTarget,
  normalizeDateInput,
  normalizeProjectWorkTargets,
  previewProjectWorkTargetAddition,
  projectUnitImportToTarget,
  projectWorkPlanSize,
  resolveWorkPlanAssignees,
  spreadProjectPhaseDates,
  workOrderTitleForPlan,
} from '../projectWorkPlanBuilder';

describe('project work plan builder', () => {
  it('normalizes generic targets and preserves an optional location', () => {
    expect(normalizeProjectWorkTargets('A1 | 1. kerros\nA2\nA1 | 1. kerros')).toEqual([
      expect.objectContaining({ title: 'A1', location: '1. kerros', description: '', assigneeUserIds: [] }),
      expect.objectContaining({ title: 'A2', location: 'A2', description: '', assigneeUserIds: [] }),
    ]);
  });

  it('parses optional per-unit work notes from a third column', () => {
    expect(normalizeProjectWorkTargets('A1 | 1. kerros | Keittiö\nB2 | | Vain kylpyhuone')).toEqual([
      expect.objectContaining({
        title: 'A1',
        location: '1. kerros',
        description: 'Keittiö',
      }),
      expect.objectContaining({
        title: 'B2',
        location: 'B2',
        description: 'Vain kylpyhuone',
      }),
    ]);
  });

  it('generates a bounded target sequence', () => {
    const targets = generateProjectWorkTargets({ prefix: 'Lohko ', start: 3, count: 3, padLength: 2 });
    expect(targets.map((target) => target.title)).toEqual(['Lohko 03', 'Lohko 04', 'Lohko 05']);
    expect(targets.every((target) => target.assigneeUserIds.length === 0 && target.description === '')).toBe(true);
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

  it('prefers target assignees over phase assignees', () => {
    expect(
      resolveWorkPlanAssignees(
        { assigneeUserIds: ['a', 'b'] },
        { assigneeUserIds: ['c'] },
      ),
    ).toEqual(['a', 'b']);
    expect(
      resolveWorkPlanAssignees(
        { assigneeUserIds: [] },
        { assigneeUserIds: ['c'] },
      ),
    ).toEqual(['c']);
  });

  it('combines target and phase notes into one work-order description', () => {
    expect(
      combineWorkPlanDescription(
        { title: 'A12', description: 'Keittiö' },
        { title: 'Asennus', description: 'Kaapistot' },
      ),
    ).toBe('Kohde A12: Keittiö\n\nTyövaihe Asennus: Kaapistot');
  });

  it('builds work-order titles as target – phase', () => {
    expect(workOrderTitleForPlan({ title: 'A12' }, { title: 'Purku' })).toBe('A12 – Purku');
  });

  it('applies the same assignees to every target', () => {
    const targets = generateProjectWorkTargets({ prefix: 'H', start: 1, count: 2 });
    expect(applyAssigneesToAllTargets(targets, ['u1']).map((target) => target.assigneeUserIds)).toEqual([
      ['u1'],
      ['u1'],
    ]);
  });

  it('converts a project unit into a work target with project and unit dates', () => {
    expect(projectUnitImportToTarget({
      id: 'unit-1',
      unitCode: 'A12',
      buildingName: 'Talo 1',
      stairwellName: 'A',
      floor: '2',
      unitType: '3h+k',
      areaM2: 72.5,
      renovationScope: 'Keittiöremontti',
      plannedCompletionDate: '2026-08-14',
      notes: 'Asuttu',
    }, { startDate: '2026-08-03', endDate: '2026-08-28' })).toEqual(expect.objectContaining({
      title: 'A12',
      location: 'Talo 1 · A · 2. kerros',
      description: 'Keittiöremontti · 3h+k · 72.5 m² · Asuttu',
      startDate: '2026-08-03',
      endDate: '2026-08-14',
    }));
  });

  it('deduplicates appended targets by normalized title and location', () => {
    const current = normalizeProjectWorkTargets('A1 | 1. kerros');
    const incoming = normalizeProjectWorkTargets(' a1 |  1. KERROS  \nA1 | 2. kerros');
    const result = appendProjectWorkTargets(current, incoming);
    expect(result.targets.map((target) => `${target.title}|${target.location}`)).toEqual([
      'A1|1. kerros',
      'A1|2. kerros',
    ]);
    expect(result.addedCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
  });

  it('keeps the target list at one hundred entries when importing', () => {
    const current = generateProjectWorkTargets({ prefix: 'H', start: 1, count: 99 });
    const incoming = generateProjectWorkTargets({ prefix: 'U', start: 1, count: 3 });
    const result = appendProjectWorkTargets(current, incoming);
    expect(result.targets).toHaveLength(100);
    expect(result.addedCount).toBe(1);
    expect(result.limitReached).toBe(true);
  });

  it('accepts tab-separated rows pasted straight from a spreadsheet', () => {
    expect(normalizeProjectWorkTargets('A1\t1. kerros\tKeittiö\nA2\t2. kerros\tKylpyhuone')).toEqual([
      expect.objectContaining({ title: 'A1', location: '1. kerros', description: 'Keittiö' }),
      expect.objectContaining({ title: 'A2', location: '2. kerros', description: 'Kylpyhuone' }),
    ]);
  });

  it('accepts semicolon-separated rows without breaking pipe-separated ones', () => {
    expect(normalizeProjectWorkTargets('A1;1. kerros;Keittiö')).toEqual([
      expect.objectContaining({ title: 'A1', location: '1. kerros', description: 'Keittiö' }),
    ]);
    expect(normalizeProjectWorkTargets('A1 | Talo 1; rappu A | Keittiö')).toEqual([
      expect.objectContaining({ title: 'A1', location: 'Talo 1; rappu A', description: 'Keittiö' }),
    ]);
  });

  it('reads both ISO and Finnish dates from a pasted list', () => {
    expect(normalizeDateInput('3.8.2026')).toBe('2026-08-03');
    expect(normalizeDateInput('03.08.2026')).toBe('2026-08-03');
    expect(normalizeDateInput('2026-08-03')).toBe('2026-08-03');
    expect(normalizeDateInput('32.8.2026')).toBe('');
    expect(normalizeDateInput('elokuu')).toBe('');
    expect(normalizeProjectWorkTargets('A1 | 1. kerros | Keittiö | 3.8.2026 | 14.8.2026')).toEqual([
      expect.objectContaining({ startDate: '2026-08-03', endDate: '2026-08-14' }),
    ]);
  });

  it('fills only the missing target dates from the project schedule', () => {
    const targets = normalizeProjectWorkTargets('A1\nA2 | 2. kerros | | 2026-09-01\nA3 | | | 2026-08-05 | 2026-08-07');
    expect(fillMissingProjectWorkTargetDates(targets, '2026-08-03', '2026-08-28')).toEqual([
      expect.objectContaining({ title: 'A1', startDate: '2026-08-03', endDate: '2026-08-28' }),
      expect.objectContaining({ title: 'A2', startDate: '2026-09-01', endDate: '2026-09-01' }),
      expect.objectContaining({ title: 'A3', startDate: '2026-08-05', endDate: '2026-08-07' }),
    ]);
  });

  it('previews an addition without touching the current target list', () => {
    const current = normalizeProjectWorkTargets('A1 | 1. kerros');
    const incoming = normalizeProjectWorkTargets('A1 | 1. kerros\nA2 | 1. kerros');
    const preview = previewProjectWorkTargetAddition(current, incoming);
    expect(preview.addedCount).toBe(1);
    expect(preview.duplicateCount).toBe(1);
    expect(preview.limitReached).toBe(false);
    expect(preview.added.map((target) => target.title)).toEqual(['A2']);
    expect(current.map((target) => target.title)).toEqual(['A1']);
  });

  it('describes what the chosen addition would do in plain Finnish', () => {
    expect(describeProjectWorkTargetAddition({
      addedCount: 10,
      duplicateCount: 0,
      limitReached: false,
      added: [],
    })).toBe('Lisätään 10 uutta kohdetta.');
    expect(describeProjectWorkTargetAddition({
      addedCount: 1,
      duplicateCount: 2,
      limitReached: true,
      added: [],
    })).toBe('Lisätään 1 uusi kohde. 2 kohdetta on jo listalla. Kohdelistan 100 kohteen raja tulee vastaan.');
    expect(describeProjectWorkTargetAddition({
      addedCount: 0,
      duplicateCount: 1,
      limitReached: false,
      added: [],
    })).toBe('Ei uusia kohteita lisättäväksi. 1 kohde on jo listalla.');
  });

  it('reorders targets without changing their dates, assignees or identity', () => {
    const targets = generateProjectWorkTargets({ prefix: 'H', start: 1, count: 3 });
    const middle = {
      ...targets[1],
      startDate: '2026-08-03',
      endDate: '2026-08-14',
      assigneeUserIds: ['u1'],
    };
    const source = [targets[0], middle, targets[2]];
    const moved = moveProjectWorkTarget(source, middle.id, -1);
    expect(moved.map((target) => target.id)).toEqual([middle.id, targets[0].id, targets[2].id]);
    expect(moved[0]).toEqual(middle);
  });
});
