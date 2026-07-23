import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FolderOpen,
  HardHat,
  Euro,
  Users,
  TrendingUp,
  TrendingDown,
  Plus,
  Clock,
  ShieldCheck,
  ChevronRight,
  AlertTriangle,
  Wrench,
  CalendarClock,
  Banknote,
  FolderKanban,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppDataContext } from '../contexts/AppDataContext';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format } from 'date-fns';
import { fi } from 'date-fns/locale';

/* ─── Animation Variants ─── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
  },
};

const slideLeftVariants = {
  hidden: { opacity: 0, x: -30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
  },
};

const slideRightVariants = {
  hidden: { opacity: 0, x: 30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, delay: 0.1, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
  },
};

/* ─── Mock Data ─── */

const revenueData = [
  { month: 'Tammi', revenue: 98400, costs: 62300, margin: 36100 },
  { month: 'Helmi', revenue: 112300, costs: 71200, margin: 41100 },
  { month: 'Maalis', revenue: 105600, costs: 68900, margin: 36700 },
  { month: 'Huhti', revenue: 118900, costs: 74500, margin: 44400 },
  { month: 'Touko', revenue: 134200, costs: 82100, margin: 52100 },
  { month: 'Kesä', revenue: 184500, costs: 96800, margin: 87700 },
];

const STATUS_COLORS: Record<string, string> = {
  'Aktiivinen': '#F97316',
  'Suunniteltu': '#3B82F6',
  'Valmis': '#22C55E',
  'Myöhässä': '#EF4444',
};

/* Urgent work orders now come from context */

const recentActivities = [
  { time: '09:15', user: 'Matti Korhonen', action: 'kirjasi 8h työaikaa', module: 'Tuntikirjaukset', moduleColor: '#F97316' },
  { time: '08:42', user: 'Järjestelmä', action: 'Uusi työmääräys luotu: #TM-2025-084', module: 'Työmääräykset', moduleColor: '#3B82F6' },
  { time: '08:30', user: 'Pekka Kinnunen', action: 'Päiväkirja täytetty: Tampereen kohde', module: 'Päiväkirjat', moduleColor: '#22C55E' },
  { time: 'Eilen', user: 'Järjestelmä', action: 'Laskenta hyväksytty: Espoon projekti', module: 'Laskenta', moduleColor: '#8B5CF6' },
  { time: 'Eilen', user: 'Sari Kolehmainen', action: 'Turvakierros suoritettu: Työmaa 3', module: 'Työturvallisuus', moduleColor: '#EF4444' },
  { time: 'Eilen', user: 'Anna Lahtinen', action: 'lisättiin projektiin: Korjaustyö Tampere', module: 'Projektit', moduleColor: '#F97316' },
  { time: 'Ti', user: 'Järjestelmä', action: 'Kaluston huolto: Kaivuri K-01 suunniteltu', module: 'Kalusto', moduleColor: '#F59E0B' },
  { time: 'Ti', user: 'Jukka Lehtonen', action: 'kirjasi matkakulut: 45 km', module: 'Matkakulut', moduleColor: '#3B82F6' },
  { time: 'Ma', user: 'Järjestelmä', action: 'Lomake lähetetty: TYA-asbesti-ilmoitus', module: 'Lomakkeet', moduleColor: '#64748B' },
  { time: 'Ma', user: 'Liisa Rantanen', action: 'päivitti asiakastietoja', module: 'Asiakkaat', moduleColor: '#22C55E' },
];

const quickActions = [
  { label: 'Uusi työmääräys', icon: Plus, color: '#F97316', path: '/tyomaaraykset' },
  { label: 'Kirjaa tunnit', icon: Clock, color: '#3B82F6', path: '/tuntikirjaukset' },
  { label: 'Turvakierros', icon: ShieldCheck, color: '#22C55E', path: '/tyoturvallisuus' },
  { label: 'Työvuorot', icon: CalendarClock, color: '#F59E0B', path: '/tyovuorokalenteri' },
  { label: 'Projektit', icon: FolderKanban, color: '#8B5CF6', path: '/projektit' },
  { label: 'Raportit', icon: Banknote, color: '#EC4899', path: '/raportit' },
];

