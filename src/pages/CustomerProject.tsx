import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileImage,
  FileText,
  MapPin,
  MessageCircle,
  Plus,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import {
  createCustomerWorkRequest,
  loadCustomerWorkRequests,
  type CustomerRequestUrgency,
  type CustomerWorkRequest,
} from '@/lib/supabase/customerWorkRequests';
import {
  createCustomerDocumentUrl,
  decideCustomerChangeOrder,
  loadCustomerProjectChangeOrders,
  loadCustomerProjectDocuments,
  type CustomerChangeDecision,
  type CustomerProjectChangeOrder,
  type CustomerProjectDocument,
} from '@/lib/supabase/customerCollaboration';
import {
  loadCustomerProjectSummaries,
  loadProjectConversationContext,
  type CustomerProjectSummary,
  type ProjectConversationContext,
} from '@/lib/supabase/projectCollaboration';

const CATEGORIES = ['Korjaus', 'Huolto', 'Muutos- tai lisätyö', 'Tarkastus', 'Reklamaatio', 'Muu'];
const EMPTY_FORM = {
  title: '',
  category: '',
  description: '',
  locationDetails: '',
  contactName: '',
  contactPhone: '',
  requestedDate: '',
  urgency: 'Normaali' as CustomerRequestUrgency,
  accessInstructions: '',
  safetyNotes: '',
};

