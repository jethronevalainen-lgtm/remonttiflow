import type { WorkOrderPriority } from '@/types';

export interface ProjectWorkTargetDraft {
  id: string;
  key: string;
  title: string;
  location: string;
  /** Mitä tässä kohteessa / huoneistossa tehdään. */
  description: string;
  /** Kohteen suunniteltu aloitus. Jaetaan kohteen työvaiheille järjestyksessä. */
  startDate: string;
  /** Kohteen suunniteltu valmistuminen. */
  endDate: string;
  /** Kohteen tekijät; jos asetettu, ohittaa työvaiheen tekijät. */
  assigneeUserIds: string[];
}

export interface ProjectWorkPhaseDraft {
  id: string;
  title: string;
  type: string;
  description: string;
  /** Työvaiheen oletusaikataulu, jota käytetään ilman kohdekohtaista aikataulua. */
  startDate: string;
  endDate: string;
  priority: WorkOrderPriority;
  assigneeUserIds: string[];
}

export interface ProjectWorkPhaseSchedule {
  startDate: string;
  endDate: string;
}

function normalizedKey(value: string, index: number): string {
  const slug = value
    .trim()
    .toLocaleLowerCase('fi')
    .replace(/[^a-z0-9åäö]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return `${String(index + 1).padStart(3, '0')}-${slug || 'kohde'}`;
}

function targetId(title: string, index: number): string {
  return `target-${index}-${normalizedKey(title, index)}`;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Resolves assignees for one target × phase cell. Target wins when set. */
export function resolveWorkPlanAssignees(
  target: Pick<ProjectWorkTargetDraft, 'assigneeUserIds'>,
  phase: Pick<ProjectWorkPhaseDraft, 'assigneeUserIds'>,
): string[] {
  if (target.assigneeUserIds.length > 0) return [...new Set(target.assigneeUserIds)];
  return [...new Set(phase.assigneeUserIds)];
}

export function combineWorkPlanDescription(
  target: Pick<ProjectWorkTargetDraft, 'title' | 'description'>,
  phase: Pick<ProjectWorkPhaseDraft, 'title' | 'description'>,
): string {
  const parts = [
    target.description.trim()
      ? `Kohde ${target.title}: ${target.description.trim()}`
      : '',
    phase.description.trim()
      ? `Työvaihe ${phase.title}: ${phase.description.trim()}`
      : '',
  ].filter(Boolean);
  return parts.join('\n\n');
}

export function workOrderTitleForPlan(
  target: Pick<ProjectWorkTargetDraft, 'title'>,
  phase: Pick<ProjectWorkPhaseDraft, 'title'>,
): string {
  const targetTitle = target.title.trim();
  const phaseTitle = phase.title.trim();
  if (!targetTitle) return phaseTitle;
  if (!phaseTitle) return targetTitle;
  return `${targetTitle} – ${phaseTitle}`;
}

export function normalizeProjectWorkTargets(value: string): ProjectWorkTargetDraft[] {
  const seen = new Set<string>();
  const result: ProjectWorkTargetDraft[] = [];

  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const parts = line.split('|').map((part) => part.trim());
    const title = parts[0] ?? '';
    const location = parts[1] || title;
    const description = parts[2] ?? '';
    const startDate = isIsoDate(parts[3] ?? '') ? parts[3] : '';
    const endDate = isIsoDate(parts[4] ?? '') ? parts[4] : '';
    if (!title) continue;

    const duplicateKey = `${title}|${location}|${description}`.toLocaleLowerCase('fi');
    if (seen.has(duplicateKey)) continue;
    seen.add(duplicateKey);

    const index = result.length;
    result.push({
      id: targetId(title, index),
      key: normalizedKey(title, index),
      title,
      location,
      description,
      startDate,
      endDate,
      assigneeUserIds: [],
    });
    if (result.length === 100) break;
  }

  return result;
}

function parseDate(value: string): Date | null {
  if (!isIsoDate(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateText(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addWorkdays(value: string, offset: number): string {
  const date = parseDate(value);
  if (!date) return '';
  const direction = offset < 0 ? -1 : 1;
  let remaining = Math.abs(Math.trunc(offset));
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + direction);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return dateText(date);
}

export function generateProjectWorkTargets(values: {
  prefix: string;
  start: number;
  count: number;
  padLength?: number;
  locationPrefix?: string;
  firstStartDate?: string;
  workdayDuration?: number;
  gapWorkdays?: number;
}): ProjectWorkTargetDraft[] {
  const prefix = values.prefix.trim();
  const separator = prefix && /[a-z0-9åäö]$/i.test(prefix) ? ' ' : '';
  const start = Number.isFinite(values.start) ? Math.max(0, Math.floor(values.start)) : 1;
  const count = Number.isFinite(values.count) ? Math.min(100, Math.max(1, Math.floor(values.count))) : 1;
  const padLength = Number.isFinite(values.padLength)
    ? Math.min(6, Math.max(0, Math.floor(values.padLength ?? 0)))
    : 0;
  const locationPrefix = values.locationPrefix?.trim() ?? '';
  const firstStartDate = isIsoDate(values.firstStartDate ?? '') ? values.firstStartDate as string : '';
  const workdayDuration = Number.isFinite(values.workdayDuration)
    ? Math.max(1, Math.min(60, Math.floor(values.workdayDuration ?? 1)))
    : 1;
  const gapWorkdays = Number.isFinite(values.gapWorkdays)
    ? Math.max(0, Math.min(20, Math.floor(values.gapWorkdays ?? 0)))
    : 0;
  let nextStartDate = firstStartDate;

  return Array.from({ length: count }, (_, index) => {
    const number = String(start + index).padStart(padLength, '0');
    const title = `${prefix}${separator}${number}`.trim();
    const targetStartDate = nextStartDate;
    const targetEndDate = targetStartDate ? addWorkdays(targetStartDate, workdayDuration - 1) : '';
    if (targetEndDate) nextStartDate = addWorkdays(targetEndDate, gapWorkdays + 1);
    return {
      id: targetId(title, index),
      key: normalizedKey(title, index),
      title,
      location: locationPrefix ? `${locationPrefix} ${title}`.trim() : title,
      description: '',
      startDate: targetStartDate,
      endDate: targetEndDate,
      assigneeUserIds: [],
    };
  });
}

export function spreadProjectPhaseDates(
  startDate: string,
  endDate: string,
  count: number,
): ProjectWorkPhaseSchedule[] {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end || end < start || count < 1) {
    return Array.from({ length: Math.max(0, count) }, () => ({ startDate: '', endDate: '' }));
  }

  const totalDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return Array.from({ length: count }, (_, index) => {
    const startOffset = Math.floor((index * totalDays) / count);
    const nextOffset = Math.floor(((index + 1) * totalDays) / count);
    const phaseStart = new Date(start.getTime() + startOffset * 86_400_000);
    const phaseEnd = new Date(start.getTime() + Math.max(startOffset, nextOffset - 1) * 86_400_000);
    return { startDate: dateText(phaseStart), endDate: dateText(phaseEnd) };
  });
}

/**
 * Builds the exact dates sent to work orders. A target-level window overrides
 * phase defaults and is divided in phase order. With one phase the target dates
 * are used unchanged.
 */
export function buildTargetPhaseSchedule(
  target: Pick<ProjectWorkTargetDraft, 'startDate' | 'endDate'>,
  phases: Array<Pick<ProjectWorkPhaseDraft, 'startDate' | 'endDate'>>,
): ProjectWorkPhaseSchedule[] {
  if (
    isIsoDate(target.startDate)
    && isIsoDate(target.endDate)
    && target.endDate >= target.startDate
  ) {
    return spreadProjectPhaseDates(target.startDate, target.endDate, phases.length);
  }
  return phases.map((phase) => ({ startDate: phase.startDate, endDate: phase.endDate }));
}

export function createGenericProjectPhases(values: {
  startDate: string;
  endDate: string;
}): ProjectWorkPhaseDraft[] {
  const definitions = [
    {
      title: 'Aloitus, suojaus ja valmistelu',
      type: 'Valmistelu',
      description: 'Varmista lähtötiedot, kulkureitit, suojaukset, materiaalit ja työn turvallinen aloitus.',
    },
    {
      title: 'Purku tai pohjatyöt',
      type: 'Pohjatyö',
      description: 'Tee kohteen edellyttämät purku-, avaus-, mittaus- ja pohjatyöt ennen varsinaista toteutusta.',
    },
    {
      title: 'Varsinainen toteutus tai asennus',
      type: 'Toteutus',
      description: 'Toteuta kohteen varsinainen rakennus-, asennus- tai korjaustyö suunnitelmien mukaisesti.',
    },
    {
      title: 'Viimeistely ja toimintakokeet',
      type: 'Viimeistely',
      description: 'Tee liittymät, säädöt, puhdistus, toimintakokeet ja muut viimeistelytyöt.',
    },
    {
      title: 'Tarkastus, dokumentointi ja luovutus',
      type: 'Luovutus',
      description: 'Tarkasta laatu, käsittele puutteet, lisää dokumentit ja varmista luovutusvalmius.',
    },
  ];
  const ranges = spreadProjectPhaseDates(values.startDate, values.endDate, definitions.length);

  return definitions.map((definition, index) => ({
    id: `phase-${index + 1}`,
    ...definition,
    startDate: ranges[index]?.startDate ?? '',
    endDate: ranges[index]?.endDate ?? '',
    priority: 'Normaali',
    assigneeUserIds: [],
  }));
}

export function projectWorkPlanSize(targetCount: number, phaseCount: number): number {
  return Math.max(0, targetCount) * Math.max(0, phaseCount);
}

export function applyAssigneesToAllTargets(
  targets: ProjectWorkTargetDraft[],
  assigneeUserIds: string[],
): ProjectWorkTargetDraft[] {
  const unique = [...new Set(assigneeUserIds)];
  return targets.map((target) => ({ ...target, assigneeUserIds: unique }));
}

export function applyScheduleToAllTargets(
  targets: ProjectWorkTargetDraft[],
  startDate: string,
  endDate: string,
): ProjectWorkTargetDraft[] {
  return targets.map((target) => ({ ...target, startDate, endDate }));
}
