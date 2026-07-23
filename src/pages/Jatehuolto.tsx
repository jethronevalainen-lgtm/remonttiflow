import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Trash2,
  Plus,
  Search,
  Filter,
  Recycle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Euro,
  FileText,
  MapPin,
  Truck,
  Calendar,
  ArrowUpDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface WasteEntry {
  id: string;
  projectId: string;
  projectName: string;
  date: string;
  wasteType: string;
  amount: number;
  unit: string;
  disposalMethod: string;
  disposalSite: string;
  cost: number;
  documents: string[];
  status: 'pending' | 'disposed' | 'recycled';
  notes: string;
}

interface WastePlan {
  id: string;
  projectId: string;
  projectName: string;
  estimatedAmount: number;
  actualAmount: number;
  recyclingTarget: number;
  recyclingActual: number;
  status: 'draft' | 'active' | 'completed';
}

const wasteEntries: WasteEntry[] = [
  {
    id: '1',
    projectId: '1',
    projectName: 'Rivitalo A',
    date: '2026-01-10',
    wasteType: 'Sekajäte',
    amount: 2500,
    unit: 'kg',
    disposalMethod: 'Kaatopaikka',
    disposalSite: 'Vantaan jätekeskus',
    cost: 450,
    documents: ['Siirtokirja #123'],
    status: 'disposed',
    notes: 'Purkujäte erilliskerätty'
  },
  {
    id: '2',
    projectId: '1',
    projectName: 'Rivitalo A',
    date: '2026-01-12',
    wasteType: 'Metalli',
    amount: 350,
    unit: 'kg',
    disposalMethod: 'Kierrätys',
    disposalSite: 'Kuusakoski',
    cost: 0,
    documents: ['Toimitustodistus #45'],
    status: 'recycled',
    notes: 'Putket ja rautatavarat'
  },
  {
    id: '3',
    projectId: '1',
    projectName: 'Rivitalo A',
    date: '2026-01-14',
    wasteType: 'Puujäte',
    amount: 800,
    unit: 'kg',
    disposalMethod: 'Kierrätys',
    disposalSite: 'Hyötyjäteasema',
    cost: 120,
    documents: [],
    status: 'pending',
    notes: 'Vanhat kaapit ja väliseinät'
  },
  {
    id: '4',
    projectId: '2',
    projectName: 'Kerrostalo B',
    date: '2026-01-15',
    wasteType: 'Betoni',
    amount: 5000,
    unit: 'kg',
    disposalMethod: 'Murskaus',
    disposalSite: 'Rudus',
    cost: 350,
    documents: ['Siirtokirja #124'],
    status: 'disposed',
    notes: 'Vanhat lattiat'
  },
  {
    id: '5',
    projectId: '2',
    projectName: 'Kerrostalo B',
    date: '2026-01-15',
    wasteType: 'Energiajäte',
    amount: 1200,
    unit: 'kg',
    disposalMethod: 'Poltto',
    disposalSite: 'Vantaan energiajäte',
    cost: 280,
    documents: [],
    status: 'pending',
    notes: 'Eristevillat ja muovit'
  }
];

const wastePlans: WastePlan[] = [
  {
    id: '1',
    projectId: '1',
    projectName: 'Rivitalo A',
    estimatedAmount: 15000,
    actualAmount: 8500,
    recyclingTarget: 80,
    recyclingActual: 75,
    status: 'active'
  },
  {
    id: '2',
    projectId: '2',
    projectName: 'Kerrostalo B',
    estimatedAmount: 25000,
    actualAmount: 6200,
    recyclingTarget: 75,
    recyclingActual: 70,
    status: 'active'
  }
];

const wasteTypes = ['Sekajäte', 'Metalli', 'Puujäte', 'Betoni', 'Energiajäte', 'Vaarallinen jäte', 'Sähkölaitteet'];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'disposed':
      return <Badge className="bg-gray-100 text-gray-800">Hävitetty</Badge>;
    case 'recycled':
      return <Badge className="bg-green-100 text-green-800">Kierrätetty</Badge>;
    case 'pending':
      return <Badge className="bg-yellow-100 text-yellow-800">Odottaa</Badge>;
    default:
      return null;
  }
};

