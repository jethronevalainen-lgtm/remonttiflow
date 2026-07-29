import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';

export interface TimeRange {
  startTime: string;
  endTime: string;
}

function minutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return hour * 60 + minute;
}

export function hoursBetween(startTime: string, endTime: string): number {
  return Math.max(0, (minutes(endTime) - minutes(startTime)) / 60);
}

export function rangesOverlap(first: TimeRange, second: TimeRange): boolean {
  return minutes(first.startTime) < minutes(second.endTime)
    && minutes(second.startTime) < minutes(first.endTime);
}

export function hasScheduleConflict<T extends TimeRange>(items: T[]): boolean {
  return items.some((item, index) => items.slice(index + 1).some((other) => rangesOverlap(item, other)));
}

export function shiftedDate(value: string, dayDelta: number): string {
  return format(addDays(parseISO(value), dayDelta), 'yyyy-MM-dd');
}

export function shiftedWorkOrderStart(
  plannedStartDate: string,
  draggedReservationDate: string,
  targetDate: string,
): string {
  const dayDelta = differenceInCalendarDays(parseISO(targetDate), parseISO(draggedReservationDate));
  return shiftedDate(plannedStartDate, dayDelta);
}
