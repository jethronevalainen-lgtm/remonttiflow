import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Link2,
  MessageSquareWarning,
  Pencil,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UserRound,
  Wrench,
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
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCrmAftercare } from '@/hooks/useCrmAftercare';
import { useCustomerRelations } from '@/hooks/useCustomerRelations';
import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import {
  createCustomerCase,
  deleteCustomerCase,
  submitCustomerCaseForAcceptance,
  updateCustomerCase,
  type CustomerCase,
  type CustomerCasePriority,
  type CustomerCaseStatus,
  type CustomerCaseType,
} from '@/lib/supabase/crmAftercare';

const CASE_TYPES: CustomerCaseType[] = ['Reklamaatio', 'Takuu', 'Laatupoikkeama', 'Huolto'];
const PRIORITIES: CustomerCasePriority[] = ['Matala', 'Normaali', 'Korkea', 'Kriittinen'];
const STATUSES: CustomerCaseStatus[] = [
  'Uusi',
  'Selvityksessä',
  'Korjaus sovittu',
  'Korjauksessa',
  'Odottaa asiakkaan hyväksyntää',
  'Suljettu',
  'Hylätty',
];
const TERMINAL_STATUSES: CustomerCaseStatus[] = ['Suljettu', 'Hylätty'];

interface CaseForm {
  customerId: string;
  siteId: string;
  projectId: string;
  workOrderId: string;
  caseType: CustomerCaseType;
  title: string;
  description: string;
  reportedByName: string;
  reportedByEmail: string;
  reportedByPhone: string;
  reportedAt: string;
  priority: CustomerCasePriority;
  status: CustomerCaseStatus;
  dueAt: string;
  assignedUserId: string;
  warrantyCovered: 'unknown' | 'yes' | 'no';
  rootCause: string;
  resolution: string;
  estimatedCost: string;
  actualCost: string;
  customerVisible: boolean;
}

function emptyForm(): CaseForm {
  return {
    customerId: '',
    siteId: '',
    projectId: '',
    workOrderId: '',
    caseType: 'Reklamaatio',
    title: '',
    description: '',
    reportedByName: '',
    reportedByEmail: '',
    reportedByPhone: '',
    reportedAt: new Date().toISOString().slice(0, 16),
    priority: 'Normaali',
    status: 'Uusi',
    dueAt: '',
    assignedUserId: '',
    warrantyCovered: 'unknown',
    rootCause: '',
    resolution: '',
    estimatedCost: '0',
    actualCost: '0',
    customerVisible: false,
  };
}

