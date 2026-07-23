import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calculator, ChevronDown, ChevronUp, Plus, Euro } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const costCategories = [
  {
    name: 'Työkustannukset',
    items: [
      { description: 'Rakennustyöntekijät', quantity: 1200, unit: 'h', price: 45, total: 54000 },
      { description: 'LVI-asentajat', quantity: 450, unit: 'h', price: 52, total: 23400 },
      { description: 'Sähköasentajat', quantity: 380, unit: 'h', price: 50, total: 19000 },
      { description: 'Työnjohto', quantity: 200, unit: 'h', price: 65, total: 13000 },
    ],
  },
  {
    name: 'Materiaalikustannukset',
    items: [
      { description: 'Betonielementit', quantity: 150, unit: 'm²', price: 180, total: 27000 },
      { description: 'Eristysmateriaalit', quantity: 500, unit: 'm²', price: 25, total: 12500 },
      { description: 'LVI-tarvikkeet', quantity: 1, unit: 'erä', price: 35000, total: 35000 },
      { description: 'Sähkötarvikkeet', quantity: 1, unit: 'erä', price: 22000, total: 22000 },
    ],
  },
  {
    name: 'Kalustokustannukset',
    items: [
      { description: 'Kaivinkonevuokra', quantity: 45, unit: 'pv', price: 850, total: 38250 },
      { description: 'Nosturivuokra', quantity: 30, unit: 'pv', price: 1200, total: 36000 },
      { description: 'Telineet', quantity: 800, unit: 'm²', price: 15, total: 12000 },
    ],
  },
  {
    name: 'Kuljetuskustannukset',
    items: [
      { description: 'Materiaalikuljetukset', quantity: 25, unit: 'ajo', price: 450, total: 11250 },
      { description: 'Jätekuljetukset', quantity: 15, unit: 'ajo', price: 350, total: 5250 },
    ],
  },
  {
    name: 'Muut kustannukset',
    items: [
      { description: 'Vakuutukset', quantity: 1, unit: 'kpl', price: 8500, total: 8500 },
      { description: 'Luvat ja maksut', quantity: 1, unit: 'kpl', price: 12000, total: 12000 },
      { description: 'Yllättävät kustannukset (10%)', quantity: 1, unit: 'kpl', price: 33150, total: 33150 },
    ],
  },
];

const COLORS = ['#F97316', '#3B82F6', '#22C55E', '#F59E0B', '#8B5CF6'];

export default function Laskenta() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (name: string) => setExpanded(prev => ({ ...prev, [name]: !prev[name] }));

  const categoryTotals = costCategories.map(cat => ({
    name: cat.name,
    value: cat.items.reduce((sum, item) => sum + item.total, 0),
  }));
  const grandTotal = categoryTotals.reduce((sum, cat) => sum + cat.value, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Laskenta</h1>
        <Button className="gap-1.5 bg-primary hover:bg-primary-hover text-white">
          <Plus size={16} /> Lisää kustannus
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
              <Euro size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-sm text-text-muted">Kokonaiskustannukset</p>
              <p className="text-xl font-bold text-text-primary">{new Intl.NumberFormat('fi-FI').format(grandTotal)} €</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-info-light flex items-center justify-center">
              <Calculator size={20} className="text-info" />
            </div>
            <div>
              <p className="text-sm text-text-muted">Kustannuslajit</p>
              <p className="text-xl font-bold text-text-primary">{costCategories.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={60}>
              <PieChart>
                <Pie data={categoryTotals} cx="50%" cy="50%" outerRadius={28} dataKey="value" strokeWidth={0}>
                  {categoryTotals.map((_, idx) => <Cell key={idx} fill={COLORS[idx]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Cost Categories */}
      <div className="space-y-3">
        {costCategories.map((cat, catIdx) => {
          const catTotal = cat.items.reduce((sum, item) => sum + item.total, 0);
          const isOpen = expanded[cat.name];
          return (
            <motion.div key={cat.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: catIdx * 0.05 }}>
              <Card>
                <CardHeader className="py-3 cursor-pointer" onClick={() => toggle(cat.name)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[catIdx] }} />
                      <CardTitle className="text-base">{cat.name}</CardTitle>
                      <Badge variant="outline">{cat.items.length} riviä</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-text-primary">{new Intl.NumberFormat('fi-FI').format(catTotal)} €</span>
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </CardHeader>
                {isOpen && (
                  <CardContent className="pt-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-text-muted border-b border-[#E2E8F0]">
                          <th className="pb-2 font-medium">Kustannus</th>
                          <th className="pb-2 font-medium text-right">Määrä</th>
                          <th className="pb-2 font-medium">Yks.</th>
                          <th className="pb-2 font-medium text-right">Hinta</th>
                          <th className="pb-2 font-medium text-right">Yhteensä</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cat.items.map((item, i) => (
                          <tr key={i} className="border-b border-[#F1F5F9]">
                            <td className="py-2 text-text-primary">{item.description}</td>
                            <td className="py-2 text-right font-mono">{item.quantity}</td>
                            <td className="py-2 text-text-muted">{item.unit}</td>
                            <td className="py-2 text-right font-mono">{item.price} €</td>
                            <td className="py-2 text-right font-mono font-medium">{new Intl.NumberFormat('fi-FI').format(item.total)} €</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Grand Total */}
      <Card className="bg-primary-light border-primary">
        <CardContent className="p-4 flex items-center justify-between">
          <span className="font-semibold text-primary">Kokonaissumma</span>
          <span className="text-2xl font-bold text-primary">{new Intl.NumberFormat('fi-FI').format(grandTotal)} €</span>
        </CardContent>
      </Card>
    </div>
  );
}
