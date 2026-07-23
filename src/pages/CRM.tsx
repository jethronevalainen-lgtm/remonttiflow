import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Euro,
  Target,
  UserPlus,
  Plus,
  FileBarChart,
  Phone,
  Mail,
  Building2,
  Home,
  Briefcase,
  Search,
  Filter,
  Eye,
  Edit3,
  Trash2,
  Send,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  FunnelChart,
  Funnel,
  LabelList,
} from 'recharts';
import { cn } from '@/lib/utils';

/* ─── Types ─── */
interface Lead {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  source: string;
  status: 'Uusi' | 'Otettu yhteyttä' | 'Tarjous tehty' | 'Neuvottelu' | 'Sopimus' | 'Hylätty';
  assignedTo: string;
  value: number;
  date: string;
  projectType: string;
  priority: 'Normaali' | 'Korkea' | 'Kiireellinen';
}

interface Contact {
  id: string;
  name: string;
  company: string;
  role: string;
  phone: string;
  email: string;
  type: 'Yritys' | 'Yksityinen' | 'Taloyhtiö';
}

interface Offer {
  id: string;
  number: string;
  customer: string;
  project: string;
  amount: number;
  validUntil: string;
  status: 'Luonnos' | 'Lähetetty' | 'Hyväksytty' | 'Hylätty';
  date: string;
}

/* ─── Mock Data ─── */
const LEADS: Lead[] = [
  { id: 'L001', name: 'Matti Korhonen', company: 'Korhonen perhe', phone: '040-1234567', email: 'matti.korhonen@email.fi', source: 'Verkkosivu', status: 'Uusi', assignedTo: 'Matti K.', value: 180000, date: '15.8.2025', projectType: 'Omakotitalo', priority: 'Normaali' },
  { id: 'L002', name: 'Rakennus Oy Helsinki', company: 'Rakennus Oy Helsinki', phone: '09-1234567', email: 'info@rakennusoy.fi', source: 'Suosittelu', status: 'Tarjous tehty', assignedTo: 'Anna L.', value: 340000, date: '20.7.2025', projectType: 'Toimisto', priority: 'Korkea' },
  { id: 'L003', name: 'As Oy Tampereen Keskusta', company: 'Asunto Oy Tampereen Keskusta', phone: '03-9876543', email: 'isannoitsija@aytampere.fi', source: 'Messut', status: 'Neuvottelu', assignedTo: 'Matti K.', value: 2100000, date: '10.7.2025', projectType: 'Kerrostalo', priority: 'Kiireellinen' },
  { id: 'L004', name: 'Perhe Virtanen', company: 'Virtasen perhe', phone: '040-9876543', email: 'virtanen.perhe@email.fi', source: 'Verkkosivu', status: 'Sopimus', assignedTo: 'Pekka S.', value: 95000, date: '1.7.2025', projectType: 'Omakotitalo', priority: 'Normaali' },
  { id: 'L005', name: 'Kiinteistöhuolto Keskus', company: 'Kiinteistöhuolto Keskus Oy', phone: '09-5554433', email: 'myynti@khkeskus.fi', source: 'Kylmäsoitto', status: 'Uusi', assignedTo: 'Jukka L.', value: 420000, date: '30.9.2025', projectType: 'Rivitalo', priority: 'Normaali' },
  { id: 'L006', name: 'Perhe Mäkinen', company: 'Mäkisen perhe', phone: '040-5566778', email: 'maki.perhe@email.fi', source: 'Suosittelu', status: 'Tarjous tehty', assignedTo: 'Anna L.', value: 145000, date: '5.8.2025', projectType: 'Omakotitalo', priority: 'Normaali' },
  { id: 'L007', name: 'Toimistotalo Oy', company: 'Toimistotalo Oy', phone: '09-1122334', email: 'info@toimistotalo.fi', source: 'Verkkosivu', status: 'Neuvottelu', assignedTo: 'Matti K.', value: 520000, date: '12.8.2025', projectType: 'Toimisto', priority: 'Korkea' },
  { id: 'L008', name: 'As Oy Hervanta', company: 'Asunto Oy Hervanta', phone: '03-4455667', email: 'isannoitsija@ayhervanta.fi', source: 'Messut', status: 'Sopimus', assignedTo: 'Pekka S.', value: 1800000, date: '25.7.2025', projectType: 'Kerrostalo', priority: 'Korkea' },
  { id: 'L009', name: 'Liisa Virtanen', company: 'Liisa Virtanen', phone: '040-2233445', email: 'liisa.virtanen@email.fi', source: 'Verkkosivu', status: 'Uusi', assignedTo: 'Jukka L.', value: 75000, date: '18.8.2025', projectType: 'Omakotitalo', priority: 'Normaali' },
  { id: 'L010', name: 'Rakennusliike Lahti', company: 'Rakennusliike Lahti Oy', phone: '03-6677889', email: 'myynti@rakennusliikel.fi', source: 'Suosittelu', status: 'Otettu yhteyttä', assignedTo: 'Matti K.', value: 890000, date: '22.8.2025', projectType: 'Toimisto', priority: 'Korkea' },
  { id: 'L011', name: 'Perhe Nieminen', company: 'Niemisen perhe', phone: '040-3344556', email: 'nieminen@email.fi', source: 'Kylmäsoitto', status: 'Hylätty', assignedTo: 'Anna L.', value: 120000, date: '10.6.2025', projectType: 'Rivitalo', priority: 'Normaali' },
  { id: 'L012', name: 'Taloyhtiö Pyynikki', company: 'Asunto Oy Pyynikki', phone: '03-2233445', email: 'isannoitsija@aypyynikki.fi', source: 'Messut', status: 'Tarjous tehty', assignedTo: 'Pekka S.', value: 650000, date: '28.8.2025', projectType: 'Kerrostalo', priority: 'Korkea' },
];

