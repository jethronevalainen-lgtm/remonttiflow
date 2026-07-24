import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Edit3,
  Play,
  Plus,
  Square,
  Trash2,
  XCircle,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import logger from '@/lib/logger';
import {
  createTimeEntryRecord,
  deleteTimeEntryRecord,
  updateTimeEntryRecord,
} from '@/lib/supabase/workforceEntities';
import type { TimeEntry, TimeEntryStatus } from '@/types';

const TIMER_START_KEY = 'vakantti-time-timer-start';
const TIMER_PROJECT_KEY = 'vakantti-time-timer-project';
const TIMER_DESCRIPTION_KEY = 'vakantti-time-timer-description';

interface EntryForm {
  date: string;
  employee: string;
  project: string;
  hours: string;
  overtime: string;
  description: string;
  status: TimeEntryStatus;
}

const emptyForm: EntryForm = {
  date: new Date().toISOString().slice(0, 10),
  employee: '',
  project: '',
  hours: '',
  overtime: '0',
  description: '',
  status: 'Odottaa',
};

function toDisplayDate(value: string) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return iso ? `${Number(iso[3])}.${Number(iso[2])}.${iso[1]}` : value;
}

function formatTimer(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
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
  const { timeEntries, projects, refresh } = useAppDataContext();
  const [activeTab, setActiveTab] = useState('mine');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TimeEntry | null>(null);
  const [form, setForm] = useState<EntryForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [timerStart, setTimerStart] = useState<string | null>(() => localStorage.getItem(TIMER_START_KEY));
  const [timerProject, setTimerProject] = useState(() => localStorage.getItem(TIMER_PROJECT_KEY) ?? '');
  const [timerDescription, setTimerDescription] = useState(() => localStorage.getItem(TIMER_DESCRIPTION_KEY) ?? '');
  const [now, setNow] = useState(Date.now());

  const canApprove = currentRole === 'admin' || currentRole === 'supervisor';
  const currentEmployee = profile?.full_name || user?.email || 'Käyttäjä';

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
    const aliases = [profile?.full_name, user?.email].filter(Boolean).map((value) => value!.toLowerCase());
    return timeEntries.filter((entry) => aliases.includes(entry.employee.toLowerCase()));
  }, [profile?.full_name, timeEntries, user?.email]);
  const visibleEntries = canApprove && activeTab !== 'mine' ? timeEntries : myEntries;
  const pendingEntries = timeEntries.filter((entry) => entry.status === 'Odottaa');
  const approvedHours = visibleEntries.filter((entry) => entry.status === 'Hyväksytty').reduce((sum, entry) => sum + entry.hours, 0);
  const pendingHours = visibleEntries.filter((entry) => entry.status === 'Odottaa').reduce((sum, entry) => sum + entry.hours, 0);
  const overtimeHours = visibleEntries.reduce((sum, entry) => sum + entry.overtime, 0);
  const elapsedMilliseconds = timerStart ? now - new Date(timerStart).getTime() : 0;

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10), employee: currentEmployee });
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const openEdit = (entry: TimeEntry) => {
    if (entry.status !== 'Odottaa' && !canApprove) return;
    setEditing(entry);
    setForm({
      date: entry.date,
      employee: entry.employee,
      project: entry.project,
      hours: String(entry.hours),
      overtime: String(entry.overtime),
      description: entry.description,
      status: entry.status,
    });
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const saveEntry = async () => {
    const hours = Number(form.hours);
    const overtime = Number(form.overtime);
    const nextErrors: string[] = [];
    if (!form.date) nextErrors.push('Päivämäärä on pakollinen.');
    if (!form.employee.trim()) nextErrors.push('Työntekijä on pakollinen.');
    if (!form.project.trim()) nextErrors.push('Projekti on pakollinen.');
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) nextErrors.push('Tuntimäärän pitää olla yli 0 ja enintään 24.');
    if (!Number.isFinite(overtime) || overtime < 0 || overtime > hours) nextErrors.push('Ylityö ei voi olla negatiivinen tai ylittää tuntimäärää.');
    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg) return;

    const payload: Omit<TimeEntry, 'id'> = {
      date: toDisplayDate(form.date),
      employee: form.employee.trim(),
      project: form.project.trim(),
      hours,
      overtime,
      description: form.description.trim(),
      status: canApprove ? form.status : 'Odottaa',
    };

    setSaving(true);
    setOperationError(null);
    try {
      if (editing) await updateTimeEntryRecord(currentOrg.id, editing.id, payload);
      else await createTimeEntryRecord(currentOrg.id, user?.id, payload);
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

  const setStatus = async (entry: TimeEntry, status: TimeEntryStatus) => {
    if (!currentOrg || !canApprove) return;
    setOperationError(null);
    try {
      await updateTimeEntryRecord(currentOrg.id, entry.id, { status });
      await refresh();
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tilan päivitys epäonnistui.');
    }
  };

  const removeEntry = async () => {
    if (!currentOrg || !deleteTarget || !canApprove) return;
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

  const startTimer = () => {
    if (!timerProject) {
      setOperationError('Valitse projekti ennen ajastimen käynnistämistä.');
      return;
    }
    const startedAt = new Date().toISOString();
    localStorage.setItem(TIMER_START_KEY, startedAt);
    setTimerStart(startedAt);
    setNow(Date.now());
    setOperationError(null);
  };

  const stopTimer = async () => {
    if (!timerStart || !currentOrg) return;
    const milliseconds = Date.now() - new Date(timerStart).getTime();
    const hours = Math.max(0.01, Math.round((milliseconds / 3_600_000) * 100) / 100);
    setSaving(true);
    try {
      await createTimeEntryRecord(currentOrg.id, user?.id, {
        date: new Date().toLocaleDateString('fi-FI'),
        employee: currentEmployee,
        project: timerProject,
        hours,
        overtime: 0,
        description: timerDescription.trim(),
        status: 'Odottaa',
      });
      localStorage.removeItem(TIMER_START_KEY);
      localStorage.removeItem(TIMER_PROJECT_KEY);
      localStorage.removeItem(TIMER_DESCRIPTION_KEY);
      setTimerStart(null);
      setTimerProject('');
      setTimerDescription('');
      await refresh();
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Ajastetun työn tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-hero text-text-primary">Tuntikirjaukset</h1><p className="mt-1 text-body-sm text-text-secondary">Työajan kirjaus, ajastin ja työnjohdon hyväksyntä</p></div>
        <Button onClick={openCreate} className="gap-2"><Plus size={16} /> Kirjaa tunnit</Button>
      </div>

      {operationError && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={16} />{operationError}</div>}

      <Card className="border-primary/30 bg-primary-light/40"><CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_1fr_auto] lg:items-end"><div className="space-y-2"><Label>Ajastettava projekti</Label>{projects.length > 0 ? <Select value={timerProject} onValueChange={setTimerProject} disabled={Boolean(timerStart)}><SelectTrigger><SelectValue placeholder="Valitse projekti" /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.name}>{project.name}</SelectItem>)}</SelectContent></Select> : <Input value={timerProject} onChange={(event) => setTimerProject(event.target.value)} disabled={Boolean(timerStart)} />}</div><div className="space-y-2"><Label htmlFor="timer-description">Työn kuvaus</Label><Input id="timer-description" value={timerDescription} onChange={(event) => setTimerDescription(event.target.value)} disabled={Boolean(timerStart)} /></div><div className="flex items-center gap-3"><div className="min-w-28 font-mono text-2xl font-bold">{formatTimer(elapsedMilliseconds)}</div>{timerStart ? <Button variant="destructive" onClick={() => void stopTimer()} disabled={saving}><Square size={15} className="mr-1" /> Lopeta ja tallenna</Button> : <Button onClick={startTimer}><Play size={15} className="mr-1" /> Käynnistä</Button>}</div></CardContent></Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        { label: 'Hyväksytyt tunnit', value: `${approvedHours.toFixed(1)} h`, icon: CheckCircle2 },
        { label: 'Odottaa', value: `${pendingHours.toFixed(1)} h`, icon: AlertCircle },
        { label: 'Ylityö', value: `${overtimeHours.toFixed(1)} h`, icon: Clock },
        { label: 'Kirjauksia', value: visibleEntries.length, icon: Clock },
      ].map((item) => <Card key={item.label}><CardContent className="p-5"><div className="mb-2 flex justify-between text-sm text-text-secondary"><span>{item.label}</span><item.icon size={18} className="text-primary" /></div><p className="font-mono text-2xl font-bold">{item.value}</p></CardContent></Card>)}</div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList><TabsTrigger value="mine">Omat kirjaukset</TabsTrigger>{canApprove && <TabsTrigger value="team">Kaikki kirjaukset</TabsTrigger>}{canApprove && <TabsTrigger value="approvals">Hyväksynnät ({pendingEntries.length})</TabsTrigger>}</TabsList>
        <TabsContent value={activeTab} className="mt-4">
          <Card className="overflow-hidden"><CardContent className="p-0">
            <div className="hidden grid-cols-[110px_1fr_1fr_90px_90px_110px_150px] gap-3 border-b bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted lg:grid"><span>Päivä</span><span>Työntekijä</span><span>Projekti / työ</span><span>Tunnit</span><span>Ylityö</span><span>Tila</span><span className="text-right">Toiminnot</span></div>
            {(activeTab === 'approvals' ? pendingEntries : visibleEntries).map((entry) => <div key={entry.id} className="grid grid-cols-1 items-center gap-3 border-b border-slate-100 px-6 py-4 lg:grid-cols-[110px_1fr_1fr_90px_90px_110px_150px]"><span className="text-sm text-text-secondary">{entry.date}</span><span className="font-medium">{entry.employee}</span><div><p className="text-sm font-medium">{entry.project}</p><p className="text-xs text-text-secondary">{entry.description || 'Ei kuvausta'}</p></div><span className="font-mono text-sm">{entry.hours.toFixed(2)} h</span><span className="font-mono text-sm">{entry.overtime.toFixed(2)} h</span><div>{statusBadge(entry.status)}</div><div className="flex justify-end gap-1">{canApprove && entry.status === 'Odottaa' && <><Button variant="ghost" size="sm" className="text-emerald-700" onClick={() => void setStatus(entry, 'Hyväksytty')}><CheckCircle2 size={15} /></Button><Button variant="ghost" size="sm" className="text-red-700" onClick={() => void setStatus(entry, 'Hylätty')}><XCircle size={15} /></Button></>}<Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(entry)}><Edit3 size={15} /></Button>{canApprove && <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-danger" onClick={() => setDeleteTarget(entry)}><Trash2 size={15} /></Button>}</div></div>)}
            {(activeTab === 'approvals' ? pendingEntries : visibleEntries).length === 0 && <div className="p-12 text-center"><Clock size={44} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei tuntikirjauksia</p></div>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{editing ? 'Muokkaa tuntikirjausta' : 'Uusi tuntikirjaus'}</DialogTitle></DialogHeader>{formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}<div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="time-date">Päivä *</Label><Input id="time-date" type="date" value={/^\d{4}-/.test(form.date) ? form.date : ''} onChange={(event) => setForm((previous) => ({ ...previous, date: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="time-employee">Työntekijä *</Label><Input id="time-employee" value={form.employee} onChange={(event) => setForm((previous) => ({ ...previous, employee: event.target.value }))} disabled={!canApprove} /></div><div className="space-y-2 sm:col-span-2"><Label>Projekti *</Label>{projects.length > 0 ? <Select value={form.project} onValueChange={(project) => setForm((previous) => ({ ...previous, project }))}><SelectTrigger><SelectValue placeholder="Valitse projekti" /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.name}>{project.name}</SelectItem>)}</SelectContent></Select> : <Input value={form.project} onChange={(event) => setForm((previous) => ({ ...previous, project: event.target.value }))} />}</div><div className="space-y-2"><Label htmlFor="time-hours">Tunnit *</Label><Input id="time-hours" type="number" min="0" max="24" step="0.25" value={form.hours} onChange={(event) => setForm((previous) => ({ ...previous, hours: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="time-overtime">Ylityö</Label><Input id="time-overtime" type="number" min="0" step="0.25" value={form.overtime} onChange={(event) => setForm((previous) => ({ ...previous, overtime: event.target.value }))} /></div>{canApprove && <div className="space-y-2 sm:col-span-2"><Label>Tila</Label><Select value={form.status} onValueChange={(status: TimeEntryStatus) => setForm((previous) => ({ ...previous, status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Odottaa">Odottaa</SelectItem><SelectItem value="Hyväksytty">Hyväksytty</SelectItem><SelectItem value="Hylätty">Hylätty</SelectItem></SelectContent></Select></div>}<div className="space-y-2 sm:col-span-2"><Label htmlFor="time-description">Työn kuvaus</Label><Textarea id="time-description" value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void saveEntry()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}><DialogContent><DialogHeader><DialogTitle>Poista tuntikirjaus</DialogTitle></DialogHeader><p className="text-sm text-text-secondary">Poistetaanko {deleteTarget?.employee} kirjaus päivältä {deleteTarget?.date}?</p><DialogFooter><Button variant="outline" onClick={() => setDeleteTarget(null)}>Peruuta</Button><Button variant="destructive" onClick={() => void removeEntry()} disabled={saving}>Poista</Button></DialogFooter></DialogContent></Dialog>
    </motion.div>
  );
}
