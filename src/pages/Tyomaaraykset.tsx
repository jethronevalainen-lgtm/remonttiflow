import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Users,
  Euro,
  FileText,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  X,
  Save,
  ArrowUpDown,
  Printer,
  Mail
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface WorkOrder {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  assignedTo: string;
  createdBy: string;
  createdAt: string;
  dueDate: string;
  completedAt?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  category: string;
  estimatedHours: number;
  actualHours?: number;
  materials: string[];
  notes: string;
}

const workOrders: WorkOrder[] = [
  {
    id: 'WO-001',
    projectId: '1',
    projectName: 'Rivitalo A',
    title: 'Putkien asennus asunto 1',
    description: 'Vanhojen putkien purku ja uusien asennus asuntoon 1. Sisältää kylpyhuoneen ja keittiön putket.',
    assignedTo: 'Mika M.',
    createdBy: 'Jethro',
    createdAt: '2026-01-05',
    dueDate: '2026-01-20',
    priority: 'high',
    status: 'in_progress',
    category: 'Putkityöt',
    estimatedHours: 40,
    actualHours: 24,
    materials: ['Kupariputki 15mm', 'Kupariputki 22mm', 'Liittimet', 'Sulut'],
    notes: 'Tarkista paineet ennen peittämistä'
  },
  {
    id: 'WO-002',
    projectId: '1',
    projectName: 'Rivitalo A',
    title: 'Sähköasennus asunto 1',
    description: 'Sähköjohdotusten asennus ja rasioinnit asuntoon 1.',
    assignedTo: 'Laura K.',
    createdBy: 'Jethro',
    createdAt: '2026-01-08',
    dueDate: '2026-01-22',
    priority: 'medium',
    status: 'open',
    category: 'Sähkötyöt',
    estimatedHours: 24,
    materials: ['Johto 1.5mm²', 'Johto 2.5mm²', 'Rasiat', 'Keskus'],
    notes: ''
  },
  {
    id: 'WO-003',
    projectId: '2',
    projectName: 'Kerrostalo B',
    title: 'Laatoitus kerros 1',
    description: 'Kylpyhuoneiden laatoitus kerroksessa 1. 4 asuntoa.',
    assignedTo: 'Jussi P.',
    createdBy: 'Jethro',
    createdAt: '2026-01-10',
    dueDate: '2026-01-25',
    priority: 'medium',
    status: 'in_progress',
    category: 'Laatoitus',
    estimatedHours: 32,
    actualHours: 8,
    materials: ['Laatta 10x10', 'Laatta 30x60', 'Laatoitusliima', 'Saumalaasti'],
    notes: 'Tarkista vesieristys ennen laatoitusta'
  },
  {
    id: 'WO-004',
    projectId: '1',
    projectName: 'Rivitalo A',
    title: 'Vesieristys asunto 2',
    description: 'Kylpyhuoneen vesieristys asuntoon 2.',
    assignedTo: 'Jussi P.',
    createdBy: 'Jethro',
    createdAt: '2026-01-12',
    dueDate: '2026-01-18',
    priority: 'high',
    status: 'open',
    category: 'Vesieristys',
    estimatedHours: 16,
    materials: ['Vesieriste', 'Vahvistusnauha', 'Kulmatiivisteet'],
    notes: ''
  },
  {
    id: 'WO-005',
    projectId: '3',
    projectName: 'Toimisto C',
    title: 'Purkutyöt toimistotila',
    description: 'Vanhojen seinien ja lattioiden purku toimistotilasta.',
    assignedTo: 'Timo K.',
    createdBy: 'Jethro',
    createdAt: '2026-01-15',
    dueDate: '2026-01-30',
    priority: 'urgent',
    status: 'in_progress',
    category: 'Purkutyöt',
    estimatedHours: 20,
    actualHours: 4,
    materials: ['Jätesäkit', 'Suojamuovi'],
    notes: 'Huomioi talon muut käyttäjät'
  },
  {
    id: 'WO-006',
    projectId: '2',
    projectName: 'Kerrostalo B',
    title: 'Sähköasennus kerros 2',
    description: 'Sähkötyöt kerroksessa 2. 4 asuntoa.',
    assignedTo: 'Laura K.',
    createdBy: 'Jethro',
    createdAt: '2026-01-14',
    dueDate: '2026-01-28',
    priority: 'medium',
    status: 'completed',
    completedAt: '2026-01-15',
    category: 'Sähkötyöt',
    estimatedHours: 24,
    actualHours: 22,
    materials: ['Johto 1.5mm²', 'Rasiat'],
    notes: ''
  },
  {
    id: 'WO-007',
    projectId: '1',
    projectName: 'Rivitalo A',
    title: 'Siivous asunto 1',
    description: 'Rakennussiivous putki- ja sähkötöiden jälkeen.',
    assignedTo: 'Sari V.',
    createdBy: 'Jethro',
    createdAt: '2026-01-15',
    dueDate: '2026-01-23',
    priority: 'low',
    status: 'open',
    category: 'Siivous',
    estimatedHours: 8,
    materials: ['Siivoustarvikkeet'],
    notes: 'Odota putki- ja sähkötöiden valmistumista'
  }
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'open':
      return <Badge className="bg-gray-100 text-gray-800">Avoin</Badge>;
    case 'in_progress':
      return <Badge className="bg-blue-100 text-blue-800">Käynnissä</Badge>;
    case 'completed':
      return <Badge className="bg-green-100 text-green-800">Valmis</Badge>;
    case 'cancelled':
      return <Badge className="bg-red-100 text-red-800">Peruttu</Badge>;
    default:
      return null;
  }
};

