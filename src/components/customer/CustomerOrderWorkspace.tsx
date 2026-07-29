import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Download, FileText, Loader2, MapPin,
  MessageCircle, Paperclip, Pencil, Send, ShieldAlert, Trash2, UsersRound,
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
import { useAuth } from '@/contexts/AuthContext';
import {
  acknowledgePortalPublication, cancelPortalOrder, createPortalAttachmentUrl,
  loadPortalOrderDetail, markPortalOrderRead, sendPortalOrderMessage, subscribePortalOrder,
  updateManagementPortalOrder, updatePortalOrder, uploadPortalOrderAttachments,
  type PortalOrderDetail, type PortalOrderDraft, type PortalOrderStatus,
} from '@/lib/supabase/customerPortalOrders';

const STATUSES: PortalOrderStatus[] = [
  'Uusi', 'Tarkennettava', 'Käsittelyssä', 'Hyväksytty', 'Suunnittelussa',
  'Työmääräys luotu', 'Aikataulutettu', 'Käynnissä', 'Odottaa', 'Valmis', 'Peruttu',
];

interface PersonOption { userId: string; name: string; role?: string; }
interface Props {
  organizationId: string;
  requestId: string;
  onBack: () => void;
  people?: PersonOption[];
  onChanged?: () => Promise<void> | void;
}

function dateLabel(value?: string) {
  if (!value) return 'Ei määritetty';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fi-FI');
}

function dateTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

function money(cents?: number) {
  if (cents === undefined || cents === null) return 'Ei määritetty';
  return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function statusTone(status: PortalOrderStatus) {
  if (status === 'Valmis') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Peruttu') return 'border-slate-200 bg-slate-100 text-slate-600';
  if (status === 'Tarkennettava' || status === 'Odottaa') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'Käynnissä') return 'border-orange-200 bg-orange-50 text-orange-700';
  return 'border-blue-200 bg-blue-50 text-blue-700';
}

function toDraft(detail: PortalOrderDetail): Omit<PortalOrderDraft, 'organizationId' | 'customerId' | 'projectId'> {
  const order = detail.order;
  return {
    title: order.title, category: order.category, description: order.description, urgency: order.urgency,
    locationDetails: order.locationDetails, serviceAddress: order.serviceAddress, building: order.building,
    stairwell: order.stairwell, unit: order.unit, contactName: order.contactName, contactPhone: order.contactPhone,
    requestedDate: order.requestedDate, desiredCompletionDate: order.desiredCompletionDate,
    preferredTime: order.preferredTime, accessWindow: order.accessWindow, accessInstructions: order.accessInstructions,
    safetyNotes: order.safetyNotes, customerReference: order.customerReference,
    purchaseOrderNumber: order.purchaseOrderNumber, budgetLimitCents: order.budgetLimitCents,
    items: detail.items.map((item) => ({ ...item })),
  };
}

function AttachmentButton({ path, name }: { path: string; name: string }) {
  const [loading, setLoading] = useState(false);
  const open = async () => {
    setLoading(true);
    try { window.open(await createPortalAttachmentUrl(path), '_blank', 'noopener,noreferrer'); }
    finally { setLoading(false); }
  };
  return <Button size="sm" variant="outline" disabled={loading} onClick={() => void open()}><Download size={14} className="mr-1" />{name}</Button>;
}

