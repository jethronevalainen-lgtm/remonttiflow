import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  ExternalLink,
  Loader2,
  MapPin,
  MessageCircle,
  Send,
  UserRound,
  UsersRound,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import {
  loadCustomerOrderContext,
  loadCustomerOrderEvents,
  loadCustomerOrderMessages,
  loadCustomerOrderParticipants,
  postCustomerOrderMessage,
  publishCustomerOrderEvent,
  type CustomerOrderContext,
  type CustomerOrderEvent,
  type CustomerOrderMessage,
  type CustomerOrderParticipant,
} from '@/lib/supabase/customerOrders';

function dateLabel(value: string) {
  if (!value) return 'Ei määritetty';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

function dateTimeLabel(value: string) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

function roleLabel(role: string) {
  if (role === 'customer') return 'Tilaaja';
  if (role === 'admin') return 'Järjestelmänvalvoja';
  if (role === 'supervisor') return 'Työnjohtaja';
  if (role === 'project_coordinator') return 'Projektikoordinaattori';
  if (role === 'worker') return 'Työntekijä';
  return role || 'Osallistuja';
}

function statusClass(status: string) {
  if (status === 'Muutettu projektiksi' || status === 'Hyväksytty') return 'border-emerald-300 bg-emerald-50 text-emerald-800';
  if (status === 'Hylätty') return 'border-red-300 bg-red-50 text-red-800';
  if (status === 'Lisätietoja pyydetty') return 'border-amber-300 bg-amber-50 text-amber-800';
  if (status === 'Luonnos') return 'border-slate-300 bg-slate-50 text-slate-700';
  return 'border-blue-300 bg-blue-50 text-blue-800';
}

export default function CustomerOrderDetail() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { effectiveRole, isPreviewing } = useViewAs();
  const [context, setContext] = useState<CustomerOrderContext | null>(null);
  const [messages, setMessages] = useState<CustomerOrderMessage[]>([]);
  const [events, setEvents] = useState<CustomerOrderEvent[]>([]);
  const [participants, setParticipants] = useState<CustomerOrderParticipant[]>([]);
  const [message, setMessage] = useState('');
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateDescription, setUpdateDescription] = useState('');
  const [updateProgress, setUpdateProgress] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canPublish = ['admin', 'supervisor', 'project_coordinator'].includes(effectiveRole ?? '');

  const refresh = useCallback(async () => {
    if (!currentOrg || !requestId) return;
    setLoading(true);
    try {
      const [nextContext, nextMessages, nextEvents, nextParticipants] = await Promise.all([
        loadCustomerOrderContext(currentOrg.id, requestId),
        loadCustomerOrderMessages(currentOrg.id, requestId),
        loadCustomerOrderEvents(currentOrg.id, requestId),
        loadCustomerOrderParticipants(currentOrg.id, requestId),
      ]);
      setContext(nextContext);
      setMessages(nextMessages);
      setEvents(nextEvents);
      setParticipants(nextParticipants);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tilauksen lataus epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [currentOrg, requestId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const orderedEvents = useMemo(() => [...events].sort((left, right) => right.createdAt.localeCompare(left.createdAt)), [events]);

  const sendMessage = async () => {
    if (!currentOrg || !requestId || isPreviewing || !message.trim()) return;
    setSaving(true);
    try {
      await postCustomerOrderMessage(currentOrg.id, requestId, message.trim());
      setMessage('');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Viestin lähetys epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const publishUpdate = async () => {
    if (!currentOrg || !requestId || !canPublish || !updateTitle.trim()) return;
    const parsedProgress = updateProgress.trim() ? Number(updateProgress) : null;
    if (parsedProgress !== null && (!Number.isFinite(parsedProgress) || parsedProgress < 0 || parsedProgress > 100)) {
      setError('Etenemisen pitää olla 0–100 %.');
      return;
    }
    setSaving(true);
    try {
      await publishCustomerOrderEvent({
        organizationId: currentOrg.id,
        requestId,
        title: updateTitle.trim(),
        description: updateDescription.trim(),
        progress: parsedProgress,
      });
      setUpdateTitle('');
      setUpdateDescription('');
      setUpdateProgress('');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Päivityksen julkaisu epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  if (!requestId) return null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-5 text-white shadow-xl sm:p-8">
        <Button variant="ghost" className="mb-4 gap-2 text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => navigate(effectiveRole === 'customer' ? '/tilaajan-tyot' : '/projektipyynnot')}>
          <ArrowLeft size={16} /> Takaisin tilauksiin
        </Button>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={statusClass(context?.status ?? '')}>{loading ? 'Ladataan' : context?.status || 'Ei tietoa'}</Badge>
              {context?.requestType && <Badge className="border-white/20 bg-white/10 text-white">{context.requestType}</Badge>}
            </div>
            <h1 className="mt-3 break-words text-3xl font-bold">{context?.title || 'Tilaus'}</h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-300"><MapPin size={15} />{context?.location || 'Sijaintia ei ole määritetty'}</p>
          </div>
          {context?.convertedProjectId && (
            <Button className="gap-2 bg-teal-500 text-white hover:bg-teal-600" onClick={() => navigate(effectiveRole === 'customer' ? `/tilaajan-projektit/${context.convertedProjectId}` : `/projektit/${context.convertedProjectId}`)}>
              <ExternalLink size={16} /> Avaa projekti
            </Button>
          )}
        </div>
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-300"><span>Tilauksen eteneminen</span><strong>{context?.progress ?? 0} %</strong></div>
          <Progress value={context?.progress ?? 0} className="h-2 bg-slate-700" />
        </div>
      </section>

      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={17} className="mt-0.5 shrink-0" />{error}</div>}
      {loading && <div className="flex items-center gap-2 rounded-xl border bg-white p-4 text-sm text-slate-500"><Loader2 size={17} className="animate-spin" />Ladataan tilausta…</div>}

      {context && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Toivottu aloitus</p><p className="mt-2 font-semibold">{dateLabel(context.desiredStartDate)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tavoite</p><p className="mt-2 font-semibold">{dateLabel(context.desiredEndDate)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Työvaiheet</p><p className="mt-2 text-2xl font-bold">{context.workOrderCompleted}/{context.workOrderTotal}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Viestit</p><p className="mt-2 text-2xl font-bold">{context.messageCount}</p></CardContent></Card>
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
              <TabsTrigger value="overview">Tilauksen tiedot</TabsTrigger>
              <TabsTrigger value="progress">Eteneminen ({events.length})</TabsTrigger>
              <TabsTrigger value="conversation">Keskustelu ({messages.length})</TabsTrigger>
              <TabsTrigger value="participants">Osapuolet ({participants.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
                <Card><CardHeader><CardTitle>Työn määrittely</CardTitle></CardHeader><CardContent className="space-y-4"><p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{context.description}</p><div className="grid gap-3 sm:grid-cols-2">{[
                  ['Tilaaja', context.customerName],
                  ['Kohteen tila', context.occupancyStatus || 'Ei tiedossa'],
                  ['Aikataulun jousto', context.deadlineFlexibility || 'Ei tiedossa'],
                  ['Pääsy kohteeseen', context.accessMethod || 'Sovittava'],
                  ['Sallitut työajat', context.allowedWorkingHours || 'Sovittava'],
                  ['Projektin tila', context.projectStatus || 'Ei vielä projektia'],
                ].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-900">{value}</p></div>)}</div></CardContent></Card>
                <Card><CardHeader><CardTitle>Yhteyshenkilö</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p className="flex items-center gap-2 font-semibold"><UserRound size={17} />{context.contactName || 'Ei määritetty'}</p>{context.contactPhone && <p>{context.contactPhone}</p>}{context.contactEmail && <p>{context.contactEmail}</p>}{context.managementNote && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950"><strong>Työnjohdon viesti</strong><p className="mt-2 whitespace-pre-wrap leading-6">{context.managementNote}</p></div>}{effectiveRole === 'customer' && ['Luonnos', 'Lisätietoja pyydetty'].includes(context.status) && !isPreviewing && <Button className="w-full" onClick={() => navigate(`/tilaajan-tyot/uusi?draft=${context.id}`)}>Täydennä tilausta</Button>}</CardContent></Card>
              </div>
            </TabsContent>

            <TabsContent value="progress" className="space-y-4">
              {canPublish && (
                <Card className="border-teal-200"><CardHeader><CardTitle>Julkaise tilaajalle tilannepäivitys</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Otsikko</Label><Input value={updateTitle} onChange={(event) => setUpdateTitle(event.target.value)} maxLength={180} /></div><div className="space-y-2 sm:col-span-2"><Label>Kuvaus</Label><Textarea rows={4} value={updateDescription} onChange={(event) => setUpdateDescription(event.target.value)} /></div><div className="space-y-2"><Label>Eteneminen %</Label><Input type="number" min={0} max={100} value={updateProgress} onChange={(event) => setUpdateProgress(event.target.value)} /></div><div className="flex items-end"><Button className="w-full" disabled={saving || !updateTitle.trim()} onClick={() => void publishUpdate()}>{saving ? 'Julkaistaan…' : 'Julkaise päivitys'}</Button></div></CardContent></Card>
              )}
              <div className="space-y-3">
                {orderedEvents.map((event) => <Card key={event.id}><CardContent className="flex gap-4 p-5"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700"><CheckCircle2 size={19} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-slate-950">{event.title}</h3><span className="text-xs text-slate-500">{dateTimeLabel(event.createdAt)}</span></div>{event.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{event.description}</p>}{event.progress !== null && <div className="mt-3 flex items-center gap-3"><Progress value={event.progress} className="h-2 flex-1" /><span className="text-xs font-semibold">{event.progress} %</span></div>}</div></CardContent></Card>)}
                {orderedEvents.length === 0 && <Card><CardContent className="p-10 text-center text-sm text-slate-500">Tilaukselle ei ole vielä julkaistu tapahtumia.</CardContent></Card>}
              </div>
            </TabsContent>

            <TabsContent value="conversation" className="space-y-4">
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><MessageCircle size={20} /> Tilauksen keskustelu</CardTitle></CardHeader><CardContent className="space-y-4"><div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">{messages.map((item) => { const own = item.authorId === user?.id; return <div key={item.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 ${own ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-900'}`}><div className="flex flex-wrap items-center gap-2 text-xs opacity-80"><strong>{item.authorName}</strong><span>{roleLabel(item.authorRole)}</span><span>{dateTimeLabel(item.createdAt)}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.body}</p></div></div>; })}{messages.length === 0 && <p className="py-10 text-center text-sm text-slate-500">Keskustelussa ei ole vielä viestejä.</p>}</div>{!isPreviewing && <div className="flex flex-col gap-2 sm:flex-row"><Textarea rows={3} value={message} onChange={(event) => setMessage(event.target.value)} maxLength={5000} placeholder="Kirjoita tilaukseen liittyvä viesti…" /><Button className="gap-2 sm:self-end" disabled={saving || !message.trim()} onClick={() => void sendMessage()}><Send size={16} /> Lähetä</Button></div>}</CardContent></Card>
            </TabsContent>

            <TabsContent value="participants">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{participants.map((participant) => <Card key={`${participant.userId}-${participant.participation}`}><CardContent className="flex items-center gap-3 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700"><UsersRound size={18} /></div><div className="min-w-0"><p className="truncate font-semibold text-slate-950">{participant.displayName}</p><p className="text-xs text-slate-500">{participant.participation} · {roleLabel(participant.role)}</p></div></CardContent></Card>)}</div>
            </TabsContent>
          </Tabs>

          <Card className="border-slate-200 bg-slate-50"><CardContent className="grid gap-3 p-4 text-xs text-slate-600 sm:grid-cols-3"><span className="flex items-center gap-2"><ClipboardList size={15} /> Tilaus luotu {dateTimeLabel(context.createdAt)}</span><span className="flex items-center gap-2"><CalendarDays size={15} /> Lähetetty {dateTimeLabel(context.submittedAt)}</span><span className="flex items-center gap-2"><Clock3 size={15} /> Käsitelty {dateTimeLabel(context.reviewedAt)}</span></CardContent></Card>
        </>
      )}
    </div>
  );
}
