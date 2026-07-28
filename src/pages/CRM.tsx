import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  LayoutDashboard,
  ListChecks,
  Plus,
  Target,
  UserRoundCheck,
} from 'lucide-react';

import CRMFull from './CRMFull';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCustomerRelations } from '@/hooks/useCustomerRelations';
import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import {
  completeCrmActivity,
  createCrmActivity,
  type CrmActivity,
  type CrmActivityPriority,
} from '@/lib/supabase/customerRelations';
import type { CrmLead, Customer } from '@/types';

const ACTIVE_STAGE_BLOCKLIST = new Set(['Voitettu', 'Hävitty']);
const DAY_MS = 86_400_000;

type WorkspaceMode = 'focus' | 'full';
type FocusFilter = 'all' | 'today' | 'overdue' | 'missing' | 'stale' | 'decisions';
type OwnerScope = 'all' | 'mine';

type FocusItem = {
  id: string;
  kind: 'activity' | 'lead';
  title: string;
  context: string;
  reason: string;
  category: Exclude<FocusFilter, 'all'>;
  dueAt?: string;
  owner?: string;
  value?: number;
  score: number;
  activity?: CrmActivity;
};

interface QuickLeadForm {
  name: string;
  customerId: string;
  value: string;
  assigneeUserId: string;
  nextAction: string;
  nextActionDueAt: string;
}

interface QuickTaskForm {
  leadId: string;
  subject: string;
  dueAt: string;
  assignedUserId: string;
  priority: CrmActivityPriority;
  description: string;
}

const emptyLeadForm = (): QuickLeadForm => ({
  name: '',
  customerId: '',
  value: '',
  assigneeUserId: '',
  nextAction: '',
  nextActionDueAt: '',
});

const emptyTaskForm = (): QuickTaskForm => ({
  leadId: '',
  subject: '',
  dueAt: '',
  assignedUserId: '',
  priority: 'Normaali',
  description: '',
});

function money(value: number) {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function parseMoney(value: string) {
  return Number(value.replace(/\s/g, '').replace(',', '.'));
}

function dateTime(value?: string) {
  if (!value) return 'Ei määräaikaa';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

function isPast(value?: string) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time < Date.now();
}

function isToday(value?: string) {
  if (!value) return false;
  const parsed = new Date(value);
  const today = new Date();
  return parsed.getFullYear() === today.getFullYear()
    && parsed.getMonth() === today.getMonth()
    && parsed.getDate() === today.getDate();
}

function daysSince(value?: string) {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - time) / DAY_MS);
}

function isWithinDays(value: string | undefined, days: number) {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;
  const diff = time - Date.now();
  return diff >= 0 && diff <= days * DAY_MS;
}

