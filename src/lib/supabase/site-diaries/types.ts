import type { SiteDiaryCompletion, SiteDiaryStatus } from '@/lib/siteDiaryRules';

export type WeatherSource = 'manual' | 'automatic' | 'corrected';
export type WorkforceCategory =
  | 'supervisor'
  | 'own_skilled'
  | 'own_other'
  | 'subcontractor'
  | 'temporary'
  | 'visitor';
export type WorkItemState = 'started' | 'ongoing' | 'completed';
export type SiteDiaryEventType =
  | 'inspection'
  | 'review'
  | 'meeting'
  | 'delivery'
  | 'instruction'
  | 'deviation'
  | 'delay'
  | 'safety'
  | 'environmental'
  | 'plan_change'
  | 'decision_needed'
  | 'yse_43_3'
  | 'yse_44_2'
  | 'other';
export type SiteDiaryEventStatus = 'Avoin' | 'Käsittelyssä' | 'Ratkaistu' | 'Ei toimenpiteitä';
export type SiteDiaryAttachmentCategory =
  | 'overview'
  | 'work_phase'
  | 'completed_work'
  | 'deviation'
  | 'damage'
  | 'safety'
  | 'delivery'
  | 'inspection'
  | 'other';
export type SiteDiarySignatureRole = 'responsible_supervisor' | 'inspector' | 'customer' | 'other';

export interface SiteDiary {
  id: string;
  organizationId: string;
  projectId: string;
  project: string;
  date: string;
  author: string;
  status: SiteDiaryStatus;
  siteAddress?: string;
  contractNumber?: string;
  responsibleSupervisorId?: string;
  preparedBy?: string;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  lockedBy?: string;
  lockedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  version: number;
  supersedesId?: string;
  isCurrent: boolean;
  visibleToCustomer: boolean;
  summary?: string;
  correctionReason?: string;
  contentChecksum?: string;
  pdfDocumentId?: string;
  snapshot?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface SiteDiaryWeatherObservation {
  id: string;
  diaryId: string;
  observationTime: string;
  temperatureC?: number;
  weatherCondition?: string;
  windSpeedMs?: number;
  windGustMs?: number;
  precipitationMm?: number;
  workImpact?: string;
  source: WeatherSource;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SiteDiaryWorkforceRow {
  id: string;
  diaryId: string;
  category: WorkforceCategory;
  companyName?: string;
  trade?: string;
  headcount: number;
  notes?: string;
  sortOrder: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SiteDiaryWorkItem {
  id: string;
  diaryId: string;
  phaseState: WorkItemState;
  workOrderId?: string;
  title: string;
  location?: string;
  responsibleParty?: string;
  progressPercent?: number;
  startedAt?: string;
  completedAt?: string;
  inspectionRequired: boolean;
  relatedInspectionId?: string;
  notes?: string;
  sortOrder: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SiteDiaryEvent {
  id: string;
  diaryId: string;
  eventType: SiteDiaryEventType;
  occurredAt?: string;
  title: string;
  description?: string;
  responsibleParty?: string;
  dueAt?: string;
  status: SiteDiaryEventStatus;
  costImpactCents?: number;
  scheduleImpactDays?: number;
  changeOrderId?: string;
  safetyItemId?: string;
  sortOrder: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SiteDiaryAttachment {
  id: string;
  diaryId: string;
  category: SiteDiaryAttachmentCategory;
  caption?: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  capturedAt?: string;
  sortOrder: number;
  createdBy?: string;
  createdAt: string;
}

export interface SiteDiarySignature {
  id: string;
  diaryId: string;
  signatureRole: SiteDiarySignatureRole;
  signerName: string;
  signerTitle?: string;
  signedByUserId?: string;
  signedAt: string;
  signatureMethod: 'typed' | 'drawn' | 'strong_auth' | 'external_link';
  signatureSvg?: string;
  comment?: string;
  createdAt: string;
}

export interface SiteDiaryBundle {
  diary: SiteDiary;
  completion: SiteDiaryCompletion;
  weather: SiteDiaryWeatherObservation[];
  workforce: SiteDiaryWorkforceRow[];
  workItems: SiteDiaryWorkItem[];
  events: SiteDiaryEvent[];
  attachments: SiteDiaryAttachment[];
  signatures: SiteDiarySignature[];
}

export type SiteDiaryListFilters = {
  projectId?: string;
  status?: SiteDiaryStatus | 'all';
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  includeHistory?: boolean;
};
