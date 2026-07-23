import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Building2,
  User,
  Home,
  Plus,
  Search,
  Eye,
  Edit3,
  Phone,
  Mail,
  MapPin,
  FolderKanban,
  CalendarDays,
  Euro,
  MessageSquare,
  Briefcase,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

/* ─── Types ─── */
interface Customer {
  id: string;
  name: string;
  type: 'Yritys' | 'Yksityinen' | 'Taloyhtiö';
  contactPerson?: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  postalCode: string;
  yTunnus?: string;
  projectCount: number;
  lastContact: string;
  status: 'Aktiivinen' | 'Epäaktiivinen';
  notes?: string;
}

interface CustomerProject {
  id: string;
  name: string;
  date: string;
  value: number;
  status: 'Käynnissä' | 'Valmis' | 'Suunniteltu' | 'Odottaa';
}

/* ─── Mock Data ─── */
const CUSTOMERS: Customer[] = [
  {
    id: 'AS-2025-0001', name: 'Rakennus Oy Helsinki', type: 'Yritys', contactPerson: 'Anna Lindqvist',
    phone: '09-1234567', email: 'info@rakennusoy.fi', address: 'Mannerheimintie 12', city: 'Helsinki', postalCode: '00100',
    yTunnus: '1234567-8', projectCount: 5, lastContact: '15.8.2025', status: 'Aktiivinen',
    notes: 'Vakioasiakas, suuria toimistoremontteja',
  },
  {
    id: 'AS-2025-0002', name: 'Matti Meikäläinen', type: 'Yksityinen', contactPerson: 'Matti Meikäläinen',
    phone: '040-1234567', email: 'matti.meikalainen@email.fi', address: 'Espoonlahdenkatu 8', city: 'Espoo', postalCode: '02320',
    projectCount: 1, lastContact: '10.8.2025', status: 'Aktiivinen',
    notes: 'Omakotitalon remontti',
  },
  {
    id: 'AS-2025-0003', name: 'Asunto Oy Tampereen Keskusta', type: 'Taloyhtiö', contactPerson: 'Jukka Mäkelä',
    phone: '03-9876543', email: 'isannoitsija@aytampere.fi', address: 'Hämeenkatu 25', city: 'Tampere', postalCode: '33100',
    yTunnus: '2345678-9', projectCount: 3, lastContact: '12.8.2025', status: 'Aktiivinen',
    notes: 'Julkisivuremontti ja putkistosaneeraus',
  },
  {
    id: 'AS-2025-0004', name: 'Kiinteistöhuolto Keskus Oy', type: 'Yritys', contactPerson: 'Sari Nieminen',
    phone: '09-5554433', email: 'myynti@khkeskus.fi', address: 'Valimotie 15', city: 'Helsinki', postalCode: '00380',
    yTunnus: '3456789-0', projectCount: 8, lastContact: '18.8.2025', status: 'Aktiivinen',
    notes: 'Kiinteistöhuolto- ja ylläpitosopimukset',
  },
  {
    id: 'AS-2025-0005', name: 'Liisa Virtanen', type: 'Yksityinen', contactPerson: 'Liisa Virtanen',
    phone: '040-9876543', email: 'liisa.virtanen@email.fi', address: 'Satamakatu 5', city: 'Vantaa', postalCode: '00150',
    projectCount: 2, lastContact: '5.7.2025', status: 'Aktiivinen',
    notes: 'Keittiö- ja kylpyhuoneremontit',
  },
  {
    id: 'AS-2025-0006', name: 'Asunto Oy Hervanta', type: 'Taloyhtiö', contactPerson: 'Kirsi Hämäläinen',
    phone: '03-4455667', email: 'isannoitsija@ayhervanta.fi', address: 'Insinöörinkatu 45', city: 'Tampere', postalCode: '33720',
    yTunnus: '4567890-1', projectCount: 2, lastContact: '20.7.2025', status: 'Aktiivinen',
    notes: 'Putkistoremontti käynnissä',
  },
  {
    id: 'AS-2025-0007', name: 'Remontti-Sepot Oy', type: 'Yritys', contactPerson: 'Tomi Seppänen',
    phone: '03-6677889', email: 'myynti@remonttisepot.fi', address: 'Ankkurikatu 7', city: 'Turku', postalCode: '20100',
    yTunnus: '5678901-2', projectCount: 4, lastContact: '1.6.2025', status: 'Epäaktiivinen',
    notes: 'Ei aktiivisia projekteja tällä hetkellä',
  },
  {
    id: 'AS-2025-0008', name: 'Perhe Korhonen', type: 'Yksityinen', contactPerson: 'Korhonen perhe',
    phone: '040-5566778', email: 'korhonen@posti.fi', address: 'Metsäpolku 12', city: 'Oulu', postalCode: '90100',
    projectCount: 2, lastContact: '25.7.2025', status: 'Aktiivinen',
    notes: 'Laajennus ja piha-alue',
  },
  {
    id: 'AS-2025-0009', name: 'Asunto Oy Pyynikki', type: 'Taloyhtiö', contactPerson: 'Heli Koskinen',
    phone: '03-2233445', email: 'isannoitsija@aypyynikki.fi', address: 'Pyynikinkatu 18', city: 'Tampere', postalCode: '33230',
    yTunnus: '6789012-3', projectCount: 1, lastContact: '8.8.2025', status: 'Aktiivinen',
    notes: 'Kattoremontti suunnitteilla',
  },
  {
    id: 'AS-2025-0010', name: 'Taloyhtiö Tähtipolku', type: 'Taloyhtiö', contactPerson: 'Pekka Mäkinen',
    phone: '050-9876543', email: 'isannoitsija@tahdipolku.fi', address: 'Tähtipolku 3', city: 'Tampere', postalCode: '33540',
    yTunnus: '7890123-4', projectCount: 3, lastContact: '14.8.2025', status: 'Aktiivinen',
    notes: 'Ikkunaremontti ja hissin asennus',
  },
];

