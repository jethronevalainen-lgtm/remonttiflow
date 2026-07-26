import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BadgeEuro,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CreditCard,
  Loader2,
  LockKeyhole,
  Save,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import {
  listAccessibleEmployeeCards,
  listSupervisorTeamMembers,
  saveEmployeeCompensation,
  saveEmployeeHrProfile,
  setSupervisorTeam,
  type EmployeeCard,
} from '@/lib/supabase/workforceHr';

interface HrForm {
  dateOfBirth: string;
  streetAddress: string;
  postalCode: string;
  city: string;
  country: string;
  personalIdentityCodeLast4: string;
  iban: string;
  bic: string;
  taxPercent: string;
  additionalTaxPercent: string;
  taxIncomeLimit: string;
  taxCardValidFrom: string;
  taxCardValidTo: string;
  unionName: string;
  occupationalHealthProvider: string;
  employmentNotes: string;
  payrollNotes: string;
}

interface CompensationForm {
  id: string;
  validFrom: string;
  validTo: string;
  payType: 'Kuukausipalkka' | 'Tuntipalkka';
  monthlySalary: string;
  hourlyWage: string;
  weeklyHours: string;
  collectiveAgreement: string;
  payPeriod: string;
  eveningAllowance: string;
  nightAllowance: string;
  saturdayAllowance: string;
  sundayAllowance: string;
  overtime50Multiplier: string;
  overtime100Multiplier: string;
  dailyAllowance: string;
  mealAllowance: string;
  travelTimeHourly: string;
  notes: string;
}

const EMPTY_HR: HrForm = {
  dateOfBirth: '',
  streetAddress: '',
  postalCode: '',
  city: '',
  country: 'Suomi',
  personalIdentityCodeLast4: '',
  iban: '',
  bic: '',
  taxPercent: '',
  additionalTaxPercent: '',
  taxIncomeLimit: '',
  taxCardValidFrom: '',
  taxCardValidTo: '',
  unionName: '',
  occupationalHealthProvider: '',
  employmentNotes: '',
  payrollNotes: '',
};

