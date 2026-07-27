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
  Moon,
  RefreshCw,
  Save,
  ShieldAlert,
  Sunset,
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
  employeeName: string;
  entryCount: number;
  totalMinutes: number;
  regularMinutes: number;
  additionalMinutes: number;
  overtime50Minutes: number;
  overtime100Minutes: number;
  weeklyOvertime50Minutes: number;
  eveningMinutes: number;
  nightMinutes: number;
  variablePayCents: number;
  lineTotalCents: number;
  fixedMonthlySalaryCents: number;
  blockers: string[];
  warnings: string[];
}

function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const iso = (value: Date) => [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
  return { start: iso(start), end: iso(end) };
}

function isFullMonth(start: string, end: string) {
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

function timeInputValue(value: string) {
  return value.slice(0, 5);
}

function summarize(lines: PayrollPreviewLine[], includeMonthlySalary: boolean): EmployeeSummary[] {
  const summaries = new Map<string, EmployeeSummary>();
  for (const line of lines) {
    const key = line.employeeId ?? `unresolved:${line.employeeName}`;
    const item = summaries.get(key) ?? {
      key,
      employeeName: line.employeeName,
      entryCount: 0,
      totalMinutes: 0,
      regularMinutes: 0,
      additionalMinutes: 0,
      overtime50Minutes: 0,
      overtime100Minutes: 0,
      weeklyOvertime50Minutes: 0,
      eveningMinutes: 0,
      nightMinutes: 0,
      variablePayCents: 0,
      lineTotalCents: 0,
      fixedMonthlySalaryCents: 0,
      blockers: [],
      warnings: [],
    };
    item.entryCount += 1;
    item.totalMinutes += line.totalMinutes;
    item.regularMinutes += line.regularMinutes;
    item.additionalMinutes += line.additionalMinutes;
    item.overtime50Minutes += line.overtime50Minutes;
    item.overtime100Minutes += line.overtime100Minutes;
    item.weeklyOvertime50Minutes += line.weeklyOvertime50Minutes;
    item.eveningMinutes += line.eveningMinutes;
    item.nightMinutes += line.nightMinutes;
    item.variablePayCents += line.variablePayCents;
    item.lineTotalCents += line.lineTotalCents;
    if (includeMonthlySalary && line.payType === 'Kuukausipalkka') {
      item.fixedMonthlySalaryCents = Math.max(item.fixedMonthlySalaryCents, line.monthlySalaryCents ?? 0);
    }
    item.blockers = [...new Set([...item.blockers, ...line.blockers])];
    item.warnings = [...new Set([...item.warnings, ...line.warnings])];
    summaries.set(key, item);
  }
  return [...summaries.values()].sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'fi'));
}

