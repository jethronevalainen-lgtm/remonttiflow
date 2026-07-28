import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity, AlertTriangle, Bell, Building2, CalendarDays, CheckCircle2,
  ClipboardList, Clock3, FolderKanban, Loader2, MessageCircle, Plus, Search,
} from 'lucide-react';

import CustomerOrderCreateDialog, {
  EMPTY_ORDER_DRAFT,
  EMPTY_ORDER_ITEM,
} from '@/components/customer/CustomerOrderCreateDialog';
import CustomerOrderWorkspace from '@/components/customer/CustomerOrderWorkspace';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import { listAppNotifications, type AppNotification } from '@/lib/supabase/appNotifications';
import {
  createPortalOrder,
  loadCustomerPortalHome,
  type PortalHome,
  type PortalOrderDraft,
  type PortalOrderStatus,
} from '@/lib/supabase/customerPortalOrders';

function dateLabel(value?: string) {
  if (!value) return 'Ei määritetty';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fi-FI');
}

function dateTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

function statusTone(status: PortalOrderStatus) {
  if (status === 'Valmis') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Peruttu') return 'border-slate-200 bg-slate-100 text-slate-600';
  if (status === 'Tarkennettava' || status === 'Odottaa') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'Käynnissä') return 'border-orange-200 bg-orange-50 text-orange-700';
  return 'border-blue-200 bg-blue-50 text-blue-700';
}

