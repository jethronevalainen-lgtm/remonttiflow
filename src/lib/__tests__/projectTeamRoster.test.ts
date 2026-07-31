import { describe, expect, it } from 'vitest';

import {
  buildProjectTeamCandidates,
  displayNamesForProjectTeam,
  partitionTeamSelection,
  selectedKeysForProject,
} from '@/lib/projectTeamRoster';
import type { Employee } from '@/types';
import type { OrganizationPerson } from '@/lib/supabase/workManagement';

const employees: Employee[] = [
  {
    id: 'e1',
    name: 'Timo Timpuri',
    role: 'Kalusteasentaja',
    department: 'Korjaus',
    phone: '',
    email: 'timo@example.com',
    startDate: '2026-01-01',
    status: 'Aktiivinen',
    projects: 0,
    hours: 0,
    training: 0,
    certifications: [],
  },
  {
    id: 'e2',
    userId: 'u2',
    name: 'Aino Asentaja',
    role: 'Asentaja',
    department: 'Tuotanto',
    phone: '',
    email: 'aino@example.com',
    startDate: '2026-01-01',
    status: 'Aktiivinen',
    projects: 0,
    hours: 0,
    training: 0,
    certifications: [],
  },
];

const people: OrganizationPerson[] = [
  {
    userId: 'u-admin',
    name: 'Jethro Nevalainen',
    email: 'admin@example.com',
    role: 'admin',
  },
  {
    userId: 'u2',
    name: 'Aino Asentaja',
    email: 'aino@example.com',
    role: 'worker',
  },
];

describe('projectTeamRoster', () => {
  it('lists employees and login-only users without cards', () => {
    const candidates = buildProjectTeamCandidates(employees, people);
    expect(candidates.map((item) => item.key).sort()).toEqual([
      'employee:e1',
      'employee:e2',
      'user:u-admin',
    ].sort());
    expect(candidates.find((item) => item.key === 'employee:e1')?.hasLogin).toBe(false);
    expect(candidates.find((item) => item.key === 'user:u-admin')?.hasLogin).toBe(true);
  });

  it('partitions selection into employee and extra user ids', () => {
    const candidates = buildProjectTeamCandidates(employees, people);
    expect(partitionTeamSelection(['employee:e1', 'user:u-admin'], candidates)).toEqual({
      employeeIds: ['e1'],
      extraUserIds: ['u-admin'],
    });
  });

  it('restores selected keys from roster and orphan memberships', () => {
    const candidates = buildProjectTeamCandidates(employees, people);
    expect(selectedKeysForProject({
      projectId: 'p1',
      teamMemberships: [{ projectId: 'p1', employeeId: 'e1' }],
      projectMemberships: [
        { projectId: 'p1', userId: 'u-admin' },
        { projectId: 'p1', userId: 'u2' },
      ],
      candidates,
    }).sort()).toEqual(['employee:e1', 'user:u-admin'].sort());
  });

  it('prefers employee roster names when displaying the team', () => {
    expect(displayNamesForProjectTeam({
      projectId: 'p1',
      teamMemberships: [{ projectId: 'p1', employeeId: 'e1' }],
      projectMemberships: [{ projectId: 'p1', userId: 'u-admin' }],
      employees,
      people,
    })).toEqual(['Timo Timpuri', 'Jethro Nevalainen']);
  });
});