const CUSTOMER_PROJECTS: Record<string, CustomerProject[]> = {
  'AS-2025-0001': [
    { id: 'P001', name: 'Toimistoremontti Kamppi', date: '15.8.2025', value: 340000, status: 'Käynnissä' },
    { id: 'P002', name: 'Aulatilan uudistus', date: '1.6.2025', value: 85000, status: 'Valmis' },
    { id: 'P003', name: 'Keittiöremontti', date: '10.5.2025', value: 45000, status: 'Valmis' },
    { id: 'P004', name: 'Toimistotilan laajennus', date: '1.9.2025', value: 520000, status: 'Suunniteltu' },
    { id: 'P005', name: 'LVIS-remontti', date: '15.7.2025', value: 125000, status: 'Valmis' },
  ],
  'AS-2025-0002': [
    { id: 'P006', name: 'Omakotitalon laajennus', date: '10.8.2025', value: 180000, status: 'Käynnissä' },
  ],
  'AS-2025-0003': [
    { id: 'P007', name: 'Julkisivuremontti', date: '12.8.2025', value: 2100000, status: 'Käynnissä' },
    { id: 'P008', name: 'Putkistosaneeraus', date: '1.3.2025', value: 890000, status: 'Valmis' },
    { id: 'P009', name: 'Ikkunaremontti', date: '15.5.2025', value: 320000, status: 'Valmis' },
  ],
  'AS-2025-0004': [
    { id: 'P010', name: 'Kiinteistöhuolto sopimus', date: '1.1.2025', value: 45000, status: 'Käynnissä' },
    { id: 'P011', name: 'Piharemontti', date: '15.6.2025', value: 78000, status: 'Valmis' },
    { id: 'P012', name: 'Kattotarkistus', date: '20.5.2025', value: 12000, status: 'Valmis' },
    { id: 'P013', name: 'Piha-alueen kunnostus', date: '1.8.2025', value: 95000, status: 'Käynnissä' },
  ],
  'AS-2025-0005': [
    { id: 'P014', name: 'Keittiöremontti', date: '5.7.2025', value: 35000, status: 'Valmis' },
    { id: 'P015', name: 'Kylpyhuoneremontti', date: '1.9.2025', value: 28000, status: 'Suunniteltu' },
  ],
  'AS-2025-0006': [
    { id: 'P016', name: 'Putkistoremontti', date: '20.7.2025', value: 1800000, status: 'Käynnissä' },
    { id: 'P017', name: 'Sähköremontti', date: '15.3.2025', value: 145000, status: 'Valmis' },
  ],
  'AS-2025-0007': [
    { id: 'P018', name: 'Varastoremontti', date: '1.4.2025', value: 65000, status: 'Valmis' },
    { id: 'P019', name: 'Toimistoremontti', date: '15.2.2025', value: 120000, status: 'Valmis' },
  ],
  'AS-2025-0008': [
    { id: 'P020', name: 'Talon laajennus', date: '25.7.2025', value: 220000, status: 'Käynnissä' },
    { id: 'P021', name: 'Pihan kunnostus', date: '10.6.2025', value: 45000, status: 'Valmis' },
  ],
  'AS-2025-0009': [
    { id: 'P022', name: 'Kattoremontti', date: '8.8.2025', value: 650000, status: 'Suunniteltu' },
  ],
  'AS-2025-0010': [
    { id: 'P023', name: 'Ikkunaremontti', date: '14.8.2025', value: 420000, status: 'Käynnissä' },
    { id: 'P024', name: 'Hissin asennus', date: '1.6.2025', value: 890000, status: 'Käynnissä' },
    { id: 'P025', name: 'Porraskäytäväremontti', date: '15.4.2025', value: 180000, status: 'Valmis' },
  ],
};

