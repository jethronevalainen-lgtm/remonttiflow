import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { addDays, addWeeks, format, startOfWeek } from 'date-fns';
import { fi } from 'date-fns/locale';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Filter,
  GripVertical,
  Layers3,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
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
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ROLE_LABELS, useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import { useSchedulingData, type Shift } from '@/hooks/useSchedulingData';
import {
  filterCalendarPeopleByTeam,
  parseCalendarTeamScope,
  resolveTeamScopeUserIds,
  type CalendarTeamScope,
} from '@/lib/calendarTeamFilter';
import {
  buildAssignInstallerToWorkOrderValues,
  buildCreateWorkOrderFromCalendarValues,
  canAssignUserToWorkOrder,
  filterAssignableWorkOrdersForCalendar,
  type CalendarBookingKind,
} from '@/lib/calendarWorkOrderBooking';
import {
  hasScheduleConflict,
  hoursBetween,
  shiftedDate,
  shiftedWorkOrderStart,
} from '@/lib/resourceCalendar';
import { listEmployeeSupervisorAssignments } from '@/lib/supabase/employeeSupervisors';
import {
  createShift,
  createShifts,
  deleteShift,
  updateShift,
} from '@/lib/supabase/schedulingEntities';
import { listAccessibleEmployeeCards } from '@/lib/supabase/workforceHr';
import {
  moveManagedWorkOrderSchedule,
  saveManagedWorkOrder,
} from '@/lib/supabase/workManagement';
import { cn } from '@/lib/utils';

interface ShiftForm {
  userId: string;
  employeeName: string;
  projectId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  shiftType: string;
  notes: string;
}

interface CalendarPerson {
  userId?: string;
  name: string;
  role?: keyof typeof ROLE_LABELS;
}

interface DragState {
  shift: Shift;
  copy: boolean;
}

const ALL_PROJECTS = '__all_projects__';
const EMPTY_FORM: ShiftForm = {
  userId: '',
  employeeName: '',
  projectId: '',
  title: '',
  date: '',
  startTime: '07:00',
  endTime: '15:30',
  shiftType: 'Työvuoro',
  notes: '',
};

