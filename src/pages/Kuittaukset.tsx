import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Ban,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  ClipboardSignature,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  PackageCheck,
  Paperclip,
  Plus,
  Ruler,
  Search,
  ShieldCheck,
  Truck,
  Upload,
  X,
} from 'lucide-react';

import SignaturePad from '@/components/receipts/SignaturePad';
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
import { useSiteReceipts } from '@/hooks/useSiteReceipts';
import logger from '@/lib/logger';
import {
  createSignedSiteReceiptRecord,
  createSiteReceiptAttachmentUrl,
  MAX_RECEIPT_FILE_BYTES,
  MAX_RECEIPT_FILES,
  RECEIPT_FILE_TYPES,
  voidSiteReceiptRecord,
  type PendingReceiptFile,
} from '@/lib/supabase/siteReceiptEntities';
import type { SiteReceipt, SiteReceiptStatus, SiteReceiptType } from '@/types';

const RECEIPT_TYPE_LABELS: Record<SiteReceiptType, string> = {
  work_acceptance: 'Työn hyväksyntä',
  delivery_receipt: 'Toimituksen vastaanotto',
  measurement_record: 'Mittauspöytäkirja',
  waybill: 'Rahtikirja',
  material_receipt: 'Materiaalikuittaus',
  other: 'Muu kuittaus',
};

const RECEIPT_TYPES = Object.keys(RECEIPT_TYPE_LABELS) as SiteReceiptType[];

interface ReceiptForm {
  project: string;
  title: string;
  type: SiteReceiptType;
  referenceNumber: string;
  occurredAt: string;
  signerName: string;
  signerRole: string;
  signerCompany: string;
  notes: string;
  confirmed: boolean;
}

