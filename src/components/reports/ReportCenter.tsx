import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  CircleAlert,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Info,
  Loader2,
  Printer,
  Search,
  ShieldAlert,
  Sparkles,
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
import { enrichReportDataset, searchableReportRow } from '@/lib/reportInsights';
import {
  loadReportCenterData,
  loadReportFilterCatalog,
  type ReportCenterBreakdown,
  type ReportCenterColumn,
  type ReportCenterDataset,
  type ReportCenterInsight,
  type ReportCenterType,
  type ReportFilterCatalog,
  type ReportMetricFormat,
} from '@/lib/supabase/reportCenter';
import { cn } from '@/lib/utils';

const ALL_PROJECTS = 'all';

type DatePreset = 'this_month' | 'previous_month' | 'this_week' | 'last_30_days' | 'this_year';

const REPORT_TYPES: Array<{
  value: ReportCenterType;
  label: string;
  description: string;
  purpose: string;
}> = [
  {
    value: 'time_entries',
    label: 'Työaikaraportti',
    description: 'Tunnit, kellonajat, tauot, ylityöt, työmääräykset ja hyväksyntätila.',
    purpose: 'Palkan, laskutuksen ja tuntipoikkeamien tarkistamiseen.',
  },
  {
    value: 'work_descriptions',
    label: 'Työselosteraportti',
    description: 'Päivittäiset työselosteet projekti- ja työmääräystietoineen.',
    purpose: 'Tehdyn työn todentamiseen, laskutusperusteisiin ja puutteellisten selosteiden löytämiseen.',
  },
  {
    value: 'site_presence',
    label: 'Työmaiden läsnäoloraportti',
    description: 'Sisään- ja uloskirjautumiset sekä kirjautumishetken sijaintivarmennus.',
    purpose: 'Avoimien kirjautumisten, pitkien läsnäolojen ja sijaintipoikkeamien tarkistamiseen.',
  },
  {
    value: 'travel_expenses',
    label: 'Matka- ja kuluraportti',
    description: 'Matka- ja kulukirjaukset, kuitit, summat ja hyväksyntätila.',
    purpose: 'Hyväksyntäjonon, puuttuvien tositteiden ja kustannusten kohdistuksen tarkistamiseen.',
  },
  {
    value: 'projects',
    label: 'Projektikooste',
    description: 'Projektien tila, budjetti, toteuma, tunnit ja avoimet työmääräykset.',
    purpose: 'Budjetti-, aikataulu- ja työjonoriskien johtamiseen.',
  },
  {
    value: 'equipment',
    label: 'Kalusto- ja huoltoraportti',
    description: 'Kalustorekisteri, kohdistukset, kustannukset ja huoltojen määräajat.',
    purpose: 'Myöhässä olevien huoltojen, vastuuhenkilöiden ja kaluston saatavuuden seurantaan.',
  },
];

const STATUS_OPTIONS: Partial<Record<ReportCenterType, string[]>> = {
  time_entries: ['Odottaa', 'Hyväksytty', 'Hylätty'],
  work_descriptions: ['Odottaa', 'Hyväksytty', 'Hylätty'],
  travel_expenses: ['Odottaa', 'Hyväksytty', 'Hylätty'],
  projects: ['Aktiivinen', 'Suunniteltu', 'Myöhässä', 'Valmis'],
  equipment: ['Käytössä', 'Vapaa', 'Huollossa', 'Vuokralla'],
};

const SUMMARY_ORDER: Record<ReportCenterType, string[]> = {
  time_entries: ['totalRecordedHours', 'overtime', 'approvedRows', 'pendingRows', 'rejectedRows', 'missingDescriptions', 'approvalRate', 'rowCount'],
  work_descriptions: ['hours', 'missingDescriptions', 'shortDescriptions', 'pendingRows', 'rowCount'],
  site_presence: ['durationHours', 'openCheckIns', 'longPresence', 'outsideGeofence', 'weakLocation', 'rowCount'],
  travel_expenses: ['amountEur', 'approvedAmountEur', 'pendingAmountEur', 'rejectedAmountEur', 'missingAttachments', 'approvalRate', 'rowCount'],
  projects: ['budgetEur', 'spentEur', 'overBudgetEur', 'overBudgetProjects', 'delayedProjects', 'approvedHours', 'pendingHours', 'openWorkOrders'],
  equipment: ['rowCount', 'overdueMaintenance', 'dueSoonMaintenance', 'inMaintenance', 'unassignedEquipment'],
};

