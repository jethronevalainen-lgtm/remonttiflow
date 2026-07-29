import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ClipboardList,
  Clock3,
  FileText,
  FolderKanban,
  HardHat,
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
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPanel } from '@/components/ui/status-panel';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import { useInspectionWorkspace } from '@/hooks/useInspectionData';
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
  const { effectiveDisplayName } = useViewAs();
  const { projects, workOrders, timeEntries, safetyItems } = useAppDataContext();
  const { inspections, findings } = useInspectionWorkspace();
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
  const today = new Date().toISOString().slice(0, 10);
  const pendingHours = timeEntries
    .filter((entry) => entry.status === 'Odottaa')
    .reduce((sum, entry) => sum + entry.hours + entry.overtime, 0);
  const delayedWork = workOrders.filter((order) => (
    !['Valmis', 'Peruttu'].includes(order.status)
    && Boolean(order.dueDate && order.dueDate < today)
  ));
  const delayedProjects = projects.filter((project) => project.status === 'Myöhässä');
  const openFindings = findings.filter((finding) => !['Hyväksytty', 'Mitätöity'].includes(finding.status));
  const criticalFindings = openFindings.filter((finding) => (
    finding.severity === 'Kriittinen' || Boolean(finding.dueDate && finding.dueDate < today)
  ));
  const openSafety = safetyItems.filter((item) => !['Valmis', 'Suljettu', 'Korjattu'].includes(item.status));
  const openInspections = inspections.filter((inspection) => !['Hyväksytty', 'Mitätöity'].includes(inspection.status));

  return (
    <section className="mx-auto max-w-[1500px] space-y-4 sm:space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-xl sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
              <HardHat size={16} /> Päivän tilannekuva
            </div>
            <h1 className="mt-2 break-words text-2xl font-bold tracking-tight sm:text-3xl">{currentOrg?.name}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Hei {effectiveDisplayName}. Tässä ovat asiat, joihin työnjohdon pitää reagoida nyt.
            </p>
          </div>
          <Badge className="w-fit border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100">
            {new Date().toLocaleDateString('fi-FI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </Badge>
        </div>
      </div>

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

      <div className="grid auto-rows-fr grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Työmailla nyt', value: snapshot.metrics.activePeople, detail: `${snapshot.metrics.activeSites} aktiivista kohdetta`, icon: UsersRound, tone: 'bg-emerald-50 text-emerald-700', path: '/tyonjohto' },
          { label: 'Odottaa hyväksyntää', value: `${pendingHours.toFixed(1)} h`, detail: 'tuntikirjauksia', icon: Clock3, tone: 'bg-amber-50 text-amber-700', path: '/tuntikirjaukset' },
          { label: 'Aikataulupoikkeamat', value: delayedWork.length + delayedProjects.length, detail: `${delayedWork.length} työtä · ${delayedProjects.length} projektia`, icon: FolderKanban, tone: 'bg-red-50 text-red-700', path: delayedWork.length ? '/tyomaaraykset' : '/projektit' },
          { label: 'Laatu ja turvallisuus', value: criticalFindings.length + openSafety.length, detail: `${openInspections.length} avointa tarkastusta`, icon: ClipboardList, tone: 'bg-orange-50 text-orange-700', path: criticalFindings.length ? '/tarkastukset' : '/tyoturvallisuus' },
        ].map((item) => (
          <button key={item.label} type="button" onClick={() => navigate(item.path)} className="min-w-0 text-left">
            <Card className="min-w-0 border-slate-200 shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="flex h-full flex-col p-3 sm:p-4">
                <div className={cn('mb-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', item.tone)}>
                  <item.icon size={18} />
                </div>
                <p className="break-words text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:text-xs">{item.label}</p>
                <p className="mt-1 break-words font-mono text-xl font-bold text-slate-950 sm:text-2xl">{item.value}</p>
                <p className="mt-auto break-words pt-2 text-xs text-slate-500">{item.detail}</p>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
        <Card className="min-w-0 border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <UsersRound size={19} className="shrink-0 text-emerald-700" /> Aktiiviset kirjautumiset
            </CardTitle>
            <Badge variant="outline">{snapshot.activeCheckIns.length} henkilöä</Badge>
          </CardHeader>
          <CardContent className="space-y-3 p-4 sm:p-6">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                <Loader2 size={18} className="animate-spin" /> Ladataan työmaatilannetta…
              </div>
            )}
            {!loading && snapshot.activeCheckIns.map((checkIn) => {
              const location = locationStatus(checkIn);
              return (
                <div key={checkIn.id} className={cn('rounded-2xl border p-4', checkIn.exceptionCodes.length ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-white')}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      {checkIn.avatarUrl ? (
                        <img src={checkIn.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                          {initials(checkIn.employeeName)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-words font-semibold text-slate-950">{checkIn.employeeName}</p>
                          <Badge variant="outline" className={location.className}>{location.label}</Badge>
                        </div>
                        <p className="mt-1 flex items-start gap-1.5 break-words text-sm text-slate-600">
                          <MapPin size={14} className="mt-0.5 shrink-0" />
                          <span>{checkIn.projectName}{checkIn.projectLocation ? ` · ${checkIn.projectLocation}` : ''}</span>
                        </p>
                        <p className="mt-1 break-words text-sm text-slate-700">{checkIn.description || 'Työn kuvausta ei ole annettu.'}</p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span>Aloittanut {clockLabel(checkIn.checkedInAt)}</span>
                          <span>Kesto {durationLabel(checkIn.durationMinutes)}</span>
                          <span>Tarkkuus ±{Math.round(checkIn.accuracyM)} m</span>
                          {checkIn.distanceFromSiteM != null && <span>Etäisyys työmaasta {Math.round(checkIn.distanceFromSiteM)} m</span>}
                        </div>
                        {checkIn.workOrderTitle && (
                          <p className="mt-2 flex items-start gap-1.5 break-words text-xs font-medium text-slate-700">
                            <Wrench size={13} className="mt-0.5 shrink-0" /> {checkIn.workOrderTitle}
                          </p>
                        )}
                      </div>
                    </div>
                    {checkIn.exceptionCodes.length > 0 && (
                      <div className="flex max-w-md flex-wrap gap-1.5 lg:justify-end">
                        {checkIn.exceptionCodes.map((code) => (
                          <Badge key={code} variant="outline" className="border-amber-300 bg-white text-amber-800">
                            {LIVE_EXCEPTION_LABELS[code]}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {!loading && snapshot.activeCheckIns.length === 0 && (
              <EmptyState
                icon={UsersRound}
                title="Ei aktiivisia työmaakirjautumisia"
                description="Työntekijän QR- tai työmaakirjautuminen ilmestyy tähän automaattisesti."
              />
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/70 p-4 sm:p-5">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin size={18} className="shrink-0 text-purple-700" /> Henkilöt työmaittain
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4 sm:p-5">
            {snapshot.siteCounts.map((site) => (
              <button
                key={site.key}
                type="button"
                onClick={() => site.projectId ? navigate(`/projektit/${site.projectId}`) : undefined}
                className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:bg-slate-50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 font-mono font-bold text-purple-700">
                  {site.peopleCount}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium text-slate-900">{site.projectName}</p>
                  <p className="break-words text-xs text-slate-500">Ensimmäinen kirjautui {clockLabel(site.firstCheckedInAt)}</p>
                </div>
                {site.exceptionCount > 0 && (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                    {site.exceptionCount} huomiota
                  </Badge>
                )}
              </button>
            ))}
            {!loading && snapshot.siteCounts.length === 0 && (
              <EmptyState
                compact
                icon={MapPin}
                title="Ei aktiivisia työmaita"
                description="Työmaat ryhmitellään tähän heti, kun niille kirjaudutaan."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
        <Card className="min-h-80 min-w-0 border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FileText size={19} className="shrink-0 text-blue-700" /> Viimeisimmät työselosteet
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/tuntikirjaukset')}>Näytä kaikki</Button>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-3 p-4 sm:p-6">
            {snapshot.recentDescriptions.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => navigate('/tuntikirjaukset')}
                className={cn(
                  'block w-full rounded-xl border bg-white p-4 text-left transition hover:bg-slate-50',
                  entry.qualityCodes.length ? 'border-amber-200' : 'border-slate-200',
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-words font-semibold text-slate-950">{entry.employeeName}</p>
                      <Badge variant="outline">{entry.status}</Badge>
                    </div>
                    <p className="mt-1 break-words text-xs text-slate-500">
                      {entry.projectName}{entry.workOrderTitle ? ` · ${entry.workOrderTitle}` : ''} · {dateTimeLabel(entry.createdAt)} · {(entry.hours + entry.overtime).toFixed(1)} h
                    </p>
                    <p className="mt-3 break-words text-sm leading-6 text-slate-700">{entry.description || 'Työselostetta ei ole annettu.'}</p>
                  </div>
                  {entry.qualityCodes.length > 0 && (
                    <div className="flex max-w-lg flex-wrap gap-1.5 sm:justify-end">
                      {entry.qualityCodes.map((code) => (
                        <Badge key={code} variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                          {DESCRIPTION_QUALITY_LABELS[code]}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            ))}
            {!loading && snapshot.recentDescriptions.length === 0 && (
              <EmptyState
                icon={FileText}
                title="Ei vielä työselosteita"
                description="Kun työntekijät kirjaavat työselosteita, ne näkyvät tässä uusimmasta vanhimpaan."
                action={(
                  <Button variant="outline" onClick={() => navigate('/tuntikirjaukset')}>
                    Avaa tuntikirjaukset
                  </Button>
                )}
              />
            )}
          </CardContent>
        </Card>

        <Card className={cn('min-h-80 min-w-0 border-slate-200 shadow-sm', exceptions.length > 0 && 'border-amber-300')}>
          <CardHeader className="border-b border-slate-100 bg-slate-50/70 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle size={18} className={cn('shrink-0', exceptions.length ? 'text-amber-700' : 'text-emerald-600')} />
                Vaatii huomiota
              </CardTitle>
              <Badge variant="outline" className={exceptions.length ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>
                {exceptions.length ? `${exceptions.length} poikkeamaa` : 'Tilanne kunnossa'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-3 p-4 sm:p-5">
            {exceptions.slice(0, 6).map((item) => (
              <StatusPanel
                key={item.id}
                tone="warning"
                icon={AlertTriangle}
                title={`${item.employeeName} · ${item.projectName}`}
                description={item.exceptionCodes.map((code) => LIVE_EXCEPTION_LABELS[code]).join(' · ')}
              />
            ))}
            {exceptions.length === 0 && (
              <StatusPanel
                tone="success"
                icon={ShieldCheck}
                title="Ei havaittuja poikkeamia"
                description="Aktiivisissa työmaakirjautumisissa ei ole sijaintiin, kestoon tai työmääräykseen liittyviä huomioita."
              />
            )}
            <StatusPanel
              tone={pendingHours > 0 ? 'warning' : 'neutral'}
              icon={Clock3}
              title={pendingHours > 0 ? `${pendingHours.toFixed(1)} h odottaa hyväksyntää` : 'Ei odottavia tuntikirjauksia'}
              description={pendingHours > 0
                ? 'Käsittele odottavat tuntikirjaukset, jotta palkka-aineisto pysyy ajan tasalla.'
                : 'Tuntikirjausten hyväksyntäjono on tällä hetkellä tyhjä.'}
            />
          </CardContent>
          <CardFooter className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-5">
            <Button className="w-full" onClick={() => navigate('/tuntikirjaukset')}>
              Avaa tuntikirjausten käsittely
            </Button>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}
