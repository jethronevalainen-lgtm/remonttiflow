import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ChevronLeft, ChevronRight, Clock, Plus, Trash2, Users } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSchedulingData, type Shift } from '@/hooks/useSchedulingData';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import logger from '@/lib/logger';
import { createShift, deleteShift, updateShift } from '@/lib/supabase/schedulingEntities';

interface ShiftForm {
  employeeId: string;
  employeeName: string;
  projectId: string;
  project: string;
  date: string;
  startTime: string;
  endTime: string;
  shiftType: string;
  notes: string;
}

const emptyForm: ShiftForm = {
  employeeId: '',
  employeeName: '',
  projectId: '',
  project: '',
  date: new Date().toISOString().slice(0, 10),
  startTime: '07:00',
  endTime: '15:00',
  shiftType: 'Työvuoro',
  notes: '',
};

function startOfWeek(value: Date) {
  const date = new Date(value);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function isoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateHours(start: string, end: string) {
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return 0;
  return Math.max(0, endHour + endMinute / 60 - startHour - startMinute / 60);
}

function shiftTone(type: string) {
  const value = type.toLowerCase();
  if (value.includes('loma')) return 'border-purple-200 bg-purple-50 text-purple-800';
  if (value.includes('sair')) return 'border-red-200 bg-red-50 text-red-800';
  if (value.includes('koul')) return 'border-blue-200 bg-blue-50 text-blue-800';
  return 'border-emerald-200 bg-emerald-50 text-emerald-800';
}

export default function Tyovuorokalenteri() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { employees, projects } = useAppDataContext();
  const { shifts, loading, error, refresh } = useSchedulingData();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Shift | null>(null);
  const [form, setForm] = useState<ShiftForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const weekShifts = useMemo(() => {
    const weekDates = new Set(days.map(isoDate));
    return shifts.filter((shift) => weekDates.has(shift.date));
  }, [days, shifts]);
  const employeeNames = useMemo(() => {
    const names = new Set([
      ...employees
        .filter((employee) => employee.status !== 'Eroonnut')
        .map((employee) => employee.name),
      ...weekShifts.map((shift) => shift.employeeName).filter(Boolean),
    ]);
    return [...names].sort((a, b) => a.localeCompare(b, 'fi'));
  }, [employees, weekShifts]);

  const weekEnd = days[6];
  const totalHours = weekShifts.reduce(
    (sum, shift) => sum + calculateHours(shift.startTime, shift.endTime),
    0,
  );
  const uncoveredDays = days.filter(
    (day) => !weekShifts.some((shift) => shift.date === isoDate(day)),
  ).length;

  const openCreate = (date?: string, employeeName?: string) => {
    const employee = employees.find((item) => item.name === employeeName);
    setEditing(null);
    setForm({
      ...emptyForm,
      date: date ?? isoDate(weekStart),
      employeeId: employee?.id ?? '',
      employeeName: employeeName ?? '',
    });
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const openEdit = (shift: Shift) => {
    setEditing(shift);
    setForm({
      employeeId: shift.employeeId ?? '',
      employeeName: shift.employeeName,
      projectId: shift.projectId ?? '',
      project: shift.project,
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
    if (!form.employeeName.trim()) nextErrors.push('Työntekijä on pakollinen.');
    if (!form.date) nextErrors.push('Päivämäärä on pakollinen.');
    if (!form.startTime || !form.endTime) nextErrors.push('Alku- ja loppuaika ovat pakollisia.');
    if (form.startTime && form.endTime && form.endTime <= form.startTime) {
      nextErrors.push('Loppuajan pitää olla alkuajan jälkeen.');
    }
    if (!form.shiftType.trim()) nextErrors.push('Vuorotyyppi on pakollinen.');
    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg) return;

    const payload: Omit<Shift, 'id'> = {
      employeeId: form.employeeId || undefined,
      employeeName: form.employeeName.trim(),
      projectId: form.projectId || undefined,
      project: form.project.trim(),
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
      const message = caught instanceof Error ? caught.message : 'Tallennus epäonnistui.';
      setOperationError(message);
      logger.error('Työvuoron tallennus epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  const removeSelectedShift = async () => {
    if (!deleteTarget || !currentOrg) return;
    setSaving(true);
    try {
      await deleteShift(currentOrg.id, deleteTarget.id);
      await refresh();
      setDeleteTarget(null);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-hero text-text-primary">Työvuorokalenteri</h1>
          <p className="mt-1 text-body-sm text-text-secondary">
            Henkilöstön viikkosuunnittelu ja projektikohdistus
          </p>
        </div>
        <Button onClick={() => openCreate()} className="gap-2">
          <Plus size={16} /> Lisää vuoro
        </Button>
      </div>

      {(error || operationError) && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} /> {operationError ?? error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5"><div className="mb-2 flex justify-between text-sm text-text-secondary"><span>Vuoroja viikolla</span><Clock size={18} className="text-primary" /></div><p className="font-mono text-3xl font-bold">{weekShifts.length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="mb-2 flex justify-between text-sm text-text-secondary"><span>Suunnitellut tunnit</span><Clock size={18} className="text-primary" /></div><p className="font-mono text-3xl font-bold">{totalHours.toFixed(1)} h</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="mb-2 flex justify-between text-sm text-text-secondary"><span>Päiviä ilman vuoroja</span><AlertTriangle size={18} className={uncoveredDays > 0 ? 'text-amber-600' : 'text-emerald-600'} /></div><p className="font-mono text-3xl font-bold">{uncoveredDays}</p></CardContent></Card>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekStart((previous) => addDays(previous, -7))}><ChevronLeft size={16} /></Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>Tämä viikko</Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart((previous) => addDays(previous, 7))}><ChevronRight size={16} /></Button>
        </div>
        <p className="font-semibold text-text-primary">
          {weekStart.toLocaleDateString('fi-FI')} – {weekEnd.toLocaleDateString('fi-FI')}
        </p>
      </div>

      <Card className="overflow-x-auto border-slate-200 shadow-card">
        <CardContent className="min-w-[1100px] p-0">
          <div className="grid grid-cols-[180px_repeat(7,minmax(125px,1fr))] border-b bg-slate-50">
            <div className="border-r p-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Henkilö</div>
            {days.map((day) => (
              <div key={day.toISOString()} className="border-r p-3 text-center">
                <p className="text-xs font-semibold uppercase text-text-muted">
                  {day.toLocaleDateString('fi-FI', { weekday: 'short' })}
                </p>
                <p className="font-semibold text-text-primary">
                  {day.toLocaleDateString('fi-FI', { day: 'numeric', month: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
          {employeeNames.map((employeeName) => (
            <div key={employeeName} className="grid grid-cols-[180px_repeat(7,minmax(125px,1fr))] border-b">
              <div className="flex items-center gap-2 border-r p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary">
                  {employeeName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <span className="truncate text-sm font-medium">{employeeName}</span>
              </div>
              {days.map((day) => {
                const date = isoDate(day);
                const dayShifts = weekShifts.filter(
                  (shift) => shift.employeeName === employeeName && shift.date === date,
                );
                return (
                  <div key={date} className="min-h-28 space-y-2 border-r p-2">
                    {dayShifts.map((shift) => (
                      <button
                        key={shift.id}
                        type="button"
                        onClick={() => openEdit(shift)}
                        className={`w-full rounded-lg border p-2 text-left text-xs ${shiftTone(shift.shiftType)}`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-semibold">{shift.startTime}–{shift.endTime}</span>
                          <Badge variant="outline" className="h-5 px-1 text-[10px]">{shift.shiftType}</Badge>
                        </div>
                        <p className="mt-1 truncate">{shift.project || 'Ei projektia'}</p>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => openCreate(date, employeeName)}
                      className="flex w-full items-center justify-center rounded-md border border-dashed border-slate-200 py-1 text-slate-400 hover:border-primary hover:text-primary"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
          {!loading && employeeNames.length === 0 && (
            <div className="p-12 text-center">
              <Users size={44} className="mx-auto mb-3 text-text-muted" />
              <p className="font-semibold">Ei henkilöstöä tai työvuoroja</p>
              <p className="mt-1 text-sm text-text-secondary">
                Lisää henkilöstörekisteriin työntekijöitä ja luo ensimmäinen vuoro.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>{editing ? 'Muokkaa työvuoroa' : 'Lisää työvuoro'}</DialogTitle></DialogHeader>
          {formErrors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formErrors.map((item) => <p key={item}>{item}</p>)}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Työntekijä *</Label>
              {employees.length > 0 ? (
                <Select
                  value={form.employeeId}
                  onValueChange={(employeeId) => {
                    const employee = employees.find((item) => item.id === employeeId);
                    setForm((previous) => ({
                      ...previous,
                      employeeId,
                      employeeName: employee?.name ?? previous.employeeName,
                    }));
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Valitse työntekijä" /></SelectTrigger>
                  <SelectContent>
                    {employees.filter((employee) => employee.status !== 'Eroonnut').map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={form.employeeName}
                  onChange={(event) => setForm((previous) => ({ ...previous, employeeName: event.target.value }))}
                />
              )}
            </div>
            <div className="space-y-2"><Label htmlFor="shift-date">Päivä *</Label><Input id="shift-date" type="date" value={form.date} onChange={(event) => setForm((previous) => ({ ...previous, date: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="shift-type">Vuorotyyppi *</Label><Input id="shift-type" value={form.shiftType} onChange={(event) => setForm((previous) => ({ ...previous, shiftType: event.target.value }))} placeholder="Työvuoro, loma, koulutus…" /></div>
            <div className="space-y-2"><Label htmlFor="shift-start">Alkaa *</Label><Input id="shift-start" type="time" value={form.startTime} onChange={(event) => setForm((previous) => ({ ...previous, startTime: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="shift-end">Päättyy *</Label><Input id="shift-end" type="time" value={form.endTime} onChange={(event) => setForm((previous) => ({ ...previous, endTime: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Projekti</Label>
              {projects.length > 0 ? (
                <Select
                  value={form.projectId}
                  onValueChange={(projectId) => {
                    const project = projects.find((item) => item.id === projectId);
                    setForm((previous) => ({
                      ...previous,
                      projectId,
                      project: project?.name ?? previous.project,
                    }));
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Valitse projekti" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={form.project}
                  onChange={(event) => setForm((previous) => ({ ...previous, project: event.target.value }))}
                />
              )}
            </div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="shift-notes">Huomiot</Label><Textarea id="shift-notes" value={form.notes} onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))} /></div>
          </div>
          <DialogFooter className="sm:justify-between">
            <div>
              {editing && (
                <Button
                  variant="ghost"
                  className="text-danger"
                  onClick={() => {
                    setDialogOpen(false);
                    setDeleteTarget(editing);
                  }}
                >
                  <Trash2 size={14} className="mr-1" /> Poista
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Peruuta</Button>
              <Button onClick={() => void save()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna'}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Poista työvuoro</DialogTitle></DialogHeader>
          <p className="text-sm text-text-secondary">
            Poistetaanko {deleteTarget?.employeeName} työvuoro päivältä {deleteTarget?.date}?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Peruuta</Button>
            <Button variant="destructive" onClick={() => void removeSelectedShift()} disabled={saving}>Poista</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
