import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  Calendar,
  Briefcase,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const timeEntries = [
  { id: '1', worker: 'Matti M.', date: '15.1.2026', project: 'Rivitalo A', hours: 7.5, description: 'Putkiasennus', approved: true },
  { id: '2', worker: 'Laura K.', date: '15.1.2026', project: 'Kerrostalo B', hours: 8.0, description: 'Laatoituksen valmistelu', approved: true },
  { id: '3', worker: 'Jussi P.', date: '15.1.2026', project: 'Rivitalo D', hours: 4.0, description: 'Sähkösuunnittelu', approved: false },
  { id: '4', worker: 'Anna S.', date: '15.1.2026', project: 'Rivitalo A', hours: 6.5, description: 'LVI-asennus', approved: true },
  { id: '5', worker: 'Pekka H.', date: '15.1.2026', project: 'Kerrostalo B', hours: 7.0, description: 'Purkutyöt', approved: true },
  { id: '6', worker: 'Matti M.', date: '14.1.2026', project: 'Rivitalo A', hours: 8.0, description: 'Putkityöt jatkuu', approved: true },
  { id: '7', worker: 'Laura K.', date: '14.1.2026', project: 'Kerrostalo B', hours: 7.5, description: 'Laatoitus', approved: true },
  { id: '8', worker: 'Jussi P.', date: '14.1.2026', project: 'Rivitalo D', hours: 8.0, description: 'Sähköasennus', approved: true },
];

export default function Tuntikirjaukset() {
  const [activeTab, setActiveTab] = useState('all');
  const [currentWeek, setCurrentWeek] = useState('Viikko 3, 2026');

  const filtered = useMemo(() => {
    if (activeTab === 'pending') return timeEntries.filter(e => !e.approved);
    if (activeTab === 'approved') return timeEntries.filter(e => e.approved);
    return timeEntries;
  }, [activeTab]);

  const totalHours = timeEntries.reduce((s, e) => s + e.hours, 0);
  const pendingCount = timeEntries.filter(e => !e.approved).length;

  const workerTotals = useMemo(() => {
    const map: Record<string, number> = {};
    timeEntries.forEach(e => { map[e.worker] = (map[e.worker] || 0) + e.hours; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tuntikirjaukset</h1>
          <p className="text-gray-500 mt-1">Työtuntien kirjaus ja hyväksyntä</p>
        </div>
        <Button className="flex items-center gap-2 bg-primary hover:bg-primary-hover">
          <Plus className="w-4 h-4" /> Kirjaa tunnit
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Kirjauksia', value: timeEntries.length, icon: Clock },
          { label: 'Tunteja yht.', value: `${totalHours.toFixed(1)} h`, icon: TrendingUp, color: 'text-primary' },
          { label: 'Odottaa', value: pendingCount, icon: AlertTriangle, color: 'text-yellow-600' },
          { label: 'Hyväksytty', value: timeEntries.filter(e => e.approved).length, icon: CheckCircle2, color: 'text-green-600' },
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
          <TabsTrigger value="all">Kaikki</TabsTrigger>
          <TabsTrigger value="pending">Odottaa</TabsTrigger>
          <TabsTrigger value="approved">Hyväksytyt</TabsTrigger>
          <TabsTrigger value="summary">Yhteenveto</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-700">
                <div className="col-span-2">Työntekijä</div>
                <div className="col-span-1">Pvm</div>
                <div className="col-span-2">Projekti</div>
                <div className="col-span-3">Kuvaus</div>
                <div className="col-span-1">Tunnit</div>
                <div className="col-span-1">Tila</div>
                <div className="col-span-2 text-right">Toiminnot</div>
              </div>
              {filtered.map(e => (
                <div key={e.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors items-center">
                  <div className="col-span-2 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary-light flex items-center justify-center">
                      <span className="text-xs font-semibold text-primary">{e.worker.charAt(0)}</span>
                    </div>
                    <span className="text-sm">{e.worker}</span>
                  </div>
                  <div className="col-span-1 text-sm">{e.date}</div>
                  <div className="col-span-2 text-sm">{e.project}</div>
                  <div className="col-span-3 text-sm text-gray-600">{e.description}</div>
                  <div className="col-span-1 font-medium">{e.hours} h</div>
                  <div className="col-span-1">
                    {e.approved ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <AlertTriangle className="w-5 h-5 text-yellow-500" />}
                  </div>
                  <div className="col-span-2 text-right">
                    {!e.approved && <Button variant="outline" size="sm">Hyväksy</Button>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {filtered.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Ei odottavia kirjauksia</p>
              ) : (
                <div className="space-y-2">{filtered.map(e => (
                  <div key={e.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="font-medium text-sm">{e.worker} - {e.project}</p>
                        <p className="text-xs text-gray-500">{e.date} · {e.hours} h · {e.description}</p>
                      </div>
                    </div>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700"><CheckCircle2 className="w-4 h-4 mr-1" /> Hyväksy</Button>
                  </div>
                ))}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approved" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <div className="space-y-2">{filtered.map(e => (
                <div key={e.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <div>
                      <p className="font-medium text-sm">{e.worker} - {e.project}</p>
                      <p className="text-xs text-gray-500">{e.date} · {e.hours} h</p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Hyväksytty</Badge>
                </div>
              ))}</div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Tunnit työntekijöittäin</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {workerTotals.map(([worker, hours]) => (
                  <div key={worker} className="flex items-center gap-4">
                    <div className="w-24 text-sm font-medium">{worker}</div>
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(hours / 40) * 100}%` }}
                        transition={{ duration: 0.5 }}
                        className="h-full bg-primary rounded-full"
                      />
                    </div>
                    <div className="w-16 text-right text-sm font-medium">{hours.toFixed(1)} h</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
