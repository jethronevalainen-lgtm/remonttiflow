import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Calculator,
  ChevronRight,
  Plus,
  Trash2,
  PieChart as PieIcon,
  Euro,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, Legend } from 'recharts';

/* ─── Mock Data ─── */
const costCategories = [
  {
    name: 'Työkustannukset',
    items: [
      { id: 1, desc: 'Työvoima (yleinen)', quantity: 1200, unit: 'h', unitPrice: 48, total: 57600 },
      { id: 2, desc: 'Työnjohto', quantity: 320, unit: 'h', unitPrice: 72, total: 23040 },
      { id: 3, desc: 'Erikoistyöntekijät', quantity: 180, unit: 'h', unitPrice: 65, total: 11700 },
      { id: 4, desc: 'Ylityökorvaukset', quantity: 80, unit: 'h', unitPrice: 72, total: 5760 },
    ],
  },
  {
    name: 'Materiaalikustannukset',
    items: [
      { id: 5, desc: 'Betoni C30', quantity: 85, unit: 'm³', unitPrice: 125, total: 10625 },
      { id: 6, desc: 'Teräkset B500B', quantity: 4.5, unit: 'tn', unitPrice: 980, total: 4410 },
      { id: 7, desc: 'Harkot 100mm', quantity: 1200, unit: 'kpl', unitPrice: 2.5, total: 3000 },
      { id: 8, desc: 'Eristysvilla', quantity: 150, unit: 'm²', unitPrice: 18, total: 2700 },
      { id: 9, desc: 'LVI-tarvikkeet', quantity: 1, unit: 'erä', unitPrice: 8500, total: 8500 },
      { id: 10, desc: 'Sähkötarvikkeet', quantity: 1, unit: 'erä', unitPrice: 6200, total: 6200 },
    ],
  },
  {
    name: 'Kalustokustannukset',
    items: [
      { id: 11, desc: 'Nosturi', quantity: 45, unit: 'pv', unitPrice: 450, total: 20250 },
      { id: 12, desc: 'Telineet', quantity: 120, unit: 'm²', unitPrice: 12, total: 1440 },
      { id: 13, desc: 'Muottimateriaali', quantity: 300, unit: 'm²', unitPrice: 15, total: 4500 },
    ],
  },
  {
    name: 'Kuljetuskustannukset',
    items: [
      { id: 14, desc: 'Materiaalikuljetukset', quantity: 25, unit: 'kpl', unitPrice: 180, total: 4500 },
      { id: 15, desc: 'Jätekuljetukset', quantity: 12, unit: 'kpl', unitPrice: 320, total: 3840 },
    ],
  },
  {
    name: 'Muut kustannukset',
    items: [
      { id: 16, desc: 'Yleiskustannukset (8%)', quantity: 1, unit: 'erä', unitPrice: 11220, total: 11220 },
      { id: 17, desc: 'Vakuutukset', quantity: 1, unit: 'erä', unitPrice: 2800, total: 2800 },
      { id: 18, desc: 'Luvat ja maksut', quantity: 1, unit: 'erä', unitPrice: 3500, total: 3500 },
    ],
  },
];

const COLORS = ['#F97316', '#3B82F6', '#22C55E', '#F59E0B', '#8B5CF6'];

