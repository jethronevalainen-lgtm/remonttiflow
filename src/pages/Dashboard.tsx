import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Users,
  Calendar,
  AlertTriangle,
  Euro,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase,
  CheckCircle2,
  XCircle,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DashboardStat {
  label: string;
  value: string;
  change: string;
  isPositive: boolean;
  icon: React.ElementType;
  color: string;
}

interface Activity {
  id: string;
  type: 'project' | 'alert' | 'task' | 'message';
  description: string;
  timestamp: string;
  isRead: boolean;
}

const stats: DashboardStat[] = [
  {
    label: 'Aktiiviset projektit',
    value: '12',
    change: '+2',
    isPositive: true,
    icon: Briefcase,
    color: 'text-blue-600'
  },
  {
    label: 'Tämän kuun liikevaihto',
    value: '45 230 €',
    change: '+12.5 %',
    isPositive: true,
    icon: Euro,
    color: 'text-green-600'
  },
  {
    label: 'Avoimet työmaaräykset',
    value: '8',
    change: '-3',
    isPositive: true,
    icon: CheckCircle2,
    color: 'text-purple-600'
  },
  {
    label: 'Henkilöstö paikalla',
    value: '18 / 22',
    change: '-4',
    isPositive: false,
    icon: Users,
    color: 'text-orange-600'
  }
];

const recentActivities: Activity[] = [
  {
    id: '1',
    type: 'project',
    description: 'Projekti "Rivitalo A" siirtynyt vaiheeseen "Laatoitus"',
    timestamp: '2026-01-15T10:30:00',
    isRead: false
  },
  {
    id: '2',
    type: 'alert',
    description: 'Työmaalla "Kerrostalo B" havaittu vesivuoto - korjaustoimet käynnistetty',
    timestamp: '2026-01-15T09:15:00',
    isRead: false
  },
  {
    id: '3',
    type: 'task',
    description: 'Uusi työmaaräys #1287 luotu - Sähkötyöt',
    timestamp: '2026-01-15T08:45:00',
    isRead: true
  },
  {
    id: '4',
    type: 'message',
    description: 'Asiakas "Asunto Oy Keltanen Tähti" lähetti viestin',
    timestamp: '2026-01-14T16:20:00',
    isRead: true
  },
  {
    id: '5',
    type: 'project',
    description: 'Projekti "Toimisto C" - tuntikirjaukset hyväksytty',
    timestamp: '2026-01-14T14:00:00',
    isRead: true
  },
  {
    id: '6',
    type: 'alert',
    description: 'Materiaalitoimitus viivästynyt 2 päivällä - Projekti "Rivitalo D"',
    timestamp: '2026-01-14T11:30:00',
    isRead: false
  }
];

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'project':
      return <Briefcase className="w-4 h-4 text-blue-500" />;
    case 'alert':
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    case 'task':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'message':
      return <BarChart3 className="w-4 h-4 text-purple-500" />;
    default:
      return null;
  }
};

const getActivityBadge = (type: string) => {
  switch (type) {
    case 'project':
      return <Badge className="bg-blue-100 text-blue-800">Projekti</Badge>;
    case 'alert':
      return <Badge className="bg-red-100 text-red-800">Hälytys</Badge>;
    case 'task':
      return <Badge className="bg-green-100 text-green-800">Tehtävä</Badge>;
    case 'message':
      return <Badge className="bg-purple-100 text-purple-800">Viesti</Badge>;
    default:
      return null;
  }
};

export default function Dashboard() {
  const [activities, setActivities] = useState<Activity[]>(recentActivities);

  const markAsRead = (id: string) => {
    setActivities(prev =>
      prev.map(a => a.id === id ? { ...a, isRead: true } : a)
    );
  };

  const unreadCount = activities.filter(a => !a.isRead).length;

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
            <AlertTriangle className="w-3 h-3" />
            {unreadCount} uutta ilmoitusta
          </Badge>
          <Button variant="outline" size="sm">
            <Calendar className="w-4 h-4 mr-2" />
            Tänään: {new Date().toLocaleDateString('fi-FI')}
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <div className={`flex items-center gap-1 text-sm ${stat.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {stat.isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    {stat.change}
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activities */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Viimeisimmät tapahtumat
                </span>
                <Button variant="ghost" size="sm">Näytä kaikki</Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activities.map((activity) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex items-start gap-4 p-4 rounded-lg transition-all cursor-pointer ${
                      !activity.isRead ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'
                    }`}
                    onClick={() => markAsRead(activity.id)}
                  >
                    <div className="mt-1">{getActivityIcon(activity.type)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getActivityBadge(activity.type)}
                        {!activity.isRead && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full" />
                        )}
                      </div>
                      <p className={`text-sm ${!activity.isRead ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                        {activity.description}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(activity.timestamp).toLocaleString('fi-FI')}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions & Upcoming */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Pikatomenpiteet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: 'Uusi projekti', icon: Briefcase },
                  { label: 'Uusi työmaaräys', icon: CheckCircle2 },
                  { label: 'Kirjaa tunnit', icon: Clock },
                  { label: 'Lisää asiakas', icon: Users },
                  { label: 'Luo lasku', icon: Euro }
                ].map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <action.icon className="w-4 h-4 mr-2" />
                    {action.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Deadlines */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Tulevat määräajat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { date: '2026-01-16', title: 'Putkityön tarkastus', project: 'Rivitalo A' },
                  { date: '2026-01-18', title: 'Sähkötyön välitarkastus', project: 'Kerrostalo B' },
                  { date: '2026-01-20', title: 'Laatoituksen aloitus', project: 'Rivitalo A' },
                  { date: '2026-01-22', title: 'Työturvallisuustarkastus', project: 'Toimisto C' },
                  { date: '2026-01-25', title: 'Loppukatselmus', project: 'Kerrostalo B' }
                ].map((item, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="text-center min-w-[50px]">
                      <p className="text-xs text-gray-500">
                        {new Date(item.date).toLocaleDateString('fi-FI', { month: 'short' })}
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        {new Date(item.date).getDate()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
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
