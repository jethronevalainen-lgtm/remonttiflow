import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BadgeEuro,
  Calculator,
  CheckCircle2,
  Clock3,
  FileLock2,
  Loader2,
  RefreshCw,
  Save,
  ShieldAlert,
  UsersRound,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  getOrganizationTimeRules,
  listPayrollPeriods,
  listPayrollPreview,
  lockPayrollPeriod,
  saveOrganizationTimeRules,
  type OrganizationTimeRules,
  type PayrollPeriod,
  type PayrollPreviewLine,
} from '@/lib/supabase/payroll';

interface EmployeeSummary {
  key: string;
  employeeId?: string;
  employeeName: string;
  entryCount: number;
  totalMinutes: number;
  regularMinutes: number;
  additionalMinutes: number;
  overtime50Minutes: number;
  overtime100Minutes: number;
  weeklyOvertime50Minutes: number;
  saturdayMinutes: number;
  sundayMinutes: number;
  hourlyBasePayCents: number;
  variablePayCents: number;
  lineTotalCents: number;
  fixedMonthlySalaryCents: number;
  blockers: string[];
  warnings: string[];
}

function monthRange(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const iso = (value: Date) => [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
  return { start: iso(start), end: iso(end) };
}

function isFullCalendarMonth(start: string, end: string) {
  if (!start || !end) return false;
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return false;
  const expectedEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
  return startDate.getDate() === 1
    && startDate.getFullYear() === endDate.getFullYear()
    && startDate.getMonth() === endDate.getMonth()
    && expectedEnd.getDate() === endDate.getDate();
}

function hours(minutes: number) {
  return `${new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 2 }).format(minutes / 60)} h`;
}

function euro(cents: number) {
  return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('fi-FI').format(new Date(`${value}T00:00:00`));
}

function dateTimeLabel(value?: string) {
  if (!value) return 'Ei tietoa';
  return new Intl.DateTimeFormat('fi-FI', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function aggregateLines(lines: PayrollPreviewLine[], includeFixedMonthlySalary: boolean): EmployeeSummary[] {
  const map = new Map<string, EmployeeSummary>();

  for (const line of lines) {
    const key = line.employeeId ?? `unresolved:${line.employeeName}`;
    const current = map.get(key) ?? {
      key,
      employeeId: line.employeeId,
      employeeName: line.employeeName,
      entryCount: 0,
      totalMinutes: 0,
      regularMinutes: 0,
      additionalMinutes: 0,
      overtime50Minutes: 0,
      overtime100Minutes: 0,
      weeklyOvertime50Minutes: 0,
      saturdayMinutes: 0,
      sundayMinutes: 0,
      hourlyBasePayCents: 0,
      variablePayCents: 0,
      lineTotalCents: 0,
      fixedMonthlySalaryCents: 0,
      blockers: [],
      warnings: [],
    };

    current.entryCount += 1;
    current.totalMinutes += line.totalMinutes;
    current.regularMinutes += line.regularMinutes;
    current.additionalMinutes += line.additionalMinutes;
    current.overtime50Minutes += line.overtime50Minutes;
    current.overtime100Minutes += line.overtime100Minutes;
    current.weeklyOvertime50Minutes += line.weeklyOvertime50Minutes;
    current.saturdayMinutes += line.saturdayMinutes;
    current.sundayMinutes += line.sundayMinutes;
    current.hourlyBasePayCents += line.hourlyBasePayCents;
    current.variablePayCents += line.variablePayCents;
    current.lineTotalCents += line.lineTotalCents;
    if (includeFixedMonthlySalary && line.payType === 'Kuukausipalkka') {
      current.fixedMonthlySalaryCents = Math.max(
        current.fixedMonthlySalaryCents,
        line.monthlySalaryCents ?? 0,
      );
    }
    current.blockers = [...new Set([...current.blockers, ...line.blockers])];
    current.warnings = [...new Set([...current.warnings, ...line.warnings])];
    map.set(key, current);
  }

  return [...map.values()].sort((left, right) => left.employeeName.localeCompare(right.employeeName, 'fi'));
}

function NumberField({
  label,
  value,
  step = 0.25,
  min = 0,
  disabled,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          value={value}
          disabled={disabled}
          className={suffix ? 'pr-14' : undefined}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{suffix}</span>}
      </div>
    </div>
  );
}

export default function PalkkaAineisto() {
  const { user } = useAuth();
  const { currentOrg, currentRole } = useOrganization();
  const initialRange = useMemo(() => monthRange(), []);
  const [periodStart, setPeriodStart] = useState(initialRange.start);
  const [periodEnd, setPeriodEnd] = useState(initialRange.end);
  const [notes, setNotes] = useState('');
  const [rules, setRules] = useState<OrganizationTimeRules | null>(null);
  const [lines, setLines] = useState<PayrollPreviewLine[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [locking, setLocking] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isAdmin = currentRole === 'admin';
  const fullMonth = isFullCalendarMonth(periodStart, periodEnd);
  const summaries = useMemo(() => aggregateLines(lines, fullMonth), [fullMonth, lines]);
  const blockerCount = summaries.reduce((sum, item) => sum + item.blockers.length, 0);
  const warningCount = summaries.reduce((sum, item) => sum + item.warnings.length, 0);
  const totalMinutes = summaries.reduce((sum, item) => sum + item.totalMinutes, 0);
  const overtimeMinutes = summaries.reduce(
    (sum, item) => sum + item.overtime50Minutes + item.overtime100Minutes + item.weeklyOvertime50Minutes,
    0,
  );
  const estimatedTotalCents = summaries.reduce(
    (sum, item) => sum + item.lineTotalCents + item.fixedMonthlySalaryCents,
    0,
  );

  const loadBase = useCallback(async () => {
    if (!currentOrg) {
      setRules(null);
      setPeriods([]);
      setLines([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [nextRules, nextPeriods] = await Promise.all([
        getOrganizationTimeRules(currentOrg.id),
        listPayrollPeriods(currentOrg.id),
      ]);
      setRules(nextRules);
      setPeriods(nextPeriods);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Palkka-aineiston perustietojen haku epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [currentOrg]);

  const calculate = useCallback(async () => {
    if (!currentOrg || !periodStart || !periodEnd) return;
    setCalculating(true);
    setError(null);
    setSuccess(null);
    try {
      setLines(await listPayrollPreview(currentOrg.id, periodStart, periodEnd));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Palkka-aineiston laskenta epäonnistui.');
    } finally {
      setCalculating(false);
    }
  }, [currentOrg, periodEnd, periodStart]);

  useEffect(() => { void loadBase(); }, [loadBase]);
  useEffect(() => {
    if (currentOrg) void calculate();
  }, [calculate, currentOrg]);

  const updateRule = <K extends keyof OrganizationTimeRules>(key: K, value: OrganizationTimeRules[K]) => {
    setRules((current) => current ? { ...current, [key]: value } : current);
  };

  const saveRules = async () => {
    if (!rules || !user || !isAdmin) return;
    setSavingRules(true);
    setError(null);
    setSuccess(null);
    try {
      await saveOrganizationTimeRules(rules, user.id);
      setRules(await getOrganizationTimeRules(rules.organizationId));
      setSuccess('Työaika- ja korvaussäännöt tallennettiin. Laske aineisto uudelleen, jotta uudet säännöt tulevat näkyviin.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Työaikasääntöjen tallennus epäonnistui.');
    } finally {
      setSavingRules(false);
    }
  };

  const lockPeriod = async () => {
    if (!currentOrg || !isAdmin || blockerCount > 0 || lines.length === 0) return;
    setLocking(true);
    setError(null);
    setSuccess(null);
    try {
      await lockPayrollPeriod({
        organizationId: currentOrg.id,
        periodStart,
        periodEnd,
        notes,
      });
      setConfirmLock(false);
      setNotes('');
      setSuccess('Palkkakausi lukittiin. Kauden hyväksyttyjä tuntikirjauksia ei voi enää muuttaa.');
      const [nextPeriods, nextLines] = await Promise.all([
        listPayrollPeriods(currentOrg.id),
        listPayrollPreview(currentOrg.id, periodStart, periodEnd),
      ]);
      setPeriods(nextPeriods);
      setLines(nextLines);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Palkkakauden lukitus epäonnistui.');
      setConfirmLock(false);
    } finally {
      setLocking(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-orange-600" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-hero text-text-primary">Palkka-aineisto</h1>
          <p className="mt-1 max-w-3xl text-body-sm text-text-secondary">
            Hyväksyttyjen tuntien palvelinpuolinen luokittelu, palkkaerien tarkistus ja palkkakauden muuttumaton lukitus.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => void calculate()} disabled={calculating}>
            {calculating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Laske uudelleen
          </Button>
          {isAdmin && (
            <Button
              className="gap-2"
              disabled={locking || calculating || lines.length === 0 || blockerCount > 0}
              onClick={() => setConfirmLock(true)}
            >
              <FileLock2 size={16} /> Lukitse palkkakausi
            </Button>
          )}
        </div>
      </div>

      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertTriangle size={18} className="mt-0.5 shrink-0" />{error}</div>}
      {success && <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={18} className="mt-0.5 shrink-0" />{success}</div>}

      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-[1fr_1fr_2fr_auto] xl:items-end">
          <div className="space-y-2"><Label htmlFor="payroll-start">Kauden alku</Label><Input id="payroll-start" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="payroll-end">Kauden loppu</Label><Input id="payroll-end" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="payroll-notes">Lukituksen muistiinpano</Label><Input id="payroll-notes" value={notes} maxLength={500} onChange={(event) => setNotes(event.target.value)} placeholder="Esimerkiksi heinäkuun varsinainen palkka-ajo" /></div>
          <Button variant="outline" className="gap-2" onClick={() => void calculate()} disabled={calculating}><Calculator size={16} /> Laske aineisto</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {[
          { label: 'Työntekijöitä', value: String(summaries.length), icon: UsersRound },
          { label: 'Hyväksytty työaika', value: hours(totalMinutes), icon: Clock3 },
          { label: 'Ylityötä', value: hours(overtimeMinutes), icon: Calculator },
          { label: 'Arvioitu aineisto', value: euro(estimatedTotalCents), icon: BadgeEuro },
          { label: 'Estäviä puutteita', value: String(blockerCount), icon: ShieldAlert },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between text-xs text-text-secondary"><span>{item.label}</span><item.icon size={17} className="text-orange-600" /></div>
              <p className="font-mono text-xl font-bold sm:text-2xl">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {!fullMonth && summaries.some((item) => item.fixedMonthlySalaryCents === 0) && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
          Kuukausipalkkaa ei jaksoteta automaattisesti vajaalle kalenterikuukaudelle. Näkymä näyttää tällöin tuntipalkat ja muuttuvat palkkaerät; kiinteä kuukausipalkka lisätään arvioon vain täydeltä kalenterikuukaudelta.
        </div>
      )}

      {blockerCount > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Palkkakautta ei voi lukita vielä.</p>
          <p className="mt-1">Korjaa alla näkyvät henkilökortti-, palkkaehto- tai kellonaikapuutteet ja laske aineisto uudelleen.</p>
        </div>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="border-b"><CardTitle className="text-lg">Työntekijäkohtainen tarkistus</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="hidden grid-cols-[1.35fr_90px_90px_90px_90px_120px_120px] gap-3 border-b bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 xl:grid">
            <span>Työntekijä</span><span>Yhteensä</span><span>Lisätyö</span><span>50 %</span><span>100 %</span><span>Muuttuvat</span><span>Arvio yhteensä</span>
          </div>
          {summaries.map((summary) => (
            <div key={summary.key} className="border-b border-slate-100 px-5 py-5">
              <div className="grid gap-4 xl:grid-cols-[1.35fr_90px_90px_90px_90px_120px_120px] xl:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-950">{summary.employeeName}</p><Badge variant="outline">{summary.entryCount} kirjausta</Badge></div>
                  <p className="mt-1 text-xs text-slate-500">Säännöllinen {hours(summary.regularMinutes)} · viikkoylityö 50 % {hours(summary.weeklyOvertime50Minutes)}</p>
                </div>
                <div><p className="text-xs text-slate-500 xl:hidden">Yhteensä</p><p className="font-mono font-semibold">{hours(summary.totalMinutes)}</p></div>
                <div><p className="text-xs text-slate-500 xl:hidden">Lisätyö</p><p className="font-mono">{hours(summary.additionalMinutes)}</p></div>
                <div><p className="text-xs text-slate-500 xl:hidden">Ylityö 50 %</p><p className="font-mono">{hours(summary.overtime50Minutes + summary.weeklyOvertime50Minutes)}</p></div>
                <div><p className="text-xs text-slate-500 xl:hidden">Ylityö 100 %</p><p className="font-mono">{hours(summary.overtime100Minutes)}</p></div>
                <div><p className="text-xs text-slate-500 xl:hidden">Muuttuvat erät</p><p className="font-mono">{euro(summary.variablePayCents)}</p></div>
                <div><p className="text-xs text-slate-500 xl:hidden">Arvio yhteensä</p><p className="font-mono font-semibold">{euro(summary.lineTotalCents + summary.fixedMonthlySalaryCents)}</p></div>
              </div>
              {(summary.blockers.length > 0 || summary.warnings.length > 0) && (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {summary.blockers.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800">{summary.blockers.map((item) => <p key={item}>• {item}</p>)}</div>}
                  {summary.warnings.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">{summary.warnings.map((item) => <p key={item}>• {item}</p>)}</div>}
                </div>
              )}
            </div>
          ))}
          {summaries.length === 0 && <div className="p-12 text-center"><Calculator size={42} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold">Ei hyväksyttyjä tuntikirjauksia valitulla kaudella</p></div>}
        </CardContent>
      </Card>

      {rules && (
        <Card>
          <CardHeader className="border-b"><CardTitle className="flex items-center gap-2 text-lg"><Calculator size={18} className="text-orange-600" />Organisaation työaikasäännöt</CardTitle></CardHeader>
          <CardContent className="space-y-6 p-5">
            {!isAdmin && <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Työnjohtaja voi tarkastella sääntöjä, mutta vain admin voi muuttaa niitä.</p>}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <NumberField label="Sovittu työaika / päivä" value={rules.contractualDailyHours} disabled={!isAdmin} onChange={(value) => updateRule('contractualDailyHours', value)} suffix="h" />
              <NumberField label="Sovittu työaika / viikko" value={rules.contractualWeeklyHours} disabled={!isAdmin} onChange={(value) => updateRule('contractualWeeklyHours', value)} suffix="h" />
              <NumberField label="Vuorokautinen ylityöraja" value={rules.statutoryDailyOvertimeAfterHours} disabled={!isAdmin} onChange={(value) => updateRule('statutoryDailyOvertimeAfterHours', value)} suffix="h" />
              <NumberField label="Viikoittainen ylityöraja" value={rules.statutoryWeeklyOvertimeAfterHours} disabled={!isAdmin} onChange={(value) => updateRule('statutoryWeeklyOvertimeAfterHours', value)} suffix="h" />
              <NumberField label="50 % vuorokautista ylityötä" value={rules.dailyOvertime50Hours} disabled={!isAdmin} onChange={(value) => updateRule('dailyOvertime50Hours', value)} suffix="h" />
              <NumberField label="Kuukausipalkan tuntijakaja" value={rules.monthlySalaryHourDivisor} step={0.5} disabled={!isAdmin} onChange={(value) => updateRule('monthlySalaryHourDivisor', value)} />
              <NumberField label="Sunnuntaikerroin" value={rules.sundayMultiplier} step={0.1} min={1} disabled={!isAdmin} onChange={(value) => updateRule('sundayMultiplier', value)} />
              <NumberField label="Enimmäistyöaika keskimäärin" value={rules.maximumAverageWeeklyHours} disabled={!isAdmin} onChange={(value) => updateRule('maximumAverageWeeklyHours', value)} suffix="h/vko" />
              <div className="space-y-2"><Label>Pyöristys</Label><Select value={String(rules.roundingMinutes)} disabled={!isAdmin} onValueChange={(value) => updateRule('roundingMinutes', Number(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1,5,10,15,30,60].map((value) => <SelectItem key={value} value={String(value)}>{value} min</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Pyöristyssuunta</Label><Select value={rules.roundingMode} disabled={!isAdmin} onValueChange={(value: OrganizationTimeRules['roundingMode']) => updateRule('roundingMode', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nearest">Lähimpään</SelectItem><SelectItem value="floor">Alaspäin</SelectItem><SelectItem value="ceil">Ylöspäin</SelectItem></SelectContent></Select></div>
              <NumberField label="Automaattinen tauko jälkeen" value={rules.automaticBreakAfterMinutes} step={15} disabled={!isAdmin} onChange={(value) => updateRule('automaticBreakAfterMinutes', value)} suffix="min" />
              <NumberField label="Automaattinen tauko" value={rules.automaticBreakMinutes} step={5} disabled={!isAdmin} onChange={(value) => updateRule('automaticBreakMinutes', value)} suffix="min" />
            </div>

            <div>
              <h3 className="font-semibold text-slate-950">Verovapaiden matkakustannusten enimmäismäärät</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">Vuoden 2026 oletukset ovat 0,55 €/km, osapäiväraha 25 €, kokopäiväraha 54 € ja ateriakorvaus 13,50 €. Arvot ovat organisaatiokohtaisesti muutettavia.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <NumberField label="Kilometrikorvaus" value={rules.kilometerAllowanceCentsPerKm / 100} step={0.01} disabled={!isAdmin} onChange={(value) => updateRule('kilometerAllowanceCentsPerKm', Math.round(value * 100))} suffix="€/km" />
                <NumberField label="Osapäiväraha" value={rules.partialDailyAllowanceCents / 100} step={0.5} disabled={!isAdmin} onChange={(value) => updateRule('partialDailyAllowanceCents', Math.round(value * 100))} suffix="€" />
                <NumberField label="Kokopäiväraha" value={rules.fullDailyAllowanceCents / 100} step={0.5} disabled={!isAdmin} onChange={(value) => updateRule('fullDailyAllowanceCents', Math.round(value * 100))} suffix="€" />
                <NumberField label="Ateriakorvaus" value={rules.mealAllowanceCents / 100} step={0.25} disabled={!isAdmin} onChange={(value) => updateRule('mealAllowanceCents', Math.round(value * 100))} suffix="€" />
                <div className="space-y-2"><Label>Voimassa alkaen</Label><Input type="date" value={rules.expenseRatesValidFrom} disabled={!isAdmin} onChange={(event) => updateRule('expenseRatesValidFrom', event.target.value)} /></div>
              </div>
            </div>

            {isAdmin && <div className="flex justify-end"><Button className="gap-2" onClick={() => void saveRules()} disabled={savingRules}>{savingRules ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{savingRules ? 'Tallennetaan…' : 'Tallenna säännöt'}</Button></div>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b"><CardTitle className="flex items-center gap-2 text-lg"><FileLock2 size={18} className="text-orange-600" />Lukitut palkkakaudet</CardTitle></CardHeader>
        <CardContent className="p-0">
          {periods.map((period) => (
            <div key={period.id} className="grid gap-3 border-b px-5 py-4 md:grid-cols-[1fr_120px_140px_180px] md:items-center">
              <div><p className="font-semibold">{dateLabel(period.periodStart)}–{dateLabel(period.periodEnd)}</p><p className="mt-1 text-xs text-slate-500">{period.notes || 'Ei muistiinpanoa'} · lukittu {dateTimeLabel(period.lockedAt)}</p></div>
              <Badge className="w-fit border-0 bg-slate-100 text-slate-700">{period.status}</Badge>
              <p className="font-mono text-sm">{period.employeeCount} työntekijää</p>
              <p className="font-mono font-semibold md:text-right">{euro(period.estimatedTotalCents)}</p>
            </div>
          ))}
          {periods.length === 0 && <div className="p-10 text-center text-sm text-slate-500">Palkkakausia ei ole vielä lukittu.</div>}
        </CardContent>
      </Card>

      {warningCount > 0 && <p className="text-xs text-slate-500">Aineistossa on {warningCount} tarkistettavaa huomautusta. Huomautus ei yksin estä lukitusta, mutta se pitää käsitellä ennen varsinaista palkanmaksua.</p>}

      <AlertDialog open={confirmLock} onOpenChange={setConfirmLock}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lukitaanko palkkakausi?</AlertDialogTitle>
            <AlertDialogDescription>
              Kauden {dateLabel(periodStart)}–{dateLabel(periodEnd)} hyväksytyistä tuntikirjauksista muodostetaan muuttumaton laskentasnapshot. Lukittuja kirjauksia ei voi enää muokata tai poistaa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Peruuta</AlertDialogCancel>
            <AlertDialogAction onClick={() => void lockPeriod()} disabled={locking}>
              {locking ? 'Lukitaan…' : 'Lukitse palkkakausi'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
