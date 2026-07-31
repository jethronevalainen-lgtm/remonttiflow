import { describe, expect, it } from 'vitest';

import {
  canEditSiteDiary,
  canLockSiteDiary,
  canSubmitSiteDiary,
  completionSummary,
  safeSiteDiaryFileName,
  siteDiaryStoragePath,
  type SiteDiaryCompletion,
} from '@/lib/siteDiaryRules';

const complete: SiteDiaryCompletion = {
  percent: 100,
  missing: [],
  weatherCount: 2,
  workforceCount: 4,
  workItemCount: 2,
  openCriticalCount: 0,
};

describe('site diary rules', () => {
  it('allows submission only when the draft is complete', () => {
    expect(canSubmitSiteDiary('Luonnos', complete)).toBe(true);
    expect(canSubmitSiteDiary('Tarkastettavana', complete)).toBe(false);
    expect(canSubmitSiteDiary('Luonnos', { ...complete, percent: 80, missing: ['Työvoima'] })).toBe(false);
  });

  it('keeps locked and voided diaries immutable', () => {
    expect(canEditSiteDiary('Luonnos')).toBe(true);
    expect(canEditSiteDiary('Lukittu', '2026-07-31T10:00:00Z')).toBe(false);
    expect(canEditSiteDiary('Mitätöity')).toBe(false);
  });

  it('requires a reviewed and complete diary before locking', () => {
    expect(canLockSiteDiary('Tarkastettu', complete)).toBe(true);
    expect(canLockSiteDiary('Luonnos', complete)).toBe(false);
    expect(canLockSiteDiary('Tarkastettu', { ...complete, missing: ['Säähavainnot'] })).toBe(false);
  });

  it('creates a safe tenant-scoped storage path', () => {
    const path = siteDiaryStoragePath({
      organizationId: 'org-1',
      projectId: 'project-1',
      diaryId: 'diary-1',
      attachmentId: 'attachment-1',
      fileName: 'Työmaan yleiskuva ä 1.jpg',
    });
    expect(path).toBe('org-1/project-1/diaries/diary-1/attachment-1/Tyomaan-yleiskuva-a-1.jpg');
    expect(safeSiteDiaryFileName('../../test.pdf')).toBe('..-..-test.pdf');
  });

  it('summarizes missing required data', () => {
    expect(completionSummary(complete)).toContain('Kaikki');
    expect(completionSummary({ ...complete, missing: ['Työvoima', 'Työvaiheet'] }))
      .toBe('Puuttuu: Työvoima, Työvaiheet.');
  });
});
