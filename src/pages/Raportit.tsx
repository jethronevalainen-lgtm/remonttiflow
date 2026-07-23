import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  Search,
  Plus,
  Trash2,
  Edit3,
  Download,
  Printer,
  Clock,
  TrendingUp,
  Users,
  Wrench,
  ShieldCheck,
  ClipboardCheck,
  Leaf,
  FileText,
  Star,
  FolderKanban,
  Euro,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

/* ─── Types ─── */
interface Report {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  isPopular: boolean;
  lastGenerated: Date | null;
  generateCount: number;
}

interface RecentReport {
  id: string;
  name: string;
  category: string;
  generatedAt: Date;
  generatedBy: string;
  format: string;
}

/* ─── Mock Data ─── */
const initialReports: Report[] = [
  { id: '1', name: 'Työaikaraportti', description: 'Työntekijöiden kuukausittaiset työtunnit, ylityöt ja poissaolot', category: 'Työaika', icon: 'clock', isPopular: true, lastGenerated: new Date(2025, 6, 22), generateCount: 45 },
  { id: '2', name: 'Projektin edistyminen', description: 'Projektien vaiheittainen edistyminen, aikataulu ja budjetti', category: 'Projektit', icon: 'folder', isPopular: true, lastGenerated: new Date(2025, 6, 21), generateCount: 38 },
  { id: '3', name: 'Kustannusraportti', description: 'Projektien kustannukset materiaaleista, työvoimasta ja alihankinnasta', category: 'Taloudellinen', icon: 'euro', isPopular: true, lastGenerated: new Date(2025, 6, 20), generateCount: 52 },
  { id: '4', name: 'Turvallisuusraportti', description: 'Tapaturmat, läheltä piti -tilanteet ja turvallisuustoimenpiteet', category: 'Turvallisuus', icon: 'shield', isPopular: false, lastGenerated: new Date(2025, 6, 15), generateCount: 28 },
  { id: '5', name: 'Henkilöstöraportti', description: 'Työntekijämäärät, osastojako ja resurssien käyttöaste', category: 'Henkilöstö', icon: 'users', isPopular: false, lastGenerated: new Date(2025, 6, 18), generateCount: 19 },
  { id: '6', name: 'Kalustoraportti', description: 'Kaluston käyttöaste, huollot ja sijainnit', category: 'Kalusto', icon: 'wrench', isPopular: false, lastGenerated: new Date(2025, 6, 12), generateCount: 22 },
  { id: '7', name: 'Laaturaportti', description: 'Laaduntarkastusten tulokset ja poikkeamat', category: 'Laatu', icon: 'clipboard', isPopular: false, lastGenerated: new Date(2025, 6, 10), generateCount: 15 },
  { id: '8', name: 'Ympäristöraportti', description: 'Jätteiden määrät, lajitteluaste ja ympäristövaikutukset', category: 'Ympäristö', icon: 'leaf', isPopular: false, lastGenerated: new Date(2025, 6, 8), generateCount: 12 },
];

const recentReports: RecentReport[] = [
  { id: 'r1', name: 'Työaikaraportti - Heinäkuu 2025', category: 'Työaika', generatedAt: new Date(2025, 6, 22, 9, 30), generatedBy: 'Matti Meikäläinen', format: 'PDF' },
  { id: 'r2', name: 'Projektin edistyminen - Rivitalo Helsinki', category: 'Projektit', generatedAt: new Date(2025, 6, 21, 14, 0), generatedBy: 'Matti Meikäläinen', format: 'PDF' },
  { id: 'r3', name: 'Kustannusraportti - Q2 2025', category: 'Taloudellinen', generatedAt: new Date(2025, 6, 20, 11, 15), generatedBy: 'Toimisto', format: 'Excel' },
  { id: 'r4', name: 'Turvallisuusraportti - Viikko 29', category: 'Turvallisuus', generatedAt: new Date(2025, 6, 19, 8, 0), generatedBy: 'Työsuojelu', format: 'PDF' },
  { id: 'r5', name: 'Kalustoraportti - Kuukausi 6', category: 'Kalusto', generatedAt: new Date(2025, 6, 18, 16, 45), generatedBy: 'Matti Meikäläinen', format: 'PDF' },
];

