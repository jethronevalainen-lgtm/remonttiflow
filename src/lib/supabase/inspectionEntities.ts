import { supabase } from './client';
import type {
  FindingSeverity, FindingStatus, InspectionFinding, InspectionResultStatus, TemplateEditorSection,
} from './inspectionTypes';

export * from './inspectionTypes';
export { loadInspectionWorkspace, loadInspectionDetail, loadTemplateEditor } from './inspectionRead';

function failure(prefix: string, message: string): Error {
  return new Error(`${prefix}: ${message}`);
}

export async function createProjectBuilding(input: {
  organizationId: string;
  projectId: string;
  name: string;
  address?: string;
  userId?: string;
}): Promise<void> {
  const { error } = await supabase.from('project_buildings').insert({
    organization_id: input.organizationId,
    project_id: input.projectId,
    name: input.name.trim(),
    address: input.address?.trim() || null,
    created_by: input.userId ?? null,
  });
  if (error) throw failure('Rakennuksen tallennus epäonnistui', error.message);
}

export async function createProjectStairwell(input: {
  organizationId: string;
  projectId: string;
  buildingId: string;
  name: string;
  userId?: string;
}): Promise<void> {
  const { error } = await supabase.from('project_stairwells').insert({
    organization_id: input.organizationId,
    project_id: input.projectId,
    building_id: input.buildingId,
    name: input.name.trim(),
    created_by: input.userId ?? null,
  });
  if (error) throw failure('Rapun tallennus epäonnistui', error.message);
}

export async function createProjectUnit(input: {
  organizationId: string;
  projectId: string;
  buildingId?: string;
  stairwellId?: string;
  unitCode: string;
  floor?: string;
  unitType?: string;
  areaM2?: number;
  renovationScope?: string;
  responsibleSupervisorId?: string;
  plannedCompletionDate?: string;
  notes?: string;
  userId?: string;
}): Promise<void> {
  const { error } = await supabase.from('project_units').insert({
    organization_id: input.organizationId,
    project_id: input.projectId,
    building_id: input.buildingId || null,
    stairwell_id: input.stairwellId || null,
    unit_code: input.unitCode.trim(),
    floor: input.floor?.trim() || null,
    unit_type: input.unitType?.trim() || null,
    area_m2: input.areaM2 ?? null,
    renovation_scope: input.renovationScope?.trim() || null,
    responsible_supervisor_id: input.responsibleSupervisorId || null,
    planned_completion_date: input.plannedCompletionDate || null,
    notes: input.notes?.trim() || null,
    created_by: input.userId ?? null,
  });
  if (error) throw failure('Huoneiston tallennus epäonnistui', error.message);
}

export async function createInspections(input: {
  organizationId: string;
  projectId: string;
  unitIds: Array<string | undefined>;
  templateVersionId: string;
  title: string;
  scheduledDate?: string;
  inspectorId?: string;
}): Promise<string[]> {
  const targets = input.unitIds.length ? input.unitIds : [undefined];
  const ids: string[] = [];
  for (const unitId of targets) {
    const { data, error } = await supabase.rpc('create_inspection', {
      p_organization_id: input.organizationId,
      p_project_id: input.projectId,
      p_unit_id: unitId ?? null,
      p_template_version_id: input.templateVersionId,
      p_title: input.title.trim(),
      p_scheduled_date: input.scheduledDate || null,
      p_inspector_id: input.inspectorId || null,
    });
    if (error) throw failure('Tarkastuksen luonti epäonnistui', error.message);
    if (typeof data === 'string') ids.push(data);
  }
  return ids;
}

export async function saveInspectionResult(input: {
  inspectionId: string;
  itemId: string;
  status: InspectionResultStatus;
  comment?: string;
  measurementValue?: number;
  measurementUnit?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('save_inspection_result', {
    p_inspection_id: input.inspectionId,
    p_item_id: input.itemId,
    p_status: input.status,
    p_comment: input.comment?.trim() || null,
    p_measurement_value: input.measurementValue ?? null,
    p_measurement_unit: input.measurementUnit?.trim() || null,
  });
  if (error) throw failure('Tarkastuskohdan tallennus epäonnistui', error.message);
}

export async function createInspectionFinding(input: {
  inspectionId: string;
  resultId?: string;
  title: string;
  description?: string;
  location?: string;
  category?: string;
  severity: FindingSeverity;
  assigneeUserId?: string;
  contractorName?: string;
  dueDate?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_inspection_finding', {
    p_inspection_id: input.inspectionId,
    p_result_id: input.resultId || null,
    p_title: input.title.trim(),
    p_description: input.description?.trim() || null,
    p_location: input.location?.trim() || null,
    p_category: input.category?.trim() || null,
    p_severity: input.severity,
    p_assignee_user_id: input.assigneeUserId || null,
    p_contractor_name: input.contractorName?.trim() || null,
    p_due_date: input.dueDate || null,
  });
  if (error) throw failure('Puutteen tallennus epäonnistui', error.message);
  if (typeof data !== 'string') throw new Error('Puutteen tunnus puuttuu vastauksesta.');
  return data;
}

export async function transitionInspectionFinding(
  findingId: string,
  status: FindingStatus,
  note?: string,
): Promise<void> {
  const { error } = await supabase.rpc('transition_inspection_finding', {
    p_finding_id: findingId,
    p_status: status,
    p_note: note?.trim() || null,
  });
  if (error) throw failure('Puutteen tilan muuttaminen epäonnistui', error.message);
}

