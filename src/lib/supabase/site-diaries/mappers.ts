import { isSiteDiaryStatus, type SiteDiaryCompletion } from '@/lib/siteDiaryRules';
import type {
  SiteDiary,
  SiteDiaryAttachment,
  SiteDiaryEvent,
  SiteDiarySignature,
  SiteDiaryWeatherObservation,
  SiteDiaryWorkforceRow,
  SiteDiaryWorkItem,
  WorkforceCategory,
  WorkItemState,
  SiteDiaryEventType,
  SiteDiaryEventStatus,
  SiteDiaryAttachmentCategory,
  SiteDiarySignatureRole,
} from './types';

type Row = Record<string, unknown>;

function asRow(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Tietokanta palautti virheellisen tietueen.');
  }
  return value as Row;
}

function text(row: Row, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

function optionalText(row: Row, key: string): string | undefined {
  return text(row, key) || undefined;
}

function numberValue(row: Row, key: string): number {
  const value = row[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function optionalNumber(row: Row, key: string): number | undefined {
  return row[key] == null ? undefined : numberValue(row, key);
}

function booleanValue(row: Row, key: string): boolean {
  return row[key] === true;
}

export function mapDiary(value: unknown): SiteDiary {
  const row = asRow(value);
  const rawStatus = row.status;
  return {
    id: text(row, 'id'),
    organizationId: text(row, 'organization_id'),
    projectId: text(row, 'project_id'),
    project: text(row, 'project'),
    date: text(row, 'date'),
    author: text(row, 'author'),
    status: isSiteDiaryStatus(rawStatus) ? rawStatus : 'Luonnos',
    siteAddress: optionalText(row, 'site_address'),
    contractNumber: optionalText(row, 'contract_number'),
    responsibleSupervisorId: optionalText(row, 'responsible_supervisor_id'),
    preparedBy: optionalText(row, 'prepared_by'),
    submittedAt: optionalText(row, 'submitted_at'),
    reviewedBy: optionalText(row, 'reviewed_by'),
    reviewedAt: optionalText(row, 'reviewed_at'),
    lockedBy: optionalText(row, 'locked_by'),
    lockedAt: optionalText(row, 'locked_at'),
    approvedBy: optionalText(row, 'approved_by'),
    approvedAt: optionalText(row, 'approved_at'),
    version: Math.max(1, numberValue(row, 'version')),
    supersedesId: optionalText(row, 'supersedes_id'),
    isCurrent: row.is_current == null ? true : booleanValue(row, 'is_current'),
    visibleToCustomer: booleanValue(row, 'visible_to_customer'),
    summary: optionalText(row, 'summary'),
    correctionReason: optionalText(row, 'correction_reason'),
    contentChecksum: optionalText(row, 'content_checksum'),
    pdfDocumentId: optionalText(row, 'pdf_document_id'),
    snapshot: row.snapshot,
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
  };
}

export function mapCompletion(value: unknown): SiteDiaryCompletion {
  const row = asRow(value);
  const rawMissing = row.missing;
  return {
    percent: numberValue(row, 'percent'),
    missing: Array.isArray(rawMissing)
      ? rawMissing.filter((item): item is string => typeof item === 'string')
      : [],
    weatherCount: numberValue(row, 'weather_count'),
    workforceCount: numberValue(row, 'workforce_count'),
    workItemCount: numberValue(row, 'work_item_count'),
    openCriticalCount: numberValue(row, 'open_critical_count'),
  };
}

export function mapWeather(value: unknown): SiteDiaryWeatherObservation {
  const row = asRow(value);
  const source = text(row, 'source');
  return {
    id: text(row, 'id'),
    diaryId: text(row, 'diary_id'),
    observationTime: text(row, 'observation_time'),
    temperatureC: optionalNumber(row, 'temperature_c'),
    weatherCondition: optionalText(row, 'weather_condition'),
    windSpeedMs: optionalNumber(row, 'wind_speed_ms'),
    windGustMs: optionalNumber(row, 'wind_gust_ms'),
    precipitationMm: optionalNumber(row, 'precipitation_mm'),
    workImpact: optionalText(row, 'work_impact'),
    source: source === 'automatic' || source === 'corrected' ? source : 'manual',
    createdBy: optionalText(row, 'created_by'),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
  };
}

export function mapWorkforce(value: unknown): SiteDiaryWorkforceRow {
  const row = asRow(value);
  return {
    id: text(row, 'id'),
    diaryId: text(row, 'diary_id'),
    category: text(row, 'category') as WorkforceCategory,
    companyName: optionalText(row, 'company_name'),
    trade: optionalText(row, 'trade'),
    headcount: numberValue(row, 'headcount'),
    notes: optionalText(row, 'notes'),
    sortOrder: numberValue(row, 'sort_order'),
    createdBy: optionalText(row, 'created_by'),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
  };
}

export function mapWorkItem(value: unknown): SiteDiaryWorkItem {
  const row = asRow(value);
  return {
    id: text(row, 'id'),
    diaryId: text(row, 'diary_id'),
    phaseState: text(row, 'phase_state') as WorkItemState,
    workOrderId: optionalText(row, 'work_order_id'),
    title: text(row, 'title'),
    location: optionalText(row, 'location'),
    responsibleParty: optionalText(row, 'responsible_party'),
    progressPercent: optionalNumber(row, 'progress_percent'),
    startedAt: optionalText(row, 'started_at'),
    completedAt: optionalText(row, 'completed_at'),
    inspectionRequired: booleanValue(row, 'inspection_required'),
    relatedInspectionId: optionalText(row, 'related_inspection_id'),
    notes: optionalText(row, 'notes'),
    sortOrder: numberValue(row, 'sort_order'),
    createdBy: optionalText(row, 'created_by'),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
  };
}

export function mapEvent(value: unknown): SiteDiaryEvent {
  const row = asRow(value);
  return {
    id: text(row, 'id'),
    diaryId: text(row, 'diary_id'),
    eventType: text(row, 'event_type') as SiteDiaryEventType,
    occurredAt: optionalText(row, 'occurred_at'),
    title: text(row, 'title'),
    description: optionalText(row, 'description'),
    responsibleParty: optionalText(row, 'responsible_party'),
    dueAt: optionalText(row, 'due_at'),
    status: text(row, 'status') as SiteDiaryEventStatus,
    costImpactCents: optionalNumber(row, 'cost_impact_cents'),
    scheduleImpactDays: optionalNumber(row, 'schedule_impact_days'),
    changeOrderId: optionalText(row, 'change_order_id'),
    safetyItemId: optionalText(row, 'safety_item_id'),
    sortOrder: numberValue(row, 'sort_order'),
    createdBy: optionalText(row, 'created_by'),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
  };
}

export function mapAttachment(value: unknown): SiteDiaryAttachment {
  const row = asRow(value);
  return {
    id: text(row, 'id'),
    diaryId: text(row, 'diary_id'),
    category: text(row, 'category') as SiteDiaryAttachmentCategory,
    caption: optionalText(row, 'caption'),
    storagePath: text(row, 'storage_path'),
    fileName: text(row, 'file_name'),
    mimeType: text(row, 'mime_type'),
    sizeBytes: numberValue(row, 'size_bytes'),
    capturedAt: optionalText(row, 'captured_at'),
    sortOrder: numberValue(row, 'sort_order'),
    createdBy: optionalText(row, 'created_by'),
    createdAt: text(row, 'created_at'),
  };
}

export function mapSignature(value: unknown): SiteDiarySignature {
  const row = asRow(value);
  return {
    id: text(row, 'id'),
    diaryId: text(row, 'diary_id'),
    signatureRole: text(row, 'signature_role') as SiteDiarySignatureRole,
    signerName: text(row, 'signer_name'),
    signerTitle: optionalText(row, 'signer_title'),
    signedByUserId: optionalText(row, 'signed_by_user_id'),
    signedAt: text(row, 'signed_at'),
    signatureMethod: text(row, 'signature_method') as SiteDiarySignature['signatureMethod'],
    signatureSvg: optionalText(row, 'signature_svg'),
    comment: optionalText(row, 'comment'),
    createdAt: text(row, 'created_at'),
  };
}

export async function assertNoError(error: { message?: string } | null, fallback: string): Promise<void> {
  if (error) throw new Error(error.message || fallback);
}
