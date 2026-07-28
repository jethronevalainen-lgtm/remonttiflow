import type { ProjectRequestFormValues } from '@/lib/projectRequestIntake';
import { isSupportedProjectRequestFile } from '@/lib/projectRequestIntake';
import { supabase } from '@/lib/supabase/client';

export type ProjectRequestStatus =
  | 'Luonnos'
  | 'Lähetetty'
  | 'Käsittelyssä'
  | 'Lisätietoja pyydetty'
  | 'Hyväksytty'
  | 'Hylätty'
  | 'Muutettu projektiksi';

export interface ProjectRequestAttachment {
  id: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  description: string;
  createdAt: string;
}

export interface ProjectRequest {
  id: string;
  organizationId: string;
  customerId: string;
  customerName: string;
  createdBy: string;
  projectName: string;
  requestType: ProjectRequestFormValues['requestType'];
  location: string;
  building: string;
  staircase: string;
  apartment: string;
  customerReference: string;
  description: string;
  desiredStartDate: string;
  desiredEndDate: string;
  deadlineFlexibility: ProjectRequestFormValues['deadlineFlexibility'];
  occupancyStatus: ProjectRequestFormValues['occupancyStatus'];
  currentResidentMovingOut: boolean;
  currentResidentMoveOutDate: string;
  incomingResidentStatus: ProjectRequestFormValues['incomingResidentStatus'];
  incomingResidentMoveInDate: string;
  incomingContractStatus: ProjectRequestFormValues['incomingContractStatus'];
  deadlineReason: string;
  accessMethod: ProjectRequestFormValues['accessMethod'];
  allowedWorkingHours: string;
  accessNotes: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  residentContactName: string;
  residentContactPhone: string;
  residentContactEmail: string;
  residentContactAllowed: boolean;
  contactInstructions: string;
  status: ProjectRequestStatus;
  managementNote: string;
  convertedProjectId: string;
  createdAt: string;
  submittedAt: string;
  reviewedAt: string;
  attachments: ProjectRequestAttachment[];
}

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.filter((item): item is Row => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function text(row: Row, key: string): string {
  return typeof row[key] === 'string' ? row[key] as string : '';
}

function booleanValue(row: Row, key: string): boolean {
  return row[key] === true;
}

function numberValue(row: Row, key: string): number {
  const parsed = Number(row[key]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapAttachments(value: unknown): ProjectRequestAttachment[] {
  return rows(value).map((row) => ({
    id: text(row, 'id'),
    storagePath: text(row, 'storage_path'),
    fileName: text(row, 'file_name'),
    mimeType: text(row, 'mime_type'),
    sizeBytes: numberValue(row, 'size_bytes'),
    description: text(row, 'description'),
    createdAt: text(row, 'created_at'),
  })).filter((item) => item.id && item.storagePath);
}

export function mapProjectRequestRow(row: Row): ProjectRequest {
  return {
    id: text(row, 'id'),
    organizationId: text(row, 'organization_id'),
    customerId: text(row, 'customer_id'),
    customerName: text(row, 'customer_name'),
    createdBy: text(row, 'created_by'),
    projectName: text(row, 'project_name'),
    requestType: (text(row, 'request_type') || 'Korjaus') as ProjectRequest['requestType'],
    location: text(row, 'location'),
    building: text(row, 'building'),
    staircase: text(row, 'staircase'),
    apartment: text(row, 'apartment'),
    customerReference: text(row, 'customer_reference'),
    description: text(row, 'description'),
    desiredStartDate: text(row, 'desired_start_date'),
    desiredEndDate: text(row, 'desired_end_date'),
    deadlineFlexibility: (text(row, 'deadline_flexibility') || 'Joustava') as ProjectRequest['deadlineFlexibility'],
    occupancyStatus: (text(row, 'occupancy_status') || 'Ei tiedossa') as ProjectRequest['occupancyStatus'],
    currentResidentMovingOut: booleanValue(row, 'current_resident_moving_out'),
    currentResidentMoveOutDate: text(row, 'current_resident_move_out_date'),
    incomingResidentStatus: (text(row, 'incoming_resident_status') || 'Ei tiedossa') as ProjectRequest['incomingResidentStatus'],
    incomingResidentMoveInDate: text(row, 'incoming_resident_move_in_date'),
    incomingContractStatus: (text(row, 'incoming_contract_status') || 'Ei tiedossa') as ProjectRequest['incomingContractStatus'],
    deadlineReason: text(row, 'deadline_reason'),
    accessMethod: text(row, 'access_method') as ProjectRequest['accessMethod'],
    allowedWorkingHours: text(row, 'allowed_working_hours'),
    accessNotes: text(row, 'access_notes'),
    contactName: text(row, 'contact_name'),
    contactPhone: text(row, 'contact_phone'),
    contactEmail: text(row, 'contact_email'),
    residentContactName: text(row, 'resident_contact_name'),
    residentContactPhone: text(row, 'resident_contact_phone'),
    residentContactEmail: text(row, 'resident_contact_email'),
    residentContactAllowed: booleanValue(row, 'resident_contact_allowed'),
    contactInstructions: text(row, 'contact_instructions'),
    status: (text(row, 'status') || 'Lähetetty') as ProjectRequestStatus,
    managementNote: text(row, 'management_note'),
    convertedProjectId: text(row, 'converted_project_id'),
    createdAt: text(row, 'created_at'),
    submittedAt: text(row, 'submitted_at'),
    reviewedAt: text(row, 'reviewed_at'),
    attachments: mapAttachments(row.attachments),
  };
}

export function projectRequestToForm(request: ProjectRequest): ProjectRequestFormValues {
  return {
    customerId: request.customerId,
    title: request.projectName === 'Nimeämätön työpyyntö' ? '' : request.projectName,
    requestType: request.requestType,
    location: request.location,
    building: request.building,
    staircase: request.staircase,
    apartment: request.apartment,
    customerReference: request.customerReference,
    description: request.description === 'Luonnos, tietoja ei ole vielä lähetetty.' ? '' : request.description,
    desiredStartDate: request.desiredStartDate,
    desiredEndDate: request.desiredEndDate,
    deadlineFlexibility: request.deadlineFlexibility,
    occupancyStatus: request.occupancyStatus,
    currentResidentMovingOut: request.currentResidentMovingOut,
    currentResidentMoveOutDate: request.currentResidentMoveOutDate,
    incomingResidentStatus: request.incomingResidentStatus,
    incomingResidentMoveInDate: request.incomingResidentMoveInDate,
    incomingContractStatus: request.incomingContractStatus,
    deadlineReason: request.deadlineReason,
    accessMethod: request.accessMethod,
    allowedWorkingHours: request.allowedWorkingHours || 'Arkisin 7.00–16.00',
    accessNotes: request.accessNotes,
    contactName: request.contactName,
    contactPhone: request.contactPhone,
    contactEmail: request.contactEmail,
    residentContactName: request.residentContactName,
    residentContactPhone: request.residentContactPhone,
    residentContactEmail: request.residentContactEmail,
    residentContactAllowed: request.residentContactAllowed,
    contactInstructions: request.contactInstructions,
  };
}

export async function loadProjectRequests(organizationId: string): Promise<ProjectRequest[]> {
  const { data, error } = await supabase.rpc('project_requests_for_user', {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(`Työpyyntöjen haku epäonnistui: ${error.message}`);
  return rows(data).map(mapProjectRequestRow).filter((item) => item.id);
}

export async function createProjectRequestDraft(organizationId: string, customerId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_customer_project_request_draft', {
    p_organization_id: organizationId,
    p_customer_id: customerId,
  });
  if (error) throw new Error(`Luonnoksen luonti epäonnistui: ${error.message}`);
  if (typeof data !== 'string') throw new Error('Tietokanta ei palauttanut työpyynnön tunnistetta.');
  return data;
}

export async function saveProjectRequestDraft(requestId: string, values: ProjectRequestFormValues): Promise<void> {
  const { error } = await supabase.rpc('save_customer_project_request_draft', {
    p_request_id: requestId,
    p_payload: values,
  });
  if (error) throw new Error(`Luonnoksen tallennus epäonnistui: ${error.message}`);
}

export async function submitProjectRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('submit_customer_project_request', {
    p_request_id: requestId,
  });
  if (error) throw new Error(`Työpyynnön lähetys epäonnistui: ${error.message}`);
}

function safeFileName(name: string): string {
  const normalized = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return normalized.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'liite';
}

function normalizedMimeType(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase();
  const fallbacks: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    heic: 'image/heic', heif: 'image/heif', pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return extension ? fallbacks[extension] ?? 'application/octet-stream' : 'application/octet-stream';
}

export async function uploadProjectRequestAttachments(input: {
  organizationId: string;
  requestId: string;
  files: File[];
  onFileState?: (file: File, state: 'uploading' | 'complete' | 'error', error?: string) => void;
}): Promise<ProjectRequestAttachment[]> {
  if (input.files.length > 20) throw new Error('Työpyyntöön voi lisätä enintään 20 liitettä.');
  const uploaded: ProjectRequestAttachment[] = [];
  for (const file of input.files) {
    try {
      if (!isSupportedProjectRequestFile(file)) throw new Error('Tiedostotyyppiä ei sallita.');
      if (file.size > 20 * 1024 * 1024) throw new Error('Tiedosto ylittää 20 Mt kokorajan.');
      input.onFileState?.(file, 'uploading');
      const attachmentId = crypto.randomUUID();
      const mimeType = normalizedMimeType(file);
      const storagePath = `${input.organizationId}/${input.requestId}/${attachmentId}/${safeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from('project-request-attachments')
        .upload(storagePath, file, { upsert: false, contentType: mimeType });
      if (uploadError) throw new Error(uploadError.message);

      const { error: metadataError } = await supabase.rpc('attach_customer_project_request_file', {
        p_request_id: input.requestId,
        p_attachment_id: attachmentId,
        p_storage_path: storagePath,
        p_file_name: file.name,
        p_mime_type: mimeType,
        p_size_bytes: file.size,
        p_description: null,
      });
      if (metadataError) {
        await supabase.storage.from('project-request-attachments').remove([storagePath]);
        throw new Error(metadataError.message);
      }
      const attachment: ProjectRequestAttachment = {
        id: attachmentId,
        storagePath,
        fileName: file.name,
        mimeType,
        sizeBytes: file.size,
        description: '',
        createdAt: new Date().toISOString(),
      };
      uploaded.push(attachment);
      input.onFileState?.(file, 'complete');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Lataus epäonnistui.';
      input.onFileState?.(file, 'error', message);
      throw new Error(`${file.name}: ${message}`);
    }
  }
  return uploaded;
}

export async function updateProjectRequestAttachmentDescription(attachmentId: string, description: string): Promise<void> {
  const { error } = await supabase.rpc('update_customer_project_request_attachment', {
    p_attachment_id: attachmentId,
    p_description: description,
  });
  if (error) throw new Error(`Liitteen kuvauksen tallennus epäonnistui: ${error.message}`);
}

export async function deleteProjectRequestAttachment(attachmentId: string): Promise<void> {
  const { data, error } = await supabase.rpc('delete_customer_project_request_attachment', {
    p_attachment_id: attachmentId,
  });
  if (error) throw new Error(`Liitteen poisto epäonnistui: ${error.message}`);
  if (typeof data === 'string' && data) {
    const { error: storageError } = await supabase.storage.from('project-request-attachments').remove([data]);
    if (storageError) throw new Error(`Liitteen tiedosto jäi tallennustilaan: ${storageError.message}`);
  }
}

export async function createProjectRequestAttachmentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('project-request-attachments')
    .createSignedUrl(storagePath, 600);
  if (error || !data?.signedUrl) {
    throw new Error(`Liitteen avaaminen epäonnistui: ${error?.message ?? 'linkkiä ei voitu luoda'}`);
  }
  return data.signedUrl;
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
  if (error) throw new Error(`Työpyynnön päivitys epäonnistui: ${error.message}`);
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
