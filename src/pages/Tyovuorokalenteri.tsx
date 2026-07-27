import { useMemo, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ROLE_LABELS, useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import { useSchedulingData, type Shift } from '@/hooks/useSchedulingData';
import {
  hasScheduleConflict,
  hoursBetween,
  shiftedDate,
  shiftedWorkOrderStart,
} from '@/lib/resourceCalendar';
import {
  createShift,
  createShifts,
  deleteShift,
  updateShift,
} from '@/lib/supabase/schedulingEntities';
import { moveManagedWorkOrderSchedule } from '@/lib/supabase/workManagement';

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
  if (conflict) return 'border-red-300 bg-red-50 text-red-900 ring-1 ring-red-200';
  if (shift.sourceType === 'work_order') return 'border-blue-300 bg-blue-50 text-blue-900';
  const type = shift.shiftType.toLocaleLowerCase('fi');
  if (type.includes('loma')) return 'border-purple-200 bg-purple-50 text-purple-800';
  if (type.includes('koulutus')) return 'border-cyan-200 bg-cyan-50 text-cyan-800';
  if (type.includes('sairas')) return 'border-red-200 bg-red-50 text-red-800';
  return 'border-orange-200 bg-orange-50 text-orange-900';
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
  const { projects } = useAppDataContext();
  const { people, workOrders, refresh: refreshWorkspace } = useRoleWorkspace();
  const { shifts, loading, error, refresh } = useSchedulingData();

  const [weekOffset, setWeekOffset] = useState(0);
  const [showWeekends, setShowWeekends] = useState(false);
  const [personSearch, setPersonSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState(ALL_PROJECTS);
  const [mobileDayIndex, setMobileDayIndex] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Shift | null>(null);
  const [form, setForm] = useState<ShiftForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const allDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const visibleDays = showWeekends ? allDays : allDays.slice(0, 5);
  const weekEnd = allDays[6];
  const weekShifts = shifts.filter((shift) => shift.date >= isoDate(weekStart) && shift.date <= isoDate(weekEnd));
  const filteredWeekShifts = projectFilter === ALL_PROJECTS
    ? weekShifts
    : weekShifts.filter((shift) => shift.projectId === projectFilter);

  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.userId, person])),
    [people],
  );

  const rowPeople = useMemo(() => {
    const map = new Map<string, CalendarPerson>();
    people.forEach((person) => map.set(person.userId, {
      userId: person.userId,
      name: person.name,
      role: person.role,
    }));
    shifts.filter((shift) => !shift.userId).forEach((shift) => {
      const key = `legacy:${shift.employeeName}`;
      if (shift.employeeName && !map.has(key)) map.set(key, { name: shift.employeeName });
    });
    const query = personSearch.trim().toLocaleLowerCase('fi');
    return [...map.values()]
      .filter((person) => !query || `${person.name} ${person.role ? ROLE_LABELS[person.role] : ''}`.toLocaleLowerCase('fi').includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, 'fi'));
  }, [people, personSearch, shifts]);

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

  const openCreate = (date = isoDate(weekStart), userId = '') => {
    const person = peopleById.get(userId);
    setEditing(null);
    setForm({ ...EMPTY_FORM, date, userId, employeeName: person?.name ?? '' });
    setFormErrors([]);
    setOperationError(null);
    setSuccessMessage(null);
    setDialogOpen(true);
  };

  const openEdit = (shift: Shift) => {
    if (shift.sourceType === 'work_order') {
      navigate('/tyomaaraykset');
      return;
    }
    setEditing(shift);
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
    if (form.startTime && form.endTime && form.endTime <= form.startTime) next.push('Päättymisajan pitää olla alkamisajan jälkeen.');
    if (!form.shiftType.trim()) next.push('Varaustyyppi on pakollinen.');
    return next;
  };

  const save = async () => {
    const nextErrors = validateForm();
    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg) return;

    const person = peopleById.get(form.userId);
    const project = projects.find((item) => item.id === form.projectId);
    const payload = manualShift({
      ...form,
      employeeName: person?.name ?? form.employeeName,
    }, project?.name ?? '');

    setSaving(true);
    setOperationError(null);
    try {
      if (editing) await updateShift(currentOrg.id, editing.id, payload);
      else await createShift(currentOrg.id, user?.id, payload);
      await refresh();
      setDialogOpen(false);
      setSuccessMessage(editing ? 'Varaus päivitettiin.' : 'Varaus lisättiin kalenteriin.');
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
      className={`group w-full rounded-lg border p-2 text-left text-xs shadow-sm transition hover:shadow-md ${cardTone(shift, conflict)}`}
      title={shift.sourceType === 'manual' ? 'Vedä siirtääksesi. Alt/Option + vedä kopioidaksesi.' : 'Vedä siirtääksesi koko työmääräyksen työjaksoa.'}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="font-semibold">{shift.startTime}–{shift.endTime}</span>
        <span className="flex items-center gap-1 opacity-60 group-hover:opacity-100">
          {shift.sourceType === 'manual' ? <Pencil size={12} /> : <Layers3 size={12} />}
          <GripVertical size={12} />
        </span>
      </div>
      <p className="mt-1 line-clamp-2 font-medium">{shift.title || shift.project || shift.shiftType}</p>
      {shift.project && shift.title && <p className="mt-1 truncate opacity-75">{shift.project}</p>}
      <div className="mt-1 flex items-center justify-between gap-2">
        <span>{hoursBetween(shift.startTime, shift.endTime).toFixed(1)} h</span>
        <span className="truncate">{shift.sourceType === 'work_order' ? 'Työmääräys' : shift.shiftType}</span>
      </div>
    </button>
  );

  const selectedMobileDay = visibleDays[Math.min(mobileDayIndex, visibleDays.length - 1)] ?? visibleDays[0];
  const gridMinWidth = 220 + visibleDays.length * 150;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-[1700px] space-y-6">
      <div className="flex flex-col gap-5 rounded-2xl bg-gradient-to-r from-slate-950 to-slate-800 p-6 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300"><CalendarDays size={16} /> Resursointi</div>
          <h1 className="text-3xl font-bold tracking-tight">Resurssikalenteri</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Siirrä varaus vetämällä. Pidä Alt/Option pohjassa kopioidaksesi käsin luodun varauksen. Työmääräysvaraus siirtää koko työjakson.
          </p>
        </div>
        <Button onClick={() => openCreate()} className="gap-2 bg-orange-500 hover:bg-orange-600"><Plus size={16} /> Lisää varaus</Button>
      </div>

      {(error || operationError) && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={16} />{operationError ?? error}</div>}
      {successMessage && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{successMessage}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: 'Varauksia viikolla', value: filteredWeekShifts.length, icon: CalendarDays },
          { label: 'Tunteja yhteensä', value: `${totalHours.toFixed(1)} h`, icon: Clock3 },
          { label: 'Käyttäjiä varattuna', value: scheduledUsers, icon: UsersRound },
          { label: 'Kirjautuvia käyttäjiä', value: people.length, icon: UsersRound },
          { label: 'Päällekkäisiä päiviä', value: conflictCount, icon: AlertTriangle },
        ].map((item) => <Card key={item.label} className="border-slate-200 shadow-sm"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-wider text-slate-500">{item.label}</p><p className="mt-2 font-mono text-2xl font-bold">{item.value}</p></div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-700"><item.icon size={19} /></div></div></CardContent></Card>)}
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 xl:grid-cols-[auto_1fr_240px_auto] xl:items-center">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((value) => value - 1)}><ChevronLeft size={16} /></Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>Tämä viikko</Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((value) => value + 1)}><ChevronRight size={16} /></Button>
        </div>
        <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input value={personSearch} onChange={(event) => setPersonSearch(event.target.value)} placeholder="Hae työntekijää tai roolia…" className="pl-9" /></div>
        <Select value={projectFilter} onValueChange={setProjectFilter}><SelectTrigger><Filter size={15} className="mr-2" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL_PROJECTS}>Kaikki projektit ja varaukset</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700"><Checkbox checked={showWeekends} onCheckedChange={(checked) => { setShowWeekends(checked === true); setMobileDayIndex(0); }} /> Näytä viikonloput</label>
        <p className="font-semibold text-slate-800 xl:col-span-4 xl:text-right">{format(weekStart, 'd.M.yyyy', { locale: fi })} – {format(weekEnd, 'd.M.yyyy', { locale: fi })}</p>
      </div>

      <Card className="hidden overflow-x-auto border-slate-200 shadow-sm lg:block">
        <CardContent className="p-0" style={{ minWidth: gridMinWidth }}>
          <div className="grid border-b bg-slate-50" style={{ gridTemplateColumns: `220px repeat(${visibleDays.length}, minmax(150px, 1fr))` }}>
            <div className="border-r p-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Käyttäjä</div>
            {visibleDays.map((day) => <div key={day.toISOString()} className="border-r p-3 text-center"><p className="text-xs font-semibold uppercase text-slate-500">{format(day, 'EEE', { locale: fi })}</p><p className="font-semibold text-slate-900">{format(day, 'd.M.')}</p></div>)}
          </div>

          {rowPeople.map((person) => {
            const personWeekShifts = filteredWeekShifts.filter((shift) => person.userId ? shift.userId === person.userId : !shift.userId && shift.employeeName === person.name);
            const weeklyHours = personWeekShifts.reduce((sum, shift) => sum + hoursBetween(shift.startTime, shift.endTime), 0);
            return (
              <div key={person.userId ?? `legacy:${person.name}`} className="grid border-b" style={{ gridTemplateColumns: `220px repeat(${visibleDays.length}, minmax(150px, 1fr))` }}>
                <div className="border-r p-3">
                  <div className="flex items-center gap-2"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{initials(person.name)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{person.name}</p><p className="truncate text-[11px] text-slate-500">{person.role ? ROLE_LABELS[person.role] : 'Vanha nimipohjainen rivi'} · {weeklyHours.toFixed(1)} h</p></div></div>
                  {person.userId && <Button variant="ghost" size="sm" onClick={() => void copyPersonWeek(person)} disabled={saving} className="mt-2 h-7 w-full justify-start gap-1 px-2 text-xs text-slate-500"><Copy size={13} /> Kopioi käsivuorot ensi viikolle</Button>}
                </div>

                {visibleDays.map((day) => {
                  const date = isoDate(day);
                  const dayShifts = shiftsFor(person, date);
                  const conflict = hasScheduleConflict(dayShifts);
                  const targetKey = `${person.userId ?? person.name}:${date}`;
                  return (
                    <div
                      key={date}
                      onDragOver={(event) => { if (person.userId) { event.preventDefault(); setDropTarget(targetKey); } }}
                      onDragLeave={() => setDropTarget((current) => current === targetKey ? null : current)}
                      onDrop={(event) => { event.preventDefault(); void dropShift(person, date); }}
                      className={`min-h-32 space-y-2 border-r p-2 transition-colors ${dropTarget === targetKey ? 'bg-blue-50 ring-2 ring-inset ring-blue-300' : ''}`}
                    >
                      {dayShifts.map((shift) => renderShiftCard(shift, conflict))}
                      {person.userId && <button type="button" onClick={() => openCreate(date, person.userId)} className="flex w-full items-center justify-center rounded-md border border-dashed border-slate-200 py-1 text-slate-400 hover:border-orange-400 hover:text-orange-600"><Plus size={13} /></button>}
                      {conflict && <p className="flex items-center gap-1 text-[10px] font-semibold text-red-700"><AlertTriangle size={11} /> Päällekkäinen varaus</p>}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {!loading && rowPeople.length === 0 && <div className="p-12 text-center"><UsersRound size={44} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold">Käyttäjiä ei löytynyt</p><p className="mt-1 text-sm text-slate-500">Muuta hakua tai kutsu käyttäjät organisaatioon.</p></div>}
        </CardContent>
      </Card>

      <div className="space-y-3 lg:hidden">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {visibleDays.map((day, index) => <button key={day.toISOString()} type="button" onClick={() => setMobileDayIndex(index)} className={`min-w-20 rounded-xl border px-3 py-2 text-center ${index === mobileDayIndex ? 'border-orange-300 bg-orange-50 text-orange-800' : 'border-slate-200 bg-white text-slate-600'}`}><span className="block text-xs uppercase">{format(day, 'EEE', { locale: fi })}</span><span className="block font-semibold">{format(day, 'd.M.')}</span></button>)}
        </div>
        {rowPeople.map((person) => {
          const date = isoDate(selectedMobileDay);
          const dayShifts = shiftsFor(person, date);
          const conflict = hasScheduleConflict(dayShifts);
          return (
            <Card key={person.userId ?? `legacy:${person.name}`} className={conflict ? 'border-red-300' : 'border-slate-200'}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{initials(person.name)}</div><div className="min-w-0 flex-1"><p className="truncate font-medium">{person.name}</p><p className="text-xs text-slate-500">{person.role ? ROLE_LABELS[person.role] : 'Vanha rivi'}</p></div>{person.userId && <Button variant="outline" size="sm" onClick={() => openCreate(date, person.userId)}><Plus size={15} /></Button>}</div>
                {dayShifts.length > 0 ? dayShifts.map((shift) => renderShiftCard(shift, conflict)) : <p className="rounded-lg border border-dashed p-3 text-center text-sm text-slate-400">Ei varauksia</p>}
                {conflict && <p className="flex items-center gap-1 text-xs font-semibold text-red-700"><AlertTriangle size={13} /> Päällekkäinen varaus</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {loading && <div className="flex items-center justify-center p-8 text-sm text-slate-500"><Loader2 size={18} className="mr-2 animate-spin" /> Ladataan resurssikalenteria…</div>}

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && !saving && setDialogOpen(false)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>{editing ? 'Muokkaa varausta' : 'Lisää varaus'}</DialogTitle></DialogHeader>
          {formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Käyttäjä *</Label><Select value={form.userId} onValueChange={(userId) => setForm((current) => ({ ...current, userId, employeeName: peopleById.get(userId)?.name ?? '' }))}><SelectTrigger><SelectValue placeholder="Valitse käyttäjä" /></SelectTrigger><SelectContent>{people.map((person) => <SelectItem key={person.userId} value={person.userId}>{person.name} · {ROLE_LABELS[person.role]}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="shift-title">Varauksen otsikko</Label><Input id="shift-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Esim. kalusteasennus tai työmaakäynti" /></div>
            <div className="space-y-2"><Label htmlFor="shift-date">Päivä *</Label><Input id="shift-date" type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Projekti</Label><Select value={form.projectId || ALL_PROJECTS} onValueChange={(value) => setForm((current) => ({ ...current, projectId: value === ALL_PROJECTS ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL_PROJECTS}>Ei projektia</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="shift-start">Alkaa *</Label><Input id="shift-start" type="time" value={form.startTime} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="shift-end">Päättyy *</Label><Input id="shift-end" type="time" value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="shift-type">Varaustyyppi *</Label><Input id="shift-type" value={form.shiftType} onChange={(event) => setForm((current) => ({ ...current, shiftType: event.target.value }))} placeholder="Työvuoro, koulutus, loma…" /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="shift-notes">Huomio</Label><Textarea id="shift-notes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={3} /></div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {editing && <Button variant="outline" onClick={() => void copyEditingShift(1)} disabled={saving} className="gap-1"><Copy size={14} /> Seuraava päivä</Button>}
              {editing && <Button variant="outline" onClick={() => void copyEditingShift(7)} disabled={saving} className="gap-1"><Copy size={14} /> Ensi viikko</Button>}
              {editing && <Button variant="ghost" onClick={() => { setDeleteTarget(editing); setDialogOpen(false); }} disabled={saving} className="gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"><Trash2 size={14} /> Poista</Button>}
            </div>
            <div className="flex gap-2"><Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void save()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna'}</Button></div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Poista varaus</AlertDialogTitle><AlertDialogDescription>Poistetaanko {deleteTarget?.employeeName} varaus päivältä {deleteTarget?.date}?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction onClick={() => void remove()} className="bg-red-600 hover:bg-red-700">Poista</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
