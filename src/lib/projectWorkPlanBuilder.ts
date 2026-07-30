import type { WorkOrderPriority } from '@/types';

export interface ProjectWorkTargetDraft {
  id: string;
  key: string;
  title: string;
  location: string;
  /** Mitä tässä kohteessa / huoneistossa tehdään. */
  description: string;
  /** Kohteen tekijät; jos asetettu, ohittaa työvaiheen tekijät. */
  assigneeUserIds: string[];
}

export interface ProjectWorkPhaseDraft {
  id: string;
  title: string;
  type: string;
  description: string;
  startDate: string;
  endDate: string;
  priority: WorkOrderPriority;
  assigneeUserIds: string[];
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
    const description = parts.slice(2).join(' | ').trim();
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
      assigneeUserIds: [],
    });
    if (result.length === 100) break;
  }

  return result;
}

export function generateProjectWorkTargets(values: {
  prefix: string;
  start: number;
  count: number;
  padLength?: number;
  locationPrefix?: string;
}): ProjectWorkTargetDraft[] {
  const prefix = values.prefix.trim();
  const separator = prefix && /[a-z0-9åäö]$/i.test(prefix) ? ' ' : '';
  const start = Number.isFinite(values.start) ? Math.max(0, Math.floor(values.start)) : 1;
  const count = Number.isFinite(values.count) ? Math.min(100, Math.max(1, Math.floor(values.count))) : 1;
  const padLength = Number.isFinite(values.padLength)
    ? Math.min(6, Math.max(0, Math.floor(values.padLength ?? 0)))
    : 0;
  const locationPrefix = values.locationPrefix?.trim() ?? '';

  return Array.from({ length: count }, (_, index) => {
    const number = String(start + index).padStart(padLength, '0');
    const title = `${prefix}${separator}${number}`.trim();
    return {
      id: targetId(title, index),
      key: normalizedKey(title, index),
      title,
      location: locationPrefix ? `${locationPrefix} ${title}`.trim() : title,
      description: '',
      assigneeUserIds: [],
    };
  });
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateText(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function spreadProjectPhaseDates(
  startDate: string,
  endDate: string,
  count: number,
): Array<{ startDate: string; endDate: string }> {
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
