import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  FolderKanban,
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react';

import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOperationsData } from '@/hooks/useOperationsData';
import { useSchedulingData } from '@/hooks/useSchedulingData';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function statusBadge(status: string) {
  const className = status === 'Valmis'
    ? 'bg-emerald-50 text-emerald-700'
    : status === 'Myöhässä'
      ? 'bg-red-50 text-red-700'
      : status === 'Käynnissä' || status === 'Aktiivinen'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-blue-50 text-blue-700';
  return <Badge className={`border-0 ${className}`}>{status}</Badge>;
}

export default function Tyonjohto() {
  const navigate = useNavigate();
  const {
    projects,
    workOrders,
    timeEntries,
    employees,
    safetyItems,
  } = useAppDataContext();
  const { diaryEntries } = useOperationsData();
  const { phases, shifts } = useSchedulingData();

  const activeProjects = projects.filter((project) => project.status === 'Aktiivinen' || project.status === 'Myöhässä');
  const openOrders = workOrders.filter((order) => !['Valmis', 'Peruttu'].includes(order.status));
  const urgentOrders = openOrders.filter((order) => order.priority === 'Korkea');
  const pendingHours = timeEntries.filter((entry) => entry.status === 'Odottaa');
  const openSafety = safetyItems.filter((item) => !['Suljettu', 'Korjattu'].includes(item.status));
  const todayShifts = shifts.filter((shift) => shift.date === todayIso());
  const currentPhases = phases.filter((phase) => phase.status === 'Käynnissä' || phase.status === 'Myöhässä');
  const latestDiaries = diaryEntries.slice(0, 5);

  const alerts = [
    ...projects.filter((project) => project.status === 'Myöhässä').map((project) => ({
      id: `project-${project.id}`,
      title: `${project.name} on myöhässä`,
      detail: `${project.progress}% valmis`,
      path: '/projektit',
      severity: 'danger' as const,
    })),
    ...urgentOrders.map((order) => ({
      id: `order-${order.id}`,
      title: order.title,
      detail: `${order.project} · määräaika ${order.dueDate || 'puuttuu'}`,
      path: '/tyomaaraykset',
      severity: 'warning' as const,
    })),
    ...openSafety.filter((item) => item.severity === 'Vakava').map((item) => ({
      id: `safety-${item.id}`,
      title: item.title,
      detail: `Vakava turvallisuusasia · ${item.date}`,
      path: '/tyoturvallisuus',
      severity: 'danger' as const,
    })),
  ].slice(0, 8);

  const scorecards = [
    { label: 'Aktiiviset työmaat', value: activeProjects.length, detail: `${projects.length} projektia yhteensä`, icon: FolderKanban, path: '/projektit' },
    { label: 'Avoimet työmääräykset', value: openOrders.length, detail: `${urgentOrders.length} korkealla prioriteetilla`, icon: Wrench, path: '/tyomaaraykset' },
    { label: 'Tunnit hyväksyttävänä', value: pendingHours.length, detail: `${pendingHours.reduce((sum, entry) => sum + entry.hours, 0).toFixed(1)} tuntia`, icon: Clock, path: '/tuntikirjaukset' },
    { label: 'Avoimet turvallisuusasiat', value: openSafety.length, detail: `${openSafety.filter((item) => item.severity === 'Vakava').length} vakavaa`, icon: ShieldCheck, path: '/tyoturvallisuus' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-hero text-text-primary">Työnjohdon tilannekuva</h1>
        <p className="mt-1 text-body-sm text-text-secondary">Työmaat, resurssit, hyväksynnät ja poikkeamat samassa näkymässä</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {scorecards.map((item) => (
          <button key={item.label} type="button" onClick={() => navigate(item.path)} className="text-left">
            <Card className="h-full border-slate-200 transition-shadow hover:shadow-md">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light"><item.icon size={19} className="text-primary" /></div><ArrowRight size={16} className="text-text-muted" /></div>
                <p className="font-mono text-3xl font-bold text-text-primary">{item.value}</p>
                <p className="text-sm font-semibold text-text-primary">{item.label}</p>
                <p className="mt-1 text-xs text-text-secondary">{item.detail}</p>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2 text-lg"><FolderKanban size={19} className="text-primary" />Työmaiden eteneminen</CardTitle><Button variant="ghost" size="sm" onClick={() => navigate('/projektit')}>Kaikki projektit <ArrowRight size={15} className="ml-1" /></Button></CardHeader>
          <CardContent className="space-y-3">
            {activeProjects.map((project) => {
              const projectPhase = currentPhases.find((phase) => phase.projectId === project.id || phase.projectName === project.name);
              const projectOrders = openOrders.filter((order) => order.project === project.name);
              return <button key={project.id} type="button" onClick={() => navigate('/projektit')} className={cn('w-full rounded-xl border p-4 text-left transition-colors hover:bg-slate-50', project.status === 'Myöhässä' ? 'border-red-200' : 'border-slate-200')}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><h3 className="font-semibold text-text-primary">{project.name}</h3>{statusBadge(project.status)}</div><p className="mt-1 text-sm text-text-secondary">{project.location || project.customer}</p><p className="mt-2 text-xs text-text-muted">Nykyinen vaihe: {projectPhase?.name || 'Ei käynnissä olevaa vaihetta'} · {projectOrders.length} avointa työmääräystä</p></div><span className="font-mono text-sm font-semibold">{project.progress}%</span></div><Progress value={project.progress} className="mt-3 h-2" /></button>;
            })}
            {activeProjects.length === 0 && <div className="py-10 text-center"><CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-500" /><p className="font-semibold">Ei aktiivisia työmaita</p></div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><AlertTriangle size={19} className="text-amber-600" />Huomiota vaativat</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((alert) => <button key={alert.id} type="button" onClick={() => navigate(alert.path)} className="flex w-full items-start gap-3 rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50"><div className={`mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${alert.severity === 'danger' ? 'bg-red-500' : 'bg-amber-500'}`} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-text-primary">{alert.title}</p><p className="mt-0.5 text-xs text-text-secondary">{alert.detail}</p></div><ArrowRight size={14} className="mt-1 text-text-muted" /></button>)}
            {alerts.length === 0 && <div className="py-10 text-center"><CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-500" /><p className="font-semibold">Ei kiireellisiä huomioita</p></div>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Users size={19} className="text-primary" />Tämän päivän resurssit</CardTitle></CardHeader>
          <CardContent><p className="font-mono text-3xl font-bold">{todayShifts.length}</p><p className="text-sm text-text-secondary">suunniteltua työvuoroa</p><div className="mt-4 space-y-2">{todayShifts.slice(0, 6).map((shift) => <div key={shift.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-sm"><div><p className="font-medium">{shift.employeeName}</p><p className="text-xs text-text-secondary">{shift.project || shift.shiftType}</p></div><span className="font-mono text-xs">{shift.startTime}–{shift.endTime}</span></div>)}{todayShifts.length === 0 && <p className="text-sm text-text-secondary">Päivälle ei ole suunniteltuja vuoroja.</p>}</div><Button variant="ghost" className="mt-3 w-full justify-between" onClick={() => navigate('/tyovuorokalenteri')}>Avaa työvuorot <ArrowRight size={15} /></Button></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><BookOpen size={19} className="text-primary" />Viimeisimmät päiväkirjat</CardTitle></CardHeader>
          <CardContent className="space-y-2">{latestDiaries.map((entry) => <div key={entry.id} className="rounded-lg border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold">{entry.project}</p><span className="text-xs text-text-muted">{entry.date}</span></div><p className="mt-1 line-clamp-2 text-xs text-text-secondary">{entry.workDescription}</p></div>)}{latestDiaries.length === 0 && <p className="text-sm text-text-secondary">Ei päiväkirjamerkintöjä.</p>}<Button variant="ghost" className="w-full justify-between" onClick={() => navigate('/paivakirjat')}>Avaa päiväkirjat <ArrowRight size={15} /></Button></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CalendarDays size={19} className="text-primary" />Henkilöstötilanne</CardTitle></CardHeader>
          <CardContent><p className="font-mono text-3xl font-bold">{employees.filter((employee) => employee.status === 'Aktiivinen').length} / {employees.length}</p><p className="text-sm text-text-secondary">aktiivisena henkilöstörekisterissä</p><div className="mt-4 space-y-2">{['Lomalla', 'Sairas', 'Koulutuksessa'].map((status) => <div key={status} className="flex justify-between text-sm"><span>{status}</span><span className="font-mono font-semibold">{employees.filter((employee) => employee.status === status).length}</span></div>)}</div><Button variant="ghost" className="mt-3 w-full justify-between" onClick={() => navigate('/henkilosto')}>Avaa henkilöstö <ArrowRight size={15} /></Button></CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