export default function TilaajanTyotV2() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestId = searchParams.get('order');
  const { currentOrg } = useOrganization();
  const { effectiveDisplayName, isPreviewing } = useViewAs();
  const [home, setHome] = useState<PortalHome | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<Omit<PortalOrderDraft, 'organizationId'>>(EMPTY_ORDER_DRAFT);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');

  const refresh = useCallback(async () => {
    if (!currentOrg || isPreviewing) return;
    setLoading(true);
    try {
      const [nextHome, nextNotifications] = await Promise.all([
        loadCustomerPortalHome(currentOrg.id),
        listAppNotifications(currentOrg.id, 30),
      ]);
      setHome(nextHome);
      setNotifications(nextNotifications.filter((item) => item.notificationType.startsWith('customer_')));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tilaajaportaalin lataus epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [currentOrg, isPreviewing]);

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

  const startOrder = () => {
    if (!home || isPreviewing) return;
    const project = home.projects.find((item) => (
      home.accounts.find((account) => account.customerId === item.customerId)?.permissions['orders.create'] !== false
    ));
    const account = home.accounts.find((item) => item.customerId === project?.customerId) ?? home.accounts[0];
    setDraft({
      ...EMPTY_ORDER_DRAFT,
      customerId: account?.customerId ?? '',
      projectId: project?.id ?? '',
      serviceAddress: project?.location ?? '',
      contactName: effectiveDisplayName,
      items: [{ ...EMPTY_ORDER_ITEM }],
    });
    setError(null);
    setSuccess(null);
    setCreateOpen(true);
  };

  const submit = async () => {
    if (!currentOrg) return;
    const items = draft.items.filter((item) => item.title.trim().length >= 2);
    if (!draft.customerId || !draft.projectId || draft.title.trim().length < 3 || !draft.category || draft.description.trim().length < 10) {
      setError('Valitse projekti ja anna työn otsikko, laji sekä riittävä kuvaus.');
      return;
    }
    if (items.length === 0) {
      setError('Määritä vähintään yksi tilattava työvaihe.');
      return;
    }

    setSaving(true);
    try {
      const id = await createPortalOrder({ ...draft, organizationId: currentOrg.id, items });
      setCreateOpen(false);
      setSuccess('Työtilaus lähetettiin työnjohdolle. Käsittely, eteneminen ja keskustelu löytyvät tilauksen omasta työtilasta.');
      await refresh();
      openOrder(id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Työtilauksen lähetys epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const filteredOrders = useMemo(() => {
    if (!home) return [];
    const query = search.trim().toLocaleLowerCase('fi');
    return home.orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (projectFilter !== 'all' && order.projectId !== projectFilter) return false;
      return !query || `${order.orderNumber} ${order.title} ${order.category} ${order.projectName} ${order.customerName}`
        .toLocaleLowerCase('fi')
        .includes(query);
    });
  }, [home, projectFilter, search, statusFilter]);

  if (!currentOrg) {
    return <Card><CardContent className="p-10 text-center">Aktiivista organisaatiota ei ole valittu.</CardContent></Card>;
  }

  if (isPreviewing) {
    return (
      <Card className="mx-auto max-w-3xl border-indigo-200 bg-indigo-50">
        <CardContent className="p-8">
          <h1 className="text-2xl font-bold text-indigo-950">Tilaajaportaalin esikatselu</h1>
          <p className="mt-3 text-sm leading-6 text-indigo-900">
            Uusi työtilausten asiointinäkymä käyttää tilaajan todellista käyttäjä- ja tilauskohtaista käyttöoikeutta.
            Esikatselutilassa tallennukset ja tilausten keskustelut ovat turvallisuussyistä poissa käytöstä.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (requestId) {
    return (
      <CustomerOrderWorkspace
        organizationId={currentOrg.id}
        requestId={requestId}
        onBack={closeOrder}
        onChanged={refresh}
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">Tilaajaportaali</p>
            <h1 className="text-3xl font-bold">Työt, tilaukset ja päätökset</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Tilaa työt tarkasti, seuraa toteutusta ja keskustele jokaisen työn nimettyjen osapuolten kanssa.
            </p>
          </div>
          <Button onClick={startOrder} disabled={!home?.projects.length} className="gap-2 bg-teal-500 text-white hover:bg-teal-600">
            <Plus size={17} /> Uusi työtilaus
          </Button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-slate-300">Aktiiviset työt</p><p className="mt-1 text-2xl font-bold">{home?.orders.filter((item) => !['Valmis', 'Peruttu'].includes(item.status)).length ?? 0}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-slate-300">Tarkennettavat</p><p className="mt-1 text-2xl font-bold">{home?.tasks.clarifications ?? 0}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-slate-300">Päätökset</p><p className="mt-1 text-2xl font-bold">{home?.tasks.pendingDecisions ?? 0}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-slate-300">Lukemattomat viestit</p><p className="mt-1 text-2xl font-bold">{home?.tasks.unreadMessages ?? 0}</p></div>
        </div>
      </section>

      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={17} className="mt-0.5" />{error}</div>}
      {success && <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={17} className="mt-0.5" />{success}</div>}
      {loading && !home && <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500"><Loader2 size={19} className="animate-spin" />Ladataan tilaajaportaalia…</div>}

      {home && (
        <>
          {(home.tasks.clarifications + home.tasks.pendingDecisions + home.tasks.acknowledgements + home.tasks.unreadMessages) > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="flex items-start gap-3 p-5">
                <Bell className="mt-0.5 text-amber-700" size={21} />
                <div>
                  <h2 className="font-semibold text-amber-950">Huomiotasi odottavat asiat</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {home.tasks.clarifications > 0 && <Badge className="bg-amber-600">{home.tasks.clarifications} tarkennettavaa</Badge>}
                    {home.tasks.pendingDecisions > 0 && <Badge className="bg-violet-600">{home.tasks.pendingDecisions} päätettävää</Badge>}
                    {home.tasks.acknowledgements > 0 && <Badge className="bg-blue-600">{home.tasks.acknowledgements} kuitattavaa</Badge>}
                    {home.tasks.unreadMessages > 0 && <Badge className="bg-teal-700">{home.tasks.unreadMessages} lukematonta viestiä</Badge>}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="orders" className="space-y-4">
            <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border bg-white p-1">
              <TabsTrigger value="orders">Työtilaukset ({home.orders.length})</TabsTrigger>
              <TabsTrigger value="projects">Projektit ({home.projects.length})</TabsTrigger>
              <TabsTrigger value="activity">Tapahtumat</TabsTrigger>
              <TabsTrigger value="notifications">Ilmoitukset ({notifications.filter((item) => !item.readAt).length})</TabsTrigger>
            </TabsList>

            <TabsContent value="orders" className="space-y-4">
              <div className="grid gap-3 rounded-2xl border bg-white p-3 md:grid-cols-[1fr_210px_210px]">
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Hae tunnuksella, työllä tai projektilla…" /></div>
                <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Kaikki tilat</SelectItem>{Array.from(new Set(home.orders.map((item) => item.status))).map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select>
                <Select value={projectFilter} onValueChange={setProjectFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Kaikki projektit</SelectItem>{home.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {filteredOrders.map((order) => (
                  <Card key={order.id} className={`cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md ${order.urgency === 'Kiireellinen' ? 'border-l-4 border-l-red-500' : ''}`} onClick={() => openOrder(order.id)}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{order.orderNumber}</Badge><Badge variant="outline" className={statusTone(order.status)}>{order.status}</Badge>{order.unreadMessageCount > 0 && <Badge className="bg-teal-700"><MessageCircle size={12} className="mr-1" />{order.unreadMessageCount}</Badge>}</div>
                          <h2 className="mt-3 truncate text-lg font-semibold">{order.title}</h2>
                          <p className="mt-1 truncate text-sm text-slate-500">{order.projectName} · {order.category}</p>
                        </div>
                        <span className="text-xl font-bold">{order.progress}%</span>
                      </div>
                      <Progress value={order.progress} className="mt-4 h-2" />
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600"><span className="flex items-center gap-1"><CalendarDays size={14} />Aloitus {dateLabel(order.plannedStartDate || order.requestedDate)}</span><span className="flex items-center justify-end gap-1"><Clock3 size={14} />Päivitetty {dateLabel(order.lastActivityAt)}</span></div>
                      {order.supervisorNote && <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900"><strong>Työnjohto:</strong> {order.supervisorNote}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
              {!loading && filteredOrders.length === 0 && <Card className="border-dashed"><CardContent className="p-12 text-center"><ClipboardList size={44} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold">Rajauksella ei löytynyt työtilauksia</p></CardContent></Card>}
            </TabsContent>

            <TabsContent value="projects">
              <div className="grid gap-4 lg:grid-cols-2">
                {home.projects.map((project) => (
                  <Card key={project.id} className="transition hover:shadow-md"><CardContent className="p-5"><div className="flex items-start justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><FolderKanban size={21} /></div><Badge variant="outline">{project.status}</Badge></div><h2 className="mt-4 text-xl font-semibold">{project.name}</h2><p className="mt-1 text-sm text-slate-500">{project.customerName} · {project.location || 'Ei sijaintia'}</p><div className="mt-5"><div className="mb-2 flex justify-between text-xs text-slate-500"><span>Projektin eteneminen</span><strong>{project.progress}%</strong></div><Progress value={project.progress} /></div><div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Aktiiviset työt</p><p className="mt-1 font-bold">{project.activeOrderCount}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Päätökset</p><p className="mt-1 font-bold">{project.pendingDecisionCount}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Tavoite</p><p className="mt-1 font-bold">{dateLabel(project.endDate)}</p></div></div><Button className="mt-5 w-full" onClick={() => navigate(`/tilaajan-projektit/${project.id}`)}><Building2 size={16} className="mr-2" />Avaa projektin tiedot</Button></CardContent></Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="activity"><Card><CardContent className="space-y-3 p-5">{home.activities.map((item) => <button key={`${item.type}-${item.id}`} type="button" onClick={() => item.requestId ? openOrder(item.requestId) : item.projectId ? navigate(`/tilaajan-projektit/${item.projectId}`) : undefined} className="flex w-full items-start gap-3 rounded-xl border p-4 text-left hover:bg-slate-50"><div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Activity size={17} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{item.title}</p><span className="text-xs text-slate-400">{dateTime(item.createdAt)}</span></div>{item.description && <p className="mt-1 text-sm text-slate-600">{item.description}</p>}</div></button>)}{home.activities.length === 0 && <p className="py-12 text-center text-sm text-slate-500">Tapahtumia ei ole vielä.</p>}</CardContent></Card></TabsContent>

            <TabsContent value="notifications"><Card><CardContent className="space-y-3 p-5">{notifications.map((item) => <button key={item.id} type="button" onClick={() => item.path && navigate(item.path)} className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left ${item.readAt ? 'bg-white' : 'border-teal-200 bg-teal-50'}`}><Bell size={18} className="mt-0.5 text-teal-700" /><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{item.title}</p><span className="text-xs text-slate-400">{dateTime(item.createdAt)}</span></div><p className="mt-1 text-sm text-slate-600">{item.body}</p></div></button>)}{notifications.length === 0 && <p className="py-12 text-center text-sm text-slate-500">Ei uusia tilaajaportaalin ilmoituksia.</p>}</CardContent></Card></TabsContent>
          </Tabs>
        </>
      )}

      <CustomerOrderCreateDialog
        open={createOpen}
        saving={saving}
        accounts={home?.accounts ?? []}
        projects={home?.projects ?? []}
        draft={draft}
        onDraftChange={setDraft}
        onOpenChange={setCreateOpen}
        onSubmit={() => void submit()}
      />
    </div>
  );
}
