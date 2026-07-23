import { motion } from 'framer-motion';
import {
  Trash2,
  ChevronRight,
  Plus,
  Recycle,
  AlertTriangle,
  Leaf,
  Factory,
  CheckCircle2,
  XCircle,
  Download,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, Legend } from 'recharts';

/* ─── Mock Data ─── */
const wasteStats = {
  recycled: 4520,
  landfill: 1840,
  hazardous: 320,
  total: 6680,
  recycledTrend: +12,
  landfillTrend: -8,
  hazardousTrend: +3,
};

const wasteLogEntries = [
  { id: 1, date: '23.6.2025', project: 'Tampere, Hatanpää', type: 'Sekajäte', amount: 450, method: 'Lajittelu', cost: 180, typeColor: 'gray' as const },
  { id: 2, date: '22.6.2025', project: 'Espoo, Suurpelto', type: 'Puu', amount: 890, method: 'Kierrätys', cost: 0, typeColor: 'brown' as const },
  { id: 3, date: '21.6.2025', project: 'Tampere, Hatanpää', type: 'Metalli', amount: 320, method: 'Kierrätys', cost: 0, typeColor: 'silver' as const },
  { id: 4, date: '20.6.2025', project: 'Helsinki, Kruununhaka', type: 'Betoni', amount: 1200, method: 'Murskaus', cost: 240, typeColor: 'darkgray' as const },
  { id: 5, date: '19.6.2025', project: 'Espoo, Suurpelto', type: 'Maalijäte', amount: 45, method: 'Vaarallinen', cost: 320, typeColor: 'orange' as const },
  { id: 6, date: '18.6.2025', project: 'Vantaa, Tikkurila', type: 'Sekajäte', amount: 380, method: 'Kaatopaikka', cost: 290, typeColor: 'gray' as const },
  { id: 7, date: '17.6.2025', project: 'Tampere, Hatanpää', type: 'Asbesti', amount: 15, method: 'Vaarallinen', cost: 850, typeColor: 'red' as const },
  { id: 8, date: '16.6.2025', project: 'Helsinki, Kruununhaka', type: 'Puu', amount: 670, method: 'Kierrätys', cost: 0, typeColor: 'brown' as const },
];

const chartData = [
  { type: 'Sekajäte', amount: 830, kierrätys: 450, kaatopaikka: 380 },
  { type: 'Puu', amount: 1560, kierrätys: 1560, kaatopaikka: 0 },
  { type: 'Metalli', amount: 320, kierrätys: 320, kaatopaikka: 0 },
  { type: 'Betoni', amount: 1200, kierrätys: 1200, kaatopaikka: 0 },
  { type: 'Maalijäte', amount: 45, kierrätys: 0, kaatopaikka: 45 },
  { type: 'Asbesti', amount: 15, kierrätys: 0, kaatopaikka: 15 },
  { type: 'Sähkölaitteet', amount: 120, kierrätys: 120, kaatopaikka: 0 },
];

const complianceItems = [
  { label: 'Jäteselvitys ajantasalla', status: true },
  { label: 'Vaaralliset jätteet kirjattu', status: true },
  { label: 'Kierrätysaste > 60%', status: true },
  { label: 'Kuukausiraportti lähetetty', status: false },
  { label: 'Jätehuoltosuunnitelma hyväksytty', status: true },
  { label: 'SER-jätteet eroteltu', status: true },
];

/* ─── Waste Type Badge ─── */
const getWasteTypeBadge = (type: string, color: string) => {
  const colorClasses: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-700',
    brown: 'bg-amber-100 text-amber-800',
    silver: 'bg-slate-200 text-slate-700',
    darkgray: 'bg-stone-200 text-stone-700',
    orange: 'bg-orange-100 text-orange-700',
    red: 'bg-red-100 text-red-700',
  };
  return <Badge className={cn('border-0', colorClasses[color] || 'bg-gray-100 text-gray-700')}>{type}</Badge>;
};

