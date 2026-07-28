import { describe, expect, it } from 'vitest';

import { derivePhaseProgress, derivePhaseStatus } from '@/lib/phaseProgress';

const base = {
  endDate: '2099-01-01',
  status: 'Suunniteltu' as const,
  workOrderCount: 0,
  completedWorkOrderCount: 0,
  activeWorkOrderCount: 0,
  storedProgress: 0,
};

describe('derivePhaseProgress', () => {
  it('shows no percentage when the phase has no linked work orders', () => {
    const view = derivePhaseProgress(base);
    expect(view.percent).toBeNull();
    expect(view.trackedByWorkOrders).toBe(false);
    expect(view.label).toBe('Ei työmääräyksiä');
  });

  it('computes percentage from completed work orders', () => {
    const view = derivePhaseProgress({
      ...base,
      workOrderCount: 4,
      completedWorkOrderCount: 1,
      activeWorkOrderCount: 1,
      storedProgress: 99,
    });
    expect(view.percent).toBe(25);
    expect(view.detail).toContain('1/4');
    expect(view.status).toBe('Käynnissä');
  });

  it('marks phase complete when every work order is finished', () => {
    const view = derivePhaseProgress({
      ...base,
      workOrderCount: 2,
      completedWorkOrderCount: 2,
    });
    expect(view.percent).toBe(100);
    expect(view.status).toBe('Valmis');
  });
});

describe('derivePhaseStatus', () => {
  it('marks overdue schedule phases without inventing progress', () => {
    expect(derivePhaseStatus({ ...base, endDate: '2020-01-01' }, '2026-07-28')).toBe('Myöhässä');
  });

  it('prefers overdue over in-progress when the deadline has passed', () => {
    expect(derivePhaseStatus({
      ...base,
      endDate: '2020-01-01',
      workOrderCount: 3,
      completedWorkOrderCount: 1,
      activeWorkOrderCount: 1,
    }, '2026-07-28')).toBe('Myöhässä');
  });
});
