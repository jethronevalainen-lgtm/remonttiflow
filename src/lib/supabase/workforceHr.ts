import { supabase } from './client';

export interface EmployeeCard {
  employeeId: string;
  userId?: string;
  employeeName: string;
  employeeRole: string;
  department: string;
  email: string;
  phone: string;
  employmentType?: string;
  startDate?: string;
  employeeStatus: string;
  supervisorNames: string[];
  streetAddress?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  dateOfBirth?: string;
  personalIdentityCodeLast4?: string;
  iban?: string;
  bic?: string;
  taxPercent?: number;
  additionalTaxPercent?: number;
  taxIncomeLimitCents?: number;
  taxCardValidFrom?: string;
  taxCardValidTo?: string;
  unionName?: string;
  occupationalHealthProvider?: string;
  employmentNotes?: string;
  payrollNotes?: string;
  compensationId?: string;
  payType?: 'Kuukausipalkka' | 'Tuntipalkka';
  monthlySalaryCents?: number;
  hourlyWageCents?: number;
  weeklyHours?: number;
  collectiveAgreement?: string;
  payPeriod?: string;
  eveningAllowanceCents?: number;
  nightAllowanceCents?: number;
  saturdayAllowanceCents?: number;
  sundayAllowanceCents?: number;
  overtime50Multiplier?: number;
  overtime100Multiplier?: number;
  dailyAllowanceCents?: number;
  mealAllowanceCents?: number;
  travelTimeHourlyCents?: number;
  compensationValidFrom?: string;
  compensationValidTo?: string;
  compensationNotes?: string;
}

export interface HrProfileInput {
  dateOfBirth?: string;
  streetAddress?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  personalIdentityCodeLast4?: string;
  iban?: string;
  bic?: string;
  taxPercent?: number;
  additionalTaxPercent?: number;
  taxIncomeLimitCents?: number;
  taxCardValidFrom?: string;
  taxCardValidTo?: string;
  unionName?: string;
  occupationalHealthProvider?: string;
  employmentNotes?: string;
  payrollNotes?: string;
}

export interface CompensationInput {
  id?: string;
  validFrom: string;
  validTo?: string;
  payType: 'Kuukausipalkka' | 'Tuntipalkka';
  monthlySalaryCents?: number;
  hourlyWageCents?: number;
  weeklyHours: number;
  collectiveAgreement?: string;
  payPeriod: string;
  eveningAllowanceCents: number;
  nightAllowanceCents: number;
  saturdayAllowanceCents: number;
  sundayAllowanceCents: number;
  overtime50Multiplier: number;
  overtime100Multiplier: number;
  dailyAllowanceCents: number;
  mealAllowanceCents: number;
  travelTimeHourlyCents: number;
  notes?: string;
}

export interface SupervisorTeamMember {
  supervisorUserId: string;
  employeeId: string;
}

export interface GeneratedWorkSiteQr {
  projectName: string;
  expiresAt?: string;
  requireGeofence: boolean;
  checkInUrl: string;
  svg: string;
}

export interface QrCheckInResult {
  checkInId: string;
  projectId: string;
  projectName: string;
  checkedInAt: string;
  withinGeofence?: boolean;
  distanceFromSiteM?: number;
}

export interface BackupRun {
  id: string;
  status: 'running' | 'completed' | 'failed';
  triggeredBy: string;
  storagePrefix?: string;
  tableCount: number;
  rowCount: number;
  fileCount: number;
  totalBytes: number;
  errorMessage?: string;
  startedAt: string;
  finishedAt?: string;
}

type Row = Record<string, unknown>;

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

function numberValue(row: Row, key: string): number {
  return optionalNumber(row, key) ?? 0;
}

function stringArray(row: Row, key: string): string[] {
  return Array.isArray(row[key]) ? (row[key] as unknown[]).filter((item): item is string => typeof item === 'string') : [];
}

