import type { WorkOrderPriority } from '@/types';
import type { ProjectBuilding, ProjectStairwell, ProjectUnit } from '@/lib/supabase/inspectionTypes';

export interface ProjectWorkTargetDraft {
  id: string;
  key: string;
  title: string;
  location: string;
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

export interface ProjectWorkTargetMergeResult {
  targets: ProjectWorkTargetDraft[];
  added: number;
  skippedDuplicates: number;
  skippedLimit: number;
}

export interface ProjectWorkTargetTemplate {
  id: string;
  label: string;
  description: string;
  sequencePrefix: string;
  sequenceStart: number;
  sequenceCount: number;
  padLength?: number;
}

export const PROJECT_WORK_TARGET_TEMPLATES: ProjectWorkTargetTemplate[] = [
  {
    id: 'apartments',
    label: 'Huoneistot',
    description: 'Asunto 1, Asunto 2, …',
    sequencePrefix: 'Asunto ',
    sequenceStart: 1,
    sequenceCount: 12,
  },
  {
    id: 'facade-blocks',
    label: 'Julkisivulohkot',
    description: 'Lohko 1, Lohko 2, …',
    sequencePrefix: 'Lohko ',
    sequenceStart: 1,
    sequenceCount: 8,
  },
  {
    id: 'floors',
    label: 'Kerrokset',
    description: 'Kerros 1, Kerros 2, …',
    sequencePrefix: 'Kerros ',
    sequenceStart: 1,
    sequenceCount: 6,
  },
  {
    id: 'stairwells',
    label: 'Raput',
    description: 'Rappu A, Rappu B, …',
    sequencePrefix: 'Rappu ',
    sequenceStart: 1,
    sequenceCount: 4,
  },
];

const TARGET_LIMIT = 100;

function normalizedKey(value: string, index: number): string {
  const slug = value
    .trim()
    .toLocaleLowerCase('fi')
    .replace(/[^a-z0-9åäö]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return `${String(index + 1).padStart(3, '0')}-${slug || 'kohde'}`;
}

function duplicateKey(title: string, location: string): string {
  return `${title}|${location}`.toLocaleLowerCase('fi');
}

function makeTarget(title: string, location: string, index: number): ProjectWorkTargetDraft {
  const safeTitle = title.trim();
  const safeLocation = location.trim() || safeTitle;
  return {
    id: `target-${index}-${normalizedKey(safeTitle, index)}-${Math.random().toString(36).slice(2, 8)}`,
    key: normalizedKey(safeTitle, index),
    title: safeTitle,
    location: safeLocation,
  };
}

export function createEmptyProjectWorkTarget(index = 0): ProjectWorkTargetDraft {
  return makeTarget('', '', index);
}

export function rekeyProjectWorkTargets(targets: ProjectWorkTargetDraft[]): ProjectWorkTargetDraft[] {
  return targets.map((target, index) => ({
    ...target,
    key: normalizedKey(target.title || `kohde-${index + 1}`, index),
  }));
}

export function mergeProjectWorkTargets(
  existing: ProjectWorkTargetDraft[],
  incoming: ProjectWorkTargetDraft[],
  limit = TARGET_LIMIT,
): ProjectWorkTargetMergeResult {
  const result = [...existing];
  const seen = new Set(result.map((target) => duplicateKey(target.title, target.location)));
  let skippedDuplicates = 0;
  let skippedLimit = 0;

  for (const item of incoming) {
    const title = item.title.trim();
    if (!title) continue;
    const location = item.location.trim() || title;
    const key = duplicateKey(title, location);
    if (seen.has(key)) {
      skippedDuplicates += 1;
      continue;
    }
    if (result.length >= limit) {
      skippedLimit += 1;
      continue;
    }
    seen.add(key);
    const index = result.length;
    result.push({
      id: item.id || makeTarget(title, location, index).id,
      key: normalizedKey(title, index),
      title,
      location,
    });
  }

  return {
    targets: result,
    added: result.length - existing.length,
    skippedDuplicates,
    skippedLimit,
  };
}

export function normalizeProjectWorkTargets(value: string): ProjectWorkTargetDraft[] {
  const seen = new Set<string>();
  const result: ProjectWorkTargetDraft[] = [];

  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const [rawTitle, ...rawLocationParts] = line.split('|');
    const title = rawTitle.trim();
    const location = rawLocationParts.join('|').trim() || title;
    if (!title) continue;

    const key = duplicateKey(title, location);
    if (seen.has(key)) continue;
    seen.add(key);

    const index = result.length;
    result.push(makeTarget(title, location, index));
    if (result.length === TARGET_LIMIT) break;
  }

  return result;
}

function detectCsvDelimiter(line: string): ',' | ';' | '\t' | '|' {
  const counts: Array<{ delimiter: ',' | ';' | '\t' | '|'; count: number }> = [
    { delimiter: ';', count: (line.match(/;/g) ?? []).length },
    { delimiter: ',', count: (line.match(/,/g) ?? []).length },
    { delimiter: '\t', count: (line.match(/\t/g) ?? []).length },
    { delimiter: '|', count: (line.match(/\|/g) ?? []).length },
  ];
  counts.sort((a, b) => b.count - a.count);
  return counts[0].count > 0 ? counts[0].delimiter : ';';
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function isCsvHeaderRow(cells: string[]): boolean {
  const joined = cells.join(' ').toLocaleLowerCase('fi');
  return /^(nimi|kohde|title|name|huoneisto|asunto)\b/.test(cells[0]?.toLocaleLowerCase('fi') ?? '')
    || joined.includes('sijainti')
    || joined.includes('location');
}

/** Parses pasted CSV/TSV or Excel-exported text (`nimi;sijainti` or comma). Also accepts `nimi | sijainti`. */
export function parseProjectWorkTargetsCsv(value: string): ProjectWorkTargetDraft[] {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // Prefer pipe-list format when every data line looks like the existing paste format.
  const pipeHeavy = lines.every((line) => !/[;,\t]/.test(line) || line.includes('|'));
  if (pipeHeavy && lines.some((line) => line.includes('|'))) {
    return normalizeProjectWorkTargets(value);
  }

  const delimiter = detectCsvDelimiter(lines[0]);
  let startIndex = 0;
  const firstCells = splitCsvLine(lines[0], delimiter);
  if (isCsvHeaderRow(firstCells)) startIndex = 1;

  const seen = new Set<string>();
  const result: ProjectWorkTargetDraft[] = [];

  for (let lineIndex = startIndex; lineIndex < lines.length; lineIndex += 1) {
    const cells = splitCsvLine(lines[lineIndex], delimiter);
    const title = (cells[0] ?? '').trim();
    if (!title) continue;
    const location = (cells[1] ?? '').trim() || title;
    const key = duplicateKey(title, location);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(makeTarget(title, location, result.length));
    if (result.length === TARGET_LIMIT) break;
  }

  return result;
}

export function generateProjectWorkTargets(values: {
  prefix: string;
  start: number;
  count: number;
  padLength?: number;
}): ProjectWorkTargetDraft[] {
  const prefix = values.prefix.trim();
  const separator = prefix && /[a-z0-9åäö]$/i.test(prefix) ? ' ' : '';
  const start = Number.isFinite(values.start) ? Math.max(0, Math.floor(values.start)) : 1;
  const count = Number.isFinite(values.count) ? Math.min(TARGET_LIMIT, Math.max(1, Math.floor(values.count))) : 1;
  const padLength = Number.isFinite(values.padLength)
    ? Math.min(6, Math.max(0, Math.floor(values.padLength ?? 0)))
    : 0;

  return Array.from({ length: count }, (_, index) => {
    const number = String(start + index).padStart(padLength, '0');
    const title = `${prefix}${separator}${number}`.trim();
    return makeTarget(title, title, index);
  });
}

function unitLocationLabel(
  unit: ProjectUnit,
  buildingsById: Map<string, ProjectBuilding>,
  stairwellsById: Map<string, ProjectStairwell>,
): string {
  const parts: string[] = [];
  if (unit.buildingId) {
    const building = buildingsById.get(unit.buildingId);
    if (building?.name) parts.push(building.name);
  }
  if (unit.stairwellId) {
    const stairwell = stairwellsById.get(unit.stairwellId);
    if (stairwell?.name) parts.push(stairwell.name);
  }
  const floor = unit.floor.trim();
  if (floor) {
    parts.push(/kerros/i.test(floor) ? floor : `${floor}. kerros`);
  }
  return parts.join(' · ') || unit.unitCode;
}

export function projectUnitsToWorkTargets(
  units: ProjectUnit[],
  buildings: ProjectBuilding[] = [],
  stairwells: ProjectStairwell[] = [],
): ProjectWorkTargetDraft[] {
  const buildingsById = new Map(buildings.map((building) => [building.id, building]));
  const stairwellsById = new Map(stairwells.map((stairwell) => [stairwell.id, stairwell]));
  const seen = new Set<string>();
  const result: ProjectWorkTargetDraft[] = [];

  for (const unit of units) {
    const title = unit.unitCode.trim();
    if (!title) continue;
    const location = unitLocationLabel(unit, buildingsById, stairwellsById);
    const key = duplicateKey(title, location);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(makeTarget(title, location, result.length));
    if (result.length === TARGET_LIMIT) break;
  }

  return result;
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
