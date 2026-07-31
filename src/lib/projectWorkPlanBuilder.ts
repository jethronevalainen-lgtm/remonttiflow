import type { WorkOrderPriority } from '@/types';

export type WorkPlanWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ProjectWorkTargetDraft {
  id: string;
  key: string;
  title: string;
  location: string;
  /** Mitä tässä kohteessa / huoneistossa tehdään. */
  description: string;
  /** Kohteen aikaisin sallittu aloitus. */
  startDate: string;
  /** Kohteen tavoitevalmistuminen. */
  endDate: string;
  /** Kohteen oletustekijät; solukohtainen valinta ohittaa tämän. */
  assigneeUserIds: string[];
}

export interface ProjectUnitImportSource {
  id: string;
  unitCode: string;
  buildingName?: string;
  stairwellName?: string;
  floor?: string;
  unitType?: string;
  areaM2?: number;
  renovationScope?: string;
  plannedCompletionDate?: string;
  notes?: string;
}

export interface AppendProjectWorkTargetsResult {
  targets: ProjectWorkTargetDraft[];
  addedCount: number;
  duplicateCount: number;
  limitReached: boolean;
}

export interface ProjectWorkPhaseDraft {
  id: string;
  /** Vakaa tunniste tietokantaan ja kohdistusmatriisiin. */
  key?: string;
  title: string;
  type: string;
  description: string;
  /** Vanhan luonnin yhteensopivuuspäivät. */
  startDate: string;
  endDate: string;
  /** Uuden mallin oletuskesto työpäivinä. */
  durationWorkdays?: number;
  startTime?: string;
  endTime?: string;
  weekdays?: WorkPlanWeekday[];
  priority: WorkOrderPriority;
  assigneeUserIds: string[];
}

export interface ProjectWorkAssignmentDraft {
  id: string;
  targetId: string;
  phaseId: string;
  enabled: boolean;
  startDate: string;
  endDate: string;
  /** Tyhjä lista tarkoittaa: käytä kohteen tai työvaiheen oletusta. */
  assigneeUserIds: string[];
  /** Manuaalista aikataulua ei korvata automaattijaksotuksessa. */
  manualSchedule: boolean;
}

export interface ProjectWorkPhaseSchedule {
  startDate: string;
  endDate: string;
}

export interface WorkPlanScheduleWarning {
  targetId: string;
  targetTitle: string;
  message: string;
}

