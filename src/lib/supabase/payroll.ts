import { supabase } from './client';

export interface OrganizationTimeRules {
  organizationId: string;
  contractualDailyHours: number;
  contractualWeeklyHours: number;
  statutoryDailyOvertimeAfterHours: number;
  statutoryWeeklyOvertimeAfterHours: number;
  dailyOvertime50Hours: number;
  roundingMinutes: number;
  roundingMode: 'nearest' | 'floor' | 'ceil';
  automaticBreakAfterMinutes: number;
  automaticBreakMinutes: number;
  eveningStartTime: string;
  eveningEndTime: string;
  nightStartTime: string;
  nightEndTime: string;
  monthlySalaryHourDivisor: number;
  sundayMultiplier: number;
  maximumAverageWeeklyHours: number;
  kilometerAllowanceCentsPerKm: number;
  partialDailyAllowanceCents: number;
  fullDailyAllowanceCents: number;
  mealAllowanceCents: number;
  expenseRatesValidFrom: string;
  timezone: string;
}

export interface PayrollPreviewLine {
  employeeId?: string;
  employeeUserId?: string;
  employeeName: string;
  timeEntryId: string;
  workDate: string;
  projectName: string;
  compensationTermId?: string;
  payType?: string;
  monthlySalaryCents?: number;
  hourlyWageBasisCents?: number;
  totalMinutes: number;
  regularMinutes: number;
  additionalMinutes: number;
  overtime50Minutes: number;
  overtime100Minutes: number;
  weeklyOvertime50Minutes: number;
  eveningMinutes: number;
  nightMinutes: number;
  saturdayMinutes: number;
  sundayMinutes: number;
  breakMinutes: number;
  breakSource: string;
  startTime?: string;
  endTime?: string;
  hourlyBasePayCents: number;
  overtimePremiumCents: number;
  allowancePayCents: number;
  sundayPremiumCents: number;
  variablePayCents: number;
  lineTotalCents: number;
  blockers: string[];
  warnings: string[];
}

export interface PayrollPeriod {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  notes?: string;
  lockedBy?: string;
  lockedAt?: string;
  exportedAt?: string;
  createdAt: string;
  employeeCount: number;
  estimatedTotalCents: number;
}

type Row = Record<string, unknown>;

const DEFAULT_RULES: Omit<OrganizationTimeRules, 'organizationId'> = {
  contractualDailyHours: 7.5,
  contractualWeeklyHours: 37.5,
  statutoryDailyOvertimeAfterHours: 8,
  statutoryWeeklyOvertimeAfterHours: 40,
  dailyOvertime50Hours: 2,
  roundingMinutes: 15,
  roundingMode: 'nearest',
  automaticBreakAfterMinutes: 360,
  automaticBreakMinutes: 30,
  eveningStartTime: '18:00:00',
  eveningEndTime: '23:00:00',
  nightStartTime: '23:00:00',
  nightEndTime: '06:00:00',
  monthlySalaryHourDivisor: 162.5,
  sundayMultiplier: 2,
  maximumAverageWeeklyHours: 48,
  kilometerAllowanceCentsPerKm: 55,
  partialDailyAllowanceCents: 2500,
  fullDailyAllowanceCents: 5400,
  mealAllowanceCents: 1350,
  expenseRatesValidFrom: '2026-01-01',
  timezone: 'Europe/Helsinki',
};

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

