import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Users,
  Euro,
  ArrowUpDown,
  Edit2,
  Trash2,
  FileText,
  ChevronDown,
  ChevronUp,
  X,
  Save
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface WorkHourEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  projectId: string;
  projectName: string;
  date: string;
  startTime: string;
  endTime: string;
  breakDuration: number;
  totalHours: number;
  hourlyRate: number;
  totalCost: number;
  description: string;
  workType: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
}

const workHourEntries: WorkHourEntry[] = [
  {
    id: '1',
    employeeId: '1',
    employeeName: 'Mika Mäkinen',
    projectId: '1',
    projectName: 'Rivitalo A',
    date: '2026-01-15',
    startTime: '07:00',
    endTime: '15:30',
    breakDuration: 30,
    totalHours: 8,
    hourlyRate: 22.50,
    totalCost: 180,
    description: 'Putkiasennusta asunnoissa 1-2',
    workType: 'Putkityöt',
    status: 'approved',
    approvedBy: 'Jethro',
    approvedAt: '2026-01-15'
  },
  {
    id: '2',
    employeeId: '2',
    employeeName: 'Laura Korhonen',
    projectId: '2',
    projectName: 'Kerrostalo B',
    date: '2026-01-15',
    startTime: '07:30',
    endTime: '15:00',
    breakDuration: 30,
    totalHours: 7,
    hourlyRate: 24.00,
    totalCost: 168,
    description: 'Sähköasennusta kerros 1',
    workType: 'Sähkötyöt',
    status: 'pending'
  },
  {
    id: '3',
    employeeId: '3',
    employeeName: 'Jussi Puttonen',
    projectId: '1',
    projectName: 'Rivitalo A',
    date: '2026-01-15',
    startTime: '08:00',
    endTime: '14:00',
    breakDuration: 30,
    totalHours: 5.5,
    hourlyRate: 21.00,
    totalCost: 115.50,
    description: 'Laatoitusta kylpyhuoneessa',
    workType: 'Laatoitus',
    status: 'pending'
  },
  {
    id: '4',
    employeeId: '4',
    employeeName: 'Timo Kallio',
    projectId: '1',
    projectName: 'Rivitalo A',
    date: '2026-01-14',
    startTime: '07:00',
    endTime: '15:00',
    breakDuration: 60,
    totalHours: 7,
    hourlyRate: 19.50,
    totalCost: 136.50,
    description: 'Purkutyöt keittiössä',
    workType: 'Purkutyöt',
    status: 'approved',
    approvedBy: 'Jethro',
    approvedAt: '2026-01-14'
  },
  {
    id: '5',
    employeeId: '5',
    employeeName: 'Sari Virtanen',
    projectId: '1',
    projectName: 'Rivitalo A',
    date: '2026-01-15',
    startTime: '08:00',
    endTime: '14:00',
    breakDuration: 0,
    totalHours: 6,
    hourlyRate: 16.50,
    totalCost: 99,
    description: 'Rakennussiivous',
    workType: 'Siivous',
    status: 'pending'
  },
  {
    id: '6',
    employeeId: '1',
    employeeName: 'Mika Mäkinen',
    projectId: '1',
    projectName: 'Rivitalo A',
    date: '2026-01-14',
    startTime: '07:00',
    endTime: '15:30',
    breakDuration: 30,
    totalHours: 8,
    hourlyRate: 22.50,
    totalCost: 180,
    description: 'Putkiasennusta asunnoissa 2-3',
    workType: 'Putkityöt',
    status: 'approved',
    approvedBy: 'Jethro',
    approvedAt: '2026-01-14'
  }
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'pending':
      return <Badge className="bg-yellow-100 text-yellow-800">Odottaa</Badge>;
    case 'approved':
      return <Badge className="bg-green-100 text-green-800">Hyväksytty</Badge>;
    case 'rejected':
      return <Badge className="bg-red-100 text-red-800">Hylätty</Badge>;
    default:
      return null;
  }
};

