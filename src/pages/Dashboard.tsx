import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Euro,
  FolderOpen,
  HardHat,
  Plus,
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

function currency(value: number) {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const finnish = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value);
  const parsed = finnish
    ? new Date(Number(finnish[3]), Number(finnish[2]) - 1, Number(finnish[1]))
    : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateLabel(value: string) {
  const date = parseDate(value);
  return date ? date.toLocaleDateString('fi-FI') : value || 'Ei määräaikaa';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { currentOrg } = useOrganization();
  const {
    projects,
    workOrders,
    timeEntries,
    employees,
    safetyItems,
    stats,
  } = useAppDataContext();

  const pendingHours = timeEntries
    .filter((entry) => entry.status === 'Odottaa')
    .reduce((sum, entry) => sum + entry.hours, 0);
  const highPriorityOrders = workOrders.filter(
    (order) => order.priority === 'Korkea' && !['Valmis', 'Peruttu'].includes(order.status),
  );
  const openSafetyItems = safetyItems.filter((item) =>
    !['Valmis', 'Suljettu', 'Korjattu'].includes(item.status),
  );
  const delayedProjects = projects.filter((project) => project.status === 'Myöhässä');
  const totalSpent = projects.reduce((sum, project) => sum + project.spent, 0);
  const budgetUsage = stats.totalRevenue > 0
    ? Math.min((totalSpent / stats.totalRevenue) * 100, 100)
    : 0;

  const deadlines = useMemo(() => {
    const candidates = [
      ...workOrders
        .filter((order) => order.dueDate && !['Valmis', 'Peruttu'].includes(order.status))
        .map((order) => ({
          id: `work-${order.id}`,
          date: order.dueDate,
          title: order.title,
          context: order.project || 'Työmääräys',
          path: '/tyomaaraykset',
        })),
      ...projects
        .filter((project) => project.endDate && project.status !== 'Valmis')
        .map((project) => ({
          id: `project-${project.id}`,
          date: project.endDate,
          title: `${project.name} päättyy`,
          context: project.customer,
          path: '/projektit',
        })),
    ];

    return candidates
      .map((candidate) => ({ ...candidate, parsed: parseDate(candidate.date) }))
      .filter((candidate) => candidate.parsed !== null)
      .sort((a, b) => (a.parsed as Date).getTime() - (b.parsed as Date).getTime())
      .slice(0, 6);
  }, [projects, workOrders]);

  const kpis = [
    {
      label: 'Aktiiviset projektit',
      value: stats.activeProjects,
      detail: `${stats.totalProjects} projektia yhteensä`,
      icon: FolderOpen,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Projektibudjetit',
      value: currency(stats.totalRevenue),
      detail: `${currency(totalSpent)} toteutunut`,
      icon: Euro,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Avoimet työmääräykset',
      value: stats.openWorkOrders + stats.inProgressWorkOrders,
      detail: `${stats.inProgressWorkOrders} käynnissä`,
      icon: Wrench,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Aktiivinen henkilöstö',
      value: `${stats.activeEmployees} / ${stats.totalEmployees}`,
      detail: `${employees.length} henkilöä`,
      icon: Users,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
  ];

  const alerts = [
    {
      label: 'Myöhässä olevat projektit',
      value: delayedProjects.length,
      icon: AlertTriangle,
      path: '/projektit',
      tone: delayedProjects.length > 0 ? 'danger' : 'ok',
    },
    {
      label: 'Kiireelliset työmääräykset',
      value: highPriorityOrders.length,
      icon: Wrench,
      path: '/tyomaaraykset',
      tone: highPriorityOrders.length > 0 ? 'warning' : 'ok',
    },
    {
      label: 'Hyväksyntää odottavat tunnit',
      value: `${pendingHours.toFixed(1)} h`,
      icon: Clock,
      path: '/tuntikirjaukset',
      tone: pendingHours > 0 ? 'warning' : 'ok',
    },
    {
      label: 'Avoimet turvallisuusasiat',
      value: openSafetyItems.length,
      icon: ShieldCheck,
      path: '/tyoturvallisuus',
      tone: openSafetyItems.length > 0 ? 'danger' : 'ok',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Yleisnäkymä</h1>
          <p className="mt-1 text-gray-500">
            {currentOrg?.name ?? 'Organisaatio'} · Tervetuloa, {profile?.full_name || user?.email || 'käyttäjä'}
          </p>
        </div>
        <Badge variant="outline" className="w-fit gap-1.5 bg-white">
          <Calendar className="h-3.5 w-3.5" />
          {new Date().toLocaleDateString('fi-FI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi, index) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
            <Card className="h-full border-slate-200 transition-shadow hover:shadow-md">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', kpi.bg)}>
                    <kpi.icon className={cn('h-5 w-5', kpi.color)} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                <p className="text-sm font-medium text-gray-700">{kpi.label}</p>
                <p className="mt-1 text-xs text-gray-500">{kpi.detail}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Huomiot ja työjono
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {alerts.map((alert) => (
              <button
                key={alert.label}
                type="button"
                onClick={() => navigate(alert.path)}
                className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-left transition-colors hover:bg-slate-50"
              >
                <div className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg',
                  alert.tone === 'danger' ? 'bg-red-50 text-red-600' : alert.tone === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600',
                )}>
                  <alert.icon size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-500">{alert.label}</p>
                  <p className="text-xl font-bold text-gray-900">{alert.value}</p>
                </div>
                <ArrowRight size={16} className="text-gray-400" />
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <HardHat className="h-5 w-5 text-primary" />
              Pikatoiminnot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/projektit')}><Plus size={16} /> Uusi projekti</Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/tyomaaraykset')}><Wrench size={16} /> Uusi työmääräys</Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/tuntikirjaukset')}><Clock size={16} /> Kirjaa tunnit</Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/tyoturvallisuus')}><ShieldCheck size={16} /> Turvallisuushavainto</Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-primary" />
              Tulevat määräajat
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deadlines.length > 0 ? (
              <div className="space-y-2">
                {deadlines.map((deadline) => (
                  <button key={deadline.id} type="button" onClick={() => navigate(deadline.path)} className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-gray-50">
                    <div className="flex h-11 min-w-20 items-center justify-center rounded-lg bg-primary-light px-2 text-xs font-semibold text-primary">{dateLabel(deadline.date)}</div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-gray-900">{deadline.title}</p><p className="truncate text-xs text-gray-500">{deadline.context}</p></div>
                    <ArrowRight size={15} className="text-gray-400" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-gray-500"><CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />Ei tulevia määräaikoja.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg"><Euro className="h-5 w-5 text-primary" />Budjetin käyttö</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between"><div><p className="text-sm text-gray-500">Toteutunut</p><p className="text-2xl font-bold text-gray-900">{currency(totalSpent)}</p></div><p className="text-sm font-semibold text-gray-600">{budgetUsage.toFixed(1)} %</p></div>
            <Progress value={budgetUsage} className="h-3" />
            <div className="flex justify-between text-sm text-gray-500"><span>Kokonaisbudjetti</span><span className="font-medium text-gray-800">{currency(stats.totalRevenue)}</span></div>
            <Button variant="ghost" className="w-full justify-between" onClick={() => navigate('/laskenta')}>Avaa kustannuslaskenta <ArrowRight size={16} /></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
