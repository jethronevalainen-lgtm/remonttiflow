import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Ruler,
  Plus,
  Search,
  Calculator,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const quantityItems = [
  { id: '1', name: 'Betonilattia', unit: 'm²', quantity: 245, unitPrice: 45, total: 11025, project: 'Rivitalo A' },
  { id: '2', name: 'Laatoitus', unit: 'm²', quantity: 180, unitPrice: 65, total: 11700, project: 'Kerrostalo B' },
  { id: '3', name: 'Putkiasennus', unit: 'm', quantity: 320, unitPrice: 85, total: 27200, project: 'Rivitalo A' },
  { id: '4', name: 'Sähköasennus', unit: 'kpl', quantity: 45, unitPrice: 120, total: 5400, project: 'Rivitalo D' },
  { id: '5', name: 'Maalaus', unit: 'm²', quantity: 520, unitPrice: 25, total: 13000, project: 'Toimisto C' },
  { id: '6', name: 'Eristys', unit: 'm²', quantity: 310, unitPrice: 35, total: 10850, project: 'Rivitalo A' },
];

export default function Maaralaskenta() {
  const [searchTerm, setSearchTerm] = useState('');
  const filtered = quantityItems.filter(i =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.project.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const grandTotal = quantityItems.reduce((s, i) => s + i.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Määrälaskenta</h1>
          <p className="text-gray-500 mt-1">Urakkamäärät ja yksikköhinnat</p>
        </div>
        <Button className="flex items-center gap-2 bg-primary hover:bg-primary-hover">
          <Plus className="w-4 h-4" /> Lisää määrä
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">Rivejä</p>
              <p className="text-2xl font-bold">{quantityItems.length}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">Yhteensä</p>
              <p className="text-2xl font-bold text-primary">{grandTotal.toLocaleString('fi-FI')} €</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Hae..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-700">
            <div className="col-span-3">Nimi</div>
            <div className="col-span-2">Projekti</div>
            <div className="col-span-2">Määrä</div>
            <div className="col-span-2">Yks.hinta</div>
            <div className="col-span-3 text-right">Yhteensä</div>
          </div>
          {filtered.map(item => (
            <div key={item.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors items-center">
              <div className="col-span-3 font-medium text-sm">{item.name}</div>
              <div className="col-span-2 text-sm text-gray-600">{item.project}</div>
              <div className="col-span-2 text-sm">{item.quantity} {item.unit}</div>
              <div className="col-span-2 text-sm">{item.unitPrice.toLocaleString('fi-FI')} €/{item.unit}</div>
              <div className="col-span-3 text-right font-medium">{item.total.toLocaleString('fi-FI')} €</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
