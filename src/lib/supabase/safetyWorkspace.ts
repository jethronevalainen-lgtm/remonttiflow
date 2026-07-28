import type { RealtimeChannel } from '@supabase/supabase-js';

import type { UserRole } from '@/contexts/AuthContext';
import type { SafetyItem, SafetyItemSeverity, SafetyItemType } from '@/types';
import { supabase } from './client';

export type SafetyBriefingSeverity = 'info' | 'warning' | 'danger';
export type SafetyBriefingStatus = 'draft' | 'published' | 'archived';
export type SafetyAttachmentKind = 'observation' | 'correction' | 'briefing';

export interface SafetyProjectOption {
  id: string;
  name: string;
  location?: string;
}

export interface SafetyBriefing {
  id: string;
  organizationId: string;
  projectId?: string;
  title: string;
  introduction: string;
  instructionItems: string[];
  severity: SafetyBriefingSeverity;
  audienceRoles: UserRole[];
  validFrom: string;
  validUntil?: string;
  requiresAcknowledgement: boolean;
  status: SafetyBriefingStatus;
  version: number;
  publishedBy?: string;
  publishedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  acknowledgedAt?: string;
  acknowledgementCount: number;
}

export interface ProjectSafetyProfile {
  projectId: string;
  organizationId: string;
  siteAddress: string;
  assemblyPoint: string;
  firstAidLocation: string;
  defibrillatorLocation: string;
  safetyContactName: string;
  safetyContactPhone: string;
  firstAidContactName: string;
  firstAidContactPhone: string;
  dutyPhone: string;
  emergencyInstructions: string;
  updatedAt?: string;
}

export interface SafetyAttachment {
  id: string;
  organizationId: string;
  safetyItemId?: string;
  briefingId?: string;
  kind: SafetyAttachmentKind;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdBy: string;
  createdAt: string;
}

