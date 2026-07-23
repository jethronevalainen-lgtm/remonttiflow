import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  Users,
  FileText,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  X,
  Save,
  ArrowUpDown,
  ClipboardCheck,
  HardHat,
  BookOpen,
  XCircle,
  TrendingDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SafetyObservation {
  id: string;
  projectId: string;
  projectName: string;
  date: string;
  reporter: string;
  type: 'risk' | 'incident' | 'near_miss' | 'improvement';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assignedTo?: string;
  dueDate?: string;
  resolution?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  photos: number;
  category: string;
}

interface SafetyInspection {
  id: string;
  projectId: string;
  projectName: string;
  date: string;
  inspector: string;
  type: 'daily' | 'weekly' | 'monthly' | 'special';
  findings: number;
  status: 'completed' | 'pending_actions';
  notes: string;
}

interface SafetyDocument {
  id: string;
  name: string;
  category: string;
  projectId?: string;
  projectName?: string;
  validFrom: string;
  validUntil: string;
  status: 'valid' | 'expiring' | 'expired';
  version: number;
}

const safetyObservations: SafetyObservation[] = [
  {
    id: 'TS-001',
    projectId: '1',
    projectName: 'Rivitalo A',
    date: '2026-01-15',
    reporter: 'Timo K.',
    type: 'risk',
    description: 'Työtaso ei ole riittävän vakaa korkealla työskentelyssä. Tarvitaan lisätuki.',
    severity: 'high',
    status: 'in_progress',
    assignedTo: 'Mika M.',
    dueDate: '2026-01-17',
    category: 'Putoamissuojaus'
  },
  {
    id: 'TS-002',
    projectId: '1',
    projectName: 'Rivitalo A',
    date: '2026-01-14',
    reporter: 'Laura K.',
    type: 'near_miss',
    description: 'Sähköjohto oli jäänyt roikkumaan lattialle käytävällä. Joku olisi voinut kompastua.',
    severity: 'medium',
    status: 'resolved',
    assignedTo: 'Laura K.',
    dueDate: '2026-01-14',
    resolution: 'Johdot kiinnitetty seinään ja varoitusnauha asennettu.',
    resolvedAt: '2026-01-14',
    resolvedBy: 'Laura K.',
    category: 'Sähköturvallisuus',
    photos: 1
  },
  {
    id: 'TS-003',
    projectId: '2',
    projectName: 'Kerrostalo B',
    date: '2026-01-15',
    reporter: 'Jussi P.',
    type: 'incident',
    description: 'Pieni naarmu lattiassa laatoituksen yhteydessä. Ei henkilövahinkoja.',
    severity: 'low',
    status: 'resolved',
    assignedTo: 'Jussi P.',
    dueDate: '2026-01-15',
    resolution: 'Laatta vaihdettu. Laadunvalvonta päivitetty.',
    resolvedAt: '2026-01-15',
    resolvedBy: 'Jussi P.',
    category: 'Laatu'
  },
  {
    id: 'TS-004',
    projectId: '2',
    projectName: 'Kerrostalo B',
    date: '2026-01-13',
    reporter: 'Timo K.',
    type: 'risk',
    description: 'Pölyäyksen riski purkutöissä. Naapuriasunnot altistuvat.',
    severity: 'high',
    status: 'in_progress',
    assignedTo: 'Timo K.',
    dueDate: '2026-01-16',
    category: 'Pölynhallinta'
  },
  {
    id: 'TS-005',
    projectId: '1',
    projectName: 'Rivitalo A',
    date: '2026-01-12',
    reporter: 'Mika M.',
    type: 'improvement',
    description: 'Ehdotetaan lisävalaistusta työskentelyalueelle. Nykyinen valaistus ei riitä iltatöihin.',
    severity: 'low',
    status: 'open',
    assignedTo: 'Jethro',
    dueDate: '2026-01-20',
    category: 'Valaistus'
  }
];

