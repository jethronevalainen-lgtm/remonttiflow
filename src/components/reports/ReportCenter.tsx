import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  UsersRound,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  downloadReportCsv,
  downloadReportPdf,
  downloadReportXlsx,
  printReport,
} from '@/lib/reportExports';
import {
  loadReportCenterData,
  loadReportFilterCatalog,
  type ReportCenterColumn,
  type ReportCenterDataset,
  type ReportCenterType,
  type ReportFilterCatalog,
} from '@/lib/supabase/reportCenter';
import { cn } from '@/lib/utils';

const ALL_PROJECTS = 'all';

const REPORT_TYPES: Array<{ value: ReportCenterType; label: string; description: string }> = [
  { value: 'time_entries', label: 'Työaikaraportti', description: 'Tunnit, kellonajat, tauot, ylityöt, työmääräykset ja hyväksyntätila.' },
  { value: 'work_descriptions', label: 'Työselosteraportti', description: 'Työntekijöiden päivittäiset työselosteet projekti- ja työmääräystietoineen.' },
  { value: 'site_presence', label: 'Työmaiden läsnäoloraportti', description: 'Sisään- ja uloskirjautumiset sekä kirjautumishetken sijaintivarmennus.' },
  { value: 'travel_expenses', label: 'Matka- ja kuluraportti', description: 'Matka- ja kulukirjaukset, kuitit, summat ja hyväksyntätila.' },
  { value: 'projects', label: 'Projektikooste', description: 'Projektien tila, budjetti, toteuma, tunnit ja avoimet työmääräykset.' },
  { value: 'equipment', label: 'Kalusto- ja huoltoraportti', description: 'Kalustorekisteri, kohdistukset, kustannukset ja huoltojen määräajat.' },
];

const STATUS_OPTIONS: Partial<Record<ReportCenterType, string[]>> = {
  time_entries: ['Odottaa', 'Hyväksytty', 'Hylätty'],
  work_descriptions: ['Odottaa', 'Hyväksytty', 'Hylätty'],
  travel_expenses: ['Odottaa', 'Hyväksytty', 'Hylätty'],
};

function localMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthDates(month: string): { from: string; to: string } {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!year || !monthNumber) return { from: '', to: '' };
  const last = new Date(year, monthNumber, 0).getDate();
  return {
    from: `${year}-${String(monthNumber).padStart(2, '0')}-01`,
    to: `${year}-${String(monthNumber).padStart(2, '0')}-${String(last).padStart(2, '0')}`,
  };
}

function displayValue(value: unknown, column: ReportCenterColumn): string {
  if (value === null || value === undefined || value === '') return '—';
  if (column.type === 'boolean') return value === true || value === 'true' ? 'Kyllä' : 'Ei';
  if (column.type === 'money') {
    const amount = Number(value);
    return Number.isFinite(amount)
      ? new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(amount)
      : String(value);
  }
  if (column.type === 'number') {
    const amount = Number(value);
    return Number.isFinite(amount)
      ? new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 2 }).format(amount)
      : String(value);
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
  }
  return String(value);
}

function summaryLabel(key: string): string {
  const labels: Record<string, string> = {
    rowCount: 'Rivejä',
    hours: 'Tunnit',
    overtime: 'Ylityö',
    missingDescriptions: 'Puuttuvat selosteet',
    openCheckIns: 'Avoimet kirjautumiset',
    durationHours: 'Läsnäoloaika',
    amountEur: 'Kulut yhteensä',
    approvedAmountEur: 'Hyväksytyt kulut',
    budgetEur: 'Budjetti',
    spentEur: 'Toteuma',
    approvedHours: 'Hyväksytyt tunnit',
    maintenanceDue: 'Huolto 30 päivän sisällä',
  };
  return labels[key] || key;
}

function summaryValue(key: string, value: unknown): string {
  const number = Number(value);
  if (['amountEur', 'approvedAmountEur', 'budgetEur', 'spentEur'].includes(key) && Number.isFinite(number)) {
    return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(number);
  }
  if (['hours', 'overtime', 'durationHours', 'approvedHours'].includes(key) && Number.isFinite(number)) {
    return `${new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 2 }).format(number)} h`;
  }
  return typeof value === 'number'
    ? new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 2 }).format(value)
    : String(value ?? '—');
}

