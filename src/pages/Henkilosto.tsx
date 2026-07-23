import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, UserCheck, Calendar, GraduationCap, HardHat, Wrench, Briefcase,
  Phone, Mail, Search, Plus, Download, Settings, MoreHorizontal, CheckCircle,
  AlertTriangle, XCircle, Clock, ChevronRight, Shield, Eye, Pencil, ToggleLeft,
  Award, FileText, Euro
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

/* ─── Easing ─── */
const ease = [0.4, 0, 0.2, 1] as [number, number, number, number];

/* ─── Mock Data ─── */
const employees = [
  { id: 'RF001', name: 'Matti Meikäläinen', role: 'Työnjohtaja', dept: 'Työnjohto', phone: '040-1112222', email: 'matti.meikalainen@remonttiflow.fi', startDate: '2019-03-01', status: 'Aktiivinen', project: 'Tampere', age: 42 },
  { id: 'RF002', name: 'Liisa Virtanen', role: 'Projektipäällikkö', dept: 'Hallinto', phone: '040-3334444', email: 'liisa.virtanen@remonttiflow.fi', startDate: '2020-06-15', status: 'Aktiivinen', project: 'Kaikki', age: 35 },
  { id: 'RF003', name: 'Juha Korhonen', role: 'Rakennustyöntekijä', dept: 'Työntekijät', phone: '040-5556666', email: 'juha.korhonen@remonttiflow.fi', startDate: '2021-01-10', status: 'Aktiivinen', project: 'Tampere', age: 29 },
  { id: 'RF004', name: 'Anna Järvinen', role: 'LVI-asentaja', dept: 'Työntekijät', phone: '040-7778888', email: 'anna.jarvinen@remonttiflow.fi', startDate: '2020-09-01', status: 'Aktiivinen', project: 'Helsinki', age: 31 },
  { id: 'RF005', name: 'Pekka Salminen', role: 'Rakennustyöntekijä', dept: 'Työntekijät', phone: '040-9990000', email: 'pekka.salminen@remonttiflow.fi', startDate: '2022-02-14', status: 'Lomalla', project: 'Espoo', age: 27 },
  { id: 'RF006', name: 'Sari Rantanen', role: 'HR-koordinaattori', dept: 'Toimisto', phone: '040-1122334', email: 'sari.rantanen@remonttiflow.fi', startDate: '2018-11-01', status: 'Aktiivinen', project: 'Toimisto', age: 45 },
  { id: 'RF007', name: 'Jukka Lehtonen', role: 'Sähköasentaja', dept: 'Työntekijät', phone: '040-3344556', email: 'jukka.lehtonen@remonttiflow.fi', startDate: '2021-05-20', status: 'Aktiivinen', project: 'Espoo', age: 33 },
  { id: 'RF008', name: 'Marja Nieminen', role: 'Työmaasihteeri', dept: 'Toimisto', phone: '040-5566778', email: 'marja.nieminen@remonttiflow.fi', startDate: '2019-08-12', status: 'Aktiivinen', project: 'Kaikki', age: 38 },
  { id: 'RF009', name: 'Timo Mäkinen', role: 'Apumies', dept: 'Työntekijät', phone: '040-7788990', email: 'timo.makinen@remonttiflow.fi', startDate: '2023-01-05', status: 'Sapattivapaa', project: '-', age: 24 },
  { id: 'RF010', name: 'Kaisa Heikkinen', role: 'Sähköasentaja', dept: 'Työntekijät', phone: '040-9900112', email: 'kaisa.heikkinen@remonttiflow.fi', startDate: '2022-06-01', status: 'Aktiivinen', project: 'Helsinki', age: 28 },
];