function employeeCard(row: Row): EmployeeCard {
  const payTypeValue = optionalText(row, 'pay_type');
  return {
    employeeId: text(row, 'employee_id'),
    userId: optionalText(row, 'user_id'),
    employeeName: text(row, 'employee_name'),
    employeeRole: text(row, 'employee_role'),
    department: text(row, 'department'),
    email: text(row, 'email'),
    phone: text(row, 'phone'),
    employmentType: optionalText(row, 'employment_type'),
    startDate: optionalText(row, 'start_date'),
    employeeStatus: text(row, 'employee_status'),
    supervisorNames: stringArray(row, 'supervisor_names'),
    streetAddress: optionalText(row, 'street_address'),
    postalCode: optionalText(row, 'postal_code'),
    city: optionalText(row, 'city'),
    country: optionalText(row, 'country'),
    dateOfBirth: optionalText(row, 'date_of_birth'),
    personalIdentityCodeLast4: optionalText(row, 'personal_identity_code_last4'),
    iban: optionalText(row, 'iban'),
    bic: optionalText(row, 'bic'),
    taxPercent: optionalNumber(row, 'tax_percent'),
    additionalTaxPercent: optionalNumber(row, 'additional_tax_percent'),
    taxIncomeLimitCents: optionalNumber(row, 'tax_income_limit_cents'),
    taxCardValidFrom: optionalText(row, 'tax_card_valid_from'),
    taxCardValidTo: optionalText(row, 'tax_card_valid_to'),
    unionName: optionalText(row, 'union_name'),
    occupationalHealthProvider: optionalText(row, 'occupational_health_provider'),
    employmentNotes: optionalText(row, 'employment_notes'),
    payrollNotes: optionalText(row, 'payroll_notes'),
    compensationId: optionalText(row, 'compensation_id'),
    payType: payTypeValue === 'Tuntipalkka' ? 'Tuntipalkka' : payTypeValue === 'Kuukausipalkka' ? 'Kuukausipalkka' : undefined,
    monthlySalaryCents: optionalNumber(row, 'monthly_salary_cents'),
    hourlyWageCents: optionalNumber(row, 'hourly_wage_cents'),
    weeklyHours: optionalNumber(row, 'weekly_hours'),
    collectiveAgreement: optionalText(row, 'collective_agreement'),
    payPeriod: optionalText(row, 'pay_period'),
    eveningAllowanceCents: optionalNumber(row, 'evening_allowance_cents'),
    nightAllowanceCents: optionalNumber(row, 'night_allowance_cents'),
    saturdayAllowanceCents: optionalNumber(row, 'saturday_allowance_cents'),
    sundayAllowanceCents: optionalNumber(row, 'sunday_allowance_cents'),
    overtime50Multiplier: optionalNumber(row, 'overtime_50_multiplier'),
    overtime100Multiplier: optionalNumber(row, 'overtime_100_multiplier'),
    dailyAllowanceCents: optionalNumber(row, 'daily_allowance_cents'),
    mealAllowanceCents: optionalNumber(row, 'meal_allowance_cents'),
    travelTimeHourlyCents: optionalNumber(row, 'travel_time_hourly_cents'),
    compensationValidFrom: optionalText(row, 'compensation_valid_from'),
    compensationValidTo: optionalText(row, 'compensation_valid_to'),
    compensationNotes: optionalText(row, 'compensation_notes'),
  };
}

