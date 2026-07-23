import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAppData, generateId, type Project, type WorkOrder } from '../useAppData';

// useAppData persists under 'vakantti-v1-*' keys; start each test from a
// clean slate so hooks always seed from initialData.
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

describe('useAppData — seeding from initialData', () => {
  it('seeds all collections with the initial data when storage is empty', () => {
    const { result } = renderHook(() => useAppData());
    expect(result.current.projects).toHaveLength(10);
    expect(result.current.workOrders).toHaveLength(8);
    expect(result.current.timeEntries).toHaveLength(5);
    expect(result.current.employees).toHaveLength(5);
    expect(result.current.equipment).toHaveLength(5);
    expect(result.current.customers).toHaveLength(4);
    expect(result.current.crmLeads).toHaveLength(3);
    expect(result.current.diaryEntries).toHaveLength(2);
    expect(result.current.safetyItems).toHaveLength(2);
    expect(result.current.wasteEntries).toHaveLength(2);
    expect(result.current.drivingLog).toHaveLength(1);
    expect(result.current.announcements).toHaveLength(1);
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.sidebarCollapsed).toBe(false);
  });

  it('hydrates from previously persisted localStorage values', () => {
    const custom: Project[] = [
      {
        id: 'PROJ-X',
        name: 'Persistoitu projekti',
        customer: 'Asiakas',
        status: 'Suunniteltu',
        startDate: '2026-01-01',
        endDate: '2026-06-30',
        progress: 0,
        budget: 1,
        spent: 0,
      },
    ];
    window.localStorage.setItem('vakantti-v1-projects', JSON.stringify(custom));
    const { result } = renderHook(() => useAppData());
    expect(result.current.projects).toEqual(custom);
  });
});

describe('useAppData — project CRUD', () => {
  it('addProject prepends a project with a generated PROJ id and returns it', () => {
    const { result } = renderHook(() => useAppData());
    let created: Project | undefined;
    act(() => {
      created = result.current.addProject({ ...newProjectInput });
    });
    expect(created).toBeDefined();
    expect(created!.id).toMatch(/^PROJ-/);
    expect(created!.name).toBe('Testiprojekti');
    expect(result.current.projects).toHaveLength(11);
    expect(result.current.projects[0]).toEqual(created);
  });

  it('updateProject merges partial updates into the matching project only', () => {
    const { result } = renderHook(() => useAppData());
    const target = result.current.projects[0];
    act(() => {
      result.current.updateProject(target.id, { progress: 99, status: 'Valmis' });
    });
    const updated = result.current.projects.find((p) => p.id === target.id)!;
    expect(updated.progress).toBe(99);
    expect(updated.status).toBe('Valmis');
    // Untouched fields preserved.
    expect(updated.name).toBe(target.name);
    expect(updated.budget).toBe(target.budget);
    // Other projects untouched.
    expect(result.current.projects.filter((p) => p.id !== target.id)).toEqual(
      result.current.projects.slice(1),
    );
  });

  it('deleteProject removes only the matching project', () => {
    const { result } = renderHook(() => useAppData());
    const target = result.current.projects[0];
    act(() => {
      result.current.deleteProject(target.id);
    });
    expect(result.current.projects).toHaveLength(9);
    expect(result.current.projects.find((p) => p.id === target.id)).toBeUndefined();
  });

  it('persists project changes to localStorage under the vakantti-v1 key', () => {
    const { result } = renderHook(() => useAppData());
    act(() => {
      result.current.addProject({ ...newProjectInput });
    });
    const persisted = JSON.parse(
      window.localStorage.getItem('vakantti-v1-projects')!,
    ) as Project[];
    expect(persisted).toHaveLength(11);
    expect(persisted[0].name).toBe('Testiprojekti');
  });
});

describe('useAppData — work order CRUD', () => {
  it('addWorkOrder prepends a work order with a generated TM id and returns it', () => {
    const { result } = renderHook(() => useAppData());
    let created: WorkOrder | undefined;
    act(() => {
      created = result.current.addWorkOrder({ ...newWorkOrderInput });
    });
    expect(created!.id).toMatch(/^TM-/);
    expect(result.current.workOrders).toHaveLength(9);
    expect(result.current.workOrders[0]).toEqual(created);
  });

  it('updateWorkOrder merges partial updates into the matching work order', () => {
    const { result } = renderHook(() => useAppData());
    const target = result.current.workOrders[0];
    act(() => {
      result.current.updateWorkOrder(target.id, { status: 'Valmis', priority: 'Matala' });
    });
    const updated = result.current.workOrders.find((wo) => wo.id === target.id)!;
    expect(updated.status).toBe('Valmis');
    expect(updated.priority).toBe('Matala');
    expect(updated.title).toBe(target.title);
  });

  it('deleteWorkOrder removes only the matching work order', () => {
    const { result } = renderHook(() => useAppData());
    const target = result.current.workOrders[0];
    act(() => {
      result.current.deleteWorkOrder(target.id);
    });
    expect(result.current.workOrders).toHaveLength(7);
    expect(result.current.workOrders.find((wo) => wo.id === target.id)).toBeUndefined();
  });
});

describe('useAppData — stats', () => {
  it('computes stats from the seeded data', () => {
    const { result } = renderHook(() => useAppData());
    const { stats } = result.current;
    expect(stats.totalProjects).toBe(10);
    expect(stats.activeProjects).toBe(
      result.current.projects.filter((p) => p.status === 'Aktiivinen').length,
    );
    expect(stats.activeProjects).toBe(5);
    expect(stats.completedProjects).toBe(2);
    expect(stats.totalRevenue).toBe(
      result.current.projects.reduce((sum, p) => sum + p.budget, 0),
    );
    expect(stats.totalRevenue).toBe(5898000);
    expect(stats.openWorkOrders).toBe(3);
    expect(stats.inProgressWorkOrders).toBe(4);
    expect(stats.totalEmployees).toBe(5);
    expect(stats.activeEmployees).toBe(5);
    expect(stats.totalCustomers).toBe(4);
    expect(stats.openLeads).toBe(1);
    expect(stats.totalEquipment).toBe(5);
  });

  it('stats react to CRUD operations', () => {
    const { result } = renderHook(() => useAppData());
    act(() => {
      result.current.addProject({ ...newProjectInput, budget: 100 });
    });
    expect(result.current.stats.totalProjects).toBe(11);
    expect(result.current.stats.activeProjects).toBe(6);
    expect(result.current.stats.totalRevenue).toBe(5898100);

    act(() => {
      result.current.addWorkOrder({ ...newWorkOrderInput });
    });
    expect(result.current.stats.openWorkOrders).toBe(4);

    act(() => {
      result.current.deleteWorkOrder(result.current.workOrders[0].id);
    });
    expect(result.current.stats.openWorkOrders).toBe(3);
  });
});

describe('generateId', () => {
  it('produces ids with the requested prefix', () => {
    expect(generateId('PROJ')).toMatch(/^PROJ-/);
    expect(generateId('TM')).toMatch(/^TM-/);
    expect(generateId('X')).toMatch(/^X-/);
  });

  it('produces unique ids across many calls (monotonic counter suffix)', () => {
    const ids = new Set(Array.from({ length: 500 }, () => generateId('T')));
    expect(ids.size).toBe(500);
  });
});
