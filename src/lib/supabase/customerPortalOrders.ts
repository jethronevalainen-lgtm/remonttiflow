import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/client';

export type PortalOrderStatus =
  | 'Uusi' | 'Tarkennettava' | 'Käsittelyssä' | 'Hyväksytty' | 'Suunnittelussa'
  | 'Työmääräys luotu' | 'Aikataulutettu' | 'Käynnissä' | 'Odottaa' | 'Valmis' | 'Peruttu';
export type PortalUrgency = 'Kiireellinen' | 'Normaali' | 'Ei kiireellinen';
export type PortalProfile = 'viewer' | 'contact' | 'approver' | 'admin' | 'finance';

export interface PortalAccount {
  customerId: string;
  customerName: string;
  accessScope: string;
  profile: PortalProfile;
  permissions: Record<string, boolean>;
  visibleProjectCount: number;
}

export interface PortalProject {
  id: string;
  customerId: string;
  customerName: string;
  name: string;
  location?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  progress: number;
  supervisorName?: string;
  supervisorEmail?: string;
  activeOrderCount: number;
  pendingDecisionCount: number;
  lastActivityAt?: string;
}

export interface PortalOrderSummary {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  projectId: string;
  projectName: string;
  title: string;
  category: string;
  status: PortalOrderStatus;
  urgency: PortalUrgency;
  progress: number;
  requestedDate?: string;
  desiredCompletionDate?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  workOrderId?: string;
  supervisorNote?: string;
  lastActivityAt: string;
  createdAt: string;
  unreadMessageCount: number;
  assignedSupervisorId?: string;
  assignedSupervisorName?: string;
  messageCount?: number;
}

export interface PortalActivity {
  id: string;
  type: string;
  title: string;
  description?: string;
  projectId?: string;
  requestId?: string;
  createdAt: string;
}

export interface PortalHome {
  accounts: PortalAccount[];
  projects: PortalProject[];
  orders: PortalOrderSummary[];
  tasks: { pendingDecisions: number; clarifications: number; acknowledgements: number; unreadMessages: number };
  activities: PortalActivity[];
}

export interface PortalOrderItemDraft {
  id?: string;
  title: string;
  description?: string;
  locationDetails?: string;
  quantity?: number | string;
  unit?: string;
  priority?: 'Korkea' | 'Normaali' | 'Matala';
  sortOrder?: number;
  completedAt?: string;
}

export interface PortalOrder {
  id: string;
  orderNumber: string;
  organizationId: string;
  customerId: string;
  customerName: string;
  projectId: string;
  projectName: string;
  projectLocation?: string;
  title: string;
  category: string;
  description: string;
  status: PortalOrderStatus;
  urgency: PortalUrgency;
  progress: number;
  locationDetails?: string;
  serviceAddress?: string;
  building?: string;
  stairwell?: string;
  unit?: string;
  contactName?: string;
  contactPhone?: string;
  requestedDate?: string;
  desiredCompletionDate?: string;
  preferredTime?: string;
  accessWindow?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  accessInstructions?: string;
  safetyNotes?: string;
  customerReference?: string;
  purchaseOrderNumber?: string;
  budgetLimitCents?: number;
  supervisorNote?: string;
  workOrderId?: string;
  assignedSupervisorId?: string;
  assignedSupervisorName?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  completedAt?: string;
}

export interface PortalParticipant {
  userId: string;
  displayName: string;
  email?: string;
  role: string;
  canMessage: boolean;
  canManage: boolean;
  canDecide: boolean;
}

