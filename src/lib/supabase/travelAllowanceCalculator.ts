import { supabase } from './client';

export interface DomesticTravelAllowanceCalculation {
  durationMinutes: number;
  distanceKm: number;
  useOwnCar: boolean;
  mileageRateCentsPerKm: number;
  mileageCents: number;
  partialDailyAllowanceCents: number;
  fullDailyAllowanceCents: number;
  dailyAllowanceCents: number;
  allowanceUnits: number;
  allowanceType: 'none' | 'partial' | 'full' | 'multi_day';
  freeMealCount: number;
  totalCents: number;
  eligibilityConfirmed: boolean;
  requiresManualReview: boolean;
  warnings: string[];
  ratesValidFrom: string;
  timezone: string;
}

function asCalculation(data: unknown): DomesticTravelAllowanceCalculation {
  const value = (data ?? {}) as Partial<DomesticTravelAllowanceCalculation>;
  return {
    durationMinutes: Number(value.durationMinutes ?? 0),
    distanceKm: Number(value.distanceKm ?? 0),
    useOwnCar: Boolean(value.useOwnCar),
    mileageRateCentsPerKm: Number(value.mileageRateCentsPerKm ?? 0),
    mileageCents: Number(value.mileageCents ?? 0),
    partialDailyAllowanceCents: Number(value.partialDailyAllowanceCents ?? 0),
    fullDailyAllowanceCents: Number(value.fullDailyAllowanceCents ?? 0),
    dailyAllowanceCents: Number(value.dailyAllowanceCents ?? 0),
    allowanceUnits: Number(value.allowanceUnits ?? 0),
    allowanceType: value.allowanceType ?? 'none',
    freeMealCount: Number(value.freeMealCount ?? 0),
    totalCents: Number(value.totalCents ?? 0),
    eligibilityConfirmed: Boolean(value.eligibilityConfirmed),
    requiresManualReview: Boolean(value.requiresManualReview),
    warnings: Array.isArray(value.warnings) ? value.warnings.map(String) : [],
    ratesValidFrom: String(value.ratesValidFrom ?? ''),
    timezone: String(value.timezone ?? 'Europe/Helsinki'),
  };
}

export async function calculateDomesticTravelAllowance(input: {
  organizationId: string;
  startedAt: string;
  endedAt: string;
  distanceKm: number;
  useOwnCar: boolean;
  freeMealCount: number;
  eligibilityConfirmed: boolean;
}): Promise<DomesticTravelAllowanceCalculation> {
  const { data, error } = await supabase.rpc('calculate_domestic_travel_allowance', {
    p_organization_id: input.organizationId,
    p_started_at: input.startedAt,
    p_ended_at: input.endedAt,
    p_distance_km: input.distanceKm,
    p_use_own_car: input.useOwnCar,
    p_free_meal_count: input.freeMealCount,
    p_eligibility_confirmed: input.eligibilityConfirmed,
  });
  if (error) throw new Error(`Matkakorvauksen laskenta epäonnistui: ${error.message}`);
  return asCalculation(data);
}

export async function createCalculatedTravelExpense(input: {
  organizationId: string;
  projectId?: string;
  startedAt: string;
  endedAt: string;
  distanceKm: number;
  useOwnCar: boolean;
  freeMealCount: number;
  eligibilityConfirmed: boolean;
  description?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_calculated_travel_expense', {
    p_organization_id: input.organizationId,
    p_project_id: input.projectId || null,
    p_started_at: input.startedAt,
    p_ended_at: input.endedAt,
    p_distance_km: input.distanceKm,
    p_use_own_car: input.useOwnCar,
    p_free_meal_count: input.freeMealCount,
    p_eligibility_confirmed: input.eligibilityConfirmed,
    p_description: input.description || null,
  });
  if (error) throw new Error(`Matkalaskun tallennus epäonnistui: ${error.message}`);
  return String(data);
}
