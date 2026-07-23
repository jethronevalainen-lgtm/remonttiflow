import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, Users, Euro, Target, UserPlus, Plus, Search, ChevronRight,
  Building2, Home, Phone, Mail, CheckCircle2, XCircle, Clock, ArrowRightLeft,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { cn } from '@/lib/utils';

interface Lead { id: string; name: string; company: string; status: string; assignedTo: string; value: number; priority: string; }
interface Offer { id: string; number: string; customer: string; amount: number; status: string; }

const LEADS: Lead[] = [
  { id: 'L001', name: 'Matti Korhonen', company: 'Korhonen perhe', status: 'Uusi', assignedTo: 'Matti K.', value: 180000, priority: 'Normaali' },
  { id: 'L002', name: 'Rakennus Oy Helsinki', company: 'Rakennus Oy Helsinki', status: 'Tarjous tehty', assignedTo: 'Anna L.', value: 340000, priority: 'Korkea' },
  { id: 'L003', name: 'As Oy Tampereen Keskusta', company: 'Asunto Oy Tampereen Keskusta', status: 'Neuvottelu', assignedTo: 'Matti K.', value: 2100000, priority: 'Kiireellinen' },
  { id: 'L004', name: 'Perhe Virtanen', company: 'Virtasen perhe', status: 'Sopimus', assignedTo: 'Pekka S.', value: 95000, priority: 'Normaali' },
  { id: 'L005', name: 'Kiinteistöhuolto Keskus', company: 'Kiinteistöhuolto Keskus Oy', status: 'Uusi', assignedTo: 'Jukka L.', value: 420000, priority: 'Normaali' },
  { id: 'L006', name: 'Perhe Mäkinen', company: 'Mäkisen perhe', status: 'Tarjous tehty', assignedTo: 'Anna L.', value: 145000, priority: 'Normaali' },
  { id: 'L007', name: 'Toimistotalo Oy', company: 'Toimistotalo Oy', status: 'Neuvottelu', assignedTo: 'Matti K.', value: 520000, priority: 'Korkea' },
  { id: 'L008', name: 'As Oy Hervanta', company: 'Asunto Oy Hervanta', status: 'Sopimus', assignedTo: 'Pekka S.', value: 1800000, priority: 'Korkea' },
  { id: 'L009', name: 'Liisa Virtanen', company: 'Liisa Virtanen', status: 'Uusi', assignedTo: 'Jukka L.', value: 75000, priority: 'Normaali' },
  { id: 'L010', name: 'Rakennusliike Lahti', company: 'Rakennusliike Lahti Oy', status: 'Otettu yhteyttä', assignedTo: 'Matti K.', value: 890000, priority: 'Korkea' },
  { id: 'L011', name: 'Perhe Nieminen', company: 'Niemisen perhe', status: 'Hylätty', assignedTo: 'Anna L.', value: 120000, priority: 'Normaali' },
  { id: 'L012', name: 'Taloyhtiö Pyynikki', company: 'Asunto Oy Pyynikki', status: 'Tarjous tehty', assignedTo: 'Pekka S.', value: 650000, priority: 'Korkea' },
];

const OFFERS: Offer[] = [
  { id: 'O001', number: 'TAR-2025-0042', customer: 'Rakennus Oy Helsinki', amount: 340000, status: 'Lähetetty' },
  { id: 'O002', number: 'TAR-2025-0039', customer: 'Perhe Virtanen', amount: 95000, status: 'Hyväksytty' },
  { id: 'O003', number: 'TAR-2025-0038', customer: 'As Oy Tampereen Keskusta', amount: 2100000, status: 'Lähetetty' },
  { id: 'O004', number: 'TAR-2025-0035', customer: 'Perhe Mäkinen', amount: 145000, status: 'Luonnos' },
  { id: 'O005', number: 'TAR-2025-0030', customer: 'Toimistotalo Oy', amount: 520000, status: 'Lähetetty' },
  { id: 'O006', number: 'TAR-2025-0028', customer: 'As Oy Hervanta', amount: 1800000, status: 'Hyväksytty' },
  { id: 'O007', number: 'TAR-2025-0025', customer: 'Taloyhtiö Pyynikki', amount: 650000, status: 'Lähetetty' },
  { id: 'O008', number: 'TAR-2025-0020', customer: 'Perhe Nieminen', amount: 120000, status: 'Hylätty' },
];

