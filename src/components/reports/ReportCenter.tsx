import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarRange,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  Printer,
  RefreshCw,
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
  return typeof value === 'number' ? new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 2 }).format(value) : String(value ?? '—');
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
    <section className="space-y-5">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-5 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-200"><FileSpreadsheet size={16} /> Raporttikeskus</div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Muodosta valmis raportti</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Palvelin laskee raportin valituilla rajauksilla. Tarkista sisältö ja vie se PDF-, Excel- tai CSV-muodossa tai avaa tulostusnäkymä.</p>
          </div>
          {dataset && <Badge className="w-fit border-white/20 bg-white/10 px-3 py-2 text-white">{dataset.rows.length} riviä · {new Date(dataset.generatedAt).toLocaleString('fi-FI')}</Badge>}
        </div>
      </div>

      {error && <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertTriangle size={18} className="mt-0.5 shrink-0" />{error}</div>}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Filter size={19} className="text-blue-700" /> Raportin rajaus</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2 lg:col-span-2"><Label>Raporttityyppi</Label><Select value={reportType} onValueChange={(value: ReportCenterType) => { setReportType(value); setStatuses([]); setDataset(null); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{REPORT_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent></Select><p className="text-xs leading-5 text-slate-500">{reportInfo.description}</p></div>
            <div className="space-y-2"><Label>Projekti</Label><Select value={projectId} onValueChange={setProjectId} disabled={catalogLoading}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL_PROJECTS}>Kaikki projektit</SelectItem>{catalog.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.projectNumber ? `${project.projectNumber} · ` : ''}{project.name}</SelectItem>)}</SelectContent></Select></div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2"><Label htmlFor="report-month">Kuukausi</Label><Input id="report-month" type="month" value={month} onChange={(event) => changeMonth(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="report-center-from">Alkupäivä</Label><Input id="report-center-from" type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setMonth(''); }} /></div>
            <div className="space-y-2"><Label htmlFor="report-center-to">Loppupäivä</Label><Input id="report-center-to" type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setMonth(''); }} /></div>
          </div>

          {statusOptions.length > 0 && <div className="space-y-2"><Label>Hyväksyntätila</Label><div className="flex flex-wrap gap-2">{statusOptions.map((status) => <label key={status} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"><Checkbox checked={statuses.includes(status)} onCheckedChange={(checked) => toggleStatus(status, checked === true)} />{status}</label>)}</div><p className="text-xs text-slate-500">Tyhjä valinta sisältää kaikki tilat.</p></div>}

          {!['projects', 'equipment'].includes(reportType) && <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><Label className="flex items-center gap-2"><UsersRound size={16} /> Henkilöt</Label><p className="mt-1 text-xs text-slate-500">Tyhjä valinta sisältää kaikki henkilöt.</p></div><Input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Hae henkilöä..." className="bg-white sm:max-w-xs" /></div><div className="grid max-h-48 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">{filteredUsers.map((user) => <label key={user.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white p-3"><Checkbox checked={userIds.includes(user.id)} onCheckedChange={(checked) => toggleUser(user.id, checked === true)} /><span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-900">{user.name}</span><span className="block truncate text-xs text-slate-500">{user.email || user.role}</span></span></label>)}</div>{userIds.length > 0 && <Button variant="ghost" size="sm" onClick={() => setUserIds([])}>Poista henkilörajaukset ({userIds.length})</Button>}</div>}

          <div className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-blue-950">{reportInfo.label}</p><p className="mt-1 text-sm text-blue-800">{dateFrom || '—'}–{dateTo || '—'} · {projectId === ALL_PROJECTS ? 'kaikki projektit' : 'yksi projekti'} · {userIds.length ? `${userIds.length} henkilöä` : 'kaikki henkilöt'}</p></div><Button className="min-h-11 gap-2" onClick={() => void generate()} disabled={loading || !currentOrg}>{loading ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}{loading ? 'Muodostetaan…' : 'Muodosta raportti'}</Button></div>
        </CardContent>
      </Card>

      {dataset && <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Object.entries(dataset.summary).slice(0, 8).map(([key, value]) => <Card key={key}><CardContent className="p-4"><p className="text-xs text-slate-500">{summaryLabel(key)}</p><p className="mt-2 break-words font-mono text-xl font-bold text-slate-950">{summaryValue(key, value)}</p></CardContent></Card>)}</div>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardHeader className="border-b bg-slate-50"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><CardTitle className="text-lg">{dataset.title}</CardTitle><p className="mt-1 text-sm text-slate-500">Esikatselu näyttää enintään ensimmäiset 200 riviä. Vientitiedosto sisältää kaikki {dataset.rows.length} riviä.</p></div><div className="grid grid-cols-2 gap-2 sm:flex"><Button variant="outline" className="gap-2" onClick={() => exportAction(downloadReportCsv)}><Download size={15} /> CSV</Button><Button variant="outline" className="gap-2" onClick={() => exportAction(downloadReportXlsx)}><FileSpreadsheet size={15} /> Excel</Button><Button variant="outline" className="gap-2" onClick={() => exportAction(downloadReportPdf)}><FileText size={15} /> PDF</Button><Button className="gap-2" onClick={() => exportAction(printReport)}><Printer size={15} /> Tulosta</Button></div></div></CardHeader>
          <CardContent className="p-0"><div className="max-h-[620px] overflow-auto"><table className="min-w-full border-collapse text-xs"><thead className="sticky top-0 z-10 bg-slate-100"><tr>{dataset.columns.map((column) => <th key={column.key} className="whitespace-nowrap border-b border-r border-slate-200 px-3 py-3 text-left font-semibold text-slate-700 last:border-r-0">{column.label}</th>)}</tr></thead><tbody>{dataset.rows.slice(0, 200).map((row, rowIndex) => <tr key={rowIndex} className="odd:bg-white even:bg-slate-50/60">{dataset.columns.map((column) => <td key={column.key} className="max-w-xs border-b border-r border-slate-100 px-3 py-2 align-top text-slate-700 last:border-r-0"><span className="line-clamp-4 whitespace-pre-wrap">{displayValue(row[column.key], column)}</span></td>)}</tr>)}</tbody></table></div>{dataset.rows.length === 0 && <div className="p-10 text-center"><CalendarRange size={38} className="mx-auto mb-3 text-slate-400" /><p className="font-semibold text-slate-800">Rajauksella ei löytynyt raportoitavaa aineistoa</p><p className="mt-1 text-sm text-slate-500">Laajenna aikaväliä tai poista projekti-, henkilö- tai tilarajauksia.</p></div>}</CardContent>
        </Card>
      </>}
    </section>
  );
}