/* ─── Helpers ─── */
const formatCurrency = (val: number) =>
  new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);

const typeColor = (type: Customer['type']) => {
  switch (type) {
    case 'Yritys': return 'bg-info-light text-info border-info/20';
    case 'Yksityinen': return 'bg-success-light text-success border-success/20';
    case 'Taloyhtiö': return 'bg-[#F3E8FF] text-[#9333EA] border-[#9333EA]/20';
  }
};

const statusColor = (s: Customer['status']) => {
  switch (s) {
    case 'Aktiivinen': return 'bg-success-light text-success';
    case 'Epäaktiivinen': return 'bg-warning-light text-warning';
  }
};

const projectStatusColor = (s: CustomerProject['status']) => {
  switch (s) {
    case 'Käynnissä': return 'bg-success-light text-success';
    case 'Valmis': return 'bg-[#F1F5F9] text-[#475569]';
    case 'Suunniteltu': return 'bg-info-light text-info';
    case 'Odottaa': return 'bg-warning-light text-warning';
  }
};

const typeIcon = (type: Customer['type']) => {
  switch (type) {
    case 'Yritys': return Building2;
    case 'Yksityinen': return User;
    case 'Taloyhtiö': return Home;
  }
};

const avatarColor = (name: string) => {
  const colors = ['bg-primary/10 text-primary', 'bg-info/10 text-info', 'bg-success/10 text-success', 'bg-warning/10 text-warning', 'bg-[#8B5CF6]/10 text-[#8B5CF6]'];
  return colors[name.charCodeAt(0) % colors.length];
};

const avatarInitials = (name: string) => {
  const parts = name.split(' ');
  return parts.map(p => p[0]).join('').slice(0, 2).toUpperCase();
};

/* ─── Sub-components ─── */

function FilterCard({ title, count, icon: Icon, color, active, onClick }: {
  title: string; count: number; icon: React.ComponentType<{ className?: string; size?: number }>;
  color: string; active: boolean; onClick: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover',
        active ? 'border-primary bg-primary-light shadow-card' : 'border-[#E2E8F0] bg-white shadow-card'
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', color)}>
          <Icon size={20} className={active ? 'text-primary' : 'text-text-secondary'} />
        </div>
        <span className="text-[24px] font-bold font-mono text-text-primary">{count}</span>
      </div>
      <p className={cn('text-sm font-medium mt-3', active ? 'text-primary' : 'text-text-secondary')}>{title}</p>
    </motion.div>
  );
}

