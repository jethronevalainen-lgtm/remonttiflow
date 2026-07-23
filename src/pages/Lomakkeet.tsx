import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Search,
  Plus,
  Trash2,
  Edit3,
  Download,
  PenLine,
  ShieldCheck,
  Award,
  Leaf,
  HardHat,
  BookOpen,
  CheckCircle2,
  Clock,
  ClipboardCheck,
  type LucideIcon,
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

/* ─── Types ─── */
interface Form {
  id: string;
  name: string;
  description: string;
  category: 'TYA' | 'Turvallisuus' | 'Laatu' | 'Koulutus' | 'Ympäristö';
  fillRate: number;
  totalFields: number;
  filledFields: number;
  lastUsed: Date;
  isPopular: boolean;
  version: string;
}

/* ─── Mock Data ─── */
const initialForms: Form[] = [
  { id: '1', name: 'TYA-kortti', description: 'Työturvallisuusasiakirja aliurakoitsijoiden rekisteröintiin', category: 'TYA', fillRate: 85, totalFields: 20, filledFields: 17, lastUsed: new Date(2025, 6, 22), isPopular: true, version: '2.1' },
  { id: '2', name: 'Perehdytyslomake', description: 'Uuden työntekijän työmaaperehdytys ja allekirjoitus', category: 'TYA', fillRate: 92, totalFields: 12, filledFields: 11, lastUsed: new Date(2025, 6, 21), isPopular: true, version: '1.3' },
  { id: '3', name: 'Turvallisuustarkastus', description: 'Viikoittainen työmaan turvallisuustarkastuslomake', category: 'Turvallisuus', fillRate: 60, totalFields: 25, filledFields: 15, lastUsed: new Date(2025, 6, 20), isPopular: true, version: '3.0' },
  { id: '4', name: 'Vaarojen tunnistaminen', description: 'Riskien arviointi ja hallintatoimenpiteet', category: 'Turvallisuus', fillRate: 45, totalFields: 18, filledFields: 8, lastUsed: new Date(2025, 6, 18), isPopular: false, version: '1.5' },
  { id: '5', name: 'Tapaturmailmoitus', description: 'Työtapaturman kirjaaminen ja raportointi', category: 'Turvallisuus', fillRate: 100, totalFields: 15, filledFields: 15, lastUsed: new Date(2025, 6, 15), isPopular: false, version: '2.2' },
  { id: '6', name: 'Laaduntarkastus', description: 'Työvaiheen laaduntarkastus ja hyväksyntä', category: 'Laatu', fillRate: 75, totalFields: 16, filledFields: 12, lastUsed: new Date(2025, 6, 22), isPopular: true, version: '1.8' },
  { id: '7', name: 'Virheilmoitus', description: 'Laatupoikkeaman kirjaus ja korjaustoimenpiteet', category: 'Laatu', fillRate: 30, totalFields: 14, filledFields: 4, lastUsed: new Date(2025, 6, 10), isPopular: false, version: '1.0' },
  { id: '8', name: 'Koulutuskirjaus', description: 'Suoritetun koulutuksen tallennus ja sertifiointi', category: 'Koulutus', fillRate: 88, totalFields: 10, filledFields: 9, lastUsed: new Date(2025, 6, 19), isPopular: false, version: '1.4' },
  { id: '9', name: 'Pätevyystodistus', description: 'Työntekijän pätevyyden voimassaoloseuranta', category: 'Koulutus', fillRate: 70, totalFields: 8, filledFields: 6, lastUsed: new Date(2025, 6, 17), isPopular: false, version: '2.0' },
  { id: '10', name: 'Jäteluettelo', description: 'Rakennusjätteiden lajittelu ja määräkirjaus', category: 'Ympäristö', fillRate: 55, totalFields: 22, filledFields: 12, lastUsed: new Date(2025, 6, 16), isPopular: false, version: '1.2' },
  { id: '11', name: 'Melumittaus', description: 'Työmaan melumittaus ja raja-arvojen seuranta', category: 'Ympäristö', fillRate: 40, totalFields: 12, filledFields: 5, lastUsed: new Date(2025, 6, 14), isPopular: false, version: '1.1' },
  { id: '12', name: 'Työmaa-alueen siivous', description: 'Päivittäinen siivouksen tarkistuslista', category: 'Ympäristö', fillRate: 95, totalFields: 10, filledFields: 10, lastUsed: new Date(2025, 6, 23), isPopular: true, version: '1.6' },
];

