import { supabase } from './client';
import type {
  FindingAction, InspectionAttachment, InspectionDetail, InspectionFinding,
  InspectionReport, InspectionResultDetail, InspectionResultStatus, InspectionStatus,
  InspectionSummary, InspectionTemplateSummary, InspectionWorkspace, OrganizationPerson,
  ProjectBuilding, ProjectStairwell, ProjectUnit, TemplateEditorSection, FindingSeverity, FindingStatus,
} from './inspectionTypes';

type Row = Record<string, unknown>;

function asRow(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Tietokanta palautti virheellisen tietueen.');
  }
  return value as Row;
}

function text(row: Row, key: string): string {
  return typeof row[key] === 'string' ? row[key] as string : '';
}

function optionalText(row: Row, key: string): string | undefined {
  const value = text(row, key);
  return value || undefined;
}

function bool(row: Row, key: string): boolean {
  return row[key] === true;
}

function num(row: Row, key: string): number {
  const value = row[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.map(asRow) : [];
}

function failure(prefix: string, message: string): Error {
  return new Error(`${prefix}: ${message}`);
}

function mapBuilding(row: Row): ProjectBuilding {
  return { id: text(row, 'id'), projectId: text(row, 'project_id'), name: text(row, 'name'), address: text(row, 'address') };
}

function mapStairwell(row: Row): ProjectStairwell {
  return { id: text(row, 'id'), projectId: text(row, 'project_id'), buildingId: text(row, 'building_id'), name: text(row, 'name') };
}

function mapUnit(row: Row): ProjectUnit {
  return {
    id: text(row, 'id'), projectId: text(row, 'project_id'), buildingId: optionalText(row, 'building_id'),
    stairwellId: optionalText(row, 'stairwell_id'), unitCode: text(row, 'unit_code'), floor: text(row, 'floor'),
    unitType: text(row, 'unit_type'), areaM2: row.area_m2 == null ? undefined : num(row, 'area_m2'),
    renovationScope: text(row, 'renovation_scope'), status: text(row, 'status'),
    responsibleSupervisorId: optionalText(row, 'responsible_supervisor_id'),
    plannedCompletionDate: optionalText(row, 'planned_completion_date'),
    actualCompletionDate: optionalText(row, 'actual_completion_date'), notes: text(row, 'notes'),
  };
}

function mapInspection(row: Row): InspectionSummary {
  return {
    id: text(row, 'id'), organizationId: text(row, 'organization_id'), projectId: text(row, 'project_id'),
    unitId: optionalText(row, 'unit_id'), templateVersionId: text(row, 'template_version_id'),
    title: text(row, 'title'), inspectionType: text(row, 'inspection_type'), status: text(row, 'status') as InspectionStatus,
    scheduledDate: optionalText(row, 'scheduled_date'), inspectorId: optionalText(row, 'inspector_id'),
    summary: text(row, 'summary'), progress: num(row, 'progress'), startedAt: optionalText(row, 'started_at'),
    completedAt: optionalText(row, 'completed_at'), approvedAt: optionalText(row, 'approved_at'),
    approvedBy: optionalText(row, 'approved_by'), reportVersion: num(row, 'report_version'), createdAt: text(row, 'created_at'),
  };
}

function mapFinding(row: Row): InspectionFinding {
  return {
    id: text(row, 'id'), inspectionId: text(row, 'inspection_id'), resultId: optionalText(row, 'result_id'),
    projectId: text(row, 'project_id'), unitId: optionalText(row, 'unit_id'), title: text(row, 'title'),
    description: text(row, 'description'), location: text(row, 'location'), category: text(row, 'category'),
    severity: text(row, 'severity') as FindingSeverity, status: text(row, 'status') as FindingStatus,
    assigneeUserId: optionalText(row, 'assignee_user_id'), contractorName: text(row, 'contractor_name'),
    dueDate: optionalText(row, 'due_date'), correctionNote: text(row, 'correction_note'),
    reportedCorrectedAt: optionalText(row, 'reported_corrected_at'), verifiedAt: optionalText(row, 'verified_at'),
    rejectionReason: text(row, 'rejection_reason'), workOrderId: optionalText(row, 'work_order_id'),
    createdAt: text(row, 'created_at'), updatedAt: text(row, 'updated_at'),
  };
}

function mapAttachment(row: Row): InspectionAttachment {
  return {
    id: text(row, 'id'), inspectionId: optionalText(row, 'inspection_id'), resultId: optionalText(row, 'result_id'),
    findingId: optionalText(row, 'finding_id'), objectPath: text(row, 'object_path'), fileName: text(row, 'file_name'),
    mimeType: text(row, 'mime_type'), sizeBytes: num(row, 'size_bytes'), kind: text(row, 'kind'),
    caption: text(row, 'caption'), createdAt: text(row, 'created_at'),
  };
}

function mapReport(row: Row): InspectionReport {
  const snapshot = row.snapshot;
  return {
    id: text(row, 'id'), inspectionId: text(row, 'inspection_id'), version: num(row, 'version'),
    snapshot: snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
      ? snapshot as Record<string, unknown> : {}, generatedAt: text(row, 'generated_at'),
  };
}

async function selectOrganizationRows(table: string, organizationId: string, orderColumn?: string): Promise<Row[]> {
  let query = supabase.from(table).select('*').eq('organization_id', organizationId);
  if (orderColumn) query = query.order(orderColumn);
  const { data, error } = await query;
  if (error) throw failure(`${table}-tietojen haku epäonnistui`, error.message);
  return rows(data);
}

async function loadPeople(organizationId: string): Promise<OrganizationPerson[]> {
  const { data: membershipData, error: membershipError } = await supabase
    .from('organization_members').select('user_id, role').eq('organization_id', organizationId);
  if (membershipError) throw failure('Henkilöiden haku epäonnistui', membershipError.message);
  const memberships = rows(membershipData);
  const userIds = memberships.map((item) => text(item, 'user_id')).filter(Boolean);
  if (!userIds.length) return [];
  const { data: profileData, error: profileError } = await supabase
    .from('profiles').select('id, full_name, email').in('id', userIds);
  if (profileError) throw failure('Profiilien haku epäonnistui', profileError.message);
  const profileMap = new Map(rows(profileData).map((item) => [text(item, 'id'), item]));
  return memberships.map((membership): OrganizationPerson => {
    const userId = text(membership, 'user_id');
    const profile = profileMap.get(userId) ?? {};
    const email = text(profile, 'email');
    return { userId, role: text(membership, 'role'), name: text(profile, 'full_name') || email || 'Nimetön käyttäjä', email };
  }).sort((a, b) => a.name.localeCompare(b.name, 'fi'));
}

async function loadTemplates(organizationId: string): Promise<InspectionTemplateSummary[]> {
  const { data: templateData, error: templateError } = await supabase
    .from('inspection_templates').select('*').eq('active', true);
  if (templateError) throw failure('Tarkastuspohjien haku epäonnistui', templateError.message);
  const templates = rows(templateData).filter((item) => bool(item, 'is_system') || text(item, 'organization_id') === organizationId);
  const templateIds = templates.map((item) => text(item, 'id')).filter(Boolean);
  if (!templateIds.length) return [];
  const { data: versionData, error: versionError } = await supabase
    .from('inspection_template_versions').select('*').in('template_id', templateIds)
    .eq('status', 'Julkaistu').order('version', { ascending: false });
  if (versionError) throw failure('Pohjaversioiden haku epäonnistui', versionError.message);
  const latestVersions = new Map<string, Row>();
  rows(versionData).forEach((version) => {
    const templateId = text(version, 'template_id');
    if (!latestVersions.has(templateId)) latestVersions.set(templateId, version);
  });
  return templates.map((template): InspectionTemplateSummary | null => {
    const id = text(template, 'id');
    const version = latestVersions.get(id);
    if (!version) return null;
    return {
      id, organizationId: optionalText(template, 'organization_id'), name: text(template, 'name'),
      category: text(template, 'category'), description: text(template, 'description'), system: bool(template, 'is_system'),
      versionId: text(version, 'id'), version: num(version, 'version'),
    };
  }).filter((item): item is InspectionTemplateSummary => item !== null)
    .sort((a, b) => a.name.localeCompare(b.name, 'fi'));
}

export async function loadInspectionWorkspace(organizationId: string): Promise<InspectionWorkspace> {
  const [templates, buildingRows, stairwellRows, unitRows, inspectionRows, findingRows, people, reportRows] = await Promise.all([
    loadTemplates(organizationId), selectOrganizationRows('project_buildings', organizationId, 'name'),
    selectOrganizationRows('project_stairwells', organizationId, 'name'),
    selectOrganizationRows('project_units', organizationId, 'unit_code'),
    selectOrganizationRows('inspections', organizationId, 'created_at'),
    selectOrganizationRows('inspection_findings', organizationId, 'created_at'),
    loadPeople(organizationId), selectOrganizationRows('inspection_reports', organizationId, 'generated_at'),
  ]);
  return {
    templates, buildings: buildingRows.map(mapBuilding), stairwells: stairwellRows.map(mapStairwell),
    units: unitRows.map(mapUnit), inspections: inspectionRows.map(mapInspection).reverse(),
    findings: findingRows.map(mapFinding).reverse(), people, reports: reportRows.map(mapReport).reverse(),
  };
}

export async function loadInspectionDetail(inspectionId: string): Promise<InspectionDetail> {
  const { data: inspectionData, error: inspectionError } = await supabase.from('inspections').select('*').eq('id', inspectionId).single();
  if (inspectionError) throw failure('Tarkastuksen haku epäonnistui', inspectionError.message);
  const inspection = mapInspection(asRow(inspectionData));
  const [resultResponse, findingResponse, signatureResponse, reportResponse] = await Promise.all([
    supabase.from('inspection_results').select('*').eq('inspection_id', inspectionId),
    supabase.from('inspection_findings').select('*').eq('inspection_id', inspectionId).order('created_at'),
    supabase.from('inspection_signatures').select('*').eq('inspection_id', inspectionId).order('signed_at'),
    supabase.from('inspection_reports').select('*').eq('inspection_id', inspectionId).order('version', { ascending: false }),
  ]);
  if (resultResponse.error) throw failure('Tarkastustulosten haku epäonnistui', resultResponse.error.message);
  if (findingResponse.error) throw failure('Puutteiden haku epäonnistui', findingResponse.error.message);
  if (signatureResponse.error) throw failure('Allekirjoitusten haku epäonnistui', signatureResponse.error.message);
  if (reportResponse.error) throw failure('Raporttien haku epäonnistui', reportResponse.error.message);
  const resultRows = rows(resultResponse.data);
  const itemIds = resultRows.map((item) => text(item, 'item_id')).filter(Boolean);
  const { data: itemData, error: itemError } = itemIds.length
    ? await supabase.from('inspection_template_items').select('*').in('id', itemIds) : { data: [], error: null };
  if (itemError) throw failure('Tarkastuskohtien haku epäonnistui', itemError.message);
  const itemRows = rows(itemData);
  const sectionIds = [...new Set(itemRows.map((item) => text(item, 'section_id')).filter(Boolean))];
  const { data: sectionData, error: sectionError } = sectionIds.length
    ? await supabase.from('inspection_template_sections').select('*').in('id', sectionIds) : { data: [], error: null };
  if (sectionError) throw failure('Tarkastusosioiden haku epäonnistui', sectionError.message);
  const itemMap = new Map(itemRows.map((item) => [text(item, 'id'), item]));
  const sectionMap = new Map(rows(sectionData).map((section) => [text(section, 'id'), section]));
  const findings = rows(findingResponse.data).map(mapFinding);
  const findingIds = findings.map((item) => item.id);
  const actionPromise = findingIds.length
    ? supabase.from('finding_actions').select('*').in('finding_id', findingIds).order('created_at')
    : Promise.resolve({ data: [], error: null });
  const findingAttachmentPromise = findingIds.length
    ? supabase.from('inspection_attachments').select('*')
      .eq('organization_id', inspection.organizationId).in('finding_id', findingIds).order('created_at')
    : Promise.resolve({ data: [], error: null });
  const [actionResponse, inspectionAttachmentResponse, findingAttachmentResponse] = await Promise.all([
    actionPromise,
    supabase.from('inspection_attachments').select('*')
      .eq('organization_id', inspection.organizationId).eq('inspection_id', inspectionId).order('created_at'),
    findingAttachmentPromise,
  ]);
  if (actionResponse.error) throw failure('Korjaushistorian haku epäonnistui', actionResponse.error.message);
  if (inspectionAttachmentResponse.error) throw failure('Tarkastuksen liitteiden haku epäonnistui', inspectionAttachmentResponse.error.message);
  if (findingAttachmentResponse.error) throw failure('Puuteliitteiden haku epäonnistui', findingAttachmentResponse.error.message);
  const attachmentRows = [...rows(inspectionAttachmentResponse.data), ...rows(findingAttachmentResponse.data)];
  const attachments = [...new Map(attachmentRows.map((row) => [text(row, 'id'), mapAttachment(row)])).values()]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return {
    inspection,
    results: resultRows.map((result): InspectionResultDetail => {
      const item = itemMap.get(text(result, 'item_id')) ?? {};
      const sectionId = text(item, 'section_id');
      const section = sectionMap.get(sectionId) ?? {};
      return {
        id: text(result, 'id'), inspectionId, itemId: text(result, 'item_id'),
        status: text(result, 'status') as InspectionResultStatus, comment: text(result, 'comment'),
        measurementValue: result.measurement_value == null ? undefined : num(result, 'measurement_value'),
        measurementUnit: text(result, 'measurement_unit') || text(item, 'measurement_unit'),
        itemTitle: text(item, 'title'), guidance: text(item, 'guidance'), required: bool(item, 'required'),
        photoRequiredOnDefect: bool(item, 'photo_required_on_defect'), sectionId,
        sectionTitle: text(section, 'title'), sectionDescription: text(section, 'description'),
        sectionOrder: num(section, 'sort_order'), itemOrder: num(item, 'sort_order'),
      };
    }).sort((a, b) => a.sectionOrder - b.sectionOrder || a.itemOrder - b.itemOrder),
    findings,
    actions: rows(actionResponse.data).map((action): FindingAction => ({
      id: text(action, 'id'), findingId: text(action, 'finding_id'), actionType: text(action, 'action_type'),
      note: text(action, 'note'), attachmentPath: text(action, 'attachment_path'),
      createdBy: optionalText(action, 'created_by'), createdAt: text(action, 'created_at'),
    })),
    attachments,
    signatures: rows(signatureResponse.data).map((signature) => ({
      id: text(signature, 'id'), inspectionId: text(signature, 'inspection_id'), signerName: text(signature, 'signer_name'),
      signerRole: text(signature, 'signer_role'), signerCompany: text(signature, 'signer_company'),
      signatureType: text(signature, 'signature_type'), note: text(signature, 'note'), signedAt: text(signature, 'signed_at'),
    })),
    reports: rows(reportResponse.data).map(mapReport),
  };
}

export const inspectionReadMappers = {
  asRow,
  num,
  mapInspection,
  mapFinding,
  mapAttachment,
};

export async function loadTemplateEditor(templateVersionId: string): Promise<TemplateEditorSection[]> {
  const { data: sectionData, error: sectionError } = await supabase.from('inspection_template_sections')
    .select('*').eq('version_id', templateVersionId).order('sort_order');
  if (sectionError) throw failure('Tarkastuspohjan osioiden haku epäonnistui', sectionError.message);
  const sectionRows = rows(sectionData);
  const sectionIds = sectionRows.map((section) => text(section, 'id')).filter(Boolean);
  const { data: itemData, error: itemError } = sectionIds.length
    ? await supabase.from('inspection_template_items').select('*').in('section_id', sectionIds).order('sort_order')
    : { data: [], error: null };
  if (itemError) throw failure('Tarkastuspohjan kohtien haku epäonnistui', itemError.message);
  const itemRows = rows(itemData);
  return sectionRows.map((section): TemplateEditorSection => {
    const sectionId = text(section, 'id');
    return {
      id: sectionId, title: text(section, 'title'), description: text(section, 'description'),
      items: itemRows.filter((item) => text(item, 'section_id') === sectionId).map((item) => ({
        id: text(item, 'id'), title: text(item, 'title'), guidance: text(item, 'guidance'),
        required: bool(item, 'required'), photoRequiredOnDefect: bool(item, 'photo_required_on_defect'),
      })),
    };
  });
}
