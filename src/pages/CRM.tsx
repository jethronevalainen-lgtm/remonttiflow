import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Euro,
  FileText,
  Handshake,
  LayoutDashboard,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Snowflake,
  Target,
  Trash2,
  TrendingUp,
  UserRound,
  UsersRound,
  XCircle,
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
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCustomerRelations } from '@/hooks/useCustomerRelations';
import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import {
  completeCrmActivity,
  createCrmActivity,
  createCustomerContact,
  createCustomerSite,
  deleteCrmActivity,
  deleteCustomerContact,
  deleteCustomerSite,
  reopenCrmActivity,
  type CrmActivity,
  type CrmActivityPriority,
} from '@/lib/supabase/customerRelations';
import type { CrmLead, CrmLeadStage, Customer } from '@/types';

const PIPELINE_STAGES: CrmLeadStage[] = [
  'Uusi',
  'Kartoitus sovittu',
  'Kartoitettu',
  'Tarjous laskennassa',
  'Tarjous lähetetty',
  'Neuvottelu',
  'Voitettu',
  'Hävitty',
  'Jäissä',
];

const ACTIVE_STAGES = PIPELINE_STAGES.filter((stage) => !['Voitettu', 'Hävitty'].includes(stage));
const ACTIVITY_TYPES = ['Puhelu', 'Sähköposti', 'Tapaaminen', 'Kartoitus', 'Tarjous', 'Tehtävä', 'Muistutus'];
const PRIORITIES: CrmActivityPriority[] = ['Matala', 'Normaali', 'Korkea', 'Kriittinen'];
const TERMINAL_STAGES: CrmLeadStage[] = ['Voitettu', 'Hävitty'];

const DEFAULT_PROBABILITY: Record<CrmLeadStage, number> = {
  Uusi: 10,
  'Kartoitus sovittu': 20,
  Kartoitettu: 30,
  'Tarjous laskennassa': 40,
  'Tarjous lähetetty': 55,
  Neuvottelu: 75,
  Voitettu: 100,
  Hävitty: 0,
  Jäissä: 10,
};

interface LeadForm {
  name: string;
  company: string;
  customerId: string;
  siteId: string;
  value: string;
  estimatedCost: string;
  stage: CrmLeadStage;
  assignee: string;
  assigneeUserId: string;
  probability: string;
  source: string;
  description: string;
  nextAction: string;
  nextActionDueAt: string;
  expectedDecisionDate: string;
  frozenUntil: string;
  lostReason: string;
  date: string;
}

interface ActivityForm {
  leadId: string;
  customerId: string;
  siteId: string;
  projectId: string;
  activityType: string;
  subject: string;
  description: string;
  dueAt: string;
  assignedUserId: string;
  priority: CrmActivityPriority;
  customerVisible: boolean;
}

interface ContactForm {
  customerId: string;
  name: string;
  title: string;
  role: string;
  email: string;
  phone: string;
  preferredChannel: string;
  availabilityNotes: string;
  notes: string;
  isPrimary: boolean;
  receivesQuotes: boolean;
  receivesReports: boolean;
  receivesInvoices: boolean;
}

interface SiteForm {
  customerId: string;
  name: string;
  address: string;
  postalCode: string;
  city: string;
  accessInstructions: string;
  contactInstructions: string;
  notes: string;
}

type DeleteTarget =
  | { kind: 'lead'; id: string; label: string }
  | { kind: 'activity'; id: string; label: string }
  | { kind: 'contact'; id: string; label: string }
  | { kind: 'site'; id: string; label: string };

const emptyLead = (): LeadForm => ({
  name: '',
  company: '',
  customerId: '',
  siteId: '',
  value: '',
  estimatedCost: '',
  stage: 'Uusi',
  assignee: '',
  assigneeUserId: '',
  probability: '10',
  source: '',
  description: '',
  nextAction: '',
  nextActionDueAt: '',
  expectedDecisionDate: '',
  frozenUntil: '',
  lostReason: '',
  date: new Date().toISOString().slice(0, 10),
});

const emptyActivity = (): ActivityForm => ({
  leadId: '',
  customerId: '',
  siteId: '',
  projectId: '',
  activityType: ACTIVITY_TYPES[0],
  subject: '',
  description: '',
  dueAt: '',
  assignedUserId: '',
  priority: 'Normaali',
  customerVisible: false,
});

const emptyContact = (): ContactForm => ({
  customerId: '',
  name: '',
  title: '',
  role: '',
  email: '',
  phone: '',
  preferredChannel: 'Sähköposti',
  availabilityNotes: '',
  notes: '',
  isPrimary: false,
  receivesQuotes: false,
  receivesReports: false,
  receivesInvoices: false,
});

const emptySite = (): SiteForm => ({
  customerId: '',
  name: '',
  address: '',
  postalCode: '',
  city: '',
  accessInstructions: '',
  contactInstructions: '',
  notes: '',
});

function currency(value: number) {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function dateTime(value?: string) {
  if (!value) return 'Ei määräaikaa';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

function dateOnly(value?: string) {
  if (!value) return 'Ei asetettu';
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

function toLocalDateTime(value?: string) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function parseMoney(value: string) {
  return Number(value.replace(/\s/g, '').replace(',', '.'));
}

function isPast(value?: string) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time < Date.now();
}

function daysSince(value?: string) {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - time) / 86_400_000);
}

function stageClass(stage: CrmLeadStage) {
  switch (stage) {
    case 'Voitettu': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'Hävitty': return 'border-red-200 bg-red-50 text-red-700';
    case 'Neuvottelu': return 'border-orange-200 bg-orange-50 text-orange-700';
    case 'Tarjous lähetetty': return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'Tarjous laskennassa': return 'border-yellow-200 bg-yellow-50 text-yellow-800';
    case 'Kartoitettu': return 'border-cyan-200 bg-cyan-50 text-cyan-700';
    case 'Kartoitus sovittu': return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'Jäissä': return 'border-slate-200 bg-slate-100 text-slate-700';
    default: return 'border-blue-200 bg-blue-50 text-blue-700';
  }
}

function priorityClass(priority: CrmActivityPriority) {
  if (priority === 'Kriittinen') return 'border-red-200 bg-red-50 text-red-700';
  if (priority === 'Korkea') return 'border-orange-200 bg-orange-50 text-orange-700';
  if (priority === 'Matala') return 'border-slate-200 bg-slate-50 text-slate-600';
  return 'border-blue-200 bg-blue-50 text-blue-700';
}

function normalizeSearch(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ').toLocaleLowerCase('fi-FI');
}

