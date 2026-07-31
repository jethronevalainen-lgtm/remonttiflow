import { supabase } from '../client';
import {
  normalizeSiteDiaryError,
  siteDiaryStoragePath,
} from '@/lib/siteDiaryRules';
import { assertNoError, mapDiary } from './mappers';
import type {
  SiteDiary,
  SiteDiaryAttachment,
  SiteDiaryAttachmentCategory,
  SiteDiaryEvent,
  SiteDiaryEventStatus,
  SiteDiaryEventType,
  SiteDiaryWorkforceRow,
  SiteDiaryWorkItem,
  WeatherSource,
  WorkforceCategory,
  WorkItemState,
} from './types';

export async function updateSiteDiaryHeader(input: {
  organizationId: string;
  diaryId: string;
  siteAddress?: string;
  contractNumber?: string;
  responsibleSupervisorId?: string;
  author?: string;
  summary?: string;
  visibleToCustomer?: boolean;
}): Promise<void> {
  const { error } = await supabase
    .from('diary_entries')
    .update({
      site_address: input.siteAddress?.trim() || null,
      contract_number: input.contractNumber?.trim() || null,
      responsible_supervisor_id: input.responsibleSupervisorId || null,
      author: input.author?.trim() || null,
      summary: input.summary?.trim() || null,
      visible_to_customer: input.visibleToCustomer ?? false,
    })
    .eq('organization_id', input.organizationId)
    .eq('id', input.diaryId);
  await assertNoError(error, 'Päiväkirjan perustietojen tallennus epäonnistui.');
}

export async function upsertWeatherObservation(input: {
  id?: string;
  diaryId: string;
  userId: string;
  observationTime: string;
  temperatureC?: number;
  weatherCondition?: string;
  windSpeedMs?: number;
  windGustMs?: number;
  precipitationMm?: number;
  workImpact?: string;
  source?: WeatherSource;
}): Promise<void> {
  const values = {
    observation_time: input.observationTime,
    temperature_c: input.temperatureC ?? null,
    weather_condition: input.weatherCondition?.trim() || null,
    wind_speed_ms: input.windSpeedMs ?? null,
    wind_gust_ms: input.windGustMs ?? null,
    precipitation_mm: input.precipitationMm ?? null,
    work_impact: input.workImpact?.trim() || null,
    source: input.source ?? 'manual',
  };

  if (input.id) {
    const { error } = await supabase
      .from('site_diary_weather_observations')
      .update(values)
      .eq('id', input.id)
      .eq('diary_id', input.diaryId);
    await assertNoError(error, 'Säähavainnon tallennus epäonnistui.');
    return;
  }

  const { error } = await supabase
    .from('site_diary_weather_observations')
    .upsert({
      diary_id: input.diaryId,
      created_by: input.userId,
      ...values,
    }, { onConflict: 'diary_id,observation_time' });
  await assertNoError(error, 'Säähavainnon tallennus epäonnistui.');
}

export async function createWorkforceRow(input: {
  diaryId: string;
  userId: string;
  category: WorkforceCategory;
  companyName?: string;
  trade?: string;
  headcount: number;
  notes?: string;
  sortOrder?: number;
}): Promise<void> {
  const { error } = await supabase.from('site_diary_workforce_rows').insert({
    diary_id: input.diaryId,
    category: input.category,
    company_name: input.companyName?.trim() || null,
    trade: input.trade?.trim() || null,
    headcount: input.headcount,
    notes: input.notes?.trim() || null,
    sort_order: input.sortOrder ?? 0,
    created_by: input.userId,
  });
  await assertNoError(error, 'Työvoimarivin tallennus epäonnistui.');
}

export async function updateWorkforceRow(
  id: string,
  input: Partial<Omit<SiteDiaryWorkforceRow, 'id' | 'diaryId' | 'createdAt' | 'updatedAt' | 'createdBy'>>,
): Promise<void> {
  const { error } = await supabase.from('site_diary_workforce_rows').update({
    ...(input.category ? { category: input.category } : {}),
    ...(input.companyName !== undefined ? { company_name: input.companyName.trim() || null } : {}),
    ...(input.trade !== undefined ? { trade: input.trade.trim() || null } : {}),
    ...(input.headcount !== undefined ? { headcount: input.headcount } : {}),
    ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
    ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
  }).eq('id', id);
  await assertNoError(error, 'Työvoimarivin päivitys epäonnistui.');
}

