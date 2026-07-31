import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, CalendarDays, ChevronRight, ClipboardCheck, FileText, Lock, MapPin, Plus, RefreshCw, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { formatSiteDiaryDate, normalizeSiteDiaryError, SITE_DIARY_STATUSES, todayIsoDate, type SiteDiaryStatus } from '@/lib/siteDiaryRules';
import { createOrGetSiteDiary, listSiteDiaries, type SiteDiary } from '@/lib/supabase/siteDiaries';
import { ErrorBanner, MetricCard, StatusBadge } from './common';

export function DiaryList({ onOpen }: { onOpen: (diaryId: string) => void }) {
  const { currentOrg } = useOrganization();
  const { projects } = useAppDataContext();
  const [diaries, setDiaries] = useState<SiteDiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<SiteDiaryStatus | 'all'>('all');
  const [newProjectId, setNewProjectId] = useState('');
  const [newDate, setNewDate] = useState(todayIsoDate());
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    setError(null);
    try {
      setDiaries(await listSiteDiaries(currentOrg.id, {
        projectId: projectFilter === 'all' ? undefined : projectFilter,
        status: statusFilter,
        search,
      }));
    } catch (caught) {
      setError(normalizeSiteDiaryError(caught, 'Työmaapäiväkirjojen haku epäonnistui.'));
    } finally {
      setLoading(false);
    }
  }, [currentOrg, projectFilter, search, statusFilter]);

  useEffect(() => { void refresh(); }, [refresh]);

  const today = todayIsoDate();
  const activeProjects = projects.filter((project) => !['Valmis'].includes(project.status));
  const todayProjectIds = new Set(diaries.filter((diary) => diary.date === today).map((diary) => diary.projectId));
  const missingToday = activeProjects.filter((project) => !todayProjectIds.has(project.id)).length;
  const drafts = diaries.filter((diary) => diary.status === 'Luonnos' || diary.status === 'Täydennettävä').length;
  const pending = diaries.filter((diary) => diary.status === 'Tarkastettavana' || diary.status === 'Odottaa kuittausta').length;
  const locked = diaries.filter((diary) => diary.status === 'Lukittu').length;

  const create = async () => {
    if (!currentOrg || !newProjectId || !newDate) return;
    setCreating(true);
    setError(null);
    try {
      const diary = await createOrGetSiteDiary({ organizationId: currentOrg.id, projectId: newProjectId, date: newDate });
      onOpen(diary.id);
    } catch (caught) {
      setError(normalizeSiteDiaryError(caught, 'Päiväkirjan luominen epäonnistui.'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div><h1 className="text-hero text-text-primary">Työmaapäiväkirjat</h1><p className="mt-1 max-w-3xl text-body-sm text-text-secondary">YSE-pohjainen päivädokumentointi, kuvat, katselmukset, muutostyöt, hyväksyntä ja muuttumaton lukitus.</p></div>
        <Card className="w-full border-primary/20 bg-primary/5 xl:max-w-2xl"><CardContent className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_165px_auto] sm:items-end"><div className="space-y-1"><Label>Projekti</Label><Select value={newProjectId} onValueChange={setNewProjectId}><SelectTrigger className="bg-white"><SelectValue placeholder="Valitse työmaa" /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Päivämäärä</Label><Input className="bg-white" type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} /></div><Button onClick={() => void create()} disabled={!newProjectId || !newDate || creating}><Plus className="mr-2 size-4" />{creating ? 'Avataan…' : 'Avaa päiväkirja'}</Button></CardContent></Card>
      </div>

      {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Tänään puuttuu" value={missingToday} icon={<CalendarDays className="size-5" />} description="Aktiiviset projektit ilman tämän päivän päiväkirjaa" />
        <MetricCard label="Keskeneräiset" value={drafts} icon={<FileText className="size-5" />} description="Luonnokset ja täydennettäväksi palautetut" />
        <MetricCard label="Odottaa käsittelyä" value={pending} icon={<ClipboardCheck className="size-5" />} description="Tarkastettavat tai kuittausta odottavat" />
        <MetricCard label="Lukitut" value={locked} icon={<Lock className="size-5" />} description="Muuttumattomat, varmennetut versiot" />
      </div>

      <Card className="border-slate-200 shadow-sm"><CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_240px_220px_auto]"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hae projektilla, osoitteella tai laatijalla…" className="pl-9" /></div><Select value={projectFilter} onValueChange={setProjectFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Kaikki projektit</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select><Select value={statusFilter} onValueChange={(value: SiteDiaryStatus | 'all') => setStatusFilter(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Kaikki tilat</SelectItem>{SITE_DIARY_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />Päivitä</Button></CardContent></Card>

      <div className="space-y-3">
        {!loading && diaries.length === 0 && <Card className="border-dashed"><CardContent className="p-12 text-center"><BookOpen className="mx-auto mb-4 size-12 text-text-muted" /><h2 className="font-semibold">Ei päiväkirjoja valituilla suodattimilla</h2><p className="mt-1 text-sm text-text-secondary">Avaa työmaan ensimmäinen päiväkirja yllä olevasta työkalusta.</p></CardContent></Card>}
        {diaries.map((diary) => (
          <button key={diary.id} type="button" onClick={() => onOpen(diary.id)} className="block w-full text-left">
            <Card className="border-slate-200 transition hover:border-primary/40 hover:shadow-md"><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-semibold text-text-primary">{diary.project}</h2><StatusBadge status={diary.status} />{diary.version > 1 && <Badge variant="outline">Versio {diary.version}</Badge>}</div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary"><span className="flex items-center gap-1"><CalendarDays className="size-4" />{formatSiteDiaryDate(diary.date)}</span><span className="flex items-center gap-1"><MapPin className="size-4" />{diary.siteAddress || 'Osoite puuttuu'}</span><span>{diary.author || 'Laatija puuttuu'}</span></div>{diary.correctionReason && <p className="mt-2 text-sm text-amber-700">Korjaus: {diary.correctionReason}</p>}</div><div className="flex items-center justify-between gap-3 sm:justify-end"><span className="text-sm text-text-muted">Päivitetty {diary.updatedAt ? new Date(diary.updatedAt).toLocaleString('fi-FI') : '–'}</span><ChevronRight className="size-5 text-text-muted" /></div></CardContent></Card>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
