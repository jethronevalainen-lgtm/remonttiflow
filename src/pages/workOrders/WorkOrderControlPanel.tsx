import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Columns3,
  Download,
  Eye,
  FileText,
  Filter,
  History,
  ListFilter,
  Loader2,
  MapPin,
  MoreHorizontal,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Receipt,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Timer,
  Trash2,
  UserCheck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { OrganizationPerson, ProjectMembership, ManagedWorkOrder } from '@/lib/supabase/workManagement';
import {
  bulkUpdateWorkOrders,
  deleteWorkOrderView,
  listWorkOrderSavedViews,
  loadWorkOrderControlData,
  loadWorkOrderInsights,
  saveWorkOrderView,
  type ControlledWorkOrder,
  type WorkOrderAttentionFlag,
  type WorkOrderBillingStatus,
  type WorkOrderControlPatch,
  type WorkOrderSavedView,
} from '@/lib/supabase/workOrderControl';
import { cn } from '@/lib/utils';
import type { Project, WorkOrderPriority, WorkOrderStatus } from '@/types';

const REVIEW_STATUS = 'Hyväksyttävänä';
type DisplayStatus = WorkOrderStatus | typeof REVIEW_STATUS;
type SortDirection = 'asc' | 'desc';
type GroupBy = 'none' | 'assignee' | 'customer' | 'project' | 'status';
type DetailTab = 'billing' | 'history' | 'summary' | 'time';
type BulkAction = 'assignee' | 'billing' | 'dueDate' | 'priority' | 'shift' | 'status';
type ScopeFilter = 'all' | 'project' | 'standalone';

type ColumnKey =
  | 'actions'
  | 'assignees'
  | 'attention'
  | 'billing'
  | 'customer'
  | 'hours'
  | 'priority'
  | 'project'
  | 'quantity'
  | 'schedule'
  | 'status'
  | 'title'
  | 'workNumber';

interface FilterState {
  assigneeIds: string[];
  attentionFlags: WorkOrderAttentionFlag[];
  billingStatuses: WorkOrderBillingStatus[];
  customerNames: string[];
  dueFrom: string;
  dueTo: string;
  groupBy: GroupBy;
  onlyActive: boolean;
  priorities: WorkOrderPriority[];
  projectIds: string[];
  scope: ScopeFilter;
  search: string;
  statuses: DisplayStatus[];
}

interface Props {
  canCreate: boolean;
  error: string | null;
  loading: boolean;
  organizationId: string;
  orders: ManagedWorkOrder[];
  people: OrganizationPerson[];
  projectFilterId?: string;
  projectMemberships: ProjectMembership[];
  projects: Project[];
  onCreate: () => void;
  onDelete: (order: ManagedWorkOrder) => void;
  onEdit: (order: ManagedWorkOrder) => void;
  onRefresh: () => Promise<void>;
  onReview: (order: ManagedWorkOrder, approved: boolean) => void;
}

const BILLING_LABELS: Record<WorkOrderBillingStatus, string> = {
  recorded: 'Kirjattu',
  approved: 'Hyväksytty',
  billable: 'Laskutusvalmis',
  queued: 'Laskutusjonossa',
  invoiced: 'Laskutettu',
  credited: 'Hyvitetty',
  rejected: 'Ei laskuteta',
};

const ATTENTION_LABELS: Record<WorkOrderAttentionFlag, string> = {
  active_long: 'Pitkä työaika',
  estimate_exceeded: 'Arvio ylittynyt',
  missing_assignee: 'Tekijä puuttuu',
  missing_schedule: 'Aikataulu puuttuu',
  overdue: 'Myöhässä',
  pending_review: 'Odottaa hyväksyntää',
  ready_to_bill: 'Valmis laskutukseen',
};

const COLUMN_LABELS: Record<ColumnKey, string> = {
  actions: 'Toiminnot',
  assignees: 'Tekijät',
  attention: 'Huomiot',
  billing: 'Laskutus',
  customer: 'Asiakas',
  hours: 'Tunnit',
  priority: 'Prioriteetti',
  project: 'Projekti / kohde',
  quantity: 'Määrä',
  schedule: 'Ajankohta',
  status: 'Tila',
  title: 'Työ',
  workNumber: 'Tunnus',
};

const DEFAULT_COLUMNS: ColumnKey[] = [
  'workNumber',
  'schedule',
  'customer',
  'project',
  'title',
  'assignees',
  'status',
  'priority',
  'hours',
  'billing',
  'attention',
  'actions',
];

function defaultFilters(projectFilterId = ''): FilterState {
  return {
    assigneeIds: [],
    attentionFlags: [],
    billingStatuses: [],
    customerNames: [],
    dueFrom: '',
    dueTo: '',
    groupBy: 'none',
    onlyActive: false,
    priorities: [],
    projectIds: projectFilterId ? [projectFilterId] : [],
    scope: 'all',
    search: '',
    statuses: [],
  };
}

