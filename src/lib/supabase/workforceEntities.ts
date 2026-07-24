import { supabase } from './client';
import type { SafetyItem, TimeEntry } from '@/types';

type Payload = Record<string, unknown>;

function toIsoDate(value: string): string {
  const finnish = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value.trim());
  if (!finnish) return value;
  return `${finnish[3]}-${finnish[2].padStart(2, '0')}-${finnish[1].padStart(2, '0')}`;
}

function timeEntryPayload(entry: Omit<TimeEntry, 'id'> | Partial<TimeEntry>): Payload {
  const payload: Payload = {};
  if (entry.date !== undefined) payload.date = toIsoDate(entry.date);
  if (entry.employee !== undefined) payload.employee = entry.employee;
  if (entry.project !== undefined) payload.project = entry.project;
  if (entry.hours !== undefined) payload.hours = entry.hours;
  if (entry.overtime !== undefined) payload.overtime = entry.overtime;
  if (entry.description !== undefined) payload.description = entry.description || null;
  if (entry.status !== undefined) payload.status = entry.status;
  return payload;
}

export async function createTimeEntryRecord(
  organizationId: string,
  createdBy: string | undefined,
  entry: Omit<TimeEntry, 'id'>,
): Promise<void> {
  const { error } = await supabase.from('time_entries').insert({
    organization_id: organizationId,
    ...(createdBy ? { created_by: createdBy } : {}),
    ...timeEntryPayload(entry),
  });
  if (error) throw new Error(`Tuntikirjauksen tallennus epäonnistui: ${error.message}`);
}

export async function updateTimeEntryRecord(
  organizationId: string,
  id: string,
  updates: Partial<TimeEntry>,
): Promise<void> {
  const { error } = await supabase
    .from('time_entries')
    .update(timeEntryPayload(updates))
    .eq('id', id)
    .eq('organization_id', organizationId);
  if (error) throw new Error(`Tuntikirjauksen päivitys epäonnistui: ${error.message}`);
}

export async function deleteTimeEntryRecord(
  organizationId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('time_entries')
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId);
  if (error) throw new Error(`Tuntikirjauksen poistaminen epäonnistui: ${error.message}`);
}

function safetyPayload(item: Omit<SafetyItem, 'id'> | Partial<SafetyItem>): Payload {
  const payload: Payload = {};
  if (item.type !== undefined) payload.type = item.type;
  if (item.title !== undefined) payload.title = item.title;
  if (item.date !== undefined) payload.date = toIsoDate(item.date);
  if (item.severity !== undefined) payload.severity = item.severity ?? null;
  if (item.status !== undefined) payload.status = item.status;
  return payload;
}

export async function createSafetyItemRecord(
  organizationId: string,
  createdBy: string | undefined,
  item: Omit<SafetyItem, 'id'>,
): Promise<void> {
  const { error } = await supabase.from('safety_items').insert({
    organization_id: organizationId,
    ...(createdBy ? { created_by: createdBy } : {}),
    ...safetyPayload(item),
  });
  if (error) throw new Error(`Turvallisuushavainnon tallennus epäonnistui: ${error.message}`);
}

export async function updateSafetyItemRecord(
  organizationId: string,
  id: string,
  updates: Partial<SafetyItem>,
): Promise<void> {
  const { error } = await supabase
    .from('safety_items')
    .update(safetyPayload(updates))
    .eq('id', id)
    .eq('organization_id', organizationId);
  if (error) throw new Error(`Turvallisuushavainnon päivitys epäonnistui: ${error.message}`);
}

export async function deleteSafetyItemRecord(
  organizationId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('safety_items')
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId);
  if (error) throw new Error(`Turvallisuushavainnon poistaminen epäonnistui: ${error.message}`);
}