export async function listAccessibleEmployeeCards(organizationId: string): Promise<EmployeeCard[]> {
  const { data, error } = await supabase.rpc('list_accessible_employee_cards', {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(`Henkilökorttien haku epäonnistui: ${error.message}`);
  return rows(data).map(employeeCard);
}

export async function saveEmployeeHrProfile(values: {
  organizationId: string;
  employeeId: string;
  userId: string;
  input: HrProfileInput;
}): Promise<void> {
  const payload = {
    employee_id: values.employeeId,
    organization_id: values.organizationId,
    date_of_birth: values.input.dateOfBirth || null,
    street_address: values.input.streetAddress?.trim() || null,
    postal_code: values.input.postalCode?.trim() || null,
    city: values.input.city?.trim() || null,
    country: values.input.country?.trim() || 'Suomi',
    personal_identity_code_last4: values.input.personalIdentityCodeLast4?.trim() || null,
    iban: values.input.iban?.replaceAll(' ', '').toUpperCase() || null,
    bic: values.input.bic?.replaceAll(' ', '').toUpperCase() || null,
    tax_percent: values.input.taxPercent ?? null,
    additional_tax_percent: values.input.additionalTaxPercent ?? null,
    tax_income_limit_cents: values.input.taxIncomeLimitCents ?? null,
    tax_card_valid_from: values.input.taxCardValidFrom || null,
    tax_card_valid_to: values.input.taxCardValidTo || null,
    union_name: values.input.unionName?.trim() || null,
    occupational_health_provider: values.input.occupationalHealthProvider?.trim() || null,
    employment_notes: values.input.employmentNotes?.trim() || null,
    payroll_notes: values.input.payrollNotes?.trim() || null,
    updated_by: values.userId,
  };
  const { error } = await supabase.from('employee_hr_profiles').upsert(payload, { onConflict: 'employee_id' });
  if (error) throw new Error(`HR-tietojen tallennus epäonnistui: ${error.message}`);
}

export async function saveEmployeeCompensation(values: {
  organizationId: string;
  employeeId: string;
  userId: string;
  input: CompensationInput;
}): Promise<void> {
  const payload = {
    organization_id: values.organizationId,
    employee_id: values.employeeId,
    valid_from: values.input.validFrom,
    valid_to: values.input.validTo || null,
    pay_type: values.input.payType,
    monthly_salary_cents: values.input.payType === 'Kuukausipalkka' ? values.input.monthlySalaryCents ?? null : null,
    hourly_wage_cents: values.input.payType === 'Tuntipalkka' ? values.input.hourlyWageCents ?? null : null,
    weekly_hours: values.input.weeklyHours,
    collective_agreement: values.input.collectiveAgreement?.trim() || null,
    pay_period: values.input.payPeriod,
    evening_allowance_cents: values.input.eveningAllowanceCents,
    night_allowance_cents: values.input.nightAllowanceCents,
    saturday_allowance_cents: values.input.saturdayAllowanceCents,
    sunday_allowance_cents: values.input.sundayAllowanceCents,
    overtime_50_multiplier: values.input.overtime50Multiplier,
    overtime_100_multiplier: values.input.overtime100Multiplier,
    daily_allowance_cents: values.input.dailyAllowanceCents,
    meal_allowance_cents: values.input.mealAllowanceCents,
    travel_time_hourly_cents: values.input.travelTimeHourlyCents,
    notes: values.input.notes?.trim() || null,
    updated_by: values.userId,
  };

  if (values.input.id) {
    const { error } = await supabase
      .from('employee_compensation_terms')
      .update(payload)
      .eq('id', values.input.id)
      .eq('organization_id', values.organizationId);
    if (error) throw new Error(`Palkkatietojen päivitys epäonnistui: ${error.message}`);
    return;
  }

  const { error } = await supabase.from('employee_compensation_terms').insert({
    ...payload,
    created_by: values.userId,
  });
  if (error) throw new Error(`Palkkatietojen tallennus epäonnistui: ${error.message}`);
}

export async function listSupervisorTeamMembers(organizationId: string): Promise<SupervisorTeamMember[]> {
  const { data, error } = await supabase
    .from('supervisor_team_members')
    .select('supervisor_user_id, employee_id')
    .eq('organization_id', organizationId)
    .eq('is_active', true);
  if (error) throw new Error(`Työnjohtajatiimien haku epäonnistui: ${error.message}`);
  return rows(data).map((row) => ({
    supervisorUserId: text(row, 'supervisor_user_id'),
    employeeId: text(row, 'employee_id'),
  }));
}

export async function setSupervisorTeam(values: {
  organizationId: string;
  supervisorUserId: string;
  employeeIds: string[];
}): Promise<void> {
  const { error } = await supabase.rpc('set_supervisor_team', {
    p_organization_id: values.organizationId,
    p_supervisor_user_id: values.supervisorUserId,
    p_employee_ids: values.employeeIds,
  });
  if (error) throw new Error(`Työnjohtajan tiimin tallennus epäonnistui: ${error.message}`);
}

export async function generateWorkSiteQr(values: {
  projectId: string;
  label?: string;
  expiresAt?: string;
  requireGeofence: boolean;
}): Promise<GeneratedWorkSiteQr> {
  const { data, error } = await supabase.functions.invoke('work-site-qr', {
    body: {
      projectId: values.projectId,
      appOrigin: window.location.origin,
      label: values.label,
      expiresAt: values.expiresAt || null,
      requireGeofence: values.requireGeofence,
    },
  });
  if (error) throw new Error(`QR-koodin luonti epäonnistui: ${error.message}`);
  if (!data || typeof data.svg !== 'string' || typeof data.checkInUrl !== 'string') {
    throw new Error(data?.error || 'QR-palvelu palautti virheellisen vastauksen.');
  }
  return {
    projectName: String(data.projectName ?? ''),
    expiresAt: data.expiresAt ? String(data.expiresAt) : undefined,
    requireGeofence: Boolean(data.requireGeofence),
    checkInUrl: data.checkInUrl,
    svg: data.svg,
  };
}

export async function consumeWorkSiteQr(values: {
  token: string;
  latitude: number;
  longitude: number;
  accuracyM: number;
  description?: string;
}): Promise<QrCheckInResult> {
  const { data, error } = await supabase.rpc('consume_work_site_qr', {
    p_token: values.token,
    p_latitude: values.latitude,
    p_longitude: values.longitude,
    p_accuracy_m: values.accuracyM,
    p_description: values.description?.trim() || null,
  });
  if (error) throw new Error(error.message);
  const record = rows(data)[0];
  if (!record) throw new Error('QR-kirjautuminen ei palauttanut työmaakirjausta.');
  return {
    checkInId: text(record, 'check_in_id'),
    projectId: text(record, 'project_id'),
    projectName: text(record, 'project_name'),
    checkedInAt: text(record, 'checked_in_at'),
    withinGeofence: typeof record.within_geofence === 'boolean' ? record.within_geofence : undefined,
    distanceFromSiteM: optionalNumber(record, 'distance_from_site_m'),
  };
}

export async function listBackupRuns(): Promise<BackupRun[]> {
  const { data, error } = await supabase
    .from('backup_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(`Varmuuskopiohistorian haku epäonnistui: ${error.message}`);
  return rows(data).map((row) => ({
    id: text(row, 'id'),
    status: text(row, 'status') === 'completed' ? 'completed' : text(row, 'status') === 'failed' ? 'failed' : 'running',
    triggeredBy: text(row, 'triggered_by'),
    storagePrefix: optionalText(row, 'storage_prefix'),
    tableCount: numberValue(row, 'table_count'),
    rowCount: numberValue(row, 'row_count'),
    fileCount: numberValue(row, 'file_count'),
    totalBytes: numberValue(row, 'total_bytes'),
    errorMessage: optionalText(row, 'error_message'),
    startedAt: text(row, 'started_at'),
    finishedAt: optionalText(row, 'finished_at'),
  }));
}