const kpiData = [
  { label: 'Raporttipohjia', value: '24', icon: BarChart3, color: 'text-blue-500', bg: 'bg-blue-50' },
  { label: 'Luotu tällä viikolla', value: '12', icon: FileText, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { label: 'Suosituin', value: 'Kustannus', icon: Star, color: 'text-amber-500', bg: 'bg-amber-50' },
  { label: 'Yhteensä luotu', value: '1,247', icon: TrendingUp, color: 'text-violet-500', bg: 'bg-violet-50' },
];

const categoryConfig: Record<string, { color: string; bg: string; border: string; icon: React.ComponentType<{ className?: string; size?: number }> }> = {
  Työaika: { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  Projektit: { icon: FolderKanban, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  Taloudellinen: { icon: Euro, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  Turvallisuus: { icon: ShieldCheck, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  Henkilöstö: { icon: Users, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  Kalusto: { icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  Laatu: { icon: ClipboardCheck, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' },
  Ympäristö: { icon: Leaf, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
};

/* ─── Component ─── */
export default function Raportit() {
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Kaikki');
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newReport, setNewReport] = useState({ name: '', description: '', category: 'Työaika' });
  const [activeTab, setActiveTab] = useState('pohjat');

  const handleAddReport = () => {
    if (!newReport.name.trim()) return;
    const report: Report = {
      id: Date.now().toString(),
      name: newReport.name,
      description: newReport.description,
      category: newReport.category,
      icon: 'file',
      isPopular: false,
      lastGenerated: null,
      generateCount: 0,
    };
    setReports(prev => [...prev, report]);
    setNewReport({ name: '', description: '', category: 'Työaika' });
    setAddDialogOpen(false);
  };

  const handleEditReport = (report: Report) => {
    setReports(prev => prev.map(r => (r.id === report.id ? report : r)));
    setEditingReport(null);
  };

  const handleDeleteReport = (id: string) => {
    setReports(prev => prev.filter(r => r.id !== id));
    setDeleteConfirm(null);
  };

  const handleGenerate = (id: string) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, lastGenerated: new Date(), generateCount: r.generateCount + 1 } : r));
  };

  const filteredReports = reports.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'Kaikki' || r.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ['Kaikki', ...Array.from(new Set(reports.map(r => r.category)))];

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
            <BarChart3 className="text-blue-500" size={28} />
            Raportit
          </h1>
          <p className="text-sm text-[#64748B] mt-1">Raporttipohjat ja viimeisimmät raportit</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#1E293B] hover:bg-[#334155] text-white">
              <Plus size={18} className="mr-2" />
              Uusi pohja
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader><DialogTitle className="text-lg font-semibold text-[#1E293B]">Luo uusi raporttipohja</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-4">
              <Input value={newReport.name} onChange={e => setNewReport(p => ({ ...p, name: e.target.value }))} placeholder="Raportin nimi" className="border-[#E2E8F0]" />
              <textarea value={newReport.description} onChange={e => setNewReport(p => ({ ...p, description: e.target.value }))} placeholder="Kuvaus..." className="w-full min-h-[80px] px-3 py-2 rounded-md border border-[#E2E8F0] text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none" />
              <Select value={newReport.category} onValueChange={v => setNewReport(p => ({ ...p, category: v }))}>
                <SelectTrigger className="border-[#E2E8F0]"><SelectValue placeholder="Kategoria" /></SelectTrigger>
                <SelectContent>
                  {categories.filter(c => c !== 'Kaikki').map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Peruuta</Button>
                <Button onClick={handleAddReport} className="bg-blue-500 hover:bg-blue-600 text-white">Luo pohja</Button>
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

      {/* ─── Tabs ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#F1F5F9] mb-4">
          <TabsTrigger value="pohjat" className="data-[state=active]:bg-white flex items-center gap-1.5"><FileText size={14} /> Raporttipohjat</TabsTrigger>
          <TabsTrigger value="viimeisimmät" className="data-[state=active]:bg-white flex items-center gap-1.5"><Clock size={14} /> Viimeisimmät raportit</TabsTrigger>
        </TabsList>

        {/* ─── Raporttipohjat ─── */}
        <TabsContent value="pohjat" className="mt-0">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Hae raporteista..." className="pl-8 border-[#E2E8F0]" />
            </div>
            <Tabs value={categoryFilter} onValueChange={setCategoryFilter}>
              <TabsList className="bg-[#F1F5F9]">
                {categories.map(c => <TabsTrigger key={c} value={c} className="text-[10px] data-[state=active]:bg-white px-2.5">{c}</TabsTrigger>)}
              </TabsList>
            </Tabs>
          </div>

          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <AnimatePresence>
              {filteredReports.map(report => {
                const cat = categoryConfig[report.category] || { icon: FileText, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' };
                const CatIcon = cat.icon;
                return (
                  <motion.div key={report.id} variants={itemVariants} layout>
                    <Card className="border border-[#E2E8F0] shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group relative overflow-hidden">
                      {report.isPopular && (
                        <div className="absolute top-0 right-0">
                          <Badge className="rounded-tl-none rounded-br-none rounded-tr-md rounded-bl-none bg-amber-500 text-white text-[10px]">
                            <Star size={10} className="mr-0.5" /> SUOSITTU
                          </Badge>
                        </div>
                      )}
                      <CardContent className="p-5">
                        <div className="flex items-start gap-3 mb-3">
                          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', cat.bg)}>
                            <CatIcon size={20} className={cat.color} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm text-[#1E293B] truncate">{report.name}</h3>
                            <Badge className={cn('text-[9px] mt-1 border', cat.bg, cat.color)}>{report.category}</Badge>
                          </div>
                        </div>
                        <p className="text-xs text-[#64748B] mb-4 line-clamp-2">{report.description}</p>

                        <div className="flex items-center justify-between text-[10px] text-[#94A3B8] mb-3">
                          <span className="flex items-center gap-1"><TrendingUp size={10} /> {report.generateCount} kertaa luotu</span>
                          {report.lastGenerated && <span className="flex items-center gap-1"><Clock size={10} /> {report.lastGenerated.toLocaleDateString('fi-FI')}</span>}
                        </div>

                        <div className="flex items-center gap-2 pt-3 border-t border-[#F1F5F9]">
                          <Button size="sm" className="h-8 text-xs flex-1 bg-blue-500 hover:bg-blue-600 text-white" onClick={() => handleGenerate(report.id)}>
                            <Download size={12} className="mr-1" /> Lataa
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-xs flex-1">
                            <Printer size={12} className="mr-1" /> Tulosta
                          </Button>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <button onClick={() => setEditingReport(report)} className="p-1.5 rounded hover:bg-[#F1F5F9] text-[#64748B]"><Edit3 size={12} /></button>
                            <button onClick={() => setDeleteConfirm(report.id)} className="p-1.5 rounded hover:bg-red-50 text-[#64748B] hover:text-red-500"><Trash2 size={12} /></button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </TabsContent>

        {/* ─── Viimeisimmät raportit ─── */}
        <TabsContent value="viimeisimmät" className="mt-0">
          <Card className="border border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-[#1E293B] flex items-center gap-2">
                <Clock size={20} className="text-blue-500" />
                Viimeksi luodut raportit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <AnimatePresence>
                  {recentReports.map((rep, idx) => {
                    const cat = categoryConfig[rep.category];
                    const CatIcon = cat?.icon || FileText;
                    return (
                      <motion.div
                        key={rep.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: idx * 0.05 }}
                        className="flex items-center justify-between p-4 rounded-xl border border-[#E2E8F0] hover:bg-[#F8FAFC] hover:shadow-sm transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', cat?.bg || 'bg-slate-50')}>
                            <CatIcon size={18} className={cat?.color || 'text-slate-600'} />
                          </div>
                          <div>
                            <div className="font-medium text-sm text-[#1E293B]">{rep.name}</div>
                            <div className="flex items-center gap-2 text-[11px] text-[#64748B] mt-0.5">
                              <span>{rep.category}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1"><Users size={10} /> {rep.generatedBy}</span>
                              <span>•</span>
                              <span>{rep.generatedAt.toLocaleString('fi-FI')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{rep.format}</Badge>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#64748B]">
                            <Download size={14} />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#64748B]">
                            <Printer size={14} />
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Edit Dialog ─── */}
      <Dialog open={!!editingReport} onOpenChange={() => setEditingReport(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle className="text-lg font-semibold text-[#1E293B]">Muokkaa raporttipohjaa</DialogTitle></DialogHeader>
          {editingReport && (
            <div className="space-y-3 pt-4">
              <Input value={editingReport.name} onChange={e => setEditingReport(p => p ? { ...p, name: e.target.value } : null)} placeholder="Nimi" className="border-[#E2E8F0]" />
              <textarea value={editingReport.description} onChange={e => setEditingReport(p => p ? { ...p, description: e.target.value } : null)} placeholder="Kuvaus" className="w-full min-h-[80px] px-3 py-2 rounded-md border border-[#E2E8F0] text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none" />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditingReport(null)}>Peruuta</Button>
                <Button onClick={() => editingReport && handleEditReport(editingReport)} className="bg-blue-500 hover:bg-blue-600 text-white">Tallenna</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirm ─── */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle className="text-lg font-semibold text-[#1E293B]">Vahvista poisto</DialogTitle></DialogHeader>
          <p className="text-sm text-[#64748B] pt-2">Haluatko varmasti poistaa tämän raporttipohjan? Toimintoa ei voi peruuttaa.</p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Peruuta</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDeleteReport(deleteConfirm)}>Poista</Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
