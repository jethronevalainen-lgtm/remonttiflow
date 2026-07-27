import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Eye,
  FileImage,
  FileText,
  MapPin,
  MessageCircle,
  Plus,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import { CustomerAftercarePanel } from '@/components/customer/CustomerAftercarePanel';
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
  createCustomerDocumentUrl,
  decideCustomerChangeOrder,
  type CustomerChangeDecision,
  type CustomerProjectChangeOrder,
  type CustomerProjectDocument,
} from '@/lib/supabase/customerCollaboration';
import {
  loadPortalChangeOrders,
  loadPortalDocuments,
  loadPortalProjectContext,
  loadPortalProjects,
  loadPortalWorkRequests,
} from '@/lib/supabase/customerPortalData';
import {
  createCustomerWorkRequest,
  type CustomerRequestUrgency,
  type CustomerWorkRequest,
} from '@/lib/supabase/customerWorkRequests';
import type { CustomerProjectSummary, ProjectConversationContext } from '@/lib/supabase/projectCollaboration';

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
  return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(cents / 100);
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

function CustomerDocumentCard({ document, onError }: { document: CustomerProjectDocument; onError: (message: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = document.mimeType.startsWith('image/');

  useEffect(() => {
    let cancelled = false;
    void createCustomerDocumentUrl(document.storagePath)
      .then((nextUrl) => { if (!cancelled) setUrl(nextUrl); })
      .catch((caught) => { if (!cancelled) onError(caught instanceof Error ? caught.message : 'Tiedoston avaaminen epäonnistui.'); });
    return () => { cancelled = true; };
  }, [document.storagePath, onError]);

  return (
    <Card className="overflow-hidden">
      {isImage && url
        ? <img src={url} alt={document.title} className="h-48 w-full object-cover" />
        : <div className="flex h-32 items-center justify-center bg-slate-100 text-slate-500">{isImage ? <FileImage size={42} /> : <FileText size={42} />}</div>}
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3"><div><Badge variant="outline">{document.documentType}</Badge><h3 className="mt-3 font-semibold text-slate-950">{document.title}</h3></div><span className="text-xs text-slate-400">{fileSize(document.sizeBytes)}</span></div>
        {document.description && <p className="mt-2 text-sm leading-6 text-slate-700">{document.description}</p>}
        <p className="mt-2 truncate text-xs text-slate-500">{document.fileName}</p>
        <Button className="mt-4 w-full" variant="outline" disabled={!url} onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}><ExternalLink size={15} className="mr-2" /> Avaa tiedosto</Button>
      </CardContent>
    </Card>
  );
}

export default function CustomerProjectV2() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const { effectiveDisplayName, isPreviewing, customerPreview } = useViewAs();
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
  const [success, setSuccess] = useState<string | null>(null);

  const reportError = useCallback((message: string) => setError(message), []);

  const refresh = useCallback(async () => {
    if (!currentOrg || !projectId) return;
    setLoading(true);
    try {
      const preview = isPreviewing ? customerPreview : null;
      const [nextContext, summaries, workRequests, nextDocuments, nextChangeOrders] = await Promise.all([
        loadPortalProjectContext(currentOrg.id, projectId, preview),
        loadPortalProjects(currentOrg.id, preview),
        loadPortalWorkRequests(currentOrg.id, preview),
        loadPortalDocuments(currentOrg.id, projectId, preview),
        loadPortalChangeOrders(currentOrg.id, projectId, preview),
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
  }, [currentOrg, customerPreview, isPreviewing, projectId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const openRequests = useMemo(() => requests.filter((request) => request.status !== 'Peruttu').length, [requests]);
  const waitingChanges = useMemo(() => changeOrders.filter((item) => item.customerDecision === 'Odottaa').length, [changeOrders]);

  const startRequest = () => {
    if (isPreviewing) return;
    setForm({ ...EMPTY_FORM, contactName: effectiveDisplayName });
    setError(null);
    setSuccess(null);
    setOpen(true);
  };

  const submit = async () => {
    if (isPreviewing) return;
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
      setSuccess('Työpyyntö lähetettiin työnjohdolle.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Työpyynnön lähetys epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const startDecision = (changeOrder: CustomerProjectChangeOrder, nextDecision: Extract<CustomerChangeDecision, 'Hyväksytty' | 'Hylätty'>) => {
    if (isPreviewing) return;
    setSelectedChange(changeOrder);
    setDecision(nextDecision);
    setDecisionNote('');
    setDecisionOpen(true);
  };

  const saveDecision = async () => {
    if (isPreviewing || !selectedChange) return;
    setSaving(true);
    try {
      await decideCustomerChangeOrder({ changeOrderId: selectedChange.id, decision, note: decisionNote });
      setDecisionOpen(false);
      setSuccess(decision === 'Hyväksytty' ? 'Muutostyö hyväksyttiin.' : 'Muutostyö hylättiin.');
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
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-5 text-white shadow-xl sm:p-8">
        <Button variant="ghost" className="mb-4 gap-2 text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => navigate('/tilaajan-tyot')}><ArrowLeft size={16} /> Projektini</Button>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2"><Badge className="border-slate-600 bg-slate-800 text-slate-100">{context?.status || (loading ? 'Ladataan' : 'Ei tietoa')}</Badge>{isPreviewing && <Badge className="border-white/20 bg-white/10 text-white"><Eye size={12} className="mr-1" /> Esikatselu</Badge>}{context?.location && <span className="flex items-center gap-1 text-sm text-slate-300"><MapPin size={14} />{context.location}</span>}</div>
            <h1 className="text-3xl font-bold">{context?.projectName || 'Projekti'}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{context?.description || 'Projektin tiedot, dokumentit ja tilaajalle julkaistu tilannekuva.'}</p>
          </div>
          {!isPreviewing && <div className="flex flex-wrap gap-2"><Button variant="outline" className="border-slate-600 bg-white/5 text-white hover:bg-white/10" onClick={() => navigate(`/projektikeskustelut/${projectId}`)}><MessageCircle size={16} className="mr-2" /> Keskustelu</Button><Button className="bg-teal-500 text-white hover:bg-teal-600" onClick={startRequest}><Plus size={16} className="mr-2" /> Uusi työpyyntö</Button></div>}
        </div>
        {context && <div className="mt-6"><div className="mb-2 flex justify-between text-xs text-slate-300"><span>Projektin eteneminen</span><strong>{context.progress}%</strong></div><Progress value={context.progress} className="h-2 bg-slate-700" /></div>}
      </section>

      {isPreviewing && <div className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900"><ShieldCheck size={19} className="mt-0.5 shrink-0" /><div><p className="font-semibold">Tilaajalle näkyvä, vain lukemiseen tarkoitettu projektinäkymä</p><p className="mt-1 leading-6">Sisäiset kustannukset, henkilöstötiedot, sisäinen keskustelu ja tilaajalta piilotetut dokumentit eivät sisälly vastaukseen.</p></div></div>}
      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={17} className="mt-0.5" />{error}</div>}
      {success && <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={17} className="mt-0.5" />{success}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Aloitus</p><p className="mt-2 font-semibold text-slate-950">{dateLabel(context?.startDate)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tavoite</p><p className="mt-2 font-semibold text-slate-950">{dateLabel(context?.endDate)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Työpyynnöt</p><p className="mt-2 text-2xl font-bold text-slate-950">{openRequests}</p></CardContent></Card>
        <Card className={waitingChanges ? 'border-amber-300' : ''}><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Päätettävät muutostyöt</p><p className="mt-2 text-2xl font-bold text-slate-950">{waitingChanges}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1"><TabsTrigger value="overview">Tilannekuva</TabsTrigger><TabsTrigger value="documents">Dokumentit ja kuvat ({documents.length})</TabsTrigger><TabsTrigger value="changes">Lisä- ja muutostyöt ({changeOrders.length})</TabsTrigger><TabsTrigger value="requests">Työpyynnöt ({requests.length})</TabsTrigger><TabsTrigger value="aftercare">Reklamaatiot ja takuu</TabsTrigger></TabsList>
        <TabsContent value="overview">
          <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
            <Card><CardHeader><CardTitle>Projektin perustiedot</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">{[['Tilaaja', context?.customerName || '—'], ['Sijainti', context?.location || '—'], ['Aloitus', dateLabel(context?.startDate)], ['Valmistuminen', dateLabel(context?.endDate)], ['Työnjohto', project?.supervisorName || 'Ei määritetty'], ['Projektin tila', context?.status || '—']].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 break-words font-semibold text-slate-900">{value}</p></div>)}</CardContent></Card>
            <Card><CardHeader><CardTitle>Tilaajan tehtävät</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex items-center justify-between rounded-xl border border-slate-200 p-4"><span className="text-sm font-medium">Päätöstä odottavat muutostyöt</span><Badge className={waitingChanges ? 'bg-amber-500' : 'bg-emerald-600'}>{waitingChanges}</Badge></div><div className="flex items-center justify-between rounded-xl border border-slate-200 p-4"><span className="text-sm font-medium">Avoimet työpyynnöt</span><Badge variant="outline">{openRequests}</Badge></div><div className="flex items-center justify-between rounded-xl border border-slate-200 p-4"><span className="text-sm font-medium">Julkaistut dokumentit</span><Badge variant="outline">{documents.length}</Badge></div></CardContent></Card>
          </div>
        </TabsContent>
        <TabsContent value="documents"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{documents.map((document) => <CustomerDocumentCard key={document.id} document={document} onError={reportError} />)}</div>{documents.length === 0 && <Card><CardContent className="p-10 text-center text-sm text-slate-500">Tilaajalle ei ole vielä julkaistu dokumentteja tai kuvia.</CardContent></Card>}</TabsContent>
        <TabsContent value="changes"><div className="space-y-4">{changeOrders.map((changeOrder) => <Card key={changeOrder.id}><CardContent className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2">{changeOrder.changeNumber && <Badge variant="outline">{changeOrder.changeNumber}</Badge>}<Badge variant="outline" className={decisionClass(changeOrder.customerDecision)}>{changeOrder.customerDecision || 'Odottaa'}</Badge></div><h3 className="mt-3 text-lg font-semibold text-slate-950">{changeOrder.title}</h3>{changeOrder.description && <p className="mt-2 text-sm leading-6 text-slate-700">{changeOrder.description}</p>}<p className="mt-3 text-2xl font-bold text-slate-950">{euro(changeOrder.amountCents)}</p>{changeOrder.customerDecisionNote && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><strong>Tilaajan kommentti:</strong> {changeOrder.customerDecisionNote}</p>}</div>{!isPreviewing && changeOrder.customerDecision === 'Odottaa' && <div className="flex gap-2"><Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => startDecision(changeOrder, 'Hyväksytty')}><CheckCircle2 size={16} /> Hyväksy</Button><Button variant="destructive" className="gap-2" onClick={() => startDecision(changeOrder, 'Hylätty')}><XCircle size={16} /> Hylkää</Button></div>}</div></CardContent></Card>)}</div>{changeOrders.length === 0 && <Card><CardContent className="p-10 text-center text-sm text-slate-500">Tilaajalle lähetettyjä lisä- tai muutostöitä ei ole.</CardContent></Card>}</TabsContent>
        <TabsContent value="aftercare"><CustomerAftercarePanel projectId={projectId} readOnly={isPreviewing} /></TabsContent>
        <TabsContent value="requests"><div className="space-y-3">{requests.map((request) => <Card key={request.id}><CardContent className="p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap gap-2"><Badge variant="outline">{request.category}</Badge><Badge variant="outline">{request.urgency}</Badge></div><h3 className="mt-3 font-semibold text-slate-950">{request.title}</h3><p className="mt-2 text-sm leading-6 text-slate-700">{request.description}</p>{request.supervisorNote && <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><strong>Työnjohdon viesti:</strong> {request.supervisorNote}</p>}</div><Badge>{request.status}</Badge></div></CardContent></Card>)}</div>{requests.length === 0 && <Card><CardContent className="p-10 text-center text-sm text-slate-500">Projektille ei ole tehty työpyyntöjä.</CardContent></Card>}</TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Uusi työpyyntö</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Otsikko *</Label><Input value={form.title} onChange={(event) => setForm((old) => ({ ...old, title: event.target.value }))} /></div><div className="space-y-2"><Label>Työn laji *</Label><Select value={form.category} onValueChange={(category) => setForm((old) => ({ ...old, category }))}><SelectTrigger><SelectValue placeholder="Valitse" /></SelectTrigger><SelectContent>{CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Kiireellisyys</Label><Select value={form.urgency} onValueChange={(urgency: CustomerRequestUrgency) => setForm((old) => ({ ...old, urgency }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Kiireellinen">Kiireellinen</SelectItem><SelectItem value="Normaali">Normaali</SelectItem><SelectItem value="Ei kiireellinen">Ei kiireellinen</SelectItem></SelectContent></Select></div><div className="space-y-2 sm:col-span-2"><Label>Kuvaus *</Label><Textarea rows={5} value={form.description} onChange={(event) => setForm((old) => ({ ...old, description: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label>Tarkka sijainti</Label><Input value={form.locationDetails} onChange={(event) => setForm((old) => ({ ...old, locationDetails: event.target.value }))} /></div><div className="space-y-2"><Label>Toivottu päivä</Label><Input type="date" value={form.requestedDate} onChange={(event) => setForm((old) => ({ ...old, requestedDate: event.target.value }))} /></div><div className="space-y-2"><Label>Yhteyshenkilö</Label><Input value={form.contactName} onChange={(event) => setForm((old) => ({ ...old, contactName: event.target.value }))} /></div><div className="space-y-2"><Label>Puhelin</Label><Input value={form.contactPhone} onChange={(event) => setForm((old) => ({ ...old, contactPhone: event.target.value }))} /></div><div className="space-y-2"><Label>Pääsyohje</Label><Input value={form.accessInstructions} onChange={(event) => setForm((old) => ({ ...old, accessInstructions: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label>Turvallisuushuomiot</Label><Textarea rows={3} value={form.safetyNotes} onChange={(event) => setForm((old) => ({ ...old, safetyNotes: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void submit()} disabled={saving}><ClipboardList size={15} className="mr-2" />{saving ? 'Lähetetään…' : 'Lähetä työpyyntö'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={decisionOpen} onOpenChange={setDecisionOpen}><DialogContent><DialogHeader><DialogTitle>{decision === 'Hyväksytty' ? 'Hyväksy muutostyö' : 'Hylkää muutostyö'}</DialogTitle></DialogHeader><p className="text-sm text-slate-700"><strong>{selectedChange?.title}</strong> · {selectedChange ? euro(selectedChange.amountCents) : ''}</p><div className="space-y-2"><Label>Kommentti</Label><Textarea rows={4} value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} /></div><DialogFooter><Button variant="outline" onClick={() => setDecisionOpen(false)} disabled={saving}>Peruuta</Button><Button variant={decision === 'Hyväksytty' ? 'default' : 'destructive'} onClick={() => void saveDecision()} disabled={saving}>{saving ? 'Tallennetaan…' : decision}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
