import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Shield, ClipboardCheck, Wrench, Award, TreePine, BookOpen,
  Search, Plus, Download, CheckCircle2, Clock, Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const forms = [
  { id: '1', name: 'Työmaapäiväkirja', category: 'TYA', description: 'Päivittäinen työmaakirjaus', icon: FileText, completed: 45, total: 60 },
  { id: '2', name: 'Turvallisuushavainto', category: 'Turvallisuus', description: 'Turvallisuushavainnon kirjaus', icon: Shield, completed: 12, total: 20 },
  { id: '3', name: 'Laatutarkastus', category: 'Laatu', description: 'Työn laadun tarkistuslomake', icon: ClipboardCheck, completed: 8, total: 15 },
  { id: '4', name: 'Kunnossapitotarkastus', category: 'Laatu', description: 'Kunnossapidon tarkistus', icon: Wrench, completed: 5, total: 10 },
  { id: '5', name: 'Koulutustodistus', category: 'Koulutus', description: 'Suoritetun koulutuksen todistus', icon: Award, completed: 18, total: 22 },
  { id: '6', name: 'Ympäristöhavainto', category: 'Ympäristö', description: 'Ympäristövaikutusten kirjaus', icon: TreePine, completed: 3, total: 12 },
  { id: '7', name: 'Riskinarviointi', category: 'Turvallisuus', description: 'Työmaa riskien arviointi', icon: Shield, completed: 6, total: 8 },
  { id: '8', name: 'Materiaalitarkastus', category: 'Laatu', description: 'Saapuvien materiaalien tarkistus', icon: ClipboardCheck, completed: 22, total: 30 },
];

const categories: Record<string, { icon: typeof FileText; color: string }> = {
  'TYA': { icon: FileText, color: 'bg-blue-100 text-blue-600' },
  'Turvallisuus': { icon: Shield, color: 'bg-red-100 text-red-600' },
  'Laatu': { icon: ClipboardCheck, color: 'bg-green-100 text-green-600' },
  'Koulutus': { icon: Award, color: 'bg-purple-100 text-purple-600' },
  'Ympäristö': { icon: TreePine, color: 'bg-emerald-100 text-emerald-600' },
};

export default function Lomakkeet() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const filtered = forms.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === 'all' || f.category === activeTab;
    return matchesSearch && matchesTab;
  });

  const totalCompleted = forms.reduce((s, f) => s + f.completed, 0);
  const totalForms = forms.reduce((s, f) => s + f.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lomakkeet</h1>
          <p className="text-gray-500 mt-1">Työlomakkeet ja dokumentaatio</p>
        </div>
        <Button className="flex items-center gap-2 bg-primary hover:bg-primary-hover">
          <Plus className="w-4 h-4" /> Uusi lomake
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-4">
              <FileText className="w-8 h-8 text-primary mb-2" />
              <p className="text-sm text-gray-500">Lomakkeita</p>
              <p className="text-2xl font-bold">{forms.length}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="p-4">
              <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
              <p className="text-sm text-gray-500">Täytetty</p>
              <p className="text-2xl font-bold text-green-600">{totalCompleted}/{totalForms}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="p-4">
              <Clock className="w-8 h-8 text-yellow-500 mb-2" />
              <p className="text-sm text-gray-500">Täyttöaste</p>
              <p className="text-2xl font-bold text-primary">{Math.round((totalCompleted / totalForms) * 100)}%</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Hae lomakkeista..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filtered.map(form => {
          const cat = categories[form.category] || { icon: FileText, color: 'bg-gray-100 text-gray-600' };
          const CatIcon = cat.icon;
          return (
            <motion.div key={form.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-4">
                  <div className={`w-10 h-10 rounded-lg ${cat.color} flex items-center justify-center mb-3`}>
                    <CatIcon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-sm">{form.name}</h3>
                  </div>
                  <Badge variant="outline" className="mb-2">{form.category}</Badge>
                  <p className="text-xs text-gray-500 mb-3">{form.description}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(form.completed / form.total) * 100}%` }} />
                    </div>
                    <span className="text-xs text-gray-500">{form.completed}/{form.total}</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm" className="flex-1"><Download className="w-3 h-3 mr-1" /> Lataa</Button>
                    <Button size="sm" className="flex-1 bg-primary hover:bg-primary-hover"><Plus className="w-3 h-3 mr-1" /> Täytä</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
