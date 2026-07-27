import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BadgeEuro,
  Car,
  CheckCircle2,
  Clock3,
  FileLock2,
  Loader2,
  Moon,
  RefreshCw,
  Save,
  SunMedium,
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
import {
  listPayrollTravelPreview,
  type PayrollTravelPreviewLine,
} from '@/lib/supabase/payrollTravel';

interface EmployeePayrollSummary {
  key: string;
  employeeName: string;
  timeEntryCount: number;
  travelExpenseCount: number;
  totalMinutes: number;
  overtimeMinutes: number;
  eveningMinutes: number;
  nightMinutes: number;
  fixedMonthlySalaryCents: number;
  timePayCents: number;
  travelExpenseCents: number;
  estimatedTotalCents: number;
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

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function employeeKey(employeeId: string | undefined, employeeName: string) {
  return employeeId ?? `unresolved:${employeeName.toLocaleLowerCase('fi')}`;
}

function summarize(
  timeLines: PayrollPreviewLine[],
  travelLines: PayrollTravelPreviewLine[],
  includeMonthlySalary: boolean,
): EmployeePayrollSummary[] {
  const summaries = new Map<string, EmployeePayrollSummary>();
  const getSummary = (key: string, employeeName: string) => {
    const current = summaries.get(key);
    if (current) return current;
    const created: EmployeePayrollSummary = {
      key,
      employeeName,
      timeEntryCount: 0,
      travelExpenseCount: 0,
      totalMinutes: 0,
      overtimeMinutes: 0,
      eveningMinutes: 0,
      nightMinutes: 0,
      fixedMonthlySalaryCents: 0,
      timePayCents: 0,
      travelExpenseCents: 0,
      estimatedTotalCents: 0,
      blockers: [],
      warnings: [],
    };
    summaries.set(key, created);
    return created;
  };

  for (const line of timeLines) {
    const summary = getSummary(employeeKey(line.employeeId, line.employeeName), line.employeeName);
    summary.timeEntryCount += 1;
    summary.totalMinutes += line.totalMinutes;
    summary.overtimeMinutes += line.overtime50Minutes + line.overtime100Minutes + line.weeklyOvertime50Minutes;
    summary.eveningMinutes += line.eveningMinutes;
    summary.nightMinutes += line.nightMinutes;
    summary.timePayCents += line.lineTotalCents;
    if (includeMonthlySalary && line.payType === 'Kuukausipalkka') {
      summary.fixedMonthlySalaryCents = Math.max(summary.fixedMonthlySalaryCents, line.monthlySalaryCents ?? 0);
    }
    summary.blockers = unique([...summary.blockers, ...line.blockers]);
    summary.warnings = unique([...summary.warnings, ...line.warnings]);
  }

  for (const line of travelLines) {
    const summary = getSummary(employeeKey(line.employeeId, line.employeeName), line.employeeName);
    summary.travelExpenseCount += 1;
    summary.travelExpenseCents += line.amountCents;
    summary.blockers = unique([...summary.blockers, ...line.blockers]);
    summary.warnings = unique([...summary.warnings, ...line.warnings]);
  }

  for (const summary of summaries.values()) {
    summary.estimatedTotalCents = summary.fixedMonthlySalaryCents
      + summary.timePayCents
      + summary.travelExpenseCents;
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

export default function PalkkaAineistoV3() {
  const { user } = useAuth();
  const { currentOrg, currentRole } = useOrganization();
  const initialRange = useMemo(() => monthRange(), []);
  const [periodStart, setPeriodStart] = useState(initialRange.start);
  const [periodEnd, setPeriodEnd] = useState(initialRange.end);
  const [notes, setNotes] = useState('');
  const [rules, setRules] = useState<OrganizationTimeRules | null>(null);
  const [timeLines, setTimeLines] = useState<PayrollPreviewLine[]>([]);
  const [travelLines, setTravelLines] = useState<PayrollTravelPreviewLine[]>([]);
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
    () => summarize(timeLines, travelLines, isFullMonth(periodStart, periodEnd)),
    [periodEnd, periodStart, timeLines, travelLines],
  );
  const blockers = useMemo(() => unique(summaries.flatMap((summary) => summary.blockers)), [summaries]);
  const totals = useMemo(() => summaries.reduce((result, summary) => ({
    employees: result.employees + 1,
    minutes: result.minutes + summary.totalMinutes,
    overtime: result.overtime + summary.overtimeMinutes,
    evening: result.evening + summary.eveningMinutes,
    night: result.night + summary.nightMinutes,
    travelCount: result.travelCount + summary.travelExpenseCount,
    travelCents: result.travelCents + summary.travelExpenseCents,
    amount: result.amount + summary.estimatedTotalCents,
  }), { employees: 0, minutes: 0, overtime: 0, evening: 0, night: 0, travelCount: 0, travelCents: 0, amount: 0 }), [summaries]);

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
      const [nextTimeLines, nextTravelLines] = await Promise.all([
        listPayrollPreview(currentOrg.id, periodStart, periodEnd),
        listPayrollTravelPreview(currentOrg.id, periodStart, periodEnd),
      ]);
      setTimeLines(nextTimeLines);
      setTravelLines(nextTravelLines);
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
      setSuccess('Työaika- ja matkakorvaussäännöt tallennettiin. Laske aineisto uudelleen.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sääntöjen tallennus epäonnistui.');
    } finally {
      setSavingRules(false);
    }
  };