/* ─── Tooltip Component for Chart ─── */
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-[#E2E8F0] px-4 py-3">
      <p className="text-sm font-semibold text-text-primary mb-1">{label}</p>
      {payload.map((entry, idx) => (
        <p key={idx} className="text-xs text-text-secondary">
          {entry.dataKey === 'revenue' && 'Liikevaihto: '}
          {entry.dataKey === 'costs' && 'Kustannukset: '}
          {entry.dataKey === 'margin' && 'Kate: '}
          <span className="font-semibold text-text-primary">
            {entry.value.toLocaleString('fi-FI')} €
          </span>
        </p>
      ))}
    </div>
  );
}

/* ─── Page Component ─── */
export default function Dashboard() {
  const navigate = useNavigate();
  const { stats, projects, workOrders } = useAppDataContext();
  const today = new Date();
  const formattedDate = format(today, "EEEE d. MMMM yyyy", { locale: fi });
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => p.status === 'Aktiivinen').length;
  const inProgressWork = workOrders.filter(wo => wo.status === 'Käynnissä').length;
  const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0);
  const totalSpent = projects.reduce((sum, p) => sum + p.spent, 0);
  const openWorkOrders = workOrders.filter(wo => wo.status === 'Avoin').length;

  return (
    <div className="space-y-6">
      {/* ─── Page Header ─── */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-hero text-text-primary">Päänäkymä</h1>
          <p className="text-body-sm text-text-secondary mt-1 flex items-center gap-1.5">
            <CalendarClock size={14} />
            {capitalizedDate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate('/tyomaaraykset')}
            className="bg-primary hover:bg-primary-hover text-white gap-1.5"
            size="sm"
          >
            <Plus size={16} /> Uusi työmääräys
          </Button>
          <Button
            onClick={() => navigate('/tuntikirjaukset')}
            variant="outline"
            className="gap-1.5"
            size="sm"
          >
            <Clock size={16} /> Kirjaa tunnit
          </Button>
          <Button
            onClick={() => navigate('/tyoturvallisuus')}
            variant="outline"
            className="gap-1.5"
            size="sm"
          >
            <ShieldCheck size={16} /> Turvakierros
          </Button>
        </div>
      </motion.div>

      {/* ─── KPI Cards ─── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        {[
          {
            label: 'Avoimet projektit',
            value: String(activeProjects),
            icon: FolderOpen,
            iconBg: '#FFF7ED',
            iconColor: '#F97316',
            trend: '+8%',
            trendUp: true,
            sublabel: `${projects.filter(p => p.status === 'Suunniteltu').length} suunnitteilla`,
          },
          {
            label: 'Käynnissä olevat työt',
            value: String(inProgressWork),
            icon: HardHat,
            iconBg: '#DBEAFE',
            iconColor: '#3B82F6',
            trend: '+12%',
            trendUp: true,
            sublabel: `${openWorkOrders} avoinna`,
          },
          {
            label: 'Tämän kuun liikevaihto',
            value: new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(totalSpent),
            icon: Euro,
            iconBg: '#DCFCE7',
            iconColor: '#22C55E',
            trend: '+15%',
            trendUp: true,
            sublabel: `Budjetti: ${new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(totalBudget)}`,
          },
          {
            label: 'Henkilöstö paikalla',
            value: `${stats.activeEmployees}/${stats.totalEmployees}`,
            icon: Users,
            iconBg: '#FEF3C7',
            iconColor: '#F59E0B',
            trend: `${Math.round((stats.activeEmployees / stats.totalEmployees) * 100)}%`,
            trendUp: true,
            sublabel: `${stats.totalEmployees - stats.activeEmployees} poissa`,
            isPercentage: true,
          },
        ].map((kpi, idx) => (
          <motion.div
            key={idx}
            variants={cardVariants}
            whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
            className="cursor-pointer"
          >
            <Card className="border border-[#E2E8F0] shadow-card hover:shadow-card-hover transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <p className="text-caption text-text-secondary">{kpi.label}</p>
                    <p className="text-[28px] font-bold text-text-primary font-mono tracking-tight">
                      {kpi.value}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {kpi.isPercentage ? (
                        <span className="text-caption font-medium text-success">
                          {kpi.trend}
                        </span>
                      ) : (
                        <>
                          {kpi.trendUp ? (
                            <TrendingUp size={14} className="text-success" />
                          ) : (
                            <TrendingDown size={14} className="text-danger" />
                          )}
                          <span className={`text-caption font-medium ${kpi.trendUp ? 'text-success' : 'text-danger'}`}>
                            {kpi.trend}
                          </span>
                        </>
                      )}
                      {!kpi.isPercentage && (
                        <span className="text-caption text-text-muted">edelliseen kk</span>
                      )}
                    </div>
                    <p className="text-[11px] text-text-muted">{kpi.sublabel}</p>
                  </div>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: kpi.iconBg }}
                  >
                    <kpi.icon size={20} style={{ color: kpi.iconColor }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* ─── Charts Row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Revenue Chart */}
        <motion.div
          variants={slideLeftVariants}
          initial="hidden"
          animate="visible"
          className="lg:col-span-3"
        >
          <Card className="border border-[#E2E8F0] shadow-card h-full">
            <CardHeader className="px-5 py-4 pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-h3 text-text-primary">Tulokehitys</CardTitle>
              <select className="text-xs border border-[#E2E8F0] rounded-md px-2 py-1 bg-white text-text-secondary focus:outline-none focus:border-primary">
                <option>Viimeiset 6 kk</option>
                <option>3 kk</option>
                <option>12 kk</option>
                <option>Tämä vuosi</option>
              </select>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F97316" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#F97316" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="marginGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22C55E" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#22C55E" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#F97316"
                      strokeWidth={2.5}
                      fill="url(#revenueGrad)"
                      dot={{ r: 4, fill: '#F97316', strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: '#F97316', strokeWidth: 2, stroke: '#FFF' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="margin"
                      stroke="#22C55E"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      fill="url(#marginGrad)"
                      dot={{ r: 3, fill: '#22C55E', strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {/* Summary Stats */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#F1F5F9]">
                <div>
                  <p className="text-[11px] text-text-muted">Kokonaistulot</p>
                  <p className="text-sm font-semibold text-text-primary font-mono">753 900 €</p>
                </div>
                <div>
                  <p className="text-[11px] text-text-muted">Keskiarvo/kk</p>
                  <p className="text-sm font-semibold text-text-primary font-mono">125 650 €</p>
                </div>
                <div>
                  <p className="text-[11px] text-text-muted">Tavoite</p>
                  <p className="text-sm font-semibold text-success">87%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Project Status Donut */}
        <motion.div
          variants={slideRightVariants}
          initial="hidden"
          animate="visible"
          className="lg:col-span-2"
        >
          <Card className="border border-[#E2E8F0] shadow-card h-full">
            <CardHeader className="px-5 py-4 pb-2">
              <CardTitle className="text-h3 text-text-primary">Projektien tila</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="flex items-center gap-4">
                <div className="w-[140px] h-[140px] flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={['Aktiivinen', 'Suunniteltu', 'Valmis', 'Myöhässä']
                          .map(s => ({ name: s, value: projects.filter(p => p.status === s).length, color: STATUS_COLORS[s] }))
                          .filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={65}
                        paddingAngle={2}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {['Aktiivinen', 'Suunniteltu', 'Valmis', 'Myöhässä']
                          .map(s => ({ name: s, value: projects.filter(p => p.status === s).length, color: STATUS_COLORS[s] }))
                          .filter(d => d.value > 0)
                          .map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [`${value} projektia`, name]}
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid #E2E8F0',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          fontSize: '12px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Center Text */}
                <div className="absolute ml-[44px] mt-0 text-center">
                  <p className="text-2xl font-bold text-text-primary font-mono">{totalProjects}</p>
                  <p className="text-[10px] text-text-muted">projektia</p>
                </div>
                {/* Legend */}
                <div className="flex flex-col gap-2 ml-4">
                  {['Aktiivinen', 'Suunniteltu', 'Valmis', 'Myöhässä'].map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
                      <span className="text-xs text-text-secondary">{s}</span>
                      <span className="text-xs font-semibold text-text-primary font-mono ml-auto">{projects.filter(p => p.status === s).length}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Project Progress List */}
              <div className="mt-5 pt-4 border-t border-[#F1F5F9] space-y-3">
                {projects.filter(p => p.status === 'Aktiivinen').slice(0, 4).map((proj, idx) => (
                  <motion.div
                    key={proj.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 + idx * 0.1 }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-text-primary">{proj.name}</span>
                      <span className="text-xs font-mono text-text-secondary">{proj.progress}%</span>
                    </div>
                    <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[proj.status] || '#F97316' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${proj.progress}%` }}
                        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] as [number, number, number, number], delay: 0.5 + idx * 0.1 }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ─── Bottom Row: Quick Actions + Urgent Work Orders ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card className="border border-[#E2E8F0] shadow-card h-full">
            <CardHeader className="px-5 py-4 pb-2">
              <CardTitle className="text-h3 text-text-primary">Pikatoiminnot</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="grid grid-cols-3 gap-3">
                {quickActions.map((action, idx) => (
                  <motion.button
                    key={idx}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(action.path)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[#E2E8F0] hover:shadow-md transition-shadow bg-white"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${action.color}15` }}
                    >
                      <action.icon size={20} style={{ color: action.color }} />
                    </div>
                    <span className="text-xs font-medium text-text-primary text-center">{action.label}</span>
                  </motion.button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Urgent Work Orders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
        >
          <Card className="border border-[#E2E8F0] shadow-card h-full">
            <CardHeader className="px-5 py-4 pb-2 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-h3 text-text-primary">Kiireelliset työmääräykset</CardTitle>
                <Badge className="bg-danger text-white text-[10px] px-1.5 py-0.5">{workOrders.filter(wo => wo.priority === 'Korkea' || wo.status === 'Käynnissä').length}</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-primary h-7 px-2"
                onClick={() => navigate('/tyomaaraykset')}
              >
                Näytä kaikki <ChevronRight size={12} />
              </Button>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3">
              {workOrders.filter(wo => wo.priority === 'Korkea' || wo.status === 'Käynnissä').slice(0, 5).map((order, idx) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + idx * 0.1, duration: 0.25 }}
                  className="flex items-center gap-3 p-3 rounded-lg border border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors group cursor-pointer"
                  onClick={() => navigate('/tyomaaraykset')}
                >
                  <div
                    className="w-1 self-stretch rounded-full flex-shrink-0"
                    style={{ backgroundColor: order.priority === 'Korkea' ? '#EF4444' : '#F59E0B' }}
                  />
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: order.priority === 'Korkea' ? '#FEE2E2' : '#FEF3C7' }}
                  >
                    <AlertTriangle size={18} style={{ color: order.priority === 'Korkea' ? '#EF4444' : '#F59E0B' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{order.title}</p>
                    <p className="text-[11px] text-text-muted">{order.project} · {order.assignee}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-[10px] border-0"
                      style={{
                        backgroundColor: order.priority === 'Korkea' ? '#FEE2E2' : '#FEF3C7',
                        color: order.priority === 'Korkea' ? '#DC2626' : '#D97706',
                      }}
                    >
                      {order.status}
                    </Badge>
                    <ChevronRight size={14} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ─── Recent Activity Feed ─── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.5 }}
      >
        <Card className="border border-[#E2E8F0] shadow-card">
          <CardHeader className="px-5 py-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-h3 text-text-primary">Tuoreet tapahtumat</CardTitle>
            <select className="text-xs border border-[#E2E8F0] rounded-md px-2 py-1 bg-white text-text-secondary focus:outline-none focus:border-primary">
              <option>Kaikki</option>
              <option>Työmääräykset</option>
              <option>Tunnit</option>
              <option>Turvallisuus</option>
              <option>Projektit</option>
            </select>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="space-y-1">
              {recentActivities.map((activity, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + idx * 0.05, duration: 0.2 }}
                  className="flex items-center gap-4 py-2.5 px-3 rounded-lg hover:bg-[#F8FAFC] transition-colors cursor-pointer group"
                >
                  {/* Time */}
                  <span className="text-xs text-text-muted w-12 flex-shrink-0 font-mono">{activity.time}</span>

                  {/* Avatar / Initials */}
                  <div className="w-7 h-7 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-primary">
                      {activity.user === 'Järjestelmä' ? '⚙' : activity.user.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </span>
                  </div>

                  {/* Action */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-text-primary">
                      <span className="font-medium">{activity.user}</span>{' '}
                      <span className="text-text-secondary">{activity.action}</span>
                    </span>
                  </div>

                  {/* Module Badge */}
                  <Badge
                    variant="outline"
                    className="text-[10px] flex-shrink-0 border-0"
                    style={{
                      backgroundColor: `${activity.moduleColor}15`,
                      color: activity.moduleColor,
                    }}
                  >
                    {activity.module}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
