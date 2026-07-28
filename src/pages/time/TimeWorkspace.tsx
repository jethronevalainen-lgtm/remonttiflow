import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FilePenLine,
  ListChecks,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import {
  captureBrowserLocation,
  createManualTimeEntry,
  loadTimeWorkspace,
  requestTimeEntryCorrection,
  resolveTimeEntryCorrection,
  reviewTimeDay,
  startTimeWorkspaceSession,
  stopTimeWorkspaceSession,
  subscribeTimeWorkspace,
  type TimeCorrectionRequest,
  type TimeWorkspaceDashboard,
} from '@/lib/supabase/timeWorkspace';
import { groupTimeEntriesByDay, summarizeEntriesByProject, formatWorkDuration, type TimeDaySummary } from '@/lib/timeWorkspaceModel';
import {
  ActiveSessionRow,
  CorrectionList,
  DayCard,
  EmptyState,
  ErrorMessage,
  KpiCard,
  ManualTimeDialog,
  StatusBadge,
  dateLabel,
  dateTimeLabel,
  emptyManualForm,
  formatHours,
  localDate,
  type ManualForm,
} from './TimeWorkspaceComponents';

const EMPTY_DASHBOARD: TimeWorkspaceDashboard = {
  role: 'worker',
  capabilities: {
    readAll: false,
    readProjects: false,
    approve: false,
    requestCorrection: false,
    resolveCorrections: false,
    createForOthers: false,
    manageRules: false,
    lockPeriods: false,
    exportPayroll: false,
  },
  entries: [],
  activeSessions: [],
  workOrders: [],
  people: [],
  projects: [],
  correctionRequests: [],
  payrollPeriods: [],
  timeRules: {},
  anomalies: [],
};

interface CorrectionTarget {
  kind: 'entry' | 'day';
  entryId?: string;
  userId?: string;
  date?: string;
  label: string;
}

