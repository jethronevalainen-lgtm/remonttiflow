import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArchiveRestore,
  CheckCircle2,
  Clock3,
  DatabaseBackup,
  Files,
  HardDrive,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { listBackupRuns, type BackupRun } from '@/lib/supabase/workforceHr';

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function statusBadge(status: BackupRun['status']) {
  if (status === 'completed') return <Badge className="gap-1 border-0 bg-emerald-50 text-emerald-700"><CheckCircle2 size={13} />Valmis</Badge>;
  if (status === 'failed') return <Badge className="gap-1 border-0 bg-red-50 text-red-700"><XCircle size={13} />Epäonnistui</Badge>;
  return <Badge className="gap-1 border-0 bg-blue-50 text-blue-700"><Loader2 size={13} className="animate-spin" />Käynnissä</Badge>;
}

function dateTime(value?: string) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('fi-FI');
}

export default function Varmuuskopiot() {
  const [runs, setRuns] = useState<BackupRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRuns(await listBackupRuns());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Varmuuskopiohistorian haku epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const latest = runs[0];
  const latestSuccessful = runs.find((run) => run.status === 'completed');
  const failedLastSeven = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return runs.filter((run) => run.status === 'failed' && new Date(run.startedAt).getTime() >= cutoff).length;
  }, [runs]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-[1500px] space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300"><DatabaseBackup size={16} /> Jatkuvuus ja palautettavuus</div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Varmuuskopiot</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">VaKantti muodostaa kahdesti vuorokaudessa yksityisen loogisen varmuuskopion liiketoimintadatasta ja Storage-liitteistä. Supabasen hallittu tietokantavarmistus toimii erillisenä katastrofipalautuksen kerroksena.</p>
          </div>
          <Button variant="outline" className="gap-2 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => void load()} disabled={loading}>{loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}Päivitä tila</Button>
        </div>
      </div>

      {error && <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"><AlertTriangle size={19} className="mt-0.5 shrink-0" />{error}</div>}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card className="border-slate-200 shadow-sm"><CardContent className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-slate-500">Viimeisin onnistunut</p><CheckCircle2 size={19} className="text-emerald-600" /></div><p className="mt-2 text-lg font-bold text-slate-950">{dateTime(latestSuccessful?.finishedAt)}</p><p className="mt-1 text-xs text-slate-500">{latestSuccessful ? `${latestSuccessful.rowCount} tietoriviä` : 'Ei vielä onnistunutta ajoa'}</p></CardContent></Card>
        <Card className="border-slate-200 shadow-sm"><CardContent className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-slate-500">Viimeisin koko</p><HardDrive size={19} className="text-orange-600" /></div><p className="mt-2 text-2xl font-bold text-slate-950">{formatBytes(latestSuccessful?.totalBytes ?? 0)}</p><p className="mt-1 text-xs text-slate-500">Tietokanta ja kopioidut liitteet</p></CardContent></Card>
        <Card className="border-slate-200 shadow-sm"><CardContent className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-slate-500">Varmistetut liitteet</p><Files size={19} className="text-orange-600" /></div><p className="mt-2 text-2xl font-bold text-slate-950">{latestSuccessful?.fileCount ?? 0}</p><p className="mt-1 text-xs text-slate-500">Viimeisimmässä onnistuneessa ajossa</p></CardContent></Card>
        <Card className={`border-slate-200 shadow-sm ${failedLastSeven > 0 ? 'ring-1 ring-red-200' : ''}`}><CardContent className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-slate-500">Virheitä 7 päivässä</p>{failedLastSeven > 0 ? <XCircle size={19} className="text-red-600" /> : <ShieldCheck size={19} className="text-emerald-600" />}</div><p className="mt-2 text-2xl font-bold text-slate-950">{failedLastSeven}</p><p className="mt-1 text-xs text-slate-500">Tavoite 0 epäonnistunutta ajoa</p></CardContent></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6"><div><h2 className="font-semibold text-slate-950">Varmuuskopioajot</h2><p className="mt-1 text-xs text-slate-500">50 viimeisintä ajoa</p></div>{loading && <Loader2 size={18} className="animate-spin text-orange-600" />}</div>
            <div className="hidden grid-cols-[170px_120px_100px_100px_100px_1fr] gap-3 border-b bg-white px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 lg:grid"><span>Aloitettu</span><span>Tila</span><span>Rivejä</span><span>Liitteitä</span><span>Koko</span><span>Huomio</span></div>
            {runs.map((run) => <div key={run.id} className="grid gap-2 border-b border-slate-100 px-5 py-4 text-sm lg:grid-cols-[170px_120px_100px_100px_100px_1fr] lg:items-center sm:px-6"><span className="text-slate-600">{dateTime(run.startedAt)}</span><span>{statusBadge(run.status)}</span><span className="font-mono">{run.rowCount}</span><span className="font-mono">{run.fileCount}</span><span className="font-mono">{formatBytes(run.totalBytes)}</span><span className={`min-w-0 break-words ${run.errorMessage ? 'text-red-700' : 'text-slate-500'}`}>{run.errorMessage || (run.finishedAt ? `Valmis ${dateTime(run.finishedAt)}` : 'Ajo käynnissä')}</span></div>)}
            {!loading && runs.length === 0 && <div className="p-12 text-center"><DatabaseBackup size={44} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold text-slate-950">Varmuuskopioajoja ei ole vielä kirjattu</p><p className="mt-1 text-sm text-slate-500">Ensimmäinen ajo käynnistyy seuraavassa cron-ajankohdassa.</p></div>}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="border-slate-200 shadow-sm"><CardContent className="space-y-4 p-5 sm:p-6"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><Clock3 size={21} /></div><div><h2 className="font-semibold text-slate-950">Automaattinen aikataulu</h2><p className="mt-1 text-sm leading-6 text-slate-500">Ajo suoritetaan kahdesti vuorokaudessa 12 tunnin välein. Cron käyttää suojattua palvelintunnistetta, jota ei anneta selaimelle.</p></div></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs uppercase tracking-wider text-slate-500">Seuraamisen kohteet</p><p className="mt-2 font-semibold text-slate-950">Tietokantataulut + Storage-liitteet</p><p className="mt-1 text-xs leading-5 text-slate-500">Varmuuskopiot säilytetään yksityisessä app-backups-bucketissa 30 vuorokautta.</p></div></CardContent></Card>
          <Card className="border-slate-200 shadow-sm"><CardContent className="space-y-4 p-5 sm:p-6"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><ArchiveRestore size={21} /></div><div><h2 className="font-semibold text-slate-950">Palautusmalli</h2><p className="mt-1 text-sm leading-6 text-slate-500">Tietokannan katastrofipalautus tehdään Supabasen hallitusta varmistuksesta tai PITR-palautuspisteestä. VaKantin JSON-varmistusta käytetään yksittäisten tietojen, siirtojen ja Storage-liitteiden palauttamiseen.</p></div></div></CardContent></Card>
          {latest?.status === 'failed' && <Card className="border-red-200 bg-red-50 shadow-sm"><CardContent className="p-5"><div className="flex items-start gap-3"><AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-700" /><div><h2 className="font-semibold text-red-950">Viimeisin ajo epäonnistui</h2><p className="mt-1 text-sm leading-6 text-red-800">{latest.errorMessage || 'Virheen syytä ei kirjattu.'}</p></div></div></CardContent></Card>}
        </div>
      </div>
    </motion.div>
  );
}
