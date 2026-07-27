import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  Loader2,
  LocateFixed,
  Lock,
  MapPin,
  Plus,
  Square,
  Trash2,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import logger from '@/lib/logger';
import {
  createTimeEntryRecord,
  deleteTimeEntryRecord,
  updateTimeEntryRecord,
} from '@/lib/supabase/workforceEntities';
import {
  captureCurrentWorkSiteLocation,
  completeWorkSiteCheckIn,
  createWorkSiteCheckIn,
  listWorkSiteCheckIns,
  workSiteMapUrl,
  type WorkSiteCheckIn,
} from '@/lib/supabase/workSiteCheckIns';
import type { TimeEntry, TimeEntryStatus } from '@/types';

const TIMER_START_KEY = 'vakantti-time-timer-start';
const TIMER_PROJECT_KEY = 'vakantti-time-timer-project';
const TIMER_DESCRIPTION_KEY = 'vakantti-time-timer-description';
const TIMER_CHECK_IN_KEY = 'vakantti-time-work-site-check-in';

type EntryMode = 'clock' | 'duration';

interface EntryForm {
  mode: EntryMode;
  date: string;
  employee: string;
  projectId: string;
  project: string;
  workOrderId: string;
  startTime: string;
  endTime: string;
  breakStartTime: string;
  breakEndTime: string;
  hours: string;
  overtime: string;
  breakMinutes: string;
  description: string;
  status: TimeEntryStatus;
}

const emptyForm: EntryForm = {
  mode: 'clock',
  date: new Date().toISOString().slice(0, 10),
  employee: '',
  projectId: '',
  project: '',
  workOrderId: '',
  startTime: '',
  endTime: '',
  breakStartTime: '',
  breakEndTime: '',
  hours: '',
  overtime: '0',
  breakMinutes: '0',
  description: '',
  status: 'Odottaa',
};

function toIsoDate(value: string) {
  const finnish = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value);
  return finnish
    ? `${finnish[3]}-${finnish[2].padStart(2, '0')}-${finnish[1].padStart(2, '0')}`
    : value;
}

function clockMinutes(start: string, end: string) {
  if (!/^\d{2}:\d{2}/.test(start) || !/^\d{2}:\d{2}/.test(end)) return 0;
  const [startHour, startMinute] = start.slice(0, 5).split(':').map(Number);
  const [endHour, endMinute] = end.slice(0, 5).split(':').map(Number);
  const startTotal = startHour * 60 + startMinute;
  let endTotal = endHour * 60 + endMinute;
  if (endTotal <= startTotal) endTotal += 24 * 60;
  return endTotal - startTotal;
}

function localDate(value: Date) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

