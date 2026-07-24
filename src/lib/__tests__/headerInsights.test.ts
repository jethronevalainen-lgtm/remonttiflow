import { describe, expect, it } from 'vitest';

import { buildHeaderAlerts, filterHeaderRoutes } from '@/lib/headerInsights';

describe('buildHeaderAlerts', () => {
  it('creates alerts only from actionable live records', () => {
    const alerts = buildHeaderAlerts(
      {
        workOrders: [
          { dueDate: '2026-07-20', status: 'Avoin' },
          { dueDate: '2026-07-19', status: 'Valmis' },
        ],
        timeEntries: [
          { status: 'Odottaa' },
          { status: 'Hyväksytty' },
        ],
        safetyItems: [
          { severity: 'Vakava', status: 'Avoin' },
          { severity: 'Vakava', status: 'Korjattu' },
        ],
        projects: [
          { budget: 10_000, spent: 10_001 },
          { budget: 0, spent: 5_000 },
        ],
      },
      new Date('2026-07-24T12:00:00'),
    );

    expect(alerts.map((alert) => alert.id)).toEqual([
      'overdue-work-orders',
      'pending-time-entries',
      'serious-safety-items',
      'over-budget-projects',
    ]);
    expect(alerts[0].title).toContain('1');
  });

  it('returns no alerts when there is nothing actionable', () => {
    expect(
      buildHeaderAlerts(
        {
          workOrders: [{ dueDate: '2026-07-30', status: 'Avoin' }],
          timeEntries: [{ status: 'Hyväksytty' }],
          safetyItems: [{ severity: 'Lievä', status: 'Avoin' }],
          projects: [{ budget: 10_000, spent: 9_000 }],
        },
        new Date('2026-07-24T12:00:00'),
      ),
    ).toEqual([]);
  });
});

describe('filterHeaderRoutes', () => {
  const routes = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/hallinta', label: 'Organisaation hallinta' },
    { path: '/tuntikirjaukset', label: 'Tuntikirjaukset' },
  ];

  it('filters by text and allowed role paths', () => {
    expect(
      filterHeaderRoutes(
        routes,
        ['/dashboard', '/tuntikirjaukset'],
        'tunti',
      ),
    ).toEqual([{ path: '/tuntikirjaukset', label: 'Tuntikirjaukset' }]);
  });

  it('does not expose disallowed routes in search results', () => {
    expect(
      filterHeaderRoutes(routes, ['/dashboard'], 'hallinta'),
    ).toEqual([]);
  });

  it('returns an empty list for blank searches', () => {
    expect(filterHeaderRoutes(routes, routes.map((route) => route.path), '  ')).toEqual([]);
  });
});
