import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen,
  Plus,
  Search,
  Filter,
  MapPin,
  Users,
  Euro,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  ChevronRight,
  Briefcase,
  TrendingUp,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Project {
  id: string;
  name: string;
  address: string;
  city: string;
  customerId: string;
  customerName: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed';
  startDate: string;
  endDate?: string;
  estimatedEndDate: string;
  budget: number;
  actualCosts: number;
  completionPercentage: number;
  teamSize: number;
  description: string;
}

const projects: Project[] = [
  {
    id: '1',
    name: 'Rivitalo A - Putkiremontti',
    address: 'Keltanenkatu 15',
    city: 'Helsinki',
    customerId: '1',
    customerName: 'Asunto Oy Keltanen Tähti',
    status: 'active',
    startDate: '2026-01-05',
    estimatedEndDate: '2026-03-15',
    budget: 145000,
    actualCosts: 45000,
    completionPercentage: 35,
    teamSize: 5,
    description: 'Täysi putkiremontti rivitaloon. Vanhojen putkien purku ja uusien asennus.'
  },
  {
    id: '2',
    name: 'Kerrostalo B - Kylpyhuoneet',
    address: 'Sinikatu 42',
    city: 'Helsinki',
    customerId: '4',
    customerName: 'Asunto Oy Sininen Talo',
    status: 'active',
    startDate: '2026-01-08',
    estimatedEndDate: '2026-04-30',
    budget: 85000,
    actualCosts: 12000,
    completionPercentage: 15,
    teamSize: 4,
    description: 'Kylpyhuoneremontit kerrostalon 12 asuntoon.'
  },
  {
    id: '3',
    name: 'Toimisto C - Peruskorjaus',
    address: 'Toimistokatu 1',
    city: 'Espoo',
    customerId: '5',
    customerName: 'Helsingin Kaupunki',
    status: 'planning',
    startDate: '2026-02-01',
    estimatedEndDate: '2026-08-31',
    budget: 320000,
    actualCosts: 5000,
    completionPercentage: 2,
    teamSize: 0,
    description: 'Toimistotilan peruskorjaus. Uudet pinnat, kalusteet ja tilajärjestelyt.'
  },
  {
    id: '4',
    name: 'Rivitalo D - Sähkötyöt',
    address: 'Sähkökatu 7',
    city: 'Vantaa',
    customerId: '2',
    customerName: 'Tmi Rakennus Rane',
    status: 'active',
    startDate: '2025-11-15',
    estimatedEndDate: '2026-02-28',
    budget: 35000,
    actualCosts: 28000,
    completionPercentage: 80,
    teamSize: 2,
    description: 'Sähköasennukset rivitaloyksiköihin.'
  },
  {
    id: '5',
    name: 'Kerrostalo E - Julkisivu',
    address: 'Julkisivukatu 22',
    city: 'Helsinki',
    customerId: '1',
    customerName: 'Asunto Oy Keltanen Tähti',
    status: 'on_hold',
    startDate: '2025-09-01',
    endDate: '2025-12-15',
    estimatedEndDate: '2025-12-15',
    budget: 180000,
    actualCosts: 175000,
    completionPercentage: 98,
    teamSize: 0,
    description: 'Julkisivuremontti. Viemäriputkien korjaus taloyhtiölle.'
  }
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'planning':
      return <Badge className="bg-gray-100 text-gray-800">Suunnittelu</Badge>;
    case 'active':
      return <Badge className="bg-green-100 text-green-800">Aktiivinen</Badge>;
    case 'on_hold':
      return <Badge className="bg-yellow-100 text-yellow-800">Tauolla</Badge>;
    case 'completed':
      return <Badge className="bg-blue-100 text-blue-800">Valmis</Badge>;
    default:
      return null;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'planning':
      return <Clock className="w-4 h-4 text-gray-500" />;
    case 'active':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'on_hold':
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    case 'completed':
      return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
    default:
      return null;
  }
};

