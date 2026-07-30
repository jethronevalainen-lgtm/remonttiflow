import { describe, expect, it } from 'vitest';

import {
  buildTargetPhaseSchedule,
  generateProjectWorkTargets,
  normalizeProjectWorkTargets,
  type ProjectWorkPhaseDraft,
} from './projectWorkPlanBuilder';

const phases: ProjectWorkPhaseDraft[] = [
  {
    id: 'phase-1',
    title: 'Purku',
    type: 'Purku',
    description: '',
    startDate: '2026-08-03',
    endDate: '2026-08-04',
    priority: 'Normaali',
    assigneeUserIds: ['worker-1'],
  },
  {
    id: 'phase-2',
    title: 'Asennus',
    type: 'Asennus',
    description: '',
    startDate: '2026-08-05',
    endDate: '2026-08-07',
    priority: 'Normaali',
    assigneeUserIds: ['worker-1'],
  },
];

describe('projectWorkPlanBuilder target schedules', () => {
  it('lukee kohteen aloitus- ja valmistumispäivän liitetystä listasta', () => {
    const result = normalizeProjectWorkTargets(
      'A1 | 1. kerros | Keittiöremontti | 2026-08-03 | 2026-08-14',
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: 'A1',
      location: '1. kerros',
      description: 'Keittiöremontti',
      startDate: '2026-08-03',
      endDate: '2026-08-14',
    });
  });

  it('muodostaa numerosarjan peräkkäisille työpäiväjaksoille ja ohittaa viikonlopun', () => {
    const result = generateProjectWorkTargets({
      prefix: 'A',
      start: 1,
      count: 2,
      firstStartDate: '2026-08-03',
      workdayDuration: 5,
      gapWorkdays: 0,
    });

    expect(result.map((target) => ({
      title: target.title,
      startDate: target.startDate,
      endDate: target.endDate,
    }))).toEqual([
      { title: 'A 1', startDate: '2026-08-03', endDate: '2026-08-07' },
      { title: 'A 2', startDate: '2026-08-10', endDate: '2026-08-14' },
    ]);
  });

  it('jakaa kohteen todellisen aikavälin työvaiheiden järjestykseen', () => {
    const schedule = buildTargetPhaseSchedule(
      { startDate: '2026-08-17', endDate: '2026-08-28' },
      phases,
    );

    expect(schedule).toEqual([
      { startDate: '2026-08-17', endDate: '2026-08-22' },
      { startDate: '2026-08-23', endDate: '2026-08-28' },
    ]);
  });

  it('käyttää työvaiheen oletuspäiviä, jos kohdekohtaista aikataulua ei ole', () => {
    expect(buildTargetPhaseSchedule({ startDate: '', endDate: '' }, phases)).toEqual([
      { startDate: '2026-08-03', endDate: '2026-08-04' },
      { startDate: '2026-08-05', endDate: '2026-08-07' },
    ]);
  });
});
