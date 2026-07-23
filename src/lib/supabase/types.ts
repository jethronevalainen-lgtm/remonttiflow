/**
 * INTERIM hand-written Supabase Database types.
 *
 * These types are written against the migration contract:
 *   - organizations
 *   - profiles (id = auth user id)
 *   - organization_members (organization_id, user_id, role in admin/supervisor/worker)
 *   - project_members
 *   - audit_logs
 *   - the six existing domain tables (projects, work_orders, time_entries,
 *     employees, customers, equipment) each gaining org_id and created_by.
 *
 * Status columns keep the Finnish canonical text values used in
 * src/types/index.ts. Numeric amounts map to `number`, dates to ISO
 * `string`, and optional fields to `| null`.
 *
 * TODO: replace this file with generated output from
 *   `supabase gen types typescript`
 * once the migrations have been applied to the project.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type OrganizationRole = 'admin' | 'supervisor' | 'worker';

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          /** Matches auth.users.id. */
          id: string;
          full_name: string | null;
          email: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          created_at?: string;
        };
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: OrganizationRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role: OrganizationRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: OrganizationRole;
          created_at?: string;
        };
      };
      project_members: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          created_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string | null;
          table_name: string;
          record_id: string | null;
          action: string;
          changes: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id?: string | null;
          table_name: string;
          record_id?: string | null;
          action: string;
          changes?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string | null;
          table_name?: string;
          record_id?: string | null;
          action?: string;
          changes?: Json | null;
          created_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          customer: string;
          status: 'Aktiivinen' | 'Suunniteltu' | 'Valmis' | 'Myöhässä';
          start_date: string;
          end_date: string;
          progress: number;
          budget: number;
          spent: number;
          description: string | null;
          location: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          customer: string;
          status?: 'Aktiivinen' | 'Suunniteltu' | 'Valmis' | 'Myöhässä';
          start_date: string;
          end_date: string;
          progress?: number;
          budget?: number;
          spent?: number;
          description?: string | null;
          location?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          customer?: string;
          status?: 'Aktiivinen' | 'Suunniteltu' | 'Valmis' | 'Myöhässä';
          start_date?: string;
          end_date?: string;
          progress?: number;
          budget?: number;
          spent?: number;
          description?: string | null;
          location?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      work_orders: {
        Row: {
          id: string;
          org_id: string;
          title: string;
          project: string;
          assignee: string;
          due_date: string;
          priority: 'Korkea' | 'Normaali' | 'Matala';
          status: 'Avoin' | 'Käynnissä' | 'Odottaa' | 'Valmis' | 'Peruttu';
          description: string | null;
          type: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          title: string;
          project: string;
          assignee: string;
          due_date: string;
          priority?: 'Korkea' | 'Normaali' | 'Matala';
          status?: 'Avoin' | 'Käynnissä' | 'Odottaa' | 'Valmis' | 'Peruttu';
          description?: string | null;
          type?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          title?: string;
          project?: string;
          assignee?: string;
          due_date?: string;
          priority?: 'Korkea' | 'Normaali' | 'Matala';
          status?: 'Avoin' | 'Käynnissä' | 'Odottaa' | 'Valmis' | 'Peruttu';
          description?: string | null;
          type?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      time_entries: {
        Row: {
          id: string;
          org_id: string;
          date: string;
          employee: string;
          project: string;
          hours: number;
          overtime: number;
          description: string;
          status: 'Hyväksytty' | 'Odottaa' | 'Hylätty';
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          date: string;
          employee: string;
          project: string;
          hours: number;
          overtime?: number;
          description: string;
          status?: 'Hyväksytty' | 'Odottaa' | 'Hylätty';
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          date?: string;
          employee?: string;
          project?: string;
          hours?: number;
          overtime?: number;
          description?: string;
          status?: 'Hyväksytty' | 'Odottaa' | 'Hylätty';
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      employees: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          role: string;
          department: string;
          phone: string;
          email: string;
          start_date: string;
          status: 'Aktiivinen' | 'Lomalla' | 'Sairas' | 'Koulutuksessa' | 'Eroonnut';
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          role: string;
          department: string;
          phone: string;
          email: string;
          start_date: string;
          status?: 'Aktiivinen' | 'Lomalla' | 'Sairas' | 'Koulutuksessa' | 'Eroonnut';
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          role?: string;
          department?: string;
          phone?: string;
          email?: string;
          start_date?: string;
          status?: 'Aktiivinen' | 'Lomalla' | 'Sairas' | 'Koulutuksessa' | 'Eroonnut';
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      customers: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          type: 'Yritys' | 'Yksityinen' | 'Taloyhtiö';
          contact_person: string;
          phone: string;
          email: string;
          address: string;
          project_count: number;
          last_contact: string;
          status: 'Aktiivinen' | 'Epäaktiivinen';
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          type?: 'Yritys' | 'Yksityinen' | 'Taloyhtiö';
          contact_person: string;
          phone: string;
          email: string;
          address: string;
          project_count?: number;
          last_contact: string;
          status?: 'Aktiivinen' | 'Epäaktiivinen';
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          type?: 'Yritys' | 'Yksityinen' | 'Taloyhtiö';
          contact_person?: string;
          phone?: string;
          email?: string;
          address?: string;
          project_count?: number;
          last_contact?: string;
          status?: 'Aktiivinen' | 'Epäaktiivinen';
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      equipment: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          type: string;
          serial: string;
          location: string;
          status: 'Käytössä' | 'Vapaa' | 'Huollossa' | 'Vuokralla';
          last_maintenance: string;
          model: string | null;
          year: number | null;
          last_service: string | null;
          next_service: string | null;
          hours: number | null;
          max_hours: number | null;
          image: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          type: string;
          serial: string;
          location: string;
          status?: 'Käytössä' | 'Vapaa' | 'Huollossa' | 'Vuokralla';
          last_maintenance: string;
          model?: string | null;
          year?: number | null;
          last_service?: string | null;
          next_service?: string | null;
          hours?: number | null;
          max_hours?: number | null;
          image?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          type?: string;
          serial?: string;
          location?: string;
          status?: 'Käytössä' | 'Vapaa' | 'Huollossa' | 'Vuokralla';
          last_maintenance?: string;
          model?: string | null;
          year?: number | null;
          last_service?: string | null;
          next_service?: string | null;
          hours?: number | null;
          max_hours?: number | null;
          image?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      organization_role: OrganizationRole;
    };
  };
}

/** Convenience row aliases for the tables most code will touch. */
export type OrganizationRow = Database['public']['Tables']['organizations']['Row'];
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type OrganizationMemberRow = Database['public']['Tables']['organization_members']['Row'];
export type ProjectMemberRow = Database['public']['Tables']['project_members']['Row'];
export type AuditLogRow = Database['public']['Tables']['audit_logs']['Row'];
export type ProjectRow = Database['public']['Tables']['projects']['Row'];
export type WorkOrderRow = Database['public']['Tables']['work_orders']['Row'];
export type TimeEntryRow = Database['public']['Tables']['time_entries']['Row'];
export type EmployeeRow = Database['public']['Tables']['employees']['Row'];
export type CustomerRow = Database['public']['Tables']['customers']['Row'];
export type EquipmentRow = Database['public']['Tables']['equipment']['Row'];
