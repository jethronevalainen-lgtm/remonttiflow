import type {
  Project, WorkOrder, TimeEntry, Employee, Equipment,
  Customer, CrmLead, DiaryEntry, SafetyItem, WasteEntry,
  DrivingLogEntry, Announcement, Message,
} from '../types';

/**
 * Legacy local-storage data starts empty.
 *
 * Production data is loaded from Supabase through AppDataContext. These arrays
 * remain only for the isolated legacy hook and must never contain sample,
 * fallback or demo business records.
 */
export const initialProjects: Project[] = [];
export const initialWorkOrders: WorkOrder[] = [];
export const initialTimeEntries: TimeEntry[] = [];
export const initialEmployees: Employee[] = [];
export const initialEquipment: Equipment[] = [];
export const initialCustomers: Customer[] = [];
export const initialCrmLeads: CrmLead[] = [];
export const initialDiaryEntries: DiaryEntry[] = [];
export const initialSafetyItems: SafetyItem[] = [];
export const initialWasteEntries: WasteEntry[] = [];
export const initialDrivingLog: DrivingLogEntry[] = [];
export const initialAnnouncements: Announcement[] = [];
export const initialMessages: Message[] = [];
