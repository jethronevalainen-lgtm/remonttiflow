import { describe, expect, it } from 'vitest';

import {
  hasScheduleConflict,
  hoursBetween,
  shiftedDate,
  shiftedWorkOrderStart,
} from '@/lib/resourceCalendar';

describe('resource calendar calculations', () => {
  it('calculates daily planned hours', () => {
    expect(hoursBetween('07:00', '15:30')).toBe(8.5);
    expect(hoursBetween('15:30', '07:00')).toBe(0);
  });

  it('detects overlapping reservations but accepts adjacent reservations', () => {
    expect(hasScheduleConflict([
      { startTime: '07:00', endTime: '12:00' },
      { startTime: '11:30', endTime: '15:30' },
    ])).toBe(true);

    expect(hasScheduleConflict([
      { startTime: '07:00', endTime: '12:00' },
      { startTime: '12:00', endTime: '15:30' },
    ])).toBe(false);
  });

  it('copies a date forward by days', () => {
    expect(shiftedDate('2026-08-03', 7)).toBe('2026-08-10');
  });

  it('moves the full work-order period by the dragged reservation delta', () => {
    expect(shiftedWorkOrderStart('2026-08-03', '2026-08-05', '2026-08-07'))
      .toBe('2026-08-05');
  });
});
