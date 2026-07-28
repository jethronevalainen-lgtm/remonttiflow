import { describe, expect, it } from 'vitest';

import {
  buildSupervisorTeamUserIds,
  filterCalendarPeopleByTeam,
  parseCalendarTeamScope,
  resolveTeamScopeUserIds,
} from '@/lib/calendarTeamFilter';

const assignments = [
  { employeeId: 'emp-a', supervisorUserId: 'sup-1' },
  { employeeId: 'emp-b', supervisorUserId: 'sup-1' },
  { employeeId: 'emp-c', supervisorUserId: 'sup-2' },
];

const employees = [
  { employeeId: 'emp-a', userId: 'user-a' },
  { employeeId: 'emp-b', userId: 'user-b' },
  { employeeId: 'emp-c', userId: 'user-c' },
  { employeeId: 'emp-orphan' },
];

describe('calendarTeamFilter', () => {
  it('maps a supervisor team to calendar user ids including the supervisor', () => {
    expect([...buildSupervisorTeamUserIds(assignments, employees, 'sup-1')].sort()).toEqual([
      'sup-1',
      'user-a',
      'user-b',
    ]);
  });

  it('returns null for all-scope so callers keep every row', () => {
    expect(resolveTeamScopeUserIds({
      scope: 'all',
      currentUserId: 'sup-1',
      assignments,
      employees,
    })).toBeNull();
  });

  it('resolves my_team from the current user', () => {
    const ids = resolveTeamScopeUserIds({
      scope: 'my_team',
      currentUserId: 'sup-2',
      assignments,
      employees,
    });
    expect([...ids!].sort()).toEqual(['sup-2', 'user-c']);
  });

  it('filters people by allowed user ids and drops legacy nameless rows', () => {
    const people = [
      { userId: 'user-a', name: 'A' },
      { userId: 'user-c', name: 'C' },
      { name: 'Legacy' },
    ];
    expect(filterCalendarPeopleByTeam(people, new Set(['user-a']))).toEqual([
      { userId: 'user-a', name: 'A' },
    ]);
  });

  it('parses team scope values safely', () => {
    expect(parseCalendarTeamScope('my_team')).toBe('my_team');
    expect(parseCalendarTeamScope('supervisor:abc')).toBe('supervisor:abc');
    expect(parseCalendarTeamScope('nope')).toBe('all');
  });
});
