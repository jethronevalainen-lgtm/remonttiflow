import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  X,
  Filter,
  MoreHorizontal,
  Eye,
  Edit3,
  Layers,
  Play,
  Clock,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileText,
  MessageSquare,
  Paperclip,
  CheckSquare,
  Square,
  Send,
  Wrench,
  Zap,
  Droplets,
  SearchCheck,
  HelpCircle,
  XCircle,
  Pause,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/* ─── Types ─── */
type WorkOrderStatus = 'Avoin' | 'Käynnissä' | 'Odottaa' | 'Valmis' | 'Peruttu';
type WorkOrderPriority = 'Kiireellinen' | 'Korkea' | 'Normaali' | 'Matala';
type WorkOrderType = 'Korjaus' | 'Asennus' | 'Tarkastus' | 'Huolto' | 'Muu';

interface WorkOrderStep {
  label: string;
  completed: boolean;
}

interface WorkOrderComment {
  author: string;
  time: string;
  text: string;
}

interface WorkOrderAttachment {
  name: string;
  size: string;
}

interface WorkOrder {
  id: string;
  title: string;
  description: string;
  type: WorkOrderType;
  project: string;
  assignee: string;
  assigneeInitials: string;
  dueDate: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  createdBy: string;
  createdDate: string;
  steps: WorkOrderStep[];
  comments: WorkOrderComment[];
  attachments: WorkOrderAttachment[];
}

