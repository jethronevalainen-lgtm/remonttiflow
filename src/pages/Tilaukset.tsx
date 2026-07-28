import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, Bell, CheckCircle2, ClipboardList, Eye, FileCheck2, Filter,
  Loader2, MessageCircle, Plus, RefreshCw, Search, Send, Settings2,
  ShieldCheck, UserCog, UserPlus, UsersRound,
} from 'lucide-react';

import CustomerOrderWorkspace from '@/components/customer/CustomerOrderWorkspace';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import {
  loadManagementPortalDashboard,
  setInspectionCustomerVisibility,
  updatePortalUser,
  type ManagementInspection,
  type ManagementPortalDashboard,
  type ManagementPortalUser,
  type PortalOrderStatus,
  type PortalProfile,
} from '@/lib/supabase/customerPortalOrders';
import { publishCustomerPortalUpdate } from '@/lib/supabase/customerPortalPublications';
import { convertCustomerWorkRequest } from '@/lib/supabase/customerWorkRequests';
import type { WorkAssignmentScope, WorkOrderPriority } from '@/types';

const PROFILES: Array<{ value: PortalProfile; label: string; description: string }> = [
  { value: 'viewer', label: 'Katselija', description: 'Näkee projektit, tilaukset ja julkaistut aineistot.' },
  { value: 'contact', label: 'Yhteyshenkilö', description: 'Voi tilata, täydentää ja keskustella.' },
  { value: 'approver', label: 'Hyväksyjä', description: 'Voi hyväksyä päätökset ja kuitata julkaisut.' },
  { value: 'finance', label: 'Talouskäyttäjä', description: 'Näkee taloustiedot ja kaupalliset päätökset.' },
  { value: 'admin', label: 'Tilaajan pääkäyttäjä', description: 'Kaikki tilaajaportaalin oikeudet.' },
];

const PERMISSIONS = [
  ['orders.create', 'Tilaa uusia töitä'],
  ['orders.edit', 'Muokkaa tilauksia'],
  ['messages.write', 'Osallistu keskusteluun'],
  ['decisions.make', 'Hyväksy päätökset'],
  ['finance.read', 'Näe taloustiedot'],
  ['users.manage', 'Hallitse tilaajakäyttäjiä'],
] as const;

interface ConvertDraft {
  dueDate: string;
  priority: WorkOrderPriority;
  scope: WorkAssignmentScope;
  assignees: string[];
  note: string;
}

function dateLabel(value?: string) {
  if (!value) return 'Ei määritetty';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fi-FI');
}

function statusTone(status: PortalOrderStatus) {
  if (status === 'Valmis') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Peruttu') return 'border-slate-200 bg-slate-100 text-slate-600';
  if (status === 'Tarkennettava' || status === 'Odottaa') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'Käynnissä') return 'border-orange-200 bg-orange-50 text-orange-700';
  return 'border-blue-200 bg-blue-50 text-blue-700';
}

