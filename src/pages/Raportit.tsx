import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileBarChart, TrendingUp, Clock, Star, Plus, Download, Printer,
  BarChart3, PieChart as PieChartIcon, Users, Wrench, ShieldCheck,
  Calendar, ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const reportTemplates = [
  { id: '1', name: 'Työaikaraportti', description: 'Työntekijöiden tuntikooste', icon: Clock, category: 'Työaika', popular: true },
  { id: '2', name: 'Projektiraportti', description: 'Projektien edistyminen ja kustannukset', icon: FileBarChart, category: 'Projektit', popular: true },
  { id: '3', name: 'Kustannusraportti', description: 'Kustannusanalyysi projekteittain', icon: TrendingUp, category: 'Taloudellinen', popular: false },
  { id: '4', name: 'Turvallisuusraportti', description: 'Turvallisuushavainnot ja toimenpiteet', icon: ShieldCheck, category: 'Turvallisuus', popular: true },
  { id: '5', name: 'Henkilöstoraportti', description: 'Henkilöstön käyttöaste ja koulutukset', icon: Users, category: 'Henkilöstö', popular: false },
  { id: '6', name: 'Kalustoraportti', description: 'Kaluston käyttö ja huollot', icon: Wrench, category: 'Kalusto', popular: false },
  { id: '7', name: 'Lomakeraportti', description: 'Lomakkeiden täyttöaste', icon: FileBarChart, category: 'Laatu', popular: false },
  { id: '8', name: 'Ympäristöraportti', description: 'Jätehuolto ja ympäristövaikutukset', icon: BarChart3, category: 'Ympäristö', popular: false },
];

const recentReports = [
  { id: '1', name: 'Tammikuun työaikaraportti', date: '15.1.2026', type: 'Työaika', format: 'PDF' },
  { id: '2', name: 'Projektien Q4 yhteenveto', date: '10.1.2026', type: 'Projektit', format: 'Excel' },
  { id: '3', name: 'Turvallisuusvuosikatsaus 2025', date: '5.1.2026', type: 'Turvallisuus', format: 'PDF' },
];

const categoryColors: Record<string, string> = {
  'Työaika': 'bg-blue-100 text-blue-600',
  'Projektit': 'bg-green-100 text-green-600',
  'Taloudellinen': 'bg-purple-100 text-purple-600',
  'Turvallisuus': 'bg-red-100 text-red-600',
  'Henkilöstö': 'bg-orange-100 text-orange-600',
  'Kalusto': 'bg-cyan-100 text-cyan-600',
  'Laatu': 'bg-pink-100 text-pink-600',
  'Ympäristö': 'bg-emerald-100 text-emerald-600',
};

export default function Raportit() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('templates');

  const filtered = reportTemplates.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Raportit</h1>
          <p className="text-gray-500 mt-1">Raporttipohjat ja analyysit</p>
        </div>
        <Button className="flex items-center gap-2 bg-primary hover:bg-primary-hover">
          <Plus className="w-4 h-4" /> Luo raportti
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="templates">Pohjat</TabsTrigger>
          <TabsTrigger value="recent">Viimeisimmät</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filtered.map((report, i) => {
              const colorClass = categoryColors[report.category] || 'bg-gray-100 text-gray-600';
              return (
                <motion.div key={report.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-10 h-10 rounded-lg ${colorClass} flex items-center justify-center`}>
                          <report.icon className="w-5 h-5" />
                        </div>
                        {report.popular && <Badge className="bg-yellow-100 text-yellow-800"><Star className="w-3 h-3 mr-1" /> Suosittu</Badge>}
                      </div>
                      <h3 className="font-medium text-sm mb-1">{report.name}</h3>
                      <p className="text-xs text-gray-500 mb-3">{report.description}</p>
                      <Badge variant="outline" className="text-xs">{report.category}</Badge>
                      <div className="flex gap-2 mt-3">
                        <Button variant="outline" size="sm" className="flex-1 text-xs"><Download className="w-3 h-3 mr-1" /> Lataa</Button>
                        <Button size="sm" className="flex-1 text-xs bg-primary hover:bg-primary-hover"><Printer className="w-3 h-3 mr-1" /> Tulosta</Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="recent" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-700">
                <div className="col-span-4">Raportti</div>
                <div className="col-span-2">Tyyppi</div>
                <div className="col-span-2">Pvm</div>
                <div className="col-span-1">Formaatti</div>
                <div className="col-span-3 text-right">Toiminnot</div>
              </div>
              {recentReports.map(r => (
                <div key={r.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors items-center">
                  <div className="col-span-4 font-medium text-sm flex items-center gap-2">
                    <FileBarChart className="w-4 h-4 text-primary" />
                    {r.name}
                  </div>
                  <div className="col-span-2 text-sm">{r.type}</div>
                  <div className="col-span-2 text-sm">{r.date}</div>
                  <div className="col-span-1"><Badge variant="outline">{r.format}</Badge></div>
                  <div className="col-span-3 text-right flex gap-2 justify-end">
                    <Button variant="outline" size="sm"><Download className="w-3 h-3 mr-1" /> Lataa</Button>
                    <Button variant="ghost" size="sm"><Printer className="w-3 h-3" /></Button>
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
