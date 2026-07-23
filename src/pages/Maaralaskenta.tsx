import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Ruler,
  ChevronRight,
  ChevronDown,
  Download,
  Plus,
  Calculator,
  FileSpreadsheet,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

/* ─── Mock Data ─── */
const quantityGroups = [
  {
    name: 'Perustukset',
    items: [
      { id: 1, work: 'Kaivutyöt', quantity: 145, unit: 'm³', unitPrice: 25, total: 3625 },
      { id: 2, work: 'Betonivalu C30', quantity: 85, unit: 'm³', unitPrice: 125, total: 10625 },
      { id: 3, work: 'Terästyöt', quantity: 4.5, unit: 'tn', unitPrice: 1850, total: 8325 },
      { id: 4, work: 'Eristys sokkeli', quantity: 180, unit: 'm²', unitPrice: 22, total: 3960 },
      { id: 5, work: 'Sokkelilaatta', quantity: 220, unit: 'm²', unitPrice: 45, total: 9900 },
    ],
  },
  {
    name: 'Väliseinät ja runko',
    items: [
      { id: 6, work: 'Harkkoseinät 100mm', quantity: 420, unit: 'm²', unitPrice: 65, total: 27300 },
      { id: 7, work: 'Harkkoseinät 200mm', quantity: 580, unit: 'm²', unitPrice: 78, total: 45240 },
      { id: 8, work: 'Palkit ja pilariet', quantity: 12, unit: 'kpl', unitPrice: 850, total: 10200 },
      { id: 9, work: 'Välipohjat', quantity: 320, unit: 'm²', unitPrice: 120, total: 38400 },
      { id: 10, work: 'Portaat (betoni)', quantity: 3, unit: 'kpl', unitPrice: 4500, total: 13500 },
    ],
  },
  {
    name: 'Pinnat',
    items: [
      { id: 11, work: 'Lattiavalut', quantity: 580, unit: 'm²', unitPrice: 35, total: 20300 },
      { id: 12, work: 'Seinämaalaukset', quantity: 1250, unit: 'm²', unitPrice: 18, total: 22500 },
      { id: 13, work: 'Laatoitukset', quantity: 320, unit: 'm²', unitPrice: 55, total: 17600 },
      { id: 14, work: 'Lattiamateriaalit', quantity: 480, unit: 'm²', unitPrice: 42, total: 20160 },
      { id: 15, work: 'Listoitukset', quantity: 890, unit: 'm', unitPrice: 8, total: 7120 },
    ],
  },
  {
    name: 'LVI-työt',
    items: [
      { id: 16, work: 'Vesijohtoasennukset', quantity: 450, unit: 'm', unitPrice: 35, total: 15750 },
      { id: 17, work: 'Viemäriputket', quantity: 380, unit: 'm', unitPrice: 42, total: 15960 },
      { id: 18, work: 'Lämmityspatterit', quantity: 24, unit: 'kpl', unitPrice: 380, total: 9120 },
      { id: 19, work: 'Ilmanvaihto', quantity: 1, unit: 'erä', unitPrice: 18500, total: 18500 },
      { id: 20, work: 'Vesikiertolämmitys', quantity: 480, unit: 'm²', unitPrice: 28, total: 13440 },
    ],
  },
  {
    name: 'Sähkötyöt',
    items: [
      { id: 21, work: 'Sähkökaapelit', quantity: 1200, unit: 'm', unitPrice: 8, total: 9600 },
      { id: 22, work: 'Pistorasiat', quantity: 85, unit: 'kpl', unitPrice: 45, total: 3825 },
      { id: 23, work: 'Valaisimet', quantity: 65, unit: 'kpl', unitPrice: 120, total: 7800 },
      { id: 24, work: 'Sähkökeskus', quantity: 2, unit: 'kpl', unitPrice: 2200, total: 4400 },
      { id: 25, work: 'Tietoverkot', quantity: 85, unit: 'kpl', unitPrice: 65, total: 5525 },
    ],
  },
];

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
export default function Maaralaskenta() {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(quantityGroups.map(g => [g.name, true]))
  );

  const toggleGroup = (name: string) => {
    setExpandedGroups(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const groupTotals = quantityGroups.map(g => ({
    name: g.name,
    total: g.items.reduce((sum, item) => sum + item.total, 0),
    itemCount: g.items.length,
  }));

  const grandTotal = groupTotals.reduce((sum, g) => sum + g.total, 0);

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
            <span className="text-text-primary font-medium">Määrälaskenta</span>
          </div>
          <h1 className="text-hero text-text-primary">Määrälaskenta</h1>
          <p className="text-body-sm text-text-secondary mt-1">Työmäärät ja kustannusarviot rakennusosittain</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Download size={16} /> Vie Excel
          </Button>
          <Button variant="outline" className="gap-2">
            <FileSpreadsheet size={16} /> Vie PDF
          </Button>
          <Button className="bg-primary hover:bg-primary-hover text-white gap-2">
            <Plus size={16} /> Lisää rivi
          </Button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Rakennusosia', value: quantityGroups.length, icon: Ruler, color: 'text-primary', bg: 'bg-primary-light' },
          { label: 'Rivejä yhteensä', value: quantityGroups.reduce((sum, g) => sum + g.items.length, 0), icon: Calculator, color: 'text-success', bg: 'bg-success-light' },
          { label: 'Kokonaissumma', value: `€${(grandTotal / 1000).toFixed(0)}k`, icon: Calculator, color: 'text-info', bg: 'bg-info-light' },
          { label: 'Keskiarvo/rivi', value: `€${(grandTotal / quantityGroups.reduce((sum, g) => sum + g.items.length, 0)).toFixed(0)}`, icon: Calculator, color: 'text-warning', bg: 'bg-warning-light' },
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

      {/* ── Quantity Table ── */}
      <Card className="border border-[#E2E8F0] shadow-card overflow-hidden">
        <CardHeader>
          <CardTitle className="text-h2 text-text-primary flex items-center gap-2">
            <Ruler size={20} className="text-primary" />
            Määräluettelo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_180px_80px_60px_100px_100px_60px] gap-2 px-6 py-3 bg-bg-light border-b border-[#E2E8F0] text-caption text-text-muted uppercase tracking-wider font-semibold">
              <span>Rakennusosa</span>
              <span>Työ</span>
              <span className="text-right">Määrä</span>
              <span className="text-right">Yks.</span>
              <span className="text-right">Yks. hinta</span>
              <span className="text-right">Yhteensä</span>
              <span></span>
            </div>

            {quantityGroups.map((group, gi) => {
              const groupTotal = group.items.reduce((sum, item) => sum + item.total, 0);
              const isOpen = expandedGroups[group.name];
              return (
                <div key={group.name}>
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(group.name)}
                    className="w-full grid grid-cols-[1fr_180px_80px_60px_100px_100px_60px] gap-2 px-6 py-3 border-b border-[#E2E8F0] hover:bg-bg-light transition-colors items-center"
                    style={{ backgroundColor: gi % 2 === 0 ? '#FAFBFC' : '#F8FAFC' }}
                  >
                    <span className="text-sm font-bold text-text-primary text-left flex items-center gap-2">
                      {isOpen ? <ChevronDown size={16} className="text-text-muted" /> : <ChevronRight size={16} className="text-text-muted" />}
                      {group.name}
                    </span>
                    <span className="text-body-sm text-text-muted">{group.items.length} työtä</span>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span className="text-right text-mono text-sm font-bold text-primary">€{groupTotal.toLocaleString('fi-FI')}</span>
                    <span></span>
                  </button>

                  {/* Group Items */}
                  {isOpen && group.items.map(item => (
                    <motion.div
                      key={item.id}
                      variants={rowVariants}
                      className="grid grid-cols-[1fr_180px_80px_60px_100px_100px_60px] gap-2 px-6 py-2.5 border-b border-[#F1F5F9] hover:bg-bg-light transition-colors items-center"
                    >
                      <span></span>
                      <span className="text-sm text-text-primary">{item.work}</span>
                      <span className="text-right text-mono text-body-sm text-text-primary">{item.quantity}</span>
                      <span className="text-right text-body-sm text-text-secondary">{item.unit}</span>
                      <span className="text-right text-mono text-body-sm text-text-primary">€{item.unitPrice.toLocaleString('fi-FI')}</span>
                      <span className="text-right text-mono text-sm font-medium text-text-primary">€{item.total.toLocaleString('fi-FI')}</span>
                      <div className="flex justify-end">
                        <Checkbox className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              );
            })}

            {/* Grand Total */}
            <div className="grid grid-cols-[1fr_180px_80px_60px_100px_100px_60px] gap-2 px-6 py-4 bg-primary-light border-t border-primary">
              <span className="text-sm font-bold text-primary col-span-2">YHTEENSÄ KAIKKI RAKENNUSOSAT</span>
              <span></span>
              <span></span>
              <span></span>
              <span className="text-right text-mono text-base font-bold text-primary">€{grandTotal.toLocaleString('fi-FI')}</span>
              <span></span>
            </div>
          </motion.div>
        </CardContent>
      </Card>

      {/* ── Group Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {groupTotals.map((group, i) => (
          <motion.div
            key={group.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.2 }}
          >
            <Card className="border border-[#E2E8F0] shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
              <CardContent className="p-4">
                <p className="text-caption text-text-muted uppercase tracking-wider mb-1">{group.name}</p>
                <p className="text-lg font-bold text-text-primary font-mono">€{group.total.toLocaleString('fi-FI')}</p>
                <p className="text-body-sm text-text-secondary">{group.itemCount} työtä</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
