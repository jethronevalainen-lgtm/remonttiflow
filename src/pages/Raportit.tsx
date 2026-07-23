import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileBarChart, TrendingUp, Clock, Star, Plus, Download, Printer,
  BarChart3, PieChart as PieChartIcon, Users, Wrench, ShieldCheck,
  Car, TreePine, MessageSquare, ChevronRight, Calendar, FolderKanban,
  CheckSquare, Eye, Share2, Trash2, X, CheckCircle2, FileSpreadsheet,
  FileText, ArrowLeft, Send, Settings
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, ComposedChart, Line
} from 'recharts';

/* ─── Easing ─── */
const ease = [0.4, 0, 0.2, 1] as [number, number, number, number];

/* ─── Mock Data ─── */
const reportTemplates = [
  { id: 'projekti', name: 'Projektiraportti', description: 'Kaikki projektit, kuluva kuukausi', scope: '12 projektia · Kesä 2025', icon: FolderKanban, color: '#F97316', bg: 'bg-orange-50' },
  { id: 'tunti', name: 'Tuntiraportti', description: 'Työntekijöiden tunnit viikoittain', scope: '23 hlöä · Viikko 25', icon: Clock, color: '#3B82F6', bg: 'bg-blue-50' },
  { id: 'kustannus', name: 'Kustannusraportti', description: 'Kustannusten jako kategorioittain', scope: 'KK-tulos · Touko 2025', icon: BarChart3, color: '#22C55E', bg: 'bg-green-50' },
  { id: 'turvallisuus', name: 'Turvallisuusraportti', description: 'Turvallisuusindeksi työmaittain', scope: '4 työmaata · Q2 2025', icon: ShieldCheck, color: '#EF4444', bg: 'bg-red-50' },
  { id: 'kalusto', name: 'Kalustoraportti', description: 'Kaluston käyttöaste ja huoltotarpeet', scope: 'Kesä 2025', icon: Wrench, color: '#8B5CF6', bg: 'bg-purple-50' },
  { id: 'henkilosto', name: 'Henkilöstoraportti', description: 'Henkilöstön tuntijakauma ja ylityöt', scope: '23 hlöä · Viikko 25', icon: Users, color: '#EC4899', bg: 'bg-pink-50' },
  { id: 'asiakas', name: 'Asiakasraportti', description: 'Asiakastyytyväisyys ja myyntiputki', scope: 'KK-tulos · Touko 2025', icon: MessageSquare, color: '#F59E0B', bg: 'bg-yellow-50' },
  { id: 'ymparisto', name: 'Ympäristöraportti', description: 'Jätehuolto ja ympäristövaikutukset', scope: 'Kesä 2025', icon: TreePine, color: '#14B8A6', bg: 'bg-teal-50' },
];

const recentReports = [
  { id: 1, name: 'Projektiyhteenveto', period: 'Kesä 2025', date: '2025-06-24', author: 'Matti Meikäläinen' },
  { id: 2, name: 'Tuloslaskelma', period: 'Touko 2025', date: '2025-06-23', author: 'Liisa Virtanen' },
  { id: 3, name: 'Työntekijätunnit', period: 'Viikko 25', date: '2025-06-22', author: 'Sari Rantanen' },
  { id: 4, name: 'Turvallisuusraportti', period: 'Q2 2025', date: '2025-06-21', author: 'Pekka Salminen' },
  { id: 5, name: 'Kaluston käyttö', period: 'Kesä 2025', date: '2025-06-20', author: 'Matti Meikäläinen' },
];

const scheduledReports = [
  { id: 1, name: 'Projektiyhteenveto', frequency: 'Viikoittain', nextRun: '2025-06-30', recipients: 'matti@rf.fi, liisa@rf.fi', active: true },
  { id: 2, name: 'Tuloslaskelma', frequency: 'Kuukausittain', nextRun: '2025-07-01', recipients: 'hallinto@rf.fi', active: true },
  { id: 3, name: 'Turvallisuusraportti', frequency: 'Viikoittain', nextRun: '2025-06-30', recipients: 'matti@rf.fi', active: false },
  { id: 4, name: 'Työntekijätunnit', frequency: 'Päivittäin', nextRun: '2025-06-25', recipients: 'palkka@rf.fi', active: true },
];