function localTime(value: Date) {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

function displayClock(value?: string) {
  return value ? value.slice(0, 5) : '';
}

function formatTimer(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('fi-FI', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatAccuracy(value: number) {
  return value < 1000 ? `±${Math.round(value)} m` : `±${(value / 1000).toFixed(1)} km`;
}

function statusBadge(status: TimeEntryStatus) {
  const config: Record<TimeEntryStatus, { className: string; icon: typeof Clock }> = {
    Hyväksytty: { className: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
    Odottaa: { className: 'bg-amber-50 text-amber-700', icon: AlertCircle },
    Hylätty: { className: 'bg-red-50 text-red-700', icon: XCircle },
  };
  const item = config[status];
  return <Badge className={`gap-1 border-0 ${item.className}`}><item.icon size={12} />{status}</Badge>;
}

export default function Tuntikirjaukset() {
  const { user, profile } = useAuth();
  const { currentOrg, currentRole } = useOrganization();
  const { timeEntries, projects, workOrders, refresh } = useAppDataContext();
  const [activeTab, setActiveTab] = useState('mine');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TimeEntry | null>(null);
  const [rejectTarget, setRejectTarget] = useState<TimeEntry | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [form, setForm] = useState<EntryForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [timerStart, setTimerStart] = useState<string | null>(() => localStorage.getItem(TIMER_START_KEY));
  const [timerProject, setTimerProject] = useState(() => localStorage.getItem(TIMER_PROJECT_KEY) ?? '');
  const [timerDescription, setTimerDescription] = useState(() => localStorage.getItem(TIMER_DESCRIPTION_KEY) ?? '');
  const [activeCheckInId, setActiveCheckInId] = useState<string | null>(() => localStorage.getItem(TIMER_CHECK_IN_KEY));
  const [checkIns, setCheckIns] = useState<WorkSiteCheckIn[]>([]);
  const [checkInsLoading, setCheckInsLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  const canApprove = currentRole === 'admin' || currentRole === 'supervisor';
  const currentEmployee = profile?.full_name || user?.email || 'Käyttäjä';
  const selectedTimerProject = projects.find((item) => item.id === timerProject || item.name === timerProject);

  const loadCheckIns = useCallback(async () => {
    if (!currentOrg) {
      setCheckIns([]);
      return;
    }
    setCheckInsLoading(true);
    try {
      setCheckIns(await listWorkSiteCheckIns(currentOrg.id));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Työmaalle kirjautumisten haku epäonnistui.';
      setOperationError(message);
      logger.error('Työmaalle kirjautumisten haku epäonnistui', { error: caught });
    } finally {
      setCheckInsLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => { void loadCheckIns(); }, [loadCheckIns]);
  useEffect(() => {
    if (!timerStart) return undefined;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [timerStart]);
  useEffect(() => {
    if (timerProject) localStorage.setItem(TIMER_PROJECT_KEY, timerProject);
    else localStorage.removeItem(TIMER_PROJECT_KEY);
  }, [timerProject]);
  useEffect(() => {
    if (timerDescription) localStorage.setItem(TIMER_DESCRIPTION_KEY, timerDescription);
    else localStorage.removeItem(TIMER_DESCRIPTION_KEY);
  }, [timerDescription]);

  const myEntries = useMemo(() => {
    const aliases = [profile?.full_name, user?.email]
      .filter(Boolean)
      .map((value) => value!.toLocaleLowerCase('fi'));
    return timeEntries.filter((entry) =>
      entry.userId === user?.id || (!entry.userId && aliases.includes(entry.employee.toLocaleLowerCase('fi'))),
    );
  }, [profile?.full_name, timeEntries, user?.email, user?.id]);
  const visibleEntries = canApprove && activeTab !== 'mine' ? timeEntries : myEntries;
  const pendingEntries = timeEntries.filter((entry) => entry.status === 'Odottaa' && !entry.lockedAt);
  const approvedHours = visibleEntries
    .filter((entry) => entry.status === 'Hyväksytty')
    .reduce((sum, entry) => sum + entry.hours + entry.overtime, 0);
  const pendingHours = visibleEntries
    .filter((entry) => entry.status === 'Odottaa')
    .reduce((sum, entry) => sum + entry.hours + entry.overtime, 0);
  const overtimeHours = visibleEntries.reduce((sum, entry) => sum + entry.overtime, 0);
  const elapsedMilliseconds = timerStart ? now - new Date(timerStart).getTime() : 0;
  const activeCheckIn = activeCheckInId ? checkIns.find((item) => item.id === activeCheckInId) : undefined;

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      date: localDate(new Date()),
      employee: currentEmployee,
    });
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const openEdit = (entry: TimeEntry) => {
    if (entry.lockedAt || (entry.status !== 'Odottaa' && !canApprove)) return;
    setEditing(entry);
    setForm({
      mode: entry.startTime && entry.endTime ? 'clock' : 'duration',
      date: toIsoDate(entry.date),
      employee: entry.employee,
      projectId: entry.projectId ?? '',
      project: entry.project,
      workOrderId: entry.workOrderId ?? '',
      startTime: displayClock(entry.startTime),
      endTime: displayClock(entry.endTime),
      breakStartTime: displayClock(entry.breakStartTime),
      breakEndTime: displayClock(entry.breakEndTime),
      hours: String(entry.hours),
      overtime: String(entry.overtime),
      breakMinutes: String(entry.breakMinutes ?? 0),
      description: entry.description,
      status: entry.status,
    });
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const selectProject = (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    setForm((previous) => ({
      ...previous,
      projectId,
      project: project?.name ?? previous.project,
      workOrderId: '',
    }));
  };

  const saveEntry = async () => {
    const nextErrors: string[] = [];
    let hours = Number(form.hours);
    let overtime = Number(form.overtime);
    let breakMinutes = Number(form.breakMinutes);

    if (!form.date) nextErrors.push('Päivämäärä on pakollinen.');
    if (!form.employee.trim()) nextErrors.push('Työntekijä on pakollinen.');
    if (!form.project.trim()) nextErrors.push('Projekti on pakollinen.');
    if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 1440) {
      nextErrors.push('Tauon pitää olla 0–1440 minuuttia.');
    }

    if (form.mode === 'clock') {
      if (!form.startTime || !form.endTime || form.startTime === form.endTime) {
        nextErrors.push('Anna työn alkamis- ja päättymisaika. Ajat eivät voi olla samat.');
      }
      const grossMinutes = clockMinutes(form.startTime, form.endTime);
      if (grossMinutes <= 0 || grossMinutes > 1440) {
        nextErrors.push('Työvuoron pitää olla yli 0 ja enintään 24 tuntia.');
      }
      const hasBreakStart = Boolean(form.breakStartTime);
      const hasBreakEnd = Boolean(form.breakEndTime);
      if (hasBreakStart !== hasBreakEnd) {
        nextErrors.push('Anna tauolle sekä alkamis- että päättymisaika.');
      }
      if (hasBreakStart && hasBreakEnd) {
        breakMinutes = clockMinutes(form.breakStartTime, form.breakEndTime);
      }
      if (breakMinutes >= grossMinutes && grossMinutes > 0) {
        nextErrors.push('Tauon pitää olla työvuoroa lyhyempi.');
      }
      hours = Math.max(0.01, Math.round(((grossMinutes - breakMinutes) / 60) * 100) / 100);
      overtime = 0;
    } else {
      if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
        nextErrors.push('Tuntimäärän pitää olla yli 0 ja enintään 24.');
      }
      if (!Number.isFinite(overtime) || overtime < 0 || overtime > hours) {
        nextErrors.push('Ylityö ei voi olla negatiivinen tai ylittää tuntimäärää.');
      }
    }

    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg) return;

    const payload: Omit<TimeEntry, 'id'> = {
      date: form.date,
      userId: editing?.userId ?? user?.id,
      employeeId: editing?.employeeId,
      employee: form.employee.trim(),
      projectId: form.projectId || undefined,
      project: form.project.trim(),
      workOrderId: form.workOrderId || undefined,
      hours,
      overtime,
      breakMinutes,
      breakSource: breakMinutes > 0 ? 'manual' : 'none',
      startTime: form.mode === 'clock' ? form.startTime : undefined,
      endTime: form.mode === 'clock' ? form.endTime : undefined,
      breakStartTime: form.mode === 'clock' && form.breakStartTime ? form.breakStartTime : undefined,
      breakEndTime: form.mode === 'clock' && form.breakEndTime ? form.breakEndTime : undefined,
      source: editing?.source ?? 'manual',
      description: form.description.trim(),
      status: canApprove ? form.status : 'Odottaa',
    };

    setSaving(true);
    setOperationError(null);
    try {
      if (editing) {
        await updateTimeEntryRecord(currentOrg.id, editing.id, {
          ...payload,
          startTime: form.mode === 'clock' ? form.startTime : '',
          endTime: form.mode === 'clock' ? form.endTime : '',
          breakStartTime: form.mode === 'clock' ? form.breakStartTime : '',
          breakEndTime: form.mode === 'clock' ? form.breakEndTime : '',
        });
      } else {
        await createTimeEntryRecord(currentOrg.id, user?.id, payload);
      }
      await refresh();
      setDialogOpen(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Tallennus epäonnistui.';
      setOperationError(message);
      logger.error('Tuntikirjauksen tallennus epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (entry: TimeEntry, status: TimeEntryStatus, reason?: string) => {
    if (!currentOrg || !canApprove || !user || entry.lockedAt) return;
    setOperationError(null);
    try {
      await updateTimeEntryRecord(currentOrg.id, entry.id, {
        status,
        approvedBy: status === 'Hyväksytty' ? user.id : undefined,
        approvedAt: status === 'Hyväksytty' ? new Date().toISOString() : undefined,
        rejectionReason: status === 'Hylätty' ? reason : undefined,
      });
      await refresh();
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tilan päivitys epäonnistui.');
    }
  };

  const rejectEntry = async () => {
    if (!rejectTarget || rejectionReason.trim().length < 3) {
      setOperationError('Hylkäyksen perustelun pitää olla vähintään 3 merkkiä.');
      return;
    }
    await setStatus(rejectTarget, 'Hylätty', rejectionReason.trim());
    setRejectTarget(null);
    setRejectionReason('');
  };

  const removeEntry = async () => {
    if (!currentOrg || !deleteTarget || !canApprove || deleteTarget.lockedAt) return;
    setSaving(true);
    try {
      await deleteTimeEntryRecord(currentOrg.id, deleteTarget.id);
      await refresh();
      setDeleteTarget(null);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const startTimer = async () => {
    if (!timerProject) {
      setOperationError('Valitse projekti ennen työmaalle kirjautumista.');
      return;
    }
    if (!currentOrg || !user) {
      setOperationError('Työmaalle kirjautuminen vaatii aktiivisen käyttäjän ja organisaation.');
      return;
    }
    setLocating(true);
    setOperationError(null);
    try {
      const location = await captureCurrentWorkSiteLocation();
      const projectName = selectedTimerProject?.name ?? timerProject;
      const checkIn = await createWorkSiteCheckIn({
        organizationId: currentOrg.id,
        userId: user.id,
        projectId: selectedTimerProject?.id,
        projectName,
        employeeName: currentEmployee,
        description: timerDescription,
        location,
      });
      localStorage.setItem(TIMER_START_KEY, checkIn.checkedInAt);
      localStorage.setItem(TIMER_CHECK_IN_KEY, checkIn.id);
      setTimerStart(checkIn.checkedInAt);
      setActiveCheckInId(checkIn.id);
      setNow(Date.now());
      await loadCheckIns();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Työmaalle kirjautuminen epäonnistui.';
      setOperationError(message);
      logger.error('Työmaalle kirjautuminen epäonnistui', { error: caught });
    } finally {
      setLocating(false);
    }
  };

  const clearTimer = () => {
    localStorage.removeItem(TIMER_START_KEY);
    localStorage.removeItem(TIMER_PROJECT_KEY);
    localStorage.removeItem(TIMER_DESCRIPTION_KEY);
    localStorage.removeItem(TIMER_CHECK_IN_KEY);
    setTimerStart(null);
    setTimerProject('');
    setTimerDescription('');
    setActiveCheckInId(null);
  };

  const stopTimer = async () => {
    if (!timerStart || !currentOrg) return;
    setSaving(true);
    setOperationError(null);
    try {
      if (activeCheckInId) {
        await completeWorkSiteCheckIn(activeCheckInId);
      } else {
        const started = new Date(timerStart);
        const ended = new Date();
        const minutes = Math.max(1, Math.round((ended.getTime() - started.getTime()) / 60_000));
        await createTimeEntryRecord(currentOrg.id, user?.id, {
          date: localDate(started),
          userId: user?.id,
          employee: currentEmployee,
          projectId: selectedTimerProject?.id,
          project: selectedTimerProject?.name ?? timerProject,
          hours: Math.max(0.01, Math.round((minutes / 60) * 100) / 100),
          overtime: 0,
          breakMinutes: 0,
          breakSource: 'none',
          startTime: localTime(started),
          endTime: localTime(ended),
          source: 'timer',
          description: timerDescription.trim(),
          status: 'Odottaa',
        });
      }
      clearTimer();
      await refresh();
      await loadCheckIns();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Ajastetun työn tallennus epäonnistui.';
      setOperationError(message);
      logger.error('Työmaalta uloskirjautuminen epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  const selectedProjectOrders = workOrders.filter((order) =>
    !form.projectId || order.projectId === form.projectId || order.project === form.project,
  );
  const listEntries = activeTab === 'approvals' ? pendingEntries : visibleEntries;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-hero text-text-primary">Tuntikirjaukset</h1>
          <p className="mt-1 text-body-sm text-text-secondary">Kellonajat, tauot, työmaalle kirjautuminen ja hyväksyntähistoria</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus size={16} /> Kirjaa työaika</Button>
      </div>

      {operationError && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={16} />{operationError}</div>}

      <Card className="border-primary/30 bg-primary-light/40">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
            <div>
              <h2 className="flex items-center gap-2 font-semibold"><LocateFixed size={18} className="text-primary" />Työmaalle kirjautuminen</h2>
              <p className="mt-1 max-w-3xl text-xs text-text-secondary">Sijainti pyydetään vain kirjautumishetkellä. Uloskirjautuminen muodostaa kellonaikapohjaisen tuntikirjauksen.</p>
            </div>
            {timerStart && <Badge className="w-fit gap-1 border-0 bg-emerald-50 text-emerald-700"><CheckCircle2 size={12} />Kirjautuneena</Badge>}
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <div className="space-y-2"><Label>Työmaa / projekti</Label>{projects.length > 0 ? <Select value={selectedTimerProject?.id ?? timerProject} onValueChange={setTimerProject} disabled={Boolean(timerStart)}><SelectTrigger><SelectValue placeholder="Valitse projekti" /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select> : <Input value={timerProject} onChange={(event) => setTimerProject(event.target.value)} disabled={Boolean(timerStart)} />}</div>
            <div className="space-y-2"><Label htmlFor="timer-description">Työn kuvaus</Label><Input id="timer-description" value={timerDescription} onChange={(event) => setTimerDescription(event.target.value)} disabled={Boolean(timerStart)} /></div>
            <div className="flex flex-wrap items-center gap-3"><div className="min-w-28 font-mono text-2xl font-bold">{formatTimer(elapsedMilliseconds)}</div>{timerStart ? <Button variant="destructive" onClick={() => void stopTimer()} disabled={saving}>{saving ? <Loader2 size={15} className="mr-1 animate-spin" /> : <Square size={15} className="mr-1" />}Lopeta ja tallenna</Button> : <Button onClick={() => void startTimer()} disabled={locating || saving}>{locating ? <Loader2 size={15} className="mr-1 animate-spin" /> : <MapPin size={15} className="mr-1" />}{locating ? 'Haetaan sijaintia…' : 'Kirjaudu työmaalle'}</Button>}</div>
          </div>
          {timerStart && <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-emerald-200 bg-white/70 px-4 py-3 text-sm"><span><strong>Aloitettu:</strong> {formatDateTime(timerStart)}</span>{activeCheckIn ? <><span><strong>Tarkkuus:</strong> {formatAccuracy(activeCheckIn.accuracyM)}</span><a href={workSiteMapUrl(activeCheckIn)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">Avaa kartalla <ExternalLink size={13} /></a></> : <span className="text-text-secondary">Sijaintinäyte on tallennettu.</span>}</div>}
        </CardContent>
      </Card>

      <Card><CardContent className="p-0"><div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="flex items-center gap-2 font-semibold"><MapPin size={17} className="text-primary" />Työmaalle kirjautumiset</h2><p className="mt-1 text-xs text-text-secondary">{canApprove ? 'Organisaation viimeisimmät kirjautumiset.' : 'Omat kirjautumiset.'}</p></div>{checkInsLoading && <Loader2 size={18} className="animate-spin" />}</div>{checkIns.slice(0, 20).map((checkIn) => <div key={checkIn.id} className="grid gap-2 border-b px-5 py-4 text-sm lg:grid-cols-[140px_1fr_1fr_1fr_100px] lg:items-center"><span>{formatDateTime(checkIn.checkedInAt)}</span><span className="font-medium">{checkIn.employeeName}</span><div><p className="font-medium">{checkIn.projectName}</p><p className="text-xs text-text-secondary">{checkIn.description || 'Ei kuvausta'}</p></div><a href={workSiteMapUrl(checkIn)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">{checkIn.latitude.toFixed(5)}, {checkIn.longitude.toFixed(5)} <ExternalLink size={12} /></a><Badge className={checkIn.checkedOutAt ? 'w-fit border-0 bg-slate-100 text-slate-700' : 'w-fit border-0 bg-emerald-50 text-emerald-700'}>{checkIn.checkedOutAt ? 'Päättynyt' : 'Aktiivinen'}</Badge></div>)}{!checkInsLoading && checkIns.length === 0 && <div className="p-10 text-center"><MapPin size={38} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei kirjautumisia</p></div>}</CardContent></Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        { label: 'Hyväksytyt tunnit', value: `${approvedHours.toFixed(1)} h`, icon: CheckCircle2 },
        { label: 'Odottaa', value: `${pendingHours.toFixed(1)} h`, icon: AlertCircle },
        { label: 'Käsin merkitty ylityö', value: `${overtimeHours.toFixed(1)} h`, icon: Clock },
        { label: 'Lukittuja', value: visibleEntries.filter((entry) => entry.lockedAt).length, icon: Lock },
      ].map((item) => <Card key={item.label}><CardContent className="p-5"><div className="mb-2 flex justify-between text-sm text-text-secondary"><span>{item.label}</span><item.icon size={18} className="text-primary" /></div><p className="font-mono text-2xl font-bold">{item.value}</p></CardContent></Card>)}</div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto flex-wrap"><TabsTrigger value="mine">Omat kirjaukset</TabsTrigger>{canApprove && <TabsTrigger value="team">Kaikki kirjaukset</TabsTrigger>}{canApprove && <TabsTrigger value="approvals">Hyväksynnät ({pendingEntries.length})</TabsTrigger>}</TabsList>
        <TabsContent value={activeTab} className="mt-4">
          <Card className="overflow-hidden"><CardContent className="p-0">
            <div className="hidden grid-cols-[100px_1fr_1.2fr_120px_80px_110px_150px] gap-3 border-b bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted lg:grid"><span>Päivä</span><span>Työntekijä</span><span>Projekti / työ</span><span>Työaika</span><span>Tauko</span><span>Tila</span><span className="text-right">Toiminnot</span></div>
            {listEntries.map((entry) => <div key={entry.id} className="grid grid-cols-1 items-center gap-3 border-b border-slate-100 px-6 py-4 lg:grid-cols-[100px_1fr_1.2fr_120px_80px_110px_150px]">
              <span className="text-sm text-text-secondary">{entry.date}</span>
              <span className="font-medium">{entry.employee}</span>
              <div><p className="text-sm font-medium">{entry.project}</p><p className="text-xs text-text-secondary">{entry.description || 'Ei kuvausta'}{entry.rejectionReason ? ` · Hylkäys: ${entry.rejectionReason}` : ''}</p></div>
              <div><p className="font-mono text-sm">{entry.hours.toFixed(2)} h</p>{entry.startTime && entry.endTime && <p className="text-xs text-text-secondary">{displayClock(entry.startTime)}–{displayClock(entry.endTime)}</p>}</div>
              <div><p className="font-mono text-sm">{entry.breakMinutes ?? 0} min</p>{entry.breakSource === 'automatic' && <p className="text-[10px] text-blue-700">Automaattinen</p>}</div>
              <div className="flex items-center gap-1">{statusBadge(entry.status)}{entry.lockedAt && <Lock size={13} className="text-slate-500" />}</div>
              <div className="flex justify-end gap-1">{canApprove && entry.status === 'Odottaa' && !entry.lockedAt && <><Button variant="ghost" size="sm" className="text-emerald-700" aria-label="Hyväksy" onClick={() => void setStatus(entry, 'Hyväksytty')}><CheckCircle2 size={15} /></Button><Button variant="ghost" size="sm" className="text-red-700" aria-label="Hylkää" onClick={() => { setRejectTarget(entry); setRejectionReason(''); }}><XCircle size={15} /></Button></>}<Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={Boolean(entry.lockedAt)} onClick={() => openEdit(entry)}><Edit3 size={15} /></Button>{canApprove && <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-danger" disabled={Boolean(entry.lockedAt)} onClick={() => setDeleteTarget(entry)}><Trash2 size={15} /></Button>}</div>
            </div>)}
            {listEntries.length === 0 && <div className="p-12 text-center"><Clock size={44} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei tuntikirjauksia</p></div>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? 'Muokkaa tuntikirjausta' : 'Uusi tuntikirjaus'}</DialogTitle></DialogHeader>
          {formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Kirjaustapa</Label><Select value={form.mode} onValueChange={(mode: EntryMode) => setForm((previous) => ({ ...previous, mode }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="clock">Alkamis- ja päättymisaika</SelectItem><SelectItem value="duration">Tuntimäärä</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="time-date">Päivä *</Label><Input id="time-date" type="date" value={form.date} onChange={(event) => setForm((previous) => ({ ...previous, date: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="time-employee">Työntekijä *</Label><Input id="time-employee" value={form.employee} onChange={(event) => setForm((previous) => ({ ...previous, employee: event.target.value }))} disabled={!canApprove} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Projekti *</Label>{projects.length > 0 ? <Select value={form.projectId} onValueChange={selectProject}><SelectTrigger><SelectValue placeholder="Valitse projekti" /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select> : <Input value={form.project} onChange={(event) => setForm((previous) => ({ ...previous, project: event.target.value }))} />}</div>
            <div className="space-y-2 sm:col-span-2"><Label>Työmääräys</Label><Select value={form.workOrderId || 'none'} onValueChange={(value) => setForm((previous) => ({ ...previous, workOrderId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei työmääräystä</SelectItem>{selectedProjectOrders.map((order) => <SelectItem key={order.id} value={order.id}>{order.title}</SelectItem>)}</SelectContent></Select></div>

            {form.mode === 'clock' ? <>
              <div className="space-y-2"><Label htmlFor="time-start">Alkamisaika *</Label><Input id="time-start" type="time" value={form.startTime} onChange={(event) => setForm((previous) => ({ ...previous, startTime: event.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="time-end">Päättymisaika *</Label><Input id="time-end" type="time" value={form.endTime} onChange={(event) => setForm((previous) => ({ ...previous, endTime: event.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="break-start">Tauko alkaa</Label><Input id="break-start" type="time" value={form.breakStartTime} onChange={(event) => setForm((previous) => ({ ...previous, breakStartTime: event.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="break-end">Tauko päättyy</Label><Input id="break-end" type="time" value={form.breakEndTime} onChange={(event) => setForm((previous) => ({ ...previous, breakEndTime: event.target.value }))} /></div>
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="time-break">Tauko minuutteina, jos kellonaikaa ei tiedetä</Label><Input id="time-break" type="number" min="0" step="1" value={form.breakMinutes} onChange={(event) => setForm((previous) => ({ ...previous, breakMinutes: event.target.value }))} /><p className="text-xs leading-5 text-text-secondary">Kun arvo on 0 eikä tauon kellonaikoja anneta, palvelin käyttää organisaation automaattista taukosääntöä. Ilta- tai yötyölisää sisältävälle vuorolle tauon kellonajat tarvitaan tarkkaa lisälaskentaa varten.</p></div>
            </> : <>
              <div className="space-y-2"><Label htmlFor="time-hours">Tunnit *</Label><Input id="time-hours" type="number" min="0.01" max="24" step="0.25" value={form.hours} onChange={(event) => setForm((previous) => ({ ...previous, hours: event.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="time-overtime">Käsin merkitty ylityö</Label><Input id="time-overtime" type="number" min="0" step="0.25" value={form.overtime} onChange={(event) => setForm((previous) => ({ ...previous, overtime: event.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="duration-break">Tauko min</Label><Input id="duration-break" type="number" min="0" step="1" value={form.breakMinutes} onChange={(event) => setForm((previous) => ({ ...previous, breakMinutes: event.target.value }))} /></div>
            </>}

            {canApprove && <div className="space-y-2"><Label>Tila</Label><Select value={form.status} onValueChange={(status: TimeEntryStatus) => setForm((previous) => ({ ...previous, status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(['Odottaa','Hyväksytty','Hylätty'] as TimeEntryStatus[]).map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>}
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="time-description">Työn kuvaus</Label><Textarea id="time-description" value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} rows={3} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Peruuta</Button><Button onClick={() => void saveEntry()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => { if (!open) setRejectTarget(null); }}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Hylkää tuntikirjaus</DialogTitle></DialogHeader><div className="space-y-2"><Label htmlFor="rejection-reason">Perustelu *</Label><Textarea id="rejection-reason" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={4} /></div><DialogFooter><Button variant="outline" onClick={() => setRejectTarget(null)}>Peruuta</Button><Button variant="destructive" onClick={() => void rejectEntry()}>Hylkää</Button></DialogFooter></DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Poistetaanko tuntikirjaus?</AlertDialogTitle><AlertDialogDescription>Kirjaus poistetaan pysyvästi. Lukittua palkkakauden kirjausta ei voi poistaa.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction onClick={() => void removeEntry()} disabled={saving}>Poista</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
