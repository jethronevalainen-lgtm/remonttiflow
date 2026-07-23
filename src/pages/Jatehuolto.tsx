import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Trash2,
  Plus,
  Recycle,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TreePine,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const wasteItems = [
  { id: '1', type: 'Seka', amount: 2400, unit: 'kg', project: 'Rivitalo A', date: '15.1.2026', recycled: false },
  { id: '2', type: 'Metalli', amount: 850, unit: 'kg', project: 'Rivitalo A', date: '14.1.2026', recycled: true },
  { id: '3', type: 'Puu', amount: 1200, unit: 'kg', project: 'Kerrostalo B', date: '13.1.2026', recycled: true },
  { id: '4', type: 'Vaarallinen', amount: 45, unit: 'kg', project: 'Rivitalo D', date: '12.1.2026', recycled: false },
  { id: '5', type: 'Betonijäte', amount: 3200, unit: 'kg', project: 'Kerrostalo B', date: '10.1.2026', recycled: true },
  { id: '6', type: 'Seka', amount: 1800, unit: 'kg', project: 'Toimisto C', date: '8.1.2026', recycled: false },
];

const getTypeBadge = (type: string) => {
  switch (type) {
    case 'Vaarallinen': return <Badge className="bg-red-100 text-red-800">Vaarallinen</Badge>;
    case 'Metalli': return <Badge className="bg-blue-100 text-blue-800">Metalli</Badge>;
    case 'Puu': return <Badge className="bg-amber-100 text-amber-800">Puu</Badge>;
    case 'Betonijäte': return <Badge className="bg-gray-100 text-gray-800">Betonijäte</Badge>;
    default: return <Badge variant="outline">Seka</Badge>;
  }
};

export default function Jatehuolto() {
  const totalWaste = wasteItems.reduce((s, w) => s + w.amount, 0);
  const recycledWaste = wasteItems.filter(w => w.recycled).reduce((s, w) => s + w.amount, 0);
  const recycleRate = Math.round((recycledWaste / totalWaste) * 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jätehuolto</h1>
          <p className="text-gray-500 mt-1">Jätteiden seuranta ja kierrätys</p>
        </div>
        <Button className="flex items-center gap-2 bg-primary hover:bg-primary-hover">
          <Plus className="w-4 h-4" /> Kirjaa jäte
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-4">
              <Trash2 className="w-8 h-8 text-gray-400 mb-2" />
              <p className="text-sm text-gray-500">Jätettä yht.</p>
              <p className="text-2xl font-bold">{(totalWaste / 1000).toFixed(1)} t</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="p-4">
              <Recycle className="w-8 h-8 text-green-500 mb-2" />
              <p className="text-sm text-gray-500">Kierrätetty</p>
              <p className="text-2xl font-bold text-green-600">{(recycledWaste / 1000).toFixed(1)} t</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="p-4">
              <TreePine className="w-8 h-8 text-primary mb-2" />
              <p className="text-sm text-gray-500">Kierrätysaste</p>
              <p className="text-2xl font-bold text-primary">{recycleRate}%</p>
              <Progress value={recycleRate} className="h-2 mt-2" />
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardContent className="p-4">
              <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
              <p className="text-sm text-gray-500">Vaarallinen jäte</p>
              <p className="text-2xl font-bold text-red-600">45 kg</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Jätelajit</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-700">
            <div className="col-span-2">Tyyppi</div>
            <div className="col-span-2">Projekti</div>
            <div className="col-span-2">Määrä</div>
            <div className="col-span-2">Pvm</div>
            <div className="col-span-2">Kierrätys</div>
            <div className="col-span-2 text-right">Toiminnot</div>
          </div>
          {wasteItems.map(w => (
            <div key={w.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors items-center">
              <div className="col-span-2">{getTypeBadge(w.type)}</div>
              <div className="col-span-2 text-sm">{w.project}</div>
              <div className="col-span-2 text-sm font-medium">{w.amount.toLocaleString('fi-FI')} {w.unit}</div>
              <div className="col-span-2 text-sm text-gray-500">{w.date}</div>
              <div className="col-span-2">
                {w.recycled ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <AlertTriangle className="w-5 h-5 text-yellow-500" />}
              </div>
              <div className="col-span-2 text-right">
                <Button variant="ghost" size="sm">Muokkaa</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
