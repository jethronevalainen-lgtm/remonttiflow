import type {
  WorkAssignmentScope,
  WorkOrderPriority,
  WorkOrderStatus,
} from '@/types';

export interface WorkOrderFormValues {
  title: string;
  projectId: string;
  location: string;
  dueDate: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  type: string;
  description: string;
  assignmentScope: WorkAssignmentScope;
  assigneeUserIds: string[];
}

export const EMPTY_WORK_ORDER_FORM: WorkOrderFormValues = {
  title: '',
  projectId: '',
  location: '',
  dueDate: '',
  priority: 'Normaali',
  status: 'Avoin',
  type: '',
  description: '',
  assignmentScope: 'people',
  assigneeUserIds: [],
};