export default function Projektit() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [activeTab, setActiveTab] = useState('list');

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedProjects = [...projects].sort((a, b) => {
    if (!sortConfig) return 0;
    const aVal = a[sortConfig.key as keyof Project];
    const bVal = b[sortConfig.key as keyof Project];
    if (aVal === undefined || bVal === undefined) return 0;
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const filteredProjects = sortedProjects.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    planning: projects.filter(p => p.status === 'planning').length,
    totalBudget: projects.reduce((sum, p) => sum + p.budget, 0),
    totalActual: projects.reduce((sum, p) => sum + p.actualCosts, 0)
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projektit</h1>
          <p className="text-gray-500 mt-1">Hallinnoi projekteja ja niiden etenemistä</p>
        </div>
        <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          Uusi projekti
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Projektit', value: stats.total.toString(), icon: FolderOpen, color: 'text-blue-600' },
          { label: 'Aktiiviset', value: stats.active.toString(), icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Suunnittelu', value: stats.planning.toString(), icon: Clock, color: 'text-gray-600' },
          { label: 'Budjetti yht.', value: `${(stats.totalBudget / 1000).toFixed(0)}k €`, icon: Euro, color: 'text-purple-600' },
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
          <TabsTrigger value="list">Projektilista</TabsTrigger>
          <TabsTrigger value="kanban">Näkymä</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Hae projekteja..."
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

          {/* Project List */}
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-700">
                <button
                  className="col-span-3 flex items-center gap-1 hover:text-gray-900"
                  onClick={() => handleSort('name')}
                >
                  Nimi <ArrowUpDown className="w-3 h-3" />
                </button>
                <div className="col-span-2">Asiakas</div>
                <div className="col-span-1">Tila</div>
                <div className="col-span-2">Aikataulu</div>
                <div className="col-span-2">Edistyminen</div>
                <div className="col-span-2 text-right">Budjetti</div>
              </div>
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className="grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors items-center"
                >
                  <div className="col-span-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(project.status)}
                      <span className="font-medium">{project.name}</span>
                    </div>
                    <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" />
                      {project.address}, {project.city}
                    </div>
                  </div>
                  <div className="col-span-2 text-sm">{project.customerName}</div>
                  <div className="col-span-1">{getStatusBadge(project.status)}</div>
                  <div className="col-span-2 text-sm">
                    <div>{new Date(project.startDate).toLocaleDateString('fi-FI')}</div>
                    <div className="text-gray-500">{new Date(project.estimatedEndDate).toLocaleDateString('fi-FI')}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${project.completionPercentage >= 100 ? 'bg-blue-500' : project.completionPercentage > 50 ? 'bg-green-500' : 'bg-yellow-500'}`}
                          style={{ width: `${project.completionPercentage}%` }}
                        />
                      </div>
                      <span className="text-sm">{project.completionPercentage}%</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {project.teamSize} työntekijää
                    </div>
                  </div>
                  <div className="col-span-2 text-right">
                    <div className="font-medium">{project.budget.toLocaleString('fi-FI')} €</div>
                    <div className={`text-sm ${project.actualCosts > project.budget ? 'text-red-600' : 'text-gray-500'}`}>
                      {project.actualCosts.toLocaleString('fi-FI')} € toteutunut
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kanban" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {['planning', 'active', 'on_hold', 'completed'].map((status) => {
              const statusProjects = filteredProjects.filter(p => p.status === status);
              const statusNames: Record<string, string> = {
                planning: 'Suunnittelu',
                active: 'Aktiivinen',
                on_hold: 'Tauolla',
                completed: 'Valmis'
              };
              return (
                <div key={status} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm">{statusNames[status]}</h3>
                    <Badge variant="outline">{statusProjects.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {statusProjects.map((project) => (
                      <Card key={project.id} className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardContent className="p-3">
                          <h4 className="font-medium text-sm">{project.name}</h4>
                          <p className="text-xs text-gray-500 mt-1">{project.customerName}</p>
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div
                                className="bg-blue-500 h-1.5 rounded-full"
                                style={{ width: `${project.completionPercentage}%` }}
                              />
                            </div>
                            <div className="flex justify-between mt-1 text-xs text-gray-500">
                              <span>{project.completionPercentage}%</span>
                              <span>{project.budget.toLocaleString('fi-FI')} €</span>
                            </div>
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
