import { supabase } from '@/lib/supabase/client';

export type ProjectRequestStatus =
  | 'Lähetetty'
  | 'Käsittelyssä'
  | 'Lisätietoja pyydetty'
  | 'Hyväksytty'
  | 'Hylätty'
  | 'Muutettu projektiksi';

export type ProjectMessageChannel = 'shared' | 'internal';

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.filter((item): item is Row => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function text(row: Row, key: string): string {
  return typeof row[key] === 'string' ? row[key] as string : '';
}

function nullableText(row: Row, key: string): string | null {
  return typeof row[key] === 'string' && row[key] ? row[key] as string : null;
}

function numberValue(row: Row, key: string): number {
  const value = row[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function booleanValue(row: Row, key: string): boolean {
  return row[key] === true;
}

function stringArray(row: Row, key: string): string[] {
  return Array.isArray(row[key]) ? row[key].filter((value): value is string => typeof value === 'string') : [];
}

export interface CustomerAccount {
  customerId: string;
  customerName: string;
}

export interface CustomerProjectSummary {
  id: string;
  customerId: string;
  name: string;
  location: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  progress: number;
  description: string | null;
  supervisorName: string | null;
  supervisorEmail: string | null;
}

export interface ProjectRequest {
  id: string;
  organizationId: string;
  customerId: string;
  customerName: string;
  createdBy: string;
  projectName: string;
  location: string;
  description: string;
  desiredStartDate: string;
  desiredEndDate: string;
  contactName: string;
  contactPhone: string;
  status: ProjectRequestStatus;
  managementNote: string;
  convertedProjectId: string;
  createdAt: string;
  reviewedAt: string;
}

export interface ProjectConversationSummary {
  projectId: string;
  projectName: string;
  location: string | null;
  status: string;
  canUseInternal: boolean;
  unreadCount: number;
  lastMessageAt: string | null;
}

export interface ProjectConversationContext {
  projectId: string;
  projectName: string;
  customerName: string;
  location: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  progress: number;
  description: string | null;
  canUseInternal: boolean;
}

export interface ProjectConversationParticipant {
  userId: string;
  displayName: string;
  email: string;
  role: string;
  canUseInternal: boolean;
}

export interface ProjectMessageAttachment {
  id: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ProjectMessage {
  id: string;
  projectId: string;
  authorUserId: string;
  authorName: string;
  channel: ProjectMessageChannel;
  body: string;
  replyToId: string | null;
  replyAuthorName: string | null;
  replyBody: string | null;
  mentionedUserIds: string[];
  mentionedNames: string[];
  attachments: ProjectMessageAttachment[];
  createdAt: string;
  editedAt: string | null;
}

export async function loadCustomerAccounts(organizationId: string): Promise<CustomerAccount[]> {
  const { data, error } = await supabase.rpc('customer_portal_accounts', {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(`Tilaajatietojen haku epäonnistui: ${error.message}`);
  return rows(data).map((row) => ({
    customerId: text(row, 'customer_id'),
    customerName: text(row, 'customer_name'),
  })).filter((item) => item.customerId);
}

export async function loadCustomerProjectSummaries(organizationId: string): Promise<CustomerProjectSummary[]> {
  const { data, error } = await supabase.rpc('customer_portal_project_summaries', {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(`Projektien haku epäonnistui: ${error.message}`);
  return rows(data).map((row) => ({
    id: text(row, 'id'),
    customerId: text(row, 'customer_id'),
    name: text(row, 'name'),
    location: nullableText(row, 'location'),
    status: text(row, 'status'),
    startDate: nullableText(row, 'start_date'),
    endDate: nullableText(row, 'end_date'),
    progress: numberValue(row, 'progress'),
    description: nullableText(row, 'description'),
    supervisorName: nullableText(row, 'supervisor_name'),
    supervisorEmail: nullableText(row, 'supervisor_email'),
  })).filter((item) => item.id);
}

export async function loadProjectRequests(organizationId: string): Promise<ProjectRequest[]> {
  const { data, error } = await supabase.rpc('project_requests_for_user', {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(`Projektipyyntöjen haku epäonnistui: ${error.message}`);
  return rows(data).map((row) => ({
    id: text(row, 'id'),
    organizationId: text(row, 'organization_id'),
    customerId: text(row, 'customer_id'),
    customerName: text(row, 'customer_name'),
    createdBy: text(row, 'created_by'),
    projectName: text(row, 'project_name'),
    location: text(row, 'location'),
    description: text(row, 'description'),
    desiredStartDate: text(row, 'desired_start_date'),
    desiredEndDate: text(row, 'desired_end_date'),
    contactName: text(row, 'contact_name'),
    contactPhone: text(row, 'contact_phone'),
    status: text(row, 'status') as ProjectRequestStatus,
    managementNote: text(row, 'management_note'),
    convertedProjectId: text(row, 'converted_project_id'),
    createdAt: text(row, 'created_at'),
    reviewedAt: text(row, 'reviewed_at'),
  }));
}

export async function createProjectRequest(values: {
  organizationId: string;
  customerId: string;
  projectName: string;
  location?: string;
  description: string;
  desiredStartDate?: string;
  desiredEndDate?: string;
  contactName?: string;
  contactPhone?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_customer_project_request', {
    p_organization_id: values.organizationId,
    p_customer_id: values.customerId,
    p_project_name: values.projectName,
    p_location: values.location || null,
    p_description: values.description,
    p_desired_start_date: values.desiredStartDate || null,
    p_desired_end_date: values.desiredEndDate || null,
    p_contact_name: values.contactName || null,
    p_contact_phone: values.contactPhone || null,
  });
  if (error) throw new Error(`Projektipyynnön lähetys epäonnistui: ${error.message}`);
  if (typeof data !== 'string') throw new Error('Tietokanta ei palauttanut projektipyynnön tunnistetta.');
  return data;
}

export async function setProjectRequestStatus(values: {
  requestId: string;
  status: Extract<ProjectRequestStatus, 'Käsittelyssä' | 'Lisätietoja pyydetty' | 'Hylätty'>;
  managementNote?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('review_project_request', {
    p_request_id: values.requestId,
    p_status: values.status,
    p_management_note: values.managementNote || null,
  });
  if (error) throw new Error(`Projektipyynnön päivitys epäonnistui: ${error.message}`);
}

export async function approveProjectRequest(values: {
  requestId: string;
  projectNumber?: string;
  managementNote?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('approve_project_request', {
    p_request_id: values.requestId,
    p_project_number: values.projectNumber || null,
    p_management_note: values.managementNote || null,
  });
  if (error) throw new Error(`Projektin perustaminen epäonnistui: ${error.message}`);
  if (typeof data !== 'string') throw new Error('Tietokanta ei palauttanut projektin tunnistetta.');
  return data;
}

export async function loadAccessibleProjectConversations(organizationId: string): Promise<ProjectConversationSummary[]> {
  const { data, error } = await supabase.rpc('accessible_project_conversations', {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(`Projektikeskustelujen haku epäonnistui: ${error.message}`);
  return rows(data).map((row) => ({
    projectId: text(row, 'project_id'),
    projectName: text(row, 'project_name'),
    location: nullableText(row, 'location'),
    status: text(row, 'status'),
    canUseInternal: booleanValue(row, 'can_use_internal'),
    unreadCount: numberValue(row, 'unread_count'),
    lastMessageAt: nullableText(row, 'last_message_at'),
  })).filter((item) => item.projectId);
}

export async function loadProjectConversationContext(projectId: string): Promise<ProjectConversationContext> {
  const { data, error } = await supabase.rpc('project_conversation_context', {
    p_project_id: projectId,
  });
  if (error) throw new Error(`Projektin tietojen haku epäonnistui: ${error.message}`);
  const source = rows(data)[0];
  if (!source) throw new Error('Projektia ei löytynyt tai sinulla ei ole siihen käyttöoikeutta.');
  return {
    projectId: text(source, 'project_id'),
    projectName: text(source, 'project_name'),
    customerName: text(source, 'customer_name'),
    location: nullableText(source, 'location'),
    status: text(source, 'status'),
    startDate: nullableText(source, 'start_date'),
    endDate: nullableText(source, 'end_date'),
    progress: numberValue(source, 'progress'),
    description: nullableText(source, 'description'),
    canUseInternal: booleanValue(source, 'can_use_internal'),
  };
}

export async function loadProjectConversationParticipants(projectId: string): Promise<ProjectConversationParticipant[]> {
  const { data, error } = await supabase.rpc('project_conversation_participants_v2', {
    p_project_id: projectId,
  });
  if (error) throw new Error(`Osallistujien haku epäonnistui: ${error.message}`);
  return rows(data).map((row) => ({
    userId: text(row, 'user_id'),
    displayName: text(row, 'display_name') || 'Käyttäjä',
    email: text(row, 'email'),
    role: text(row, 'role'),
    canUseInternal: booleanValue(row, 'can_use_internal'),
  })).filter((item) => item.userId);
}

function mapAttachments(value: unknown): ProjectMessageAttachment[] {
  return rows(value).map((row) => ({
    id: text(row, 'id'),
    storagePath: text(row, 'storage_path'),
    fileName: text(row, 'file_name'),
    mimeType: text(row, 'mime_type'),
    sizeBytes: numberValue(row, 'size_bytes'),
  })).filter((item) => item.id && item.storagePath);
}

export async function loadProjectMessages(
  projectId: string,
  channel: ProjectMessageChannel,
): Promise<ProjectMessage[]> {
  const { data, error } = await supabase.rpc('project_messages_for_user_v2', {
    p_project_id: projectId,
    p_channel: channel,
  });
  if (error) throw new Error(`Viestien haku epäonnistui: ${error.message}`);
  return rows(data).map((row) => ({
    id: text(row, 'id'),
    projectId: text(row, 'project_id'),
    authorUserId: text(row, 'author_user_id'),
    authorName: text(row, 'author_name') || 'Käyttäjä',
    channel: text(row, 'channel') === 'internal' ? 'internal' : 'shared',
    body: text(row, 'body'),
    replyToId: nullableText(row, 'reply_to_id'),
    replyAuthorName: nullableText(row, 'reply_author_name'),
    replyBody: nullableText(row, 'reply_body'),
    mentionedUserIds: stringArray(row, 'mentioned_user_ids'),
    mentionedNames: stringArray(row, 'mentioned_names'),
    attachments: mapAttachments(row.attachments),
    createdAt: text(row, 'created_at'),
    editedAt: nullableText(row, 'edited_at'),
  }));
}

export async function sendProjectMessage(
  projectId: string,
  channel: ProjectMessageChannel,
  body: string,
  options?: { replyToId?: string | null; mentionedUserIds?: string[] },
): Promise<string> {
  const { data, error } = await supabase.rpc('send_project_message_v2', {
    p_project_id: projectId,
    p_channel: channel,
    p_body: body,
    p_reply_to_id: options?.replyToId || null,
    p_mentioned_user_ids: options?.mentionedUserIds ?? [],
  });
  if (error) throw new Error(`Viestin lähetys epäonnistui: ${error.message}`);
  if (typeof data !== 'string') throw new Error('Tietokanta ei palauttanut viestin tunnistetta.');
  return data;
}

export async function editProjectMessage(
  messageId: string,
  body: string,
  mentionedUserIds: string[],
): Promise<void> {
  const { error } = await supabase.rpc('edit_project_message_v2', {
    p_message_id: messageId,
    p_body: body,
    p_mentioned_user_ids: mentionedUserIds,
  });
  if (error) throw new Error(`Viestin muokkaus epäonnistui: ${error.message}`);
}

export async function deleteProjectMessage(messageId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_project_message_v2', {
    p_message_id: messageId,
  });
  if (error) throw new Error(`Viestin poisto epäonnistui: ${error.message}`);
}

function safeFileName(name: string): string {
  const normalized = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return normalized.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'liite';
}

export async function uploadProjectMessageAttachments(input: {
  organizationId: string;
  projectId: string;
  messageId: string;
  files: File[];
}): Promise<void> {
  if (input.files.length > 5) throw new Error('Yhteen viestiin voi lisätä enintään viisi liitettä.');
  for (const file of input.files) {
    if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: tiedosto ylittää 10 Mt kokorajan.`);
    const attachmentId = crypto.randomUUID();
    const storagePath = `${input.organizationId}/${input.projectId}/${input.messageId}/${attachmentId}/${safeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from('project-message-attachments')
      .upload(storagePath, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
    if (uploadError) throw new Error(`${file.name}: lataus epäonnistui: ${uploadError.message}`);

    const { error: metadataError } = await supabase.rpc('attach_project_message_file_v2', {
      p_message_id: input.messageId,
      p_attachment_id: attachmentId,
      p_storage_path: storagePath,
      p_file_name: file.name,
      p_mime_type: file.type || 'application/octet-stream',
      p_size_bytes: file.size,
    });
    if (metadataError) {
      await supabase.storage.from('project-message-attachments').remove([storagePath]);
      throw new Error(`${file.name}: liitteen tietojen tallennus epäonnistui: ${metadataError.message}`);
    }
  }
}

export async function createProjectMessageAttachmentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('project-message-attachments')
    .createSignedUrl(storagePath, 600);
  if (error || !data?.signedUrl) {
    throw new Error(`Liitteen avaaminen epäonnistui: ${error?.message ?? 'linkkiä ei voitu luoda'}`);
  }
  return data.signedUrl;
}

export async function markProjectMessagesRead(
  projectId: string,
  channel: ProjectMessageChannel,
): Promise<void> {
  const { error } = await supabase.rpc('mark_project_messages_read', {
    p_project_id: projectId,
    p_channel: channel,
  });
  if (error) throw new Error(`Viestien kuittaus epäonnistui: ${error.message}`);
}

export function subscribeProjectMessages(projectId: string, onChange: () => void) {
  const channel = supabase
    .channel(`project-collaboration-${projectId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'project_messages', filter: `project_id=eq.${projectId}` },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'project_message_attachments', filter: `project_id=eq.${projectId}` },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'project_message_mentions' },
      onChange,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