const archiveReports = [
  { id: 1, name: 'Projektiyhteenveto', created: '2025-06-24', period: 'Kesä 2025', size: '1.2 MB' },
  { id: 2, name: 'Tuloslaskelma', created: '2025-06-23', period: 'Touko 2025', size: '845 KB' },
  { id: 3, name: 'Työntekijätunnit', created: '2025-06-22', period: 'Viikko 25', size: '2.1 MB' },
  { id: 4, name: 'Turvallisuusraportti', created: '2025-06-21', period: 'Q2 2025', size: '3.4 MB' },
  { id: 5, name: 'Kaluston käyttö', created: '2025-06-20', period: 'Kesä 2025', size: '1.8 MB' },
  { id: 6, name: 'Ympäristöraportti', created: '2025-06-19', period: 'Kesä 2025', size: '956 KB' },
];

/* ─── Chart Data ─── */
const projectProgressData = [
  { project: 'Tampere', completed: 85, remaining: 15 },
  { project: 'Espoo', completed: 62, remaining: 38 },
  { project: 'Helsinki', completed: 45, remaining: 55 },
  { project: 'Vantaa', completed: 92, remaining: 8 },
  { project: 'Oulu', completed: 30, remaining: 70 },
];

const hoursByEmployeeData = [
  { name: 'Matti M.', tunnit: 168, ylityo: 12 },
  { name: 'Juha K.', tunnit: 160, ylityo: 24 },
  { name: 'Anna J.', tunnit: 152, ylityo: 8 },
  { name: 'Jukka L.', tunnit: 155, ylityo: 6 },
  { name: 'Pekka S.', tunnit: 148, ylityo: 16 },
  { name: 'Kaisa H.', tunnit: 162, ylityo: 10 },
];

const costBreakdownData = [
  { name: 'Työvoima', value: 45000, color: '#F97316' },
  { name: 'Materiaalit', value: 28000, color: '#3B82F6' },
  { name: 'Kalusto', value: 12000, color: '#22C55E' },
  { name: 'Kuljetus', value: 5000, color: '#F59E0B' },
  { name: 'Muut', value: 8000, color: '#8B5CF6' },
];

const financialTrendData = [
  { month: 'Tam', revenue: 42000, costs: 38000 },
  { month: 'Hel', revenue: 48000, costs: 41000 },
  { month: 'Maa', revenue: 52000, costs: 44000 },
  { month: 'Huh', revenue: 49000, costs: 42000 },
  { month: 'Tou', revenue: 58000, costs: 46000 },
  { month: 'Kes', revenue: 61000, costs: 48000 },
];