function dateLabel(value: string | null | undefined) {
  if (!value) return 'Ei määritetty';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

function euro(cents: number) {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} t`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kt`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mt`;
}

function decisionClass(decision: string | null) {
  if (decision === 'Hyväksytty') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (decision === 'Hylätty') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function CustomerDocumentCard({
  document,
  onError,
}: {
  document: CustomerProjectDocument;
  onError: (message: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = document.mimeType.startsWith('image/');

  useEffect(() => {
    let cancelled = false;
    void createCustomerDocumentUrl(document.storagePath)
      .then((nextUrl) => { if (!cancelled) setUrl(nextUrl); })
      .catch((caught) => {
        if (!cancelled) onError(caught instanceof Error ? caught.message : 'Tiedoston avaaminen epäonnistui.');
      });
    return () => { cancelled = true; };
  }, [document.storagePath, onError]);

  return (
    <Card className="overflow-hidden">
      {isImage && url
        ? <img src={url} alt={document.title} className="h-48 w-full object-cover" />
        : <div className="flex h-32 items-center justify-center bg-slate-100 text-slate-500">{isImage ? <FileImage size={42} /> : <FileText size={42} />}</div>}
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div><Badge variant="outline">{document.documentType}</Badge><h3 className="mt-3 font-semibold text-slate-950">{document.title}</h3></div>
          <span className="text-xs text-slate-400">{fileSize(document.sizeBytes)}</span>
        </div>
        {document.description && <p className="mt-2 text-sm leading-6 text-slate-700">{document.description}</p>}
        <p className="mt-2 break-words text-xs text-slate-500">{document.fileName}</p>
        <Button className="mt-4 w-full" variant="outline" disabled={!url} onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}>
          <ExternalLink size={15} className="mr-2" /> Avaa tiedosto
        </Button>
      </CardContent>
    </Card>
  );
}

function CustomerChangeOrderCard({
  changeOrder,
  onDecision,
}: {
  changeOrder: CustomerProjectChangeOrder;
  onDecision: (
    changeOrder: CustomerProjectChangeOrder,
    decision: Extract<CustomerChangeDecision, 'Hyväksytty' | 'Hylätty'>,
  ) => void;
}) {
  const vatCents = Math.round(changeOrder.amountCents * (changeOrder.vatRate / 100));
  const totalWithVatCents = changeOrder.amountCents + vatCents;

  return (
    <Card className={changeOrder.customerDecision === 'Odottaa' ? 'border-amber-300 shadow-sm' : ''}>
      <CardContent className="p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{changeOrder.changeNumber || 'Lisä- tai muutostyö'}</Badge>
              <Badge variant="outline">Versio {changeOrder.customerVersion}</Badge>
              <Badge variant="outline" className={decisionClass(changeOrder.customerDecision)}>{changeOrder.customerDecision || changeOrder.status}</Badge>
            </div>
            <h3 className="mt-3 text-lg font-semibold text-slate-950">{changeOrder.title}</h3>
            {changeOrder.description && <p className="mt-2 text-sm leading-6 text-slate-700">{changeOrder.description}</p>}

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Hinta ilman ALV:tä</p>
                <p className="mt-1 text-xl font-bold text-slate-950">{euro(changeOrder.amountCents)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">ALV {changeOrder.vatRate.toLocaleString('fi-FI')} %</p>
                <p className="mt-1 text-xl font-bold text-slate-950">{euro(vatCents)}</p>
              </div>
              <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Yhteensä</p>
                <p className="mt-1 text-xl font-bold text-teal-950">{euro(totalWithVatCents)}</p>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="hidden grid-cols-[110px_minmax(0,1fr)_110px_140px] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
                <span>Laji</span><span>Sisältö</span><span>Määrä</span><span>Yhteensä</span>
              </div>
              {changeOrder.lines.map((line) => (
                <div key={line.lineNumber} className="grid gap-2 border-t border-slate-100 px-4 py-3 text-sm first:border-t-0 md:grid-cols-[110px_minmax(0,1fr)_110px_140px] md:items-center">
                  <span className="text-slate-500">{line.category}</span>
                  <div className="min-w-0"><p className="break-words font-medium text-slate-900">{line.description}</p><p className="text-xs text-slate-500">{euro(line.saleUnitPriceCents)} / {line.unit}</p></div>
                  <span>{line.quantity.toLocaleString('fi-FI')} {line.unit}</span>
                  <span className="font-mono font-semibold">{euro(line.saleTotalCents)}</span>
                </div>
              ))}
              {changeOrder.lines.length === 0 && <p className="p-4 text-sm text-slate-500">Erittelyä ei ole saatavilla.</p>}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-3 text-sm"><strong>Vaikutus aikatauluun:</strong> {changeOrder.scheduleEffectDays > 0 ? `+${changeOrder.scheduleEffectDays}` : changeOrder.scheduleEffectDays} päivää</div>
              <div className="rounded-lg border border-slate-200 p-3 text-sm"><strong>Lähetetty:</strong> {dateLabel(changeOrder.submittedToCustomerAt)}</div>
            </div>
            {changeOrder.customerDecisionNote && (
              <div className="mt-3 rounded-lg border border-slate-200 p-3 text-sm"><strong>Kommentti:</strong> {changeOrder.customerDecisionNote}</div>
            )}
          </div>

          {changeOrder.customerDecision === 'Odottaa' && (
            <div className="grid shrink-0 grid-cols-2 gap-2 xl:w-64 xl:grid-cols-1">
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => onDecision(changeOrder, 'Hyväksytty')}>
                <CheckCircle2 size={15} className="mr-2" /> Hyväksy
              </Button>
              <Button variant="destructive" onClick={() => onDecision(changeOrder, 'Hylätty')}>
                <XCircle size={15} className="mr-2" /> Hylkää
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CustomerProject() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const { effectiveDisplayName } = useViewAs();
  const [context, setContext] = useState<ProjectConversationContext | null>(null);
  const [project, setProject] = useState<CustomerProjectSummary | null>(null);
  const [requests, setRequests] = useState<CustomerWorkRequest[]>([]);
  const [documents, setDocuments] = useState<CustomerProjectDocument[]>([]);
  const [changeOrders, setChangeOrders] = useState<CustomerProjectChangeOrder[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [open, setOpen] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [selectedChange, setSelectedChange] = useState<CustomerProjectChangeOrder | null>(null);
  const [decision, setDecision] = useState<Extract<CustomerChangeDecision, 'Hyväksytty' | 'Hylätty'>>('Hyväksytty');
  const [decisionNote, setDecisionNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reportError = useCallback((message: string) => setError(message), []);

  const refresh = useCallback(async () => {
    if (!currentOrg || !projectId) return;
    setLoading(true);
    try {
      const [nextContext, summaries, workRequests, nextDocuments, nextChangeOrders] = await Promise.all([
        loadProjectConversationContext(projectId),
        loadCustomerProjectSummaries(currentOrg.id),
        loadCustomerWorkRequests(currentOrg.id),
        loadCustomerProjectDocuments(projectId),
        loadCustomerProjectChangeOrders(projectId),
      ]);
      setContext(nextContext);
      setProject(summaries.find((item) => item.id === projectId) ?? null);
      setRequests(workRequests.filter((item) => item.projectId === projectId));
      setDocuments(nextDocuments);
      setChangeOrders(nextChangeOrders);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Projektin lataus epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [currentOrg, projectId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const openRequests = useMemo(() => requests.filter((request) => request.status !== 'Peruttu').length, [requests]);
  const waitingChanges = useMemo(() => changeOrders.filter((item) => item.customerDecision === 'Odottaa').length, [changeOrders]);

  const startRequest = () => {
    setForm({ ...EMPTY_FORM, contactName: effectiveDisplayName });
    setError(null);
    setOpen(true);
  };

  const submit = async () => {
    if (!currentOrg || !project || !projectId || form.title.trim().length < 3 || !form.category || form.description.trim().length < 10) {
      setError('Anna työpyynnölle otsikko, työn laji ja riittävä kuvaus.');
      return;
    }
    setSaving(true);
    try {
      await createCustomerWorkRequest({
        organizationId: currentOrg.id,
        customerId: project.customerId,
        projectId,
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim(),
        locationDetails: form.locationDetails,
        contactName: form.contactName,
        contactPhone: form.contactPhone,
        requestedDate: form.requestedDate,
        preferredTime: '',
        urgency: form.urgency,
        accessInstructions: form.accessInstructions,
        safetyNotes: form.safetyNotes,
      });
      setOpen(false);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Työpyynnön lähetys epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const startDecision = (
    changeOrder: CustomerProjectChangeOrder,
    nextDecision: Extract<CustomerChangeDecision, 'Hyväksytty' | 'Hylätty'>,
  ) => {
    setSelectedChange(changeOrder);
    setDecision(nextDecision);
    setDecisionNote('');
    setError(null);
    setDecisionOpen(true);
  };

  const saveDecision = async () => {
    if (!selectedChange) return;
    setSaving(true);
    try {
      await decideCustomerChangeOrder({ changeOrderId: selectedChange.id, decision, note: decisionNote });
      setDecisionOpen(false);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Päätöksen tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  if (!projectId) return null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-5 text-white shadow-lg sm:p-8">
        <Button variant="ghost" className="mb-4 gap-2 text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => navigate('/tilaajan-tyot')}><ArrowLeft size={16} /> Projektini</Button>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2"><Badge className="border-slate-600 bg-slate-800 text-slate-100">{context?.status || 'Ladataan'}</Badge>{context?.location && <span className="flex items-center gap-1 text-sm text-slate-300"><MapPin size={14} />{context.location}</span>}</div>
            <h1 className="text-3xl font-bold">{context?.projectName || 'Projekti'}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{context?.description || 'Projektin tiedot ja viestintä.'}</p>
          </div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" className="border-slate-600 bg-white/5 text-white hover:bg-white/10" onClick={() => navigate(`/projektikeskustelut/${projectId}`)}><MessageCircle size={16} className="mr-2" /> Keskustelu</Button><Button className="bg-teal-500 text-white hover:bg-teal-600" onClick={startRequest}><Plus size={16} className="mr-2" /> Uusi työpyyntö</Button></div>
        </div>
        {context && <div className="mt-6"><div className="mb-2 flex justify-between text-xs text-slate-300"><span>Projektin eteneminen</span><strong>{context.progress}%</strong></div><Progress value={context.progress} className="h-2 bg-slate-700" /></div>}
      </section>

      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={17} className="mt-0.5" />{error}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Aloitus</p><p className="mt-2 font-semibold text-slate-950">{dateLabel(context?.startDate)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tavoite</p><p className="mt-2 font-semibold text-slate-950">{dateLabel(context?.endDate)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Työpyynnöt</p><p className="mt-2 text-2xl font-bold text-slate-950">{openRequests}</p></CardContent></Card>
        <Card className={waitingChanges ? 'border-amber-300' : ''}><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Päätettävät muutostyöt</p><p className="mt-2 text-2xl font-bold text-slate-950">{waitingChanges}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-1 sm:grid-cols-4">
          <TabsTrigger value="overview">Tilannekuva</TabsTrigger>
          <TabsTrigger value="documents">Dokumentit ja kuvat ({documents.length})</TabsTrigger>
          <TabsTrigger value="changes">Lisä- ja muutostyöt ({changeOrders.length})</TabsTrigger>
          <TabsTrigger value="requests">Työpyynnöt ({requests.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
            <Card><CardHeader><CardTitle>Projektin perustiedot</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">{[['Tilaaja', context?.customerName || '—'], ['Sijainti', context?.location || '—'], ['Aloitus', dateLabel(context?.startDate)], ['Valmistuminen', dateLabel(context?.endDate)], ['Työnjohto', project?.supervisorName || '—'], ['Yhteys', project?.supervisorEmail || '—']].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 p-4"><p className="text-xs uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 break-words font-semibold text-slate-900">{value}</p></div>)}</CardContent></Card>
            <Card><CardHeader><CardTitle>Pikatoiminnot</CardTitle></CardHeader><CardContent className="grid gap-2"><Button variant="outline" className="justify-start gap-3" onClick={() => navigate(`/projektikeskustelut/${projectId}`)}><MessageCircle size={17} /> Projektikeskustelu</Button><Button variant="outline" className="justify-start gap-3" onClick={startRequest}><ClipboardList size={17} /> Uusi työpyyntö</Button><Button variant="outline" className="justify-start gap-3" onClick={() => navigate('/tyoturvallisuus')}><ShieldCheck size={17} /> Turvallisuushavainto</Button></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="documents"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{documents.map((document) => <CustomerDocumentCard key={document.id} document={document} onError={reportError} />)}{!loading && documents.length === 0 && <Card className="md:col-span-2 xl:col-span-3"><CardContent className="p-12 text-center"><FileText size={44} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold">Ei vielä jaettuja dokumentteja</p><p className="mt-1 text-sm text-slate-500">Työnjohto julkaisee tähän projektin asiakirjat ja kuvat.</p></CardContent></Card>}</div></TabsContent>

        <TabsContent value="changes" className="space-y-3">
          {changeOrders.map((changeOrder) => <CustomerChangeOrderCard key={changeOrder.id} changeOrder={changeOrder} onDecision={startDecision} />)}
          {!loading && changeOrders.length === 0 && <Card><CardContent className="p-12 text-center"><BriefcaseBusiness size={44} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold">Ei hyväksyttäviä lisä- tai muutostöitä</p></CardContent></Card>}
        </TabsContent>

        <TabsContent value="requests" className="space-y-3">{requests.map((request) => <Card key={request.id}><CardContent className="p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold text-slate-950">{request.title}</h3><p className="mt-1 text-sm text-slate-500">{request.category} · {dateLabel(request.createdAt)}</p><p className="mt-3 text-sm leading-6 text-slate-700">{request.description}</p>{request.supervisorNote && <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><strong>Työnjohdon viesti:</strong> {request.supervisorNote}</div>}</div><Badge variant="outline">{request.status}</Badge></div></CardContent></Card>)}{!loading && requests.length === 0 && <Card className="border-dashed"><CardContent className="p-12 text-center"><ClipboardList size={44} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold">Ei työpyyntöjä</p></CardContent></Card>}</TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Uusi työpyyntö</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="customer-request-title">Otsikko *</Label><Input id="customer-request-title" value={form.title} onChange={(event) => setForm((old) => ({ ...old, title: event.target.value }))} placeholder="Esim. Vuoto kylpyhuoneessa" /></div>
            <div className="space-y-2"><Label>Työn laji *</Label><Select value={form.category} onValueChange={(category) => setForm((old) => ({ ...old, category }))}><SelectTrigger><SelectValue placeholder="Valitse" /></SelectTrigger><SelectContent>{CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Kiireellisyys</Label><Select value={form.urgency} onValueChange={(urgency) => setForm((old) => ({ ...old, urgency: urgency as CustomerRequestUrgency }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Kiireellinen">Kiireellinen</SelectItem><SelectItem value="Normaali">Normaali</SelectItem><SelectItem value="Ei kiireellinen">Ei kiireellinen</SelectItem></SelectContent></Select></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="customer-request-description">Kuvaus *</Label><Textarea id="customer-request-description" rows={5} value={form.description} onChange={(event) => setForm((old) => ({ ...old, description: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="customer-request-location">Tarkka sijainti</Label><Input id="customer-request-location" value={form.locationDetails} onChange={(event) => setForm((old) => ({ ...old, locationDetails: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="customer-request-date">Toivottu päivä</Label><Input id="customer-request-date" type="date" value={form.requestedDate} onChange={(event) => setForm((old) => ({ ...old, requestedDate: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="customer-request-contact">Yhteyshenkilö</Label><Input id="customer-request-contact" value={form.contactName} onChange={(event) => setForm((old) => ({ ...old, contactName: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="customer-request-phone">Puhelin</Label><Input id="customer-request-phone" value={form.contactPhone} onChange={(event) => setForm((old) => ({ ...old, contactPhone: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="customer-request-access">Pääsy- ja avainohjeet</Label><Textarea id="customer-request-access" rows={2} value={form.accessInstructions} onChange={(event) => setForm((old) => ({ ...old, accessInstructions: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="customer-request-safety">Turvallisuus- tai muut huomioitavat asiat</Label><Textarea id="customer-request-safety" rows={2} value={form.safetyNotes} onChange={(event) => setForm((old) => ({ ...old, safetyNotes: event.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void submit()} disabled={saving} className="gap-2"><Send size={16} />{saving ? 'Lähetetään…' : 'Lähetä työpyyntö'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={decisionOpen} onOpenChange={setDecisionOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{decision === 'Hyväksytty' ? 'Hyväksy lisä- tai muutostyö' : 'Hylkää lisä- tai muutostyö'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="font-semibold text-slate-950">{selectedChange?.title}</p><p className="mt-1 text-2xl font-bold">{euro(selectedChange?.amountCents ?? 0)}</p><p className="mt-1 text-xs text-slate-500">Päätös koskee versiota {selectedChange?.customerVersion ?? '—'} ja yllä näkyvää erittelyä.</p></div>
            <div className="space-y-2"><Label htmlFor="decision-note">Kommentti {decision === 'Hylätty' ? '*' : '(valinnainen)'}</Label><Textarea id="decision-note" rows={4} value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} placeholder={decision === 'Hylätty' ? 'Kerro, miksi työtä ei hyväksytä.' : 'Lisää tarvittaessa hyväksyntään liittyvä huomio.'} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDecisionOpen(false)}>Peruuta</Button><Button variant={decision === 'Hylätty' ? 'destructive' : 'default'} disabled={saving || (decision === 'Hylätty' && decisionNote.trim().length < 3)} onClick={() => void saveDecision()}>{saving ? 'Tallennetaan…' : decision}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
