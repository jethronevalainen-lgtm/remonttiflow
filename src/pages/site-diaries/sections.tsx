import { useEffect, useState } from 'react';
import { Camera, Eye, FileText, Image as ImageIcon, MapPin, Save, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useOrganization } from '@/contexts/OrganizationContext';
import { normalizeSiteDiaryError } from '@/lib/siteDiaryRules';
import {
  createSiteDiaryAttachmentUrl,
  updateDiaryEvent,
  updateSiteDiaryHeader,
  uploadSiteDiaryAttachment,
  type SiteDiaryAttachment,
  type SiteDiaryAttachmentCategory,
  type SiteDiaryBundle,
  type SiteDiaryEventStatus,
} from '@/lib/supabase/siteDiaries';
import { ATTACHMENT_LABELS, EVENT_LABELS, fileSize } from './labels';
import { SectionCard, StatusBadge } from './common';

export function HeaderSection({ bundle, userId, userName, editable, onSaved }: { bundle: SiteDiaryBundle; userId: string; userName: string; editable: boolean; onSaved: () => Promise<void> }) {
  const { currentOrg } = useOrganization();
  const [address, setAddress] = useState(bundle.diary.siteAddress ?? '');
  const [contractNumber, setContractNumber] = useState(bundle.diary.contractNumber ?? '');
  const [author, setAuthor] = useState(bundle.diary.author || userName);
  const [summary, setSummary] = useState(bundle.diary.summary ?? '');
  const [visibleToCustomer, setVisibleToCustomer] = useState(bundle.diary.visibleToCustomer);
  const [responsibleId, setResponsibleId] = useState(bundle.diary.responsibleSupervisorId ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAddress(bundle.diary.siteAddress ?? '');
    setContractNumber(bundle.diary.contractNumber ?? '');
    setAuthor(bundle.diary.author || userName);
    setSummary(bundle.diary.summary ?? '');
    setVisibleToCustomer(bundle.diary.visibleToCustomer);
    setResponsibleId(bundle.diary.responsibleSupervisorId ?? '');
  }, [bundle.diary, userName]);

  const save = async () => {
    if (!currentOrg) return;
    setSaving(true);
    try {
      await updateSiteDiaryHeader({ organizationId: currentOrg.id, diaryId: bundle.diary.id, siteAddress: address, contractNumber, author, summary, visibleToCustomer, responsibleSupervisorId: responsibleId });
      await onSaved();
    } finally { setSaving(false); }
  };
  return <SectionCard title="Perustiedot ja päivän yhteenveto" description="Projektitiedot esitäytetään. Tarkista työmaan osoite, laatija ja vastaava työnjohtaja ennen lähettämistä." icon={<MapPin className="size-5" />} action={editable ? <Button size="sm" onClick={() => void save()} disabled={saving}><Save className="mr-2 size-4" />{saving ? 'Tallennetaan…' : 'Tallenna'}</Button> : undefined}><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1"><Label>Työmaan osoite *</Label><Input value={address} onChange={(event) => setAddress(event.target.value)} disabled={!editable} /></div><div className="space-y-1"><Label>Sopimus- tai projektinumero</Label><Input value={contractNumber} onChange={(event) => setContractNumber(event.target.value)} disabled={!editable} /></div><div className="space-y-1"><Label>Laatija</Label><Input value={author} onChange={(event) => setAuthor(event.target.value)} disabled={!editable} /></div><div className="space-y-1"><Label>Vastaava työnjohtaja</Label><div className="flex gap-2"><Input value={responsibleId ? (responsibleId === userId ? userName : 'Määritetty projektille') : 'Puuttuu'} readOnly />{editable && !responsibleId && <Button variant="outline" onClick={() => setResponsibleId(userId)}>Aseta minut</Button>}</div></div><div className="space-y-1 sm:col-span-2"><Label>Päivän yhteenveto</Label><Textarea rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Tiivis kokonaiskuva päivän etenemisestä, merkittävistä havainnoista ja seuraavista toimista." disabled={!editable} /></div><div className="flex items-center justify-between rounded-xl border p-4 sm:col-span-2"><div><p className="font-medium">Näytä päiväkirja tilaajalle</p><p className="text-sm text-text-secondary">Julkaisu ei ohita projektin käyttöoikeuksia.</p></div><Switch checked={visibleToCustomer} onCheckedChange={setVisibleToCustomer} disabled={!editable} /></div></div></SectionCard>;
}