function formatDate(value: string | undefined, empty = 'Ei määritetty') {
  if (!value) return empty;
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

function formatDateTime(value: string | undefined, empty = 'Ei tiedossa') {
  if (!value) return empty;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

function formatMinutes(minutes: number | undefined) {
  if (minutes === undefined) return 'Ei arviota';
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const remainder = safe % 60;
  return remainder === 0 ? `${hours} h` : `${hours} h ${remainder} min`;
}

function formatMoney(cents: number | undefined) {
  if (cents === undefined) return 'Ei summaa';
  return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function displayStatus(order: ManagedWorkOrder): DisplayStatus {
  return order.completionRequestedAt && !order.completionApproved ? REVIEW_STATUS : order.status;
}

function statusClass(status: DisplayStatus) {
  const classes: Record<DisplayStatus, string> = {
    Avoin: 'border-blue-200 bg-blue-50 text-blue-700',
    Käynnissä: 'border-orange-200 bg-orange-50 text-orange-700',
    Odottaa: 'border-amber-200 bg-amber-50 text-amber-700',
    Hyväksyttävänä: 'border-violet-200 bg-violet-50 text-violet-700',
    Valmis: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Peruttu: 'border-slate-200 bg-slate-50 text-slate-600',
  };
  return classes[status];
}

function priorityClass(priority: WorkOrderPriority) {
  return priority === 'Korkea'
    ? 'border-red-200 bg-red-50 text-red-700'
    : priority === 'Matala'
      ? 'border-blue-100 bg-blue-50 text-blue-600'
      : 'border-slate-200 bg-slate-50 text-slate-700';
}

function billingClass(status: WorkOrderBillingStatus) {
  if (status === 'invoiced') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'queued' || status === 'billable') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (status === 'rejected' || status === 'credited') return 'border-slate-200 bg-slate-50 text-slate-600';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function assignmentLabel(order: ManagedWorkOrder) {
  if (order.assignmentScope === 'project_team') return 'Koko projektitiimi';
  return order.assigneeNames.length > 0 ? order.assigneeNames.join(', ') : 'Vastuuhenkilö puuttuu';
}

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function safeFilters(value: Record<string, unknown>, projectFilterId = ''): FilterState {
  const base = defaultFilters(projectFilterId);
  const stringArray = (key: keyof FilterState) => Array.isArray(value[key])
    ? (value[key] as unknown[]).filter((item): item is string => typeof item === 'string')
    : [];
  const scope = value.scope === 'project' || value.scope === 'standalone' ? value.scope : 'all';
  const groupBy = ['assignee', 'customer', 'project', 'status'].includes(String(value.groupBy))
    ? value.groupBy as GroupBy
    : 'none';
  return {
    ...base,
    search: typeof value.search === 'string' ? value.search : '',
    assigneeIds: stringArray('assigneeIds'),
    attentionFlags: stringArray('attentionFlags') as WorkOrderAttentionFlag[],
    billingStatuses: stringArray('billingStatuses') as WorkOrderBillingStatus[],
    customerNames: stringArray('customerNames'),
    dueFrom: typeof value.dueFrom === 'string' ? value.dueFrom : '',
    dueTo: typeof value.dueTo === 'string' ? value.dueTo : '',
    groupBy,
    onlyActive: value.onlyActive === true,
    priorities: stringArray('priorities') as WorkOrderPriority[],
    projectIds: projectFilterId ? [projectFilterId] : stringArray('projectIds'),
    scope,
    statuses: stringArray('statuses') as DisplayStatus[],
  };
}

function MultiSelectFilter({
  label,
  options,
  selected,
  onToggle,
  searchable = false,
}: {
  label: string;
  options: Array<{ label: string; value: string; description?: string }>;
  selected: string[];
  onToggle: (value: string) => void;
  searchable?: boolean;
}) {
  const [query, setQuery] = useState('');
  const filtered = options.filter((option) => (
    !query || `${option.label} ${option.description ?? ''}`.toLocaleLowerCase('fi').includes(query.toLocaleLowerCase('fi'))
  ));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('gap-2', selected.length > 0 && 'border-orange-300 bg-orange-50 text-orange-800')}>
          <Filter size={15} /> {label}{selected.length > 0 ? ` (${selected.length})` : ''}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        {searchable && (
          <div className="border-b p-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hae..." className="pl-9" />
            </div>
          </div>
        )}
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50">
              <Checkbox
                checked={selected.includes(option.value)}
                onCheckedChange={() => onToggle(option.value)}
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800">{option.label}</span>
                {option.description && <span className="block truncate text-xs text-slate-500">{option.description}</span>}
              </span>
            </label>
          ))}
          {filtered.length === 0 && <p className="p-4 text-center text-sm text-slate-500">Ei tuloksia</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function WorkOrderControlPanel({
  canCreate,
  error,
  loading,
  organizationId,
  orders,
  people,
  projectFilterId = '',
  projectMemberships,
  projects,
  onCreate,
  onDelete,
  onEdit,
  onRefresh,
  onReview,
}: Props) {
  const [filters, setFilters] = useState<FilterState>(() => defaultFilters(projectFilterId));
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS);
  const [sortKey, setSortKey] = useState<keyof ControlledWorkOrder | 'displayStatus'>('dueDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 25 | 50 | 100>(25);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('summary');
  const [userTargetId, setUserTargetId] = useState<string | null>(null);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [viewDefault, setViewDefault] = useState(false);
  const [activeSavedViewId, setActiveSavedViewId] = useState<string | null>(null);
  const [defaultViewApplied, setDefaultViewApplied] = useState(false);
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [bulkValue, setBulkValue] = useState('');
  const [bulkAssignees, setBulkAssignees] = useState<string[]>([]);
  const [metadataEstimate, setMetadataEstimate] = useState('');
  const [metadataQuantity, setMetadataQuantity] = useState('');
  const [metadataUnit, setMetadataUnit] = useState('');
  const [metadataBillable, setMetadataBillable] = useState(true);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationSuccess, setOperationSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const controlQuery = useQuery({
    queryKey: [
      'work-order-control-data',
      organizationId,
      orders.map((order) => `${order.id}:${order.status}:${order.dueDate}:${order.assigneeUserIds.join('.')}`).join('|'),
    ],
    queryFn: () => loadWorkOrderControlData(organizationId, orders),
    enabled: Boolean(organizationId),
    staleTime: 10_000,
    retry: 1,
  });

  const savedViewsQuery = useQuery({
    queryKey: ['work-order-saved-views', organizationId],
    queryFn: () => listWorkOrderSavedViews(organizationId),
    enabled: Boolean(organizationId),
    staleTime: 30_000,
  });

  const controlledOrders = controlQuery.data ?? [];
  const detailOrder = controlledOrders.find((order) => order.id === detailOrderId) ?? null;
  const userTarget = people.find((person) => person.userId === userTargetId) ?? null;

  const insightsQuery = useQuery({
    queryKey: ['work-order-insights', organizationId, detailOrderId],
    queryFn: () => loadWorkOrderInsights(organizationId, detailOrderId as string),
    enabled: Boolean(detailOrderId),
    staleTime: 10_000,
  });

  useEffect(() => {
    setFilters((previous) => ({
      ...previous,
      projectIds: projectFilterId ? [projectFilterId] : previous.projectIds,
    }));
  }, [projectFilterId]);

  useEffect(() => {
    if (defaultViewApplied || projectFilterId || !savedViewsQuery.data) return;
    const defaultView = savedViewsQuery.data.find((view) => view.isDefault);
    if (defaultView) {
      setFilters(safeFilters(defaultView.filters));
      setVisibleColumns(defaultView.visibleColumns.filter((column): column is ColumnKey => column in COLUMN_LABELS));
      setSortKey(defaultView.sortKey as keyof ControlledWorkOrder);
      setSortDirection(defaultView.sortDirection);
      setPageSize(defaultView.pageSize);
      setActiveSavedViewId(defaultView.id);
    }
    setDefaultViewApplied(true);
  }, [defaultViewApplied, projectFilterId, savedViewsQuery.data]);

  useEffect(() => {
    if (!detailOrder) return;
    setMetadataEstimate(detailOrder.estimatedMinutes === undefined ? '' : String(detailOrder.estimatedMinutes / 60));
    setMetadataQuantity(detailOrder.quantity === undefined ? '' : String(detailOrder.quantity));
    setMetadataUnit(detailOrder.quantityUnit);
    setMetadataBillable(detailOrder.billable);
  }, [detailOrder?.id, detailOrder?.estimatedMinutes, detailOrder?.quantity, detailOrder?.quantityUnit, detailOrder?.billable]);

  const customerOptions = useMemo(() => [...new Set(controlledOrders.map((order) => order.customerName))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, 'fi'))
    .map((name) => ({ label: name, value: name })), [controlledOrders]);

  const projectOptions = useMemo(() => projects
    .map((project) => ({ label: project.name, value: project.id, description: project.location ?? project.customer }))
    .sort((left, right) => left.label.localeCompare(right.label, 'fi')), [projects]);

  const personOptions = useMemo(() => people.map((person) => ({
    label: person.name,
    value: person.userId,
    description: person.role === 'worker' ? 'Työntekijä' : person.role === 'supervisor' ? 'Työnjohtaja' : person.role === 'project_coordinator' ? 'Projektikoordinaattori' : 'Ylläpitäjä',
  })), [people]);

  const filteredOrders = useMemo(() => {
    const query = filters.search.trim().toLocaleLowerCase('fi');
    const dueFrom = filters.dueFrom ? new Date(`${filters.dueFrom}T00:00:00`) : null;
    const dueTo = filters.dueTo ? new Date(`${filters.dueTo}T23:59:59`) : null;
    return controlledOrders.filter((order) => {
      const status = displayStatus(order);
      const due = order.dueDate ? new Date(`${order.dueDate}T12:00:00`) : null;
      const matchesSearch = !query || [
        order.workNumber,
        order.title,
        order.description,
        order.type,
        order.project,
        order.projectNumber,
        order.projectLocation,
        order.location,
        order.customerName,
        assignmentLabel(order),
        order.workReference,
        order.invoiceReference,
      ].some((value) => String(value ?? '').toLocaleLowerCase('fi').includes(query));
      const matchesScope = filters.scope === 'all'
        || (filters.scope === 'project' && Boolean(order.projectId))
        || (filters.scope === 'standalone' && !order.projectId);
      return matchesSearch
        && matchesScope
        && (filters.statuses.length === 0 || filters.statuses.includes(status))
        && (filters.priorities.length === 0 || filters.priorities.includes(order.priority))
        && (filters.billingStatuses.length === 0 || filters.billingStatuses.includes(order.billingStatus))
        && (filters.assigneeIds.length === 0 || filters.assigneeIds.some((userId) => order.assigneeUserIds.includes(userId)))
        && (filters.projectIds.length === 0 || Boolean(order.projectId && filters.projectIds.includes(order.projectId)))
        && (filters.customerNames.length === 0 || filters.customerNames.includes(order.customerName))
        && (filters.attentionFlags.length === 0 || filters.attentionFlags.every((flag) => order.attentionFlags.includes(flag)))
        && (!filters.onlyActive || order.activeSessionCount > 0)
        && (!dueFrom || Boolean(due && due >= dueFrom))
        && (!dueTo || Boolean(due && due <= dueTo));
    });
  }, [controlledOrders, filters]);

  const sortedOrders = useMemo(() => [...filteredOrders].sort((left, right) => {
    const leftValue = sortKey === 'displayStatus' ? displayStatus(left) : left[sortKey];
    const rightValue = sortKey === 'displayStatus' ? displayStatus(right) : right[sortKey];
    const leftText = Array.isArray(leftValue) ? leftValue.join(',') : String(leftValue ?? '');
    const rightText = Array.isArray(rightValue) ? rightValue.join(',') : String(rightValue ?? '');
    const comparison = leftText.localeCompare(rightText, 'fi', { numeric: true, sensitivity: 'base' });
    return sortDirection === 'asc' ? comparison : -comparison;
  }), [filteredOrders, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageOrders = sortedOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const selectedOrders = controlledOrders.filter((order) => selectedIds.includes(order.id));
  const pageAllSelected = pageOrders.length > 0 && pageOrders.every((order) => selectedIds.includes(order.id));

  const eligibleAssignees = useMemo(() => {
    if (selectedOrders.length === 0) return people;
    return people.filter((person) => selectedOrders.every((order) => (
      !order.projectId
      || projectMemberships.some((membership) => membership.projectId === order.projectId && membership.userId === person.userId)
    )));
  }, [people, projectMemberships, selectedOrders]);

  const counts = useMemo(() => ({
    active: controlledOrders.filter((order) => order.activeSessionCount > 0).length,
    open: controlledOrders.filter((order) => order.status === 'Avoin').length,
    running: controlledOrders.filter((order) => order.status === 'Käynnissä' && !order.completionRequestedAt).length,
    waiting: controlledOrders.filter((order) => order.status === 'Odottaa').length,
    review: controlledOrders.filter((order) => order.completionRequestedAt && !order.completionApproved).length,
    overdue: controlledOrders.filter((order) => order.attentionFlags.includes('overdue')).length,
    unassigned: controlledOrders.filter((order) => order.attentionFlags.includes('missing_assignee')).length,
    readyToBill: controlledOrders.filter((order) => order.attentionFlags.includes('ready_to_bill')).length,
  }), [controlledOrders]);

  const activeFilterCount = filters.assigneeIds.length
    + filters.attentionFlags.length
    + filters.billingStatuses.length
    + filters.customerNames.length
    + filters.priorities.length
    + filters.projectIds.length
    + filters.statuses.length
    + (filters.dueFrom ? 1 : 0)
    + (filters.dueTo ? 1 : 0)
    + (filters.onlyActive ? 1 : 0)
    + (filters.scope !== 'all' ? 1 : 0);

  const runPatch = async (workOrderIds: string[], patch: WorkOrderControlPatch, successMessage: string) => {
    if (workOrderIds.length === 0) return;
    setSaving(true);
    setOperationError(null);
    setOperationSuccess(null);
    try {
      const updated = await bulkUpdateWorkOrders({ organizationId, workOrderIds, patch });
      await Promise.all([onRefresh(), controlQuery.refetch(), insightsQuery.refetch()]);
      setSelectedIds([]);
      setBulkAction(null);
      setBulkValue('');
      setBulkAssignees([]);
      setOperationSuccess(`${successMessage} (${updated} työmääräystä).`);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Päivitys epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const executeBulkAction = async () => {
    if (!bulkAction) return;
    const ids = selectedIds;
    if (bulkAction === 'assignee') {
      await runPatch(ids, { assigneeUserIds: bulkAssignees }, 'Vastuuhenkilöt päivitettiin');
      return;
    }
    if (!bulkValue && bulkAction !== 'dueDate') {
      setOperationError('Valitse tai anna uusi arvo.');
      return;
    }
    const patch: WorkOrderControlPatch = {};
    if (bulkAction === 'status') patch.status = bulkValue as WorkOrderStatus;
    if (bulkAction === 'priority') patch.priority = bulkValue as WorkOrderPriority;
    if (bulkAction === 'billing') patch.billingStatus = bulkValue as WorkOrderBillingStatus;
    if (bulkAction === 'shift') patch.scheduleShiftDays = Number(bulkValue);
    if (bulkAction === 'dueDate') patch.dueDate = bulkValue || null;
    await runPatch(ids, patch, 'Valitut työmääräykset päivitettiin');
  };

  const saveMetadata = async () => {
    if (!detailOrder) return;
    const estimateHours = metadataEstimate.trim() === '' ? null : Number(metadataEstimate.replace(',', '.'));
    const quantity = metadataQuantity.trim() === '' ? null : Number(metadataQuantity.replace(',', '.'));
    if (estimateHours !== null && (!Number.isFinite(estimateHours) || estimateHours < 0)) {
      setOperationError('Tuntiarvion pitää olla nolla tai positiivinen luku.');
      return;
    }
    if (quantity !== null && (!Number.isFinite(quantity) || quantity < 0)) {
      setOperationError('Määrän pitää olla nolla tai positiivinen luku.');
      return;
    }
    await runPatch([detailOrder.id], {
      estimatedMinutes: estimateHours === null ? null : Math.round(estimateHours * 60),
      quantity,
      quantityUnit: metadataUnit || null,
      billable: metadataBillable,
    }, 'Työmääräyksen ohjaustiedot tallennettiin');
  };

  const applySavedView = (view: WorkOrderSavedView) => {
    setFilters(safeFilters(view.filters, projectFilterId));
    const columns = view.visibleColumns.filter((column): column is ColumnKey => column in COLUMN_LABELS);
    setVisibleColumns(columns.length > 0 ? columns : DEFAULT_COLUMNS);
    setSortKey(view.sortKey as keyof ControlledWorkOrder);
    setSortDirection(view.sortDirection);
    setPageSize(view.pageSize);
    setActiveSavedViewId(view.id);
    setPage(1);
  };

  const saveCurrentView = async () => {
    if (viewName.trim().length < 2) {
      setOperationError('Anna näkymälle vähintään kahden merkin nimi.');
      return;
    }
    setSaving(true);
    setOperationError(null);
    try {
      await saveWorkOrderView({
        organizationId,
        name: viewName,
        filters: filters as unknown as Record<string, unknown>,
        visibleColumns,
        sortKey: String(sortKey),
        sortDirection,
        pageSize,
        isDefault: viewDefault,
      });
      await savedViewsQuery.refetch();
      setSaveViewOpen(false);
      setViewName('');
      setViewDefault(false);
      setOperationSuccess('Näkymä tallennettiin.');
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Näkymän tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const removeSavedView = async (viewId: string) => {
    setSaving(true);
    setOperationError(null);
    try {
      await deleteWorkOrderView(organizationId, viewId);
      if (activeSavedViewId === viewId) setActiveSavedViewId(null);
      await savedViewsQuery.refetch();
      setOperationSuccess('Tallennettu näkymä poistettiin.');
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Näkymän poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setFilters(defaultFilters(projectFilterId));
    setActiveSavedViewId(null);
    setPage(1);
  };

  const exportCsv = () => {
    const header = [
      'Tunnus', 'Määräpäivä', 'Asiakas', 'Projekti', 'Kohde', 'Työ', 'Tekijät',
      'Tila', 'Prioriteetti', 'Tunnit', 'Arvio', 'Laskutus', 'Määrä', 'Huomiot',
    ];
    const lines = sortedOrders.map((order) => [
      order.workNumber,
      order.dueDate,
      order.customerName,
      order.project,
      order.location || order.projectLocation,
      order.title,
      assignmentLabel(order),
      displayStatus(order),
      order.priority,
      (order.totalMinutes / 60).toLocaleString('fi-FI', { maximumFractionDigits: 2 }),
      order.estimatedMinutes === undefined ? '' : (order.estimatedMinutes / 60).toLocaleString('fi-FI', { maximumFractionDigits: 2 }),
      BILLING_LABELS[order.billingStatus],
      order.quantity === undefined ? '' : `${order.quantity} ${order.quantityUnit}`.trim(),
      order.attentionFlags.map((flag) => ATTENTION_LABELS[flag]).join(', '),
    ]);
    const csv = [header, ...lines].map((line) => line.map(csvCell).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tyomaaraykset-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const sortBy = (key: keyof ControlledWorkOrder | 'displayStatus') => {
    if (sortKey === key) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const groupLabel = (order: ControlledWorkOrder) => {
    if (filters.groupBy === 'status') return displayStatus(order);
    if (filters.groupBy === 'project') return order.project;
    if (filters.groupBy === 'customer') return order.customerName;
    if (filters.groupBy === 'assignee') return assignmentLabel(order);
    return '';
  };

  const openDetail = (order: ControlledWorkOrder) => {
    setDetailOrderId(order.id);
    setDetailTab('summary');
    setOperationError(null);
  };

  const showColumn = (column: ColumnKey) => visibleColumns.includes(column);

  return (
    <div className="space-y-5">
      {(error || controlQuery.error || operationError) && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          {operationError ?? error ?? (controlQuery.error instanceof Error ? controlQuery.error.message : 'Tietojen haku epäonnistui.')}
        </div>
      )}
      {operationSuccess && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <span className="flex items-start gap-2"><CheckCircle2 size={17} className="mt-0.5 shrink-0" /> {operationSuccess}</span>
          <button type="button" onClick={() => setOperationSuccess(null)} aria-label="Sulje"><X size={16} /></button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
        {[
          { key: 'active', label: 'Työssä nyt', value: counts.active, icon: Activity, tone: 'bg-orange-50 text-orange-700', action: () => setFilters({ ...defaultFilters(projectFilterId), onlyActive: true }) },
          { key: 'open', label: 'Avoimet', value: counts.open, icon: FileText, tone: 'bg-blue-50 text-blue-700', action: () => setFilters({ ...defaultFilters(projectFilterId), statuses: ['Avoin'] }) },
          { key: 'running', label: 'Käynnissä', value: counts.running, icon: PlayCircle, tone: 'bg-orange-50 text-orange-700', action: () => setFilters({ ...defaultFilters(projectFilterId), statuses: ['Käynnissä'] }) },
          { key: 'waiting', label: 'Odottaa', value: counts.waiting, icon: PauseCircle, tone: 'bg-amber-50 text-amber-700', action: () => setFilters({ ...defaultFilters(projectFilterId), statuses: ['Odottaa'] }) },
          { key: 'review', label: 'Hyväksyttävänä', value: counts.review, icon: ClipboardCheck, tone: 'bg-violet-50 text-violet-700', action: () => setFilters({ ...defaultFilters(projectFilterId), statuses: [REVIEW_STATUS] }) },
          { key: 'overdue', label: 'Myöhässä', value: counts.overdue, icon: AlertTriangle, tone: 'bg-red-50 text-red-700', action: () => setFilters({ ...defaultFilters(projectFilterId), attentionFlags: ['overdue'] }) },
          { key: 'unassigned', label: 'Ilman tekijää', value: counts.unassigned, icon: UserRound, tone: 'bg-slate-50 text-slate-700', action: () => setFilters({ ...defaultFilters(projectFilterId), attentionFlags: ['missing_assignee'] }) },
          { key: 'billing', label: 'Laskutusvalmiit', value: counts.readyToBill, icon: CircleDollarSign, tone: 'bg-emerald-50 text-emerald-700', action: () => setFilters({ ...defaultFilters(projectFilterId), attentionFlags: ['ready_to_bill'] }) },
        ].map((item) => (
          <button key={item.key} type="button" onClick={() => { item.action(); setPage(1); }} className="text-left">
            <Card className="h-full border-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <CardContent className="flex items-center justify-between gap-2 p-4">
                <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p><p className="mt-1 font-mono text-2xl font-bold text-slate-950">{item.value}</p></div>
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', item.tone)}><item.icon size={19} /></div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <Card className="overflow-visible border-slate-200 shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Button
                variant={activeSavedViewId === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => { clearFilters(); setVisibleColumns(DEFAULT_COLUMNS); }}
              >
                Kaikki
              </Button>
              {(savedViewsQuery.data ?? []).map((view) => (
                <div key={view.id} className="flex items-center">
                  <Button
                    variant={activeSavedViewId === view.id ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-r-none"
                    onClick={() => applySavedView(view)}
                  >
                    {view.name}{view.isDefault ? ' · oletus' : ''}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="rounded-l-none border-l-0 px-2"><MoreHorizontal size={15} /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end"><DropdownMenuItem className="text-red-600" onClick={() => void removeSavedView(view.id)}><Trash2 size={14} className="mr-2" /> Poista näkymä</DropdownMenuItem></DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSaveViewOpen(true)}><Save size={15} /> Tallenna näkymä</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2"><Download size={15} /> Vie CSV</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="gap-2"><Columns3 size={15} /> Sarakkeet</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Näytettävät sarakkeet</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column}
                      checked={visibleColumns.includes(column)}
                      onCheckedChange={() => setVisibleColumns((current) => current.includes(column) ? current.filter((item) => item !== column) : [...current, column])}
                    >
                      {COLUMN_LABELS[column]}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setVisibleColumns(DEFAULT_COLUMNS)}><RotateCcw size={14} className="mr-2" /> Palauta oletus</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {canCreate && <Button size="sm" onClick={onCreate} className="gap-2 bg-orange-600 hover:bg-orange-700"><Plus size={15} /> Uusi työmääräys</Button>}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_auto]">
            <div className="relative">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={filters.search}
                onChange={(event) => { setFilters((current) => ({ ...current, search: event.target.value })); setPage(1); }}
                placeholder="Hae tunnuksella, työllä, asiakkaalla, kohteella tai tekijällä..."
                className="h-11 pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <MultiSelectFilter label="Asiakas" options={customerOptions} selected={filters.customerNames} onToggle={(value) => setFilters((current) => ({ ...current, customerNames: toggleValue(current.customerNames, value) }))} searchable />
              <MultiSelectFilter label="Projekti" options={projectOptions} selected={filters.projectIds} onToggle={(value) => setFilters((current) => ({ ...current, projectIds: toggleValue(current.projectIds, value) }))} searchable />
              <MultiSelectFilter label="Tekijät" options={personOptions} selected={filters.assigneeIds} onToggle={(value) => setFilters((current) => ({ ...current, assigneeIds: toggleValue(current.assigneeIds, value) }))} searchable />
              <MultiSelectFilter
                label="Tila"
                options={['Avoin', 'Käynnissä', 'Odottaa', REVIEW_STATUS, 'Valmis', 'Peruttu'].map((value) => ({ label: value, value }))}
                selected={filters.statuses}
                onToggle={(value) => setFilters((current) => ({ ...current, statuses: toggleValue(current.statuses, value as DisplayStatus) }))}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('gap-2', activeFilterCount > 0 && 'border-orange-300 bg-orange-50 text-orange-800')}>
                    <SlidersHorizontal size={15} /> Lisää rajauksia{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[min(92vw,28rem)] space-y-5">
                  <div><p className="font-semibold text-slate-900">Tarkemmat rajaukset</p><p className="text-xs text-slate-500">Rajaa työmääräykset aikataulun, prioriteetin, laskutuksen ja poikkeamien perusteella.</p></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label>Määräpäivä alkaen</Label><Input type="date" value={filters.dueFrom} onChange={(event) => setFilters((current) => ({ ...current, dueFrom: event.target.value }))} /></div>
                    <div className="space-y-2"><Label>Määräpäivä päättyen</Label><Input type="date" value={filters.dueTo} onChange={(event) => setFilters((current) => ({ ...current, dueTo: event.target.value }))} /></div>
                  </div>
                  <div className="space-y-2"><Label>Työn laajuus</Label><Select value={filters.scope} onValueChange={(value: ScopeFilter) => setFilters((current) => ({ ...current, scope: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Kaikki työmääräykset</SelectItem><SelectItem value="project">Projekteihin liitetyt</SelectItem><SelectItem value="standalone">Yksittäiset työt</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Ryhmittely</Label><Select value={filters.groupBy} onValueChange={(value: GroupBy) => setFilters((current) => ({ ...current, groupBy: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei ryhmittelyä</SelectItem><SelectItem value="status">Tilan mukaan</SelectItem><SelectItem value="project">Projektin mukaan</SelectItem><SelectItem value="customer">Asiakkaan mukaan</SelectItem><SelectItem value="assignee">Tekijän mukaan</SelectItem></SelectContent></Select></div>
                  <div><Label className="mb-2 block">Prioriteetti</Label><div className="flex flex-wrap gap-2">{(['Korkea', 'Normaali', 'Matala'] as WorkOrderPriority[]).map((priority) => <Button key={priority} type="button" size="sm" variant={filters.priorities.includes(priority) ? 'default' : 'outline'} onClick={() => setFilters((current) => ({ ...current, priorities: toggleValue(current.priorities, priority) }))}>{priority}</Button>)}</div></div>
                  <div><Label className="mb-2 block">Laskutuksen tila</Label><div className="grid gap-2 sm:grid-cols-2">{(Object.keys(BILLING_LABELS) as WorkOrderBillingStatus[]).map((status) => <label key={status} className="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm"><Checkbox checked={filters.billingStatuses.includes(status)} onCheckedChange={() => setFilters((current) => ({ ...current, billingStatuses: toggleValue(current.billingStatuses, status) }))} /> {BILLING_LABELS[status]}</label>)}</div></div>
                  <div><Label className="mb-2 block">Vaatii huomiota</Label><div className="grid gap-2 sm:grid-cols-2">{(Object.keys(ATTENTION_LABELS) as WorkOrderAttentionFlag[]).map((flag) => <label key={flag} className="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm"><Checkbox checked={filters.attentionFlags.includes(flag)} onCheckedChange={() => setFilters((current) => ({ ...current, attentionFlags: toggleValue(current.attentionFlags, flag) }))} /> {ATTENTION_LABELS[flag]}</label>)}</div></div>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"><Checkbox checked={filters.onlyActive} onCheckedChange={(checked) => setFilters((current) => ({ ...current, onlyActive: checked === true }))} /><span><span className="block text-sm font-medium">Vain nyt käynnissä olevat</span><span className="text-xs text-slate-500">Näytä työmääräykset, joilla on aktiivinen työaika.</span></span></label>
                  <Button variant="outline" className="w-full gap-2" onClick={clearFilters}><RotateCcw size={15} /> Tyhjennä rajaukset</Button>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-xs">
              <span className="font-semibold text-slate-500">Aktiiviset rajaukset:</span>
              {filters.customerNames.map((value) => <Badge key={`customer-${value}`} variant="secondary">Asiakas: {value}<button onClick={() => setFilters((current) => ({ ...current, customerNames: current.customerNames.filter((item) => item !== value) }))}><X size={12} className="ml-1" /></button></Badge>)}
              {filters.projectIds.map((value) => <Badge key={`project-${value}`} variant="secondary">Projekti: {projects.find((item) => item.id === value)?.name ?? value}<button onClick={() => setFilters((current) => ({ ...current, projectIds: current.projectIds.filter((item) => item !== value) }))}><X size={12} className="ml-1" /></button></Badge>)}
              {filters.assigneeIds.map((value) => <Badge key={`person-${value}`} variant="secondary">Tekijä: {people.find((item) => item.userId === value)?.name ?? value}<button onClick={() => setFilters((current) => ({ ...current, assigneeIds: current.assigneeIds.filter((item) => item !== value) }))}><X size={12} className="ml-1" /></button></Badge>)}
              {filters.statuses.map((value) => <Badge key={`status-${value}`} variant="secondary">Tila: {value}<button onClick={() => setFilters((current) => ({ ...current, statuses: current.statuses.filter((item) => item !== value) }))}><X size={12} className="ml-1" /></button></Badge>)}
              {filters.attentionFlags.map((value) => <Badge key={`attention-${value}`} variant="secondary">{ATTENTION_LABELS[value]}<button onClick={() => setFilters((current) => ({ ...current, attentionFlags: current.attentionFlags.filter((item) => item !== value) }))}><X size={12} className="ml-1" /></button></Badge>)}
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearFilters}>Tyhjennä kaikki</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedIds.length > 0 && (
        <div className="sticky top-2 z-30 flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 text-white shadow-xl lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3"><UserCheck size={18} className="text-orange-400" /><span className="font-semibold">{selectedIds.length} työmääräystä valittu</span><Button variant="ghost" size="sm" className="text-slate-300 hover:text-white" onClick={() => setSelectedIds([])}>Poista valinta</Button></div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setBulkAction('assignee')}>Määritä tekijät</Button>
            <Button size="sm" variant="secondary" onClick={() => setBulkAction('status')}>Vaihda tila</Button>
            <Button size="sm" variant="secondary" onClick={() => setBulkAction('priority')}>Prioriteetti</Button>
            <Button size="sm" variant="secondary" onClick={() => setBulkAction('shift')}>Siirrä aikataulua</Button>
            <Button size="sm" variant="secondary" onClick={() => setBulkAction('billing')}>Laskutuksen tila</Button>
            <Button size="sm" variant="secondary" onClick={() => setBulkAction('dueDate')}>Määräpäivä</Button>
          </div>
        </div>
      )}

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="flex flex-col gap-3 border-b bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600"><ListFilter size={16} /><strong className="text-slate-900">{sortedOrders.length}</strong> työmääräystä</div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Rivejä</span>
            <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value) as 10 | 25 | 50 | 100); setPage(1); }}><SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger><SelectContent>{[10, 25, 50, 100].map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select>
          </div>
        </div>

        {(loading || controlQuery.isLoading) && <div className="flex min-h-64 items-center justify-center text-slate-500"><Loader2 size={24} className="mr-2 animate-spin" /> Ladataan työmääräyksiä…</div>}

        {!loading && !controlQuery.isLoading && pageOrders.length === 0 && (
          <div className="p-12 text-center"><BriefcaseBusiness size={44} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold text-slate-800">Rajauksilla ei löytynyt työmääräyksiä</p><p className="mt-1 text-sm text-slate-500">Muuta hakua tai tyhjennä rajauksia.</p></div>
        )}

        {!loading && !controlQuery.isLoading && pageOrders.length > 0 && (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-[1500px] w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="sticky left-0 z-20 w-12 border-b bg-slate-100 px-3 py-3"><Checkbox checked={pageAllSelected} onCheckedChange={() => setSelectedIds((current) => pageAllSelected ? current.filter((id) => !pageOrders.some((order) => order.id === id)) : [...new Set([...current, ...pageOrders.map((order) => order.id)])])} /></th>
                    {showColumn('workNumber') && <th className="border-b px-3 py-3"><button onClick={() => sortBy('workNumber')}>Tunnus</button></th>}
                    {showColumn('schedule') && <th className="border-b px-3 py-3"><button onClick={() => sortBy('dueDate')}>Ajankohta</button></th>}
                    {showColumn('customer') && <th className="border-b px-3 py-3"><button onClick={() => sortBy('customerName')}>Asiakas</button></th>}
                    {showColumn('project') && <th className="border-b px-3 py-3"><button onClick={() => sortBy('project')}>Projekti / kohde</button></th>}
                    {showColumn('title') && <th className="border-b px-3 py-3"><button onClick={() => sortBy('title')}>Työ</button></th>}
                    {showColumn('assignees') && <th className="border-b px-3 py-3">Tekijät</th>}
                    {showColumn('status') && <th className="border-b px-3 py-3"><button onClick={() => sortBy('displayStatus')}>Tila</button></th>}
                    {showColumn('priority') && <th className="border-b px-3 py-3"><button onClick={() => sortBy('priority')}>Prioriteetti</button></th>}
                    {showColumn('hours') && <th className="border-b px-3 py-3"><button onClick={() => sortBy('totalMinutes')}>Tunnit / arvio</button></th>}
                    {showColumn('billing') && <th className="border-b px-3 py-3"><button onClick={() => sortBy('billingStatus')}>Laskutus</button></th>}
                    {showColumn('quantity') && <th className="border-b px-3 py-3">Määrä</th>}
                    {showColumn('attention') && <th className="border-b px-3 py-3">Huomiot</th>}
                    {showColumn('actions') && <th className="border-b px-3 py-3 text-right">Toiminnot</th>}
                  </tr>
                </thead>
                <tbody>
                  {pageOrders.map((order, index) => {
                    const group = groupLabel(order);
                    const previousGroup = index > 0 ? groupLabel(pageOrders[index - 1]) : null;
                    const pendingReview = Boolean(order.completionRequestedAt && !order.completionApproved);
                    return [
                      filters.groupBy !== 'none' && group !== previousGroup ? (
                        <tr key={`group-${group}-${order.id}`} className="bg-slate-50"><td colSpan={14} className="border-b px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-600">{group || 'Ei määritetty'}</td></tr>
                      ) : null,
                      <tr key={order.id} className={cn('group border-b border-slate-100 align-top hover:bg-orange-50/30', selectedIds.includes(order.id) && 'bg-blue-50/50', order.activeSessionCount > 0 && 'border-l-4 border-l-orange-500')}>
                        <td className="sticky left-0 z-[1] bg-white px-3 py-3 group-hover:bg-orange-50/30"><Checkbox checked={selectedIds.includes(order.id)} onCheckedChange={() => setSelectedIds((current) => toggleValue(current, order.id))} /></td>
                        {showColumn('workNumber') && <td className="whitespace-nowrap px-3 py-3"><button type="button" onClick={() => openDetail(order)} className="font-mono text-xs font-bold text-blue-700 hover:underline">{order.workNumber}</button><p className="mt-1 text-[10px] text-slate-400">{formatDateTime(order.createdAt)}</p></td>}
                        {showColumn('schedule') && <td className="min-w-36 px-3 py-3"><p className="font-medium text-slate-800">{formatDate(order.dueDate, 'Ei määräpäivää')}</p><p className="mt-1 text-xs text-slate-500">{order.plannedStartDate ? `${formatDate(order.plannedStartDate)}–${formatDate(order.plannedEndDate)}` : 'Ei työjaksoa'}</p></td>}
                        {showColumn('customer') && <td className="min-w-40 px-3 py-3"><p className="font-medium text-slate-800">{order.customerName}</p></td>}
                        {showColumn('project') && <td className="min-w-48 px-3 py-3"><p className="font-medium text-slate-800">{order.project}</p><p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin size={11} /> {order.location || order.projectLocation || 'Ei sijaintia'}</p>{order.projectNumber && <p className="mt-1 font-mono text-[10px] text-slate-400">{order.projectNumber}</p>}</td>}
                        {showColumn('title') && <td className="min-w-64 px-3 py-3"><button type="button" onClick={() => openDetail(order)} className="text-left font-semibold text-slate-950 hover:text-blue-700">{order.title}</button>{order.type && <p className="mt-1 text-xs text-slate-500">{order.type}</p>}{pendingReview && <p className="mt-2 text-xs font-medium text-violet-700">Valmistuminen odottaa käsittelyä</p>}</td>}
                        {showColumn('assignees') && <td className="min-w-48 px-3 py-3">{order.assignmentScope === 'project_team' ? <Badge variant="outline"><UsersRound size={12} className="mr-1" /> Projektitiimi</Badge> : order.assigneeUserIds.length > 0 ? <div className="space-y-1">{order.assigneeUserIds.map((userId, personIndex) => <button key={userId} type="button" onClick={() => setUserTargetId(userId)} className="block max-w-48 truncate text-left text-xs font-medium text-blue-700 hover:underline">{order.assigneeNames[personIndex] ?? people.find((person) => person.userId === userId)?.name ?? 'Nimetön käyttäjä'}</button>)}</div> : <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Puuttuu</Badge>}</td>}
                        {showColumn('status') && <td className="min-w-36 px-3 py-3">{pendingReview ? <Badge variant="outline" className={statusClass(REVIEW_STATUS)}>{REVIEW_STATUS}</Badge> : <Select value={order.status} disabled={saving} onValueChange={(value: WorkOrderStatus) => void runPatch([order.id], { status: value }, 'Tila päivitettiin')}><SelectTrigger className={cn('h-8 border text-xs font-semibold', statusClass(order.status))}><SelectValue /></SelectTrigger><SelectContent>{(['Avoin', 'Käynnissä', 'Odottaa', 'Valmis', 'Peruttu'] as WorkOrderStatus[]).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>}</td>}
                        {showColumn('priority') && <td className="min-w-32 px-3 py-3"><Select value={order.priority} disabled={saving} onValueChange={(value: WorkOrderPriority) => void runPatch([order.id], { priority: value }, 'Prioriteetti päivitettiin')}><SelectTrigger className={cn('h-8 border text-xs font-semibold', priorityClass(order.priority))}><SelectValue /></SelectTrigger><SelectContent>{(['Korkea', 'Normaali', 'Matala'] as WorkOrderPriority[]).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></td>}
                        {showColumn('hours') && <td className="min-w-40 px-3 py-3"><p className="font-mono text-xs font-semibold text-slate-800">{formatMinutes(order.totalMinutes)} / {formatMinutes(order.estimatedMinutes)}</p>{order.estimatedMinutes !== undefined && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className={cn('h-full rounded-full', order.totalMinutes > order.estimatedMinutes ? 'bg-red-500' : 'bg-blue-500')} style={{ width: `${Math.min(100, order.estimatedMinutes > 0 ? order.totalMinutes / order.estimatedMinutes * 100 : 0)}%` }} /></div>}<p className="mt-1 text-[10px] text-slate-500">Hyväksytty {formatMinutes(order.approvedMinutes)} · odottaa {formatMinutes(order.pendingMinutes)}</p></td>}
                        {showColumn('billing') && <td className="min-w-40 px-3 py-3"><Select value={order.billingStatus} disabled={saving} onValueChange={(value: WorkOrderBillingStatus) => void runPatch([order.id], { billingStatus: value }, 'Laskutuksen tila päivitettiin')}><SelectTrigger className={cn('h-8 border text-xs font-semibold', billingClass(order.billingStatus))}><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(BILLING_LABELS) as WorkOrderBillingStatus[]).map((value) => <SelectItem key={value} value={value}>{BILLING_LABELS[value]}</SelectItem>)}</SelectContent></Select>{order.invoiceReference && <p className="mt-1 font-mono text-[10px] text-slate-500">{order.invoiceReference}</p>}</td>}
                        {showColumn('quantity') && <td className="whitespace-nowrap px-3 py-3 text-xs font-medium text-slate-700">{order.quantity === undefined ? '—' : `${order.quantity.toLocaleString('fi-FI')} ${order.quantityUnit}`}</td>}
                        {showColumn('attention') && <td className="min-w-52 px-3 py-3"><div className="flex flex-wrap gap-1">{order.activeSessionCount > 0 && <Badge className="bg-orange-600"><Timer size={11} className="mr-1" /> Työssä nyt</Badge>}{order.attentionFlags.map((flag) => <Badge key={flag} variant="outline" className={flag === 'overdue' || flag === 'estimate_exceeded' ? 'border-red-200 bg-red-50 text-red-700' : flag === 'pending_review' ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-amber-200 bg-amber-50 text-amber-800'}>{ATTENTION_LABELS[flag]}</Badge>)}</div></td>}
                        {showColumn('actions') && <td className="px-3 py-3"><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => openDetail(order)} aria-label="Avaa"><Eye size={15} /></Button><Button variant="ghost" size="sm" onClick={() => onEdit(order)} aria-label="Muokkaa"><Pencil size={15} /></Button><Button variant="ghost" size="sm" className="text-red-600" onClick={() => onDelete(order)} aria-label="Poista"><Trash2 size={15} /></Button></div></td>}
                      </tr>,
                    ];
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-3 lg:hidden">
              {pageOrders.map((order) => (
                <Card key={order.id} className={cn('overflow-hidden border-slate-200', selectedIds.includes(order.id) && 'ring-2 ring-blue-400', order.activeSessionCount > 0 && 'border-l-4 border-l-orange-500')}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start gap-3"><Checkbox checked={selectedIds.includes(order.id)} onCheckedChange={() => setSelectedIds((current) => toggleValue(current, order.id))} className="mt-1" /><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-1"><Badge variant="outline" className={statusClass(displayStatus(order))}>{displayStatus(order)}</Badge><Badge variant="outline" className={priorityClass(order.priority)}>{order.priority}</Badge>{order.activeSessionCount > 0 && <Badge className="bg-orange-600">Työssä nyt</Badge>}</div><button type="button" onClick={() => openDetail(order)} className="mt-2 text-left font-semibold text-slate-950">{order.title}</button><p className="mt-1 text-xs text-slate-500">{order.workNumber} · {order.project}</p></div></div>
                    <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs"><div><p className="text-slate-400">Asiakas</p><p className="mt-1 font-medium text-slate-700">{order.customerName}</p></div><div><p className="text-slate-400">Määräpäivä</p><p className="mt-1 font-medium text-slate-700">{formatDate(order.dueDate, 'Ei määräpäivää')}</p></div><div className="col-span-2"><p className="text-slate-400">Tekijät</p><p className="mt-1 font-medium text-slate-700">{assignmentLabel(order)}</p></div><div><p className="text-slate-400">Tunnit / arvio</p><p className="mt-1 font-medium text-slate-700">{formatMinutes(order.totalMinutes)} / {formatMinutes(order.estimatedMinutes)}</p></div><div><p className="text-slate-400">Laskutus</p><p className="mt-1 font-medium text-slate-700">{BILLING_LABELS[order.billingStatus]}</p></div></div>
                    {order.attentionFlags.length > 0 && <div className="flex flex-wrap gap-1">{order.attentionFlags.map((flag) => <Badge key={flag} variant="outline" className="text-[10px]">{ATTENTION_LABELS[flag]}</Badge>)}</div>}
                    <div className="flex gap-2 border-t pt-3"><Button variant="outline" size="sm" className="flex-1" onClick={() => openDetail(order)}><Eye size={14} className="mr-1" /> Avaa</Button><Button variant="outline" size="sm" className="flex-1" onClick={() => onEdit(order)}><Pencil size={14} className="mr-1" /> Muokkaa</Button></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        <div className="flex flex-col gap-3 border-t bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">Näytetään {sortedOrders.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sortedOrders.length)} / {sortedOrders.length}</p>
          <div className="flex items-center gap-1"><Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={currentPage === 1}><ChevronsLeft size={15} /></Button><Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1}><ChevronLeft size={15} /></Button><span className="px-3 text-sm font-medium">{currentPage} / {totalPages}</span><Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages}><ChevronRight size={15} /></Button><Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={currentPage === totalPages}><ChevronsRight size={15} /></Button></div>
        </div>
      </Card>

      <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Tallenna nykyinen näkymä</DialogTitle></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label htmlFor="view-name">Näkymän nimi *</Label><Input id="view-name" value={viewName} onChange={(event) => setViewName(event.target.value)} maxLength={80} placeholder="Esimerkiksi viikon kiireelliset työt" /></div><label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"><Checkbox checked={viewDefault} onCheckedChange={(checked) => setViewDefault(checked === true)} className="mt-0.5" /><span><span className="block text-sm font-medium">Avaa tämä oletuksena</span><span className="text-xs text-slate-500">Rajaukset, lajittelu, sivukoko ja sarakkeet palautetaan automaattisesti.</span></span></label></div><DialogFooter><Button variant="outline" onClick={() => setSaveViewOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void saveCurrentView()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna näkymä'}</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={Boolean(bulkAction)} onOpenChange={(open) => { if (!open && !saving) { setBulkAction(null); setBulkValue(''); setBulkAssignees([]); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{bulkAction === 'assignee' ? 'Määritä vastuuhenkilöt' : bulkAction === 'status' ? 'Vaihda tila' : bulkAction === 'priority' ? 'Vaihda prioriteetti' : bulkAction === 'billing' ? 'Vaihda laskutuksen tila' : bulkAction === 'shift' ? 'Siirrä aikataulua' : 'Muuta määräpäivä'}</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">Muutos kohdistuu {selectedIds.length} valittuun työmääräykseen. Kaikki muutokset kirjataan muutoshistoriaan.</p>
          {bulkAction === 'assignee' && <div className="space-y-2"><p className="text-xs text-slate-500">Listassa ovat henkilöt, jotka kuuluvat kaikkien valittujen projektitöiden projektitiimeihin.</p>{eligibleAssignees.map((person) => <label key={person.userId} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"><Checkbox checked={bulkAssignees.includes(person.userId)} onCheckedChange={() => setBulkAssignees((current) => toggleValue(current, person.userId))} /><span className="font-medium">{person.name}</span></label>)}{eligibleAssignees.length === 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Valituilla töillä ei ole yhteistä kelvollista vastuuhenkilöä. Lisää henkilöt ensin projektitiimeihin.</div>}</div>}
          {bulkAction === 'status' && <Select value={bulkValue} onValueChange={setBulkValue}><SelectTrigger><SelectValue placeholder="Valitse tila" /></SelectTrigger><SelectContent>{(['Avoin', 'Käynnissä', 'Odottaa', 'Valmis', 'Peruttu'] as WorkOrderStatus[]).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>}
          {bulkAction === 'priority' && <Select value={bulkValue} onValueChange={setBulkValue}><SelectTrigger><SelectValue placeholder="Valitse prioriteetti" /></SelectTrigger><SelectContent>{(['Korkea', 'Normaali', 'Matala'] as WorkOrderPriority[]).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>}
          {bulkAction === 'billing' && <Select value={bulkValue} onValueChange={setBulkValue}><SelectTrigger><SelectValue placeholder="Valitse laskutuksen tila" /></SelectTrigger><SelectContent>{(Object.keys(BILLING_LABELS) as WorkOrderBillingStatus[]).map((value) => <SelectItem key={value} value={value}>{BILLING_LABELS[value]}</SelectItem>)}</SelectContent></Select>}
          {bulkAction === 'shift' && <div className="space-y-2"><Label htmlFor="shift-days">Siirto päivinä</Label><Input id="shift-days" type="number" value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} placeholder="Esimerkiksi 3 tai -2" /><p className="text-xs text-slate-500">Positiivinen luku siirtää eteenpäin, negatiivinen taaksepäin. Sekä alku- että loppupäivä siirtyvät.</p></div>}
          {bulkAction === 'dueDate' && <div className="space-y-2"><Label htmlFor="bulk-due-date">Uusi määräpäivä</Label><Input id="bulk-due-date" type="date" value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} /><p className="text-xs text-slate-500">Tyhjä päivämäärä poistaa määräpäivän.</p></div>}
          <DialogFooter><Button variant="outline" onClick={() => setBulkAction(null)} disabled={saving}>Peruuta</Button><Button onClick={() => void executeBulkAction()} disabled={saving || (bulkAction === 'assignee' && bulkAssignees.length === 0)}>{saving ? 'Päivitetään…' : 'Vahvista muutos'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(detailOrder)} onOpenChange={(open) => !open && setDetailOrderId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-3xl">
          {detailOrder && <div className="min-h-full bg-slate-50"><SheetHeader className="border-b bg-white p-6 pr-12"><div className="flex flex-wrap gap-2"><Badge variant="outline" className={statusClass(displayStatus(detailOrder))}>{displayStatus(detailOrder)}</Badge><Badge variant="outline" className={priorityClass(detailOrder.priority)}>{detailOrder.priority}</Badge><Badge variant="outline" className={billingClass(detailOrder.billingStatus)}>{BILLING_LABELS[detailOrder.billingStatus]}</Badge>{detailOrder.activeSessionCount > 0 && <Badge className="bg-orange-600">Työssä nyt</Badge>}</div><SheetTitle className="mt-3 text-2xl">{detailOrder.title}</SheetTitle><SheetDescription>{detailOrder.workNumber} · {detailOrder.customerName} · {detailOrder.project}</SheetDescription></SheetHeader>
            <div className="sticky top-0 z-10 flex overflow-x-auto border-b bg-white px-4">{([['summary', 'Yhteenveto', BriefcaseBusiness], ['time', 'Työaika', Clock3], ['billing', 'Laskutus', Receipt], ['history', 'Historia', History]] as const).map(([tab, label, Icon]) => <button key={tab} type="button" onClick={() => setDetailTab(tab)} className={cn('flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium', detailTab === tab ? 'border-orange-500 text-orange-700' : 'border-transparent text-slate-500')}><Icon size={15} /> {label}</button>)}</div>
            <div className="space-y-5 p-5">
              {detailTab === 'summary' && <><Card><CardContent className="grid gap-4 p-5 sm:grid-cols-2"><div className="flex items-start gap-3"><Building2 size={18} className="mt-0.5 text-slate-400" /><div><p className="text-xs uppercase tracking-wide text-slate-400">Asiakas</p><p className="font-medium text-slate-800">{detailOrder.customerName}</p></div></div><div className="flex items-start gap-3"><BriefcaseBusiness size={18} className="mt-0.5 text-slate-400" /><div><p className="text-xs uppercase tracking-wide text-slate-400">Projekti</p><p className="font-medium text-slate-800">{detailOrder.project}</p></div></div><div className="flex items-start gap-3"><MapPin size={18} className="mt-0.5 text-slate-400" /><div><p className="text-xs uppercase tracking-wide text-slate-400">Kohde</p><p className="font-medium text-slate-800">{detailOrder.location || detailOrder.projectLocation || 'Ei määritetty'}</p></div></div><div className="flex items-start gap-3"><CalendarDays size={18} className="mt-0.5 text-slate-400" /><div><p className="text-xs uppercase tracking-wide text-slate-400">Aikataulu</p><p className="font-medium text-slate-800">{detailOrder.plannedStartDate ? `${formatDate(detailOrder.plannedStartDate)}–${formatDate(detailOrder.plannedEndDate)}` : 'Ei työjaksoa'}</p><p className="text-xs text-slate-500">Määräpäivä {formatDate(detailOrder.dueDate, 'puuttuu')}</p></div></div><div className="flex items-start gap-3 sm:col-span-2"><UsersRound size={18} className="mt-0.5 text-slate-400" /><div><p className="text-xs uppercase tracking-wide text-slate-400">Vastuuhenkilöt</p><p className="font-medium text-slate-800">{assignmentLabel(detailOrder)}</p></div></div>{detailOrder.description && <div className="sm:col-span-2"><p className="text-xs uppercase tracking-wide text-slate-400">Työkuvaus</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{detailOrder.description}</p></div>}</CardContent></Card>
                {detailOrder.attentionFlags.length > 0 && <Card className="border-amber-200 bg-amber-50"><CardContent className="p-4"><p className="flex items-center gap-2 font-semibold text-amber-950"><AlertTriangle size={17} /> Vaatii huomiota</p><div className="mt-3 flex flex-wrap gap-2">{detailOrder.attentionFlags.map((flag) => <Badge key={flag} variant="outline" className="border-amber-300 bg-white text-amber-900">{ATTENTION_LABELS[flag]}</Badge>)}</div></CardContent></Card>}
                {detailOrder.completionRequestedAt && !detailOrder.completionApproved && <Card className="border-violet-200 bg-violet-50"><CardContent className="space-y-3 p-5"><p className="font-semibold text-violet-950">Valmistumispyyntö</p><p className="text-xs text-violet-700">{detailOrder.completionRequesterName ?? 'Työntekijä'} · {formatDateTime(detailOrder.completionRequestedAt)}</p><p className="whitespace-pre-wrap text-sm leading-6 text-violet-950">{detailOrder.completionRequestNote}</p><div className="flex flex-wrap gap-2"><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => onReview(detailOrder, true)}><CheckCircle2 size={15} className="mr-2" /> Hyväksy valmiiksi</Button><Button variant="outline" onClick={() => onReview(detailOrder, false)}>Palauta jatkettavaksi</Button></div></CardContent></Card>}
                <Card><CardContent className="space-y-4 p-5"><div><p className="font-semibold text-slate-950">Ohjaus- ja laskentatiedot</p><p className="text-xs text-slate-500">Tiedot vaikuttavat tuntipoikkeamiin, määrälaskentaan ja laskutusvalmiuden seurantaan.</p></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="metadata-estimate">Tuntiarvio</Label><Input id="metadata-estimate" inputMode="decimal" value={metadataEstimate} onChange={(event) => setMetadataEstimate(event.target.value)} placeholder="Esimerkiksi 8" /></div><div className="grid grid-cols-[1fr_7rem] gap-2"><div className="space-y-2"><Label htmlFor="metadata-quantity">Määrä</Label><Input id="metadata-quantity" inputMode="decimal" value={metadataQuantity} onChange={(event) => setMetadataQuantity(event.target.value)} placeholder="Esimerkiksi 45" /></div><div className="space-y-2"><Label htmlFor="metadata-unit">Yksikkö</Label><Input id="metadata-unit" value={metadataUnit} onChange={(event) => setMetadataUnit(event.target.value)} placeholder="m²" maxLength={24} /></div></div></div><label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"><Checkbox checked={metadataBillable} onCheckedChange={(checked) => setMetadataBillable(checked === true)} /><span><span className="block text-sm font-medium">Työ on laskutettava</span><span className="text-xs text-slate-500">Valmis työ nostetaan laskutusvalmiiden seurantaan.</span></span></label><Button onClick={() => void saveMetadata()} disabled={saving} className="w-full gap-2"><Save size={15} /> {saving ? 'Tallennetaan…' : 'Tallenna ohjaustiedot'}</Button></CardContent></Card>
                <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => onEdit(detailOrder)}><Pencil size={15} className="mr-2" /> Muokkaa työmääräystä</Button><Button variant="outline" className="text-red-600" onClick={() => onDelete(detailOrder)}><Trash2 size={15} className="mr-2" /> Poista</Button></div>
              </>}

              {detailTab === 'time' && <Card><CardContent className="p-0"><div className="border-b p-5"><p className="font-semibold text-slate-950">Tunnit ja työselosteet</p><p className="mt-1 text-sm text-slate-500">Yhteensä {formatMinutes(detailOrder.totalMinutes)}, hyväksytty {formatMinutes(detailOrder.approvedMinutes)} ja odottaa {formatMinutes(detailOrder.pendingMinutes)}.</p></div>{insightsQuery.isLoading ? <div className="p-8 text-center text-slate-500">Ladataan…</div> : (insightsQuery.data?.timeLines ?? []).length === 0 ? <div className="p-8 text-center text-sm text-slate-500">Työmääräykselle ei ole vielä tuntikirjauksia.</div> : <div className="divide-y">{insightsQuery.data?.timeLines.map((line) => <div key={line.id} className="p-5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-slate-900">{line.employee}</p><div className="flex gap-2"><Badge variant="outline">{line.status}</Badge><Badge variant="outline" className={billingClass(line.billingStatus)}>{BILLING_LABELS[line.billingStatus]}</Badge></div></div><p className="mt-1 text-xs text-slate-500">{formatDate(line.date)} · {line.hours.toLocaleString('fi-FI')} h{line.overtime > 0 ? ` · ylityö ${line.overtime.toLocaleString('fi-FI')} h` : ''}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{line.description || 'Ei työselostetta'}</p></div>)}</div>}</CardContent></Card>}

              {detailTab === 'billing' && <div className="space-y-4"><Card><CardContent className="grid gap-4 p-5 sm:grid-cols-3"><div><p className="text-xs uppercase tracking-wide text-slate-400">Tila</p><Badge variant="outline" className={cn('mt-2', billingClass(detailOrder.billingStatus))}>{BILLING_LABELS[detailOrder.billingStatus]}</Badge></div><div><p className="text-xs uppercase tracking-wide text-slate-400">Laskutusrivejä</p><p className="mt-1 text-2xl font-bold">{detailOrder.billingItemCount}</p></div><div><p className="text-xs uppercase tracking-wide text-slate-400">Veroton arvo</p><p className="mt-1 text-2xl font-bold">{formatMoney(detailOrder.billingTotalCents)}</p></div>{detailOrder.invoiceReference && <div className="sm:col-span-3"><p className="text-xs uppercase tracking-wide text-slate-400">Laskuviite</p><p className="mt-1 font-mono text-sm">{detailOrder.invoiceReference}</p></div>}</CardContent></Card><Card><CardContent className="p-0"><div className="border-b p-5"><p className="font-semibold">Laskutusrivit</p></div>{insightsQuery.isLoading ? <div className="p-8 text-center text-slate-500">Ladataan…</div> : (insightsQuery.data?.billingLines ?? []).length === 0 ? <div className="p-8 text-center text-sm text-slate-500">Työmääräykselle ei ole muodostettu laskutusrivejä.</div> : <div className="divide-y">{insightsQuery.data?.billingLines.map((line) => <div key={line.id} className="grid gap-2 p-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-medium text-slate-900">{line.description}</p><p className="mt-1 text-xs text-slate-500">{line.quantity.toLocaleString('fi-FI')} {line.unit} · {formatDateTime(line.createdAt)}</p></div><div className="text-right"><p className="font-semibold">{formatMoney(line.totalExVatCents)}</p><Badge variant="outline" className={cn('mt-1', billingClass(line.status))}>{BILLING_LABELS[line.status]}</Badge></div></div>)}</div>}</CardContent></Card></div>}

              {detailTab === 'history' && <Card><CardContent className="p-0"><div className="border-b p-5"><p className="font-semibold">Muutoshistoria</p><p className="mt-1 text-sm text-slate-500">Työmääräyksen luonti, muokkaukset ja massatoiminnot.</p></div>{insightsQuery.isLoading ? <div className="p-8 text-center text-slate-500">Ladataan…</div> : (insightsQuery.data?.auditEvents ?? []).length === 0 ? <div className="p-8 text-center text-sm text-slate-500">Muutoshistoriaa ei löytynyt.</div> : <div className="divide-y">{insightsQuery.data?.auditEvents.map((event) => <div key={event.id} className="flex gap-3 p-5"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"><History size={15} /></div><div className="min-w-0"><p className="font-medium text-slate-900">{event.action === 'work_order_created' ? 'Työmääräys luotiin' : event.action === 'work_order_updated' ? 'Työmääräystä muokattiin' : event.action === 'work_order_bulk_updated' ? 'Työmääräys päivitettiin ohjauspaneelista' : event.action}</p><p className="mt-1 text-xs text-slate-500">{people.find((person) => person.userId === event.userId)?.name ?? 'Järjestelmä'} · {formatDateTime(event.createdAt)}</p><pre className="mt-2 max-w-full overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[11px] text-slate-600">{JSON.stringify(event.metadata, null, 2)}</pre></div></div>)}</div>}</CardContent></Card>}
            </div>
          </div>}
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(userTarget)} onOpenChange={(open) => !open && setUserTargetId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {userTarget && (() => {
            const personOrders = controlledOrders.filter((order) => order.assigneeUserIds.includes(userTarget.userId));
            const activeOrders = personOrders.filter((order) => order.activeSessionUserIds.includes(userTarget.userId));
            const currentWeekStart = new Date();
            currentWeekStart.setHours(0, 0, 0, 0);
            currentWeekStart.setDate(currentWeekStart.getDate() - ((currentWeekStart.getDay() || 7) - 1));
            const currentWeekEnd = new Date(currentWeekStart);
            currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);
            const weekOrders = personOrders.filter((order) => {
              if (!order.plannedStartDate) return false;
              const start = new Date(`${order.plannedStartDate}T12:00:00`);
              return start >= currentWeekStart && start <= currentWeekEnd;
            });
            const weekEstimate = weekOrders.reduce((sum, order) => sum + (order.estimatedMinutes ?? 0), 0);
            return <><SheetHeader><SheetTitle>{userTarget.name}</SheetTitle><SheetDescription>{userTarget.role === 'worker' ? 'Työntekijä' : userTarget.role === 'supervisor' ? 'Työnjohtaja' : userTarget.role === 'project_coordinator' ? 'Projektikoordinaattori' : 'Ylläpitäjä'}</SheetDescription></SheetHeader><div className="mt-6 space-y-5">{activeOrders.length > 0 && <Card className="border-orange-200 bg-orange-50"><CardContent className="p-4"><p className="flex items-center gap-2 font-semibold text-orange-950"><Activity size={17} /> Työaika käynnissä</p>{activeOrders.map((order) => <button key={order.id} type="button" onClick={() => { setUserTargetId(null); openDetail(order); }} className="mt-3 block text-left text-sm font-medium text-orange-800 hover:underline">{order.title}</button>)}</CardContent></Card>}<div className="grid grid-cols-2 gap-3"><Card><CardContent className="p-4"><p className="text-xs text-slate-500">Työmääräyksiä</p><p className="mt-1 text-2xl font-bold">{personOrders.length}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-slate-500">Tämän viikon arvio</p><p className="mt-1 text-2xl font-bold">{formatMinutes(weekEstimate)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-slate-500">Käynnissä</p><p className="mt-1 text-2xl font-bold text-orange-700">{personOrders.filter((order) => order.status === 'Käynnissä').length}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-slate-500">Myöhässä</p><p className="mt-1 text-2xl font-bold text-red-700">{personOrders.filter((order) => order.attentionFlags.includes('overdue')).length}</p></CardContent></Card></div><Card><CardContent className="p-0"><div className="border-b p-4"><p className="font-semibold">Työmääräykset</p></div><div className="divide-y">{personOrders.slice(0, 20).map((order) => <button key={order.id} type="button" onClick={() => { setUserTargetId(null); openDetail(order); }} className="block w-full p-4 text-left hover:bg-slate-50"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-slate-900">{order.title}</p><p className="mt-1 text-xs text-slate-500">{order.project} · {formatDate(order.dueDate, 'ei määräpäivää')}</p></div><Badge variant="outline" className={statusClass(displayStatus(order))}>{displayStatus(order)}</Badge></div></button>)}</div></CardContent></Card><Button className="w-full" onClick={() => { setFilters({ ...defaultFilters(projectFilterId), assigneeIds: [userTarget.userId] }); setUserTargetId(null); setPage(1); }}>Näytä henkilön kaikki työt taulukossa</Button></div></>;
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}