export default function CRM() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const {
    crmLeads,
    customers,
    projects,
    addCrmLead,
    updateCrmLead,
    deleteCrmLead,
    operationError: domainError,
  } = useAppDataContext();
  const relations = useCustomerRelations();
  const { people } = useRoleWorkspace();

  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [activityStatusFilter, setActivityStatusFilter] = useState('open');
  const [leadDialog, setLeadDialog] = useState(false);
  const [editingLead, setEditingLead] = useState<CrmLead | null>(null);
  const [leadForm, setLeadForm] = useState<LeadForm>(emptyLead);
  const [activityDialog, setActivityDialog] = useState(false);
  const [activityForm, setActivityForm] = useState<ActivityForm>(emptyActivity);
  const [contactDialog, setContactDialog] = useState(false);
  const [contactForm, setContactForm] = useState<ContactForm>(emptyContact);
  const [siteDialog, setSiteDialog] = useState(false);
  const [siteForm, setSiteForm] = useState<SiteForm>(emptySite);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const today = new Date();
  const todayIso = today.toISOString();
  const in14Days = new Date(today.getTime() + 14 * 86_400_000).toISOString().slice(0, 10);
  const normalizedQuery = search.trim().toLocaleLowerCase('fi-FI');

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) ?? null;
  const visibleError = operationError ?? domainError ?? relations.error;

  const filteredLeads = useMemo(() => crmLeads.filter((lead) => {
    if (ownerFilter !== 'all' && lead.assigneeUserId !== ownerFilter) return false;
    if (!normalizedQuery) return true;
    const customer = customers.find((item) => item.id === lead.customerId);
    const site = relations.sites.find((item) => item.id === lead.siteId);
    return normalizeSearch(
      lead.name,
      lead.company,
      lead.assignee,
      lead.source,
      lead.nextAction,
      customer?.name,
      site?.name,
      site?.address,
    ).includes(normalizedQuery);
  }), [crmLeads, customers, normalizedQuery, ownerFilter, relations.sites]);

  const leadsByStage = useMemo(() => Object.fromEntries(
    PIPELINE_STAGES.map((stage) => [stage, filteredLeads.filter((lead) => lead.stage === stage)]),
  ) as Record<CrmLeadStage, CrmLead[]>, [filteredLeads]);

  const activeLeads = crmLeads.filter((lead) => !TERMINAL_STAGES.includes(lead.stage));
  const openActivities = relations.activities.filter((activity) => !activity.completedAt);
  const overdueActivities = openActivities.filter((activity) => activity.dueAt && isPast(activity.dueAt));
  const overdueLeadActions = activeLeads.filter((lead) => lead.nextActionDueAt && isPast(lead.nextActionDueAt));
  const missingNextAction = activeLeads.filter((lead) => !lead.nextAction || !lead.nextActionDueAt);
  const staleLeads = activeLeads.filter((lead) => daysSince(lead.lastActivityAt) > 7);
  const decisionsSoon = activeLeads
    .filter((lead) => lead.expectedDecisionDate && lead.expectedDecisionDate <= in14Days)
    .sort((a, b) => (a.expectedDecisionDate ?? '').localeCompare(b.expectedDecisionDate ?? ''));
  const totalPipeline = activeLeads.reduce((sum, lead) => sum + lead.value, 0);
  const weightedPipeline = activeLeads.reduce(
    (sum, lead) => sum + lead.value * ((lead.probability ?? DEFAULT_PROBABILITY[lead.stage]) / 100),
    0,
  );
  const estimatedMargin = activeLeads.reduce(
    (sum, lead) => sum + Math.max(0, lead.value - (lead.estimatedCost ?? 0)),
    0,
  );
  const wonValue = crmLeads
    .filter((lead) => lead.stage === 'Voitettu')
    .reduce((sum, lead) => sum + lead.value, 0);
  const wonCount = crmLeads.filter((lead) => lead.stage === 'Voitettu').length;
  const lostCount = crmLeads.filter((lead) => lead.stage === 'Hävitty').length;
  const winRate = wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0;

  const customerRows = useMemo(() => customers
    .filter((customer) => !normalizedQuery || normalizeSearch(
      customer.name,
      customer.businessId,
      customer.email,
      customer.phone,
      customer.address,
      ...relations.contacts.filter((contact) => contact.customerId === customer.id).map((contact) => contact.name),
      ...relations.sites.filter((site) => site.customerId === customer.id).flatMap((site) => [site.name, site.address, site.city]),
    ).includes(normalizedQuery))
    .map((customer) => {
      const customerLeads = crmLeads.filter((lead) => lead.customerId === customer.id);
      const customerProjects = projects.filter((project) => project.customerId === customer.id || project.customer === customer.name);
      const customerActivities = openActivities.filter((activity) => activity.customerId === customer.id);
      const customerContacts = relations.contacts.filter((contact) => contact.customerId === customer.id);
      const customerSites = relations.sites.filter((site) => site.customerId === customer.id);
      const activeValue = customerLeads
        .filter((lead) => !TERMINAL_STAGES.includes(lead.stage))
        .reduce((sum, lead) => sum + lead.value, 0);
      return {
        customer,
        leads: customerLeads,
        projects: customerProjects,
        activities: customerActivities,
        contacts: customerContacts,
        sites: customerSites,
        activeValue,
      };
    })
    .sort((a, b) => b.activeValue - a.activeValue || a.customer.name.localeCompare(b.customer.name, 'fi')),
  [customers, normalizedQuery, crmLeads, projects, openActivities, relations.contacts, relations.sites]);

  const selectedCustomerData = useMemo(() => {
    if (!selectedCustomer) return null;
    const leads = crmLeads.filter((lead) => lead.customerId === selectedCustomer.id);
    const customerProjects = projects.filter(
      (project) => project.customerId === selectedCustomer.id || project.customer === selectedCustomer.name,
    );
    const activities = relations.activities
      .filter((activity) => activity.customerId === selectedCustomer.id || leads.some((lead) => lead.id === activity.leadId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      leads,
      projects: customerProjects,
      contacts: relations.contacts.filter((contact) => contact.customerId === selectedCustomer.id),
      sites: relations.sites.filter((site) => site.customerId === selectedCustomer.id),
      activities,
    };
  }, [selectedCustomer, crmLeads, projects, relations.activities, relations.contacts, relations.sites]);

  const sourceSummary = useMemo(() => {
    const summary = new Map<string, { count: number; value: number; weighted: number }>();
    activeLeads.forEach((lead) => {
      const key = lead.source?.trim() || 'Ei lähdettä';
      const previous = summary.get(key) ?? { count: 0, value: 0, weighted: 0 };
      previous.count += 1;
      previous.value += lead.value;
      previous.weighted += lead.value * ((lead.probability ?? DEFAULT_PROBABILITY[lead.stage]) / 100);
      summary.set(key, previous);
    });
    return [...summary.entries()].sort((a, b) => b[1].weighted - a[1].weighted);
  }, [activeLeads]);

  const openLeadCreate = (stage: CrmLeadStage = 'Uusi', customer?: Customer) => {
    const form = emptyLead();
    form.stage = stage;
    form.probability = String(DEFAULT_PROBABILITY[stage]);
    if (customer) {
      form.customerId = customer.id;
      form.company = customer.name;
    }
    setEditingLead(null);
    setLeadForm(form);
    setErrors([]);
    setOperationError(null);
    setLeadDialog(true);
  };

  const openLeadEdit = (lead: CrmLead) => {
    setEditingLead(lead);
    setLeadForm({
      name: lead.name,
      company: lead.company,
      customerId: lead.customerId ?? '',
      siteId: lead.siteId ?? '',
      value: String(lead.value),
      estimatedCost: String(lead.estimatedCost ?? 0),
      stage: lead.stage,
      assignee: lead.assignee,
      assigneeUserId: lead.assigneeUserId ?? '',
      probability: String(lead.probability ?? DEFAULT_PROBABILITY[lead.stage]),
      source: lead.source ?? '',
      description: lead.description ?? '',
      nextAction: lead.nextAction ?? '',
      nextActionDueAt: toLocalDateTime(lead.nextActionDueAt),
      expectedDecisionDate: lead.expectedDecisionDate ?? '',
      frozenUntil: lead.frozenUntil ?? '',
      lostReason: lead.lostReason ?? '',
      date: lead.date,
    });
    setErrors([]);
    setOperationError(null);
    setLeadDialog(true);
  };

  const selectLeadCustomer = (customerId: string) => {
    const customer = customers.find((item) => item.id === customerId);
    setLeadForm((previous) => ({
      ...previous,
      customerId,
      siteId: relations.sites.some((site) => site.id === previous.siteId && site.customerId === customerId)
        ? previous.siteId
        : '',
      company: customer?.name ?? previous.company,
    }));
  };

  const selectAssignee = (userId: string) => {
    const person = people.find((item) => item.userId === userId);
    setLeadForm((previous) => ({
      ...previous,
      assigneeUserId: userId,
      assignee: person?.name ?? previous.assignee,
    }));
  };

  const changeLeadStage = (stage: CrmLeadStage) => {
    setLeadForm((previous) => ({
      ...previous,
      stage,
      probability: String(DEFAULT_PROBABILITY[stage]),
      nextAction: TERMINAL_STAGES.includes(stage) ? '' : previous.nextAction,
      nextActionDueAt: TERMINAL_STAGES.includes(stage) ? '' : previous.nextActionDueAt,
    }));
  };

  const saveLead = () => {
    const value = parseMoney(leadForm.value);
    const estimatedCost = parseMoney(leadForm.estimatedCost || '0');
    const probability = Number(leadForm.probability);
    const nextErrors: string[] = [];
    if (!leadForm.name.trim()) nextErrors.push('Mahdollisuuden nimi on pakollinen.');
    if (!Number.isFinite(value) || value < 0) nextErrors.push('Arvon pitää olla nolla tai positiivinen.');
    if (!Number.isFinite(estimatedCost) || estimatedCost < 0) nextErrors.push('Arvioidun kustannuksen pitää olla nolla tai positiivinen.');
    if (Number.isFinite(value) && Number.isFinite(estimatedCost) && estimatedCost > value) {
      nextErrors.push('Arvioitu kustannus ei voi ylittää myyntiarvoa.');
    }
    if (!Number.isFinite(probability) || probability < 0 || probability > 100) {
      nextErrors.push('Todennäköisyyden pitää olla 0–100 %.');
    }
    if (!TERMINAL_STAGES.includes(leadForm.stage) && leadForm.stage !== 'Jäissä') {
      if (!leadForm.nextAction.trim()) nextErrors.push('Avoimella mahdollisuudella pitää olla seuraava toimenpide.');
      if (!leadForm.nextActionDueAt) nextErrors.push('Seuraavalle toimenpiteelle pitää asettaa määräaika.');
    }
    if (leadForm.stage === 'Hävitty' && !leadForm.lostReason.trim()) {
      nextErrors.push('Hävityn mahdollisuuden syy on kirjattava.');
    }
    if (leadForm.stage === 'Jäissä' && !leadForm.frozenUntil) {
      nextErrors.push('Jäissä olevalle mahdollisuudelle pitää asettaa tarkistuspäivä.');
    }
    setErrors(nextErrors);
    if (nextErrors.length) return;

    const payload: Omit<CrmLead, 'id'> = {
      name: leadForm.name.trim(),
      company: leadForm.company.trim(),
      customerId: leadForm.customerId || undefined,
      siteId: leadForm.siteId || undefined,
      value,
      estimatedCost,
      stage: leadForm.stage,
      assignee: leadForm.assignee.trim(),
      assigneeUserId: leadForm.assigneeUserId || undefined,
      probability,
      source: leadForm.source.trim() || undefined,
      description: leadForm.description.trim() || undefined,
      nextAction: leadForm.nextAction.trim() || undefined,
      nextActionDueAt: leadForm.nextActionDueAt
        ? new Date(leadForm.nextActionDueAt).toISOString()
        : undefined,
      expectedDecisionDate: leadForm.expectedDecisionDate || undefined,
      frozenUntil: leadForm.frozenUntil || undefined,
      lostReason: leadForm.lostReason.trim() || undefined,
      date: leadForm.date || leadForm.expectedDecisionDate || new Date().toISOString().slice(0, 10),
    };

    if (editingLead) void updateCrmLead(editingLead.id, payload);
    else void addCrmLead(payload);
    setLeadDialog(false);
  };

  const advanceLead = (lead: CrmLead) => {
    const path: CrmLeadStage[] = [
      'Uusi',
      'Kartoitus sovittu',
      'Kartoitettu',
      'Tarjous laskennassa',
      'Tarjous lähetetty',
      'Neuvottelu',
      'Voitettu',
    ];
    const index = path.indexOf(lead.stage);
    if (index >= 0 && index < path.length - 1) {
      const nextStage = path[index + 1];
      void updateCrmLead(lead.id, {
        stage: nextStage,
        probability: DEFAULT_PROBABILITY[nextStage],
      });
    }
  };

  const openActivity = (lead?: CrmLead, customer?: Customer) => {
    const form = emptyActivity();
    if (lead) {
      form.leadId = lead.id;
      form.customerId = lead.customerId ?? '';
      form.siteId = lead.siteId ?? '';
      form.assignedUserId = lead.assigneeUserId ?? '';
      form.subject = lead.nextAction ?? '';
      form.dueAt = toLocalDateTime(lead.nextActionDueAt);
    }
    if (customer) form.customerId = customer.id;
    setActivityForm(form);
    setOperationError(null);
    setActivityDialog(true);
  };

  const selectActivityLead = (leadId: string) => {
    const lead = crmLeads.find((item) => item.id === leadId);
    setActivityForm((previous) => ({
      ...previous,
      leadId,
      customerId: lead?.customerId ?? previous.customerId,
      siteId: lead?.siteId ?? previous.siteId,
      assignedUserId: lead?.assigneeUserId ?? previous.assignedUserId,
    }));
  };

  const saveActivity = async () => {
    if (!currentOrg) return;
    setSaving(true);
    setOperationError(null);
    try {
      await createCrmActivity({
        organizationId: currentOrg.id,
        userId: user?.id,
        leadId: activityForm.leadId || undefined,
        customerId: activityForm.customerId || undefined,
        siteId: activityForm.siteId || undefined,
        projectId: activityForm.projectId || undefined,
        assignedUserId: activityForm.assignedUserId || undefined,
        activityType: activityForm.activityType,
        subject: activityForm.subject,
        description: activityForm.description,
        dueAt: activityForm.dueAt ? new Date(activityForm.dueAt).toISOString() : undefined,
        priority: activityForm.priority,
        customerVisible: activityForm.customerVisible,
      });
      await relations.refresh();
      setActivityDialog(false);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Aktiviteetin tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const completeActivity = async (activity: CrmActivity) => {
    if (!currentOrg) return;
    setSaving(true);
    try {
      await completeCrmActivity(currentOrg.id, activity.id, user?.id);
      await relations.refresh();
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Aktiviteetin kuittaus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const reopenActivity = async (activity: CrmActivity) => {
    if (!currentOrg) return;
    setSaving(true);
    try {
      await reopenCrmActivity(currentOrg.id, activity.id);
      await relations.refresh();
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Aktiviteetin avaaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const openContact = (customer?: Customer) => {
    const form = emptyContact();
    if (customer) form.customerId = customer.id;
    setContactForm(form);
    setOperationError(null);
    setContactDialog(true);
  };

  const saveContact = async () => {
    if (!currentOrg) return;
    if (!contactForm.customerId || !contactForm.name.trim()) {
      setOperationError('Valitse asiakas ja anna yhteyshenkilön nimi.');
      return;
    }
    setSaving(true);
    setOperationError(null);
    try {
      await createCustomerContact({
        organizationId: currentOrg.id,
        userId: user?.id,
        ...contactForm,
      });
      await relations.refresh();
      setContactDialog(false);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Yhteyshenkilön tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const openSite = (customer?: Customer) => {
    const form = emptySite();
    if (customer) form.customerId = customer.id;
    setSiteForm(form);
    setOperationError(null);
    setSiteDialog(true);
  };

  const saveSite = async () => {
    if (!currentOrg) return;
    setSaving(true);
    setOperationError(null);
    try {
      await createCustomerSite({
        organizationId: currentOrg.id,
        userId: user?.id,
        ...siteForm,
      });
      await relations.refresh();
      setSiteDialog(false);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Kohteen tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !currentOrg) return;
    setSaving(true);
    setOperationError(null);
    try {
      if (deleteTarget.kind === 'lead') {
        void deleteCrmLead(deleteTarget.id);
      } else if (deleteTarget.kind === 'activity') {
        await deleteCrmActivity(currentOrg.id, deleteTarget.id);
        await relations.refresh();
      } else if (deleteTarget.kind === 'contact') {
        await deleteCustomerContact(currentOrg.id, deleteTarget.id);
        await relations.refresh();
      } else {
        await deleteCustomerSite(currentOrg.id, deleteTarget.id);
        await relations.refresh();
      }
      setDeleteTarget(null);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const filteredActivities = relations.activities.filter((activity) => {
    if (activityStatusFilter === 'open' && activity.completedAt) return false;
    if (activityStatusFilter === 'done' && !activity.completedAt) return false;
    if (ownerFilter !== 'all' && activity.assignedUserId !== ownerFilter) return false;
    if (!normalizedQuery) return true;
    const lead = crmLeads.find((item) => item.id === activity.leadId);
    const customer = customers.find((item) => item.id === activity.customerId);
    const site = relations.sites.find((item) => item.id === activity.siteId);
    const project = projects.find((item) => item.id === activity.projectId);
    return normalizeSearch(
      activity.subject,
      activity.description,
      activity.activityType,
      lead?.name,
      customer?.name,
      site?.name,
      project?.name,
    ).includes(normalizedQuery);
  });

  const leadSiteOptions = relations.sites.filter((site) => !leadForm.customerId || site.customerId === leadForm.customerId);
  const activitySiteOptions = relations.sites.filter(
    (site) => !activityForm.customerId || site.customerId === activityForm.customerId,
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
            <LayoutDashboard size={16} />
            Asiakkuuksien operatiivinen työpöytä
          </div>
          <h1 className="text-hero text-text-primary">CRM</h1>
          <p className="mt-1 max-w-3xl text-body-sm text-text-secondary">
            Asiakkaat, kohteet, myynti, seuraavat toimenpiteet ja projektihistoria samassa näkymässä.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => openLeadCreate()}><Plus size={16} className="mr-2" />Uusi mahdollisuus</Button>
          <Button variant="outline" onClick={() => openActivity()}><CalendarDays size={16} className="mr-2" />Uusi tehtävä</Button>
          <Button variant="outline" onClick={() => openContact()}><UserRound size={16} className="mr-2" />Yhteyshenkilö</Button>
          <Button variant="outline" onClick={() => openSite()}><MapPin size={16} className="mr-2" />Kohde</Button>
        </div>
      </div>

      {visibleError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{visibleError}</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Avoin tarjouskanta', value: currency(totalPipeline), detail: `${activeLeads.length} mahdollisuutta`, icon: Briefcase },
          { label: 'Painotettu ennuste', value: currency(weightedPipeline), detail: 'Todennäköisyyksillä painotettu', icon: TrendingUp },
          { label: 'Arvioitu kate', value: currency(estimatedMargin), detail: totalPipeline > 0 ? `${Math.round((estimatedMargin / totalPipeline) * 100)} % tarjouskannasta` : 'Ei tarjouskantaa', icon: CircleDollarSign },
          { label: 'Voitettu arvo', value: currency(wonValue), detail: `${winRate} % voittoprosentti`, icon: Handshake },
          { label: 'Reagoi nyt', value: overdueActivities.length + overdueLeadActions.length, detail: `${missingNextAction.length} ilman seuraavaa askelta`, icon: AlertTriangle },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-text-secondary">{item.label}</p>
                  <p className="mt-2 break-words font-mono text-2xl font-bold text-text-primary">{item.value}</p>
                  <p className="mt-1 text-xs text-text-muted">{item.detail}</p>
                </div>
                <div className="rounded-xl bg-primary/10 p-2 text-primary"><item.icon size={19} /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_240px_auto]">
            <div className="relative">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Hae asiakkaalla, kohteella, osoitteella, vastuuhenkilöllä tai tarjouksella"
                className="pl-10"
              />
            </div>
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger><SelectValue placeholder="Kaikki vastuuhenkilöt" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Kaikki vastuuhenkilöt</SelectItem>
                {people.map((person) => <SelectItem key={person.userId} value={person.userId}>{person.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" onClick={() => { setSearch(''); setOwnerFilter('all'); }}>Tyhjennä rajaukset</Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <div className="overflow-x-auto pb-1">
          <TabsList className="min-w-max">
            <TabsTrigger value="overview">Tilannekuva</TabsTrigger>
            <TabsTrigger value="pipeline">Myyntiputki</TabsTrigger>
            <TabsTrigger value="tasks">Tehtävät ({openActivities.length})</TabsTrigger>
            <TabsTrigger value="customers">Asiakkaat ({customers.length})</TabsTrigger>
            <TabsTrigger value="reports">Myynnin analyysi</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center justify-between border-b px-5 py-4">
                  <div>
                    <h2 className="font-semibold text-text-primary">Toimenpiteitä vaativat asiat</h2>
                    <p className="text-xs text-text-secondary">Myöhässä olevat ja puutteelliset seuraavat askeleet</p>
                  </div>
                  <Badge variant="outline" className={overdueActivities.length + overdueLeadActions.length > 0 ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>
                    {overdueActivities.length + overdueLeadActions.length} myöhässä
                  </Badge>
                </div>
                <div className="divide-y">
                  {overdueLeadActions.slice(0, 6).map((lead) => (
                    <button key={`lead-${lead.id}`} type="button" onClick={() => openLeadEdit(lead)} className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-muted/40">
                      <div className="rounded-lg bg-red-50 p-2 text-red-600"><Target size={17} /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{lead.nextAction}</p>
                        <p className="truncate text-xs text-text-secondary">{lead.name} · {lead.company || 'Ei asiakasta'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-red-700">{dateTime(lead.nextActionDueAt)}</p>
                        <p className="text-xs text-text-muted">{lead.assignee || 'Ei vastuuhenkilöä'}</p>
                      </div>
                      <ChevronRight size={17} className="text-text-muted" />
                    </button>
                  ))}
                  {overdueActivities.slice(0, Math.max(0, 8 - overdueLeadActions.length)).map((activity) => {
                    const lead = crmLeads.find((item) => item.id === activity.leadId);
                    const customer = customers.find((item) => item.id === activity.customerId);
                    return (
                      <div key={`activity-${activity.id}`} className="flex items-center gap-3 px-5 py-4">
                        <div className="rounded-lg bg-orange-50 p-2 text-orange-600"><Clock3 size={17} /></div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{activity.subject}</p>
                          <p className="truncate text-xs text-text-secondary">{lead?.name || customer?.name || activity.activityType}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-red-700">{dateTime(activity.dueAt)}</p>
                          <Badge variant="outline" className={priorityClass(activity.priority)}>{activity.priority}</Badge>
                        </div>
                        <Button variant="ghost" size="sm" className="text-emerald-700" disabled={saving} onClick={() => void completeActivity(activity)}><CheckCircle2 size={17} /></Button>
                      </div>
                    );
                  })}
                  {overdueLeadActions.length === 0 && overdueActivities.length === 0 && (
                    <div className="p-10 text-center">
                      <CheckCircle2 size={38} className="mx-auto mb-3 text-emerald-600" />
                      <p className="font-semibold">Ei myöhässä olevia tehtäviä</p>
                      <p className="text-sm text-text-secondary">CRM:n aikataulut ovat hallinnassa.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardContent className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold">Puuttuvat seuraavat askeleet</h2>
                      <p className="text-xs text-text-secondary">Avoin kauppa ei saa jäädä ilman omistajaa ja määräaikaa</p>
                    </div>
                    <Badge variant="outline" className={missingNextAction.length ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>{missingNextAction.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {missingNextAction.slice(0, 5).map((lead) => (
                      <button key={lead.id} type="button" onClick={() => openLeadEdit(lead)} className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-muted/40">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{lead.name}</p>
                          <p className="truncate text-xs text-text-secondary">{lead.company || 'Ei asiakasta'} · {lead.assignee || 'Ei vastuuhenkilöä'}</p>
                        </div>
                        <ArrowRight size={16} className="shrink-0 text-primary" />
                      </button>
                    ))}
                    {!missingNextAction.length && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Kaikilla avoimilla mahdollisuuksilla on seuraava askel.</p>}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold">Päätökset seuraavan 14 päivän aikana</h2>
                      <p className="text-xs text-text-secondary">Kaupat, joihin kannattaa valmistautua</p>
                    </div>
                    <CalendarDays size={19} className="text-primary" />
                  </div>
                  <div className="space-y-3">
                    {decisionsSoon.slice(0, 5).map((lead) => (
                      <button key={lead.id} type="button" onClick={() => openLeadEdit(lead)} className="flex w-full items-center justify-between gap-4 text-left">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{lead.name}</p>
                          <p className="text-xs text-text-secondary">{dateOnly(lead.expectedDecisionDate)} · {lead.probability ?? DEFAULT_PROBABILITY[lead.stage]} %</p>
                        </div>
                        <span className="font-mono text-sm font-bold">{currency(lead.value)}</span>
                      </button>
                    ))}
                    {!decisionsSoon.length && <p className="text-sm text-text-muted">Ei päätöspäiviä seuraavan kahden viikon aikana.</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card><CardContent className="p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-slate-100 p-3 text-slate-700"><Clock3 size={20} /></div><div><p className="text-sm text-text-secondary">Yli 7 päivää ilman aktiviteettia</p><p className="font-mono text-2xl font-bold">{staleLeads.length}</p></div></div></CardContent></Card>
            <Card><CardContent className="p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-3 text-blue-700"><UsersRound size={20} /></div><div><p className="text-sm text-text-secondary">Aktiivisia asiakkuuksia</p><p className="font-mono text-2xl font-bold">{customers.filter((customer) => customer.status === 'Aktiivinen').length}</p></div></div></CardContent></Card>
            <Card><CardContent className="p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-cyan-50 p-3 text-cyan-700"><MapPin size={20} /></div><div><p className="text-sm text-text-secondary">Rekisteröityjä kohteita</p><p className="font-mono text-2xl font-bold">{relations.sites.length}</p></div></div></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="pipeline">
          <div className="flex min-w-max gap-4 overflow-x-auto pb-4">
            {PIPELINE_STAGES.map((stage) => {
              const stageLeads = leadsByStage[stage];
              const stageValue = stageLeads.reduce((sum, lead) => sum + lead.value, 0);
              return (
                <section key={stage} className="w-[290px] shrink-0 space-y-3">
                  <div className="rounded-xl border bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className={stageClass(stage)}>{stage}</Badge>
                      <Button variant="ghost" size="sm" onClick={() => openLeadCreate(stage)}><Plus size={15} /></Button>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-text-secondary">
                      <span>{stageLeads.length} kpl</span>
                      <span className="font-mono font-semibold text-text-primary">{currency(stageValue)}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {stageLeads.map((lead) => {
                      const activities = relations.activities.filter((activity) => activity.leadId === lead.id && !activity.completedAt);
                      const probability = lead.probability ?? DEFAULT_PROBABILITY[stage];
                      const customer = customers.find((item) => item.id === lead.customerId);
                      const site = relations.sites.find((item) => item.id === lead.siteId);
                      const margin = lead.value - (lead.estimatedCost ?? 0);
                      return (
                        <Card key={lead.id} className={lead.nextActionDueAt && isPast(lead.nextActionDueAt) ? 'border-red-200' : ''}>
                          <CardContent className="space-y-3 p-4">
                            <button type="button" className="block w-full text-left" onClick={() => openLeadEdit(lead)}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate font-semibold">{lead.name}</p>
                                  <p className="truncate text-sm text-text-secondary">{customer?.name || lead.company || 'Ei asiakasta'}</p>
                                </div>
                                {stage === 'Jäissä' && <Snowflake size={16} className="shrink-0 text-slate-500" />}
                              </div>
                              {site && <p className="mt-2 flex items-center gap-1 truncate text-xs text-text-secondary"><MapPin size={13} />{site.name}</p>}
                              <div className="mt-3 flex items-center justify-between">
                                <span className="font-mono font-bold">{currency(lead.value)}</span>
                                <Badge variant="secondary">{probability} %</Badge>
                              </div>
                              <div className="mt-2 flex items-center justify-between text-xs text-text-secondary">
                                <span>Kate {currency(Math.max(0, margin))}</span>
                                <span>{lead.assignee || 'Ei vastuuhenkilöä'}</span>
                              </div>
                            </button>
                            <div className={`rounded-lg p-2 text-xs ${lead.nextActionDueAt && isPast(lead.nextActionDueAt) ? 'bg-red-50 text-red-700' : 'bg-muted/50 text-text-secondary'}`}>
                              <p className="font-medium">{lead.nextAction || 'Seuraava askel puuttuu'}</p>
                              <p>{lead.nextActionDueAt ? dateTime(lead.nextActionDueAt) : 'Ei määräaikaa'} · {activities.length} tehtävää</p>
                            </div>
                            <div className="flex justify-end gap-1 border-t pt-2">
                              <Button variant="ghost" size="sm" onClick={() => openActivity(lead)}><CalendarDays size={15} /></Button>
                              {ACTIVE_STAGES.includes(stage) && stage !== 'Jäissä' && (
                                <Button variant="ghost" size="sm" className="text-emerald-700" onClick={() => advanceLead(lead)}><ArrowRight size={15} /></Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => openLeadEdit(lead)}><FileText size={15} /></Button>
                              <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteTarget({ kind: 'lead', id: lead.id, label: lead.name })}><Trash2 size={15} /></Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                    {!stageLeads.length && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-text-muted">Ei mahdollisuuksia</div>}
                  </div>
                </section>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                {[
                  ['open', `Avoimet (${openActivities.length})`],
                  ['overdue', `Myöhässä (${overdueActivities.length})`],
                  ['done', 'Valmiit'],
                  ['all', 'Kaikki'],
                ].map(([value, label]) => (
                  <Button key={value} variant={activityStatusFilter === value ? 'default' : 'outline'} size="sm" onClick={() => setActivityStatusFilter(value)}>{label}</Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {filteredActivities
                  .filter((activity) => activityStatusFilter !== 'overdue' || (!activity.completedAt && activity.dueAt && isPast(activity.dueAt)))
                  .map((activity) => {
                    const lead = crmLeads.find((item) => item.id === activity.leadId);
                    const customer = customers.find((item) => item.id === activity.customerId);
                    const site = relations.sites.find((item) => item.id === activity.siteId);
                    const project = projects.find((item) => item.id === activity.projectId);
                    const assignee = people.find((person) => person.userId === activity.assignedUserId);
                    const overdue = !activity.completedAt && activity.dueAt && isPast(activity.dueAt);
                    return (
                      <div key={activity.id} className={`grid gap-3 px-5 py-4 lg:grid-cols-[150px_1.5fr_1fr_170px_150px] lg:items-center ${overdue ? 'bg-red-50/50' : ''}`}>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline">{activity.activityType}</Badge>
                          <Badge variant="outline" className={priorityClass(activity.priority)}>{activity.priority}</Badge>
                          {overdue && <Badge className="border-0 bg-red-600 text-white">Myöhässä</Badge>}
                        </div>
                        <div>
                          <p className="font-semibold">{activity.subject}</p>
                          <p className="text-xs text-text-secondary">{activity.description || activity.outcome || 'Ei kuvausta'}</p>
                        </div>
                        <div className="text-sm">
                          <p>{lead?.name || customer?.name || project?.name || 'Yleinen aktiviteetti'}</p>
                          <p className="text-xs text-text-secondary">{site?.name || assignee?.name || 'Ei vastuuhenkilöä'}</p>
                        </div>
                        <div className="text-sm">
                          <p>{activity.completedAt ? `Valmis ${dateTime(activity.completedAt)}` : dateTime(activity.dueAt)}</p>
                          {activity.customerVisible && <p className="text-xs text-primary">Näkyy asiakkaalle</p>}
                        </div>
                        <div className="flex justify-end gap-1">
                          {activity.completedAt ? (
                            <Button variant="ghost" size="sm" onClick={() => void reopenActivity(activity)}>Avaa</Button>
                          ) : (
                            <Button variant="ghost" size="sm" className="text-emerald-700" disabled={saving} onClick={() => void completeActivity(activity)}><CheckCircle2 size={17} /></Button>
                          )}
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteTarget({ kind: 'activity', id: activity.id, label: activity.subject })}><Trash2 size={17} /></Button>
                        </div>
                      </div>
                    );
                  })}
                {!filteredActivities.length && <div className="p-12 text-center"><CalendarDays size={42} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei tehtäviä valitulla rajauksella</p></div>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {customerRows.map((row) => {
              const primary = row.contacts.find((contact) => contact.isPrimary) ?? row.contacts[0];
              const overdue = row.activities.filter((activity) => activity.dueAt && isPast(activity.dueAt)).length;
              return (
                <Card key={row.customer.id} className="transition hover:border-primary/40">
                  <CardContent className="p-5">
                    <button type="button" className="block w-full text-left" onClick={() => setSelectedCustomerId(row.customer.id)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Building2 size={18} className="shrink-0 text-primary" />
                            <h3 className="truncate font-semibold text-text-primary">{row.customer.name}</h3>
                          </div>
                          <p className="mt-1 text-xs text-text-secondary">{row.customer.type}{row.customer.businessId ? ` · ${row.customer.businessId}` : ''}</p>
                        </div>
                        <Badge variant="outline" className={row.customer.status === 'Aktiivinen' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : ''}>{row.customer.status}</Badge>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-muted/50 p-2"><p className="font-mono font-bold">{row.projects.length}</p><p className="text-[11px] text-text-secondary">projektia</p></div>
                        <div className="rounded-lg bg-muted/50 p-2"><p className="font-mono font-bold">{row.leads.filter((lead) => !TERMINAL_STAGES.includes(lead.stage)).length}</p><p className="text-[11px] text-text-secondary">avointa kauppaa</p></div>
                        <div className="rounded-lg bg-muted/50 p-2"><p className="font-mono font-bold">{row.sites.length}</p><p className="text-[11px] text-text-secondary">kohdetta</p></div>
                      </div>

                      <div className="mt-4 space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-3"><span className="text-text-secondary">Avoin tarjouskanta</span><span className="font-mono font-bold">{currency(row.activeValue)}</span></div>
                        <div className="flex items-center justify-between gap-3"><span className="text-text-secondary">Yhteyshenkilö</span><span className="truncate">{primary?.name || row.customer.contactPerson || 'Ei määritetty'}</span></div>
                        <div className="flex items-center justify-between gap-3"><span className="text-text-secondary">Avoimet tehtävät</span><span className={overdue ? 'font-semibold text-red-700' : ''}>{row.activities.length}{overdue ? ` · ${overdue} myöhässä` : ''}</span></div>
                      </div>

                      <div className="mt-4 flex items-center justify-end gap-1 border-t pt-3 text-sm font-medium text-primary">Avaa asiakasnäkymä <ChevronRight size={16} /></div>
                    </button>
                  </CardContent>
                </Card>
              );
            })}
            {!customerRows.length && <div className="col-span-full rounded-xl border border-dashed p-12 text-center text-text-muted">Asiakkaita ei löytynyt.</div>}
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-4">
            <Card><CardContent className="p-5"><p className="text-sm text-text-secondary">Voitetut kaupat</p><p className="mt-2 font-mono text-2xl font-bold">{wonCount}</p><p className="text-xs text-text-muted">{currency(wonValue)}</p></CardContent></Card>
            <Card><CardContent className="p-5"><p className="text-sm text-text-secondary">Hävityt kaupat</p><p className="mt-2 font-mono text-2xl font-bold">{lostCount}</p><p className="text-xs text-text-muted">Syyt kirjataan mahdollisuudelle</p></CardContent></Card>
            <Card><CardContent className="p-5"><p className="text-sm text-text-secondary">Voittoprosentti</p><p className="mt-2 font-mono text-2xl font-bold">{winRate} %</p><p className="text-xs text-text-muted">Päätetyt kaupat</p></CardContent></Card>
            <Card><CardContent className="p-5"><p className="text-sm text-text-secondary">Tarjouskannan kate</p><p className="mt-2 font-mono text-2xl font-bold">{totalPipeline ? Math.round((estimatedMargin / totalPipeline) * 100) : 0} %</p><p className="text-xs text-text-muted">Arvioitu myyntikate</p></CardContent></Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardContent className="p-5">
                <div className="mb-5"><h2 className="font-semibold">Tarjouskanta vaiheittain</h2><p className="text-xs text-text-secondary">Missä myynti tällä hetkellä sijaitsee</p></div>
                <div className="space-y-4">
                  {PIPELINE_STAGES.filter((stage) => !TERMINAL_STAGES.includes(stage)).map((stage) => {
                    const value = leadsByStage[stage].reduce((sum, lead) => sum + lead.value, 0);
                    const width = totalPipeline > 0 ? Math.max(2, Math.round((value / totalPipeline) * 100)) : 0;
                    return (
                      <div key={stage}>
                        <div className="mb-1 flex items-center justify-between gap-3 text-sm"><span>{stage}</span><span className="font-mono font-semibold">{currency(value)}</span></div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="mb-5"><h2 className="font-semibold">Myyntilähteet</h2><p className="text-xs text-text-secondary">Painotetun arvon mukaan</p></div>
                <div className="divide-y">
                  {sourceSummary.map(([source, summary]) => (
                    <div key={source} className="grid grid-cols-[1fr_auto] gap-4 py-3">
                      <div><p className="font-medium">{source}</p><p className="text-xs text-text-secondary">{summary.count} mahdollisuutta · yhteensä {currency(summary.value)}</p></div>
                      <div className="text-right"><p className="font-mono font-bold">{currency(summary.weighted)}</p><p className="text-xs text-text-muted">painotettu</p></div>
                    </div>
                  ))}
                  {!sourceSummary.length && <p className="py-8 text-center text-sm text-text-muted">Ei analysoitavaa tarjouskantaa.</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={leadDialog} onOpenChange={setLeadDialog}>
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>{editingLead ? 'Muokkaa myyntimahdollisuutta' : 'Uusi myyntimahdollisuus'}</DialogTitle></DialogHeader>
          {errors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.map((item) => <p key={item}>{item}</p>)}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Mahdollisuuden nimi *</Label><Input value={leadForm.name} onChange={(event) => setLeadForm((previous) => ({ ...previous, name: event.target.value }))} placeholder="Esim. Rosalankuja 6 linjasaneeraus" /></div>
            <div className="space-y-2"><Label>Asiakas</Label><Select value={leadForm.customerId || 'none'} onValueChange={(value) => value === 'none' ? setLeadForm((previous) => ({ ...previous, customerId: '', siteId: '' })) : selectLeadCustomer(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei asiakaslinkkiä</SelectItem>{customers.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Kohde</Label><Select value={leadForm.siteId || 'none'} onValueChange={(value) => setLeadForm((previous) => ({ ...previous, siteId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei kohdetta</SelectItem>{leadSiteOptions.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Yritys / asiakasnimi</Label><Input value={leadForm.company} onChange={(event) => setLeadForm((previous) => ({ ...previous, company: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Vastuuhenkilö</Label><Select value={leadForm.assigneeUserId || 'none'} onValueChange={(value) => value === 'none' ? setLeadForm((previous) => ({ ...previous, assigneeUserId: '', assignee: '' })) : selectAssignee(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei vastuuhenkilöä</SelectItem>{people.map((item) => <SelectItem key={item.userId} value={item.userId}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Myyntiarvo €</Label><Input inputMode="decimal" value={leadForm.value} onChange={(event) => setLeadForm((previous) => ({ ...previous, value: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Arvioitu kustannus €</Label><Input inputMode="decimal" value={leadForm.estimatedCost} onChange={(event) => setLeadForm((previous) => ({ ...previous, estimatedCost: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Vaihe</Label><Select value={leadForm.stage} onValueChange={(stage: CrmLeadStage) => changeLeadStage(stage)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PIPELINE_STAGES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Todennäköisyys %</Label><Input type="number" min="0" max="100" value={leadForm.probability} onChange={(event) => setLeadForm((previous) => ({ ...previous, probability: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Myyntilähde</Label><Input value={leadForm.source} onChange={(event) => setLeadForm((previous) => ({ ...previous, source: event.target.value }))} placeholder="Suositus, kilpailutus, nykyasiakas…" /></div>
            <div className="space-y-2"><Label>Arvioitu päätöspäivä</Label><Input type="date" value={leadForm.expectedDecisionDate} onChange={(event) => setLeadForm((previous) => ({ ...previous, expectedDecisionDate: event.target.value, date: event.target.value || previous.date }))} /></div>
            {!TERMINAL_STAGES.includes(leadForm.stage) && leadForm.stage !== 'Jäissä' && <><div className="space-y-2 sm:col-span-2"><Label>Seuraava toimenpide *</Label><Input value={leadForm.nextAction} onChange={(event) => setLeadForm((previous) => ({ ...previous, nextAction: event.target.value }))} placeholder="Esim. Soita tilaajalle tarjouspalaverin jälkeen" /></div><div className="space-y-2"><Label>Seuraavan toimenpiteen määräaika *</Label><Input type="datetime-local" value={leadForm.nextActionDueAt} onChange={(event) => setLeadForm((previous) => ({ ...previous, nextActionDueAt: event.target.value }))} /></div></>}
            {leadForm.stage === 'Jäissä' && <div className="space-y-2"><Label>Tarkistetaan uudelleen *</Label><Input type="date" value={leadForm.frozenUntil} onChange={(event) => setLeadForm((previous) => ({ ...previous, frozenUntil: event.target.value }))} /></div>}
            {leadForm.stage === 'Hävitty' && <div className="space-y-2 sm:col-span-2"><Label>Häviämisen syy *</Label><Textarea value={leadForm.lostReason} onChange={(event) => setLeadForm((previous) => ({ ...previous, lostReason: event.target.value }))} /></div>}
            <div className="space-y-2 sm:col-span-2"><Label>Kuvaus ja rajaus</Label><Textarea value={leadForm.description} onChange={(event) => setLeadForm((previous) => ({ ...previous, description: event.target.value }))} rows={4} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setLeadDialog(false)}>Peruuta</Button><Button onClick={saveLead}>Tallenna</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activityDialog} onOpenChange={setActivityDialog}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Uusi CRM-tehtävä tai yhteydenotto</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Tyyppi</Label><Select value={activityForm.activityType} onValueChange={(value) => setActivityForm((previous) => ({ ...previous, activityType: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ACTIVITY_TYPES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Prioriteetti</Label><Select value={activityForm.priority} onValueChange={(value: CrmActivityPriority) => setActivityForm((previous) => ({ ...previous, priority: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Mahdollisuus</Label><Select value={activityForm.leadId || 'none'} onValueChange={(value) => value === 'none' ? setActivityForm((previous) => ({ ...previous, leadId: '' })) : selectActivityLead(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei mahdollisuutta</SelectItem>{crmLeads.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Asiakas</Label><Select value={activityForm.customerId || 'none'} onValueChange={(value) => setActivityForm((previous) => ({ ...previous, customerId: value === 'none' ? '' : value, siteId: '' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei asiakasta</SelectItem>{customers.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Kohde</Label><Select value={activityForm.siteId || 'none'} onValueChange={(value) => setActivityForm((previous) => ({ ...previous, siteId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei kohdetta</SelectItem>{activitySiteOptions.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Projekti</Label><Select value={activityForm.projectId || 'none'} onValueChange={(value) => setActivityForm((previous) => ({ ...previous, projectId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei projektia</SelectItem>{projects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 sm:col-span-2"><Label>Otsikko *</Label><Input value={activityForm.subject} onChange={(event) => setActivityForm((previous) => ({ ...previous, subject: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Määräaika</Label><Input type="datetime-local" value={activityForm.dueAt} onChange={(event) => setActivityForm((previous) => ({ ...previous, dueAt: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Vastuuhenkilö</Label><Select value={activityForm.assignedUserId || 'none'} onValueChange={(value) => setActivityForm((previous) => ({ ...previous, assignedUserId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei vastuuhenkilöä</SelectItem>{people.map((item) => <SelectItem key={item.userId} value={item.userId}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 sm:col-span-2"><Label>Kuvaus</Label><Textarea value={activityForm.description} onChange={(event) => setActivityForm((previous) => ({ ...previous, description: event.target.value }))} /></div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={activityForm.customerVisible} onChange={(event) => setActivityForm((previous) => ({ ...previous, customerVisible: event.target.checked }))} />Näytä asiakkaalle myöhemmässä asiakasportaalissa</label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setActivityDialog(false)}>Peruuta</Button><Button onClick={() => void saveActivity()} disabled={saving}>Tallenna</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={contactDialog} onOpenChange={setContactDialog}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Uusi yhteyshenkilö</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Asiakas *</Label><Select value={contactForm.customerId || 'none'} onValueChange={(value) => setContactForm((previous) => ({ ...previous, customerId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Valitse asiakas</SelectItem>{customers.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Nimi *</Label><Input value={contactForm.name} onChange={(event) => setContactForm((previous) => ({ ...previous, name: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Tehtävänimike</Label><Input value={contactForm.title} onChange={(event) => setContactForm((previous) => ({ ...previous, title: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Rooli asiakkuudessa</Label><Input value={contactForm.role} onChange={(event) => setContactForm((previous) => ({ ...previous, role: event.target.value }))} placeholder="Tilaaja, hyväksyjä, laskutus…" /></div>
            <div className="space-y-2"><Label>Ensisijainen kanava</Label><Select value={contactForm.preferredChannel} onValueChange={(value) => setContactForm((previous) => ({ ...previous, preferredChannel: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Sähköposti', 'Puhelin', 'Tekstiviesti', 'Teams'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Sähköposti</Label><Input type="email" value={contactForm.email} onChange={(event) => setContactForm((previous) => ({ ...previous, email: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Puhelin</Label><Input value={contactForm.phone} onChange={(event) => setContactForm((previous) => ({ ...previous, phone: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Tavoitettavuus</Label><Input value={contactForm.availabilityNotes} onChange={(event) => setContactForm((previous) => ({ ...previous, availabilityNotes: event.target.value }))} placeholder="Esim. parhaiten arkisin 8–11" /></div>
            <div className="grid gap-2 text-sm sm:col-span-2 sm:grid-cols-2"><label className="flex items-center gap-2"><input type="checkbox" checked={contactForm.isPrimary} onChange={(event) => setContactForm((previous) => ({ ...previous, isPrimary: event.target.checked }))} />Ensisijainen yhteyshenkilö</label><label className="flex items-center gap-2"><input type="checkbox" checked={contactForm.receivesQuotes} onChange={(event) => setContactForm((previous) => ({ ...previous, receivesQuotes: event.target.checked }))} />Vastaanottaa tarjoukset</label><label className="flex items-center gap-2"><input type="checkbox" checked={contactForm.receivesReports} onChange={(event) => setContactForm((previous) => ({ ...previous, receivesReports: event.target.checked }))} />Vastaanottaa raportit</label><label className="flex items-center gap-2"><input type="checkbox" checked={contactForm.receivesInvoices} onChange={(event) => setContactForm((previous) => ({ ...previous, receivesInvoices: event.target.checked }))} />Vastaanottaa laskut</label></div>
            <div className="space-y-2 sm:col-span-2"><Label>Muistiinpanot</Label><Textarea value={contactForm.notes} onChange={(event) => setContactForm((previous) => ({ ...previous, notes: event.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setContactDialog(false)}>Peruuta</Button><Button onClick={() => void saveContact()} disabled={saving}>Tallenna</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={siteDialog} onOpenChange={setSiteDialog}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Uusi asiakaskohde</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Asiakas *</Label><Select value={siteForm.customerId || 'none'} onValueChange={(value) => setSiteForm((previous) => ({ ...previous, customerId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Valitse asiakas</SelectItem>{customers.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 sm:col-span-2"><Label>Kohteen nimi *</Label><Input value={siteForm.name} onChange={(event) => setSiteForm((previous) => ({ ...previous, name: event.target.value }))} placeholder="Kiinteistö, taloyhtiö tai sopimuskohde" /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Osoite</Label><Input value={siteForm.address} onChange={(event) => setSiteForm((previous) => ({ ...previous, address: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Postinumero</Label><Input value={siteForm.postalCode} onChange={(event) => setSiteForm((previous) => ({ ...previous, postalCode: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Kaupunki</Label><Input value={siteForm.city} onChange={(event) => setSiteForm((previous) => ({ ...previous, city: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Kulku- ja avainohjeet</Label><Textarea value={siteForm.accessInstructions} onChange={(event) => setSiteForm((previous) => ({ ...previous, accessInstructions: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Yhteydenotto-ohjeet</Label><Textarea value={siteForm.contactInstructions} onChange={(event) => setSiteForm((previous) => ({ ...previous, contactInstructions: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Muistiinpanot</Label><Textarea value={siteForm.notes} onChange={(event) => setSiteForm((previous) => ({ ...previous, notes: event.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setSiteDialog(false)}>Peruuta</Button><Button onClick={() => void saveSite()} disabled={saving}>Tallenna</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedCustomer)} onOpenChange={(open) => { if (!open) setSelectedCustomerId(null); }}>
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-5xl">
          {selectedCustomer && selectedCustomerData && <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Building2 size={21} className="text-primary" />{selectedCustomer.name}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => openLeadCreate('Uusi', selectedCustomer)}><Plus size={14} className="mr-1" />Myyntimahdollisuus</Button>
              <Button size="sm" variant="outline" onClick={() => openActivity(undefined, selectedCustomer)}><CalendarDays size={14} className="mr-1" />Tehtävä</Button>
              <Button size="sm" variant="outline" onClick={() => openContact(selectedCustomer)}><UserRound size={14} className="mr-1" />Yhteyshenkilö</Button>
              <Button size="sm" variant="outline" onClick={() => openSite(selectedCustomer)}><MapPin size={14} className="mr-1" />Kohde</Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border p-4"><p className="text-xs text-text-secondary">Avoin tarjouskanta</p><p className="mt-1 font-mono text-xl font-bold">{currency(selectedCustomerData.leads.filter((lead) => !TERMINAL_STAGES.includes(lead.stage)).reduce((sum, lead) => sum + lead.value, 0))}</p></div>
              <div className="rounded-xl border p-4"><p className="text-xs text-text-secondary">Aktiiviset projektit</p><p className="mt-1 font-mono text-xl font-bold">{selectedCustomerData.projects.filter((project) => project.status !== 'Valmis').length}</p></div>
              <div className="rounded-xl border p-4"><p className="text-xs text-text-secondary">Kohteet</p><p className="mt-1 font-mono text-xl font-bold">{selectedCustomerData.sites.length}</p></div>
              <div className="rounded-xl border p-4"><p className="text-xs text-text-secondary">Avoimet tehtävät</p><p className="mt-1 font-mono text-xl font-bold">{selectedCustomerData.activities.filter((activity) => !activity.completedAt).length}</p></div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardContent className="p-5">
                  <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">Yhteyshenkilöt</h3><UserRound size={18} className="text-primary" /></div>
                  <div className="space-y-3">
                    {selectedCustomerData.contacts.map((contact) => (
                      <div key={contact.id} className="rounded-xl border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div><p className="font-medium">{contact.name}{contact.isPrimary ? ' · ensisijainen' : ''}</p><p className="text-xs text-text-secondary">{contact.role || contact.title || 'Rooli puuttuu'}</p></div>
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteTarget({ kind: 'contact', id: contact.id, label: contact.name })}><Trash2 size={15} /></Button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">{contact.email && <span className="flex items-center gap-1"><Mail size={12} />{contact.email}</span>}{contact.phone && <span className="flex items-center gap-1"><Phone size={12} />{contact.phone}</span>}</div>
                        <div className="mt-2 flex flex-wrap gap-1">{contact.receivesQuotes && <Badge variant="secondary">Tarjoukset</Badge>}{contact.receivesReports && <Badge variant="secondary">Raportit</Badge>}{contact.receivesInvoices && <Badge variant="secondary">Laskut</Badge>}</div>
                      </div>
                    ))}
                    {!selectedCustomerData.contacts.length && <p className="text-sm text-text-muted">Ei yhteyshenkilöitä.</p>}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">Kohteet</h3><MapPin size={18} className="text-primary" /></div>
                  <div className="space-y-3">
                    {selectedCustomerData.sites.map((site) => (
                      <div key={site.id} className="rounded-xl border p-3">
                        <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{site.name}</p><p className="text-xs text-text-secondary">{[site.address, site.postalCode, site.city].filter(Boolean).join(', ') || 'Osoite puuttuu'}</p></div><Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteTarget({ kind: 'site', id: site.id, label: site.name })}><Trash2 size={15} /></Button></div>
                        {site.accessInstructions && <p className="mt-2 text-xs text-text-secondary"><span className="font-medium">Kulku:</span> {site.accessInstructions}</p>}
                      </div>
                    ))}
                    {!selectedCustomerData.sites.length && <p className="text-sm text-text-muted">Ei rekisteröityjä kohteita.</p>}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">Projektit ja myynti</h3><Briefcase size={18} className="text-primary" /></div>
                  <div className="space-y-3">
                    {selectedCustomerData.leads.map((lead) => <button key={lead.id} type="button" onClick={() => openLeadEdit(lead)} className="flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left hover:bg-muted/40"><div className="min-w-0"><p className="truncate font-medium">{lead.name}</p><Badge variant="outline" className={`mt-1 ${stageClass(lead.stage)}`}>{lead.stage}</Badge></div><span className="font-mono font-bold">{currency(lead.value)}</span></button>)}
                    {selectedCustomerData.projects.map((project) => <div key={project.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="truncate font-medium">{project.name}</p><p className="text-xs text-text-secondary">{project.status} · {project.progress} %</p></div><span className="font-mono text-sm font-bold">{currency(project.budget)}</span></div>)}
                    {!selectedCustomerData.leads.length && !selectedCustomerData.projects.length && <p className="text-sm text-text-muted">Ei myyntimahdollisuuksia tai projekteja.</p>}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">Asiakkuuden aikajana</h3><Clock3 size={18} className="text-primary" /></div>
                  <div className="space-y-4">
                    {selectedCustomerData.activities.slice(0, 12).map((activity) => (
                      <div key={activity.id} className="flex gap-3">
                        <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${activity.completedAt ? 'bg-emerald-500' : activity.dueAt && isPast(activity.dueAt) ? 'bg-red-500' : 'bg-primary'}`} />
                        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{activity.subject}</p><Badge variant="outline">{activity.activityType}</Badge></div><p className="text-xs text-text-secondary">{activity.completedAt ? `Valmis ${dateTime(activity.completedAt)}` : activity.dueAt ? `Määräaika ${dateTime(activity.dueAt)}` : `Luotu ${dateTime(activity.createdAt)}`}</p>{activity.description && <p className="mt-1 text-sm text-text-secondary">{activity.description}</p>}</div>
                      </div>
                    ))}
                    {!selectedCustomerData.activities.length && <p className="text-sm text-text-muted">Ei yhteydenottohistoriaa.</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Poistetaanko “{deleteTarget?.label}”?</AlertDialogTitle><AlertDialogDescription>Poistoa ei voi perua. Linkitetyt tiedot voivat menettää tämän yhteyden.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={saving} onClick={() => void handleDelete()}>Poista</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
