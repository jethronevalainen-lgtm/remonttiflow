import type { TimeWorkspaceEntry } from '@/lib/supabase/timeWorkspace';

export interface TimeDaySummary {
  key: string;
  userId: string;
  employeeName: string;
  date: string;
  entries: TimeWorkspaceEntry[];
  totalHours: number;
  overtimeHours: number;
  breakMinutes: number;
  status: TimeWorkspaceEntry['status'];
  locked: boolean;
  startTime: string;
  endTime: string;
  projectNames: string[];
  hasCorrectionReason: boolean;
}

export interface ProjectTimeSummary {
  projectId: string;
  projectName: string;
  totalHours: number;
  overtimeHours: number;
  pendingHours: number;
  employeeCount: number;
  entryCount: number;
}

const STATUS_WEIGHT: Record<TimeWorkspaceEntry['status'], number> = {
  Hylätty: 3,
  Odottaa: 2,
  Hyväksytty: 1,
};

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function groupTimeEntriesByDay(entries: TimeWorkspaceEntry[]): TimeDaySummary[] {
  const groups = new Map<string, TimeWorkspaceEntry[]>();
  entries.forEach((entry) => {
    const key = `${entry.userId || entry.employeeName}::${entry.date}`;
    const current = groups.get(key) ?? [];
    current.push(entry);
    groups.set(key, current);
  });

  return [...groups.entries()].map(([key, items]) => {
    const ordered = [...items].sort((left, right) => {
      const leftValue = left.startTime || left.createdAt;
      const rightValue = right.startTime || right.createdAt;
      return leftValue.localeCompare(rightValue);
    });
    const status = ordered.reduce<TimeWorkspaceEntry['status']>((current, item) => (
      STATUS_WEIGHT[item.status] > STATUS_WEIGHT[current] ? item.status : current
    ), 'Hyväksytty');
    return {
      key,
      userId: ordered[0]?.userId ?? '',
      employeeName: ordered[0]?.employeeName ?? 'Työntekijä',
      date: ordered[0]?.date ?? '',
      entries: ordered,
      totalHours: round(ordered.reduce((sum, item) => sum + item.hours, 0)),
      overtimeHours: round(ordered.reduce((sum, item) => sum + item.overtime, 0)),
      breakMinutes: ordered.reduce((sum, item) => sum + item.breakMinutes, 0),
      status,
      locked: ordered.some((item) => Boolean(item.lockedAt)),
      startTime: ordered.find((item) => item.startTime)?.startTime ?? '',
      endTime: [...ordered].reverse().find((item) => item.endTime)?.endTime ?? '',
      projectNames: [...new Set(ordered.map((item) => item.projectName).filter(Boolean))],
      hasCorrectionReason: ordered.some((item) => Boolean(item.rejectionReason)),
    };
  }).sort((left, right) => right.date.localeCompare(left.date) || left.employeeName.localeCompare(right.employeeName, 'fi'));
}

export function summarizeEntriesByProject(entries: TimeWorkspaceEntry[]): ProjectTimeSummary[] {
  const projects = new Map<string, TimeWorkspaceEntry[]>();
  entries.forEach((entry) => {
    const key = entry.projectId || entry.projectName;
    const current = projects.get(key) ?? [];
    current.push(entry);
    projects.set(key, current);
  });

  return [...projects.entries()].map(([projectId, items]) => ({
    projectId,
    projectName: items[0]?.projectName ?? 'Muu työ',
    totalHours: round(items.reduce((sum, item) => sum + item.hours, 0)),
    overtimeHours: round(items.reduce((sum, item) => sum + item.overtime, 0)),
    pendingHours: round(items.filter((item) => item.status === 'Odottaa').reduce((sum, item) => sum + item.hours, 0)),
    employeeCount: new Set(items.map((item) => item.userId || item.employeeName)).size,
    entryCount: items.length,
  })).sort((left, right) => right.totalHours - left.totalHours || left.projectName.localeCompare(right.projectName, 'fi'));
}

export function formatWorkDuration(startedAt: string, now = Date.now()): string {
  const started = new Date(startedAt).getTime();
  if (!Number.isFinite(started)) return '00:00:00';
  const total = Math.max(0, Math.floor((now - started) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}
