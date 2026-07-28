import { describe, expect, it } from 'vitest';

import {
  buildAssignInstallerToWorkOrderValues,
  buildCreateWorkOrderFromCalendarValues,
  canAssignUserToWorkOrder,
  filterAssignableWorkOrdersForCalendar,
  isoWeekdayFromDate,
  mergeAssigneeUserIds,
  resolveScheduleForCalendarDay,
} from '@/lib/calendarWorkOrderBooking';
import type { ManagedWorkOrder } from '@/lib/supabase/workManagement';

function order(overrides: Partial<ManagedWorkOrder> = {}): ManagedWorkOrder {
  return {
    id: 'wo-1',
    project: 'Yksittäinen työ',
    location: '',
    title: 'Keittiöremontti',
    dueDate: '',
    plannedStartDate: '',
    plannedEndDate: '',
    plannedStartTime: '07:00',
    plannedEndTime: '15:30',
    plannedWeekdays: [1, 2, 3, 4, 5],
    calendarSyncEnabled: true,
    occupancyStatus: 'unknown',
    workReference: '',
    startConstraints: '',
    accessNotes: '',
    residentNotificationRequired: false,
    priority: 'Normaali',
    status: 'Avoin',
    description: '',
    type: '',
    assignmentScope: 'people',
    assigneeUserIds: [],
    assigneeNames: [],
    workerNote: '',
    completionRequestNote: '',
    completionReviewNote: '',
    completionApproved: false,
    workPackageKey: '',
    workPackageTitle: '',
    phaseOrder: 0,
    phaseGateEnabled: true,
    ...overrides,
  };
}

describe('calendarWorkOrderBooking', () => {
  it('maps ISO weekday from date', () => {
    expect(isoWeekdayFromDate('2026-07-27')).toBe(1);
    expect(isoWeekdayFromDate('2026-08-01')).toBe(6);
  });

  it('blocks closed work orders and non-members of project WOs', () => {
    expect(canAssignUserToWorkOrder(order({ status: 'Valmis' }), 'u1', [])).toBe(false);
    expect(canAssignUserToWorkOrder(order({ projectId: 'p1' }), 'u1', [])).toBe(false);
    expect(canAssignUserToWorkOrder(
      order({ projectId: 'p1' }),
      'u1',
      [{ projectId: 'p1', userId: 'u1' }],
    )).toBe(true);
    expect(canAssignUserToWorkOrder(order(), 'u1', [])).toBe(true);
  });

  it('prefers unassigned open orders in filter sort and matches search', () => {
    const list = filterAssignableWorkOrdersForCalendar({
      userId: 'u1',
      projectMemberships: [],
      search: 'keittiö',
      workOrders: [
        order({ id: 'a', title: 'Keittiö A', assigneeUserIds: ['u2'] }),
        order({ id: 'b', title: 'Keittiö B', assigneeUserIds: [] }),
        order({ id: 'c', title: 'Kylpyhuone', assigneeUserIds: [] }),
        order({ id: 'd', title: 'Keittiö suljettu', status: 'Peruttu' }),
      ],
    });
    expect(list.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('merges assignees and switches project_team to explicit people list', () => {
    expect(mergeAssigneeUserIds(order({ assigneeUserIds: ['u2'] }), 'u1')).toEqual(['u2', 'u1']);
    expect(mergeAssigneeUserIds(
      order({ assignmentScope: 'project_team', assigneeUserIds: ['u9'] }),
      'u1',
    )).toEqual(['u1']);
  });

  it('creates single-day schedule for unschedulded work order using form times', () => {
    expect(resolveScheduleForCalendarDay(order(), {
      date: '2026-07-28',
      startTime: '08:00',
      endTime: '16:00',
    })).toEqual({
      plannedStartDate: '2026-07-28',
      plannedEndDate: '2026-07-28',
      plannedStartTime: '08:00',
      plannedEndTime: '16:00',
      plannedWeekdays: [2],
    });
  });

  it('expands existing schedule without changing daily times', () => {
    expect(resolveScheduleForCalendarDay(order({
      plannedStartDate: '2026-07-27',
      plannedEndDate: '2026-07-29',
      plannedStartTime: '07:00',
      plannedEndTime: '15:30',
      plannedWeekdays: [1, 2, 3],
    }), {
      date: '2026-07-31',
      startTime: '09:00',
      endTime: '17:00',
    })).toEqual({
      plannedStartDate: '2026-07-27',
      plannedEndDate: '2026-07-31',
      plannedStartTime: '07:00',
      plannedEndTime: '15:30',
      plannedWeekdays: [1, 2, 3, 5],
    });
  });

  it('builds assign and create payloads for saveManagedWorkOrder', () => {
    const assigned = buildAssignInstallerToWorkOrderValues(
      order({ id: 'wo-9', title: 'Tilaus 12', assigneeUserIds: [] }),
      'installer-1',
      { date: '2026-07-28', startTime: '07:00', endTime: '15:30' },
    );
    expect(assigned.workOrderId).toBe('wo-9');
    expect(assigned.assigneeUserIds).toEqual(['installer-1']);
    expect(assigned.assignmentScope).toBe('people');
    expect(assigned.calendarSyncEnabled).toBe(true);
    expect(assigned.plannedStartDate).toBe('2026-07-28');

    const created = buildCreateWorkOrderFromCalendarValues({
      title: '  Uusi keikka  ',
      userId: 'installer-1',
      projectId: 'p1',
      description: 'Huomio',
      input: { date: '2026-07-28', startTime: '07:00', endTime: '15:30' },
    });
    expect(created.title).toBe('Uusi keikka');
    expect(created.assigneeUserIds).toEqual(['installer-1']);
    expect(created.plannedWeekdays).toEqual([2]);
    expect(created.projectId).toBe('p1');
  });
});