const MONEY_SUMMARIES = new Set(['amountEur', 'approvedAmountEur', 'pendingAmountEur', 'rejectedAmountEur', 'budgetEur', 'spentEur', 'overBudgetEur']);
const HOUR_SUMMARIES = new Set(['hours', 'totalRecordedHours', 'overtime', 'durationHours', 'approvedHours', 'pendingHours']);
const PERCENT_SUMMARIES = new Set(['approvalRate']);

function inputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

function presetDates(preset: DatePreset): { from: string; to: string; month: string } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = new Date(end);
  let month = '';

  if (preset === 'this_month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end.setMonth(now.getMonth() + 1, 0);
    month = localMonth();
  } else if (preset === 'previous_month') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end.setFullYear(now.getFullYear(), now.getMonth(), 0);
    month = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
  } else if (preset === 'this_week') {
    const day = end.getDay() || 7;
    start.setDate(end.getDate() - day + 1);
  } else if (preset === 'last_30_days') {
    start.setDate(end.getDate() - 29);
  } else if (preset === 'this_year') {
    start = new Date(now.getFullYear(), 0, 1);
  }

  return { from: inputDate(start), to: inputDate(end), month };
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
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatFinnishDate(value);
  return String(value);
}

function summaryLabel(key: string): string {
  const labels: Record<string, string> = {
    rowCount: 'Rivejä',
    hours: 'Tunnit',
    totalRecordedHours: 'Kirjatut tunnit',
    overtime: 'Ylityö',
    approvedRows: 'Hyväksyttyjä',
    pendingRows: 'Odottaa hyväksyntää',
    rejectedRows: 'Hylättyjä',
    approvalRate: 'Hyväksymisaste',
    missingDescriptions: 'Puuttuvat selosteet',
    shortDescriptions: 'Liian lyhyet selosteet',
    openCheckIns: 'Avoimet kirjautumiset',
    durationHours: 'Läsnäoloaika',
    longPresence: 'Yli 12 h läsnäolot',
    outsideGeofence: 'Työmaa-alueen ulkopuolella',
    weakLocation: 'Heikko sijaintitarkkuus',
    amountEur: 'Kulut yhteensä',
    approvedAmountEur: 'Hyväksytyt kulut',
    pendingAmountEur: 'Odottaa hyväksyntää',
    rejectedAmountEur: 'Hylätyt kulut',
    missingAttachments: 'Puuttuvat liitteet',
    budgetEur: 'Budjetti',
    spentEur: 'Toteuma',
    overBudgetEur: 'Budjetin ylitys',
    overBudgetProjects: 'Budjetin ylittäneet',
    delayedProjects: 'Myöhässä',
    approvedHours: 'Hyväksytyt tunnit',
    pendingHours: 'Odottavat tunnit',
    openWorkOrders: 'Avoimet työmääräykset',
    maintenanceDue: 'Huolto 30 päivän sisällä',
    overdueMaintenance: 'Huolto myöhässä',
    dueSoonMaintenance: 'Huolto 30 päivän sisällä',
    unassignedEquipment: 'Ilman vastuuhenkilöä',
    inMaintenance: 'Huollossa',
  };
  return labels[key] || key;
}

function formatMetric(value: unknown, format: ReportMetricFormat): string {
  const number = Number(value);
  if (format === 'money' && Number.isFinite(number)) {
    return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(number);
  }
  if (format === 'hours' && Number.isFinite(number)) {
    return `${new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 2 }).format(number)} h`;
  }
  if (format === 'percent' && Number.isFinite(number)) {
    return `${new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 1 }).format(number)} %`;
  }
  return Number.isFinite(number)
    ? new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 2 }).format(number)
    : String(value ?? '—');
}

function summaryValue(key: string, value: unknown): string {
  if (MONEY_SUMMARIES.has(key)) return formatMetric(value, 'money');
  if (HOUR_SUMMARIES.has(key)) return formatMetric(value, 'hours');
  if (PERCENT_SUMMARIES.has(key)) return formatMetric(value, 'percent');
  return formatMetric(value, 'number');
}

