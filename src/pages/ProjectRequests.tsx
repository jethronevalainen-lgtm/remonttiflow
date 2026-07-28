import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileQuestion,
  Home,
  KeyRound,
  MapPin,
  Paperclip,
  RefreshCw,
  UserRound,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  approveProjectRequest,
  createProjectRequestAttachmentUrl,
  loadProjectRequests,
  setProjectRequestStatus,
  type ProjectRequest,
  type ProjectRequestStatus,
} from '@/lib/supabase/projectRequests';

const REVIEW_STATUSES: Array<Extract<ProjectRequestStatus, 'Käsittelyssä' | 'Lisätietoja pyydetty' | 'Hylätty'>> = [
  'Käsittelyssä',
  'Lisätietoja pyydetty',
  'Hylätty',
];

function dateLabel(value: string) {
  if (!value) return 'Ei määritetty';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

function statusClass(status: ProjectRequestStatus) {
  if (status === 'Muutettu projektiksi' || status === 'Hyväksytty') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Hylätty') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'Lisätietoja pyydetty') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'Käsittelyssä') return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function detailLocation(request: ProjectRequest) {
  return [
    request.location,
    request.building ? `Rakennus ${request.building}` : '',
    request.staircase ? `Rappu ${request.staircase}` : '',
    request.apartment ? `Asunto ${request.apartment}` : '',
  ].filter(Boolean).join(' · ');
}

export default function ProjectRequests() {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const [requests, setRequests] = useState<ProjectRequest[]>([]);
  const [selected, setSelected] = useState<ProjectRequest | null>(null);
  const [reviewStatus, setReviewStatus] = useState<Extract<ProjectRequestStatus, 'Käsittelyssä' | 'Lisätietoja pyydetty' | 'Hylätty'>>('Käsittelyssä');
  const [note, setNote] = useState('');
  const [projectNumber, setProjectNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      setRequests(await loadProjectRequests(currentOrg.id));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Työpyyntöjen lataus epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => { void refresh(); }, [refresh]);

  const counts = useMemo(() => ({
    open: requests.filter((item) => ['Lähetetty', 'Käsittelyssä', 'Lisätietoja pyydetty'].includes(item.status)).length,
    waiting: requests.filter((item) => item.status === 'Lähetetty').length,
    needsInfo: requests.filter((item) => item.status === 'Lisätietoja pyydetty').length,
    converted: requests.filter((item) => item.status === 'Muutettu projektiksi').length,
  }), [requests]);

  const openReview = (request: ProjectRequest) => {
    setSelected(request);
    setReviewStatus(request.status === 'Lisätietoja pyydetty' || request.status === 'Hylätty' ? request.status : 'Käsittelyssä');
    setNote(request.managementNote || '');
    setProjectNumber('');
    setError(null);
  };

  const saveReview = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await setProjectRequestStatus({ requestId: selected.id, status: reviewStatus, managementNote: note });
      setSelected(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Työpyynnön päivitys epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const approve = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const projectId = await approveProjectRequest({ requestId: selected.id, projectNumber, managementNote: note });
      setSelected(null);
      await refresh();
      navigate(`/projektit/${projectId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Projektin perustaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const openAttachment = async (storagePath: string) => {
    try {
      const url = await createProjectRequestAttachmentUrl(storagePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Liitteen avaaminen epäonnistui.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-orange-200">Tilaajalta tuotantoon</p><h1 className="text-3xl font-bold">Tilaajan työpyynnöt</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Tarkista kohde, aikataulu, asuminen, pääsy, yhteystiedot ja liitteet ennen projektin perustamista.</p></div>
          <Button variant="outline" className="border-slate-600 bg-white/5 text-white hover:bg-white/10" onClick={() => void refresh()} disabled={loading}><RefreshCw size={16} className={loading ? 'mr-2 animate-spin' : 'mr-2'} /> Päivitä</Button>
        </div>
      </section>

      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={17} className="mt-0.5" />{error}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Avoimet', value: counts.open, icon: FileQuestion, tone: 'bg-orange-50 text-orange-700' },
          { label: 'Uudet', value: counts.waiting, icon: Clock3, tone: 'bg-blue-50 text-blue-700' },
          { label: 'Täydennettävät', value: counts.needsInfo, icon: AlertTriangle, tone: 'bg-amber-50 text-amber-700' },
          { label: 'Perustetut projektit', value: counts.converted, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
        ].map((item) => <Card key={item.label}><CardContent className="p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-bold text-slate-950">{item.value}</p></div><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.tone}`}><item.icon size={20} /></div></div></CardContent></Card>)}
      </div>

      <div className="space-y-4">
        {requests.map((request) => (
          <Card key={request.id} className="border-slate-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={statusClass(request.status)}>{request.status}</Badge><Badge variant="outline">{request.requestType}</Badge><Badge className={request.occupancyStatus === 'Asuttu' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'}>{request.occupancyStatus}</Badge><span className="text-xs text-slate-400">{dateLabel(request.submittedAt || request.createdAt)}</span></div>
                  <h2 className="mt-3 text-xl font-semibold text-slate-950">{request.projectName}</h2>
                  <p className="mt-1 text-sm text-slate-500">{request.customerName}</p>
                  <p className="mt-2 flex items-center gap-1 text-sm text-slate-600"><MapPin size={14} />{detailLocation(request) || 'Ei sijaintia'}</p>
                  <p className="mt-3 max-w-4xl whitespace-pre-wrap text-sm leading-6 text-slate-700">{request.description}</p>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
                    <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Aloitus aikaisintaan</p><p className="mt-1 font-medium">{dateLabel(request.desiredStartDate)}</p></div>
                    <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Valmis viimeistään</p><p className="mt-1 font-medium">{dateLabel(request.desiredEndDate)}</p><p className="text-xs text-slate-500">{request.deadlineFlexibility}</p></div>
                    <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Uusi asukas</p><p className="mt-1 font-medium">{request.incomingResidentStatus}</p><p className="text-xs text-slate-500">{request.incomingResidentMoveInDate ? dateLabel(request.incomingResidentMoveInDate) : request.incomingContractStatus}</p></div>
                    <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Pääsy</p><p className="mt-1 font-medium">{request.accessMethod || 'Ei määritetty'}</p><p className="text-xs text-slate-500">{request.allowedWorkingHours}</p></div>
                    <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Liitteet</p><p className="mt-1 flex items-center gap-1 font-medium"><Paperclip size={14} />{request.attachments.length}</p></div>
                  </div>
                  {request.managementNote && <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><strong>Työnjohdon merkintä:</strong> {request.managementNote}</div>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col">
                  {request.status === 'Muutettu projektiksi' && request.convertedProjectId ? <Button onClick={() => navigate(`/projektit/${request.convertedProjectId}`)}>Avaa projekti</Button> : <Button onClick={() => openReview(request)}>Tarkista ja käsittele</Button>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && requests.length === 0 && <Card className="border-dashed"><CardContent className="p-12 text-center"><FileQuestion size={44} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold text-slate-800">Ei työpyyntöjä</p></CardContent></Card>}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader><DialogTitle>Käsittele tilaajan työpyyntö</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-5">
              <div className="rounded-xl bg-slate-950 p-5 text-white">
                <div className="flex flex-wrap items-center gap-2"><Badge className="bg-white/10 text-white">{selected.requestType}</Badge><Badge className="bg-white/10 text-white">{selected.occupancyStatus}</Badge></div>
                <h2 className="mt-3 text-2xl font-bold">{selected.projectName}</h2>
                <p className="mt-1 text-sm text-slate-300">{selected.customerName} · {detailLocation(selected)}</p>
                {selected.customerReference && <p className="mt-2 text-xs text-slate-400">Tilaajan viite: {selected.customerReference}</p>}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border p-4"><p className="flex items-center gap-2 font-semibold"><CalendarDays size={17} className="text-orange-700" /> Aikataulu</p><dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-slate-500">Aloitus</dt><dd className="font-medium">{dateLabel(selected.desiredStartDate)}</dd></div><div><dt className="text-xs text-slate-500">Valmistuminen</dt><dd className="font-medium">{dateLabel(selected.desiredEndDate)}</dd></div><div><dt className="text-xs text-slate-500">Määräpäivä</dt><dd>{selected.deadlineFlexibility}</dd></div><div><dt className="text-xs text-slate-500">Peruste</dt><dd>{selected.deadlineReason || 'Ei määritetty'}</dd></div></dl></div>
                <div className="rounded-xl border p-4"><p className="flex items-center gap-2 font-semibold"><Home size={17} className="text-orange-700" /> Asuminen</p><dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-slate-500">Käyttötilanne</dt><dd className="font-medium">{selected.occupancyStatus}</dd></div><div><dt className="text-xs text-slate-500">Nykyinen asukas muuttaa</dt><dd>{selected.currentResidentMovingOut ? dateLabel(selected.currentResidentMoveOutDate) : 'Ei / ei tiedossa'}</dd></div><div><dt className="text-xs text-slate-500">Uusi asukas</dt><dd>{selected.incomingResidentStatus}{selected.incomingResidentMoveInDate ? ` · ${dateLabel(selected.incomingResidentMoveInDate)}` : ''}</dd></div><div><dt className="text-xs text-slate-500">Sopimus</dt><dd>{selected.incomingContractStatus}</dd></div></dl></div>
                <div className="rounded-xl border p-4"><p className="flex items-center gap-2 font-semibold"><KeyRound size={17} className="text-orange-700" /> Pääsy kohteeseen</p><p className="mt-3 text-sm font-medium">{selected.accessMethod || 'Ei määritetty'}</p><p className="mt-1 text-sm text-slate-600">{selected.allowedWorkingHours || 'Työaikoja ei määritetty'}</p>{selected.accessNotes && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{selected.accessNotes}</p>}</div>
                <div className="rounded-xl border p-4"><p className="flex items-center gap-2 font-semibold"><UserRound size={17} className="text-orange-700" /> Yhteyshenkilöt</p><p className="mt-3 text-sm"><strong>Tilaaja:</strong> {selected.contactName || 'Ei määritetty'}{selected.contactPhone ? ` · ${selected.contactPhone}` : ''}{selected.contactEmail ? ` · ${selected.contactEmail}` : ''}</p><p className="mt-2 text-sm"><strong>Asukas / kohde:</strong> {selected.residentContactAllowed ? `${selected.residentContactName}${selected.residentContactPhone ? ` · ${selected.residentContactPhone}` : ''}${selected.residentContactEmail ? ` · ${selected.residentContactEmail}` : ''}` : 'Suora yhteydenotto ei ole sallittu'}</p>{selected.contactInstructions && <p className="mt-3 text-sm text-slate-600">{selected.contactInstructions}</p>}</div>
              </div>

              <div className="rounded-xl border p-4"><p className="font-semibold">Työn kuvaus</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selected.description}</p></div>

              <div className="rounded-xl border p-4">
                <div className="flex items-center justify-between"><p className="flex items-center gap-2 font-semibold"><Paperclip size={17} className="text-orange-700" /> Liitteet</p><Badge variant="outline">{selected.attachments.length}</Badge></div>
                {selected.attachments.length === 0 ? <p className="mt-3 text-sm text-slate-500">Tilaaja ei lisännyt liitteitä.</p> : <div className="mt-3 grid gap-2 sm:grid-cols-2">{selected.attachments.map((attachment) => <button key={attachment.id} type="button" onClick={() => void openAttachment(attachment.storagePath)} className="flex items-center gap-3 rounded-lg border p-3 text-left transition hover:border-orange-300 hover:bg-orange-50"><FileQuestion size={18} className="shrink-0 text-orange-700" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{attachment.fileName}</span><span className="block truncate text-xs text-slate-500">{attachment.description || attachment.mimeType}</span></span><ExternalLink size={15} className="shrink-0 text-slate-400" /></button>)}</div>}
              </div>

              {selected.status !== 'Muutettu projektiksi' && <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"><div className="space-y-2"><Label>Käsittelytila</Label><Select value={reviewStatus} onValueChange={(value) => setReviewStatus(value as typeof reviewStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{REVIEW_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="project-number">Projektinumero hyväksyttäessä</Label><Input id="project-number" value={projectNumber} onChange={(event) => setProjectNumber(event.target.value)} placeholder="Luodaan automaattisesti, jos tyhjä" /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="management-note">Viesti tilaajalle / käsittelymerkintä</Label><Textarea id="management-note" value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder={reviewStatus === 'Lisätietoja pyydetty' ? 'Kerro täsmällisesti, mitä tietoja tilaajan pitää täydentää.' : 'Kirjaa päätöksen tai käsittelyn peruste.'} /></div></div>}
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row"><Button variant="outline" onClick={() => setSelected(null)} disabled={saving}>Sulje</Button>{selected && selected.status !== 'Muutettu projektiksi' && <><Button variant="secondary" onClick={() => void saveReview()} disabled={saving}><XCircle size={16} className="mr-2" />Tallenna käsittely</Button><Button onClick={() => void approve()} disabled={saving}><CheckCircle2 size={16} className="mr-2" />Hyväksy ja perusta projekti</Button></>}</DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