export interface SafetyWorkspaceSnapshot {
  projects: SafetyProjectOption[];
  activeProjectId?: string;
  items: SafetyItem[];
  briefings: SafetyBriefing[];
  profiles: ProjectSafetyProfile[];
  attachments: SafetyAttachment[];
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

function bool(row: Row, key: string, fallback = false): boolean {
  return typeof row[key] === 'boolean' ? row[key] as boolean : fallback;
}

function numberValue(row: Row, key: string, fallback = 0): number {
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function mapSafetyItem(value: unknown): SafetyItem {
  const row = object(value);
  const type = text(row, 'type');
  const severity = text(row, 'severity');
  return {
    id: text(row, 'id'),
    type: (['incident', 'risk', 'inspection', 'training'].includes(type) ? type : 'risk') as SafetyItemType,
    title: text(row, 'title'),
    date: text(row, 'date'),
    projectId: optionalText(row, 'project_id'),
    project: optionalText(row, 'project'),
    description: optionalText(row, 'description'),
    location: optionalText(row, 'location'),
    severity: (['Lievä', 'Keskitasoinen', 'Vakava'].includes(severity) ? severity : undefined) as SafetyItemSeverity | undefined,
    status: text(row, 'status') || 'Avoin',
    assignee: optionalText(row, 'assignee'),
    assigneeUserId: optionalText(row, 'assignee_user_id'),
    dueDate: optionalText(row, 'due_date'),
    rootCause: optionalText(row, 'root_cause'),
    correctiveAction: optionalText(row, 'corrective_action'),
    preventiveAction: optionalText(row, 'preventive_action'),
    resolvedAt: optionalText(row, 'resolved_at'),
    verifiedAt: optionalText(row, 'verified_at'),
    verifiedBy: optionalText(row, 'verified_by'),
    latitude: row.latitude == null ? undefined : numberValue(row, 'latitude'),
    longitude: row.longitude == null ? undefined : numberValue(row, 'longitude'),
  };
}

function mapBriefing(value: unknown, acknowledgements: Map<string, string>, acknowledgementCounts: Map<string, number>): SafetyBriefing {
  const row = object(value);
  const severity = text(row, 'severity');
  const status = text(row, 'status');
  const version = numberValue(row, 'version', 1);
  const id = text(row, 'id');
  return {
    id,
    organizationId: text(row, 'organization_id'),
    projectId: optionalText(row, 'project_id'),
    title: text(row, 'title'),
    introduction: text(row, 'introduction'),
    instructionItems: stringArray(row.instruction_items),
    severity: (['warning', 'danger'].includes(severity) ? severity : 'info') as SafetyBriefingSeverity,
    audienceRoles: stringArray(row.audience_roles) as UserRole[],
    validFrom: text(row, 'valid_from'),
    validUntil: optionalText(row, 'valid_until'),
    requiresAcknowledgement: bool(row, 'requires_acknowledgement'),
    status: (['draft', 'archived'].includes(status) ? status : 'published') as SafetyBriefingStatus,
    version,
    publishedBy: optionalText(row, 'published_by'),
    publishedAt: optionalText(row, 'published_at'),
    createdBy: text(row, 'created_by'),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
    acknowledgedAt: acknowledgements.get(`${id}:${version}`),
    acknowledgementCount: acknowledgementCounts.get(`${id}:${version}`) ?? 0,
  };
}

function mapProfile(value: unknown): ProjectSafetyProfile {
  const row = object(value);
  return {
    projectId: text(row, 'project_id'),
    organizationId: text(row, 'organization_id'),
    siteAddress: text(row, 'site_address'),
    assemblyPoint: text(row, 'assembly_point'),
    firstAidLocation: text(row, 'first_aid_location'),
    defibrillatorLocation: text(row, 'defibrillator_location'),
    safetyContactName: text(row, 'safety_contact_name'),
    safetyContactPhone: text(row, 'safety_contact_phone'),
    firstAidContactName: text(row, 'first_aid_contact_name'),
    firstAidContactPhone: text(row, 'first_aid_contact_phone'),
    dutyPhone: text(row, 'duty_phone'),
    emergencyInstructions: text(row, 'emergency_instructions'),
    updatedAt: optionalText(row, 'updated_at'),
  };
}

function mapAttachment(value: unknown): SafetyAttachment {
  const row = object(value);
  return {
    id: text(row, 'id'),
    organizationId: text(row, 'organization_id'),
    safetyItemId: optionalText(row, 'safety_item_id'),
    briefingId: optionalText(row, 'briefing_id'),
    kind: text(row, 'kind') as SafetyAttachmentKind,
    storagePath: text(row, 'storage_path'),
    fileName: text(row, 'file_name'),
    mimeType: text(row, 'mime_type'),
    sizeBytes: numberValue(row, 'size_bytes'),
    createdBy: text(row, 'created_by'),
    createdAt: text(row, 'created_at'),
  };
}

export function safetyMetrics(items: SafetyItem[], today: string) {
  const open = items.filter((item) => !['Suljettu', 'Vahvistettu'].includes(item.status));
  return {
    open: open.length,
    serious: open.filter((item) => item.severity === 'Vakava').length,
    overdue: open.filter((item) => Boolean(item.dueDate && item.dueDate < today)).length,
    waitingVerification: items.filter((item) => item.status === 'Ilmoitettu korjatuksi').length,
  };
}

export function safetyActionReasons(item: SafetyItem, today: string): string[] {
  const reasons: string[] = [];
  if (['Suljettu', 'Vahvistettu'].includes(item.status)) return reasons;
  if (item.severity === 'Vakava') reasons.push('Vakava havainto');
  if (item.dueDate && item.dueDate < today) reasons.push('Korjaus myöhässä');
  if (!item.assigneeUserId && ['Avoin', 'Arvioitu', 'Osoitettu', 'Korjattavana'].includes(item.status)) reasons.push('Vastuuhenkilö puuttuu');
  if (item.status === 'Ilmoitettu korjatuksi') reasons.push('Odottaa varmennusta');
  if (['Korjattavana', 'Ilmoitettu korjatuksi'].includes(item.status) && !item.correctiveAction?.trim()) reasons.push('Korjaava toimenpide puuttuu');
  return reasons;
}

export function selectPrimaryBriefing(
  briefings: SafetyBriefing[],
  projectId: string | undefined,
): SafetyBriefing | undefined {
  const score = (briefing: SafetyBriefing) => {
    const projectScore = briefing.projectId === projectId ? 100 : briefing.projectId ? 0 : 50;
    const severityScore = briefing.severity === 'danger' ? 30 : briefing.severity === 'warning' ? 20 : 10;
    return projectScore + severityScore + briefing.version / 100;
  };
  const today = new Date().toISOString().slice(0, 10);
  return [...briefings]
    .filter((item) => item.status === 'published')
    .filter((item) => item.validFrom <= today && (!item.validUntil || item.validUntil >= today))
    .filter((item) => !item.projectId || item.projectId === projectId)
    .sort((a, b) => score(b) - score(a))[0];
}

export async function loadSafetyWorkspace(
  organizationId: string,
  userId: string,
  role: UserRole,
): Promise<SafetyWorkspaceSnapshot> {
  const canManage = ['admin', 'supervisor', 'project_coordinator'].includes(role);
  let acknowledgementsQuery = supabase
    .from('safety_briefing_acknowledgements')
    .select('briefing_id,briefing_version,user_id,acknowledged_at')
    .eq('organization_id', organizationId);
  if (!canManage) acknowledgementsQuery = acknowledgementsQuery.eq('user_id', userId);

  const [projectsResult, itemsResult, briefingsResult, profilesResult, attachmentsResult, acknowledgementsResult, activeCheckInResult] = await Promise.all([
    supabase.from('projects').select('id,name,location').eq('organization_id', organizationId).is('archived_at', null).order('name'),
    supabase.from('safety_items').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }),
    supabase.from('safety_briefings').select('*').eq('organization_id', organizationId).neq('status', 'archived').order('published_at', { ascending: false, nullsFirst: false }),
    supabase.from('project_safety_profiles').select('*').eq('organization_id', organizationId),
    supabase.from('safety_attachments').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }),
    acknowledgementsQuery,
    supabase.from('work_site_check_ins').select('project_id').eq('organization_id', organizationId).eq('user_id', userId).is('checked_out_at', null).order('checked_in_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const errors = [projectsResult.error, itemsResult.error, briefingsResult.error, profilesResult.error, attachmentsResult.error, acknowledgementsResult.error]
    .filter(Boolean);
  if (errors.length) throw new Error(`Turvallisuustietojen lataus epäonnistui: ${errors[0]?.message}`);

  const acknowledgements = new Map<string, string>();
  const acknowledgementCounts = new Map<string, number>();
  rows(acknowledgementsResult.data).forEach((row) => {
    const key = `${text(row, 'briefing_id')}:${numberValue(row, 'briefing_version', 1)}`;
    acknowledgementCounts.set(key, (acknowledgementCounts.get(key) ?? 0) + 1);
    if (text(row, 'user_id') === userId) acknowledgements.set(key, text(row, 'acknowledged_at'));
  });

  const projectRows = rows(projectsResult.data).map((row) => ({ id: text(row, 'id'), name: text(row, 'name'), location: optionalText(row, 'location') }));
  const projectIds = new Set(projectRows.map((project) => project.id));
  const briefings = rows(briefingsResult.data)
    .map((row) => mapBriefing(row, acknowledgements, acknowledgementCounts))
    .filter((briefing) => briefing.status === 'published' || ['admin', 'supervisor', 'project_coordinator'].includes(role))
    .filter((briefing) => canManage || !briefing.audienceRoles.length || briefing.audienceRoles.includes(role))
    .filter((briefing) => !briefing.projectId || projectIds.has(briefing.projectId));

  return {
    projects: projectRows,
    activeProjectId: text(object(activeCheckInResult.data), 'project_id') || undefined,
    items: rows(itemsResult.data).map(mapSafetyItem).filter((item) => item.id),
    briefings,
    profiles: rows(profilesResult.data).map(mapProfile).filter((item) => item.projectId),
    attachments: rows(attachmentsResult.data).map(mapAttachment).filter((item) => item.id),
  };
}

export async function acknowledgeSafetyBriefing(
  organizationId: string,
  briefing: SafetyBriefing,
  userId: string,
  role: UserRole,
): Promise<void> {
  const { error } = await supabase.from('safety_briefing_acknowledgements').upsert({
    organization_id: organizationId,
    briefing_id: briefing.id,
    briefing_version: briefing.version,
    user_id: userId,
    user_role: role,
    project_id: briefing.projectId ?? null,
    acknowledged_at: new Date().toISOString(),
  }, { onConflict: 'briefing_id,user_id,briefing_version' });
  if (error) throw new Error(`Turvallisuusohjeen kuittaus epäonnistui: ${error.message}`);
}

export async function saveSafetyBriefing(
  organizationId: string,
  userId: string,
  briefing: Omit<SafetyBriefing, 'id' | 'organizationId' | 'createdBy' | 'createdAt' | 'updatedAt' | 'acknowledgedAt' | 'publishedBy' | 'publishedAt' | 'acknowledgementCount'> & { id?: string },
): Promise<string> {
  const payload = {
    organization_id: organizationId,
    project_id: briefing.projectId || null,
    title: briefing.title.trim(),
    introduction: briefing.introduction.trim() || null,
    instruction_items: briefing.instructionItems.map((item) => item.trim()).filter(Boolean),
    severity: briefing.severity,
    audience_roles: briefing.audienceRoles,
    valid_from: briefing.validFrom,
    valid_until: briefing.validUntil || null,
    requires_acknowledgement: briefing.requiresAcknowledgement,
    status: briefing.status,
    version: briefing.version,
    ...(briefing.status === 'published' ? { published_by: userId, published_at: new Date().toISOString() } : {}),
  };

  if (briefing.id) {
    const { data, error } = await supabase.from('safety_briefings').update(payload).eq('id', briefing.id).eq('organization_id', organizationId).select('id').single();
    if (error) throw new Error(`Turvallisuusohjeen päivitys epäonnistui: ${error.message}`);
    return text(object(data), 'id');
  }

  const { data, error } = await supabase.from('safety_briefings').insert({ ...payload, created_by: userId }).select('id').single();
  if (error) throw new Error(`Turvallisuusohjeen tallennus epäonnistui: ${error.message}`);
  return text(object(data), 'id');
}

export async function archiveSafetyBriefing(organizationId: string, briefingId: string): Promise<void> {
  const { error } = await supabase.from('safety_briefings').update({ status: 'archived' }).eq('id', briefingId).eq('organization_id', organizationId);
  if (error) throw new Error(`Turvallisuusohjeen arkistointi epäonnistui: ${error.message}`);
}

export async function saveProjectSafetyProfile(profile: ProjectSafetyProfile): Promise<void> {
  const { error } = await supabase.from('project_safety_profiles').upsert({
    project_id: profile.projectId,
    organization_id: profile.organizationId,
    site_address: profile.siteAddress.trim() || null,
    assembly_point: profile.assemblyPoint.trim() || null,
    first_aid_location: profile.firstAidLocation.trim() || null,
    defibrillator_location: profile.defibrillatorLocation.trim() || null,
    safety_contact_name: profile.safetyContactName.trim() || null,
    safety_contact_phone: profile.safetyContactPhone.trim() || null,
    first_aid_contact_name: profile.firstAidContactName.trim() || null,
    first_aid_contact_phone: profile.firstAidContactPhone.trim() || null,
    duty_phone: profile.dutyPhone.trim() || null,
    emergency_instructions: profile.emergencyInstructions.trim() || null,
  }, { onConflict: 'project_id' });
  if (error) throw new Error(`Työmaan hätätietojen tallennus epäonnistui: ${error.message}`);
}

function safeFileName(fileName: string): string {
  return fileName.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 120) || 'tiedosto';
}

