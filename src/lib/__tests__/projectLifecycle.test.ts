import { describe, expect, it } from 'vitest';

import {
  deriveProjectStatus,
  isRunningProjectStatus,
  localTodayIso,
  reopenProjectStatus,
} from '@/lib/projectLifecycle';

describe('project lifecycle', () => {
  const today = '2026-07-29';

  it('keeps a project planned before its start date', () => {
    expect(deriveProjectStatus({
      status: 'Suunniteltu',
      startDate: '2026-08-01',
      endDate: '2026-08-15',
    }, today)).toBe('Suunniteltu');
  });

  it('activates a project on its start date', () => {
    expect(deriveProjectStatus({
      status: 'Suunniteltu',
      startDate: today,
      endDate: '2026-08-15',
    }, today)).toBe('Aktiivinen');
  });

  it('marks an unfinished project late after its target completion date', () => {
    expect(deriveProjectStatus({
      status: 'Aktiivinen',
      startDate: '2026-07-01',
      endDate: '2026-07-28',
    }, today)).toBe('Myöhässä');
  });

  it('does not mark a project late on the target completion date itself', () => {
    expect(deriveProjectStatus({
      status: 'Aktiivinen',
      startDate: '2026-07-01',
      endDate: today,
    }, today)).toBe('Aktiivinen');
  });

  it('preserves the explicit completed state regardless of dates', () => {
    expect(deriveProjectStatus({
      status: 'Valmis',
      startDate: '2026-08-01',
      endDate: '2026-07-01',
    }, today)).toBe('Valmis');
  });

  it('recalculates the status when a completed project is reopened', () => {
    expect(reopenProjectStatus({
      startDate: '2026-07-01',
      endDate: '2026-07-28',
    }, today)).toBe('Myöhässä');
  });

  it('treats active and late projects as running', () => {
    expect(isRunningProjectStatus('Aktiivinen')).toBe(true);
    expect(isRunningProjectStatus('Myöhässä')).toBe(true);
    expect(isRunningProjectStatus('Suunniteltu')).toBe(false);
    expect(isRunningProjectStatus('Valmis')).toBe(false);
  });

  it('formats the local date without a UTC conversion', () => {
    expect(localTodayIso(new Date(2026, 6, 9, 23, 30))).toBe('2026-07-09');
  });
});