export async function approveInspection(
  inspectionId: string,
  summary?: string,
): Promise<number> {
  const { data, error } = await supabase.rpc('approve_inspection', {
    p_inspection_id: inspectionId,
    p_summary: summary?.trim() || null,
  });
  if (error) throw failure('Tarkastuksen hyväksyntä epäonnistui', error.message);
  return typeof data === 'number' ? data : Number(data ?? 0);
}

export async function voidInspection(inspectionId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('void_inspection', {
    p_inspection_id: inspectionId,
    p_reason: reason.trim(),
  });
  if (error) throw failure('Tarkastuksen mitätöinti epäonnistui', error.message);
}

export async function addInspectionSignature(input: {
  organizationId: string;
  inspectionId: string;
  signerName: string;
  signerRole: string;
  signerCompany?: string;
  note?: string;
  userId?: string;
}): Promise<void> {
  const { error } = await supabase.from('inspection_signatures').insert({
    organization_id: input.organizationId,
    inspection_id: input.inspectionId,
    signer_name: input.signerName.trim(),
    signer_role: input.signerRole.trim(),
    signer_company: input.signerCompany?.trim() || null,
    signature_type: 'Vahvistus',
    note: input.note?.trim() || null,
    signed_by: input.userId ?? null,
  });
  if (error) throw failure('Hyväksyntämerkinnän tallennus epäonnistui', error.message);
}

function safeFileName(name: string): string {
  const normalized = name.normalize('NFKD').replace(/[^\w.-]+/g, '-');
  return normalized.replace(/^-+|-+$/g, '') || 'liite';
}

export async function uploadInspectionAttachment(input: {
  organizationId: string;
  inspectionId?: string;
  resultId?: string;
  findingId?: string;
  file: File;
  kind: string;
  caption?: string;
  userId: string;
}): Promise<void> {
  const target = input.findingId ?? input.resultId ?? input.inspectionId;
  if (!target) throw new Error('Liitteen kohde puuttuu.');
  const objectPath = `${input.organizationId}/${input.inspectionId ?? 'finding'}/${crypto.randomUUID()}-${safeFileName(input.file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from('inspection-files')
    .upload(objectPath, input.file, {
      cacheControl: '3600',
      contentType: input.file.type || undefined,
      upsert: false,
    });
  if (uploadError) throw failure('Liitteen lähetys epäonnistui', uploadError.message);

  const { error: insertError } = await supabase.from('inspection_attachments').insert({
    organization_id: input.organizationId,
    inspection_id: input.inspectionId || null,
    result_id: input.resultId || null,
    finding_id: input.findingId || null,
    object_path: objectPath,
    file_name: input.file.name,
    mime_type: input.file.type || null,
    size_bytes: input.file.size,
    kind: input.kind,
    caption: input.caption?.trim() || null,
    uploaded_by: input.userId,
  });
  if (insertError) {
    await supabase.storage.from('inspection-files').remove([objectPath]);
    throw failure('Liitetiedon tallennus epäonnistui', insertError.message);
  }
}

export async function createAttachmentUrl(objectPath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('inspection-files')
    .createSignedUrl(objectPath, 300);
  if (error) throw failure('Liitteen avaaminen epäonnistui', error.message);
  return data.signedUrl;
}

export async function publishInspectionTemplate(input: {
  organizationId: string;
  templateId?: string;
  name: string;
  category: string;
  description?: string;
  changeNote?: string;
  sections: TemplateEditorSection[];
}): Promise<string> {
  const payload = input.sections.map((section) => ({
    title: section.title.trim(),
    description: section.description.trim(),
    items: section.items.map((item) => ({
      title: item.title.trim(),
      guidance: item.guidance.trim(),
      responseType: 'condition',
      required: item.required,
      photoRequiredOnDefect: item.photoRequiredOnDefect,
    })),
  }));
  const { data, error } = await supabase.rpc('publish_inspection_template', {
    p_organization_id: input.organizationId,
    p_template_id: input.templateId || null,
    p_name: input.name.trim(),
    p_category: input.category.trim(),
    p_description: input.description?.trim() || null,
    p_change_note: input.changeNote?.trim() || null,
    p_sections: payload,
  });
  if (error) throw failure('Tarkastuspohjan julkaisu epäonnistui', error.message);
  if (typeof data !== 'string') throw new Error('Pohjaversiota ei palautettu.');
  return data;
}

export async function createFindingWorkOrder(
  organizationId: string,
  finding: InspectionFinding,
): Promise<string> {
  const assignmentScope = finding.assigneeUserId ? 'people' : 'project_team';
  const priority = finding.severity === 'Kriittinen' || finding.severity === 'Merkittävä'
    ? 'Korkea'
    : 'Normaali';
  const { data, error } = await supabase.rpc('save_work_order', {
    p_organization_id: organizationId,
    p_work_order_id: null,
    p_project_id: finding.projectId,
    p_title: `Korjaa tarkastuspuute: ${finding.title}`,
    p_due_date: finding.dueDate || null,
    p_priority: priority,
    p_status: 'Avoin',
    p_description: [finding.location, finding.description].filter(Boolean).join('\n'),
    p_type: 'Tarkastuspuute',
    p_assignment_scope: assignmentScope,
    p_assignee_user_ids: finding.assigneeUserId ? [finding.assigneeUserId] : [],
  });
  if (error) throw failure('Työmääräyksen luonti epäonnistui', error.message);
  if (typeof data !== 'string') throw new Error('Työmääräyksen tunnus puuttuu.');

  const { error: updateError } = await supabase
    .from('inspection_findings')
    .update({ work_order_id: data, updated_at: new Date().toISOString() })
    .eq('id', finding.id)
    .eq('organization_id', organizationId);
  if (updateError) throw failure('Puutteen linkitys työmääräykseen epäonnistui', updateError.message);
  return data;
}
