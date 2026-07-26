import { supabase } from './client';

export type OfferStatus =
  | 'Luonnos'
  | 'Lähetetty'
  | 'Hyväksytty'
  | 'Hylätty'
  | 'Vanhentunut'
  | 'Arkistoitu';

export type OfferVersionStatus =
  | 'Luonnos'
  | 'Lähetetty'
  | 'Hyväksytty'
  | 'Hylätty'
  | 'Korvattu'
  | 'Arkistoitu';

export type AttachmentEntityType =
  | 'project'
  | 'work_order'
  | 'diary'
  | 'safety'
  | 'form_submission'
  | 'customer'
  | 'equipment'
  | 'crm_activity'
  | 'offer'
  | 'change_order';

export interface Offer {
  id: string;
  organizationId: string;
  customerId?: string;
  crmLeadId?: string;
  projectId?: string;
  convertedProjectId?: string;
  name: string;
  offerNumber?: string;
  status: OfferStatus;
  validUntil?: string;
  currency: 'EUR';
  notes?: string;
  sentAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfferVersion {
  id: string;
  organizationId: string;
  offerId: string;
  versionNumber: number;
  status: OfferVersionStatus;
  title: string;
  vatRate: number;
  overheadPercent: number;
  riskPercent: number;
  marginPercent: number;
  subtotalCents: number;
  totalCents: number;
  notes?: string;
  terms?: string;
  pdfStoragePath?: string;
  createdAt: string;
}

export interface OfferLine {
  id: string;
  organizationId: string;
  offerVersionId: string;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
  sortOrder: number;
  createdAt: string;
}

export interface OrganizationCommercialSettings {
  organizationId: string;
  locale: string;
  timezone: string;
  defaultVatRate: number;
  defaultOverheadPercent: number;
  defaultRiskPercent: number;
  defaultMarginPercent: number;
  defaultHourlyCostCents: number;
  defaultPaymentTermDays: number;
  defaultOfferValidDays: number;
  defaultOfferTerms?: string;
  companyAddress?: string;
  companyPostalCode?: string;
  companyCity?: string;
  companyEmail?: string;
  companyPhone?: string;
}

export interface RecordAttachment {
  id: string;
  organizationId: string;
  projectId?: string;
  entityType: AttachmentEntityType;
  entityId: string;
  fileName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  description?: string;
  createdAt: string;
}

export interface OfferCenterData {
  offers: Offer[];
  versions: OfferVersion[];
  lines: OfferLine[];
  attachments: RecordAttachment[];
  settings: OrganizationCommercialSettings;
}

type Row = Record<string, unknown>;

const DEFAULT_SETTINGS: Omit<OrganizationCommercialSettings, 'organizationId'> = {
  locale: 'fi-FI',
  timezone: 'Europe/Helsinki',
  defaultVatRate: 25.5,
  defaultOverheadPercent: 0,
  defaultRiskPercent: 0,
  defaultMarginPercent: 0,
  defaultHourlyCostCents: 0,
  defaultPaymentTermDays: 14,
  defaultOfferValidDays: 30,
};

function ensureRow(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Tietokanta palautti virheellisen tietueen.');
  }
  return value as Row;
}

function text(row: Row, key: string): string {
  return typeof row[key] === 'string' ? row[key] as string : '';
}

function optionalText(row: Row, key: string): string | undefined {
  return text(row, key) || undefined;
}