export default function TimeWorkspace() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { isPreviewing } = useViewAs();
  const [from, setFrom] = useState(localDate(-30));
  const [to, setTo] = useState(localDate());
  const [data, setData] = useState<TimeWorkspaceDashboard>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [search, setSearch] = useState('');
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState<ManualForm>(() => emptyManualForm(user?.id ?? ''));
  const [startOrderId, setStartOrderId] = useState('');
  const [startNote, setStartNote] = useState('');
  const [correctionTarget, setCorrectionTarget] = useState<CorrectionTarget | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');

  const refresh = useCallback(async (quiet = false) => {
    if (!currentOrg) return;
    if (!quiet) setLoading(true);
    try {
      setData(await loadTimeWorkspace(currentOrg.id, from, to));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Työaikatietojen lataus epäonnistui.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [currentOrg, from, to]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!currentOrg) return undefined;
    return subscribeTimeWorkspace(currentOrg.id, () => { void refresh(true); });
  }, [currentOrg, refresh]);
  useEffect(() => {
    if (data.activeSessions.length === 0) return undefined;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [data.activeSessions.length]);

  const days = useMemo(() => groupTimeEntriesByDay(data.entries), [data.entries]);
  const projects = useMemo(() => summarizeEntriesByProject(data.entries), [data.entries]);
  const management = data.role === 'admin' || data.role === 'supervisor';
  const coordinator = data.role === 'project_coordinator';
  const worker = data.role === 'worker';
  const ownSession = data.activeSessions.find((session) => session.userId === user?.id);
  const ownOrders = data.workOrders.filter((order) => order.assignedToCurrentUser);
  const todayEntries = data.entries.filter((entry) => entry.date === localDate() && entry.userId === user?.id);
  const pendingDays = days.filter((day) => day.status === 'Odottaa' && !day.locked);
  const correctionDays = days.filter((day) => day.status === 'Hylätty' || day.hasCorrectionReason);
  const openCorrections = data.correctionRequests.filter((request) => request.status === 'Avoin');
  const totalHours = data.entries.reduce((sum, entry) => sum + entry.hours, 0);
  const pendingHours = data.entries.filter((entry) => entry.status === 'Odottaa').reduce((sum, entry) => sum + entry.hours, 0);
  const overtimeHours = data.entries.reduce((sum, entry) => sum + entry.overtime, 0);
  const todayHours = todayEntries.reduce((sum, entry) => sum + entry.hours, 0);
  const visibleDays = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fi-FI');
    return !query
      ? days
      : days.filter((day) => [day.employeeName, day.date, ...day.projectNames]
        .some((value) => value.toLocaleLowerCase('fi-FI').includes(query)));
  }, [days, search]);

  const execute = async (operation: () => Promise<void>, message: string) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await operation();
      setSuccess(message);
      await refresh(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Toiminto epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const startWork = async () => {
    if (!currentOrg || !startOrderId || isPreviewing) return;
    setSaving(true);
    setError(null);
    try {
      const location = await captureBrowserLocation();
      await startTimeWorkspaceSession({
        organizationId: currentOrg.id,
        workOrderId: startOrderId,
        note: startNote,
        location,
      });
      setStartOrderId('');
      setStartNote('');
      setSuccess(location
        ? 'Työ aloitettiin ja sijaintinäyte tallennettiin.'
        : 'Työ aloitettiin. Sijaintia ei saatu, mutta työaika käynnistyi.');
      await refresh(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Työn aloittaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const stopWork = () => {
    if (!currentOrg || isPreviewing) return;
    void execute(
      async () => { await stopTimeWorkspaceSession(currentOrg.id, startNote); },
      'Työpäivä päätettiin ja työaika lähetettiin tarkistettavaksi.',
    );
  };

  const saveManual = () => {
    if (!currentOrg || isPreviewing) return;
    if (!manual.date || !manual.startTime || !manual.endTime || (!manual.projectId && !manual.workOrderId)) {
      setError('Anna päivä, alku- ja loppuaika sekä projekti tai työmääräys.');
      return;
    }
    const numericBreak = Number(manual.breakMinutes || 0);
    void execute(async () => {
      await createManualTimeEntry({
        organizationId: currentOrg.id,
        targetUserId: data.capabilities.createForOthers ? manual.targetUserId : user?.id,
        projectId: manual.projectId,
        workOrderId: manual.workOrderId,
        date: manual.date,
        startTime: manual.startTime,
        endTime: manual.endTime,
        breakSource: manual.breakSource,
        breakMinutes: Number.isFinite(numericBreak) ? numericBreak : 0,
        description: manual.description,
      });
      setManualOpen(false);
      setManual(emptyManualForm(user?.id ?? ''));
    }, 'Puuttuva työaika lisättiin tarkistettavaksi.');
  };

  const approveDay = (day: TimeDaySummary) => {
    if (!currentOrg || isPreviewing) return;
    void execute(async () => {
      await reviewTimeDay({
        organizationId: currentOrg.id,
        targetUserId: day.userId,
        date: day.date,
        decision: 'approve',
      });
    }, `${day.employeeName} · ${dateLabel(day.date)} hyväksyttiin.`);
  };

  const submitCorrection = () => {
    if (!currentOrg || !correctionTarget || correctionReason.trim().length < 3 || isPreviewing) return;
    void execute(async () => {
      if (correctionTarget.kind === 'day' && correctionTarget.userId && correctionTarget.date) {
        await reviewTimeDay({
          organizationId: currentOrg.id,
          targetUserId: correctionTarget.userId,
          date: correctionTarget.date,
          decision: 'request_correction',
          reason: correctionReason.trim(),
        });
      } else if (correctionTarget.entryId) {
        await requestTimeEntryCorrection(currentOrg.id, correctionTarget.entryId, correctionReason.trim());
      }
      setCorrectionTarget(null);
      setCorrectionReason('');
    }, 'Korjauspyyntö lähetettiin.');
  };

  const resolveCorrection = (request: TimeCorrectionRequest, decision: 'accept' | 'reject') => {
    if (!currentOrg || isPreviewing) return;
    void execute(async () => {
      await resolveTimeEntryCorrection({
        organizationId: currentOrg.id,
        requestId: request.id,
        decision,
      });
    }, decision === 'accept'
      ? 'Korjauspyyntö hyväksyttiin ja kirjaus palautettiin odottavaksi.'
      : 'Korjauspyyntö suljettiin.');
  };

  if (!currentOrg) return <EmptyState title="Organisaatiota ei ole valittu" />;

  const roleTitle = management ? 'Työaikahallinta' : coordinator ? 'Projektien työaika' : 'Työaika';
  const roleDescription = data.role === 'admin'
    ? 'Organisaation työajat, hyväksyntä, poikkeamat, palkkakaudet ja työaikasäännöt.'
    : data.role === 'supervisor'
      ? 'Organisaation työajat, hyväksyntä, poikkeamat, palkkakaudet ja aktiiviset työntekijät.'
      : coordinator
        ? 'Omien projektien toteutuneet tunnit, työmääräykset ja aktiivinen työ.'
        : 'Aloita määrätty työ, seuraa omaa päivää ja korjaa puuttuvat kirjaukset.';

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-5 text-white shadow-xl sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
              VaKantti · {data.role === 'supervisor' ? 'Työnjohto' : data.role === 'admin' ? 'Järjestelmänvalvoja' : coordinator ? 'Projektikoordinaattori' : 'Työntekijä'}
            </p>
            <h1 className="mt-2 text-3xl font-bold">{roleTitle}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{roleDescription}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              onClick={() => void refresh()}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Päivitä
            </Button>
            {!isPreviewing && !coordinator && (
              <Button
                className="gap-2 bg-blue-500 text-white hover:bg-blue-600"
                onClick={() => { setManual(emptyManualForm(user?.id ?? '')); setManualOpen(true); }}
              >
                <Plus size={16} /> {management ? 'Lisää työaika' : 'Lisää puuttuva työaika'}
              </Button>
            )}
          </div>
        </div>
      </section>

      {error && <ErrorMessage message={error} />}
      {success && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" />{success}
        </div>
      )}
      {isPreviewing && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-800">
          Esikatselutilassa työaikatietoja voi tarkastella, mutta ei muuttaa.
        </div>
      )}
      {loading && (
        <div className="flex items-center gap-2 rounded-xl border bg-white p-4 text-sm text-slate-500">
          <Loader2 size={17} className="animate-spin" /> Ladataan työaikatietoja…
        </div>
      )}

      {worker && (
        <WorkerView
          dashboard={data}
          userId={user?.id ?? ''}
          ownSession={ownSession}
          ownOrders={ownOrders}
          todayEntries={todayEntries}
          days={days}
          openCorrections={openCorrections}
          todayHours={todayHours}
          overtimeHours={overtimeHours}
          correctionCount={correctionDays.length + openCorrections.length}
          now={now}
          saving={saving}
          isPreviewing={isPreviewing}
          startOrderId={startOrderId}
          startNote={startNote}
          expandedDay={expandedDay}
          onStartOrderChange={setStartOrderId}
          onStartNoteChange={setStartNote}
          onStart={() => void startWork()}
          onStop={stopWork}
          onExpand={setExpandedDay}
          onRequestEntryCorrection={(entryId, label) => {
            setCorrectionTarget({ kind: 'entry', entryId, label });
            setCorrectionReason('');
          }}
        />
      )}

      {management && (
        <ManagementView
          dashboard={data}
          days={visibleDays}
          pendingDays={pendingDays}
          openCorrections={openCorrections}
          totalHours={totalHours}
          pendingHours={pendingHours}
          overtimeHours={overtimeHours}
          now={now}
          saving={saving}
          isPreviewing={isPreviewing}
          search={search}
          from={from}
          to={to}
          expandedDay={expandedDay}
          onSearch={setSearch}
          onFrom={setFrom}
          onTo={setTo}
          onExpand={setExpandedDay}
          onApprove={approveDay}
          onRequestDayCorrection={(day) => {
            setCorrectionTarget({
              kind: 'day',
              userId: day.userId,
              date: day.date,
              label: `${day.employeeName} · ${dateLabel(day.date)}`,
            });
            setCorrectionReason('');
          }}
          onResolveCorrection={resolveCorrection}
          onOpenPayroll={() => navigate('/palkka-aineisto')}
          onOpenSettings={() => navigate('/hallinta')}
        />
      )}

      {coordinator && (
        <CoordinatorView dashboard={data} projects={projects} totalHours={totalHours} pendingHours={pendingHours} now={now} />
      )}

      <ManualTimeDialog
        open={manualOpen}
        saving={saving}
        management={management}
        dashboard={data}
        form={manual}
        onFormChange={setManual}
        onOpenChange={setManualOpen}
        onSave={saveManual}
      />

      <Dialog open={Boolean(correctionTarget)} onOpenChange={(open) => !saving && !open && setCorrectionTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pyydä työajan korjaus</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">{correctionTarget?.label}</p>
          <div className="space-y-2">
            <Label>Korjattava asia</Label>
            <Textarea
              rows={4}
              value={correctionReason}
              onChange={(event) => setCorrectionReason(event.target.value)}
              placeholder="Kerro selkeästi, mitä työajassa pitää korjata."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionTarget(null)} disabled={saving}>Peruuta</Button>
            <Button onClick={submitCorrection} disabled={saving || correctionReason.trim().length < 3}>
              Lähetä korjauspyyntö
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface WorkerViewProps {
  dashboard: TimeWorkspaceDashboard;
  userId: string;
  ownSession: TimeWorkspaceDashboard['activeSessions'][number] | undefined;
  ownOrders: TimeWorkspaceDashboard['workOrders'];
  todayEntries: TimeWorkspaceDashboard['entries'];
  days: TimeDaySummary[];
  openCorrections: TimeCorrectionRequest[];
  todayHours: number;
  overtimeHours: number;
  correctionCount: number;
  now: number;
  saving: boolean;
  isPreviewing: boolean;
  startOrderId: string;
  startNote: string;
  expandedDay: string | null;
  onStartOrderChange: (value: string) => void;
  onStartNoteChange: (value: string) => void;
  onStart: () => void;
  onStop: () => void;
  onExpand: (value: string | null) => void;
  onRequestEntryCorrection: (entryId: string, label: string) => void;
}

function WorkerView(props: WorkerViewProps) {
  const pending = props.dashboard.entries
    .filter((entry) => entry.status === 'Odottaa')
    .reduce((sum, entry) => sum + entry.hours, 0);
  return (
    <>
      <Card className={props.ownSession ? 'border-emerald-300 bg-emerald-50/50' : 'border-blue-200'}>
        <CardContent className="p-5 sm:p-6">
          {props.ownSession ? (
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <Badge className="border-0 bg-emerald-600 text-white">Työ käynnissä</Badge>
                <h2 className="mt-3 text-2xl font-bold text-slate-950">{props.ownSession.workOrderTitle}</h2>
                <p className="mt-1 text-sm text-slate-600">{props.ownSession.projectName}</p>
                <p className="mt-3 font-mono text-4xl font-bold text-emerald-700">
                  {formatWorkDuration(props.ownSession.startedAt, props.now)}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Aloitettu {dateTimeLabel(props.ownSession.startedAt)}
                  {props.ownSession.withinGeofence === false
                    ? ' · Aloitus työmaa-alueen ulkopuolelta'
                    : props.ownSession.checkInId ? ' · Sijaintinäyte tallennettu' : ''}
                </p>
              </div>
              <Button
                variant="destructive"
                size="lg"
                className="gap-2"
                disabled={props.saving || props.isPreviewing}
                onClick={props.onStop}
              >
                {props.saving ? <Loader2 size={17} className="animate-spin" /> : <PauseCircle size={18} />}
                Lopeta työpäivä
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <PlayCircle size={21} className="text-blue-700" /> Aloita määrätty työ
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Työaika käynnistyy valitulle työmääräykselle. Sijainti pyydetään vain aloitushetkellä.
                </p>
              </div>
              {props.ownOrders.length > 0 ? (
                <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr_auto] lg:items-end">
                  <div className="space-y-2">
                    <Label>Työmääräys</Label>
                    <Select value={props.startOrderId} onValueChange={props.onStartOrderChange}>
                      <SelectTrigger><SelectValue placeholder="Valitse määrätty työ" /></SelectTrigger>
                      <SelectContent>
                        {props.ownOrders.map((order) => (
                          <SelectItem key={order.id} value={order.id}>{order.title} · {order.projectName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Työhuomio</Label>
                    <Input value={props.startNote} onChange={(event) => props.onStartNoteChange(event.target.value)} placeholder="Valinnainen" />
                  </div>
                  <Button
                    size="lg"
                    className="gap-2"
                    disabled={!props.startOrderId || props.saving || props.isPreviewing}
                    onClick={props.onStart}
                  >
                    {props.saving ? <Loader2 size={17} className="animate-spin" /> : <PlayCircle size={18} />}
                    Aloita työ
                  </Button>
                </div>
              ) : (
                <EmptyState title="Sinulle ei ole määrätty avoimia töitä" description="Työnjohto voi nimetä sinut työmääräykselle." />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Tänään" value={formatHours(props.todayHours)} icon={Clock3} />
        <KpiCard label="Odottaa" value={formatHours(pending)} icon={CircleAlert} />
        <KpiCard label="Ylityö jaksolla" value={formatHours(props.overtimeHours)} icon={CalendarClock} />
        <KpiCard label="Korjattavaa" value={String(props.correctionCount)} icon={FilePenLine} />
      </div>

      <Tabs defaultValue="today" className="space-y-4">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="today">Tänään</TabsTrigger>
          <TabsTrigger value="history">Omat päivät</TabsTrigger>
          <TabsTrigger value="corrections">Korjauspyynnöt ({props.openCorrections.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="today">
          <Card>
            <CardHeader><CardTitle>Päivän työajan kohdistukset</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {props.todayEntries.map((entry) => (
                <div key={entry.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{entry.workOrderTitle || entry.projectName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {entry.startTime && entry.endTime ? `${entry.startTime.slice(0, 5)}–${entry.endTime.slice(0, 5)}` : 'Kellonaika puuttuu'} · {entry.description || 'Ei työselostetta'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <strong>{formatHours(entry.hours)}</strong>
                    <StatusBadge status={entry.status} />
                    {!entry.lockedAt && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => props.onRequestEntryCorrection(entry.id, `${entry.projectName} · ${dateLabel(entry.date)}`)}
                      >
                        Pyydä korjausta
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {props.todayEntries.length === 0 && <EmptyState title="Tälle päivälle ei ole vielä tuntikirjauksia" />}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history" className="space-y-3">
          {props.days.map((day) => (
            <DayCard
              key={day.key}
              day={day}
              expanded={props.expandedDay === day.key}
              onToggle={() => props.onExpand(props.expandedDay === day.key ? null : day.key)}
            />
          ))}
          {props.days.length === 0 && <EmptyState title="Työaikapäiviä ei ole valitulla jaksolla" />}
        </TabsContent>
        <TabsContent value="corrections">
          <CorrectionList requests={props.dashboard.correctionRequests} management={false} saving={props.saving} onResolve={() => undefined} />
        </TabsContent>
      </Tabs>
    </>
  );
}

interface ManagementViewProps {
  dashboard: TimeWorkspaceDashboard;
  days: TimeDaySummary[];
  pendingDays: TimeDaySummary[];
  openCorrections: TimeCorrectionRequest[];
  totalHours: number;
  pendingHours: number;
  overtimeHours: number;
  now: number;
  saving: boolean;
  isPreviewing: boolean;
  search: string;
  from: string;
  to: string;
  expandedDay: string | null;
  onSearch: (value: string) => void;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onExpand: (value: string | null) => void;
  onApprove: (day: TimeDaySummary) => void;
  onRequestDayCorrection: (day: TimeDaySummary) => void;
  onResolveCorrection: (request: TimeCorrectionRequest, decision: 'accept' | 'reject') => void;
  onOpenPayroll: () => void;
  onOpenSettings: () => void;
}

function ManagementView(props: ManagementViewProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Töissä nyt" value={String(props.dashboard.activeSessions.length)} icon={UsersRound} />
        <KpiCard label="Odottaa hyväksyntää" value={String(props.pendingDays.length)} icon={ListChecks} note={formatHours(props.pendingHours)} />
        <KpiCard label="Poikkeamat" value={String(props.dashboard.anomalies.length)} icon={AlertTriangle} />
        <KpiCard label="Korjauspyynnöt" value={String(props.openCorrections.length)} icon={FilePenLine} />
        <KpiCard label="Tunnit jaksolla" value={formatHours(props.totalHours)} icon={BarChart3} note={`Ylityö ${formatHours(props.overtimeHours)}`} />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="overview">Tilannekuva</TabsTrigger>
          <TabsTrigger value="approvals">Hyväksyntä ({props.pendingDays.length})</TabsTrigger>
          <TabsTrigger value="anomalies">Poikkeamat ({props.dashboard.anomalies.length})</TabsTrigger>
          <TabsTrigger value="all">Kaikki työajat</TabsTrigger>
          <TabsTrigger value="active">Töissä nyt ({props.dashboard.activeSessions.length})</TabsTrigger>
          <TabsTrigger value="periods">Palkkakaudet</TabsTrigger>
          {props.dashboard.capabilities.manageRules && <TabsTrigger value="rules">Säännöt</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Vaatii huomiota</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {props.pendingDays.slice(0, 5).map((day) => (
                  <div key={day.key} className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 p-3">
                    <div><p className="font-semibold">{day.employeeName}</p><p className="text-xs text-slate-600">{dateLabel(day.date)} · {formatHours(day.totalHours)}</p></div>
                    <Button size="sm" onClick={() => props.onApprove(day)} disabled={props.saving || props.isPreviewing}>Hyväksy</Button>
                  </div>
                ))}
                {props.pendingDays.length === 0 && <p className="text-sm text-slate-500">Ei hyväksyntää odottavia päiviä.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Aktiiviset työntekijät</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {props.dashboard.activeSessions.slice(0, 6).map((session) => (
                  <ActiveSessionRow key={session.id} session={session} now={props.now} />
                ))}
                {props.dashboard.activeSessions.length === 0 && <p className="text-sm text-slate-500">Kukaan ei työskentele juuri nyt.</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="approvals" className="space-y-3">
          {props.pendingDays.map((day) => (
            <DayCard
              key={day.key}
              day={day}
              expanded={props.expandedDay === day.key}
              onToggle={() => props.onExpand(props.expandedDay === day.key ? null : day.key)}
              actions={(
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-amber-700"
                    disabled={props.saving || day.locked || props.isPreviewing}
                    onClick={() => props.onRequestDayCorrection(day)}
                  >
                    Pyydä korjaus
                  </Button>
                  <Button
                    size="sm"
                    disabled={props.saving || day.locked || props.isPreviewing}
                    onClick={() => props.onApprove(day)}
                  >
                    <CheckCircle2 size={15} className="mr-1" /> Hyväksy päivä
                  </Button>
                </>
              )}
            />
          ))}
          {props.pendingDays.length === 0 && <EmptyState title="Kaikki työpäivät on käsitelty" />}
        </TabsContent>

        <TabsContent value="anomalies" className="space-y-3">
          {props.dashboard.anomalies.map((anomaly) => (
            <Card key={anomaly.id} className={anomaly.severity === 'critical' ? 'border-red-300' : anomaly.severity === 'warning' ? 'border-amber-300' : ''}>
              <CardContent className="flex gap-4 p-5">
                <div className={anomaly.severity === 'critical' ? 'rounded-xl bg-red-50 p-2 text-red-700' : 'rounded-xl bg-amber-50 p-2 text-amber-700'}>
                  <AlertTriangle size={19} />
                </div>
                <div><h3 className="font-semibold">{anomaly.title}</h3><p className="mt-1 text-sm text-slate-600">{anomaly.description}</p><p className="mt-2 text-xs text-slate-400">{dateTimeLabel(anomaly.createdAt)}</p></div>
              </CardContent>
            </Card>
          ))}
          {props.dashboard.anomalies.length === 0 && <EmptyState title="Työaikapoikkeamia ei löytynyt" />}
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardContent className="p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><Input className="pl-9" value={props.search} onChange={(event) => props.onSearch(event.target.value)} placeholder="Hae työntekijällä, projektilla tai päivällä" /></div>
                <Input type="date" value={props.from} onChange={(event) => props.onFrom(event.target.value)} className="sm:w-44" />
                <Input type="date" value={props.to} onChange={(event) => props.onTo(event.target.value)} className="sm:w-44" />
              </div>
              <div className="space-y-3">
                {props.days.map((day) => (
                  <DayCard key={day.key} day={day} expanded={props.expandedDay === day.key} onToggle={() => props.onExpand(props.expandedDay === day.key ? null : day.key)} />
                ))}
                {props.days.length === 0 && <EmptyState title="Hakuehdoilla ei löytynyt työaikaa" />}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active">
          <div className="grid gap-4 lg:grid-cols-2">
            {props.dashboard.activeSessions.map((session) => (
              <Card key={session.id}><CardContent className="p-5"><ActiveSessionRow session={session} now={props.now} expanded /></CardContent></Card>
            ))}
            {props.dashboard.activeSessions.length === 0 && <div className="lg:col-span-2"><EmptyState title="Kukaan ei ole tällä hetkellä töissä" /></div>}
          </div>
        </TabsContent>

        <TabsContent value="periods" className="space-y-4">
          <div className="flex justify-end"><Button className="gap-2" onClick={props.onOpenPayroll}><ShieldCheck size={16} /> Avaa palkka-aineisto ja lukitukset</Button></div>
          <div className="grid gap-3 lg:grid-cols-2">
            {props.dashboard.payrollPeriods.map((period) => (
              <Card key={period.id}><CardContent className="flex items-center justify-between gap-4 p-5"><div><p className="font-semibold">{dateLabel(period.periodStart)}–{dateLabel(period.periodEnd)}</p><p className="mt-1 text-xs text-slate-500">{period.lockedAt ? `Lukittu ${dateTimeLabel(period.lockedAt)}` : 'Avoin käsittelylle'}{period.exportedAt ? ` · Viety ${dateTimeLabel(period.exportedAt)}` : ''}</p></div><Badge variant="outline">{period.status}</Badge></CardContent></Card>
            ))}
            {props.dashboard.payrollPeriods.length === 0 && <div className="lg:col-span-2"><EmptyState title="Palkkakausia ei ole vielä muodostettu" /></div>}
          </div>
        </TabsContent>

        {props.dashboard.capabilities.manageRules && (
          <TabsContent value="rules">
            <Card>
              <CardHeader><CardTitle>Organisaation työaikasäännöt</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-600">Työnjohtaja käyttää samoja operatiivisia työkaluja, mutta vain järjestelmänvalvoja muuttaa organisaation laskentasääntöjä.</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {Object.entries(props.dashboard.timeRules)
                    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
                    .slice(0, 12)
                    .map(([key, value]) => <div key={key} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{key}</p><p className="mt-1 font-semibold">{String(value)}</p></div>)}
                </div>
                <Button variant="outline" className="gap-2" onClick={props.onOpenSettings}><Settings2 size={16} /> Avaa organisaation asetukset</Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <CorrectionList requests={props.dashboard.correctionRequests} management saving={props.saving} onResolve={props.onResolveCorrection} />
    </>
  );
}

function CoordinatorView({
  dashboard,
  projects,
  totalHours,
  pendingHours,
  now,
}: {
  dashboard: TimeWorkspaceDashboard;
  projects: ReturnType<typeof summarizeEntriesByProject>;
  totalHours: number;
  pendingHours: number;
  now: number;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Projektit" value={String(projects.length)} icon={BarChart3} />
        <KpiCard label="Tunnit jaksolla" value={formatHours(totalHours)} icon={Clock3} />
        <KpiCard label="Odottaa" value={formatHours(pendingHours)} icon={CircleAlert} />
        <KpiCard label="Töissä nyt" value={String(dashboard.activeSessions.length)} icon={UsersRound} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {projects.map((project) => (
          <Card key={project.projectId}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-950">{project.projectName}</h3><p className="mt-1 text-xs text-slate-500">{project.employeeCount} työntekijää · {project.entryCount} kirjausta</p></div><strong className="text-xl">{formatHours(project.totalHours)}</strong></div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Odottaa</p><p className="mt-1 font-semibold">{formatHours(project.pendingHours)}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Ylityö</p><p className="mt-1 font-semibold">{formatHours(project.overtimeHours)}</p></div></div>
            </CardContent>
          </Card>
        ))}
        {projects.length === 0 && <div className="lg:col-span-2"><EmptyState title="Projektien työaikaa ei löytynyt" /></div>}
      </div>
      <Card>
        <CardHeader><CardTitle>Projektien aktiivinen työ</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {dashboard.activeSessions.map((session) => <ActiveSessionRow key={session.id} session={session} now={now} />)}
          {dashboard.activeSessions.length === 0 && <p className="text-sm text-slate-500">Omissa projekteissa ei ole aktiivisia työvuoroja.</p>}
        </CardContent>
      </Card>
    </>
  );
}
