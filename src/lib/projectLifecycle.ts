import type { ProjectStatus } from '@/types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface ProjectLifecycleInput {
  status?: ProjectStatus | string | null;
  startDate?: string | null;
  endDate?: string | null;
}

function validDate(value: string | null | undefined): string | undefined {
  return typeof value === 'string' && ISO_DATE.test(value) ? value : undefined;
}

/**
 * Returns a local calendar date instead of a UTC date. Project dates are
 * date-only values and must not change a day when the browser timezone differs
 * from UTC.
 */
export function localTodayIso(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Project lifecycle rules:
 * - Valmis is the only explicit/manual terminal state.
 * - Myöhässä is derived from an exceeded target completion date.
 * - Aktiivinen starts automatically on the start date.
 * - Otherwise the project remains Suunniteltu.
 */
export function deriveProjectStatus(
  input: ProjectLifecycleInput,
  referenceDate = localTodayIso(),
): ProjectStatus {
  if (input.status === 'Valmis') return 'Valmis';

  const endDate = validDate(input.endDate);
  if (endDate && endDate < referenceDate) return 'Myöhässä';

  const startDate = validDate(input.startDate);
  if (startDate && startDate <= referenceDate) return 'Aktiivinen';

  return 'Suunniteltu';
}

export function isRunningProjectStatus(status: ProjectStatus): boolean {
  return status === 'Aktiivinen' || status === 'Myöhässä';
}

export function reopenProjectStatus(
  input: Omit<ProjectLifecycleInput, 'status'>,
  referenceDate = localTodayIso(),
): ProjectStatus {
  return deriveProjectStatus({ ...input, status: 'Suunniteltu' }, referenceDate);
}
