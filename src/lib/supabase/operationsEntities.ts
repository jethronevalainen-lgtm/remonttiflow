import { supabase } from './client';
import type {
  Announcement,
  DiaryEntry,
  DrivingLogEntry,
  Message,
  TravelExpense,
  WasteEntry,
} from '@/types';

type TableName =
  | 'diary_entries'
  | 'waste_entries'
  | 'driving_log_entries'
  | 'travel_expenses'
  | 'announcements'
  | 'messages';
type Payload = Record<string, unknown>;

function basePayload(organizationId: string, createdBy?: string): Payload {
  return {
    organization_id: organizationId,
    ...(createdBy ? { created_by: createdBy } : {}),
  };
}

async function insert(table: TableName, payload: Payload): Promise<void> {
  const { error } = await supabase.from(table).insert(payload);
  if (error) throw new Error(`Tallennus epäonnistui: ${error.message}`);
}

async function update(
  table: TableName,
  organizationId: string,
  id: string,
  payload: Payload,
): Promise<void> {
  const { error } = await supabase
    .from(table)
    .update(payload)
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`Päivitys epäonnistui: ${error.message}`);
}

async function remove(table: TableName, organizationId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`Poistaminen epäonnistui: ${error.message}`);
}

function diaryPayload(entry: Omit<DiaryEntry, 'id'> | Partial<DiaryEntry>): Payload {
  const payload: Payload = {};
  if (entry.projectId !== undefined) payload.project_id = entry.projectId || null;
  if (entry.project !== undefined) payload.project = entry.project || null;
  if (entry.date !== undefined) payload.date = entry.date;
  if (entry.author !== undefined) payload.author = entry.author || null;
  if (entry.weather !== undefined) payload.weather = entry.weather || null;
  if (entry.temperature !== undefined) payload.temperature = entry.temperature === '' ? null : Number(entry.temperature);
  if (entry.workers !== undefined) payload.workers = entry.workers;
  if (entry.workDescription !== undefined) payload.work_phases = entry.workDescription || null;
  if (entry.deliveries !== undefined) payload.deliveries = entry.deliveries || null;
  if (entry.issues !== undefined) payload.issues = entry.issues || null;
  if (entry.delays !== undefined) payload.delays = entry.delays || null;
  if (entry.status !== undefined) payload.status = entry.status;
  if (entry.approvedBy !== undefined) payload.approved_by = entry.approvedBy || null;
  if (entry.approvedAt !== undefined) payload.approved_at = entry.approvedAt || null;
  if (entry.lockedBy !== undefined) payload.locked_by = entry.lockedBy || null;
  return payload;
}

export async function createDiaryEntryRecord(
  organizationId: string,
  createdBy: string | undefined,
  entry: Omit<DiaryEntry, 'id'>,
): Promise<void> {
  await insert('diary_entries', { ...basePayload(organizationId, createdBy), ...diaryPayload(entry) });
}

export async function updateDiaryEntryRecord(
  organizationId: string,
  id: string,
  entry: Partial<DiaryEntry>,
): Promise<void> {
  await update('diary_entries', organizationId, id, diaryPayload(entry));
}

export const deleteDiaryEntryRecord = (organizationId: string, id: string) =>
  remove('diary_entries', organizationId, id);

function wastePayload(entry: Omit<WasteEntry, 'id'> | Partial<WasteEntry>): Payload {
  const payload: Payload = {};
  if (entry.projectId !== undefined) payload.project_id = entry.projectId || null;
  if (entry.project !== undefined) payload.project = entry.project || null;
  if (entry.date !== undefined) payload.date = entry.date;
  if (entry.wasteType !== undefined) payload.waste_type = entry.wasteType;
  if (entry.amount !== undefined) payload.amount = entry.amount;
  if (entry.unit !== undefined) payload.unit = entry.unit || null;
  else if (entry.method !== undefined) payload.unit = entry.method || null;
  if (entry.cost !== undefined) payload.cost = entry.cost;
  if (entry.notes !== undefined) payload.notes = entry.notes || null;
  if (entry.destination !== undefined) payload.destination = entry.destination || null;
  if (entry.receiptNumber !== undefined) payload.receipt_number = entry.receiptNumber || null;
  if (entry.hazardous !== undefined) payload.hazardous = entry.hazardous;
  return payload;
}

export async function createWasteEntryRecord(
  organizationId: string,
  createdBy: string | undefined,
  entry: Omit<WasteEntry, 'id'>,
): Promise<void> {
  await insert('waste_entries', { ...basePayload(organizationId, createdBy), ...wastePayload(entry) });
}

export async function updateWasteEntryRecord(
  organizationId: string,
  id: string,
  entry: Partial<WasteEntry>,
): Promise<void> {
  await update('waste_entries', organizationId, id, wastePayload(entry));
}

export const deleteWasteEntryRecord = (organizationId: string, id: string) =>
  remove('waste_entries', organizationId, id);

