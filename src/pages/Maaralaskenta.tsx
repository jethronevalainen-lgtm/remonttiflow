import { useState } from 'react';
import { motion } from 'framer-motion';
import { Ruler, ChevronDown, ChevronUp, Plus, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const quantityData = [
  {
    category: 'Perustukset',
    items: [
      { work: 'Maankaivu', quantity: 450, unit: 'm³', price: 35, total: 15750 },
      { work: 'Betonivalu', quantity: 320, unit: 'm³', price: 180, total: 57600 },
      { work: 'Raudoitus', quantity: 8500, unit: 'kg', price: 2.5, total: 21250 },
    ],
  },
  {
    category: 'Väliseinät',
    items: [
      { work: 'Harkkomuuraukset', quantity: 850, unit: 'm²', price: 65, total: 55250 },
      { work: 'Kipsilevyt', quantity: 1200, unit: 'm²', price: 28, total: 33600 },
      { work: 'Oviaukkojen teko', quantity: 45, unit: 'kpl', price: 350, total: 15750 },
    ],
  },
  {
    category: 'Pinnat',
    items: [
      { work: 'Laatoitus', quantity: 650, unit: 'm²', price: 75, total: 48750 },
      { work: 'Parketointi', quantity: 480, unit: 'm²', price: 55, total: 26400 },
      { work: 'Maalaustyöt', quantity: 2100, unit: 'm²', price: 22, total: 46200 },
    ],
  },
  {
    category: 'LVI',
    items: [
      { work: 'Putkiasennus', quantity: 1200, unit: 'm', price: 45, total: 54000 },
      { work: 'Lämmitysjärjestelmä', quantity: 450, unit: 'm²', price: 85, total: 38250 },
      { work: 'Viemäröinti', quantity: 380, unit: 'm', price: 55, total: 20900 },
    ],
  },
  {
    category: 'Sähkö',
    items: [
      { work: 'Kaapelointi', quantity: 2500, unit: 'm', price: 12, total: 30000 },
      { work: 'Pistorasiat', quantity: 180, unit: 'kpl', price: 85, total: 15300 },
      { work: 'Valaistus', quantity: 95, unit: 'kpl', price: 220, total: 20900 },
    ],
  },
];

export default function Maaralaskenta() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (name: string) => setExpanded(prev => ({ ...prev, [name]: !prev[name] }));

  const grandTotal = quantityData.reduce((sum, cat) => sum + cat.items.reduce((s, item) => s + item.total, 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Määrälaskenta</h1>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-1.5"><Download size={16} /> Vie Excel</Button>
          <Button className="gap-1.5 bg-primary hover:bg-primary-hover text-white"><Plus size={16} /> Lisää rivi</Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {quantityData.map(cat => {
          const catTotal = cat.items.reduce((sum, item) => sum + item.total, 0);
          return (
            <Card key={cat.category}>
              <CardContent className="p-4">
                <p className="text-sm text-text-muted">{cat.category}</p>
                <p className="text-lg font-bold text-text-primary">{new Intl.NumberFormat('fi-FI').format(catTotal)} €</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Categories */}
      <div className="space-y-3">
        {quantityData.map((cat, idx) => {
          const catTotal = cat.items.reduce((sum, item) => sum + item.total, 0);
          const isOpen = expanded[cat.category] ?? true;
          return (
            <motion.div key={cat.category} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
              <Card>
                <CardHeader className="py-3 cursor-pointer" onClick={() => toggle(cat.category)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Ruler size={18} className="text-primary" />
                      <CardTitle className="text-base">{cat.category}</CardTitle>
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
                          <th className="pb-2 font-medium">Työ</th>
                          <th className="pb-2 font-medium text-right">Määrä</th>
                          <th className="pb-2 font-medium">Yks.</th>
                          <th className="pb-2 font-medium text-right">Yks. hinta</th>
                          <th className="pb-2 font-medium text-right">Yhteensä</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cat.items.map((item, i) => (
                          <tr key={i} className="border-b border-[#F1F5F9]">
                            <td className="py-2 text-text-primary">{item.work}</td>
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

      <Card className="bg-primary-light border-primary">
        <CardContent className="p-4 flex items-center justify-between">
          <span className="font-semibold text-primary">Kokonaissumma</span>
          <span className="text-2xl font-bold text-primary">{new Intl.NumberFormat('fi-FI').format(grandTotal)} €</span>
        </CardContent>
      </Card>
    </div>
  );
}
