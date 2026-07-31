export const SITE_DIARY_STATUSES = [
  'Luonnos',
  'Täydennettävä',
  'Tarkastettavana',
  'Tarkastettu',
  'Odottaa kuittausta',
  'Lukittu',
  'Mitätöity',
] as const;

export type SiteDiaryStatus = (typeof SITE_DIARY_STATUSES)[number];

export type SiteDiaryTone = 'neutral' | 'warning' | 'info' | 'success' | 'locked' | 'danger';

export const SITE_DIARY_STATUS_TONES: Record<SiteDiaryStatus, SiteDiaryTone> = {
  Luonnos: 'neutral',
  Täydennettävä: 'warning',
  Tarkastettavana: 'info',
  Tarkastettu: 'success',
  'Odottaa kuittausta': 'warning',
  Lukittu: 'locked',
  Mitätöity: 'danger',
};

export interface SiteDiaryCompletion {
  percent: number;
  missing: string[];
  weatherCount: number;
  workforceCount: number;
  workItemCount: number;
  openCriticalCount: number;
}

export function isSiteDiaryStatus(value: unknown): value is SiteDiaryStatus {
  return typeof value === 'string' && SITE_DIARY_STATUSES.includes(value as SiteDiaryStatus);
}

export function canEditSiteDiary(status: SiteDiaryStatus, lockedAt?: string | null): boolean {
  return !lockedAt && (status === 'Luonnos' || status === 'Täydennettävä');
}

export function canSubmitSiteDiary(status: SiteDiaryStatus, completion: SiteDiaryCompletion): boolean {
  return (
    (status === 'Luonnos' || status === 'Täydennettävä')
    && completion.missing.length === 0
    && completion.percent === 100
  );
}

export function canReviewSiteDiary(status: SiteDiaryStatus): boolean {
  return status === 'Tarkastettavana';
}

export function canLockSiteDiary(status: SiteDiaryStatus, completion: SiteDiaryCompletion): boolean {
  return (
    (status === 'Tarkastettu' || status === 'Odottaa kuittausta')
    && completion.missing.length === 0
    && completion.percent === 100
  );
}

export function completionSummary(completion: SiteDiaryCompletion): string {
  if (completion.missing.length === 0) return 'Kaikki pakolliset tiedot on täytetty.';
  return `Puuttuu: ${completion.missing.join(', ')}.`;
}

export function safeSiteDiaryFileName(name: string): string {
  const normalized = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return normalized
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'tiedosto';
}

export function siteDiaryStoragePath(input: {
  organizationId: string;
  projectId: string;
  diaryId: string;
  attachmentId: string;
  fileName: string;
}): string {
  return [
    input.organizationId,
    input.projectId,
    'diaries',
    input.diaryId,
    input.attachmentId,
    safeSiteDiaryFileName(input.fileName),
  ].join('/');
}

export function formatSiteDiaryDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fi-FI');
}

export function todayIsoDate(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function normalizeSiteDiaryError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}
