import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserCheck,
  Calendar,
  GraduationCap,
  Phone,
  Mail,
  Search,
  Plus,
  CheckCircle,
  AlertTriangle,
  Award,
  Trash2,
  Edit3,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { BRAND } from '@/config/brand';
import type { Employee, EmployeeStatus } from '@/types';

/* ─── Mock Data ─── */
const initialEmployees: Employee[] = [
  { id: '1', name: 'Matti Korhonen', role: 'Putkimies', department: 'LVI', phone: '040-1234567', email: `matti.k@${BRAND.emailDomain}`, status: 'Aktiivinen', projects: 2, hours: 1520, training: 4, certifications: ['LVI-perustutkinto', 'Työturvallisuus'], startDate: '2019-03-01' },
  { id: '2', name: 'Laura Virtanen', role: 'Laatoittaja', department: 'Pinnat', phone: '040-2345678', email: `laura.v@${BRAND.emailDomain}`, status: 'Aktiivinen', projects: 1, hours: 1480, training: 3, certifications: ['Pinnoitusalan perustutkinto'], startDate: '2020-06-15' },
  { id: '3', name: 'Jussi Mäkinen', role: 'Sähkömies', department: 'Sähkö', phone: '040-3456789', email: `jussi.m@${BRAND.emailDomain}`, status: 'Lomalla', projects: 1, hours: 1600, training: 5, certifications: ['Sähkötekniikan perustutkinto', 'Sähköturvallisuus S2'], startDate: '2018-01-10' },
  { id: '4', name: 'Anna Salminen', role: 'LVI-asentaja', department: 'LVI', phone: '040-4567890', email: `anna.s@${BRAND.emailDomain}`, status: 'Aktiivinen', projects: 2, hours: 1450, training: 4, certifications: ['LVI-asentaja', 'Kaaasujärjestelmät'], startDate: '2021-02-01' },
  { id: '5', name: 'Pekka Heikkinen', role: 'Rakennusmies', department: 'Yleinen', phone: '040-5678901', email: `pekka.h@${BRAND.emailDomain}`, status: 'Aktiivinen', projects: 1, hours: 1550, training: 3, certifications: ['Rakennusalan perustutkinto'], startDate: '2020-09-01' },
  { id: '6', name: 'Maria Lehtonen', role: 'Työnjohtaja', department: 'Johto', phone: '040-6789012', email: `maria.l@${BRAND.emailDomain}`, status: 'Aktiivinen', projects: 5, hours: 1680, training: 6, certifications: ['Rakennusmestari', 'Työturvallisuus', 'LEED AP'], startDate: '2015-04-01' },
  { id: '7', name: 'Timo Rantanen', role: 'Maalari', department: 'Pinnat', phone: '040-7890123', email: `timo.r@${BRAND.emailDomain}`, status: 'Sairas', projects: 0, hours: 1200, training: 2, certifications: ['Maalarin perustutkinto'], startDate: '2022-01-15' },
  { id: '8', name: 'Satu Koskinen', role: 'Siivooja', department: 'Kiinteistö', phone: '040-8901234', email: `satu.k@${BRAND.emailDomain}`, status: 'Aktiivinen', projects: 3, hours: 1400, training: 2, certifications: ['Kiinteistöhuollon ammattitutkinto'], startDate: '2021-08-01' },
  { id: '9', name: 'Jukka Laine', role: 'Sähköasentaja', department: 'Sähkö', phone: '040-9012345', email: `jukka.l@${BRAND.emailDomain}`, status: 'Koulutuksessa', projects: 0, hours: 800, training: 1, certifications: ['Sähköasentajan perustutkinto'], startDate: '2023-03-01' },
  { id: '10', name: 'Liisa Nieminen', role: 'Rakennusmies', department: 'Yleinen', phone: '040-0123456', email: `liisa.n@${BRAND.emailDomain}`, status: 'Aktiivinen', projects: 2, hours: 1500, training: 3, certifications: ['Rakennusalan perustutkinto', 'Työturvallisuus'], startDate: '2020-05-15' },
];

