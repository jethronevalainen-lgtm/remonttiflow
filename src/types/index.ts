/**
 * Canonical domain types — single source of truth.
 *
 * Hooks, seed data and pages MUST import these interfaces instead of
 * declaring page-local duplicates. Status enums use Finnish canonical
 * values everywhere (UI labels may differ, the stored value does not).
 */

/* ─── Shared status enums (Finnish canonical values) ─── */
export type ProjectStatus = 'Aktiivinen' | 'Suunniteltu' | 'Valmis' | 'Myöhässä';
export type WorkOrderPriority = 'Korkea' | 'Normaali' | 'Matala';
export type WorkOrderStatus = 'Avoin' | 'Käynnissä' | 'Odottaa' | 'Valmis' | 'Peruttu';
export type TimeEntryStatus = 'Hyväksytty' | 'Odottaa' | 'Hylätty';
export type EmployeeStatus = 'Aktiivinen' | 'Lomalla' | 'Sairas' | 'Koulutuksessa' | 'Eroonnut';
export type EquipmentStatus = 'Käytössä' | 'Vapaa' | 'Huollossa' | 'Vuokralla';
export type CustomerType = 'Yritys' | 'Yksityinen' | 'Taloyhtiö';
export type CustomerStatus = 'Aktiivinen' | 'Epäaktiivinen';
export type CrmLeadStage = 'Uusi' | 'Tarjous tehty' | 'Neuvottelu' | 'Sopimus';
export type SafetyItemType = 'incident' | 'risk' | 'inspection' | 'training';
export type SafetyItemSeverity = 'Lievä' | 'Keskitasoinen' | 'Vakava';
export type AnnouncementPriority = 'Tärkeä' | 'Normaali' | 'Info';

/* ─── Domain interfaces ─── */
export interface Project {
  id: string;
  name: string;
  customer: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  progress: number;
  budget: number;
  spent: number;
  description?: string;
  location?: string;
}

export interface WorkOrder {
  id: string;
  title: string;
  project: string;
  assignee: string;
  dueDate: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  description?: string;
  type?: string;
}

export interface TimeEntry {
  id: string;
  date: string;
  employee: string;
  project: string;
  hours: number;
  overtime: number;
  description: string;
  status: TimeEntryStatus;
  /** View fields used by the Tuntikirjaukset page (not part of the core record). */
  dayName?: string;
  startTime?: string;
  endTime?: string;
  projectColor?: string;
  workType?: string;
  personId?: string;
  personName?: string;
  personInitials?: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  phone: string;
  email: string;
  startDate: string;
  status: EmployeeStatus;
  /** Superset fields from the Henkilöstö page (seeded in initialData). */
  projects: number;
  hours: number;
  training: number;
  certifications: string[];
}

export interface Equipment {
  id: string;
  name: string;
  type: string;
  serial: string;
  location: string;
  status: EquipmentStatus;
  lastMaintenance: string;
  /** Optional fields used by the Kalusto page view. */
  model?: string;
  year?: number;
  lastService?: string;
  nextService?: string;
  hours?: number;
  maxHours?: number;
  image?: string;
}

export interface Customer {
  id: string;
  name: string;
  type: CustomerType;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  projectCount: number;
  lastContact: string;
  status: CustomerStatus;
}

export interface CrmLead {
  id: string;
  name: string;
  company: string;
  value: number;
  stage: CrmLeadStage;
  assignee: string;
  date: string;
}

export interface DiaryEntry {
  id: string;
  date: string;
  project: string;
  author: string;
  weather: string;
  temperature: string;
  workers: number;
  workDescription: string;
  issues?: string;
}

export interface SafetyItem {
  id: string;
  type: SafetyItemType;
  title: string;
  date: string;
  severity?: SafetyItemSeverity;
  status: string;
}

export interface WasteEntry {
  id: string;
  date: string;
  project: string;
  wasteType: string;
  amount: number;
  method: string;
  cost: number;
}

export interface DrivingLogEntry {
  id: string;
  date: string;
  driver: string;
  vehicle: string;
  startAddress: string;
  endAddress: string;
  distance: number;
  purpose: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  author: string;
  date: string;
  priority: AnnouncementPriority;
}

export interface Message {
  id: string;
  sender: string;
  recipient: string;
  content: string;
  timestamp: string;
  read: boolean;
}

/* ─── View types ─── */

/**
 * Reduced employee shape for the Työvuorokalenteri roster —
 * a view over Employee, not a separate domain entity.
 */
export type ShiftEmployee = Pick<Employee, 'id' | 'name' | 'role'> & {
  initials: string;
  color: string;
};