const safetyInspections: SafetyInspection[] = [
  {
    id: 'TI-001',
    projectId: '1',
    projectName: 'Rivitalo A',
    date: '2026-01-15',
    inspector: 'Jethro',
    type: 'daily',
    findings: 2,
    status: 'pending_actions',
    notes: 'Kaksi pientä huomautusta korjattava'
  },
  {
    id: 'TI-002',
    projectId: '1',
    projectName: 'Rivitalo A',
    date: '2026-01-14',
    inspector: 'Timo K.',
    type: 'daily',
    findings: 0,
    status: 'completed',
    notes: 'Kaikki kunnossa'
  },
  {
    id: 'TI-003',
    projectId: '2',
    projectName: 'Kerrostalo B',
    date: '2026-01-15',
    inspector: 'Jethro',
    type: 'daily',
    findings: 1,
    status: 'pending_actions',
    notes: 'Yksi korkean prioriteetin havainto'
  },
  {
    id: 'TI-004',
    projectId: '1',
    projectName: 'Rivitalo A',
    date: '2026-01-10',
    inspector: 'Jethro',
    type: 'weekly',
    findings: 3,
    status: 'completed',
    notes: 'Kaikki havainnot korjattu'
  }
];

const safetyDocuments: SafetyDocument[] = [
  {
    id: '1',
    name: 'Työturvallisuussuunnitelma',
    category: 'Suunnitelma',
    projectId: '1',
    projectName: 'Rivitalo A',
    validFrom: '2026-01-05',
    validUntil: '2026-03-15',
    status: 'valid',
    version: 1
  },
  {
    id: '2',
    name: 'Pelastussuunnitelma',
    category: 'Suunnitelma',
    projectId: '1',
    projectName: 'Rivitalo A',
    validFrom: '2025-12-01',
    validUntil: '2026-01-30',
    status: 'expiring',
    version: 1
  },
  {
    id: '3',
    name: 'Riskien arviointi',
    category: 'Arviointi',
    projectId: '2',
    projectName: 'Kerrostalo B',
    validFrom: '2026-01-08',
    validUntil: '2026-04-08',
    status: 'valid',
    version: 1
  },
  {
    id: '4',
    name: 'Koneiden tarkastuspöytäkirja',
    category: 'Tarkastus',
    validFrom: '2025-06-01',
    validUntil: '2025-12-31',
    status: 'expired',
    version: 2
  }
];

const getTypeBadge = (type: string) => {
  switch (type) {
    case 'risk':
      return <Badge className="bg-orange-100 text-orange-800">Riski</Badge>;
    case 'incident':
      return <Badge className="bg-red-100 text-red-800">Tapaturma</Badge>;
    case 'near_miss':
      return <Badge className="bg-yellow-100 text-yellow-800">Poisläheltä</Badge>;
    case 'improvement':
      return <Badge className="bg-blue-100 text-blue-800">Parannus</Badge>;
    default:
      return null;
  }
};

const getSeverityBadge = (severity: string) => {
  switch (severity) {
    case 'low':
      return <Badge variant="outline" className="text-gray-600">Matala</Badge>;
    case 'medium':
      return <Badge variant="outline" className="text-yellow-600">Keskitaso</Badge>;
    case 'high':
      return <Badge variant="outline" className="text-orange-600">Korkea</Badge>;
    case 'critical':
      return <Badge className="bg-red-100 text-red-800">Kriittinen</Badge>;
    default:
      return null;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'open':
      return <Badge className="bg-gray-100 text-gray-800">Avoin</Badge>;
    case 'in_progress':
      return <Badge className="bg-blue-100 text-blue-800">Käynnissä</Badge>;
    case 'resolved':
      return <Badge className="bg-green-100 text-green-800">Ratkaistu</Badge>;
    case 'closed':
      return <Badge className="bg-gray-100 text-gray-600">Suljettu</Badge>;
    default:
      return null;
  }
};

