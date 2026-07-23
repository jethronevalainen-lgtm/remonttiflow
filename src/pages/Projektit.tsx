import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FolderKanban,
  Plus,
  Download,
  Settings,
  Search,
  Play,
  Calendar,
  CheckCircle,
  MapPin,
  ChevronRight,
  Eye,
  Pencil,
  MoreHorizontal,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAppDataContext } from '../contexts/AppDataContext';

/* ─── Mock Data ─── */
const projectsData = [
  { id: 1, name: 'Tampereen korjaustyö', client: 'Tampereen Kaupunki', location: 'Tampere', start: '1.3.2025', end: '30.9.2025', progress: 87, status: 'Aktiivinen' as const, budget: 450000, spent: 391500 },
  { id: 2, name: 'Espoon uudisrakennus', client: 'Espoon Asunnot Oy', location: 'Espoo', start: '15.4.2025', end: '20.12.2025', progress: 62, status: 'Aktiivinen' as const, budget: 1200000, spent: 744000 },
  { id: 3, name: 'Helsingin saneeraus', client: 'Helsinki Rakennuttaja', location: 'Helsinki', start: '1.5.2025', end: '15.11.2025', progress: 45, status: 'Aktiivinen' as const, budget: 890000, spent: 400500 },
  { id: 4, name: 'Turun piha-alue', client: 'Turun Kaupunki', location: 'Turku', start: '10.5.2025', end: '30.8.2025', progress: 60, status: 'Aktiivinen' as const, budget: 320000, spent: 192000 },
  { id: 5, name: 'Vantaan toimisto', client: 'Vantaan Kiinteistöt', location: 'Vantaa', start: '1.6.2025', end: '31.10.2025', progress: 20, status: 'Aktiivinen' as const, budget: 650000, spent: 130000 },
  { id: 6, name: 'Oulun kerrostalo', client: 'Oulun Rakennus Oy', location: 'Oulu', start: '15.6.2025', end: '28.2.2026', progress: 8, status: 'Myöhässä' as const, budget: 2100000, spent: 168000 },
  { id: 7, name: 'Rovaniemen omakotitalo', client: 'Perhe Rantanen', location: 'Rovaniemi', start: '1.7.2025', end: '30.4.2026', progress: 0, status: 'Suunniteltu' as const, budget: 480000, spent: 0 },
  { id: 8, name: 'Jyväskylän koulu', client: 'Jyväskylän Kaupunki', location: 'Jyväskylä', start: '1.2.2025', end: '15.6.2025', progress: 100, status: 'Valmis' as const, budget: 1500000, spent: 1485000 },
  { id: 9, name: 'Lahti tehdaskorjaus', client: 'Lahti Industrial', location: 'Lahti', start: '15.1.2025', end: '30.4.2025', progress: 100, status: 'Valmis' as const, budget: 750000, spent: 735000 },
  { id: 10, name: 'Kuopion rivitalo', client: 'Kuopion Asunnot', location: 'Kuopi o', start: '15.8.2025', end: '30.6.2026', progress: 0, status: 'Suunniteltu' as const, budget: 950000, spent: 0 },
];

const getStatusFilters = (projects: { status: string }[]) => [
  { key: 'Kaikki', count: projects.length, icon: FolderKanban, bg: 'bg-bg-light', border: 'border-[#E2E8F0]', text: 'text-text-primary' },
  { key: 'Käynnissä', count: projects.filter(p => p.status === 'Aktiivinen').length, icon: Play, bg: 'bg-primary-light', border: 'border-primary', text: 'text-primary' },
  { key: 'Suunniteltu', count: projects.filter(p => p.status === 'Suunniteltu').length, icon: Calendar, bg: 'bg-info-light', border: 'border-info', text: 'text-info' },
  { key: 'Valmis', count: projects.filter(p => p.status === 'Valmis').length, icon: CheckCircle, bg: 'bg-success-light', border: 'border-success', text: 'text-success' },
];