export async function uploadSafetyAttachment(params: {
  organizationId: string;
  userId: string;
  kind: SafetyAttachmentKind;
  file: File;
  safetyItemId?: string;
  briefingId?: string;
}): Promise<void> {
  const { organizationId, userId, kind, file, safetyItemId, briefingId } = params;
  if (!safetyItemId && !briefingId) throw new Error('Liitteeltä puuttuu kohde.');
  const parentType = safetyItemId ? 'items' : 'briefings';
  const parentId = safetyItemId ?? briefingId ?? '';
  const storagePath = `${organizationId}/${parentType}/${parentId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage.from('safety-files').upload(storagePath, file, { upsert: false, contentType: file.type });
  if (uploadError) throw new Error(`Liitteen lataus epäonnistui: ${uploadError.message}`);

  const { error: insertError } = await supabase.from('safety_attachments').insert({
    organization_id: organizationId,
    safety_item_id: safetyItemId ?? null,
    briefing_id: briefingId ?? null,
    kind,
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type || 'application/octet-stream',
    size_bytes: file.size,
    created_by: userId,
  });
  if (insertError) {
    await supabase.storage.from('safety-files').remove([storagePath]);
    throw new Error(`Liitteen rekisteröinti epäonnistui: ${insertError.message}`);
  }
}

export async function deleteSafetyAttachment(attachment: SafetyAttachment): Promise<void> {
  const { error } = await supabase.from('safety_attachments').delete().eq('id', attachment.id);
  if (error) throw new Error(`Liitteen poistaminen epäonnistui: ${error.message}`);
}

export async function openSafetyAttachment(attachment: SafetyAttachment): Promise<void> {
  const { data, error } = await supabase.storage.from('safety-files').createSignedUrl(attachment.storagePath, 300);
  if (error || !data?.signedUrl) throw new Error(`Liitteen avaaminen epäonnistui: ${error?.message ?? 'linkkiä ei saatu'}`);
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}

export function subscribeSafetyWorkspace(organizationId: string, onChange: () => void): () => void {
  const tables = ['safety_items', 'safety_briefings', 'safety_briefing_acknowledgements', 'project_safety_profiles', 'safety_attachments'];
  const channel: RealtimeChannel = tables.reduce((current, table) => current.on(
    'postgres_changes',
    { event: '*', schema: 'public', table, filter: `organization_id=eq.${organizationId}` },
    onChange,
  ), supabase.channel(`safety-workspace-${organizationId}`));
  void channel.subscribe();
  return () => { void supabase.removeChannel(channel); };
}
