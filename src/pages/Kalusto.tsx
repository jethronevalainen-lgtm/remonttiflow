import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench,
  Truck,
  Plus,
  Search,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  Gauge,
  Settings,
  PenLine,
  Trash2,
  Edit3,
  Star,
  HardHat,
  Tag,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

/* ─── Types ─── */
interface Equipment {
  id: string;
  name: string;
  type: string;
  model: string;
  year: number;
  location: string;
  status: 'available' | 'in_use' | 'maintenance' | 'reserved';
  lastService: string;
  nextService: string;
  hours: number;
  maxHours: number;
  image?: string;
}

/* ─── Mock Data ─── */
const initialEquipment: Equipment[] = [
  { id: '1', name: 'Bobcat kaivuri', type: 'Kaivuri', model: 'E26', year: 2022, location: 'Rivitalo Helsinki', status: 'available', lastService: '1.12.2025', nextService: '1.3.2026', hours: 1240, maxHours: 2000 },
  { id: '2', name: 'Hilti poravasara', type: 'Työkalu', model: 'TE 70-AVR', year: 2024, location: 'Kerrostalo Espoo', status: 'in_use', lastService: '15.11.2025', nextService: '15.2.2026', hours: 340, maxHours: 1500 },
  { id: '3', name: 'Työmaakontti', type: 'Kontti', model: '20ft varastokontti', year: 2023, location: 'Rivitalo Helsinki', status: 'available', lastService: '-', nextService: '-', hours: 0, maxHours: 0 },
  { id: '4', name: 'Honda generaattori', type: 'Sähkö', model: 'EU70is', year: 2024, location: 'Rivitalo D', status: 'in_use', lastService: '20.12.2025', nextService: '20.3.2026', hours: 180, maxHours: 1000 },
  { id: '5', name: 'Zarges tikkaat 12m', type: 'Teline', model: ' professionaalimalli', year: 2023, location: 'Kerrostalo Espoo', status: 'maintenance', lastService: '5.1.2026', nextService: '5.7.2026', hours: 0, maxHours: 500 },
  { id: '6', name: 'Putkileikkuri', type: 'Työkalu', model: 'Rothenberger', year: 2024, location: 'LVI-varasto', status: 'available', lastService: '10.12.2025', nextService: '10.6.2026', hours: 45, maxHours: 800 },
  { id: '7', name: 'Betoniauto', type: 'Kuljetus', model: 'Volvo FM', year: 2021, location: 'Parkkipaikka', status: 'reserved', lastService: '1.1.2026', nextService: '1.4.2026', hours: 8500, maxHours: 15000 },
];

