import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
  type SupervisorTeamMember,
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

function euro(value?: number) {
  if (value == null) return 'Ei määritetty';
  return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(value / 100);
}

function dateLabel(value?: string) {
  if (!value) return 'Ei määritetty';
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs leading-5 text-slate-500">{hint}</p>}
    </div>
  );
}

function moneyInput(
  label: string,
  value: string,
  disabled: boolean,
  onChange: (value: string) => void,
) {
  return (
    <Field label={label}>
      <Input disabled={disabled} inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function HeroStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-h-[5.5rem] flex-col rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <div className="mt-auto break-words pt-2 text-2xl font-bold leading-tight tracking-tight">{value}</div>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof BriefcaseBusiness;
}) {
  return (
    <Card className="min-h-[7.5rem] border-slate-200/80 shadow-sm">
      <CardContent className="flex h-full flex-col p-4">
        <div className="flex min-h-8 items-start justify-between gap-3">
          <p className="break-words text-xs font-medium text-slate-500">{label}</p>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
            <Icon size={16} />
          </span>
        </div>
        <p className="mt-auto break-words pt-3 text-base font-semibold leading-snug text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}

function ReadOnlyFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[5.75rem] flex-col rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-auto break-words pt-2 text-sm font-semibold leading-snug text-slate-900">{value}</p>
    </div>
  );
}

