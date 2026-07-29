import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, BadgeEuro, CheckCircle2, Loader2, Plus, ShieldCheck, UserRoundCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ROLE_LABELS, useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrganizationAdmin } from '@/hooks/useOrganizationAdmin';
import logger from '@/lib/logger';
import { localDateIso } from '@/lib/localDateTime';
import { setEmployeeSupervisor } from '@/lib/supabase/employeeSupervisors';
import {
  createEmployeeRecord,
  deleteEmployeeRecord,
} from '@/lib/supabase/organizationEntities';
import {
  inviteOrganizationMember,
  type EmployeeOnboardingInput,
} from '@/lib/supabase/organizationAdmin';
import {
  saveEmployeeCompensation,
  type CompensationInput,
} from '@/lib/supabase/workforceHr';
import type { OrganizationRole } from '@/lib/supabase/types';
import type { Employee, EmployeeStatus } from '@/types';

import HenkilostoIntegratedLegacy from './HenkilostoIntegratedLegacy';

type AccountMode = 'invite' | 'record_only';
type InternalRole = Exclude<OrganizationRole, 'customer'>;
type PayType = 'Tuntipalkka' | 'Kuukausipalkka';

const NONE = 'none';
const INTERNAL_ROLES: InternalRole[] = ['worker', 'supervisor', 'project_coordinator', 'admin'];
const EMPLOYEE_STATUSES: EmployeeStatus[] = [
  'Aktiivinen',
  'Lomalla',
  'Sairas',
  'Koulutuksessa',
  'Eroonnut',
];

interface EmployeeCreateForm {
  name: string;
  role: string;
  department: string;
  phone: string;
  email: string;
  startDate: string;
  status: EmployeeStatus;
  employmentType: string;
  hourlyCost: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  accountMode: AccountMode;
  accessRole: InternalRole;
  supervisorUserId: string;
  payType: PayType | '';
  payAmount: string;
  weeklyHours: string;
  payPeriod: string;
}

function emptyForm(): EmployeeCreateForm {
  return {
    name: '',
    role: '',
    department: '',
    phone: '',
    email: '',
    startDate: localDateIso(),
    status: 'Aktiivinen',
    employmentType: '',
    hourlyCost: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    accountMode: 'invite',
    accessRole: 'worker',
    supervisorUserId: NONE,
    payType: '',
    payAmount: '',
    weeklyHours: '37,5',
    payPeriod: 'Kuukausi',
  };
}

function decimal(value: string): number | null {
  const normalized = value.trim().replaceAll(' ', '').replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function cents(value: string): number | null {
  const parsed = decimal(value);
  return parsed == null ? null : Math.round(parsed * 100);
}

function payPreview(payType: PayType | '', amountCents: number | null): string {
  if (!payType || amountCents == null) return 'Valitse palkkatapa ja anna palkka';
  const amount = new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
  }).format(amountCents / 100);
  return payType === 'Tuntipalkka' ? `${amount} / h` : `${amount} / kk`;
}

function Field({ label, children, hint }: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs leading-5 text-text-secondary">{hint}</p>}
    </div>
  );
}

