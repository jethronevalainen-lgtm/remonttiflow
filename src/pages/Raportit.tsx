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
  TrendingUp,
  BarChart3,
  PieChart,
  Calendar,
  Users,
  Euro,
  ChevronDown,
  ChevronUp,
  Printer,
  Share2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Report {
  id: string;
  name: string;
  category: string;
  description: string;
  projectId?: string;
  projectName?: string;
  createdBy: string;
  createdAt: string;
  period: string;
  status: 'draft' | 'final';
  fileUrl?: string;
}

const reports: Report[] = [
  {
    id: '1',
    name: 'Kustannusraportti Q4/2025',
    category: 'Kustannukset',
    description: 'Neljännesvuosittainen kustannusraportti',
    createdBy: 'Jethro',
    createdAt: '2026-01-05',
    period: 'Q4/2025',
    status: 'final'
  },
  {
    id: '2',
    name: 'Työturvallisuusraportti 2025',
    category: 'Turvallisuus',
    description: 'Vuosittainen työturvallisuusraportti',
    createdBy: 'Jethro',
    createdAt: '2026-01-10',
    period: '2025',
    status: 'final'
  },
  {
    id: '3',
    name: 'Projektiraportti - Rivitalo A',
    category: 'Projekti',
    description: 'Projektin edistymisraportti',
    projectId: '1',
    projectName: 'Rivitalo A',
    createdBy: 'Jethro',
    createdAt: '2026-01-15',
    period: 'Viikko 2/2026',
    status: 'draft'
  },
  {
    id: '4',
    name: 'Henkilöstöraportti 2025',
    category: 'Henkilöstö',
    description: 'Vuosittainen henkilöstöraportti',
    createdBy: 'Jethro',
    createdAt: '2026-01-08',
    period: '2025',
    status: 'final'
  },
  {
    id: '5',
    name: 'Laaturaportti - Kerrostalo B',
    category: 'Laatu',
    description: 'Laadunvalvontaraportti',
    projectId: '2',
    projectName: 'Kerrostalo B',
    createdBy: 'Mika M.',
    createdAt: '2026-01-12',
    period: 'Viikko 2/2026',
    status: 'final'
  }
];

const reportTemplates = [
  { name: 'Kustannusraportti', category: 'Kustannukset', icon: Euro },
  { name: 'Työturvallisuusraportti', category: 'Turvallisuus', icon: AlertTriangle },
  { name: 'Projektiraportti', category: 'Projekti', icon: FileText },
  { name: 'Henkilöstöraportti', category: 'Henkilöstö', icon: Users },
  { name: 'Laaturaportti', category: 'Laatu', icon: CheckCircle2 },
  { name: 'Aikatauluraportti', category: 'Aikataulu', icon: Calendar },
  { name: 'Tuntiraportti', category: 'Tunnit', icon: Clock },
  { name: 'Ympäristöraportti', category: 'Ympäristö', icon: BarChart3 }
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'draft':
      return <Badge className="bg-gray-100 text-gray-800">Luonnos</Badge>;
    case 'final':
      return <Badge className="bg-green-100 text-green-800">Valmis</Badge>;
    default:
      return null;
  }
};

export default function Raportit() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('reports');
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  const filteredReports = reports.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.projectName && r.projectName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const stats = {
    total: reports.length,
    final: reports.filter(r => r.status === 'final').length,
    draft: reports.filter(r => r.status === 'draft').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Raportit</h1>
          <p className="text-gray-500 mt-1">Työmaan raportit ja tilastot</p>
        </div>
        <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          Uusi raportti
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Raportit', value: stats.total.toString(), icon: FileText, color: 'text-blue-600' },
          { label: 'Valmiit', value: stats.final.toString(), icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Luonnokset', value: stats.draft.toString(), icon: Clock, color: 'text-gray-600' },
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
          <TabsTrigger value="reports">Raportit</TabsTrigger>
          <TabsTrigger value="templates">Mallit</TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Hae raportteja..."
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
            {filteredReports.map((report) => (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-blue-600" />
                          <h3 className="font-semibold">{report.name}</h3>
                          {getStatusBadge(report.status)}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span>{report.category}</span>
                          {report.projectName && <span>{report.projectName}</span>}
                          <span>{report.createdBy}</span>
                          <span>{new Date(report.createdAt).toLocaleDateString('fi-FI')}</span>
                          <span>{report.period}</span>
                        </div>
                      </div>
                      {expandedReport === report.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>

                    {expandedReport === report.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 pt-4 border-t"
                      >
                        <p className="text-sm text-gray-700">{report.description}</p>
                        <div className="flex items-center gap-2 mt-4">
                          <Button variant="outline" size="sm" className="flex items-center gap-1">
                            <Download className="w-4 h-4" />
                            Lataa PDF
                          </Button>
                          <Button variant="outline" size="sm" className="flex items-center gap-1">
                            <Printer className="w-4 h-4" />
                            Tulosta
                          </Button>
                          <Button variant="outline" size="sm" className="flex items-center gap-1">
                            <Share2 className="w-4 h-4" />
                            Jaa
                          </Button>
                          {report.status === 'draft' && (
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">Hyväksy</Button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportTemplates.map((template, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <template.icon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">{template.name}</h3>
                        <Badge variant="outline" className="mt-1">{template.category}</Badge>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full mt-3">
                      <Plus className="w-3 h-3 mr-1" />
                      Luo raportti
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