function defaultDueAt() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setHours(9, 0, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function focusTone(category: FocusItem['category']) {
  if (category === 'overdue') return 'border-red-200 bg-red-50 text-red-700';
  if (category === 'today') return 'border-cyan-200 bg-cyan-50 text-cyan-700';
  if (category === 'missing') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (category === 'stale') return 'border-slate-200 bg-slate-100 text-slate-700';
  return 'border-blue-200 bg-blue-50 text-blue-700';
}

function focusLabel(category: FocusItem['category']) {
  if (category === 'overdue') return 'Myöhässä';
  if (category === 'today') return 'Tänään';
  if (category === 'missing') return 'Täydennettävä';
  if (category === 'stale') return 'Hiljentynyt';
  return 'Päätös tulossa';
}

function customerName(customer: Customer | undefined, lead: CrmLead) {
  return customer?.name || lead.company || 'Ei asiakasta';
}

export default function CRM() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const {
    crmLeads,
    customers,
    addCrmLead,
    operationError: domainError,
  } = useAppDataContext();
  const relations = useCustomerRelations();
  const { people } = useRoleWorkspace();

  const [mode, setMode] = useState<WorkspaceMode>('focus');
  const [focusFilter, setFocusFilter] = useState<FocusFilter>('all');
  const [ownerScope, setOwnerScope] = useState<OwnerScope>('all');
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [leadForm, setLeadForm] = useState<QuickLeadForm>(emptyLeadForm);
  const [taskForm, setTaskForm] = useState<QuickTaskForm>(emptyTaskForm);
  const [saving, setSaving] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);

  const activeLeads = useMemo(
    () => crmLeads.filter((lead) => !ACTIVE_STAGE_BLOCKLIST.has(lead.stage)),
    [crmLeads],
  );
  const openActivities = useMemo(
    () => relations.activities.filter((activity) => !activity.completedAt),
    [relations.activities],
  );

  const scopedLeads = useMemo(() => ownerScope === 'mine'
    ? activeLeads.filter((lead) => lead.assigneeUserId === user?.id)
    : activeLeads,
  [activeLeads, ownerScope, user?.id]);

  const scopedActivities = useMemo(() => ownerScope === 'mine'
    ? openActivities.filter((activity) => activity.assignedUserId === user?.id)
    : openActivities,
  [openActivities, ownerScope, user?.id]);

  const focusItems = useMemo(() => {
    const items: FocusItem[] = [];

    scopedActivities.forEach((activity) => {
      const lead = crmLeads.find((item) => item.id === activity.leadId);
      const customer = customers.find((item) => item.id === activity.customerId || item.id === lead?.customerId);
      const owner = people.find((person) => person.userId === activity.assignedUserId)?.name;
      if (activity.dueAt && isPast(activity.dueAt)) {
        items.push({
          id: `activity-${activity.id}`,
          kind: 'activity',
          title: activity.subject,
          context: lead?.name || customer?.name || activity.activityType,
          reason: `Tehtävä erääntyi ${dateTime(activity.dueAt)}`,
          category: 'overdue',
          dueAt: activity.dueAt,
          owner,
          score: 120,
          activity,
        });
      } else if (isToday(activity.dueAt)) {
        items.push({
          id: `activity-today-${activity.id}`,
          kind: 'activity',
          title: activity.subject,
          context: lead?.name || customer?.name || activity.activityType,
          reason: `Tehtävä erääntyy tänään ${dateTime(activity.dueAt)}`,
          category: 'today',
          dueAt: activity.dueAt,
          owner,
          score: 105,
          activity,
        });
      }
    });

    scopedLeads.forEach((lead) => {
      const customer = customers.find((item) => item.id === lead.customerId);
      const context = `${customerName(customer, lead)} · ${lead.stage}`;
      const owner = lead.assignee || people.find((person) => person.userId === lead.assigneeUserId)?.name;
      const overdue = Boolean(lead.nextActionDueAt && isPast(lead.nextActionDueAt));
      const missingNextAction = !lead.nextAction || !lead.nextActionDueAt || !lead.assigneeUserId;
      const stale = daysSince(lead.lastActivityAt || lead.date) > 7;
      const decisionSoon = isWithinDays(lead.expectedDecisionDate, 14);

      if (overdue) {
        items.push({
          id: `lead-overdue-${lead.id}`,
          kind: 'lead',
          title: lead.nextAction || lead.name,
          context,
          reason: `Seuraava toimenpide on myöhässä: ${dateTime(lead.nextActionDueAt)}`,
          category: 'overdue',
          dueAt: lead.nextActionDueAt,
          owner,
          value: lead.value,
          score: 110 + Math.min(20, Math.round(lead.value / 10_000)),
        });
        return;
      }
      if (isToday(lead.nextActionDueAt)) {
        items.push({
          id: `lead-today-${lead.id}`,
          kind: 'lead',
          title: lead.nextAction || lead.name,
          context,
          reason: `Seuraava toimenpide erääntyy tänään ${dateTime(lead.nextActionDueAt)}`,
          category: 'today',
          dueAt: lead.nextActionDueAt,
          owner,
          value: lead.value,
          score: 100 + Math.min(20, Math.round(lead.value / 10_000)),
        });
        return;
      }
      if (missingNextAction) {
        const gaps = [
          !lead.assigneeUserId ? 'vastuuhenkilö' : '',
          !lead.nextAction ? 'seuraava toimenpide' : '',
          !lead.nextActionDueAt ? 'määräaika' : '',
        ].filter(Boolean).join(', ');
        items.push({
          id: `lead-missing-${lead.id}`,
          kind: 'lead',
          title: lead.name,
          context,
          reason: `Puuttuu: ${gaps}`,
          category: 'missing',
          owner,
          value: lead.value,
          score: 90 + Math.min(20, Math.round(lead.value / 10_000)),
        });
        return;
      }
      if (stale) {
        items.push({
          id: `lead-stale-${lead.id}`,
          kind: 'lead',
          title: lead.name,
          context,
          reason: `${daysSince(lead.lastActivityAt || lead.date)} päivää ilman kirjattua etenemistä`,
          category: 'stale',
          owner,
          value: lead.value,
          score: 70 + Math.min(20, Math.round(lead.value / 10_000)),
        });
        return;
      }
      if (decisionSoon) {
        items.push({
          id: `lead-decision-${lead.id}`,
          kind: 'lead',
          title: lead.name,
          context,
          reason: `Arvioitu päätös ${new Date(`${lead.expectedDecisionDate}T12:00:00`).toLocaleDateString('fi-FI')}`,
          category: 'decisions',
          owner,
          value: lead.value,
          score: 55 + Math.min(20, Math.round(lead.value / 10_000)),
        });
      }
    });

    return items.sort((a, b) => b.score - a.score);
  }, [scopedActivities, scopedLeads, crmLeads, customers, people]);

  const filteredFocusItems = focusFilter === 'all'
    ? focusItems
    : focusItems.filter((item) => item.category === focusFilter);

  const todayCount = focusItems.filter((item) => item.category === 'today').length;
  const overdueCount = focusItems.filter((item) => item.category === 'overdue').length;
  const missingCount = focusItems.filter((item) => item.category === 'missing').length;
  const staleCount = focusItems.filter((item) => item.category === 'stale').length;
  const decisionCount = focusItems.filter((item) => item.category === 'decisions').length;
  const weightedPipeline = scopedLeads.reduce(
    (sum, lead) => sum + lead.value * ((lead.probability ?? 10) / 100),
    0,
  );

  const nextSevenDays = useMemo(() => {
    const items = scopedActivities
      .filter((activity) => activity.dueAt && !isPast(activity.dueAt) && isWithinDays(activity.dueAt, 7))
      .map((activity) => ({
        id: activity.id,
        title: activity.subject,
        dueAt: activity.dueAt,
        owner: people.find((person) => person.userId === activity.assignedUserId)?.name,
        priority: activity.priority,
        activity,
      }));
    return items.sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? '')).slice(0, 8);
  }, [scopedActivities, people]);

  const visibleError = operationError ?? domainError ?? relations.error;

  const openQuickLead = () => {
    const next = emptyLeadForm();
    next.assigneeUserId = user?.id ?? '';
    next.nextActionDueAt = defaultDueAt();
    setLeadForm(next);
    setOperationError(null);
    setLeadDialogOpen(true);
  };

  const openQuickTask = () => {
    const next = emptyTaskForm();
    next.assignedUserId = user?.id ?? '';
    next.dueAt = defaultDueAt();
    setTaskForm(next);
    setOperationError(null);
    setTaskDialogOpen(true);
  };

  const saveQuickLead = async () => {
    const value = parseMoney(leadForm.value || '0');
    if (!leadForm.name.trim()) {
      setOperationError('Anna myyntimahdollisuudelle nimi.');
      return;
    }
    if (!Number.isFinite(value) || value < 0) {
      setOperationError('Anna kelvollinen myyntiarvo.');
      return;
    }
    if (!leadForm.nextAction.trim() || !leadForm.nextActionDueAt) {
      setOperationError('Määritä seuraava toimenpide ja sen määräaika.');
      return;
    }
    const customer = customers.find((item) => item.id === leadForm.customerId);
    const assignee = people.find((person) => person.userId === leadForm.assigneeUserId);
    setSaving(true);
    setOperationError(null);
    try {
      await addCrmLead({
        name: leadForm.name.trim(),
        company: customer?.name ?? '',
        customerId: customer?.id,
        value,
        estimatedCost: 0,
        stage: 'Uusi',
        assignee: assignee?.name ?? '',
        assigneeUserId: assignee?.userId,
        probability: 10,
        nextAction: leadForm.nextAction.trim(),
        nextActionDueAt: new Date(leadForm.nextActionDueAt).toISOString(),
        date: new Date().toISOString().slice(0, 10),
      });
      setLeadDialogOpen(false);
      setLeadForm(emptyLeadForm());
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Myyntimahdollisuuden tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const saveQuickTask = async () => {
    if (!currentOrg) return;
    if (!taskForm.leadId) {
      setOperationError('Valitse tehtävälle myyntimahdollisuus.');
      return;
    }
    if (!taskForm.subject.trim()) {
      setOperationError('Anna tehtävälle otsikko.');
      return;
    }
    if (!taskForm.dueAt) {
      setOperationError('Aseta tehtävälle määräaika.');
      return;
    }
    const lead = crmLeads.find((item) => item.id === taskForm.leadId);
    setSaving(true);
    setOperationError(null);
    try {
      await createCrmActivity({
        organizationId: currentOrg.id,
        leadId: lead?.id,
        customerId: lead?.customerId,
        siteId: lead?.siteId,
        userId: user?.id,
        assignedUserId: taskForm.assignedUserId || user?.id,
        activityType: 'Tehtävä',
        subject: taskForm.subject.trim(),
        description: taskForm.description.trim() || undefined,
        priority: taskForm.priority,
        dueAt: new Date(taskForm.dueAt).toISOString(),
      });
      await relations.refresh();
      setTaskDialogOpen(false);
      setTaskForm(emptyTaskForm());
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'CRM-tehtävän tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const completeActivity = async (activity: CrmActivity) => {
    if (!currentOrg) return;
    setSaving(true);
    setOperationError(null);
    try {
      await completeCrmActivity(currentOrg.id, activity.id, user?.id);
      await relations.refresh();
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tehtävän kuittaus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  if (mode === 'full') {
    return (
      <div className="space-y-4 pb-10">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-text-primary">Laaja CRM-hallinta</p>
              <p className="text-sm text-text-secondary">Myyntiputki, asiakkaat, kohteet, yhteyshenkilöt, takuuasiat ja analyysi.</p>
            </div>
            <Button variant="outline" onClick={() => setMode('focus')}>Palaa työpöydälle</Button>
          </CardContent>
        </Card>
        <CRMFull />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-10">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
            <LayoutDashboard size={16} />
            Päivittäinen asiakkuus- ja myyntityö
          </div>
          <h1 className="text-hero text-text-primary">CRM-työpöytä</h1>
          <p className="mt-1 max-w-3xl text-body-sm text-text-secondary">
            Näe ensin asiat, joihin pitää reagoida. Laaja CRM-hallinta on erikseen, jotta päivittäinen työ ei huku rekistereihin ja raportteihin.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={openQuickLead}><Plus size={16} className="mr-2" />Uusi mahdollisuus</Button>
          <Button variant="outline" onClick={openQuickTask}><ListChecks size={16} className="mr-2" />Uusi tehtävä</Button>
          <Button variant="outline" onClick={() => setMode('full')}><BriefcaseBusiness size={16} className="mr-2" />Avaa koko CRM</Button>
        </div>
      </div>

      {visibleError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{visibleError}</span>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-semibold text-text-primary">Työjono</p>
              <p className="text-sm text-text-secondary">Järjestetty kiireellisyyden, puutteiden ja kaupan arvon perusteella.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant={ownerScope === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setOwnerScope('all')}>Kaikki</Button>
              <Button variant={ownerScope === 'mine' ? 'default' : 'outline'} size="sm" onClick={() => setOwnerScope('mine')} disabled={!user?.id}>Omat</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { filter: 'today' as const, label: 'Tänään', value: todayCount, detail: 'Määräaika tänään', icon: CalendarClock },
          { filter: 'overdue' as const, label: 'Myöhässä', value: overdueCount, detail: 'Vaatii välittömän reagoinnin', icon: AlertTriangle },
          { filter: 'missing' as const, label: 'Täydennettävä', value: missingCount, detail: 'Omistaja tai seuraava askel puuttuu', icon: Target },
          { filter: 'stale' as const, label: 'Hiljentyneet', value: staleCount, detail: 'Yli 7 päivää ilman etenemistä', icon: Clock3 },
          { filter: 'decisions' as const, label: 'Painotettu ennuste', value: money(weightedPipeline), detail: `${decisionCount} päätöstä 14 päivän sisällä`, icon: CircleDollarSign },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => setFocusFilter(item.filter)}
            className={`rounded-xl border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm ${focusFilter === item.filter ? 'border-primary ring-1 ring-primary/20' : ''}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-text-secondary">{item.label}</p>
                <p className="mt-2 break-words font-mono text-2xl font-bold text-text-primary">{item.value}</p>
                <p className="mt-1 text-xs text-text-muted">{item.detail}</p>
              </div>
              <div className="rounded-xl bg-primary/10 p-2 text-primary"><item.icon size={19} /></div>
            </div>
          </button>
        ))}
      </div>

      {crmLeads.length === 0 && relations.activities.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 sm:p-10">
            <div className="mx-auto max-w-3xl text-center">
              <BriefcaseBusiness size={46} className="mx-auto mb-4 text-primary" />
              <h2 className="text-xl font-semibold text-text-primary">CRM on valmis käyttöön</h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                Aloita yhdestä myyntimahdollisuudesta. VaKantti nostaa sen jälkeen työpöydälle myöhästyneet tehtävät, puuttuvat seuraavat askeleet ja lähestyvät päätökset.
              </p>
              <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
                <div className="rounded-xl border p-4"><p className="font-semibold">1. Kirjaa mahdollisuus</p><p className="mt-1 text-sm text-text-secondary">Asiakas, arvo ja vastuuhenkilö.</p></div>
                <div className="rounded-xl border p-4"><p className="font-semibold">2. Aseta seuraava askel</p><p className="mt-1 text-sm text-text-secondary">Mitä tehdään ja mihin mennessä.</p></div>
                <div className="rounded-xl border p-4"><p className="font-semibold">3. Vie kauppa projektiksi</p><p className="mt-1 text-sm text-text-secondary">Voitettu mahdollisuus voidaan muuttaa projektiksi.</p></div>
              </div>
              <Button className="mt-6" onClick={openQuickLead}><Plus size={16} className="mr-2" />Luo ensimmäinen mahdollisuus</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <Card>
            <CardContent className="p-0">
              <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold text-text-primary">Seuraavaksi tehtävät asiat</h2>
                  <p className="text-xs text-text-secondary">Korkein prioriteetti näkyy ensin.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['all', 'Kaikki'],
                    ['today', `Tänään ${todayCount}`],
                    ['overdue', `Myöhässä ${overdueCount}`],
                    ['missing', `Täydennä ${missingCount}`],
                    ['stale', `Hiljentyneet ${staleCount}`],
                    ['decisions', `Päätökset ${decisionCount}`],
                  ].map(([value, label]) => (
                    <Button key={value} size="sm" variant={focusFilter === value ? 'default' : 'outline'} onClick={() => setFocusFilter(value as FocusFilter)}>{label}</Button>
                  ))}
                </div>
              </div>
              <div className="divide-y">
                {filteredFocusItems.slice(0, 12).map((item) => (
                  <div key={item.id} className="grid gap-3 px-5 py-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
                    <div className={`rounded-lg border p-2 ${focusTone(item.category)}`}>
                      {item.kind === 'activity' ? <ListChecks size={18} /> : <Target size={18} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words font-semibold text-text-primary">{item.title}</p>
                        <Badge variant="outline" className={focusTone(item.category)}>{focusLabel(item.category)}</Badge>
                      </div>
                      <p className="mt-1 break-words text-sm text-text-secondary">{item.context}</p>
                      <p className="mt-1 break-words text-xs text-text-muted">{item.reason}{item.owner ? ` · ${item.owner}` : ''}</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {typeof item.value === 'number' && <span className="font-mono text-sm font-bold">{money(item.value)}</span>}
                      {item.activity ? (
                        <Button size="sm" variant="outline" className="text-emerald-700" disabled={saving} onClick={() => void completeActivity(item.activity as CrmActivity)}>
                          <CheckCircle2 size={15} className="mr-2" />Valmis
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setMode('full')}>Avaa <ArrowRight size={15} className="ml-2" /></Button>
                      )}
                    </div>
                  </div>
                ))}
                {filteredFocusItems.length === 0 && (
                  <div className="p-10 text-center">
                    <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-600" />
                    <p className="font-semibold text-text-primary">Ei asioita valitulla rajauksella</p>
                    <p className="mt-1 text-sm text-text-secondary">Työjono on tältä osin kunnossa.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardContent className="p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-text-primary">Seuraavat 7 päivää</h2>
                    <p className="text-xs text-text-secondary">Avoimet CRM-tehtävät aikajärjestyksessä.</p>
                  </div>
                  <CalendarClock size={20} className="text-primary" />
                </div>
                <div className="space-y-3">
                  {nextSevenDays.map((item) => (
                    <div key={item.id} className="rounded-xl border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="break-words text-sm font-semibold">{item.title}</p>
                        <Badge variant="outline">{item.priority}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-text-secondary">{dateTime(item.dueAt)}{item.owner ? ` · ${item.owner}` : ''}</p>
                      <Button className="mt-3" size="sm" variant="ghost" disabled={saving} onClick={() => void completeActivity(item.activity)}>
                        <CheckCircle2 size={15} className="mr-2" />Merkitse valmiiksi
                      </Button>
                    </div>
                  ))}
                  {nextSevenDays.length === 0 && <p className="rounded-lg bg-muted/50 p-4 text-sm text-text-secondary">Ei tulevia CRM-tehtäviä seuraavan viikon aikana.</p>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-text-primary">Tarjouskannan terveystarkistus</h2>
                    <p className="text-xs text-text-secondary">Tiedot, joiden puute heikentää ennustetta.</p>
                  </div>
                  <UserRoundCheck size={20} className="text-primary" />
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3"><span className="text-text-secondary">Avoimia mahdollisuuksia</span><strong>{scopedLeads.length}</strong></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-text-secondary">Ilman vastuuhenkilöä</span><strong>{scopedLeads.filter((lead) => !lead.assigneeUserId).length}</strong></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-text-secondary">Ilman päätöspäivää</span><strong>{scopedLeads.filter((lead) => !lead.expectedDecisionDate).length}</strong></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-text-secondary">Ilman myyntilähdettä</span><strong>{scopedLeads.filter((lead) => !lead.source).length}</strong></div>
                </div>
                <Button variant="outline" className="mt-5 w-full" onClick={() => setMode('full')}>Avaa myyntiputki ja täydennä tiedot</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Dialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Uusi myyntimahdollisuus</DialogTitle></DialogHeader>
          <p className="text-sm leading-6 text-text-secondary">Kirjaa vain päätöksenteon kannalta olennaiset tiedot. Muut tiedot voi täydentää myöhemmin laajassa CRM:ssä.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Nimi *</Label><Input value={leadForm.name} onChange={(event) => setLeadForm((previous) => ({ ...previous, name: event.target.value }))} placeholder="Esim. As Oy Mallikuja – kylpyhuoneremontit" /></div>
            <div className="space-y-2"><Label>Asiakas</Label><Select value={leadForm.customerId || 'none'} onValueChange={(value) => setLeadForm((previous) => ({ ...previous, customerId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei vielä asiakaslinkkiä</SelectItem>{customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Arvioitu myyntiarvo €</Label><Input inputMode="decimal" value={leadForm.value} onChange={(event) => setLeadForm((previous) => ({ ...previous, value: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Vastuuhenkilö</Label><Select value={leadForm.assigneeUserId || 'none'} onValueChange={(value) => setLeadForm((previous) => ({ ...previous, assigneeUserId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei vastuuhenkilöä</SelectItem>{people.map((person) => <SelectItem key={person.userId} value={person.userId}>{person.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Seuraavan toimenpiteen määräaika *</Label><Input type="datetime-local" value={leadForm.nextActionDueAt} onChange={(event) => setLeadForm((previous) => ({ ...previous, nextActionDueAt: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Seuraava toimenpide *</Label><Input value={leadForm.nextAction} onChange={(event) => setLeadForm((previous) => ({ ...previous, nextAction: event.target.value }))} placeholder="Esim. Soita tilaajalle ja sovi kartoitus" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setLeadDialogOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void saveQuickLead()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Luo mahdollisuus'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Uusi CRM-tehtävä</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Tehtävän otsikko *</Label><Input value={taskForm.subject} onChange={(event) => setTaskForm((previous) => ({ ...previous, subject: event.target.value }))} placeholder="Esim. Varmista tarjouspalaverin aika" /></div>
            <div className="space-y-2"><Label>Myyntimahdollisuus *</Label><Select value={taskForm.leadId || 'none'} onValueChange={(value) => setTaskForm((previous) => ({ ...previous, leadId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Valitse mahdollisuus</SelectItem>{activeLeads.map((lead) => <SelectItem key={lead.id} value={lead.id}>{lead.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Vastuuhenkilö</Label><Select value={taskForm.assignedUserId || 'none'} onValueChange={(value) => setTaskForm((previous) => ({ ...previous, assignedUserId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei vastuuhenkilöä</SelectItem>{people.map((person) => <SelectItem key={person.userId} value={person.userId}>{person.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Määräaika *</Label><Input type="datetime-local" value={taskForm.dueAt} onChange={(event) => setTaskForm((previous) => ({ ...previous, dueAt: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Prioriteetti</Label><Select value={taskForm.priority} onValueChange={(value: CrmActivityPriority) => setTaskForm((previous) => ({ ...previous, priority: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(['Matala', 'Normaali', 'Korkea', 'Kriittinen'] as CrmActivityPriority[]).map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 sm:col-span-2"><Label>Lisätiedot</Label><Textarea value={taskForm.description} onChange={(event) => setTaskForm((previous) => ({ ...previous, description: event.target.value }))} rows={4} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setTaskDialogOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void saveQuickTask()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Luo tehtävä'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