/* ─── Status badge helper ─── */
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'Aktiivinen': return <Badge className="bg-success-light text-success border-0 font-medium">Aktiivinen</Badge>;
    case 'Suunniteltu': return <Badge className="bg-info-light text-info border-0 font-medium">Suunniteltu</Badge>;
    case 'Valmis': return <Badge className="bg-bg-light text-text-secondary border border-[#E2E8F0] font-medium">Valmis</Badge>;
    case 'Myöhässä': return <Badge className="bg-danger-light text-danger border-0 font-medium">Myöhässä</Badge>;
    default: return <Badge variant="secondary">{status}</Badge>;
  }
};

/* ─── Animation ─── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
};

/* ─── Component ─── */
export default function Projektit() {
  const { projects, deleteProject } = useAppDataContext();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('Kaikki');

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                         p.customer.toLowerCase().includes(search.toLowerCase()) ||
                         (p.location || '').toLowerCase().includes(search.toLowerCase());
    const matchesFilter = activeFilter === 'Kaikki' ? true :
                         activeFilter === 'Käynnissä' ? p.status === 'Aktiivinen' :
                         activeFilter === 'Valmis' ? p.status === 'Valmis' :
                         activeFilter === 'Suunniteltu' ? p.status === 'Suunniteltu' :
                         true;
    return matchesSearch && matchesFilter;
  });

  const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
      className="space-y-6"
    >
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-body-sm text-text-secondary mb-1">
            <span>Dashboard</span>
            <ChevronRight size={14} />
            <span className="text-text-primary font-medium">Projektit</span>
          </div>
          <h1 className="text-hero text-text-primary">Projektit</h1>
          <p className="text-body-sm text-text-secondary mt-1">Kaikki projektit yhdessä näkymässä</p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="bg-primary hover:bg-primary-hover text-white gap-2">
            <Plus size={16} /> Uusi projekti
          </Button>
          <Button variant="outline" className="gap-2">
            <Download size={16} /> Vie
          </Button>
          <Button variant="ghost" className="gap-2 text-text-secondary">
            <Settings size={16} />
          </Button>
        </div>
      </div>

      {/* ── Stats Summary ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Yhteensä', value: projects.length, unit: 'projektia', icon: FolderKanban, color: 'text-primary', bg: 'bg-primary-light' },
          { label: 'Käynnissä', value: projects.filter(p => p.status === 'Aktiivinen').length, unit: 'projektia', icon: Play, color: 'text-success', bg: 'bg-success-light' },
          { label: 'Valmiit', value: projects.filter(p => p.status === 'Valmis').length, unit: 'projektia', icon: CheckCircle, color: 'text-text-secondary', bg: 'bg-bg-light' },
          { label: 'Budjetti', value: `€${(totalBudget / 1000000).toFixed(1)}M`, unit: 'yhteensä', icon: FolderKanban, color: 'text-warning', bg: 'bg-warning-light' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06, duration: 0.2 }}
          >
            <Card className="border border-[#E2E8F0] shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-caption text-text-secondary uppercase tracking-wider">{stat.label}</span>
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', stat.bg)}>
                    <stat.icon size={20} className={stat.color} />
                  </div>
                </div>
                <p className="text-[28px] font-bold text-text-primary font-mono leading-none">{stat.value}</p>
                <p className="text-body-sm text-text-secondary mt-1">{stat.unit}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── Filter Cards ── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {getStatusFilters(projects).map(filter => (
          <motion.div key={filter.key} variants={cardVariants}>
            <button
              onClick={() => setActiveFilter(filter.key)}
              className={cn(
                'w-full p-4 rounded-xl border-2 text-left transition-all hover:-translate-y-0.5',
                activeFilter === filter.key
                  ? `${filter.bg} ${filter.border}`
                  : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1]'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <filter.icon size={18} className={activeFilter === filter.key ? filter.text : 'text-text-secondary'} />
                <span className={cn(
                  'text-sm font-medium',
                  activeFilter === filter.key ? filter.text : 'text-text-secondary'
                )}>{filter.key}</span>
              </div>
              <p className={cn(
                'text-2xl font-bold font-mono',
                activeFilter === filter.key ? filter.text : 'text-text-primary'
              )}>{filter.count}</p>
            </button>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Search Bar ── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Hae projekteja..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10 border-[#E2E8F0] focus:border-primary focus:ring-primary"
          />
        </div>
      </div>

      {/* ── Project Table ── */}
      <Card className="border border-[#E2E8F0] shadow-card overflow-hidden">
        <CardContent className="p-0">
          {/* Table Header */}
          <div className="hidden lg:grid lg:grid-cols-[60px_1fr_140px_100px_100px_140px_100px_120px] gap-4 px-6 py-3 bg-bg-light border-b border-[#E2E8F0]">
            <span className="text-caption text-text-muted uppercase tracking-wider font-semibold">#</span>
            <span className="text-caption text-text-muted uppercase tracking-wider font-semibold">Nimi</span>
            <span className="text-caption text-text-muted uppercase tracking-wider font-semibold">Asiakas</span>
            <span className="text-caption text-text-muted uppercase tracking-wider font-semibold">Aloitus</span>
            <span className="text-caption text-text-muted uppercase tracking-wider font-semibold">Lopetus</span>
            <span className="text-caption text-text-muted uppercase tracking-wider font-semibold">Edistyminen</span>
            <span className="text-caption text-text-muted uppercase tracking-wider font-semibold">Tila</span>
            <span className="text-caption text-text-muted uppercase tracking-wider font-semibold text-right">Toiminnot</span>
          </div>

          {/* Table Rows */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {filteredProjects.map((project, idx) => (
              <motion.div
                key={project.id}
                variants={itemVariants}
                className={cn(
                  'grid grid-cols-1 lg:grid-cols-[60px_1fr_140px_100px_100px_140px_100px_120px] gap-2 lg:gap-4 px-6 py-4 border-b border-[#F1F5F9] hover:bg-bg-light transition-colors items-center',
                  project.status === 'Myöhässä' && 'border-l-[3px] border-l-danger'
                )}
              >
                <span className="text-mono text-text-muted hidden lg:block">{idx + 1}</span>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{project.name}</p>
                  <div className="flex items-center gap-1 text-body-sm text-text-secondary mt-0.5">
                    <MapPin size={12} />
                    {project.location}
                  </div>
                </div>
                <span className="text-body-sm text-text-secondary hidden lg:block">{project.customer}</span>
                <span className="text-body-sm text-text-secondary hidden lg:block">{project.startDate}</span>
                <span className="text-body-sm text-text-secondary hidden lg:block">{project.endDate}</span>
                <div className="flex items-center gap-2">
                  <Progress value={project.progress} className="h-2 w-20 hidden sm:block" />
                  <span className="text-mono text-body-sm text-text-primary">{project.progress}%</span>
                </div>
                <div>{getStatusBadge(project.status)}</div>
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-text-secondary hover:text-primary">
                    <Eye size={16} />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-text-secondary hover:text-primary">
                    <Pencil size={16} />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-text-secondary hover:text-danger"
                    onClick={() => { if (confirm('Poista projekti "' + project.name + '"?')) deleteProject(project.id); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </Button>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {filteredProjects.length === 0 && (
            <div className="p-12 text-center">
              <FolderKanban size={48} className="mx-auto text-text-muted mb-4" />
              <p className="text-h3 text-text-primary mb-1">Ei projekteja</p>
              <p className="text-body-sm text-text-secondary">Hakuehdoilla ei löytynyt projekteja</p>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-[#E2E8F0] bg-bg-light">
            <span className="text-body-sm text-text-secondary">
              Näytetään {filteredProjects.length} / {projects.length}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>Edellinen</Button>
              <Button variant="outline" size="sm" disabled>Seuraava</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
