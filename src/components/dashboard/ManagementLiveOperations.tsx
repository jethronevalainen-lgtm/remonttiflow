import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
  Wrench,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  loadManagementLiveOperations,
  subscribeManagementLiveOperations,
  type ActiveSiteCheckIn,
  type LiveOperationExceptionCode,
  type ManagementLiveOperationsSnapshot,
  type WorkDescriptionQualityCode,
} from '@/lib/supabase/managementLiveOperations';
import { cn } from '@/lib/utils';

const LIVE_EXCEPTION_LABELS: Record<LiveOperationExceptionCode, string> = {
  missing_description: 'Työn kuvaus puuttuu',
  open_over_12h: 'Avoinna yli 12 tuntia',
  previous_day: 'Edellisen päivän kirjautuminen',
  weak_accuracy: 'Heikko sijaintitarkkuus',
  outside_geofence: 'Työmaa-alueen ulkopuolella',
  no_active_work_order: 'Ei aktiivista työmääräystä',
  not_project_member: 'Ei projektitiimissä',
};

const DESCRIPTION_QUALITY_LABELS: Record<WorkDescriptionQualityCode, string> = {
  missing_description: 'Seloste puuttuu',
  too_short: 'Seloste on liian lyhyt',
  duplicate_description: 'Sama seloste toistuu',
  no_work_order: 'Ei työmääräystä',
  completed_text_open_order: 'Seloste sanoo valmiiksi, työ on yhä avoin',
};

const EMPTY: ManagementLiveOperationsSnapshot = {
  generatedAt: new Date(0).toISOString(),
  metrics: {
    activePeople: 0,
    activeSites: 0,
    todayHours: 0,
    pendingHours: 0,
    activeExceptions: 0,
    descriptionExceptions: 0,
  },
  activeCheckIns: [],
  siteCounts: [],
  recentDescriptions: [],
};

function durationLabel(minutes: number): string {
  const safe = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  return hours > 0 ? `${hours} h ${rest} min` : `${rest} min`;
}

function clockLabel(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
}

