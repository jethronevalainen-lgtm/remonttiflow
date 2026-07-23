import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Plus,
  Search,
  Filter,
  Mail,
  Phone,
  MapPin,
  Building2,
  Star,
  Clock,
  FileText,
  MessageSquare,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Handshake,
  TrendingUp,
  Calendar,
  CheckCircle2,
  XCircle,
  MoreHorizontal
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Customer interface matching Asiakkaat.tsx
interface ContactPerson {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  isPrimary: boolean;
}

interface Customer {
  id: string;
  name: string;
  type: 'company' | 'individual';
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  yTunnus?: string;
  rating: number;
  status: 'active' | 'passive' | 'prospect';
  notes: string;
  contactPersons: ContactPerson[];
  projectCount: number;
  totalValue: number;
  lastContact: string;
  createdAt: string;
}

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  order: number;
}

interface Deal {
  id: string;
  name: string;
  customerId: string;
  customerName: string;
  value: number;
  stageId: string;
  probability: number;
  expectedCloseDate: string;
  description: string;
  assignedTo: string;
  createdAt: string;
  lastActivity: string;
}

interface Activity {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'note' | 'task';
  description: string;
  customerId?: string;
  customerName?: string;
  dealId?: string;
  dealName?: string;
  createdBy: string;
  createdAt: string;
  completed: boolean;
}

const pipelineStages: PipelineStage[] = [
  { id: 'lead', name: 'Liidi', color: 'bg-gray-100 border-gray-300', order: 1 },
  { id: 'contact', name: 'Yhteydenotto', color: 'bg-blue-50 border-blue-300', order: 2 },
  { id: 'offer', name: 'Tarjous', color: 'bg-yellow-50 border-yellow-300', order: 3 },
  { id: 'negotiation', name: 'Neuvottelu', color: 'bg-orange-50 border-orange-300', order: 4 },
  { id: 'won', name: 'Voitettu', color: 'bg-green-50 border-green-300', order: 5 },
  { id: 'lost', name: 'Hävitty', color: 'bg-red-50 border-red-300', order: 6 },
];

const initialDeals: Deal[] = [
  {
    id: '1',
    name: 'Keittiöremontti',
    customerId: '3',
    customerName: 'Pekka Puttonen',
    value: 25000,
    stageId: 'offer',
    probability: 60,
    expectedCloseDate: '2026-02-15',
    description: 'Vanhan keittiön täysremontti. Suunnittelu käynnissä.',
    assignedTo: 'Jethro',
    createdAt: '2026-01-10',
    lastActivity: '2026-01-15'
  },
  {
    id: '2',
    name: 'Putkiremontti rivitalo',
    customerId: '1',
    customerName: 'Asunto Oy Keltanen Tähti',
    value: 145000,
    stageId: 'negotiation',
    probability: 80,
    expectedCloseDate: '2026-03-01',
    description: 'Taloyhtiön putkiremontti. Hallitus hyväksynyt alustavan suunnitelman.',
    assignedTo: 'Jethro',
    createdAt: '2026-01-05',
    lastActivity: '2026-01-15'
  },
  {
    id: '3',
    name: 'Kylpyhuoneremontti',
    customerId: '4',
    customerName: 'Asunto Oy Sininen Talo',
    value: 45000,
    stageId: 'won',
    probability: 100,
    expectedCloseDate: '2026-01-20',
    description: 'Kylpyhuoneremontti käynnissä.',
    assignedTo: 'Jethro',
    createdAt: '2025-12-01',
    lastActivity: '2026-01-14'
  },
  {
    id: '4',
    name: 'Toimistoremontti',
    customerId: '5',
    customerName: 'Helsingin Kaupunki',
    value: 180000,
    stageId: 'contact',
    probability: 30,
    expectedCloseDate: '2026-04-01',
    description: 'Toimistotilan peruskorjaus. Alustava kartoitus tehty.',
    assignedTo: 'Jethro',
    createdAt: '2026-01-08',
    lastActivity: '2026-01-12'
  },
  {
    id: '5',
    name: 'Sähkötyöt kerrostalo',
    customerId: '2',
    customerName: 'Tmi Rakennus Rane',
    value: 35000,
    stageId: 'lead',
    probability: 20,
    expectedCloseDate: '2026-05-01',
    description: 'Uudisrakennuksen sähköasennukset.',
    assignedTo: 'Jethro',
    createdAt: '2026-01-14',
    lastActivity: '2026-01-14'
  }
];

