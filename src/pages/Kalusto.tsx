import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wrench,
  Truck,
  Plus,
  Search,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  Gauge,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const equipment = [
  { id: '1', name: 'Bobcat kaivuri', type: 'kaivuri', model: 'E26', year: 2022, location: 'Rivitalo A', status: 'available', lastService: '1.12.2025', nextService: '1.3.2026', hours: 1240 },
  { id: '2', name: 'Hilti poravasara', type: 'työkalu', model: 'TE 70-AVR', year: 2024, location: 'Kerrostalo B', status: 'in_use', lastService: '15.11.2025', nextService: '15.2.2026', hours: 340 },
  { id: '3', name: 'Työmaakontti', type: 'kontti', model: '20ft', year: 2023, location: 'Rivitalo A', status: 'available', lastService: '-', nextService: '-', hours: 0 },
  { id: '4', name: 'Generaattori', type: 'sähkö', model: 'Honda EU70is', year: 2024, location: 'Rivitalo D', status: 'in_use', lastService: '20.12.2025', nextService: '20.3.2026', hours: 180 },
  { id: '5', name: 'Tikkaat 12m', type: 'teline', model: 'Zarges', year: 2023, location: 'Kerrostalo B', status: 'maintenance', lastService: '5.1.2026', nextService: '5.7.2026', hours: 0 },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'available': return <Badge className="bg-green-100 text-green-800">Vapaa</Badge>;
    case 'in_use': return <Badge className="bg-blue-100 text-blue-800">Käytössä</Badge>;
    case 'maintenance': return <Badge className="bg-yellow-100 text-yellow-800">Huolto</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
};

export default function Kalusto() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('list');

  const filtered = equipment.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const available = equipment.filter(e => e.status === 'available').length;
  const inUse = equipment.filter(e => e.status === 'in_use').length;
  const maintenance = equipment.filter(e => e.status === 'maintenance').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kalusto</h1>
          <p className="text-gray-500 mt-1">Koneet, laitteet ja työkalut</p>
        </div>
        <Button className="flex items-center gap-2 bg-primary hover:bg-primary-hover">
          <Plus className="w-4 h-4" /> Lisää kalusto
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Kalustoa', value: equipment.length, icon: Wrench },
          { label: 'Vapaa', value: available, icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Käytössä', value: inUse, icon: Gauge, color: 'text-blue-600' },
          { label: 'Huollossa', value: maintenance, icon: AlertTriangle, color: 'text-yellow-600' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color || ''}`}>{s.value}</p>
                </div>
                <s.icon className="w-8 h-8 text-gray-300" />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Hae kalustosta..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-700">
            <div className="col-span-3">Nimi</div>
            <div className="col-span-1">Tyyppi</div>
            <div className="col-span-2">Sijainti</div>
            <div className="col-span-2">Tila</div>
            <div className="col-span-2">Seur. huolto</div>
            <div className="col-span-2 text-right">Tunnit</div>
          </div>
          {filtered.map(e => (
            <div key={e.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors items-center">
              <div className="col-span-3">
                <p className="font-medium text-sm">{e.name}</p>
                <p className="text-xs text-gray-500">{e.model} ({e.year})</p>
              </div>
              <div className="col-span-1 text-sm capitalize">{e.type}</div>
              <div className="col-span-2 text-sm flex items-center gap-1"><MapPin className="w-3 h-3" />{e.location}</div>
              <div className="col-span-2">{getStatusBadge(e.status)}</div>
              <div className="col-span-2 text-sm">{e.nextService}</div>
              <div className="col-span-2 text-right text-sm font-medium">{e.hours} h</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
