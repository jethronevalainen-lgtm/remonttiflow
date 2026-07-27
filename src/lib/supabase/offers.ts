import { supabase } from './client';

export type OfferStatus = 'Luonnos' | 'Lähetetty' | 'Hyväksytty' | 'Hylätty' | 'Vanhentunut' | 'Arkistoitu';
export type OfferVersionStatus = 'Luonnos' | 'Lähetetty' | 'Hyväksytty' | 'Hylätty' | 'Korvattu' | 'Arkistoitu';

export interface Offer {
  id: string;
  customerId?: string;
  crmLeadId?: string;
  projectId?: string;
  convertedProjectId?: string;
  assignedUserId?: string;
  acceptedVersionId?: string;
  name: string;
  offerNumber: string;
  status: OfferStatus;
  validUntil?: string;
  currency: 'EUR';
  notes: string;
  customerReference: string;
  deliveryTime: string;
  paymentTerms: string;
  sentAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfferVersion {
  id: string;
  offerId: string;
  versionNumber: number;
  status: OfferVersionStatus;
  title: string;
  vatRate: number;
  overheadPercent: number;
  riskPercent: number;
  marginPercent: number;
  directCostCents: number;
  estimatedCostCents: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  grossMarginCents: number;
  grossMarginPercent: number;
  notes: string;
  terms: string;
  pdfStoragePath?: string;
  lockedAt?: string;
  createdAt: string;
}

export interface OfferSection {
  id: string;
  offerVersionId: string;
  title: string;
  description: string;
  sortOrder: number;
  customerVisible: boolean;
}

export interface OfferLine {
  id: string;
  offerVersionId: string;
  sectionId?: string;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  costUnitPriceCents: number;
  saleUnitPriceCents: number;
  wastePercent: number;
  discountPercent: number;
  vatRate?: number;
  sourceTakeoffLineId?: string;
  sourceCatalogItemId?: string;
  internalNote: string;
  customerNote: string;
  customerVisible: boolean;
  optional: boolean;
  sortOrder: number;
}

export interface PriceCatalogItem {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  unit: string;
  costUnitPriceCents: number;
  saleUnitPriceCents: number;
  defaultWastePercent: number;
  active: boolean;
  validFrom?: string;
  validUntil?: string;
}

export interface OfferEvent {
  id: string;
  offerId: string;
  offerVersionId?: string;
  eventType: string;
  detail: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface OffersData {
  offers: Offer[];
  versions: OfferVersion[];
  sections: OfferSection[];
  lines: OfferLine[];
  catalog: PriceCatalogItem[];
  events: OfferEvent[];
}

type Row = Record<string, unknown>;

function row(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Tietokanta palautti virheellisen tarjoustietueen.');
  }
  return value as Row;
}

function text(value: Row, key: string): string {
  return typeof value[key] === 'string' ? value[key] as string : '';
}

function optionalText(value: Row, key: string): string | undefined {
  return text(value, key) || undefined;
}

function numberValue(value: Row, key: string): number {
  const current = value[key];
  if (typeof current === 'number' && Number.isFinite(current)) return current;
  if (typeof current === 'string') {
    const parsed = Number(current);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function booleanValue(value: Row, key: string, fallback = false): boolean {
  return typeof value[key] === 'boolean' ? value[key] as boolean : fallback;
}

function objectValue(value: Row, key: string): Record<string, unknown> {
  const current = value[key];
  return current && typeof current === 'object' && !Array.isArray(current)
    ? current as Record<string, unknown>
    : {};
}

async function selectRows(table: string, organizationId: string): Promise<Row[]> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('organization_id', organizationId);
  if (error) throw new Error(`${table}-tietojen haku epäonnistui: ${error.message}`);
  return (Array.isArray(data) ? data : []).map(row);
}

export async function loadOffersData(organizationId: string): Promise<OffersData> {
  const [offerRows, versionRows, sectionRows, lineRows, catalogRows, eventRows] = await Promise.all([
    selectRows('offers', organizationId),
    selectRows('offer_versions', organizationId),
    selectRows('offer_sections', organizationId),
    selectRows('offer_lines', organizationId),
    selectRows('price_catalog_items', organizationId),
    selectRows('offer_events', organizationId),
  ]);

  return {
    offers: offerRows.map((value) => ({
      id: text(value, 'id'),
      customerId: optionalText(value, 'customer_id'),
      crmLeadId: optionalText(value, 'crm_lead_id'),
      projectId: optionalText(value, 'project_id'),
      convertedProjectId: optionalText(value, 'converted_project_id'),
      assignedUserId: optionalText(value, 'assigned_user_id'),
      acceptedVersionId: optionalText(value, 'accepted_version_id'),
      name: text(value, 'name'),
      offerNumber: text(value, 'offer_number'),
      status: text(value, 'status') as OfferStatus,
      validUntil: optionalText(value, 'valid_until'),
      currency: 'EUR' as const,
      notes: text(value, 'notes'),
      customerReference: text(value, 'customer_reference'),
      deliveryTime: text(value, 'delivery_time'),
      paymentTerms: text(value, 'payment_terms'),
      sentAt: optionalText(value, 'sent_at'),
      acceptedAt: optionalText(value, 'accepted_at'),
      rejectedAt: optionalText(value, 'rejected_at'),
      createdAt: text(value, 'created_at'),
      updatedAt: text(value, 'updated_at'),
    })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    versions: versionRows.map((value) => ({
      id: text(value, 'id'),
      offerId: text(value, 'offer_id'),
      versionNumber: numberValue(value, 'version_number'),
      status: text(value, 'status') as OfferVersionStatus,
      title: text(value, 'title'),
      vatRate: numberValue(value, 'vat_rate'),
      overheadPercent: numberValue(value, 'overhead_percent'),
      riskPercent: numberValue(value, 'risk_percent'),
      marginPercent: numberValue(value, 'margin_percent'),
      directCostCents: numberValue(value, 'direct_cost_cents'),
      estimatedCostCents: numberValue(value, 'estimated_cost_cents'),
      subtotalCents: numberValue(value, 'subtotal_cents'),
      taxCents: numberValue(value, 'tax_cents'),
      totalCents: numberValue(value, 'total_cents'),
      grossMarginCents: numberValue(value, 'gross_margin_cents'),
      grossMarginPercent: numberValue(value, 'gross_margin_percent'),
      notes: text(value, 'notes'),
      terms: text(value, 'terms'),
      pdfStoragePath: optionalText(value, 'pdf_storage_path'),
      lockedAt: optionalText(value, 'locked_at'),
      createdAt: text(value, 'created_at'),
    })).sort((a, b) => b.versionNumber - a.versionNumber),
    sections: sectionRows.map((value) => ({
      id: text(value, 'id'),
      offerVersionId: text(value, 'offer_version_id'),
      title: text(value, 'title'),
      description: text(value, 'description'),
      sortOrder: numberValue(value, 'sort_order'),
      customerVisible: booleanValue(value, 'customer_visible', true),
    })).sort((a, b) => a.sortOrder - b.sortOrder),
    lines: lineRows.map((value) => ({
      id: text(value, 'id'),
      offerVersionId: text(value, 'offer_version_id'),
      sectionId: optionalText(value, 'section_id'),
      category: text(value, 'category'),
      description: text(value, 'description'),
      quantity: numberValue(value, 'quantity'),
      unit: text(value, 'unit'),
      costUnitPriceCents: numberValue(value, 'cost_unit_price_cents'),
      saleUnitPriceCents: numberValue(value, 'unit_price_cents'),
      wastePercent: numberValue(value, 'waste_percent'),
      discountPercent: numberValue(value, 'discount_percent'),
      vatRate: value.vat_rate == null ? undefined : numberValue(value, 'vat_rate'),
      sourceTakeoffLineId: optionalText(value, 'source_takeoff_line_id'),
      sourceCatalogItemId: optionalText(value, 'source_catalog_item_id'),
      internalNote: text(value, 'internal_note'),
      customerNote: text(value, 'customer_note'),
      customerVisible: booleanValue(value, 'customer_visible', true),
      optional: booleanValue(value, 'is_optional'),
      sortOrder: numberValue(value, 'sort_order'),
    })).sort((a, b) => a.sortOrder - b.sortOrder),
    catalog: catalogRows.map((value) => ({
      id: text(value, 'id'),
      code: text(value, 'code'),
      name: text(value, 'name'),
      category: text(value, 'category'),
      description: text(value, 'description'),
      unit: text(value, 'unit'),
      costUnitPriceCents: numberValue(value, 'cost_unit_price_cents'),
      saleUnitPriceCents: numberValue(value, 'sale_unit_price_cents'),
      defaultWastePercent: numberValue(value, 'default_waste_percent'),
      active: booleanValue(value, 'active', true),
      validFrom: optionalText(value, 'valid_from'),
      validUntil: optionalText(value, 'valid_until'),
    })).sort((a, b) => a.category.localeCompare(b.category, 'fi') || a.name.localeCompare(b.name, 'fi')),
    events: eventRows.map((value) => ({
      id: text(value, 'id'),
      offerId: text(value, 'offer_id'),
      offerVersionId: optionalText(value, 'offer_version_id'),
      eventType: text(value, 'event_type'),
      detail: text(value, 'detail'),
      metadata: objectValue(value, 'metadata'),
      createdAt: text(value, 'created_at'),
    })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

export interface CreateOfferInput {
  organizationId: string;
  customerId?: string;
  crmLeadId?: string;
  projectId?: string;
  name: string;
  offerNumber?: string;
  validUntil?: string;
  notes?: string;
  assignedUserId?: string;
}

export async function createOffer(input: CreateOfferInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_offer_v2', {
    p_organization_id: input.organizationId,
    p_customer_id: input.customerId || null,
    p_crm_lead_id: input.crmLeadId || null,
    p_project_id: input.projectId || null,
    p_name: input.name,
    p_offer_number: input.offerNumber || null,
    p_valid_until: input.validUntil || null,
    p_notes: input.notes || null,
    p_assigned_user_id: input.assignedUserId || null,
  });
  if (error) throw new Error(`Tarjouksen luominen epäonnistui: ${error.message}`);
  if (typeof data !== 'string') throw new Error('Tarjouksen tunnistetta ei palautettu.');
  return data;
}

export async function updateOffer(
  organizationId: string,
  offerId: string,
  values: Partial<Pick<Offer, 'name' | 'validUntil' | 'notes' | 'customerReference' | 'deliveryTime' | 'paymentTerms' | 'assignedUserId'>>,
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (values.name !== undefined) payload.name = values.name;
  if (values.validUntil !== undefined) payload.valid_until = values.validUntil || null;
  if (values.notes !== undefined) payload.notes = values.notes || null;
  if (values.customerReference !== undefined) payload.customer_reference = values.customerReference || null;
  if (values.deliveryTime !== undefined) payload.delivery_time = values.deliveryTime || null;
  if (values.paymentTerms !== undefined) payload.payment_terms = values.paymentTerms || null;
  if (values.assignedUserId !== undefined) payload.assigned_user_id = values.assignedUserId || null;
  const { error } = await supabase.from('offers').update(payload).eq('id', offerId).eq('organization_id', organizationId);
  if (error) throw new Error(`Tarjouksen päivitys epäonnistui: ${error.message}`);
}

export async function deleteOffer(organizationId: string, offerId: string): Promise<void> {
  const { error } = await supabase.from('offers').delete().eq('id', offerId).eq('organization_id', organizationId).eq('status', 'Luonnos');
  if (error) throw new Error(`Tarjouksen poistaminen epäonnistui: ${error.message}`);
}

export async function createOfferVersion(offerId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_offer_version', { p_offer_id: offerId });
  if (error) throw new Error(`Tarjousversion luominen epäonnistui: ${error.message}`);
  if (typeof data !== 'string') throw new Error('Tarjousversion tunnistetta ei palautettu.');
  return data;
}

export async function updateOfferVersion(
  organizationId: string,
  versionId: string,
  values: Partial<Pick<OfferVersion, 'title' | 'vatRate' | 'overheadPercent' | 'riskPercent' | 'marginPercent' | 'notes' | 'terms'>>,
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (values.title !== undefined) payload.title = values.title;
  if (values.vatRate !== undefined) payload.vat_rate = values.vatRate;
  if (values.overheadPercent !== undefined) payload.overhead_percent = values.overheadPercent;
  if (values.riskPercent !== undefined) payload.risk_percent = values.riskPercent;
  if (values.marginPercent !== undefined) payload.margin_percent = values.marginPercent;
  if (values.notes !== undefined) payload.notes = values.notes || null;
  if (values.terms !== undefined) payload.terms = values.terms || null;
  const { error } = await supabase.from('offer_versions').update(payload).eq('id', versionId).eq('organization_id', organizationId).eq('status', 'Luonnos');
  if (error) throw new Error(`Tarjousversion päivitys epäonnistui: ${error.message}`);
}

export async function addOfferSection(
  organizationId: string,
  userId: string | undefined,
  value: Omit<OfferSection, 'id'>,
): Promise<void> {
  const { error } = await supabase.from('offer_sections').insert({
    organization_id: organizationId,
    offer_version_id: value.offerVersionId,
    title: value.title,
    description: value.description || null,
    sort_order: value.sortOrder,
    customer_visible: value.customerVisible,
    created_by: userId || null,
  });
  if (error) throw new Error(`Tarjousosion tallennus epäonnistui: ${error.message}`);
}

export async function deleteOfferSection(organizationId: string, sectionId: string): Promise<void> {
  const { error } = await supabase.from('offer_sections').delete().eq('id', sectionId).eq('organization_id', organizationId);
  if (error) throw new Error(`Tarjousosion poistaminen epäonnistui: ${error.message}`);
}

function linePayload(value: Omit<OfferLine, 'id'> | Partial<OfferLine>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (value.offerVersionId !== undefined) payload.offer_version_id = value.offerVersionId;
  if (value.sectionId !== undefined) payload.section_id = value.sectionId || null;
  if (value.category !== undefined) payload.category = value.category;
  if (value.description !== undefined) payload.description = value.description;
  if (value.quantity !== undefined) payload.quantity = value.quantity;
  if (value.unit !== undefined) payload.unit = value.unit;
  if (value.costUnitPriceCents !== undefined) payload.cost_unit_price_cents = value.costUnitPriceCents;
  if (value.saleUnitPriceCents !== undefined) payload.unit_price_cents = value.saleUnitPriceCents;
  if (value.wastePercent !== undefined) payload.waste_percent = value.wastePercent;
  if (value.discountPercent !== undefined) payload.discount_percent = value.discountPercent;
  if (value.vatRate !== undefined) payload.vat_rate = value.vatRate ?? null;
  if (value.sourceTakeoffLineId !== undefined) payload.source_takeoff_line_id = value.sourceTakeoffLineId || null;
  if (value.sourceCatalogItemId !== undefined) payload.source_catalog_item_id = value.sourceCatalogItemId || null;
  if (value.internalNote !== undefined) payload.internal_note = value.internalNote || null;
  if (value.customerNote !== undefined) payload.customer_note = value.customerNote || null;
  if (value.customerVisible !== undefined) payload.customer_visible = value.customerVisible;
  if (value.optional !== undefined) payload.is_optional = value.optional;
  if (value.sortOrder !== undefined) payload.sort_order = value.sortOrder;
  return payload;
}

export async function addOfferLine(
  organizationId: string,
  userId: string | undefined,
  value: Omit<OfferLine, 'id'>,
): Promise<void> {
  const { error } = await supabase.from('offer_lines').insert({
    organization_id: organizationId,
    created_by: userId || null,
    ...linePayload(value),
  });
  if (error) throw new Error(`Tarjousrivin tallennus epäonnistui: ${error.message}`);
}

export async function addOfferLines(
  organizationId: string,
  userId: string | undefined,
  values: Array<Omit<OfferLine, 'id'>>,
): Promise<void> {
  if (!values.length) return;
  const { error } = await supabase.from('offer_lines').insert(values.map((value) => ({
    organization_id: organizationId,
    created_by: userId || null,
    ...linePayload(value),
  })));
  if (error) throw new Error(`Tarjousrivien tuonti epäonnistui: ${error.message}`);
}

export async function updateOfferLine(
  organizationId: string,
  lineId: string,
  value: Partial<OfferLine>,
): Promise<void> {
  const { error } = await supabase.from('offer_lines').update(linePayload(value)).eq('id', lineId).eq('organization_id', organizationId);
  if (error) throw new Error(`Tarjousrivin päivitys epäonnistui: ${error.message}`);
}

export async function deleteOfferLine(organizationId: string, lineId: string): Promise<void> {
  const { error } = await supabase.from('offer_lines').delete().eq('id', lineId).eq('organization_id', organizationId);
  if (error) throw new Error(`Tarjousrivin poistaminen epäonnistui: ${error.message}`);
}

export async function transitionOffer(offerId: string, versionId: string | undefined, status: OfferStatus): Promise<void> {
  const { error } = await supabase.rpc('transition_offer', {
    p_offer_id: offerId,
    p_offer_version_id: versionId || null,
    p_status: status,
  });
  if (error) throw new Error(`Tarjouksen tilan muuttaminen epäonnistui: ${error.message}`);
}

export async function convertOfferToProject(offerId: string): Promise<string> {
  const { data, error } = await supabase.rpc('convert_offer_to_project', { p_offer_id: offerId });
  if (error) throw new Error(`Tarjouksen muuntaminen projektiksi epäonnistui: ${error.message}`);
  if (typeof data !== 'string') throw new Error('Luodun projektin tunnistetta ei palautettu.');
  return data;
}

function catalogPayload(value: Omit<PriceCatalogItem, 'id'> | Partial<PriceCatalogItem>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (value.code !== undefined) payload.code = value.code || null;
  if (value.name !== undefined) payload.name = value.name;
  if (value.category !== undefined) payload.category = value.category;
  if (value.description !== undefined) payload.description = value.description || null;
  if (value.unit !== undefined) payload.unit = value.unit;
  if (value.costUnitPriceCents !== undefined) payload.cost_unit_price_cents = value.costUnitPriceCents;
  if (value.saleUnitPriceCents !== undefined) payload.sale_unit_price_cents = value.saleUnitPriceCents;
  if (value.defaultWastePercent !== undefined) payload.default_waste_percent = value.defaultWastePercent;
  if (value.active !== undefined) payload.active = value.active;
  if (value.validFrom !== undefined) payload.valid_from = value.validFrom || null;
  if (value.validUntil !== undefined) payload.valid_until = value.validUntil || null;
  return payload;
}

export async function addCatalogItem(
  organizationId: string,
  userId: string | undefined,
  value: Omit<PriceCatalogItem, 'id'>,
): Promise<void> {
  const { error } = await supabase.from('price_catalog_items').insert({
    organization_id: organizationId,
    created_by: userId || null,
    ...catalogPayload(value),
  });
  if (error) throw new Error(`Hinnastorivin tallennus epäonnistui: ${error.message}`);
}

export async function updateCatalogItem(
  organizationId: string,
  itemId: string,
  value: Partial<PriceCatalogItem>,
): Promise<void> {
  const { error } = await supabase.from('price_catalog_items').update(catalogPayload(value)).eq('id', itemId).eq('organization_id', organizationId);
  if (error) throw new Error(`Hinnastorivin päivitys epäonnistui: ${error.message}`);
}

export async function deleteCatalogItem(organizationId: string, itemId: string): Promise<void> {
  const { error } = await supabase.from('price_catalog_items').delete().eq('id', itemId).eq('organization_id', organizationId);
  if (error) throw new Error(`Hinnastorivin poistaminen epäonnistui: ${error.message}`);
}
