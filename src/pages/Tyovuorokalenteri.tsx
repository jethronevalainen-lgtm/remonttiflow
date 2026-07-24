import { useMemo, useState } from 'react';
import { addDays, addWeeks, format, startOfWeek } from 'date-fns';
import { fi } from 'date-fns/locale';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Pencil,
  Plus,
  Trash2,
  UsersRound,
} from 'lucide-react';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import { useSchedulingData, type Shift } from '@/hooks/useSchedulingData';
import {
  createShift,
  deleteShift,
  updateShift,
} from '@/lib/supabase/schedulingEntities';

interface ShiftForm {
  userId: string;
  employeeName: string;
  projectId: string;
  date: string;
  startTime: string;
  endTime: string;
  shiftType: string;
  notes: string;
}

const EMPTY_FORM: ShiftForm = {
  userId: '',
  employeeName: '',
  projectId: '',
  date: '',
  startTime: '07:00',
  endTime: '15:30',
  shiftType: 'Työvuoro',
  notes: '',
};

function isoDate(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

function hoursBetween(start: string, end: string) {
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return 0;
  return Math.max(0, (endHour * 60 + endMinute - startHour * 60 - startMinute) / 60);
}

function tone(type: string) {
  const normalized = type.toLocaleLowerCase('fi');
  if (normalized.includes('loma')) return 'border-purple-200 bg-purple-50 text-purple-800';
  if (normalized.includes('koulutus')) return 'border-blue-200 bg-blue-50 text-blue-800';
  if (normalized.includes('sairas')) return 'border-red-200 bg-red-50 text-red-800';
  return 'border-orange-200 bg-orange-50 text-orange-800';
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?';
}

export default function Tyovuorokalenteri() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { projects } = useAppDataContext();
  const { people } = useRoleWorkspace();
  const { shifts, loading, error, refresh } = useSchedulingData();
  const [weekOffset, setWeekOffset] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Shift | null>(null);
  const [form, setForm] = useState<ShiftForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const weekEnd = days[6];
  const weekShifts = shifts.filter((shift) => shift.date >= isoDate(weekStart) && shift.date <= isoDate(weekEnd));
  const peopleById = useMemo(() => new Map(people.map((person) => [person.userId, person])), [people]);
  const rowPeople = useMemo(() => {
    const map = new Map<string, { userId?: string; name: string }>();
    people.forEach((person) => map.set(person.userId, { userId: person.userId, name: person.name }));
    shifts.filter((shift) => !shift.userId).forEach((shift) => {
      const key = `legacy:${shift.employeeName}`;
      if (shift.employeeName && !map.has(key)) map.set(key, { name: shift.employeeName });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'fi'));
  }, [people, shifts]);
  const totalHours = weekShifts.reduce((sum, shift) => sum + hoursBetween(shift.startTime, shift.endTime), 0);
  const scheduledUsers = new Set(weekShifts.map((shift) => shift.userId || shift.employeeName)).size;

  const openCreate = (date = isoDate(weekStart), userId = '') => {
    const person = peopleById.get(userId);
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      date,
      userId,
      employeeName: person?.name ?? '',
    });
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const openEdit = (shift: Shift) => {
    setEditing(shift);
    setForm({
      userId: shift.userId ?? '',
      employeeName: shift.employeeName,
      projectId: shift.projectId ?? '',
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      shiftType: shift.shiftType,
      notes: shift.notes,
    });
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const save = async () => {
    const nextErrors: string[] = [];
    if (!form.userId) nextErrors.push('Valitse kirjautuva käyttäjä.');
    if (!form.date) nextErrors.push('Päivä on pakollinen.');
    if (!form.startTime || !form.endTime) nextErrors.push('Alku- ja päättymisaika ovat pakollisia.');
    if (form.startTime && form.endTime && form.endTime <= form.startTime) nextErrors.push('Päättymisajan pitää olla alkamisajan jälkeen.');
    if (!form.shiftType.trim()) nextErrors.push('Vuorotyyppi on pakollinen.');
    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg) return;

    const person = peopleById.get(form.userId);
    const project = projects.find((item) => item.id === form.projectId);
    const payload: Omit<Shift, 'id'> = {
      userId: form.userId,
      employeeName: person?.name ?? form.employeeName,
      projectId: form.projectId || undefined,
      project: project?.name ?? '',
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      shiftType: form.shiftType.trim(),
      notes: form.notes.trim(),
    };

    setSaving(true);
    setOperationError(null);
    try {
      if (editing) await updateShift(currentOrg.id, editing.id, payload);
      else await createShift(currentOrg.id, user?.id, payload);
      await refresh();
      setDialogOpen(false);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Työvuoron tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget || !currentOrg) return;
    setSaving(true);
    try {
      await deleteShift(currentOrg.id, deleteTarget.id);
      await refresh();
      setDeleteTarget(null);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Työvuoron poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-col gap-5 rounded-2xl bg-gradient-to-r from-slate-950 to-slate-800 p-6 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300"><CalendarDays size={16} /> Resursointi</div><h1 className="text-3xl font-bold tracking-tight">Työvuorokalenteri</h1><p className="mt-2 text-sm text-slate-300">Vuoro sidotaan kirjautuvaan käyttäjään, jolloin se näkyy automaattisesti hänen omassa työtilassaan.</p></div>
        <Button onClick={() => openCreate()} className="gap-2 bg-orange-500 hover:bg-orange-600"><Plus size={16} /> Lisää työvuoro</Button>
      </div>

      {(error || operationError) && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={16} />{operationError ?? error}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        { label: 'Vuoroja viikolla', value: weekShifts.length, icon: CalendarDays },
        { label: 'Tunteja yhteensä', value: `${totalHours.toFixed(1)} h`, icon: Clock3 },
        { label: 'Käyttäjiä vuorossa', value: scheduledUsers, icon: UsersRound },
        { label: 'Kirjautuvia käyttäjiä', value: people.length, icon: UsersRound },
      ].map((item) => <Card key={item.label} className="border-slate-200 shadow-sm"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-wider text-slate-500">{item.label}</p><p className="mt-2 font-mono text-2xl font-bold">{item.value}</p></div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-700"><item.icon size={19} /></div></div></CardContent></Card>)}</div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setWeekOffset((value) => value - 1)}><ChevronLeft size={16} /></Button><Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>Tämä viikko</Button><Button variant="outline" size="sm" onClick={() => setWeekOffset((value) => value + 1)}><ChevronRight size={16} /></Button></div><p className="font-semibold text-slate-800">{format(weekStart, 'd.M.yyyy', { locale: fi })} – {format(weekEnd, 'd.M.yyyy', { locale: fi })}</p></div>

      <Card className="overflow-x-auto border-slate-200 shadow-sm"><CardContent className="min-w-[1120px] p-0"><div className="grid grid-cols-[190px_repeat(7,minmax(130px,1fr))] border-b bg-slate-50"><div className="border-r p-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Käyttäjä</div>{days.map((day) => <div key={day.toISOString()} className="border-r p-3 text-center"><p className="text-xs font-semibold uppercase text-slate-500">{format(day, 'EEE', { locale: fi })}</p><p className="font-semibold text-slate-900">{format(day, 'd.M.')}</p></div>)}</div>{rowPeople.map((person) => <div key={person.userId ?? `legacy:${person.name}`} className="grid grid-cols-[190px_repeat(7,minmax(130px,1fr))] border-b"><div className="flex items-center gap-2 border-r p-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{initials(person.name)}</div><div className="min-w-0"><p className="truncate text-sm font-medium">{person.name}</p>{!person.userId && <p className="text-[10px] text-amber-600">Vanha nimipohjainen rivi</p>}</div></div>{days.map((day) => {
        const date = isoDate(day);
        const dayShifts = weekShifts.filter((shift) => shift.date === date && (person.userId ? shift.userId === person.userId : !shift.userId && shift.employeeName === person.name));
        return <div key={date} className="min-h-28 space-y-2 border-r p-2">{dayShifts.map((shift) => <button key={shift.id} type="button" onClick={() => openEdit(shift)} className={`w-full rounded-lg border p-2 text-left text-xs ${tone(shift.shiftType)}`}><div className="flex items-start justify-between gap-1"><span className="font-semibold">{shift.startTime}–{shift.endTime}</span><Pencil size={12} /></div><p className="mt-1 truncate">{shift.project || shift.shiftType}</p></button>)}{person.userId && <button type="button" onClick={() => openCreate(date, person.userId)} className="flex w-full items-center justify-center rounded-md border border-dashed border-slate-200 py-1 text-slate-400 hover:border-orange-400 hover:text-orange-600"><Plus size={13} /></button>}</div>;
      })}</div>)}{!loading && rowPeople.length === 0 && <div className="p-12 text-center"><UsersRound size={44} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold">Ei kirjautuvia käyttäjiä</p><p className="mt-1 text-sm text-slate-500">Kutsu käyttäjät organisaatioon ennen vuorojen kohdistamista.</p></div>}</CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{editing ? 'Muokkaa työvuoroa' : 'Lisää työvuoro'}</DialogTitle></DialogHeader>{formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}<div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Kirjautuva käyttäjä *</Label><Select value={form.userId} onValueChange={(userId) => setForm((previous) => ({ ...previous, userId, employeeName: peopleById.get(userId)?.name ?? '' }))}><SelectTrigger><SelectValue placeholder="Valitse käyttäjä" /></SelectTrigger><SelectContent>{people.map((person) => <SelectItem key={person.userId} value={person.userId}>{person.name} · {person.role === 'worker' ? 'Työntekijä' : person.role === 'supervisor' ? 'Työnjohto' : 'Admin'}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="shift-date">Päivä *</Label><Input id="shift-date" type="date" value={form.date} onChange={(event) => setForm((previous) => ({ ...previous, date: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="shift-type">Vuorotyyppi *</Label><Input id="shift-type" value={form.shiftType} onChange={(event) => setForm((previous) => ({ ...previous, shiftType: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="shift-start">Alkaa *</Label><Input id="shift-start" type="time" value={form.startTime} onChange={(event) => setForm((previous) => ({ ...previous, startTime: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="shift-end">Päättyy *</Label><Input id="shift-end" type="time" value={form.endTime} onChange={(event) => setForm((previous) => ({ ...previous, endTime: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label>Projekti</Label><Select value={form.projectId || 'none'} onValueChange={(projectId) => setForm((previous) => ({ ...previous, projectId: projectId === 'none' ? '' : projectId }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei projektia</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="shift-notes">Huomio</Label><Textarea id="shift-notes" value={form.notes} onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))} rows={3} /></div></div><DialogFooter>{editing && <Button variant="ghost" className="mr-auto text-red-600" onClick={() => { setDialogOpen(false); setDeleteTarget(editing); }}><Trash2 size={15} className="mr-1" /> Poista</Button>}<Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void save()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna vuoro'}</Button></DialogFooter></DialogContent></Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Poista työvuoro</AlertDialogTitle><AlertDialogDescription>Poistetaanko {deleteTarget?.employeeName} työvuoro päivältä {deleteTarget?.date}?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction onClick={() => void remove()} className="bg-red-600 hover:bg-red-700">Poista</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </motion.div>
  );
}
