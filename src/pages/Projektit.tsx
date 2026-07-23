import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FolderKanban,
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
  customerName: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed';
  startDate: string;
  estimatedEndDate: string;
  budget: number;
  actualCosts: number;
  completionPercentage: number;
  teamSize: number;
}

const projects: Project[] = [
  {
    id: '1', name: 'Rivitalo A - Putkiremontti', address: 'Keltanenkatu 15', city: 'Helsinki',
    customerName: 'Asunto Oy Keltainen Tähti', status: 'active', startDate: '2026-01-05',
    estimatedEndDate: '2026-03-15', budget: 145000, actualCosts: 45000, completionPercentage: 35, teamSize: 5,
  },
  {
    id: '2', name: 'Kerrostalo B - Kylpyhuoneet', address: 'Sinikatu 42', city: 'Helsinki',
    customerName: 'Asunto Oy Sininen Talo', status: 'active', startDate: '2026-01-08',
    estimatedEndDate: '2026-04-30', budget: 85000, actualCosts: 12000, completionPercentage: 15, teamSize: 4,
  },
  {
    id: '3', name: 'Toimisto C - Peruskorjaus', address: 'Toimistokatu 1', city: 'Espoo',
    customerName: 'Helsingin Kaupunki', status: 'planning', startDate: '2026-02-01',
    estimatedEndDate: '2026-08-31', budget: 320000, actualCosts: 5000, completionPercentage: 2, teamSize: 0,
  },
  {
    id: '4', name: 'Rivitalo D - Sähkötyöt', address: 'Sähkökatu 7', city: 'Vantaa',
    customerName: 'Tmi Rakennus Rane', status: 'active', startDate: '2025-11-15',
    estimatedEndDate: '2026-02-28', budget: 35000, actualCosts: 28000, completionPercentage: 80, teamSize: 2,
  },
  {
    id: '5', name: 'Kerrostalo E - Julkisivu', address: 'Julkisivukatu 22', city: 'Helsinki',
    customerName: 'Asunto Oy Keltainen Tähti', status: 'on_hold', startDate: '2025-09-01',
    estimatedEndDate: '2025-12-15', budget: 180000, actualCosts: 175000, completionPercentage: 98, teamSize: 0,
  },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'planning': return <Badge variant="outline" className="text-gray-600">Suunnittelu</Badge>;
    case 'active': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Aktiivinen</Badge>;
    case 'on_hold': return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Tauolla</Badge>;
    case 'completed': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Valmis</Badge>;
    default: return null;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'planning': return <Clock className="w-4 h-4 text-gray-500" />;
    case 'active': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'on_hold': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    case 'completed': return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
    default: return null;
  }
};

export default function Projektit() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [activeTab, setActiveTab] = useState('list');

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig?.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sorted = [...projects].sort((a, b) => {
    if (!sortConfig) return 0;
    const av = a[sortConfig.key as keyof Project];
    const bv = b[sortConfig.key as keyof Project];
    if (av === undefined || bv === undefined) return 0;
    if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1;
    if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const filtered = sorted.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    planning: projects.filter(p => p.status === 'planning').length,
    totalBudget: projects.reduce((s, p) => s + p.budget, 0),
    totalActual: projects.reduce((s, p) => s + p.actualCosts, 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projektit</h1>
          <p className="text-gray-500 mt-1">Hallinnoi projekteja ja niiden etenemistä</p>
        </div>
        <Button className="flex items-center gap-2 bg-primary hover:bg-primary-hover">
          <Plus className="w-4 h-4" /> Uusi projekti
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Projektit yht.', value: stats.total, icon: FolderKanban, color: 'text-primary' },
          { label: 'Aktiiviset', value: stats.active, icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Suunnittelu', value: stats.planning, icon: Clock, color: 'text-gray-600' },
          { label: 'Budjetti yht.', value: `${(stats.totalBudget / 1000).toFixed(0)}k €`, icon: Euro, color: 'text-purple-600' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                </div>
                <s.icon className={`w-8 h-8 ${s.color} opacity-20`} />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list">Lista</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4 mt-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Hae projekteja..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Button variant="outline" size="sm"><Filter className="w-4 h-4 mr-1" /> Suodata</Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-700">
                <button className="col-span-3 flex items-center gap-1 hover:text-gray-900" onClick={() => handleSort('name')}>
                  Nimi <ArrowUpDown className="w-3 h-3" />
                </button>
                <div className="col-span-2">Asiakas</div>
                <div className="col-span-2">Tila</div>
                <div className="col-span-2">Edistyminen</div>
                <div className="col-span-3 text-right">Budjetti</div>
              </div>
              {filtered.map(p => (
                <div key={p.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors items-center">
                  <div className="col-span-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(p.status)}
                      <span className="font-medium text-sm">{p.name}</span>
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" />{p.address}, {p.city}
                    </div>
                  </div>
                  <div className="col-span-2 text-sm">{p.customerName}</div>
                  <div className="col-span-2">{getStatusBadge(p.status)}</div>
                  <div className="col-span-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className={`h-2 rounded-full ${p.completionPercentage >= 80 ? 'bg-green-500' : p.completionPercentage > 40 ? 'bg-blue-500' : 'bg-yellow-500'}`} style={{ width: `${p.completionPercentage}%` }} />
                    </div>
                    <span className="text-xs text-gray-500">{p.completionPercentage}%</span>
                  </div>
                  <div className="col-span-3 text-right">
                    <div className="font-medium text-sm">{p.budget.toLocaleString('fi-FI')} €</div>
                    <div className={`text-xs ${p.actualCosts > p.budget ? 'text-red-600' : 'text-gray-500'}`}>
                      {p.actualCosts.toLocaleString('fi-FI')} € toteutunut
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kanban" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {(['planning', 'active', 'on_hold', 'completed'] as const).map(status => {
              const sp = filtered.filter(p => p.status === status);
              const names: Record<string, string> = { planning: 'Suunnittelu', active: 'Aktiivinen', on_hold: 'Tauolla', completed: 'Valmis' };
              return (
                <div key={status} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm">{names[status]}</h3>
                    <Badge variant="outline">{sp.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {sp.map(p => (
                      <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardContent className="p-3">
                          <h4 className="font-medium text-sm">{p.name}</h4>
                          <p className="text-xs text-gray-500 mt-1">{p.customerName}</p>
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div className="bg-primary h-1.5 rounded-full" style={{ width: `${p.completionPercentage}%` }} />
                            </div>
                            <div className="flex justify-between mt-1 text-xs text-gray-500">
                              <span>{p.completionPercentage}%</span>
                              <span>{p.budget.toLocaleString('fi-FI')} €</span>
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
