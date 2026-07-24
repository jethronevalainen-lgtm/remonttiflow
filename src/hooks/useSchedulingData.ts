import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/lib/supabase/client';

export type PhaseStatus = 'Suunniteltu' | 'Käynnissä' | 'Valmis' | 'Myöhässä';

export interface ProjectPhase {
  id: string;
  projectId?: string;
  projectName: string;
  name: string;
  startDate: string;
  endDate: string;
  status: PhaseStatus;
  progress: number;
  notes: string;
}

export interface Shift {
  id: string;
  userId?: string;
  employeeId?: string;
  employeeName: string;
  projectId?: string;
  project: string;
  date: string;
  startTime: string;
  endTime: string;
  shiftType: string;
  notes: string;
}

type Row = Record<string, unknown>;

function row(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Tietokanta palautti virheellisen tietueen.');
  }
  return value as Row;
}

function text(item: Row, key: string): string {
  return typeof item[key] === 'string' ? item[key] as string : '';
}

function optionalText(item: Row, key: string): string | undefined {
  const value = text(item, key);
  return value || undefined;
}

function numberValue(item: Row, key: string): number {
  const value = item[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

async function loadScheduling(organizationId: string) {
  const [phasesResponse, shiftsResponse] = await Promise.all([
    supabase
      .from('project_phases')
      .select('*')
      .eq('organization_id', organizationId)
      .order('start_date', { ascending: true }),
    supabase
      .from('shifts')
      .select('*')
      .eq('organization_id', organizationId)
      .order('date', { ascending: true }),
  ]);

  if (phasesResponse.error) {
    throw new Error(`Projektivaiheiden haku epäonnistui: ${phasesResponse.error.message}`);
  }
  if (shiftsResponse.error) {
    throw new Error(`Työvuorojen haku epäonnistui: ${shiftsResponse.error.message}`);
  }

  const phases = (Array.isArray(phasesResponse.data) ? phasesResponse.data : [])
    .map(row)
    .map((item): ProjectPhase => {
      const rawStatus = text(item, 'status');
      const status: PhaseStatus = ['Käynnissä', 'Valmis', 'Myöhässä'].includes(rawStatus)
        ? rawStatus as PhaseStatus
        : 'Suunniteltu';
      return {
        id: text(item, 'id'),
        projectId: optionalText(item, 'project_id'),
        projectName: text(item, 'project_name'),
        name: text(item, 'name'),
        startDate: text(item, 'start_date'),
        endDate: text(item, 'end_date'),
        status,
        progress: numberValue(item, 'progress'),
        notes: text(item, 'notes'),
      };
    });

  const shifts = (Array.isArray(shiftsResponse.data) ? shiftsResponse.data : [])
    .map(row)
    .map((item): Shift => ({
      id: text(item, 'id'),
      userId: optionalText(item, 'user_id'),
      employeeId: optionalText(item, 'employee_id'),
      employeeName: text(item, 'employee_name'),
      projectId: optionalText(item, 'project_id'),
      project: text(item, 'project'),
      date: text(item, 'date'),
      startTime: text(item, 'start_time'),
      endTime: text(item, 'end_time'),
      shiftType: text(item, 'shift_type'),
      notes: text(item, 'notes'),
    }));

  return { phases, shifts };
}

export function useSchedulingData() {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = currentOrg?.id;
  const queryKey = ['scheduling-data', organizationId ?? 'none'] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => loadScheduling(organizationId as string),
    enabled: Boolean(organizationId),
    staleTime: 20_000,
    retry: 1,
  });

  return {
    phases: query.data?.phases ?? [],
    shifts: query.data?.shifts ?? [],
    loading: query.isLoading,
    refreshing: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: () => queryClient.invalidateQueries({ queryKey }),
  };
}