export default function Henkilokortit() {
  const { user } = useAuth();
  const { currentOrg, currentRole } = useOrganization();
  const { employees } = useAppDataContext();
  const { people } = useRoleWorkspace();
  const organizationId = currentOrg?.id;
  const isAdmin = currentRole === 'admin';

  const [cards, setCards] = useState<EmployeeCard[]>([]);
  const [assignments, setAssignments] = useState<SupervisorTeamMember[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');
  const [assignedEmployeeIds, setAssignedEmployeeIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hrForm, setHrForm] = useState<HrForm>(EMPTY_HR);
  const [compensationForm, setCompensationForm] = useState<CompensationForm>(EMPTY_COMPENSATION);

  const supervisors = useMemo(
    () => people.filter((person) => person.role === 'supervisor'),
    [people],
  );
  const selectedCard = useMemo(
    () => cards.find((card) => card.employeeId === selectedEmployeeId) ?? cards[0],
    [cards, selectedEmployeeId],
  );

  const load = useCallback(async () => {
    if (!organizationId) {
      setCards([]);
      setAssignments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [nextCards, nextAssignments] = await Promise.all([
        listAccessibleEmployeeCards(organizationId),
        isAdmin ? listSupervisorTeamMembers(organizationId) : Promise.resolve([]),
      ]);
      setCards(nextCards);
      setAssignments(nextAssignments);
      setSelectedEmployeeId((current) => (
        nextCards.some((card) => card.employeeId === current)
          ? current
          : nextCards[0]?.employeeId ?? ''
      ));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Henkilötietojen haku epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, organizationId]);

  useEffect(() => { void load(); }, [load]);

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
  }, [selectedCard]);

  useEffect(() => {
    setAssignedEmployeeIds(new Set(
      assignments
        .filter((item) => item.supervisorUserId === selectedSupervisorId)
        .map((item) => item.employeeId),
    ));
  }, [assignments, selectedSupervisorId]);

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
    if (!organizationId || !user || !selectedCard || !isAdmin) return;
    const taxPercent = decimal(hrForm.taxPercent);
    const additionalTaxPercent = decimal(hrForm.additionalTaxPercent);
    if ((taxPercent != null && (taxPercent < 0 || taxPercent > 100))
      || (additionalTaxPercent != null && (additionalTaxPercent < 0 || additionalTaxPercent > 100))) {
      setError('Veroprosentin pitää olla 0–100.');
      return;
    }
    if (hrForm.personalIdentityCodeLast4 && hrForm.personalIdentityCodeLast4.length !== 4) {
      setError('Henkilötunnuksesta tallennetaan vain neljä viimeistä merkkiä.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await saveEmployeeHrProfile({
        organizationId,
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
    if (!organizationId || !user || !selectedCard || !isAdmin) return;
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
        organizationId,
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
    if (!organizationId || !isAdmin || !selectedSupervisorId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await setSupervisorTeam({
        organizationId,
        supervisorUserId: selectedSupervisorId,
        employeeIds: [...assignedEmployeeIds],
      });
      await load();
      setSuccess('Työnjohtajan oma HR-tiimi tallennettiin. Operatiiviset työnjako-oikeudet eivät muuttuneet.');
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
  const readOnly = !isAdmin;

  const accessLevelLabel = isAdmin
    ? 'Koko organisaatio'
    : currentRole === 'supervisor'
      ? 'Oma tiimi'
      : 'Omat tiedot';

  const summaryMetrics = selectedCard
    ? [
        {
          label: 'Viikkotyöaika',
          value: selectedCard.weeklyHours ? `${selectedCard.weeklyHours} h` : '—',
          icon: BriefcaseBusiness,
        },
        {
          label: 'Työsuhde alkanut',
          value: dateLabel(selectedCard.startDate),
          icon: Building2,
        },
        {
          label: 'Työehtosopimus',
          value: selectedCard.collectiveAgreement || '—',
          icon: ShieldCheck,
        },
        {
          label: 'Oma työnjohto',
          value: selectedCard.supervisorNames.join(', ') || '—',
          icon: UsersRound,
        },
      ]
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="mx-auto max-w-[1600px] space-y-6"
    >
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 12% 18%, rgba(251,146,60,0.22), transparent 42%), radial-gradient(circle at 88% 12%, rgba(148,163,184,0.18), transparent 36%)',
          }}
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-stretch lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
              <ShieldCheck size={16} />
              Rajattu henkilöstöhallinto
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Työnjohtaja näkee vain oman tiiminsä HR- ja palkkatiedot. Työmääräysten ja työvuorojen jakaminen koko organisaatiolle toimii tästä rajauksesta riippumatta.
            </p>
          </div>
          <div className="grid auto-rows-fr grid-cols-1 items-stretch gap-3 sm:min-w-[22rem] sm:grid-cols-3 lg:w-[28rem] lg:shrink-0">
            <HeroStat label="Näkyviä henkilöitä" value={cards.length} />
            <HeroStat label="Palkka määritetty" value={cards.filter((card) => card.payType).length} />
            <HeroStat label="Oikeustaso" value={<span className="text-lg sm:text-xl">{accessLevelLabel}</span>} />
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          {success}
        </div>
      )}

      {isAdmin && (
        <Card className="border-slate-200/80 shadow-sm">
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-slate-950">
                <UsersRound size={18} className="text-orange-600" />
                Työnjohtajien omat HR-tiimit
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Tiimijako vaikuttaa vain luottamuksellisten HR- ja palkkatietojen näkyvyyteen.
              </p>
            </div>
            <div className="grid gap-5 lg:grid-cols-[300px_1fr_auto] lg:items-start">
              <Field label="Työnjohtaja">
                <Select value={selectedSupervisorId} onValueChange={setSelectedSupervisorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Valitse työnjohtaja" />
                  </SelectTrigger>
                  <SelectContent>
                    {supervisors.map((person) => (
                      <SelectItem key={person.userId} value={person.userId}>{person.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="space-y-2">
                <Label>Oman tiimin työntekijät</Label>
                <div className="grid max-h-56 auto-rows-fr gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/40 p-3 sm:grid-cols-2 xl:grid-cols-3">
                  {employees.filter((employee) => !employee.archivedAt).map((employee) => (
                    <label
                      key={employee.id}
                      className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-transparent bg-white px-3 py-2 shadow-sm hover:border-slate-200"
                    >
                      <Checkbox
                        disabled={!selectedSupervisorId}
                        checked={assignedEmployeeIds.has(employee.id)}
                        onCheckedChange={(checked) => setAssignedEmployeeIds((previous) => {
                          const next = new Set(previous);
                          if (checked) next.add(employee.id);
                          else next.delete(employee.id);
                          return next;
                        })}
                      />
                      <span className="min-w-0 break-words">
                        <span className="block text-sm font-medium">{employee.name}</span>
                        <span className="block text-xs text-slate-500">{employee.role} · {employee.department}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <Button className="gap-2 lg:mt-7" disabled={!selectedSupervisorId || saving} onClick={() => void saveTeam()}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Tallenna tiimi
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex min-h-72 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <Loader2 size={28} className="animate-spin text-orange-600" />
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <LockKeyhole size={44} className="mx-auto mb-3 text-slate-300" />
          <h2 className="font-semibold">Ei näkyviä henkilökortteja</h2>
          <p className="mt-1 text-sm text-slate-500">Admin määrittää työnjohtajan oman HR-tiimin.</p>
        </div>
      ) : (
        <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="h-fit overflow-hidden border-slate-200/80 shadow-sm xl:sticky xl:top-4">
            <CardContent className="p-0">
              <div className="border-b border-slate-200 bg-slate-50/70 p-4">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="border-slate-200 bg-white pl-9"
                    placeholder="Hae henkilöä…"
                  />
                </div>
              </div>
              <div className="max-h-[68vh] overflow-y-auto">
                {filteredCards.map((card) => {
                  const selected = selectedCard?.employeeId === card.employeeId;
                  return (
                    <button
                      key={card.employeeId}
                      type="button"
                      onClick={() => setSelectedEmployeeId(card.employeeId)}
                      className={`flex min-h-[5.75rem] w-full items-start gap-3 border-b border-slate-100 px-4 py-3.5 text-left transition-colors ${
                        selected
                          ? 'border-l-4 border-l-orange-500 bg-orange-50/90'
                          : 'border-l-4 border-l-transparent hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">
                        {initials(card.employeeName)}
                      </div>
                      <div className="min-w-0 flex-1 break-words">
                        <div className="flex flex-wrap items-start gap-2">
                          <p className="font-semibold text-slate-950">{card.employeeName}</p>
                          {card.payType && (
                            <Badge className="shrink-0 border-0 bg-emerald-50 text-emerald-700">Palkka</Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-slate-500">{card.employeeRole} · {card.department}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">
                          {card.supervisorNames.length
                            ? `Työnjohto: ${card.supervisorNames.join(', ')}`
                            : 'Omaa työnjohtajaa ei määritetty'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {selectedCard && (
            <motion.div
              key={selectedCard.employeeId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="min-w-0 space-y-5"
            >
              <Card className="overflow-hidden border-slate-200/80 shadow-sm">
                <CardContent className="grid gap-5 bg-gradient-to-br from-white via-white to-slate-50 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(13rem,16rem)] sm:items-stretch sm:p-6">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-orange-500 text-xl font-bold text-white shadow-sm shadow-orange-500/25">
                      {initials(selectedCard.employeeName)}
                    </div>
                    <div className="min-w-0 break-words">
                      <h2 className="text-2xl font-bold tracking-tight text-slate-950">{selectedCard.employeeName}</h2>
                      <p className="mt-1 text-sm text-slate-500">{selectedCard.employeeRole} · {selectedCard.department}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline">{selectedCard.employeeStatus}</Badge>
                        <Badge variant="outline">{selectedCard.employmentType || 'Työsuhdemuoto puuttuu'}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex min-h-[6.5rem] flex-col rounded-2xl bg-slate-950 px-5 py-4 text-white">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Voimassa oleva palkka</p>
                    <p className="mt-auto break-words pt-3 text-xl font-bold leading-snug">
                      {selectedCard.payType === 'Tuntipalkka'
                        ? `${euro(selectedCard.hourlyWageCents)} / h`
                        : euro(selectedCard.monthlySalaryCents)}
                    </p>
                    <p className="mt-1 break-words text-xs text-slate-400">
                      {selectedCard.payType || 'Palkkatapaa ei määritetty'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="grid auto-rows-fr grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {summaryMetrics.map((item) => (
                  <SummaryMetric key={item.label} label={item.label} value={item.value} icon={item.icon} />
                ))}
              </div>

              <Tabs defaultValue="employment">
                <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-2xl bg-slate-100/90 p-1.5">
                  <TabsTrigger value="employment" className="rounded-xl">Työsuhde</TabsTrigger>
                  <TabsTrigger value="compensation" className="rounded-xl">Palkka ja lisät</TabsTrigger>
                  <TabsTrigger value="tax" className="rounded-xl">Pankki ja verotus</TabsTrigger>
                  <TabsTrigger value="contact" className="rounded-xl">Yhteystiedot</TabsTrigger>
                </TabsList>

                <TabsContent value="employment" className="mt-4">
                  <Card className="border-slate-200/80 shadow-sm">
                    <CardContent className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
                      <Field label="Ammattiliitto">
                        <Input disabled={readOnly} value={hrForm.unionName} onChange={(event) => setHrForm((previous) => ({ ...previous, unionName: event.target.value }))} />
                      </Field>
                      <Field label="Työterveyshuolto">
                        <Input disabled={readOnly} value={hrForm.occupationalHealthProvider} onChange={(event) => setHrForm((previous) => ({ ...previous, occupationalHealthProvider: event.target.value }))} />
                      </Field>
                      <Field label="Työsuhteen HR-huomiot">
                        <Textarea disabled={readOnly} value={hrForm.employmentNotes} onChange={(event) => setHrForm((previous) => ({ ...previous, employmentNotes: event.target.value }))} rows={5} />
                      </Field>
                      <Field label="Palkanlaskennan huomiot" hint="Näkyy vain rajatun HR-oikeuden käyttäjille.">
                        <Textarea disabled={readOnly} value={hrForm.payrollNotes} onChange={(event) => setHrForm((previous) => ({ ...previous, payrollNotes: event.target.value }))} rows={5} />
                      </Field>
                      {isAdmin && (
                        <div className="flex justify-end md:col-span-2">
                          <Button className="gap-2" onClick={() => void saveHr()} disabled={saving}>
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Tallenna HR-tiedot
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="compensation" className="mt-4">
                  <Card className="border-slate-200/80 shadow-sm">
                    <CardContent className="space-y-6 p-5 sm:p-6">
                      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                        <Field label="Palkkatapa">
                          <Select
                            disabled={readOnly}
                            value={compensationForm.payType}
                            onValueChange={(value) => setCompensationForm((previous) => ({
                              ...previous,
                              payType: value === 'Tuntipalkka' ? 'Tuntipalkka' : 'Kuukausipalkka',
                            }))}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Kuukausipalkka">Kuukausipalkka</SelectItem>
                              <SelectItem value="Tuntipalkka">Tuntipalkka</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        {moneyInput(
                          compensationForm.payType === 'Kuukausipalkka' ? 'Kuukausipalkka €' : 'Tuntipalkka €/h',
                          compensationForm.payType === 'Kuukausipalkka' ? compensationForm.monthlySalary : compensationForm.hourlyWage,
                          readOnly,
                          (value) => setCompensationForm((previous) => (
                            compensationForm.payType === 'Kuukausipalkka'
                              ? { ...previous, monthlySalary: value }
                              : { ...previous, hourlyWage: value }
                          )),
                        )}
                        <Field label="Viikkotyöaika">
                          <Input disabled={readOnly} inputMode="decimal" value={compensationForm.weeklyHours} onChange={(event) => setCompensationForm((previous) => ({ ...previous, weeklyHours: event.target.value }))} />
                        </Field>
                        <Field label="Työehtosopimus">
                          <Input disabled={readOnly} value={compensationForm.collectiveAgreement} onChange={(event) => setCompensationForm((previous) => ({ ...previous, collectiveAgreement: event.target.value }))} />
                        </Field>
                        <Field label="Voimassa alkaen">
                          <Input disabled={readOnly} type="date" value={compensationForm.validFrom} onChange={(event) => setCompensationForm((previous) => ({ ...previous, validFrom: event.target.value }))} />
                        </Field>
                        <Field label="Voimassa päättyen">
                          <Input disabled={readOnly} type="date" value={compensationForm.validTo} onChange={(event) => setCompensationForm((previous) => ({ ...previous, validTo: event.target.value }))} />
                        </Field>
                        <Field label="Palkkakausi">
                          <Input disabled={readOnly} value={compensationForm.payPeriod} onChange={(event) => setCompensationForm((previous) => ({ ...previous, payPeriod: event.target.value }))} />
                        </Field>
                        {moneyInput('Matka-ajan korvaus €/h', compensationForm.travelTimeHourly, readOnly, (value) => setCompensationForm((previous) => ({ ...previous, travelTimeHourly: value })))}
                      </div>
                      <div>
                        <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-950">
                          <BadgeEuro size={18} className="text-orange-600" />
                          Lisät ja korvaukset
                        </h3>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                          {moneyInput('Iltalisä €/h', compensationForm.eveningAllowance, readOnly, (value) => setCompensationForm((previous) => ({ ...previous, eveningAllowance: value })))}
                          {moneyInput('Yölisä €/h', compensationForm.nightAllowance, readOnly, (value) => setCompensationForm((previous) => ({ ...previous, nightAllowance: value })))}
                          {moneyInput('Lauantailisä €/h', compensationForm.saturdayAllowance, readOnly, (value) => setCompensationForm((previous) => ({ ...previous, saturdayAllowance: value })))}
                          {moneyInput('Sunnuntailisä €/h', compensationForm.sundayAllowance, readOnly, (value) => setCompensationForm((previous) => ({ ...previous, sundayAllowance: value })))}
                          {moneyInput('Päiväraha €', compensationForm.dailyAllowance, readOnly, (value) => setCompensationForm((previous) => ({ ...previous, dailyAllowance: value })))}
                          {moneyInput('Ateriakorvaus €', compensationForm.mealAllowance, readOnly, (value) => setCompensationForm((previous) => ({ ...previous, mealAllowance: value })))}
                          <Field label="Ylityö 50 % kerroin">
                            <Input disabled={readOnly} inputMode="decimal" value={compensationForm.overtime50Multiplier} onChange={(event) => setCompensationForm((previous) => ({ ...previous, overtime50Multiplier: event.target.value }))} />
                          </Field>
                          <Field label="Ylityö 100 % kerroin">
                            <Input disabled={readOnly} inputMode="decimal" value={compensationForm.overtime100Multiplier} onChange={(event) => setCompensationForm((previous) => ({ ...previous, overtime100Multiplier: event.target.value }))} />
                          </Field>
                        </div>
                      </div>
                      <Field label="Palkkaehtojen huomautukset">
                        <Textarea disabled={readOnly} value={compensationForm.notes} onChange={(event) => setCompensationForm((previous) => ({ ...previous, notes: event.target.value }))} rows={4} />
                      </Field>
                      {isAdmin && (
                        <div className="flex justify-end">
                          <Button className="gap-2" onClick={() => void saveCompensation()} disabled={saving}>
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Tallenna palkkaehdot
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="tax" className="mt-4">
                  <Card className="border-slate-200/80 shadow-sm">
                    <CardContent className="space-y-6 p-5 sm:p-6">
                      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                        <LockKeyhole size={19} className="mt-0.5 shrink-0" />
                        <p>
                          Henkilötunnuksesta tallennetaan turvallisuussyistä vain neljä viimeistä merkkiä. Täyttä henkilötunnusta ei tallenneta ilman erillistä kenttätason salausta.
                        </p>
                      </div>
                      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                        <Field label="IBAN">
                          <Input disabled={readOnly} value={hrForm.iban} onChange={(event) => setHrForm((previous) => ({ ...previous, iban: event.target.value }))} />
                        </Field>
                        <Field label="BIC">
                          <Input disabled={readOnly} value={hrForm.bic} onChange={(event) => setHrForm((previous) => ({ ...previous, bic: event.target.value }))} />
                        </Field>
                        <Field label="Perusveroprosentti">
                          <Input disabled={readOnly} inputMode="decimal" value={hrForm.taxPercent} onChange={(event) => setHrForm((previous) => ({ ...previous, taxPercent: event.target.value }))} />
                        </Field>
                        <Field label="Lisäveroprosentti">
                          <Input disabled={readOnly} inputMode="decimal" value={hrForm.additionalTaxPercent} onChange={(event) => setHrForm((previous) => ({ ...previous, additionalTaxPercent: event.target.value }))} />
                        </Field>
                        {moneyInput('Tuloraja €', hrForm.taxIncomeLimit, readOnly, (value) => setHrForm((previous) => ({ ...previous, taxIncomeLimit: value })))}
                        <Field label="Verokortti alkaen">
                          <Input disabled={readOnly} type="date" value={hrForm.taxCardValidFrom} onChange={(event) => setHrForm((previous) => ({ ...previous, taxCardValidFrom: event.target.value }))} />
                        </Field>
                        <Field label="Verokortti päättyen">
                          <Input disabled={readOnly} type="date" value={hrForm.taxCardValidTo} onChange={(event) => setHrForm((previous) => ({ ...previous, taxCardValidTo: event.target.value }))} />
                        </Field>
                        <Field label="Henkilötunnuksen 4 viimeistä">
                          <Input disabled={readOnly} maxLength={4} value={hrForm.personalIdentityCodeLast4} onChange={(event) => setHrForm((previous) => ({ ...previous, personalIdentityCodeLast4: event.target.value }))} />
                        </Field>
                      </div>
                      {isAdmin && (
                        <div className="flex justify-end">
                          <Button className="gap-2" onClick={() => void saveHr()} disabled={saving}>
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                            Tallenna pankki- ja verotiedot
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="contact" className="mt-4">
                  <Card className="border-slate-200/80 shadow-sm">
                    <CardContent className="grid auto-rows-fr gap-5 p-5 sm:p-6 md:grid-cols-2 xl:grid-cols-4">
                      <Field label="Syntymäaika">
                        <Input disabled={readOnly} type="date" value={hrForm.dateOfBirth} onChange={(event) => setHrForm((previous) => ({ ...previous, dateOfBirth: event.target.value }))} />
                      </Field>
                      <Field label="Katuosoite">
                        <Input disabled={readOnly} value={hrForm.streetAddress} onChange={(event) => setHrForm((previous) => ({ ...previous, streetAddress: event.target.value }))} />
                      </Field>
                      <Field label="Postinumero">
                        <Input disabled={readOnly} value={hrForm.postalCode} onChange={(event) => setHrForm((previous) => ({ ...previous, postalCode: event.target.value }))} />
                      </Field>
                      <Field label="Postitoimipaikka">
                        <Input disabled={readOnly} value={hrForm.city} onChange={(event) => setHrForm((previous) => ({ ...previous, city: event.target.value }))} />
                      </Field>
                      <Field label="Maa">
                        <Input disabled={readOnly} value={hrForm.country} onChange={(event) => setHrForm((previous) => ({ ...previous, country: event.target.value }))} />
                      </Field>
                      <ReadOnlyFact label="Työsähköposti" value={selectedCard.email || 'Ei määritetty'} />
                      <ReadOnlyFact label="Puhelin" value={selectedCard.phone || 'Ei määritetty'} />
                      {isAdmin && (
                        <div className="flex items-end justify-end xl:col-span-4">
                          <Button className="gap-2" onClick={() => void saveHr()} disabled={saving}>
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Tallenna yhteystiedot
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  );
}
