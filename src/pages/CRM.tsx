import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
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
import { useOffersData } from '@/hooks/useOffersData';
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
  owner?: string;
  value?: number;
  score: number;
  activity?: CrmActivity;
  lead?: CrmLead;
};

interface QuickLeadForm {
  name: string;
  customerId: string;
  company: string;
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
  company: '',
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

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateOnly(value?: string) {
  if (!value) return 'Ei asetettu';
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
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

function isDatePast(value?: string) {
  return Boolean(value && value.slice(0, 10) < localDateKey());
}

function isDateToday(value?: string) {
  return Boolean(value && value.slice(0, 10) === localDateKey());
}

function daysSince(value?: string) {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - time) / DAY_MS);
}

function isWithinDays(value: string | undefined, days: number) {
  if (!value) return false;
  const time = new Date(`${value.slice(0, 10)}T12:00:00`).getTime();
  if (!Number.isFinite(time)) return false;
  const diff = time - Date.now();
  return diff >= 0 && diff <= days * DAY_MS;
}

function defaultDueAt() {
  const date = new Date(Date.now() + DAY_MS);
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const {
    crmLeads,
    customers,
    addCrmLead,
    operationError: domainError,
  } = useAppDataContext();
  const relations = useCustomerRelations();
  const offers = useOffersData();
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
  const scopedLeads = useMemo(
    () => ownerScope === 'mine'
      ? activeLeads.filter((lead) => lead.assigneeUserId === user?.id)
      : activeLeads,
    [activeLeads, ownerScope, user?.id],
  );
  const scopedActivities = useMemo(
    () => ownerScope === 'mine'
      ? openActivities.filter((activity) => activity.assignedUserId === user?.id)
      : openActivities,
    [openActivities, ownerScope, user?.id],
  );

  const focusItems = useMemo(() => {
    const items: FocusItem[] = [];

    scopedActivities.forEach((activity) => {
      const lead = crmLeads.find((item) => item.id === activity.leadId);
      const customer = customers.find((item) => item.id === activity.customerId || item.id === lead?.customerId);
      const owner = people.find((person) => person.userId === activity.assignedUserId)?.name;
      const common = {
        kind: 'activity' as const,
        title: activity.subject,
        context: lead?.name || customer?.name || activity.activityType,
        owner,
        activity,
      };
      if (activity.dueAt && isPast(activity.dueAt)) {
        items.push({
          ...common,
          id: `activity-overdue-${activity.id}`,
          reason: `Tehtävä erääntyi ${dateTime(activity.dueAt)}`,
          category: 'overdue',
          score: 125,
        });
      } else if (isToday(activity.dueAt)) {
        items.push({
          ...common,
          id: `activity-today-${activity.id}`,
          reason: `Tehtävä erääntyy tänään ${dateTime(activity.dueAt)}`,
          category: 'today',
          score: 110,
        });
      }
    });

    scopedLeads.forEach((lead) => {
      const customer = customers.find((item) => item.id === lead.customerId);
      const context = `${customerName(customer, lead)} · ${lead.stage}`;
      const owner = lead.assignee || people.find((person) => person.userId === lead.assigneeUserId)?.name;
      const valueScore = Math.min(20, Math.round(lead.value / 10_000));

      if (lead.stage === 'Jäissä') {
        if (isDatePast(lead.frozenUntil) || isDateToday(lead.frozenUntil)) {
          const overdue = isDatePast(lead.frozenUntil);
          items.push({
            id: `lead-frozen-${lead.id}`,
            kind: 'lead',
            title: `Tarkista jäissä oleva mahdollisuus: ${lead.name}`,
            context,
            reason: `Tarkistuspäivä ${dateOnly(lead.frozenUntil)}`,
            category: overdue ? 'overdue' : 'today',
            owner,
            value: lead.value,
            score: (overdue ? 115 : 102) + valueScore,
            lead,
          });
        }
        return;
      }

      if (lead.nextActionDueAt && isPast(lead.nextActionDueAt)) {
        items.push({
          id: `lead-overdue-${lead.id}`,
          kind: 'lead',
          title: lead.nextAction || lead.name,
          context,
          reason: `Seuraava toimenpide on myöhässä: ${dateTime(lead.nextActionDueAt)}`,
          category: 'overdue',
          owner,
          value: lead.value,
          score: 112 + valueScore,
          lead,
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
          owner,
          value: lead.value,
          score: 103 + valueScore,
          lead,
        });
        return;
      }

      const missing = [
        !lead.assigneeUserId ? 'vastuuhenkilö' : '',
        !lead.nextAction ? 'seuraava toimenpide' : '',
        !lead.nextActionDueAt ? 'määräaika' : '',
      ].filter(Boolean);
      if (missing.length > 0) {
        items.push({
          id: `lead-missing-${lead.id}`,
          kind: 'lead',
          title: lead.name,
          context,
          reason: `Puuttuu: ${missing.join(', ')}`,
          category: 'missing',
          owner,
          value: lead.value,
          score: 92 + valueScore,
          lead,
        });
        return;
      }

      if (daysSince(lead.lastActivityAt || lead.date) > 7) {
        items.push({
          id: `lead-stale-${lead.id}`,
          kind: 'lead',
          title: lead.name,
          context,
          reason: `${daysSince(lead.lastActivityAt || lead.date)} päivää ilman kirjattua etenemistä`,
          category: 'stale',
          owner,
          value: lead.value,
          score: 72 + valueScore,
          lead,
        });
        return;
      }

      if (isWithinDays(lead.expectedDecisionDate, 14)) {
        items.push({
          id: `lead-decision-${lead.id}`,
          kind: 'lead',
          title: lead.name,
          context,
          reason: `Arvioitu päätös ${dateOnly(lead.expectedDecisionDate)}`,
          category: 'decisions',
          owner,
          value: lead.value,
          score: 56 + valueScore,
          lead,
        });
      }
    });

    return items.sort((a, b) => b.score - a.score);
  }, [scopedActivities, scopedLeads, crmLeads, customers, people]);

  const filteredFocusItems = focusFilter === 'all'
    ? focusItems
    : focusItems.filter((item) => item.category === focusFilter);
  const categoryCounts = {
    today: focusItems.filter((item) => item.category === 'today').length,
    overdue: focusItems.filter((item) => item.category === 'overdue').length,
    missing: focusItems.filter((item) => item.category === 'missing').length,
    stale: focusItems.filter((item) => item.category === 'stale').length,
    decisions: focusItems.filter((item) => item.category === 'decisions').length,
  };
  const totalPipeline = scopedLeads.reduce((sum, lead) => sum + lead.value, 0);
  const weightedPipeline = scopedLeads.reduce(
    (sum, lead) => sum + lead.value * ((lead.probability ?? 10) / 100),
    0,
  );
  const estimatedMargin = scopedLeads.reduce(
    (sum, lead) => sum + Math.max(0, lead.value - (lead.estimatedCost ?? 0)),
    0,
  );

  const nextSevenDays = useMemo(() => scopedActivities
    .filter((activity) => activity.dueAt && !isPast(activity.dueAt) && isWithinDays(activity.dueAt, 7))
    .map((activity) => ({
      id: activity.id,
      title: activity.subject,
      dueAt: activity.dueAt,
      owner: people.find((person) => person.userId === activity.assignedUserId)?.name,
      priority: activity.priority,
      activity,
    }))
    .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''))
    .slice(0, 8), [scopedActivities, people]);

  const visibleError = operationError ?? domainError ?? relations.error ?? offers.error;

  const openQuickLead = () => {
    const next = emptyLeadForm();
    next.assigneeUserId = user?.id ?? '';
    next.nextActionDueAt = defaultDueAt();
    setLeadForm(next);
    setOperationError(null);
    setLeadDialogOpen(true);
  };

  const openQuickTask = (leadId = '') => {
    const lead = crmLeads.find((item) => item.id === leadId);
    const next = emptyTaskForm();
    next.leadId = leadId;
    next.subject = lead?.nextAction ?? '';
    next.assignedUserId = lead?.assigneeUserId ?? user?.id ?? '';
    next.dueAt = defaultDueAt();
    setTaskForm(next);
    setOperationError(null);
    setTaskDialogOpen(true);
  };

  const selectLeadCustomer = (customerId: string) => {
    const customer = customers.find((item) => item.id === customerId);
    setLeadForm((previous) => ({
      ...previous,
      customerId,
      company: customer?.name ?? previous.company,
    }));
  };

  const saveQuickLead = async () => {
    const value = parseMoney(leadForm.value || '0');
    if (!leadForm.name.trim()) {
      setOperationError('Anna myyntimahdollisuudelle nimi.');
      return;
    }
    if (!leadForm.customerId && !leadForm.company.trim()) {
      setOperationError('Valitse asiakas tai kirjoita yrityksen tai tilaajan nimi.');
      return;
    }
    if (!leadForm.assigneeUserId) {
      setOperationError('Valitse myyntimahdollisuudelle vastuuhenkilö.');
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
      const saved = await addCrmLead({
        name: leadForm.name.trim(),
        company: customer?.name ?? leadForm.company.trim(),
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
      if (!saved) return;
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
    if (!taskForm.assignedUserId) {
      setOperationError('Valitse tehtävälle vastuuhenkilö.');
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
        assignedUserId: taskForm.assignedUserId,
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

  const openOfferForLead = (lead: CrmLead) => {
    const existing = offers.offers.find((offer) => offer.crmLeadId === lead.id);
    navigate(existing ? `/tarjoukset?offer=${existing.id}` : `/tarjoukset?lead=${lead.id}`);
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
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => navigate('/tarjoukset')}><FileText size={16} className="mr-2" />Tarjoukset</Button>
              <Button onClick={() => setMode('focus')}>Palaa työpöydälle</Button>
            </div>
          </CardContent>
        </Card>
        <CRMFull />
      </div>
    );
  }

  const metricCards = [
    { filter: 'today' as const, label: 'Tänään', value: categoryCounts.today, detail: 'Määräaika tai tarkistuspäivä tänään', icon: CalendarClock },
    { filter: 'overdue' as const, label: 'Myöhässä', value: categoryCounts.overdue, detail: 'Vaatii välittömän reagoinnin', icon: AlertTriangle },
    { filter: 'missing' as const, label: 'Täydennettävä', value: categoryCounts.missing, detail: 'Omistaja tai seuraava askel puuttuu', icon: Target },
    { filter: 'stale' as const, label: 'Hiljentyneet', value: categoryCounts.stale, detail: 'Yli 7 päivää ilman etenemistä', icon: Clock3 },
    { filter: 'decisions' as const, label: 'Päätökset 14 pv', value: categoryCounts.decisions, detail: 'Kaupat, joihin pitää valmistautua', icon: CircleDollarSign },
  ];

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
            Näe ensin asiat, joihin pitää reagoida. Asiakasrekisteri, myyntiputki, tarjoukset, reklamaatiot ja analyysi ovat edelleen yhden painalluksen päässä.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={openQuickLead}><Plus size={16} className="mr-2" />Uusi mahdollisuus</Button>
          <Button variant="outline" onClick={() => openQuickTask()} disabled={activeLeads.length === 0}><ListChecks size={16} className="mr-2" />Uusi tehtävä</Button>
          <Button variant="outline" onClick={() => navigate('/tarjoukset')}><FileText size={16} className="mr-2" />Tarjoukset</Button>
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
              <p className="font-semibold text-text-primary">Priorisoitu työjono</p>
              <p className="text-sm text-text-secondary">Järjestys perustuu kiireellisyyteen, tietopuutteisiin ja kaupan arvoon.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant={ownerScope === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setOwnerScope('all')}>Kaikki</Button>
              <Button variant={ownerScope === 'mine' ? 'default' : 'outline'} size="sm" onClick={() => setOwnerScope('mine')} disabled={!user?.id}>Omat</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metricCards.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => setFocusFilter(item.filter)}
            className={`rounded-xl border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm ${focusFilter === item.filter ? 'border-primary ring-1 ring-primary/20' : ''}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-text-secondary">{item.label}</p>
                <p className="mt-2 font-mono text-2xl font-bold text-text-primary">{item.value}</p>
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
                Aloita yhdestä myyntimahdollisuudesta. VaKantti nostaa sen jälkeen automaattisesti esiin myöhästyneet tehtävät, puuttuvat seuraavat askeleet ja lähestyvät päätökset.
              </p>
              <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
                <div className="rounded-xl border p-4"><p className="font-semibold">1. Kirjaa mahdollisuus</p><p className="mt-1 text-sm text-text-secondary">Asiakas, arvo ja vastuuhenkilö.</p></div>
                <div className="rounded-xl border p-4"><p className="font-semibold">2. Aseta seuraava askel</p><p className="mt-1 text-sm text-text-secondary">Mitä tehdään ja mihin mennessä.</p></div>
                <div className="rounded-xl border p-4"><p className="font-semibold">3. Tarjous ja projekti</p><p className="mt-1 text-sm text-text-secondary">Mahdollisuudesta tarjous ja voitetusta kaupasta projekti.</p></div>
              </div>
              <Button className="mt-6" onClick={openQuickLead}><Plus size={16} className="mr-2" />Luo ensimmäinen mahdollisuus</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <Card>
            <CardContent className="p-0">
              <div className="flex flex-col gap-3 border-b px-5 py-4">
                <div>
                  <h2 className="font-semibold text-text-primary">Seuraavaksi tehtävät asiat</h2>
                  <p className="text-xs text-text-secondary">Korkein prioriteetti näkyy ensin.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['all', 'Kaikki'],
                    ['today', `Tänään ${categoryCounts.today}`],
                    ['overdue', `Myöhässä ${categoryCounts.overdue}`],
                    ['missing', `Täydennä ${categoryCounts.missing}`],
                    ['stale', `Hiljentyneet ${categoryCounts.stale}`],
                    ['decisions', `Päätökset ${categoryCounts.decisions}`],
                  ].map(([value, label]) => (
                    <Button key={value} size="sm" variant={focusFilter === value ? 'default' : 'outline'} onClick={() => setFocusFilter(value as FocusFilter)}>{label}</Button>
                  ))}
                </div>
              </div>
              <div className="divide-y">
                {filteredFocusItems.slice(0, 12).map((item) => {
                  const linkedOffer = item.lead
                    ? offers.offers.find((offer) => offer.crmLeadId === item.lead?.id)
                    : undefined;
                  return (
                    <div key={item.id} className="grid gap-3 px-5 py-4 md:grid-cols-[auto_minmax(0,1fr)]">
                      <div className={`h-fit rounded-lg border p-2 ${focusTone(item.category)}`}>
                        {item.kind === 'activity' ? <ListChecks size={18} /> : <Target size={18} />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-words font-semibold text-text-primary">{item.title}</p>
                          <Badge variant="outline" className={focusTone(item.category)}>{focusLabel(item.category)}</Badge>
                        </div>
                        <p className="mt-1 break-words text-sm text-text-secondary">{item.context}</p>
                        <p className="mt-1 break-words text-xs text-text-muted">{item.reason}{item.owner ? ` · ${item.owner}` : ''}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {typeof item.value === 'number' && <span className="mr-auto font-mono text-sm font-bold">{money(item.value)}</span>}
                          {item.activity && (
                            <Button size="sm" variant="outline" className="text-emerald-700" disabled={saving} onClick={() => void completeActivity(item.activity as CrmActivity)}>
                              <CheckCircle2 size={15} className="mr-2" />Valmis
                            </Button>
                          )}
                          {item.lead && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => openQuickTask(item.lead?.id)}><ListChecks size={15} className="mr-2" />Tehtävä</Button>
                              <Button size="sm" variant="outline" onClick={() => openOfferForLead(item.lead as CrmLead)}><FileText size={15} className="mr-2" />{linkedOffer ? 'Avaa tarjous' : 'Luo tarjous'}</Button>
                              <Button size="sm" onClick={() => setMode('full')}>Avaa CRM <ArrowRight size={15} className="ml-2" /></Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                    <h2 className="font-semibold text-text-primary">Tarjouskannan tilanne</h2>
                    <p className="text-xs text-text-secondary">Avoimet mahdollisuudet valitulla vastuuhenkilörajauksella.</p>
                  </div>
                  <CircleDollarSign size={20} className="text-primary" />
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3"><span className="text-text-secondary">Avoin tarjouskanta</span><strong className="font-mono">{money(totalPipeline)}</strong></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-text-secondary">Painotettu ennuste</span><strong className="font-mono">{money(weightedPipeline)}</strong></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-text-secondary">Arvioitu kate</span><strong className="font-mono">{money(estimatedMargin)}</strong></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-text-secondary">Avoimia mahdollisuuksia</span><strong>{scopedLeads.length}</strong></div>
                </div>
                <Button variant="outline" className="mt-5 w-full" onClick={() => navigate('/tarjoukset')}>Avaa tarjoukset</Button>
              </CardContent>
            </Card>

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
                    <h2 className="font-semibold text-text-primary">Tietojen terveystarkistus</h2>
                    <p className="text-xs text-text-secondary">Puutteet, jotka heikentävät tekemistä ja ennustetta.</p>
                  </div>
                  <UserRoundCheck size={20} className="text-primary" />
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3"><span className="text-text-secondary">Ilman vastuuhenkilöä</span><strong>{scopedLeads.filter((lead) => !lead.assigneeUserId).length}</strong></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-text-secondary">Ilman päätöspäivää</span><strong>{scopedLeads.filter((lead) => !lead.expectedDecisionDate).length}</strong></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-text-secondary">Ilman myyntilähdettä</span><strong>{scopedLeads.filter((lead) => !lead.source).length}</strong></div>
                </div>
                <Button variant="outline" className="mt-5 w-full" onClick={() => setMode('full')}>Avaa myyntiputki ja täydennä</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Dialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Uusi myyntimahdollisuus</DialogTitle></DialogHeader>
          <p className="text-sm leading-6 text-text-secondary">Kirjaa päätöksenteon kannalta olennaiset tiedot. Laajemmat tiedot voi täydentää myöhemmin.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Mahdollisuuden nimi *</Label><Input value={leadForm.name} onChange={(event) => setLeadForm((previous) => ({ ...previous, name: event.target.value }))} placeholder="Esim. As Oy Mallikuja – kylpyhuoneremontit" /></div>
            <div className="space-y-2"><Label>Nykyinen asiakas</Label><Select value={leadForm.customerId || 'none'} onValueChange={(value) => value === 'none' ? setLeadForm((previous) => ({ ...previous, customerId: '' })) : selectLeadCustomer(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei asiakaslinkkiä</SelectItem>{customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Yritys / tilaaja *</Label><Input value={leadForm.company} onChange={(event) => setLeadForm((previous) => ({ ...previous, company: event.target.value }))} disabled={Boolean(leadForm.customerId)} placeholder="Kirjoita nimi, jos asiakasta ei ole vielä rekisterissä" /></div>
            <div className="space-y-2"><Label>Arvioitu myyntiarvo €</Label><Input inputMode="decimal" value={leadForm.value} onChange={(event) => setLeadForm((previous) => ({ ...previous, value: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Vastuuhenkilö *</Label><Select value={leadForm.assigneeUserId || 'none'} onValueChange={(value) => setLeadForm((previous) => ({ ...previous, assigneeUserId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Valitse vastuuhenkilö</SelectItem>{people.map((person) => <SelectItem key={person.userId} value={person.userId}>{person.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 sm:col-span-2"><Label>Seuraava toimenpide *</Label><Input value={leadForm.nextAction} onChange={(event) => setLeadForm((previous) => ({ ...previous, nextAction: event.target.value }))} placeholder="Esim. Soita tilaajalle ja sovi kartoitus" /></div>
            <div className="space-y-2"><Label>Toimenpiteen määräaika *</Label><Input type="datetime-local" value={leadForm.nextActionDueAt} onChange={(event) => setLeadForm((previous) => ({ ...previous, nextActionDueAt: event.target.value }))} /></div>
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
            <div className="space-y-2"><Label>Vastuuhenkilö *</Label><Select value={taskForm.assignedUserId || 'none'} onValueChange={(value) => setTaskForm((previous) => ({ ...previous, assignedUserId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Valitse vastuuhenkilö</SelectItem>{people.map((person) => <SelectItem key={person.userId} value={person.userId}>{person.name}</SelectItem>)}</SelectContent></Select></div>
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
