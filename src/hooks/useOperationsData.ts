import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/lib/supabase/client';
import type {
  Announcement,
  AnnouncementPriority,
  DiaryEntry,
  DiaryStatus,
  DrivingLogEntry,
  Message,
  TravelExpense,
  TravelExpenseStatus,
  WasteEntry,
} from '@/types';

type Row = Record<string, unknown>;

export interface OperationsData {
  diaryEntries: DiaryEntry[];
  wasteEntries: WasteEntry[];
  drivingLog: DrivingLogEntry[];
  travelExpenses: TravelExpense[];
  announcements: Announcement[];
  messages: Message[];
}

const EMPTY_OPERATIONS: OperationsData = {
  diaryEntries: [], wasteEntries: [], drivingLog: [], travelExpenses: [],
  announcements: [], messages: [],
};

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
  return text(item, key) || undefined;
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

function optionalNumber(item: Row, key: string): number | undefined {
  return item[key] == null ? undefined : numberValue(item, key);
}

function booleanValue(item: Row, key: string): boolean {
  return typeof item[key] === 'boolean' ? item[key] as boolean : false;
}

function enumValue<T extends string>(
  item: Row,
  key: string,
  options: readonly T[],
  fallback: T,
): T {
  const value = item[key];
  return typeof value === 'string' && options.includes(value as T)
    ? value as T
    : fallback;
}

async function selectRows(table: string, organizationId: string): Promise<Row[]> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('organization_id', organizationId);
  if (error) throw new Error(`${table}-tietojen haku epäonnistui: ${error.message}`);
  return (Array.isArray(data) ? data : []).map(row);
}

async function loadOperations(organizationId: string): Promise<OperationsData> {
  const [diaries, waste, driving, travel, announcements, messages] = await Promise.all([
    selectRows('diary_entries', organizationId),
    selectRows('waste_entries', organizationId),
    selectRows('driving_log_entries', organizationId),
    selectRows('travel_expenses', organizationId),
    selectRows('announcements', organizationId),
    selectRows('messages', organizationId),
  ]);

  return {
    diaryEntries: diaries
      .map((item): DiaryEntry => ({
        id: text(item, 'id'),
        date: text(item, 'date'),
        projectId: optionalText(item, 'project_id'),
        project: text(item, 'project'),
        author: text(item, 'author'),
        weather: text(item, 'weather'),
        temperature: item.temperature == null ? '' : String(item.temperature),
        workers: numberValue(item, 'workers'),
        workDescription: text(item, 'work_phases'),
        deliveries: optionalText(item, 'deliveries'),
        issues: optionalText(item, 'issues'),
        delays: optionalText(item, 'delays'),
        status: enumValue<DiaryStatus>(item, 'status', ['Luonnos', 'Valmis', 'Lukittu'], 'Luonnos'),
        approvedBy: optionalText(item, 'approved_by'),
        approvedAt: optionalText(item, 'approved_at'),
        lockedBy: optionalText(item, 'locked_by'),
      }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    wasteEntries: waste
      .map((item): WasteEntry => ({
        id: text(item, 'id'),
        date: text(item, 'date'),
        projectId: optionalText(item, 'project_id'),
        project: text(item, 'project'),
        wasteType: text(item, 'waste_type'),
        amount: numberValue(item, 'amount'),
        method: text(item, 'unit'),
        unit: optionalText(item, 'unit'),
        cost: numberValue(item, 'cost'),
        notes: optionalText(item, 'notes'),
        destination: optionalText(item, 'destination'),
        receiptNumber: optionalText(item, 'receipt_number'),
        hazardous: booleanValue(item, 'hazardous'),
      }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    drivingLog: driving
      .map((item): DrivingLogEntry => ({
        id: text(item, 'id'),
        date: text(item, 'date'),
        userId: optionalText(item, 'user_id'),
        driver: text(item, 'driver'),
        equipmentId: optionalText(item, 'equipment_id'),
        vehicle: '',
        startAddress: text(item, 'start_address'),
        endAddress: text(item, 'end_address'),
        distance: numberValue(item, 'distance_km'),
        purpose: text(item, 'purpose'),
        projectId: optionalText(item, 'project_id'),
        project: optionalText(item, 'project'),
        startOdometerKm: optionalNumber(item, 'start_odometer_km'),
        endOdometerKm: optionalNumber(item, 'end_odometer_km'),
      }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    travelExpenses: travel
      .map((item): TravelExpense => ({
        id: text(item, 'id'),
        date: text(item, 'date'),
        userId: optionalText(item, 'user_id'),
        employee: text(item, 'employee'),
        projectId: optionalText(item, 'project_id'),
        type: text(item, 'type'),
        description: text(item, 'description'),
        amount: numberValue(item, 'amount'),
        status: enumValue<TravelExpenseStatus>(
          item,
          'status',
          ['Odottaa', 'Hyväksytty', 'Hylätty'],
          'Odottaa',
        ),
        approvedBy: optionalText(item, 'approved_by'),
        approvedAt: optionalText(item, 'approved_at'),
        rejectionReason: optionalText(item, 'rejection_reason'),
        attachmentPath: optionalText(item, 'attachment_path'),
      }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    announcements: announcements
      .map((item): Announcement => ({
        id: text(item, 'id'),
        title: text(item, 'title'),
        content: text(item, 'content'),
        author: text(item, 'author'),
        date: text(item, 'published_at'),
        priority: enumValue<AnnouncementPriority>(
          item,
          'priority',
          ['Tärkeä', 'Normaali', 'Info'],
          'Normaali',
        ),
      }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    messages: messages
      .map((item): Message => ({
        id: text(item, 'id'),
        sender: text(item, 'sender'),
        recipient: text(item, 'recipient'),
        senderUserId: optionalText(item, 'sender_user_id'),
        recipientUserId: optionalText(item, 'recipient_user_id'),
        subject: optionalText(item, 'subject'),
        content: text(item, 'content'),
        timestamp: text(item, 'sent_at'),
        read: booleanValue(item, 'read'),
      }))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
  };
}

export function useOperationsData() {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = currentOrg?.id;
  const queryKey = ['operations-data', organizationId ?? 'none'] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => loadOperations(organizationId as string),
    enabled: Boolean(organizationId),
    staleTime: 20_000,
    retry: 1,
  });

  return {
    ...(query.data ?? EMPTY_OPERATIONS),
    loading: query.isLoading,
    refreshing: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: () => queryClient.invalidateQueries({ queryKey }),
  };
}
