import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Euro,
  FileText,
  LocateFixed,
  RefreshCw,
  UsersRound,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getWorkinfoDashboard, type WorkinfoDashboardData } from '@/lib/supabase/workinfoSuite';
import { cn } from '@/lib/utils';

function euroFromCents(value: number) {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value / 100);
}

function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = Math.max(0, Math.round(minutes % 60));
  return hours > 0 ? `${hours} h ${rest} min` : `${rest} min`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0] ?? ''}` : parts[0]?.slice(0, 2) || '?').toUpperCase();
}

function severityClasses(severity: string) {
  if (severity === 'critical') return 'border-red-200 bg-red-50 text-red-900';
  if (severity === 'warning') return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-blue-200 bg-blue-50 text-blue-900';
}

export default function OperationalOverview() {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const [data, setData] = useState<WorkinfoDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getWorkinfoDashboard(currentOrg.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Operatiivisen tilannekuvan haku epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(interval);
  }, [load]);

  if (error && !data) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
          <AlertTriangle className="shrink-0 text-red-700" size={20} />
          <p className="min-w-0 flex-1 text-sm text-red-800">{error}</p>
          <Button variant="outline" onClick={() => void load()}><RefreshCw size={15} className="mr-2" />Yritä uudelleen</Button>
        </CardContent>
      </Card>
    );
  }

  const summary = data?.summary ?? {
    activeWorkers: 0,
    todayHours: 0,
    monthHours: 0,
    pendingHours: 0,
    billableCents: 0,
    unqueuedCents: 0,
  };

  return (
    <section className="space-y-5" aria-label="Työnjohdon reaaliaikainen tilannekuva">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Reaaliaikainen tuotanto</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl">Työmaiden tilanne nyt</h2>
          <p className="mt-1 text-sm text-slate-500">Kirjautumiset, työselosteet, poikkeamat ja laskutusvalmius samassa näkymässä.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={15} className={cn('mr-2', loading && 'animate-spin')} />Päivitä
          </Button>
          <Button onClick={() => navigate('/toiminnanohjaus')}>
            Avaa toiminnanohjaus <ArrowRight size={15} className="ml-2" />
          </Button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Työmailla nyt', value: summary.activeWorkers, detail: 'aktiivista kirjautumista', icon: UsersRound, tone: 'bg-emerald-50 text-emerald-700' },
          { label: 'Tunteja tänään', value: `${summary.todayHours.toFixed(1)} h`, detail: `${summary.monthHours.toFixed(1)} h tässä kuussa`, icon: Clock3, tone: 'bg-blue-50 text-blue-700' },
          { label: 'Odottaa hyväksyntää', value: `${summary.pendingHours.toFixed(1)} h`, detail: 'tuntikirjauksia', icon: FileText, tone: 'bg-amber-50 text-amber-700' },
          { label: 'Laskulle lisäämättä', value: euroFromCents(summary.unqueuedCents), detail: `${euroFromCents(summary.billableCents)} laskutusketjussa`, icon: Euro, tone: 'bg-purple-50 text-purple-700' },
        ].map((item) => (
          <Card key={item.label} className="min-w-0 border-slate-200 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:text-xs">{item.label}</p>
                  <p className="mt-2 break-words font-mono text-xl font-bold text-slate-950 sm:text-2xl">{item.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
                </div>
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', item.tone)}><item.icon size={20} /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_0.9fr]">
        <Card className="min-w-0 border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3 p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><LocateFixed size={19} className="text-emerald-600" />Työmailla nyt</CardTitle>
            <Badge variant="outline">{data?.activePresence.length ?? 0} henkilöä</Badge>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
            {data?.activePresence.map((item) => (
              <div key={item.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 font-semibold text-white">{initials(item.employeeName)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-950">{item.employeeName}</p>
                    <Badge className={item.withinGeofence === false ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}>{item.withinGeofence === false ? 'Sijaintipoikkeama' : 'Sijainti varmennettu'}</Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-700">{item.projectName}{item.workOrderTitle ? ` · ${item.workOrderTitle}` : ''}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.description || 'Työn kuvaus puuttuu'}</p>
                </div>
                <div className="shrink-0 text-left sm:text-right">
                  <p className="font-mono text-sm font-semibold text-slate-900">{durationLabel(item.durationMinutes)}</p>
                  <p className="mt-1 text-xs text-slate-500">Aloitettu {new Date(item.checkedInAt).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
            {!loading && (data?.activePresence.length ?? 0) === 0 && (
              <div className="py-10 text-center">
                <CheckCircle2 size={38} className="mx-auto text-emerald-500" />
                <p className="mt-3 font-semibold text-slate-900">Ei aktiivisia työmaakirjautumisia</p>
                <p className="mt-1 text-sm text-slate-500">QR- ja työmaakirjautumiset ilmestyvät tähän palvelimelta.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 border-slate-200 shadow-sm">
          <CardHeader className="p-4 sm:p-6"><CardTitle className="flex items-center gap-2 text-base sm:text-lg"><AlertTriangle size={19} className="text-amber-600" />Vaatii huomiota</CardTitle></CardHeader>
          <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
            {data?.exceptions.map((item) => (
              <div key={item.id} className={cn('rounded-xl border p-3', severityClasses(item.severity))}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><p className="font-semibold">{item.employeeName}</p><p className="truncate text-xs opacity-80">{item.projectName}</p></div>
                  <Badge variant="outline" className="bg-white/70">{item.severity === 'critical' ? 'Kiireellinen' : 'Tarkista'}</Badge>
                </div>
                <ul className="mt-2 space-y-1 text-xs leading-5">{item.reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul>
              </div>
            ))}
            {!loading && (data?.exceptions.length ?? 0) === 0 && <div className="py-8 text-center text-sm text-slate-500">Ei havaittuja kirjautumispoikkeamia.</div>}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3 p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><BriefcaseBusiness size={19} className="text-orange-600" />Viimeisimmät työselosteet</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/toiminnanohjaus?tab=reports')}>Raportit <ArrowRight size={14} className="ml-1" /></Button>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100 p-0">
          {data?.latestDescriptions.slice(0, 8).map((item) => (
            <div key={item.id} className="grid min-w-0 gap-2 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-950">{item.employeeName}</p><Badge variant="outline">{item.status}</Badge>{item.qualityFlags.length > 0 && <Badge className="bg-amber-100 text-amber-800">{item.qualityFlags.length} tarkistettavaa</Badge>}</div>
                <p className="mt-1 truncate text-xs text-slate-500">{item.projectName}{item.workOrderTitle ? ` · ${item.workOrderTitle}` : ''}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{item.description || 'Työseloste puuttuu.'}</p>
                {item.qualityFlags.length > 0 && <p className="mt-2 text-xs text-amber-700">{item.qualityFlags.join(' · ')}</p>}
              </div>
              <div className="text-left sm:text-right"><p className="font-mono text-sm font-semibold">{item.hours.toFixed(1)} h</p><p className="mt-1 text-xs text-slate-500">{new Date(item.date).toLocaleDateString('fi-FI')}</p></div>
            </div>
          ))}
          {!loading && (data?.latestDescriptions.length ?? 0) === 0 && <div className="p-8 text-center text-sm text-slate-500">Työselosteita ei ole vielä kirjattu.</div>}
        </CardContent>
      </Card>
    </section>
  );
}