function dateTimeLabel(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ''}`.toUpperCase();
}

function locationStatus(checkIn: ActiveSiteCheckIn) {
  if (checkIn.withinGeofence === false) {
    return { label: 'Aluerajan ulkopuolella', className: 'border-red-200 bg-red-50 text-red-700' };
  }
  if (checkIn.withinGeofence === true) {
    return { label: 'Sijainti varmennettu', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  }
  return { label: 'Sijainti tallennettu', className: 'border-slate-200 bg-slate-50 text-slate-600' };
}

export default function ManagementLiveOperations() {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const [snapshot, setSnapshot] = useState<ManagementLiveOperationsSnapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (quiet = false) => {
    if (!currentOrg) return;
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      setSnapshot(await loadManagementLiveOperations(currentOrg.id));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Työmaatilanteen lataus epäonnistui.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentOrg]);

  useEffect(() => {
    void refresh();
    if (!currentOrg) return;

    const unsubscribe = subscribeManagementLiveOperations(currentOrg.id, () => { void refresh(true); });
    const timer = window.setInterval(() => { void refresh(true); }, 30_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh(true);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      unsubscribe();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [currentOrg, refresh]);

  const exceptions = useMemo(
    () => snapshot.activeCheckIns.filter((item) => item.exceptionCodes.length > 0),
    [snapshot.activeCheckIns],
  );

  return (
    <section className="mx-auto max-w-[1500px] space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">
            <UserRoundCheck size={16} /> Reaaliaikainen tuotanto
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Työmailla nyt</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Aktiiviset työmaakirjautumiset, poikkeamat ja viimeisimmät työselosteet. Näkymä päivittyy automaattisesti.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Päivitetty {dateTimeLabel(snapshot.generatedAt)}</span>
          <Button variant="outline" size="sm" className="gap-2" disabled={refreshing} onClick={() => void refresh(true)}>
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Päivitä
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1">{error}</span>
          <Button variant="outline" size="sm" onClick={() => void refresh()}>Yritä uudelleen</Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {[
          { label: 'Työmailla nyt', value: snapshot.metrics.activePeople, detail: `${snapshot.metrics.activeSites} työmaata`, icon: UsersRound, tone: 'bg-emerald-50 text-emerald-700' },
          { label: 'Tunnit tänään', value: `${snapshot.metrics.todayHours.toFixed(1)} h`, detail: 'ei hylättyjä', icon: Clock3, tone: 'bg-blue-50 text-blue-700' },
          { label: 'Odottaa hyväksyntää', value: `${snapshot.metrics.pendingHours.toFixed(1)} h`, detail: 'tuntikirjauksia', icon: Clock3, tone: 'bg-amber-50 text-amber-700' },
          { label: 'Live-poikkeamat', value: snapshot.metrics.activeExceptions, detail: 'aktiivisissa kirjauksissa', icon: AlertTriangle, tone: 'bg-red-50 text-red-700' },
          { label: 'Selostepuutteet', value: snapshot.metrics.descriptionExceptions, detail: '30 päivän aineistossa', icon: FileText, tone: 'bg-orange-50 text-orange-700' },
          { label: 'Työmaat', value: snapshot.metrics.activeSites, detail: 'aktiivista kohdetta', icon: MapPin, tone: 'bg-purple-50 text-purple-700' },
        ].map((item) => (
          <Card key={item.label} className="min-w-0 border-slate-200 shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className={cn('mb-3 flex h-9 w-9 items-center justify-center rounded-xl', item.tone)}><item.icon size={18} /></div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:text-xs">{item.label}</p>
              <p className="mt-1 break-words font-mono text-xl font-bold text-slate-950 sm:text-2xl">{item.value}</p>
              <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
        <Card className="min-w-0 border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3 p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><UsersRound size={19} className="text-emerald-700" /> Aktiiviset kirjautumiset</CardTitle>
            <Badge variant="outline">{snapshot.activeCheckIns.length} henkilöä</Badge>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
            {loading && <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" /> Ladataan työmaatilannetta…</div>}
            {!loading && snapshot.activeCheckIns.map((checkIn) => {
              const location = locationStatus(checkIn);
              return (
                <div key={checkIn.id} className={cn('rounded-2xl border p-4', checkIn.exceptionCodes.length ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-white')}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      {checkIn.avatarUrl ? (
                        <img src={checkIn.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">{initials(checkIn.employeeName)}</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-950">{checkIn.employeeName}</p>
                          <Badge variant="outline" className={location.className}>{location.label}</Badge>
                        </div>
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600"><MapPin size={14} /> {checkIn.projectName}{checkIn.projectLocation ? ` · ${checkIn.projectLocation}` : ''}</p>
                        <p className="mt-1 text-sm text-slate-700">{checkIn.description || 'Työn kuvausta ei ole annettu.'}</p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span>Aloittanut {clockLabel(checkIn.checkedInAt)}</span>
                          <span>Kesto {durationLabel(checkIn.durationMinutes)}</span>
                          <span>Tarkkuus ±{Math.round(checkIn.accuracyM)} m</span>
                          {checkIn.distanceFromSiteM != null && <span>Etäisyys työmaasta {Math.round(checkIn.distanceFromSiteM)} m</span>}
                        </div>
                        {checkIn.workOrderTitle && <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-700"><Wrench size={13} /> {checkIn.workOrderTitle}</p>}
                      </div>
                    </div>
                    {checkIn.exceptionCodes.length > 0 && (
                      <div className="flex max-w-md flex-wrap gap-1.5 lg:justify-end">
                        {checkIn.exceptionCodes.map((code) => <Badge key={code} variant="outline" className="border-amber-300 bg-white text-amber-800">{LIVE_EXCEPTION_LABELS[code]}</Badge>)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {!loading && snapshot.activeCheckIns.length === 0 && (
              <div className="py-10 text-center">
                <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-500" />
                <p className="font-semibold text-slate-900">Ei aktiivisia työmaakirjautumisia</p>
                <p className="mt-1 text-sm text-slate-500">Työntekijän QR- tai työmaakirjautuminen ilmestyy tähän automaattisesti.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-4 sm:p-5"><CardTitle className="flex items-center gap-2 text-base"><MapPin size={18} className="text-purple-700" /> Henkilöt työmaittain</CardTitle></CardHeader>
            <CardContent className="space-y-2 p-4 pt-0 sm:p-5 sm:pt-0">
              {snapshot.siteCounts.map((site) => (
                <button key={site.key} type="button" onClick={() => site.projectId ? navigate(`/projektit/${site.projectId}`) : undefined} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 font-mono font-bold text-purple-700">{site.peopleCount}</div>
                  <div className="min-w-0 flex-1"><p className="truncate font-medium text-slate-900">{site.projectName}</p><p className="text-xs text-slate-500">Ensimmäinen kirjautui {clockLabel(site.firstCheckedInAt)}</p></div>
                  {site.exceptionCount > 0 && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">{site.exceptionCount} huomiota</Badge>}
                </button>
              ))}
              {snapshot.siteCounts.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Ei aktiivisia työmaita.</p>}
            </CardContent>
          </Card>

          <Card className={cn('border-slate-200 shadow-sm', exceptions.length > 0 && 'border-amber-300')}>
            <CardHeader className="p-4 sm:p-5"><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle size={18} className={exceptions.length ? 'text-amber-700' : 'text-emerald-600'} /> Vaatii huomiota</CardTitle></CardHeader>
            <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
              {exceptions.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="font-medium text-amber-950">{item.employeeName} · {item.projectName}</p>
                  <p className="mt-1 text-xs leading-5 text-amber-800">{item.exceptionCodes.map((code) => LIVE_EXCEPTION_LABELS[code]).join(' · ')}</p>
                </div>
              ))}
              {exceptions.length === 0 && <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><ShieldCheck size={18} className="mt-0.5" />Aktiivisissa kirjautumisissa ei ole havaittuja poikkeamia.</div>}
              <Button variant="outline" className="w-full" onClick={() => navigate('/tuntikirjaukset')}>Avaa tuntikirjausten käsittely</Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3 p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><FileText size={19} className="text-blue-700" /> Viimeisimmät työselosteet</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/tuntikirjaukset')}>Näytä kaikki</Button>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
          {snapshot.recentDescriptions.map((entry) => (
            <button key={entry.id} type="button" onClick={() => navigate('/tuntikirjaukset')} className={cn('block w-full rounded-xl border p-4 text-left transition hover:bg-slate-50', entry.qualityCodes.length ? 'border-amber-200' : 'border-slate-200')}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-950">{entry.employeeName}</p><Badge variant="outline">{entry.status}</Badge></div>
                  <p className="mt-1 text-xs text-slate-500">{entry.projectName}{entry.workOrderTitle ? ` · ${entry.workOrderTitle}` : ''} · {dateTimeLabel(entry.createdAt)} · {(entry.hours + entry.overtime).toFixed(1)} h</p>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{entry.description || 'Työselostetta ei ole annettu.'}</p>
                </div>
                {entry.qualityCodes.length > 0 && <div className="flex max-w-lg flex-wrap gap-1.5 sm:justify-end">{entry.qualityCodes.map((code) => <Badge key={code} variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">{DESCRIPTION_QUALITY_LABELS[code]}</Badge>)}</div>}
              </div>
            </button>
          ))}
          {snapshot.recentDescriptions.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Työselosteita ei ole vielä kirjattu.</p>}
        </CardContent>
      </Card>
    </section>
  );
}
