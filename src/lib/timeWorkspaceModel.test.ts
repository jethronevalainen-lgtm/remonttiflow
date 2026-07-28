import { describe, expect, it } from 'vitest';

import { formatWorkDuration, groupTimeEntriesByDay, summarizeEntriesByProject } from '@/lib/timeWorkspaceModel';
import type { TimeWorkspaceEntry } from '@/lib/supabase/timeWorkspace';

function entry(patch: Partial<TimeWorkspaceEntry>): TimeWorkspaceEntry {
  return {
    id: 'entry-1', userId: 'user-1', employeeId: 'employee-1', employeeName: 'Testaaja',
    date: '2026-07-28', projectId: 'project-1', projectName: 'Kohde A', workOrderId: '',
    workOrderTitle: '', hours: 4, overtime: 0, breakMinutes: 15, breakSource: 'automatic',
    startTime: '07:00:00', endTime: '11:15:00', description: '', status: 'Hyväksytty',
    source: 'work_order', rejectionReason: '', lockedAt: '', payrollPeriodId: '', approvedAt: '',
    createdAt: '2026-07-28T11:15:00Z',
    ...patch,
  };
}

describe('time workspace model', () => {
  it('groups a persons daily allocations into one approval unit', () => {
    const days = groupTimeEntriesByDay([
      entry({ id: 'one' }),
      entry({ id: 'two', hours: 3.5, projectId: 'project-2', projectName: 'Kohde B', startTime: '11:30:00', endTime: '15:00:00', status: 'Odottaa' }),
    ]);
    expect(days).toHaveLength(1);
    expect(days[0].totalHours).toBe(7.5);
    expect(days[0].status).toBe('Odottaa');
    expect(days[0].projectNames).toEqual(['Kohde A', 'Kohde B']);
  });

  it('uses rejected as the strongest daily status and exposes locks', () => {
    const [day] = groupTimeEntriesByDay([
      entry({ id: 'one', status: 'Odottaa' }),
      entry({ id: 'two', status: 'Hylätty', lockedAt: '2026-07-29T10:00:00Z' }),
    ]);
    expect(day.status).toBe('Hylätty');
    expect(day.locked).toBe(true);
  });

  it('summarizes project hours and pending work', () => {
    const summaries = summarizeEntriesByProject([
      entry({ id: 'one' }),
      entry({ id: 'two', hours: 2, status: 'Odottaa', userId: 'user-2' }),
    ]);
    expect(summaries[0]).toMatchObject({ totalHours: 6, pendingHours: 2, employeeCount: 2 });
  });

  it('formats an active duration', () => {
    expect(formatWorkDuration('2026-07-28T07:00:00.000Z', Date.parse('2026-07-28T08:02:03.000Z'))).toBe('01:02:03');
  });
});