export default function Tuntikirjaukset() {
  const [entries, setEntries] = useState<WorkHourEntry[]>(workHourEntries);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [newEntry, setNewEntry] = useState<Partial<WorkHourEntry>>({
    date: new Date().toISOString().split('T')[0],
    startTime: '07:00',
    endTime: '15:30',
    breakDuration: 30,
    status: 'pending'
  });

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedEntries = [...entries].sort((a, b) => {
    if (!sortConfig) return 0;
    const aVal = a[sortConfig.key as keyof WorkHourEntry];
    const bVal = b[sortConfig.key as keyof WorkHourEntry];
    if (aVal === undefined || bVal === undefined) return 0;
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const filteredEntries = sortedEntries.filter(entry =>
    entry.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.workType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleApprove = (id: string) => {
    setEntries(prev => prev.map(e =>
      e.id === id ? { ...e, status: 'approved' as const, approvedBy: 'Jethro', approvedAt: new Date().toISOString().split('T')[0] } : e
    ));
  };

  const handleReject = (id: string) => {
    setEntries(prev => prev.map(e =>
      e.id === id ? { ...e, status: 'rejected' as const } : e
    ));
  };

  const handleAddEntry = () => {
    if (!newEntry.employeeName || !newEntry.projectName || !newEntry.date) return;

    const start = new Date(`2000-01-01T${newEntry.startTime}`);
    const end = new Date(`2000-01-01T${newEntry.endTime}`);
    const breakMin = newEntry.breakDuration || 0;
    const hours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60) - breakMin / 60);
    const rate = newEntry.hourlyRate || 20;

    const entry: WorkHourEntry = {
      id: Date.now().toString(),
      employeeId: 'temp',
      employeeName: newEntry.employeeName || '',
      projectId: 'temp',
      projectName: newEntry.projectName || '',
      date: newEntry.date || '',
      startTime: newEntry.startTime || '07:00',
      endTime: newEntry.endTime || '15:30',
      breakDuration: breakMin,
      totalHours: Math.round(hours * 100) / 100,
      hourlyRate: rate,
      totalCost: Math.round(hours * rate * 100) / 100,
      description: newEntry.description || '',
      workType: newEntry.workType || 'Yleinen',
      status: 'pending'
    };

    setEntries(prev => [entry, ...prev]);
    setShowAddForm(false);
    setNewEntry({
      date: new Date().toISOString().split('T')[0],
      startTime: '07:00',
      endTime: '15:30',
      breakDuration: 30,
      status: 'pending'
    });
  };

  const handleDelete = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const stats = {
    totalEntries: entries.length,
    totalHours: entries.reduce((sum, e) => sum + e.totalHours, 0),
    totalCost: entries.reduce((sum, e) => sum + e.totalCost, 0),
    pendingCount: entries.filter(e => e.status === 'pending').length,
    approvedCount: entries.filter(e => e.status === 'approved').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tuntikirjaukset</h1>
          <p className="text-gray-500 mt-1">Työntekijöiden tuntikirjaukset ja hyväksyntä</p>
        </div>
        <Button
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAddForm ? 'Peruuta' : 'Uusi kirjaus'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: 'Kirjaukset', value: stats.totalEntries.toString(), icon: FileText, color: 'text-blue-600' },
          { label: 'Tunnit yht.', value: stats.totalHours.toFixed(1), icon: Clock, color: 'text-purple-600' },
          { label: 'Kustannukset', value: `${stats.totalCost.toFixed(0)} €`, icon: Euro, color: 'text-green-600' },
          { label: 'Odottaa', value: stats.pendingCount.toString(), icon: AlertTriangle, color: 'text-yellow-600' },
          { label: 'Hyväksytty', value: stats.approvedCount.toString(), icon: CheckCircle2, color: 'text-green-600' },
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
                <CardTitle>Uusi tuntikirjaus</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Työntekijä</label>
                    <Input
                      placeholder="Nimi"
                      value={newEntry.employeeName || ''}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, employeeName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Projekti</label>
                    <Input
                      placeholder="Projektin nimi"
                      value={newEntry.projectName || ''}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, projectName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Päivämäärä</label>
                    <Input
                      type="date"
                      value={newEntry.date || ''}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Aloitusaika</label>
                    <Input
                      type="time"
                      value={newEntry.startTime || '07:00'}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, startTime: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Lopetusaika</label>
                    <Input
                      type="time"
                      value={newEntry.endTime || '15:30'}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, endTime: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Tauko (min)</label>
                    <Input
                      type="number"
                      value={newEntry.breakDuration || 30}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, breakDuration: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Tuntipalkka (€)</label>
                    <Input
                      type="number"
                      step="0.5"
                      value={newEntry.hourlyRate || 20}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, hourlyRate: parseFloat(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Työn tyyppi</label>
                    <Input
                      placeholder="Esim. Putkityöt"
                      value={newEntry.workType || ''}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, workType: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-sm font-medium mb-1 block">Kuvaus</label>
                    <Input
                      placeholder="Mitä tehtiin?"
                      value={newEntry.description || ''}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <Button onClick={handleAddEntry} className="bg-blue-600 hover:bg-blue-700">
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
          <TabsTrigger value="list">Kirjaukset</TabsTrigger>
          <TabsTrigger value="summary">Yhteenveto</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {/* Search */}
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

          {/* Entries List */}
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-700">
                <button
                  className="col-span-2 flex items-center gap-1 hover:text-gray-900"
                  onClick={() => handleSort('employeeName')}
                >
                  Työntekijä <ArrowUpDown className="w-3 h-3" />
                </button>
                <button
                  className="col-span-1 flex items-center gap-1 hover:text-gray-900"
                  onClick={() => handleSort('date')}
                >
                  Päivä <ArrowUpDown className="w-3 h-3" />
                </button>
                <div className="col-span-1">Aika</div>
                <div className="col-span-1">Tauko</div>
                <div className="col-span-1">Tunnit</div>
                <div className="col-span-2">Kuvaus</div>
                <div className="col-span-1">Tyyppi</div>
                <div className="col-span-1">Kustannus</div>
                <div className="col-span-1">Tila</div>
                <div className="col-span-1 text-right">Toiminnot</div>
              </div>
              {filteredEntries.map((entry) => (
                <div key={entry.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 hover:bg-gray-50 items-center">
                  <div className="col-span-2 font-medium">{entry.employeeName}</div>
                  <div className="col-span-1 text-sm">{new Date(entry.date).toLocaleDateString('fi-FI')}</div>
                  <div className="col-span-1 text-sm">{entry.startTime}-{entry.endTime}</div>
                  <div className="col-span-1 text-sm">{entry.breakDuration} min</div>
                  <div className="col-span-1 font-medium">{entry.totalHours} h</div>
                  <div className="col-span-2 text-sm text-gray-600">{entry.description}</div>
                  <div className="col-span-1">
                    <Badge variant="outline" className="text-xs">{entry.workType}</Badge>
                  </div>
                  <div className="col-span-1 text-sm">{entry.totalCost.toFixed(2)} €</div>
                  <div className="col-span-1">{getStatusBadge(entry.status)}</div>
                  <div className="col-span-1 flex justify-end gap-1">
                    {entry.status === 'pending' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleApprove(entry.id)}
                          className="text-green-600"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReject(entry.id)}
                          className="text-red-600"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(entry.id)}
                    >
                      <Trash2 className="w-4 h-4 text-gray-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Työntekijöittäin
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from(new Set(entries.map(e => e.employeeName))).map(name => {
                    const empEntries = entries.filter(e => e.employeeName === name);
                    const totalHours = empEntries.reduce((sum, e) => sum + e.totalHours, 0);
                    const totalCost = empEntries.reduce((sum, e) => sum + e.totalCost, 0);
                    return (
                      <div key={name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <span className="font-medium">{name}</span>
                          <div className="text-sm text-gray-500">{empEntries.length} kirjaukset</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{totalHours.toFixed(1)} h</div>
                          <div className="text-sm text-gray-500">{totalCost.toFixed(0)} €</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Projektittain
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from(new Set(entries.map(e => e.projectName))).map(name => {
                    const projEntries = entries.filter(e => e.projectName === name);
                    const totalHours = projEntries.reduce((sum, e) => sum + e.totalHours, 0);
                    const totalCost = projEntries.reduce((sum, e) => sum + e.totalCost, 0);
                    return (
                      <div key={name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <span className="font-medium">{name}</span>
                          <div className="text-sm text-gray-500">{projEntries.length} kirjaukset</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{totalHours.toFixed(1)} h</div>
                          <div className="text-sm text-gray-500">{totalCost.toFixed(0)} €</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
