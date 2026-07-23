import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Filter,
  ClipboardCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronRight,
  Calendar,
  User,
  MapPin,
  Wrench,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface WorkOrder {
  id: string;
  title: string;
  project: string;
  assignee: string;
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  dueDate: string;
  description: string;
  created: string;
}

const workOrders: WorkOrder[] = [
  { id: 'TM-1287', title: 'Sähkötyöt asuntoon 3B', project: 'Kerrostalo B', assignee: 'Jussi P.', priority: 'high', status: 'in_progress', dueDate: '18.1.2026', description: 'Sähköasennukset kylpyhuoneeseen', created: '15.1.2026' },
  { id: 'TM-1286', title: 'Laatoitus keittiö', project: 'Rivitalo A', assignee: 'Laura K.', priority: 'medium', status: 'open', dueDate: '22.1.2026', description: 'Keittiön lattian laatoitus', created: '14.1.2026' },
  { id: 'TM-1285', title: 'Putkitarkastus', project: 'Rivitalo A', assignee: 'Matti M.', priority: 'high', status: 'completed', dueDate: '16.1.2026', description: 'Putkityön välitarkastus', created: '13.1.2026' },
  { id: 'TM-1284', title: 'LVI-asennus', project: 'Kerrostalo B', assignee: 'Anna S.', priority: 'medium', status: 'in_progress', dueDate: '20.1.2026', description: 'LVI-työt asuntoihin', created: '12.1.2026' },
  { id: 'TM-1283', title: 'Maalaus olohuone', project: 'Toimisto C', assignee: 'Pekka H.', priority: 'low', status: 'open', dueDate: '25.1.2026', description: 'Seinämaalaus', created: '10.1.2026' },
  { id: 'TM-1282', title: 'Turvakierros', project: 'Rivitalo D', assignee: 'Matti M.', priority: 'high', status: 'cancelled', dueDate: '14.1.2026', description: 'Viikoittainen turvallisuustarkastus', created: '8.1.2026' },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'open': return <Badge variant="outline">Avoin</Badge>;
    case 'in_progress': return <Badge className="bg-blue-100 text-blue-800">Käynnissä</Badge>;
    case 'completed': return <Badge className="bg-green-100 text-green-800">Valmis</Badge>;
    case 'cancelled': return <Badge className="bg-red-100 text-red-800">Peruttu</Badge>;
    default: return null;
  }
};

const getPriorityBadge = (priority: string) => {
  switch (priority) {
    case 'high': return <Badge className="bg-red-100 text-red-800">Kiireellinen</Badge>;
    case 'medium': return <Badge className="bg-yellow-100 text-yellow-800">Normaali</Badge>;
    case 'low': return <Badge className="bg-blue-100 text-blue-800">Matala</Badge>;
    default: return null;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'open': return <Clock className="w-4 h-4 text-gray-500" />;
    case 'in_progress': return <Wrench className="w-4 h-4 text-blue-500" />;
    case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'cancelled': return <XCircle className="w-4 h-4 text-red-500" />;
    default: return null;
  }
};

export default function Tyomaaraykset() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const filtered = useMemo(() => {
    let items = workOrders;
    if (activeTab !== 'all') items = items.filter(w => w.status === activeTab);
    if (searchTerm) items = items.filter(w =>
      w.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.project.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return items;
  }, [searchTerm, activeTab]);

  const stats = {
    all: workOrders.length,
    open: workOrders.filter(w => w.status === 'open').length,
    in_progress: workOrders.filter(w => w.status === 'in_progress').length,
    completed: workOrders.filter(w => w.status === 'completed').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Työmääräykset</h1>
          <p className="text-gray-500 mt-1">Työmaaräysten hallinta ja seuranta</p>
        </div>
        <Button className="flex items-center gap-2 bg-primary hover:bg-primary-hover">
          <Plus className="w-4 h-4" /> Uusi määräys
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Kaikki', value: stats.all, tab: 'all' },
          { label: 'Avoinna', value: stats.open, tab: 'open' },
          { label: 'Käynnissä', value: stats.in_progress, tab: 'in_progress' },
          { label: 'Valmiit', value: stats.completed, tab: 'completed' },
        ].map(s => (
          <motion.div key={s.tab} whileHover={{ scale: 1.02 }} onClick={() => setActiveTab(s.tab)} className="cursor-pointer">
            <Card className={activeTab === s.tab ? 'border-primary' : ''}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-sm text-gray-500">{s.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Hae määräyksistä..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light" />
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {filtered.map(w => (
            <motion.div key={w.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(w.status)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 font-mono">{w.id}</span>
                          <span className="font-medium text-sm">{w.title}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{w.project}</span>
                          <span className="flex items-center gap-1"><User className="w-3 h-3" />{w.assignee}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{w.dueDate}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getPriorityBadge(w.priority)}
                      {getStatusBadge(w.status)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
