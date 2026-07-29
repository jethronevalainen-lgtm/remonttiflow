import { supabase } from '@/lib/supabase/client';
import type { UserRole } from '@/auth/permissions';

export type AnnouncementPriorityV2 = 'Info' | 'Normaali' | 'Tärkeä' | 'Kriittinen';
export type AnnouncementStatusV2 = 'draft' | 'scheduled' | 'published' | 'expired';
export type AnnouncementPlacement =
  | 'archive'
  | 'dashboard'
  | 'notification_center'
  | 'banner'
  | 'project'
  | 'work_order';
export type AnnouncementEvent = 'shown' | 'opened' | 'read' | 'acknowledged' | 'dismissed';

export type AnnouncementTargetInput =
  | { type: 'organization' }
  | { type: 'role'; role: UserRole }
  | { type: 'team'; supervisorUserId: string }
  | { type: 'project'; projectId: string }
  | { type: 'project_customer'; projectId: string }
  | { type: 'user'; userId: string };

export type AnnouncementPlacementInput =
  | { type: 'archive' | 'dashboard' | 'notification_center' | 'banner' }
  | { type: 'project'; projectId: string }
  | { type: 'work_order'; workOrderId: string };

export interface VisibleAnnouncement {
  id: string;
  title: string;
  content: string;
  priority: AnnouncementPriorityV2;
  author: string;
  status: AnnouncementStatusV2;
  publishedAt: string;
  startsAt: string;
  expiresAt?: string;
  requireAcknowledgement: boolean;
  dismissible: boolean;
  pinned: boolean;
  linkPath?: string;
  relatedProjectId?: string;
  relatedWorkOrderId?: string;
  recipientCount: number;
  seenCount: number;
  acknowledgedCount: number;
  firstShownAt?: string;
  openedAt?: string;
  readAt?: string;
  acknowledgedAt?: string;
  dismissedAt?: string;
}

export interface ManagedAnnouncement extends VisibleAnnouncement {
  openedCount: number;
  placementLabels: AnnouncementPlacement[];
  targetLabels: string[];
}

export interface AnnouncementDirectoryPerson {
  userId: string;
  displayName: string;
  email: string;
  role: UserRole;
}

export interface AnnouncementReceipt extends AnnouncementDirectoryPerson {
  matchedBy: Array<Record<string, unknown>>;
  deliveredAt?: string;
  firstShownAt?: string;
  openedAt?: string;
  readAt?: string;
  acknowledgedAt?: string;
  dismissedAt?: string;
}

export interface CreateAnnouncementInput {
  organizationId: string;
  title: string;
  content: string;
  priority: AnnouncementPriorityV2;
  status: Exclude<AnnouncementStatusV2, 'expired'>;
  startsAt?: string;
  expiresAt?: string;
  requireAcknowledgement: boolean;
  dismissible: boolean;
  pinned: boolean;
  linkPath?: string;
  targets: AnnouncementTargetInput[];
  placements: AnnouncementPlacementInput[];
}

type Row = Record<string, unknown>;

function object(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
}

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.map(object) : [];
}

function text(row: Row, key: string): string {
  return typeof row[key] === 'string' ? row[key] as string : '';
}

function optionalText(row: Row, key: string): string | undefined {
  return text(row, key) || undefined;
}

function bool(row: Row, key: string): boolean {
  return row[key] === true;
}

function numberValue(row: Row, key: string): number {
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : 0;
}

function stringArray(row: Row, key: string): string[] {
  return Array.isArray(row[key])
    ? (row[key] as unknown[]).filter((value): value is string => typeof value === 'string')
    : [];
}

function objectArray(row: Row, key: string): Array<Record<string, unknown>> {
  return Array.isArray(row[key])
    ? (row[key] as unknown[]).map(object)
    : [];
}

function priority(value: unknown): AnnouncementPriorityV2 {
  return value === 'Kriittinen' || value === 'Tärkeä' || value === 'Info' ? value : 'Normaali';
}

function status(value: unknown): AnnouncementStatusV2 {
  return value === 'draft' || value === 'scheduled' || value === 'expired' ? value : 'published';
}

function mapDirectoryPerson(value: unknown): AnnouncementDirectoryPerson {
  const row = object(value);
  return {
    userId: text(row, 'user_id'),
    displayName: text(row, 'display_name') || 'Nimetön käyttäjä',
    email: text(row, 'email'),
    role: text(row, 'role') as UserRole,
  };
}

function mapVisible(value: unknown): VisibleAnnouncement {
  const row = object(value);
  return {
    id: text(row, 'id'),
    title: text(row, 'title'),
    content: text(row, 'content'),
    priority: priority(row.priority),
    author: text(row, 'author') || 'Käyttäjä',
    status: status(row.status),
    publishedAt: text(row, 'published_at'),
    startsAt: text(row, 'starts_at'),
    expiresAt: optionalText(row, 'expires_at'),
    requireAcknowledgement: bool(row, 'require_acknowledgement'),
    dismissible: bool(row, 'dismissible'),
    pinned: bool(row, 'pinned'),
    linkPath: optionalText(row, 'link_path'),
    relatedProjectId: optionalText(row, 'related_project_id'),
    relatedWorkOrderId: optionalText(row, 'related_work_order_id'),
    recipientCount: numberValue(row, 'recipient_count'),
    seenCount: numberValue(row, 'seen_count'),
    acknowledgedCount: numberValue(row, 'acknowledged_count'),
    firstShownAt: optionalText(row, 'first_shown_at'),
    openedAt: optionalText(row, 'opened_at'),
    readAt: optionalText(row, 'read_at'),
    acknowledgedAt: optionalText(row, 'acknowledged_at'),
    dismissedAt: optionalText(row, 'dismissed_at'),
  };
}

