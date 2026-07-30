import { describe, expect, it } from 'vitest';

import { calculateProjectProgress } from './projectProgress';
import type { Project, WorkOrder } from '@/types';

const project: Pick<Project, 'id' | 'name' | 'status'> = {
  id: 'project-1',
  name: 'Kohde A',
  status: 'Aktiivinen',
};

const order = (id: string, status: WorkOrder['status'], projectId = 'project-1'): WorkOrder => ({
  id,
  title: id,
  projectId,
  project: 'Kohde A',
  assignee: '',
  dueDate: '2026-08-01',
  priority: 'Normaali',
  status,
});

describe('calculateProjectProgress', () => {
  it('laskee etenemisen valmiista työmääräyksistä ja ohittaa perutut', () => {
    expect(calculateProjectProgress(project, [
      order('1', 'Valmis'),
      order('2', 'Valmis'),
      order('3', 'Käynnissä'),
      order('4', 'Peruttu'),
    ])).toEqual({ total: 3, completed: 2, percent: 67 });
  });

  it('palauttaa valmiille projektille 100 prosenttia', () => {
    expect(calculateProjectProgress({ ...project, status: 'Valmis' }, [])).toEqual({
      total: 0,
      completed: 0,
      percent: 100,
    });
  });
});
