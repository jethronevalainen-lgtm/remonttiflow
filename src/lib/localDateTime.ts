function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Calendar date in the user's local timezone, suitable for date inputs and comparisons. */
export function localDateIso(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local wall-clock value for a datetime-local input. */
export function localDateTimeInput(date = new Date()): string {
  return `${localDateIso(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function isInstantWithinRange(
  startsAt: string,
  endsAt: string,
  instant = Date.now(),
): boolean {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && start <= instant && instant < end;
}