function numberValue(row: Row, key: string): number {
  const value = row[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function mapOffer(row: Row): Offer {
  return {
    id: text(row, 'id'),
    organizationId: text(row, 'organization_id'),
    customerId: optionalText(row, 'customer_id'),
    crmLeadId: optionalText(row, 'crm_lead_id'),
    projectId: optionalText(row, 'project_id'),
    convertedProjectId: optionalText(row, 'converted_project_id'),
    name: text(row, 'name'),
    offerNumber: optionalText(row, 'offer_number'),
    status: (text(row, 'status') || 'Luonnos') as OfferStatus,
    validUntil: optionalText(row, 'valid_until'),
    currency: 'EUR',
    notes: optionalText(row, 'notes'),
    sentAt: optionalText(row, 'sent_at'),
    acceptedAt: optionalText(row, 'accepted_at'),
    rejectedAt: optionalText(row, 'rejected_at'),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
  };
}

function mapVersion(row: Row): OfferVersion {
  return {
    id: text(row, 'id'),
    organizationId: text(row, 'organization_id'),
    offerId: text(row, 'offer_id'),
    versionNumber: numberValue(row, 'version_number'),
    status: (text(row, 'status') || 'Luonnos') as OfferVersionStatus,
    title: text(row, 'title'),
    vatRate: numberValue(row, 'vat_rate'),
    overheadPercent: numberValue(row, 'overhead_percent'),
    riskPercent: numberValue(row, 'risk_percent'),
    marginPercent: numberValue(row, 'margin_percent'),
    subtotalCents: numberValue(row, 'subtotal_cents'),
    totalCents: numberValue(row, 'total_cents'),
    notes: optionalText(row, 'notes'),
    terms: optionalText(row, 'terms'),
    pdfStoragePath: optionalText(row, 'pdf_storage_path'),
    createdAt: text(row, 'created_at'),
  };
}

function mapLine(row: Row): OfferLine {
  return {
    id: text(row, 'id'),
    organizationId: text(row, 'organization_id'),
    offerVersionId: text(row, 'offer_version_id'),
    category: text(row, 'category'),
    description: text(row, 'description'),
    quantity: numberValue(row, 'quantity'),
    unit: text(row, 'unit'),
    unitPriceCents: numberValue(row, 'unit_price_cents'),
    sortOrder: numberValue(row, 'sort_order'),
    createdAt: text(row, 'created_at'),
  };
}

function mapAttachment(row: Row): RecordAttachment {
  return {
    id: text(row, 'id'),
    organizationId: text(row, 'organization_id'),
    projectId: optionalText(row, 'project_id'),
    entityType: text(row, 'entity_type') as AttachmentEntityType,
    entityId: text(row, 'entity_id'),
    fileName: text(row, 'file_name'),
    storagePath: text(row, 'storage_path'),
    mimeType: text(row, 'mime_type'),
    sizeBytes: numberValue(row, 'size_bytes'),
    description: optionalText(row, 'description'),
    createdAt: text(row, 'created_at'),
  };
}

function mapSettings(row: Row, organizationId: string): OrganizationCommercialSettings {
  return {
    organizationId,
    locale: text(row, 'locale') || DEFAULT_SETTINGS.locale,
    timezone: text(row, 'timezone') || DEFAULT_SETTINGS.timezone,
    defaultVatRate: row.default_vat_rate == null
      ? DEFAULT_SETTINGS.defaultVatRate
      : numberValue(row, 'default_vat_rate'),
    defaultOverheadPercent: numberValue(row, 'default_overhead_percent'),
    defaultRiskPercent: numberValue(row, 'default_risk_percent'),
    defaultMarginPercent: numberValue(row, 'default_margin_percent'),
    defaultHourlyCostCents: numberValue(row, 'default_hourly_cost_cents'),
    defaultPaymentTermDays: row.default_payment_term_days == null
      ? DEFAULT_SETTINGS.defaultPaymentTermDays
      : numberValue(row, 'default_payment_term_days'),
    defaultOfferValidDays: row.default_offer_valid_days == null
      ? DEFAULT_SETTINGS.defaultOfferValidDays
      : numberValue(row, 'default_offer_valid_days'),
    defaultOfferTerms: optionalText(row, 'default_offer_terms'),
    companyAddress: optionalText(row, 'company_address'),
    companyPostalCode: optionalText(row, 'company_postal_code'),
    companyCity: optionalText(row, 'company_city'),
    companyEmail: optionalText(row, 'company_email'),
    companyPhone: optionalText(row, 'company_phone'),
  };
}

async function selectRows(
  table: string,
  organizationId: string,
  orderColumn: string,
  ascending = false,
): Promise<Row[]> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('organization_id', organizationId)
    .order(orderColumn, { ascending });
  if (error) throw new Error(`${table}-tietojen haku epäonnistui: ${error.message}`);
  return (Array.isArray(data) ? data : []).map(ensureRow);
}

export async function loadOfferCenter(organizationId: string): Promise<OfferCenterData> {
  const [offers, versions, lines, attachments, settingsResponse] = await Promise.all([
    selectRows('offers', organizationId, 'created_at'),
    selectRows('offer_versions', organizationId, 'created_at'),
    selectRows('offer_lines', organizationId, 'sort_order', true),
    selectRows('record_attachments', organizationId, 'created_at'),
    supabase
      .from('organization_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle(),
  ]);

  if (settingsResponse.error) {
    throw new Error(`Talousasetusten haku epäonnistui: ${settingsResponse.error.message}`);
  }

  const settingsRow = settingsResponse.data ? ensureRow(settingsResponse.data) : {};
  return {
    offers: offers.map(mapOffer),
    versions: versions.map(mapVersion),
    lines: lines.map(mapLine),
    attachments: attachments.map(mapAttachment),
    settings: mapSettings(settingsRow, organizationId),
  };
}

export async function createOffer(input: {
  organizationId: string;
  customerId?: string;
  crmLeadId?: string;
  projectId?: string;
  name: string;
  offerNumber?: string;
  validUntil?: string;
  notes?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_offer', {
    p_organization_id: input.organizationId,
    p_customer_id: input.customerId || null,
    p_crm_lead_id: input.crmLeadId || null,
    p_project_id: input.projectId || null,
    p_name: input.name.trim(),
    p_offer_number: input.offerNumber?.trim() || null,
    p_valid_until: input.validUntil || null,
    p_notes: input.notes?.trim() || null,
  });
  if (error) throw new Error(`Tarjouksen luominen epäonnistui: ${error.message}`);
  if (typeof data !== 'string') throw new Error('Tarjouksen luonti ei palauttanut tunnistetta.');
  return data;
}

export async function updateOffer(
  organizationId: string,
  id: string,
  updates: Partial<Pick<Offer, 'name' | 'offerNumber' | 'customerId' | 'crmLeadId' | 'projectId' | 'validUntil' | 'notes'>>,
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.offerNumber !== undefined) payload.offer_number = updates.offerNumber?.trim() || null;
  if (updates.customerId !== undefined) payload.customer_id = updates.customerId || null;
  if (updates.crmLeadId !== undefined) payload.crm_lead_id = updates.crmLeadId || null;
  if (updates.projectId !== undefined) payload.project_id = updates.projectId || null;
  if (updates.validUntil !== undefined) payload.valid_until = updates.validUntil || null;
  if (updates.notes !== undefined) payload.notes = updates.notes?.trim() || null;

  const { error } = await supabase
    .from('offers')
    .update(payload)
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`Tarjouksen päivitys epäonnistui: ${error.message}`);
}

