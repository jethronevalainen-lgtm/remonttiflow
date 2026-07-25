export type InspectionStatus =
  | 'Luonnos'
  | 'Suunniteltu'
  | 'Käynnissä'
  | 'Puutteita havaittu'
  | 'Korjattavana'
  | 'Uusintatarkastus'
  | 'Hyväksyttävänä'
  | 'Hyväksytty'
  | 'Mitätöity';

export type InspectionResultStatus =
  | 'Tarkastamatta'
  | 'Kunnossa'
  | 'Puute'
  | 'Ei koske kohdetta'
  | 'Ei voitu tarkastaa'
  | 'Tarkastettava myöhemmin';

export type FindingStatus =
  | 'Avoin'
  | 'Osoitettu'
  | 'Työn alla'
  | 'Ilmoitettu korjatuksi'
  | 'Odottaa uusintatarkastusta'
  | 'Hyväksytty'
  | 'Hylätty'
  | 'Mitätöity';

export type FindingSeverity =
  | 'Vähäinen'
  | 'Korjattava ennen luovutusta'
  | 'Merkittävä'
  | 'Kriittinen';

export interface InspectionTemplateSummary {
  id: string;
  organizationId?: string;
  name: string;
  category: string;
  description: string;
  system: boolean;
  versionId: string;
  version: number;
}

export interface ProjectBuilding {
  id: string;
  projectId: string;
  name: string;
  address: string;
}

export interface ProjectStairwell {
  id: string;
  projectId: string;
  buildingId: string;
  name: string;
}

export interface ProjectUnit {
  id: string;
  projectId: string;
  buildingId?: string;
  stairwellId?: string;
  unitCode: string;
  floor: string;
  unitType: string;
  areaM2?: number;
  renovationScope: string;
  status: string;
  responsibleSupervisorId?: string;
  plannedCompletionDate?: string;
  actualCompletionDate?: string;
  notes: string;
}

export interface OrganizationPerson {
  userId: string;
  role: string;
  name: string;
  email: string;
}

export interface InspectionSummary {
  id: string;
  organizationId: string;
  projectId: string;
  unitId?: string;
  templateVersionId: string;
  title: string;
  inspectionType: string;
  status: InspectionStatus;
  scheduledDate?: string;
  inspectorId?: string;
  summary: string;
  progress: number;
  startedAt?: string;
  completedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  reportVersion: number;
  createdAt: string;
}

export interface InspectionFinding {
  id: string;
  inspectionId: string;
  resultId?: string;
  projectId: string;
  unitId?: string;
  title: string;
  description: string;
  location: string;
  category: string;
  severity: FindingSeverity;
  status: FindingStatus;
  assigneeUserId?: string;
  contractorName: string;
  dueDate?: string;
  correctionNote: string;
  reportedCorrectedAt?: string;
  verifiedAt?: string;
  rejectionReason: string;
  workOrderId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FindingAction {
  id: string;
  findingId: string;
  actionType: string;
  note: string;
  attachmentPath: string;
  createdBy?: string;
  createdAt: string;
}

export interface InspectionAttachment {
  id: string;
  inspectionId?: string;
  resultId?: string;
  findingId?: string;
  objectPath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: string;
  caption: string;
  createdAt: string;
}

export interface InspectionSignature {
  id: string;
  inspectionId: string;
  signerName: string;
  signerRole: string;
  signerCompany: string;
  signatureType: string;
  note: string;
  signedAt: string;
}

export interface InspectionReport {
  id: string;
  inspectionId: string;
  version: number;
  snapshot: Record<string, unknown>;
  generatedAt: string;
}

export interface InspectionResultDetail {
  id: string;
  inspectionId: string;
  itemId: string;
  status: InspectionResultStatus;
  comment: string;
  measurementValue?: number;
  measurementUnit: string;
  itemTitle: string;
  guidance: string;
  required: boolean;
  photoRequiredOnDefect: boolean;
  sectionId: string;
  sectionTitle: string;
  sectionDescription: string;
  sectionOrder: number;
  itemOrder: number;
}

export interface InspectionWorkspace {
  templates: InspectionTemplateSummary[];
  buildings: ProjectBuilding[];
  stairwells: ProjectStairwell[];
  units: ProjectUnit[];
  inspections: InspectionSummary[];
  findings: InspectionFinding[];
  people: OrganizationPerson[];
  reports: InspectionReport[];
}

export interface InspectionDetail {
  inspection: InspectionSummary;
  results: InspectionResultDetail[];
  findings: InspectionFinding[];
  actions: FindingAction[];
  attachments: InspectionAttachment[];
  signatures: InspectionSignature[];
  reports: InspectionReport[];
}

export interface TemplateEditorSection {
  id: string;
  title: string;
  description: string;
  items: Array<{
    id: string;
    title: string;
    guidance: string;
    required: boolean;
    photoRequiredOnDefect: boolean;
  }>;
}
