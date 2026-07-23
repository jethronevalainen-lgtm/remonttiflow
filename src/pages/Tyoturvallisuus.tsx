import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  ShieldCheck,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Users,
  BookOpen,
  TrendingUp,
  HardHat,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const observations = [
  { id: '1', project: 'Rivitalo A', type: 'positive', description: 'Turvakengät kunnossa kaikilla', date: '15.1.2026', reporter: 'Matti M.' },
  { id: '2', project: 'Kerrostalo B', type: 'negative', description: 'Putoamissuojaus puutteellinen rappukäytävässä', date: '14.1.2026', reporter: 'Laura K.' },
  { id: '3', project: 'Rivitalo D', type: 'positive', description: 'Työmaa siisti ja järjestyksessä', date: '13.1.2026', reporter: 'Jussi P.' },
  { id: '4', project: 'Rivitalo A', type: 'negative', description: 'Hätäpoistumistie tukossa rakennusjäteillä', date: '12.1.2026', reporter: 'Anna S.' },
  { id: '5', project: 'Kerrostalo B', type: 'positive', description: 'Ensiapupakkaus täydellinen', date: '11.1.2026', reporter: 'Pekka H.' },
];

const training = [
  { id: '1', name: 'Työturvallisuuskortti', required: true, validUntil: '31.12.2026', participants: 22, completed: 20 },
  { id: '2', name: 'Tulityökortti', required: true, validUntil: '30.6.2026', participants: 8, completed: 7 },
  { id: '3', name: 'Ensiapu', required: false, validUntil: '15.3.2026', participants: 5, completed: 3 },
  { id: '4', name: 'Hätäensiapu', required: true, validUntil: '30.9.2026', participants: 10, completed: 10 },
];

const getObservationIcon = (type: string) => {
  return type === 'positive'
    ? <CheckCircle2 className="w-5 h-5 text-green-500" />
    : <AlertTriangle className="w-5 h-5 text-red-500" />;
};

export default function Tyoturvallisuus() {
  const [activeTab, setActiveTab] = useState('observations');
  const safetyScore = 87;
  const positiveCount = observations.filter(o => o.type === 'positive').length;
  const negativeCount = observations.filter(o => o.type === 'negative').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Työturvallisuus</h1>
          <p className="text-gray-500 mt-1">Turvallisuushavainnot ja koulutukset</p>
        </div>
        <Button className="flex items-center gap-2 bg-primary hover:bg-primary-hover">
          <Plus className="w-4 h-4" /> Uusi havainto
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-4">
              <ShieldCheck className="w-8 h-8 text-green-500 mb-2" />
              <p className="text-sm text-gray-500">Turvallisuusindeksi</p>
              <p className="text-3xl font-bold text-green-600">{safetyScore}%</p>
              <Progress value={safetyScore} className="h-2 mt-2" />
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="p-4">
              <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
              <p className="text-sm text-gray-500">Positiiviset</p>
              <p className="text-2xl font-bold text-green-600">{positiveCount}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="p-4">
              <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
              <p className="text-sm text-gray-500">Korjattavaa</p>
              <p className="text-2xl font-bold text-red-600">{negativeCount}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardContent className="p-4">
              <Users className="w-8 h-8 text-primary mb-2" />
              <p className="text-sm text-gray-500">Koulutettuja</p>
              <p className="text-2xl font-bold text-primary">22/22</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="observations">Havainnot</TabsTrigger>
          <TabsTrigger value="training">Koulutukset</TabsTrigger>
        </TabsList>

        <TabsContent value="observations" className="mt-4">
          <div className="space-y-2">
            {observations.map(o => (
              <motion.div key={o.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center gap-4">
                    {getObservationIcon(o.type)}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{o.description}</p>
                      <p className="text-xs text-gray-500">{o.project} · {o.date} · {o.reporter}</p>
                    </div>
                    <Badge className={o.type === 'positive' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {o.type === 'positive' ? 'Hyvä' : 'Korjattava'}
                    </Badge>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="training" className="mt-4">
          <div className="space-y-3">
            {training.map(t => (
              <Card key={t.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <HardHat className="w-5 h-5 text-primary" />
                      <span className="font-medium">{t.name}</span>
                      {t.required && <Badge className="bg-red-100 text-red-800">Pakollinen</Badge>}
                    </div>
                    <span className="text-sm text-gray-500">Voimassa: {t.validUntil}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Progress value={(t.completed / t.participants) * 100} className="h-2" />
                    </div>
                    <span className="text-sm font-medium">{t.completed}/{t.participants}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
