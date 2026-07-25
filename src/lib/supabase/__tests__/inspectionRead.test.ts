import { describe, expect, it } from 'vitest';

import { inspectionReadMappers } from '../inspectionRead';

const { asRow, num, mapInspection, mapFinding, mapAttachment } = inspectionReadMappers;

describe('inspection Supabase row mappings', () => {
  it('rejects non-record database values', () => {
    expect(() => asRow(null)).toThrow('Tietokanta palautti virheellisen tietueen.');
    expect(() => asRow([])).toThrow('Tietokanta palautti virheellisen tietueen.');
  });

  it('normalizes nullable inspection fields and numeric strings', () => {
    const inspection = mapInspection({
      id: 'inspection-1',
      organization_id: 'org-1',
      project_id: 'project-1',
      unit_id: null,
      template_version_id: 'version-1',
      title: 'Itselleluovutus',
      inspection_type: 'Huoneisto',
      status: 'Käynnissä',
      scheduled_date: null,
      inspector_id: null,
      summary: null,
      progress: '75',
      started_at: null,
      completed_at: null,
      approved_at: null,
      approved_by: null,
      report_version: null,
      created_at: '2026-07-25T10:00:00Z',
    });

    expect(inspection).toMatchObject({
      id: 'inspection-1',
      unitId: undefined,
      summary: '',
      progress: 75,
      reportVersion: 0,
    });
  });

  it('maps nullable finding and attachment values to UI-safe defaults', () => {
    const finding = mapFinding({
      id: 'finding-1',
      inspection_id: 'inspection-1',
      result_id: null,
      project_id: 'project-1',
      unit_id: null,
      title: 'Saumaus',
      description: null,
      location: null,
      category: null,
      severity: 'Merkittävä',
      status: 'Avoin',
      assignee_user_id: null,
      contractor_name: null,
      due_date: null,
      correction_note: null,
      reported_corrected_at: null,
      verified_at: null,
      rejection_reason: null,
      work_order_id: null,
      created_at: '2026-07-25T10:00:00Z',
      updated_at: '2026-07-25T10:00:00Z',
    });
    const attachment = mapAttachment({
      id: 'attachment-1',
      inspection_id: 'inspection-1',
      result_id: null,
      finding_id: null,
      object_path: 'org-1/inspection-1/file.jpg',
      file_name: 'file.jpg',
      mime_type: null,
      size_bytes: '2048',
      kind: 'Yleiskuva',
      caption: null,
      created_at: '2026-07-25T10:00:00Z',
    });

    expect(finding.description).toBe('');
    expect(finding.assigneeUserId).toBeUndefined();
    expect(attachment.mimeType).toBe('');
    expect(attachment.sizeBytes).toBe(2048);
    expect(num({ value: 'not-a-number' }, 'value')).toBe(0);
  });
});
