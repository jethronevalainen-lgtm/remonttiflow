import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, ClipboardCheck, Shield, PenTool, Plus, Search, Eye, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Form {
  id: string;
  name: string;
  category: string;
  description: string;
  filledCount: number;
  lastUpdated: string;
}

const FORMS: Form[] = [
  { id: 'F001', name: 'TYA-kortti', category: 'Työturvallisuus', description: 'Työnaikainen ajankohtaiskortti', filledCount: 145, lastUpdated: '22.7.2026' },
  { id: 'F002', name: 'Turvallisuushavainto', category: 'Työturvallisuus', description: 'Turvallisuushavainnon ilmoituslomake', filledCount: 23, lastUpdated: '20.7.2026' },
  { id: 'F003', name: 'Työtapaturmailmoitus', category: 'Työturvallisuus', description: 'Tapaturman ilmoitus', filledCount: 2, lastUpdated: '15.7.2026' },
  { id: 'F004', name: 'Kalustotarkastus', category: 'Laatu', description: 'Kaluston päivittäinen tarkastus', filledCount: 89, lastUpdated: '22.7.2026' },
  { id: 'F005', name: 'Laaduntarkastus', category: 'Laatu', description: 'Työn laaduntarkastuslomake', filledCount: 34, lastUpdated: '18.7.2026' },
  { id: 'F006', name: 'Ympäristöhavainto', category: 'Ympäristö', description: 'Ympäristöhavainnon ilmoitus', filledCount: 12, lastUpdated: '10.7.2026' },
  { id: 'F007', name: 'Päiväkirja', category: 'Hallinto', description: 'Työmaapäiväkirja', filledCount: 210, lastUpdated: '22.7.2026' },
  { id: 'F008', name: 'Riskiarvio', category: 'Työturvallisuus', description: 'Riskien arviointilomake', filledCount: 8, lastUpdated: '5.7.2026' },
];

const categoryColors: Record<string, string> = {
  'Työturvallisuus': '#EF4444',
  'Laatu': '#3B82F6',
  'Ympäristö': '#22C55E',
  'Hallinto': '#F97316',
};

export default function Lomakkeet() {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('Kaikki');

  const filtered = FORMS.filter(f => {
    const matchesSearch = !search || f.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = catFilter === 'Kaikki' || f.category === catFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Lomakkeet</h1>
        <Button className="gap-1.5 bg-primary hover:bg-primary-hover text-white"><Plus size={16} /> Uusi lomake</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {['Kaikki', 'Työturvallisuus', 'Laatu', 'Ympäristö', 'Hallinto'].map(c => (
          <Button key={c} variant={catFilter === c ? 'default' : 'outline'} size="sm" onClick={() => setCatFilter(c)} className={catFilter === c ? 'bg-primary' : ''}>{c}</Button>
        ))}
        <div className="flex-1" />
        <div className="relative w-64"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><Input placeholder="Hae lomakkeita..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
      </div>

      {/* Form Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((form, idx) => (
          <motion.div key={form.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-4 flex flex-col h-full">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: categoryColors[form.category] + '15' }}>
                    <FileText size={20} style={{ color: categoryColors[form.category] }} />
                  </div>
                  <Badge style={{ backgroundColor: categoryColors[form.category] + '20', color: categoryColors[form.category] }}>{form.category}</Badge>
                </div>
                <h3 className="font-semibold text-text-primary mb-1">{form.name}</h3>
                <p className="text-xs text-text-muted mb-3 flex-1">{form.description}</p>
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>{form.filledCount} täytetty</span>
                  <span>Viim. {form.lastUpdated}</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" className="flex-1 text-xs"><Eye size={12} /> Katso</Button>
                  <Button variant="outline" size="sm" className="flex-1 text-xs"><PenTool size={12} /> Täytä</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