function drivingPayload(entry: Omit<DrivingLogEntry, 'id'> | Partial<DrivingLogEntry>): Payload {
  const payload: Payload = {};
  if (entry.date !== undefined) payload.date = entry.date;
  if (entry.userId !== undefined) payload.user_id = entry.userId || null;
  if (entry.driver !== undefined) payload.driver = entry.driver || null;
  if (entry.equipmentId !== undefined) payload.equipment_id = entry.equipmentId || null;
  if (entry.startAddress !== undefined) payload.start_address = entry.startAddress || null;
  if (entry.endAddress !== undefined) payload.end_address = entry.endAddress || null;
  if (entry.distance !== undefined) payload.distance_km = entry.distance;
  if (entry.purpose !== undefined) payload.purpose = entry.purpose || null;
  if (entry.projectId !== undefined) payload.project_id = entry.projectId || null;
  if (entry.project !== undefined) payload.project = entry.project || null;
  if (entry.startOdometerKm !== undefined) payload.start_odometer_km = entry.startOdometerKm ?? null;
  if (entry.endOdometerKm !== undefined) payload.end_odometer_km = entry.endOdometerKm ?? null;
  return payload;
}

export async function createDrivingLogRecord(
  organizationId: string,
  createdBy: string | undefined,
  entry: Omit<DrivingLogEntry, 'id'>,
): Promise<void> {
  await insert('driving_log_entries', { ...basePayload(organizationId, createdBy), ...drivingPayload(entry) });
}

export async function updateDrivingLogRecord(
  organizationId: string,
  id: string,
  entry: Partial<DrivingLogEntry>,
): Promise<void> {
  await update('driving_log_entries', organizationId, id, drivingPayload(entry));
}

export const deleteDrivingLogRecord = (organizationId: string, id: string) =>
  remove('driving_log_entries', organizationId, id);

function travelPayload(expense: Omit<TravelExpense, 'id'> | Partial<TravelExpense>): Payload {
  const payload: Payload = {};
  if (expense.date !== undefined) payload.date = expense.date;
  if (expense.userId !== undefined) payload.user_id = expense.userId || null;
  if (expense.employee !== undefined) payload.employee = expense.employee || null;
  if (expense.projectId !== undefined) payload.project_id = expense.projectId || null;
  if (expense.type !== undefined) payload.type = expense.type || null;
  if (expense.description !== undefined) payload.description = expense.description || null;
  if (expense.amount !== undefined) payload.amount = expense.amount;
  if (expense.status !== undefined) payload.status = expense.status;
  if (expense.approvedBy !== undefined) payload.approved_by = expense.approvedBy || null;
  if (expense.approvedAt !== undefined) payload.approved_at = expense.approvedAt || null;
  if (expense.rejectionReason !== undefined) payload.rejection_reason = expense.rejectionReason || null;
  if (expense.attachmentPath !== undefined) payload.attachment_path = expense.attachmentPath || null;
  return payload;
}

export async function createTravelExpenseRecord(
  organizationId: string,
  createdBy: string | undefined,
  expense: Omit<TravelExpense, 'id'>,
): Promise<void> {
  await insert('travel_expenses', { ...basePayload(organizationId, createdBy), ...travelPayload(expense) });
}

export async function updateTravelExpenseRecord(
  organizationId: string,
  id: string,
  expense: Partial<TravelExpense>,
): Promise<void> {
  await update('travel_expenses', organizationId, id, travelPayload(expense));
}

export const deleteTravelExpenseRecord = (organizationId: string, id: string) =>
  remove('travel_expenses', organizationId, id);

function announcementPayload(announcement: Omit<Announcement, 'id'>): Payload {
  return {
    title: announcement.title,
    content: announcement.content || null,
    priority: announcement.priority,
    author: announcement.author || null,
    published_at: announcement.date,
  };
}

export async function createAnnouncementRecord(
  organizationId: string,
  createdBy: string | undefined,
  announcement: Omit<Announcement, 'id'>,
): Promise<void> {
  await insert('announcements', {
    ...basePayload(organizationId, createdBy),
    ...announcementPayload(announcement),
  });
}

export const deleteAnnouncementRecord = (organizationId: string, id: string) =>
  remove('announcements', organizationId, id);

function messagePayload(message: Omit<Message, 'id'> | Partial<Message>): Payload {
  const payload: Payload = {};
  if (message.sender !== undefined) payload.sender = message.sender || null;
  if (message.recipient !== undefined) payload.recipient = message.recipient || null;
  if (message.subject !== undefined) payload.subject = message.subject || null;
  if (message.content !== undefined) payload.content = message.content || null;
  if (message.read !== undefined) payload.read = message.read;
  if (message.timestamp !== undefined) payload.sent_at = message.timestamp;
  return payload;
}

export async function createMessageRecord(
  organizationId: string,
  createdBy: string | undefined,
  message: Omit<Message, 'id'>,
): Promise<void> {
  await insert('messages', { ...basePayload(organizationId, createdBy), ...messagePayload(message) });
}

export async function updateMessageRecord(
  organizationId: string,
  id: string,
  message: Partial<Message>,
): Promise<void> {
  await update('messages', organizationId, id, messagePayload(message));
}

export const deleteMessageRecord = (organizationId: string, id: string) =>
  remove('messages', organizationId, id);
