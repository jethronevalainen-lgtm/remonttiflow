import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FolderOpen,
  HardHat,
  Clock,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Plus,
  FileText,
  Wrench,
  Calendar,
  ArrowRight,
  Bell,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

/* Mock Data */
const kpiData = [
  {
    label: 'Aktiiviset projektit',
    value: '12',
    change: '+2',
    trend: 'up' as const,
    icon: FolderOpen,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    label: 'Tämän kuun liikevaihto',
    value: '45 230 €',
    change: '+12.5 %',
    trend: 'up' as const,
    icon: HardHat,
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  {
    label: 'Avoimet työmääräykset',
    value: '8',
    change: '-3',
    trend: 'down' as const,
    icon: Wrench,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  {
    label: 'Henkilöstö paikalla',
    value: '18 / 22',
    change: '-4',
    trend: 'down' as const,
    icon: Users,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
];

const recentEvents = [
  { id: '1', type: 'project', title: 'Projekti "Rivitalo A" siirtynyt vaiheeseen "Laatoitus"', date: '15.1.2026 klo 10.30.00', icon: FolderOpen, iconColor: 'text-blue-600', bg: 'bg-blue-50' },
  { id: '2', type: 'alert', title: 'Työmaalla "Kerrostalo B" havaittu vesivuoto - korjaustoimet käynnistetty', date: '15.1.2026 klo 9.15.00', icon: AlertTriangle, iconColor: 'text-red-600', bg: 'bg-red-50' },
  { id: '3', type: 'task', title: 'Uusi työmaaräys #1287 luotu - Sähkötyöt', date: '15.1.2026 klo 8.45.00', icon: CheckCircle2, iconColor: 'text-green-600', bg: 'bg-green-50' },
  { id: '4', type: 'message', title: 'Asiakas "Asunto Oy Keltainen Tähti" lähetti viestin', date: '14.1.2026 klo 16.20.00', icon: FileText, iconColor: 'text-purple-600', bg: 'bg-purple-50' },
  { id: '5', type: 'project', title: 'Projekti "Toimisto C" - tuntikirjaukset hyväksytty', date: '14.1.2026 klo 14.00.00', icon: FolderOpen, iconColor: 'text-blue-600', bg: 'bg-blue-50' },
  { id: '6', type: 'alert', title: 'Materiaalitoimitus viivästynyt 2 päivällä - Projekti "Rivitalo D"', date: '14.1.2026 klo 11.30.00', icon: AlertTriangle, iconColor: 'text-orange-600', bg: 'bg-orange-50' },
];

const quickActions = [
  { label: 'Uusi projekti', icon: Plus, path: '/projektit', color: 'bg-blue-600 hover:bg-blue-700' },
  { label: 'Uusi työmääräys', icon: Wrench, path: '/tyomaaraykset', color: 'bg-purple-600 hover:bg-purple-700' },
  { label: 'Kirjaa tunnit', icon: Clock, path: '/tuntikirjaukset', color: 'bg-green-600 hover:bg-green-700' },
  { label: 'Lisää asiakas', icon: Users, path: '/asiakkaat', color: 'bg-orange-600 hover:bg-orange-700' },
  { label: 'Luo lasku', icon: FileText, path: '/laskenta', color: 'bg-pink-600 hover:bg-pink-700' },
];

const upcomingDeadlines = [
  { date: '16', month: 'tammi', title: 'Putkityön tarkastus', project: 'Rivitalo A' },
  { date: '18', month: 'tammi', title: 'Sähkötyön välitarkastus', project: 'Kerrostalo B' },
  { date: '20', month: 'tammi', title: 'Laatoituksen aloitus', project: 'Rivitalo A' },
  { date: '22', month: 'tammi', title: 'Työturvallisuustarkastus', project: 'Toimisto C' },
  { date: '25', month: 'tammi', title: 'Loppukatselmus', project: 'Kerrostalo B' },
];

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Yleisnäkymä</h1>
          <p className="text-gray-500 mt-1">Tervetuloa takaisin, Jethro!</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
            <Bell className="w-3 h-3" />
            3 uutta ilmoitusta
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Tänään: {new Date().toLocaleDateString('fi-FI')}
          </Badge>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', kpi.bg)}>
                    <kpi.icon className={cn('w-5 h-5', kpi.color)} />
                  </div>
                  <div className={cn('flex items-center gap-1 text-xs font-medium', kpi.trend === 'up' ? 'text-green-600' : 'text-red-600')}>
                    {kpi.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {kpi.change}
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                <p className="text-sm text-gray-500">{kpi.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Events */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Viimeisimmät tapahtumat
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-primary">
                Näytä kaikki <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentEvents.map(event => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', event.bg)}>
                      <event.icon className={cn('w-4 h-4', event.iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{event.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{event.date}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Pikatoimenpiteet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {quickActions.map(action => (
                  <Button
                    key={action.label}
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => navigate(action.path)}
                  >
                    <action.icon className="w-4 h-4" />
                    {action.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Deadlines */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Tulevat määräajat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcomingDeadlines.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-primary-light flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-[10px] text-primary font-medium uppercase">{item.month}</span>
                      <span className="text-lg font-bold text-primary leading-tight">{item.date}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                      <p className="text-xs text-gray-500">{item.project}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Helper
function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