function formatFinnishDate(value: string): string {
  if (!value) return '—';
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

export default function ReportCenter() {
  const { currentOrg } = useOrganization();
  const initialMonth = localMonth();
  const initialDates = monthDates(initialMonth);
  const [catalog, setCatalog] = useState<ReportFilterCatalog>({ projects: [], users: [] });
  const [reportType, setReportType] = useState<ReportCenterType>('time_entries');
  const [projectId, setProjectId] = useState(ALL_PROJECTS);
  const [month, setMonth] = useState(initialMonth);
  const [dateFrom, setDateFrom] = useState(initialDates.from);
  const [dateTo, setDateTo] = useState(initialDates.to);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [dataset, setDataset] = useState<ReportCenterDataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentOrg) return;
    setCatalogLoading(true);
    void loadReportFilterCatalog(currentOrg.id)
      .then(setCatalog)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Raporttisuodattimia ei voitu ladata.'))
      .finally(() => setCatalogLoading(false));
  }, [currentOrg]);

  const reportInfo = REPORT_TYPES.find((item) => item.value === reportType) ?? REPORT_TYPES[0];
  const statusOptions = STATUS_OPTIONS[reportType] ?? [];
  const selectedProject = catalog.projects.find((project) => project.id === projectId);
  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLocaleLowerCase('fi');
    if (!query) return catalog.users;
    return catalog.users.filter((user) => `${user.name} ${user.email ?? ''}`.toLocaleLowerCase('fi').includes(query));
  }, [catalog.users, userSearch]);

  const changeMonth = (nextMonth: string) => {
    setMonth(nextMonth);
    const dates = monthDates(nextMonth);
    setDateFrom(dates.from);
    setDateTo(dates.to);
  };

  const toggleStatus = (status: string, checked: boolean) => {
    setStatuses((current) => checked ? [...new Set([...current, status])] : current.filter((item) => item !== status));
  };

  const toggleUser = (userId: string, checked: boolean) => {
    setUserIds((current) => checked ? [...new Set([...current, userId])] : current.filter((item) => item !== userId));
  };

  const generate = async () => {
    if (!currentOrg) return;
    if (!dateFrom || !dateTo) {
      setError('Valitse raportille alku- ja loppupäivä.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setDataset(await loadReportCenterData({
        organizationId: currentOrg.id,
        reportType,
        projectId: projectId === ALL_PROJECTS ? null : projectId,
        dateFrom,
        dateTo,
        statuses: statuses.length ? statuses : null,
        userIds: userIds.length ? userIds : null,
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Raportin muodostaminen epäonnistui.');
    } finally {
      setLoading(false);
    }
  };

  const exportAction = (action: (data: ReportCenterDataset) => void) => {
    if (!dataset) return;
    try {
      action(dataset);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Raportin vienti epäonnistui.');
    }
  };

  return (
    <section className="mx-auto max-w-[1500px] space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              <FileSpreadsheet size={16} /> Raporttikeskus
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Raportit</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Valitse raportti ja rajaukset, tarkista yhteenveto ja vie valmis aineisto haluamassasi muodossa.
            </p>
          </div>
          {dataset && (
            <Badge variant="outline" className="w-fit gap-2 px-3 py-2 text-slate-700">
              <CheckCircle2 size={15} className="text-emerald-600" />
              {dataset.rows.length} riviä · {new Date(dataset.generatedAt).toLocaleString('fi-FI')}
            </Badge>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />{error}
        </div>
      )}

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <Filter size={19} />
            </div>
            <div>
              <CardTitle className="text-lg">1. Valitse raportin sisältö</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Raporttityyppi määrää, mitä tietoja raportille kerätään.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-5 sm:p-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {REPORT_TYPES.map((type) => {
              const active = reportType === type.value;
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => { setReportType(type.value); setStatuses([]); setDataset(null); }}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-colors',
                    active
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={cn('font-semibold', active ? 'text-blue-950' : 'text-slate-900')}>{type.label}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{type.description}</p>
                    </div>
                    <span className={cn('mt-0.5 h-4 w-4 shrink-0 rounded-full border-2', active ? 'border-blue-600 bg-blue-600 ring-2 ring-blue-100' : 'border-slate-300')} />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="border-t border-slate-100 pt-6">
            <div className="mb-4">
              <h2 className="font-semibold text-slate-950">2. Rajaa ajanjakso ja kohde</h2>
              <p className="mt-1 text-sm text-slate-500">Kuukausivalinta täyttää päivämäärät automaattisesti. Päiviä voi myös muuttaa erikseen.</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-4">
              <div className="space-y-2"><Label>Projekti</Label><Select value={projectId} onValueChange={setProjectId} disabled={catalogLoading}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL_PROJECTS}>Kaikki projektit</SelectItem>{catalog.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.projectNumber ? `${project.projectNumber} · ` : ''}{project.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="report-month">Kuukausi</Label><Input id="report-month" type="month" value={month} onChange={(event) => changeMonth(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="report-center-from">Alkupäivä</Label><Input id="report-center-from" type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setMonth(''); }} /></div>
              <div className="space-y-2"><Label htmlFor="report-center-to">Loppupäivä</Label><Input id="report-center-to" type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setMonth(''); }} /></div>
            </div>
          </div>

          {(statusOptions.length > 0 || !['projects', 'equipment'].includes(reportType)) && (
            <div className="border-t border-slate-100 pt-6">
              <div className="mb-4">
                <h2 className="font-semibold text-slate-950">3. Tarkemmat rajaukset</h2>
                <p className="mt-1 text-sm text-slate-500">Tyhjä valinta tarkoittaa, että kaikki vaihtoehdot sisällytetään.</p>
              </div>

              {statusOptions.length > 0 && (
                <div className="mb-5 space-y-2">
                  <Label>Hyväksyntätila</Label>
                  <div className="flex flex-wrap gap-2">
                    {statusOptions.map((status) => (
                      <label key={status} className={cn('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm', statuses.includes(status) ? 'border-blue-300 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white')}>
                        <Checkbox checked={statuses.includes(status)} onCheckedChange={(checked) => toggleStatus(status, checked === true)} />{status}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {!['projects', 'equipment'].includes(reportType) && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <Label className="flex items-center gap-2"><UsersRound size={16} /> Henkilöt</Label>
                      <p className="mt-1 text-xs text-slate-500">Valitse vain henkilöt, jotka haluat raportille.</p>
                    </div>
                    <div className="relative sm:w-80">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Hae henkilöä…" className="bg-white pl-9" />
                    </div>
                  </div>
                  <div className="mt-4 grid max-h-52 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredUsers.map((user) => (
                      <label key={user.id} className={cn('flex cursor-pointer items-start gap-2 rounded-lg border p-3', userIds.includes(user.id) ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white')}>
                        <Checkbox checked={userIds.includes(user.id)} onCheckedChange={(checked) => toggleUser(user.id, checked === true)} />
                        <span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-900">{user.name}</span><span className="block truncate text-xs text-slate-500">{user.email || user.role}</span></span>
                      </label>
                    ))}
                  </div>
                  {userIds.length > 0 && <Button variant="ghost" size="sm" className="mt-2" onClick={() => setUserIds([])}>Tyhjennä henkilövalinnat ({userIds.length})</Button>}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-4 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Valmis muodostettavaksi</p>
              <p className="mt-1 font-semibold text-blue-950">{reportInfo.label}</p>
              <p className="mt-1 text-sm text-blue-800">
                {formatFinnishDate(dateFrom)}–{formatFinnishDate(dateTo)} · {selectedProject?.name ?? 'Kaikki projektit'} · {userIds.length ? `${userIds.length} henkilöä` : 'Kaikki henkilöt'}
              </p>
            </div>
            <Button className="min-h-11 shrink-0 gap-2" onClick={() => void generate()} disabled={loading || !currentOrg}>
              {loading ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
              {loading ? 'Muodostetaan…' : 'Muodosta raportti'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {dataset && (
        <>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Raportin yhteenveto</h2>
            <p className="mt-1 text-sm text-slate-500">Keskeiset luvut valitulta ajanjaksolta ja rajaukselta.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Object.entries(dataset.summary).slice(0, 8).map(([key, value]) => (
              <Card key={key} className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{summaryLabel(key)}</p>
                  <p className="mt-2 break-words font-mono text-2xl font-bold text-slate-950">{summaryValue(key, value)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b bg-slate-50">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-lg">{dataset.title}</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">Esikatselussa näkyvät enintään ensimmäiset 200 riviä. Vientitiedosto sisältää kaikki {dataset.rows.length} riviä.</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Button variant="outline" className="gap-2" onClick={() => exportAction(downloadReportCsv)}><Download size={15} /> CSV</Button>
                  <Button variant="outline" className="gap-2" onClick={() => exportAction(downloadReportXlsx)}><FileSpreadsheet size={15} /> Excel</Button>
                  <Button variant="outline" className="gap-2" onClick={() => exportAction(downloadReportPdf)}><FileText size={15} /> PDF</Button>
                  <Button className="gap-2" onClick={() => exportAction(printReport)}><Printer size={15} /> Tulosta</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {dataset.rows.length > 0 ? (
                <div className="max-h-[620px] overflow-auto">
                  <table className="min-w-full border-collapse text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-100"><tr>{dataset.columns.map((column) => <th key={column.key} className="whitespace-nowrap border-b border-r border-slate-200 px-3 py-3 text-left font-semibold text-slate-700 last:border-r-0">{column.label}</th>)}</tr></thead>
                    <tbody>{dataset.rows.slice(0, 200).map((row, rowIndex) => <tr key={rowIndex} className="odd:bg-white even:bg-slate-50/60">{dataset.columns.map((column) => <td key={column.key} className="max-w-xs border-b border-r border-slate-100 px-3 py-2 align-top text-slate-700 last:border-r-0"><span className="line-clamp-4 whitespace-pre-wrap">{displayValue(row[column.key], column)}</span></td>)}</tr>)}</tbody>
                  </table>
                </div>
              ) : (
                <div className="p-10 text-center">
                  <CalendarRange size={38} className="mx-auto mb-3 text-slate-400" />
                  <p className="font-semibold text-slate-800">Rajauksella ei löytynyt raportoitavaa aineistoa</p>
                  <p className="mt-1 text-sm text-slate-500">Laajenna aikaväliä tai poista projekti-, henkilö- tai tilarajauksia.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
