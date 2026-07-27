export interface ProjectWorkDraft {
  id: string;
  title: string;
  location: string;
  assigneeUserId: string;
}

export interface GenerateProjectWorkLabelsInput {
  prefix: string;
  start: number;
  count: number;
  padLength?: number;
}

export function normalizeProjectWorkLines(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const key = line.toLocaleLowerCase('fi');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(line);
    if (result.length === 100) break;
  }

  return result;
}

export function generateProjectWorkLabels({
  prefix,
  start,
  count,
  padLength = 0,
}: GenerateProjectWorkLabelsInput): string[] {
  const normalizedPrefix = prefix.trim();
  const normalizedStart = Number.isFinite(start) ? Math.max(0, Math.floor(start)) : 1;
  const normalizedCount = Number.isFinite(count) ? Math.min(100, Math.max(1, Math.floor(count))) : 1;
  const normalizedPadLength = Number.isFinite(padLength) ? Math.min(6, Math.max(0, Math.floor(padLength))) : 0;

  return Array.from({ length: normalizedCount }, (_, index) => {
    const number = String(normalizedStart + index).padStart(normalizedPadLength, '0');
    return `${normalizedPrefix}${number}`;
  });
}

export function createProjectWorkDrafts(
  labels: string[],
  titlePrefix: string,
  defaultAssigneeUserId: string,
): ProjectWorkDraft[] {
  const prefix = titlePrefix.trim();
  return labels.slice(0, 100).map((label, index) => ({
    id: `draft-${index}-${label.toLocaleLowerCase('fi').replace(/[^a-z0-9åäö]+/gi, '-')}`,
    title: prefix ? `${prefix} ${label}` : label,
    location: label,
    assigneeUserId: defaultAssigneeUserId,
  }));
}