export async function listVisibleAnnouncements(values: {
  organizationId: string;
  placement: AnnouncementPlacement;
  projectId?: string;
  workOrderId?: string;
}): Promise<VisibleAnnouncement[]> {
  const { data, error } = await supabase.rpc('list_visible_announcements_v2', {
    p_organization_id: values.organizationId,
    p_placement: values.placement,
    p_project_id: values.projectId || null,
    p_work_order_id: values.workOrderId || null,
  });
  if (error) throw new Error(`Tiedotteiden haku epäonnistui: ${error.message}`);
  return rows(data).map(mapVisible).filter((item) => item.id);
}

export async function listManagedAnnouncements(
  organizationId: string,
): Promise<ManagedAnnouncement[]> {
  const { data, error } = await supabase.rpc('list_managed_announcements', {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(`Tiedotteiden hallintanäkymän haku epäonnistui: ${error.message}`);
  return rows(data).map((value): ManagedAnnouncement => {
    const row = object(value);
    return {
      ...mapVisible(row),
      openedCount: numberValue(row, 'opened_count'),
      placementLabels: stringArray(row, 'placement_labels') as AnnouncementPlacement[],
      targetLabels: stringArray(row, 'target_labels'),
    };
  }).filter((item) => item.id);
}

export async function listAnnouncementDirectory(
  organizationId: string,
): Promise<AnnouncementDirectoryPerson[]> {
  const { data, error } = await supabase.rpc('list_announcement_directory', {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(`Vastaanottajahakemiston haku epäonnistui: ${error.message}`);
  return rows(data).map(mapDirectoryPerson).filter((item) => item.userId);
}

export async function previewAnnouncementRecipients(
  organizationId: string,
  targets: AnnouncementTargetInput[],
): Promise<AnnouncementDirectoryPerson[]> {
  const { data, error } = await supabase.rpc('preview_announcement_recipients', {
    p_organization_id: organizationId,
    p_targets: targets,
  });
  if (error) throw new Error(`Vastaanottajien esikatselu epäonnistui: ${error.message}`);
  return rows(data).map(mapDirectoryPerson).filter((item) => item.userId);
}

export async function listAnnouncementReceipts(
  organizationId: string,
  announcementId: string,
): Promise<AnnouncementReceipt[]> {
  const { data, error } = await supabase.rpc('list_announcement_receipts', {
    p_organization_id: organizationId,
    p_announcement_id: announcementId,
  });
  if (error) throw new Error(`Toimitusraportin haku epäonnistui: ${error.message}`);
  return rows(data).map((value): AnnouncementReceipt => {
    const row = object(value);
    return {
      ...mapDirectoryPerson(row),
      matchedBy: objectArray(row, 'matched_by'),
      deliveredAt: optionalText(row, 'delivered_at'),
      firstShownAt: optionalText(row, 'first_shown_at'),
      openedAt: optionalText(row, 'opened_at'),
      readAt: optionalText(row, 'read_at'),
      acknowledgedAt: optionalText(row, 'acknowledged_at'),
      dismissedAt: optionalText(row, 'dismissed_at'),
    };
  }).filter((item) => item.userId);
}

export async function createAnnouncementV2(values: CreateAnnouncementInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_announcement_v2', {
    p_organization_id: values.organizationId,
    p_title: values.title,
    p_content: values.content,
    p_priority: values.priority,
    p_status: values.status,
    p_starts_at: values.startsAt || null,
    p_expires_at: values.expiresAt || null,
    p_require_acknowledgement: values.requireAcknowledgement,
    p_dismissible: values.dismissible,
    p_pinned: values.pinned,
    p_link_path: values.linkPath || null,
    p_targets: values.targets,
    p_placements: values.placements,
  });
  if (error) throw new Error(`Tiedotteen tallennus epäonnistui: ${error.message}`);
  if (typeof data !== 'string') throw new Error('Tietokanta ei palauttanut tiedotteen tunnistetta.');
  return data;
}

export async function recordAnnouncementEvent(
  announcementId: string,
  event: AnnouncementEvent,
): Promise<void> {
  const { error } = await supabase.rpc('record_announcement_event', {
    p_announcement_id: announcementId,
    p_event: event,
  });
  if (error) throw new Error(`Tiedotteen kuittaus epäonnistui: ${error.message}`);
}

export async function publishAnnouncementV2(
  organizationId: string,
  announcementId: string,
): Promise<void> {
  const { error } = await supabase.rpc('publish_announcement_v2', {
    p_organization_id: organizationId,
    p_announcement_id: announcementId,
  });
  if (error) throw new Error(`Tiedotteen julkaiseminen epäonnistui: ${error.message}`);
}

export async function endAnnouncementV2(
  organizationId: string,
  announcementId: string,
): Promise<void> {
  const { error } = await supabase.rpc('end_announcement_v2', {
    p_organization_id: organizationId,
    p_announcement_id: announcementId,
  });
  if (error) throw new Error(`Tiedotteen päättäminen epäonnistui: ${error.message}`);
}

export async function deleteAnnouncementV2(
  organizationId: string,
  announcementId: string,
): Promise<void> {
  const { error } = await supabase.rpc('delete_announcement_v2', {
    p_organization_id: organizationId,
    p_announcement_id: announcementId,
  });
  if (error) throw new Error(`Tiedotteen poistaminen epäonnistui: ${error.message}`);
}
