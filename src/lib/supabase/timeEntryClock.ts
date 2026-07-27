import { supabase } from './client';

export type BreakSource = 'none' | 'manual' | 'automatic';

export interface TimeEntryClockMetadata {
  timeEntryId: string;
  startTime?: string;
  endTime?: string;
  breakSource: BreakSource;
  breakStartTime?: string;
  breakEndTime?: string;
}

type Row = {
  id: string;
  start_time: string | null;
  end_time: string | null;
  break_source: string | null;
  break_start_time: string | null;
  break_end_time: string | null;
};

function time(value: string | null): string | undefined {
  return value ? value.slice(0, 5) : undefined;
}

function breakSource(value: string | null): BreakSource {
  return value === 'automatic' || value === 'none' ? value : 'manual';
}

export async function listTimeEntryClockMetadata(
  organizationId: string,
): Promise<Record<string, TimeEntryClockMetadata>> {
  const { data, error } = await supabase
    .from('time_entries')
    .select('id,start_time,end_time,break_source,break_start_time,break_end_time')
    .eq('organization_id', organizationId);

  if (error) throw new Error(`Tuntikirjausten kellonaikojen haku epäonnistui: ${error.message}`);

  return Object.fromEntries(((data ?? []) as Row[]).map((row) => [row.id, {
    timeEntryId: row.id,
    startTime: time(row.start_time),
    endTime: time(row.end_time),
    breakSource: breakSource(row.break_source),
    breakStartTime: time(row.break_start_time),
    breakEndTime: time(row.break_end_time),
  }]));
}
