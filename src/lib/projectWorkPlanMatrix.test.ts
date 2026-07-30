import { describe, expect, it } from 'vitest';

import {
  buildInternalResourceConflicts,
  buildScheduleWarnings,
  scheduleAllAssignments,
  setAllPhasesForTarget,
  synchronizeWorkAssignments,
  type ProjectWorkPhaseDraft,
  type ProjectWorkTargetDraft,
} from './projectWorkPlanBuilder';

const targets: ProjectWorkTargetDraft[] = [
  {
    id: 'target-a1',
    key: 'a1',
    title: 'A1',
    location: '1. kerros',
    description: '',
    startDate: '2026-08-03',
    endDate: '2026-08-14',
    assigneeUserIds: ['worker-1'],
  },
  {
    id: 'target-a2',
    key: 'a2',
    title: 'A2',
    location: '1. kerros',
    description: '',
    startDate: '2026-08-03',
    endDate: '2026-08-14',
    assigneeUserIds: ['worker-1'],
  },
];

const phases: ProjectWorkPhaseDraft[] = [
  {
    id: 'phase-prep',
    key: 'prep',
    title: 'Valmistelu',
    type: 'Valmistelu',
    description: '',
    startDate: '',
    endDate: '',
    durationWorkdays: 2,
    startTime: '07:00',
    endTime: '15:30',
    weekdays: [1, 2, 3, 4, 5],
    priority: 'Normaali',
    assigneeUserIds: [],
  },
  {
    id: 'phase-install',
    key: 'install',
    title: 'Asennus',
    type: 'Asennus',
    description: '',
    startDate: '',
    endDate: '',
    durationWorkdays: 3,
    startTime: '07:00',
    endTime: '15:30',
    weekdays: [1, 2, 3, 4, 5],
    priority: 'Normaali',
    assigneeUserIds: [],
  },
];

describe('project work plan matrix', () => {
  it('luo matriisin ja sallii työvaiheen poistamisen vain yhdeltä kohteelta', () => {
    const matrix = synchronizeWorkAssignments(targets, phases);
    const changed = setAllPhasesForTarget(matrix, 'target-a2', false).map((item) => (
      item.targetId === 'target-a2' && item.phaseId === 'phase-install'
        ? { ...item, enabled: true }
        : item
    ));

    expect(changed.filter((item) => item.targetId === 'target-a1' && item.enabled)).toHaveLength(2);
    expect(changed.filter((item) => item.targetId === 'target-a2' && item.enabled)).toHaveLength(1);
  });

  it('jaksottaa vain valitut työvaiheet kohteen aloituksesta', () => {
    const matrix = synchronizeWorkAssignments([targets[0]], phases);
    const scheduled = scheduleAllAssignments([targets[0]], phases, matrix);

    expect(scheduled.map((item) => ({ phaseId: item.phaseId, start: item.startDate, end: item.endDate }))).toEqual([
      { phaseId: 'phase-prep', start: '2026-08-03', end: '2026-08-04' },
      { phaseId: 'phase-install', start: '2026-08-05', end: '2026-08-07' },
    ]);
    expect(buildScheduleWarnings([targets[0]], phases, scheduled)).toEqual([]);
  });

  it('havaitsee saman tekijän päällekkäiset kohteet samana päivänä', () => {
    const matrix = synchronizeWorkAssignments(targets, [phases[0]]);
    const scheduled = scheduleAllAssignments(targets, [phases[0]], matrix);
    const conflicts = buildInternalResourceConflicts(targets, [phases[0]], scheduled);

    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0]).toMatchObject({ userId: 'worker-1', date: '2026-08-03' });
  });
});