const CONTACTS: Contact[] = [
  { id: 'C001', name: 'Matti Korhonen', company: 'Korhonen perhe', role: 'Omistaja', phone: '040-1234567', email: 'matti.korhonen@email.fi', type: 'Yksityinen' },
  { id: 'C002', name: 'Anna Lindqvist', company: 'Rakennus Oy Helsinki', role: 'Toimitusjohtaja', phone: '09-1234567', email: 'anna.lindqvist@rakennusoy.fi', type: 'Yritys' },
  { id: 'C003', name: 'Jukka Mäkelä', company: 'Asunto Oy Tampereen Keskusta', role: 'Isännöitsijä', phone: '03-9876543', email: 'jukka.makela@aytampere.fi', type: 'Taloyhtiö' },
  { id: 'C004', name: 'Pekka Virtanen', company: 'Virtasen perhe', role: 'Omistaja', phone: '040-9876543', email: 'pekka.virtanen@email.fi', type: 'Yksityinen' },
  { id: 'C005', name: 'Sari Nieminen', company: 'Kiinteistöhuolto Keskus Oy', role: 'Myyntipäällikkö', phone: '09-5554433', email: 'sari.nieminen@khkeskus.fi', type: 'Yritys' },
  { id: 'C006', name: 'Laura Mäkinen', company: 'Mäkisen perhe', role: 'Omistaja', phone: '040-5566778', email: 'laura.makinen@email.fi', type: 'Yksityinen' },
  { id: 'C007', name: 'Timo Järvinen', company: 'Toimistotalo Oy', role: 'Kiinteistöpäällikkö', phone: '09-1122334', email: 'timo.jarvinen@toimistotalo.fi', type: 'Yritys' },
  { id: 'C008', name: 'Kirsi Hämäläinen', company: 'Asunto Oy Hervanta', role: 'Isännöitsijä', phone: '03-4455667', email: 'kirsi.hamalainen@ayhervanta.fi', type: 'Taloyhtiö' },
  { id: 'C009', name: 'Marko Laine', company: 'Rakennusliike Lahti Oy', role: 'Myyntijohtaja', phone: '03-6677889', email: 'marko.laine@rakennusliikel.fi', type: 'Yritys' },
  { id: 'C010', name: 'Heli Koskinen', company: 'Asunto Oy Pyynikki', role: 'Isännöitsijä', phone: '03-2233445', email: 'heli.koskinen@aypyynikki.fi', type: 'Taloyhtiö' },
];