const roles = [
  { name: 'Työnjohtaja', description: 'Vastaa työmaan päivittäisjohtamisesta, työturvallisuudesta ja aikataulusta', count: 4, permissions: ['read', 'write', 'write', 'read', 'write', 'read', 'write', 'read'] },
  { name: 'Projektipäällikkö', description: 'Johtaa projektin kokonaisuutta, budjettia ja asiakassuhteita', count: 2, permissions: ['write', 'write', 'write', 'write', 'write', 'read', 'write', 'write'] },
  { name: 'Rakennustyöntekijä', description: 'Suorittaa rakennustyöt työnjohdon ohjeiden mukaisesti', count: 6, permissions: ['read', 'none', 'none', 'read', 'write', 'none', 'read', 'none'] },
  { name: 'Sähköasentaja', description: 'Asentaa ja huoltaa sähköjärjestelmiä', count: 3, permissions: ['read', 'none', 'none', 'read', 'write', 'none', 'read', 'none'] },
  { name: 'LVI-asentaja', description: 'Asentaa LVI-järjestelmiä', count: 2, permissions: ['read', 'none', 'none', 'read', 'write', 'none', 'read', 'none'] },
  { name: 'Hallinto', description: 'Yrityksen hallinnolliset tehtävät ja talous', count: 2, permissions: ['write', 'write', 'write', 'write', 'write', 'write', 'write', 'write'] },
  { name: 'Apumies', description: 'Avustaa kokeneempia työntekijöitä', count: 2, permissions: ['read', 'none', 'none', 'read', 'write', 'none', 'read', 'none'] },
];

const permissionModules = ['Projektit', 'Työmääräykset', 'Aikataulu', 'Tuntikirjaukset', 'Työturvallisuus', 'Lomakkeet', 'Kalusto', 'Raportit'];

const certificates = [
  { employee: 'Matti Meikäläinen', cert: 'Työturvallisuuskortti', issued: '2023-01-15', expires: '2028-01-15', status: 'valid' },
  { employee: 'Matti Meikäläinen', cert: 'Tulityökortti', issued: '2024-03-10', expires: '2029-03-10', status: 'valid' },
  { employee: 'Juha Korhonen', cert: 'Työturvallisuuskortti', issued: '2022-05-20', expires: '2027-05-20', status: 'valid' },
  { employee: 'Juha Korhonen', cert: 'Koneenkuljettaja', issued: '2023-08-01', expires: '2028-08-01', status: 'valid' },
  { employee: 'Anna Järvinen', cert: 'Työturvallisuuskortti', issued: '2021-11-10', expires: '2026-11-10', status: 'expiring' },
  { employee: 'Anna Järvinen', cert: 'Tulityökortti', issued: '2023-02-01', expires: '2028-02-01', status: 'valid' },
  { employee: 'Jukka Lehtonen', cert: 'Sähkötyöturvallisuus', issued: '2024-01-10', expires: '2027-01-10', status: 'valid' },
  { employee: 'Jukka Lehtonen', cert: 'Työturvallisuuskortti', issued: '2020-06-15', expires: '2025-06-15', status: 'expired' },
  { employee: 'Pekka Salminen', cert: 'Työturvallisuuskortti', issued: '2024-04-01', expires: '2029-04-01', status: 'valid' },
  { employee: 'Kaisa Heikkinen', cert: 'Sähkötyöturvallisuus', issued: '2022-09-01', expires: '2025-09-01', status: 'expiring' },
  { employee: 'Timo Mäkinen', cert: 'Työturvallisuuskortti', issued: '2023-06-01', expires: '2028-06-01', status: 'valid' },
  { employee: 'Liisa Virtanen', cert: 'ENSI (ensiapu)', issued: '2024-02-15', expires: '2027-02-15', status: 'valid' },
  { employee: 'Marja Nieminen', cert: 'Työturvallisuuskortti', issued: '2023-10-10', expires: '2028-10-10', status: 'valid' },
];

const vacations = [
  { employee: 'Pekka Salminen', type: 'Kesäloma', start: '2025-06-16', end: '2025-06-30', days: 10, status: 'Hyväksytty' },
  { employee: 'Matti Meikäläinen', type: 'Kesäloma', start: '2025-07-07', end: '2025-07-21', days: 15, status: 'Hyväksytty' },
  { employee: 'Anna Järvinen', type: 'Talviloma', start: '2025-02-10', end: '2025-02-14', days: 5, status: 'Hyväksytty' },
  { employee: 'Juha Korhonen', type: 'Sairausloma', start: '2025-06-10', end: '2025-06-13', days: 4, status: 'Hyväksytty' },
  { employee: 'Timo Mäkinen', type: 'Opintovapaa', start: '2025-08-01', end: '2025-12-31', days: 120, status: 'Odottaa' },
  { employee: 'Sari Rantanen', type: 'Kesäloma', start: '2025-07-14', end: '2025-07-28', days: 15, status: 'Odottaa' },
];

