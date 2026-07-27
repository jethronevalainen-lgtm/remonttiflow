import { describe, expect, it } from 'vitest';

import { enrichReportDataset } from '@/lib/reportInsights';
import type { ReportCenterContext, ReportCenterDataset, ReportCenterType } from '@/lib/supabase/reportCenter';

const context: ReportCenterContext = {
  organizationName: 'Testiorganisaatio',
  periodLabel: '1.7.2026–31.7.2026',
  projectLabel: 'Kaikki projektit',
  peopleLabel: 'Kaikki henkilöt',
  statusLabel: 'Kaikki tilat',
};

function dataset(reportType: ReportCenterType, rows: ReportCenterDataset['rows']): ReportCenterDataset {
  return {
    reportType,
    title: 'Testiraportti',
    dateFrom: '2026-07-01',
    dateTo: '2026-07-31',
    generatedAt: '2026-07-27T09:00:00.000Z',
    organizationId: 'org-1',
    projectId: null,
    columns: [],
    rows,
    summary: { rowCount: rows.length },
  };
}

describe('report center decision support', () => {
  it('finds unresolved time-entry issues and groups total hours', () => {
    const result = enrichReportDataset(dataset('time_entries', [
      { employee: 'Anna', project: 'Kohde A', hours: 7.5, overtime: 0.5, status: 'Hyväksytty', description: 'Keittiön purkutyöt' },
      { employee: 'Anna', project: 'Kohde A', hours: 8, overtime: 0, status: 'Odottaa', description: '' },
      { employee: 'Mikko', project: 'Kohde B', hours: 6, overtime: 1, status: 'Hylätty', description: 'Laatoitus' },
    ]), context);

    expect(result.summary).toMatchObject({
      totalRecordedHours: 23,
      approvedRows: 1,
      pendingRows: 1,
      rejectedRows: 1,
      missingDescriptions: 1,
      approvalRate: 33.3,
    });
    expect(result.insights?.map((item) => item.id)).toEqual(expect.arrayContaining([
      'rejected-time-entries',
      'pending-time-entries',
      'missing-time-descriptions',
    ]));
    expect(result.breakdowns?.[0].rows[0]).toEqual({ label: 'Anna', value: 16 });
  });

  it('separates overdue and upcoming equipment maintenance', () => {
    const result = enrichReportDataset(dataset('equipment', [
      { name: 'Porakone', status: 'Käytössä', project: 'Kohde A', responsible: '', nextMaintenance: '2026-07-20' },
      { name: 'Pölynimuri', status: 'Huollossa', project: '', responsible: 'Anna', nextMaintenance: '2026-08-10' },
      { name: 'Sirkkeli', status: 'Vapaa', project: '', responsible: 'Mikko', nextMaintenance: '2026-10-01' },
    ]), { ...context, periodLabel: 'Nykytilanne' });

    expect(result.summary).toMatchObject({
      overdueMaintenance: 1,
      dueSoonMaintenance: 1,
      unassignedEquipment: 1,
      inMaintenance: 1,
    });
    expect(result.insights?.[0]).toMatchObject({ id: 'overdue-maintenance', severity: 'critical' });
  });

  it('identifies budget and schedule risks in project reporting', () => {
    const result = enrichReportDataset(dataset('projects', [
      { name: 'Kohde A', status: 'Myöhässä', budgetEur: 10000, spentEur: 12500, pendingHours: 12, openWorkOrders: 4 },
      { name: 'Kohde B', status: 'Aktiivinen', budgetEur: 20000, spentEur: 15000, pendingHours: 0, openWorkOrders: 1 },
    ]), context);

    expect(result.summary).toMatchObject({
      overBudgetProjects: 1,
      overBudgetEur: 2500,
      delayedProjects: 1,
      pendingHours: 12,
      openWorkOrders: 5,
    });
    expect(result.breakdowns?.find((item) => item.id === 'project-budget')?.rows[0]).toMatchObject({
      label: 'Kohde B',
      value: 15000,
      secondaryValue: 20000,
    });
  });

  it('returns an explicit empty-state analysis without inventing findings', () => {
    const result = enrichReportDataset(dataset('travel_expenses', []), context);

    expect(result.summary).toEqual({ rowCount: 0 });
    expect(result.insights).toEqual([expect.objectContaining({ id: 'empty-report', severity: 'info' })]);
    expect(result.breakdowns).toEqual([]);
  });
});