const getMethodBadge = (method: string) => {
  switch (method) {
    case 'Kierrätys': return <Badge className="bg-success-light text-success border-0">{method}</Badge>;
    case 'Lajittelu': return <Badge className="bg-info-light text-info border-0">{method}</Badge>;
    case 'Murskaus': return <Badge className="bg-warning-light text-warning border-0">{method}</Badge>;
    case 'Kaatopaikka': return <Badge className="bg-bg-light text-text-secondary border border-[#E2E8F0]">{method}</Badge>;
    case 'Vaarallinen': return <Badge className="bg-danger-light text-danger border-0">{method}</Badge>;
    default: return <Badge variant="secondary">{method}</Badge>;
  }
};

/* ─── Animation ─── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
};

/* ─── Component ─── */
export default function Jatehuolto() {
  const recyclingRate = Math.round((wasteStats.recycled / wasteStats.total) * 100);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
      className="space-y-6"
    >
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-body-sm text-text-secondary mb-1">
            <span>Dashboard</span>
            <ChevronRight size={14} />
            <span>Projektit</span>
            <ChevronRight size={14} />
            <span className="text-text-primary font-medium">Jätehuolto</span>
          </div>
          <h1 className="text-hero text-text-primary">Jätehuolto</h1>
          <p className="text-body-sm text-text-secondary mt-1">Jätteiden seuranta ja kierrätysraportointi</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Download size={16} /> Vie raportti
          </Button>
          <Button className="bg-primary hover:bg-primary-hover text-white gap-2">
            <Plus size={16} /> Lisää jätekuorma
          </Button>
        </div>
      </div>

      {/* ── Waste Stats Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Kierrätetty',
            value: `${wasteStats.recycled.toLocaleString('fi-FI')} kg`,
            trend: wasteStats.recycledTrend,
            icon: Recycle,
            color: 'text-success',
            bg: 'bg-success-light',
            barColor: '#22C55E',
          },
          {
            label: 'Kaatopaikalle',
            value: `${wasteStats.landfill.toLocaleString('fi-FI')} kg`,
            trend: wasteStats.landfillTrend,
            icon: Factory,
            color: 'text-text-secondary',
            bg: 'bg-bg-light',
            barColor: '#94A3B8',
          },
          {
            label: 'Vaarallinen',
            value: `${wasteStats.hazardous.toLocaleString('fi-FI')} kg`,
            trend: wasteStats.hazardousTrend,
            icon: AlertTriangle,
            color: 'text-danger',
            bg: 'bg-danger-light',
            barColor: '#EF4444',
          },
          {
            label: 'Kokonaisjäte',
            value: `${wasteStats.total.toLocaleString('fi-FI')} kg`,
            trend: null,
            icon: Trash2,
            color: 'text-primary',
            bg: 'bg-primary-light',
            barColor: '#F97316',
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06, duration: 0.2 }}
          >
            <Card className="border border-[#E2E8F0] shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-caption text-text-secondary uppercase tracking-wider">{stat.label}</span>
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', stat.bg)}>
                    <stat.icon size={20} className={stat.color} />
                  </div>
                </div>
                <p className="text-[24px] font-bold text-text-primary font-mono leading-none">{stat.value}</p>
                {stat.trend !== null && (
                  <div className="flex items-center gap-1 mt-2">
                    {stat.trend > 0 ? (
                      <TrendingUp size={14} className={stat.trend > 0 && stat.label === 'Kierrätetty' ? 'text-success' : stat.label === 'Vaarallinen' ? 'text-danger' : 'text-warning'} />
                    ) : (
                      <TrendingDown size={14} className="text-success" />
                    )}
                    <span className={cn(
                      'text-body-sm font-medium',
                      stat.trend > 0 ? (stat.label === 'Kierrätetty' ? 'text-success' : stat.label === 'Vaarallinen' ? 'text-danger' : 'text-warning') : 'text-success'
                    )}>
                      {stat.trend > 0 ? '+' : ''}{stat.trend}%
                    </span>
                    <span className="text-caption text-text-muted">vs kk sitten</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── Main Content: Table + Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Waste Log Table */}
        <div className="lg:col-span-2">
          <Card className="border border-[#E2E8F0] shadow-card overflow-hidden">
            <CardHeader>
              <CardTitle className="text-h2 text-text-primary flex items-center gap-2">
                <Trash2 size={20} className="text-primary" />
                Jätekirjaus
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {/* Table Header */}
                <div className="hidden md:grid md:grid-cols-[100px_1fr_120px_80px_100px_100px_80px] gap-4 px-6 py-3 bg-bg-light border-b border-[#E2E8F0] text-caption text-text-muted uppercase tracking-wider font-semibold">
                  <span>Päivämäärä</span>
                  <span>Projekti</span>
                  <span>Jätteen laji</span>
                  <span className="text-right">Määrä (kg)</span>
                  <span>Käsittelytapa</span>
                  <span className="text-right">Kustannus</span>
                  <span></span>
                </div>

                {wasteLogEntries.map(entry => (
                  <motion.div
                    key={entry.id}
                    variants={rowVariants}
                    className="grid grid-cols-1 md:grid-cols-[100px_1fr_120px_80px_100px_100px_80px] gap-2 md:gap-4 px-6 py-3 border-b border-[#F1F5F9] hover:bg-bg-light transition-colors items-center"
                  >
                    <span className="text-body-sm text-text-secondary">{entry.date}</span>
                    <span className="text-sm text-text-primary truncate">{entry.project}</span>
                    <div>{getWasteTypeBadge(entry.type, entry.typeColor)}</div>
                    <span className="text-right text-mono text-body-sm text-text-primary">{entry.amount}</span>
                    <div>{getMethodBadge(entry.method)}</div>
                    <span className="text-right text-mono text-body-sm text-text-primary">€{entry.cost.toLocaleString('fi-FI')}</span>
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-text-muted">
                        <ChevronRight size={14} />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-6 py-3 border-t border-[#E2E8F0] bg-bg-light">
                <span className="text-body-sm text-text-secondary">Näytetään {wasteLogEntries.length} merkintää</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled>Edellinen</Button>
                  <Button variant="outline" size="sm" disabled>Seuraava</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar: Chart + Compliance */}
        <div className="space-y-4">
          {/* Recycling Rate */}
          <Card className="border border-[#E2E8F0] shadow-card">
            <CardHeader>
              <CardTitle className="text-h3 text-text-primary flex items-center gap-2">
                <Leaf size={18} className="text-success" />
                Kierrätysaste
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center mb-4">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#F1F5F9" strokeWidth="10" />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="#22C55E"
                      strokeWidth="10"
                      strokeDasharray={`${(recyclingRate / 100) * 264} 264`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-text-primary font-mono">{recyclingRate}%</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-body-sm">
                <span className="text-text-secondary">Tavoite: 70%</span>
                <span className={cn(
                  'font-medium',
                  recyclingRate >= 60 ? 'text-success' : 'text-warning'
                )}>
                  {recyclingRate >= 60 ? 'Hyvä' : 'Kehitettävää'}
                </span>
              </div>
              <Progress value={recyclingRate} max={70} className="h-2 mt-2" />
            </CardContent>
          </Card>

          {/* Waste Type Breakdown Chart */}
          <Card className="border border-[#E2E8F0] shadow-card">
            <CardHeader>
              <CardTitle className="text-h3 text-text-primary">Jätteen määrä tyypeittäin</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis dataKey="type" type="category" tick={{ fontSize: 11, fill: '#64748B' }} width={80} />
                  <ReTooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="kierrätys" name="Kierrätys" fill="#22C55E" radius={[0, 4, 4, 0]} barSize={12} />
                  <Bar dataKey="kaatopaikka" name="Kaatopaikka" fill="#94A3B8" radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Compliance Status */}
          <Card className="border border-[#E2E8F0] shadow-card">
            <CardHeader>
              <CardTitle className="text-h3 text-text-primary flex items-center gap-2">
                <CheckCircle2 size={18} className="text-success" />
                Vaatimustenmukaisuus
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {complianceItems.map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  {item.status ? (
                    <CheckCircle2 size={18} className="text-success flex-shrink-0" />
                  ) : (
                    <XCircle size={18} className="text-danger flex-shrink-0" />
                  )}
                  <span className={cn(
                    'text-body-sm',
                    item.status ? 'text-text-secondary' : 'text-danger'
                  )}>{item.label}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-[#E2E8F0]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-text-primary">Yhteenveto</span>
                  <Badge className={cn(
                    'border-0',
                    complianceItems.filter(i => i.status).length / complianceItems.length >= 0.8
                      ? 'bg-success-light text-success'
                      : 'bg-warning-light text-warning'
                  )}>
                    {complianceItems.filter(i => i.status).length}/{complianceItems.length} kunnossa
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