const CHART_COLORS = ['#F97316', '#3B82F6', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899'];

/* ─── KPI Card ─── */
function KPICard({ icon: Icon, label, value, sub, colorClass }: { icon: React.ComponentType<{ className?: string; size?: number }>; label: string; value: string; sub?: string; colorClass?: string }) {
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
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', colorClass || 'bg-primary-light')}>
              <Icon size={20} className="text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── Report Builder Modal ─── */
function ReportBuilderModal({ open, onClose, template }: { open: boolean; onClose: () => void; template: typeof reportTemplates[0] | null }) {
  const [step, setStep] = useState(1);
  const [dateRange, setDateRange] = useState({ start: '2025-06-01', end: '2025-06-30' });
  const [selectedProjects, setSelectedProjects] = useState<string[]>(['tampere', 'espoo']);
  const [selectedSections, setSelectedSections] = useState<string[]>(['summary', 'charts', 'tables']);
  const [exportFormat, setExportFormat] = useState('pdf');

  const totalSteps = 5;

  const nextStep = () => setStep(s => Math.min(s + 1, totalSteps));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const projects = ['Tampere', 'Espoo', 'Helsinki', 'Vantaa', 'Oulu'];
  const sections = [
    { id: 'summary', label: 'Yhteenveto' },
    { id: 'charts', label: 'Kaaviot ja kuvaajat' },
    { id: 'tables', label: 'Taulukot' },
    { id: 'details', label: 'Tarkat tiedot' },
    { id: 'appendix', label: 'Liitteet' },
  ];

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-h1 text-text-primary flex items-center gap-2">
            <FileBarChart size={22} className="text-primary" /> Luo raportti: {template.name}
          </DialogTitle>
          <DialogDescription className="text-body-sm text-text-secondary">
            Raportinlaatija — vaihe {step}/{totalSteps}
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-4">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div key={i} className="flex-1 h-2 rounded-full bg-bg-light overflow-hidden">
              <div className={cn('h-full rounded-full transition-all duration-300', i < step ? 'bg-primary' : 'bg-transparent')} style={{ width: i < step ? '100%' : '0%' }} />
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Date Range */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2, ease }}>
              <h3 className="text-h3 text-text-primary mb-4">1. Valitse aikaväli</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-caption text-text-secondary mb-1 block">Alkupäivä</label>
                  <Input type="date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
                </div>
                <div>
                  <label className="text-caption text-text-secondary mb-1 block">Loppupäivä</label>
                  <Input type="date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                {(['Tämä viikko', 'Tämä kuukausi', 'Tämä vuosineljännes', 'Tämä vuosi'] as const).map(range => (
                  <Button key={range} variant="outline" size="sm" onClick={() => {}}>{range}</Button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 2: Projects */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2, ease }}>
              <h3 className="text-h3 text-text-primary mb-4">2. Valitse projektit</h3>
              <div className="space-y-2">
                {projects.map(project => (
                  <div key={project} className="flex items-center gap-3 p-3 rounded-lg hover:bg-bg-light transition-colors border border-[#F1F5F9]">
                    <Checkbox
                      checked={selectedProjects.includes(project.toLowerCase())}
                      onCheckedChange={() => {
                        setSelectedProjects(prev =>
                          prev.includes(project.toLowerCase())
                            ? prev.filter(p => p !== project.toLowerCase())
                            : [...prev, project.toLowerCase()]
                        );
                      }}
                    />
                    <FolderKanban size={16} className="text-primary" />
                    <span className="text-sm text-text-primary">{project}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 3: Content */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2, ease }}>
              <h3 className="text-h3 text-text-primary mb-4">3. Valitse sisältö</h3>
              <div className="space-y-2">
                {sections.map(section => (
                  <div key={section.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-bg-light transition-colors border border-[#F1F5F9]">
                    <Checkbox
                      checked={selectedSections.includes(section.id)}
                      onCheckedChange={() => {
                        setSelectedSections(prev =>
                          prev.includes(section.id)
                            ? prev.filter(s => s !== section.id)
                            : [...prev, section.id]
                        );
                      }}
                    />
                    <CheckSquare size={16} className="text-primary" />
                    <span className="text-sm text-text-primary">{section.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 4: Preview */}
          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2, ease }}>
              <h3 className="text-h3 text-text-primary mb-4">4. Esikatselu</h3>
              <Card className="border border-[#E2E8F0] bg-bg-light">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2 text-primary">
                    <FileBarChart size={18} />
                    <span className="font-semibold text-text-primary">{template.name}</span>
                  </div>
                  <div className="text-body-sm text-text-secondary space-y-1">
                    <p><span className="font-medium">Aikaväli:</span> {dateRange.start} — {dateRange.end}</p>
                    <p><span className="font-medium">Projektit:</span> {selectedProjects.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}</p>
                    <p><span className="font-medium">Sisältö:</span> {selectedSections.map(s => sections.find(sec => sec.id === s)?.label).filter(Boolean).join(', ')}</p>
                  </div>
                  <div className="pt-3 border-t border-[#E2E8F0]">
                    <p className="text-caption text-text-muted">Raportti sisältää yllä valitun aikavälin, projektit ja sisältöosion tiedot muokattavassa muodossa.</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 5: Export */}
          {step === 5 && (
            <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2, ease }}>
              <h3 className="text-h3 text-text-primary mb-4">5. Vientiasetukset</h3>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setExportFormat('pdf')}
                  className={cn('p-4 rounded-xl border-2 transition-all text-center', exportFormat === 'pdf' ? 'border-primary bg-primary-light' : 'border-[#E2E8F0] hover:bg-bg-light')}
                >
                  <FileText size={32} className={cn('mx-auto mb-2', exportFormat === 'pdf' ? 'text-primary' : 'text-text-muted')} />
                  <p className="text-sm font-medium text-text-primary">PDF</p>
                  <p className="text-caption text-text-muted">Tulostettava raportti</p>
                </button>
                <button
                  onClick={() => setExportFormat('excel')}
                  className={cn('p-4 rounded-xl border-2 transition-all text-center', exportFormat === 'excel' ? 'border-primary bg-primary-light' : 'border-[#E2E8F0] hover:bg-bg-light')}
                >
                  <FileSpreadsheet size={32} className={cn('mx-auto mb-2', exportFormat === 'excel' ? 'text-primary' : 'text-text-muted')} />
                  <p className="text-sm font-medium text-text-primary">Excel</p>
                  <p className="text-caption text-text-muted">Muokattava taulukko</p>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#E2E8F0]">
          <Button variant="outline" onClick={prevStep} disabled={step === 1}>
            Edellinen
          </Button>
          {step < totalSteps ? (
            <Button onClick={nextStep} className="bg-primary hover:bg-primary-hover">Seuraava</Button>
          ) : (
            <Button onClick={() => { onClose(); setStep(1); }} className="bg-primary hover:bg-primary-hover gap-1.5">
              <Send size={14} /> Luo raportti
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main Page ─── */
export default function Raportit() {
  const [activeTab, setActiveTab] = useState('raporttikirjasto');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<typeof reportTemplates[0] | null>(null);
  const [viewingReport, setViewingReport] = useState<string | null>(null);

  const openBuilder = (template: typeof reportTemplates[0]) => {
    setSelectedTemplate(template);
    setBuilderOpen(true);
  };

  const reportChartData: Record<string, { title: string; chart: React.ReactNode }> = {
    projekti: {
      title: 'Projektien edistyminen',
      chart: (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={projectProgressData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748B' }} />
            <YAxis dataKey="project" type="category" tick={{ fontSize: 12, fill: '#64748B' }} width={70} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0' }} />
            <Legend />
            <Bar dataKey="completed" name="Valmis %" fill="#22C55E" radius={[0, 4, 4, 0]} />
            <Bar dataKey="remaining" name="Jäljellä %" fill="#F1F5F9" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    tunti: {
      title: 'Tunnit työntekijöittäin',
      chart: (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={hoursByEmployeeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748B' }} />
            <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0' }} />
            <Legend />
            <Bar dataKey="tunnit" name="Tunnit" fill="#F97316" radius={[4, 4, 0, 0]} />
            <Bar dataKey="ylityo" name="Ylityö" fill="#EF4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    kustannus: {
      title: 'Kustannusrakenne',
      chart: (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={costBreakdownData} cx="50%" cy="50%" outerRadius={110} dataKey="value" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
              {costBreakdownData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => `${value.toLocaleString('fi-FI')} €`} contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0' }} />
          </PieChart>
        </ResponsiveContainer>
      ),
    },
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease }}>
      {/* ─── Page Header ─── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-hero text-text-primary">Raportit</h1>
          <p className="text-body-sm text-text-secondary mt-1">Raportointi ja analytiikka</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5"><Download size={16} /> Vie</Button>
          <Button variant="outline" size="sm" className="gap-1.5"><Printer size={16} /> Tulosta</Button>
          <Button size="sm" className="gap-1.5 bg-primary hover:bg-primary-hover" onClick={() => openBuilder(reportTemplates[0])}>
            <Plus size={16} /> Luo raportti
          </Button>
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 bg-bg-light border border-[#E2E8F0]">
          <TabsTrigger value="raporttikirjasto" className="data-[state=active]:bg-primary data-[state=active]:text-white">Raporttikirjasto</TabsTrigger>
          <TabsTrigger value="ajastetut" className="data-[state=active]:bg-primary data-[state=active]:text-white">Ajastetut</TabsTrigger>
          <TabsTrigger value="arkisto" className="data-[state=active]:bg-primary data-[state=active]:text-white">Arkisto</TabsTrigger>
        </TabsList>

        {/* ─── TAB: Raporttikirjasto ─── */}
        <TabsContent value="raporttikirjasto">
          <AnimatePresence mode="wait">
            {viewingReport ? (
              <motion.div key="chart-view" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease }}>
                <div className="flex items-center gap-3 mb-6">
                  <Button variant="outline" size="icon" onClick={() => setViewingReport(null)} className="h-9 w-9">
                    <ArrowLeft size={18} />
                  </Button>
                  <div>
                    <h2 className="text-h1 text-text-primary">{reportChartData[viewingReport]?.title}</h2>
                    <p className="text-body-sm text-text-secondary">Esimerkkikuvaaja raportista</p>
                  </div>
                </div>
                <Card className="border border-[#E2E8F0] shadow-card">
                  <CardContent className="p-6">
                    {reportChartData[viewingReport]?.chart}
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div key="kirjasto" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease }}>
                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <KPICard icon={FileBarChart} label="Raportteja luotu" value="47" colorClass="bg-gray-100" />
                  <KPICard icon={TrendingUp} label="Tämän kk raportti" value="Tuloslaskelma" sub="24.6." colorClass="bg-primary-light" />
                  <KPICard icon={Clock} label="Viimeisin raportti" value="Projektit yhteenveto" sub="2 h sitten" colorClass="bg-blue-50" />
                  <KPICard icon={Star} label="Suosituin raportti" value="Työntekijöiden tunnit" colorClass="bg-yellow-50" />
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <Card className="border border-[#E2E8F0] shadow-card">
                    <CardHeader className="px-6 py-5">
                      <CardTitle className="text-h2 text-text-primary flex items-center gap-2">
                        <TrendingUp size={18} className="text-primary" /> Projektien tulokset
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-6 pb-6">
                      <ResponsiveContainer width="100%" height={250}>
                        <ComposedChart data={financialTrendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} />
                          <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                          <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0' }} formatter={(value: number) => `${value.toLocaleString('fi-FI')} €`} />
                          <Legend />
                          <Area type="monotone" dataKey="revenue" name="Tuotot" fill="#22C55E" fillOpacity={0.2} stroke="#22C55E" />
                          <Line type="monotone" dataKey="costs" name="Kustannukset" stroke="#EF4444" strokeWidth={2} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="border border-[#E2E8F0] shadow-card">
                    <CardHeader className="px-6 py-5">
                      <CardTitle className="text-h2 text-text-primary flex items-center gap-2">
                        <Users size={18} className="text-primary" /> Tuntijakauma
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-6 pb-6">
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={[
                          { category: 'Rakennus', hours: 45 },
                          { category: 'Sähkö', hours: 23 },
                          { category: 'LVI', hours: 15 },
                          { category: 'Maalaus', hours: 10 },
                          { category: 'Muu', hours: 7 },
                        ]} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F0" />
                          <XAxis type="number" tick={{ fontSize: 12, fill: '#64748B' }} />
                          <YAxis dataKey="category" type="category" tick={{ fontSize: 12, fill: '#64748B' }} width={70} />
                          <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0' }} />
                          <Bar dataKey="hours" name="%" fill="#F97316" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* Report Template Grid */}
                <h3 className="text-h2 text-text-primary mb-4">Raporttipohjat</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
                  {reportTemplates.map((template, i) => {
                    const Icon = template.icon;
                    return (
                      <motion.div
                        key={template.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.06, ease }}
                      >
                        <Card className="border border-[#E2E8F0] shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 h-full flex flex-col">
                          <CardContent className="p-5 flex flex-col flex-1">
                            <div className="flex items-start justify-between mb-3">
                              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', template.bg)}>
                                <Icon size={20} style={{ color: template.color }} />
                              </div>
                            </div>
                            <h4 className="text-h3 text-text-primary mb-1">{template.name}</h4>
                            <p className="text-body-sm text-text-secondary mb-1 flex-1">{template.description}</p>
                            <p className="text-caption text-text-muted mb-4">{template.scope}</p>
                            <div className="flex items-center gap-2 mt-auto">
                              <Button size="sm" className="bg-primary hover:bg-primary-hover flex-1" onClick={() => openBuilder(template)}>
                                Luo raportti
                              </Button>
                              {reportChartData[template.id] && (
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setViewingReport(template.id)}>
                                  <Eye size={14} />
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Recent Reports Table */}
                <Card className="border border-[#E2E8F0] shadow-card">
                  <CardHeader className="px-6 py-5">
                    <CardTitle className="text-h2 text-text-primary">Viimeisimmät raportit</CardTitle>
                  </CardHeader>
                  <CardContent className="px-0 pb-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-bg-light hover:bg-bg-light">
                          <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Raportti</TableHead>
                          <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Ajanjakso</TableHead>
                          <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Luotu</TableHead>
                          <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Luoja</TableHead>
                          <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider w-[140px]">Toiminnot</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentReports.map((report, i) => (
                          <motion.tr
                            key={report.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2, delay: i * 0.04, ease }}
                            className="border-b border-[#F1F5F9] hover:bg-bg-light transition-colors"
                          >
                            <TableCell className="font-medium text-text-primary">{report.name}</TableCell>
                            <TableCell className="text-sm text-text-secondary">{report.period}</TableCell>
                            <TableCell className="text-sm text-text-secondary">{report.date}</TableCell>
                            <TableCell className="text-sm text-text-primary">{report.author}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Avaa"><Eye size={14} /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Jaa"><Share2 size={14} /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Poista"><Trash2 size={14} /></Button>
                              </div>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>

        {/* ─── TAB: Ajastetut ─── */}
        <TabsContent value="ajastetut">
          <AnimatePresence mode="wait">
            <motion.div key="ajastetut" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease }}>
              <Card className="border border-[#E2E8F0] shadow-card">
                <CardHeader className="px-6 py-5">
                  <CardTitle className="text-h2 text-text-primary">Ajastetut raportit</CardTitle>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-bg-light hover:bg-bg-light">
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Raportti</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Tiheys</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Seuraava ajo</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Vastaanottajat</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider text-center">Status</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider w-[80px]">Toiminnot</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduledReports.map((report, i) => (
                        <motion.tr
                          key={report.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.2, delay: i * 0.04, ease }}
                          className="border-b border-[#F1F5F9] hover:bg-bg-light transition-colors"
                        >
                          <TableCell className="font-medium text-text-primary">{report.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-bg-light">
                              {report.frequency === 'Päivittäin' && <Clock size={10} className="mr-1" />}
                              {report.frequency === 'Viikoittain' && <Calendar size={10} className="mr-1" />}
                              {report.frequency === 'Kuukausittain' && <FileBarChart size={10} className="mr-1" />}
                              {report.frequency}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-text-secondary">{report.nextRun}</TableCell>
                          <TableCell className="text-sm text-text-secondary max-w-[200px] truncate">{report.recipients}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center">
                              <Switch checked={report.active} />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><Settings size={14} /></Button>
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

        {/* ─── TAB: Arkisto ─── */}
        <TabsContent value="arkisto">
          <AnimatePresence mode="wait">
            <motion.div key="arkisto" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease }}>
              <Card className="border border-[#E2E8F0] shadow-card">
                <CardHeader className="px-6 py-5">
                  <CardTitle className="text-h2 text-text-primary">Raporttiarkisto</CardTitle>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-bg-light hover:bg-bg-light">
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Raportti</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Luotu</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Aikaväli</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider">Koko</TableHead>
                        <TableHead className="text-caption uppercase text-text-secondary font-semibold tracking-wider w-[100px]">Toiminnot</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {archiveReports.map((report, i) => (
                        <motion.tr
                          key={report.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.2, delay: i * 0.04, ease }}
                          className="border-b border-[#F1F5F9] hover:bg-bg-light transition-colors"
                        >
                          <TableCell className="font-medium text-text-primary">
                            <div className="flex items-center gap-2">
                              <FileText size={14} className="text-primary" />
                              {report.name}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-text-secondary">{report.created}</TableCell>
                          <TableCell className="text-sm text-text-secondary">{report.period}</TableCell>
                          <TableCell className="text-sm text-text-primary font-mono">{report.size}</TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm" className="h-8 gap-1.5">
                              <Download size={12} /> Lataa
                            </Button>
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
      </Tabs>

      {/* ─── Report Builder Modal ─── */}
      <ReportBuilderModal open={builderOpen} onClose={() => setBuilderOpen(false)} template={selectedTemplate} />
    </motion.div>
  );
}
