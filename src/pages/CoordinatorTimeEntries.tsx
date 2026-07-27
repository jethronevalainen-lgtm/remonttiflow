import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock3, ExternalLink, Loader2, MapPin, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  listWorkSiteCheckIns,
  workSiteMapUrl,
  type WorkSiteCheckIn,
} from '@/lib/supabase/workSiteCheckIns';
import type { TimeEntryStatus } from '@/types';

function dateTime(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

function statusBadge(status: TimeEntryStatus) {
  const className = status === 'Hyväksytty'
    ? 'border-0 bg-emerald-50 text-emerald-700'
    : status === 'Hylätty'
      ? 'border-0 bg-red-50 text-red-700'
      : 'border-0 bg-amber-50 text-amber-700';
  return <Badge className={className}>{status}</Badge>;
}

export default function CoordinatorTimeEntries() {
  const { currentOrg } = useOrganization();
  const { timeEntries } = useAppDataContext();
  const [checkIns, setCheckIns] = useState<WorkSiteCheckIn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCheckIns = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      setCheckIns(await listWorkSiteCheckIns(currentOrg.id));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Työaikaleimausten haku epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => { void loadCheckIns(); }, [loadCheckIns]);

  const totals = useMemo(() => ({
    hours: timeEntries.reduce((sum, entry) => sum + entry.hours, 0),
    overtime: timeEntries.reduce((sum, entry) => sum + entry.overtime, 0),
    pending: timeEntries.filter((entry) => entry.status === 'Odottaa').length,
  }), [timeEntries]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl sm:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-white/10 p-3"><Clock3 size={28} /></div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">Projektikoordinaattorin näkymä</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Työaikaleimaukset ja historia</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Näkymä on vain lukemista varten. Tietoja ei voi hyväksyä, hylätä, muokata tai poistaa.
            </p>
          </div>
        </div>
      </section>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-5"><p className="text-sm text-slate-500">Kirjatut tunnit</p><p className="mt-2 font-mono text-2xl font-bold">{totals.hours.toFixed(1)} h</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-slate-500">Ylityö</p><p className="mt-2 font-mono text-2xl font-bold">{totals.overtime.toFixed(1)} h</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-slate-500">Odottaa käsittelyä</p><p className="mt-2 font-mono text-2xl font-bold">{totals.pending}</p></CardContent></Card>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div><h2 className="flex items-center gap-2 font-semibold"><MapPin size={18} className="text-indigo-600" />Työmaalle kirjautumiset</h2><p className="mt-1 text-xs text-slate-500">Viimeisimmät sisään- ja uloskirjautumiset sijaintihistorioineen.</p></div>
            {loading && <Loader2 size={18} className="animate-spin" />}
          </div>
          {checkIns.slice(0, 100).map((item) => (
            <div key={item.id} className="grid gap-2 border-b px-5 py-4 text-sm lg:grid-cols-[150px_1fr_1fr_1fr_110px] lg:items-center">
              <span>{dateTime(item.checkedInAt)}</span>
              <span className="font-medium">{item.employeeName}</span>
              <div><p className="font-medium">{item.projectName}</p><p className="text-xs text-slate-500">{item.description || 'Ei kuvausta'}</p></div>
              <a href={workSiteMapUrl(item)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-700 hover:underline">Avaa kartalla <ExternalLink size={13} /></a>
              <Badge className={item.checkedOutAt ? 'w-fit border-0 bg-slate-100 text-slate-700' : 'w-fit border-0 bg-emerald-50 text-emerald-700'}>{item.checkedOutAt ? 'Päättynyt' : 'Aktiivinen'}</Badge>
            </div>
          ))}
          {!loading && checkIns.length === 0 && <div className="p-10 text-center text-sm text-slate-500">Ei työmaalle kirjautumisia.</div>}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="border-b px-5 py-4"><h2 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} className="text-indigo-600" />Tuntikirjaushistoria</h2><p className="mt-1 text-xs text-slate-500">Kaikki organisaation työaikarivit. Toiminnot on poistettu tästä roolista.</p></div>
          <div className="hidden grid-cols-[110px_1fr_1fr_90px_90px_100px] gap-3 border-b bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 lg:grid">
            <span>Päivä</span><span>Työntekijä</span><span>Projekti / työ</span><span>Tunnit</span><span>Ylityö</span><span>Tila</span>
          </div>
          {timeEntries.map((entry) => (
            <div key={entry.id} className="grid gap-3 border-b px-5 py-4 text-sm lg:grid-cols-[110px_1fr_1fr_90px_90px_100px] lg:items-center">
              <span className="text-slate-500">{entry.date}</span>
              <span className="font-medium">{entry.employee}</span>
              <div><p className="font-medium">{entry.project}</p><p className="text-xs text-slate-500">{entry.description || 'Ei kuvausta'}</p></div>
              <span className="font-mono">{entry.hours.toFixed(2)} h</span>
              <span className="font-mono">{entry.overtime.toFixed(2)} h</span>
              {statusBadge(entry.status)}
            </div>
          ))}
          {timeEntries.length === 0 && <div className="p-10 text-center text-sm text-slate-500">Ei tuntikirjauksia.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