const FUNNEL_DATA = [
  { name: 'Uusi liidi', value: 12, fill: '#DBEAFE' },
  { name: 'Tarjous tehty', value: 8, fill: '#FFF7ED' },
  { name: 'Neuvottelu', value: 5, fill: '#FEF3C7' },
  { name: 'Sopimus', value: 3, fill: '#DCFCE7' },
];

const MONTHLY_LEADS = [
  { month: 'Tammi', leads: 8, deals: 2 },
  { month: 'Helmi', leads: 12, deals: 3 },
  { month: 'Maalis', leads: 10, deals: 4 },
  { month: 'Huhti', leads: 15, deals: 5 },
  { month: 'Touko', leads: 11, deals: 3 },
  { month: 'Kesä', leads: 14, deals: 4 },
  { month: 'Heinä', leads: 18, deals: 6 },
  { month: 'Elo', leads: 9, deals: 2 },
];

const SOURCE_DATA = [
  { name: 'Verkkosivu', value: 35, fill: '#F97316' },
  { name: 'Suosittelu', value: 28, fill: '#3B82F6' },
  { name: 'Messut', value: 15, fill: '#22C55E' },
  { name: 'Kylmäsoitto', value: 12, fill: '#F59E0B' },
  { name: 'Muu', value: 10, fill: '#8B5CF6' },
];

const formatCurrency = (val: number) => new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);

