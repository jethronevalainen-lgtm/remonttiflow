/**
 * Small, generated-schema-aligned aliases used by the authentication and
 * organization contexts.
 *
 * Business-table rows are translated to the application's canonical domain
 * types in `domainData.ts`. Keeping that mapping explicit prevents database
 * snake_case/nullability details from leaking into page components.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrganizationRole = 'admin' | 'supervisor' | 'worker';

export interface OrganizationRow {
  id: string;
  name: string;
  business_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMemberRow {
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  created_at: string;
}

export interface ProjectMemberRow {
  project_id: string;
  user_id: string;
  role: string | null;
  created_at: string;
}

export interface AuditLogRow {
  id: number;
  organization_id: string | null;
  user_id: string | null;
  table_name: string | null;
  record_id: string | null;
  action: string | null;
  metadata: Json | null;
  created_at: string;
}

export interface ProjectRow {
  id: string;
  organization_id: string | null;
  created_by: string | null;
  customer: string;
  customer_id: string | null;
  name: string;
  location: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  spent: number | null;
  progress: number | null;
  description: string | null;
  project_number: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface WorkOrderRow {
  id: string;
  organization_id: string | null;
  created_by: string | null;
  project_id: string | null;
  title: string;
  project: string;
  assignee: string;
  due_date: string | null;
  priority: string;
  status: string;
  description: string | null;
  type: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface TimeEntryRow {
  id: string;
  organization_id: string | null;
  created_by: string | null;
  project_id: string | null;
  employee_id: string | null;
  date: string;
  employee: string;
  project: string;
  hours: number;
  overtime: number | null;
  description: string | null;
  status: string;
  created_at: string | null;
  updated_at: string;
}

export interface EmployeeRow {
  id: string;
  organization_id: string | null;
  created_by: string | null;
  name: string;
  role: string;
  department: string;
  phone: string | null;
  email: string | null;
  start_date: string | null;
  status: string;
  created_at: string | null;
}

export interface CustomerRow {
  id: string;
  organization_id: string | null;
  created_by: string | null;
  name: string;
  type: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  project_count: number | null;
  last_contact: string | null;
  status: string;
  created_at: string | null;
}

export interface EquipmentRow {
  id: string;
  organization_id: string | null;
  created_by: string | null;
  name: string;
  type: string;
  serial: string | null;
  location: string | null;
  status: string;
  last_maintenance: string | null;
  created_at: string | null;
}