/* ─── Mock Data ─── */
const WORK_ORDERS: WorkOrder[] = [
  {
    id: 'TM-2025-084',
    title: 'Sähkötyöt rakennus B',
    description: 'Sähköasennukset rakennuksen B kerroksiin 1–3. Käytettävä uusia kaapeleita ja rasioita.',
    type: 'Asennus',
    project: 'Espoon uudisrakennus',
    assignee: 'Matti Korhonen',
    assigneeInitials: 'MK',
    dueDate: '23.6.2025',
    priority: 'Kiireellinen',
    status: 'Käynnissä',
    createdBy: 'Anna Lahtinen',
    createdDate: '15.6.2025',
    steps: [
      { label: 'Valmistelu', completed: true },
      { label: 'Materiaalien tarkistus', completed: true },
      { label: 'Kaapelointi', completed: false },
      { label: 'Kytkentä', completed: false },
      { label: 'Testaus', completed: false },
    ],
    comments: [
      { author: 'Matti K.', time: '16:30', text: 'Materiaalit saapuneet, aloitetaan huomenna.' },
      { author: 'Anna L.', time: '08:15', text: 'Muistutus: Tarkista eristykset ennen kaapelointia.' },
    ],
    attachments: [
      { name: 'Sähkösuunnitelma.pdf', size: '2.4 MB' },
      { name: 'Turvallisuusohje.pdf', size: '156 KB' },
    ],
  },
  {
    id: 'TM-2025-083',
    title: 'LVI-asennus kerros 2',
    description: 'LVI-putkien asennus toiseen kerrokseen. Vesijohtojen liittäminen pääjakeluun.',
    type: 'Asennus',
    project: 'Helsingin toimistorakennus',
    assignee: 'Anna Lahtinen',
    assigneeInitials: 'AL',
    dueDate: '24.6.2025',
    priority: 'Korkea',
    status: 'Avoin',
    createdBy: 'Pekka Salminen',
    createdDate: '14.6.2025',
    steps: [
      { label: 'Putkien mittaus', completed: false },
      { label: 'Leikkaus', completed: false },
      { label: 'Liittäminen', completed: false },
      { label: 'Painetestaus', completed: false },
    ],
    comments: [],
    attachments: [{ name: 'LVI-suunnitelma.pdf', size: '1.8 MB' }],
  },
  {
    id: 'TM-2025-082',
    title: 'Ikkunoiden tiivistys',
    description: 'Vanhojen ikkunoiden tiivisteiden uusiminen ja vedenpitävyyden tarkistus.',
    type: 'Korjaus',
    project: 'Tampereen korjaustyö',
    assignee: 'Jukka Lehtonen',
    assigneeInitials: 'JL',
    dueDate: '25.6.2025',
    priority: 'Normaali',
    status: 'Avoin',
    createdBy: 'Liisa Rantanen',
    createdDate: '13.6.2025',
    steps: [
      { label: 'Vanhojen tiivisteiden poisto', completed: false },
      { label: 'Pintojen puhdistus', completed: false },
      { label: 'Uusien tiivisteiden asennus', completed: false },
    ],
    comments: [],
    attachments: [],
  },
  {
    id: 'TM-2025-081',
    title: 'Runkotarkastus',
    description: 'Rakennuksen rungon laadunvarmistustarkastus ja dokumentointi.',
    type: 'Tarkastus',
    project: 'Espoon uudisrakennus',
    assignee: 'Pekka Salminen',
    assigneeInitials: 'PS',
    dueDate: '20.6.2025',
    priority: 'Normaali',
    status: 'Valmis',
    createdBy: 'Matti Korhonen',
    createdDate: '10.6.2025',
    steps: [
      { label: 'Visuaalinen tarkastus', completed: true },
      { label: 'Mittaukset', completed: true },
      { label: 'Dokumentointi', completed: true },
      { label: 'Raportin laatiminen', completed: true },
    ],
    comments: [
      { author: 'Pekka S.', time: '14:00', text: 'Runko kunnossa, pieniä korjauksia tarvitaan liitoksissa.' },
    ],
    attachments: [{ name: 'Tarkastusraportti.pdf', size: '890 KB' }],
  },
  {
    id: 'TM-2025-080',
    title: 'Maalaustyöt sisäpinnat',
    description: 'Sisäseinien maalaus asunnoissa A1–A5. Käytettävä ekologista sisämaalia.',
    type: 'Korjaus',
    project: 'Tampereen korjaustyö',
    assignee: 'Liisa Rantanen',
    assigneeInitials: 'LR',
    dueDate: '19.6.2025',
    priority: 'Matala',
    status: 'Valmis',
    createdBy: 'Jukka Lehtonen',
    createdDate: '9.6.2025',
    steps: [
      { label: 'Pintojen esikäsittely', completed: true },
      { label: 'Pohjamaalaus', completed: true },
      { label: 'Päällemaalaus 1. kerros', completed: true },
      { label: 'Päällemaalaus 2. kerros', completed: true },
    ],
    comments: [],
    attachments: [],
  },
  {
    id: 'TM-2025-079',
    title: 'Perustusten valu',
    description: 'Betonivalu perustuksiin. Huomioitava sääolosuhteet ja lämpötila.',
    type: 'Asennus',
    project: 'Helsingin toimistorakennus',
    assignee: 'Matti Korhonen',
    assigneeInitials: 'MK',
    dueDate: '18.6.2025',
    priority: 'Kiireellinen',
    status: 'Odottaa',
    createdBy: 'Anna Lahtinen',
    createdDate: '8.6.2025',
    steps: [
      { label: 'Muottien tarkistus', completed: true },
      { label: 'Rautojen asennus', completed: true },
      { label: 'Betonin tilaus', completed: true },
      { label: 'Valu', completed: false },
      { label: 'Jälkihoito', completed: false },
    ],
    comments: [
      { author: 'Matti K.', time: '09:00', text: 'Betonin toimitus viivästynyt, odotetaan huomiseen.' },
    ],
    attachments: [
      { name: 'Valusuunnitelma.pdf', size: '3.1 MB' },
      { name: 'Sääennuste.pdf', size: '45 KB' },
    ],
  },
  {
    id: 'TM-2025-078',
    title: 'Hissikuilun eristys',
    description: 'Hissikuilun ääni- ja lämpöeristys mineraalivillalla.',
    type: 'Asennus',
    project: 'Tampereen korjaustyö',
    assignee: 'Sari Kettunen',
    assigneeInitials: 'SK',
    dueDate: '26.6.2025',
    priority: 'Korkea',
    status: 'Avoin',
    createdBy: 'Pekka Salminen',
    createdDate: '12.6.2025',
    steps: [
      { label: 'Pintojen puhdistus', completed: false },
      { label: 'Villan asennus', completed: false },
      { label: 'Suojalevyt', completed: false },
    ],
    comments: [],
    attachments: [{ name: 'Eristyssuunnitelma.pdf', size: '1.2 MB' }],
  },
  {
    id: 'TM-2025-077',
    title: 'Palo-ovien tarkastus',
    description: 'Vuotuinen palo-ovien toiminnallinen tarkastus ja sertifiointi.',
    type: 'Tarkastus',
    project: 'Helsingin toimistorakennus',
    assignee: 'Pekka Salminen',
    assigneeInitials: 'PS',
    dueDate: '27.6.2025',
    priority: 'Normaali',
    status: 'Käynnissä',
    createdBy: 'Anna Lahtinen',
    createdDate: '11.6.2025',
    steps: [
      { label: 'Ovien lukumäärän tarkistus', completed: true },
      { label: 'Sulkimien testaus', completed: true },
      { label: 'Saranoiden tarkistus', completed: false },
      { label: 'Sertifiointi', completed: false },
    ],
    comments: [],
    attachments: [],
  },
  {
    id: 'TM-2025-076',
    title: 'Lattialämmityksen huolto',
    description: 'Lattialämmitysjärjestelmän vuosihuolto ja termostaattien tarkistus.',
    type: 'Huolto',
    project: 'Espoon uudisrakennus',
    assignee: 'Jukka Lehtonen',
    assigneeInitials: 'JL',
    dueDate: '28.6.2025',
    priority: 'Matala',
    status: 'Odottaa',
    createdBy: 'Liisa Rantanen',
    createdDate: '10.6.2025',
    steps: [
      { label: 'Järjestelmän huuhtelu', completed: false },
      { label: 'Termostaattien testaus', completed: false },
      { label: 'Vuototarkistus', completed: false },
    ],
    comments: [],
    attachments: [],
  },
  {
    id: 'TM-2025-075',
    title: 'Ulko-ovien vaihto',
    description: 'Vanhojen ulko-ovien purku ja uusien asennus. Sisältää karmeiden korjauksen.',
    type: 'Korjaus',
    project: 'Tampereen korjaustyö',
    assignee: 'Matti Korhonen',
    assigneeInitials: 'MK',
    dueDate: '30.6.2025',
    priority: 'Korkea',
    status: 'Peruttu',
    createdBy: 'Pekka Salminen',
    createdDate: '5.6.2025',
    steps: [],
    comments: [
      { author: 'Matti K.', time: '10:00', text: 'Ovitilaus peruttu toimittajan toimesta, siirretään heinäkuulle.' },
    ],
    attachments: [],
  },
];