const getDocStatusBadge = (status: string) => {
  switch (status) {
    case 'valid':
      return <Badge className="bg-green-100 text-green-800">Voimassa</Badge>;
    case 'expiring':
      return <Badge className="bg-yellow-100 text-yellow-800">Vanhenemassa</Badge>;
    case 'expired':
      return <Badge className="bg-red-100 text-red-800">Vanhentunut</Badge>;
    default:
      return null;
  }
};

export default function Tyoturvallisuus() {
  const [observations, setObservations] = useState<SafetyObservation[]>(safetyObservations);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('observations');
  const [expandedObservation, setExpandedObservation] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newObservation, setNewObservation] = useState<Partial<SafetyObservation>>({
    type: 'risk',
    severity: 'medium',
    status: 'open',
    date: new Date().toISOString().split('T')[0],
    photos: 0,
    category: 'Yleinen'
  });

  const filteredObservations = observations.filter(obs =>
    obs.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    obs.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    obs.reporter.toLowerCase().includes(searchTerm.toLowerCase()) ||
    obs.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStatusChange = (id: string, newStatus: SafetyObservation['status']) => {
    setObservations(prev => prev.map(o =>
      o.id === id ? {
        ...o,
        status: newStatus,
        resolvedAt: newStatus === 'resolved' ? new Date().toISOString().split('T')[0] : o.resolvedAt,
        resolvedBy: newStatus === 'resolved' ? 'Jethro' : o.resolvedBy
      } : o
    ));
  };

  const handleAddObservation = () => {
    if (!newObservation.description || !newObservation.projectName) return;

    const obs: SafetyObservation = {
      id: `TS-${String(observations.length + 1).padStart(3, '0')}`,
      projectId: 'temp',
      projectName: newObservation.projectName || '',
      date: newObservation.date || new Date().toISOString().split('T')[0],
      reporter: 'Jethro',
      type: (newObservation.type as SafetyObservation['type']) || 'risk',
      description: newObservation.description || '',
      severity: (newObservation.severity as SafetyObservation['severity']) || 'medium',
      status: 'open',
      assignedTo: newObservation.assignedTo,
      dueDate: newObservation.dueDate,
      photos: 0,
      category: newObservation.category || 'Yleinen'
    };

    setObservations(prev => [obs, ...prev]);
    setShowAddForm(false);
    setNewObservation({
      type: 'risk',
      severity: 'medium',
      status: 'open',
      date: new Date().toISOString().split('T')[0],
      photos: 0,
      category: 'Yleinen'
    });
  };

  const stats = {
    totalObservations: observations.length,
    openObservations: observations.filter(o => o.status === 'open' || o.status === 'in_progress').length,
    resolvedObservations: observations.filter(o => o.status === 'resolved' || o.status === 'closed').length,
    criticalCount: observations.filter(o => o.severity === 'critical' || o.severity === 'high').filter(o => o.status !== 'resolved' && o.status !== 'closed').length,
    inspectionsCount: safetyInspections.length,
    expiringDocs: safetyDocuments.filter(d => d.status === 'expiring' || d.status === 'expired').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Työturvallisuus</h1>
          <p className="text-gray-500 mt-1">Turvallisuushavainnot, tarkastukset ja dokumentit</p>
        </div>
        <Button
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAddForm ? 'Peruuta' : 'Uusi havainto'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        {[
          { label: 'Havainnot', value: stats.totalObservations.toString(), icon: Shield, color: 'text-blue-600' },
          { label: 'Avoimet', value: stats.openObservations.toString(), icon: AlertTriangle, color: 'text-yellow-600' },
          { label: 'Ratkaistut', value: stats.resolvedObservations.toString(), icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Kriittiset', value: stats.criticalCount.toString(), icon: XCircle, color: 'text-red-600' },
          { label: 'Tarkastukset', value: stats.inspectionsCount.toString(), icon: ClipboardCheck, color: 'text-purple-600' },
          { label: 'Vanhentuvat dok.', value: stats.expiringDocs.toString(), icon: FileText, color: 'text-orange-600' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
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
                <CardTitle>Uusi turvallisuushavainto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Projekti *</label>
                    <Input
                      placeholder="Projektin nimi"
                      value={newObservation.projectName || ''}
                      onChange={(e) => setNewObservation(prev => ({ ...prev, projectName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Tyyppi</label>
                    <select
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      value={newObservation.type || 'risk'}
                      onChange={(e) => setNewObservation(prev => ({ ...prev, type: e.target.value as SafetyObservation['type'] }))}
                    >
                      <option value="risk">Riski</option>
                      <option value="incident">Tapaturma</option>
                      <option value="near_miss">Poisläheltä</option>
                      <option value="improvement">Parannus</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Vakavuus</label>
                    <select
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      value={newObservation.severity || 'medium'}
                      onChange={(e) => setNewObservation(prev => ({ ...prev, severity: e.target.value as SafetyObservation['severity'] }))}
                    >
                      <option value="low">Matala</option>
                      <option value="medium">Keskitaso</option>
                      <option value="high">Korkea</option>
                      <option value="critical">Kriittinen</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Kategoria</label>
                    <Input
                      placeholder="Esim. Putoamissuojaus"
                      value={newObservation.category || ''}
                      onChange={(e) => setNewObservation(prev => ({ ...prev, category: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Vastuuhenkilö</label>
                    <Input
                      placeholder="Kenelle määrätty"
                      value={newObservation.assignedTo || ''}
                      onChange={(e) => setNewObservation(prev => ({ ...prev, assignedTo: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Eräpäivä</label>
                    <Input
                      type="date"
                      value={newObservation.dueDate || ''}
                      onChange={(e) => setNewObservation(prev => ({ ...prev, dueDate: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-sm font-medium mb-1 block">Kuvaus *</label>
                    <Input
                      placeholder="Kuvaa havainto..."
                      value={newObservation.description || ''}
                      onChange={(e) => setNewObservation(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <Button onClick={handleAddObservation} className="bg-red-600 hover:bg-red-700">
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
          <TabsTrigger value="observations">Havainnot</TabsTrigger>
          <TabsTrigger value="inspections">Tarkastukset</TabsTrigger>
          <TabsTrigger value="documents">Dokumentit</TabsTrigger>
        </TabsList>

        {/* Observations Tab */}
        <TabsContent value="observations" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Hae havaintoja..."
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

          <div className="space-y-3">
            {filteredObservations.map((obs) => (
              <motion.div
                key={obs.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card
                  className={`cursor-pointer hover:shadow-md transition-shadow ${
                    obs.severity === 'critical' || obs.severity === 'high' ? 'border-red-200' : ''
                  }`}
                  onClick={() => setExpandedObservation(expandedObservation === obs.id ? null : obs.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-sm font-mono text-gray-500">{obs.id}</span>
                          {getTypeBadge(obs.type)}
                          {getSeverityBadge(obs.severity)}
                          {getStatusBadge(obs.status)}
                          {obs.photos > 0 && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {obs.photos} kuvaa
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            {obs.projectName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(obs.date).toLocaleDateString('fi-FI')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {obs.reporter}
                          </span>
                          <span>{obs.category}</span>
                          {obs.assignedTo && (
                            <span className="flex items-center gap-1">
                              <HardHat className="w-3 h-3" />
                              {obs.assignedTo}
                            </span>
                          )}
                          {obs.dueDate && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Eräpäivä: {new Date(obs.dueDate).toLocaleDateString('fi-FI')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 mt-2">{obs.description}</p>
                      </div>
                      {expandedObservation === obs.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>

                    {expandedObservation === obs.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 pt-4 border-t space-y-4"
                      >
                        {obs.resolution && (
                          <div>
                            <h4 className="font-semibold text-sm mb-2 text-green-700">Ratkaisu</h4>
                            <p className="text-sm text-gray-700 bg-green-50 p-3 rounded-lg">{obs.resolution}</p>
                            {obs.resolvedAt && obs.resolvedBy && (
                              <p className="text-xs text-gray-500 mt-1">
                                Ratkaistu {new Date(obs.resolvedAt).toLocaleDateString('fi-FI')} ({obs.resolvedBy})
                              </p>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-2">
                          {obs.status === 'open' && (
                            <Button
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(obs.id, 'in_progress'); }}
                            >
                              Aloita käsittely
                            </Button>
                          )}
                          {obs.status === 'in_progress' && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(obs.id, 'resolved'); }}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Merkitse ratkaistuksi
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                            <Edit2 className="w-4 h-4 mr-1" />
                            Muokkaa
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

        {/* Inspections Tab */}
        <TabsContent value="inspections" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-700">
                <div className="col-span-1">ID</div>
                <div className="col-span-2">Projekti</div>
                <div className="col-span-1">Päivä</div>
                <div className="col-span-1">Tyyppi</div>
                <div className="col-span-2">Tarkastaja</div>
                <div className="col-span-1">Havainnot</div>
                <div className="col-span-1">Tila</div>
                <div className="col-span-3">Muistiinpanot</div>
              </div>
              {safetyInspections.map((inspection) => (
                <div key={inspection.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 hover:bg-gray-50 items-center">
                  <div className="col-span-1 text-sm font-mono">{inspection.id}</div>
                  <div className="col-span-2 font-medium">{inspection.projectName}</div>
                  <div className="col-span-1 text-sm">{new Date(inspection.date).toLocaleDateString('fi-FI')}</div>
                  <div className="col-span-1">
                    <Badge variant="outline" className="text-xs">
                      {inspection.type === 'daily' ? 'Päivittäinen' :
                       inspection.type === 'weekly' ? 'Viikoittain' :
                       inspection.type === 'monthly' ? 'Kuukausittain' : 'Erikois'}
                    </Badge>
                  </div>
                  <div className="col-span-2 text-sm">{inspection.inspector}</div>
                  <div className="col-span-1">
                    <Badge className={inspection.findings > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}>
                      {inspection.findings}
                    </Badge>
                  </div>
                  <div className="col-span-1">
                    {inspection.status === 'completed' ? (
                      <Badge className="bg-green-100 text-green-800">Valmis</Badge>
                    ) : (
                      <Badge className="bg-yellow-100 text-yellow-800">Toimenpiteitä</Badge>
                    )}
                  </div>
                  <div className="col-span-3 text-sm text-gray-600">{inspection.notes}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-700">
                <div className="col-span-3">Nimi</div>
                <div className="col-span-1">Kategoria</div>
                <div className="col-span-2">Projekti</div>
                <div className="col-span-2">Voimassa</div>
                <div className="col-span-1">Tila</div>
                <div className="col-span-1">Versio</div>
                <div className="col-span-2 text-right">Toiminnot</div>
              </div>
              {safetyDocuments.map((doc) => (
                <div key={doc.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 hover:bg-gray-50 items-center">
                  <div className="col-span-3 font-medium flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-gray-400" />
                    {doc.name}
                  </div>
                  <div className="col-span-1">
                    <Badge variant="outline">{doc.category}</Badge>
                  </div>
                  <div className="col-span-2 text-sm">{doc.projectName || 'Yleinen'}</div>
                  <div className="col-span-2 text-sm">
                    <div>{new Date(doc.validFrom).toLocaleDateString('fi-FI')}</div>
                    <div className="text-gray-500">{new Date(doc.validUntil).toLocaleDateString('fi-FI')}</div>
                  </div>
                  <div className="col-span-1">{getDocStatusBadge(doc.status)}</div>
                  <div className="col-span-1 text-sm">v{doc.version}</div>
                  <div className="col-span-2 flex justify-end gap-2">
                    <Button variant="ghost" size="sm"><Edit2 className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm"><FileText className="w-4 h-4" /></Button>
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
