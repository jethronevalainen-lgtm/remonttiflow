import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ClipboardList, MapPin, MessageCircle, Plus, Send, ShieldCheck } from 'lucide-react';

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
  loadCustomerProjectSummaries,
  loadProjectConversationContext,
  type CustomerProjectSummary,
  type ProjectConversationContext,
} from '@/lib/supabase/projectCollaboration';

const CATEGORIES = ['Korjaus', 'Huolto', 'Muutos- tai lisätyö', 'Tarkastus', 'Reklamaatio', 'Muu'];
const EMPTY_FORM = { title: '', category: '', description: '', locationDetails: '', contactName: '', contactPhone: '', requestedDate: '', urgency: 'Normaali' as CustomerRequestUrgency, accessInstructions: '', safetyNotes: '' };

function dateLabel(value: string | null | undefined) {
  if (!value) return 'Ei määritetty';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

export default function CustomerProject() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const { effectiveDisplayName } = useViewAs();
  const [context, setContext] = useState<ProjectConversationContext | null>(null);
  const [project, setProject] = useState<CustomerProjectSummary | null>(null);
  const [requests, setRequests] = useState<CustomerWorkRequest[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!currentOrg || !projectId) return;
    setLoading(true);
    try {
      const [nextContext, summaries, workRequests] = await Promise.all([
        loadProjectConversationContext(projectId),
        loadCustomerProjectSummaries(currentOrg.id),
        loadCustomerWorkRequests(currentOrg.id),
      ]);
      setContext(nextContext);
      setProject(summaries.find((item) => item.id === projectId) ?? null);
      setRequests(workRequests.filter((item) => item.projectId === projectId));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Projektin lataus epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [currentOrg, projectId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const openRequests = useMemo(() => requests.filter((request) => request.status !== 'Peruttu').length, [requests]);

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

  if (!projectId) return null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-5 text-white shadow-lg sm:p-8">
        <Button variant="ghost" className="mb-4 gap-2 text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => navigate('/tilaajan-tyot')}><ArrowLeft size={16} /> Projektini</Button>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-3 flex flex-wrap items-center gap-2"><Badge className="border-slate-600 bg-slate-800 text-slate-100">{context?.status || 'Ladataan'}</Badge>{context?.location && <span className="flex items-center gap-1 text-sm text-slate-300"><MapPin size={14} />{context.location}</span>}</div><h1 className="text-3xl font-bold">{context?.projectName || 'Projekti'}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{context?.description || 'Projektin tiedot ja viestintä.'}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" className="border-slate-600 bg-white/5 text-white hover:bg-white/10" onClick={() => navigate(`/projektikeskustelut/${projectId}`)}><MessageCircle size={16} className="mr-2" /> Keskustelu</Button><Button className="bg-teal-500 text-white hover:bg-teal-600" onClick={startRequest}><Plus size={16} className="mr-2" /> Uusi työpyyntö</Button></div></div>
        {context && <div className="mt-6"><div className="mb-2 flex justify-between text-xs text-slate-300"><span>Projektin eteneminen</span><strong>{context.progress}%</strong></div><Progress value={context.progress} className="h-2 bg-slate-700" /></div>}
      </section>

      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={17} className="mt-0.5" />{error}</div>}

      <div className="grid grid-cols-3 gap-3"><Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Aloitus</p><p className="mt-2 font-semibold text-slate-950">{dateLabel(context?.startDate)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tavoite</p><p className="mt-2 font-semibold text-slate-950">{dateLabel(context?.endDate)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Työpyynnöt</p><p className="mt-2 text-2xl font-bold text-slate-950">{openRequests}</p></CardContent></Card></div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1"><TabsTrigger value="overview">Tilannekuva</TabsTrigger><TabsTrigger value="requests">Työpyynnöt ({requests.length})</TabsTrigger></TabsList>
        <TabsContent value="overview"><div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]"><Card><CardHeader><CardTitle>Projektin perustiedot</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">{[['Tilaaja', context?.customerName || '—'], ['Sijainti', context?.location || '—'], ['Aloitus', dateLabel(context?.startDate)], ['Valmistuminen', dateLabel(context?.endDate)], ['Työnjohto', project?.supervisorName || '—'], ['Yhteys', project?.supervisorEmail || '—']].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 p-4"><p className="text-xs uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 break-words font-semibold text-slate-900">{value}</p></div>)}</CardContent></Card><Card><CardHeader><CardTitle>Pikatoiminnot</CardTitle></CardHeader><CardContent className="grid gap-2"><Button variant="outline" className="justify-start gap-3" onClick={() => navigate(`/projektikeskustelut/${projectId}`)}><MessageCircle size={17} /> Projektikeskustelu</Button><Button variant="outline" className="justify-start gap-3" onClick={startRequest}><ClipboardList size={17} /> Uusi työpyyntö</Button><Button variant="outline" className="justify-start gap-3" onClick={() => navigate('/tyoturvallisuus')}><ShieldCheck size={17} /> Turvallisuushavainto</Button></CardContent></Card></div></TabsContent>
        <TabsContent value="requests" className="space-y-3">{requests.map((request) => <Card key={request.id}><CardContent className="p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold text-slate-950">{request.title}</h3><p className="mt-1 text-sm text-slate-500">{request.category} · {dateLabel(request.createdAt)}</p><p className="mt-3 text-sm leading-6 text-slate-700">{request.description}</p>{request.supervisorNote && <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><strong>Työnjohdon viesti:</strong> {request.supervisorNote}</div>}</div><Badge variant="outline">{request.status}</Badge></div></CardContent></Card>)}{!loading && requests.length === 0 && <Card className="border-dashed"><CardContent className="p-12 text-center"><ClipboardList size={44} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold">Ei työpyyntöjä</p></CardContent></Card>}</TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Uusi työpyyntö</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="customer-request-title">Otsikko *</Label><Input id="customer-request-title" value={form.title} onChange={(event) => setForm((old) => ({ ...old, title: event.target.value }))} placeholder="Esim. Vuoto kylpyhuoneessa" /></div><div className="space-y-2"><Label>Työn laji *</Label><Select value={form.category} onValueChange={(category) => setForm((old) => ({ ...old, category }))}><SelectTrigger><SelectValue placeholder="Valitse" /></SelectTrigger><SelectContent>{CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Kiireellisyys</Label><Select value={form.urgency} onValueChange={(urgency) => setForm((old) => ({ ...old, urgency: urgency as CustomerRequestUrgency }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Kiireellinen">Kiireellinen</SelectItem><SelectItem value="Normaali">Normaali</SelectItem><SelectItem value="Ei kiireellinen">Ei kiireellinen</SelectItem></SelectContent></Select></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="customer-request-description">Kuvaus *</Label><Textarea id="customer-request-description" rows={5} value={form.description} onChange={(event) => setForm((old) => ({ ...old, description: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="customer-request-location">Tarkka sijainti</Label><Input id="customer-request-location" value={form.locationDetails} onChange={(event) => setForm((old) => ({ ...old, locationDetails: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="customer-request-date">Toivottu päivä</Label><Input id="customer-request-date" type="date" value={form.requestedDate} onChange={(event) => setForm((old) => ({ ...old, requestedDate: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="customer-request-contact">Yhteyshenkilö</Label><Input id="customer-request-contact" value={form.contactName} onChange={(event) => setForm((old) => ({ ...old, contactName: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="customer-request-phone">Puhelin</Label><Input id="customer-request-phone" value={form.contactPhone} onChange={(event) => setForm((old) => ({ ...old, contactPhone: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="customer-request-access">Pääsy- ja avainohjeet</Label><Textarea id="customer-request-access" rows={2} value={form.accessInstructions} onChange={(event) => setForm((old) => ({ ...old, accessInstructions: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="customer-request-safety">Turvallisuus- tai muut huomioitavat asiat</Label><Textarea id="customer-request-safety" rows={2} value={form.safetyNotes} onChange={(event) => setForm((old) => ({ ...old, safetyNotes: event.target.value }))} /></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void submit()} disabled={saving} className="gap-2"><Send size={16} />{saving ? 'Lähetetään…' : 'Lähetä työpyyntö'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