const OFFERS: Offer[] = [
  { id: 'O001', number: 'TAR-2025-0042', customer: 'Rakennus Oy Helsinki', project: 'Toimistoremontti', amount: 340000, validUntil: '15.9.2025', status: 'Lähetetty', date: '15.8.2025' },
  { id: 'O002', number: 'TAR-2025-0039', customer: 'Perhe Virtanen', project: 'Keittiöremontti', amount: 95000, validUntil: '1.9.2025', status: 'Hyväksytty', date: '1.8.2025' },
  { id: 'O003', number: 'TAR-2025-0038', customer: 'As Oy Tampereen Keskusta', project: 'Julkisivuremontti', amount: 2100000, validUntil: '30.9.2025', status: 'Lähetetty', date: '10.7.2025' },
  { id: 'O004', number: 'TAR-2025-0035', customer: 'Perhe Mäkinen', project: 'Kylpyhuoneremontti', amount: 145000, validUntil: '20.8.2025', status: 'Luonnos', date: '5.8.2025' },
  { id: 'O005', number: 'TAR-2025-0030', customer: 'Toimistotalo Oy', project: 'Toimistoremontti', amount: 520000, validUntil: '15.8.2025', status: 'Lähetetty', date: '12.7.2025' },
  { id: 'O006', number: 'TAR-2025-0028', customer: 'As Oy Hervanta', project: 'Putkistoremontti', amount: 1800000, validUntil: '5.9.2025', status: 'Hyväksytty', date: '20.7.2025' },
  { id: 'O007', number: 'TAR-2025-0025', customer: 'Taloyhtiö Pyynikki', project: 'Kattoremontti', amount: 650000, validUntil: '30.8.2025', status: 'Lähetetty', date: '28.7.2025' },
  { id: 'O008', number: 'TAR-2025-0020', customer: 'Perhe Nieminen', project: 'Laajennus', amount: 120000, validUntil: '15.6.2025', status: 'Hylätty', date: '10.5.2025' },
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


/* ─── Helpers ─── */
const formatCurrency = (val: number) =>
  new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);

const priorityColor = (p: Lead['priority']) => {
  switch (p) {
    case 'Kiireellinen': return 'bg-danger-light text-danger border-danger/20';
    case 'Korkea': return 'bg-warning-light text-warning border-warning/20';
    default: return 'bg-info-light text-info border-info/20';
  }
};

const statusColor = (s: Lead['status']) => {
  switch (s) {
    case 'Sopimus': return 'bg-success-light text-success';
    case 'Neuvottelu': return 'bg-warning-light text-warning';
    case 'Tarjous tehty': return 'bg-primary-light text-primary';
    case 'Hylätty': return 'bg-destructive-light text-destructive';
    default: return 'bg-info-light text-info';
  }
};

const offerStatusColor = (s: Offer['status']) => {
  switch (s) {
    case 'Hyväksytty': return 'bg-success-light text-success';
    case 'Lähetetty': return 'bg-info-light text-info';
    case 'Hylätty': return 'bg-destructive-light text-destructive';
    default: return 'bg-warning-light text-warning';
  }
};

const projectTypeIcon = (type: string) => {
  switch (type) {
    case 'Toimisto': return <Briefcase size={14} className="text-text-secondary" />;
    case 'Kerrostalo': return <Building2 size={14} className="text-text-secondary" />;
    case 'Rivitalo': return <Home size={14} className="text-text-secondary" />;
    default: return <Home size={14} className="text-text-secondary" />;
  }
};

const avatarColor = (name: string) => {
  const colors = ['bg-primary/10 text-primary', 'bg-info/10 text-info', 'bg-success/10 text-success', 'bg-warning/10 text-warning'];
  return colors[name.charCodeAt(0) % colors.length];
};

