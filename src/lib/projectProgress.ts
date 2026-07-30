import type { Project, WorkOrderStatus } from '@/types';

export interface ProjectProgressSummary {
  total: number;
  completed: number;
  percent: number;
}

interface ProgressWorkOrder {
  projectId?: string;
  project: string;
  status: WorkOrderStatus;
}

export function calculateProjectProgress(
  project: Pick<Project, 'id' | 'name' | 'status'>,
  workOrders: ProgressWorkOrder[],
): ProjectProgressSummary {
  const relevant = workOrders.filter((workOrder) => (
    workOrder.status !== 'Peruttu'
    && (workOrder.projectId === project.id || workOrder.project === project.name)
  ));
  const completed = relevant.filter((workOrder) => workOrder.status === 'Valmis').length;
  const percent = project.status === 'Valmis'
    ? 100
    : relevant.length > 0
      ? Math.round((completed / relevant.length) * 100)
      : 0;

  return { total: relevant.length, completed, percent };
}