/* ─── Helpers ─── */
const statusConfig: Record<WorkOrderStatus, { bg: string; text: string; border: string; icon: typeof CheckSquare }> = {
  Avoin: { bg: 'bg-[#DBEAFE]', text: 'text-[#2563EB]', border: 'border-[#93C5FD]', icon: Clock },
  Käynnissä: { bg: 'bg-[#DCFCE7]', text: 'text-[#16A34A]', border: 'border-[#86EFAC]', icon: Play },
  Odottaa: { bg: 'bg-[#FEF3C7]', text: 'text-[#D97706]', border: 'border-[#FCD34D]', icon: Pause },
  Valmis: { bg: 'bg-[#F1F5F9]', text: 'text-[#475569]', border: 'border-[#CBD5E1]', icon: CheckCircle },
  Peruttu: { bg: 'bg-[#F1F5F9]', text: 'text-[#94A3B8]', border: 'border-[#CBD5E1]', icon: XCircle },
};

const priorityConfig: Record<WorkOrderPriority, { bg: string; text: string; dot: string }> = {
  Kiireellinen: { bg: 'bg-[#FEE2E2]', text: 'text-[#DC2626]', dot: 'bg-[#DC2626]' },
  Korkea: { bg: 'bg-[#FFF7ED]', text: 'text-[#EA580C]', dot: 'bg-[#EA580C]' },
  Normaali: { bg: 'bg-[#DBEAFE]', text: 'text-[#2563EB]', dot: 'bg-[#2563EB]' },
  Matala: { bg: 'bg-[#F1F5F9]', text: 'text-[#64748B]', dot: 'bg-[#64748B]' },
};