const salaries = [
  { employee: 'Matti Meikäläinen', monthly: 4200, hourly: 24.5, overtime: 12, bonus: 300, total: 4802 },
  { employee: 'Liisa Virtanen', monthly: 4800, hourly: 28.0, overtime: 0, bonus: 200, total: 5000 },
  { employee: 'Juha Korhonen', monthly: 0, hourly: 18.5, overtime: 24, bonus: 150, total: 3714 },
  { employee: 'Anna Järvinen', monthly: 0, hourly: 20.0, overtime: 8, bonus: 100, total: 3540 },
  { employee: 'Pekka Salminen', monthly: 0, hourly: 17.0, overtime: 16, bonus: 0, total: 2992 },
  { employee: 'Sari Rantanen', monthly: 3800, hourly: 22.0, overtime: 0, bonus: 0, total: 3800 },
  { employee: 'Jukka Lehtonen', monthly: 0, hourly: 21.0, overtime: 6, bonus: 100, total: 3706 },
  { employee: 'Marja Nieminen', monthly: 3500, hourly: 20.3, overtime: 0, bonus: 0, total: 3500 },
  { employee: 'Timo Mäkinen', monthly: 0, hourly: 15.5, overtime: 20, bonus: 0, total: 2790 },
  { employee: 'Kaisa Heikkinen', monthly: 0, hourly: 20.0, overtime: 10, bonus: 50, total: 3650 },
];

/* ─── Helpers ─── */
const statusColor = (status: string) => {
  switch (status) {
    case 'Aktiivinen': return 'bg-success-light text-success';
    case 'Lomalla': return 'bg-info-light text-info';
    case 'Sapattivapaa': return 'bg-warning-light text-warning';
    case 'Eroonnut': return 'bg-gray-100 text-gray-500';
    default: return 'bg-gray-100 text-gray-500';
  }
};

const certStatusColor = (status: string) => {
  switch (status) {
    case 'valid': return { bg: 'bg-success-light', text: 'text-success', label: 'Voimassa', icon: CheckCircle };
    case 'expiring': return { bg: 'bg-warning-light', text: 'text-warning', label: 'Vanhenemassa', icon: AlertTriangle };
    case 'expired': return { bg: 'bg-destructive-light', text: 'text-destructive', label: 'Vanhentunut', icon: XCircle };
    default: return { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Tuntematon', icon: Clock };
  }
};

const vacationStatusColor = (status: string) => {
  switch (status) {
    case 'Hyväksytty': return 'bg-success-light text-success';
    case 'Odottaa': return 'bg-warning-light text-warning';
    case 'Hylätty': return 'bg-destructive-light text-destructive';
    default: return 'bg-gray-100 text-gray-500';
  }
};

const vacationTypeIcon = (type: string) => {
  switch (type) {
    case 'Kesäloma': return 'bg-green-100 text-green-600';
    case 'Talviloma': return 'bg-blue-100 text-blue-600';
    case 'Sairausloma': return 'bg-red-100 text-red-600';
    case 'Opintovapaa': return 'bg-purple-100 text-purple-600';
    default: return 'bg-gray-100 text-gray-600';
  }
};

const permIcon = (perm: string) => {
  switch (perm) {
    case 'write': return <CheckCircle size={14} className="text-success" />;
    case 'read': return <Eye size={14} className="text-warning" />;
    case 'none': return <XCircle size={14} className="text-text-muted" />;
    default: return null;
  }
};

const permLabel = (perm: string) => {
  switch (perm) {
    case 'write': return 'Muokkaus';
    case 'read': return 'Katselu';
    case 'none': return 'Ei oikeutta';
    default: return '';
  }
};

/* ─── Status Badge Component ─── */
function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn('font-medium border-0', statusColor(status))}>
      <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5', status === 'Aktiivinen' ? 'bg-success' : status === 'Lomalla' ? 'bg-info' : status === 'Sapattivapaa' ? 'bg-warning' : 'bg-gray-400')} />
      {status}
    </Badge>
  );
}

