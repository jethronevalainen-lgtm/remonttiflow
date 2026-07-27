import { describe, expect, it } from 'vitest';

import { restrictEmployeeCardsForPreview } from '@/lib/workforcePreview';
import type { EmployeeCard, SupervisorTeamMember } from '@/lib/supabase/workforceHr';

const cards: EmployeeCard[] = [
  {
    employeeId: 'employee-worker',
    userId: 'user-worker',
    employeeName: 'Jeti Nevalainen',
    employeeRole: 'Asentaja',
    department: 'Tuotanto',
    email: 'worker@example.com',
    phone: '',
    employeeStatus: 'Aktiivinen',
    supervisorNames: ['Matti Korhonen'],
  },
  {
    employeeId: 'employee-other',
    userId: 'user-other',
    employeeName: 'Anna Lahtinen',
    employeeRole: 'LVI-asentaja',
    department: 'LVI',
    email: 'anna@example.com',
    phone: '',
    employeeStatus: 'Aktiivinen',
    supervisorNames: [],
  },
  {
    employeeId: 'employee-supervisor',
    userId: 'user-supervisor',
    employeeName: 'Matti Korhonen',
    employeeRole: 'Työnjohtaja',
    department: 'Tuotanto',
    email: 'supervisor@example.com',
    phone: '',
    employeeStatus: 'Aktiivinen',
    supervisorNames: [],
  },
];

const assignments: SupervisorTeamMember[] = [
  { supervisorUserId: 'user-supervisor', employeeId: 'employee-worker' },
];

describe('employee-card preview isolation', () => {
  it('shows a worker only their own employee card', () => {
    expect(restrictEmployeeCardsForPreview(cards, assignments, 'worker', 'user-worker'))
      .toEqual([cards[0]]);
  });

  it('shows a supervisor only their own card and assigned team members', () => {
    expect(restrictEmployeeCardsForPreview(cards, assignments, 'supervisor', 'user-supervisor'))
      .toEqual([cards[0], cards[2]]);
  });

  it('does not expose employee cards to a customer preview or an unknown identity', () => {
    expect(restrictEmployeeCardsForPreview(cards, assignments, 'customer', 'customer-user')).toEqual([]);
    expect(restrictEmployeeCardsForPreview(cards, assignments, 'worker', null)).toEqual([]);
  });

  it('keeps full visibility only for an administrator preview', () => {
    expect(restrictEmployeeCardsForPreview(cards, assignments, 'admin', 'admin-user')).toEqual(cards);
  });
});