const typeIcon: Record<WorkOrderType, typeof Wrench> = {
  Korjaus: Wrench,
  Asennus: Zap,
  Tarkastus: SearchCheck,
  Huolto: Droplets,
  Muu: HelpCircle,
};

const statusFilters = [
  { key: 'Kaikki', label: 'Kaikki', icon: Layers, count: WORK_ORDERS.length },
  { key: 'Avoin', label: 'Avoin', icon: Clock, count: WORK_ORDERS.filter(w => w.status === 'Avoin').length },
  { key: 'Käynnissä', label: 'Käynnissä', icon: Play, count: WORK_ORDERS.filter(w => w.status === 'Käynnissä').length },
  { key: 'Odottaa', label: 'Odottaa', icon: Pause, count: WORK_ORDERS.filter(w => w.status === 'Odottaa').length },
  { key: 'Valmis', label: 'Valmis', icon: CheckCircle, count: WORK_ORDERS.filter(w => w.status === 'Valmis').length },
  { key: 'Peruttu', label: 'Peruttu', icon: XCircle, count: WORK_ORDERS.filter(w => w.status === 'Peruttu').length },
];

/* ─── Component ─── */
export default function Tyomaaraykset() {
  const [activeFilter, setActiveFilter] = useState('Kaikki');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [newComment, setNewComment] = useState('');

  // New order form state
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState<WorkOrderType>('Korjaus');
  const [formProject, setFormProject] = useState('');
  const [formAssignee, setFormAssignee] = useState('');
  const [formPriority, setFormPriority] = useState<WorkOrderPriority>('Normaali');
  const [formDate, setFormDate] = useState('');

  const filteredOrders = useMemo(() => {
    let filtered = WORK_ORDERS;
    if (activeFilter !== 'Kaikki') {
      filtered = filtered.filter(o => o.status === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        o =>
          o.title.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q) ||
          o.project.toLowerCase().includes(q) ||
          o.assignee.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [activeFilter, searchQuery]);

  const urgentOrders = useMemo(
    () => WORK_ORDERS.filter(o => o.priority === 'Kiireellinen' && o.status !== 'Valmis' && o.status !== 'Peruttu'),
    []
  );

  const handleOpenDetail = (order: WorkOrder) => {
    setSelectedOrder(order);
    setDetailOpen(true);
  };

  const handleAddComment = () => {
    if (!newComment.trim() || !selectedOrder) return;
    const updated = { ...selectedOrder };
    updated.comments = [...updated.comments, { author: 'Sinä', time: 'Nyt', text: newComment.trim() }];
    setSelectedOrder(updated);
    setNewComment('');
  };

  const handleCreateOrder = () => {
    setNewOrderOpen(false);
    setFormTitle('');
    setFormDesc('');
    setFormType('Korjaus');
    setFormProject('');
    setFormAssignee('');
    setFormPriority('Normaali');
    setFormDate('');
  };

  return (
    <div className="space-y-6">
      {/* ─── Page Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-hero text-text-primary">Työmääräykset</h1>
          <p className="text-body-sm text-text-secondary mt-1">Työmääräysten hallinta ja seuranta</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <Filter size={16} /> Suodata
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setActiveFilter('Kaikki')}>
            <Clock size={16} /> Päivitä
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-primary hover:bg-primary-hover text-white"
            onClick={() => setNewOrderOpen(true)}
          >
            <Plus size={16} /> Uusi työmääräys
          </Button>
        </div>
      </motion.div>

      {/* ─── Status Filter Cards ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="grid grid-cols-3 lg:grid-cols-6 gap-3"
      >
        {statusFilters.map((f, i) => {
          const active = activeFilter === f.key;
          return (
            <motion.div
              key={f.key}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: i * 0.06 }}
            >
              <Card
                className={cn(
                  'cursor-pointer transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5 border',
                  active
                    ? 'border-primary bg-primary-light'
                    : f.key === 'Myöhässä'
                    ? 'border-danger/30 bg-danger-light'
                    : 'border-border bg-bg-white'
                )}
                onClick={() => setActiveFilter(f.key)}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                      active ? 'bg-primary text-white' : 'bg-bg-light text-text-secondary'
                    )}
                  >
                    <f.icon size={18} />
                  </div>
                  <div>
                    <p className={cn('text-caption font-semibold', active ? 'text-primary' : 'text-text-secondary')}>
                      {f.label}
                    </p>
                    <p className="text-h2 text-text-primary">{f.count}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* ─── Urgent Work Orders Banner ─── */}
      {urgentOrders.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="bg-danger-light border border-danger/20 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-danger" />
            <h3 className="text-h3 text-danger">Kiireelliset työmääräykset</h3>
            <Badge className="bg-danger text-white">{urgentOrders.length}</Badge>
          </div>
          <div className="space-y-2">
            {urgentOrders.map(order => (
              <div
                key={order.id}
                className="flex items-center gap-3 bg-white rounded-lg p-3 border border-danger/10 cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => handleOpenDetail(order)}
              >
                <div className="w-2 h-2 rounded-full bg-danger flex-shrink-0 animate-pulse" />
                <span className="text-mono text-text-secondary">{order.id}</span>
                <span className="font-medium text-text-primary flex-1">{order.title}</span>
                <span className="text-body-sm text-text-secondary">{order.project}</span>
                <Badge className={cn(priorityConfig[order.priority].bg, priorityConfig[order.priority].text)}>
                  {order.priority}
                </Badge>
                <span className="text-body-sm text-danger font-medium">{order.dueDate}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ─── Search Bar ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="relative"
      >
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <Input
          placeholder="Hae työmääräyksiä..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-10 pr-10 h-10"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
          >
            <X size={16} />
          </button>
        )}
      </motion.div>

      {/* ─── Work Orders Table ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25 }}
        className="bg-white rounded-xl border border-border shadow-card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-bg-light border-b border-border">
                <th className="text-left px-4 py-3 text-caption uppercase tracking-wider text-text-secondary font-semibold w-14">
                  Tila
                </th>
                <th className="text-left px-4 py-3 text-caption uppercase tracking-wider text-text-secondary font-semibold w-28">
                  Tunnus
                </th>
                <th className="text-left px-4 py-3 text-caption uppercase tracking-wider text-text-secondary font-semibold">
                  Otsikko
                </th>
                <th className="text-left px-4 py-3 text-caption uppercase tracking-wider text-text-secondary font-semibold w-32">
                  Tyyppi
                </th>
                <th className="text-left px-4 py-3 text-caption uppercase tracking-wider text-text-secondary font-semibold w-40">
                  Projekti
                </th>
                <th className="text-left px-4 py-3 text-caption uppercase tracking-wider text-text-secondary font-semibold w-36">
                  Vastuullinen
                </th>
                <th className="text-left px-4 py-3 text-caption uppercase tracking-wider text-text-secondary font-semibold w-28">
                  Määräpäivä
                </th>
                <th className="text-left px-4 py-3 text-caption uppercase tracking-wider text-text-secondary font-semibold w-28">
                  Prioriteetti
                </th>
                <th className="text-left px-4 py-3 text-caption uppercase tracking-wider text-text-secondary font-semibold w-24">
                  Toiminnot
                </th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filteredOrders.map((order, idx) => {
                  const sCfg = statusConfig[order.status];
                  const pCfg = priorityConfig[order.priority];
                  const TypeIc = typeIcon[order.type];
                  return (
                    <motion.tr
                      key={order.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15, delay: idx * 0.03 }}
                      className={cn(
                        'border-b border-border/50 cursor-pointer transition-colors duration-100 hover:bg-bg-light',
                        order.priority === 'Kiireellinen' && order.status !== 'Valmis' && 'border-l-[3px] border-l-primary'
                      )}
                      onClick={() => handleOpenDetail(order)}
                    >
                      <td className="px-4 py-3">
                        <div className={cn('w-3 h-3 rounded-full', sCfg.text.replace('text-', 'bg-'))} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-mono text-text-primary hover:text-primary cursor-pointer">
                          {order.id}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-text-primary text-sm">{order.title}</p>
                          <p className="text-body-sm text-text-secondary line-clamp-1">{order.description}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <TypeIc size={14} className="text-text-secondary" />
                          <Badge variant="outline" className="text-xs font-normal">
                            {order.type}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-primary">{order.project}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary-light text-primary text-[10px] font-semibold flex items-center justify-center">
                            {order.assigneeInitials}
                          </div>
                          <span className="text-sm text-text-primary">{order.assignee.split(' ')[0]}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'text-sm',
                            order.status !== 'Valmis' && order.dueDate < '26.6.2025' ? 'text-danger font-medium' : 'text-text-primary'
                          )}
                        >
                          {order.dueDate}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={cn(pCfg.bg, pCfg.text, 'font-medium text-xs')}>
                          <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5', pCfg.dot)} />
                          {order.priority}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={e => {
                              e.stopPropagation();
                              handleOpenDetail(order);
                            }}
                          >
                            <Eye size={15} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => e.stopPropagation()}>
                            <Edit3 size={15} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => e.stopPropagation()}>
                            <MoreHorizontal size={15} />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-bg-light/50">
          <p className="text-body-sm text-text-secondary">
            Näytetään 1–{filteredOrders.length} / {filteredOrders.length}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronLeft size={16} />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 bg-primary-light text-primary">
              1
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ─── Detail Drawer ─── */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-hidden p-0">
          <div className="h-full overflow-auto">
            {selectedOrder && (
              <div className="p-6 space-y-6">
                {/* Header */}
                <SheetHeader className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-mono text-primary">{selectedOrder.id}</span>
                      <SheetTitle className="text-h2 mt-1">{selectedOrder.title}</SheetTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Edit3 size={16} />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={cn(priorityConfig[selectedOrder.priority].bg, priorityConfig[selectedOrder.priority].text)}>
                      {selectedOrder.priority}
                    </Badge>
                    <Badge className={cn(statusConfig[selectedOrder.status].bg, statusConfig[selectedOrder.status].text)}>
                      {selectedOrder.status}
                    </Badge>
                  </div>
                </SheetHeader>

                {/* Details */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="bg-bg-light rounded-xl p-4 space-y-2.5"
                >
                  <div className="flex justify-between">
                    <span className="text-body-sm text-text-secondary">Tyyppi</span>
                    <span className="text-sm text-text-primary font-medium">{selectedOrder.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-body-sm text-text-secondary">Projekti</span>
                    <span className="text-sm text-text-primary font-medium">{selectedOrder.project}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-body-sm text-text-secondary">Vastuuhenkilö</span>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary-light text-primary text-[9px] font-semibold flex items-center justify-center">
                        {selectedOrder.assigneeInitials}
                      </div>
                      <span className="text-sm text-text-primary font-medium">{selectedOrder.assignee}</span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-body-sm text-text-secondary">Määräaika</span>
                    <span className="text-sm text-text-primary font-medium">{selectedOrder.dueDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-body-sm text-text-secondary">Luotu</span>
                    <span className="text-sm text-text-secondary">
                      {selectedOrder.createdDate} · {selectedOrder.createdBy}
                    </span>
                  </div>
                </motion.div>

                {/* Description */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
                  <h4 className="text-h3 text-text-primary mb-2 flex items-center gap-2">
                    <FileText size={16} className="text-text-secondary" /> Kuvaus
                  </h4>
                  <p className="text-sm text-text-secondary leading-relaxed bg-bg-light rounded-xl p-4">
                    {selectedOrder.description}
                  </p>
                </motion.div>

                {/* Steps */}
                {selectedOrder.steps.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                    <h4 className="text-h3 text-text-primary mb-2 flex items-center gap-2">
                      <CheckSquare size={16} className="text-text-secondary" /> Työvaiheet
                    </h4>
                    <div className="space-y-2">
                      {selectedOrder.steps.map((step, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-bg-light transition-colors"
                        >
                          {step.completed ? (
                            <CheckSquare size={18} className="text-success flex-shrink-0" />
                          ) : (
                            <Square size={18} className="text-text-muted flex-shrink-0" />
                          )}
                          <span className={cn('text-sm', step.completed ? 'text-text-secondary line-through' : 'text-text-primary')}>
                            {step.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Attachments */}
                {selectedOrder.attachments.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
                    <h4 className="text-h3 text-text-primary mb-2 flex items-center gap-2">
                      <Paperclip size={16} className="text-text-secondary" /> Liitteet
                    </h4>
                    <div className="space-y-2">
                      {selectedOrder.attachments.map((att, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-bg-light transition-colors cursor-pointer"
                        >
                          <FileText size={18} className="text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-text-primary truncate">{att.name}</p>
                            <p className="text-caption text-text-secondary">{att.size}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Comments */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                  <h4 className="text-h3 text-text-primary mb-2 flex items-center gap-2">
                    <MessageSquare size={16} className="text-text-secondary" /> Kommentit
                  </h4>
                  <div className="space-y-3 mb-4">
                    {selectedOrder.comments.map((comment, i) => (
                      <div key={i} className="bg-bg-light rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-text-primary">{comment.author}</span>
                          <span className="text-caption text-text-muted">{comment.time}</span>
                        </div>
                        <p className="text-sm text-text-secondary">{comment.text}</p>
                      </div>
                    ))}
                    {selectedOrder.comments.length === 0 && (
                      <p className="text-body-sm text-text-muted italic">Ei kommentteja vielä.</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Kirjoita kommentti..."
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                      className="flex-1"
                    />
                    <Button size="icon" className="bg-primary hover:bg-primary-hover text-white shrink-0" onClick={handleAddComment}>
                      <Send size={16} />
                    </Button>
                  </div>
                </motion.div>

                {/* Actions */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 }}
                  className="flex items-center gap-2 pt-2 border-t border-border"
                >
                  <Button variant="outline" className="flex-1">
                    Muuta tilaa
                  </Button>
                  <Button className="flex-1 bg-primary hover:bg-primary-hover text-white">
                    <Edit3 size={16} className="mr-1.5" /> Muokkaa
                  </Button>
                </motion.div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ─── New Work Order Dialog ─── */}
      <Dialog open={newOrderOpen} onOpenChange={setNewOrderOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-h2">Uusi työmääräys</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Otsikko *</Label>
              <Input placeholder="Syötä työmääräyksen otsikko" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Kuvaus *</Label>
              <Textarea placeholder="Kuvaa työmääräyksen sisältö..." rows={3} value={formDesc} onChange={e => setFormDesc(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tyyppi</Label>
                <Select value={formType} onValueChange={v => setFormType(v as WorkOrderType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['Korjaus', 'Asennus', 'Tarkastus', 'Huolto', 'Muu'] as WorkOrderType[]).map(t => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Projekti</Label>
                <Select value={formProject} onValueChange={setFormProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Valitse projekti" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="espoo">Espoon uudisrakennus</SelectItem>
                    <SelectItem value="helsinki">Helsingin toimistorakennus</SelectItem>
                    <SelectItem value="tampere">Tampereen korjaustyö</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vastuuhenkilö</Label>
                <Select value={formAssignee} onValueChange={setFormAssignee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Valitse henkilö" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="matti">Matti Korhonen</SelectItem>
                    <SelectItem value="anna">Anna Lahtinen</SelectItem>
                    <SelectItem value="jukka">Jukka Lehtonen</SelectItem>
                    <SelectItem value="pekka">Pekka Salminen</SelectItem>
                    <SelectItem value="liisa">Liisa Rantanen</SelectItem>
                    <SelectItem value="sari">Sari Kettunen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Määräaika</Label>
                <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Prioriteetti</Label>
              <div className="flex gap-2">
                {(['Kiireellinen', 'Korkea', 'Normaali', 'Matala'] as WorkOrderPriority[]).map(p => (
                  <button
                    key={p}
                    onClick={() => setFormPriority(p)}
                    className={cn(
                      'flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all',
                      formPriority === p
                        ? cn(priorityConfig[p].bg, priorityConfig[p].text, 'border-current')
                        : 'border-border text-text-secondary hover:bg-bg-light'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOrderOpen(false)}>
              Tallenna luonnoksena
            </Button>
            <Button className="bg-primary hover:bg-primary-hover text-white" onClick={handleCreateOrder}>
              Luo työmääräys
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
