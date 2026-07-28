import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileClock,
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
  Send,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  XCircle,
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import {
  finishMyWorkOrderSession,
  reviewWorkOrderCompletion,
  saveManagedWorkOrder,
  transitionMyWorkOrder,
  type ManagedWorkOrder,
  type WorkOrderFinishAction,
} from '@/lib/supabase/workManagement';
import { cn } from '@/lib/utils';
import type { WorkOrderPriority, WorkOrderStatus } from '@/types';
import WorkOrderDialog from './workOrders/WorkOrderDialog';
import {
  EMPTY_WORK_ORDER_FORM,
  type WorkOrderFormValues,
} from './workOrders/workOrderForm';

const ALL = 'Kaikki';
const REVIEW_STATUS = 'Hyväksyttävänä';
type ScopeFilter = 'all' | 'standalone' | 'project';
type DisplayStatus = WorkOrderStatus | typeof REVIEW_STATUS;

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

function formatDateTime(value: string | undefined, empty = 'Ei määritetty') {
  if (!value) return empty;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
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

function displayStatus(order: ManagedWorkOrder): DisplayStatus {
  return order.completionRequestedAt && !order.completionApproved ? REVIEW_STATUS : order.status;
}

function statusBadge(order: ManagedWorkOrder) {
  const current = displayStatus(order);
  const styles: Record<DisplayStatus, string> = {
    Avoin: 'border-blue-200 bg-blue-50 text-blue-700',
    Käynnissä: 'border-orange-200 bg-orange-50 text-orange-700',
    Odottaa: 'border-amber-200 bg-amber-50 text-amber-700',
    Hyväksyttävänä: 'border-violet-200 bg-violet-50 text-violet-700',
    Valmis: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Peruttu: 'border-slate-200 bg-slate-50 text-slate-600',
  };
  return <Badge variant="outline" className={styles[current]}>{current}</Badge>;
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

function finishActionCopy(action: WorkOrderFinishAction) {
  switch (action) {
    case 'request_completion':
      return {
        title: 'Lähetä työ valmiiksi hyväksyttäväksi',
        description: 'Työseloste ja tämän työjakson tunnit lähtevät hyväksyjälle. Työ sulkeutuu vasta hyväksynnän jälkeen.',
        button: 'Lähetä hyväksyttäväksi',
      };
    case 'blocked':
      return {
        title: 'Merkitse työ odottamaan',
        description: 'Tunnit kirjataan ja työnjohto näkee esteen sekä sen, mitä jatkaminen vaatii.',
        button: 'Lähetä tunnit ja este',
      };
    default:
      return {
        title: 'Lähetä tuntikirjaus',
        description: 'Tunnit ja työseloste lähtevät hyväksyttäväksi. Monipäiväinen työ jää käynnissä olevaksi seuraavaa työjaksoa varten.',
        button: 'Lähetä tuntikirjaus',
      };
  }
}

export default function Tyomaaraykset() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentOrg, currentRole } = useOrganization();
  const { projects, deleteWorkOrder, refresh: refreshDomain } = useAppDataContext();
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
  const [finishTarget, setFinishTarget] = useState<ManagedWorkOrder | null>(null);
  const [finishAction, setFinishAction] = useState<WorkOrderFinishAction>('submit_time_entry');
  const [workDescription, setWorkDescription] = useState('');
  const [nextOrderAfterFinish, setNextOrderAfterFinish] = useState<ManagedWorkOrder | null>(null);
  const [reviewTarget, setReviewTarget] = useState<ManagedWorkOrder | null>(null);
  const [reviewApproved, setReviewApproved] = useState(true);
  const [reviewNote, setReviewNote] = useState('');
  const [form, setForm] = useState<WorkOrderFormValues>(EMPTY_WORK_ORDER_FORM);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationSuccess, setOperationSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const projectFilterId = new URLSearchParams(location.search).get('project') ?? '';
  const selectedProject = projects.find((project) => project.id === projectFilterId);
  const standaloneCount = workOrders.filter((order) => !order.projectId).length;
  const activeSessionOrder = workOrders.find((order) => order.activeSessionId);

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
        order.completionRequestNote,
        assignmentLabel(order),
      ].some((value) => value.toLocaleLowerCase('fi').includes(query));
      const matchesStatus = statusFilter === ALL || displayStatus(order) === statusFilter;
      const matchesProjectQuery = !projectFilterId || order.projectId === projectFilterId;
      const matchesScope = scopeFilter === 'all'
        || (scopeFilter === 'standalone' && !order.projectId)
        || (scopeFilter === 'project' && Boolean(order.projectId));
      return matchesSearch && matchesStatus && matchesProjectQuery && matchesScope;
    });
  }, [projectFilterId, scopeFilter, search, statusFilter, workOrders]);

  const activeOrders = workOrders.filter((order) => order.status === 'Käynnissä' && !order.completionRequestedAt);
  const openOrders = workOrders.filter((order) => order.status === 'Avoin');
  const waitingOrders = workOrders.filter((order) => order.status === 'Odottaa' && !order.completionRequestedAt);
  const reviewOrders = workOrders.filter((order) => Boolean(order.completionRequestedAt && !order.completionApproved));
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

  const refreshEverything = async () => {
    await Promise.all([refresh(), refreshDomain()]);
  };

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
      await refreshEverything();
      setDialogOpen(false);
      setOperationSuccess(editing ? 'Työmääräys päivitettiin.' : 'Työmääräys luotiin.');
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget || !canManage) return;
    setSaving(true);
    setOperationError(null);
    try {
      const removed = await deleteWorkOrder(deleteTarget.id);
      if (!removed) throw new Error('Työmääräyksen poistaminen epäonnistui.');
      setDeleteTarget(null);
      await refreshEverything();
      setOperationSuccess('Työmääräys poistettiin.');
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const openFinish = (
    order: ManagedWorkOrder,
    action: WorkOrderFinishAction = 'submit_time_entry',
    nextOrder: ManagedWorkOrder | null = null,
  ) => {
    setFinishAction(order.activeSessionId ? action : 'request_completion');
    setWorkDescription('');
    setOperationError(null);
    setFinishTarget(order);
    setNextOrderAfterFinish(nextOrder);
  };

  const startOrder = async (order: ManagedWorkOrder) => {
    if (activeSessionOrder && activeSessionOrder.id !== order.id) {
      openFinish(activeSessionOrder, 'submit_time_entry', order);
      return;
    }

    setSaving(true);
    setOperationError(null);
    setOperationSuccess(null);
    try {
      await transitionMyWorkOrder({ workOrderId: order.id, status: 'Käynnissä' });
      await refreshEverything();
      setOperationSuccess(`${order.title} käynnistettiin. Työaika alkoi nyt.`);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Työn aloittaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const finishOrder = async () => {
    if (!finishTarget) return;
    const description = workDescription.trim();
    if (description.length < 3) {
      setOperationError('Kirjoita työseloste: mitä teit, mikä valmistui tai mikä estää jatkamisen.');
      return;
    }

    setSaving(true);
    setOperationError(null);
    setOperationSuccess(null);
    try {
      await finishMyWorkOrderSession({
        workOrderId: finishTarget.id,
        action: finishAction,
        workDescription: description,
      });

      const nextOrder = nextOrderAfterFinish;
      if (nextOrder) {
        await transitionMyWorkOrder({ workOrderId: nextOrder.id, status: 'Käynnissä' });
      }

      await refreshEverything();
      const finishedTitle = finishTarget.title;
      setFinishTarget(null);
      setNextOrderAfterFinish(null);
      setOperationSuccess(
        nextOrder
          ? `${finishedTitle} päätettiin ja ${nextOrder.title} käynnistettiin.`
          : finishAction === 'request_completion'
            ? 'Työ lähetettiin valmistumisen hyväksyntään.'
            : finishAction === 'blocked'
              ? 'Tuntikirjaus ja työn este lähetettiin työnjohdolle.'
              : 'Tuntikirjaus lähetettiin. Työmääräys jäi käynnissä olevaksi.',
      );
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Työajan päättäminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const openReview = (order: ManagedWorkOrder, approved: boolean) => {
    setReviewTarget(order);
    setReviewApproved(approved);
    setReviewNote('');
    setOperationError(null);
  };

  const reviewCompletion = async () => {
    if (!reviewTarget) return;
    const note = reviewNote.trim();
    if (!reviewApproved && note.length < 3) {
      setOperationError('Kirjoita, mitä työssä pitää korjata tai jatkaa.');
      return;
    }

    setSaving(true);
    setOperationError(null);
    setOperationSuccess(null);
    try {
      await reviewWorkOrderCompletion({
        workOrderId: reviewTarget.id,
        approved: reviewApproved,
        reviewNote: note,
      });
      await refreshEverything();
      setReviewTarget(null);
      setOperationSuccess(
        reviewApproved
          ? 'Työ hyväksyttiin valmiiksi.'
          : 'Työ palautettiin tekijälle jatkettavaksi.',
      );
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Valmistumispyynnön käsittely epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const pageTitle = canManage ? 'Työmääräysten ohjaus' : 'Minun työni';
  const pageDescription = canManage
    ? 'Määritä vastuut ja aikataulu, seuraa tuntiselosteita ja käsittele valmistumispyynnöt.'
    : 'Aloita työ, lähetä työjakson tunnit ja työseloste tai ilmoita työ valmiiksi hyväksyttäväksi.';

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

      {!canManage && activeSessionOrder && (
        <div className="flex flex-col gap-3 rounded-2xl border border-orange-300 bg-orange-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
              <Clock3 size={20} />
            </div>
            <div>
              <p className="font-semibold text-orange-950">Työaika käynnissä: {activeSessionOrder.title}</p>
              <p className="mt-1 text-sm text-orange-800">
                Aloitettu {formatDateTime(activeSessionOrder.activeSessionStartedAt)}. Päätä tämä työ ennen kuin siirryt toiseen.
              </p>
            </div>
          </div>
          <Button onClick={() => openFinish(activeSessionOrder)} className="gap-2 bg-orange-600 hover:bg-orange-700">
            <FileClock size={16} /> Päätä työ tältä erää
          </Button>
        </div>
      )}

      {(error || (operationError && !finishTarget && !reviewTarget)) && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" /> {operationError ?? error}
        </div>
      )}
      {operationSuccess && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" /> {operationSuccess}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {[
          { label: 'Avoimet', value: openOrders.length, icon: ClipboardList, tone: 'bg-blue-50 text-blue-700' },
          { label: 'Käynnissä', value: activeOrders.length, icon: PlayCircle, tone: 'bg-orange-50 text-orange-700' },
          { label: 'Odottaa', value: waitingOrders.length, icon: PauseCircle, tone: 'bg-amber-50 text-amber-700' },
          { label: 'Hyväksyttävänä', value: reviewOrders.length, icon: ClipboardCheck, tone: 'bg-violet-50 text-violet-700' },
          { label: 'Valmiit', value: doneOrders.length, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
          { label: 'Ilman projektia', value: standaloneCount, icon: BriefcaseBusiness, tone: 'bg-slate-50 text-slate-700' },
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
          {[ALL, 'Avoin', 'Käynnissä', 'Odottaa', REVIEW_STATUS, 'Valmis'].map((item) => (
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
            const pendingReview = Boolean(order.completionRequestedAt && !order.completionApproved);
            return (
              <Card
                key={order.id}
                className={cn(
                  'overflow-hidden border-slate-200 shadow-sm transition-shadow hover:shadow-md',
                  order.priority === 'Korkea' && !['Valmis', 'Peruttu'].includes(order.status) && 'border-l-4 border-l-red-500',
                  pendingReview && 'border-violet-300',
                  order.activeSessionId && 'ring-2 ring-orange-300',
                )}
              >
                <CardContent className="p-0">
                  <div className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap gap-2">
                          {statusBadge(order)}
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
                      {canManage && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(order)} aria-label={`Muokkaa ${order.title}`}><Pencil size={16} /></Button>
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteTarget(order)} aria-label={`Poista ${order.title}`}><Trash2 size={16} /></Button>
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

                    {pendingReview && (
                      <div className="space-y-3 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
                        <div className="flex items-start gap-2">
                          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-violet-700" />
                          <div>
                            <p className="font-semibold">Valmistuminen odottaa hyväksyntää</p>
                            <p className="mt-1 text-xs text-violet-700">
                              {order.completionRequesterName ?? 'Työntekijä'} · {formatDateTime(order.completionRequestedAt)}
                            </p>
                          </div>
                        </div>
                        <p className="whitespace-pre-wrap leading-6">{order.completionRequestNote}</p>
                        {canManage ? (
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Button onClick={() => openReview(order, true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                              <CheckCircle2 size={16} /> Hyväksy valmiiksi
                            </Button>
                            <Button variant="outline" onClick={() => openReview(order, false)} className="gap-2 border-violet-300">
                              <XCircle size={16} /> Palauta jatkettavaksi
                            </Button>
                          </div>
                        ) : (
                          <p className="rounded-lg bg-white/70 p-3 text-xs leading-5 text-violet-800">
                            Työmääräyksen tekijä tai työnjohto käsittelee pyynnön. Saat ilmoituksen hyväksynnästä tai palautuksesta.
                          </p>
                        )}
                      </div>
                    )}

                    {!pendingReview && order.workerNote && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        <strong>Työhuomio:</strong> {order.workerNote}
                      </div>
                    )}

                    {!canManage && !['Valmis', 'Peruttu'].includes(order.status) && !pendingReview && (
                      <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap">
                        {order.activeSessionId ? (
                          <Button onClick={() => openFinish(order)} disabled={saving} className="gap-2 bg-orange-600 hover:bg-orange-700">
                            <FileClock size={16} /> Päätä työ tältä erää
                          </Button>
                        ) : (
                          <Button onClick={() => void startOrder(order)} disabled={saving} className="gap-2">
                            <PlayCircle size={16} /> {order.status === 'Avoin' ? 'Aloita työ' : 'Jatka työtä'}
                          </Button>
                        )}
                        {!order.activeSessionId && ['Käynnissä', 'Odottaa'].includes(order.status) && (
                          <Button variant="outline" onClick={() => openFinish(order, 'request_completion')} disabled={saving} className="gap-2 border-emerald-300 text-emerald-700">
                            <Send size={16} /> Lähetä valmiiksi
                          </Button>
                        )}
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

      <Dialog
        open={Boolean(finishTarget)}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setFinishTarget(null);
            setNextOrderAfterFinish(null);
            setOperationError(null);
          }
        }}
      >
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Päätä työ tältä erää</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div>
              <p className="font-semibold text-slate-950">{finishTarget?.title}</p>
              <p className="mt-1 text-sm text-slate-500">
                Valitse, mitä työjakson päättyessä tapahtuu. Monipäiväinen työ jää käyntiin, kun lähetät vain tuntikirjauksen.
              </p>
            </div>

            {operationError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle size={17} className="mt-0.5 shrink-0" /> {operationError}
              </div>
            )}

            {nextOrderAfterFinish && (
              <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <ArrowRight size={17} className="mt-0.5 shrink-0" />
                <span>Tämän kirjauksen jälkeen käynnistetään automaattisesti <strong>{nextOrderAfterFinish.title}</strong>.</span>
              </div>
            )}

            {finishTarget?.activeSessionId ? (
              <>
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
                  <p className="font-semibold">Työaika on käynnissä</p>
                  <p className="mt-1">Aloitettu {formatDateTime(finishTarget.activeSessionStartedAt)}. Työaika katkaistaan lähetyksen yhteydessä ja tuntikirjaus lasketaan automaattisesti.</p>
                </div>
                <div className="grid gap-3">
                  {([
                    { action: 'submit_time_entry' as const, icon: FileClock },
                    { action: 'request_completion' as const, icon: CheckCircle2 },
                    { action: 'blocked' as const, icon: PauseCircle },
                  ]).map(({ action, icon: Icon }) => {
                    const copy = finishActionCopy(action);
                    const selected = finishAction === action;
                    return (
                      <button
                        key={action}
                        type="button"
                        onClick={() => setFinishAction(action)}
                        className={cn(
                          'flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors',
                          selected
                            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                            : 'border-slate-200 bg-white hover:bg-slate-50',
                        )}
                      >
                        <div className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                          selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600',
                        )}>
                          <Icon size={19} />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-950">{copy.title}</p>
                          <p className="mt-1 text-sm leading-5 text-slate-600">{copy.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                Työaika ei ole juuri nyt käynnissä. Lähetät valmistumispyynnön ilman uutta tuntikirjausta.
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="work-description">
                {finishAction === 'blocked' ? 'Työseloste ja työn este *' : 'Työseloste *'}
              </Label>
              <Textarea
                id="work-description"
                value={workDescription}
                onChange={(event) => setWorkDescription(event.target.value)}
                placeholder={
                  finishAction === 'blocked'
                    ? 'Mitä teit, mikä estää jatkamisen ja mitä tarvitaan seuraavaksi?'
                    : 'Mitä teit tämän työjakson aikana? Kerro tehdyt vaiheet ja työn nykytila.'
                }
                rows={5}
              />
              <p className="text-xs text-slate-500">
                Työseloste tallentuu tuntikirjaukseen ja näkyy työnjohdolle.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setFinishTarget(null);
                setNextOrderAfterFinish(null);
                setOperationError(null);
              }}
              disabled={saving}
            >
              Peruuta
            </Button>
            <Button
              onClick={() => void finishOrder()}
              disabled={saving}
              className={cn(
                finishAction === 'request_completion' && 'bg-emerald-600 hover:bg-emerald-700',
                finishAction === 'blocked' && 'bg-amber-600 hover:bg-amber-700',
              )}
            >
              {saving ? <><Loader2 size={15} className="mr-2 animate-spin" />Lähetetään…</> : finishActionCopy(finishAction).button}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(reviewTarget)}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setReviewTarget(null);
            setOperationError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{reviewApproved ? 'Hyväksy työ valmiiksi' : 'Palauta työ jatkettavaksi'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {operationError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle size={17} className="mt-0.5 shrink-0" /> {operationError}
              </div>
            )}
            <div className={cn(
              'rounded-xl border p-4 text-sm',
              reviewApproved
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                : 'border-amber-200 bg-amber-50 text-amber-950',
            )}>
              <p className="font-semibold">{reviewTarget?.title}</p>
              <p className="mt-2 whitespace-pre-wrap leading-6">{reviewTarget?.completionRequestNote}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-note">
                {reviewApproved ? 'Hyväksynnän huomio' : 'Mitä pitää korjata tai jatkaa? *'}
              </Label>
              <Textarea
                id="review-note"
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder={
                  reviewApproved
                    ? 'Valinnainen huomio hyväksynnästä'
                    : 'Anna tekijälle selkeä ohje puutteesta ja vaaditusta jatkosta.'
                }
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewTarget(null)} disabled={saving}>Peruuta</Button>
            <Button
              onClick={() => void reviewCompletion()}
              disabled={saving}
              className={reviewApproved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}
            >
              {saving ? 'Tallennetaan…' : reviewApproved ? 'Hyväksy valmiiksi' : 'Palauta jatkettavaksi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poista työmääräys</AlertDialogTitle>
            <AlertDialogDescription>Poistetaanko <strong>{deleteTarget?.title}</strong>? Myös siihen linkitetyt kalenterivaraukset poistetaan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Peruuta</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()} disabled={saving} className="bg-red-600 hover:bg-red-700">Poista</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!canManage && currentRole === 'worker' && (
        <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          <Clock3 size={16} className="mt-0.5 shrink-0" />
          <span>Tuntikirjaukset lähtevät työnjohdon hyväksyttäväksi. Valmistumisilmoitus ei sulje työmääräystä ennen hyväksyntää.</span>
        </div>
      )}
    </motion.div>
  );
}