function localDateTime(value?: string): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function dateTime(value?: string): string {
  if (!value) return 'Ei asetettu';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

function euroFromCents(value: number): string {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

function cents(value: string): number {
  const parsed = Number(value.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : Number.NaN;
}

function isOverdue(item: CustomerCase): boolean {
  return Boolean(
    item.dueAt
    && !TERMINAL_STATUSES.includes(item.status)
    && new Date(item.dueAt).getTime() < Date.now(),
  );
}

function statusClass(status: CustomerCaseStatus): string {
  if (status === 'Suljettu') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Hylätty') return 'border-slate-200 bg-slate-100 text-slate-700';
  if (status === 'Odottaa asiakkaan hyväksyntää') return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  if (status === 'Korjauksessa' || status === 'Korjaus sovittu') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (status === 'Selvityksessä') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-orange-200 bg-orange-50 text-orange-700';
}

function priorityClass(priority: CustomerCasePriority): string {
  if (priority === 'Kriittinen') return 'border-red-200 bg-red-50 text-red-700';
  if (priority === 'Korkea') return 'border-orange-200 bg-orange-50 text-orange-700';
  if (priority === 'Matala') return 'border-slate-200 bg-slate-50 text-slate-600';
  return 'border-blue-200 bg-blue-50 text-blue-700';
}

export function CrmAftercarePanel() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { customers, projects, workOrders } = useAppDataContext();
  const { sites } = useCustomerRelations();
  const { people } = useRoleWorkspace();
  const aftercare = useCrmAftercare();

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [typeFilter, setTypeFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerCase | null>(null);
  const [form, setForm] = useState<CaseForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<CustomerCase | null>(null);
  const [acceptanceTarget, setAcceptanceTarget] = useState<CustomerCase | null>(null);
  const [acceptanceResolution, setAcceptanceResolution] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const openCases = aftercare.cases.filter((item) => !TERMINAL_STATUSES.includes(item.status));
  const overdueCases = openCases.filter(isOverdue);
  const warrantyCases = openCases.filter((item) => item.caseType === 'Takuu' || item.warrantyCovered === true);
  const awaitingCustomer = openCases.filter((item) => item.status === 'Odottaa asiakkaan hyväksyntää');
  const actualCost = aftercare.cases.reduce((sum, item) => sum + item.actualCostCents, 0);
  const pendingChangeOrders = aftercare.changeOrders.filter(
    (item) => item.customerVisible && (!item.customerDecision || item.customerDecision === 'Odottaa'),
  );
  const portalCustomerIds = new Set(aftercare.portalUsers.map((item) => item.customerId));
  const normalizedQuery = query.trim().toLocaleLowerCase('fi-FI');

  const filtered = useMemo(() => aftercare.cases.filter((item) => {
    if (statusFilter === 'open' && TERMINAL_STATUSES.includes(item.status)) return false;
    if (statusFilter === 'overdue' && !isOverdue(item)) return false;
    if (statusFilter === 'waiting' && item.status !== 'Odottaa asiakkaan hyväksyntää') return false;
    if (statusFilter === 'closed' && !TERMINAL_STATUSES.includes(item.status)) return false;
    if (typeFilter !== 'all' && item.caseType !== typeFilter) return false;
    if (customerFilter !== 'all' && item.customerId !== customerFilter) return false;
    if (!normalizedQuery) return true;

    const customer = customers.find((entry) => entry.id === item.customerId);
    const project = projects.find((entry) => entry.id === item.projectId);
    const site = sites.find((entry) => entry.id === item.siteId);
    const assignee = people.find((entry) => entry.userId === item.assignedUserId);
    return [
      item.caseNumber,
      item.title,
      item.description,
      item.rootCause,
      item.resolution,
      customer?.name,
      project?.name,
      site?.name,
      assignee?.name,
    ].filter(Boolean).join(' ').toLocaleLowerCase('fi-FI').includes(normalizedQuery);
  }), [aftercare.cases, customerFilter, customers, normalizedQuery, people, projects, sites, statusFilter, typeFilter]);

  const availableProjects = projects.filter(
    (project) => !form.customerId || project.customerId === form.customerId || project.customer === customers.find((item) => item.id === form.customerId)?.name,
  );
  const availableSites = sites.filter((site) => !form.customerId || site.customerId === form.customerId);
  const availableWorkOrders = workOrders.filter((order) => !form.projectId || order.projectId === form.projectId);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError(null);
    setSuccess(null);
    setDialogOpen(true);
  };

  const openEdit = (item: CustomerCase) => {
    setEditing(item);
    setForm({
      customerId: item.customerId,
      siteId: item.siteId ?? '',
      projectId: item.projectId ?? '',
      workOrderId: item.workOrderId ?? '',
      caseType: item.caseType,
      title: item.title,
      description: item.description,
      reportedByName: item.reportedByName ?? '',
      reportedByEmail: item.reportedByEmail ?? '',
      reportedByPhone: item.reportedByPhone ?? '',
      reportedAt: localDateTime(item.reportedAt),
      priority: item.priority,
      status: item.status,
      dueAt: localDateTime(item.dueAt),
      assignedUserId: item.assignedUserId ?? '',
      warrantyCovered: item.warrantyCovered === true ? 'yes' : item.warrantyCovered === false ? 'no' : 'unknown',
      rootCause: item.rootCause ?? '',
      resolution: item.resolution ?? '',
      estimatedCost: String(item.estimatedCostCents / 100),
      actualCost: String(item.actualCostCents / 100),
      customerVisible: item.customerVisible,
    });
    setError(null);
    setSuccess(null);
    setDialogOpen(true);
  };

  const chooseCustomer = (customerId: string) => {
    setForm((previous) => ({
      ...previous,
      customerId,
      siteId: sites.some((site) => site.id === previous.siteId && site.customerId === customerId) ? previous.siteId : '',
      projectId: projects.some((project) => project.id === previous.projectId && (project.customerId === customerId || project.customer === customers.find((item) => item.id === customerId)?.name)) ? previous.projectId : '',
      workOrderId: '',
    }));
  };

  const chooseProject = (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    setForm((previous) => ({
      ...previous,
      projectId,
      siteId: project?.customerSiteId ?? previous.siteId,
      workOrderId: '',
    }));
  };

  const save = async () => {
    if (!currentOrg) return;
    const estimatedCostCents = cents(form.estimatedCost);
    const actualCostCents = cents(form.actualCost);
    if (!form.customerId) {
      setError('Valitse asiakas.');
      return;
    }
    if (form.title.trim().length < 3 || form.description.trim().length < 10) {
      setError('Anna vähintään kolmen merkin otsikko ja riittävä kuvaus.');
      return;
    }
    if (!Number.isFinite(estimatedCostCents) || estimatedCostCents < 0 || !Number.isFinite(actualCostCents) || actualCostCents < 0) {
      setError('Kustannusten pitää olla nolla tai positiivisia euromääriä.');
      return;
    }
    if (form.status === 'Odottaa asiakkaan hyväksyntää' && (!form.projectId || !form.resolution.trim())) {
      setError('Asiakkaan hyväksyntä vaatii projektin ja kirjatun ratkaisun.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        customerId: form.customerId,
        siteId: form.siteId || undefined,
        projectId: form.projectId || undefined,
        workOrderId: form.workOrderId || undefined,
        caseType: form.caseType,
        title: form.title,
        description: form.description,
        reportedByName: form.reportedByName,
        reportedByEmail: form.reportedByEmail,
        reportedByPhone: form.reportedByPhone,
        reportedAt: form.reportedAt ? new Date(form.reportedAt).toISOString() : undefined,
        priority: form.priority,
        status: form.status,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
        assignedUserId: form.assignedUserId || undefined,
        warrantyCovered: form.warrantyCovered === 'unknown' ? null : form.warrantyCovered === 'yes',
        rootCause: form.rootCause,
        resolution: form.resolution,
        estimatedCostCents,
        actualCostCents,
        customerVisible: form.customerVisible,
        customerDecision: form.status === 'Odottaa asiakkaan hyväksyntää'
          ? 'Odottaa' as const
          : TERMINAL_STATUSES.includes(form.status)
            ? editing?.customerDecision ?? null
            : null,
        closedAt: TERMINAL_STATUSES.includes(form.status)
          ? editing?.closedAt ?? new Date().toISOString()
          : '',
      };
      if (editing) await updateCustomerCase(currentOrg.id, editing.id, payload);
      else await createCustomerCase(currentOrg.id, user?.id, payload);
      await aftercare.refresh();
      setDialogOpen(false);
      setSuccess(editing ? 'Asia päivitettiin.' : 'Asia luotiin.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!currentOrg || !deleteTarget) return;
    setSaving(true);
    setError(null);
    try {
      await deleteCustomerCase(currentOrg.id, deleteTarget.id);
      await aftercare.refresh();
      setDeleteTarget(null);
      setSuccess('Asia poistettiin.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const startAcceptance = (item: CustomerCase) => {
    setAcceptanceTarget(item);
    setAcceptanceResolution(item.resolution ?? '');
    setError(null);
  };

  const sendAcceptance = async () => {
    if (!currentOrg || !acceptanceTarget) return;
    if (!acceptanceTarget.projectId) {
      setError('Liitä asia projektiin ennen asiakkaan hyväksynnän pyytämistä.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await submitCustomerCaseForAcceptance(currentOrg.id, acceptanceTarget.id, acceptanceResolution);
      await aftercare.refresh();
      setAcceptanceTarget(null);
      setSuccess('Ratkaisu lähetettiin asiakkaan hyväksyttäväksi.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Hyväksyntäpyynnön lähetys epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Reklamaatiot, takuu ja jälkihoito</h2>
          <p className="mt-1 text-sm text-text-secondary">Ohjaa ilmoitus selvityksestä korjaukseen, asiakkaan hyväksyntään ja sulkemiseen.</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} className="mr-2" />Uusi asia</Button>
      </div>

      {(error || aftercare.error) && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />{error ?? aftercare.error}
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />{success}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          { label: 'Avoimet asiat', value: String(openCases.length), detail: `${overdueCases.length} myöhässä`, icon: MessageSquareWarning },
          { label: 'Takuuasiat', value: String(warrantyCases.length), detail: 'Avoimet takuu- ja takuukorjaukset', icon: ShieldCheck },
          { label: 'Asiakkaan päätös', value: String(awaitingCustomer.length), detail: 'Odottaa hyväksyntää', icon: FileCheck2 },
          { label: 'Takuukustannus', value: euroFromCents(actualCost), detail: 'Kaikkien asioiden toteuma', icon: CircleDollarSign },
          { label: 'Lisätyöt päätettävänä', value: String(pendingChangeOrders.length), detail: 'Asiakkaalle lähetetyt', icon: Link2 },
          { label: 'Portaaliasiakkaat', value: String(portalCustomerIds.size), detail: `${aftercare.portalUsers.length} käyttäjälinkkiä`, icon: UserRound },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><p className="text-xs text-text-secondary">{item.label}</p><p className="mt-2 break-words font-mono text-xl font-bold">{item.value}</p><p className="mt-1 text-[11px] text-text-muted">{item.detail}</p></div>
                <div className="rounded-lg bg-primary/10 p-2 text-primary"><item.icon size={17} /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 xl:grid-cols-[1fr_190px_190px_230px]">
            <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hae numerolla, asiakkaalla, kohteella, syyllä tai ratkaisulla" /></div>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Avoimet</SelectItem><SelectItem value="overdue">Myöhässä</SelectItem><SelectItem value="waiting">Odottaa asiakasta</SelectItem><SelectItem value="closed">Suljetut</SelectItem><SelectItem value="all">Kaikki</SelectItem></SelectContent></Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Kaikki tyypit</SelectItem>{CASE_TYPES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
            <Select value={customerFilter} onValueChange={setCustomerFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Kaikki asiakkaat</SelectItem>{customers.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {filtered.map((item) => {
              const customer = customers.find((entry) => entry.id === item.customerId);
              const project = projects.find((entry) => entry.id === item.projectId);
              const site = sites.find((entry) => entry.id === item.siteId);
              const assignee = people.find((entry) => entry.userId === item.assignedUserId);
              const overdue = isOverdue(item);
              return (
                <article key={item.id} className={`grid gap-4 px-5 py-5 xl:grid-cols-[180px_minmax(260px,1.5fr)_minmax(220px,1fr)_180px_170px] xl:items-center ${overdue ? 'bg-red-50/40' : ''}`}>
                  <div>
                    <div className="flex flex-wrap gap-1"><Badge variant="outline">{item.caseType}</Badge><Badge variant="outline" className={priorityClass(item.priority)}>{item.priority}</Badge></div>
                    <p className="mt-2 font-mono text-sm font-bold text-text-primary">{item.caseNumber}</p>
                    <p className="text-xs text-text-muted">Ilmoitettu {dateTime(item.reportedAt)}</p>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.title}</h3><Badge variant="outline" className={statusClass(item.status)}>{item.status}</Badge>{overdue && <Badge className="border-0 bg-red-600 text-white">Myöhässä</Badge>}</div>
                    <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{item.description}</p>
                    {item.resolution && <p className="mt-2 line-clamp-1 text-xs text-emerald-700"><span className="font-semibold">Ratkaisu:</span> {item.resolution}</p>}
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="flex items-center gap-1.5"><Building2 size={14} className="text-text-muted" />{customer?.name || 'Asiakas puuttuu'}</p>
                    <p className="truncate text-xs text-text-secondary">{project?.name || 'Ei projektia'}{site ? ` · ${site.name}` : ''}</p>
                    <p className="flex items-center gap-1.5 text-xs text-text-secondary"><UserRound size={13} />{assignee?.name || 'Ei vastuuhenkilöä'}</p>
                  </div>
                  <div className="text-sm">
                    <p className={overdue ? 'font-semibold text-red-700' : ''}><Clock3 size={14} className="mr-1 inline" />{dateTime(item.dueAt)}</p>
                    <p className="mt-1 text-xs text-text-secondary">Toteuma {euroFromCents(item.actualCostCents)}</p>
                    {item.customerVisible && <p className="mt-1 text-xs text-indigo-700">Näkyy asiakkaalle</p>}
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {!TERMINAL_STATUSES.includes(item.status) && item.status !== 'Odottaa asiakkaan hyväksyntää' && (
                      <Button variant="ghost" size="sm" title="Lähetä asiakkaan hyväksyttäväksi" onClick={() => startAcceptance(item)}><Send size={16} /></Button>
                    )}
                    <Button variant="ghost" size="sm" title="Muokkaa" onClick={() => openEdit(item)}><Pencil size={16} /></Button>
                    <Button variant="ghost" size="sm" className="text-red-600" title="Poista" onClick={() => setDeleteTarget(item)}><Trash2 size={16} /></Button>
                  </div>
                </article>
              );
            })}
            {!filtered.length && (
              <div className="p-12 text-center"><Wrench size={42} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei asioita valitulla rajauksella</p><p className="text-sm text-text-secondary">Uusi reklamaatio syntyy myös automaattisesti asiakkaan reklamaatiotyöpyynnöstä.</p></div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className="mb-4"><h3 className="font-semibold">Asiakkaan päätöstä odottavat lisätyöt</h3><p className="text-xs text-text-secondary">CRM yhdistää olemassa olevan muutostyöketjun samaan tilannekuvaan.</p></div>
            <div className="space-y-3">
              {pendingChangeOrders.slice(0, 8).map((item) => {
                const project = projects.find((entry) => entry.id === item.projectId);
                return <div key={item.id} className="flex items-center justify-between gap-4 rounded-xl border p-3"><div className="min-w-0"><p className="truncate font-medium">{item.title}</p><p className="truncate text-xs text-text-secondary">{project?.name || 'Projekti'} · {item.status}</p></div><span className="font-mono font-bold">{euroFromCents(item.amountCents)}</span></div>;
              })}
              {!pendingChangeOrders.length && <p className="text-sm text-text-muted">Ei asiakkaan päätöstä odottavia lisätöitä.</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="mb-4"><h3 className="font-semibold">Asiakasportaalin kattavuus</h3><p className="text-xs text-text-secondary">Näet, millä asiakkailla on digitaalinen projektinäkymä käytössä.</p></div>
            <div className="space-y-3">
              {customers.filter((customer) => portalCustomerIds.has(customer.id)).slice(0, 8).map((customer) => {
                const users = aftercare.portalUsers.filter((item) => item.customerId === customer.id);
                return <div key={customer.id} className="flex items-center justify-between gap-4 rounded-xl border p-3"><div><p className="font-medium">{customer.name}</p><p className="text-xs text-text-secondary">{users.some((item) => item.accessScope === 'all_projects') ? 'Kaikki projektit' : 'Valitut projektit'}</p></div><Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">{users.length} käyttäjää</Badge></div>;
              })}
              {!portalCustomerIds.size && <p className="text-sm text-text-muted">Asiakasportaaliin ei ole vielä liitetty asiakkaita.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader><DialogTitle>{editing ? `Muokkaa ${editing.caseNumber}` : 'Uusi reklamaatio- tai takuuasia'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2"><Label>Asiakas *</Label><Select value={form.customerId || 'none'} onValueChange={(value) => chooseCustomer(value === 'none' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Valitse asiakas</SelectItem>{customers.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Projekti</Label><Select value={form.projectId || 'none'} onValueChange={(value) => chooseProject(value === 'none' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei projektia</SelectItem>{availableProjects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Kohde</Label><Select value={form.siteId || 'none'} onValueChange={(value) => setForm((previous) => ({ ...previous, siteId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei kohdetta</SelectItem>{availableSites.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Työmääräys</Label><Select value={form.workOrderId || 'none'} onValueChange={(value) => setForm((previous) => ({ ...previous, workOrderId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei työmääräystä</SelectItem>{availableWorkOrders.map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Tyyppi</Label><Select value={form.caseType} onValueChange={(value: CustomerCaseType) => setForm((previous) => ({ ...previous, caseType: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CASE_TYPES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Prioriteetti</Label><Select value={form.priority} onValueChange={(value: CustomerCasePriority) => setForm((previous) => ({ ...previous, priority: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-3"><Label>Otsikko *</Label><Input value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-3"><Label>Kuvaus *</Label><Textarea rows={4} value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Ilmoittaja</Label><Input value={form.reportedByName} onChange={(event) => setForm((previous) => ({ ...previous, reportedByName: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Ilmoittajan sähköposti</Label><Input type="email" value={form.reportedByEmail} onChange={(event) => setForm((previous) => ({ ...previous, reportedByEmail: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Ilmoittajan puhelin</Label><Input value={form.reportedByPhone} onChange={(event) => setForm((previous) => ({ ...previous, reportedByPhone: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Ilmoitettu</Label><Input type="datetime-local" value={form.reportedAt} onChange={(event) => setForm((previous) => ({ ...previous, reportedAt: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Määräaika</Label><Input type="datetime-local" value={form.dueAt} onChange={(event) => setForm((previous) => ({ ...previous, dueAt: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Vastuuhenkilö</Label><Select value={form.assignedUserId || 'none'} onValueChange={(value) => setForm((previous) => ({ ...previous, assignedUserId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei vastuuhenkilöä</SelectItem>{people.map((item) => <SelectItem key={item.userId} value={item.userId}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Tila</Label><Select value={form.status} onValueChange={(value: CustomerCaseStatus) => setForm((previous) => ({ ...previous, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Kuuluuko takuuseen?</Label><Select value={form.warrantyCovered} onValueChange={(value: CaseForm['warrantyCovered']) => setForm((previous) => ({ ...previous, warrantyCovered: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">Ei ratkaistu</SelectItem><SelectItem value="yes">Kyllä</SelectItem><SelectItem value="no">Ei</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Arvioitu kustannus €</Label><Input inputMode="decimal" value={form.estimatedCost} onChange={(event) => setForm((previous) => ({ ...previous, estimatedCost: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Toteutunut kustannus €</Label><Input inputMode="decimal" value={form.actualCost} onChange={(event) => setForm((previous) => ({ ...previous, actualCost: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-3"><Label>Juurisyy</Label><Textarea value={form.rootCause} onChange={(event) => setForm((previous) => ({ ...previous, rootCause: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-3"><Label>Ratkaisu ja tehdyt toimenpiteet</Label><Textarea rows={4} value={form.resolution} onChange={(event) => setForm((previous) => ({ ...previous, resolution: event.target.value }))} /></div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-3"><input type="checkbox" checked={form.customerVisible} onChange={(event) => setForm((previous) => ({ ...previous, customerVisible: event.target.checked }))} />Näytä asia asiakkaan projektinäkymässä</label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Peruuta</Button><Button disabled={saving} onClick={() => void save()}>Tallenna</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(acceptanceTarget)} onOpenChange={(open) => { if (!open) setAcceptanceTarget(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Lähetä ratkaisu asiakkaan hyväksyttäväksi</DialogTitle></DialogHeader>
          <div className="space-y-4"><div className="rounded-xl border bg-muted/40 p-4"><p className="font-semibold">{acceptanceTarget?.caseNumber} · {acceptanceTarget?.title}</p><p className="mt-1 text-sm text-text-secondary">Asiakas voi hyväksyä ratkaisun tai palauttaa asian uudelleen selvitettäväksi.</p></div><div className="space-y-2"><Label>Ratkaisu *</Label><Textarea rows={6} value={acceptanceResolution} onChange={(event) => setAcceptanceResolution(event.target.value)} /></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setAcceptanceTarget(null)}>Peruuta</Button><Button disabled={saving} onClick={() => void sendAcceptance()}><Send size={15} className="mr-2" />Lähetä</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Poistetaanko {deleteTarget?.caseNumber}?</AlertDialogTitle><AlertDialogDescription>Poistoa ei voi perua. Audit-loki säilyttää tiedon tehdystä poistosta.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={saving} onClick={() => void remove()}>Poista</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