export async function deleteOffer(organizationId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('offers')
    .delete()
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`Tarjouksen poistaminen epäonnistui: ${error.message}`);
}

export async function createOfferVersion(offerId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_offer_version', { p_offer_id: offerId });
  if (error) throw new Error(`Tarjousversion luominen epäonnistui: ${error.message}`);
  if (typeof data !== 'string') throw new Error('Tarjousversion luonti ei palauttanut tunnistetta.');
  return data;
}

export async function updateOfferVersion(
  organizationId: string,
  id: string,
  updates: Partial<Pick<
    OfferVersion,
    'title' | 'vatRate' | 'overheadPercent' | 'riskPercent' | 'marginPercent' | 'notes' | 'terms'
  >>,
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (updates.title !== undefined) payload.title = updates.title.trim();
  if (updates.vatRate !== undefined) payload.vat_rate = updates.vatRate;
  if (updates.overheadPercent !== undefined) payload.overhead_percent = updates.overheadPercent;
  if (updates.riskPercent !== undefined) payload.risk_percent = updates.riskPercent;
  if (updates.marginPercent !== undefined) payload.margin_percent = updates.marginPercent;
  if (updates.notes !== undefined) payload.notes = updates.notes?.trim() || null;
  if (updates.terms !== undefined) payload.terms = updates.terms?.trim() || null;

  const { error } = await supabase
    .from('offer_versions')
    .update(payload)
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`Tarjousversion päivitys epäonnistui: ${error.message}`);
}

export async function createOfferLine(input: {
  organizationId: string;
  offerVersionId: string;
  userId?: string;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
  sortOrder: number;
}): Promise<void> {
  const { error } = await supabase.from('offer_lines').insert({
    organization_id: input.organizationId,
    offer_version_id: input.offerVersionId,
    created_by: input.userId,
    category: input.category.trim() || 'Työ',
    description: input.description.trim(),
    quantity: input.quantity,
    unit: input.unit.trim() || 'kpl',
    unit_price_cents: input.unitPriceCents,
    sort_order: input.sortOrder,
  });
  if (error) throw new Error(`Tarjousrivin tallennus epäonnistui: ${error.message}`);
}

export async function updateOfferLine(
  organizationId: string,
  id: string,
  updates: Partial<Pick<OfferLine, 'category' | 'description' | 'quantity' | 'unit' | 'unitPriceCents' | 'sortOrder'>>,
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (updates.category !== undefined) payload.category = updates.category.trim();
  if (updates.description !== undefined) payload.description = updates.description.trim();
  if (updates.quantity !== undefined) payload.quantity = updates.quantity;
  if (updates.unit !== undefined) payload.unit = updates.unit.trim();
  if (updates.unitPriceCents !== undefined) payload.unit_price_cents = updates.unitPriceCents;
  if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;

  const { error } = await supabase
    .from('offer_lines')
    .update(payload)
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`Tarjousrivin päivitys epäonnistui: ${error.message}`);
}