export interface WorkPlanInternalConflict {
  userId: string;
  date: string;
  firstAssignmentId: string;
  secondAssignmentId: string;
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

export function phaseKey(phase: Pick<ProjectWorkPhaseDraft, 'id' | 'key' | 'title'>, index = 0): string {
  if (phase.key?.trim()) return phase.key.trim();
  const id = phase.id.trim();
  if (id) return id;
  return normalizedKey(phase.title, index);
}

export function workAssignmentId(targetIdValue: string, phaseIdValue: string): string {
  return `${targetIdValue}::${phaseIdValue}`;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Hyväksyy sekä ISO-muodon että suomalaisen 3.8.2026 -kirjoitusasun. */
export function normalizeDateInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (isIsoDate(trimmed)) return trimmed;
  const finnish = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/.exec(trimmed);
  if (!finnish) return '';
  const iso = `${finnish[3]}-${finnish[2].padStart(2, '0')}-${finnish[1].padStart(2, '0')}`;
  return isIsoDate(iso) ? iso : '';
}

function parseDate(value: string): Date | null {
  if (!isIsoDate(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateText(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizedWeekdays(value?: WorkPlanWeekday[]): WorkPlanWeekday[] {
  const weekdays = value?.filter((day): day is WorkPlanWeekday => day >= 1 && day <= 7) ?? [];
  return weekdays.length > 0 ? [...new Set(weekdays)] : [1, 2, 3, 4, 5];
}

function isAllowedWorkday(date: Date, weekdays: WorkPlanWeekday[]): boolean {
  const jsDay = date.getUTCDay();
  const isoDay = (jsDay === 0 ? 7 : jsDay) as WorkPlanWeekday;
  return weekdays.includes(isoDay);
}

export function addWorkdays(
  value: string,
  offset: number,
  weekdays: WorkPlanWeekday[] = [1, 2, 3, 4, 5],
): string {
  const date = parseDate(value);
  if (!date) return '';
  const allowed = normalizedWeekdays(weekdays);
  const direction = offset < 0 ? -1 : 1;
  let remaining = Math.abs(Math.trunc(offset));
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + direction);
    if (isAllowedWorkday(date, allowed)) remaining -= 1;
  }
  return dateText(date);
}

export function firstAllowedWorkday(
  value: string,
  weekdays: WorkPlanWeekday[] = [1, 2, 3, 4, 5],
): string {
  const date = parseDate(value);
  if (!date) return '';
  const allowed = normalizedWeekdays(weekdays);
  while (!isAllowedWorkday(date, allowed)) date.setUTCDate(date.getUTCDate() + 1);
  return dateText(date);
}

export function workdayDates(
  startDate: string,
  endDate: string,
  weekdays: WorkPlanWeekday[] = [1, 2, 3, 4, 5],
): string[] {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end || end < start) return [];
  const allowed = normalizedWeekdays(weekdays);
  const result: string[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (isAllowedWorkday(cursor, allowed)) result.push(dateText(cursor));
  }
  return result;
}

export function defaultPhaseDuration(phase: ProjectWorkPhaseDraft): number {
  const explicit = Number(phase.durationWorkdays);
  if (Number.isFinite(explicit) && explicit >= 1) return Math.min(60, Math.floor(explicit));
  const legacyDates = workdayDates(phase.startDate, phase.endDate, phase.weekdays);
  return Math.max(1, legacyDates.length || 1);
}

/** Resolves assignees for one target × phase cell. Target wins when set. */
export function resolveWorkPlanAssignees(
  target: Pick<ProjectWorkTargetDraft, 'assigneeUserIds'>,
  phase: Pick<ProjectWorkPhaseDraft, 'assigneeUserIds'>,
): string[] {
  if (target.assigneeUserIds.length > 0) return [...new Set(target.assigneeUserIds)];
  return [...new Set(phase.assigneeUserIds)];
}

export function resolveWorkItemAssignees(
  item: Pick<ProjectWorkAssignmentDraft, 'assigneeUserIds'>,
  target: Pick<ProjectWorkTargetDraft, 'assigneeUserIds'>,
  phase: Pick<ProjectWorkPhaseDraft, 'assigneeUserIds'>,
): string[] {
  if (item.assigneeUserIds.length > 0) return [...new Set(item.assigneeUserIds)];
  return resolveWorkPlanAssignees(target, phase);
}

export function combineWorkPlanDescription(
  target: Pick<ProjectWorkTargetDraft, 'title' | 'description'>,
  phase: Pick<ProjectWorkPhaseDraft, 'title' | 'description'>,
): string {
  const parts = [
    target.description.trim() ? `Kohde ${target.title}: ${target.description.trim()}` : '',
    phase.description.trim() ? `Työvaihe ${phase.title}: ${phase.description.trim()}` : '',
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

export function normalizeProjectWorkTargetIdentity(
  target: Pick<ProjectWorkTargetDraft, 'title' | 'location'>,
): string {
  const normalize = (value: string) => value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('fi');
  const title = normalize(target.title);
  const location = normalize(target.location || target.title);
  return `${title}|${location}`;
}

export function projectUnitImportToTarget(
  unit: ProjectUnitImportSource,
  projectDates: { startDate: string; endDate: string },
): ProjectWorkTargetDraft {
  const floor = unit.floor?.trim();
  const location = [
    unit.buildingName?.trim(),
    unit.stairwellName?.trim(),
    floor ? (/kerros/i.test(floor) ? floor : `${floor}. kerros`) : '',
  ].filter(Boolean).join(' · ') || unit.unitCode.trim();
  const details = [
    unit.renovationScope?.trim(),
    unit.unitType?.trim(),
    Number.isFinite(unit.areaM2) ? `${unit.areaM2} m²` : '',
    unit.notes?.trim(),
  ].filter(Boolean).join(' · ');
  return {
    id: `unit-${unit.id}`,
    key: `unit-${unit.id}`,
    title: unit.unitCode.trim(),
    location,
    description: details,
    startDate: projectDates.startDate,
    endDate: unit.plannedCompletionDate || projectDates.endDate || projectDates.startDate,
    assigneeUserIds: [],
  };
}

export function appendProjectWorkTargets(
  current: ProjectWorkTargetDraft[],
  incoming: ProjectWorkTargetDraft[],
  maxTargets = 100,
): AppendProjectWorkTargetsResult {
  const limit = Math.min(100, Math.max(0, Math.floor(maxTargets)));
  const targets = [...current];
  const seen = new Set(current.map(normalizeProjectWorkTargetIdentity));
  const usedIds = new Set(current.map((target) => target.id));
  let addedCount = 0;
  let duplicateCount = 0;
  let limitReached = current.length >= limit;

  for (const target of incoming) {
    const identity = normalizeProjectWorkTargetIdentity(target);
    if (!target.title.trim() || seen.has(identity)) {
      duplicateCount += 1;
      continue;
    }
    if (targets.length >= limit) {
      limitReached = true;
      break;
    }

    const index = targets.length;
    const baseId = target.id.trim() || `target-${index}`;
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    seen.add(identity);

    const keyTail = (target.key.trim() || normalizedKey(target.title, index)).replace(/^\d+-/, '');
    targets.push({
      ...target,
      id,
      key: `${String(index + 1).padStart(3, '0')}-${keyTail || 'kohde'}`,
      assigneeUserIds: [...target.assigneeUserIds],
    });
    addedCount += 1;
  }

  return { targets, addedCount, duplicateCount, limitReached };
}

/** Täydentää puuttuvat kohdepäivät projektin aikataululla, jotta lisätty kohde on heti kelvollinen. */
export function fillMissingProjectWorkTargetDates(
  targets: ProjectWorkTargetDraft[],
  startDate: string,
  endDate: string,
): ProjectWorkTargetDraft[] {
  const fallbackStart = isIsoDate(startDate) ? startDate : '';
  const fallbackEnd = isIsoDate(endDate) ? endDate : fallbackStart;
  return targets.map((target) => {
    const nextStart = isIsoDate(target.startDate) ? target.startDate : fallbackStart;
    if (isIsoDate(target.endDate)) return { ...target, startDate: nextStart };
    const nextEnd = fallbackEnd && fallbackEnd >= nextStart ? fallbackEnd : nextStart;
    return { ...target, startDate: nextStart, endDate: nextEnd };
  });
}

export interface ProjectWorkTargetAdditionPreview {
  addedCount: number;
  duplicateCount: number;
  limitReached: boolean;
  added: ProjectWorkTargetDraft[];
}

/** Kertoo etukäteen, mitä valittu lisäystapa oikeasti tekisi nykyiselle kohdelistalle. */
export function previewProjectWorkTargetAddition(
  current: ProjectWorkTargetDraft[],
  incoming: ProjectWorkTargetDraft[],
  maxTargets = 100,
): ProjectWorkTargetAdditionPreview {
  const result = appendProjectWorkTargets(current, incoming, maxTargets);
  return {
    addedCount: result.addedCount,
    duplicateCount: result.duplicateCount,
    limitReached: result.limitReached,
    added: result.targets.slice(current.length),
  };
}

export function describeProjectWorkTargetAddition(preview: ProjectWorkTargetAdditionPreview): string {
  const parts: string[] = [];
  if (preview.addedCount === 0) parts.push('Ei uusia kohteita lisättäväksi.');
  else if (preview.addedCount === 1) parts.push('Lisätään 1 uusi kohde.');
  else parts.push(`Lisätään ${preview.addedCount} uutta kohdetta.`);
  if (preview.duplicateCount === 1) parts.push('1 kohde on jo listalla.');
  else if (preview.duplicateCount > 1) parts.push(`${preview.duplicateCount} kohdetta on jo listalla.`);
  if (preview.limitReached) parts.push('Kohdelistan 100 kohteen raja tulee vastaan.');
  return parts.join(' ');
}

export function moveProjectWorkTarget(
  targets: ProjectWorkTargetDraft[],
  targetIdValue: string,
  direction: -1 | 1,
): ProjectWorkTargetDraft[] {
  const index = targets.findIndex((target) => target.id === targetIdValue);
  const destination = index + direction;
  if (index < 0 || destination < 0 || destination >= targets.length) return targets;
  const reordered = [...targets];
  [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
  return reordered;
}

/**
 * Sarakkeet erotellaan sarkaimella (Excel-liitos), pystyviivalla tai puolipisteellä.
 * Rivikohtainen tunnistus estää sen, että sijainnin välimerkki katkaisisi rivin väärin.
 */
function splitTargetColumns(line: string): string[] {
  const separator = line.includes('\t') ? '\t' : line.includes('|') ? '|' : ';';
  return line.split(separator).map((part) => part.trim());
}

export function normalizeProjectWorkTargets(value: string): ProjectWorkTargetDraft[] {
  const seen = new Set<string>();
  const result: ProjectWorkTargetDraft[] = [];

  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const parts = splitTargetColumns(line);
    const title = parts[0] ?? '';
    const location = parts[1] || title;
    const description = parts[2] ?? '';
    const startDate = normalizeDateInput(parts[3] ?? '');
    const endDate = normalizeDateInput(parts[4] ?? '');
    if (!title) continue;

    const duplicateKey = normalizeProjectWorkTargetIdentity({ title, location });
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
  const firstStartDateValue = isIsoDate(values.firstStartDate ?? '') ? values.firstStartDate as string : '';
  const workdayDuration = Number.isFinite(values.workdayDuration)
    ? Math.max(1, Math.min(60, Math.floor(values.workdayDuration ?? 1)))
    : 1;
  const gapWorkdays = Number.isFinite(values.gapWorkdays)
    ? Math.max(0, Math.min(20, Math.floor(values.gapWorkdays ?? 0)))
    : 0;
  let nextStartDate = firstStartDateValue;

  return Array.from({ length: count }, (_, index) => {
    const number = String(start + index).padStart(padLength, '0');
    const title = `${prefix}${separator}${number}`.trim();
    const targetStartDate = nextStartDate ? firstAllowedWorkday(nextStartDate) : '';
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

/** Vanhan mallin yhteensopiva aikataulun jako. */
export function buildTargetPhaseSchedule(
  target: Pick<ProjectWorkTargetDraft, 'startDate' | 'endDate'>,
  phases: Array<Pick<ProjectWorkPhaseDraft, 'startDate' | 'endDate'>>,
): ProjectWorkPhaseSchedule[] {
  if (isIsoDate(target.startDate) && isIsoDate(target.endDate) && target.endDate >= target.startDate) {
    return spreadProjectPhaseDates(target.startDate, target.endDate, phases.length);
  }
  return phases.map((phase) => ({ startDate: phase.startDate, endDate: phase.endDate }));
}

export function synchronizeWorkAssignments(
  targets: ProjectWorkTargetDraft[],
  phases: ProjectWorkPhaseDraft[],
  current: ProjectWorkAssignmentDraft[] = [],
  enableNew = true,
): ProjectWorkAssignmentDraft[] {
  const existing = new Map(current.map((item) => [workAssignmentId(item.targetId, item.phaseId), item]));
  return targets.flatMap((target) => phases.map((phase) => {
    const id = workAssignmentId(target.id, phase.id);
    return existing.get(id) ?? {
      id,
      targetId: target.id,
      phaseId: phase.id,
      enabled: enableNew,
      startDate: '',
      endDate: '',
      assigneeUserIds: [],
      manualSchedule: false,
    };
  }));
}

export function setPhaseForAllTargets(
  assignments: ProjectWorkAssignmentDraft[],
  phaseIdValue: string,
  enabled: boolean,
): ProjectWorkAssignmentDraft[] {
  return assignments.map((item) => item.phaseId === phaseIdValue ? { ...item, enabled } : item);
}

export function setAllPhasesForTarget(
  assignments: ProjectWorkAssignmentDraft[],
  targetIdValue: string,
  enabled: boolean,
): ProjectWorkAssignmentDraft[] {
  return assignments.map((item) => item.targetId === targetIdValue ? { ...item, enabled } : item);
}

export function copyTargetPhaseSelection(
  assignments: ProjectWorkAssignmentDraft[],
  sourceTargetId: string,
  targetIds: string[],
): ProjectWorkAssignmentDraft[] {
  const source = new Map(
    assignments.filter((item) => item.targetId === sourceTargetId).map((item) => [item.phaseId, item.enabled]),
  );
  const selectedTargets = new Set(targetIds);
  return assignments.map((item) => selectedTargets.has(item.targetId)
    ? { ...item, enabled: source.get(item.phaseId) ?? false }
    : item);
}

export function scheduleTargetAssignments(
  target: ProjectWorkTargetDraft,
  phases: ProjectWorkPhaseDraft[],
  assignments: ProjectWorkAssignmentDraft[],
  options: { overwriteManual?: boolean } = {},
): ProjectWorkAssignmentDraft[] {
  let cursor = firstAllowedWorkday(target.startDate);
  const phaseIndex = new Map(phases.map((phase, index) => [phase.id, index]));
  const targetItems = assignments
    .filter((item) => item.targetId === target.id && item.enabled)
    .sort((a, b) => (phaseIndex.get(a.phaseId) ?? 0) - (phaseIndex.get(b.phaseId) ?? 0));
  const scheduled = new Map<string, ProjectWorkAssignmentDraft>();

  for (const item of targetItems) {
    const phase = phases.find((candidate) => candidate.id === item.phaseId);
    if (!phase) continue;
    if (item.manualSchedule && !options.overwriteManual && isIsoDate(item.startDate) && isIsoDate(item.endDate)) {
      scheduled.set(item.id, item);
      cursor = addWorkdays(item.endDate, 1, phase.weekdays);
      continue;
    }
    const startDate = firstAllowedWorkday(cursor || target.startDate, phase.weekdays);
    const endDate = startDate
      ? addWorkdays(startDate, defaultPhaseDuration(phase) - 1, phase.weekdays)
      : '';
    scheduled.set(item.id, {
      ...item,
      startDate,
      endDate,
      manualSchedule: false,
    });
    cursor = endDate ? addWorkdays(endDate, 1, phase.weekdays) : '';
  }

  return assignments.map((item) => scheduled.get(item.id) ?? item);
}

export function scheduleAllAssignments(
  targets: ProjectWorkTargetDraft[],
  phases: ProjectWorkPhaseDraft[],
  assignments: ProjectWorkAssignmentDraft[],
  options: { overwriteManual?: boolean } = {},
): ProjectWorkAssignmentDraft[] {
  return targets.reduce(
    (current, target) => scheduleTargetAssignments(target, phases, current, options),
    assignments,
  );
}

export function selectedWorkAssignments(assignments: ProjectWorkAssignmentDraft[]): ProjectWorkAssignmentDraft[] {
  return assignments.filter((item) => item.enabled);
}

export function buildScheduleWarnings(
  targets: ProjectWorkTargetDraft[],
  phases: ProjectWorkPhaseDraft[],
  assignments: ProjectWorkAssignmentDraft[],
): WorkPlanScheduleWarning[] {
  const warnings: WorkPlanScheduleWarning[] = [];
  for (const target of targets) {
    const selected = assignments.filter((item) => item.targetId === target.id && item.enabled);
    if (selected.length === 0) {
      warnings.push({ targetId: target.id, targetTitle: target.title, message: 'Kohteelle ei ole valittu työvaiheita.' });
      continue;
    }
    const missingSchedule = selected.some((item) => !isIsoDate(item.startDate) || !isIsoDate(item.endDate));
    if (missingSchedule) {
      warnings.push({ targetId: target.id, targetTitle: target.title, message: 'Kaikilla valituilla työvaiheilla ei ole aikataulua.' });
      continue;
    }
    const latestEnd = selected.reduce((latest, item) => item.endDate > latest ? item.endDate : latest, '');
    if (isIsoDate(target.endDate) && latestEnd > target.endDate) {
      warnings.push({
        targetId: target.id,
        targetTitle: target.title,
        message: `Työvaiheet valmistuvat ${latestEnd}, joka ylittää kohteen tavoitepäivän ${target.endDate}.`,
      });
    }
    const ordered = [...selected].sort((a, b) => {
      const aIndex = phases.findIndex((phase) => phase.id === a.phaseId);
      const bIndex = phases.findIndex((phase) => phase.id === b.phaseId);
      return aIndex - bIndex;
    });
    for (let index = 1; index < ordered.length; index += 1) {
      if (ordered[index].startDate <= ordered[index - 1].endDate) {
        warnings.push({
          targetId: target.id,
          targetTitle: target.title,
          message: 'Peräkkäiset työvaiheet menevät ajallisesti päällekkäin.',
        });
        break;
      }
    }
  }
  return warnings;
}

export function buildInternalResourceConflicts(
  targets: ProjectWorkTargetDraft[],
  phases: ProjectWorkPhaseDraft[],
  assignments: ProjectWorkAssignmentDraft[],
): WorkPlanInternalConflict[] {
  const targetMap = new Map(targets.map((target) => [target.id, target]));
  const phaseMap = new Map(phases.map((phase) => [phase.id, phase]));
  const occupied = new Map<string, string>();
  const conflicts: WorkPlanInternalConflict[] = [];

  for (const item of assignments.filter((candidate) => candidate.enabled)) {
    const target = targetMap.get(item.targetId);
    const phase = phaseMap.get(item.phaseId);
    if (!target || !phase) continue;
    const users = resolveWorkItemAssignees(item, target, phase);
    for (const date of workdayDates(item.startDate, item.endDate, phase.weekdays)) {
      for (const userId of users) {
        const key = `${userId}:${date}`;
        const previous = occupied.get(key);
        if (previous && previous !== item.id) {
          conflicts.push({
            userId,
            date,
            firstAssignmentId: previous,
            secondAssignmentId: item.id,
          });
        } else {
          occupied.set(key, item.id);
        }
      }
    }
  }
  return conflicts;
}

export function createGenericProjectPhases(values: {
  startDate: string;
  endDate: string;
}): ProjectWorkPhaseDraft[] {
  const definitions = [
    {
      key: 'valmistelu',
      title: 'Aloitus, suojaus ja valmistelu',
      type: 'Valmistelu',
      description: 'Varmista lähtötiedot, kulkureitit, suojaukset, materiaalit ja työn turvallinen aloitus.',
      durationWorkdays: 1,
    },
    {
      key: 'purku-pohjatyot',
      title: 'Purku tai pohjatyöt',
      type: 'Pohjatyö',
      description: 'Tee kohteen edellyttämät purku-, avaus-, mittaus- ja pohjatyöt ennen varsinaista toteutusta.',
      durationWorkdays: 2,
    },
    {
      key: 'toteutus-asennus',
      title: 'Varsinainen toteutus tai asennus',
      type: 'Toteutus',
      description: 'Toteuta kohteen varsinainen rakennus-, asennus- tai korjaustyö suunnitelmien mukaisesti.',
      durationWorkdays: 4,
    },
    {
      key: 'viimeistely',
      title: 'Viimeistely ja toimintakokeet',
      type: 'Viimeistely',
      description: 'Tee liittymät, säädöt, puhdistus, toimintakokeet ja muut viimeistelytyöt.',
      durationWorkdays: 1,
    },
    {
      key: 'luovutus',
      title: 'Tarkastus, dokumentointi ja luovutus',
      type: 'Luovutus',
      description: 'Tarkasta laatu, käsittele puutteet, lisää dokumentit ja varmista luovutusvalmius.',
      durationWorkdays: 1,
    },
  ];
  const ranges = spreadProjectPhaseDates(values.startDate, values.endDate, definitions.length);

  return definitions.map((definition, index) => ({
    id: `phase-${definition.key}`,
    ...definition,
    startDate: ranges[index]?.startDate ?? '',
    endDate: ranges[index]?.endDate ?? '',
    startTime: '07:00',
    endTime: '15:30',
    weekdays: [1, 2, 3, 4, 5],
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