export default function HenkilostoIntegrated() {
  const { user } = useAuth();
  const { currentOrg, actualRole } = useOrganization();
  const { refresh: refreshDomain } = useAppDataContext();
  const { members, refresh: refreshMembers } = useOrganizationAdmin();
  const rootRef = useRef<HTMLDivElement>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<EmployeeCreateForm>(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [legacyVersion, setLegacyVersion] = useState(0);

  const supervisors = useMemo(
    () => members
      .filter((member) => member.role === 'supervisor' && member.invitationStatus !== 'disabled')
      .map((member) => ({
        userId: member.userId,
        name: member.profile?.full_name || member.profile?.email || 'Nimetön työnjohtaja',
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fi')),
    [members],
  );

  useEffect(() => {
    if (actualRole !== 'admin') {
      setPortalTarget(null);
      return;
    }

    const root = rootRef.current;
    if (!root) return;

    let originalButton: HTMLButtonElement | null = null;
    let marker: HTMLSpanElement | null = null;

    const attach = () => {
      if (marker) return;
      const button = [...root.querySelectorAll('button')]
        .find((candidate) => candidate.textContent?.trim() === 'Lisää henkilö');
      if (!button || !button.parentElement) return;

      originalButton = button;
      marker = document.createElement('span');
      marker.className = 'contents';
      button.parentElement.insertBefore(marker, button);
      button.hidden = true;
      setPortalTarget(marker);
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (originalButton) originalButton.hidden = false;
      marker?.remove();
      setPortalTarget(null);
    };
  }, [actualRole, legacyVersion]);

  const openCreate = () => {
    setForm(emptyForm());
    setErrors([]);
    setOperationError(null);
    setMessage(null);
    setDialogOpen(true);
  };

  const validate = (): {
    payAmountCents: number;
    weeklyHours: number;
    hourlyCostCents: number | undefined;
  } | null => {
    const nextErrors: string[] = [];
    const payAmountCents = cents(form.payAmount);
    const weeklyHours = decimal(form.weeklyHours);
    const hourlyCost = form.hourlyCost.trim() ? decimal(form.hourlyCost) : null;

    if (!form.name.trim()) nextErrors.push('Nimi on pakollinen.');
    if (!form.role.trim()) nextErrors.push('Tehtävänimike on pakollinen.');
    if (!form.department.trim()) nextErrors.push('Osasto on pakollinen.');
    if (!form.payType) nextErrors.push('Valitse tuntipalkka tai kuukausipalkka.');
    if (payAmountCents == null || payAmountCents <= 0) {
      nextErrors.push('Anna palkaksi nollaa suurempi euromäärä.');
    }
    if (weeklyHours == null || weeklyHours <= 0 || weeklyHours > 168) {
      nextErrors.push('Viikkotyöajan pitää olla yli 0 ja enintään 168 tuntia.');
    }
    if (!form.payPeriod.trim()) nextErrors.push('Palkkakausi on pakollinen.');
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) {
      nextErrors.push('Sähköpostiosoite ei ole kelvollinen.');
    }
    if (form.accountMode === 'invite' && !form.email.trim()) {
      nextErrors.push('Sähköposti on pakollinen kutsua varten.');
    }
    if (form.accessRole === 'worker' && supervisors.length > 0 && form.supervisorUserId === NONE) {
      nextErrors.push('Valitse työntekijälle vastuullinen työnjohtaja.');
    }
    if (form.hourlyCost.trim() && (hourlyCost == null || hourlyCost < 0)) {
      nextErrors.push('Sisäisen tuntikustannuksen pitää olla nolla tai positiivinen.');
    }

    setErrors(nextErrors);
    if (nextErrors.length || payAmountCents == null || weeklyHours == null) return null;

    return {
      payAmountCents,
      weeklyHours,
      hourlyCostCents: hourlyCost == null ? undefined : Math.round(hourlyCost * 100),
    };
  };

  const save = async () => {
    const parsed = validate();
    if (!parsed || !currentOrg || !user || !form.payType) return;

    const payload: Omit<Employee, 'id'> = {
      name: form.name.trim(),
      role: form.role.trim(),
      department: form.department.trim(),
      phone: form.phone.trim(),
      email: form.email.trim().toLowerCase(),
      startDate: form.startDate,
      status: form.status,
      hourlyCostCents: parsed.hourlyCostCents,
      employmentType: form.employmentType.trim() || undefined,
      emergencyContactName: form.emergencyContactName.trim() || undefined,
      emergencyContactPhone: form.emergencyContactPhone.trim() || undefined,
      projects: 0,
      hours: 0,
      training: 0,
      certifications: [],
    };

    const compensation: CompensationInput = {
      validFrom: form.startDate || localDateIso(),
      payType: form.payType,
      monthlySalaryCents: form.payType === 'Kuukausipalkka' ? parsed.payAmountCents : undefined,
      hourlyWageCents: form.payType === 'Tuntipalkka' ? parsed.payAmountCents : undefined,
      weeklyHours: parsed.weeklyHours,
      payPeriod: form.payPeriod.trim(),
      eveningAllowanceCents: 0,
      nightAllowanceCents: 0,
      saturdayAllowanceCents: 0,
      sundayAllowanceCents: 0,
      overtime50Multiplier: 1.5,
      overtime100Multiplier: 2,
      dailyAllowanceCents: 0,
      mealAllowanceCents: 0,
      travelTimeHourlyCents: 0,
    };

    setSaving(true);
    setOperationError(null);
    setMessage(null);
    let employeeId: string | null = null;
    let completed = false;

    try {
      employeeId = await createEmployeeRecord(currentOrg.id, user.id, payload);
      await saveEmployeeCompensation({
        organizationId: currentOrg.id,
        employeeId,
        userId: user.id,
        input: compensation,
      });

      if (form.supervisorUserId !== NONE) {
        await setEmployeeSupervisor({
          organizationId: currentOrg.id,
          employeeId,
          supervisorUserId: form.supervisorUserId,
        });
      }

      if (form.accountMode === 'invite') {
        const onboarding: EmployeeOnboardingInput = {
          jobTitle: payload.role,
          department: payload.department,
          phone: payload.phone,
          startDate: payload.startDate,
          status: payload.status,
          hourlyCostCents: payload.hourlyCostCents ?? null,
          employmentType: payload.employmentType ?? '',
          emergencyContactName: payload.emergencyContactName ?? '',
          emergencyContactPhone: payload.emergencyContactPhone ?? '',
          supervisorUserId: form.supervisorUserId === NONE ? null : form.supervisorUserId,
        };
        const result = await inviteOrganizationMember({
          organizationId: currentOrg.id,
          email: payload.email,
          fullName: payload.name,
          role: form.accessRole,
          employee: onboarding,
        });
        setMessage(`${result.message} Palkkaehdot tallennettiin.`);
      } else {
        setMessage('Henkilöstökortti ja palkkaehdot luotiin ilman sovellustunnusta.');
      }
      completed = true;
    } catch (caught) {
      if (!completed && employeeId) {
        try {
          await deleteEmployeeRecord(currentOrg.id, employeeId);
        } catch (rollbackError) {
          logger.error('Työntekijän luonnin peruutus epäonnistui', {
            employeeId,
            error: rollbackError,
          });
        }
      }
      const errorMessage = caught instanceof Error ? caught.message : 'Työntekijän tallennus epäonnistui.';
      setOperationError(errorMessage);
      logger.error('Työntekijän ja palkkaehtojen tallennus epäonnistui', { error: caught });
      setSaving(false);
      return;
    }

    try {
      await Promise.all([refreshDomain(), refreshMembers()]);
    } catch (refreshError) {
      logger.error('Henkilöstönäkymän päivitys tallennuksen jälkeen epäonnistui', { error: refreshError });
    }

    setLegacyVersion((value) => value + 1);
    setDialogOpen(false);
    setSaving(false);
  };

  const payAmountCents = cents(form.payAmount);

  return (
    <>
      {message && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{message}</span>
        </div>
      )}
      {operationError && !dialogOpen && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{operationError}</span>
        </div>
      )}

      <div ref={rootRef}>
        <HenkilostoIntegratedLegacy key={legacyVersion} />
      </div>

      {portalTarget && createPortal(
        <Button onClick={openCreate}>
          <Plus size={16} className="mr-2" /> Lisää henkilö
        </Button>,
        portalTarget,
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!saving) setDialogOpen(open); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Lisää henkilö ja palkkaehdot</DialogTitle>
          </DialogHeader>

          {errors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errors.map((error) => <p key={error}>{error}</p>)}
            </div>
          )}
          {operationError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{operationError}</span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nimi *">
              <Input value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} />
            </Field>
            <Field label="Tehtävänimike *">
              <Input value={form.role} onChange={(event) => setForm((previous) => ({ ...previous, role: event.target.value }))} placeholder="Esimerkiksi kirvesmies" />
            </Field>
            <Field label="Osasto *">
              <Input value={form.department} onChange={(event) => setForm((previous) => ({ ...previous, department: event.target.value }))} placeholder="Esimerkiksi korjausrakentaminen" />
            </Field>
            <Field label="Puhelin">
              <Input value={form.phone} onChange={(event) => setForm((previous) => ({ ...previous, phone: event.target.value }))} />
            </Field>
            <Field label={form.accountMode === 'invite' ? 'Sähköposti *' : 'Sähköposti'}>
              <Input type="email" value={form.email} onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))} />
            </Field>
            <Field label="Aloituspäivä">
              <Input type="date" value={form.startDate} onChange={(event) => setForm((previous) => ({ ...previous, startDate: event.target.value }))} />
            </Field>
            <Field label="Tila">
              <Select value={form.status} onValueChange={(status: EmployeeStatus) => setForm((previous) => ({ ...previous, status }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EMPLOYEE_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Työsuhdetyyppi">
              <Input value={form.employmentType} onChange={(event) => setForm((previous) => ({ ...previous, employmentType: event.target.value }))} placeholder="Esimerkiksi vakituinen" />
            </Field>
            <Field label="Sisäinen tuntikustannus €/h" hint="Projektien kustannuslaskentaa varten. Tämä ei ole työntekijän tuntipalkka.">
              <Input inputMode="decimal" value={form.hourlyCost} onChange={(event) => setForm((previous) => ({ ...previous, hourlyCost: event.target.value }))} />
            </Field>
            <Field label="Hätäyhteyshenkilö">
              <Input value={form.emergencyContactName} onChange={(event) => setForm((previous) => ({ ...previous, emergencyContactName: event.target.value }))} />
            </Field>
            <Field label="Hätäyhteyshenkilön puhelin">
              <Input value={form.emergencyContactPhone} onChange={(event) => setForm((previous) => ({ ...previous, emergencyContactPhone: event.target.value }))} />
            </Field>
          </div>

          <div className="space-y-4 rounded-xl border border-orange-200 bg-orange-50/60 p-4">
            <div>
              <div className="flex items-center gap-2 font-semibold text-slate-950">
                <BadgeEuro size={18} className="text-orange-600" /> Palkka
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-700">Valitse palkkatapa. Tieto tallennetaan suoraan henkilön voimassa oleviin palkkaehtoihin.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Palkkatapa *">
                <Select value={form.payType} onValueChange={(value) => setForm((previous) => ({ ...previous, payType: value === 'Tuntipalkka' ? 'Tuntipalkka' : 'Kuukausipalkka', payAmount: '' }))}>
                  <SelectTrigger><SelectValue placeholder="Valitse palkkatapa" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tuntipalkka">Tuntipalkka</SelectItem>
                    <SelectItem value="Kuukausipalkka">Kuukausipalkka</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={form.payType === 'Tuntipalkka' ? 'Tuntipalkka €/h *' : form.payType === 'Kuukausipalkka' ? 'Kuukausipalkka €/kk *' : 'Palkan määrä € *'}>
                <Input inputMode="decimal" disabled={!form.payType} value={form.payAmount} onChange={(event) => setForm((previous) => ({ ...previous, payAmount: event.target.value }))} placeholder={form.payType === 'Tuntipalkka' ? 'Esimerkiksi 18,75' : 'Esimerkiksi 3250'} />
              </Field>
              <Field label="Viikkotyöaika *">
                <Input inputMode="decimal" value={form.weeklyHours} onChange={(event) => setForm((previous) => ({ ...previous, weeklyHours: event.target.value }))} />
              </Field>
              <Field label="Palkkakausi *">
                <Input value={form.payPeriod} onChange={(event) => setForm((previous) => ({ ...previous, payPeriod: event.target.value }))} placeholder="Esimerkiksi Kuukausi tai 2 viikkoa" />
              </Field>
            </div>
            <div className="rounded-lg border border-orange-200 bg-white/80 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-orange-700">Tallennettava palkka</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">{payPreview(form.payType, payAmountCents)}</p>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center gap-2 font-semibold"><ShieldCheck size={17} className="text-primary" />Sovelluksen käyttö</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Käyttäjätili">
                <Select value={form.accountMode} onValueChange={(accountMode: AccountMode) => setForm((previous) => ({ ...previous, accountMode }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invite">Luo tili ja lähetä kutsu</SelectItem>
                    <SelectItem value="record_only">Vain henkilöstökortti</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {form.accountMode === 'invite' && (
                <Field label="Käyttöoikeusrooli *">
                  <Select value={form.accessRole} onValueChange={(accessRole: InternalRole) => setForm((previous) => ({ ...previous, accessRole }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{INTERNAL_ROLES.map((role) => <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div>
              <div className="flex items-center gap-2 font-semibold"><UserRoundCheck size={17} className="text-primary" />Tiimi ja esihenkilö</div>
              <p className="mt-1 text-sm leading-6 text-text-secondary">Valitse työntekijälle vastuullinen työnjohtaja.</p>
            </div>
            <Select value={form.supervisorUserId} onValueChange={(supervisorUserId) => setForm((previous) => ({ ...previous, supervisorUserId }))}>
              <SelectTrigger><SelectValue placeholder="Valitse esihenkilö" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Ei nimettyä esihenkilöä</SelectItem>
                {supervisors.map((supervisor) => <SelectItem key={supervisor.userId} value={supervisor.userId}>{supervisor.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Peruuta</Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
              {saving ? 'Tallennetaan…' : form.accountMode === 'invite' ? 'Luo henkilö ja lähetä kutsu' : 'Luo henkilöstökortti'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