function formatFinnishDate(value: string): string {
  if (!value) return '—';
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

function statusFilterLabel(reportType: ReportCenterType): string {
  if (reportType === 'projects') return 'Projektin tila';
  if (reportType === 'equipment') return 'Kaluston tila';
  return 'Hyväksyntätila';
}

function insightAppearance(severity: ReportCenterInsight['severity']): {
  container: string;
  icon: typeof ShieldAlert;
  iconClass: string;
} {
  if (severity === 'critical') return {
    container: 'border-red-200 bg-red-50', icon: ShieldAlert, iconClass: 'text-red-700',
  };
  if (severity === 'warning') return {
    container: 'border-amber-200 bg-amber-50', icon: CircleAlert, iconClass: 'text-amber-700',
  };
  if (severity === 'success') return {
    container: 'border-emerald-200 bg-emerald-50', icon: CheckCircle2, iconClass: 'text-emerald-700',
  };
  return { container: 'border-blue-200 bg-blue-50', icon: Info, iconClass: 'text-blue-700' };
}

function InsightCard({ insight }: { insight: ReportCenterInsight }) {
  const appearance = insightAppearance(insight.severity);
  const Icon = appearance.icon;
  return (
    <div className={cn('rounded-xl border p-4', appearance.container)}>
      <div className="flex items-start gap-3">
        <Icon size={20} className={cn('mt-0.5 shrink-0', appearance.iconClass)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold text-slate-950">{insight.title}</p>
            {insight.value !== undefined && (
              <p className="font-mono text-xl font-bold text-slate-950">
                {formatMetric(insight.value, insight.format ?? 'number')}
              </p>
            )}
          </div>
          <p className="mt-1 text-sm leading-5 text-slate-600">{insight.description}</p>
        </div>
      </div>
    </div>
  );
}

function BreakdownCard({ breakdown }: { breakdown: ReportCenterBreakdown }) {
  const maximum = Math.max(0, ...breakdown.rows.map((row) => row.secondaryValue && row.secondaryValue > 0
    ? Math.max(row.value, row.secondaryValue)
    : row.value));
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{breakdown.title}</CardTitle>
        <p className="text-sm text-slate-500">{breakdown.description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {breakdown.rows.map((row) => {
          const denominator = row.secondaryValue && row.secondaryValue > 0 ? row.secondaryValue : maximum;
          const ratio = denominator > 0 ? Math.min(100, Math.max(0, (row.value / denominator) * 100)) : 0;
          return (
            <div key={row.label}>
              <div className="flex items-start justify-between gap-4 text-sm">
                <span className="min-w-0 break-words font-medium text-slate-700">{row.label}</span>
                <span className="shrink-0 text-right font-mono font-semibold text-slate-950">
                  {formatMetric(row.value, breakdown.format)}
                  {row.secondaryValue !== undefined && (
                    <span className="font-normal text-slate-500"> / {formatMetric(row.secondaryValue, breakdown.secondaryFormat ?? breakdown.format)}</span>
                  )}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className={cn('h-full rounded-full', ratio >= 100 && row.secondaryValue ? 'bg-red-500' : 'bg-blue-600')} style={{ width: `${ratio}%` }} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
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
  const [resultSearch, setResultSearch] = useState('');
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
  const usesDateRange = reportType !== 'equipment';
  const usesPeople = !['projects', 'equipment'].includes(reportType);
  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLocaleLowerCase('fi');
    if (!query) return catalog.users;
    return catalog.users.filter((user) => `${user.name} ${user.email ?? ''}`.toLocaleLowerCase('fi').includes(query));
  }, [catalog.users, userSearch]);

  const previewRows = useMemo(() => {
    if (!dataset) return [];
    const query = resultSearch.trim().toLocaleLowerCase('fi');
    if (!query) return dataset.rows;
    return dataset.rows.filter((row) => searchableReportRow(row).includes(query));
  }, [dataset, resultSearch]);

  const summaryEntries = useMemo(() => {
    if (!dataset) return [];
    const preferred = SUMMARY_ORDER[dataset.reportType];
    const included = new Set(preferred);
    const ordered = preferred
      .filter((key) => Object.prototype.hasOwnProperty.call(dataset.summary, key))
      .map((key) => [key, dataset.summary[key]] as const);
    for (const entry of Object.entries(dataset.summary)) {
      if (!included.has(entry[0])) ordered.push(entry);
    }
    return ordered.slice(0, 8);
  }, [dataset]);

  const invalidateDataset = () => {
    setDataset(null);
    setResultSearch('');
  };

  const changeReportType = (nextType: ReportCenterType) => {
    setReportType(nextType);
    setStatuses([]);
    setUserIds([]);
    invalidateDataset();
  };

  const changeMonth = (nextMonth: string) => {
    setMonth(nextMonth);
    const dates = monthDates(nextMonth);
    setDateFrom(dates.from);
    setDateTo(dates.to);
    invalidateDataset();
  };

  const applyPreset = (preset: DatePreset) => {
    const dates = presetDates(preset);
    setDateFrom(dates.from);
    setDateTo(dates.to);
    setMonth(dates.month);
    invalidateDataset();
  };

  const toggleStatus = (status: string, checked: boolean) => {
    setStatuses((current) => checked ? [...new Set([...current, status])] : current.filter((item) => item !== status));
    invalidateDataset();
  };

  const toggleUser = (userId: string, checked: boolean) => {
    setUserIds((current) => checked ? [...new Set([...current, userId])] : current.filter((item) => item !== userId));
    invalidateDataset();
  };

  const generate = async () => {
    if (!currentOrg) return;
    if (usesDateRange && (!dateFrom || !dateTo)) {
      setError('Valitse raportille alku- ja loppupäivä.');
      return;
    }
    if (usesDateRange && dateFrom > dateTo) {
      setError('Alkupäivä ei voi olla loppupäivän jälkeen.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const today = inputDate(new Date());
      const rawDataset = await loadReportCenterData({
        organizationId: currentOrg.id,
        reportType,
        projectId: projectId === ALL_PROJECTS ? null : projectId,
        dateFrom: usesDateRange ? dateFrom : today,
        dateTo: usesDateRange ? dateTo : today,
        statuses: statuses.length ? statuses : null,
        userIds: usesPeople && userIds.length ? userIds : null,
      });
      const selectedNames = catalog.users.filter((user) => userIds.includes(user.id)).map((user) => user.name);
      const peopleLabel = !usesPeople || !userIds.length
        ? 'Kaikki henkilöt'
        : selectedNames.length <= 3 ? selectedNames.join(', ') : `${selectedNames.length} henkilöä`;
      setDataset(enrichReportDataset(rawDataset, {
        organizationName: currentOrg.name,
        periodLabel: usesDateRange ? `${formatFinnishDate(dateFrom)}–${formatFinnishDate(dateTo)}` : 'Nykytilanne',
        projectLabel: selectedProject?.name ?? 'Kaikki projektit',
        peopleLabel,
        statusLabel: statuses.length ? statuses.join(', ') : 'Kaikki tilat',
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

  const periodSummary = usesDateRange ? `${formatFinnishDate(dateFrom)}–${formatFinnishDate(dateTo)}` : 'Nykytilanne';

  return (
    <section className="mx-auto max-w-[1500px] space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              <FileSpreadsheet size={16} /> Raporttikeskus
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Raportit ja analyysit</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Muodosta tarkistettava aineisto, tunnista poikkeamat ja vie yksityiskohtaiset rivit jatkokäsittelyyn.
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
              <CardTitle className="text-lg">1. Valitse raportin käyttötarkoitus</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Raporttityyppi määrää aineiston, tunnusluvut ja automaattiset tarkistukset.</p>
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
                  onClick={() => changeReportType(type.value)}
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

          <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
            <Sparkles size={18} className="mt-0.5 shrink-0 text-blue-700" />
            <div>
              <p className="text-sm font-semibold text-blue-950">Mihin tätä raporttia käytetään?</p>
              <p className="mt-1 text-sm text-blue-800">{reportInfo.purpose}</p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <div className="mb-4">
              <h2 className="font-semibold text-slate-950">2. Rajaa kohde ja tarkastelujakso</h2>
              <p className="mt-1 text-sm text-slate-500">
                {reportType === 'equipment'
                  ? 'Kalustoraportti kuvaa nykytilannetta. Päivämäärärajausta ei käytetä.'
                  : reportType === 'projects'
                    ? 'Ajanjakso rajaa projektien tuntitoteuman. Projektin budjetti ja nykytila näytetään kokonaisuutena.'
                    : 'Valitse valmis ajanjakso tai määritä alku- ja loppupäivä tarkasti.'}
              </p>
            </div>

            <div className={cn('grid gap-4', usesDateRange ? 'lg:grid-cols-4' : 'lg:grid-cols-2')}>
              <div className="space-y-2">
                <Label>Projekti</Label>
                <Select value={projectId} onValueChange={(value: string) => { setProjectId(value); invalidateDataset(); }} disabled={catalogLoading}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_PROJECTS}>Kaikki projektit</SelectItem>
                    {catalog.projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.projectNumber ? `${project.projectNumber} · ` : ''}{project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {usesDateRange && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="report-month">Kuukausi</Label>
                    <Input id="report-month" type="month" value={month} onChange={(event: ChangeEvent<HTMLInputElement>) => changeMonth(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="report-center-from">Alkupäivä</Label>
                    <Input id="report-center-from" type="date" value={dateFrom} onChange={(event: ChangeEvent<HTMLInputElement>) => { setDateFrom(event.target.value); setMonth(''); invalidateDataset(); }} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="report-center-to">Loppupäivä</Label>
                    <Input id="report-center-to" type="date" value={dateTo} onChange={(event: ChangeEvent<HTMLInputElement>) => { setDateTo(event.target.value); setMonth(''); invalidateDataset(); }} />
                  </div>
                </>
              )}
            </div>

            {usesDateRange && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => applyPreset('this_month')}>Tämä kuukausi</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => applyPreset('previous_month')}>Viime kuukausi</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => applyPreset('this_week')}>Tämä viikko</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => applyPreset('last_30_days')}>Viimeiset 30 päivää</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => applyPreset('this_year')}>Tämä vuosi</Button>
              </div>
            )}
          </div>

          {(statusOptions.length > 0 || usesPeople) && (
            <div className="border-t border-slate-100 pt-6">
              <div className="mb-4">
                <h2 className="font-semibold text-slate-950">3. Tarkemmat rajaukset</h2>
                <p className="mt-1 text-sm text-slate-500">Tyhjä valinta tarkoittaa, että kaikki vaihtoehdot sisällytetään.</p>
              </div>

              {statusOptions.length > 0 && (
                <div className="mb-5 space-y-2">
                  <Label>{statusFilterLabel(reportType)}</Label>
                  <div className="flex flex-wrap gap-2">
                    {statusOptions.map((status) => (
                      <label key={status} className={cn('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm', statuses.includes(status) ? 'border-blue-300 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white')}>
                        <Checkbox checked={statuses.includes(status)} onCheckedChange={(checked: boolean | 'indeterminate') => toggleStatus(status, checked === true)} />{status}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {usesPeople && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <Label className="flex items-center gap-2"><UsersRound size={16} /> Henkilöt</Label>
                      <p className="mt-1 text-xs text-slate-500">Valitse vain henkilöt, jotka haluat raportille.</p>
                    </div>
                    <div className="relative sm:w-80">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input value={userSearch} onChange={(event: ChangeEvent<HTMLInputElement>) => setUserSearch(event.target.value)} placeholder="Hae henkilöä…" className="bg-white pl-9" />
                    </div>
                  </div>
                  <div className="mt-4 grid max-h-52 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredUsers.map((user) => (
                      <label key={user.id} className={cn('flex cursor-pointer items-start gap-2 rounded-lg border p-3', userIds.includes(user.id) ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white')}>
                        <Checkbox checked={userIds.includes(user.id)} onCheckedChange={(checked: boolean | 'indeterminate') => toggleUser(user.id, checked === true)} />
                        <span className="min-w-0 break-words"><span className="block text-sm font-medium text-slate-900">{user.name}</span><span className="block text-xs text-slate-500">{user.email || user.role}</span></span>
                      </label>
                    ))}
                  </div>
                  {userIds.length > 0 && <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setUserIds([]); invalidateDataset(); }}>Tyhjennä henkilövalinnat ({userIds.length})</Button>}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-4 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Valmis analysoitavaksi</p>
              <p className="mt-1 font-semibold text-blue-950">{reportInfo.label}</p>
              <p className="mt-1 text-sm text-blue-800">
                {periodSummary} · {selectedProject?.name ?? 'Kaikki projektit'} · {usesPeople ? (userIds.length ? `${userIds.length} henkilöä` : 'Kaikki henkilöt') : (statuses.length ? statuses.join(', ') : 'Kaikki tilat')}
              </p>
            </div>
            <Button className="min-h-11 shrink-0 gap-2" onClick={() => void generate()} disabled={loading || !currentOrg}>
              {loading ? <Loader2 size={17} className="animate-spin" /> : <BarChart3 size={17} />}
              {loading ? 'Analysoidaan…' : 'Muodosta raportti'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {dataset && (
        <>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Raportin tilannekuva</h2>
            <p className="mt-1 text-sm text-slate-500">Keskeiset luvut ja aineistosta automaattisesti tunnistetut toimenpidetarpeet.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {summaryEntries.map(([key, value]) => (
              <Card key={key} className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{summaryLabel(key)}</p>
                  <p className="mt-2 break-words font-mono text-2xl font-bold text-slate-950">{summaryValue(key, value)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {dataset.insights && dataset.insights.length > 0 && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-slate-50/70">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                    <Sparkles size={19} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Tarkistettavat asiat</CardTitle>
                    <p className="mt-1 text-sm text-slate-500">Poikkeamat on johdettu raportin riveistä. Tarkista aina alkuperäinen kirjaus ennen päätöstä.</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 p-5 md:grid-cols-2">
                {dataset.insights.map((insight) => <InsightCard key={insight.id} insight={insight} />)}
              </CardContent>
            </Card>
          )}

          {dataset.breakdowns && dataset.breakdowns.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              {dataset.breakdowns.map((breakdown) => <BreakdownCard key={breakdown.id} breakdown={breakdown} />)}
            </div>
          )}

          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b bg-slate-50">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <CardTitle className="text-lg">{dataset.title}</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    {dataset.context?.periodLabel} · {dataset.context?.projectLabel} · {dataset.context?.peopleLabel} · {dataset.context?.statusLabel}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Esikatselussa näkyvät enintään 200 riviä. Vientitiedosto sisältää kaikki {dataset.rows.length} riviä.</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="relative sm:w-72">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input value={resultSearch} onChange={(event: ChangeEvent<HTMLInputElement>) => setResultSearch(event.target.value)} placeholder="Hae raportin riveistä…" className="bg-white pl-9" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <Button variant="outline" className="gap-2" onClick={() => exportAction(downloadReportCsv)}><Download size={15} /> CSV</Button>
                    <Button variant="outline" className="gap-2" onClick={() => exportAction(downloadReportXlsx)}><FileSpreadsheet size={15} /> Excel</Button>
                    <Button variant="outline" className="gap-2" onClick={() => exportAction(downloadReportPdf)}><FileText size={15} /> PDF</Button>
                    <Button className="gap-2" onClick={() => exportAction(printReport)}><Printer size={15} /> Tulosta</Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {previewRows.length > 0 ? (
                <>
                  {resultSearch && (
                    <div className="border-b border-slate-200 bg-blue-50 px-4 py-2 text-xs text-blue-800">
                      Haulla löytyi {previewRows.length} riviä. Haku rajaa vain esikatselua, ei vientitiedostoa.
                    </div>
                  )}
                  <div className="max-h-[620px] overflow-auto">
                    <table className="min-w-full border-collapse text-xs">
                      <thead className="sticky top-0 z-10 bg-slate-100"><tr>{dataset.columns.map((column) => <th key={column.key} className="break-words border-b border-r border-slate-200 px-3 py-3 text-left font-semibold text-slate-700 last:border-r-0">{column.label}</th>)}</tr></thead>
                      <tbody>{previewRows.slice(0, 200).map((row, rowIndex) => <tr key={rowIndex} className="odd:bg-white even:bg-slate-50/60">{dataset.columns.map((column) => <td key={column.key} className="max-w-xs break-words border-b border-r border-slate-100 px-3 py-2 align-top text-slate-700 last:border-r-0"><span className="whitespace-pre-wrap">{displayValue(row[column.key], column)}</span></td>)}</tr>)}</tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="p-10 text-center">
                  <CalendarRange size={38} className="mx-auto mb-3 text-slate-400" />
                  <p className="font-semibold text-slate-800">{dataset.rows.length ? 'Haulla ei löytynyt rivejä' : 'Rajauksella ei löytynyt raportoitavaa aineistoa'}</p>
                  <p className="mt-1 text-sm text-slate-500">{dataset.rows.length ? 'Tyhjennä esikatseluhaku tai käytä toista hakusanaa.' : 'Laajenna aikaväliä tai poista projekti-, henkilö- tai tilarajauksia.'}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