const EMPTY_COMPENSATION: CompensationForm = {
  id: '',
  validFrom: new Date().toISOString().slice(0, 10),
  validTo: '',
  payType: 'Kuukausipalkka',
  monthlySalary: '',
  hourlyWage: '',
  weeklyHours: '37,5',
  collectiveAgreement: '',
  payPeriod: 'Kuukausi',
  eveningAllowance: '0',
  nightAllowance: '0',
  saturdayAllowance: '0',
  sundayAllowance: '0',
  overtime50Multiplier: '1,5',
  overtime100Multiplier: '2',
  dailyAllowance: '0',
  mealAllowance: '0',
  travelTimeHourly: '0',
  notes: '',
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function euroFromCents(value?: number) {
  if (value == null) return 'Ei määritetty';
  return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(value / 100);
}

function decimal(value: string, fallback?: number): number | undefined {
  if (!value.trim()) return fallback;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function cents(value: string, fallback?: number): number | undefined {
  const parsed = decimal(value);
  return parsed == null ? fallback : Math.round(parsed * 100);
}

function euros(value?: number) {
  return value == null ? '' : String(value / 100).replace('.', ',');
}

function dateLabel(value?: string) {
  if (!value) return 'Ei määritetty';
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs leading-5 text-slate-500">{hint}</p>}
    </div>
  );
}

export default function Henkilokortit() {
  const { user } = useAuth();
  const { currentOrg, currentRole } = useOrganization();
  const { employees } = useAppDataContext();
  const { people } = useRoleWorkspace();
  const [cards, setCards] = useState<EmployeeCard[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hrForm, setHrForm] = useState<HrForm>(EMPTY_HR);
  const [compensationForm, setCompensationForm] = useState<CompensationForm>(EMPTY_COMPENSATION);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');
  const [assignedEmployeeIds, setAssignedEmployeeIds] = useState<Set<string>>(new Set());
  const [teamAssignments, setTeamAssignments] = useState<Array<{ supervisorUserId: string; employeeId: string }>>([]);

  const isAdmin = currentRole === 'admin';
  const supervisors = people.filter((person) => person.role === 'supervisor');
  const selectedCard = cards.find((card) => card.employeeId === selectedEmployeeId) ?? cards[0];

  const load = async () => {
    if (!currentOrg) return;
    setLoading(true);
    setError(null);
    try {
      const [nextCards, assignments] = await Promise.all([
        listAccessibleEmployeeCards(currentOrg.id),
        isAdmin ? listSupervisorTeamMembers(currentOrg.id) : Promise.resolve([]),
      ]);
      setCards(nextCards);
      setTeamAssignments(assignments);
      setSelectedEmployeeId((current) => (
        nextCards.some((card) => card.employeeId === current) ? current : nextCards[0]?.employeeId ?? ''
      ));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Henkilötietojen haku epäonnistui.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [currentOrg?.id, currentRole]);

  useEffect(() => {
    if (!selectedCard) {
      setHrForm(EMPTY_HR);
      setCompensationForm(EMPTY_COMPENSATION);
      return;
    }
    setHrForm({
      dateOfBirth: selectedCard.dateOfBirth ?? '',
      streetAddress: selectedCard.streetAddress ?? '',
      postalCode: selectedCard.postalCode ?? '',
      city: selectedCard.city ?? '',
      country: selectedCard.country ?? 'Suomi',
      personalIdentityCodeLast4: selectedCard.personalIdentityCodeLast4 ?? '',
      iban: selectedCard.iban ?? '',
      bic: selectedCard.bic ?? '',
      taxPercent: selectedCard.taxPercent == null ? '' : String(selectedCard.taxPercent).replace('.', ','),
      additionalTaxPercent: selectedCard.additionalTaxPercent == null ? '' : String(selectedCard.additionalTaxPercent).replace('.', ','),
      taxIncomeLimit: euros(selectedCard.taxIncomeLimitCents),
      taxCardValidFrom: selectedCard.taxCardValidFrom ?? '',
      taxCardValidTo: selectedCard.taxCardValidTo ?? '',
      unionName: selectedCard.unionName ?? '',
      occupationalHealthProvider: selectedCard.occupationalHealthProvider ?? '',
      employmentNotes: selectedCard.employmentNotes ?? '',
      payrollNotes: selectedCard.payrollNotes ?? '',
    });
    setCompensationForm({
      id: selectedCard.compensationId ?? '',
      validFrom: selectedCard.compensationValidFrom ?? new Date().toISOString().slice(0, 10),
      validTo: selectedCard.compensationValidTo ?? '',
      payType: selectedCard.payType ?? 'Kuukausipalkka',
      monthlySalary: euros(selectedCard.monthlySalaryCents),
      hourlyWage: euros(selectedCard.hourlyWageCents),
      weeklyHours: String(selectedCard.weeklyHours ?? 37.5).replace('.', ','),
      collectiveAgreement: selectedCard.collectiveAgreement ?? '',
      payPeriod: selectedCard.payPeriod ?? 'Kuukausi',
      eveningAllowance: euros(selectedCard.eveningAllowanceCents ?? 0),
      nightAllowance: euros(selectedCard.nightAllowanceCents ?? 0),
      saturdayAllowance: euros(selectedCard.saturdayAllowanceCents ?? 0),
      sundayAllowance: euros(selectedCard.sundayAllowanceCents ?? 0),
      overtime50Multiplier: String(selectedCard.overtime50Multiplier ?? 1.5).replace('.', ','),
      overtime100Multiplier: String(selectedCard.overtime100Multiplier ?? 2).replace('.', ','),
      dailyAllowance: euros(selectedCard.dailyAllowanceCents ?? 0),
      mealAllowance: euros(selectedCard.mealAllowanceCents ?? 0),
      travelTimeHourly: euros(selectedCard.travelTimeHourlyCents ?? 0),
      notes: selectedCard.compensationNotes ?? '',
    });
  }, [selectedCard?.employeeId, selectedCard?.compensationId]);

  useEffect(() => {
    if (!selectedSupervisorId) {
      setAssignedEmployeeIds(new Set());
      return;
    }
    setAssignedEmployeeIds(new Set(
      teamAssignments
        .filter((item) => item.supervisorUserId === selectedSupervisorId)
        .map((item) => item.employeeId),
    ));
  }, [selectedSupervisorId, teamAssignments]);

  const filteredCards = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fi');
    if (!query) return cards;
    return cards.filter((card) => [
      card.employeeName,
      card.employeeRole,
      card.department,
      card.email,
      ...card.supervisorNames,
    ].some((value) => value.toLocaleLowerCase('fi').includes(query)));
  }, [cards, search]);

  const saveHr = async () => {
    if (!currentOrg || !user || !selectedCard || !isAdmin) return;
    const taxPercent = decimal(hrForm.taxPercent);
    const additionalTaxPercent = decimal(hrForm.additionalTaxPercent);
    if ((taxPercent != null && (taxPercent < 0 || taxPercent > 100))
      || (additionalTaxPercent != null && (additionalTaxPercent < 0 || additionalTaxPercent > 100))) {
      setError('Veroprosentin pitää olla 0–100.');
      return;
    }
    if (hrForm.personalIdentityCodeLast4 && hrForm.personalIdentityCodeLast4.length !== 4) {
      setError('Henkilötunnuksesta tallennetaan turvallisuussyistä vain neljä viimeistä merkkiä.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await saveEmployeeHrProfile({
        organizationId: currentOrg.id,
        employeeId: selectedCard.employeeId,
        userId: user.id,
        input: {
          ...hrForm,
          taxPercent,
          additionalTaxPercent,
          taxIncomeLimitCents: cents(hrForm.taxIncomeLimit),
        },
      });
      await load();
      setSuccess('HR-, pankki- ja verotiedot tallennettiin.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'HR-tietojen tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const saveCompensation = async () => {
    if (!currentOrg || !user || !selectedCard || !isAdmin) return;
    const monthlySalaryCents = cents(compensationForm.monthlySalary);
    const hourlyWageCents = cents(compensationForm.hourlyWage);
    const weeklyHours = decimal(compensationForm.weeklyHours);
    const overtime50Multiplier = decimal(compensationForm.overtime50Multiplier);
    const overtime100Multiplier = decimal(compensationForm.overtime100Multiplier);
    if (!compensationForm.validFrom) {
      setError('Palkkaehtojen alkupäivä on pakollinen.');
      return;
    }
    if (compensationForm.payType === 'Kuukausipalkka' && monthlySalaryCents == null) {
      setError('Anna kuukausipalkka.');
      return;
    }
    if (compensationForm.payType === 'Tuntipalkka' && hourlyWageCents == null) {
      setError('Anna tuntipalkka.');
      return;
    }
    if (weeklyHours == null || weeklyHours <= 0 || overtime50Multiplier == null || overtime100Multiplier == null) {
      setError('Tarkista viikkotunnit ja ylityökertoimet.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await saveEmployeeCompensation({
        organizationId: currentOrg.id,
        employeeId: selectedCard.employeeId,
        userId: user.id,
        input: {
          id: compensationForm.id || undefined,
          validFrom: compensationForm.validFrom,
          validTo: compensationForm.validTo || undefined,
          payType: compensationForm.payType,
          monthlySalaryCents,
          hourlyWageCents,
          weeklyHours,
          collectiveAgreement: compensationForm.collectiveAgreement,
          payPeriod: compensationForm.payPeriod,
          eveningAllowanceCents: cents(compensationForm.eveningAllowance, 0) ?? 0,
          nightAllowanceCents: cents(compensationForm.nightAllowance, 0) ?? 0,
          saturdayAllowanceCents: cents(compensationForm.saturdayAllowance, 0) ?? 0,
          sundayAllowanceCents: cents(compensationForm.sundayAllowance, 0) ?? 0,
          overtime50Multiplier,
          overtime100Multiplier,
          dailyAllowanceCents: cents(compensationForm.dailyAllowance, 0) ?? 0,
          mealAllowanceCents: cents(compensationForm.mealAllowance, 0) ?? 0,
          travelTimeHourlyCents: cents(compensationForm.travelTimeHourly, 0) ?? 0,
          notes: compensationForm.notes,
        },
      });
      await load();
      setSuccess('Palkkaehdot tallennettiin.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Palkkatietojen tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const saveTeam = async () => {
    if (!currentOrg || !isAdmin || !selectedSupervisorId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await setSupervisorTeam({
        organizationId: currentOrg.id,
        supervisorUserId: selectedSupervisorId,
        employeeIds: [...assignedEmployeeIds],
      });
      const assignments = await listSupervisorTeamMembers(currentOrg.id);
      setTeamAssignments(assignments);
      await load();
      setSuccess('Työnjohtajan oma tiimi tallennettiin. Työnjako-oikeudet eivät muuttuneet.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tiimin tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const title = currentRole === 'worker'
    ? 'Omat henkilöstö- ja palkkatiedot'
    : currentRole === 'supervisor'
      ? 'Oman tiimin henkilökortit'
      : 'Henkilökortit ja palkat';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-[1600px] space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300"><ShieldCheck size={16} /> Rajattu henkilöstöhallinto</div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Palkka-, vero-, pankki- ja HR-tiedot näkyvät vain työntekijälle itselleen, adminille ja työntekijän omalle työnjohtajalle. Työmääräysten jakaminen koko organisaatiolle toimii tästä rajauksesta riippumatta.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"><p className="text-xs text-slate-400">Näkyviä henkilöitä</p><p className="mt-1 text-2xl font-bold">{cards.length}</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"><p className="text-xs text-slate-400">Palkka määritetty</p><p className="mt-1 text-2xl font-bold">{cards.filter((card) => card.payType).length}</p></div>
            <div className="col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur sm:col-span-1"><p className="text-xs text-slate-400">Oikeustaso</p><p className="mt-1 text-sm font-semibold">{isAdmin ? 'Koko organisaatio' : currentRole === 'supervisor' ? 'Oma tiimi' : 'Omat tiedot'}</p></div>
          </div>
        </div>
      </div>

      {error && <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertTriangle size={18} className="mt-0.5 shrink-0" />{error}</div>}
      {success && <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={18} className="mt-0.5 shrink-0" />{success}</div>}

      {isAdmin && (
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6"><h2 className="flex items-center gap-2 font-semibold text-slate-950"><UsersRound size={18} className="text-orange-600" />Työnjohtajien omat HR-tiimit</h2><p className="mt-1 text-sm text-slate-500">Tiimijako rajaa vain HR- ja palkkatietojen näkyvyyttä. Se ei rajaa töiden tai työvuorojen jakamista.</p></div>
            <div className="grid gap-5 p-5 lg:grid-cols-[320px_1fr_auto] lg:items-start sm:p-6">
              <Field label="Työnjohtaja">
                <Select value={selectedSupervisorId} onValueChange={setSelectedSupervisorId}><SelectTrigger><SelectValue placeholder="Valitse työnjohtaja" /></SelectTrigger><SelectContent>{supervisors.map((person) => <SelectItem key={person.userId} value={person.userId}>{person.name}</SelectItem>)}</SelectContent></Select>
              </Field>
              <div className="space-y-2"><Label>Oman tiimin työntekijät</Label><div className="grid max-h-56 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2 xl:grid-cols-3">{employees.filter((employee) => !employee.archivedAt).map((employee) => <label key={employee.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50"><Checkbox disabled={!selectedSupervisorId} checked={assignedEmployeeIds.has(employee.id)} onCheckedChange={(checked) => setAssignedEmployeeIds((previous) => { const next = new Set(previous); if (checked) next.add(employee.id); else next.delete(employee.id); return next; })} /><span className="min-w-0"><span className="block truncate text-sm font-medium">{employee.name}</span><span className="block truncate text-xs text-slate-500">{employee.role} · {employee.department}</span></span></label>)}</div></div>
              <Button className="gap-2 lg:mt-7" disabled={!selectedSupervisorId || saving} onClick={() => void saveTeam()}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}Tallenna tiimi</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex min-h-72 items-center justify-center rounded-2xl border border-slate-200 bg-white"><Loader2 size={28} className="animate-spin text-orange-600" /></div>
      ) : cards.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center"><LockKeyhole size={44} className="mx-auto mb-3 text-slate-300" /><h2 className="font-semibold">Ei näkyviä henkilökortteja</h2><p className="mt-1 text-sm text-slate-500">Admin määrittää työnjohtajan oman tiimin henkilöstöhallinnossa.</p></div>
      ) : (
        <div className="grid min-w-0 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <Card className="h-fit min-w-0 overflow-hidden border-slate-200 shadow-sm xl:sticky xl:top-0">
            <CardContent className="p-0">
              <div className="border-b border-slate-200 p-4"><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Hae henkilöä…" /></div></div>
              <div className="max-h-[68vh] overflow-y-auto">{filteredCards.map((card) => <button key={card.employeeId} type="button" onClick={() => setSelectedEmployeeId(card.employeeId)} className={`flex w-full items-center gap-3 border-b border-slate-100 p-4 text-left transition-colors ${selectedCard?.employeeId === card.employeeId ? 'bg-orange-50' : 'hover:bg-slate-50'}`}><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">{initials(card.employeeName)}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-950">{card.employeeName}</p><p className="truncate text-sm text-slate-500">{card.employeeRole} · {card.department}</p><p className="mt-1 truncate text-xs text-slate-400">{card.supervisorNames.length ? `Työnjohto: ${card.supervisorNames.join(', ')}` : 'Omaa työnjohtajaa ei määritetty'}</p></div>{card.payType && <Badge className="shrink-0 border-0 bg-emerald-50 text-emerald-700">Palkka</Badge>}</button>)}</div>
            </CardContent>
          </Card>

          {selectedCard && (
            <div className="min-w-0 space-y-5">
              <Card className="overflow-hidden border-slate-200 shadow-sm"><CardContent className="p-0"><div className="flex flex-col gap-5 bg-gradient-to-r from-white to-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div className="flex min-w-0 items-center gap-4"><div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-orange-500 text-xl font-bold text-white shadow-lg shadow-orange-500/20">{initials(selectedCard.employeeName)}</div><div className="min-w-0"><h2 className="truncate text-2xl font-bold text-slate-950">{selectedCard.employeeName}</h2><p className="mt-1 truncate text-sm text-slate-500">{selectedCard.employeeRole} · {selectedCard.department}</p><div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline">{selectedCard.employeeStatus}</Badge><Badge variant="outline">{selectedCard.employmentType || 'Työsuhdemuoto puuttuu'}</Badge></div></div></div><div className="rounded-2xl border border-slate-200 bg-white px-5 py-4"><p className="text-xs uppercase tracking-wider text-slate-400">Voimassa oleva palkka</p><p className="mt-1 text-xl font-bold text-slate-950">{selectedCard.payType === 'Tuntipalkka' ? `${euroFromCents(selectedCard.hourlyWageCents)} / h` : euroFromCents(selectedCard.monthlySalaryCents)}</p><p className="mt-1 text-xs text-slate-500">{selectedCard.payType || 'Palkkatapaa ei määritetty'}</p></div></div></CardContent></Card>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
                { label: 'Viikkotyöaika', value: selectedCard.weeklyHours ? `${selectedCard.weeklyHours} h` : '—', icon: BriefcaseBusiness },
                { label: 'Työsuhde alkanut', value: dateLabel(selectedCard.startDate), icon: Building2 },
                { label: 'Työehtosopimus', value: selectedCard.collectiveAgreement || '—', icon: ShieldCheck },
                { label: 'Oma työnjohto', value: selectedCard.supervisorNames.join(', ') || '—', icon: UsersRound },
              ].map((item) => <Card key={item.label} className="border-slate-200 shadow-sm"><CardContent className="p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-500">{item.label}</p><item.icon size={17} className="shrink-0 text-orange-600" /></div><p className="mt-2 break-words font-semibold text-slate-900">{item.value}</p></CardContent></Card>)}</div>

              <Tabs defaultValue="employment">
                <TabsList className="h-auto w-full flex-wrap justify-start rounded-xl bg-slate-100 p-1"><TabsTrigger value="employment">Työsuhde</TabsTrigger><TabsTrigger value="compensation">Palkka ja lisät</TabsTrigger><TabsTrigger value="tax">Pankki ja verotus</TabsTrigger><TabsTrigger value="contact">Yhteystiedot</TabsTrigger></TabsList>

                <TabsContent value="employment" className="mt-4"><Card className="border-slate-200 shadow-sm"><CardContent className="grid gap-5 p-5 md:grid-cols-2 sm:p-6"><Field label="Ammattiliitto"><Input disabled={!isAdmin} value={hrForm.unionName} onChange={(event) => setHrForm((previous) => ({ ...previous, unionName: event.target.value }))} /></Field><Field label="Työterveyshuolto"><Input disabled={!isAdmin} value={hrForm.occupationalHealthProvider} onChange={(event) => setHrForm((previous) => ({ ...previous, occupationalHealthProvider: event.target.value }))} /></Field><Field label="Työsuhteen HR-huomiot"><Textarea disabled={!isAdmin} value={hrForm.employmentNotes} onChange={(event) => setHrForm((previous) => ({ ...previous, employmentNotes: event.target.value }))} rows={5} /></Field><Field label="Palkanlaskennan huomiot" hint="Näkyy vain rajatun HR-oikeuden käyttäjille."><Textarea disabled={!isAdmin} value={hrForm.payrollNotes} onChange={(event) => setHrForm((previous) => ({ ...previous, payrollNotes: event.target.value }))} rows={5} /></Field>{isAdmin && <div className="md:col-span-2 flex justify-end"><Button className="gap-2" onClick={() => void saveHr()} disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}Tallenna HR-tiedot</Button></div>}</CardContent></Card></TabsContent>

                <TabsContent value="compensation" className="mt-4"><Card className="border-slate-200 shadow-sm"><CardContent className="space-y-6 p-5 sm:p-6"><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4"><Field label="Palkkatapa"><Select disabled={!isAdmin} value={compensationForm.payType} onValueChange={(value: 'Kuukausipalkka' | 'Tuntipalkka') => setCompensationForm((previous) => ({ ...previous, payType: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Kuukausipalkka">Kuukausipalkka</SelectItem><SelectItem value="Tuntipalkka">Tuntipalkka</SelectItem></SelectContent></Select></Field><Field label={compensationForm.payType === 'Kuukausipalkka' ? 'Kuukausipalkka €' : 'Tuntipalkka €/h'}><Input disabled={!isAdmin} inputMode="decimal" value={compensationForm.payType === 'Kuukausipalkka' ? compensationForm.monthlySalary : compensationForm.hourlyWage} onChange={(event) => setCompensationForm((previous) => compensationForm.payType === 'Kuukausipalkka' ? { ...previous, monthlySalary: event.target.value } : { ...previous, hourlyWage: event.target.value })} /></Field><Field label="Viikkotyöaika"><Input disabled={!isAdmin} inputMode="decimal" value={compensationForm.weeklyHours} onChange={(event) => setCompensationForm((previous) => ({ ...previous, weeklyHours: event.target.value }))} /></Field><Field label="Työehtosopimus"><Input disabled={!isAdmin} value={compensationForm.collectiveAgreement} onChange={(event) => setCompensationForm((previous) => ({ ...previous, collectiveAgreement: event.target.value }))} placeholder="Esim. rakennusalan TES" /></Field><Field label="Voimassa alkaen"><Input disabled={!isAdmin} type="date" value={compensationForm.validFrom} onChange={(event) => setCompensationForm((previous) => ({ ...previous, validFrom: event.target.value }))} /></Field><Field label="Voimassa päättyen"><Input disabled={!isAdmin} type="date" value={compensationForm.validTo} onChange={(event) => setCompensationForm((previous) => ({ ...previous, validTo: event.target.value }))} /></Field><Field label="Palkkakausi"><Input disabled={!isAdmin} value={compensationForm.payPeriod} onChange={(event) => setCompensationForm((previous) => ({ ...previous, payPeriod: event.target.value }))} /></Field><Field label="Matka-ajan korvaus €/h"><Input disabled={!isAdmin} inputMode="decimal" value={compensationForm.travelTimeHourly} onChange={(event) => setCompensationForm((previous) => ({ ...previous, travelTimeHourly: event.target.value }))} /></Field></div><div><h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-950"><BadgeEuro size={18} className="text-orange-600" />Lisät ja korvaukset</h3><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
                  ['Iltalisä €/h', 'eveningAllowance'], ['Yölisä €/h', 'nightAllowance'], ['Lauantailisä €/h', 'saturdayAllowance'], ['Sunnuntailisä €/h', 'sundayAllowance'], ['Päiväraha €', 'dailyAllowance'], ['Ateriakorvaus €', 'mealAllowance'], ['Ylityö 50 % kerroin', 'overtime50Multiplier'], ['Ylityö 100 % kerroin', 'overtime100Multiplier'],
                ].map(([label, key]) => <Field key={key} label={label}><Input disabled={!isAdmin} inputMode="decimal" value={compensationForm[key as keyof CompensationForm] as string} onChange={(event) => setCompensationForm((previous) => ({ ...previous, [key]: event.target.value }))} /></Field>)}</div></div><Field label="Palkkaehtojen huomautukset"><Textarea disabled={!isAdmin} value={compensationForm.notes} onChange={(event) => setCompensationForm((previous) => ({ ...previous, notes: event.target.value }))} rows={4} /></Field>{isAdmin && <div className="flex justify-end"><Button className="gap-2" onClick={() => void saveCompensation()} disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}Tallenna palkkaehdot</Button></div>}</CardContent></Card></TabsContent>

                <TabsContent value="tax" className="mt-4"><Card className="border-slate-200 shadow-sm"><CardContent className="space-y-6 p-5 sm:p-6"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><div className="flex items-start gap-3"><LockKeyhole size={19} className="mt-0.5 shrink-0" /><p>Nämä tiedot ovat erityisen luottamuksellisia. Henkilötunnuksesta tallennetaan tässä vaiheessa vain neljä viimeistä merkkiä; täyttä henkilötunnusta ei tallenneta ilman erillistä kenttätason salausta.</p></div></div><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4"><Field label="IBAN"><Input disabled={!isAdmin} value={hrForm.iban} onChange={(event) => setHrForm((previous) => ({ ...previous, iban: event.target.value }))} /></Field><Field label="BIC"><Input disabled={!isAdmin} value={hrForm.bic} onChange={(event) => setHrForm((previous) => ({ ...previous, bic: event.target.value }))} /></Field><Field label="Perusveroprosentti"><Input disabled={!isAdmin} inputMode="decimal" value={hrForm.taxPercent} onChange={(event) => setHrForm((previous) => ({ ...previous, taxPercent: event.target.value }))} /></Field><Field label="Lisäveroprosentti"><Input disabled={!isAdmin} inputMode="decimal" value={hrForm.additionalTaxPercent} onChange={(event) => setHrForm((previous) => ({ ...previous, additionalTaxPercent: event.target.value }))} /></Field><Field label="Tuloraja €"><Input disabled={!isAdmin} inputMode="decimal" value={hrForm.taxIncomeLimit} onChange={(event) => setHrForm((previous) => ({ ...previous, taxIncomeLimit: event.target.value }))} /></Field><Field label="Verokortti voimassa alkaen"><Input disabled={!isAdmin} type="date" value={hrForm.taxCardValidFrom} onChange={(event) => setHrForm((previous) => ({ ...previous, taxCardValidFrom: event.target.value }))} /></Field><Field label="Verokortti voimassa päättyen"><Input disabled={!isAdmin} type="date" value={hrForm.taxCardValidTo} onChange={(event) => setHrForm((previous) => ({ ...previous, taxCardValidTo: event.target.value }))} /></Field><Field label="Henkilötunnuksen 4 viimeistä"><Input disabled={!isAdmin} maxLength={4} value={hrForm.personalIdentityCodeLast4} onChange={(event) => setHrForm((previous) => ({ ...previous, personalIdentityCodeLast4: event.target.value }))} /></Field></div>{isAdmin && <div className="flex justify-end"><Button className="gap-2" onClick={() => void saveHr()} disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}Tallenna pankki- ja verotiedot</Button></div>}</CardContent></Card></TabsContent>

                <TabsContent value="contact" className="mt-4"><Card className="border-slate-200 shadow-sm"><CardContent className="grid gap-5 p-5 md:grid-cols-2 xl:grid-cols-4 sm:p-6"><Field label="Syntymäaika"><Input disabled={!isAdmin} type="date" value={hrForm.dateOfBirth} onChange={(event) => setHrForm((previous) => ({ ...previous, dateOfBirth: event.target.value }))} /></Field><Field label="Katuosoite"><Input disabled={!isAdmin} value={hrForm.streetAddress} onChange={(event) => setHrForm((previous) => ({ ...previous, streetAddress: event.target.value }))} /></Field><Field label="Postinumero"><Input disabled={!isAdmin} value={hrForm.postalCode} onChange={(event) => setHrForm((previous) => ({ ...previous, postalCode: event.target.value }))} /></Field><Field label="Postitoimipaikka"><Input disabled={!isAdmin} value={hrForm.city} onChange={(event) => setHrForm((previous) => ({ ...previous, city: event.target.value }))} /></Field><Field label="Maa"><Input disabled={!isAdmin} value={hrForm.country} onChange={(event) => setHrForm((previous) => ({ ...previous, country: event.target.value }))} /></Field><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">Työsähköposti</p><p className="mt-1 break-words font-medium">{selectedCard.email || 'Ei määritetty'}</p></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">Puhelin</p><p className="mt-1 break-words font-medium">{selectedCard.phone || 'Ei määritetty'}</p></div>{isAdmin && <div className="flex items-end justify-end xl:col-span-4"><Button className="gap-2" onClick={() => void saveHr()} disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}Tallenna yhteystiedot</Button></div>}</CardContent></Card></TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