/* ─── KPI Card ─── */
function KPICard({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string; size?: number }>; label: string; value: string; sub?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease }}>
      <Card className="border border-[#E2E8F0] shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-caption text-text-secondary uppercase tracking-wider">{label}</p>
              <p className="text-hero text-text-primary mt-1 font-mono">{value}</p>
              {sub && <p className="text-body-sm text-text-secondary mt-1">{sub}</p>}
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
              <Icon size={20} className="text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── Page Component ─── */
export default function Henkilosto() {
  const [activeTab, setActiveTab] = useState('henkilot');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('Kaikki');

  const filteredEmployees = employees.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = filterDept === 'Kaikki' || e.dept === filterDept;
    return matchesSearch && matchesDept;
  });

  const deptCounts = {
    'Kaikki': employees.length,
    'Työnjohto': employees.filter(e => e.dept === 'Työnjohto').length,
    'Työntekijät': employees.filter(e => e.dept === 'Työntekijät').length,
    'Toimisto': employees.filter(e => e.dept === 'Toimisto').length,
  };

  const presentCount = employees.filter(e => e.status === 'Aktiivinen').length;
  const avgAge = Math.round(employees.reduce((sum, e) => sum + e.age, 0) / employees.length);
  const trainingHours = 156;

  const onVacationNow = vacations.filter(v => v.status === 'Hyväksytty' && new Date(v.start) <= new Date() && new Date(v.end) >= new Date()).length;
  const pendingRequests = vacations.filter(v => v.status === 'Odottaa').length;

  const validCerts = certificates.filter(c => c.status === 'valid').length;
  const expiringCerts = certificates.filter(c => c.status === 'expiring').length;
  const expiredCerts = certificates.filter(c => c.status === 'expired').length;

  const totalSalary = salaries.reduce((sum, s) => sum + s.total, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease }}>
      {/* ─── Page Header ─── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-hero text-text-primary">Henkilöstö</h1>
          <p className="text-body-sm text-text-secondary mt-1">Henkilöstöhallinto ja rekisteri</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download size={16} /> Vie
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Settings size={16} /> Roolit
          </Button>
          <Button size="sm" className="gap-1.5 bg-primary hover:bg-primary-hover">
            <Plus size={16} /> Lisää henkilö
          </Button>
        </div>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard icon={Users} label="Työntekijät yhteensä" value={String(employees.length)} sub={`${presentCount} paikalla tänään`} />
        <KPICard icon={UserCheck} label="Paikalla tänään" value={String(presentCount)} sub={`${employees.length - presentCount} poissa`} />
        <KPICard icon={Calendar} label="Keski-ikä" value={String(avgAge)} sub="vuotta" />
        <KPICard icon={GraduationCap} label="Koulutustunteja kuussa" value={String(trainingHours)} sub="kumulatiivinen" />
      </div>

      {/* ─── Tabs ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 bg-bg-light border border-[#E2E8F0]">
          <TabsTrigger value="henkilot" className="data-[state=active]:bg-primary data-[state=active]:text-white">Henkilöt</TabsTrigger>
          <TabsTrigger value="roolit" className="data-[state=active]:bg-primary data-[state=active]:text-white">Roolit</TabsTrigger>
          <TabsTrigger value="sertifikaatit" className="data-[state=active]:bg-primary data-[state=active]:text-white">Sertifikaatit</TabsTrigger>
          <TabsTrigger value="lomat" className="data-[state=active]:bg-primary data-[state=active]:text-white">Lomat</TabsTrigger>
          <TabsTrigger value="palkka" className="data-[state=active]:bg-primary data-[state=active]:text-white">Palkka</TabsTrigger>
        </TabsList>

        {/* ─── TAB: Henkilöt ─── */}
        <TabsContent value="henkilot">
          <AnimatePresence mode="wait">
            <motion.div key="henkilot" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease }}>
              {/* Filter Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {(['Kaikki', 'Työnjohto', 'Työntekijät', 'Toimisto'] as const).map((dept) => (
                  <button
                    key={dept}
                    onClick={() => setFilterDept(dept)}
                    className={cn(
                      'flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 text-left',
                      filterDept === dept
                        ? 'border-primary bg-primary-light shadow-sm'
                        : 'border-[#E2E8F0] bg-white hover:bg-bg-light'
                    )}
                  >
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', dept === 'Kaikki' ? 'bg-bg-light' : dept === 'Työnjohto' ? 'bg-primary-light' : dept === 'Työntekijät' ? 'bg-info-light' : 'bg-success-light')}>
                      {dept === 'Kaikki' ? <Users size={18} className="text-text-secondary" /> :
                       dept === 'Työnjohto' ? <HardHat size={18} className="text-primary" /> :
                       dept === 'Työntekijät' ? <Wrench size={18} className="text-info" /> :
                       <Briefcase size={18} className="text-success" />}
                    </div>
                    <div>
                      <p className="text-caption text-text-secondary">{dept}</p>
                      <p className="text-h3 text-text-primary">{deptCounts[dept]}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative mb-4">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <Input
                  placeholder="Hae henkilöitä..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 max-w-sm"
                />
              </div>

              {/* Employee Table */}
              <Card className="border border-[#E2E8F0] shadow-card">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-bg-light hover:bg-bg-light">
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Nimi</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Rooli</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Osasto</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Puhelin</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Sähköposti</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Aloituspäivä</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Status</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider w-[100px]">Toiminnot</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployees.map((emp, i) => (
                        <motion.tr
                          key={emp.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: i * 0.03, ease }}
                          className="border-b border-[#F1F5F9] hover:bg-bg-light transition-colors"
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarFallback className="bg-primary-light text-primary text-xs font-semibold">
                                  {emp.name.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium text-text-primary">{emp.name}</p>
                                <p className="text-caption text-text-muted">{emp.id}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-text-primary">{emp.role}</TableCell>
                          <TableCell className="text-sm text-text-secondary">{emp.dept}</TableCell>
                          <TableCell className="text-sm text-text-secondary">
                            <div className="flex items-center gap-1"><Phone size={12} />{emp.phone}</div>
                          </TableCell>
                          <TableCell className="text-sm text-text-secondary">
                            <div className="flex items-center gap-1"><Mail size={12} />{emp.email}</div>
                          </TableCell>
                          <TableCell className="text-sm text-text-secondary">{emp.startDate}</TableCell>
                          <TableCell><StatusBadge status={emp.status} /></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8"><Eye size={14} /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil size={14} /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal size={14} /></Button>
                            </div>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        </TabsContent>

        {/* ─── TAB: Roolit ─── */}
        <TabsContent value="roolit">
          <AnimatePresence mode="wait">
            <motion.div key="roolit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease }}>
              <Card className="border border-[#E2E8F0] shadow-card">
                <CardHeader className="px-6 py-5">
                  <CardTitle className="text-h2 text-text-primary">Roolit ja oikeudet</CardTitle>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-bg-light hover:bg-bg-light">
                          <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Rooli</TableHead>
                          <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Kuvaus</TableHead>
                          <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider text-center">Henkilömäärä</TableHead>
                          {permissionModules.map(m => (
                            <TableHead key={m} className="text-caption uppercase text-text-secondary font-semibold tracking-wider text-center">{m}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {roles.map((role, ri) => (
                          <motion.tr
                            key={role.name}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2, delay: ri * 0.05, ease }}
                            className="border-b border-[#F1F5F9] hover:bg-bg-light transition-colors"
                          >
                            <TableCell className="font-medium text-text-primary">{role.name}</TableCell>
                            <TableCell className="text-sm text-text-secondary max-w-xs">{role.description}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="bg-bg-light">{role.count}</Badge>
                            </TableCell>
                            {role.permissions.map((perm, pi) => (
                              <TableCell key={pi} className="text-center">
                                <div className="flex justify-center" title={permLabel(perm)}>
                                  {permIcon(perm)}
                                </div>
                              </TableCell>
                            ))}
                          </motion.tr>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        </TabsContent>

        {/* ─── TAB: Sertifikaatit ─── */}
        <TabsContent value="sertifikaatit">
          <AnimatePresence mode="wait">
            <motion.div key="sertifikaatit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease }}>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <Card className="border border-[#E2E8F0] shadow-card">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-success-light flex items-center justify-center">
                      <CheckCircle size={24} className="text-success" />
                    </div>
                    <div>
                      <p className="text-caption text-text-secondary">Voimassa olevat</p>
                      <p className="text-h1 text-success font-mono">{validCerts}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border border-[#E2E8F0] shadow-card">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-warning-light flex items-center justify-center">
                      <AlertTriangle size={24} className="text-warning" />
                    </div>
                    <div>
                      <p className="text-caption text-text-secondary">Vanhenemassa (&lt; 3 kk)</p>
                      <p className="text-h1 text-warning font-mono">{expiringCerts}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border border-[#E2E8F0] shadow-card">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-destructive-light flex items-center justify-center">
                      <XCircle size={24} className="text-destructive" />
                    </div>
                    <div>
                      <p className="text-caption text-text-secondary">Vanhentuneet</p>
                      <p className="text-h1 text-destructive font-mono">{expiredCerts}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Certificate Table */}
              <Card className="border border-[#E2E8F0] shadow-card">
                <CardHeader className="px-6 py-5">
                  <CardTitle className="text-h2 text-text-primary">Sertifikaattirekisteri</CardTitle>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-bg-light hover:bg-bg-light">
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Henkilö</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Sertifikaatti</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Myönnetty</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Voimassa asti</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {certificates.map((cert, i) => {
                        const statusInfo = certStatusColor(cert.status);
                        const StatusIcon = statusInfo.icon;
                        return (
                          <motion.tr
                            key={`${cert.employee}-${cert.cert}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2, delay: i * 0.02, ease }}
                            className="border-b border-[#F1F5F9] hover:bg-bg-light transition-colors"
                          >
                            <TableCell className="font-medium text-text-primary">{cert.employee}</TableCell>
                            <TableCell className="text-sm text-text-secondary">
                              <div className="flex items-center gap-1.5">
                                <Award size={14} className="text-primary" />
                                {cert.cert}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-text-secondary">{cert.issued}</TableCell>
                            <TableCell className="text-sm text-text-secondary">{cert.expires}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn('font-medium border-0 gap-1', statusInfo.bg, statusInfo.text)}>
                                <StatusIcon size={12} />
                                {statusInfo.label}
                              </Badge>
                            </TableCell>
                          </motion.tr>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        </TabsContent>

        {/* ─── TAB: Lomat ─── */}
        <TabsContent value="lomat">
          <AnimatePresence mode="wait">
            <motion.div key="lomat" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease }}>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
                <Card className="border border-[#E2E8F0] shadow-card">
                  <CardContent className="p-5">
                    <p className="text-caption text-text-secondary">Lomalla nyt</p>
                    <p className="text-h1 text-info font-mono mt-1">{onVacationNow}</p>
                  </CardContent>
                </Card>
                <Card className="border border-[#E2E8F0] shadow-card">
                  <CardContent className="p-5">
                    <p className="text-caption text-text-secondary">Lomahakemukset jonossa</p>
                    <p className="text-h1 text-warning font-mono mt-1">{pendingRequests}</p>
                  </CardContent>
                </Card>
                <Card className="border border-[#E2E8F0] shadow-card">
                  <CardContent className="p-5">
                    <p className="text-caption text-text-secondary">Kesälomia yhteensä</p>
                    <p className="text-h1 text-primary font-mono mt-1">{vacations.filter(v => v.type === 'Kesäloma').reduce((s, v) => s + v.days, 0)} pv</p>
                  </CardContent>
                </Card>
                <Card className="border border-[#E2E8F0] shadow-card">
                  <CardContent className="p-5">
                    <p className="text-caption text-text-secondary">Sairauslomia (kk)</p>
                    <p className="text-h1 text-destructive font-mono mt-1">{vacations.filter(v => v.type === 'Sairausloma').reduce((s, v) => s + v.days, 0)} pv</p>
                  </CardContent>
                </Card>
              </div>

              {/* Vacation Table */}
              <Card className="border border-[#E2E8F0] shadow-card">
                <CardHeader className="px-6 py-5">
                  <CardTitle className="text-h2 text-text-primary">Lomat ja poissaolot</CardTitle>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-bg-light hover:bg-bg-light">
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Henkilö</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Tyyppi</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Alku</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Loppu</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Päivät</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vacations.map((vac, i) => (
                        <motion.tr
                          key={`${vac.employee}-${vac.start}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.2, delay: i * 0.04, ease }}
                          className="border-b border-[#F1F5F9] hover:bg-bg-light transition-colors"
                        >
                          <TableCell className="font-medium text-text-primary">{vac.employee}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('border-0 gap-1', vacationTypeIcon(vac.type))}>
                              {vac.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-text-secondary">{vac.start}</TableCell>
                          <TableCell className="text-sm text-text-secondary">{vac.end}</TableCell>
                          <TableCell className="text-sm text-text-primary font-mono">{vac.days} pv</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('font-medium border-0', vacationStatusColor(vac.status))}>
                              {vac.status}
                            </Badge>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        </TabsContent>

        {/* ─── TAB: Palkka ─── */}
        <TabsContent value="palkka">
          <AnimatePresence mode="wait">
            <motion.div key="palkka" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease }}>
              {/* Total Summary */}
              <Card className="border border-[#E2E8F0] shadow-card mb-4">
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center">
                      <Euro size={24} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-caption text-text-secondary">Kuukausipalkat yhteensä (heinäkuu 2025)</p>
                      <p className="text-h1 text-text-primary font-mono">{totalSalary.toLocaleString('fi-FI')} €</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5"><Download size={14} /> Vie palkkatiedot</Button>
                  </div>
                </CardContent>
              </Card>

              {/* Salary Table */}
              <Card className="border border-[#E2E8F0] shadow-card">
                <CardHeader className="px-6 py-5">
                  <CardTitle className="text-h2 text-text-primary">Palkkayleiskatsaus</CardTitle>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-bg-light hover:bg-bg-light">
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Henkilö</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider text-right">Kuukausipalkka</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider text-right">Tuntipalkka</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider text-right">Ylityötunnit</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider text-right">Lisät</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider text-right">Yhteensä</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salaries.map((sal, i) => (
                        <motion.tr
                          key={sal.employee}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.2, delay: i * 0.03, ease }}
                          className="border-b border-[#F1F5F9] hover:bg-bg-light transition-colors"
                        >
                          <TableCell className="font-medium text-text-primary">{sal.employee}</TableCell>
                          <TableCell className="text-sm text-text-secondary text-right font-mono">{sal.monthly > 0 ? `${sal.monthly.toLocaleString('fi-FI')} €` : '-'}</TableCell>
                          <TableCell className="text-sm text-text-secondary text-right font-mono">{sal.hourly.toFixed(1).replace('.', ',')} €</TableCell>
                          <TableCell className="text-sm text-text-secondary text-right font-mono">{sal.overtime} h</TableCell>
                          <TableCell className="text-sm text-text-secondary text-right font-mono">{sal.bonus > 0 ? `${sal.bonus} €` : '-'}</TableCell>
                          <TableCell className="text-sm text-text-primary font-semibold text-right font-mono">{sal.total.toLocaleString('fi-FI')} €</TableCell>
                        </motion.tr>
                      ))}
                      <TableRow className="bg-bg-light font-semibold">
                        <TableCell className="text-text-primary">Yhteensä</TableCell>
                        <TableCell className="text-right font-mono">{salaries.filter(s => s.monthly > 0).reduce((s, v) => s + v.monthly, 0).toLocaleString('fi-FI')} €</TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right font-mono">{salaries.reduce((s, v) => s + v.overtime, 0)} h</TableCell>
                        <TableCell className="text-right font-mono">{salaries.reduce((s, v) => s + v.bonus, 0)} €</TableCell>
                        <TableCell className="text-right font-mono text-text-primary">{totalSalary.toLocaleString('fi-FI')} €</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
