import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BellRing,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FolderKanban,
  HardHat,
  Home,
  KeyRound,
  Link2,
  Loader2,
  MapPin,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Search,
  Trash2,
  UserRound,
  UsersRound,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import { deleteManagedWorkOrders } from '@/lib/supabase/workOrderBulkDelete';
import {
  saveManagedWorkOrder,
  transitionMyWorkOrder,
  type ManagedWorkOrder,
} from '@/lib/supabase/workManagement';
import { cn } from '@/lib/utils';
import type { WorkOrderPriority, WorkOrderStatus } from '@/types';
import WorkOrderDialog from './workOrders/WorkOrderDialog';
import {
  EMPTY_WORK_ORDER_FORM,
  type WorkOrderFormValues,
} from './workOrders/workOrderForm';

const ALL = 'Kaikki';
type ScopeFilter = 'all' | 'standalone' | 'project';

const WEEKDAY_LABELS: Record<number, string> = {
  1: 'ma',
  2: 'ti',
  3: 'ke',
  4: 'to',
  5: 'pe',
  6: 'la',
  7: 'su',
};

function formatDate(value: string, empty = 'Ei määritetty') {
  if (!value) return empty;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

function formatSchedule(order: ManagedWorkOrder) {
  if (!order.plannedStartDate) return 'Ei työjaksoa';
  const dates = order.plannedEndDate && order.plannedEndDate !== order.plannedStartDate
    ? `${formatDate(order.plannedStartDate)}–${formatDate(order.plannedEndDate)}`
    : formatDate(order.plannedStartDate);
  const weekdays = order.plannedWeekdays.map((weekday) => WEEKDAY_LABELS[weekday]).filter(Boolean).join(', ');
  return `${dates} · ${order.plannedStartTime}–${order.plannedEndTime}${weekdays ? ` · ${weekdays}` : ''}`;
}

function occupancyLabel(order: ManagedWorkOrder) {
  switch (order.occupancyStatus) {
    case 'occupied': return 'Asuttu työn aikana';
    case 'vacant': return 'Tyhjä / asumaton';
    case 'partly_occupied': return 'Osittain käytössä';
    default: return 'Asumistilanne ei tiedossa';
  }
}

function statusBadge(status: WorkOrderStatus) {
  const styles: Record<WorkOrderStatus, string> = {
    Avoin: 'border-blue-200 bg-blue-50 text-blue-700',
    Käynnissä: 'border-orange-200 bg-orange-50 text-orange-700',
    Odottaa: 'border-amber-200 bg-amber-50 text-amber-700',
    Valmis: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Peruttu: 'border-slate-200 bg-slate-50 text-slate-600',
  };
  return <Badge variant="outline" className={styles[status]}>{status}</Badge>;
}

function priorityBadge(priority: WorkOrderPriority) {
  const styles: Record<WorkOrderPriority, string> = {
    Korkea: 'border-red-200 bg-red-50 text-red-700',
    Normaali: 'border-slate-200 bg-slate-50 text-slate-700',
    Matala: 'border-blue-100 bg-blue-50 text-blue-600',
  };
  return <Badge variant="outline" className={styles[priority]}>{priority}</Badge>;
}

function assignmentLabel(order: ManagedWorkOrder) {
  if (order.assignmentScope === 'project_team') return 'Koko projektitiimi';
  if (order.assigneeNames.length > 0) return order.assigneeNames.join(', ');
  return 'Vastuuhenkilö puuttuu';
}

function contextLabel(order: ManagedWorkOrder) {
  return order.projectId ? order.project : 'Yksittäinen työ';
}

function canSelectForDeletion(order: ManagedWorkOrder) {
  return order.status !== 'Käynnissä';
}

export default function Tyomaaraykset() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentOrg, currentRole } = useOrganization();
  const { projects, refresh: refreshDomain } = useAppDataContext();
  const {
    people,
    projectMemberships,
    workOrders,
    canManage,
    loading,
    error,
    refresh,
  } = useRoleWorkspace();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedWorkOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedWorkOrder | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [transitionTarget, setTransitionTarget] = useState<ManagedWorkOrder | null>(null);
  const [transitionStatus, setTransitionStatus] = useState<'Odottaa' | 'Valmis'>('Valmis');
  const [workerNote, setWorkerNote] = useState('');
  const [form, setForm] = useState<WorkOrderFormValues>(EMPTY_WORK_ORDER_FORM);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canDelete = canManage && (currentRole === 'admin' || currentRole === 'supervisor');
  const projectFilterId = new URLSearchParams(location.search).get('project') ?? '';
  const selectedProject = projects.find((project) => project.id === projectFilterId);
  const standaloneCount = workOrders.filter((order) => !order.projectId).length;

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fi');
    return workOrders.filter((order) => {
      const matchesSearch = !query || [
        order.title,
        order.project,
        order.location,
        order.description,
        order.type,
        order.workReference,
        order.startConstraints,
        order.accessNotes,
        assignmentLabel(order),
      ].some((value) => value.toLocaleLowerCase('fi').includes(query));
      const matchesStatus = statusFilter === ALL || order.status === statusFilter;
      const matchesProjectQuery = !projectFilterId || order.projectId === projectFilterId;
      const matchesScope = scopeFilter === 'all'
        || (scopeFilter === 'standalone' && !order.projectId)
        || (scopeFilter === 'project' && Boolean(order.projectId));
      return matchesSearch && matchesStatus && matchesProjectQuery && matchesScope;
    });
  }, [projectFilterId, scopeFilter, search, statusFilter, workOrders]);

  const selectableVisibleOrders = useMemo(
    () => filteredOrders.filter(canSelectForDeletion),
    [filteredOrders],
  );
  const selectedOrders = useMemo(
    () => workOrders.filter((order) => selectedOrderIds.has(order.id)),
    [selectedOrderIds, workOrders],
  );
  const allVisibleSelected = selectableVisibleOrders.length > 0
    && selectableVisibleOrders.every((order) => selectedOrderIds.has(order.id));
  const someVisibleSelected = selectableVisibleOrders.some((order) => selectedOrderIds.has(order.id));

  const activeOrders = workOrders.filter((order) => order.status === 'Käynnissä');
  const openOrders = workOrders.filter((order) => order.status === 'Avoin');
  const waitingOrders = workOrders.filter((order) => order.status === 'Odottaa');
  const doneOrders = workOrders.filter((order) => order.status === 'Valmis');

  const selectedProjectMemberIds = new Set(
    projectMemberships
      .filter((membership) => membership.projectId === form.projectId)
      .map((membership) => membership.userId),
  );
  const organizationUserIds = new Set(people.map((person) => person.userId));

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const projectId = params.get('project');
    if (!canManage || params.get('new') !== '1' || !projectId || !projects.some((project) => project.id === projectId)) return;

    setEditing(null);
    setForm({ ...EMPTY_WORK_ORDER_FORM, projectId });
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
    navigate(`/tyomaaraykset?project=${encodeURIComponent(projectId)}`, { replace: true });
  }, [canManage, location.search, navigate, projects]);

  useEffect(() => {
    const existingIds = new Set(workOrders.map((order) => order.id));
    setSelectedOrderIds((current) => {
      const next = new Set([...current].filter((id) => existingIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [workOrders]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_WORK_ORDER_FORM, projectId: projectFilterId });
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const openEdit = (order: ManagedWorkOrder) => {
    setEditing(order);
    setForm({
      title: order.title,
      projectId: order.projectId ?? '',
      location: order.location,
      dueDate: order.dueDate,
      plannedStartDate: order.plannedStartDate,
      plannedEndDate: order.plannedEndDate,
      plannedStartTime: order.plannedStartTime,
      plannedEndTime: order.plannedEndTime,
      plannedWeekdays: order.plannedWeekdays,
      calendarSyncEnabled: order.calendarSyncEnabled,
      occupancyStatus: order.occupancyStatus,
      workReference: order.workReference,
      startConstraints: order.startConstraints,
      accessNotes: order.accessNotes,
      residentNotificationRequired: order.residentNotificationRequired,
      priority: order.priority,
      status: order.status,
      type: order.type,
      description: order.description,
      assignmentScope: order.projectId ? order.assignmentScope : 'people',
      assigneeUserIds: order.assigneeUserIds,
    });
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const validateForm = () => {
    const nextErrors: string[] = [];
    if (!form.title.trim()) nextErrors.push('Työmääräyksen otsikko on pakollinen.');
    if (form.assignmentScope === 'people' && form.assigneeUserIds.length === 0) {
      nextErrors.push('Valitse vähintään yksi vastuuhenkilö.');
    }
    if (!form.projectId && form.assignmentScope === 'project_team') {
      nextErrors.push('Koko projektitiimi voidaan valita vain projektiin liitetylle työmääräykselle.');
    }
    if (form.projectId && form.assignmentScope === 'people' && form.assigneeUserIds.some((userId) => !selectedProjectMemberIds.has(userId))) {
      nextErrors.push('Projektiin liitetyn työmääräyksen vastuuhenkilöiden täytyy kuulua projektitiimiin.');
    }
    if (!form.projectId && form.assigneeUserIds.some((userId) => !organizationUserIds.has(userId))) {
      nextErrors.push('Vastuuhenkilön täytyy kuulua organisaatioon.');
    }
    if (form.projectId && form.assignmentScope === 'project_team' && selectedProjectMemberIds.size === 0) {
      nextErrors.push('Valitulla projektilla ei ole projektitiimiä. Lisää tiimi ensin Projektit ja tiimit -näkymässä.');
    }
    if (form.plannedEndDate && !form.plannedStartDate) {
      nextErrors.push('Valitse työn aloituspäivä ennen suunniteltua valmistumista.');
    }
    if (form.plannedStartDate && !form.plannedEndDate) {
      nextErrors.push('Valitse suunniteltu valmistumispäivä.');
    }
    if (form.plannedStartDate && form.plannedEndDate < form.plannedStartDate) {
      nextErrors.push('Suunniteltu valmistuminen ei voi olla ennen aloituspäivää.');
    }
    if (form.plannedStartDate && form.plannedEndTime <= form.plannedStartTime) {
      nextErrors.push('Päivittäisen päättymisajan pitää olla alkamisajan jälkeen.');
    }
    if (form.plannedStartDate && form.plannedWeekdays.length === 0) {
      nextErrors.push('Valitse vähintään yksi työpäivä.');
    }
    if (form.dueDate && form.plannedEndDate && form.dueDate < form.plannedEndDate) {
      nextErrors.push('Viimeistään valmis -päivä ei voi olla ennen suunniteltua valmistumista.');
    }
    return nextErrors;
  };

  const save = async () => {
    const nextErrors = validateForm();
    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg || !canManage) return;

    setSaving(true);
    setOperationError(null);
    try {
      await saveManagedWorkOrder({
        organizationId: currentOrg.id,
        workOrderId: editing?.id,
        projectId: form.projectId || undefined,
        title: form.title.trim(),
        location: form.location.trim(),
        dueDate: form.dueDate,
        plannedStartDate: form.plannedStartDate,
        plannedEndDate: form.plannedEndDate,
        plannedStartTime: form.plannedStartTime,
        plannedEndTime: form.plannedEndTime,
        plannedWeekdays: form.plannedWeekdays,
        calendarSyncEnabled: form.calendarSyncEnabled,
        occupancyStatus: form.occupancyStatus,
        workReference: form.workReference.trim(),
        startConstraints: form.startConstraints.trim(),
        accessNotes: form.accessNotes.trim(),
        residentNotificationRequired: form.residentNotificationRequired,
        priority: form.priority,
        status: form.status,
        description: form.description.trim(),
        type: form.type.trim(),
        assignmentScope: form.projectId ? form.assignmentScope : 'people',
        assigneeUserIds: form.assignmentScope === 'people' ? form.assigneeUserIds : [],
      });
      await Promise.all([refresh(), refreshDomain()]);
      setDialogOpen(false);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const removeOrders = async (ids: string[]) => {
    if (!currentOrg || !canDelete || ids.length === 0) return;
    setSaving(true);
    setOperationError(null);
    try {
      await deleteManagedWorkOrders({
        organizationId: currentOrg.id,
        workOrderIds: ids,
      });
      setSelectedOrderIds((current) => {
        const next = new Set(current);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      setDeleteTarget(null);
      setBulkDeleteOpen(false);
      await Promise.all([refresh(), refreshDomain()]);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const toggleOrderSelection = (orderId: string, selected: boolean) => {
    setSelectedOrderIds((current) => {
      const next = new Set(current);
      if (selected) next.add(orderId);
      else next.delete(orderId);
      return next;
    });
  };

  const toggleVisibleSelection = (selected: boolean) => {
    setSelectedOrderIds((current) => {
      const next = new Set(current);
      selectableVisibleOrders.forEach((order) => {
        if (selected) next.add(order.id);
        else next.delete(order.id);
      });
      return next;
    });
  };

  const runTransition = async (
    order: ManagedWorkOrder,
    nextStatus: 'Käynnissä' | 'Odottaa' | 'Valmis',
    note = '',
  ) => {
    setSaving(true);
    setOperationError(null);
    try {
      await transitionMyWorkOrder({
        workOrderId: order.id,
        status: nextStatus,
        workerNote: note,
      });
      await Promise.all([refresh(), refreshDomain()]);
      setTransitionTarget(null);
      setWorkerNote('');
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tilan päivitys epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const openTransition = (order: ManagedWorkOrder, nextStatus: 'Odottaa' | 'Valmis') => {
    setTransitionTarget(order);
    setTransitionStatus(nextStatus);
    setWorkerNote(order.workerNote);
    setOperationError(null);
  };

  const pageTitle = canManage ? 'Työmääräysten ohjaus' : 'Minun työni';
  const pageDescription = canManage
    ? 'Määritä työn vastuut, aloitusehdot ja aikataulu. Työjaksot siirtyvät automaattisesti resurssikalenteriin.'
    : 'Näet sinulle määrätyt työt, työjakson, kohdeohjeet ja viimeisen valmistumispäivän.';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-[1500px] space-y-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
              {canManage ? <HardHat size={16} /> : <ClipboardList size={16} />}
              {canManage ? 'Työn ohjaus' : 'Työntekijän työtila'}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{pageTitle}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{pageDescription}</p>
          </div>
          {canManage && (
            <Button onClick={openCreate} className="gap-2 bg-orange-500 text-white hover:bg-orange-600">
              <Plus size={17} /> Uusi työmääräys
            </Button>
          )}
        </div>
      </div>

      {(error || operationError) && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={17} /> {operationError ?? error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: 'Avoimet', value: openOrders.length, icon: ClipboardList, tone: 'bg-blue-50 text-blue-700' },
          { label: 'Käynnissä', value: activeOrders.length, icon: PlayCircle, tone: 'bg-orange-50 text-orange-700' },
          { label: 'Odottaa', value: waitingOrders.length, icon: PauseCircle, tone: 'bg-amber-50 text-amber-700' },
          { label: 'Valmiit', value: doneOrders.length, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
          { label: 'Ilman projektia', value: standaloneCount, icon: BriefcaseBusiness, tone: 'bg-violet-50 text-violet-700' },
        ].map((item) => (
          <Card key={item.label} className="border-slate-200 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{item.label}</p>
                  <p className="mt-2 font-mono text-3xl font-bold text-slate-950">{item.value}</p>
                </div>
                <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', item.tone)}><item.icon size={21} /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_auto_20rem] lg:items-center">
        <div className="flex flex-wrap gap-2">
          {[ALL, 'Avoin', 'Käynnissä', 'Odottaa', 'Valmis'].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStatusFilter(item)}
              className={cn(
                'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                statusFilter === item
                  ? 'border-orange-300 bg-orange-50 text-orange-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <Select value={scopeFilter} onValueChange={(value) => setScopeFilter(value as ScopeFilter)}>
          <SelectTrigger className="w-full lg:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Kaikki työt</SelectItem>
            <SelectItem value="standalone">Ilman projektia</SelectItem>
            <SelectItem value="project">Projekteihin liitetyt</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Hae tehtävää, viitettä, sijaintia tai projektia…"
            className="pl-9"
          />
        </div>
      </div>

      {canDelete && !loading && filteredOrders.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-visible-work-orders"
                checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                disabled={selectableVisibleOrders.length === 0 || saving}
                onCheckedChange={(checked) => toggleVisibleSelection(checked === true)}
              />
              <Label htmlFor="select-visible-work-orders" className="cursor-pointer text-sm font-medium text-slate-700">
                Valitse poistettavat näkyvät
              </Label>
            </div>
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
              {selectedOrderIds.size} valittu
            </Badge>
            {filteredOrders.length !== selectableVisibleOrders.length && (
              <span className="text-xs text-slate-500">Käynnissä olevia töitä ei voi valita poistettavaksi.</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() => setSelectedOrderIds(new Set())}
              disabled={selectedOrderIds.size === 0 || saving}
            >
              Tyhjennä valinta
            </Button>
            <Button
              variant="destructive"
              className="gap-2"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={selectedOrderIds.size === 0 || saving}
            >
              <Trash2 size={16} /> Poista valitut ({selectedOrderIds.size})
            </Button>
          </div>
        </div>
      )}

      {selectedProject && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          <span>Projektin <strong>{selectedProject.name}</strong> työmääräykset</span>
          <Button variant="ghost" size="sm" onClick={() => navigate('/tyomaaraykset')}>Näytä kaikki</Button>
        </div>
      )}

      {loading && (
        <div className="flex min-h-48 items-center justify-center text-slate-500">
          <Loader2 size={24} className="mr-2 animate-spin" /> Ladataan työmääräyksiä…
        </div>
      )}

      {!loading && (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredOrders.map((order) => {
            const selected = selectedOrderIds.has(order.id);
            const deletionBlocked = !canSelectForDeletion(order);
            return (
              <Card
                key={order.id}
                className={cn(
                  'overflow-hidden border-slate-200 shadow-sm transition-shadow hover:shadow-md',
                  order.priority === 'Korkea' && !['Valmis', 'Peruttu'].includes(order.status) && 'border-l-4 border-l-red-500',
                  selected && 'ring-2 ring-red-300 ring-offset-1',
                )}
              >
                <CardContent className="p-0">
                  <div className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        {canDelete && (
                          <Checkbox
                            checked={selected}
                            disabled={deletionBlocked || saving}
                            onCheckedChange={(checked) => toggleOrderSelection(order.id, checked === true)}
                            aria-label={deletionBlocked
                              ? `Työmääräystä ${order.title} ei voi poistaa aktiivisen työn aikana`
                              : `Valitse työmääräys ${order.title} poistettavaksi`}
                            className="mt-1"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap gap-2">
                            {statusBadge(order.status)}
                            {priorityBadge(order.priority)}
                            <Badge variant="outline" className={order.projectId ? 'border-slate-200 bg-white text-slate-600' : 'border-violet-200 bg-violet-50 text-violet-700'}>
                              {order.projectId ? <FolderKanban size={13} className="mr-1" /> : <BriefcaseBusiness size={13} className="mr-1" />}
                              {contextLabel(order)}
                            </Badge>
                            {order.plannedStartDate && order.calendarSyncEnabled && (
                              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                                <CalendarClock size={13} className="mr-1" /> Kalenterissa
                              </Badge>
                            )}
                          </div>
                          <h2 className="text-lg font-semibold text-slate-950">{order.title}</h2>
                          {order.type && <p className="mt-1 text-sm text-slate-500">{order.type}</p>}
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(order)} aria-label={`Muokkaa ${order.title}`}><Pencil size={16} /></Button>
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600"
                              onClick={() => setDeleteTarget(order)}
                              disabled={deletionBlocked || saving}
                              title={deletionBlocked ? 'Päätä aktiivinen työ ennen poistamista.' : undefined}
                              aria-label={`Poista ${order.title}`}
                            >
                              <Trash2 size={16} />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {order.description && <p className="text-sm leading-6 text-slate-600">{order.description}</p>}

                    <div className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                      <div className="flex items-start gap-2 sm:col-span-2">
                        <CalendarClock size={16} className="mt-0.5 text-slate-400" />
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-400">Suunniteltu työjakso</p>
                          <p className="text-sm font-medium text-slate-700">{formatSchedule(order)}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <CalendarDays size={16} className="mt-0.5 text-slate-400" />
                        <div><p className="text-xs uppercase tracking-wide text-slate-400">Viimeistään valmis</p><p className="text-sm font-medium text-slate-700">{formatDate(order.dueDate, 'Ei takarajaa')}</p></div>
                      </div>
                      <div className="flex items-start gap-2">
                        {order.assignmentScope === 'project_team'
                          ? <UsersRound size={16} className="mt-0.5 text-slate-400" />
                          : <UserRound size={16} className="mt-0.5 text-slate-400" />}
                        <div><p className="text-xs uppercase tracking-wide text-slate-400">Vastuu</p><p className="text-sm font-medium text-slate-700">{assignmentLabel(order)}</p></div>
                      </div>
                      {order.location && (
                        <div className="flex items-start gap-2 sm:col-span-2">
                          <MapPin size={16} className="mt-0.5 text-slate-400" />
                          <div><p className="text-xs uppercase tracking-wide text-slate-400">Kohde tai sijainti</p><p className="text-sm font-medium text-slate-700">{order.location}</p></div>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <Home size={16} className="mt-0.5 text-slate-400" />
                        <div><p className="text-xs uppercase tracking-wide text-slate-400">Kohteen käyttö</p><p className="text-sm font-medium text-slate-700">{occupancyLabel(order)}</p></div>
                      </div>
                      {order.workReference && (
                        <div className="flex items-start gap-2">
                          <Link2 size={16} className="mt-0.5 text-slate-400" />
                          <div><p className="text-xs uppercase tracking-wide text-slate-400">Työn viite</p><p className="text-sm font-medium text-slate-700">{order.workReference}</p></div>
                        </div>
                      )}
                    </div>

                    {(order.residentNotificationRequired || order.startConstraints || order.accessNotes) && (
                      <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                        {order.residentNotificationRequired && (
                          <p className="flex items-start gap-2 font-semibold"><BellRing size={16} className="mt-0.5 shrink-0" /> Ilmoita asukkaalle tai tilan käyttäjälle ennen aloitusta.</p>
                        )}
                        {order.startConstraints && <p><strong>Aloitusehdot:</strong> {order.startConstraints}</p>}
                        {order.accessNotes && <p className="flex items-start gap-2"><KeyRound size={16} className="mt-0.5 shrink-0" /><span><strong>Pääsy ja avaimet:</strong> {order.accessNotes}</span></p>}
                      </div>
                    )}

                    {order.workerNote && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        <strong>Työhuomio:</strong> {order.workerNote}
                      </div>
                    )}

                    {!canManage && !['Valmis', 'Peruttu'].includes(order.status) && (
                      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                        {order.status === 'Avoin' && <Button onClick={() => void runTransition(order, 'Käynnissä')} disabled={saving} className="gap-2"><PlayCircle size={16} /> Aloita työ</Button>}
                        {order.status === 'Odottaa' && <Button onClick={() => void runTransition(order, 'Käynnissä')} disabled={saving} className="gap-2"><PlayCircle size={16} /> Jatka työtä</Button>}
                        {order.status === 'Käynnissä' && <Button variant="outline" onClick={() => openTransition(order, 'Odottaa')} disabled={saving} className="gap-2"><PauseCircle size={16} /> Keskeytä</Button>}
                        {['Käynnissä', 'Odottaa'].includes(order.status) && <Button onClick={() => openTransition(order, 'Valmis')} disabled={saving} className="gap-2 bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 size={16} /> Merkitse valmiiksi</Button>}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && filteredOrders.length === 0 && (
        <Card className="border-dashed border-slate-300">
          <CardContent className="p-12 text-center">
            <ClipboardList size={46} className="mx-auto mb-3 text-slate-300" />
            <h2 className="font-semibold text-slate-800">{canManage ? 'Työmääräyksiä ei löytynyt' : 'Sinulle ei ole määrätty töitä'}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {canManage
                ? 'Muuta suodatusta tai luo uusi työmääräys. Projektia ei tarvitse valita.'
                : 'Uudet tehtävät näkyvät tässä, kun työnjohto kohdistaa ne sinulle tai projektitiimillesi.'}
            </p>
          </CardContent>
        </Card>
      )}

      <WorkOrderDialog
        open={dialogOpen}
        editing={Boolean(editing)}
        saving={saving}
        errors={formErrors}
        form={form}
        projects={projects}
        people={people}
        projectMemberships={projectMemberships}
        onChange={setForm}
        onClose={() => setDialogOpen(false)}
        onSave={() => void save()}
      />

      <Dialog open={Boolean(transitionTarget)} onOpenChange={(open) => !open && setTransitionTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{transitionStatus === 'Valmis' ? 'Merkitse työ valmiiksi' : 'Keskeytä työ'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">{transitionTarget?.title}</p>
            <div className="space-y-2">
              <Label htmlFor="worker-note">Työhuomio</Label>
              <Textarea
                id="worker-note"
                value={workerNote}
                onChange={(event) => setWorkerNote(event.target.value)}
                placeholder={transitionStatus === 'Valmis' ? 'Mitä tehtiin ja mitä työnjohdon pitää tietää?' : 'Miksi työ odottaa ja mitä tarvitaan jatkamiseen?'}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransitionTarget(null)} disabled={saving}>Peruuta</Button>
            <Button
              onClick={() => transitionTarget && void runTransition(transitionTarget, transitionStatus, workerNote)}
              disabled={saving}
              className={transitionStatus === 'Valmis' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              {saving ? 'Tallennetaan…' : transitionStatus === 'Valmis' ? 'Merkitse valmiiksi' : 'Keskeytä työ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poista työmääräys</AlertDialogTitle>
            <AlertDialogDescription>
              Poistetaanko <strong>{deleteTarget?.title}</strong>? Toimintoa ei voi perua. Linkitetyt kalenterivaraukset poistetaan, mutta aiemmat tuntikirjaukset säilyvät historiassa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Peruuta</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && void removeOrders([deleteTarget.id])}
              disabled={saving || !deleteTarget || !canSelectForDeletion(deleteTarget)}
              className="bg-red-600 hover:bg-red-700"
            >
              {saving ? 'Poistetaan…' : 'Poista'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={(open) => !open && setBulkDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poista {selectedOrders.length} työmääräystä</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-slate-600">
                <p>Valitut työmääräykset poistetaan yhdellä kertaa. Toimintoa ei voi perua.</p>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <ul className="space-y-1">
                    {selectedOrders.slice(0, 8).map((order) => (
                      <li key={order.id} className="font-medium text-slate-800">• {order.title}</li>
                    ))}
                  </ul>
                  {selectedOrders.length > 8 && (
                    <p className="mt-2 text-xs text-slate-500">Lisäksi {selectedOrders.length - 8} muuta työmääräystä.</p>
                  )}
                </div>
                <p>Linkitetyt kalenterivaraukset poistetaan. Aiemmat tuntikirjaukset säilyvät historiassa. Aktiivista työaikaa sisältävää työmääräystä ei poisteta.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Peruuta</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void removeOrders(selectedOrders.map((order) => order.id))}
              disabled={saving || selectedOrders.length === 0}
              className="bg-red-600 hover:bg-red-700"
            >
              {saving ? 'Poistetaan…' : `Poista ${selectedOrders.length} työmääräystä`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!canManage && currentRole === 'worker' && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          <Clock3 size={16} /> Työnjohto näkee tilapäivityksesi ja työhuomiosi välittömästi.
        </div>
      )}
    </motion.div>
  );
}
