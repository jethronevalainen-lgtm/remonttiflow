import type {
  WorkAssignmentScope,
  WorkOrderPriority,
  WorkOrderStatus,
} from '@/types';

export type OccupancyStatus = 'unknown' | 'occupied' | 'vacant' | 'partly_occupied';

export interface WorkOrderFormValues {
  title: string;
  projectId: string;
  location: string;
  buildingId: string;
  stairwellId: string;
  unitId: string;
  locationDetail: string;
  dueDate: string;
  plannedStartDate: string;
  plannedEndDate: string;
  plannedStartTime: string;
  plannedEndTime: string;
  plannedWeekdays: number[];
  calendarSyncEnabled: boolean;
  occupancyStatus: OccupancyStatus;
  workReference: string;
  startConstraints: string;
  accessNotes: string;
  residentNotificationRequired: boolean;
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
  buildingId: '',
  stairwellId: '',
  unitId: '',
  locationDetail: '',
  dueDate: '',
  plannedStartDate: '',
  plannedEndDate: '',
  plannedStartTime: '07:00',
  plannedEndTime: '15:30',
  plannedWeekdays: [1, 2, 3, 4, 5],
  calendarSyncEnabled: true,
  occupancyStatus: 'unknown',
  workReference: '',
  startConstraints: '',
  accessNotes: '',
  residentNotificationRequired: false,
  priority: 'Normaali',
  status: 'Avoin',
  type: '',
  description: '',
  assignmentScope: 'people',
  assigneeUserIds: [],
};
