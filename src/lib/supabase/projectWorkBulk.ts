import { supabase } from '@/lib/supabase/client';
import type { WorkOrderOccupancyStatus } from '@/lib/supabase/workManagement';
import type { WorkOrderPriority, WorkOrderStatus } from '@/types';

export interface BulkProjectWorkItem {
  title: string;
  location: string;
  assigneeUserId: string;
}

export interface BulkProjectWorkDefaults {
  dueDate?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  plannedStartTime: string;
  plannedEndTime: string;
  plannedWeekdays: number[];
  calendarSyncEnabled: boolean;
  occupancyStatus: WorkOrderOccupancyStatus;
  workReference?: string;
  startConstraints?: string;
  accessNotes?: string;
  residentNotificationRequired: boolean;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  description?: string;
  type?: string;
}

export async function createProjectWorkOrdersBulk(values: {
  organizationId: string;
  projectId: string;
  items: BulkProjectWorkItem[];
  defaults: BulkProjectWorkDefaults;
}): Promise<string[]> {
  const { data, error } = await supabase.rpc('create_project_work_orders_bulk', {
    p_organization_id: values.organizationId,
    p_project_id: values.projectId,
    p_items: values.items.map((item) => ({
      title: item.title,
      location: item.location || null,
      assignee_user_id: item.assigneeUserId,
    })),
    p_defaults: {
      due_date: values.defaults.dueDate || null,
      planned_start_date: values.defaults.plannedStartDate || null,
      planned_end_date: values.defaults.plannedEndDate || null,
      planned_start_time: values.defaults.plannedStartTime,
      planned_end_time: values.defaults.plannedEndTime,
      planned_weekdays: values.defaults.plannedWeekdays,
      calendar_sync_enabled: values.defaults.calendarSyncEnabled,
      occupancy_status: values.defaults.occupancyStatus,
      work_reference: values.defaults.workReference || null,
      start_constraints: values.defaults.startConstraints || null,
      access_notes: values.defaults.accessNotes || null,
      resident_notification_required: values.defaults.residentNotificationRequired,
      priority: values.defaults.priority,
      status: values.defaults.status,
      description: values.defaults.description || null,
      type: values.defaults.type || null,
    },
  });

  if (error) throw new Error(`Töiden massaluonti epäonnistui: ${error.message}`);
  if (!Array.isArray(data) || data.some((item) => typeof item !== 'string')) {
    throw new Error('Tietokanta ei palauttanut luotujen töiden tunnisteita.');
  }
  return data as string[];
}