const getPriorityBadge = (priority: string) => {
  switch (priority) {
    case 'low':
      return <Badge variant="outline" className="text-gray-600">Matala</Badge>;
    case 'medium':
      return <Badge variant="outline" className="text-yellow-600">Normaali</Badge>;
    case 'high':
      return <Badge variant="outline" className="text-orange-600">Korkea</Badge>;
    case 'urgent':
      return <Badge className="bg-red-100 text-red-800">Kiireellinen</Badge>;
    default:
      return null;
  }
};

export default function Tyomaaraykset() {
  const [orders, setOrders] = useState<WorkOrder[]>(workOrders);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [newOrder, setNewOrder] = useState<Partial<WorkOrder>>({
    priority: 'medium',
    status: 'open',
    createdAt: new Date().toISOString().split('T')[0]
  });

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedOrders = [...orders].sort((a, b) => {
    if (!sortConfig) return 0;
    const aVal = a[sortConfig.key as keyof WorkOrder];
    const bVal = b[sortConfig.key as keyof WorkOrder];
    if (aVal === undefined || bVal === undefined) return 0;
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const filteredOrders = sortedOrders.filter(order =>
    order.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.assignedTo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStatusChange = (id: string, newStatus: WorkOrder['status']) => {
    setOrders(prev => prev.map(o =>
      o.id === id ? {
        ...o,
        status: newStatus,
        completedAt: newStatus === 'completed' ? new Date().toISOString().split('T')[0] : o.completedAt
      } : o
    ));
  };

  const handleAddOrder = () => {
    if (!newOrder.title || !newOrder.projectName || !newOrder.assignedTo) return;

    const order: WorkOrder = {
      id: `WO-${String(orders.length + 1).padStart(3, '0')}`,
      projectId: 'temp',
      projectName: newOrder.projectName || '',
      title: newOrder.title || '',
      description: newOrder.description || '',
      assignedTo: newOrder.assignedTo || '',
      createdBy: 'Jethro',
      createdAt: new Date().toISOString().split('T')[0],
      dueDate: newOrder.dueDate || '',
      priority: (newOrder.priority as WorkOrder['priority']) || 'medium',
      status: 'open',
      category: newOrder.category || 'Yleinen',
      estimatedHours: newOrder.estimatedHours || 0,
      materials: [],
      notes: newOrder.notes || ''
    };

    setOrders(prev => [order, ...prev]);
    setShowAddForm(false);
    setNewOrder({
      priority: 'medium',
      status: 'open',
      createdAt: new Date().toISOString().split('T')[0]
    });
  };

  const handleDelete = (id: string) => {
    setOrders(prev => prev.filter(o => o.id !== id));
  };

  const stats = {
    total: orders.length,
    open: orders.filter(o => o.status === 'open').length,
    inProgress: orders.filter(o => o.status === 'in_progress').length,
    completed: orders.filter(o => o.status === 'completed').length,
    urgent: orders.filter(o => o.priority === 'urgent' && o.status !== 'completed').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Työmääräykset</h1>
          <p className="text-gray-500 mt-1">Työmääräysten hallinta ja seuranta</p>
        </div>
        <Button
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAddForm ? 'Peruuta' : 'Uusi määräys'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: 'Määräykset', value: stats.total.toString(), icon: ClipboardList, color: 'text-blue-600' },
          { label: 'Avoimet', value: stats.open.toString(), icon: FileText, color: 'text-gray-600' },
          { label: 'Käynnissä', value: stats.inProgress.toString(), icon: Clock, color: 'text-blue-600' },
          { label: 'Valmiit', value: stats.completed.toString(), icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Kiireelliset', value: stats.urgent.toString(), icon: AlertTriangle, color: 'text-red-600' },
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

      {/* Add Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Uusi työmääräys</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Otsikko *</label>
                    <Input
                      placeholder="Määräyksen otsikko"
                      value={newOrder.title || ''}
                      onChange={(e) => setNewOrder(prev => ({ ...prev, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Projekti *</label>
                    <Input
                      placeholder="Projektin nimi"
                      value={newOrder.projectName || ''}
                      onChange={(e) => setNewOrder(prev => ({ ...prev, projectName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Vastuuhenkilö *</label>
                    <Input
                      placeholder="Kenelle määrätty"
                      value={newOrder.assignedTo || ''}
                      onChange={(e) => setNewOrder(prev => ({ ...prev, assignedTo: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Kategoria</label>
                    <Input
                      placeholder="Esim. Putkityöt"
                      value={newOrder.category || ''}
                      onChange={(e) => setNewOrder(prev => ({ ...prev, category: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Prioriteetti</label>
                    <select
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      value={newOrder.priority || 'medium'}
                      onChange={(e) => setNewOrder(prev => ({ ...prev, priority: e.target.value as WorkOrder['priority'] }))}
                    >
                      <option value="low">Matala</option>
                      <option value="medium">Normaali</option>
                      <option value="high">Korkea</option>
                      <option value="urgent">Kiireellinen</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Eräpäivä</label>
                    <Input
                      type="date"
                      value={newOrder.dueDate || ''}
                      onChange={(e) => setNewOrder(prev => ({ ...prev, dueDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Arvioidut tunnit</label>
                    <Input
                      type="number"
                      value={newOrder.estimatedHours || ''}
                      onChange={(e) => setNewOrder(prev => ({ ...prev, estimatedHours: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium mb-1 block">Kuvaus</label>
                    <Input
                      placeholder="Työn kuvaus"
                      value={newOrder.description || ''}
                      onChange={(e) => setNewOrder(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-sm font-medium mb-1 block">Muistiinpanot</label>
                    <Input
                      placeholder="Lisähuomautukset"
                      value={newOrder.notes || ''}
                      onChange={(e) => setNewOrder(prev => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <Button onClick={handleAddOrder} className="bg-blue-600 hover:bg-blue-700">
                    <Save className="w-4 h-4 mr-2" />
                    Tallenna
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Lista</TabsTrigger>
          <TabsTrigger value="kanban">Taulu</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Hae määräyksiä..."
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

          {/* Orders List */}
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono text-gray-500">{order.id}</span>
                          <h3 className="font-semibold">{order.title}</h3>
                          {getStatusBadge(order.status)}
                          {getPriorityBadge(order.priority)}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <ClipboardList className="w-3 h-3" />
                            {order.projectName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {order.assignedTo}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Eräpäivä: {new Date(order.dueDate).toLocaleDateString('fi-FI')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {order.estimatedHours} h
                          </span>
                        </div>
                      </div>
                      {expandedOrder === order.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>

                    {expandedOrder === order.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 pt-4 border-t space-y-4"
                      >
                        <p className="text-sm text-gray-700">{order.description}</p>

                        {order.materials.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-2">Materiaalit</h4>
                            <div className="flex flex-wrap gap-2">
                              {order.materials.map((mat, i) => (
                                <Badge key={i} variant="outline">{mat}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {order.notes && (
                          <div>
                            <h4 className="font-semibold text-sm mb-2">Muistiinpanot</h4>
                            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{order.notes}</p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Luotu:</span>
                            <p>{new Date(order.createdAt).toLocaleDateString('fi-FI')} ({order.createdBy})</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Arvioidut tunnit:</span>
                            <p>{order.estimatedHours} h</p>
                          </div>
                          {order.actualHours && (
                            <div>
                              <span className="text-gray-500">Toteutuneet tunnit:</span>
                              <p>{order.actualHours} h</p>
                            </div>
                          )}
                          {order.completedAt && (
                            <div>
                              <span className="text-gray-500">Valmistunut:</span>
                              <p>{new Date(order.completedAt).toLocaleDateString('fi-FI')}</p>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          {order.status === 'open' && (
                            <Button
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(order.id, 'in_progress'); }}
                            >
                              Aloita
                            </Button>
                          )}
                          {order.status === 'in_progress' && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(order.id, 'completed'); }}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Merkitse valmiiksi
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                            <Edit2 className="w-4 h-4 mr-1" />
                            Muokkaa
                          </Button>
                          <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                            <Printer className="w-4 h-4 mr-1" />
                            Tulosta
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleDelete(order.id); }}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Poista
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="kanban" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {['open', 'in_progress', 'completed', 'cancelled'].map((status) => {
              const statusOrders = filteredOrders.filter(o => o.status === status);
              const statusNames: Record<string, string> = {
                open: 'Avoin',
                in_progress: 'Käynnissä',
                completed: 'Valmis',
                cancelled: 'Peruttu'
              };
              const statusColors: Record<string, string> = {
                open: 'bg-gray-50',
                in_progress: 'bg-blue-50',
                completed: 'bg-green-50',
                cancelled: 'bg-red-50'
              };
              return (
                <div key={status} className={`rounded-lg p-3 ${statusColors[status]}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm">{statusNames[status]}</h3>
                    <Badge variant="outline">{statusOrders.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {statusOrders.map((order) => (
                      <Card key={order.id} className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-mono text-gray-500">{order.id}</span>
                            {getPriorityBadge(order.priority)}
                          </div>
                          <h4 className="font-medium text-sm">{order.title}</h4>
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                            <span>{order.assignedTo}</span>
                            <span>•</span>
                            <span>{order.estimatedHours} h</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Eräpäivä: {new Date(order.dueDate).toLocaleDateString('fi-FI')}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