export function EventRow({ event, disabled, onSaved, onDelete }: { event: SiteDiaryBundle['events'][number]; disabled: boolean; onSaved: () => Promise<void>; onDelete: () => Promise<void> }) {
  const [status, setStatus] = useState<SiteDiaryEventStatus>(event.status);
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); try { await updateDiaryEvent(event.id, { status }); await onSaved(); } finally { setSaving(false); } };
  const critical = ['deviation', 'delay', 'safety', 'decision_needed', 'yse_43_3', 'yse_44_2'].includes(event.eventType);
  return <div className={`rounded-xl border p-4 ${critical && event.status !== 'Ratkaistu' ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200'}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{EVENT_LABELS[event.eventType]}</Badge><h3 className="font-semibold">{event.title}</h3></div>{event.description && <p className="mt-2 whitespace-pre-wrap text-sm">{event.description}</p>}<div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">{event.occurredAt && <span>{new Date(event.occurredAt).toLocaleString('fi-FI')}</span>}{event.responsibleParty && <span>Vastuu: {event.responsibleParty}</span>}{event.dueAt && <span>Määräaika: {new Date(event.dueAt).toLocaleString('fi-FI')}</span>}{event.costImpactCents != null && <span>Arvio: {(event.costImpactCents / 100).toLocaleString('fi-FI', { style: 'currency', currency: 'EUR' })}</span>}</div></div><StatusBadge status={event.status === 'Ratkaistu' ? 'Tarkastettu' : event.status === 'Avoin' ? 'Täydennettävä' : 'Tarkastettavana'} /></div>{!disabled && <div className="mt-3 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-end sm:justify-end"><div className="w-full space-y-1 sm:w-48"><Label>Tapahtuman tila</Label><Select value={status} onValueChange={(value: SiteDiaryEventStatus) => setStatus(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(['Avoin', 'Käsittelyssä', 'Ratkaistu', 'Ei toimenpiteitä'] as SiteDiaryEventStatus[]).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div><Button size="sm" variant="outline" onClick={() => void save()} disabled={saving}><Save className="mr-2 size-4" />Tallenna</Button><Button size="icon" variant="ghost" className="text-red-600" onClick={() => void onDelete()}><Trash2 className="size-4" /></Button></div>}</div>;
}

export function AttachmentSection({ bundle, userId, editable, onSaved, onDelete, onError }: { bundle: SiteDiaryBundle; userId: string; editable: boolean; onSaved: () => Promise<void>; onDelete: (attachment: SiteDiaryAttachment) => void; onError: (message: string) => void }) {
  const [category, setCategory] = useState<SiteDiaryAttachmentCategory>('overview');
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadSiteDiaryAttachment({ organizationId: bundle.diary.organizationId, projectId: bundle.diary.projectId, diaryId: bundle.diary.id, userId, file, category, caption, capturedAt: new Date().toISOString() });
      setCaption('');
      await onSaved();
    } catch (caught) { onError(normalizeSiteDiaryError(caught, 'Liitteen lataus epäonnistui.')); } finally { setUploading(false); }
  };
  const open = async (attachment: SiteDiaryAttachment) => { try { window.open(await createSiteDiaryAttachmentUrl(attachment.storagePath), '_blank', 'noopener,noreferrer'); } catch (caught) { onError(normalizeSiteDiaryError(caught, 'Liitteen avaaminen epäonnistui.')); } };
  return <SectionCard title="Kuvat ja liitteet" description="Ota kuva suoraan puhelimella tai lisää PDF-, Excel- ja muut työmaadokumentit. Kuvaan tallennetaan kategoria ja kuvateksti." icon={<Camera className="size-5" />}><div className="space-y-4">{editable && <div className="grid gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 sm:grid-cols-[220px_minmax(0,1fr)_auto] sm:items-end"><div className="space-y-1"><Label>Kategoria</Label><Select value={category} onValueChange={(value: SiteDiaryAttachmentCategory) => setCategory(value)}><SelectTrigger className="bg-white"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ATTACHMENT_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Kuvateksti</Label><Input className="bg-white" value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Mitä kuvassa tai tiedostossa näkyy?" /></div><div><Input id="site-diary-file" className="hidden" type="file" accept="image/*,.pdf,.xlsx,.xls,.doc,.docx" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; void upload(file); event.currentTarget.value = ''; }} /><Button asChild disabled={uploading}><label htmlFor="site-diary-file" className="cursor-pointer"><Camera className="mr-2 size-4" />{uploading ? 'Ladataan…' : 'Ota kuva / lisää'}</label></Button></div></div>}<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{bundle.attachments.map((attachment) => <Card key={attachment.id} className="overflow-hidden"><div className="flex aspect-video items-center justify-center bg-slate-100">{attachment.mimeType.startsWith('image/') ? <ImageIcon className="size-10 text-text-muted" /> : <FileText className="size-10 text-text-muted" />}</div><CardContent className="p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><Badge variant="outline">{ATTACHMENT_LABELS[attachment.category]}</Badge><p className="mt-2 break-words font-medium">{attachment.caption || attachment.fileName}</p><p className="mt-1 text-xs text-text-muted">{attachment.fileName} · {fileSize(attachment.sizeBytes)}</p></div><div className="flex"><Button size="icon" variant="ghost" onClick={() => void open(attachment)} aria-label="Avaa"><Eye className="size-4" /></Button>{editable && <Button size="icon" variant="ghost" className="text-red-600" onClick={() => onDelete(attachment)} aria-label="Poista"><Trash2 className="size-4" /></Button>}</div></div></CardContent></Card>)}{bundle.attachments.length === 0 && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-text-secondary sm:col-span-2 xl:grid-cols-3">Ei kuvia tai liitteitä.</div>}</div></div></SectionCard>;
}
