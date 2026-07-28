import type { EmployeeSupervisorAssignment } from '@/lib/supabase/employeeSupervisors';

export type CalendarTeamScope = 'all' | 'my_team' | `supervisor:${string}`;

export interface CalendarTeamPerson {
  userId?: string;
  name: string;
}

export interface EmployeeUserLink {
  employeeId: string;
  userId?: string;
}

/**
 * Builds the set of calendar user IDs that belong to a supervisor's HR team.
 * Team membership is stored by employee_id; calendar rows are keyed by user_id.
 */
export function buildSupervisorTeamUserIds(
  assignments: EmployeeSupervisorAssignment[],
  employees: EmployeeUserLink[],
  supervisorUserId: string,
): Set<string> {
  const employeeToUser = new Map(
    employees
      .filter((employee) => employee.userId)
      .map((employee) => [employee.employeeId, employee.userId as string]),
  );

  const userIds = new Set<string>([supervisorUserId]);
  for (const assignment of assignments) {
    if (assignment.supervisorUserId !== supervisorUserId) continue;
    const userId = employeeToUser.get(assignment.employeeId);
    if (userId) userIds.add(userId);
  }
  return userIds;
}

export function resolveTeamScopeUserIds(options: {
  scope: CalendarTeamScope;
  currentUserId: string | null;
  assignments: EmployeeSupervisorAssignment[];
  employees: EmployeeUserLink[];
}): Set<string> | null {
  const { scope, currentUserId, assignments, employees } = options;
  if (scope === 'all') return null;

  if (scope === 'my_team') {
    if (!currentUserId) return new Set();
    return buildSupervisorTeamUserIds(assignments, employees, currentUserId);
  }

  if (scope.startsWith('supervisor:')) {
    const supervisorUserId = scope.slice('supervisor:'.length);
    if (!supervisorUserId) return new Set();
    return buildSupervisorTeamUserIds(assignments, employees, supervisorUserId);
  }

  return null;
}

export function filterCalendarPeopleByTeam<T extends CalendarTeamPerson>(
  people: T[],
  allowedUserIds: Set<string> | null,
): T[] {
  if (!allowedUserIds) return people;
  return people.filter((person) => person.userId && allowedUserIds.has(person.userId));
}

export function parseCalendarTeamScope(value: string): CalendarTeamScope {
  if (value === 'all' || value === 'my_team') return value;
  if (value.startsWith('supervisor:') && value.length > 'supervisor:'.length) {
    return value as CalendarTeamScope;
  }
  return 'all';
}
