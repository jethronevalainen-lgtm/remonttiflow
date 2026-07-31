import type { Employee } from '@/types';
import type { OrganizationPerson } from '@/lib/supabase/workManagement';

export interface ProjectTeamCandidate {
  key: string;
  employeeId?: string;
  userId?: string;
  name: string;
  detail: string;
  hasLogin: boolean;
}

export interface ProjectTeamMembership {
  projectId: string;
  employeeId: string;
}

export function buildProjectTeamCandidates(
  employees: Employee[],
  people: OrganizationPerson[],
): ProjectTeamCandidate[] {
  const activeEmployees = employees.filter((employee) => !employee.archivedAt);
  const linkedUserIds = new Set(
    activeEmployees.map((employee) => employee.userId).filter(Boolean) as string[],
  );

  const fromEmployees = activeEmployees.map((employee): ProjectTeamCandidate => ({
    key: `employee:${employee.id}`,
    employeeId: employee.id,
    userId: employee.userId,
    name: employee.name,
    detail: [employee.role, employee.department].filter(Boolean).join(' · '),
    hasLogin: Boolean(employee.userId),
  }));

  const fromLoginOnly = people
    .filter((person) => !linkedUserIds.has(person.userId))
    .map((person): ProjectTeamCandidate => ({
      key: `user:${person.userId}`,
      userId: person.userId,
      name: person.name,
      detail: person.role,
      hasLogin: true,
    }));

  return [...fromEmployees, ...fromLoginOnly].sort((a, b) => a.name.localeCompare(b.name, 'fi'));
}

export function selectedKeysForProject(values: {
  projectId: string;
  teamMemberships: ProjectTeamMembership[];
  projectMemberships: Array<{ projectId: string; userId: string }>;
  candidates: ProjectTeamCandidate[];
}): string[] {
  const employeeKeys = values.teamMemberships
    .filter((item) => item.projectId === values.projectId)
    .map((item) => `employee:${item.employeeId}`);

  const selectedEmployeeUserIds = new Set(
    values.candidates
      .filter((candidate) => candidate.employeeId && employeeKeys.includes(candidate.key) && candidate.userId)
      .map((candidate) => candidate.userId as string),
  );

  const loginOnlyKeys = values.projectMemberships
    .filter((item) => item.projectId === values.projectId)
    .filter((item) => !selectedEmployeeUserIds.has(item.userId))
    .map((item) => `user:${item.userId}`)
    .filter((key) => values.candidates.some((candidate) => candidate.key === key));

  return [...new Set([...employeeKeys, ...loginOnlyKeys])];
}

export function partitionTeamSelection(
  selectedKeys: string[],
  candidates: ProjectTeamCandidate[],
): { employeeIds: string[]; extraUserIds: string[] } {
  const byKey = new Map(candidates.map((candidate) => [candidate.key, candidate]));
  const employeeIds: string[] = [];
  const extraUserIds: string[] = [];

  selectedKeys.forEach((key) => {
    const candidate = byKey.get(key);
    if (!candidate) return;
    if (candidate.employeeId) employeeIds.push(candidate.employeeId);
    else if (candidate.userId) extraUserIds.push(candidate.userId);
  });

  return {
    employeeIds: [...new Set(employeeIds)],
    extraUserIds: [...new Set(extraUserIds)],
  };
}

export function displayNamesForProjectTeam(values: {
  projectId: string;
  teamMemberships: ProjectTeamMembership[];
  projectMemberships: Array<{ projectId: string; userId: string }>;
  employees: Employee[];
  people: OrganizationPerson[];
}): string[] {
  const employeeById = new Map(values.employees.map((employee) => [employee.id, employee]));
  const personById = new Map(values.people.map((person) => [person.userId, person]));
  const names: string[] = [];

  values.teamMemberships
    .filter((item) => item.projectId === values.projectId)
    .forEach((item) => {
      const employee = employeeById.get(item.employeeId);
      if (employee?.name) names.push(employee.name);
    });

  const rosterUserIds = new Set(
    values.teamMemberships
      .filter((item) => item.projectId === values.projectId)
      .map((item) => employeeById.get(item.employeeId)?.userId)
      .filter(Boolean) as string[],
  );

  values.projectMemberships
    .filter((item) => item.projectId === values.projectId && !rosterUserIds.has(item.userId))
    .forEach((item) => {
      const person = personById.get(item.userId);
      if (person?.name) names.push(person.name);
    });

  return [...new Set(names)];
}
