import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BadgeEuro,
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

interface EmployeeSummary {
  key: string;
  employeeName: string;
  entryCount: number;
  totalMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  eveningMinutes: number;
  nightMinutes: number;
  saturdayMinutes: number;
  sundayMinutes: number;
  variablePayCents: number;
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

function summarize(lines: PayrollPreviewLine[]): EmployeeSummary[] {
  const map = new Map<string, EmployeeSummary>();
  for (const line of lines) {
    const key = line.employeeId ?? `unresolved:${line.employeeName}`;
    const current = map.get(key) ?? {
      key,
      employeeName: line.employeeName,
      entryCount: 0,
      totalMinutes: 0,
      regularMinutes: 0,
      overtimeMinutes: 0,
      eveningMinutes: 0,
      nightMinutes: 0,
      saturdayMinutes: 0,
      sundayMinutes: 0,
      variablePayCents: 0,
      estimatedTotalCents: 0,
      blockers: [],
      warnings: [],
    };
    current.entryCount += 1;
    current.totalMinutes += line.totalMinutes;
    current.regularMinutes += line.regularMinutes;
    current.overtimeMinutes += line.overtime50Minutes + line.overtime100Minutes + line.weeklyOvertime50Minutes;
    current.eveningMinutes += line.eveningMinutes;
    current.nightMinutes += line.nightMinutes;
    current.saturdayMinutes += line.saturdayMinutes;
    current.sundayMinutes += line.sundayMinutes;
    current.variablePayCents += line.variablePayCents;
    current.estimatedTotalCents += line.lineTotalCents;
    current.blockers = [...new Set([...current.blockers, ...line.blockers])];
    current.warnings = [...new Set([...current.warnings, ...line.warnings])];
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'fi'));
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
  const summaries = useMemo(() => summarize(lines), [lines]);
  const blockerCount = summaries.reduce((sum, item) => sum + item.blockers.length, 0);
  const totals = useMemo(() => summaries.reduce((acc, item) => ({
    minutes: acc.minutes + item.totalMinutes,
    overtime: acc.overtime + item.overtimeMinutes,
    evening: acc.evening + item.eveningMinutes,
    night: acc.night + item.nightMinutes,
    amount: acc.amount + item.estimatedTotalCents,
  }), { minutes: 0, overtime: 0, evening: 0, night: 0, amount: 0 }), [summaries]);

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
      setSuccess('Työaikasäännöt tallennettiin. Palkka-aineisto lasketaan uusilla säännöillä.');
      await calculate();
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
      setSuccess('Palkkakausi lukittiin ja laskentarivit tallennettiin muuttumattomaksi snapshotiksi.');
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
          <p className="mt-1 max-w-3xl text-body-sm text-text-secondary">Kellonaikapohjainen työajan luokittelu, ilta- ja yölisät, ylityöt sekä palkkakauden lukitus.</p>
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
        <div className="space-y-2"><Label>Lukituksen muistiinpano</Label><Input value={notes} maxLength={500} onChange={(event) => setNotes(event.target.value)} placeholder="Esim. heinäkuun palkka-aineisto" /></div>
        <Button variant="outline" onClick={() => void calculate()} disabled={calculating}>Päivitä</Button>
      </CardContent></Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: 'Työntekijöitä', value: summaries.length, icon: UsersRound },
          { label: 'Työaika', value: hours(totals.minutes), icon: Clock3 },
          { label: 'Ylityö', value: hours(totals.overtime), icon: BadgeEuro },
          { label: 'Ilta / yö', value: `${hours(totals.evening)} / ${hours(totals.night)}`, icon: Moon },
          { label: 'Arvio yhteensä', value: euro(totals.amount), icon: BadgeEuro },
        ].map((item) => <Card key={item.label}><CardContent className="p-4"><div className="mb-2 flex items-center justify-between text-xs text-text-secondary"><span>{item.label}</span><item.icon size={17} className="text-primary" /></div><p className="font-mono text-xl font-bold">{item.value}</p></CardContent></Card>)}
      </div>

      {rules && <Card>
        <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-lg">Työaika- ja lisäsäännöt</CardTitle>{isAdmin && <Button size="sm" className="gap-2" onClick={() => void persistRules()} disabled={savingRules}>{savingRules ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Tallenna säännöt</Button>}</CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <NumericRule label="Sopimustunnit / päivä" value={rules.contractualDailyHours} disabled={!isAdmin} suffix="h" onChange={(value) => updateRule('contractualDailyHours', value)} />
          <NumericRule label="Sopimustunnit / viikko" value={rules.contractualWeeklyHours} disabled={!isAdmin} suffix="h" onChange={(value) => updateRule('contractualWeeklyHours', value)} />
          <NumericRule label="Vuorokautinen ylityöraja" value={rules.statutoryDailyOvertimeAfterHours} disabled={!isAdmin} suffix="h" onChange={(value) => updateRule('statutoryDailyOvertimeAfterHours', value)} />
          <NumericRule label="Viikoittainen ylityöraja" value={rules.statutoryWeeklyOvertimeAfterHours} disabled={!isAdmin} suffix="h" onChange={(value) => updateRule('statutoryWeeklyOvertimeAfterHours', value)} />
          <NumericRule label="Automaattinen tauko alkaa" value={rules.automaticBreakAfterMinutes} disabled={!isAdmin} suffix="min" step={1} onChange={(value) => updateRule('automaticBreakAfterMinutes', value)} />
          <NumericRule label="Automaattinen tauko" value={rules.automaticBreakMinutes} disabled={!isAdmin} suffix="min" step={1} onChange={(value) => updateRule('automaticBreakMinutes', value)} />
          <div className="space-y-2"><Label>Ilta-aika</Label><div className="grid grid-cols-2 gap-2"><Input type="time" value={rules.eveningStartTime} disabled={!isAdmin} onChange={(event) => updateRule('eveningStartTime', event.target.value)} /><Input type="time" value={rules.eveningEndTime} disabled={!isAdmin} onChange={(event) => updateRule('eveningEndTime', event.target.value)} /></div></div>
          <div className="space-y-2"><Label>Yöaika</Label><div className="grid grid-cols-2 gap-2"><Input type="time" value={rules.nightStartTime} disabled={!isAdmin} onChange={(event) => updateRule('nightStartTime', event.target.value)} /><Input type="time" value={rules.nightEndTime} disabled={!isAdmin} onChange={(event) => updateRule('nightEndTime', event.target.value)} /></div></div>
          <div className="space-y-2"><Label>Pyöristys</Label><Select value={rules.roundingMode} disabled={!isAdmin} onValueChange={(value) => updateRule('roundingMode', value as OrganizationTimeRules['roundingMode'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nearest">Lähimpään</SelectItem><SelectItem value="floor">Alaspäin</SelectItem><SelectItem value="ceil">Ylöspäin</SelectItem></SelectContent></Select></div>
          <NumericRule label="Pyöristysväli" value={rules.roundingMinutes} disabled={!isAdmin} suffix="min" step={1} onChange={(value) => updateRule('roundingMinutes', value)} />
          <NumericRule label="Kuukausipalkan tuntijakaja" value={rules.monthlySalaryHourDivisor} disabled={!isAdmin} suffix="h" onChange={(value) => updateRule('monthlySalaryHourDivisor', value)} />
          <NumericRule label="Sunnuntaikerroin" value={rules.sundayMultiplier} disabled={!isAdmin} suffix="×" onChange={(value) => updateRule('sundayMultiplier', value)} />
        </CardContent>
      </Card>}

      <Card>
        <CardHeader><CardTitle className="text-lg">Työntekijäkohtainen yhteenveto</CardTitle></CardHeader>
        <CardContent className="p-0">
          {summaries.map((item) => <div key={item.key} className="border-t p-5 first:border-t-0">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><h3 className="font-semibold">{item.employeeName}</h3><p className="text-xs text-text-secondary">{item.entryCount} hyväksyttyä kirjausta</p></div><div className="flex flex-wrap gap-2"><Badge variant="outline">Työ {hours(item.totalMinutes)}</Badge><Badge variant="outline">Ylityö {hours(item.overtimeMinutes)}</Badge><Badge className="border-0 bg-amber-50 text-amber-800"><SunMedium size={12} className="mr-1" />Ilta {hours(item.eveningMinutes)}</Badge><Badge className="border-0 bg-indigo-50 text-indigo-800"><Moon size={12} className="mr-1" />Yö {hours(item.nightMinutes)}</Badge><Badge className="border-0 bg-emerald-50 text-emerald-800">{euro(item.estimatedTotalCents)}</Badge></div></div>
            {item.blockers.length > 0 && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><strong>Estää lukituksen:</strong> {item.blockers.join(' · ')}</div>}
            {item.warnings.length > 0 && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{item.warnings.join(' · ')}</div>}
          </div>)}
          {summaries.length === 0 && <div className="p-10 text-center text-sm text-text-secondary">Valitulla kaudella ei ole hyväksyttyjä tuntikirjauksia.</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Laskentarivit</CardTitle></CardHeader>
        <CardContent className="p-0">
          {lines.slice(0, 100).map((line) => <div key={line.timeEntryId} className="grid gap-2 border-t px-5 py-4 text-sm first:border-t-0 lg:grid-cols-[110px_1fr_1fr_150px_150px_120px] lg:items-center">
            <span>{dateLabel(line.workDate)}</span><div><p className="font-medium">{line.employeeName}</p><p className="text-xs text-text-secondary">{line.projectName}</p></div><div><p>{line.startTime && line.endTime ? `${line.startTime}–${line.endTime}` : 'Kellonaika puuttuu'}</p><p className="text-xs text-text-secondary">Tauko {line.breakMinutes} min · {line.breakSource || 'ei lähdettä'}</p></div><span>Ilta {hours(line.eveningMinutes)}<br />Yö {hours(line.nightMinutes)}</span><span>50/100 % {hours(line.overtime50Minutes)} / {hours(line.overtime100Minutes)}</span><span className="font-mono font-semibold">{euro(line.lineTotalCents)}</span>
          </div>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Lukitut palkkakaudet</CardTitle></CardHeader>
        <CardContent className="p-0">{periods.map((period) => <div key={period.id} className="grid gap-2 border-t px-5 py-4 text-sm first:border-t-0 md:grid-cols-[1fr_120px_150px_180px] md:items-center"><div><p className="font-medium">{dateLabel(period.periodStart)}–{dateLabel(period.periodEnd)}</p><p className="text-xs text-text-secondary">{period.notes || 'Ei muistiinpanoa'}</p></div><Badge className="w-fit border-0 bg-slate-100 text-slate-700">{period.status}</Badge><span>{period.employeeCount} työntekijää<br />{euro(period.estimatedTotalCents)}</span><span className="text-text-secondary">Lukittu {dateTimeLabel(period.lockedAt)}</span></div>)}{periods.length === 0 && <div className="p-8 text-center text-sm text-text-secondary">Lukittuja palkkakausia ei ole.</div>}</CardContent>
      </Card>

      <AlertDialog open={confirmLock} onOpenChange={setConfirmLock}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Lukitaanko palkkakausi?</AlertDialogTitle><AlertDialogDescription>Lukitus tallentaa laskentarivit muuttumattomaksi aineistoksi ja estää kauden hyväksyttyjen tuntikirjausten muuttamisen. Toimintoa ei voi perua tässä vaiheessa.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction onClick={() => void lockPeriod()} disabled={locking}>{locking ? 'Lukitaan…' : 'Lukitse palkkakausi'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