/* ─── Animation ─── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
};

/* ─── Component ─── */
export default function Laskenta() {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(
    Object.fromEntries(costCategories.map(c => [c.name, true]))
  );

  const toggleCategory = (name: string) => {
    setExpandedCategories(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const categoryTotals = costCategories.map(cat => ({
    name: cat.name,
    value: cat.items.reduce((sum, item) => sum + item.total, 0),
  }));

  const grandTotal = categoryTotals.reduce((sum, cat) => sum + cat.value, 0);

  const pieData = categoryTotals.map((cat, i) => ({
    name: cat.name,
    value: cat.value,
    color: COLORS[i % COLORS.length],
  }));

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
            <span className="text-text-primary font-medium">Laskenta</span>
          </div>
          <h1 className="text-hero text-text-primary">Laskenta</h1>
          <p className="text-body-sm text-text-secondary mt-1">Kustannuslaskenta ja arviot</p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="bg-primary hover:bg-primary-hover text-white gap-2">
            <Plus size={16} /> Uusi kustannus
          </Button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Kokonaissumma', value: `€${grandTotal.toLocaleString('fi-FI')}`, icon: Euro, color: 'text-primary', bg: 'bg-primary-light' },
          { label: 'Työkustannukset', value: `€${categoryTotals[0].value.toLocaleString('fi-FI')}`, icon: Calculator, color: 'text-success', bg: 'bg-success-light' },
          { label: 'Materiaalit', value: `€${categoryTotals[1].value.toLocaleString('fi-FI')}`, icon: Calculator, color: 'text-info', bg: 'bg-info-light' },
          { label: 'Kalusto', value: `€${categoryTotals[2].value.toLocaleString('fi-FI')}`, icon: Calculator, color: 'text-warning', bg: 'bg-warning-light' },
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
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── Main Content: Table + Chart ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cost Table */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border border-[#E2E8F0] shadow-card overflow-hidden">
            <CardHeader>
              <CardTitle className="text-h2 text-text-primary flex items-center gap-2">
                <Calculator size={20} className="text-primary" />
                Kustannuslaskelma
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {/* Table Header */}
                <div className="grid grid-cols-[1fr_80px_60px_100px_100px_60px] gap-2 px-6 py-3 bg-bg-light border-b border-[#E2E8F0] text-caption text-text-muted uppercase tracking-wider font-semibold">
                  <span>Kustannuslaji</span>
                  <span className="text-right">Määrä</span>
                  <span className="text-right">Yks.</span>
                  <span className="text-right">Yks. hinta</span>
                  <span className="text-right">Yhteensä</span>
                  <span></span>
                </div>

                {costCategories.map((category, ci) => {
                  const catTotal = category.items.reduce((sum, item) => sum + item.total, 0);
                  const isOpen = expandedCategories[category.name];
                  return (
                    <div key={category.name}>
                      {/* Category Header */}
                      <button
                        onClick={() => toggleCategory(category.name)}
                        className="w-full grid grid-cols-[1fr_80px_60px_100px_100px_60px] gap-2 px-6 py-3 bg-[#FAFBFC] border-b border-[#F1F5F9] hover:bg-bg-light transition-colors items-center"
                      >
                        <span className="text-sm font-semibold text-text-primary text-left flex items-center gap-2">
                          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[ci % COLORS.length] }} />
                          {category.name}
                        </span>
                        <span className="text-right text-mono text-body-sm text-text-secondary">{category.items.length} kpl</span>
                        <span></span>
                        <span></span>
                        <span className="text-right text-mono text-sm font-semibold text-text-primary">€{catTotal.toLocaleString('fi-FI')}</span>
                        <span className="text-right text-caption text-text-muted">{isOpen ? '▼' : '▶'}</span>
                      </button>

                      {/* Items */}
                      {isOpen && category.items.map(item => (
                        <motion.div
                          key={item.id}
                          variants={rowVariants}
                          className="grid grid-cols-[1fr_80px_60px_100px_100px_60px] gap-2 px-6 py-2.5 border-b border-[#F1F5F9] hover:bg-bg-light transition-colors items-center"
                        >
                          <span className="text-sm text-text-primary pl-5">{item.desc}</span>
                          <span className="text-right text-mono text-body-sm text-text-primary">{item.quantity}</span>
                          <span className="text-right text-body-sm text-text-secondary">{item.unit}</span>
                          <span className="text-right text-mono text-body-sm text-text-primary">€{item.unitPrice.toLocaleString('fi-FI')}</span>
                          <span className="text-right text-mono text-sm font-medium text-text-primary">€{item.total.toLocaleString('fi-FI')}</span>
                          <div className="flex justify-end">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-text-muted hover:text-danger">
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  );
                })}

                {/* Grand Total */}
                <div className="grid grid-cols-[1fr_80px_60px_100px_100px_60px] gap-2 px-6 py-4 bg-primary-light border-t border-primary">
                  <span className="text-sm font-bold text-primary">YHTEENSÄ</span>
                  <span></span>
                  <span></span>
                  <span></span>
                  <span className="text-right text-mono text-base font-bold text-primary">€{grandTotal.toLocaleString('fi-FI')}</span>
                  <span></span>
                </div>
              </motion.div>
            </CardContent>
          </Card>
        </div>

        {/* Pie Chart */}
        <div className="space-y-4">
          <Card className="border border-[#E2E8F0] shadow-card">
            <CardHeader>
              <CardTitle className="text-h3 text-text-primary flex items-center gap-2">
                <PieIcon size={18} className="text-primary" />
                Kustannusrakenne
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ReTooltip
                    formatter={(value: number) => [`€${value.toLocaleString('fi-FI')}`, '']}
                    contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value: string) => <span className="text-body-sm text-text-secondary">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Percentage Breakdown */}
              <div className="mt-4 space-y-2">
                {categoryTotals.map((cat, i) => {
                  const pct = ((cat.value / grandTotal) * 100).toFixed(1);
                  return (
                    <div key={cat.name}>
                      <div className="flex items-center justify-between text-body-sm mb-1">
                        <span className="text-text-secondary flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          {cat.name}
                        </span>
                        <span className="text-mono text-text-primary font-medium">{pct}%</span>
                      </div>
                      <Progress value={parseFloat(pct)} className="h-1.5" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