const getWasteTypeIcon = (type: string) => {
  switch (type) {
    case 'Metalli':
      return <Recycle className="w-4 h-4 text-blue-500" />;
    case 'Vaarallinen jäte':
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    default:
      return <Trash2 className="w-4 h-4 text-gray-500" />;
  }
};

export default function Jatehuolto() {
  const [entries, setEntries] = useState<WasteEntry[]>(wasteEntries);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('entries');

  const filteredEntries = entries.filter(entry =>
    entry.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.wasteType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.disposalSite.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCost = entries.reduce((sum, e) => sum + e.cost, 0);
  const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);
  const recycledAmount = entries.filter(e => e.status === 'recycled').reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jätehuolto</h1>
          <p className="text-gray-500 mt-1">Jätteiden seuranta ja kierrätys</p>
        </div>
        <Button className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4" />
          Kirjaa jäte
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Kirjaukset', value: entries.length.toString(), icon: FileText, color: 'text-blue-600' },
          { label: 'Kokonaismäärä', value: `${(totalAmount / 1000).toFixed(1)} t`, icon: Trash2, color: 'text-gray-600' },
          { label: 'Kierrätetty', value: `${(recycledAmount / 1000).toFixed(1)} t`, icon: Recycle, color: 'text-green-600' },
          { label: 'Kustannukset', value: `${totalCost.toLocaleString('fi-FI')} €`, icon: Euro, color: 'text-red-600' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
                <stat.icon className={`w-8 h-8 ${stat.color} opacity-20`} />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="entries">Jätekirjaukset</TabsTrigger>
          <TabsTrigger value="plans">Jätesuunnitelmat</TabsTrigger>
        </TabsList>

        <TabsContent value="entries" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Hae kirjauksia..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Suodata
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-700">
                <div className="col-span-2">Projekti</div>
                <div className="col-span-1">Päivä</div>
                <div className="col-span-2">Jätetyyppi</div>
                <div className="col-span-1">Määrä</div>
                <div className="col-span-2">Hävityspaikka</div>
                <div className="col-span-1">Kustannus</div>
                <div className="col-span-1">Tila</div>
                <div className="col-span-2">Huomautukset</div>
              </div>
              {filteredEntries.map((entry) => (
                <div key={entry.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 hover:bg-gray-50 items-center">
                  <div className="col-span-2 font-medium">{entry.projectName}</div>
                  <div className="col-span-1 text-sm">{new Date(entry.date).toLocaleDateString('fi-FI')}</div>
                  <div className="col-span-2 flex items-center gap-2">
                    {getWasteTypeIcon(entry.wasteType)}
                    <span className="text-sm">{entry.wasteType}</span>
                  </div>
                  <div className="col-span-1 text-sm">{entry.amount} {entry.unit}</div>
                  <div className="col-span-2 text-sm text-gray-600">
                    <div>{entry.disposalMethod}</div>
                    <div className="text-xs text-gray-400">{entry.disposalSite}</div>
                  </div>
                  <div className="col-span-1 text-sm">{entry.cost.toLocaleString('fi-FI')} €</div>
                  <div className="col-span-1">{getStatusBadge(entry.status)}</div>
                  <div className="col-span-2 text-sm text-gray-600 truncate">{entry.notes}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-4">
          <div className="space-y-4">
            {wastePlans.map((plan) => (
              <Card key={plan.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{plan.projectName} - Jätesuunnitelma</span>
                    <Badge variant={plan.status === 'active' ? 'default' : 'outline'}>
                      {plan.status === 'active' ? 'Aktiivinen' : plan.status === 'completed' ? 'Valmis' : 'Luonnos'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Arvioitu määrä</p>
                      <p className="text-lg font-semibold">{(plan.estimatedAmount / 1000).toFixed(1)} t</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Toteutunut</p>
                      <p className="text-lg font-semibold">{(plan.actualAmount / 1000).toFixed(1)} t</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Kierrätys (tavoite)</p>
                      <p className="text-lg font-semibold">{plan.recyclingTarget}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Kierrätys (toteuma)</p>
                      <p className="text-lg font-semibold">{plan.recyclingActual}%</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Kierrätysaste</span>
                      <span>{plan.recyclingActual}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-green-500 h-3 rounded-full"
                        style={{ width: `${plan.recyclingActual}%` }}
                      />
                    </div>
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
