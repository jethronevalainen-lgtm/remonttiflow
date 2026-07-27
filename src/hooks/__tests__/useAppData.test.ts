import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  generateId,
  useAppData,
  type CrmLead,
  type Customer,
  type Project,
  type SafetyItem,
  type TimeEntry,
  type WorkOrder,
} from '../useAppData';

beforeEach(() => {
  window.localStorage.clear();
});

const newProjectInput = {
  name: 'Testiprojekti',
  customer: 'Testi Oy',
  status: 'Aktiivinen',
  startDate: '2026-08-01',
  endDate: '2026-12-31',
  progress: 0,
  budget: 100000,
  spent: 0,
} as const;

const newWorkOrderInput = {
  title: 'Testityömääräys',
  project: 'Testiprojekti',
  assignee: 'Testaaja',
  dueDate: '2026-08-15',
  priority: 'Normaali',
  status: 'Avoin',
} as const;

const newCustomerInput = {
  name: 'Testiasiakas Oy',
  type: 'Yritys',
  contactPerson: 'Testi Henkilö',
  phone: '040-1234567',
  email: 'testi@example.com',
  address: 'Testikatu 1, 00100 Helsinki',
  projectCount: 0,
  lastContact: '2026-08-01',
  status: 'Aktiivinen',
} as const;

const newLeadInput = {
  name: 'Testiliidi',
  company: 'Liidi Oy',
  value: 50000,
  stage: 'Uusi',
  assignee: 'Myyjä',
  date: '2026-08-01',
} as const;

const newTimeEntryInput = {
  date: '2026-08-01',
  employee: 'Testaaja',
  project: 'Testiprojekti',
  hours: 8,
  overtime: 0,
  description: 'Testikirjaus',
  status: 'Odottaa',
} as const;

const newSafetyItemInput = {
  type: 'incident',
  title: 'Testitapaturma',
  date: '2026-08-01',
  severity: 'Lievä',
  status: 'Avoin',
} as const;

describe('useAppData — empty initial state', () => {
  it('starts every business collection empty', () => {
    const { result } = renderHook(() => useAppData());

    expect(result.current.projects).toEqual([]);
    expect(result.current.workOrders).toEqual([]);
    expect(result.current.timeEntries).toEqual([]);
    expect(result.current.employees).toEqual([]);
    expect(result.current.equipment).toEqual([]);
    expect(result.current.customers).toEqual([]);
    expect(result.current.crmLeads).toEqual([]);
    expect(result.current.diaryEntries).toEqual([]);
    expect(result.current.safetyItems).toEqual([]);
    expect(result.current.wasteEntries).toEqual([]);
    expect(result.current.drivingLog).toEqual([]);
    expect(result.current.announcements).toEqual([]);
    expect(result.current.messages).toEqual([]);
    expect(result.current.stats.totalProjects).toBe(0);
    expect(result.current.stats.totalEmployees).toBe(0);
    expect(result.current.sidebarCollapsed).toBe(false);
  });

  it('does not hydrate stale values from the removed demo storage keys', () => {
    const stale: Project[] = [{ id: 'PROJ-DEMO', ...newProjectInput }];
    window.localStorage.setItem('vakantti-v1-projects', JSON.stringify(stale));

    const { result } = renderHook(() => useAppData());

    expect(result.current.projects).toEqual([]);
  });

  it('hydrates values from the new clean storage namespace', () => {
    const persisted: Project[] = [{ id: 'PROJ-REAL', ...newProjectInput }];
    window.localStorage.setItem('vakantti-v1-clean-projects', JSON.stringify(persisted));

    const { result } = renderHook(() => useAppData());

    expect(result.current.projects).toEqual(persisted);
  });
});

describe('useAppData — local CRUD helpers', () => {
  it('creates, updates and deletes a project from an empty state', () => {
    const { result } = renderHook(() => useAppData());
    let created: Project | undefined;

    act(() => {
      created = result.current.addProject({ ...newProjectInput });
    });
    expect(created?.id).toMatch(/^PROJ-/);
    expect(result.current.projects).toHaveLength(1);

    act(() => {
      result.current.updateProject(created!.id, { progress: 100, status: 'Valmis' });
    });
    expect(result.current.projects[0]).toMatchObject({ progress: 100, status: 'Valmis' });

    act(() => {
      result.current.deleteProject(created!.id);
    });
    expect(result.current.projects).toEqual([]);
  });

  it('creates, updates and deletes a work order from an empty state', () => {
    const { result } = renderHook(() => useAppData());
    let created: WorkOrder | undefined;

    act(() => {
      created = result.current.addWorkOrder({ ...newWorkOrderInput });
    });
    expect(created?.id).toMatch(/^TM-/);

    act(() => {
      result.current.updateWorkOrder(created!.id, { status: 'Valmis' });
    });
    expect(result.current.workOrders[0].status).toBe('Valmis');

    act(() => {
      result.current.deleteWorkOrder(created!.id);
    });
    expect(result.current.workOrders).toEqual([]);
  });

  it('creates, updates and deletes a customer from an empty state', () => {
    const { result } = renderHook(() => useAppData());
    let created: Customer | undefined;

    act(() => {
      created = result.current.addCustomer({ ...newCustomerInput });
    });
    expect(created?.id).toMatch(/^AS-/);

    act(() => {
      result.current.updateCustomer(created!.id, { status: 'Epäaktiivinen' });
    });
    expect(result.current.customers[0].status).toBe('Epäaktiivinen');

    act(() => {
      result.current.deleteCustomer(created!.id);
    });
    expect(result.current.customers).toEqual([]);
  });

  it('creates, updates and deletes a CRM lead from an empty state', () => {
    const { result } = renderHook(() => useAppData());
    let created: CrmLead | undefined;

    act(() => {
      created = result.current.addCrmLead({ ...newLeadInput });
    });
    expect(created?.id).toMatch(/^LEAD-/);

    act(() => {
      result.current.updateCrmLead(created!.id, { stage: 'Voitettu' });
    });
    expect(result.current.crmLeads[0].stage).toBe('Voitettu');

    act(() => {
      result.current.deleteCrmLead(created!.id);
    });
    expect(result.current.crmLeads).toEqual([]);
  });

  it('adds time and safety records without bundled seed data', () => {
    const { result } = renderHook(() => useAppData());
    let timeEntry: TimeEntry | undefined;
    let safetyItem: SafetyItem | undefined;

    act(() => {
      timeEntry = result.current.addTimeEntry({ ...newTimeEntryInput });
      safetyItem = result.current.addSafetyItem({ ...newSafetyItemInput });
    });

    expect(timeEntry?.id).toMatch(/^TK-/);
    expect(safetyItem?.id).toMatch(/^TURV-/);
    expect(result.current.timeEntries).toHaveLength(1);
    expect(result.current.safetyItems).toHaveLength(1);
  });
});

describe('generateId', () => {
  it('creates unique ids with the requested prefix', () => {
    const first = generateId('TEST');
    const second = generateId('TEST');

    expect(first).toMatch(/^TEST-/);
    expect(second).toMatch(/^TEST-/);
    expect(second).not.toBe(first);
  });
});
