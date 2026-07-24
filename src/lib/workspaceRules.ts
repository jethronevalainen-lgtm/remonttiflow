import type { WorkOrderStatus } from '@/types';

export type WorkerTransitionStatus = Extract<
  WorkOrderStatus,
  'Käynnissä' | 'Odottaa' | 'Valmis'
>;

export function allowedWorkerTransitions(
  status: WorkOrderStatus,
): WorkerTransitionStatus[] {
  switch (status) {
    case 'Avoin':
      return ['Käynnissä'];
    case 'Käynnissä':
      return ['Odottaa', 'Valmis'];
    case 'Odottaa':
      return ['Käynnissä', 'Valmis'];
    case 'Valmis':
    case 'Peruttu':
      return [];
  }
}

export function isWorkerTransitionAllowed(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
): to is WorkerTransitionStatus {
  return allowedWorkerTransitions(from).includes(to as WorkerTransitionStatus);
}