function NumericRule({
  label,
  value,
  disabled,
  suffix,
  step = 0.25,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  suffix?: string;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          type="number"
          min="0"
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

function ClockRule({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="time"
        value={timeInputValue(value)}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
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
  const summaries = useMemo(
    () => summarize(lines, isFullMonth(periodStart, periodEnd)),
    [lines, periodEnd, periodStart],
  );
  const blockerCount = summaries.reduce((sum, item) => sum + item.blockers.length, 0);
  const totalMinutes = summaries.reduce((sum, item) => sum + item.totalMinutes, 0);
  const overtimeMinutes = summaries.reduce(
    (sum, item) => sum + item.overtime50Minutes + item.overtime100Minutes + item.weeklyOvertime50Minutes,
    0,
  );
  const eveningMinutes = summaries.reduce((sum, item) => sum + item.eveningMinutes, 0);
  const nightMinutes = summaries.reduce((sum, item) => sum + item.nightMinutes, 0);
  const totalCents = summaries.reduce(
    (sum, item) => sum + item.lineTotalCents + item.fixedMonthlySalaryCents,
    0,
  );

  const loadBase = useCallback(async () => {
    if (!currentOrg) {
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
  useEffect(() => { if (currentOrg) void calculate(); }, [calculate, currentOrg]);

  const updateRule = <K extends keyof OrganizationTimeRules>(key: K, value: OrganizationTimeRules[K]) => {
    setRules((current) => current ? { ...current, [key]: value } : current);
  };

  const persistRules = async () => {
    if (!rules || !user || !isAdmin) return;
    setSavingRules(true);
    setError(null);
    try {
      await saveOrganizationTimeRules(rules, user.id);
      setRules(await getOrganizationTimeRules(rules.organizationId));
      setSuccess('Työaikasäännöt tallennettiin. Laske aineisto uudelleen.');
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
    try {
      await lockPayrollPeriod({ organizationId: currentOrg.id, periodStart, periodEnd, notes });
      setPeriods(await listPayrollPeriods(currentOrg.id));
      setSuccess('Palkkakausi lukittiin. Kauden hyväksyttyjä tuntikirjauksia ei voi enää muuttaa.');
      setNotes('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Palkkakauden lukitus epäonnistui.');
    } finally {
      setLocking(false);
      setConfirmLock(false);
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
          <p className="mt-1 max-w-3xl text-body-sm text-text-secondary">Hyväksyttyjen tuntien luokittelu, kellonaikapohjaiset lisät ja palkkakauden lukitus.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => void calculate()} disabled={calculating}>
            {calculating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Laske uudelleen
          </Button>
          {isAdmin && <Button className="gap-2" disabled={lines.length === 0 || blockerCount > 0 || locking} onClick={() => setConfirmLock(true)}><FileLock2 size={16} /> Lukitse palkkakausi</Button>}
        </div>
      </div>

      {error && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertTriangle size={18} className="shrink-0" />{error}</div>}
      {success && <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={18} className="shrink-0" />{success}</div>}

      <Card><CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-[1fr_1fr_2fr_auto] xl:items-end">
        <div className="space-y-2"><Label>Kauden alku</Label><Input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></div>
        <div className="space-y-2"><Label>Kauden loppu</Label><Input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></div>
        <div className="space-y-2"><Label>Lukituksen muistiinpano</Label><Input value={notes} maxLength={500} onChange={(event) => setNotes(event.target.value)} /></div>
        <Button variant="outline" className="gap-2" onClick={() => void calculate()} disabled={calculating}><Calculator size={16} /> Laske</Button>
      </CardContent></Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-7">
        {[
          { label: 'Työntekijöitä', value: String(summaries.length), icon: UsersRound },
          { label: 'Hyväksytty työaika', value: hours(totalMinutes), icon: Clock3 },
          { label: 'Ylityötä', value: hours(overtimeMinutes), icon: Calculator },
          { label: 'Iltatyötä', value: hours(eveningMinutes), icon: Sunset },
          { label: 'Yötyötä', value: hours(nightMinutes), icon: Moon },
          { label: 'Arvioitu aineisto', value: euro(totalCents), icon: BadgeEuro },
          { label: 'Estäviä puutteita', value: String(blockerCount), icon: ShieldAlert },
        ].map((item) => <Card key={item.label}><CardContent className="p-4"><div className="mb-2 flex justify-between text-xs text-text-secondary"><span>{item.label}</span><item.icon size={17} className="text-orange-600" /></div><p className="font-mono text-xl font-bold sm:text-2xl">{item.value}</p></CardContent></Card>)}
      </div>

      {blockerCount > 0 && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p className="font-semibold">Palkkakautta ei voi lukita.</p><p className="mt-1">Korjaa henkilökortti-, palkkaehto-, kellonaika- tai taukopuutteet ja laske aineisto uudelleen.</p></div>}

      <Card className="overflow-hidden">
        <CardHeader className="border-b"><CardTitle className="text-lg">Työntekijäkohtainen tarkistus</CardTitle></CardHeader>
        <CardContent className="p-0">
          {summaries.map((item) => <div key={item.key} className="border-b px-5 py-5">
            <div className="grid gap-3 xl:grid-cols-[1.4fr_repeat(7,100px)] xl:items-center">
              <div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.employeeName}</p><Badge variant="outline">{item.entryCount} kirjausta</Badge></div><p className="mt-1 text-xs text-slate-500">Säännöllinen {hours(item.regularMinutes)} · viikkoylityö {hours(item.weeklyOvertime50Minutes)}</p></div>
              <div><p className="text-xs text-slate-500">Yhteensä</p><p className="font-mono">{hours(item.totalMinutes)}</p></div>
              <div><p className="text-xs text-slate-500">Lisätyö</p><p className="font-mono">{hours(item.additionalMinutes)}</p></div>
              <div><p className="text-xs text-slate-500">50 %</p><p className="font-mono">{hours(item.overtime50Minutes + item.weeklyOvertime50Minutes)}</p></div>
              <div><p className="text-xs text-slate-500">100 %</p><p className="font-mono">{hours(item.overtime100Minutes)}</p></div>
              <div><p className="text-xs text-slate-500">Ilta</p><p className="font-mono">{hours(item.eveningMinutes)}</p></div>
              <div><p className="text-xs text-slate-500">Yö</p><p className="font-mono">{hours(item.nightMinutes)}</p></div>
              <div><p className="text-xs text-slate-500">Arvio</p><p className="font-mono font-semibold">{euro(item.lineTotalCents + item.fixedMonthlySalaryCents)}</p></div>
            </div>
            {(item.blockers.length > 0 || item.warnings.length > 0) && <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {item.blockers.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800">{item.blockers.map((message) => <p key={message}>• {message}</p>)}</div>}
              {item.warnings.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">{item.warnings.map((message) => <p key={message}>• {message}</p>)}</div>}
            </div>}
          </div>)}
          {summaries.length === 0 && <div className="p-12 text-center"><Calculator size={42} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold">Ei hyväksyttyjä tuntikirjauksia valitulla kaudella</p></div>}
        </CardContent>
      </Card>

      {rules && <Card>
        <CardHeader className="border-b"><CardTitle className="text-lg">Organisaation työaikasäännöt</CardTitle></CardHeader>
        <CardContent className="space-y-6 p-5">
          {!isAdmin && <p className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-600">Työnjohtaja voi tarkastella sääntöjä. Vain admin voi muuttaa niitä.</p>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <NumericRule label="Sovittu / päivä" value={rules.contractualDailyHours} disabled={!isAdmin} suffix="h" onChange={(value) => updateRule('contractualDailyHours', value)} />
            <NumericRule label="Sovittu / viikko" value={rules.contractualWeeklyHours} disabled={!isAdmin} suffix="h" onChange={(value) => updateRule('contractualWeeklyHours', value)} />
            <NumericRule label="Ylityöraja / päivä" value={rules.statutoryDailyOvertimeAfterHours} disabled={!isAdmin} suffix="h" onChange={(value) => updateRule('statutoryDailyOvertimeAfterHours', value)} />
            <NumericRule label="Ylityöraja / viikko" value={rules.statutoryWeeklyOvertimeAfterHours} disabled={!isAdmin} suffix="h" onChange={(value) => updateRule('statutoryWeeklyOvertimeAfterHours', value)} />
            <NumericRule label="50 % ylityötä / päivä" value={rules.dailyOvertime50Hours} disabled={!isAdmin} suffix="h" onChange={(value) => updateRule('dailyOvertime50Hours', value)} />
            <NumericRule label="Automaattinen tauko jälkeen" value={rules.automaticBreakAfterMinutes} disabled={!isAdmin} suffix="min" step={15} onChange={(value) => updateRule('automaticBreakAfterMinutes', value)} />
            <NumericRule label="Automaattisen tauon pituus" value={rules.automaticBreakMinutes} disabled={!isAdmin} suffix="min" step={5} onChange={(value) => updateRule('automaticBreakMinutes', value)} />
            <NumericRule label="Kuukausipalkan jakaja" value={rules.monthlySalaryHourDivisor} disabled={!isAdmin} step={0.5} onChange={(value) => updateRule('monthlySalaryHourDivisor', value)} />
            <NumericRule label="Sunnuntaikerroin" value={rules.sundayMultiplier} disabled={!isAdmin} step={0.1} onChange={(value) => updateRule('sundayMultiplier', value)} />
            <NumericRule label="Keskimääräinen enimmäistyöaika" value={rules.maximumAverageWeeklyHours} disabled={!isAdmin} suffix="h/vko" onChange={(value) => updateRule('maximumAverageWeeklyHours', value)} />
            <ClockRule label="Iltatyö alkaa" value={rules.eveningStartTime} disabled={!isAdmin} onChange={(value) => updateRule('eveningStartTime', value)} />
            <ClockRule label="Iltatyö päättyy" value={rules.eveningEndTime} disabled={!isAdmin} onChange={(value) => updateRule('eveningEndTime', value)} />
            <ClockRule label="Yötyö alkaa" value={rules.nightStartTime} disabled={!isAdmin} onChange={(value) => updateRule('nightStartTime', value)} />
            <ClockRule label="Yötyö päättyy" value={rules.nightEndTime} disabled={!isAdmin} onChange={(value) => updateRule('nightEndTime', value)} />
            <div className="space-y-2"><Label>Pyöristys</Label><Select value={String(rules.roundingMinutes)} disabled={!isAdmin} onValueChange={(value) => updateRule('roundingMinutes', Number(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1,5,10,15,30,60].map((value) => <SelectItem key={value} value={String(value)}>{value} min</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Pyöristyssuunta</Label><Select value={rules.roundingMode} disabled={!isAdmin} onValueChange={(value) => updateRule('roundingMode', value as OrganizationTimeRules['roundingMode'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nearest">Lähimpään</SelectItem><SelectItem value="floor">Alaspäin</SelectItem><SelectItem value="ceil">Ylöspäin</SelectItem></SelectContent></Select></div>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900">Ilta- ja yötyön kellonajat ovat organisaation sääntöjä. Tarkista ennen käyttöönottoa, että rajat ja työntekijäkohtaiset euromääräiset lisät vastaavat sovellettavaa työehtosopimusta.</div>
          <div><h3 className="font-semibold">Vuoden 2026 matkakorvausten oletukset</h3><p className="mt-1 text-xs text-slate-500">0,55 €/km · osapäiväraha 25 € · kokopäiväraha 54 € · ateriakorvaus 13,50 €. Arvot ovat muokattavia.</p></div>
          {isAdmin && <div className="flex justify-end"><Button className="gap-2" onClick={() => void persistRules()} disabled={savingRules}>{savingRules ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Tallenna säännöt</Button></div>}
        </CardContent>
      </Card>}

      <Card>
        <CardHeader className="border-b"><CardTitle className="text-lg">Lukitut palkkakaudet</CardTitle></CardHeader>
        <CardContent className="p-0">
          {periods.map((period) => <div key={period.id} className="grid gap-3 border-b px-5 py-4 md:grid-cols-[1fr_120px_140px_180px] md:items-center"><div><p className="font-semibold">{dateLabel(period.periodStart)}–{dateLabel(period.periodEnd)}</p><p className="mt-1 text-xs text-slate-500">{period.notes || 'Ei muistiinpanoa'} · {dateTimeLabel(period.lockedAt)}</p></div><Badge className="w-fit border-0 bg-slate-100 text-slate-700">{period.status}</Badge><p className="font-mono text-sm">{period.employeeCount} työntekijää</p><p className="font-mono font-semibold md:text-right">{euro(period.estimatedTotalCents)}</p></div>)}
          {periods.length === 0 && <div className="p-10 text-center text-sm text-slate-500">Palkkakausia ei ole vielä lukittu.</div>}
        </CardContent>
      </Card>

      <AlertDialog open={confirmLock} onOpenChange={setConfirmLock}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Lukitaanko palkkakausi?</AlertDialogTitle><AlertDialogDescription>Kaudesta {dateLabel(periodStart)}–{dateLabel(periodEnd)} muodostetaan muuttumaton laskentasnapshot. Lukittuja kirjauksia ei voi muokata tai poistaa.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction onClick={() => void lockPeriod()} disabled={locking}>{locking ? 'Lukitaan…' : 'Lukitse palkkakausi'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