export async function deleteOfferLine(organizationId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('offer_lines')
    .delete()
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`Tarjousrivin poistaminen epäonnistui: ${error.message}`);
}

export async function transitionOffer(
  offerId: string,
  offerVersionId: string | undefined,
  status: OfferStatus,
): Promise<void> {
  const { error } = await supabase.rpc('transition_offer', {
    p_offer_id: offerId,
    p_offer_version_id: offerVersionId || null,
    p_status: status,
  });
  if (error) throw new Error(`Tarjouksen tilan muuttaminen epäonnistui: ${error.message}`);
}

export async function convertOfferToProject(offerId: string): Promise<string> {
  const { data, error } = await supabase.rpc('convert_offer_to_project', {
    p_offer_id: offerId,
  });
  if (error) throw new Error(`Projektin luominen tarjouksesta epäonnistui: ${error.message}`);
  if (typeof data !== 'string') throw new Error('Projektin luonti ei palauttanut tunnistetta.');
  return data;
}

export async function saveCommercialSettings(
  settings: OrganizationCommercialSettings,
): Promise<void> {
  const { error } = await supabase.from('organization_settings').upsert({
    organization_id: settings.organizationId,
    locale: settings.locale,
    timezone: settings.timezone,
    default_vat_rate: settings.defaultVatRate,
    default_overhead_percent: settings.defaultOverheadPercent,
    default_risk_percent: settings.defaultRiskPercent,
    default_margin_percent: settings.defaultMarginPercent,
    default_hourly_cost_cents: settings.defaultHourlyCostCents,
    default_payment_term_days: settings.defaultPaymentTermDays,
    default_offer_valid_days: settings.defaultOfferValidDays,
    default_offer_terms: settings.defaultOfferTerms?.trim() || null,
    company_address: settings.companyAddress?.trim() || null,
    company_postal_code: settings.companyPostalCode?.trim() || null,
    company_city: settings.companyCity?.trim() || null,
    company_email: settings.companyEmail?.trim() || null,
    company_phone: settings.companyPhone?.trim() || null,
  }, { onConflict: 'organization_id' });
  if (error) throw new Error(`Talousasetusten tallennus epäonnistui: ${error.message}`);
}

function safeFileName(fileName: string): string {
  const cleaned = fileName
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'tiedosto';
}

export async function uploadRecordAttachment(input: {
  organizationId: string;
  projectId?: string;
  entityType: AttachmentEntityType;
  entityId: string;
  userId?: string;
  file: File;
  description?: string;
}): Promise<void> {
  if (input.file.size > 25 * 1024 * 1024) {
    throw new Error('Tiedoston enimmäiskoko on 25 Mt.');
  }

  const storagePath = [
    input.organizationId,
    input.entityType,
    input.entityId,
    `${crypto.randomUUID()}-${safeFileName(input.file.name)}`,
  ].join('/');

  const upload = await supabase.storage
    .from('project-documents')
    .upload(storagePath, input.file, {
      contentType: input.file.type || 'application/octet-stream',
      upsert: false,
    });
  if (upload.error) throw new Error(`Tiedoston lähetys epäonnistui: ${upload.error.message}`);

  const { error } = await supabase.from('record_attachments').insert({
    organization_id: input.organizationId,
    project_id: input.projectId || null,
    entity_type: input.entityType,
    entity_id: input.entityId,
    file_name: input.file.name,
    storage_path: storagePath,
    mime_type: input.file.type || 'application/octet-stream',
    size_bytes: input.file.size,
    description: input.description?.trim() || null,
    created_by: input.userId,
  });

  if (error) {
    await supabase.storage.from('project-documents').remove([storagePath]);
    throw new Error(`Liitetiedon tallennus epäonnistui: ${error.message}`);
  }
}

export async function openRecordAttachment(storagePath: string): Promise<void> {
  const { data, error } = await supabase.storage
    .from('project-documents')
    .createSignedUrl(storagePath, 120);
  if (error) throw new Error(`Tiedoston avaaminen epäonnistui: ${error.message}`);
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}

export async function deleteRecordAttachment(attachment: RecordAttachment): Promise<void> {
  const storageResult = await supabase.storage
    .from('project-documents')
    .remove([attachment.storagePath]);
  if (storageResult.error) {
    throw new Error(`Tiedoston poistaminen epäonnistui: ${storageResult.error.message}`);
  }

  const { error } = await supabase
    .from('record_attachments')
    .delete()
    .eq('organization_id', attachment.organizationId)
    .eq('id', attachment.id);
  if (error) throw new Error(`Liitetiedon poistaminen epäonnistui: ${error.message}`);
}