const avatarInitials = (name: string) => {
  const parts = name.split(' ');
  return parts.map(p => p[0]).join('').slice(0, 2).toUpperCase();
};

/* ─── Sub-components ─── */

function KPICard({ title, value, trend, trendUp, icon: Icon }: { title: string; value: string; trend: string; trendUp: boolean; icon: React.ComponentType<{ className?: string; size?: number }> }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
    >
      <Card className="border border-[#E2E8F0] shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-caption text-text-secondary uppercase tracking-wider">{title}</p>
              <p className="text-[28px] font-bold font-mono text-text-primary leading-none">{value}</p>
              <div className="flex items-center gap-1">
                {trendUp ? <TrendingUp size={14} className="text-success" /> : <TrendingDown size={14} className="text-danger" />}
                <span className={cn('text-caption font-medium', trendUp ? 'text-success' : 'text-danger')}>
                  {trend}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center">
              <Icon size={20} className="text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function KanbanCard({ lead, index }: { lead: Lead; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
      className="bg-white border border-[#E2E8F0] rounded-[10px] p-3 cursor-pointer hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200 group"
    >
      <div className="flex items-center gap-2 mb-2">
        {projectTypeIcon(lead.projectType)}
        <span className="text-xs text-text-secondary">{lead.projectType}</span>
      </div>
      <p className="text-sm font-semibold text-text-primary mb-1">{lead.name}</p>
      <p className="text-mono text-[15px] font-semibold text-primary mb-2">
        {formatCurrency(lead.value)}
      </p>
      <div className="flex items-center justify-between">
        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0.5', priorityColor(lead.priority))}>
          {lead.priority}
        </Badge>
        <div className="flex items-center gap-1.5">
          <Avatar className="w-5 h-5">
            <AvatarFallback className={cn('text-[8px] font-semibold', avatarColor(lead.assignedTo))}>
              {avatarInitials(lead.assignedTo)}
            </AvatarFallback>
          </Avatar>
          <span className="text-[10px] text-text-muted">{lead.date}</span>
        </div>
      </div>
    </motion.div>
  );
}