const initialActivities: Activity[] = [
  { id: '1', type: 'call', description: 'Soitto Pekalle keittiöremontista', customerId: '3', customerName: 'Pekka Puttonen', dealId: '1', dealName: 'Keittiöremontti', createdBy: 'Jethro', createdAt: '2026-01-15T10:00:00', completed: true },
  { id: '2', type: 'email', description: 'Tarjous lähetetty Keltanen Tähti', customerId: '1', customerName: 'Asunto Oy Keltanen Tähti', dealId: '2', dealName: 'Putkiremontti rivitalo', createdBy: 'Jethro', createdAt: '2026-01-15T09:00:00', completed: true },
  { id: '3', type: 'meeting', description: 'Palaveri hallituksen kanssa', customerId: '1', customerName: 'Asunto Oy Keltanen Tähti', dealId: '2', dealName: 'Putkiremontti rivitalo', createdBy: 'Jethro', createdAt: '2026-01-14T14:00:00', completed: true },
  { id: '4', type: 'task', description: 'Laadi tarkennettu tarjous Helsingin Kaupungille', customerId: '5', customerName: 'Helsingin Kaupunki', dealId: '4', dealName: 'Toimistoremontti', createdBy: 'Jethro', createdAt: '2026-01-12T16:00:00', completed: false },
  { id: '5', type: 'note', description: 'Rane soitti ja kyseli sähkötöiden aikataulusta', customerId: '2', customerName: 'Tmi Rakennus Rane', dealId: '5', dealName: 'Sähkötyöt kerrostalo', createdBy: 'Jethro', createdAt: '2026-01-14T11:00:00', completed: true }
];

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'call': return <Phone className="w-4 h-4 text-blue-500" />;
    case 'email': return <Mail className="w-4 h-4 text-green-500" />;
    case 'meeting': return <Users className="w-4 h-4 text-purple-500" />;
    case 'note': return <MessageSquare className="w-4 h-4 text-yellow-500" />;
    case 'task': return <CheckCircle2 className="w-4 h-4 text-orange-500" />;
    default: return <FileText className="w-4 h-4" />;
  }
};

const getActivityLabel = (type: string) => {
  switch (type) {
    case 'call': return 'Puhelu';
    case 'email': return 'Sähköposti';
    case 'meeting': return 'Tapaaminen';
    case 'note': return 'Muistiinpano';
    case 'task': return 'Tehtävä';
    default: return type;
  }
};