const kpiData = [
  { label: 'Kalusto yhteensä', value: '18', icon: Wrench, color: 'text-blue-500', bg: 'bg-blue-50' },
  { label: 'Vapaa', value: '7', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { label: 'Käytössä', value: '8', icon: Gauge, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  { label: 'Huollossa', value: '3', icon: Settings, color: 'text-amber-500', bg: 'bg-amber-50' },
];

const typeConfig: Record<string, { icon: React.ComponentType<{ className?: string; size?: number }>; color: string; bg: string }> = {
  Kaivuri: { icon: Truck, color: 'text-orange-600', bg: 'bg-orange-50' },
  Työkalu: { icon: Wrench, color: 'text-blue-600', bg: 'bg-blue-50' },
  Kontti: { icon: Tag, color: 'text-slate-600', bg: 'bg-slate-50' },
  Sähkö: { icon: Gauge, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  Teline: { icon: HardHat, color: 'text-purple-600', bg: 'bg-purple-50' },
  Kuljetus: { icon: Truck, color: 'text-green-600', bg: 'bg-green-50' },
};

/* ─── Component ─── */
export default function Kalusto() {
  const [equipment, setEquipment] = useState<Equipment[]>(initialEquipment);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Kaikki');
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', type: 'Työkalu', model: '', location: '', status: 'available' as 'available' | 'in_use' | 'maintenance' | 'reserved' });

  const handleAddItem = () => {
    if (!newItem.name.trim()) return;
    const item: Equipment = {
      id: Date.now().toString(),
      name: newItem.name,
      type: newItem.type,
      model: newItem.model,
      year: new Date().getFullYear(),
      location: newItem.location,
      status: newItem.status,
      lastService: '-',
      nextService: '-',
      hours: 0,
      maxHours: 1000,
    };
    setEquipment(prev => [...prev, item]);
    setNewItem({ name: '', type: 'Työkalu', model: '', location: '', status: 'available' });
    setAddDialogOpen(false);
  };

  const handleEditItem = (item: Equipment) => {
    setEquipment(prev => prev.map(e => (e.id === item.id ? item : e)));
    setEditingItem(null);
  };

  const handleDeleteItem = (id: string) => {
    setEquipment(prev => prev.filter(e => e.id !== id));
    setDeleteConfirm(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available': return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]"><CheckCircle2 size={10} className="mr-0.5" />Vapaa</Badge>;
      case 'in_use': return <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px]"><Gauge size={10} className="mr-0.5" />Käytössä</Badge>;
      case 'maintenance': return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]"><Settings size={10} className="mr-0.5" />Huolto</Badge>;
      case 'reserved': return <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px]"><Calendar size={10} className="mr-0.5" />Varattu</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredEquipment = equipment.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.model.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'Kaikki' || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statuses = ['Kaikki', 'available', 'in_use', 'maintenance', 'reserved'];
  const statusLabels: Record<string, string> = { Kaikki: 'Kaikki', available: 'Vapaa', in_use: 'Käytössä', maintenance: 'Huolto', reserved: 'Varattu' };

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
            <Wrench className="text-orange-500" size={28} />
            Kalusto
          </h1>
          <p className="text-sm text-[#64748B] mt-1">Koneet, laitteet ja työkalut</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#1E293B] hover:bg-[#334155] text-white">
              <Plus size={18} className="mr-2" />
              Lisää kalusto
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader><DialogTitle className="text-lg font-semibold text-[#1E293B]">Lisää uusi kalusto</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-4">
              <Input value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} placeholder="Kaluston nimi" className="border-[#E2E8F0]" />
              <div className="grid grid-cols-2 gap-3">
                <Input value={newItem.model} onChange={e => setNewItem(p => ({ ...p, model: e.target.value }))} placeholder="Malli" className="border-[#E2E8F0]" />
                <Input value={newItem.location} onChange={e => setNewItem(p => ({ ...p, location: e.target.value }))} placeholder="Sijainti" className="border-[#E2E8F0]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select value={newItem.type} onValueChange={v => setNewItem(p => ({ ...p, type: v }))}>
                  <SelectTrigger className="border-[#E2E8F0]"><SelectValue placeholder="Tyyppi" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Kaivuri">Kaivuri</SelectItem>
                    <SelectItem value="Työkalu">Työkalu</SelectItem>
                    <SelectItem value="Kontti">Kontti</SelectItem>
                    <SelectItem value="Sähkö">Sähkö</SelectItem>
                    <SelectItem value="Teline">Teline</SelectItem>
                    <SelectItem value="Kuljetus">Kuljetus</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={newItem.status} onValueChange={v => setNewItem(p => ({ ...p, status: v as 'available' | 'in_use' | 'maintenance' | 'reserved' }))}>
                  <SelectTrigger className="border-[#E2E8F0]"><SelectValue placeholder="Tila" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Vapaa</SelectItem>
                    <SelectItem value="in_use">Käytössä</SelectItem>
                    <SelectItem value="maintenance">Huolto</SelectItem>
                    <SelectItem value="reserved">Varattu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Peruuta</Button>
                <Button onClick={handleAddItem} className="bg-orange-500 hover:bg-orange-600 text-white">Tallenna</Button>
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
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Hae kalustosta..." className="pl-8 border-[#E2E8F0]" />
        </div>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="bg-[#F1F5F9]">
            {statuses.map(s => <TabsTrigger key={s} value={s} className="text-[10px] data-[state=active]:bg-white px-2.5">{statusLabels[s]}</TabsTrigger>)}
          </TabsList>
        </Tabs>
      </div>

      {/* ─── Equipment Cards ─── */}
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {filteredEquipment.map(item => {
            const t = typeConfig[item.type] || { icon: Wrench, color: 'text-slate-600', bg: 'bg-slate-50' };
            const TypeIcon = t.icon;
            const usagePct = item.maxHours > 0 ? Math.round((item.hours / item.maxHours) * 100) : 0;
            return (
              <motion.div key={item.id} variants={itemVariants} layout>
                <Card className="border border-[#E2E8F0] shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group relative overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', t.bg)}>
                        <TypeIcon size={24} className={t.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-[#1E293B]">{item.name}</h3>
                        <p className="text-xs text-[#64748B]">{item.model} ({item.year})</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge className={cn('text-[9px] border', t.bg, t.color)}>{item.type}</Badge>
                          {getStatusBadge(item.status)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-3 text-center">
                      <div className="bg-[#F8FAFC] rounded-lg p-2">
                        <div className="text-lg font-bold text-[#1E293B]">{item.hours}</div>
                        <div className="text-[9px] text-[#64748B]">Käyttötunnit</div>
                      </div>
                      <div className="bg-[#F8FAFC] rounded-lg p-2">
                        <div className="text-lg font-bold text-[#1E293B]">{usagePct}%</div>
                        <div className="text-[9px] text-[#64748B]">Käyttöaste</div>
                      </div>
                      <div className="bg-[#F8FAFC] rounded-lg p-2">
                        <div className="text-xs font-semibold text-[#1E293B] mt-1.5">{item.nextService}</div>
                        <div className="text-[9px] text-[#64748B]">Seur. huolto</div>
                      </div>
                    </div>

                    {item.maxHours > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-[#64748B]">Käyttöaste</span>
                          <span className={cn('text-[10px] font-semibold', usagePct > 80 ? 'text-red-600' : usagePct > 50 ? 'text-amber-600' : 'text-emerald-600')}>{usagePct}%</span>
                        </div>
                        <Progress value={usagePct} className={cn('h-2', usagePct > 80 ? '[&>div]:bg-red-500' : usagePct > 50 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500')} />
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-[10px] text-[#94A3B8] mb-2">
                      <span className="flex items-center gap-1"><MapPin size={10} />{item.location}</span>
                      <span>•</span>
                      <span>Viim. huolto: {item.lastService}</span>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-[#F1F5F9]">
                      <Button size="sm" variant="outline" className="h-7 text-xs flex-1">
                        <PenLine size={10} className="mr-1" /> Käytä
                      </Button>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <button onClick={() => setEditingItem(item)} className="p-1.5 rounded hover:bg-[#F1F5F9] text-[#64748B]"><Edit3 size={12} /></button>
                        <button onClick={() => setDeleteConfirm(item.id)} className="p-1.5 rounded hover:bg-red-50 text-[#64748B] hover:text-red-500"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {/* ─── Edit Dialog ─── */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle className="text-lg font-semibold text-[#1E293B]">Muokkaa kalustoa</DialogTitle></DialogHeader>
          {editingItem && (
            <div className="space-y-3 pt-4">
              <Input value={editingItem.name} onChange={e => setEditingItem(p => p ? { ...p, name: e.target.value } : null)} placeholder="Nimi" className="border-[#E2E8F0]" />
              <Input value={editingItem.model} onChange={e => setEditingItem(p => p ? { ...p, model: e.target.value } : null)} placeholder="Malli" className="border-[#E2E8F0]" />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditingItem(null)}>Peruuta</Button>
                <Button onClick={() => editingItem && handleEditItem(editingItem)} className="bg-orange-500 hover:bg-orange-600 text-white">Tallenna</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirm ─── */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle className="text-lg font-semibold text-[#1E293B]">Vahvista poisto</DialogTitle></DialogHeader>
          <p className="text-sm text-[#64748B] pt-2">Haluatko varmasti poistaa tämän kaluston? Toimintoa ei voi peruuttaa.</p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Peruuta</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDeleteItem(deleteConfirm)}>Poista</Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