  const lockPeriod = async () => {
    if (!currentOrg || !isAdmin || blockers.length > 0 || timeLines.length + travelLines.length === 0) return;
    setLocking(true);
    setError(null);
    try {
      await lockPayrollPeriod({ organizationId: currentOrg.id, periodStart, periodEnd, notes });
      setPeriods(await listPayrollPeriods(currentOrg.id));
      setSuccess(`Palkkakausi lukittiin. Snapshotiin tallennettiin ${timeLines.length} tuntiriviä ja ${travelLines.length} matkakuluriviä.`);
      setNotes('');
      await calculate();
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
          <p className="mt-1 max-w-3xl text-body-sm text-text-secondary">Hyväksyttyjen tuntien, lisien ja matkakulujen palvelinlaskenta sekä muuttumaton palkkakausisnapshot.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => void calculate()} disabled={calculating}>
            {calculating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Laske uudelleen
          </Button>
          {isAdmin && <Button className="gap-2" disabled={timeLines.length + travelLines.length === 0 || blockers.length > 0 || locking} onClick={() => setConfirmLock(true)}><FileLock2 size={16} /> Lukitse palkkakausi</Button>}
        </div>
      </div>

      {error && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertTriangle size={18} className="shrink-0" />{error}</div>}
      {success && <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={18} className="shrink-0" />{success}</div>}
      {blockers.length > 0 && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><strong>Lukitus estetty:</strong> {blockers.join(' · ')}</div>}

      <Card><CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-[1fr_1fr_2fr_auto] xl:items-end">
        <div className="space-y-2"><Label>Kauden alku</Label><Input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></div>
        <div className="space-y-2"><Label>Kauden loppu</Label><Input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></div>
        <div className="space-y-2"><Label>Lukituksen muistiinpano</Label><Input value={notes} maxLength={500} onChange={(event) => setNotes(event.target.value)} placeholder="Esim. heinäkuun palkka-aineisto" /></div>
        <Button variant="outline" onClick={() => void calculate()} disabled={calculating}>Päivitä</Button>
      </CardContent></Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {[
          { label: 'Työntekijöitä', value: totals.employees, icon: UsersRound },
          { label: 'Työaika', value: hours(totals.minutes), icon: Clock3 },
          { label: 'Ylityö', value: hours(totals.overtime), icon: BadgeEuro },
          { label: 'Ilta / yö', value: `${hours(totals.evening)} / ${hours(totals.night)}`, icon: Moon },
          { label: 'Matkakulut', value: `${totals.travelCount} · ${euro(totals.travelCents)}`, icon: Car },
          { label: 'Arvio yhteensä', value: euro(totals.amount), icon: BadgeEuro },
        ].map((item) => <Card key={item.label}><CardContent className="p-4"><div className="mb-2 flex items-center justify-between text-xs text-text-secondary"><span>{item.label}</span><item.icon size={17} className="text-primary" /></div><p className="font-mono text-xl font-bold">{item.value}</p></CardContent></Card>)}
      </div>

      {rules && <Card>
        <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-lg">Työaika- ja korvaussäännöt</CardTitle>{isAdmin && <Button size="sm" className="gap-2" onClick={() => void persistRules()} disabled={savingRules}>{savingRules ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Tallenna säännöt</Button>}</CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <NumericRule label="Sopimustunnit / päivä" value={rules.contractualDailyHours} disabled={!isAdmin} suffix="h" onChange={(value) => updateRule('contractualDailyHours', value)} />
          <NumericRule label="Sopimustunnit / viikko" value={rules.contractualWeeklyHours} disabled={!isAdmin} suffix="h" onChange={(value) => updateRule('contractualWeeklyHours', value)} />
          <NumericRule label="Vuorokautinen ylityöraja" value={rules.statutoryDailyOvertimeAfterHours} disabled={!isAdmin} suffix="h" onChange={(value) => updateRule('statutoryDailyOvertimeAfterHours', value)} />
          <NumericRule label="Viikoittainen ylityöraja" value={rules.statutoryWeeklyOvertimeAfterHours} disabled={!isAdmin} suffix="h" onChange={(value) => updateRule('statutoryWeeklyOvertimeAfterHours', value)} />
          <NumericRule label="Automaattinen tauko alkaa" value={rules.automaticBreakAfterMinutes} disabled={!isAdmin} suffix="min" step={1} onChange={(value) => updateRule('automaticBreakAfterMinutes', value)} />
          <NumericRule label="Automaattinen tauko" value={rules.automaticBreakMinutes} disabled={!isAdmin} suffix="min" step={1} onChange={(value) => updateRule('automaticBreakMinutes', value)} />
          <NumericRule label="Kilometrikorvaus" value={rules.kilometerAllowanceCentsPerKm} disabled={!isAdmin} suffix="snt/km" step={1} onChange={(value) => updateRule('kilometerAllowanceCentsPerKm', value)} />
          <NumericRule label="Osapäiväraha" value={rules.partialDailyAllowanceCents} disabled={!isAdmin} suffix="snt" step={1} onChange={(value) => updateRule('partialDailyAllowanceCents', value)} />
          <NumericRule label="Kokopäiväraha" value={rules.fullDailyAllowanceCents} disabled={!isAdmin} suffix="snt" step={1} onChange={(value) => updateRule('fullDailyAllowanceCents', value)} />
          <NumericRule label="Ateriakorvaus" value={rules.mealAllowanceCents} disabled={!isAdmin} suffix="snt" step={1} onChange={(value) => updateRule('mealAllowanceCents', value)} />
          <div className="space-y-2"><Label>Ilta-aika</Label><div className="grid grid-cols-2 gap-2"><Input type="time" value={rules.eveningStartTime} disabled={!isAdmin} onChange={(event) => updateRule('eveningStartTime', event.target.value)} /><Input type="time" value={rules.eveningEndTime} disabled={!isAdmin} onChange={(event) => updateRule('eveningEndTime', event.target.value)} /></div></div>
          <div className="space-y-2"><Label>Yöaika</Label><div className="grid grid-cols-2 gap-2"><Input type="time" value={rules.nightStartTime} disabled={!isAdmin} onChange={(event) => updateRule('nightStartTime', event.target.value)} /><Input type="time" value={rules.nightEndTime} disabled={!isAdmin} onChange={(event) => updateRule('nightEndTime', event.target.value)} /></div></div>
          <div className="space-y-2"><Label>Pyöristys</Label><Select value={rules.roundingMode} disabled={!isAdmin} onValueChange={(value) => updateRule('roundingMode', value as OrganizationTimeRules['roundingMode'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nearest">Lähimpään</SelectItem><SelectItem value="floor">Alaspäin</SelectItem><SelectItem value="ceil">Ylöspäin</SelectItem></SelectContent></Select></div>
          <NumericRule label="Pyöristysväli" value={rules.roundingMinutes} disabled={!isAdmin} suffix="min" step={1} onChange={(value) => updateRule('roundingMinutes', value)} />
        </CardContent>
      </Card>}

      <Card>
        <CardHeader><CardTitle className="text-lg">Työntekijäkohtainen yhteenveto</CardTitle></CardHeader>
        <CardContent className="p-0">
          {summaries.map((item) => <div key={item.key} className="border-t p-5 first:border-t-0">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><h3 className="font-semibold">{item.employeeName}</h3><p className="text-xs text-text-secondary">{item.timeEntryCount} tuntikirjausta · {item.travelExpenseCount} matkakulua</p></div><div className="flex flex-wrap gap-2"><Badge variant="outline">Työ {hours(item.totalMinutes)}</Badge><Badge variant="outline">Ylityö {hours(item.overtimeMinutes)}</Badge><Badge className="border-0 bg-amber-50 text-amber-800"><SunMedium size={12} className="mr-1" />Ilta {hours(item.eveningMinutes)}</Badge><Badge className="border-0 bg-indigo-50 text-indigo-800"><Moon size={12} className="mr-1" />Yö {hours(item.nightMinutes)}</Badge><Badge className="border-0 bg-sky-50 text-sky-800"><Car size={12} className="mr-1" />{euro(item.travelExpenseCents)}</Badge><Badge className="border-0 bg-emerald-50 text-emerald-800">{euro(item.estimatedTotalCents)}</Badge></div></div>
            {item.blockers.length > 0 && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><strong>Estää lukituksen:</strong> {item.blockers.join(' · ')}</div>}
            {item.warnings.length > 0 && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{item.warnings.join(' · ')}</div>}
          </div>)}
          {summaries.length === 0 && <div className="p-10 text-center text-sm text-text-secondary">Valitulla kaudella ei ole hyväksyttyjä tuntikirjauksia tai matkakuluja.</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Tuntien laskentarivit</CardTitle></CardHeader>
        <CardContent className="p-0">
          {timeLines.slice(0, 100).map((line) => <div key={line.timeEntryId} className="grid gap-2 border-t px-5 py-4 text-sm first:border-t-0 lg:grid-cols-[110px_1fr_1fr_150px_150px_120px] lg:items-center">
            <span>{dateLabel(line.workDate)}</span><div><p className="font-medium">{line.employeeName}</p><p className="text-xs text-text-secondary">{line.projectName}</p></div><div><p>{line.startTime && line.endTime ? `${line.startTime}–${line.endTime}` : 'Kellonaika puuttuu'}</p><p className="text-xs text-text-secondary">Tauko {line.breakMinutes} min · {line.breakSource || 'ei lähdettä'}</p></div><span>Ilta {hours(line.eveningMinutes)}<br />Yö {hours(line.nightMinutes)}</span><span>50/100 % {hours(line.overtime50Minutes)} / {hours(line.overtime100Minutes)}</span><span className="font-mono font-semibold">{euro(line.lineTotalCents)}</span>
          </div>)}
          {timeLines.length === 0 && <div className="p-8 text-center text-sm text-text-secondary">Hyväksyttyjä tuntirivejä ei ole.</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Car size={19} className="text-primary" />Matkakulujen palkkarivit</CardTitle></CardHeader>
        <CardContent className="p-0">
          {travelLines.slice(0, 100).map((line) => <div key={line.travelExpenseId} className="grid gap-2 border-t px-5 py-4 text-sm first:border-t-0 lg:grid-cols-[110px_1fr_1fr_1fr_130px] lg:items-center">
            <span>{dateLabel(line.expenseDate)}</span><div><p className="font-medium">{line.employeeName}</p><p className="text-xs text-text-secondary">{line.projectName || 'Ei projektia'}</p></div><div><p className="font-medium">{line.expenseType}</p><p className="text-xs text-text-secondary">{line.description || 'Ei kuvausta'}</p></div><div>{line.blockers.length > 0 ? <span className="text-red-700">{line.blockers.join(' · ')}</span> : line.warnings.length > 0 ? <span className="text-amber-800">{line.warnings.join(' · ')}</span> : <span className="text-emerald-700">Valmis lukittavaksi</span>}</div><span className="font-mono font-semibold">{euro(line.amountCents)}</span>
          </div>)}
          {travelLines.length === 0 && <div className="p-8 text-center text-sm text-text-secondary">Hyväksyttyjä matkakuluja ei ole.</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Lukitut palkkakaudet</CardTitle></CardHeader>
        <CardContent className="p-0">{periods.map((period) => <div key={period.id} className="grid gap-2 border-t px-5 py-4 text-sm first:border-t-0 md:grid-cols-[1fr_120px_150px_180px] md:items-center"><div><p className="font-medium">{dateLabel(period.periodStart)}–{dateLabel(period.periodEnd)}</p><p className="text-xs text-text-secondary">{period.notes || 'Ei muistiinpanoa'}</p></div><Badge className="w-fit border-0 bg-slate-100 text-slate-700">{period.status}</Badge><span>{period.employeeCount} työntekijää<br />{euro(period.estimatedTotalCents)}</span><span className="text-text-secondary">Lukittu {dateTimeLabel(period.lockedAt)}</span></div>)}{periods.length === 0 && <div className="p-8 text-center text-sm text-text-secondary">Lukittuja palkkakausia ei ole.</div>}</CardContent>
      </Card>

      <AlertDialog open={confirmLock} onOpenChange={setConfirmLock}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Lukitaanko palkkakausi?</AlertDialogTitle><AlertDialogDescription>Lukitus tallentaa {timeLines.length} tuntiriviä ja {travelLines.length} matkakuluriviä muuttumattomaksi snapshotiksi. Kauden hyväksyttyjä kirjauksia ei voi tämän jälkeen muuttaa ilman erillistä korjausketjua.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction onClick={() => void lockPeriod()} disabled={locking}>{locking ? 'Lukitaan…' : 'Lukitse palkkakausi'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