function numberValue(row: Row, key: string): number {
  const value = row[key];
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(row: Row, key: string): number | undefined {
  if (row[key] == null || row[key] === '') return undefined;
  const parsed = Number(row[key]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringArray(row: Row, key: string): string[] {
  return Array.isArray(row[key])
    ? (row[key] as unknown[]).filter((item): item is string => typeof item === 'string')
    : [];
}

function clockValue(row: Row, key: string, fallback: string): string {
  const value = text(row, key);
  return value || fallback;
}

export async function getOrganizationTimeRules(organizationId: string): Promise<OrganizationTimeRules> {
  const { data, error } = await supabase
    .from('organization_time_rules')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) throw new Error(`Työaikasääntöjen haku epäonnistui: ${error.message}`);
  const row = (data ?? {}) as Row;
  const roundingMode = text(row, 'rounding_mode');

  return {
    organizationId,
    contractualDailyHours: optionalNumber(row, 'contractual_daily_hours') ?? DEFAULT_RULES.contractualDailyHours,
    contractualWeeklyHours: optionalNumber(row, 'contractual_weekly_hours') ?? DEFAULT_RULES.contractualWeeklyHours,
    statutoryDailyOvertimeAfterHours: optionalNumber(row, 'statutory_daily_overtime_after_hours') ?? DEFAULT_RULES.statutoryDailyOvertimeAfterHours,
    statutoryWeeklyOvertimeAfterHours: optionalNumber(row, 'statutory_weekly_overtime_after_hours') ?? DEFAULT_RULES.statutoryWeeklyOvertimeAfterHours,
    dailyOvertime50Hours: optionalNumber(row, 'daily_overtime_50_hours') ?? DEFAULT_RULES.dailyOvertime50Hours,
    roundingMinutes: optionalNumber(row, 'rounding_minutes') ?? DEFAULT_RULES.roundingMinutes,
    roundingMode: roundingMode === 'floor' || roundingMode === 'ceil' ? roundingMode : 'nearest',
    automaticBreakAfterMinutes: optionalNumber(row, 'automatic_break_after_minutes') ?? DEFAULT_RULES.automaticBreakAfterMinutes,
    automaticBreakMinutes: optionalNumber(row, 'automatic_break_minutes') ?? DEFAULT_RULES.automaticBreakMinutes,
    eveningStartTime: clockValue(row, 'evening_start_time', DEFAULT_RULES.eveningStartTime),
    eveningEndTime: clockValue(row, 'evening_end_time', DEFAULT_RULES.eveningEndTime),
    nightStartTime: clockValue(row, 'night_start_time', DEFAULT_RULES.nightStartTime),
    nightEndTime: clockValue(row, 'night_end_time', DEFAULT_RULES.nightEndTime),
    monthlySalaryHourDivisor: optionalNumber(row, 'monthly_salary_hour_divisor') ?? DEFAULT_RULES.monthlySalaryHourDivisor,
    sundayMultiplier: optionalNumber(row, 'sunday_multiplier') ?? DEFAULT_RULES.sundayMultiplier,
    maximumAverageWeeklyHours: optionalNumber(row, 'maximum_average_weekly_hours') ?? DEFAULT_RULES.maximumAverageWeeklyHours,
    kilometerAllowanceCentsPerKm: optionalNumber(row, 'kilometer_allowance_cents_per_km') ?? DEFAULT_RULES.kilometerAllowanceCentsPerKm,
    partialDailyAllowanceCents: optionalNumber(row, 'partial_daily_allowance_cents') ?? DEFAULT_RULES.partialDailyAllowanceCents,
    fullDailyAllowanceCents: optionalNumber(row, 'full_daily_allowance_cents') ?? DEFAULT_RULES.fullDailyAllowanceCents,
    mealAllowanceCents: optionalNumber(row, 'meal_allowance_cents') ?? DEFAULT_RULES.mealAllowanceCents,
    expenseRatesValidFrom: optionalText(row, 'expense_rates_valid_from') ?? DEFAULT_RULES.expenseRatesValidFrom,
    timezone: optionalText(row, 'timezone') ?? DEFAULT_RULES.timezone,
  };
}

export async function saveOrganizationTimeRules(
  rules: OrganizationTimeRules,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from('organization_time_rules').upsert({
    organization_id: rules.organizationId,
    contractual_daily_hours: rules.contractualDailyHours,
    contractual_weekly_hours: rules.contractualWeeklyHours,
    statutory_daily_overtime_after_hours: rules.statutoryDailyOvertimeAfterHours,
    statutory_weekly_overtime_after_hours: rules.statutoryWeeklyOvertimeAfterHours,
    daily_overtime_50_hours: rules.dailyOvertime50Hours,
    rounding_minutes: rules.roundingMinutes,
    rounding_mode: rules.roundingMode,
    automatic_break_after_minutes: rules.automaticBreakAfterMinutes,
    automatic_break_minutes: rules.automaticBreakMinutes,
    evening_start_time: rules.eveningStartTime,
    evening_end_time: rules.eveningEndTime,
    night_start_time: rules.nightStartTime,
    night_end_time: rules.nightEndTime,
    monthly_salary_hour_divisor: rules.monthlySalaryHourDivisor,
    sunday_multiplier: rules.sundayMultiplier,
    maximum_average_weekly_hours: rules.maximumAverageWeeklyHours,
    kilometer_allowance_cents_per_km: rules.kilometerAllowanceCentsPerKm,
    partial_daily_allowance_cents: rules.partialDailyAllowanceCents,
    full_daily_allowance_cents: rules.fullDailyAllowanceCents,
    meal_allowance_cents: rules.mealAllowanceCents,
    expense_rates_valid_from: rules.expenseRatesValidFrom,
    timezone: rules.timezone,
    created_by: userId,
    updated_by: userId,
  }, { onConflict: 'organization_id' });

  if (error) throw new Error(`Työaikasääntöjen tallennus epäonnistui: ${error.message}`);
}

export async function listPayrollPreview(
  organizationId: string,
  periodStart: string,
  periodEnd: string,
): Promise<PayrollPreviewLine[]> {
  const { data, error } = await supabase.rpc('list_payroll_preview_v2', {
    p_organization_id: organizationId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
  });
  if (error) throw new Error(`Palkka-aineiston laskenta epäonnistui: ${error.message}`);

  return rows(data).map((row) => ({
    employeeId: optionalText(row, 'employee_id'),
    employeeUserId: optionalText(row, 'employee_user_id'),
    employeeName: text(row, 'employee_name'),
    timeEntryId: text(row, 'time_entry_id'),
    workDate: text(row, 'work_date'),
    projectName: text(row, 'project_name'),
    compensationTermId: optionalText(row, 'compensation_term_id'),
    payType: optionalText(row, 'pay_type'),
    monthlySalaryCents: optionalNumber(row, 'monthly_salary_cents'),
    hourlyWageBasisCents: optionalNumber(row, 'hourly_wage_basis_cents'),
    totalMinutes: numberValue(row, 'total_minutes'),
    regularMinutes: numberValue(row, 'regular_minutes'),
    additionalMinutes: numberValue(row, 'additional_minutes'),
    overtime50Minutes: numberValue(row, 'overtime_50_minutes'),
    overtime100Minutes: numberValue(row, 'overtime_100_minutes'),
    weeklyOvertime50Minutes: numberValue(row, 'weekly_overtime_50_minutes'),
    eveningMinutes: numberValue(row, 'evening_minutes'),
    nightMinutes: numberValue(row, 'night_minutes'),
    saturdayMinutes: numberValue(row, 'saturday_minutes'),
    sundayMinutes: numberValue(row, 'sunday_minutes'),
    breakMinutes: numberValue(row, 'break_minutes'),
    breakSource: text(row, 'break_source'),
    startTime: optionalText(row, 'start_time'),
    endTime: optionalText(row, 'end_time'),
    hourlyBasePayCents: numberValue(row, 'hourly_base_pay_cents'),
    overtimePremiumCents: numberValue(row, 'overtime_premium_cents'),
    allowancePayCents: numberValue(row, 'allowance_pay_cents'),
    sundayPremiumCents: numberValue(row, 'sunday_premium_cents'),
    variablePayCents: numberValue(row, 'variable_pay_cents'),
    lineTotalCents: numberValue(row, 'line_total_cents'),
    blockers: stringArray(row, 'blockers'),
    warnings: stringArray(row, 'warnings'),
  }));
}

export async function listPayrollPeriods(organizationId: string): Promise<PayrollPeriod[]> {
  const { data, error } = await supabase.rpc('list_payroll_periods', {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(`Palkkakausien haku epäonnistui: ${error.message}`);

  return rows(data).map((row) => ({
    id: text(row, 'id'),
    periodStart: text(row, 'period_start'),
    periodEnd: text(row, 'period_end'),
    status: text(row, 'status'),
    notes: optionalText(row, 'notes'),
    lockedBy: optionalText(row, 'locked_by'),
    lockedAt: optionalText(row, 'locked_at'),
    exportedAt: optionalText(row, 'exported_at'),
    createdAt: text(row, 'created_at'),
    employeeCount: numberValue(row, 'employee_count'),
    estimatedTotalCents: numberValue(row, 'estimated_total_cents'),
  }));
}

export async function lockPayrollPeriod(values: {
  organizationId: string;
  periodStart: string;
  periodEnd: string;
  notes?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('lock_payroll_period', {
    p_organization_id: values.organizationId,
    p_period_start: values.periodStart,
    p_period_end: values.periodEnd,
    p_notes: values.notes?.trim() || null,
  });
  if (error) throw new Error(`Palkkakauden lukitus epäonnistui: ${error.message}`);
  if (typeof data !== 'string') throw new Error('Palkkakauden lukitus ei palauttanut tunnistetta.');
  return data;
}