function localDateTimeValue(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function emptyForm(): ReceiptForm {
  return {
    project: '',
    title: '',
    type: 'work_acceptance',
    referenceNumber: '',
    occurredAt: localDateTimeValue(),
    signerName: '',
    signerRole: '',
    signerCompany: '',
    notes: '',
    confirmed: false,
  };
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} t`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kt`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mt`;
}

function ReceiptTypeIcon({ type, size = 18 }: { type: SiteReceiptType; size?: number }) {
  const icons = {
    work_acceptance: ClipboardSignature,
    delivery_receipt: Truck,
    measurement_record: Ruler,
    waybill: FileText,
    material_receipt: PackageCheck,
    other: ClipboardCheck,
  } satisfies Record<SiteReceiptType, typeof ClipboardSignature>;
  const Icon = icons[type];
  return <Icon size={size} />;
}

function statusBadge(status: SiteReceiptStatus) {
  if (status === 'signed') {
    return <Badge className="gap-1 border-0 bg-emerald-50 text-emerald-700"><CheckCircle2 size={12} /> Allekirjoitettu</Badge>;
  }
  if (status === 'voided') {
    return <Badge className="gap-1 border-0 bg-red-50 text-red-700"><Ban size={12} /> Mitätöity</Badge>;
  }
  return <Badge className="gap-1 border-0 bg-amber-50 text-amber-700"><Loader2 size={12} /> Luonnos</Badge>;
}

export default function Kuittaukset() {
  const { user } = useAuth();
  const { currentOrg, currentRole } = useOrganization();
  const { projects } = useAppDataContext();
  const { receipts, loading, error, refresh } = useSiteReceipts();
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | SiteReceiptType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | SiteReceiptStatus>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ReceiptForm>(emptyForm);
  const [files, setFiles] = useState<PendingReceiptFile[]>([]);
  const [signature, setSignature] = useState<Blob | null>(null);
  const [signatureKey, setSignatureKey] = useState(0);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [detailReceipt, setDetailReceipt] = useState<SiteReceipt | null>(null);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [voidTarget, setVoidTarget] = useState<SiteReceipt | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const projectNames = useMemo(
    () => [...new Set(projects.map((project) => project.name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fi')),
    [projects],
  );

  const filteredReceipts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return receipts.filter((receipt) => {
      const matchesSearch = !query || [
        receipt.title,
        receipt.project,
        receipt.signerName,
        receipt.signerCompany ?? '',
        receipt.referenceNumber ?? '',
      ].some((value) => value.toLowerCase().includes(query));
      const matchesType = typeFilter === 'all' || receipt.type === typeFilter;
      const matchesStatus = statusFilter === 'all' || receipt.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [receipts, search, statusFilter, typeFilter]);

  const thisMonth = useMemo(() => {
    const now = new Date();
    return receipts.filter((receipt) => {
      const date = new Date(receipt.occurredAt);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    }).length;
  }, [receipts]);

  const canVoid = currentRole === 'admin' || currentRole === 'supervisor';

  const openCreate = () => {
    setForm(emptyForm());
    setFiles([]);
    setSignature(null);
    setSignatureKey((value) => value + 1);
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (selected.length === 0) return;

    const nextErrors: string[] = [];
    const accepted: PendingReceiptFile[] = [];

    selected.forEach((file) => {
      if (!RECEIPT_FILE_TYPES.includes(file.type as (typeof RECEIPT_FILE_TYPES)[number])) {
        nextErrors.push(`${file.name}: vain kuvat ja PDF-tiedostot ovat sallittuja.`);
        return;
      }
      if (file.size > MAX_RECEIPT_FILE_BYTES) {
        nextErrors.push(`${file.name}: tiedosto ylittää 10 Mt kokorajan.`);
        return;
      }
      accepted.push({ file, kind: file.type.startsWith('image/') ? 'photo' : 'document' });
    });

    setFiles((previous) => {
      const available = Math.max(0, MAX_RECEIPT_FILES - previous.length);
      if (accepted.length > available) {
        nextErrors.push(`Kuittaukseen voi lisätä enintään ${MAX_RECEIPT_FILES} liitettä.`);
      }
      return [...previous, ...accepted.slice(0, available)];
    });
    if (nextErrors.length > 0) setFormErrors(nextErrors);
  };

  const removeFile = (index: number) => {
    setFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index));
  };

  const saveReceipt = async () => {
    const nextErrors: string[] = [];
    if (!form.project.trim()) nextErrors.push('Työmaa tai projekti on pakollinen.');
    if (!form.title.trim()) nextErrors.push('Kuittauksen otsikko on pakollinen.');
    if (!form.occurredAt || Number.isNaN(new Date(form.occurredAt).getTime())) {
      nextErrors.push('Tapahtuma-aika on pakollinen.');
    }
    if (!form.signerName.trim()) nextErrors.push('Allekirjoittajan nimi on pakollinen.');
    if (!signature) nextErrors.push('Allekirjoitus puuttuu.');
    if (!form.confirmed) nextErrors.push('Allekirjoittajan vahvistus on hyväksyttävä.');
    setFormErrors(nextErrors);

    if (nextErrors.length > 0 || !currentOrg || !user || !signature) return;

    const project = projects.find((item) => item.name === form.project.trim());
    setSaving(true);
    setOperationError(null);
    try {
      await createSignedSiteReceiptRecord(currentOrg.id, user.id, {
        projectId: project?.id,
        project: form.project.trim(),
        title: form.title.trim(),
        type: form.type,
        referenceNumber: form.referenceNumber.trim() || undefined,
        occurredAt: new Date(form.occurredAt).toISOString(),
        signerName: form.signerName.trim(),
        signerRole: form.signerRole.trim() || undefined,
        signerCompany: form.signerCompany.trim() || undefined,
        notes: form.notes.trim() || undefined,
        signature,
        files,
      });
      await refresh();
      setDialogOpen(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Kuittauksen tallennus epäonnistui.';
      setOperationError(message);
      logger.error('Työmaakuittauksen tallennus epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  const openDetails = async (receipt: SiteReceipt) => {
    setDetailReceipt(receipt);
    setAttachmentUrls({});
    setLoadingAttachments(true);
    setOperationError(null);
    try {
      const resolved = await Promise.all(
        receipt.attachments.map(async (attachment) => [
          attachment.id,
          await createSiteReceiptAttachmentUrl(attachment.storagePath),
        ] as const),
      );
      setAttachmentUrls(Object.fromEntries(resolved));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Liitteiden avaaminen epäonnistui.';
      setOperationError(message);
      logger.error('Työmaakuittauksen liitteiden avaaminen epäonnistui', { error: caught });
    } finally {
      setLoadingAttachments(false);
    }
  };

  const voidReceipt = async () => {
    if (!voidTarget || !currentOrg) return;
    if (voidReason.trim().length < 5) {
      setOperationError('Mitätöinnin perustelun pitää olla vähintään 5 merkkiä.');
      return;
    }
    setSaving(true);
    setOperationError(null);
    try {
      await voidSiteReceiptRecord(currentOrg.id, voidTarget.id, voidReason.trim());
      await refresh();
      if (detailReceipt?.id === voidTarget.id) setDetailReceipt(null);
      setVoidTarget(null);
      setVoidReason('');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Kuittauksen mitätöinti epäonnistui.';
      setOperationError(message);
      logger.error('Työmaakuittauksen mitätöinti epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  const signatureAttachment = detailReceipt?.attachments.find((attachment) => attachment.kind === 'signature');
  const detailAttachments = detailReceipt?.attachments.filter((attachment) => attachment.kind !== 'signature') ?? [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-hero text-text-primary">Työmaakuittaukset</h1>
          <p className="mt-1 text-body-sm text-text-secondary">
            Tallenna allekirjoitetut hyväksynnät, toimitukset, rahtikirjat ja mittauspöytäkirjat.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus size={16} /> Uusi kuittaus</Button>
      </div>

      {(error || operationError) && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{operationError ?? error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Kuittauksia', value: receipts.length, icon: ClipboardSignature },
          { label: 'Tässä kuussa', value: thisMonth, icon: ClipboardCheck },
          { label: 'Allekirjoitettu', value: receipts.filter((item) => item.status === 'signed').length, icon: ShieldCheck },
          { label: 'Mitätöity', value: receipts.filter((item) => item.status === 'voided').length, icon: Ban },
        ].map((item) => (
          <Card key={item.label} className="border-slate-200 shadow-card">
            <CardContent className="p-5">
              <div className="mb-3 flex justify-between"><span className="text-xs uppercase tracking-wider text-text-secondary">{item.label}</span><item.icon size={18} className="text-primary" /></div>
              <p className="font-mono text-3xl font-bold">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_190px]">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hae työmaalla, otsikolla, allekirjoittajalla tai viitteellä…" className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={(value: 'all' | SiteReceiptType) => setTypeFilter(value)}>
          <SelectTrigger><SelectValue placeholder="Kaikki tyypit" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Kaikki tyypit</SelectItem>
            {RECEIPT_TYPES.map((type) => <SelectItem key={type} value={type}>{RECEIPT_TYPE_LABELS[type]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(value: 'all' | SiteReceiptStatus) => setStatusFilter(value)}>
          <SelectTrigger><SelectValue placeholder="Kaikki tilat" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Kaikki tilat</SelectItem>
            <SelectItem value="signed">Allekirjoitettu</SelectItem>
            <SelectItem value="voided">Mitätöity</SelectItem>
            <SelectItem value="draft">Luonnos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {filteredReceipts.map((receipt) => (
          <Card key={receipt.id} className={`border-slate-200 shadow-card ${receipt.status === 'voided' ? 'opacity-70' : ''}`}>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-primary"><ReceiptTypeIcon type={receipt.type} /></div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-text-primary">{receipt.title}</p>
                    <p className="text-sm text-text-secondary">{RECEIPT_TYPE_LABELS[receipt.type]}</p>
                  </div>
                </div>
                {statusBadge(receipt.status)}
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
                <div><p className="text-xs text-text-muted">Työmaa</p><p className="font-medium">{receipt.project}</p></div>
                <div><p className="text-xs text-text-muted">Ajankohta</p><p className="font-medium">{formatDateTime(receipt.occurredAt)}</p></div>
                <div><p className="text-xs text-text-muted">Allekirjoittaja</p><p className="font-medium">{receipt.signerName}</p></div>
                <div><p className="text-xs text-text-muted">Yritys / rooli</p><p className="font-medium">{[receipt.signerCompany, receipt.signerRole].filter(Boolean).join(' · ') || '—'}</p></div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <Paperclip size={14} /> {Math.max(0, receipt.attachments.length - 1)} liitettä
                  {receipt.referenceNumber && <span>· Viite {receipt.referenceNumber}</span>}
                </div>
                <Button variant="outline" size="sm" onClick={() => void openDetails(receipt)} className="gap-1.5"><ExternalLink size={14} /> Avaa</Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {!loading && filteredReceipts.length === 0 && (
          <Card className="lg:col-span-2">
            <CardContent className="p-12 text-center">
              <ClipboardSignature size={46} className="mx-auto mb-3 text-text-muted" />
              <p className="font-semibold">Ei kuittauksia</p>
              <p className="mt-1 text-sm text-text-secondary">Luo ensimmäinen allekirjoitettava työmaakuittaus.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Uusi työmaakuittaus</DialogTitle>
          </DialogHeader>

          {formErrors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formErrors.map((item) => <p key={item}>{item}</p>)}
            </div>
          )}

          <div className="space-y-6">
            <section className="space-y-4">
              <div><h3 className="font-semibold text-text-primary">Kuittauksen tiedot</h3><p className="text-xs text-text-secondary">Mitä kuitataan ja millä työmaalla tapahtuma on ollut.</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="receipt-project">Työmaa tai projekti *</Label>
                  <Input id="receipt-project" list="receipt-projects" value={form.project} onChange={(event) => setForm((previous) => ({ ...previous, project: event.target.value }))} placeholder="Valitse tai kirjoita työmaa" />
                  <datalist id="receipt-projects">{projectNames.map((name) => <option key={name} value={name} />)}</datalist>
                </div>
                <div className="space-y-2">
                  <Label>Kuittaustyyppi *</Label>
                  <Select value={form.type} onValueChange={(value: SiteReceiptType) => setForm((previous) => ({ ...previous, type: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{RECEIPT_TYPES.map((type) => <SelectItem key={type} value={type}>{RECEIPT_TYPE_LABELS[type]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receipt-time">Tapahtuma-aika *</Label>
                  <Input id="receipt-time" type="datetime-local" value={form.occurredAt} onChange={(event) => setForm((previous) => ({ ...previous, occurredAt: event.target.value }))} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="receipt-title">Otsikko *</Label>
                  <Input id="receipt-title" value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))} placeholder="Esim. kylpyhuoneen vedeneristyksen hyväksyntä" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receipt-reference">Viite tai asiakirjan numero</Label>
                  <Input id="receipt-reference" value={form.referenceNumber} onChange={(event) => setForm((previous) => ({ ...previous, referenceNumber: event.target.value }))} placeholder="Rahtikirjan, tilauksen tai mittauksen numero" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="receipt-notes">Kuvaus ja huomautukset</Label>
                  <Textarea id="receipt-notes" rows={3} value={form.notes} onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))} placeholder="Kuvaa hyväksytty työ, vastaanotettu toimitus, määrä tai mahdolliset varaumat." />
                </div>
              </div>
            </section>

            <section className="space-y-4 border-t border-slate-200 pt-5">
              <div><h3 className="font-semibold text-text-primary">Allekirjoittaja</h3><p className="text-xs text-text-secondary">Henkilö, joka vahvistaa työn, toimituksen tai asiakirjan.</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="signer-name">Nimi *</Label><Input id="signer-name" value={form.signerName} onChange={(event) => setForm((previous) => ({ ...previous, signerName: event.target.value }))} /></div>
                <div className="space-y-2"><Label htmlFor="signer-role">Rooli</Label><Input id="signer-role" value={form.signerRole} onChange={(event) => setForm((previous) => ({ ...previous, signerRole: event.target.value }))} placeholder="Mestari, kuljettaja, tilaaja…" /></div>
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="signer-company">Yritys</Label><Input id="signer-company" value={form.signerCompany} onChange={(event) => setForm((previous) => ({ ...previous, signerCompany: event.target.value }))} /></div>
              </div>
            </section>

            <section className="space-y-4 border-t border-slate-200 pt-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div><h3 className="font-semibold text-text-primary">Liitteet</h3><p className="text-xs text-text-secondary">Enintään {MAX_RECEIPT_FILES} kuvaa tai PDF-tiedostoa, 10 Mt / tiedosto.</p></div>
                <div className="flex flex-wrap gap-2">
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={addFiles} />
                  <input ref={fileInputRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={addFiles} />
                  <Button type="button" variant="outline" size="sm" onClick={() => cameraInputRef.current?.click()} className="gap-1.5"><Camera size={15} /> Ota kuva</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5"><Upload size={15} /> Lisää tiedosto</Button>
                </div>
              </div>

              {files.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {files.map(({ file, kind }, index) => (
                    <div key={`${file.name}-${file.size}-${index}`} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-primary">{kind === 'photo' ? <ImageIcon size={18} /> : <FileText size={18} />}</div>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{file.name}</p><p className="text-xs text-text-muted">{formatFileSize(file.size)}</p></div>
                      <button type="button" onClick={() => removeFile(index)} className="rounded-md p-1 text-text-muted hover:bg-white hover:text-danger" aria-label={`Poista ${file.name}`}><X size={16} /></button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4 border-t border-slate-200 pt-5">
              <div><h3 className="font-semibold text-text-primary">Allekirjoitus *</h3><p className="text-xs text-text-secondary">Allekirjoitus lukitsee kuittauksen ja tallentaa tapahtuman tarkastuslokiin.</p></div>
              <SignaturePad key={signatureKey} onChange={setSignature} />
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <input type="checkbox" checked={form.confirmed} onChange={(event) => setForm((previous) => ({ ...previous, confirmed: event.target.checked }))} className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-orange-500" />
                <span>Allekirjoittaja vahvistaa, että yllä olevat tiedot ja liitteet vastaavat kuitattua työtä, toimitusta tai asiakirjaa.</span>
              </label>
            </section>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Peruuta</Button>
            <Button onClick={() => void saveReceipt()} disabled={saving} className="gap-2">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              {saving ? 'Tallennetaan ja lukitaan…' : 'Allekirjoita ja tallenna'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detailReceipt)} onOpenChange={(open) => !open && setDetailReceipt(null)}>
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>{detailReceipt?.title}</DialogTitle></DialogHeader>
          {detailReceipt && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">{statusBadge(detailReceipt.status)}<Badge variant="outline" className="gap-1.5"><ReceiptTypeIcon type={detailReceipt.type} size={14} /> {RECEIPT_TYPE_LABELS[detailReceipt.type]}</Badge></div>

              {detailReceipt.status === 'voided' && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p className="font-semibold">Kuittaus on mitätöity</p><p className="mt-1">{detailReceipt.voidReason}</p>{detailReceipt.voidedAt && <p className="mt-1 text-xs">{formatDateTime(detailReceipt.voidedAt)}</p>}</div>
              )}

              <div className="grid gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
                <div><p className="text-xs text-text-muted">Työmaa</p><p className="font-medium">{detailReceipt.project}</p></div>
                <div><p className="text-xs text-text-muted">Tapahtuma-aika</p><p className="font-medium">{formatDateTime(detailReceipt.occurredAt)}</p></div>
                <div><p className="text-xs text-text-muted">Allekirjoittaja</p><p className="font-medium">{detailReceipt.signerName}</p></div>
                <div><p className="text-xs text-text-muted">Yritys / rooli</p><p className="font-medium">{[detailReceipt.signerCompany, detailReceipt.signerRole].filter(Boolean).join(' · ') || '—'}</p></div>
                <div><p className="text-xs text-text-muted">Viite</p><p className="font-medium">{detailReceipt.referenceNumber || '—'}</p></div>
                <div><p className="text-xs text-text-muted">Tallennettu</p><p className="font-medium">{formatDateTime(detailReceipt.signedAt ?? detailReceipt.createdAt)}</p></div>
              </div>

              {detailReceipt.notes && <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Kuvaus ja huomautukset</p><p className="whitespace-pre-wrap text-sm text-text-primary">{detailReceipt.notes}</p></div>}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Allekirjoitus</p>
                <div className="flex min-h-36 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-2">
                  {loadingAttachments && <Loader2 size={22} className="animate-spin text-text-muted" />}
                  {!loadingAttachments && signatureAttachment && attachmentUrls[signatureAttachment.id] && <img src={attachmentUrls[signatureAttachment.id]} alt={`Allekirjoitus: ${detailReceipt.signerName}`} className="max-h-44 w-full object-contain" />}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Liitteet ({detailAttachments.length})</p>
                {detailAttachments.length === 0 ? <p className="text-sm text-text-secondary">Ei erillisiä liitteitä.</p> : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {detailAttachments.map((attachment) => {
                      const url = attachmentUrls[attachment.id];
                      return (
                        <a key={attachment.id} href={url} target="_blank" rel="noreferrer" className={`group overflow-hidden rounded-lg border border-slate-200 bg-white ${url ? 'hover:border-orange-300' : 'pointer-events-none'}`}>
                          {attachment.kind === 'photo' && url ? <img src={url} alt={attachment.fileName} className="h-40 w-full object-cover" /> : <div className="flex h-28 items-center justify-center bg-slate-50 text-primary">{loadingAttachments ? <Loader2 size={24} className="animate-spin" /> : <FileText size={32} />}</div>}
                          <div className="flex items-center gap-2 p-3"><Paperclip size={14} className="text-text-muted" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{attachment.fileName}</p><p className="text-xs text-text-muted">{formatFileSize(attachment.sizeBytes)}</p></div><ExternalLink size={14} className="text-text-muted group-hover:text-primary" /></div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            {detailReceipt?.status === 'signed' && canVoid && <Button variant="destructive" onClick={() => { setVoidTarget(detailReceipt); setVoidReason(''); }} className="gap-1.5"><Ban size={15} /> Mitätöi</Button>}
            <Button variant="outline" onClick={() => setDetailReceipt(null)}>Sulje</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(voidTarget)} onOpenChange={(open) => !open && setVoidTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mitätöi kuittaus</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">Allekirjoitettua kuittausta ei poisteta. Se merkitään mitätöidyksi ja perustelu jää pysyvästi näkyviin.</p>
            <div className="space-y-2"><Label htmlFor="void-reason">Perustelu *</Label><Textarea id="void-reason" rows={4} value={voidReason} onChange={(event) => setVoidReason(event.target.value)} placeholder="Kerro miksi kuittaus mitätöidään." /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setVoidTarget(null)} disabled={saving}>Peruuta</Button><Button variant="destructive" onClick={() => void voidReceipt()} disabled={saving}>{saving ? 'Mitätöidään…' : 'Mitätöi kuittaus'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
