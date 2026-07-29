import type { UserRole } from '@/auth/permissions';
import type {
  AnnouncementPlacementInput,
  AnnouncementPriorityV2,
  AnnouncementTargetInput,
} from '@/lib/supabase/announcements';

export interface AnnouncementTargetSelections {
  wholeOrganization: boolean;
  roles: UserRole[];
  supervisorUserIds: string[];
  projectIds: string[];
  customerProjectIds: string[];
  userIds: string[];
}

export interface AnnouncementPlacementSelections {
  dashboard: boolean;
  notificationCenter: boolean;
  banner: boolean;
  projectIds: string[];
  workOrderIds: string[];
}

export interface AnnouncementValidationInput {
  title: string;
  content: string;
  priority: AnnouncementPriorityV2;
  publishMode: 'draft' | 'now' | 'scheduled';
  startsAtLocal: string;
  expiresAtLocal: string;
  targets: AnnouncementTargetInput[];
  placements: AnnouncementPlacementInput[];
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function buildAnnouncementTargets(
  selections: AnnouncementTargetSelections,
): AnnouncementTargetInput[] {
  const targets: AnnouncementTargetInput[] = [];
  if (selections.wholeOrganization) targets.push({ type: 'organization' });
  unique(selections.roles).forEach((role) => targets.push({ type: 'role', role: role as UserRole }));
  unique(selections.supervisorUserIds).forEach((supervisorUserId) => targets.push({ type: 'team', supervisorUserId }));
  unique(selections.projectIds).forEach((projectId) => targets.push({ type: 'project', projectId }));
  unique(selections.customerProjectIds).forEach((projectId) => targets.push({ type: 'project_customer', projectId }));
  unique(selections.userIds).forEach((userId) => targets.push({ type: 'user', userId }));
  return targets;
}

export function buildAnnouncementPlacements(
  selections: AnnouncementPlacementSelections,
): AnnouncementPlacementInput[] {
  const placements: AnnouncementPlacementInput[] = [{ type: 'archive' }];
  if (selections.dashboard) placements.push({ type: 'dashboard' });
  if (selections.notificationCenter) placements.push({ type: 'notification_center' });
  if (selections.banner) placements.push({ type: 'banner' });
  unique(selections.projectIds).forEach((projectId) => placements.push({ type: 'project', projectId }));
  unique(selections.workOrderIds).forEach((workOrderId) => placements.push({ type: 'work_order', workOrderId }));
  return placements;
}

export function localDateTimeToIso(value: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function validateAnnouncementForm(values: AnnouncementValidationInput): string[] {
  const errors: string[] = [];
  const titleLength = values.title.trim().length;
  const contentLength = values.content.trim().length;
  if (titleLength < 3 || titleLength > 180) errors.push('Otsikon pitää olla 3–180 merkkiä.');
  if (contentLength < 1 || contentLength > 10_000) errors.push('Sisällön pitää olla 1–10 000 merkkiä.');
  if (!['Info', 'Normaali', 'Tärkeä', 'Kriittinen'].includes(values.priority)) errors.push('Valitse tiedotteen prioriteetti.');
  if (values.targets.length === 0) errors.push('Valitse vähintään yksi vastaanottajaryhmä.');
  if (!values.placements.some((placement) => placement.type === 'archive')) errors.push('Tiedotearkisto on pakollinen näyttöpaikka.');
  if (values.publishMode === 'scheduled' && !localDateTimeToIso(values.startsAtLocal)) {
    errors.push('Ajastetulle tiedotteelle pitää valita kelvollinen julkaisuaika.');
  }
  const startsAt = localDateTimeToIso(values.startsAtLocal);
  const expiresAt = localDateTimeToIso(values.expiresAtLocal);
  if (values.startsAtLocal && !startsAt) errors.push('Julkaisuaika on virheellinen.');
  if (values.expiresAtLocal && !expiresAt) errors.push('Päättymisaika on virheellinen.');
  if (expiresAt) {
    const comparisonStart = startsAt ?? new Date().toISOString();
    if (expiresAt <= comparisonStart) errors.push('Päättymisajan pitää olla julkaisuaikaa myöhemmin.');
  }
  return errors;
}

export function statusForPublishMode(mode: AnnouncementValidationInput['publishMode']) {
  if (mode === 'draft') return 'draft' as const;
  if (mode === 'scheduled') return 'scheduled' as const;
  return 'published' as const;
}
