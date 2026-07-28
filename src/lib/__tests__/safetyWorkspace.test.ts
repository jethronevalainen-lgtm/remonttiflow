import { describe, expect, it } from 'vitest';

import {
  safetyActionReasons,
  safetyMetrics,
  selectPrimaryBriefing,
  type SafetyBriefing,
} from '@/lib/supabase/safetyWorkspace';
import type { SafetyItem } from '@/types';

const item = (overrides: Partial<SafetyItem> = {}): SafetyItem => ({
  id: 'item-1',
  type: 'risk',
  title: 'Suojaamaton aukko',
  date: '2026-07-28',
  project: 'Kohde A',
  severity: 'Keskitasoinen',
  status: 'Avoin',
  ...overrides,
});

const briefing = (overrides: Partial<SafetyBriefing> = {}): SafetyBriefing => ({
  id: 'briefing-1',
  organizationId: 'org-1',
  title: 'Päivän ohje',
  introduction: '',
  instructionItems: ['Tarkista kulkureitit.'],
  severity: 'info',
  audienceRoles: ['worker'],
  validFrom: '2026-01-01',
  validUntil: '2099-12-31',
  requiresAcknowledgement: true,
  status: 'published',
  version: 1,
  createdBy: 'user-1',
  createdAt: '2026-07-28T00:00:00Z',
  updatedAt: '2026-07-28T00:00:00Z',
  acknowledgementCount: 0,
  ...overrides,
});

describe('safety command center rules', () => {
  it('counts open, serious, overdue and verification items', () => {
    const metrics = safetyMetrics([
      item({ id: '1', severity: 'Vakava' }),
      item({ id: '2', dueDate: '2026-07-20' }),
      item({ id: '3', status: 'Ilmoitettu korjatuksi' }),
      item({ id: '4', status: 'Suljettu' }),
    ], '2026-07-28');

    expect(metrics).toEqual({ open: 3, serious: 1, overdue: 1, waitingVerification: 1 });
  });

  it('prioritizes missing assignee, overdue repairs and verification', () => {
    expect(safetyActionReasons(item({ severity: 'Vakava', dueDate: '2026-07-20' }), '2026-07-28'))
      .toEqual(['Vakava havainto', 'Korjaus myöhässä', 'Vastuuhenkilö puuttuu']);
    expect(safetyActionReasons(item({ status: 'Ilmoitettu korjatuksi', correctiveAction: '' }), '2026-07-28'))
      .toEqual(['Odottaa varmennusta', 'Korjaava toimenpide puuttuu']);
    expect(safetyActionReasons(item({ status: 'Vahvistettu' }), '2026-07-28')).toEqual([]);
  });

  it('selects a project-specific critical briefing before organization guidance', () => {
    const selected = selectPrimaryBriefing([
      briefing({ id: 'organization', severity: 'warning' }),
      briefing({ id: 'project', projectId: 'project-1', severity: 'danger' }),
      briefing({ id: 'other-project', projectId: 'project-2', severity: 'danger' }),
      briefing({ id: 'draft', status: 'draft', severity: 'danger' }),
    ], 'project-1');

    expect(selected?.id).toBe('project');
  });

  it('keeps the general workspace on organization guidance until a project is selected', () => {
    const selected = selectPrimaryBriefing([
      briefing({ id: 'organization', severity: 'warning' }),
      briefing({ id: 'project', projectId: 'project-1', severity: 'danger' }),
    ], undefined);

    expect(selected?.id).toBe('organization');
  });
});