export default function CRM() {
  const [activeTab, setActiveTab] = useState('myyntiputki');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Kaikki');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const filteredLeads = useMemo(() => {
    return LEADS.filter(l => {
      const matchesSearch = !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.company.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'Kaikki' || l.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter]);

  const pipelineColumns = ['Uusi', 'Otettu yhteyttä', 'Tarjous tehty', 'Neuvottelu', 'Sopimus', 'Hylätty'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">CRM</h1>
        <Button className="gap-1.5 bg-primary hover:bg-primary-hover text-white"><Plus size={16} /> Uusi liidi</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center"><Target size={20} className="text-primary" /></div><div><p className="text-sm text-text-muted">Avoimet liidit</p><p className="text-xl font-bold text-text-primary">{LEADS.filter(l => l.status !== 'Sopimus' && l.status !== 'Hylätty').length}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-success-light flex items-center justify-center"><Euro size={20} className="text-success" /></div><div><p className="text-sm text-text-muted">Myyntiputken arvo</p><p className="text-xl font-bold text-text-primary">{formatCurrency(LEADS.reduce((s, l) => s + l.value, 0))}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-info-light flex items-center justify-center"><TrendingUp size={20} className="text-info" /></div><div><p className="text-sm text-text-muted">Konversio</p><p className="text-xl font-bold text-text-primary">25%</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-warning-light flex items-center justify-center"><UserPlus size={20} className="text-warning" /></div><div><p className="text-sm text-text-muted">Uudet kuussa</p><p className="text-xl font-bold text-text-primary">12</p></div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border">
          <TabsTrigger value="myyntiputki">Myyntiputki</TabsTrigger>
          <TabsTrigger value="liidit">Liidit</TabsTrigger>
          <TabsTrigger value="tarjoukset">Tarjoukset</TabsTrigger>
          <TabsTrigger value="analytiikka">Analytiikka</TabsTrigger>
        </TabsList>

        <TabsContent value="myyntiputki" className="mt-4">
          <div className="flex gap-4 overflow-x-auto pb-4">
            {pipelineColumns.map(col => {
              const colLeads = LEADS.filter(l => l.status === col);
              return (
                <div key={col} className="min-w-[240px] flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-text-primary text-sm">{col}</h3>
                    <Badge variant="outline">{colLeads.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {colLeads.map(lead => (
                      <motion.div key={lead.id} whileHover={{ scale: 1.02 }} className="p-3 bg-white rounded-lg border shadow-sm cursor-pointer" onClick={() => setSelectedLead(lead)}>
                        <p className="text-sm font-medium text-text-primary">{lead.name}</p>
                        <p className="text-xs text-text-muted">{lead.company}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs font-semibold text-primary">{formatCurrency(lead.value)}</span>
                          <Badge className={lead.priority === 'Kiireellinen' ? 'bg-danger-light text-danger' : lead.priority === 'Korkea' ? 'bg-warning-light text-warning' : 'bg-info-light text-info'}>{lead.priority}</Badge>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="liidit" className="mt-4 space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><Input placeholder="Hae liidejä..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-10 px-3 border rounded-lg text-sm bg-white">
              <option>Kaikki</option><option>Uusi</option><option>Otettu yhteyttä</option><option>Tarjous tehty</option><option>Neuvottelu</option><option>Sopimus</option><option>Hylätty</option>
            </select>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Nimi</TableHead><TableHead>Yritys</TableHead><TableHead>Status</TableHead><TableHead>Vastuullinen</TableHead><TableHead className="text-right">Arvo</TableHead></TableRow></TableHeader>
                <TableBody>{filteredLeads.map(lead => (<TableRow key={lead.id} className="cursor-pointer" onClick={() => setSelectedLead(lead)}><TableCell className="font-medium">{lead.name}</TableCell><TableCell>{lead.company}</TableCell><TableCell><Badge variant="outline">{lead.status}</Badge></TableCell><TableCell>{lead.assignedTo}</TableCell><TableCell className="text-right font-mono">{formatCurrency(lead.value)}</TableCell></TableRow>))}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tarjoukset" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Tarjousnro</TableHead><TableHead>Asiakas</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Summa</TableHead></TableRow></TableHeader>
                <TableBody>{OFFERS.map(offer => (<TableRow key={offer.id}><TableCell className="font-mono">{offer.number}</TableCell><TableCell>{offer.customer}</TableCell><TableCell><Badge className={offer.status === 'Hyväksytty' ? 'bg-success-light text-success' : offer.status === 'Hylätty' ? 'bg-danger-light text-danger' : 'bg-warning-light text-warning'}>{offer.status}</Badge></TableCell><TableCell className="text-right font-mono">{formatCurrency(offer.amount)}</TableCell></TableRow>))}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytiikka" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card><CardHeader><CardTitle className="text-base">Konversio</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={200}><BarChart data={FUNNEL_DATA} layout="vertical"><XAxis type="number" /><YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} /><Bar dataKey="value" radius={[0, 4, 4, 0]}>{FUNNEL_DATA.map((_, i) => <Cell key={i} fill={FUNNEL_DATA[i].fill} />)}</Bar></BarChart></ResponsiveContainer></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Liidit / Kaupat kuukausittain</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={200}><BarChart data={MONTHLY_LEADS}><XAxis dataKey="month" tick={{ fontSize: 12 }} /><YAxis /><CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" /><Bar dataKey="leads" fill="#3B82F6" /><Bar dataKey="deals" fill="#22C55E" /></BarChart></ResponsiveContainer></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Lähteet</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={200}><PieChart><Pie data={SOURCE_DATA} cx="50%" cy="50%" outerRadius={70} dataKey="value" strokeWidth={0}>{SOURCE_DATA.map((_, i) => <Cell key={i} fill={SOURCE_DATA[i].fill} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Lead Detail Dialog */}
      <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selectedLead?.name}</DialogTitle></DialogHeader>
          {selectedLead && (
            <div className="space-y-4">
              <div className="flex items-center gap-2"><Building2 size={16} className="text-text-muted" /><span>{selectedLead.company}</span></div>
              <div className="flex items-center gap-2"><Badge>{selectedLead.status}</Badge><Badge>{selectedLead.priority}</Badge></div>
              <p className="text-2xl font-bold text-primary">{formatCurrency(selectedLead.value)}</p>
              <Separator />
              <p className="text-sm text-text-muted">Vastuullinen: {selectedLead.assignedTo}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