const kpiData = [
  { label: 'Lomakkeet yhteensä', value: '48', icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50' },
  { label: 'Keskim. täyttöaste', value: '73%', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { label: 'Täytetyt', value: '156', icon: PenLine, color: 'text-violet-500', bg: 'bg-violet-50' },
  { label: 'Suosituimmat', value: '8', icon: Award, color: 'text-amber-500', bg: 'bg-amber-50' },
];

const categoryConfig: Record<string, { icon: LucideIcon; color: string; bg: string; border: string }> = {
  TYA: { icon: HardHat, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  Turvallisuus: { icon: ShieldCheck, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  Laatu: { icon: ClipboardCheck, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  Koulutus: { icon: BookOpen, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  Ympäristö: { icon: Leaf, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
};

/* ─── Component ─── */
export default function Lomakkeet() {
  const [forms, setForms] = useState<Form[]>(initialForms);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Kaikki');
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newForm, setNewForm] = useState<{ name: string; description: string; category: 'TYA' | 'Turvallisuus' | 'Laatu' | 'Koulutus' | 'Ympäristö'; totalFields: number }>({ name: '', description: '', category: 'TYA', totalFields: 10 });
  const [fillDialogOpen, setFillDialogOpen] = useState(false);
  const [fillingForm, setFillingForm] = useState<Form | null>(null);
  const [fillProgress, setFillProgress] = useState(0);

  const handleAddForm = () => {
    if (!newForm.name.trim()) return;
    const form: Form = {
      id: Date.now().toString(),
      name: newForm.name,
      description: newForm.description,
      category: newForm.category,
      fillRate: 0,
      totalFields: newForm.totalFields,
      filledFields: 0,
      lastUsed: new Date(),
      isPopular: false,
      version: '1.0',
    };
    setForms(prev => [...prev, form]);
    setNewForm({ name: '', description: '', category: 'TYA', totalFields: 10 });
    setAddDialogOpen(false);
  };

  const handleEditForm = (form: Form) => {
    setForms(prev => prev.map(f => (f.id === form.id ? form : f)));
    setEditingForm(null);
  };

  const handleDeleteForm = (id: string) => {
    setForms(prev => prev.filter(f => f.id !== id));
    setDeleteConfirm(null);
  };

  const handleOpenFill = (form: Form) => {
    setFillingForm(form);
    setFillProgress(form.fillRate);
    setFillDialogOpen(true);
  };

  const handleSaveFill = () => {
    if (!fillingForm) return;
    const filledFields = Math.round((fillProgress / 100) * fillingForm.totalFields);
    setForms(prev => prev.map(f => f.id === fillingForm.id ? { ...f, fillRate: fillProgress, filledFields, lastUsed: new Date() } : f));
    setFillDialogOpen(false);
    setFillingForm(null);
  };

  const filteredForms = forms.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'Kaikki' || f.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ['Kaikki', 'TYA', 'Turvallisuus', 'Laatu', 'Koulutus', 'Ympäristö'];

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
            <FileText className="text-violet-500" size={28} />
            Lomakkeet
          </h1>
          <p className="text-sm text-[#64748B] mt-1">Lomakekirjasto ja täyttöseuranta</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#1E293B] hover:bg-[#334155] text-white">
              <Plus size={18} className="mr-2" />
              Uusi lomake
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader><DialogTitle className="text-lg font-semibold text-[#1E293B]">Luo uusi lomake</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-4">
              <Input value={newForm.name} onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))} placeholder="Lomakkeen nimi" className="border-[#E2E8F0]" />
              <textarea value={newForm.description} onChange={e => setNewForm(p => ({ ...p, description: e.target.value }))} placeholder="Kuvaus..." className="w-full min-h-[80px] px-3 py-2 rounded-md border border-[#E2E8F0] text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none" />
              <Select value={newForm.category} onValueChange={v => setNewForm(p => ({ ...p, category: v as 'TYA' | 'Turvallisuus' | 'Laatu' | 'Koulutus' | 'Ympäristö' }))}>
                <SelectTrigger className="border-[#E2E8F0]"><SelectValue placeholder="Kategoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TYA">TYA</SelectItem>
                  <SelectItem value="Turvallisuus">Turvallisuus</SelectItem>
                  <SelectItem value="Laatu">Laatu</SelectItem>
                  <SelectItem value="Koulutus">Koulutus</SelectItem>
                  <SelectItem value="Ympäristö">Ympäristö</SelectItem>
                </SelectContent>
              </Select>
              <Input type="number" value={newForm.totalFields} onChange={e => setNewForm(p => ({ ...p, totalFields: Number(e.target.value) }))} placeholder="Kenttien määrä" className="border-[#E2E8F0]" />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Peruuta</Button>
                <Button onClick={handleAddForm} className="bg-violet-500 hover:bg-violet-600 text-white">Luo lomake</Button>
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

      {/* ─── Category Tabs & Search ─── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Hae lomakkeista..." className="pl-8 border-[#E2E8F0]" />
        </div>
        <Tabs value={categoryFilter} onValueChange={setCategoryFilter}>
          <TabsList className="bg-[#F1F5F9]">
            {categories.map(c => (
              <TabsTrigger key={c} value={c} className="text-xs data-[state=active]:bg-white">{c}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* ─── Form Cards ─── */}
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {filteredForms.map(form => {
            const cat = categoryConfig[form.category];
            const CatIcon = cat.icon;
            const isComplete = form.fillRate === 100;
            return (
              <motion.div key={form.id} variants={itemVariants} layout>
                <Card className={cn('border shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group relative overflow-hidden', isComplete ? 'border-emerald-200' : 'border-[#E2E8F0]')}>
                  {form.isPopular && (
                    <div className="absolute top-0 right-0">
                      <Badge className="rounded-tl-none rounded-br-none rounded-tr-md rounded-bl-none bg-amber-500 text-white text-[10px]">
                        <Award size={10} className="mr-0.5" /> SUOSITTU
                      </Badge>
                    </div>
                  )}
                  {isComplete && (
                    <div className="absolute top-0 left-0">
                      <Badge className="rounded-tr-none rounded-bl-none rounded-tl-md rounded-br-none bg-emerald-500 text-white text-[10px]">
                        <CheckCircle2 size={10} className="mr-0.5" /> VALMIS
                      </Badge>
                    </div>
                  )}
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', cat.bg)}>
                        <CatIcon size={20} className={cat.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-[#1E293B] truncate">{form.name}</h3>
                        <Badge className={cn('text-[9px] mt-1 border', cat.bg, cat.color)}>{form.category}</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-[#64748B] mb-3 line-clamp-2">{form.description}</p>

                    {/* Fill Progress */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-[#64748B]">Täyttöaste</span>
                        <span className={cn('text-[10px] font-semibold', isComplete ? 'text-emerald-600' : form.fillRate >= 50 ? 'text-blue-600' : 'text-amber-600')}>
                          {form.fillRate}%
                        </span>
                      </div>
                      <Progress value={form.fillRate} className={cn('h-2', isComplete ? '[&>div]:bg-emerald-500' : form.fillRate >= 50 ? '[&>div]:bg-blue-500' : '[&>div]:bg-amber-500')} />
                      <div className="text-[10px] text-[#94A3B8] mt-0.5">{form.filledFields} / {form.totalFields} kenttää täytetty</div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#F1F5F9]">
                      <div className="flex items-center gap-1 text-[10px] text-[#94A3B8]">
                        <Clock size={10} /> {form.lastUsed.toLocaleDateString('fi-FI')}
                        <span className="mx-1">•</span>
                        <span>v{form.version}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => handleOpenFill(form)}>
                          <PenLine size={12} className="mr-1" /> Täytä
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-[#64748B]">
                          <Download size={12} />
                        </Button>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          <button onClick={() => setEditingForm(form)} className="p-1 rounded hover:bg-[#F1F5F9] text-[#64748B]"><Edit3 size={11} /></button>
                          <button onClick={() => setDeleteConfirm(form.id)} className="p-1 rounded hover:bg-red-50 text-[#64748B] hover:text-red-500"><Trash2 size={11} /></button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {/* ─── Fill Form Dialog ─── */}
      <Dialog open={fillDialogOpen} onOpenChange={setFillDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#1E293B] flex items-center gap-2">
              <PenLine size={20} className="text-violet-500" />
              {fillingForm?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-[#64748B]">{fillingForm?.description}</p>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[#1E293B]">Täyttöaste</span>
                <span className="text-sm font-bold text-violet-600">{fillProgress}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={fillProgress}
                onChange={e => setFillProgress(Number(e.target.value))}
                className="w-full h-2 bg-[#E2E8F0] rounded-full appearance-none cursor-pointer accent-violet-500"
              />
              <div className="flex justify-between text-[10px] text-[#94A3B8] mt-1">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>
            <div className="bg-[#F8FAFC] rounded-lg p-4 border border-[#E2E8F0]">
              <h4 className="text-xs font-semibold text-[#1E293B] mb-2">Simuloitu lomakenäkymä</h4>
              <div className="space-y-2">
                {Array.from({ length: Math.min(5, fillingForm?.totalFields || 5) }, (_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={cn('w-4 h-4 rounded border flex items-center justify-center', i < (fillingForm?.filledFields || 0) ? 'bg-emerald-500 border-emerald-500' : 'border-[#CBD5E1]')}>
                      {i < (fillingForm?.filledFields || 0) && <CheckCircle2 size={10} className="text-white" />}
                    </div>
                    <span className={cn('text-xs', i < (fillingForm?.filledFields || 0) ? 'text-[#64748B] line-through' : 'text-[#1E293B]')}>
                      Kenttä {i + 1}: {['Henkilötiedot', 'Yritystiedot', 'Pätevyys', 'Turvallisuus', 'Allekirjoitus'][i] || `Tieto ${i + 1}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFillDialogOpen(false)}>Peruuta</Button>
              <Button onClick={handleSaveFill} className="bg-violet-500 hover:bg-violet-600 text-white">Tallenna täyttö</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Dialog ─── */}
      <Dialog open={!!editingForm} onOpenChange={() => setEditingForm(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle className="text-lg font-semibold text-[#1E293B]">Muokkaa lomaketta</DialogTitle></DialogHeader>
          {editingForm && (
            <div className="space-y-3 pt-4">
              <Input value={editingForm.name} onChange={e => setEditingForm(p => p ? { ...p, name: e.target.value } : null)} placeholder="Nimi" className="border-[#E2E8F0]" />
              <textarea value={editingForm.description} onChange={e => setEditingForm(p => p ? { ...p, description: e.target.value } : null)} placeholder="Kuvaus" className="w-full min-h-[80px] px-3 py-2 rounded-md border border-[#E2E8F0] text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none" />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditingForm(null)}>Peruuta</Button>
                <Button onClick={() => editingForm && handleEditForm(editingForm)} className="bg-violet-500 hover:bg-violet-600 text-white">Tallenna</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirm ─── */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle className="text-lg font-semibold text-[#1E293B]">Vahvista poisto</DialogTitle></DialogHeader>
          <p className="text-sm text-[#64748B] pt-2">Haluatko varmasti poistaa tämän lomakkeen? Toimintoa ei voi peruuttaa.</p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Peruuta</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDeleteForm(deleteConfirm)}>Poista</Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
