import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Euro,
  FolderKanban,
  HardHat,
  MapPin,
  ShieldCheck,
  UsersRound,
  Wrench,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import { useSchedulingData } from '@/hooks/useSchedulingData';
import { cn } from '@/lib/utils';

function currency(value: number) {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function isoToday() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function dateLabel(value: string) {
  if (!value) return 'Ei määräaikaa';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

function WorkerDashboard() {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const { effectiveDisplayName } = useViewAs();
  const { projects, timeEntries } = useAppDataContext();
  const { workOrders, projectMemberships, loading, error } = useRoleWorkspace();
  const { shifts } = useSchedulingData();

  const activeOrders = workOrders.filter((order) => order.status === 'Käynnissä');
  const openOrders = workOrders.filter((order) => order.status === 'Avoin');
  const waitingOrders = workOrders.filter((order) => order.status === 'Odottaa');
  const aliases = useMemo(
    () => [effectiveDisplayName].filter(Boolean).map((value) => value.trim().toLocaleLowerCase('fi')),
    [effectiveDisplayName],
  );
  const ownEntries = timeEntries.filter((entry) => aliases.includes(entry.employee.trim().toLocaleLowerCase('fi')));
  const pendingHours = ownEntries
    .filter((entry) => entry.status === 'Odottaa')
    .reduce((sum, entry) => sum + entry.hours + entry.overtime, 0);
  const approvedHours = ownEntries
    .filter((entry) => entry.status === 'Hyväksytty')
    .reduce((sum, entry) => sum + entry.hours + entry.overtime, 0);
  const ownProjectIds = new Set(projectMemberships.map((membership) => membership.projectId));
  const ownProjects = projects.filter((project) => ownProjectIds.has(project.id));
  const upcomingShifts = shifts
    .filter((shift) => shift.date >= isoToday())
    .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`))
    .slice(0, 5);
  const priorityOrders = [...activeOrders, ...openOrders, ...waitingOrders]
    .sort((a, b) => {
      const priority = { Korkea: 0, Normaali: 1, Matala: 2 };
      return priority[a.priority] - priority[b.priority]
        || (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
    })
    .slice(0, 6);

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 sm:space-y-6">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
              <HardHat size={16} /> Oma työtila
            </div>
            <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">
              Hei, {effectiveDisplayName || 'työntekijä'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              {currentOrg?.name}. Tässä näkyvät valitulle käyttäjälle tai hänen projektitiimilleen kohdistetut työt ja vuorot.
            </p>
          </div>
          <Badge className="w-fit border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100">
            {new Date().toLocaleDateString('fi-FI', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Badge>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={17} className="mt-0.5 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Työ käynnissä', value: activeOrders.length, detail: 'aktiivista tehtävää', icon: Wrench, tone: 'bg-orange-50 text-orange-700' },
          { label: 'Avoimet tehtävät', value: openOrders.length, detail: `${waitingOrders.length} odottaa`, icon: ClipboardList, tone: 'bg-blue-50 text-blue-700' },
          { label: 'Omat tunnit', value: `${approvedHours.toFixed(1)} h`, detail: `${pendingHours.toFixed(1)} h odottaa`, icon: Clock3, tone: 'bg-emerald-50 text-emerald-700' },
          { label: 'Omat kohteet', value: ownProjects.length, detail: 'projektia käytettävissä', icon: MapPin, tone: 'bg-purple-50 text-purple-700' },
        ].map((item) => (
          <Card key={item.label} className="min-w-0 border-slate-200 shadow-sm">
            <CardContent className="p-3 sm:p-5">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:text-xs">{item.label}</p>
                  <p className="mt-2 break-words font-mono text-2xl font-bold text-slate-950 sm:text-3xl">{item.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
                </div>
                <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11', item.tone)}>
                  <item.icon size={21} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card className="min-w-0 border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3 p-4 sm:p-6">
            <CardTitle className="flex min-w-0 items-center gap-2 text-base sm:text-lg">
              <ClipboardList size={19} className="flex-shrink-0 text-orange-600" /> Seuraavat työni
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/tyomaaraykset')} className="flex-shrink-0 gap-1">Kaikki <ArrowRight size={14} /></Button>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
            {priorityOrders.map((order) => (
              <button key={order.id} type="button" onClick={() => navigate('/tyomaaraykset')} className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition-colors hover:bg-slate-50 sm:p-4">
                <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11', order.status === 'Käynnissä' ? 'bg-orange-50 text-orange-700' : order.priority === 'Korkea' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700')}>
                  {order.status === 'Käynnissä' ? <Wrench size={19} /> : <ClipboardList size={19} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="min-w-0 flex-1 break-words font-semibold text-slate-900">{order.title}</p>
                    <Badge variant="outline">{order.status}</Badge>
                  </div>
                  <p className="mt-1 break-words text-xs text-slate-500">{order.project} · {dateLabel(order.dueDate)}</p>
                </div>
                <ArrowRight size={16} className="flex-shrink-0 text-slate-400" />
              </button>
            ))}
            {!loading && priorityOrders.length === 0 && (
              <div className="py-10 text-center">
                <CheckCircle2 size={38} className="mx-auto mb-3 text-emerald-500" />
                <p className="font-semibold text-slate-800">Ei avoimia tehtäviä</p>
                <p className="mt-1 text-sm text-slate-500">Työnjohdon kohdistamat tehtävät ilmestyvät tähän.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 border-slate-200 shadow-sm">
          <CardHeader className="p-4 sm:p-6"><CardTitle className="flex items-center gap-2 text-base sm:text-lg"><CalendarDays size={19} className="text-blue-600" /> Omat vuorot</CardTitle></CardHeader>
          <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
            {upcomingShifts.map((shift) => (
              <div key={shift.id} className="rounded-xl border border-slate-200 p-3 sm:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-semibold text-slate-900">{dateLabel(shift.date)}</p><p className="mt-1 text-sm text-slate-600">{shift.startTime}–{shift.endTime}</p></div>
                  <Badge variant="outline">{shift.shiftType || 'Työvuoro'}</Badge>
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-500"><MapPin size={14} />{shift.project || 'Projektia ei määritetty'}</p>
              </div>
            ))}
            {upcomingShifts.length === 0 && <div className="py-8 text-center text-sm text-slate-500">Ei tulevia omia vuoroja.</div>}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="p-4 sm:p-6"><CardTitle className="text-base sm:text-lg">Pikatoiminnot</CardTitle></CardHeader>
        <CardContent className="grid gap-3 p-4 pt-0 sm:grid-cols-2 sm:p-6 sm:pt-0 lg:grid-cols-4">
          {[
            { label: 'Omat työt', detail: 'Aloita ja kuittaa tehtäviä', icon: ClipboardList, path: '/tyomaaraykset' },
            { label: 'Kirjaa tunnit', detail: 'Oma työaika', icon: Clock3, path: '/tuntikirjaukset' },
            { label: 'Työmaakuittaus', detail: 'Kuvat ja allekirjoitus', icon: CheckCircle2, path: '/kuittaukset' },
            { label: 'Lomakkeet', detail: 'Täytä työmaalta', icon: ShieldCheck, path: '/lomakkeet' },
          ].map((item) => (
            <Button key={item.path} variant="outline" className="h-auto min-h-16 justify-start gap-3 p-4" onClick={() => navigate(item.path)}>
              <item.icon size={19} className="flex-shrink-0 text-orange-600" />
              <span className="min-w-0 break-words text-left"><span className="block font-semibold">{item.label}</span><span className="block text-xs font-normal text-slate-500">{item.detail}</span></span>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ManagementDashboard() {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const { effectiveRole, effectiveDisplayName } = useViewAs();
  const { projects, workOrders, timeEntries, employees, safetyItems, stats } = useAppDataContext();

  const pendingHours = timeEntries.filter((entry) => entry.status === 'Odottaa').reduce((sum, entry) => sum + entry.hours + entry.overtime, 0);
  const highPriorityOrders = workOrders.filter((order) => order.priority === 'Korkea' && !['Valmis', 'Peruttu'].includes(order.status));
  const openSafetyItems = safetyItems.filter((item) => !['Valmis', 'Suljettu', 'Korjattu'].includes(item.status));
  const delayedProjects = projects.filter((project) => project.status === 'Myöhässä');
  const totalSpent = projects.reduce((sum, project) => sum + project.spent, 0);
  const budgetUsage = stats.totalRevenue > 0 ? Math.min(totalSpent / stats.totalRevenue * 100, 100) : 0;
  const deadlines = useMemo(() => [
    ...workOrders.filter((order) => order.dueDate && !['Valmis', 'Peruttu'].includes(order.status)).map((order) => ({ id: `work-${order.id}`, date: order.dueDate, title: order.title, context: order.project, path: '/tyomaaraykset' })),
    ...projects.filter((project) => project.endDate && project.status !== 'Valmis').map((project) => ({ id: `project-${project.id}`, date: project.endDate, title: `${project.name} päättyy`, context: project.customer, path: '/projektit' })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6), [projects, workOrders]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 sm:space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300"><HardHat size={16} />{effectiveRole === 'admin' ? 'Adminin tilannekuva' : 'Työnjohdon tilannekuva'}</div>
            <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{currentOrg?.name}</h1>
            <p className="mt-2 text-sm text-slate-300">Tervetuloa, {effectiveDisplayName}. Operatiivinen tilanne perustuu organisaation ajantasaisiin tietoihin.</p>
          </div>
          <Badge className="w-fit border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100">{new Date().toLocaleDateString('fi-FI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Aktiiviset projektit', value: stats.activeProjects, detail: `${delayedProjects.length} myöhässä`, icon: FolderKanban, tone: 'bg-blue-50 text-blue-700' },
          { label: 'Avoimet työmääräykset', value: stats.openWorkOrders, detail: `${stats.inProgressWorkOrders} käynnissä`, icon: Wrench, tone: 'bg-orange-50 text-orange-700' },
          { label: 'Odottaa hyväksyntää', value: `${pendingHours.toFixed(1)} h`, detail: 'tuntikirjauksia', icon: Clock3, tone: 'bg-amber-50 text-amber-700' },
          { label: 'Henkilöstö', value: stats.activeEmployees || employees.length, detail: 'aktiivista henkilöä', icon: UsersRound, tone: 'bg-purple-50 text-purple-700' },
        ].map((item) => (
          <Card key={item.label} className="min-w-0 border-slate-200 shadow-sm"><CardContent className="p-3 sm:p-5"><div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:text-xs">{item.label}</p><p className="mt-2 break-words font-mono text-2xl font-bold text-slate-950 sm:text-3xl">{item.value}</p><p className="mt-1 text-xs text-slate-500">{item.detail}</p></div><div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11', item.tone)}><item.icon size={21} /></div></div></CardContent></Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="min-w-0 border-slate-200 shadow-sm"><CardHeader className="p-4 sm:p-6"><CardTitle className="text-base sm:text-lg">Johdon huomiot</CardTitle></CardHeader><CardContent className="grid gap-3 p-4 pt-0 sm:grid-cols-2 sm:p-6 sm:pt-0">{[
          { label: 'Korkean prioriteetin työt', value: highPriorityOrders.length, icon: AlertTriangle, path: '/tyomaaraykset', danger: true },
          { label: 'Avoimet turvallisuushavainnot', value: openSafetyItems.length, icon: ShieldCheck, path: '/tyoturvallisuus', danger: openSafetyItems.length > 0 },
          { label: 'Myöhässä olevat projektit', value: delayedProjects.length, icon: FolderKanban, path: '/projektit', danger: delayedProjects.length > 0 },
          { label: 'Odottaa tuntihyväksyntää', value: `${pendingHours.toFixed(1)} h`, icon: Clock3, path: '/tuntikirjaukset', danger: pendingHours > 0 },
        ].map((item) => <button key={item.label} type="button" onClick={() => navigate(item.path)} className="flex min-h-16 min-w-0 items-center gap-3 rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50 sm:p-4"><div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg', item.danger ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')}><item.icon size={19} /></div><div className="min-w-0 flex-1"><p className="text-sm text-slate-500">{item.label}</p><p className="break-words text-xl font-bold text-slate-950">{item.value}</p></div><ArrowRight size={16} className="flex-shrink-0 text-slate-400" /></button>)}</CardContent></Card>

        <Card className="min-w-0 border-slate-200 shadow-sm"><CardHeader className="p-4 sm:p-6"><CardTitle className="text-base sm:text-lg">Pikatoiminnot</CardTitle></CardHeader><CardContent className="space-y-2 p-4 pt-0 sm:p-6 sm:pt-0"><Button variant="outline" className="min-h-11 w-full justify-start gap-2" onClick={() => navigate('/projektit')}><FolderKanban size={16} /> Projektit ja tiimit</Button><Button variant="outline" className="min-h-11 w-full justify-start gap-2" onClick={() => navigate('/tyomaaraykset')}><Wrench size={16} /> Kohdista työmääräys</Button><Button variant="outline" className="min-h-11 w-full justify-start gap-2" onClick={() => navigate('/tyovuorokalenteri')}><CalendarDays size={16} /> Suunnittele vuorot</Button><Button variant="outline" className="min-h-11 w-full justify-start gap-2" onClick={() => navigate('/raportit')}><Euro size={16} /> Avaa raportit</Button></CardContent></Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="min-w-0 border-slate-200 shadow-sm"><CardHeader className="p-4 sm:p-6"><CardTitle className="flex items-center gap-2 text-base sm:text-lg"><CalendarDays size={19} className="text-blue-600" /> Tulevat määräajat</CardTitle></CardHeader><CardContent className="space-y-2 p-4 pt-0 sm:p-6 sm:pt-0">{deadlines.map((item) => <button key={item.id} type="button" onClick={() => navigate(item.path)} className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-lg p-2 text-left hover:bg-slate-50 sm:p-3"><div className="min-w-20 flex-shrink-0 rounded-lg bg-blue-50 px-2 py-2 text-center text-xs font-semibold text-blue-700 sm:min-w-24">{dateLabel(item.date)}</div><div className="min-w-0 flex-1 break-words"><p className="text-sm font-medium text-slate-900">{item.title}</p><p className="text-xs text-slate-500">{item.context}</p></div><ArrowRight size={15} className="flex-shrink-0 text-slate-400" /></button>)}{deadlines.length === 0 && <div className="py-8 text-center text-sm text-slate-500">Ei tulevia määräaikoja.</div>}</CardContent></Card>

        <Card className="min-w-0 border-slate-200 shadow-sm"><CardHeader className="p-4 sm:p-6"><CardTitle className="flex items-center gap-2 text-base sm:text-lg"><Euro size={19} className="text-emerald-600" /> Budjetin käyttö</CardTitle></CardHeader><CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0"><div className="flex min-w-0 items-end justify-between gap-3"><div className="min-w-0"><p className="text-sm text-slate-500">Toteutunut</p><p className="break-words text-xl font-bold text-slate-950 sm:text-2xl">{currency(totalSpent)}</p></div><p className="flex-shrink-0 font-mono text-sm font-semibold">{budgetUsage.toFixed(1)} %</p></div><Progress value={budgetUsage} className="h-3" /><div className="flex min-w-0 justify-between gap-3 text-sm text-slate-500"><span>Kokonaisbudjetti</span><strong className="break-words text-right text-slate-800">{currency(stats.totalRevenue)}</strong></div><Button variant="ghost" className="w-full justify-between" onClick={() => navigate('/laskenta')}>Avaa kustannuslaskenta <ArrowRight size={15} /></Button></CardContent></Card>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { effectiveRole } = useViewAs();
  return effectiveRole === 'worker' ? <WorkerDashboard /> : <ManagementDashboard />;
}