export default function CustomerOrderWorkspace({ organizationId, requestId, onBack, people = [], onChanged }: Props) {
  const { user } = useAuth();
  const [detail, setDetail] = useState<PortalOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [replyToId, setReplyToId] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<Omit<PortalOrderDraft, 'organizationId' | 'customerId' | 'projectId'> | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [manageStatus, setManageStatus] = useState<PortalOrderStatus>('Uusi');
  const [manageProgress, setManageProgress] = useState(0);
  const [manageStart, setManageStart] = useState('');
  const [manageEnd, setManageEnd] = useState('');
  const [manageNote, setManageNote] = useState('');
  const [manageSupervisor, setManageSupervisor] = useState('none');
  const [manageParticipants, setManageParticipants] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadPortalOrderDetail(organizationId, requestId);
      setDetail(next);
      setManageStatus(next.order.status);
      setManageProgress(next.order.progress);
      setManageStart(next.order.plannedStartDate ?? '');
      setManageEnd(next.order.plannedEndDate ?? '');
      setManageNote(next.order.supervisorNote ?? '');
      setManageSupervisor(next.order.assignedSupervisorId ?? 'none');
      setManageParticipants(next.participants.filter((item) => item.role === 'worker').map((item) => item.userId));
      setError(null);
      void markPortalOrderRead(requestId).catch(() => undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Työtilauksen lataus epäonnistui.');
    } finally { setLoading(false); }
  }, [organizationId, requestId]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => subscribePortalOrder(requestId, () => { void refresh(); }), [refresh, requestId]);

  const send = async () => {
    if (!detail || (!message.trim() && files.length === 0)) return;
    setSaving(true);
    setError(null);
    try {
      const messageId = await sendPortalOrderMessage(requestId, message.trim() || 'Liite', replyToId);
      if (files.length) await uploadPortalOrderAttachments({ organizationId, requestId, messageId, files });
      setMessage(''); setFiles([]); setReplyToId(undefined);
      if (fileRef.current) fileRef.current.value = '';
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Viestin lähetys epäonnistui.'); }
    finally { setSaving(false); }
  };

  const saveEdit = async () => {
    if (!editDraft) return;
    setSaving(true);
    try {
      await updatePortalOrder(requestId, editDraft);
      setEditOpen(false); setSuccess('Työtilauksen tiedot päivitettiin.');
      await refresh(); await onChanged?.();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Päivitys epäonnistui.'); }
    finally { setSaving(false); }
  };

  const cancel = async () => {
    setSaving(true);
    try {
      await cancelPortalOrder(requestId, cancelReason);
      setCancelOpen(false); setSuccess('Työtilaus peruttiin.');
      await refresh(); await onChanged?.();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Peruminen epäonnistui.'); }
    finally { setSaving(false); }
  };

  const saveManagement = async () => {
    setSaving(true);
    try {
      await updateManagementPortalOrder({
        requestId, status: manageStatus, progress: manageProgress,
        plannedStartDate: manageStart, plannedEndDate: manageEnd, supervisorNote: manageNote,
        assignedSupervisorId: manageSupervisor === 'none' ? undefined : manageSupervisor,
        participantUserIds: manageParticipants,
      });
      setSuccess('Tilauksen tila, aikataulu ja osapuolet päivitettiin.');
      await refresh(); await onChanged?.();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Tilauksen ohjaus epäonnistui.'); }
    finally { setSaving(false); }
  };

  const acknowledge = async (publicationId: string) => {
    setSaving(true);
    try { await acknowledgePortalPublication(publicationId); await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Kuittaus epäonnistui.'); }
    finally { setSaving(false); }
  };

  const workerPeople = useMemo(() => people.filter((person) => person.role === 'worker' || !person.role), [people]);

  if (loading && !detail) return <div className="flex min-h-[45vh] items-center justify-center gap-2 text-sm text-slate-600"><Loader2 className="animate-spin" size={20} />Ladataan työtilausta…</div>;
  if (!detail) return <Card><CardContent className="p-8"><Button variant="outline" onClick={onBack}><ArrowLeft size={16} className="mr-2" />Takaisin</Button><p className="mt-5 text-red-700">{error ?? 'Tilausta ei löytynyt.'}</p></CardContent></Card>;
  const { order } = detail;
  const isManager = detail.permissions.isManager === true;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-5 text-white shadow-xl sm:p-8">
        <Button variant="ghost" onClick={onBack} className="mb-4 gap-2 text-slate-200 hover:bg-white/10 hover:text-white"><ArrowLeft size={16} />Tilaajaportaali</Button>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge className="bg-white/10 text-white">{order.orderNumber}</Badge><Badge className={statusTone(order.status)}>{order.status}</Badge>{order.urgency === 'Kiireellinen' && <Badge className="bg-red-500 text-white">Kiireellinen</Badge>}</div><h1 className="mt-3 break-words text-2xl font-bold sm:text-3xl">{order.title}</h1><p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-300"><span>{order.customerName}</span><span>·</span><span>{order.projectName}</span>{order.serviceAddress && <><span>·</span><span className="flex items-center gap-1"><MapPin size={14} />{order.serviceAddress}</span></>}</p></div>
          <div className="flex flex-wrap gap-2">{detail.permissions.canEdit && <Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={() => { setEditDraft(toDraft(detail)); setEditOpen(true); }}><Pencil size={16} className="mr-2" />Muokkaa määrittelyä</Button>}{detail.permissions.canCancel && order.status !== 'Peruttu' && order.status !== 'Valmis' && <Button variant="destructive" onClick={() => setCancelOpen(true)}><Trash2 size={16} className="mr-2" />Peru tilaus</Button>}</div>
        </div>
        <div className="mt-6"><div className="mb-2 flex justify-between text-xs text-slate-300"><span>Työn eteneminen</span><strong>{order.progress} %</strong></div><Progress value={order.progress} className="h-2 bg-slate-700" /></div>
      </section>

      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={17} className="mt-0.5" />{error}</div>}
      {success && <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={17} className="mt-0.5" />{success}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Toivottu aloitus</p><p className="mt-2 font-semibold">{dateLabel(order.requestedDate)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Suunniteltu aloitus</p><p className="mt-2 font-semibold">{dateLabel(order.plannedStartDate)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Suunniteltu valmistuminen</p><p className="mt-2 font-semibold">{dateLabel(order.plannedEndDate)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Vastuuhenkilö</p><p className="mt-2 font-semibold">{order.assignedSupervisorName || 'Ei määritetty'}</p></CardContent></Card></div>

      {isManager && <Card className="border-orange-200 bg-orange-50/40"><CardHeader><CardTitle className="text-lg">Työnjohdon ohjaus</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div className="space-y-2"><Label>Tila</Label><Select value={manageStatus} onValueChange={(value) => setManageStatus(value as PortalOrderStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Eteneminen %</Label><Input type="number" min={0} max={100} value={manageProgress} onChange={(event) => setManageProgress(Math.max(0, Math.min(100, Number(event.target.value))))} /></div><div className="space-y-2"><Label>Aloitus</Label><Input type="date" value={manageStart} onChange={(event) => setManageStart(event.target.value)} /></div><div className="space-y-2"><Label>Valmistuminen</Label><Input type="date" value={manageEnd} onChange={(event) => setManageEnd(event.target.value)} /></div></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Vastuuhenkilö</Label><Select value={manageSupervisor} onValueChange={setManageSupervisor}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei määritetty</SelectItem>{people.filter((person) => person.role !== 'worker').map((person) => <SelectItem key={person.userId} value={person.userId}>{person.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Viesti tilaajalle</Label><Textarea rows={3} value={manageNote} onChange={(event) => setManageNote(event.target.value)} /></div></div><div><Label>Työn osapuolet</Label><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{workerPeople.map((person) => <label key={person.userId} className="flex items-center gap-3 rounded-xl border bg-white p-3 text-sm"><input type="checkbox" checked={manageParticipants.includes(person.userId)} onChange={(event) => setManageParticipants((old) => event.target.checked ? [...new Set([...old, person.userId])] : old.filter((id) => id !== person.userId))} /><span>{person.name}</span></label>)}</div></div><Button disabled={saving} onClick={() => void saveManagement()}>{saving ? 'Tallennetaan…' : 'Tallenna ohjaus'}</Button></CardContent></Card>}

      <Tabs defaultValue="overview" className="space-y-4"><TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border bg-white p-1 sm:grid-cols-5"><TabsTrigger value="overview">Määrittely</TabsTrigger><TabsTrigger value="messages">Keskustelu ({detail.messages.length})</TabsTrigger><TabsTrigger value="timeline">Eteneminen ({detail.events.length})</TabsTrigger><TabsTrigger value="participants">Osapuolet ({detail.participants.length})</TabsTrigger><TabsTrigger value="documents">Julkaisut ({detail.publications.length})</TabsTrigger></TabsList>

        <TabsContent value="overview" className="space-y-4"><div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]"><Card><CardHeader><CardTitle>Työn kuvaus</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{order.description}</p>{detail.items.length > 0 && <div className="mt-6 space-y-3"><h3 className="font-semibold">Tilatut työvaiheet</h3>{detail.items.map((item, index) => <div key={item.id ?? index} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{index + 1}. {item.title}</p>{item.description && <p className="mt-1 text-sm text-slate-600">{item.description}</p>}</div>{item.completedAt ? <Badge className="bg-emerald-600">Valmis</Badge> : <Badge variant="outline">{item.priority ?? 'Normaali'}</Badge>}</div>{(item.quantity || item.unit || item.locationDetails) && <p className="mt-2 text-xs text-slate-500">{item.quantity ? `${item.quantity} ` : ''}{item.unit ?? ''}{item.locationDetails ? ` · ${item.locationDetails}` : ''}</p>}</div>)}</div>}</CardContent></Card><Card><CardHeader><CardTitle>Kohde ja ehdot</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">{[['Osoite', order.serviceAddress], ['Rakennus', order.building], ['Rappu', order.stairwell], ['Huoneisto / tila', order.unit], ['Tarkka sijainti', order.locationDetails], ['Pääsyohje', order.accessInstructions], ['Käyntiaika', order.accessWindow || order.preferredTime], ['Yhteyshenkilö', [order.contactName, order.contactPhone].filter(Boolean).join(' · ')], ['Tilaajan viite', order.customerReference], ['Ostotilausnumero', order.purchaseOrderNumber], ['Budjettiraja', order.budgetLimitCents !== undefined ? money(order.budgetLimitCents) : undefined]].map(([label, value]) => value ? <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-medium text-slate-900">{value}</p></div> : null)}{order.safetyNotes && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-red-900"><ShieldAlert size={17} className="mt-0.5" /><span>{order.safetyNotes}</span></div>}</CardContent></Card></div></TabsContent>

        <TabsContent value="messages"><Card className="overflow-hidden"><CardHeader className="border-b"><CardTitle className="flex items-center gap-2"><MessageCircle size={19} />Tilauksen keskustelu</CardTitle><p className="text-sm text-slate-500">Keskustelu näkyy vain tämän tilauksen tilaajille ja nimetyille toteutusosapuolille.</p></CardHeader><CardContent className="p-0"><div className="max-h-[58vh] min-h-[360px] space-y-3 overflow-y-auto bg-slate-50 p-4">{detail.messages.map((entry) => { const own = entry.authorUserId === user?.id; return <div key={entry.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] rounded-2xl p-3 shadow-sm ${own ? 'bg-teal-700 text-white' : 'border bg-white text-slate-900'}`}><div className="mb-1 flex flex-wrap items-center gap-2 text-xs opacity-80"><strong>{entry.authorName}</strong><span>{dateTime(entry.createdAt)}</span>{entry.editedAt && <span>muokattu</span>}</div><p className="whitespace-pre-wrap text-sm leading-6">{entry.body}</p>{entry.attachments.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{entry.attachments.map((attachment) => <AttachmentButton key={attachment.id} path={attachment.storagePath} name={attachment.fileName} />)}</div>}<button type="button" onClick={() => setReplyToId(entry.id)} className="mt-2 text-xs underline opacity-80">Vastaa</button></div></div>; })}{detail.messages.length === 0 && <p className="py-16 text-center text-sm text-slate-500">Keskustelua ei ole vielä aloitettu.</p>}</div>{detail.permissions.canMessage && <div className="border-t bg-white p-4">{replyToId && <div className="mb-2 flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-xs"><span>Vastaat aiempaan viestiin</span><button onClick={() => setReplyToId(undefined)}>Poista</button></div>}<Textarea rows={3} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Kirjoita viesti työn osapuolille…" /><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><div><input ref={fileRef} className="hidden" type="file" multiple accept="image/*,.pdf,.docx,.xlsx,.txt" onChange={(event) => { const selected = Array.from(event.target.files ?? []); const invalid = selected.find((file) => file.size > 10 * 1024 * 1024); if (invalid) setError(`${invalid.name}: tiedosto ylittää 10 Mt rajan.`); else setFiles(selected.slice(0, 5)); }} /><Button variant="outline" onClick={() => fileRef.current?.click()}><Paperclip size={16} className="mr-2" />Liitteet {files.length ? `(${files.length})` : ''}</Button></div><Button disabled={saving || (!message.trim() && files.length === 0)} onClick={() => void send()}><Send size={16} className="mr-2" />{saving ? 'Lähetetään…' : 'Lähetä'}</Button></div>{files.length > 0 && <p className="mt-2 text-xs text-slate-500">{files.map((file) => file.name).join(', ')}</p>}</div>}</CardContent></Card></TabsContent>

        <TabsContent value="timeline"><Card><CardHeader><CardTitle>Työn tapahtumat</CardTitle></CardHeader><CardContent><div className="relative space-y-4 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-px before:bg-slate-200">{detail.events.map((event) => <div key={event.id} className="relative flex gap-4"><div className="z-10 mt-1 h-6 w-6 shrink-0 rounded-full border-4 border-white bg-teal-600 shadow" /><div className="min-w-0 flex-1 rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{event.title}</p><span className="text-xs text-slate-500">{dateTime(event.createdAt)}</span></div>{event.description && <p className="mt-2 text-sm leading-6 text-slate-600">{event.description}</p>}{event.actorName && <p className="mt-2 text-xs text-slate-400">{event.actorName}</p>}</div></div>)}{detail.events.length === 0 && <p className="pl-10 text-sm text-slate-500">Tapahtumia ei ole vielä.</p>}</div></CardContent></Card></TabsContent>

        <TabsContent value="participants"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{detail.participants.map((participant) => <Card key={participant.userId}><CardContent className="p-4"><div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><UsersRound size={18} /></div><div className="min-w-0 break-words"><p className="font-semibold">{participant.displayName}</p><p className="text-xs text-slate-500">{participant.email}</p><Badge variant="outline" className="mt-2 whitespace-normal">{participant.role === 'worker' ? 'Toteuttaja' : participant.role === 'supervisor' ? 'Työnjohto' : participant.role === 'approver' ? 'Tilaajan hyväksyjä' : 'Tilaajan yhteyshenkilö'}</Badge></div></div></CardContent></Card>)}</div></TabsContent>

        <TabsContent value="documents"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{detail.publications.map((publication) => <Card key={publication.id}><CardContent className="p-5"><div className="flex items-start justify-between gap-2"><FileText className="text-teal-700" size={22} /><Badge variant="outline">Versio {publication.version}</Badge></div><h3 className="mt-4 font-semibold">{publication.title}</h3>{publication.summary && <p className="mt-2 text-sm leading-6 text-slate-600">{publication.summary}</p>}<p className="mt-3 text-xs text-slate-400">Julkaistu {dateTime(publication.publishedAt)}</p>{publication.requiresAcknowledgement && !publication.acknowledgedAt && <Button className="mt-4 w-full" disabled={saving} onClick={() => void acknowledge(publication.id)}>Kuittaa vastaanotetuksi</Button>}{publication.acknowledgedAt && <p className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-700"><CheckCircle2 size={16} />Kuitattu {dateTime(publication.acknowledgedAt)}</p>}</CardContent></Card>)}{detail.publications.length === 0 && <Card className="md:col-span-2 xl:col-span-3"><CardContent className="p-10 text-center text-sm text-slate-500">Tälle projektille ei ole julkaistu tilaaja-aineistoa.</CardContent></Card>}</div></TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Muokkaa työtilauksen määrittelyä</DialogTitle></DialogHeader>{editDraft && <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Otsikko</Label><Input value={editDraft.title} onChange={(event) => setEditDraft({ ...editDraft, title: event.target.value })} /></div><div className="space-y-2"><Label>Työn laji</Label><Input value={editDraft.category} onChange={(event) => setEditDraft({ ...editDraft, category: event.target.value })} /></div><div className="space-y-2"><Label>Kiireellisyys</Label><Select value={editDraft.urgency} onValueChange={(urgency) => setEditDraft({ ...editDraft, urgency: urgency as typeof editDraft.urgency })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Kiireellinen">Kiireellinen</SelectItem><SelectItem value="Normaali">Normaali</SelectItem><SelectItem value="Ei kiireellinen">Ei kiireellinen</SelectItem></SelectContent></Select></div><div className="space-y-2 sm:col-span-2"><Label>Kuvaus</Label><Textarea rows={5} value={editDraft.description} onChange={(event) => setEditDraft({ ...editDraft, description: event.target.value })} /></div>{[['serviceAddress','Osoite'],['building','Rakennus'],['stairwell','Rappu'],['unit','Huoneisto / tila'],['locationDetails','Tarkka sijainti'],['contactName','Yhteyshenkilö'],['contactPhone','Puhelin'],['accessWindow','Sallittu käyntiaika'],['accessInstructions','Pääsyohje'],['customerReference','Tilaajan viite'],['purchaseOrderNumber','Ostotilausnumero']].map(([key,label]) => <div key={key} className="space-y-2"><Label>{label}</Label><Input value={String(editDraft[key as keyof typeof editDraft] ?? '')} onChange={(event) => setEditDraft({ ...editDraft, [key]: event.target.value })} /></div>)}</div><div className="space-y-2"><Label>Turvallisuushuomiot</Label><Textarea rows={3} value={editDraft.safetyNotes ?? ''} onChange={(event) => setEditDraft({ ...editDraft, safetyNotes: event.target.value })} /></div><div className="space-y-3"><div className="flex items-center justify-between"><Label>Työvaiheet</Label><Button size="sm" variant="outline" onClick={() => setEditDraft({ ...editDraft, items: [...editDraft.items, { title: '', priority: 'Normaali' }] })}>Lisää työvaihe</Button></div>{editDraft.items.map((item, index) => <div key={item.id ?? index} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_120px_auto]"><Input value={item.title} placeholder="Työvaihe" onChange={(event) => { const items = [...editDraft.items]; items[index] = { ...item, title: event.target.value }; setEditDraft({ ...editDraft, items }); }} /><Input value={item.quantity ?? ''} placeholder="Määrä" onChange={(event) => { const items = [...editDraft.items]; items[index] = { ...item, quantity: event.target.value }; setEditDraft({ ...editDraft, items }); }} /><Button size="sm" variant="ghost" onClick={() => setEditDraft({ ...editDraft, items: editDraft.items.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={16} /></Button></div>)}</div></div>}<DialogFooter><Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void saveEdit()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}><DialogContent><DialogHeader><DialogTitle>Peru työtilaus</DialogTitle></DialogHeader><p className="text-sm text-slate-600">Peruminen tallentuu tapahtumahistoriaan. Työmääräykseksi muutettua työtä ei voi perua tilaajan toimesta.</p><div className="space-y-2"><Label>Perumisen syy</Label><Textarea rows={4} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></div><DialogFooter><Button variant="outline" onClick={() => setCancelOpen(false)} disabled={saving}>Takaisin</Button><Button variant="destructive" onClick={() => void cancel()} disabled={saving}>Peru työtilaus</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
