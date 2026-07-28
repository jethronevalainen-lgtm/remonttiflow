import { getISODay, parseISO } from 'date-fns';

import type { ProjectMembership, ManagedWorkOrder } from '@/lib/supabase/workManagement';
import type { WorkAssignmentScope, WorkOrderPriority, WorkOrderStatus } from '@/types';

export type CalendarBookingKind = 'manual' | 'work_order_existing' | 'work_order_new';

export interface CalendarWorkOrderScheduleInput {
  date: string;
  startTime: string;
  endTime: string;
}

/** Payload subset accepted by `saveManagedWorkOrder`. */
export interface CalendarWorkOrderSaveValues {
  workOrderId?: string;
  projectId?: string;
  title: string;
  location?: string;
  dueDate?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  plannedStartTime?: string;
  plannedEndTime?: string;
  plannedWeekdays: number[];
  calendarSyncEnabled: boolean;
  occupancyStatus: ManagedWorkOrder['occupancyStatus'];
  workReference?: string;
  startConstraints?: string;
  accessNotes?: string;
  residentNotificationRequired: boolean;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  description?: string;
  type?: string;
  assignmentScope: WorkAssignmentScope;
  assigneeUserIds: string[];
}

const CLOSED_STATUSES = new Set<WorkOrderStatus>(['Valmis', 'Peruttu']);

export function isoWeekdayFromDate(date: string): number {
  return getISODay(parseISO(date));
}

export function isOpenWorkOrderStatus(status: WorkOrderStatus): boolean {
  return !CLOSED_STATUSES.has(status);
}

export function canAssignUserToWorkOrder(
  order: Pick<ManagedWorkOrder, 'status' | 'projectId'>,
  userId: string,
  projectMemberships: ProjectMembership[],
): boolean {
  if (!userId || !isOpenWorkOrderStatus(order.status)) return false;
  if (!order.projectId) return true;
  return projectMemberships.some(
    (membership) => membership.projectId === order.projectId && membership.userId === userId,
  );
}

export function filterAssignableWorkOrdersForCalendar(options: {
  workOrders: ManagedWorkOrder[];
  userId: string;
  projectMemberships: ProjectMembership[];
  search?: string;
}): ManagedWorkOrder[] {
  const needle = options.search?.trim().toLocaleLowerCase('fi') ?? '';
  return options.workOrders
    .filter((order) => canAssignUserToWorkOrder(order, options.userId, options.projectMemberships))
    .filter((order) => {
      if (!needle) return true;
      const haystack = [
        order.title,
        order.project,
        order.location,
        order.workReference,
        order.status,
        ...order.assigneeNames,
      ].join(' ').toLocaleLowerCase('fi');
      return haystack.includes(needle);
    })
    .sort((a, b) => {
      const aUnassigned = a.assignmentScope === 'people' && a.assigneeUserIds.length === 0 ? 0 : 1;
      const bUnassigned = b.assignmentScope === 'people' && b.assigneeUserIds.length === 0 ? 0 : 1;
      if (aUnassigned !== bUnassigned) return aUnassigned - bUnassigned;
      return a.title.localeCompare(b.title, 'fi');
    });
}

export function mergeAssigneeUserIds(
  order: Pick<ManagedWorkOrder, 'assignmentScope' | 'assigneeUserIds'>,
  userId: string,
): string[] {
  const base = order.assignmentScope === 'people' ? order.assigneeUserIds : [];
  return [...new Set([...base, userId].filter(Boolean))];
}

/**
 * Expands (or creates) the planned schedule so the selected calendar day is covered,
 * without changing daily times of an already-scheduled work order.
 */
export function resolveScheduleForCalendarDay(
  order: Pick<
    ManagedWorkOrder,
    'plannedStartDate' | 'plannedEndDate' | 'plannedStartTime' | 'plannedEndTime' | 'plannedWeekdays'
  >,
  input: CalendarWorkOrderScheduleInput,
): Pick<
  CalendarWorkOrderSaveValues,
  'plannedStartDate' | 'plannedEndDate' | 'plannedStartTime' | 'plannedEndTime' | 'plannedWeekdays'
> {
  const weekday = isoWeekdayFromDate(input.date);
  const hadSchedule = Boolean(order.plannedStartDate && order.plannedEndDate);

  let plannedStartDate = order.plannedStartDate || input.date;
  let plannedEndDate = order.plannedEndDate || input.date;
  if (input.date < plannedStartDate) plannedStartDate = input.date;
  if (input.date > plannedEndDate) plannedEndDate = input.date;

  const plannedWeekdays = [...new Set([
    ...(hadSchedule ? order.plannedWeekdays : []),
    weekday,
  ])].sort((a, b) => a - b);

  return {
    plannedStartDate,
    plannedEndDate,
    plannedStartTime: hadSchedule ? (order.plannedStartTime || '07:00') : input.startTime,
    plannedEndTime: hadSchedule ? (order.plannedEndTime || '15:30') : input.endTime,
    plannedWeekdays,
  };
}

export function buildAssignInstallerToWorkOrderValues(
  order: ManagedWorkOrder,
  userId: string,
  input: CalendarWorkOrderScheduleInput,
): CalendarWorkOrderSaveValues {
  const schedule = resolveScheduleForCalendarDay(order, input);
  return {
    workOrderId: order.id,
    projectId: order.projectId,
    title: order.title,
    location: order.location || undefined,
    dueDate: order.dueDate || undefined,
    ...schedule,
    calendarSyncEnabled: true,
    occupancyStatus: order.occupancyStatus,
    workReference: order.workReference || undefined,
    startConstraints: order.startConstraints || undefined,
    accessNotes: order.accessNotes || undefined,
    residentNotificationRequired: order.residentNotificationRequired,
    priority: order.priority,
    status: order.status === 'Avoin' ? 'Avoin' : order.status,
    description: order.description || undefined,
    type: order.type || undefined,
    assignmentScope: 'people',
    assigneeUserIds: mergeAssigneeUserIds(order, userId),
  };
}

export function buildCreateWorkOrderFromCalendarValues(options: {
  title: string;
  userId: string;
  projectId?: string;
  description?: string;
  type?: string;
  input: CalendarWorkOrderScheduleInput;
}): CalendarWorkOrderSaveValues {
  const weekday = isoWeekdayFromDate(options.input.date);
  return {
    projectId: options.projectId || undefined,
    title: options.title.trim(),
    description: options.description?.trim() || undefined,
    type: options.type?.trim() || undefined,
    plannedStartDate: options.input.date,
    plannedEndDate: options.input.date,
    plannedStartTime: options.input.startTime,
    plannedEndTime: options.input.endTime,
    plannedWeekdays: [weekday],
    calendarSyncEnabled: true,
    occupancyStatus: 'unknown',
    residentNotificationRequired: false,
    priority: 'Normaali',
    status: 'Avoin',
    assignmentScope: 'people',
    assigneeUserIds: [options.userId],
  };
}

export function parseCalendarBookingKind(value: string): CalendarBookingKind {
  if (value === 'work_order_existing' || value === 'work_order_new' || value === 'manual') return value;
  return 'manual';
}
