import { useEffect, useMemo, useState } from 'react';
import { Clock3, Loader2, MoonStar, Plus } from 'lucide-react';

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
import { getOrganizationTimeRules, type OrganizationTimeRules } from '@/lib/supabase/payroll';
import { type BreakSource } from '@/lib/supabase/timeEntryClock';
import { createTimeEntryRecord } from '@/lib/supabase/workforceEntities';
import type { TimeEntry, TimeEntryStatus } from '@/types';

type ClockFields = {
  startTime: string;
  endTime: string;
  breakSource: BreakSource;
  breakStartTime?: string;
  breakEndTime?: string;
};

type ClockPayload = Omit<TimeEntry, 'id'> & ClockFields;

function localDateValue() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function durationMinutes(start: string, end: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start === end) return null;
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  const startValue = startHour * 60 + startMinute;
  let endValue = endHour * 60 + endMinute;
  if (endValue <= startValue) endValue += 24 * 60;
  return endValue - startValue;
}

export default function ClockEntryQuickCreate() {
  const { user, profile } = useAuth();
  const { currentOrg, currentRole } = useOrganization();
  const { projects, workOrders, refresh } = useAppDataContext();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<OrganizationTimeRules | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [date, setDate] = useState(localDateValue());
  const [employee, setEmployee] = useState('');
  const [projectId, setProjectId] = useState('');
  const [workOrderId, setWorkOrderId] = useState('');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('15:30');
  const [breakSource, setBreakSource] = useState<BreakSource>('automatic');
  const [breakStartTime, setBreakStartTime] = useState('');
  const [breakEndTime, setBreakEndTime] = useState('');
  const [breakMinutes, setBreakMinutes] = useState('0');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TimeEntryStatus>('Odottaa');

  const canApprove = currentRole === 'admin' || currentRole === 'supervisor';
  const currentEmployee = profile?.full_name || user?.email || 'Käyttäjä';
  const selectedProject = projects.find((project) => project.id === projectId);
  const selectedOrders = workOrders.filter((order) => !projectId || order.projectId === projectId || order.project === selectedProject?.name);
  const grossMinutes = useMemo(() => durationMinutes(startTime, endTime), [endTime, startTime]);
  const manualClockBreak = useMemo(
    () => breakStartTime && breakEndTime ? durationMinutes(breakStartTime, breakEndTime) : null,
    [breakEndTime, breakStartTime],
  );
  const estimatedBreakMinutes = breakSource === 'none'
    ? 0
    : breakSource === 'automatic'
      ? grossMinutes !== null && grossMinutes >= (rules?.automaticBreakAfterMinutes ?? 360)
        ? rules?.automaticBreakMinutes ?? 30
        : 0
      : manualClockBreak ?? Number(breakMinutes || 0);
  const paidMinutes = grossMinutes === null ? null : Math.max(0, grossMinutes - estimatedBreakMinutes);
  const overnight = grossMinutes !== null && endTime <= startTime;

  useEffect(() => {
    setEmployee(currentEmployee);
  }, [currentEmployee]);

  useEffect(() => {
    if (!currentOrg) return;
    void getOrganizationTimeRules(currentOrg.id).then(setRules).catch(() => setRules(null));
  }, [currentOrg]);

  const reset = () => {
    setDate(localDateValue());
    setEmployee(currentEmployee);
    setProjectId('');
    setWorkOrderId('');
    setStartTime('07:00');
    setEndTime('15:30');
    setBreakSource('automatic');
    setBreakStartTime('');
    setBreakEndTime('');
    setBreakMinutes('0');
    setDescription('');
    setStatus('Odottaa');
    setError(null);
  };

  const save = async () => {
    if (!currentOrg) return;
    const errors: string[] = [];
    if (!date) errors.push('Päivämäärä puuttuu.');
    if (!employee.trim()) errors.push('Työntekijä puuttuu.');
    if (!selectedProject) errors.push('Valitse projekti.');
    if (grossMinutes === null) errors.push('Anna eriävät alku- ja loppuajat.');
    if (breakSource === 'manual' && Boolean(breakStartTime) !== Boolean(breakEndTime)) {
      errors.push('Anna tauolle sekä alku- että loppuaika.');
    }
    const numericBreakMinutes = Number(breakMinutes || 0);
    if (breakSource === 'manual' && manualClockBreak === null && (!Number.isInteger(numericBreakMinutes) || numericBreakMinutes < 0)) {
      errors.push('Tauon pitää olla kokonaisluku minuutteina.');
    }
    if (grossMinutes !== null && estimatedBreakMinutes >= grossMinutes) errors.push('Tauko ei voi olla yhtä pitkä tai pidempi kuin työvuoro.');
    if (errors.length > 0) {
      setError(errors.join(' '));
      return;
    }

    const payload: ClockPayload = {
      date,
      userId: user?.id,
      employee: employee.trim(),
      projectId,
      project: selectedProject!.name,
      workOrderId: workOrderId || undefined,
      hours: Math.max(0.01, (paidMinutes ?? 1) / 60),
      overtime: 0,
      breakMinutes: breakSource === 'manual' ? manualClockBreak ?? numericBreakMinutes : 0,
      breakSource,
      startTime,
      endTime,
      breakStartTime: breakSource === 'manual' ? breakStartTime || undefined : undefined,
      breakEndTime: breakSource === 'manual' ? breakEndTime || undefined : undefined,
      source: 'manual-clock',
      description: description.trim(),
      status: canApprove ? status : 'Odottaa',
    };

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await createTimeEntryRecord(currentOrg.id, user?.id, payload);
      await refresh();
      setSuccess(`Työvuoro ${startTime}–${endTime} tallennettiin. Palvelin laski maksettavan työajan ja tauon.`);
      setOpen(false);
      reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kellonaikakirjauksen tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-white">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-slate-900"><Clock3 size={19} className="text-orange-600" />Kellonaikapohjainen työvuoro</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">Kirjaa alku- ja loppuaika. Yön yli jatkuva vuoro, automaattinen tauko sekä ilta- ja yötyön laskenta käsitellään palvelimella.</p>
            {success && <p className="mt-2 text-sm font-medium text-emerald-700">{success}</p>}
            {error && !open && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}
          </div>
          <Button className="shrink-0 gap-2" onClick={() => { reset(); setOpen(true); }}><Plus size={16} />Kirjaa kellonajoilla</Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Uusi kellonaikapohjainen työvuoro</DialogTitle></DialogHeader>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="clock-date">Päivä *</Label><Input id="clock-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="clock-employee">Työntekijä *</Label><Input id="clock-employee" value={employee} onChange={(event) => setEmployee(event.target.value)} disabled={!canApprove} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Projekti *</Label><Select value={projectId} onValueChange={(value) => { setProjectId(value); setWorkOrderId(''); }}><SelectTrigger><SelectValue placeholder="Valitse projekti" /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 sm:col-span-2"><Label>Työmääräys</Label><Select value={workOrderId || 'none'} onValueChange={(value) => setWorkOrderId(value === 'none' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei työmääräystä</SelectItem>{selectedOrders.map((order) => <SelectItem key={order.id} value={order.id}>{order.title}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="clock-start">Alkamisaika *</Label><Input id="clock-start" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="clock-end">Päättymisaika *</Label><Input id="clock-end" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Taukotapa</Label><Select value={breakSource} onValueChange={(value: BreakSource) => setBreakSource(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="automatic">Automaattinen organisaation säännön mukaan</SelectItem><SelectItem value="manual">Manuaalinen tauko</SelectItem><SelectItem value="none">Ei taukoa</SelectItem></SelectContent></Select></div>
            {breakSource === 'manual' && <><div className="space-y-2"><Label htmlFor="clock-break-start">Tauon alku</Label><Input id="clock-break-start" type="time" value={breakStartTime} onChange={(event) => setBreakStartTime(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="clock-break-end">Tauon loppu</Label><Input id="clock-break-end" type="time" value={breakEndTime} onChange={(event) => setBreakEndTime(event.target.value)} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="clock-break-minutes">Tauko minuutteina, jos kellonaikoja ei anneta</Label><Input id="clock-break-minutes" type="number" min="0" step="1" value={breakMinutes} onChange={(event) => setBreakMinutes(event.target.value)} /></div></>}
            {grossMinutes !== null && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:col-span-2"><div className="flex items-center gap-2 font-semibold">{overnight && <MoonStar size={16} className="text-indigo-600" />}Työvuoron esikatselu</div><p className="mt-1 text-slate-600">Kesto {Math.floor(grossMinutes / 60)} h {grossMinutes % 60} min · tauko {estimatedBreakMinutes} min · maksettava aika noin {((paidMinutes ?? 0) / 60).toFixed(2)} h{overnight ? ' · vuoro päättyy seuraavana päivänä' : ''}.</p><p className="mt-1 text-xs text-slate-500">Palvelin vahvistaa tauon, ylityöt sekä ilta- ja yötyölisät organisaation sääntöjen perusteella.</p></div>}
            {canApprove && <div className="space-y-2"><Label>Tila</Label><Select value={status} onValueChange={(value: TimeEntryStatus) => setStatus(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(['Odottaa', 'Hyväksytty', 'Hylätty'] as TimeEntryStatus[]).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>}
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="clock-description">Työn kuvaus</Label><Textarea id="clock-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Peruuta</Button><Button onClick={() => void save()} disabled={saving}>{saving ? <><Loader2 size={15} className="mr-2 animate-spin" />Tallennetaan…</> : 'Tallenna työvuoro'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