export async function createWorkItem(input: {
  diaryId: string;
  userId: string;
  phaseState: WorkItemState;
  title: string;
  location?: string;
  responsibleParty?: string;
  progressPercent?: number;
  notes?: string;
  inspectionRequired?: boolean;
  workOrderId?: string;
}): Promise<void> {
  const { error } = await supabase.from('site_diary_work_items').insert({
    diary_id: input.diaryId,
    phase_state: input.phaseState,
    work_order_id: input.workOrderId || null,
    title: input.title.trim(),
    location: input.location?.trim() || null,
    responsible_party: input.responsibleParty?.trim() || null,
    progress_percent: input.progressPercent ?? null,
    inspection_required: input.inspectionRequired ?? false,
    notes: input.notes?.trim() || null,
    created_by: input.userId,
  });
  await assertNoError(error, 'Työvaiheen tallennus epäonnistui.');
}

export async function updateWorkItem(
  id: string,
  input: Partial<Omit<SiteDiaryWorkItem, 'id' | 'diaryId' | 'createdAt' | 'updatedAt' | 'createdBy'>>,
): Promise<void> {
  const { error } = await supabase.from('site_diary_work_items').update({
    ...(input.phaseState ? { phase_state: input.phaseState } : {}),
    ...(input.workOrderId !== undefined ? { work_order_id: input.workOrderId || null } : {}),
    ...(input.title !== undefined ? { title: input.title.trim() } : {}),
    ...(input.location !== undefined ? { location: input.location.trim() || null } : {}),
    ...(input.responsibleParty !== undefined ? { responsible_party: input.responsibleParty.trim() || null } : {}),
    ...(input.progressPercent !== undefined ? { progress_percent: input.progressPercent } : {}),
    ...(input.startedAt !== undefined ? { started_at: input.startedAt || null } : {}),
    ...(input.completedAt !== undefined ? { completed_at: input.completedAt || null } : {}),
    ...(input.inspectionRequired !== undefined ? { inspection_required: input.inspectionRequired } : {}),
    ...(input.relatedInspectionId !== undefined ? { related_inspection_id: input.relatedInspectionId || null } : {}),
    ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
    ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
  }).eq('id', id);
  await assertNoError(error, 'Työvaiheen päivitys epäonnistui.');
}

export async function createDiaryEvent(input: {
  diaryId: string;
  userId: string;
  eventType: SiteDiaryEventType;
  occurredAt?: string;
  title: string;
  description?: string;
  responsibleParty?: string;
  dueAt?: string;
  status?: SiteDiaryEventStatus;
  costImpactCents?: number;
  scheduleImpactDays?: number;
  changeOrderId?: string;
  safetyItemId?: string;
}): Promise<void> {
  const { error } = await supabase.from('site_diary_events').insert({
    diary_id: input.diaryId,
    event_type: input.eventType,
    occurred_at: input.occurredAt || null,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    responsible_party: input.responsibleParty?.trim() || null,
    due_at: input.dueAt || null,
    status: input.status ?? 'Avoin',
    cost_impact_cents: input.costImpactCents ?? null,
    schedule_impact_days: input.scheduleImpactDays ?? null,
    change_order_id: input.changeOrderId || null,
    safety_item_id: input.safetyItemId || null,
    created_by: input.userId,
  });
  await assertNoError(error, 'Tapahtuman tallennus epäonnistui.');
}

export async function updateDiaryEvent(
  id: string,
  input: Partial<Omit<SiteDiaryEvent, 'id' | 'diaryId' | 'createdAt' | 'updatedAt' | 'createdBy'>>,
): Promise<void> {
  const { error } = await supabase.from('site_diary_events').update({
    ...(input.eventType ? { event_type: input.eventType } : {}),
    ...(input.occurredAt !== undefined ? { occurred_at: input.occurredAt || null } : {}),
    ...(input.title !== undefined ? { title: input.title.trim() } : {}),
    ...(input.description !== undefined ? { description: input.description.trim() || null } : {}),
    ...(input.responsibleParty !== undefined ? { responsible_party: input.responsibleParty.trim() || null } : {}),
    ...(input.dueAt !== undefined ? { due_at: input.dueAt || null } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.costImpactCents !== undefined ? { cost_impact_cents: input.costImpactCents } : {}),
    ...(input.scheduleImpactDays !== undefined ? { schedule_impact_days: input.scheduleImpactDays } : {}),
    ...(input.changeOrderId !== undefined ? { change_order_id: input.changeOrderId || null } : {}),
    ...(input.safetyItemId !== undefined ? { safety_item_id: input.safetyItemId || null } : {}),
    ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
  }).eq('id', id);
  await assertNoError(error, 'Tapahtuman päivitys epäonnistui.');
}

export async function removeSiteDiaryChild(
  table: 'site_diary_workforce_rows' | 'site_diary_work_items' | 'site_diary_events',
  id: string,
): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  await assertNoError(error, 'Rivin poistaminen epäonnistui.');
}