function KanbanColumn({ title, color, leads, count }: { title: string; color: string; leads: Lead[]; count: number }) {
  const totalValue = leads.reduce((sum, l) => sum + l.value, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
      className="flex flex-col min-w-[260px] flex-1"
    >
      <div className={cn('rounded-t-lg px-4 py-3', color)}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          <Badge variant="secondary" className="bg-white/80 text-text-primary text-xs font-mono">
            {count}
          </Badge>
        </div>
      </div>
      <div className="bg-[#F8FAFC] rounded-b-lg p-3 space-y-3 min-h-[400px]">
        <div className="h-[420px] overflow-auto">
          <div className="space-y-3 pr-2">
            {leads.map((lead, i) => (
              <KanbanCard key={lead.id} lead={lead} index={i} />
            ))}
          </div>
        </div>
        <div className="pt-2 border-t border-[#E2E8F0]">
          <p className="text-xs text-text-secondary text-center">
            Yhteensä: <span className="font-mono font-semibold text-text-primary">{formatCurrency(totalValue)}</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Main Component ─── */
export default function CRM() {
  const [activeTab, setActiveTab] = useState('pipeline');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [offerStatusFilter, setOfferStatusFilter] = useState<string>('all');
  const [contactSearch, setContactSearch] = useState('');
  const [contactTypeFilter, setContactTypeFilter] = useState<string>('all');

  const filteredLeads = useMemo(() => {
    return LEADS.filter(l => {
      const matchSearch = searchQuery === '' ||
        l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.company.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === 'all' || l.status === statusFilter;
      const matchSource = sourceFilter === 'all' || l.source === sourceFilter;
      return matchSearch && matchStatus && matchSource;
    });
  }, [searchQuery, statusFilter, sourceFilter]);

  const filteredOffers = useMemo(() => {
    return OFFERS.filter(o => {
      const matchStatus = offerStatusFilter === 'all' || o.status === offerStatusFilter;
      const matchSearch = searchQuery === '' ||
        o.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.number.toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [offerStatusFilter, searchQuery]);

  const filteredContacts = useMemo(() => {
    return CONTACTS.filter(c => {
      const matchSearch = contactSearch === '' ||
        c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
        c.company.toLowerCase().includes(contactSearch.toLowerCase());
      const matchType = contactTypeFilter === 'all' || c.type === contactTypeFilter;
      return matchSearch && matchType;
    });
  }, [contactSearch, contactTypeFilter]);

  const uusiLeads = LEADS.filter(l => l.status === 'Uusi');
  const tarjousLeads = LEADS.filter(l => l.status === 'Tarjous tehty');
  const neuvotteluLeads = LEADS.filter(l => l.status === 'Neuvottelu');
  const sopimusLeads = LEADS.filter(l => l.status === 'Sopimus');

  const totalPipelineValue = LEADS.filter(l => l.status !== 'Sopimus' && l.status !== 'Hylätty').reduce((s, l) => s + l.value, 0);
  const contractedValue = LEADS.filter(l => l.status === 'Sopimus').reduce((s, l) => s + l.value, 0);
  const conversionRate = Math.round((LEADS.filter(l => l.status === 'Sopimus').length / LEADS.filter(l => l.status === 'Uusi').length) * 100);
  const newLeadsThisMonth = LEADS.filter(l => l.status === 'Uusi').length;

  const totalOffers = OFFERS.length;
  const acceptedOffers = OFFERS.filter(o => o.status === 'Hyväksytty').length;
  const acceptanceRate = Math.round((acceptedOffers / totalOffers) * 100);
  const avgOfferAmount = Math.round(OFFERS.reduce((s, o) => s + o.amount, 0) / totalOffers);

  const tabChange = (val: string) => {
    setActiveTab(val);
    setSearchQuery('');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
      className="space-y-6"
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-hero text-text-primary">CRM</h1>
          <p className="text-body-sm text-text-secondary mt-1">Asiakassuhteiden hallinta ja myyntiprosessi</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-[#E2E8F0] text-text-secondary hover:bg-bg-light">
            <FileBarChart size={16} className="mr-2" />
            Raportti
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary-hover text-white">
                <Plus size={16} className="mr-2" />
                Uusi liidi
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-h2">Lisää uusi liidi</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary">Nimi</label>
                    <Input placeholder="Asiakkaan nimi" className="border-[#E2E8F0]" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary">Yritys</label>
                    <Input placeholder="Yrityksen nimi" className="border-[#E2E8F0]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary">Puhelin</label>
                    <Input placeholder="040-1234567" className="border-[#E2E8F0]" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary">Sähköposti</label>
                    <Input placeholder="sahkoposti@email.fi" className="border-[#E2E8F0]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary">Arvo (€)</label>
                    <Input type="number" placeholder="0" className="border-[#E2E8F0]" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary">Lähde</label>
                    <Select>
                      <SelectTrigger className="border-[#E2E8F0]">
                        <SelectValue placeholder="Valitse lähde" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="verkkosivu">Verkkosivu</SelectItem>
                        <SelectItem value="suosittelu">Suosittelu</SelectItem>
                        <SelectItem value="messut">Messut</SelectItem>
                        <SelectItem value="kylmasoitto">Kylmäsoitto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary">Projektin tyyppi</label>
                  <Select>
                    <SelectTrigger className="border-[#E2E8F0]">
                      <SelectValue placeholder="Valitse tyyppi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="omakotitalo">Omakotitalo</SelectItem>
                      <SelectItem value="rivitalo">Rivitalo</SelectItem>
                      <SelectItem value="kerrostalo">Kerrostalo</SelectItem>
                      <SelectItem value="toimisto">Toimisto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full bg-primary hover:bg-primary-hover text-white">
                  Tallenna liidi
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={tabChange} className="space-y-6">
        <TabsList className="bg-bg-light border border-[#E2E8F0] p-1">
          <TabsTrigger value="pipeline" className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
            Myyntiputki
          </TabsTrigger>
          <TabsTrigger value="leads" className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
            Liidit
          </TabsTrigger>
          <TabsTrigger value="offers" className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
            Tarjoukset
          </TabsTrigger>
          <TabsTrigger value="contacts" className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
            Yhteystiedot
          </TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
            Analytiikka
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Myyntiputki ── */}
        <TabsContent value="pipeline" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="Avoimet mahdollisuudet" value={String(LEADS.filter(l => l.status !== 'Sopimus' && l.status !== 'Hylätty').length)} trend="+3 uutta" trendUp={true} icon={Target} />
            <KPICard title="Myyntiputken arvo" value={formatCurrency(totalPipelineValue)} trend="+125 000 €" trendUp={true} icon={Euro} />
            <KPICard title="Konversioaste" value={`${conversionRate}%`} trend="+5 %" trendUp={true} icon={TrendingUp} />
            <KPICard title="Uudet liidit kuussa" value={String(newLeadsThisMonth)} trend="+2" trendUp={true} icon={UserPlus} />
          </div>

          {/* Kanban Board */}
          <div className="flex gap-4 overflow-x-auto pb-2">
            <KanbanColumn title="Uusi liidi" color="bg-[#DBEAFE]" leads={uusiLeads} count={uusiLeads.length} />
            <KanbanColumn title="Tarjous tehty" color="bg-[#FFF7ED]" leads={tarjousLeads} count={tarjousLeads.length} />
            <KanbanColumn title="Neuvottelu" color="bg-[#FEF3C7]" leads={neuvotteluLeads} count={neuvotteluLeads.length} />
            <KanbanColumn title="Sopimus" color="bg-[#DCFCE7]" leads={sopimusLeads} count={sopimusLeads.length} />
          </div>
        </TabsContent>

        {/* ── Tab: Liidit ── */}
        <TabsContent value="leads" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input
                placeholder="Hae liidejä..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 border-[#E2E8F0]"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] border-[#E2E8F0]">
                <Filter size={14} className="mr-2 text-text-muted" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Kaikki status</SelectItem>
                <SelectItem value="Uusi">Uusi</SelectItem>
                <SelectItem value="Otettu yhteyttä">Otettu yhteyttä</SelectItem>
                <SelectItem value="Tarjous tehty">Tarjous tehty</SelectItem>
                <SelectItem value="Neuvottelu">Neuvottelu</SelectItem>
                <SelectItem value="Sopimus">Sopimus</SelectItem>
                <SelectItem value="Hylätty">Hylätty</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[180px] border-[#E2E8F0]">
                <SelectValue placeholder="Lähde" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Kaikki lähteet</SelectItem>
                <SelectItem value="Verkkosivu">Verkkosivu</SelectItem>
                <SelectItem value="Suosittelu">Suosittelu</SelectItem>
                <SelectItem value="Messut">Messut</SelectItem>
                <SelectItem value="Kylmäsoitto">Kylmäsoitto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Leads Table */}
          <Card className="border border-[#E2E8F0] shadow-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F8FAFC] hover:bg-[#F8FAFC]">
                    <TableHead className="text-caption text-text-secondary uppercase tracking-wider font-semibold">Nimi</TableHead>
                    <TableHead className="text-caption text-text-secondary uppercase tracking-wider font-semibold">Yritys</TableHead>
                    <TableHead className="text-caption text-text-secondary uppercase tracking-wider font-semibold">Puhelin</TableHead>
                    <TableHead className="text-caption text-text-secondary uppercase tracking-wider font-semibold">Sähköposti</TableHead>
                    <TableHead className="text-caption text-text-secondary uppercase tracking-wider font-semibold">Lähde</TableHead>
                    <TableHead className="text-caption text-text-secondary uppercase tracking-wider font-semibold">Status</TableHead>
                    <TableHead className="text-caption text-text-secondary uppercase tracking-wider font-semibold">Vastuullinen</TableHead>
                    <TableHead className="text-caption text-text-secondary uppercase tracking-wider font-semibold text-right">Toiminnot</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {filteredLeads.map((lead, i) => (
                      <motion.tr
                        key={lead.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.03, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
                        className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors"
                      >
                        <TableCell className="font-medium text-text-primary text-sm">{lead.name}</TableCell>
                        <TableCell className="text-sm text-text-secondary">{lead.company}</TableCell>
                        <TableCell className="text-sm text-text-secondary">{lead.phone}</TableCell>
                        <TableCell className="text-sm text-text-secondary">{lead.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-bg-light text-text-secondary border-[#E2E8F0] text-[11px]">
                            {lead.source}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('text-[11px]', statusColor(lead.status))}>
                            {lead.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Avatar className="w-5 h-5">
                              <AvatarFallback className={cn('text-[8px]', avatarColor(lead.assignedTo))}>
                                {avatarInitials(lead.assignedTo)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-text-secondary">{lead.assignedTo}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-text-muted hover:text-primary">
                              <Eye size={14} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-text-muted hover:text-info">
                              <Edit3 size={14} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-text-muted hover:text-danger">
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Tarjoukset ── */}
        <TabsContent value="offers" className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border border-[#E2E8F0] shadow-card">
              <CardContent className="p-5">
                <p className="text-caption text-text-secondary uppercase tracking-wider mb-1">Tarjoukset yhteensä</p>
                <p className="text-[28px] font-bold font-mono text-text-primary">{totalOffers}</p>
              </CardContent>
            </Card>
            <Card className="border border-[#E2E8F0] shadow-card">
              <CardContent className="p-5">
                <p className="text-caption text-text-secondary uppercase tracking-wider mb-1">Hyväksymisprosentti</p>
                <p className="text-[28px] font-bold font-mono text-success">{acceptanceRate}%</p>
              </CardContent>
            </Card>
            <Card className="border border-[#E2E8F0] shadow-card">
              <CardContent className="p-5">
                <p className="text-caption text-text-secondary uppercase tracking-wider mb-1">Keskisumma</p>
                <p className="text-[28px] font-bold font-mono text-text-primary">{formatCurrency(avgOfferAmount)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input
                placeholder="Hae tarjouksia..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 border-[#E2E8F0]"
              />
            </div>
            <Select value={offerStatusFilter} onValueChange={setOfferStatusFilter}>
              <SelectTrigger className="w-[180px] border-[#E2E8F0]">
                <Filter size={14} className="mr-2 text-text-muted" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Kaikki status</SelectItem>
                <SelectItem value="Luonnos">Luonnos</SelectItem>
                <SelectItem value="Lähetetty">Lähetetty</SelectItem>
                <SelectItem value="Hyväksytty">Hyväksytty</SelectItem>
                <SelectItem value="Hylätty">Hylätty</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Offers Table */}
          <Card className="border border-[#E2E8F0] shadow-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F8FAFC] hover:bg-[#F8FAFC]">
                    <TableHead className="text-caption text-text-secondary uppercase tracking-wider font-semibold">Tarjousnumero</TableHead>
                    <TableHead className="text-caption text-text-secondary uppercase tracking-wider font-semibold">Asiakas</TableHead>
                    <TableHead className="text-caption text-text-secondary uppercase tracking-wider font-semibold">Projekti</TableHead>
                    <TableHead className="text-caption text-text-secondary uppercase tracking-wider font-semibold">Summa</TableHead>
                    <TableHead className="text-caption text-text-secondary uppercase tracking-wider font-semibold">Voimassa</TableHead>
                    <TableHead className="text-caption text-text-secondary uppercase tracking-wider font-semibold">Status</TableHead>
                    <TableHead className="text-caption text-text-secondary uppercase tracking-wider font-semibold text-right">Toiminnot</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {filteredOffers.map((offer, i) => (
                      <motion.tr
                        key={offer.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.03, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
                        className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors"
                      >
                        <TableCell className="font-mono text-sm text-text-primary">{offer.number}</TableCell>
                        <TableCell className="text-sm text-text-primary font-medium">{offer.customer}</TableCell>
                        <TableCell className="text-sm text-text-secondary">{offer.project}</TableCell>
                        <TableCell className="font-mono text-sm font-semibold text-primary">{formatCurrency(offer.amount)}</TableCell>
                        <TableCell className="text-sm text-text-secondary">{offer.validUntil}</TableCell>
                        <TableCell>
                          <Badge className={cn('text-[11px]', offerStatusColor(offer.status))}>
                            {offer.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-text-muted hover:text-primary">
                              <Eye size={14} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-text-muted hover:text-info">
                              <Send size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Yhteystiedot ── */}
        <TabsContent value="contacts" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input
                placeholder="Hae yhteystietoja..."
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
                className="pl-9 border-[#E2E8F0]"
              />
            </div>
            <Select value={contactTypeFilter} onValueChange={setContactTypeFilter}>
              <SelectTrigger className="w-[180px] border-[#E2E8F0]">
                <Filter size={14} className="mr-2 text-text-muted" />
                <SelectValue placeholder="Tyyppi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Kaikki tyypit</SelectItem>
                <SelectItem value="Yritys">Yritys</SelectItem>
                <SelectItem value="Yksityinen">Yksityinen</SelectItem>
                <SelectItem value="Taloyhtiö">Taloyhtiö</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Contact Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {filteredContacts.map((contact, i) => (
                <motion.div
                  key={contact.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, delay: i * 0.04, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
                >
                  <Card className="border border-[#E2E8F0] shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className={cn('text-sm font-semibold', avatarColor(contact.name))}>
                              {avatarInitials(contact.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-semibold text-text-primary">{contact.name}</p>
                            <p className="text-xs text-text-secondary">{contact.role}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={cn('text-[10px]',
                          contact.type === 'Yritys' ? 'bg-info-light text-info border-info/20' :
                          contact.type === 'Yksityinen' ? 'bg-success-light text-success border-success/20' :
                          'bg-[#F3E8FF] text-[#9333EA] border-[#9333EA]/20'
                        )}>
                          {contact.type}
                        </Badge>
                      </div>
                      <Separator className="my-3" />
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Building2 size={13} className="text-text-muted" />
                          <span className="text-xs text-text-secondary">{contact.company}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone size={13} className="text-text-muted" />
                          <span className="text-xs text-text-secondary">{contact.phone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail size={13} className="text-text-muted" />
                          <span className="text-xs text-text-secondary">{contact.email}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-4">
                        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs border-[#E2E8F0]">
                          <Phone size={12} className="mr-1" />
                          Soita
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs border-[#E2E8F0]">
                          <Mail size={12} className="mr-1" />
                          Sähköposti
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </TabsContent>

        {/* ── Tab: Analytiikka ── */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversion Funnel */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
            >
              <Card className="border border-[#E2E8F0] shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-h3 text-text-primary">Konversiosuppilo</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <FunnelChart>
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                        formatter={(value: number) => [`${value} liidiä`, '']}
                      />
                      <Funnel
                        dataKey="value"
                        data={FUNNEL_DATA}
                        isAnimationActive
                      >
                        <LabelList
                          position="inside"
                          fill="#1E293B"
                          stroke="none"
                          dataKey="name"
                          className="text-xs font-medium"
                        />
                        {FUNNEL_DATA.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} stroke="#fff" strokeWidth={2} />
                        ))}
                      </Funnel>
                    </FunnelChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* Source Breakdown Pie */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
            >
              <Card className="border border-[#E2E8F0] shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-h3 text-text-primary">Liidien lähde</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={SOURCE_DATA}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {SOURCE_DATA.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                        formatter={(value: number) => [`${value}%`, '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-3 mt-2">
                    {SOURCE_DATA.map(s => (
                      <div key={s.name} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.fill }} />
                        <span className="text-xs text-text-secondary">{s.name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Monthly Leads Bar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
          >
            <Card className="border border-[#E2E8F0] shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-h3 text-text-primary">Kuukausittaiset liidit ja kaupat</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={MONTHLY_LEADS} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    />
                    <Bar dataKey="leads" name="Liidit" fill="#F97316" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="deals" name="Kaupat" fill="#22C55E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
