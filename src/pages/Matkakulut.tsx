import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Car,
  Plus,
  Route,
  Euro,
  Clock,
  MapPin,
  Fuel,
  Coffee,
  Hotel,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const trips = [
  { id: '1', worker: 'Matti M.', date: '15.1.2026', from: 'Toimisto', to: 'Rivitalo A', distance: 12, purpose: 'Työnjohto', cost: 6.96 },
  { id: '2', worker: 'Laura K.', date: '15.1.2026', from: 'Toimisto', to: 'Kerrostalo B', distance: 8, purpose: 'Laatoitus', cost: 4.64 },
  { id: '3', worker: 'Jussi P.', date: '14.1.2026', from: 'Koti', to: 'Rivitalo D', distance: 25, purpose: 'Sähkötyöt', cost: 14.50 },
  { id: '4', worker: 'Anna S.', date: '14.1.2026', from: 'Toimisto', to: 'Rivitalo A', distance: 12, purpose: 'LVI', cost: 6.96 },
  { id: '5', worker: 'Pekka H.', date: '13.1.2026', from: 'Toimisto', to: 'Kerrostalo B', distance: 8, purpose: 'Purkutyöt', cost: 4.64 },
];

const allowances = [
  { id: '1', worker: 'Matti M.', date: '15.1.2026', type: 'päiväraha', amount: 44, status: 'approved' },
  { id: '2', worker: 'Jussi P.', date: '14.1.2026', type: 'km-korvaus', amount: 14.50, status: 'approved' },
  { id: '3', worker: 'Laura K.', date: '14.1.2026', type: 'ateriaraha', amount: 11.30, status: 'pending' },
];

const getTypeBadge = (type: string) => {
  switch (type) {
    case 'päiväraha': return <Badge className="bg-blue-100 text-blue-800">Päiväraha</Badge>;
    case 'km-korvaus': return <Badge className="bg-green-100 text-green-800">KM</Badge>;
    case 'ateriaraha': return <Badge className="bg-orange-100 text-orange-800">Ateria</Badge>;
    default: return <Badge variant="outline">{type}</Badge>;
  }
};

export default function Matkakulut() {
  const [activeTab, setActiveTab] = useState('trips');
  const totalKm = trips.reduce((s, t) => s + t.distance, 0);
  const totalCost = trips.reduce((s, t) => s + t.cost, 0) + allowances.reduce((s, a) => s + a.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Matkakulut & Ajo</h1>
          <p className="text-gray-500 mt-1">Ajopäiväkirja ja kulukorvaukset</p>
        </div>
        <Button className="flex items-center gap-2 bg-primary hover:bg-primary-hover">
          <Plus className="w-4 h-4" /> Uusi merkintä
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Matkoja', value: trips.length, icon: Car },
          { label: 'Kilometrejä', value: `${totalKm} km`, icon: Route, color: 'text-primary' },
          { label: 'Kustannukset', value: `${totalCost.toFixed(2)} €`, icon: Euro, color: 'text-green-600' },
          { label: 'Korvaukset', value: allowances.length, icon: Coffee },
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="trips">Ajopäiväkirja</TabsTrigger>
          <TabsTrigger value="allowances">Korvaukset</TabsTrigger>
        </TabsList>

        <TabsContent value="trips" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-700">
                <div className="col-span-2">Pvm</div>
                <div className="col-span-2">Työntekijä</div>
                <div className="col-span-2">Reitti</div>
                <div className="col-span-2">Tarkoitus</div>
                <div className="col-span-1">Km</div>
                <div className="col-span-2 text-right">Kustannus</div>
              </div>
              {trips.map(t => (
                <div key={t.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors items-center">
                  <div className="col-span-2 text-sm">{t.date}</div>
                  <div className="col-span-2 text-sm flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary-light flex items-center justify-center">
                      <span className="text-[10px] font-semibold text-primary">{t.worker.charAt(0)}</span>
                    </div>
                    {t.worker}
                  </div>
                  <div className="col-span-2 text-sm">{t.from} → {t.to}</div>
                  <div className="col-span-2 text-sm text-gray-600">{t.purpose}</div>
                  <div className="col-span-1 font-medium">{t.distance} km</div>
                  <div className="col-span-2 text-right font-medium">{t.cost.toFixed(2)} €</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="allowances" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-700">
                <div className="col-span-2">Pvm</div>
                <div className="col-span-2">Työntekijä</div>
                <div className="col-span-2">Tyyppi</div>
                <div className="col-span-2">Summa</div>
                <div className="col-span-2">Tila</div>
                <div className="col-span-2 text-right">Toiminnot</div>
              </div>
              {allowances.map(a => (
                <div key={a.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors items-center">
                  <div className="col-span-2 text-sm">{a.date}</div>
                  <div className="col-span-2 text-sm">{a.worker}</div>
                  <div className="col-span-2">{getTypeBadge(a.type)}</div>
                  <div className="col-span-2 font-medium">{a.amount.toFixed(2)} €</div>
                  <div className="col-span-2">
                    {a.status === 'approved' ? <Badge className="bg-green-100 text-green-800">Hyväksytty</Badge> : <Badge className="bg-yellow-100 text-yellow-800">Odottaa</Badge>}
                  </div>
                  <div className="col-span-2 text-right">
                    {a.status !== 'approved' && <Button variant="outline" size="sm">Hyväksy</Button>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