export default function Tilaukset() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestId = searchParams.get('order');
  const { currentOrg } = useOrganization();
  const { projects, refresh: refreshDomain } = useAppDataContext();
  const { people, projectMemberships, canManage, refresh: refreshWorkspace } = useRoleWorkspace();
  const [dashboard, setDashboard] = useState<ManagementPortalDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [convertId, setConvertId] = useState<string | null>(null);
  const [convertDraft, setConvertDraft] = useState<ConvertDraft>({
    dueDate: '', priority: 'Normaali', scope: 'people', assignees: [], note: '',
  });
  const [userTarget, setUserTarget] = useState<ManagementPortalUser | null>(null);
  const [userProfile, setUserProfile] = useState<PortalProfile>('contact');
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
  const [userDisabled, setUserDisabled] = useState(false);
  const [inspectionTarget, setInspectionTarget] = useState<ManagementInspection | null>(null);
  const [inspectionAck, setInspectionAck] = useState(false);
  const [publicationOpen, setPublicationOpen] = useState(false);
  const [publicationProjectId, setPublicationProjectId] = useState('');
  const [publicationTitle, setPublicationTitle] = useState('');
  const [publicationSummary, setPublicationSummary] = useState('');
  const [publicationAck, setPublicationAck] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentOrg || !canManage) return;
    setLoading(true);
    try {
      setDashboard(await loadManagementPortalDashboard(currentOrg.id));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tilaajaportaalin hallinnan lataus epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [canManage, currentOrg]);

  useEffect(() => { void refresh(); }, [refresh]);

  const openOrder = (id: string) => setSearchParams((current) => {
    const next = new URLSearchParams(current);
    next.set('order', id);
    return next;
  });

  const closeOrder = () => setSearchParams((current) => {
    const next = new URLSearchParams(current);
    next.delete('order');
    return next;
  });

  const filteredOrders = useMemo(() => {
    if (!dashboard) return [];
    const query = search.trim().toLocaleLowerCase('fi');
    return dashboard.orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (customerFilter !== 'all' && order.customerId !== customerFilter) return false;
      return !query || `${order.orderNumber} ${order.title} ${order.projectName} ${order.customerName}`
        .toLocaleLowerCase('fi')
        .includes(query);
    });
  }, [customerFilter, dashboard, search, statusFilter]);

  const selectedOrder = dashboard?.orders.find((item) => item.id === convertId);
  const projectWorkerIds = new Set(
    projectMemberships
      .filter((item) => item.projectId === selectedOrder?.projectId)
      .map((item) => item.userId),
  );
  const availableWorkers = people.filter((person) => person.role === 'worker' && projectWorkerIds.has(person.userId));

  const startConvert = (id: string) => {
    const order = dashboard?.orders.find((item) => item.id === id);
    if (!order) return;
    setConvertId(id);
    setConvertDraft({
      dueDate: order.plannedEndDate || order.desiredCompletionDate || order.requestedDate || '',
      priority: order.urgency === 'Kiireellinen' ? 'Korkea' : 'Normaali',
      scope: 'people',
      assignees: [],
      note: '',
    });
  };

  const convert = async () => {
    if (!convertId) return;
    if (convertDraft.scope === 'people' && convertDraft.assignees.length === 0) {
      setError('Valitse vähintään yksi toteuttaja projektitiimistä.');
      return;
    }
    if (convertDraft.scope === 'project_team' && availableWorkers.length === 0) {
      setError('Projektitiimissä ei ole toteuttajia.');
      return;
    }

    setSaving(true);
    try {
      await convertCustomerWorkRequest({
        requestId: convertId,
        dueDate: convertDraft.dueDate,
        priority: convertDraft.priority,
        assignmentScope: convertDraft.scope,
        assigneeUserIds: convertDraft.assignees,
        supervisorNote: convertDraft.note,
      });
      setConvertId(null);
      setSuccess('Tilauksesta luotiin työmääräys ja toteutusosapuolet liitettiin tilauskohtaiseen keskusteluun.');
      await Promise.all([refresh(), refreshWorkspace(), refreshDomain()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Työmääräyksen luominen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const openUser = (portalUser: ManagementPortalUser) => {
    setUserTarget(portalUser);
    setUserProfile(portalUser.profile);
    setUserPermissions({ ...portalUser.permissionOverrides });
    setUserDisabled(Boolean(portalUser.disabledAt));
  };

  const saveUser = async () => {
    if (!currentOrg || !userTarget) return;
    setSaving(true);
    try {
      await updatePortalUser({
        organizationId: currentOrg.id,
        customerId: userTarget.customerId,
        userId: userTarget.userId,
        profile: userProfile,
        permissions: userPermissions,
        disabled: userDisabled,
      });
      setUserTarget(null);
      setSuccess('Tilaajakäyttäjän profiili ja oikeudet päivitettiin.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Käyttäjän päivitys epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const saveInspection = async () => {
    if (!inspectionTarget) return;
    setSaving(true);
    try {
      await setInspectionCustomerVisibility(
        inspectionTarget.id,
        !inspectionTarget.customerVisible,
        inspectionAck,
      );
      setInspectionTarget(null);
      setSuccess(inspectionTarget.customerVisible
        ? 'Tarkastus poistettiin tilaajan näkyvistä.'
        : 'Tarkastus julkaistiin tilaajalle.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tarkastuksen julkaisu epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const publishUpdate = async () => {
    if (!currentOrg || !publicationProjectId || publicationTitle.trim().length < 2) {
      setError('Valitse projekti ja anna julkaisulle otsikko.');
      return;
    }
    setSaving(true);
    try {
      await publishCustomerPortalUpdate({
        organizationId: currentOrg.id,
        projectId: publicationProjectId,
        type: 'project_update',
        title: publicationTitle.trim(),
        summary: publicationSummary.trim(),
        requiresAcknowledgement: publicationAck,
      });
      setPublicationOpen(false);
      setPublicationTitle('');
      setPublicationSummary('');
      setPublicationAck(false);
      setSuccess('Projektipäivitys julkaistiin tilaajaportaaliin.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Julkaisu epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) return null;
  if (!currentOrg) {
    return <Card><CardContent className="p-12 text-center">Aktiivista organisaatiota ei ole valittu.</CardContent></Card>;
  }

  if (requestId) {
    return (
      <CustomerOrderWorkspace
        organizationId={currentOrg.id}
        requestId={requestId}
        onBack={closeOrder}
        people={people.map((person) => ({ userId: person.userId, name: person.name, role: person.role }))}
        onChanged={refresh}
      />
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-[1500px] space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-orange-200">Tilaajayhteistyön ohjaus</p>
            <h1 className="text-3xl font-bold">Tilaajaportaali</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Käsittele tilaajan työtilaukset, määritä aikataulu ja osapuolet, julkaise aineistot sekä hallitse tilaajakäyttäjien oikeuksia.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={() => navigate('/hallinta')}><UserPlus size={16} className="mr-2" />Kutsu tilaaja</Button>
            <Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={() => { setPublicationProjectId(projects[0]?.id ?? ''); setPublicationOpen(true); }}><Plus size={16} className="mr-2" />Julkaise päivitys</Button>
            <Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={() => void refresh()} disabled={loading}><RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />Päivitä</Button>
          </div>
        </div>
      </section>

      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={17} className="mt-0.5" />{error}</div>}
      {success && <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={17} className="mt-0.5" />{success}</div>}
      {loading && !dashboard && <div className="flex justify-center gap-2 py-20 text-sm text-slate-500"><Loader2 className="animate-spin" size={19} />Ladataan tilaajaportaalia…</div>}

      {dashboard && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {([
              ['Avoimet tilaukset', dashboard.metrics.openOrders, ClipboardList, 'text-blue-700'],
              ['Kiireelliset', dashboard.metrics.urgentOrders, Bell, 'text-red-700'],
              ['Odottaa tilaajaa', dashboard.metrics.waitingCustomer, MessageCircle, 'text-violet-700'],
              ['Tilaajakäyttäjät', dashboard.metrics.portalUsers, UsersRound, 'text-teal-700'],
              ['Julkaisemattomat tarkastukset', dashboard.metrics.unpublishedInspections, FileCheck2, 'text-amber-700'],
            ] as const).map(([label, value, Icon, tone]) => (
              <Card key={label}><CardContent className="p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p></div><Icon size={20} className={tone} /></div></CardContent></Card>
            ))}
          </div>

          <Tabs defaultValue="orders" className="space-y-4">
            <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border bg-white p-1">
              <TabsTrigger value="orders">Työtilaukset ({dashboard.orders.length})</TabsTrigger>
              <TabsTrigger value="users">Tilaajakäyttäjät ({dashboard.users.length})</TabsTrigger>
              <TabsTrigger value="inspections">Tarkastusten julkaisu ({dashboard.inspections.length})</TabsTrigger>
              <TabsTrigger value="publications">Julkaisut ({dashboard.publications.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="orders" className="space-y-4">
              <div className="grid gap-3 rounded-2xl border bg-white p-3 md:grid-cols-[1fr_220px_220px]">
                <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hae tilausta, tilaajaa tai projektia…" /></div>
                <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><Filter size={15} className="mr-2" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Kaikki tilat</SelectItem>{Array.from(new Set(dashboard.orders.map((item) => item.status))).map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select>
                <Select value={customerFilter} onValueChange={setCustomerFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Kaikki tilaajat</SelectItem>{Array.from(new Map(dashboard.orders.map((item) => [item.customerId, item.customerName])).entries()).map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {filteredOrders.map((order) => (
                  <Card key={order.id} className={order.urgency === 'Kiireellinen' ? 'border-l-4 border-l-red-500' : ''}>
                    <CardContent className="p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap gap-2"><Badge variant="outline">{order.orderNumber}</Badge><Badge variant="outline" className={statusTone(order.status)}>{order.status}</Badge>{order.messageCount ? <Badge className="bg-teal-700"><MessageCircle size={12} className="mr-1" />{order.messageCount}</Badge> : null}</div>
                          <h2 className="mt-3 truncate text-lg font-semibold">{order.title}</h2>
                          <p className="mt-1 truncate text-sm text-slate-500">{order.customerName} · {order.projectName} · {order.category}</p>
                          <Progress value={order.progress} className="mt-4 h-2" />
                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>Eteneminen {order.progress} %</span><span>Aloitus {dateLabel(order.plannedStartDate || order.requestedDate)}</span><span>Valmistuminen {dateLabel(order.plannedEndDate || order.desiredCompletionDate)}</span></div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
                          <Button variant="outline" onClick={() => openOrder(order.id)}><Eye size={15} className="mr-2" />Avaa työtila</Button>
                          {!order.workOrderId && !['Valmis', 'Peruttu'].includes(order.status) && <Button onClick={() => startConvert(order.id)}><Send size={15} className="mr-2" />Luo työmääräys</Button>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {filteredOrders.length === 0 && <Card className="border-dashed"><CardContent className="p-12 text-center text-sm text-slate-500">Rajauksella ei löytynyt tilauksia.</CardContent></Card>}
            </TabsContent>

            <TabsContent value="users">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {dashboard.users.map((portalUser) => (
                  <Card key={`${portalUser.customerId}-${portalUser.userId}`} className={portalUser.disabledAt ? 'opacity-60' : ''}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><UserCog size={20} /></div><Badge variant="outline" className={portalUser.disabledAt ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>{portalUser.disabledAt ? 'Suljettu' : 'Aktiivinen'}</Badge></div>
                      <h2 className="mt-4 font-semibold">{portalUser.displayName}</h2>
                      <p className="text-sm text-slate-500">{portalUser.email}</p>
                      <p className="mt-3 text-sm"><strong>{portalUser.customerName}</strong> · {PROFILES.find((item) => item.value === portalUser.profile)?.label}</p>
                      <p className="mt-1 text-xs text-slate-500">{portalUser.accessScope === 'all_projects' ? 'Kaikki nykyiset ja tulevat projektit' : `${portalUser.projectIds.length} valittua projektia`}</p>
                      <p className="mt-3 text-xs text-slate-400">Viimeisin käyttö: {dateLabel(portalUser.lastPortalActivityAt)}</p>
                      <Button className="mt-4 w-full" variant="outline" onClick={() => openUser(portalUser)}><Settings2 size={15} className="mr-2" />Oikeudet ja profiili</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="inspections">
              <div className="grid gap-4 lg:grid-cols-2">
                {dashboard.inspections.map((inspection) => (
                  <Card key={inspection.id} className={inspection.customerVisible ? 'border-emerald-200' : 'border-amber-200'}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3"><div><Badge variant="outline">{inspection.type}</Badge><h2 className="mt-3 font-semibold">{inspection.title}</h2><p className="mt-1 text-sm text-slate-500">{inspection.projectName}</p></div><Badge className={inspection.customerVisible ? 'bg-emerald-600' : 'bg-amber-600'}>{inspection.customerVisible ? 'Julkaistu' : 'Sisäinen'}</Badge></div>
                      <div className="mt-4 flex items-center justify-between text-sm"><span>Hyväksytty {dateLabel(inspection.approvedAt)}</span><span>{inspection.progress} %</span></div>
                      <Button className="mt-4 w-full" variant={inspection.customerVisible ? 'outline' : 'default'} onClick={() => { setInspectionTarget(inspection); setInspectionAck(false); }}><ShieldCheck size={15} className="mr-2" />{inspection.customerVisible ? 'Poista tilaajan näkyvistä' : 'Julkaise tilaajalle'}</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {dashboard.inspections.length === 0 && <Card><CardContent className="p-12 text-center text-sm text-slate-500">Hyväksyttyjä tai julkaistuja tarkastuksia ei ole.</CardContent></Card>}
            </TabsContent>

            <TabsContent value="publications">
              <div className="space-y-3">
                {dashboard.publications.map((publication) => (
                  <Card key={publication.id}><CardContent className="p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap gap-2"><Badge variant="outline">{publication.type}</Badge><Badge variant="outline">Versio {publication.version}</Badge><Badge className={publication.status === 'published' ? 'bg-emerald-600' : 'bg-slate-600'}>{publication.status}</Badge></div><h2 className="mt-3 font-semibold">{publication.title}</h2><p className="mt-1 text-sm text-slate-500">{publication.projectName}</p>{publication.summary && <p className="mt-2 text-sm text-slate-600">{publication.summary}</p>}</div><div className="text-sm text-slate-500"><p>Julkaistu {dateLabel(publication.publishedAt)}</p><p className="mt-1">Kuittauksia {publication.acknowledgementCount}</p></div></div></CardContent></Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      <Dialog open={Boolean(convertId)} onOpenChange={(open) => !open && setConvertId(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>Luo työmääräys: {selectedOrder?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Määräaika</Label><Input type="date" value={convertDraft.dueDate} onChange={(event) => setConvertDraft((old) => ({ ...old, dueDate: event.target.value }))} /></div>
              <div className="space-y-2"><Label>Prioriteetti</Label><Select value={convertDraft.priority} onValueChange={(priority) => setConvertDraft((old) => ({ ...old, priority: priority as WorkOrderPriority }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Korkea">Korkea</SelectItem><SelectItem value="Normaali">Normaali</SelectItem><SelectItem value="Matala">Matala</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Kohdistus</Label><Select value={convertDraft.scope} onValueChange={(scope) => setConvertDraft((old) => ({ ...old, scope: scope as WorkAssignmentScope, assignees: [] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="people">Nimetyt toteuttajat</SelectItem><SelectItem value="project_team">Koko projektitiimi</SelectItem></SelectContent></Select></div>
            {convertDraft.scope === 'people' && <div><Label>Toteuttajat projektitiimistä *</Label><div className="mt-2 grid gap-2 rounded-xl border p-3">{availableWorkers.map((person) => <label key={person.userId} className="flex items-center gap-3 rounded-lg p-2 hover:bg-slate-50"><Checkbox checked={convertDraft.assignees.includes(person.userId)} onCheckedChange={(checked) => setConvertDraft((old) => ({ ...old, assignees: checked === true ? [...old.assignees, person.userId] : old.assignees.filter((id) => id !== person.userId) }))} /><span className="text-sm font-medium">{person.name}</span></label>)}{availableWorkers.length === 0 && <p className="text-sm text-slate-500">Projektitiimissä ei ole toteuttajia.</p>}</div></div>}
            <div className="space-y-2"><Label>Viesti tilaajalle</Label><Textarea rows={4} value={convertDraft.note} onChange={(event) => setConvertDraft((old) => ({ ...old, note: event.target.value }))} placeholder="Työ on vastaanotettu ja aikataulutettu…" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setConvertId(null)} disabled={saving}>Peruuta</Button><Button onClick={() => void convert()} disabled={saving}>{saving ? 'Luodaan…' : 'Luo ja jaa työ'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(userTarget)} onOpenChange={(open) => !open && setUserTarget(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Tilaajakäyttäjän oikeudet</DialogTitle></DialogHeader>
          {userTarget && <div className="space-y-5"><div className="rounded-xl bg-teal-50 p-4"><p className="font-semibold text-teal-950">{userTarget.displayName}</p><p className="text-sm text-teal-800">{userTarget.customerName} · {userTarget.email}</p></div><div className="space-y-2"><Label>Profiili</Label><Select value={userProfile} onValueChange={(value) => { setUserProfile(value as PortalProfile); setUserPermissions({}); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PROFILES.map((profile) => <SelectItem key={profile.value} value={profile.value}>{profile.label} — {profile.description}</SelectItem>)}</SelectContent></Select></div><div><Label>Oikeuksien poikkeukset</Label><p className="mt-1 text-xs text-slate-500">Tyhjä valinta käyttää profiilin oletusta.</p><div className="mt-3 space-y-2">{PERMISSIONS.map(([key, label]) => <div key={key} className="grid grid-cols-[1fr_130px] items-center gap-3 rounded-xl border p-3"><span className="text-sm font-medium">{label}</span><Select value={key in userPermissions ? String(userPermissions[key]) : 'default'} onValueChange={(value) => setUserPermissions((old) => { const next = { ...old }; if (value === 'default') delete next[key]; else next[key] = value === 'true'; return next; })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="default">Profiilin mukaan</SelectItem><SelectItem value="true">Sallittu</SelectItem><SelectItem value="false">Estetty</SelectItem></SelectContent></Select></div>)}</div></div><label className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4"><Checkbox checked={userDisabled} onCheckedChange={(checked) => setUserDisabled(checked === true)} /><span><span className="block font-semibold text-red-900">Sulje käyttäjän portaali</span><span className="text-sm text-red-700">Historia säilyy, mutta käyttäjä ei pääse portaaliin.</span></span></label></div>}
          <DialogFooter><Button variant="outline" onClick={() => setUserTarget(null)} disabled={saving}>Peruuta</Button><Button onClick={() => void saveUser()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna oikeudet'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(inspectionTarget)} onOpenChange={(open) => !open && setInspectionTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{inspectionTarget?.customerVisible ? 'Poista tarkastus tilaajalta' : 'Julkaise tarkastus tilaajalle'}</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">{inspectionTarget?.title} · {inspectionTarget?.projectName}</p>
          {!inspectionTarget?.customerVisible && <label className="flex items-start gap-3 rounded-xl border p-4"><Checkbox checked={inspectionAck} onCheckedChange={(checked) => setInspectionAck(checked === true)} /><span><span className="block font-medium">Vaadi tilaajan kuittaus</span><span className="text-sm text-slate-500">Portaali seuraa, kuka on kuitannut raportin vastaanotetuksi.</span></span></label>}
          <DialogFooter><Button variant="outline" onClick={() => setInspectionTarget(null)} disabled={saving}>Peruuta</Button><Button variant={inspectionTarget?.customerVisible ? 'destructive' : 'default'} onClick={() => void saveInspection()} disabled={saving}>{saving ? 'Tallennetaan…' : inspectionTarget?.customerVisible ? 'Poista näkyvistä' : 'Julkaise tilaajalle'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={publicationOpen} onOpenChange={(open) => !saving && setPublicationOpen(open)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Julkaise projektipäivitys tilaajalle</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Projekti *</Label><Select value={publicationProjectId} onValueChange={setPublicationProjectId}><SelectTrigger><SelectValue placeholder="Valitse" /></SelectTrigger><SelectContent>{projects.filter((project) => project.customerId).map((project) => <SelectItem key={project.id} value={project.id}>{project.name} · {project.location || project.customer}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Otsikko *</Label><Input value={publicationTitle} onChange={(event) => setPublicationTitle(event.target.value)} /></div>
            <div className="space-y-2"><Label>Tilannepäivitys</Label><Textarea rows={5} value={publicationSummary} onChange={(event) => setPublicationSummary(event.target.value)} /></div>
            <label className="flex items-start gap-3 rounded-xl border p-4"><Checkbox checked={publicationAck} onCheckedChange={(checked) => setPublicationAck(checked === true)} /><span><span className="block font-medium">Vaadi vastaanottokuittaus</span><span className="text-sm text-slate-500">Julkaisu näkyy tilaajan tehtävissä, kunnes se on kuitattu.</span></span></label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPublicationOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void publishUpdate()} disabled={saving}>{saving ? 'Julkaistaan…' : 'Julkaise tilaajalle'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