const kpiData = [
  { label: 'Henkilöstö yhteensä', value: '10', icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
  { label: 'Työssä tänään', value: '7', icon: UserCheck, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { label: 'Lomalla', value: '1', icon: Calendar, color: 'text-amber-500', bg: 'bg-amber-50' },
  { label: 'Sairauspoissa', value: '1', icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50' },
];

const departmentConfig: Record<string, { color: string; bg: string }> = {
  LVI: { color: 'text-blue-700', bg: 'bg-blue-50' },
  Pinnat: { color: 'text-orange-700', bg: 'bg-orange-50' },
  Sähkö: { color: 'text-yellow-700', bg: 'bg-yellow-50' },
  Yleinen: { color: 'text-slate-700', bg: 'bg-slate-50' },
  Johto: { color: 'text-purple-700', bg: 'bg-purple-50' },
  Kiinteistö: { color: 'text-green-700', bg: 'bg-green-50' },
};

/* ─── Component ─── */
export default function Henkilosto() {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Kaikki');
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ name: '', role: '', department: 'Yleinen', status: 'Aktiivinen' as EmployeeStatus, email: '', phone: '' });

  const handleAddEmployee = () => {
    if (!newEmployee.name.trim() || !newEmployee.role.trim()) return;
    const emp: Employee = {
      id: Date.now().toString(),
      name: newEmployee.name,
      role: newEmployee.role,
      department: newEmployee.department,
      status: newEmployee.status,
      phone: newEmployee.phone,
      email: newEmployee.email,
      projects: 0,
      hours: 0,
      training: 0,
      certifications: [],
      startDate: new Date().toISOString().split('T')[0],
    };
    setEmployees(prev => [...prev, emp]);
    setNewEmployee({ name: '', role: '', department: 'Yleinen', status: 'Aktiivinen', email: '', phone: '' });
    setAddDialogOpen(false);
  };

  const handleEditEmployee = (emp: Employee) => {
    setEmployees(prev => prev.map(e => (e.id === emp.id ? emp : e)));
    setEditingEmployee(null);
  };

  const handleDeleteEmployee = (id: string) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
    setDeleteConfirm(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Aktiivinen': return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]"><CheckCircle size={10} className="mr-0.5" />Työssä</Badge>;
      case 'Lomalla': return <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px]"><Calendar size={10} className="mr-0.5" />Lomalla</Badge>;
      case 'Sairas': return <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px]"><AlertTriangle size={10} className="mr-0.5" />Sairas</Badge>;
      case 'Koulutuksessa': return <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px]"><GraduationCap size={10} className="mr-0.5" />Koulutuksessa</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredEmployees = employees.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'Kaikki' || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statuses = ['Kaikki', 'Aktiivinen', 'Lomalla', 'Sairas', 'Koulutuksessa'];
  const statusLabels: Record<string, string> = { Kaikki: 'Kaikki', Aktiivinen: 'Työssä', Lomalla: 'Lomalla', Sairas: 'Sairas', Koulutuksessa: 'Koulutuksessa' };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-6"
    >
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B] flex items-center gap-2">
            <Users className="text-blue-500" size={28} />
            Henkilöstö
          </h1>
          <p className="text-sm text-[#64748B] mt-1">Työntekijät, roolit ja osaaminen</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#1E293B] hover:bg-[#334155] text-white">
              <Plus size={18} className="mr-2" />
              Lisää henkilö
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader><DialogTitle className="text-lg font-semibold text-[#1E293B]">Lisää uusi henkilö</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-4">
              <Input value={newEmployee.name} onChange={e => setNewEmployee(p => ({ ...p, name: e.target.value }))} placeholder="Koko nimi" className="border-[#E2E8F0]" />
              <Input value={newEmployee.role} onChange={e => setNewEmployee(p => ({ ...p, role: e.target.value }))} placeholder="Rooli / Ammattinimike" className="border-[#E2E8F0]" />
              <div className="grid grid-cols-2 gap-3">
                <Select value={newEmployee.department} onValueChange={v => setNewEmployee(p => ({ ...p, department: v }))}>
                  <SelectTrigger className="border-[#E2E8F0]"><SelectValue placeholder="Osasto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LVI">LVI</SelectItem>
                    <SelectItem value="Pinnat">Pinnat</SelectItem>
                    <SelectItem value="Sähkö">Sähkö</SelectItem>
                    <SelectItem value="Yleinen">Yleinen</SelectItem>
                    <SelectItem value="Johto">Johto</SelectItem>
                    <SelectItem value="Kiinteistö">Kiinteistö</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={newEmployee.status} onValueChange={v => setNewEmployee(p => ({ ...p, status: v as EmployeeStatus }))}>
                  <SelectTrigger className="border-[#E2E8F0]"><SelectValue placeholder="Tila" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Aktiivinen">Työssä</SelectItem>
                    <SelectItem value="Lomalla">Lomalla</SelectItem>
                    <SelectItem value="Sairas">Sairas</SelectItem>
                    <SelectItem value="Koulutuksessa">Koulutuksessa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input value={newEmployee.email} onChange={e => setNewEmployee(p => ({ ...p, email: e.target.value }))} placeholder="Sähköposti" className="border-[#E2E8F0]" />
              <Input value={newEmployee.phone} onChange={e => setNewEmployee(p => ({ ...p, phone: e.target.value }))} placeholder="Puhelin" className="border-[#E2E8F0]" />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Peruuta</Button>
                <Button onClick={handleAddEmployee} className="bg-blue-500 hover:bg-blue-600 text-white">Tallenna</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ─── KPI Cards ─── */}
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi, i) => (
          <motion.div key={i} variants={itemVariants}>
            <Card className="border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center', kpi.bg)}>
                  <kpi.icon size={20} className={kpi.color} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#1E293B]">{kpi.value}</div>
                  <div className="text-xs text-[#64748B]">{kpi.label}</div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* ─── Filters ─── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Hae henkilöstöstä..." className="pl-8 border-[#E2E8F0]" />
        </div>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="bg-[#F1F5F9]">
            {statuses.map(s => <TabsTrigger key={s} value={s} className="text-[10px] data-[state=active]:bg-white px-2.5">{statusLabels[s]}</TabsTrigger>)}
          </TabsList>
        </Tabs>
      </div>

      {/* ─── Employee Cards ─── */}
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatePresence>
          {filteredEmployees.map(emp => {
            const dept = departmentConfig[emp.department] || { color: 'text-slate-700', bg: 'bg-slate-50' };
            const statusConfig: Partial<Record<EmployeeStatus, { bar: string; dot: string }>> = {
              Aktiivinen: { bar: '[&>div]:bg-emerald-500', dot: 'bg-emerald-500' },
              Lomalla: { bar: '[&>div]:bg-blue-500', dot: 'bg-blue-500' },
              Sairas: { bar: '[&>div]:bg-red-500', dot: 'bg-red-500' },
              Koulutuksessa: { bar: '[&>div]:bg-purple-500', dot: 'bg-purple-500' },
            };
            const sc = statusConfig[emp.status] ?? { bar: '[&>div]:bg-slate-400', dot: 'bg-slate-400' };
            return (
              <motion.div key={emp.id} variants={itemVariants} layout>
                <Card className="border border-[#E2E8F0] shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                          {emp.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-[#1E293B]">{emp.name}</h3>
                          <p className="text-xs text-[#64748B]">{emp.role}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge className={cn('text-[9px] border', dept.bg, dept.color)}>{emp.department}</Badge>
                            {getStatusBadge(emp.status)}
                          </div>
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <button onClick={() => setEditingEmployee(emp)} className="p-1.5 rounded hover:bg-[#F1F5F9] text-[#64748B]"><Edit3 size={12} /></button>
                        <button onClick={() => setDeleteConfirm(emp.id)} className="p-1.5 rounded hover:bg-red-50 text-[#64748B] hover:text-red-500"><Trash2 size={12} /></button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-lg font-bold text-[#1E293B]">{emp.projects}</div>
                        <div className="text-[10px] text-[#64748B]">Projektia</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-[#1E293B]">{emp.hours}</div>
                        <div className="text-[10px] text-[#64748B]">Tuntia</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-[#1E293B]">{emp.training}</div>
                        <div className="text-[10px] text-[#64748B]">Koulutusta</div>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-[#64748B]">Tuntikiintiö</span>
                        <span className="text-[10px] font-semibold text-[#1E293B]">{Math.round((emp.hours / 1800) * 100)}%</span>
                      </div>
                      <Progress value={(emp.hours / 1800) * 100} className={cn('h-1.5', sc.bar)} />
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-[#94A3B8] mb-2">
                      <span className="flex items-center gap-1"><Phone size={10} />{emp.phone}</span>
                      <span className="flex items-center gap-1"><Mail size={10} />{emp.email}</span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {emp.certifications.map((cert, i) => (
                        <Badge key={i} variant="outline" className="text-[9px] border-[#E2E8F0] text-[#64748B]">
                          <Award size={8} className="mr-0.5" />{cert}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {/* ─── Edit Dialog ─── */}
      <Dialog open={!!editingEmployee} onOpenChange={() => setEditingEmployee(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle className="text-lg font-semibold text-[#1E293B]">Muokkaa henkilöä</DialogTitle></DialogHeader>
          {editingEmployee && (
            <div className="space-y-3 pt-4">
              <Input value={editingEmployee.name} onChange={e => setEditingEmployee(p => p ? { ...p, name: e.target.value } : null)} placeholder="Nimi" className="border-[#E2E8F0]" />
              <Input value={editingEmployee.role} onChange={e => setEditingEmployee(p => p ? { ...p, role: e.target.value } : null)} placeholder="Rooli" className="border-[#E2E8F0]" />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditingEmployee(null)}>Peruuta</Button>
                <Button onClick={() => editingEmployee && handleEditEmployee(editingEmployee)} className="bg-blue-500 hover:bg-blue-600 text-white">Tallenna</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirm ─── */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle className="text-lg font-semibold text-[#1E293B]">Vahvista poisto</DialogTitle></DialogHeader>
          <p className="text-sm text-[#64748B] pt-2">Haluatko varmasti poistaa tämän henkilön? Toimintoa ei voi peruuttaa.</p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Peruuta</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDeleteEmployee(deleteConfirm)}>Poista</Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
