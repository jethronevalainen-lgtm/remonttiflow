import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Euro,
  Target,
  Plus,
  Search,
  MoreHorizontal,
  Phone,
  Mail,
  Calendar,
  ChevronRight,
  Star,
  Building2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Lead {
  id: string;
  company: string;
  contact: string;
  value: number;
  stage: 'lead' | 'contact' | 'offer' | 'negotiation' | 'won' | 'lost';
  probability: number;
  lastContact: string;
  nextAction: string;
}

const leads: Lead[] = [
  { id: '1', company: 'Asunto Oy Uusi Koti', contact: 'Mikko M.', value: 185000, stage: 'negotiation', probability: 75, lastContact: '14.1.2026', nextAction: 'Tarjouksen lähetys' },
  { id: '2', company: 'Rakennus Oy Pohjola', contact: 'Sari L.', value: 420000, stage: 'offer', probability: 50, lastContact: '13.1.2026', nextAction: 'Neuvottelut' },
  { id: '3', company: 'Taloyhtiö Kruunuvuori', contact: 'Petri K.', value: 95000, stage: 'contact', probability: 30, lastContact: '12.1.2026', nextAction: 'Yhteydenotto' },
  { id: '4', company: 'Tmi Remontti-Ritari', contact: 'Leena R.', value: 65000, stage: 'won', probability: 100, lastContact: '10.1.2026', nextAction: 'Sopimuksen allekirjoitus' },
  { id: '5', company: 'Asunto Oy Merituuli', contact: 'Kari J.', value: 210000, stage: 'lead', probability: 15, lastContact: '15.1.2026', nextAction: 'Esittely' },
  { id: '6', company: 'Helsingin Kaupunki', contact: 'Anna T.', value: 580000, stage: 'negotiation', probability: 60, lastContact: '11.1.2026', nextAction: 'Hintaneuvottelut' },
];

const stageNames: Record<string, string> = {
  lead: 'Liidi', contact: 'Kontakti', offer: 'Tarjous', negotiation: 'Neuvottelu', won: 'Voitettu', lost: 'Hävitty'
};

const stageColors: Record<string, string> = {
  lead: 'bg-gray-100 text-gray-800',
  contact: 'bg-blue-100 text-blue-800',
  offer: 'bg-purple-100 text-purple-800',
  negotiation: 'bg-orange-100 text-orange-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800',
};

export default function CRM() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('pipeline');

  const filtered = leads.filter(l =>
    l.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.contact.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalValue = leads.reduce((s, l) => s + l.value, 0);
  const weightedValue = leads.reduce((s, l) => s + l.value * (l.probability / 100), 0);
  const wonValue = leads.filter(l => l.stage === 'won').reduce((s, l) => s + l.value, 0);

  const byStage = useMemo(() => {
    const stages = ['lead', 'contact', 'offer', 'negotiation', 'won', 'lost'] as const;
    return stages.map(stage => ({
      stage,
      name: stageNames[stage],
      leads: filtered.filter(l => l.stage === stage),
    }));
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CRM & Myynti</h1>
          <p className="text-gray-500 mt-1">Myyntiputki ja asiakassuhteet</p>
        </div>
        <Button className="flex items-center gap-2 bg-primary hover:bg-primary-hover">
          <Plus className="w-4 h-4" /> Uusi liidi
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Liidejä', value: leads.length, icon: Users },
          { label: 'Putken arvo', value: `${(totalValue / 1000).toFixed(0)}k €`, icon: Euro, color: 'text-primary' },
          { label: 'Painotettu', value: `${(weightedValue / 1000).toFixed(0)}k €`, icon: Target, color: 'text-blue-600' },
          { label: 'Voitettu', value: `${(wonValue / 1000).toFixed(0)}k €`, icon: TrendingUp, color: 'text-green-600' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color || ''}`}>{s.value}</p>
                </div>
                <s.icon className="w-8 h-8 text-gray-300" />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Hae liideistä..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pipeline">Putki</TabsTrigger>
          <TabsTrigger value="list">Lista</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {byStage.map(s => (
              <div key={s.stage} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">{s.name}</h3>
                  <Badge variant="outline">{s.leads.length}</Badge>
                </div>
                <div className="space-y-2">
                  {s.leads.map(lead => (
                    <Card key={lead.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-3">
                        <p className="font-medium text-sm">{lead.company}</p>
                        <p className="text-xs text-gray-500">{lead.contact}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs font-medium">{lead.value.toLocaleString('fi-FI')} €</span>
                          <span className="text-xs text-gray-500">{lead.probability}%</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-700">
                <div className="col-span-3">Yritys</div>
                <div className="col-span-2">Yhteyshenkilö</div>
                <div className="col-span-1">Vaihe</div>
                <div className="col-span-2">Arvo</div>
                <div className="col-span-1">Tod.</div>
                <div className="col-span-3">Seuraava toimenpide</div>
              </div>
              {filtered.map(lead => (
                <div key={lead.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors items-center">
                  <div className="col-span-3 font-medium text-sm">{lead.company}</div>
                  <div className="col-span-2 text-sm">{lead.contact}</div>
                  <div className="col-span-1"><Badge className={stageColors[lead.stage]}>{stageNames[lead.stage]}</Badge></div>
                  <div className="col-span-2 font-medium text-sm">{lead.value.toLocaleString('fi-FI')} €</div>
                  <div className="col-span-1 text-sm">{lead.probability}%</div>
                  <div className="col-span-3 text-sm text-gray-600">{lead.nextAction}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