export async function uploadSiteDiaryAttachment(input: {
  organizationId: string;
  projectId: string;
  diaryId: string;
  userId: string;
  file: File;
  category: SiteDiaryAttachmentCategory;
  caption?: string;
  capturedAt?: string;
}): Promise<void> {
  const attachmentId = crypto.randomUUID();
  const storagePath = siteDiaryStoragePath({
    organizationId: input.organizationId,
    projectId: input.projectId,
    diaryId: input.diaryId,
    attachmentId,
    fileName: input.file.name,
  });

  const { error: uploadError } = await supabase.storage
    .from('project-documents')
    .upload(storagePath, input.file, {
      upsert: false,
      contentType: input.file.type || 'application/octet-stream',
    });
  if (uploadError) throw new Error(`Tiedoston lataus epäonnistui: ${uploadError.message}`);

  const { error: insertError } = await supabase.from('site_diary_attachments').insert({
    id: attachmentId,
    diary_id: input.diaryId,
    category: input.category,
    caption: input.caption?.trim() || null,
    storage_path: storagePath,
    file_name: input.file.name,
    mime_type: input.file.type || 'application/octet-stream',
    size_bytes: input.file.size,
    captured_at: input.capturedAt || null,
    created_by: input.userId,
  });

  if (insertError) {
    await supabase.storage.from('project-documents').remove([storagePath]);
    throw new Error(`Liitteen tietojen tallennus epäonnistui: ${insertError.message}`);
  }
}

export async function createSiteDiaryAttachmentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('project-documents')
    .createSignedUrl(storagePath, 600);
  if (error || !data?.signedUrl) {
    throw new Error(`Liitteen avaaminen epäonnistui: ${error?.message ?? 'linkkiä ei voitu luoda'}`);
  }
  return data.signedUrl;
}

export async function deleteSiteDiaryAttachment(attachment: SiteDiaryAttachment): Promise<void> {
  const { error } = await supabase.from('site_diary_attachments').delete().eq('id', attachment.id);
  await assertNoError(error, 'Liitteen poistaminen epäonnistui.');

  // A correction version may reference the same immutable source object as the
  // locked version. Remove the object only after the final metadata reference
  // has disappeared; otherwise the original signed diary would lose its file.
  const { count, error: referenceError } = await supabase
    .from('site_diary_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('storage_path', attachment.storagePath);
  await assertNoError(referenceError, 'Liitteen viittausten tarkistus epäonnistui.');
  if ((count ?? 0) === 0) {
    const { error: storageError } = await supabase.storage
      .from('project-documents')
      .remove([attachment.storagePath]);
    await assertNoError(storageError, 'Liitetiedoston poistaminen epäonnistui.');
  }
}

async function workflowRpc(name: string, args: Record<string, unknown>): Promise<SiteDiary> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message || 'Päiväkirjan työnkulun päivitys epäonnistui.');
  return mapDiary(data);
}

export const submitSiteDiary = (diaryId: string) =>
  workflowRpc('submit_site_diary', { p_diary_id: diaryId });

export const reviewSiteDiary = (diaryId: string, approved: boolean, note?: string) =>
  workflowRpc('review_site_diary', {
    p_diary_id: diaryId,
    p_approved: approved,
    p_note: note?.trim() || null,
  });

export const lockSiteDiary = (input: {
  diaryId: string;
  signerName: string;
  signerTitle?: string;
  signatureSvg?: string;
  waitForExternalSignature?: boolean;
}) => workflowRpc('lock_site_diary', {
  p_diary_id: input.diaryId,
  p_signer_name: input.signerName.trim(),
  p_signer_title: input.signerTitle?.trim() || null,
  p_signature_svg: input.signatureSvg || null,
  p_wait_for_external_signature: input.waitForExternalSignature ?? false,
});

export const createSiteDiaryCorrection = (diaryId: string, reason: string) =>
  workflowRpc('create_site_diary_correction', {
    p_diary_id: diaryId,
    p_reason: reason.trim(),
  });

export const voidSiteDiary = (diaryId: string, reason: string) =>
  workflowRpc('void_site_diary', {
    p_diary_id: diaryId,
    p_reason: reason.trim(),
  });

export async function fetchSiteDiarySnapshot(diaryId: string): Promise<unknown> {
  const { data, error } = await supabase.rpc('get_site_diary_snapshot', { p_diary_id: diaryId });
  if (error) {
    throw new Error(normalizeSiteDiaryError(error, 'Päiväkirjan varmennetun sisällön haku epäonnistui.'));
  }
  return data;
}
