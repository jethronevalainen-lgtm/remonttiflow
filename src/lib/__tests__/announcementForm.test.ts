import { describe, expect, it } from 'vitest';

import {
  buildAnnouncementPlacements,
  buildAnnouncementTargets,
  localDateTimeToIso,
  statusForPublishMode,
  validateAnnouncementForm,
} from '@/lib/announcementForm';

describe('announcementForm', () => {
  it('rakentaa kohdistukset ilman kaksoiskappaleita', () => {
    expect(buildAnnouncementTargets({
      wholeOrganization: true,
      roles: ['worker', 'worker', 'supervisor'],
      supervisorUserIds: ['sup-1', 'sup-1'],
      projectIds: ['project-1'],
      customerProjectIds: ['project-2'],
      userIds: ['user-1', 'user-1'],
    })).toEqual([
      { type: 'organization' },
      { type: 'role', role: 'worker' },
      { type: 'role', role: 'supervisor' },
      { type: 'team', supervisorUserId: 'sup-1' },
      { type: 'project', projectId: 'project-1' },
      { type: 'project_customer', projectId: 'project-2' },
      { type: 'user', userId: 'user-1' },
    ]);
  });

  it('pitää arkiston aina näyttöpaikkana', () => {
    expect(buildAnnouncementPlacements({
      dashboard: true,
      notificationCenter: true,
      banner: false,
      projectIds: ['project-1', 'project-1'],
      workOrderIds: ['work-1'],
    })).toEqual([
      { type: 'archive' },
      { type: 'dashboard' },
      { type: 'notification_center' },
      { type: 'project', projectId: 'project-1' },
      { type: 'work_order', workOrderId: 'work-1' },
    ]);
  });

  it('vaatii vastaanottajan ja ajastetulta tiedotteelta ajan', () => {
    expect(validateAnnouncementForm({
      title: 'Työmaan tiedote',
      content: 'Sisältö',
      priority: 'Normaali',
      publishMode: 'scheduled',
      startsAtLocal: '',
      expiresAtLocal: '',
      targets: [],
      placements: [{ type: 'archive' }],
    })).toEqual([
      'Valitse vähintään yksi vastaanottajaryhmä.',
      'Ajastetulle tiedotteelle pitää valita kelvollinen julkaisuaika.',
    ]);
  });

  it('hylkää päättymisen ennen alkamista', () => {
    expect(validateAnnouncementForm({
      title: 'Työmaan tiedote',
      content: 'Sisältö',
      priority: 'Tärkeä',
      publishMode: 'scheduled',
      startsAtLocal: '2030-01-02T12:00',
      expiresAtLocal: '2030-01-02T11:00',
      targets: [{ type: 'organization' }],
      placements: [{ type: 'archive' }],
    })).toContain('Päättymisajan pitää olla julkaisuaikaa myöhemmin.');
  });

  it('muuntaa paikallisen ajan ISO-muotoon ja julkaisutilat oikein', () => {
    expect(localDateTimeToIso('not-a-date')).toBeUndefined();
    expect(localDateTimeToIso('2030-01-02T12:00')).toMatch(/^2030-01-02T/);
    expect(statusForPublishMode('draft')).toBe('draft');
    expect(statusForPublishMode('scheduled')).toBe('scheduled');
    expect(statusForPublishMode('now')).toBe('published');
  });
});
