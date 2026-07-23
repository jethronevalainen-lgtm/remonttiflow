import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Edit2,
  Trash2,
  Copy,
  Euro,
  Users,
  Shield
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Form {
  id: string;
  name: string;
  category: string;
  description: string;
  projectId?: string;
  projectName?: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  submittedBy?: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  fileUrl?: string;
  version: number;
}

const forms: Form[] = [
  {
    id: '1',
    name: 'Työturvallisuussuunnitelma',
    category: 'Turvallisuus',
    description: 'Projektin työturvallisuussuunnitelma',
    projectId: '1',
    projectName: 'Rivitalo A',
    status: 'approved',
    submittedBy: 'Jethro',
    submittedAt: '2025-12-15',
    approvedBy: 'Timo K.',
    approvedAt: '2025-12-20',
    version: 1
  },
  {
    id: '2',
    name: 'Häiriöilmoitus #1',
    category: 'Häiriö',
    description: 'Naapurin valitus melusta',
    projectId: '1',
    projectName: 'Rivitalo A',
    status: 'submitted',
    submittedBy: 'Jethro',
    submittedAt: '2026-01-10',
    version: 1
  },
  {
    id: '3',
    name: 'Turvallisuustarkastus',
    category: 'Turvallisuus',
    description: 'Viikkotarkastus työmaalla',
    projectId: '2',
    projectName: 'Kerrostalo B',
    status: 'approved',
    submittedBy: 'Mika M.',
    submittedAt: '2026-01-08',
    approvedBy: 'Jethro',
    approvedAt: '2026-01-09',
    version: 1
  },
  {
    id: '4',
    name: 'Laatusuunnitelma',
    category: 'Laatu',
    description: 'Projektin laadunvarmistussuunnitelma',
    projectId: '3',
    projectName: 'Toimisto C',
    status: 'draft',
    version: 1
  },
  {
    id: '5',
    name: 'Työmaa-aikataulu',
    category: 'Aikataulu',
    description: 'Yksityiskohtainen työaikataulu',
    projectId: '1',
    projectName: 'Rivitalo A',
    status: 'approved',
    submittedBy: 'Jethro',
    submittedAt: '2025-12-10',
    approvedBy: 'Jethro',
    approvedAt: '2025-12-12',
    version: 2
  }
];

const formTemplates = [
  { name: 'Työturvallisuussuunnitelma', category: 'Turvallisuus' },
  { name: 'Häiriöilmoitus', category: 'Häiriö' },
  { name: 'Turvallisuustarkastus', category: 'Turvallisuus' },
  { name: 'Laatusuunnitelma', category: 'Laatu' },
  { name: 'Työmaa-aikataulu', category: 'Aikataulu' },
  { name: 'Perehdytyslomake', category: 'Henkilöstö' },
  { name: 'Katselmuspöytäkirja', category: 'Laatu' },
  { name: 'Hankintapyyntö', category: 'Hankinta' }
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'draft':
      return <Badge className="bg-gray-100 text-gray-800">Luonnos</Badge>;
    case 'submitted':
      return <Badge className="bg-blue-100 text-blue-800">Lähetetty</Badge>;
    case 'approved':
      return <Badge className="bg-green-100 text-green-800">Hyväksytty</Badge>;
    case 'rejected':
      return <Badge className="bg-red-100 text-red-800">Hylätty</Badge>;
    default:
      return null;
  }
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Turvallisuus':
      return <Shield className="w-4 h-4 text-red-500" />;
    case 'Henkilöstö':
      return <Users className="w-4 h-4 text-blue-500" />;
    default:
      return <FileText className="w-4 h-4 text-gray-500" />;
  }
};

export default function Lomakkeet() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('forms');

  const filteredForms = forms.filter(f =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (f.projectName && f.projectName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const stats = {
    total: forms.length,
    approved: forms.filter(f => f.status === 'approved').length,
    pending: forms.filter(f => f.status === 'submitted').length,
    draft: forms.filter(f => f.status === 'draft').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lomakkeet</h1>
          <p className="text-gray-500 mt-1">Työmaan lomakkeet ja asiakirjat</p>
        </div>
        <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          Uusi lomake
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Lomakkeet', value: stats.total.toString(), icon: FileText, color: 'text-blue-600' },
          { label: 'Hyväksytty', value: stats.approved.toString(), icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Odottaa', value: stats.pending.toString(), icon: Clock, color: 'text-yellow-600' },
          { label: 'Luonnokset', value: stats.draft.toString(), icon: AlertTriangle, color: 'text-gray-600' },
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
          <TabsTrigger value="forms">Lomakkeet</TabsTrigger>
          <TabsTrigger value="templates">Pohjat</TabsTrigger>
        </TabsList>

        <TabsContent value="forms" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Hae lomakkeita..."
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
                <div className="col-span-3">Nimi</div>
                <div className="col-span-1">Kategoria</div>
                <div className="col-span-2">Projekti</div>
                <div className="col-span-1">Tila</div>
                <div className="col-span-2">Lähettäjä / Päivä</div>
                <div className="col-span-1">Versio</div>
                <div className="col-span-2 text-right">Toiminnot</div>
              </div>
              {filteredForms.map((form) => (
                <div key={form.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 hover:bg-gray-50 items-center">
                  <div className="col-span-3 flex items-center gap-2">
                    {getCategoryIcon(form.category)}
                    <span className="font-medium">{form.name}</span>
                  </div>
                  <div className="col-span-1">
                    <Badge variant="outline">{form.category}</Badge>
                  </div>
                  <div className="col-span-2 text-sm">{form.projectName || '-'}</div>
                  <div className="col-span-1">{getStatusBadge(form.status)}</div>
                  <div className="col-span-2 text-sm">
                    <div>{form.submittedBy || '-'}</div>
                    <div className="text-gray-500">{form.submittedAt ? new Date(form.submittedAt).toLocaleDateString('fi-FI') : '-'}</div>
                  </div>
                  <div className="col-span-1 text-sm">v{form.version}</div>
                  <div className="col-span-2 flex justify-end gap-2">
                    <Button variant="ghost" size="sm"><Eye className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm"><Edit2 className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm"><Download className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {formTemplates.map((template, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <FileText className="w-5 h-5 text-gray-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">{template.name}</h3>
                        <Badge variant="outline" className="mt-1">{template.category}</Badge>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full mt-3">
                      <Copy className="w-3 h-3 mr-1" />
                      Käytä pohjaa
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