/* ─── Main Component ─── */
export default function Asiakkaat() {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [customerTypeTab, setCustomerTypeTab] = useState('all');

  const filteredCustomers = useMemo(() => {
    return CUSTOMERS.filter(c => {
      const matchType = typeFilter === 'all' || c.type === typeFilter;
      const matchSearch = searchQuery === '' ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.city.toLowerCase().includes(searchQuery.toLowerCase());
      return matchType && matchSearch;
    });
  }, [typeFilter, searchQuery]);

  const handleRowClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDrawerOpen(true);
  };

  const allCount = CUSTOMERS.length;
  const companyCount = CUSTOMERS.filter(c => c.type === 'Yritys').length;
  const privateCount = CUSTOMERS.filter(c => c.type === 'Yksityinen').length;
  const housingCount = CUSTOMERS.filter(c => c.type === 'Taloyhtiö').length;

  const selectedProjects = selectedCustomer ? (CUSTOMER_PROJECTS[selectedCustomer.id] || []) : [];
  const selectedTotalValue = selectedProjects.reduce((s, p) => s + p.value, 0);

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
          <h1 className="text-hero text-text-primary">Asiakkaat</h1>
          <p className="text-body-sm text-text-secondary mt-1">Asiakasrekisteri</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-[#E2E8F0] text-text-secondary hover:bg-bg-light">
            Vie
          </Button>
          <Button
            className="bg-primary hover:bg-primary-hover text-white"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus size={16} className="mr-2" />
            Lisää asiakas
          </Button>
        </div>
      </div>

      {/* ── Filter Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <FilterCard title="Kaikki" count={allCount} icon={Users} color="bg-[#F8FAFC]" active={typeFilter === 'all'} onClick={() => setTypeFilter('all')} />
        <FilterCard title="Yritykset" count={companyCount} icon={Building2} color="bg-[#DBEAFE]" active={typeFilter === 'Yritys'} onClick={() => setTypeFilter('Yritys')} />
        <FilterCard title="Yksityiset" count={privateCount} icon={User} color="bg-[#FFF7ED]" active={typeFilter === 'Yksityinen'} onClick={() => setTypeFilter('Yksityinen')} />
        <FilterCard title="Taloyhtiöt" count={housingCount} icon={Home} color="bg-[#DCFCE7]" active={typeFilter === 'Taloyhtiö'} onClick={() => setTypeFilter('Taloyhtiö')} />
      </div>

      {/* ── Search ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Hae asiakkaita..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 border-[#E2E8F0]"
          />
        </div>
      </div>

      {/* ── Customer Table ── */}
      <Card className="border border-[#E2E8F0] shadow-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F8FAFC] hover:bg-[#F8FAFC]">
                <TableHead className="text-caption text-text-secondary uppercase tracking-wider font-semibold">Nimi</TableHead>
                <TableHead className="text-caption text-text-secondary uppercase tracking-wider font-semibold">Tyyppi</TableHead>
                <TableHead className="text-caption text-text-secondary uppercase tracking-wider font-semibold">Yhteystieto</TableHead>
                <TableHead className="text-caption text-text-secondary uppercase tracking-wider font-semibold">Puhelin</TableHead>
                <TableHead className="text-caption text-text-secondary uppercase tracking-wider font-semibold">Sähköposti</TableHead>
                <TableHead className="text-caption text-text-secondary uppercase tracking-wider font-semibold text-center">Projektit</TableHead>
                <TableHead className="text-caption text-text-secondary uppercase tracking-wider font-semibold">Viimeisin</TableHead>
                <TableHead className="text-caption text-text-secondary uppercase tracking-wider font-semibold">Status</TableHead>
                <TableHead className="text-caption text-text-secondary uppercase tracking-wider font-semibold text-right">Toiminnot</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {filteredCustomers.map((customer, i) => {
                  const Icon = typeIcon(customer.type);
                  return (
                    <motion.tr
                      key={customer.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.03, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
                      className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                      onClick={() => handleRowClick(customer)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className={cn('text-[10px] font-semibold', avatarColor(customer.name))}>
                              {avatarInitials(customer.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-semibold text-text-primary">{customer.name}</p>
                            <p className="text-[11px] text-text-muted">{customer.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('text-[11px]', typeColor(customer.type))}>
                          {customer.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-text-secondary">
                        {customer.contactPerson || customer.name}
                      </TableCell>
                      <TableCell className="text-sm text-text-secondary">{customer.phone}</TableCell>
                      <TableCell className="text-sm text-text-secondary">{customer.email}</TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-light text-primary text-xs font-mono font-semibold">
                          {customer.projectCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-text-secondary">{customer.lastContact}</TableCell>
                      <TableCell>
                        <Badge className={cn('text-[11px]', statusColor(customer.status))}>
                          {customer.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-text-muted hover:text-primary">
                            <Eye size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-text-muted hover:text-info">
                            <Edit3 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Detail Drawer ── */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-[480px] p-0 overflow-hidden">
          {selectedCustomer && (
            <>
              <SheetHeader className="p-6 pb-4 border-b border-[#E2E8F0]">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center',
                      selectedCustomer.type === 'Yritys' ? 'bg-info-light' :
                      selectedCustomer.type === 'Yksityinen' ? 'bg-success-light' : 'bg-[#F3E8FF]'
                    )}>
                      {(() => {
                        const Icon = typeIcon(selectedCustomer.type);
                        return <Icon size={24} className={
                          selectedCustomer.type === 'Yritys' ? 'text-info' :
                          selectedCustomer.type === 'Yksityinen' ? 'text-success' : 'text-[#9333EA]'
                        } />;
                      })()}
                    </div>
                    <div>
                      <SheetTitle className="text-h2 text-text-primary">{selectedCustomer.name}</SheetTitle>
                      <p className="text-caption text-text-muted mt-0.5">{selectedCustomer.id}</p>
                    </div>
                  </div>
                  <Badge className={cn(statusColor(selectedCustomer.status))}>
                    {selectedCustomer.status}
                  </Badge>
                </div>
              </SheetHeader>

              <div className="h-[calc(100vh-120px)] overflow-auto">
                <div className="p-6 space-y-6">
                  {/* Quick Actions */}
                  <div className="flex items-center gap-2">
                    <Button className="flex-1 bg-primary hover:bg-primary-hover text-white h-9 text-sm">
                      <FolderKanban size={14} className="mr-1.5" />
                      Uusi projekti
                    </Button>
                    <Button variant="outline" className="flex-1 border-[#E2E8F0] h-9 text-sm">
                      <MessageSquare size={14} className="mr-1.5" />
                      Lähetä viesti
                    </Button>
                  </div>

                  {/* Contact Info */}
                  <div className="bg-[#F8FAFC] rounded-xl p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-text-primary">Yhteystiedot</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5">
                        <MapPin size={14} className="text-text-muted" />
                        <span className="text-sm text-text-secondary">{selectedCustomer.address}, {selectedCustomer.postalCode} {selectedCustomer.city}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Phone size={14} className="text-text-muted" />
                        <span className="text-sm text-text-secondary">{selectedCustomer.phone}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Mail size={14} className="text-text-muted" />
                        <span className="text-sm text-text-secondary">{selectedCustomer.email}</span>
                      </div>
                      {selectedCustomer.yTunnus && (
                        <div className="flex items-center gap-2.5">
                          <Briefcase size={14} className="text-text-muted" />
                          <span className="text-sm text-text-secondary">Y-tunnus: {selectedCustomer.yTunnus}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-primary-light rounded-xl p-3 text-center">
                      <FolderKanban size={18} className="mx-auto text-primary mb-1" />
                      <p className="text-lg font-bold font-mono text-text-primary">{selectedCustomer.projectCount}</p>
                      <p className="text-[10px] text-text-secondary">Projektia</p>
                    </div>
                    <div className="bg-success-light rounded-xl p-3 text-center">
                      <Euro size={18} className="mx-auto text-success mb-1" />
                      <p className="text-lg font-bold font-mono text-text-primary">{formatCurrency(selectedTotalValue)}</p>
                      <p className="text-[10px] text-text-secondary">Arvo yht.</p>
                    </div>
                    <div className="bg-info-light rounded-xl p-3 text-center">
                      <CalendarDays size={18} className="mx-auto text-info mb-1" />
                      <p className="text-sm font-bold font-mono text-text-primary mt-1">{selectedCustomer.lastContact}</p>
                      <p className="text-[10px] text-text-secondary">Viim. yhteys</p>
                    </div>
                  </div>

                  {/* Notes */}
                  {selectedCustomer.notes && (
                    <div className="bg-warning-light rounded-xl p-4">
                      <h3 className="text-sm font-semibold text-warning mb-1">Muistiinpanot</h3>
                      <p className="text-sm text-text-secondary">{selectedCustomer.notes}</p>
                    </div>
                  )}

                  <Separator />

                  {/* Project History */}
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary mb-3">Projektihistoria</h3>
                    <div className="space-y-2">
                      {selectedProjects.map((project, i) => (
                        <motion.div
                          key={project.id}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: i * 0.05 }}
                          className="bg-white border border-[#E2E8F0] rounded-lg p-3 hover:shadow-card-hover transition-all duration-200"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-medium text-text-primary">{project.name}</p>
                              <p className="text-xs text-text-muted mt-0.5">{project.date}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-mono text-sm font-semibold text-primary">{formatCurrency(project.value)}</p>
                              <Badge className={cn('text-[10px] mt-1', projectStatusColor(project.status))}>
                                {project.status}
                              </Badge>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Billing Info */}
                  <div className="bg-[#F8FAFC] rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-text-primary mb-2">Laskutustiedot</h3>
                    <div className="space-y-1.5 text-sm text-text-secondary">
                      <p><span className="text-text-muted">Laskutusosoite:</span> {selectedCustomer.address}</p>
                      <p><span className="text-text-muted">Postiosoite:</span> {selectedCustomer.postalCode} {selectedCustomer.city}</p>
                      <p><span className="text-text-muted">Maksuehto:</span> 14 pv netto</p>
                      <p><span className="text-text-muted">ALV:</span> 24 %</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Add Customer Dialog ── */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-h2">Lisää uusi asiakas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {/* Customer Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Asiakastyyppi</label>
              <Tabs value={customerTypeTab} onValueChange={setCustomerTypeTab} className="w-full">
                <TabsList className="grid grid-cols-3 w-full bg-bg-light border border-[#E2E8F0]">
                  <TabsTrigger value="all" className="data-[state=active]:bg-white data-[state=active]:text-primary text-xs">
                    Yritys
                  </TabsTrigger>
                  <TabsTrigger value="yksityinen" className="data-[state=active]:bg-white data-[state=active]:text-primary text-xs">
                    Yksityinen
                  </TabsTrigger>
                  <TabsTrigger value="taloyhtio" className="data-[state=active]:bg-white data-[state=active]:text-primary text-xs">
                    Taloyhtiö
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Nimi</label>
              <Input placeholder="Asiakkaan nimi" className="border-[#E2E8F0]" />
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

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Katuosoite</label>
              <Input placeholder="Katuosoite" className="border-[#E2E8F0]" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">Postinumero</label>
                <Input placeholder="00100" className="border-[#E2E8F0]" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">Postitoimipaikka</label>
                <Input placeholder="Helsinki" className="border-[#E2E8F0]" />
              </div>
            </div>

            {(customerTypeTab === 'all') && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">Y-tunnus</label>
                <Input placeholder="1234567-8" className="border-[#E2E8F0]" />
              </div>
            )}

            {(customerTypeTab === 'all' || customerTypeTab === 'taloyhtio') && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">{customerTypeTab === 'taloyhtio' ? 'Isännöitsijä' : 'Yhteyshenkilö'}</label>
                <Input placeholder="Nimi" className="border-[#E2E8F0]" />
              </div>
            )}

            {customerTypeTab === 'taloyhtio' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary">Huoneistojen määrä</label>
                  <Input type="number" placeholder="0" className="border-[#E2E8F0]" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary">Rakennusvuosi</label>
                  <Input type="number" placeholder="1980" className="border-[#E2E8F0]" />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Lisätiedot</label>
              <textarea
                className="w-full min-h-[80px] rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                placeholder="Kirjoita lisätietoja..."
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button variant="outline" className="flex-1 border-[#E2E8F0]" onClick={() => setAddDialogOpen(false)}>
                Peruuta
              </Button>
              <Button className="flex-1 bg-primary hover:bg-primary-hover text-white" onClick={() => setAddDialogOpen(false)}>
                Tallenna asiakas
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
