import { supabase } from './client';

export type HrRecordStatus = 'Avoin' | 'Käynnissä' | 'Valmis' | 'Ohitettu';

export interface EmploymentProfile {
  employeeId: string;
  organizationId: string;
  employeeNumber?: string;
  personalEmail?: string;
  workLocation?: string;
  costCenter?: string;
  jobLevel?: string;
  contractType?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  probationEndDate?: string;
  noticePeriod?: string;
  workingTimeModel?: string;
  remoteWorkPolicy?: string;
  managerNotes?: string;
  updatedAt: string;
}

export interface EmployeeSkill {
  id: string;
  organizationId: string;
  employeeId: string;
  skillName: string;
  category: string;
  currentLevel: number;
  targetLevel: number;
  assessmentSource: string;
  lastAssessedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeTrainingRecord {
  id: string;
  organizationId: string;
  employeeId: string;
  title: string;
  provider?: string;
  trainingType: string;
  status: string;
  startDate?: string;
  endDate?: string;
  hours?: number;
  costCents?: number;
  validUntil?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeGoal {
  id: string;
  organizationId: string;
  employeeId: string;
  title: string;
  description?: string;
  category: string;
  status: string;
  progress: number;
  targetDate?: string;
  completedAt?: string;
  employeeComment?: string;
  managerComment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeConversation {
  id: string;
  organizationId: string;
  employeeId: string;
  conversationType: string;
  scheduledAt?: string;
  heldAt?: string;
  status: string;
  summary?: string;
  agreedActions?: string;
  nextFollowUpDate?: string;
  employeeAcknowledgedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeHrTask {
  id: string;
  organizationId: string;
  employeeId: string;
  phase: string;
  title: string;
  description?: string;
  ownerUserId?: string;
  dueDate?: string;
  status: HrRecordStatus;
  completedAt?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeDocument {
  id: string;
  organizationId: string;
  employeeId: string;
  title: string;
  documentType: string;
  storagePath: string;
  originalFilename: string;
  mimeType?: string;
  sizeBytes?: number;
  issueDate?: string;
  validUntil?: string;
  visibility: 'Vain HR' | 'HR ja esihenkilö' | 'Työntekijä';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeHrEvent {
  id: string;
  organizationId: string;
  employeeId: string;
  eventType: string;
  eventDate: string;
  title: string;
  description?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface HrWorkspaceData {
  employmentProfiles: EmploymentProfile[];
  skills: EmployeeSkill[];
  trainings: EmployeeTrainingRecord[];
  goals: EmployeeGoal[];
  conversations: EmployeeConversation[];
  tasks: EmployeeHrTask[];
  documents: EmployeeDocument[];
  events: EmployeeHrEvent[];
}

export interface EmploymentProfileInput {
  employeeNumber?: string;
  personalEmail?: string;
  workLocation?: string;
  costCenter?: string;
  jobLevel?: string;
  contractType?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  probationEndDate?: string;
  noticePeriod?: string;
  workingTimeModel?: string;
  remoteWorkPolicy?: string;
  managerNotes?: string;
}

type Row = Record<string, unknown>;
type HrTable =
  | 'employee_skills'
  | 'employee_training_records'
  | 'employee_goals'
  | 'employee_conversations'
  | 'employee_hr_tasks';

function rows(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.filter((item): item is Row => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function text(row: Row, key: string): string {
  return typeof row[key] === 'string' ? row[key] as string : '';
}

function optionalText(row: Row, key: string): string | undefined {
  return text(row, key) || undefined;
}

function optionalNumber(row: Row, key: string): number | undefined {
  const value = row[key];
  if (value == null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function employmentProfile(row: Row): EmploymentProfile {
  return {
    employeeId: text(row, 'employee_id'),
    organizationId: text(row, 'organization_id'),
    employeeNumber: optionalText(row, 'employee_number'),
    personalEmail: optionalText(row, 'personal_email'),
    workLocation: optionalText(row, 'work_location'),
    costCenter: optionalText(row, 'cost_center'),
    jobLevel: optionalText(row, 'job_level'),
    contractType: optionalText(row, 'contract_type'),
    contractStartDate: optionalText(row, 'contract_start_date'),
    contractEndDate: optionalText(row, 'contract_end_date'),
    probationEndDate: optionalText(row, 'probation_end_date'),
    noticePeriod: optionalText(row, 'notice_period'),
    workingTimeModel: optionalText(row, 'working_time_model'),
    remoteWorkPolicy: optionalText(row, 'remote_work_policy'),
    managerNotes: optionalText(row, 'manager_notes'),
    updatedAt: text(row, 'updated_at'),
  };
}

function skill(row: Row): EmployeeSkill {
  return {
    id: text(row, 'id'), organizationId: text(row, 'organization_id'), employeeId: text(row, 'employee_id'),
    skillName: text(row, 'skill_name'), category: text(row, 'category'),
    currentLevel: optionalNumber(row, 'current_level') ?? 1,
    targetLevel: optionalNumber(row, 'target_level') ?? 3,
    assessmentSource: text(row, 'assessment_source'),
    lastAssessedAt: optionalText(row, 'last_assessed_at'), notes: optionalText(row, 'notes'),
    createdAt: text(row, 'created_at'), updatedAt: text(row, 'updated_at'),
  };
}

function training(row: Row): EmployeeTrainingRecord {
  return {
    id: text(row, 'id'), organizationId: text(row, 'organization_id'), employeeId: text(row, 'employee_id'),
    title: text(row, 'title'), provider: optionalText(row, 'provider'), trainingType: text(row, 'training_type'),
    status: text(row, 'status'), startDate: optionalText(row, 'start_date'), endDate: optionalText(row, 'end_date'),
    hours: optionalNumber(row, 'hours'), costCents: optionalNumber(row, 'cost_cents'),
    validUntil: optionalText(row, 'valid_until'), notes: optionalText(row, 'notes'),
    createdAt: text(row, 'created_at'), updatedAt: text(row, 'updated_at'),
  };
}

function goal(row: Row): EmployeeGoal {
  return {
    id: text(row, 'id'), organizationId: text(row, 'organization_id'), employeeId: text(row, 'employee_id'),
    title: text(row, 'title'), description: optionalText(row, 'description'), category: text(row, 'category'),
    status: text(row, 'status'), progress: optionalNumber(row, 'progress') ?? 0,
    targetDate: optionalText(row, 'target_date'), completedAt: optionalText(row, 'completed_at'),
    employeeComment: optionalText(row, 'employee_comment'), managerComment: optionalText(row, 'manager_comment'),
    createdAt: text(row, 'created_at'), updatedAt: text(row, 'updated_at'),
  };
}

function conversation(row: Row): EmployeeConversation {
  return {
    id: text(row, 'id'), organizationId: text(row, 'organization_id'), employeeId: text(row, 'employee_id'),
    conversationType: text(row, 'conversation_type'), scheduledAt: optionalText(row, 'scheduled_at'),
    heldAt: optionalText(row, 'held_at'), status: text(row, 'status'), summary: optionalText(row, 'summary'),
    agreedActions: optionalText(row, 'agreed_actions'), nextFollowUpDate: optionalText(row, 'next_follow_up_date'),
    employeeAcknowledgedAt: optionalText(row, 'employee_acknowledged_at'),
    createdAt: text(row, 'created_at'), updatedAt: text(row, 'updated_at'),
  };
}

function task(row: Row): EmployeeHrTask {
  const status = text(row, 'status');
  return {
    id: text(row, 'id'), organizationId: text(row, 'organization_id'), employeeId: text(row, 'employee_id'),
    phase: text(row, 'phase'), title: text(row, 'title'), description: optionalText(row, 'description'),
    ownerUserId: optionalText(row, 'owner_user_id'), dueDate: optionalText(row, 'due_date'),
    status: status === 'Käynnissä' || status === 'Valmis' || status === 'Ohitettu' ? status : 'Avoin',
    completedAt: optionalText(row, 'completed_at'), sortOrder: optionalNumber(row, 'sort_order') ?? 0,
    createdAt: text(row, 'created_at'), updatedAt: text(row, 'updated_at'),
  };
}

function document(row: Row): EmployeeDocument {
  const visibility = text(row, 'visibility');
  return {
    id: text(row, 'id'), organizationId: text(row, 'organization_id'), employeeId: text(row, 'employee_id'),
    title: text(row, 'title'), documentType: text(row, 'document_type'), storagePath: text(row, 'storage_path'),
    originalFilename: text(row, 'original_filename'), mimeType: optionalText(row, 'mime_type'),
    sizeBytes: optionalNumber(row, 'size_bytes'), issueDate: optionalText(row, 'issue_date'),
    validUntil: optionalText(row, 'valid_until'),
    visibility: visibility === 'Vain HR' || visibility === 'Työntekijä' ? visibility : 'HR ja esihenkilö',
    notes: optionalText(row, 'notes'), createdAt: text(row, 'created_at'), updatedAt: text(row, 'updated_at'),
  };
}

function event(row: Row): EmployeeHrEvent {
  const metadata = row.metadata;
  return {
    id: text(row, 'id'), organizationId: text(row, 'organization_id'), employeeId: text(row, 'employee_id'),
    eventType: text(row, 'event_type'), eventDate: text(row, 'event_date'), title: text(row, 'title'),
    description: optionalText(row, 'description'),
    metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? metadata as Record<string, unknown>
      : {},
    createdAt: text(row, 'created_at'),
  };
}

async function tableRows(table: string, organizationId: string, orderColumn: string, ascending = false) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('organization_id', organizationId)
    .order(orderColumn, { ascending });
  if (error) throw new Error(`HR-tietojen haku epäonnistui (${table}): ${error.message}`);
  return rows(data);
}

export async function loadHrWorkspace(organizationId: string): Promise<HrWorkspaceData> {
  const [profiles, skills, trainings, goals, conversations, tasks, documents, events] = await Promise.all([
    tableRows('employee_employment_profiles', organizationId, 'updated_at'),
    tableRows('employee_skills', organizationId, 'updated_at'),
    tableRows('employee_training_records', organizationId, 'start_date'),
    tableRows('employee_goals', organizationId, 'target_date', true),
    tableRows('employee_conversations', organizationId, 'scheduled_at'),
    tableRows('employee_hr_tasks', organizationId, 'due_date', true),
    tableRows('employee_documents', organizationId, 'created_at'),
    tableRows('employee_hr_events', organizationId, 'event_date'),
  ]);
  return {
    employmentProfiles: profiles.map(employmentProfile), skills: skills.map(skill), trainings: trainings.map(training),
    goals: goals.map(goal), conversations: conversations.map(conversation), tasks: tasks.map(task),
    documents: documents.map(document), events: events.slice(0, 1000).map(event),
  };
}

export async function saveEmploymentProfile(values: {
  organizationId: string; employeeId: string; userId: string; input: EmploymentProfileInput;
}): Promise<void> {
  const { input } = values;
  const { error } = await supabase.from('employee_employment_profiles').upsert({
    organization_id: values.organizationId, employee_id: values.employeeId,
    employee_number: input.employeeNumber?.trim() || null,
    personal_email: input.personalEmail?.trim().toLowerCase() || null,
    work_location: input.workLocation?.trim() || null,
    cost_center: input.costCenter?.trim() || null,
    job_level: input.jobLevel?.trim() || null,
    contract_type: input.contractType?.trim() || null,
    contract_start_date: input.contractStartDate || null,
    contract_end_date: input.contractEndDate || null,
    probation_end_date: input.probationEndDate || null,
    notice_period: input.noticePeriod?.trim() || null,
    working_time_model: input.workingTimeModel?.trim() || null,
    remote_work_policy: input.remoteWorkPolicy?.trim() || null,
    manager_notes: input.managerNotes?.trim() || null,
    updated_by: values.userId,
  }, { onConflict: 'employee_id' });
  if (error) throw new Error(`Työsuhdetietojen tallennus epäonnistui: ${error.message}`);
}

async function insertRecord(table: HrTable, payload: Record<string, unknown>, label: string): Promise<void> {
  const { error } = await supabase.from(table).insert(payload);
  if (error) throw new Error(`${label} tallennus epäonnistui: ${error.message}`);
}

export async function createEmployeeSkill(values: {
  organizationId: string; employeeId: string; userId: string; skillName: string; category: string;
  currentLevel: number; targetLevel: number; assessmentSource: string; notes?: string;
}): Promise<void> {
  await insertRecord('employee_skills', {
    organization_id: values.organizationId, employee_id: values.employeeId,
    skill_name: values.skillName.trim(), category: values.category.trim() || 'Ammattiosaaminen',
    current_level: values.currentLevel, target_level: values.targetLevel,
    assessment_source: values.assessmentSource, last_assessed_at: new Date().toISOString().slice(0, 10),
    verified_by: values.userId, notes: values.notes?.trim() || null,
    created_by: values.userId, updated_by: values.userId,
  }, 'Osaamisen');
}

export async function createEmployeeTraining(values: {
  organizationId: string; employeeId: string; userId: string; title: string; provider?: string;
  status: string; startDate?: string; validUntil?: string; notes?: string;
}): Promise<void> {
  await insertRecord('employee_training_records', {
    organization_id: values.organizationId, employee_id: values.employeeId,
    title: values.title.trim(), provider: values.provider?.trim() || null, status: values.status,
    start_date: values.startDate || null, valid_until: values.validUntil || null,
    notes: values.notes?.trim() || null, created_by: values.userId, updated_by: values.userId,
  }, 'Koulutuksen');
}

export async function createEmployeeGoal(values: {
  organizationId: string; employeeId: string; userId: string; title: string; description?: string;
  category: string; status: string; progress: number; targetDate?: string;
}): Promise<void> {
  await insertRecord('employee_goals', {
    organization_id: values.organizationId, employee_id: values.employeeId,
    title: values.title.trim(), description: values.description?.trim() || null,
    category: values.category.trim() || 'Työ', status: values.status, progress: values.progress,
    target_date: values.targetDate || null, created_by: values.userId, updated_by: values.userId,
  }, 'Tavoitteen');
}

export async function createEmployeeConversation(values: {
  organizationId: string; employeeId: string; userId: string; conversationType: string;
  scheduledAt?: string; status: string; summary?: string; agreedActions?: string; nextFollowUpDate?: string;
}): Promise<void> {
  await insertRecord('employee_conversations', {
    organization_id: values.organizationId, employee_id: values.employeeId,
    conversation_type: values.conversationType,
    scheduled_at: values.scheduledAt ? new Date(values.scheduledAt).toISOString() : null,
    held_at: values.status === 'Pidetty' ? new Date().toISOString() : null,
    status: values.status, summary: values.summary?.trim() || null,
    agreed_actions: values.agreedActions?.trim() || null,
    next_follow_up_date: values.nextFollowUpDate || null,
    created_by: values.userId, updated_by: values.userId,
  }, 'Keskustelun');
}

export async function createEmployeeHrTask(values: {
  organizationId: string; employeeId: string; userId: string; phase: string;
  title: string; description?: string; dueDate?: string;
}): Promise<void> {
  await insertRecord('employee_hr_tasks', {
    organization_id: values.organizationId, employee_id: values.employeeId,
    phase: values.phase, title: values.title.trim(), description: values.description?.trim() || null,
    due_date: values.dueDate || null, status: 'Avoin',
    created_by: values.userId, updated_by: values.userId,
  }, 'HR-tehtävän');
}

export async function updateHrTaskStatus(values: {
  organizationId: string; id: string; userId: string; status: HrRecordStatus;
}): Promise<void> {
  const { error } = await supabase.from('employee_hr_tasks').update({
    status: values.status,
    completed_at: values.status === 'Valmis' ? new Date().toISOString() : null,
    updated_by: values.userId,
  }).eq('organization_id', values.organizationId).eq('id', values.id);
  if (error) throw new Error(`HR-tehtävän päivitys epäonnistui: ${error.message}`);
}

export async function deleteHrRecord(table: HrTable, organizationId: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('organization_id', organizationId).eq('id', id);
  if (error) throw new Error(`HR-tiedon poistaminen epäonnistui: ${error.message}`);
}

export async function uploadEmployeeDocument(values: {
  organizationId: string; employeeId: string; userId: string; file: File; title: string;
  documentType: string; issueDate?: string; validUntil?: string;
  visibility: EmployeeDocument['visibility']; notes?: string;
}): Promise<void> {
  if (values.file.size > 15 * 1024 * 1024) throw new Error('Tiedoston enimmäiskoko on 15 Mt.');
  const safeName = values.file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120) || 'document';
  const storagePath = `${values.organizationId}/${values.employeeId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from('employee-hr-documents').upload(storagePath, values.file, {
    cacheControl: '3600', upsert: false, contentType: values.file.type || undefined,
  });
  if (uploadError) throw new Error(`Dokumentin lataus epäonnistui: ${uploadError.message}`);
  const { error: insertError } = await supabase.from('employee_documents').insert({
    organization_id: values.organizationId, employee_id: values.employeeId,
    title: values.title.trim(), document_type: values.documentType, storage_path: storagePath,
    original_filename: values.file.name, mime_type: values.file.type || null, size_bytes: values.file.size,
    issue_date: values.issueDate || null, valid_until: values.validUntil || null,
    visibility: values.visibility, notes: values.notes?.trim() || null, uploaded_by: values.userId,
  });
  if (insertError) {
    await supabase.storage.from('employee-hr-documents').remove([storagePath]);
    throw new Error(`Dokumentin rekisteröinti epäonnistui: ${insertError.message}`);
  }
}

export async function createEmployeeDocumentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from('employee-hr-documents').createSignedUrl(storagePath, 300);
  if (error || !data?.signedUrl) throw new Error(`Dokumentin avaaminen epäonnistui: ${error?.message ?? 'Osoite puuttuu.'}`);
  return data.signedUrl;
}

export async function deleteEmployeeDocument(values: {
  organizationId: string; id: string; storagePath: string;
}): Promise<void> {
  const { error: storageError } = await supabase.storage.from('employee-hr-documents').remove([values.storagePath]);
  if (storageError) throw new Error(`Dokumenttitiedoston poistaminen epäonnistui: ${storageError.message}`);
  const { error } = await supabase.from('employee_documents').delete()
    .eq('organization_id', values.organizationId).eq('id', values.id);
  if (error) throw new Error(`Dokumentin tietueen poistaminen epäonnistui: ${error.message}`);
}