export default function CRM() {
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [activeTab, setActiveTab] = useState('pipeline');
  const [expandedDeal, setExpandedDeal] = useState<string | null>(null);

  const toggleActivityComplete = (id: string) => {
    setActivities(prev => prev.map(a => a.id === id ? { ...a, completed: !a.completed } : a));
  };

  const filteredDeals = deals.filter(deal =>
    deal.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    deal.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalValue: deals.reduce((sum, d) => sum + d.value, 0),
    weightedValue: deals.reduce((sum, d) => sum + d.value * (d.probability / 100), 0),
    activeDeals: deals.filter(d => d.stageId !== 'won' && d.stageId !== 'lost').length,
    wonDeals: deals.filter(d => d.stageId === 'won').length,
    wonValue: deals.filter(d => d.stageId === 'won').reduce((sum, d) => sum + d.value, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CRM & Myynti</h1>
          <p className="text-gray-500 mt-1">Myyntiputki, diilit ja asiakastoimenpiteet</p>
        </div>
        <Button
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
          onClick={() => setShowAddDeal(true)}
        >
          <Plus className="w-4 h-4" />
          Uusi diili
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Myyntiputken arvo', value: `${(stats.totalValue / 1000).toFixed(0)}k €`, icon: TrendingUp, color: 'text-blue-600' },
          { label: 'Painotettu arvo', value: `${(stats.weightedValue / 1000).toFixed(0)}k €`, icon: Handshake, color: 'text-purple-600' },
          { label: 'Aktiiviset diilit', value: stats.activeDeals.toString(), icon: FileText, color: 'text-yellow-600' },
          { label: 'Voitetut', value: `${stats.wonDeals} (${(stats.wonValue / 1000).toFixed(0)}k €)`, icon: CheckCircle2, color: 'text-green-600' },
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
          <TabsTrigger value="pipeline">Myyntiputki</TabsTrigger>
          <TabsTrigger value="activities">Toimenpiteet</TabsTrigger>
          <TabsTrigger value="deals">Diililista</TabsTrigger>
        </TabsList>

        {/* Pipeline Tab */}
        <TabsContent value="pipeline" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Hae diilejä..."
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

          {/* Kanban Board */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {pipelineStages.map((stage) => {
              const stageDeals = filteredDeals.filter(d => d.stageId === stage.id);
              const stageValue = stageDeals.reduce((sum, d) => sum + d.value, 0);
              return (
                <div key={stage.id} className={`rounded-lg border p-3 ${stage.color}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm">{stage.name}</h3>
                    <Badge variant="outline" className="text-xs">{stageDeals.length}</Badge>
                  </div>
                  <div className="text-xs text-gray-500 mb-3">
                    {stageValue.toLocaleString('fi-FI')} €
                  </div>
                  <div className="space-y-2">
                    {stageDeals.map((deal) => (
                      <motion.div
                        key={deal.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => setSelectedDeal(deal)}
                      >
                        <h4 className="font-medium text-sm truncate">{deal.name}</h4>
                        <p className="text-xs text-gray-500">{deal.customerName}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-semibold">{deal.value.toLocaleString('fi-FI')} €</span>
                          <span className="text-xs text-gray-500">{deal.probability}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                          <div
                            className="bg-blue-500 h-1 rounded-full"
                            style={{ width: `${deal.probability}%` }}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Activities Tab */}
        <TabsContent value="activities" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Hae toimenpiteitä..." className="pl-10" />
            </div>
            <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Uusi toimenpide
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {/* Activity List */}
              <div className="divide-y">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className={`p-4 flex items-start gap-4 hover:bg-gray-50 transition-colors ${activity.completed ? 'opacity-50' : ''}`}
                  >
                    <div className="mt-1">{getActivityIcon(activity.type)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{getActivityLabel(activity.type)}</Badge>
                        {activity.customerName && (
                          <span className="text-sm text-gray-600">{activity.customerName}</span>
                        )}
                      </div>
                      <p className={`text-sm mt-1 ${activity.completed ? 'line-through' : ''}`}>
                        {activity.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span>{activity.createdBy}</span>
                        <span>•</span>
                        <span>{new Date(activity.createdAt).toLocaleString('fi-FI')}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleActivityComplete(activity.id)}
                    >
                      {activity.completed ? (
                        <XCircle className="w-5 h-5 text-gray-400" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deals List Tab */}
        <TabsContent value="deals" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Hae diilejä..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-700">
                <div className="col-span-3">Nimi</div>
                <div className="col-span-2">Asiakas</div>
                <div className="col-span-2">Arvo</div>
                <div className="col-span-2">Vaihe</div>
                <div className="col-span-2">Todennäköisyys</div>
                <div className="col-span-1 text-right">Toiminnot</div>
              </div>
              {filteredDeals.map((deal) => (
                <div
                  key={deal.id}
                  className="grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer items-center"
                  onClick={() => setSelectedDeal(deal)}
                >
                  <div className="col-span-3">
                    <div className="font-medium">{deal.name}</div>
                    <div className="text-xs text-gray-500">{deal.assignedTo}</div>
                  </div>
                  <div className="col-span-2 text-sm">{deal.customerName}</div>
                  <div className="col-span-2 font-semibold">{deal.value.toLocaleString('fi-FI')} €</div>
                  <div className="col-span-2">
                    <Badge variant="outline">
                      {pipelineStages.find(s => s.id === deal.stageId)?.name}
                    </Badge>
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${deal.probability}%` }}
                        />
                      </div>
                      <span className="text-sm">{deal.probability}%</span>
                    </div>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Deal Detail Modal */}
      {selectedDeal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedDeal(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">{selectedDeal.name}</h2>
                <Button variant="ghost" size="sm" onClick={() => setSelectedDeal(null)}>✕</Button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500">Asiakas</label>
                    <p className="font-medium">{selectedDeal.customerName}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Arvo</label>
                    <p className="font-medium">{selectedDeal.value.toLocaleString('fi-FI')} €</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Vaihe</label>
                    <p className="font-medium">{pipelineStages.find(s => s.id === selectedDeal.stageId)?.name}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Todennäköisyys</label>
                    <p className="font-medium">{selectedDeal.probability}%</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Odotettu päätös</label>
                    <p className="font-medium">{new Date(selectedDeal.expectedCloseDate).toLocaleDateString('fi-FI')}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Vastuullinen</label>
                    <p className="font-medium">{selectedDeal.assignedTo}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Kuvaus</label>
                  <p className="text-sm mt-1">{selectedDeal.description}</p>
                </div>
                <div className="flex gap-2 pt-4 border-t">
                  <Button variant="outline" className="flex items-center gap-2">
                    <Edit2 className="w-4 h-4" />
                    Muokkaa
                  </Button>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Lisää kalenteriin
                  </Button>
                  <Button variant="destructive" className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    Poista
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