export interface PortalAttachment {
  id: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface PortalMessage {
  id: string;
  authorUserId: string;
  authorName: string;
  body: string;
  replyToId?: string;
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
  attachments: PortalAttachment[];
}

export interface PortalEvent {
  id: string;
  type: string;
  title: string;
  description?: string;
  visibility: 'customer' | 'internal';
  actorName?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PortalPublication {
  id: string;
  type: string;
  title: string;
  summary?: string;
  version: number;
  requiresAcknowledgement: boolean;
  acknowledgedAt?: string;
  publishedAt: string;
  metadata: Record<string, unknown>;
}

export interface PortalOrderDetail {
  order: PortalOrder;
  items: PortalOrderItemDraft[];
  participants: PortalParticipant[];
  messages: PortalMessage[];
  events: PortalEvent[];
  publications: PortalPublication[];
  permissions: Record<string, boolean> & { isManager?: boolean; canEdit?: boolean; canMessage?: boolean; canCancel?: boolean };
  profile?: PortalProfile;
}

export interface PortalOrderDraft {
  organizationId: string;
  customerId: string;
  projectId: string;
  title: string;
  category: string;
  description: string;
  urgency: PortalUrgency;
  locationDetails?: string;
  serviceAddress?: string;
  building?: string;
  stairwell?: string;
  unit?: string;
  contactName?: string;
  contactPhone?: string;
  requestedDate?: string;
  desiredCompletionDate?: string;
  preferredTime?: string;
  accessWindow?: string;
  accessInstructions?: string;
  safetyNotes?: string;
  customerReference?: string;
  purchaseOrderNumber?: string;
  budgetLimitCents?: number;
  items: PortalOrderItemDraft[];
}

export interface ManagementPortalUser {
  userId: string;
  displayName: string;
  email?: string;
  customerId: string;
  customerName: string;
  accessScope: string;
  profile: PortalProfile;
  permissions: Record<string, boolean>;
  permissionOverrides: Record<string, boolean>;
  disabledAt?: string;
  lastPortalActivityAt?: string;
  projectIds: string[];
}

export interface ManagementInspection {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  type: string;
  status: string;
  progress: number;
  approvedAt?: string;
  customerVisible: boolean;
  publishedAt?: string;
}

export interface ManagementPublication {
  id: string;
  customerId?: string;
  projectId: string;
  projectName: string;
  type: string;
  title: string;
  summary?: string;
  version: number;
  status: string;
  requiresAcknowledgement: boolean;
  publishedAt?: string;
  acknowledgementCount: number;
}

export interface ManagementPortalDashboard {
  metrics: { openOrders: number; urgentOrders: number; waitingCustomer: number; portalUsers: number; unpublishedInspections: number };
  orders: PortalOrderSummary[];
  users: ManagementPortalUser[];
  inspections: ManagementInspection[];
  publications: ManagementPublication[];
}

function object<T>(value: unknown, fallback: T): T {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as T : fallback;
}

export async function loadCustomerPortalHome(organizationId: string): Promise<PortalHome> {
  const { data, error } = await supabase.rpc('customer_portal_home_v3', { p_organization_id: organizationId });
  if (error) throw new Error(`Tilaajaportaalin lataus epäonnistui: ${error.message}`);
  return object<PortalHome>(data, { accounts: [], projects: [], orders: [], tasks: { pendingDecisions: 0, clarifications: 0, acknowledgements: 0, unreadMessages: 0 }, activities: [] });
}

export async function loadPortalOrderDetail(organizationId: string, requestId: string): Promise<PortalOrderDetail> {
  const { data, error } = await supabase.rpc('customer_portal_order_detail_v3', { p_organization_id: organizationId, p_request_id: requestId });
  if (error) throw new Error(`Työtilauksen lataus epäonnistui: ${error.message}`);
  return object<PortalOrderDetail>(data, {} as PortalOrderDetail);
}

function orderArgs(draft: Omit<PortalOrderDraft, 'organizationId' | 'customerId' | 'projectId'>) {
  return {
    p_title: draft.title,
    p_category: draft.category,
    p_description: draft.description,
    p_urgency: draft.urgency,
    p_location_details: draft.locationDetails || null,
    p_service_address: draft.serviceAddress || null,
    p_building: draft.building || null,
    p_stairwell: draft.stairwell || null,
    p_unit: draft.unit || null,
    p_contact_name: draft.contactName || null,
    p_contact_phone: draft.contactPhone || null,
    p_requested_date: draft.requestedDate || null,
    p_desired_completion_date: draft.desiredCompletionDate || null,
    p_preferred_time: draft.preferredTime || null,
    p_access_window: draft.accessWindow || null,
    p_access_instructions: draft.accessInstructions || null,
    p_safety_notes: draft.safetyNotes || null,
    p_customer_reference: draft.customerReference || null,
    p_purchase_order_number: draft.purchaseOrderNumber || null,
    p_budget_limit_cents: draft.budgetLimitCents ?? null,
    p_items: draft.items.map((item, index) => ({ ...item, sortOrder: index })),
  };
}

export async function createPortalOrder(draft: PortalOrderDraft): Promise<string> {
  const { data, error } = await supabase.rpc('create_customer_portal_order_v3', {
    p_organization_id: draft.organizationId,
    p_customer_id: draft.customerId,
    p_project_id: draft.projectId,
    ...orderArgs(draft),
  });
  if (error) throw new Error(`Työtilauksen lähetys epäonnistui: ${error.message}`);
  if (typeof data !== 'string') throw new Error('Työtilauksen tunnistetta ei palautettu.');
  return data;
}

export async function updatePortalOrder(requestId: string, draft: Omit<PortalOrderDraft, 'organizationId' | 'customerId' | 'projectId'>): Promise<void> {
  const { error } = await supabase.rpc('update_customer_portal_order_v3', { p_request_id: requestId, ...orderArgs(draft) });
  if (error) throw new Error(`Työtilauksen päivitys epäonnistui: ${error.message}`);
}

export async function sendPortalOrderMessage(requestId: string, body: string, replyToId?: string): Promise<string> {
  const { data, error } = await supabase.rpc('send_customer_portal_order_message_v3', {
    p_request_id: requestId, p_body: body, p_reply_to_id: replyToId || null,
  });
  if (error) throw new Error(`Viestin lähetys epäonnistui: ${error.message}`);
  if (typeof data !== 'string') throw new Error('Viestin tunnistetta ei palautettu.');
  return data;
}

export async function uploadPortalOrderAttachments(values: {
  organizationId: string; requestId: string; messageId: string; files: File[];
}): Promise<void> {
  for (const file of values.files) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${values.organizationId}/${values.requestId}/${values.messageId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from('customer-order-files').upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (uploadError) throw new Error(`${file.name}: lataus epäonnistui: ${uploadError.message}`);
    const { error: registerError } = await supabase.rpc('register_customer_order_attachment_v3', {
      p_message_id: values.messageId,
      p_storage_path: path,
      p_file_name: file.name,
      p_mime_type: file.type || 'application/octet-stream',
      p_size_bytes: file.size,
    });
    if (registerError) {
      await supabase.storage.from('customer-order-files').remove([path]);
      throw new Error(`${file.name}: liitteen rekisteröinti epäonnistui: ${registerError.message}`);
    }
  }
}

export async function createPortalAttachmentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('customer-order-files').createSignedUrl(path, 600);
  if (error || !data?.signedUrl) throw new Error(`Liitettä ei voitu avata: ${error?.message ?? 'osoite puuttuu'}`);
  return data.signedUrl;
}

export async function markPortalOrderRead(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_customer_portal_order_read_v3', { p_request_id: requestId });
  if (error) throw new Error(`Lukutilan tallennus epäonnistui: ${error.message}`);
}

export async function cancelPortalOrder(requestId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_customer_portal_order_v3', { p_request_id: requestId, p_reason: reason || null });
  if (error) throw new Error(`Työtilauksen peruminen epäonnistui: ${error.message}`);
}

export async function acknowledgePortalPublication(publicationId: string, note?: string): Promise<void> {
  const { error } = await supabase.rpc('acknowledge_customer_portal_publication_v3', { p_publication_id: publicationId, p_note: note || null });
  if (error) throw new Error(`Kuittaus epäonnistui: ${error.message}`);
}

export async function loadManagementPortalDashboard(organizationId: string): Promise<ManagementPortalDashboard> {
  const { data, error } = await supabase.rpc('management_customer_portal_dashboard_v3', { p_organization_id: organizationId });
  if (error) throw new Error(`Tilaajaportaalin hallinnan lataus epäonnistui: ${error.message}`);
  return object<ManagementPortalDashboard>(data, { metrics: { openOrders: 0, urgentOrders: 0, waitingCustomer: 0, portalUsers: 0, unpublishedInspections: 0 }, orders: [], users: [], inspections: [], publications: [] });
}

export async function updateManagementPortalOrder(values: {
  requestId: string; status: PortalOrderStatus; progress: number; plannedStartDate?: string; plannedEndDate?: string;
  supervisorNote?: string; assignedSupervisorId?: string; participantUserIds: string[];
}): Promise<void> {
  const { error } = await supabase.rpc('management_update_customer_portal_order_v3', {
    p_request_id: values.requestId,
    p_status: values.status,
    p_progress: values.progress,
    p_planned_start_date: values.plannedStartDate || null,
    p_planned_end_date: values.plannedEndDate || null,
    p_supervisor_note: values.supervisorNote || null,
    p_assigned_supervisor_id: values.assignedSupervisorId || null,
    p_participant_user_ids: values.participantUserIds,
  });
  if (error) throw new Error(`Tilauksen päivitys epäonnistui: ${error.message}`);
}

export async function updatePortalUser(values: {
  organizationId: string; customerId: string; userId: string; profile: PortalProfile;
  permissions: Record<string, boolean>; disabled: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc('management_set_customer_portal_user_v3', {
    p_organization_id: values.organizationId,
    p_customer_id: values.customerId,
    p_user_id: values.userId,
    p_profile: values.profile,
    p_permissions: values.permissions,
    p_disabled: values.disabled,
  });
  if (error) throw new Error(`Tilaajakäyttäjän päivitys epäonnistui: ${error.message}`);
}

export async function setInspectionCustomerVisibility(inspectionId: string, visible: boolean, requiresAcknowledgement = false): Promise<void> {
  const { error } = await supabase.rpc('management_set_inspection_customer_visibility_v3', {
    p_inspection_id: inspectionId, p_visible: visible, p_requires_acknowledgement: requiresAcknowledgement,
  });
  if (error) throw new Error(`Tarkastuksen julkaisun päivitys epäonnistui: ${error.message}`);
}

export function subscribePortalOrder(requestId: string, onChange: () => void): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`customer-order-${requestId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_work_request_messages', filter: `request_id=eq.${requestId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_work_request_events', filter: `request_id=eq.${requestId}` }, onChange)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'customer_work_requests', filter: `id=eq.${requestId}` }, onChange);
  void channel.subscribe();
  return () => { void supabase.removeChannel(channel); };
}