function isoDate(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function cardTone(shift: Shift, conflict: boolean) {
  if (conflict) return 'border-l-red-500 border-red-200 bg-red-50 text-red-950';
  if (shift.sourceType === 'work_order') return 'border-l-blue-500 border-blue-200 bg-blue-50 text-blue-950';
  const type = shift.shiftType.toLocaleLowerCase('fi');
  if (type.includes('loma')) return 'border-l-violet-500 border-violet-200 bg-violet-50 text-violet-950';
  if (type.includes('koulutus')) return 'border-l-cyan-500 border-cyan-200 bg-cyan-50 text-cyan-950';
  if (type.includes('sairas')) return 'border-l-rose-500 border-rose-200 bg-rose-50 text-rose-950';
  return 'border-l-orange-500 border-orange-200 bg-orange-50 text-orange-950';
}

function manualShift(form: ShiftForm, projectName: string): Omit<Shift, 'id'> {
  return {
    userId: form.userId,
    employeeName: form.employeeName,
    projectId: form.projectId || undefined,
    project: projectName,
    title: form.title.trim(),
    date: form.date,
    startTime: form.startTime,
    endTime: form.endTime,
    shiftType: form.shiftType.trim(),
    notes: form.notes.trim(),
    sourceType: 'manual',
  };
}

export default function Tyovuorokalenteri() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { effectiveRole, effectiveUserId, actualRole } = useViewAs();
  const { projects } = useAppDataContext();
  const {
    people,
    projectMemberships,
    workOrders,
    refresh: refreshWorkspace,
  } = useRoleWorkspace();
  const { shifts, loading, error, refresh } = useSchedulingData();

  const [weekOffset, setWeekOffset] = useState(0);
  const [showWeekends, setShowWeekends] = useState(false);
  const [personSearch, setPersonSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState(ALL_PROJECTS);
  const [teamScope, setTeamScope] = useState<CalendarTeamScope>('all');
  const [teamScopeReady, setTeamScopeReady] = useState(false);
  const [mobileDayIndex, setMobileDayIndex] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Shift | null>(null);
  const [bookingKind, setBookingKind] = useState<CalendarBookingKind>('work_order_existing');
  const [existingWorkOrderId, setExistingWorkOrderId] = useState('');
  const [workOrderSearch, setWorkOrderSearch] = useState('');
  const [form, setForm] = useState<ShiftForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const organizationId = currentOrg?.id;
  const teamQuery = useQuery({
    queryKey: ['calendar-team-scope', organizationId ?? 'none'],
    enabled: Boolean(organizationId),
    staleTime: 15_000,
    queryFn: async () => {
      const [assignments, cards] = await Promise.all([
        listEmployeeSupervisorAssignments(organizationId as string),
        listAccessibleEmployeeCards(organizationId as string),
      ]);
      return {
        assignments,
        employees: cards.map((card) => ({
          employeeId: card.employeeId,
          userId: card.userId,
        })),
      };
    },
  });

  useEffect(() => {
    if (teamScopeReady || !effectiveRole) return;
    setTeamScope(effectiveRole === 'supervisor' ? 'my_team' : 'all');
    setTeamScopeReady(true);
  }, [effectiveRole, teamScopeReady]);

  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const allDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const visibleDays = showWeekends ? allDays : allDays.slice(0, 5);
  const weekEnd = allDays[6];
  const todayIso = isoDate(new Date());
  const weekShifts = shifts.filter((shift) => shift.date >= isoDate(weekStart) && shift.date <= isoDate(weekEnd));
  const filteredWeekShifts = projectFilter === ALL_PROJECTS
    ? weekShifts
    : weekShifts.filter((shift) => shift.projectId === projectFilter);

  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.userId, person])),
    [people],
  );

  const supervisors = useMemo(
    () => people.filter((person) => person.role === 'supervisor').sort((a, b) => a.name.localeCompare(b.name, 'fi')),
    [people],
  );

  const allowedTeamUserIds = useMemo(() => resolveTeamScopeUserIds({
    scope: teamScope,
    currentUserId: effectiveUserId ?? user?.id ?? null,
    assignments: teamQuery.data?.assignments ?? [],
    employees: teamQuery.data?.employees ?? [],
  }), [teamScope, effectiveUserId, user?.id, teamQuery.data]);

  const rowPeople = useMemo(() => {
    const map = new Map<string, CalendarPerson>();
    people.forEach((person) => map.set(person.userId, {
      userId: person.userId,
      name: person.name,
      role: person.role,
    }));
    if (teamScope === 'all') {
      shifts.filter((shift) => !shift.userId).forEach((shift) => {
        const key = `legacy:${shift.employeeName}`;
        if (shift.employeeName && !map.has(key)) map.set(key, { name: shift.employeeName });
      });
    }
    const query = personSearch.trim().toLocaleLowerCase('fi');
    const searched = [...map.values()]
      .filter((person) => !query || `${person.name} ${person.role ? ROLE_LABELS[person.role] : ''}`.toLocaleLowerCase('fi').includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, 'fi'));
    return filterCalendarPeopleByTeam(searched, allowedTeamUserIds);
  }, [people, personSearch, shifts, teamScope, allowedTeamUserIds]);

  const shiftsFor = (person: CalendarPerson, date: string) => filteredWeekShifts.filter((shift) => (
    shift.date === date
    && (person.userId
      ? shift.userId === person.userId
      : !shift.userId && shift.employeeName === person.name)
  ));

  const totalHours = filteredWeekShifts.reduce(
    (sum, shift) => sum + hoursBetween(shift.startTime, shift.endTime),
    0,
  );
  const scheduledUsers = new Set(filteredWeekShifts.map((shift) => shift.userId || shift.employeeName)).size;
  const conflictCount = rowPeople.reduce((count, person) => count + visibleDays.filter((day) => (
    hasScheduleConflict(shiftsFor(person, isoDate(day)))
  )).length, 0);

  const assignableWorkOrders = useMemo(
    () => filterAssignableWorkOrdersForCalendar({
      workOrders,
      userId: form.userId,
      projectMemberships,
      search: workOrderSearch,
    }),
    [form.userId, projectMemberships, workOrderSearch, workOrders],
  );

  const selectedExistingWorkOrder = workOrders.find((order) => order.id === existingWorkOrderId) ?? null;

  const openCreate = (date = isoDate(weekStart), userId = '') => {
    const person = peopleById.get(userId);
    setEditing(null);
    setBookingKind('work_order_existing');
    setExistingWorkOrderId('');
    setWorkOrderSearch('');
    setForm({ ...EMPTY_FORM, date, userId, employeeName: person?.name ?? '' });
    setFormErrors([]);
    setOperationError(null);
    setSuccessMessage(null);
    setDialogOpen(true);
  };

  const openEdit = (shift: Shift) => {
    if (shift.sourceType === 'work_order') {
      if (shift.workOrderId) {
        navigate(`/tyomaaraykset?edit=${encodeURIComponent(shift.workOrderId)}`);
      } else {
        navigate('/tyomaaraykset');
      }
      return;
    }
    setEditing(shift);
    setBookingKind('manual');
    setExistingWorkOrderId('');
    setWorkOrderSearch('');
    setForm({
      userId: shift.userId ?? '',
      employeeName: shift.employeeName,
      projectId: shift.projectId ?? '',
      title: shift.title,
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      shiftType: shift.shiftType,
      notes: shift.notes,
    });
    setFormErrors([]);
    setOperationError(null);
    setSuccessMessage(null);
    setDialogOpen(true);
  };

  const validateForm = () => {
    const next: string[] = [];
    if (!form.userId) next.push('Valitse kirjautuva käyttäjä.');
    if (!form.date) next.push('Päivä on pakollinen.');
    if (!form.startTime || !form.endTime) next.push('Alku- ja päättymisaika ovat pakollisia.');
    if (form.startTime && form.endTime && form.endTime <= form.startTime) {
      next.push('Päättymisajan pitää olla alkamisajan jälkeen.');
    }

    if (editing || bookingKind === 'manual') {
      if (!form.shiftType.trim()) next.push('Varaustyyppi on pakollinen.');
      return next;
    }

    if (bookingKind === 'work_order_existing') {
      if (!existingWorkOrderId) next.push('Valitse työmääräys, tilaus tai keikka.');
      else if (!selectedExistingWorkOrder) next.push('Valittua työmääräystä ei löytynyt.');
      else if (!canAssignUserToWorkOrder(selectedExistingWorkOrder, form.userId, projectMemberships)) {
        next.push(
          selectedExistingWorkOrder.projectId
            ? 'Asentaja näkyy HR-tiimissä, mutta hänen täytyy kuulua myös työmääräyksen projektitiimiin. Lisää henkilö projektiin Projektit → Tiimi.'
            : 'Tätä työmääräystä ei voi enää kohdistaa.',
        );
      }
      return next;
    }

    if (!form.title.trim()) next.push('Työmääräyksen otsikko on pakollinen.');
    if (
      form.projectId
      && !projectMemberships.some(
        (membership) => membership.projectId === form.projectId && membership.userId === form.userId,
      )
    ) {
      next.push('Projektiin liitettäessä asentajan täytyy kuulua projektitiimiin (Projektit → Tiimi). Kalenterin HR-tiimi ei riitä.');
    }
    return next;
  };

  const save = async () => {
    const nextErrors = validateForm();
    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg) return;

    const person = peopleById.get(form.userId);
    const project = projects.find((item) => item.id === form.projectId);

    setSaving(true);
    setOperationError(null);
    try {
      if (editing || bookingKind === 'manual') {
        const payload = manualShift({
          ...form,
          employeeName: person?.name ?? form.employeeName,
        }, project?.name ?? '');
        if (editing) await updateShift(currentOrg.id, editing.id, payload);
        else await createShift(currentOrg.id, user?.id, payload);
        await refresh();
        setDialogOpen(false);
        setSuccessMessage(editing ? 'Varaus päivitettiin.' : 'Käsinvaraus lisättiin kalenteriin.');
        return;
      }

      if (bookingKind === 'work_order_existing' && selectedExistingWorkOrder) {
        const values = buildAssignInstallerToWorkOrderValues(
          selectedExistingWorkOrder,
          form.userId,
          { date: form.date, startTime: form.startTime, endTime: form.endTime },
        );
        await saveManagedWorkOrder({ organizationId: currentOrg.id, ...values });
        await Promise.all([refresh(), refreshWorkspace()]);
        setDialogOpen(false);
        setSuccessMessage(
          `${person?.name ?? 'Asentaja'} kohdistettiin työmääräykseen “${selectedExistingWorkOrder.title}” ja kalenteri synkronoitiin.`,
        );
        return;
      }

      const values = buildCreateWorkOrderFromCalendarValues({
        title: form.title,
        userId: form.userId,
        projectId: form.projectId || undefined,
        description: form.notes,
        type: form.shiftType.trim() || undefined,
        input: { date: form.date, startTime: form.startTime, endTime: form.endTime },
      });
      const workOrderId = await saveManagedWorkOrder({ organizationId: currentOrg.id, ...values });
      await Promise.all([refresh(), refreshWorkspace()]);
      setDialogOpen(false);
      setSuccessMessage(
        workOrderId
          ? 'Uusi työmääräys luotiin ja synkronoitiin resurssikalenteriin.'
          : 'Uusi työmääräys luotiin.',
      );
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Varauksen tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const copyEditingShift = async (dayDelta: number) => {
    if (!editing || editing.sourceType !== 'manual' || !currentOrg) return;
    setSaving(true);
    setOperationError(null);
    try {
      const { id: _id, ...copy } = editing;
      await createShift(currentOrg.id, user?.id, {
        ...copy,
        date: shiftedDate(editing.date, dayDelta),
        sourceType: 'manual',
        workOrderId: undefined,
      });
      await refresh();
      setDialogOpen(false);
      setSuccessMessage(dayDelta === 7 ? 'Varaus kopioitiin seuraavalle viikolle.' : 'Varaus kopioitiin seuraavalle päivälle.');
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Varauksen kopiointi epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const copyPersonWeek = async (person: CalendarPerson) => {
    if (!person.userId || !currentOrg) return;
    const source = weekShifts.filter((shift) => shift.userId === person.userId && shift.sourceType === 'manual');
    if (source.length === 0) {
      setOperationError(`${person.name}: tällä viikolla ei ole kopioitavia käsin luotuja varauksia.`);
      return;
    }
    setSaving(true);
    setOperationError(null);
    try {
      await createShifts(currentOrg.id, user?.id, source.map((shift) => {
        const { id: _id, ...copy } = shift;
        return {
          ...copy,
          date: shiftedDate(shift.date, 7),
          sourceType: 'manual',
          workOrderId: undefined,
        };
      }));
      await refresh();
      setSuccessMessage(`${person.name}: viikon käsin luodut varaukset kopioitiin seuraavalle viikolle.`);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Viikon kopiointi epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget || !currentOrg || deleteTarget.sourceType !== 'manual') return;
    setSaving(true);
    try {
      await deleteShift(currentOrg.id, deleteTarget.id);
      await refresh();
      setDeleteTarget(null);
      setSuccessMessage('Varaus poistettiin.');
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Varauksen poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const startDrag = (event: DragEvent<HTMLButtonElement>, shift: Shift) => {
    const copy = shift.sourceType === 'manual' && event.altKey;
    event.dataTransfer.effectAllowed = shift.sourceType === 'manual' ? 'copyMove' : 'move';
    event.dataTransfer.setData('text/plain', shift.id);
    setDragState({ shift, copy });
    setOperationError(null);
  };

  const dropShift = async (person: CalendarPerson, date: string) => {
    const state = dragState;
    setDropTarget(null);
    setDragState(null);
    if (!state || !person.userId || !currentOrg) return;

    setSaving(true);
    setOperationError(null);
    try {
      if (state.shift.sourceType === 'work_order') {
        if (state.shift.userId !== person.userId) {
          throw new Error('Työmääräyksen vastuuhenkilöä ei vaihdeta kalenterivedolla. Muuta vastuuhenkilöt työmääräykseltä.');
        }
        const order = workOrders.find((item) => item.id === state.shift.workOrderId);
        if (!order?.plannedStartDate || !state.shift.workOrderId) {
          throw new Error('Työmääräyksellä ei ole siirrettävää työjaksoa.');
        }
        await moveManagedWorkOrderSchedule({
          organizationId: currentOrg.id,
          workOrderId: state.shift.workOrderId,
          targetStartDate: shiftedWorkOrderStart(order.plannedStartDate, state.shift.date, date),
        });
        await Promise.all([refresh(), refreshWorkspace()]);
        setSuccessMessage('Koko työmääräyksen työjakso siirrettiin. Viimeinen valmistumispäivä säilyi ennallaan.');
        return;
      }

      const targetPerson = peopleById.get(person.userId);
      if (state.copy) {
        const { id: _id, ...copy } = state.shift;
        await createShift(currentOrg.id, user?.id, {
          ...copy,
          userId: person.userId,
          employeeName: targetPerson?.name ?? person.name,
          date,
          sourceType: 'manual',
          workOrderId: undefined,
        });
        setSuccessMessage('Varaus kopioitiin uuteen kohtaan.');
      } else {
        await updateShift(currentOrg.id, state.shift.id, {
          userId: person.userId,
          employeeName: targetPerson?.name ?? person.name,
          date,
        });
        setSuccessMessage('Varaus siirrettiin.');
      }
      await refresh();
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Varauksen siirto epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const renderShiftCard = (shift: Shift, conflict: boolean) => (
    <button
      key={shift.id}
      type="button"
      draggable
      onDragStart={(event) => startDrag(event, shift)}
      onDragEnd={() => { setDragState(null); setDropTarget(null); }}
      onClick={() => openEdit(shift)}
      className={cn(
        'group w-full rounded-md border border-l-4 p-2 text-left text-xs shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
        cardTone(shift, conflict),
      )}
      title={shift.sourceType === 'manual' ? 'Vedä siirtääksesi. Alt/Option + vedä kopioidaksesi.' : 'Vedä siirtääksesi koko työmääräyksen työjaksoa.'}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold tracking-tight">{shift.startTime}–{shift.endTime}</span>
        <span className="flex shrink-0 items-center gap-1 opacity-60 group-hover:opacity-100">
          {shift.sourceType === 'manual' ? <Pencil size={12} /> : <Layers3 size={12} />}
          <GripVertical size={12} />
        </span>
      </div>
      <p className="mt-1 break-words font-medium leading-snug">{shift.title || shift.project || shift.shiftType}</p>
      {shift.project && shift.title ? <p className="mt-1 break-words opacity-80">{shift.project}</p> : null}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 opacity-90">
        <span className="font-mono">{hoursBetween(shift.startTime, shift.endTime).toFixed(1)} h</span>
        <span className="break-words">{shift.sourceType === 'work_order' ? 'Työmääräys' : shift.shiftType}</span>
      </div>
    </button>
  );

  const teamScopeLabel = teamScope === 'all'
    ? 'Kaikki käyttäjät'
    : teamScope === 'my_team'
      ? 'Oma tiimi'
      : supervisors.find((person) => `supervisor:${person.userId}` === teamScope)?.name
        ?? 'Valittu työnjohtaja';

  const selectedMobileDay = visibleDays[Math.min(mobileDayIndex, visibleDays.length - 1)] ?? visibleDays[0];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-[1700px] space-y-6">
      <div className="flex flex-col gap-5 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950 p-6 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300"><CalendarDays size={16} /> Resursointi</div>
          <h1 className="text-3xl font-bold tracking-tight">Resurssikalenteri</h1>
          <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-slate-300">
            Siirrä varaus vetämällä. Pidä Alt/Option pohjassa kopioidaksesi käsin luodun varauksen.
            Työmääräysvaraus siirtää koko työjakson. Voit rajata näkymän omaan HR-tiimiin tai valitun työnjohtajan tiimiin
            (ei sama asia kuin projektitiimi). Työmääräyksen kohdistus vaatii henkilön projektitiimiin.
          </p>
        </div>
        <Button onClick={() => openCreate()} className="gap-2 bg-orange-500 hover:bg-orange-600"><Plus size={16} /> Lisää kalenteriin</Button>
      </div>

      {(error || operationError || teamQuery.error) && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span className="break-words">
            {operationError
              ?? error
              ?? (teamQuery.error instanceof Error ? teamQuery.error.message : 'Tiimitietojen haku epäonnistui.')}
          </span>
        </div>
      )}
      {successMessage && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{successMessage}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: 'Varauksia viikolla', value: filteredWeekShifts.length, icon: CalendarDays },
          { label: 'Tunteja yhteensä', value: `${totalHours.toFixed(1)} h`, icon: Clock3 },
          { label: 'Käyttäjiä varattuna', value: scheduledUsers, icon: UsersRound },
          { label: 'Näkyviä rivejä', value: rowPeople.length, icon: UsersRound },
          { label: 'Päällekkäisiä päiviä', value: conflictCount, icon: AlertTriangle },
        ].map((item) => (
          <Card key={item.label} className="border-slate-200/80 bg-gradient-to-b from-white to-slate-50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">{item.label}</p>
                  <p className="mt-2 font-mono text-2xl font-bold text-slate-950">{item.value}</p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700"><item.icon size={19} /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setWeekOffset((value) => value - 1)} aria-label="Edellinen viikko"><ChevronLeft size={16} /></Button>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>Tämä viikko</Button>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset((value) => value + 1)} aria-label="Seuraava viikko"><ChevronRight size={16} /></Button>
            <p className="px-1 text-sm font-semibold text-slate-800">
              {format(weekStart, 'd.M.yyyy', { locale: fi })} – {format(weekEnd, 'd.M.yyyy', { locale: fi })}
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
            <Checkbox checked={showWeekends} onCheckedChange={(checked) => { setShowWeekends(checked === true); setMobileDayIndex(0); }} />
            Näytä viikonloput
          </label>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,16rem)_minmax(14rem,18rem)]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={personSearch} onChange={(event) => setPersonSearch(event.target.value)} placeholder="Hae työntekijää tai roolia…" className="pl-9" />
          </div>
          <Select value={teamScope} onValueChange={(value) => setTeamScope(parseCalendarTeamScope(value))}>
            <SelectTrigger aria-label="Tiiminäkymä">
              <UsersRound size={15} className="mr-2 shrink-0" />
              <SelectValue placeholder="Valitse tiiminäkymä" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Näytä kaikki</SelectItem>
              <SelectItem value="my_team">Näytä oma tiimi</SelectItem>
              {supervisors.length > 0 && (
                <>
                  {supervisors.map((person) => (
                    <SelectItem key={person.userId} value={`supervisor:${person.userId}`}>
                      Työnjohtaja: {person.name}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger aria-label="Projektisuodatin">
              <Filter size={15} className="mr-2 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PROJECTS}>Kaikki projektit ja varaukset</SelectItem>
              {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <p className="break-words text-xs text-slate-500">
          Näkymä: <span className="font-medium text-slate-700">{teamScopeLabel}</span>
          {actualRole === 'admin' || effectiveRole === 'admin'
            ? ' · Ylläpitäjä voi vaihtaa työnjohtajan tiimiin.'
            : null}
          {teamScope !== 'all' && rowPeople.length === 0
            ? ' · Valitulla tiimillä ei ole kirjautuvia käyttäjiä kalenterissa.'
            : null}
        </p>
      </div>

      <Card className="hidden overflow-hidden border-slate-200 shadow-sm lg:block">
        <CardContent className="p-0">
          <div
            className="grid border-b bg-slate-900 text-white"
            style={{ gridTemplateColumns: `minmax(12rem,14rem) repeat(${visibleDays.length}, minmax(0, 1fr))` }}
          >
            <div className="sticky left-0 z-10 border-r border-white/10 bg-slate-900 p-3 text-xs font-semibold uppercase tracking-wider text-slate-300">
              Käyttäjä
            </div>
            {visibleDays.map((day) => {
              const dayIso = isoDate(day);
              const isToday = dayIso === todayIso;
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'border-r border-white/10 p-3 text-center',
                    isToday && 'bg-orange-500/20',
                  )}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">{format(day, 'EEE', { locale: fi })}</p>
                  <p className={cn('text-base font-semibold', isToday ? 'text-orange-200' : 'text-white')}>{format(day, 'd.M.')}</p>
                </div>
              );
            })}
          </div>

          {rowPeople.map((person, rowIndex) => {
            const personWeekShifts = filteredWeekShifts.filter((shift) => person.userId ? shift.userId === person.userId : !shift.userId && shift.employeeName === person.name);
            const weeklyHours = personWeekShifts.reduce((sum, shift) => sum + hoursBetween(shift.startTime, shift.endTime), 0);
            return (
              <div
                key={person.userId ?? `legacy:${person.name}`}
                className={cn('grid border-b border-slate-100', rowIndex % 2 === 1 && 'bg-slate-50/70')}
                style={{ gridTemplateColumns: `minmax(12rem,14rem) repeat(${visibleDays.length}, minmax(0, 1fr))` }}
              >
                <div className={cn('sticky left-0 z-[1] border-r border-slate-200 p-3', rowIndex % 2 === 1 ? 'bg-slate-50' : 'bg-white')}>
                  <div className="flex items-start gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-800 to-slate-950 text-xs font-bold text-white shadow-sm">
                      {initials(person.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold text-slate-950">{person.name}</p>
                      <p className="break-words text-[11px] leading-4 text-slate-500">
                        {person.role ? ROLE_LABELS[person.role] : 'Vanha nimipohjainen rivi'} · {weeklyHours.toFixed(1)} h
                      </p>
                    </div>
                  </div>
                  {person.userId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void copyPersonWeek(person)}
                      disabled={saving}
                      className="mt-2 h-auto w-full justify-start gap-1 whitespace-normal px-2 py-1 text-left text-xs leading-4 text-slate-500"
                    >
                      <Copy size={13} className="shrink-0" /> Kopioi käsivuorot ensi viikolle
                    </Button>
                  )}
                </div>

                {visibleDays.map((day) => {
                  const date = isoDate(day);
                  const dayShifts = shiftsFor(person, date);
                  const conflict = hasScheduleConflict(dayShifts);
                  const targetKey = `${person.userId ?? person.name}:${date}`;
                  const isToday = date === todayIso;
                  return (
                    <div
                      key={date}
                      onDragOver={(event) => { if (person.userId) { event.preventDefault(); setDropTarget(targetKey); } }}
                      onDragLeave={() => setDropTarget((current) => current === targetKey ? null : current)}
                      onDrop={(event) => { event.preventDefault(); void dropShift(person, date); }}
                      className={cn(
                        'min-h-[5.5rem] space-y-1.5 border-r border-slate-100 p-1.5 transition-colors',
                        isToday && 'bg-orange-50/40',
                        dropTarget === targetKey && 'bg-blue-50 ring-2 ring-inset ring-blue-300',
                      )}
                    >
                      {dayShifts.map((shift) => renderShiftCard(shift, conflict))}
                      {person.userId && (
                        <button
                          type="button"
                          onClick={() => openCreate(date, person.userId)}
                          className="flex w-full items-center justify-center rounded-md border border-dashed border-slate-300/80 py-1.5 text-slate-400 transition hover:border-orange-400 hover:bg-orange-50 hover:text-orange-600"
                          aria-label={`Lisää varaus: ${person.name} ${date}`}
                        >
                          <Plus size={13} />
                        </button>
                      )}
                      {conflict && (
                        <p className="flex items-start gap-1 break-words text-[10px] font-semibold text-red-700">
                          <AlertTriangle size={11} className="mt-0.5 shrink-0" /> Päällekkäinen varaus
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {!loading && rowPeople.length === 0 && (
            <div className="p-4 sm:p-6">
              <EmptyState
                icon={UsersRound}
                title="Käyttäjiä ei löytynyt"
                description={
                  teamScope !== 'all'
                    ? 'Valitussa HR-tiimissä ei ole jäseniä tällä haulla. Vaihda tiiminäkymää tai hae uudelleen.'
                    : 'Muuta hakua tai kutsu käyttäjät organisaatioon. Työmääräysten kohdistus vaatii lisäksi projektitiimin.'
                }
                action={
                  <Button onClick={() => openCreate()} className="gap-2">
                    <Plus size={16} /> Lisää kalenteriin
                  </Button>
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3 lg:hidden">
        <div className="flex flex-wrap gap-2 pb-1">
          {visibleDays.map((day, index) => (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => setMobileDayIndex(index)}
              className={cn(
                'min-w-20 rounded-xl border px-3 py-2 text-center',
                index === mobileDayIndex
                  ? 'border-orange-300 bg-orange-50 text-orange-800'
                  : 'border-slate-200 bg-white text-slate-600',
              )}
            >
              <span className="block text-xs uppercase">{format(day, 'EEE', { locale: fi })}</span>
              <span className="block font-semibold">{format(day, 'd.M.')}</span>
            </button>
          ))}
        </div>
        {rowPeople.map((person) => {
          const date = isoDate(selectedMobileDay);
          const dayShifts = shiftsFor(person, date);
          const conflict = hasScheduleConflict(dayShifts);
          return (
            <Card key={person.userId ?? `legacy:${person.name}`} className={conflict ? 'border-red-300' : 'border-slate-200'}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{initials(person.name)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium">{person.name}</p>
                    <p className="break-words text-xs text-slate-500">{person.role ? ROLE_LABELS[person.role] : 'Vanha rivi'}</p>
                  </div>
                  {person.userId && <Button variant="outline" size="sm" onClick={() => openCreate(date, person.userId)}><Plus size={15} /></Button>}
                </div>
                {dayShifts.length > 0 ? dayShifts.map((shift) => renderShiftCard(shift, conflict)) : <p className="rounded-lg border border-dashed p-3 text-center text-sm text-slate-400">Ei varauksia</p>}
                {conflict && <p className="flex items-start gap-1 break-words text-xs font-semibold text-red-700"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> Päällekkäinen varaus</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {loading && <div className="flex items-center justify-center p-8 text-sm text-slate-500"><Loader2 size={18} className="mr-2 animate-spin" /> Ladataan resurssikalenteria…</div>}

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && !saving && setDialogOpen(false)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Muokkaa varausta' : 'Lisää kalenteriin'}</DialogTitle>
          </DialogHeader>
          {formErrors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formErrors.map((item) => <p key={item} className="break-words">{item}</p>)}
            </div>
          )}

          {!editing && (
            <div className="grid gap-2">
              <Label>Varauksen tapa</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {([
                  { value: 'work_order_existing' as const, label: 'Olemassa oleva työmääräys' },
                  { value: 'work_order_new' as const, label: 'Uusi työmääräys' },
                  { value: 'manual' as const, label: 'Käsinvaraus' },
                ]).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setBookingKind(option.value);
                      setFormErrors([]);
                    }}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-left text-sm font-medium transition-colors',
                      bookingKind === option.value
                        ? 'border-orange-500 bg-orange-50 text-orange-950'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    <span className="break-words">{option.label}</span>
                  </button>
                ))}
              </div>
              <p className="break-words text-xs text-slate-500">
                {bookingKind === 'work_order_existing'
                  && 'Kohdista asentaja avoimeen työmääräykseen. Asentajan pitää olla projektitiimissä (ei vain HR-tiimissä).'}
                {bookingKind === 'work_order_new'
                  && 'Luo uusi työmääräys valitulle henkilölle tälle päivälle. Jos valitset projektin, henkilö pitää olla projektitiimissä.'}
                {bookingKind === 'manual'
                  && 'Käsinvaraus ei luo työmääräystä — sopii koulutukseen, lomaan tai muuhun resurssivaraukseen.'}
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Käyttäjä *</Label>
              <Select
                value={form.userId}
                onValueChange={(userId) => {
                  setForm((current) => ({
                    ...current,
                    userId,
                    employeeName: peopleById.get(userId)?.name ?? '',
                  }));
                  setExistingWorkOrderId('');
                }}
              >
                <SelectTrigger><SelectValue placeholder="Valitse käyttäjä" /></SelectTrigger>
                <SelectContent>
                  {people.map((person) => (
                    <SelectItem key={person.userId} value={person.userId}>
                      {person.name} · {ROLE_LABELS[person.role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!editing && bookingKind === 'work_order_existing' && (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="wo-search">Hae työmääräystä</Label>
                <Input
                  id="wo-search"
                  value={workOrderSearch}
                  onChange={(event) => setWorkOrderSearch(event.target.value)}
                  placeholder="Otsikko, projekti, sijainti…"
                  disabled={!form.userId}
                />
                <Label>Työmääräys / tilaus / keikka *</Label>
                <Select
                  value={existingWorkOrderId || undefined}
                  onValueChange={setExistingWorkOrderId}
                  disabled={!form.userId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={form.userId ? 'Valitse työmääräys' : 'Valitse ensin käyttäjä'} />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableWorkOrders.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.title}
                        {' · '}
                        {order.project}
                        {' · '}
                        {order.status}
                        {order.assigneeNames.length > 0
                          ? ` · ${order.assigneeNames.join(', ')}`
                          : ' · Ei vastuuhenkilöitä'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.userId && assignableWorkOrders.length === 0 && (
                  <p className="break-words text-xs text-amber-700">
                    Ei kohdistettavia avoimia työmääräyksiä tälle henkilölle.
                    Luo uusi tai lisää henkilö projektitiimiin.
                  </p>
                )}
                {selectedExistingWorkOrder && (
                  <p className="break-words rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    {selectedExistingWorkOrder.plannedStartDate
                      ? `Nykyinen jakso ${selectedExistingWorkOrder.plannedStartDate} – ${selectedExistingWorkOrder.plannedEndDate}.`
                      : 'Työmääräyksellä ei ole vielä aikataulua — valittu päivä asetetaan työjaksoksi.'}
                    {' '}
                    Kalenterisynkronointi pidetään päällä.
                  </p>
                )}
              </div>
            )}

            {(editing || bookingKind !== 'work_order_existing') && (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="shift-title">
                  {bookingKind === 'work_order_new' && !editing ? 'Työmääräyksen otsikko *' : 'Varauksen otsikko'}
                </Label>
                <Input
                  id="shift-title"
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Esim. kalusteasennus tai työmaakäynti"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="shift-date">Päivä *</Label>
              <Input
                id="shift-date"
                type="date"
                value={form.date}
                onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              />
            </div>

            {(editing || bookingKind !== 'work_order_existing') && (
              <div className="space-y-2">
                <Label>Projekti</Label>
                <Select
                  value={form.projectId || ALL_PROJECTS}
                  onValueChange={(value) => setForm((current) => ({
                    ...current,
                    projectId: value === ALL_PROJECTS ? '' : value,
                  }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_PROJECTS}>Ei projektia</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="shift-start">Alkaa *</Label>
              <Input
                id="shift-start"
                type="time"
                value={form.startTime}
                onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shift-end">Päättyy *</Label>
              <Input
                id="shift-end"
                type="time"
                value={form.endTime}
                onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))}
              />
            </div>

            {(editing || bookingKind === 'manual' || bookingKind === 'work_order_new') && (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="shift-type">
                  {bookingKind === 'work_order_new' && !editing ? 'Tyyppi' : 'Varaustyyppi *'}
                </Label>
                <Input
                  id="shift-type"
                  value={form.shiftType}
                  onChange={(event) => setForm((current) => ({ ...current, shiftType: event.target.value }))}
                  placeholder={bookingKind === 'work_order_new' ? 'Esim. asennus' : 'Työvuoro, koulutus, loma…'}
                />
              </div>
            )}

            {(editing || bookingKind === 'manual' || bookingKind === 'work_order_new') && (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="shift-notes">
                  {bookingKind === 'work_order_new' && !editing ? 'Kuvaus / huomio' : 'Huomio'}
                </Label>
                <Textarea
                  id="shift-notes"
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  rows={3}
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {editing && (
                <Button variant="outline" onClick={() => void copyEditingShift(1)} disabled={saving} className="gap-1">
                  <Copy size={14} /> Seuraava päivä
                </Button>
              )}
              {editing && (
                <Button variant="outline" onClick={() => void copyEditingShift(7)} disabled={saving} className="gap-1">
                  <Copy size={14} /> Ensi viikko
                </Button>
              )}
              {editing && (
                <Button
                  variant="ghost"
                  onClick={() => { setDeleteTarget(editing); setDialogOpen(false); }}
                  disabled={saving}
                  className="gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 size={14} /> Poista
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Peruuta</Button>
              <Button onClick={() => void save()} disabled={saving}>
                {saving
                  ? 'Tallennetaan…'
                  : bookingKind === 'work_order_existing' && !editing
                    ? 'Kohdista työmääräys'
                    : bookingKind === 'work_order_new' && !editing
                      ? 'Luo työmääräys'
                      : 'Tallenna'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Poista varaus</AlertDialogTitle><AlertDialogDescription>Poistetaanko {deleteTarget?.employeeName} varaus päivältä {deleteTarget?.date}?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction onClick={() => void remove()} className="bg-red-600 hover:bg-red-700">Poista</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
