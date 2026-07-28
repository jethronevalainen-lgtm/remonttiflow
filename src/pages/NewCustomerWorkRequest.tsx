import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Save,
  Send,
  Trash2,
  UploadCloud,
  UserRound,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import {
  ACCESS_METHOD_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  DEADLINE_FLEXIBILITY_OPTIONS,
  emptyProjectRequestForm,
  OCCUPANCY_OPTIONS,
  PROJECT_REQUEST_TYPES,
  projectRequestLocationLabel,
  validateProjectRequestStep,
  YES_NO_UNKNOWN_OPTIONS,
  type ProjectRequestFormValues,
} from '@/lib/projectRequestIntake';
import { loadPortalAccounts, type CustomerPortalAccountV2 } from '@/lib/supabase/customerPortalData';
import {
  createProjectRequestAttachmentUrl,
  createProjectRequestDraft,
  deleteProjectRequestAttachment,
  loadProjectRequests,
  projectRequestToForm,
  saveProjectRequestDraft,
  submitProjectRequest,
  updateProjectRequestAttachmentDescription,
  uploadProjectRequestAttachments,
  type ProjectRequestAttachment,
} from '@/lib/supabase/projectRequests';

const STEPS = [
  { title: 'Kohde ja työ', icon: Building2 },
  { title: 'Aikataulu ja pääsy', icon: CalendarDays },
  { title: 'Kuvat ja asiakirjat', icon: Paperclip },
  { title: 'Yhteenveto', icon: CheckCircle2 },
] as const;

interface UploadState {
  id: string;
  name: string;
  status: 'uploading' | 'complete' | 'error';
  error?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} t`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kt`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mt`;
}

function dateLabel(value: string): string {
  if (!value) return 'Ei määritetty';
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

function attachmentIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return ImageIcon;
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType === 'text/csv') return FileSpreadsheet;
  return FileText;
}

export default function NewCustomerWorkRequest() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentOrg } = useOrganization();
  const { effectiveDisplayName, isPreviewing } = useViewAs();
  const draftParam = searchParams.get('draft') || '';
  const customerParam = searchParams.get('customer') || '';

  const [accounts, setAccounts] = useState<CustomerPortalAccountV2[]>([]);
  const [form, setForm] = useState<ProjectRequestFormValues>(() => emptyProjectRequestForm(customerParam, effectiveDisplayName));
  const [attachments, setAttachments] = useState<ProjectRequestAttachment[]>([]);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [draftId, setDraftId] = useState(draftParam);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const changeVersion = useRef(0);
  const creatingDraft = useRef<Promise<string> | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!currentOrg) return;
      setLoading(true);
      try {
        const nextAccounts = await loadPortalAccounts(currentOrg.id, null);
        if (!active) return;
        setAccounts(nextAccounts);
        const resolvedCustomerId = customerParam && nextAccounts.some((item) => item.customerId === customerParam)
          ? customerParam
          : nextAccounts[0]?.customerId ?? '';

        if (draftParam) {
          const requests = await loadProjectRequests(currentOrg.id);
          const draft = requests.find((item) => item.id === draftParam);
          if (!draft || !['Luonnos', 'Lisätietoja pyydetty'].includes(draft.status)) {
            throw new Error('Muokattavaa luonnosta ei löytynyt tai työpyyntö on jo lähetetty.');
          }
          if (!active) return;
          setDraftId(draft.id);
          setForm(projectRequestToForm(draft));
          setAttachments(draft.attachments);
          setMessage(draft.status === 'Lisätietoja pyydetty' && draft.managementNote
            ? `Työnjohto pyysi täydennystä: ${draft.managementNote}`
            : null);
        } else {
          setForm((current) => ({
            ...current,
            customerId: current.customerId || resolvedCustomerId,
            contactName: current.contactName || effectiveDisplayName,
          }));
        }
        setErrors([]);
      } catch (caught) {
        setErrors([caught instanceof Error ? caught.message : 'Työpyynnön avaaminen epäonnistui.']);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [currentOrg, customerParam, draftParam, effectiveDisplayName]);

  useEffect(() => {
    let active = true;
    const createUrls = async () => {
      const missing = attachments.filter((item) => item.mimeType.startsWith('image/') && !attachmentUrls[item.id]);
      if (missing.length === 0) return;
      const resolved = await Promise.all(missing.map(async (attachment) => {
        try {
          return [attachment.id, await createProjectRequestAttachmentUrl(attachment.storagePath)] as const;
        } catch {
          return null;
        }
      }));
      if (!active) return;
      setAttachmentUrls((current) => ({
        ...current,
        ...Object.fromEntries(resolved.filter((item): item is readonly [string, string] => item !== null)),
      }));
    };
    void createUrls();
    return () => { active = false; };
  }, [attachments, attachmentUrls]);

  const updateForm = useCallback(<K extends keyof ProjectRequestFormValues,>(key: K, value: ProjectRequestFormValues[K]) => {
    changeVersion.current += 1;
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setSaveStatus('idle');
    setErrors([]);
  }, []);

  const ensureDraft = useCallback(async (): Promise<string> => {
    if (draftId) return draftId;
    if (!currentOrg || !form.customerId) throw new Error('Valitse tilaaja-asiakkuus ennen tallentamista.');
    if (!creatingDraft.current) {
      creatingDraft.current = createProjectRequestDraft(currentOrg.id, form.customerId)
        .then((id) => {
          setDraftId(id);
          window.history.replaceState(null, '', `/tilaajan-tyot/uusi?draft=${id}`);
          return id;
        })
        .finally(() => { creatingDraft.current = null; });
    }
    return creatingDraft.current;
  }, [currentOrg, draftId, form.customerId]);

  const saveDraftNow = useCallback(async (showMessage = false): Promise<string> => {
    if (isPreviewing) throw new Error('Esikatselutilassa ei voi tallentaa työpyyntöä.');
    const versionAtStart = changeVersion.current;
    setSaving(true);
    setSaveStatus('saving');
    try {
      const id = await ensureDraft();
      await saveProjectRequestDraft(id, form);
      if (changeVersion.current === versionAtStart) setDirty(false);
      setSaveStatus('saved');
      if (showMessage) setMessage('Luonnos tallennettiin. Voit jatkaa sitä myöhemmin tilaajan työtilasta.');
      return id;
    } catch (caught) {
      setSaveStatus('error');
      const errorMessage = caught instanceof Error ? caught.message : 'Luonnoksen tallennus epäonnistui.';
      setErrors([errorMessage]);
      throw caught;
    } finally {
      setSaving(false);
    }
  }, [ensureDraft, form, isPreviewing]);

  useEffect(() => {
    if (!dirty || loading || isPreviewing) return;
    const timer = window.setTimeout(() => { void saveDraftNow(false).catch(() => undefined); }, 1400);
    return () => window.clearTimeout(timer);
  }, [dirty, form, isPreviewing, loading, saveDraftNow]);

  const currentErrors = useMemo(() => validateProjectRequestStep(form, step), [form, step]);
  const fullErrors = useMemo(() => validateProjectRequestStep(form, 3), [form]);
  const locationSummary = useMemo(() => projectRequestLocationLabel(form), [form]);
  const attachmentTotal = useMemo(() => attachments.reduce((sum, item) => sum + item.sizeBytes, 0), [attachments]);

  const nextStep = () => {
    if (currentErrors.length > 0 && step !== 2) {
      setErrors(currentErrors);
      return;
    }
    setErrors([]);
    setStep((current) => Math.min(3, current + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const previousStep = () => {
    setErrors([]);
    setStep((current) => Math.max(0, current - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    if (attachments.length + files.length > 20) {
      setErrors(['Työpyyntöön voi lisätä enintään 20 liitettä.']);
      return;
    }
    if (attachmentTotal + files.reduce((sum, file) => sum + file.size, 0) > 100 * 1024 * 1024) {
      setErrors(['Työpyynnön liitteiden yhteiskoko voi olla enintään 100 Mt.']);
      return;
    }

    setErrors([]);
    try {
      const id = await saveDraftNow(false);
      const uploaded = await uploadProjectRequestAttachments({
        organizationId: currentOrg?.id ?? '',
        requestId: id,
        files,
        onFileState: (file, status, error) => {
          const uploadId = `${file.name}-${file.lastModified}`;
          setUploads((current) => {
            const next = current.filter((item) => item.id !== uploadId);
            return [...next, { id: uploadId, name: file.name, status, error }];
          });
        },
      });
      setAttachments((current) => [...current, ...uploaded]);
      setUploads((current) => current.filter((item) => item.status !== 'complete'));
      setMessage(`${uploaded.length} liitettä lisättiin työpyyntöön.`);
    } catch (caught) {
      setErrors([caught instanceof Error ? caught.message : 'Liitteiden lataus epäonnistui.']);
    }
  };

  const removeAttachment = async (attachment: ProjectRequestAttachment) => {
    try {
      await deleteProjectRequestAttachment(attachment.id);
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
      setAttachmentUrls((current) => {
        const next = { ...current };
        delete next[attachment.id];
        return next;
      });
    } catch (caught) {
      setErrors([caught instanceof Error ? caught.message : 'Liitteen poisto epäonnistui.']);
    }
  };

  const saveAttachmentDescription = async (attachment: ProjectRequestAttachment) => {
    try {
      await updateProjectRequestAttachmentDescription(attachment.id, attachment.description);
    } catch (caught) {
      setErrors([caught instanceof Error ? caught.message : 'Liitteen kuvauksen tallennus epäonnistui.']);
    }
  };

  const openAttachment = async (attachment: ProjectRequestAttachment) => {
    try {
      const url = attachmentUrls[attachment.id] || await createProjectRequestAttachmentUrl(attachment.storagePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (caught) {
      setErrors([caught instanceof Error ? caught.message : 'Liitteen avaaminen epäonnistui.']);
    }
  };

  const sendRequest = async () => {
    if (fullErrors.length > 0) {
      setErrors(fullErrors);
      const firstError = validateProjectRequestStep(form, 0).length > 0 ? 0 : 1;
      setStep(firstError);
      return;
    }
    setSubmitting(true);
    setErrors([]);
    try {
      const id = await saveDraftNow(false);
      await submitProjectRequest(id);
      navigate('/tilaajan-tyot', { replace: true, state: { workRequestSent: true } });
    } catch (caught) {
      setErrors([caught instanceof Error ? caught.message : 'Työpyynnön lähetys epäonnistui.']);
    } finally {
      setSubmitting(false);
    }
  };

  if (isPreviewing) {
    return (
      <Card className="mx-auto max-w-2xl border-amber-200 bg-amber-50">
        <CardContent className="p-8 text-center">
          <h1 className="text-2xl font-bold text-amber-950">Työpyyntöä ei voi luoda esikatselutilassa</h1>
          <p className="mt-2 text-sm text-amber-900">Palaa tilaajan työtilaan tai lopeta käyttäjäesikatselu.</p>
          <Button className="mt-5" onClick={() => navigate('/tilaajan-tyot')}>Palaa työtilaan</Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-teal-700" size={32} /></div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" className="mb-2 -ml-3 gap-2" onClick={() => navigate('/tilaajan-tyot')}>
            <ArrowLeft size={17} /> Tilaajan työtila
          </Button>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Tilaajan työpyyntö</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">{draftId ? 'Muokkaa työpyyntöä' : 'Uusi työpyyntö'}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Anna työnjohdolle kohteen, aikataulun, asumisen, pääsyn ja liitteiden tiedot yhdellä kertaa.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          {saveStatus === 'saving' && <><Loader2 size={15} className="animate-spin" /> Tallennetaan…</>}
          {saveStatus === 'saved' && <><CheckCircle2 size={15} className="text-emerald-600" /> Luonnos tallennettu</>}
          {saveStatus === 'error' && <span className="text-red-600">Tallennus epäonnistui</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {STEPS.map((item, index) => {
          const Icon = item.icon;
          const active = index === step;
          const complete = index < step;
          return (
            <button
              key={item.title}
              type="button"
              onClick={() => { if (index <= step || validateProjectRequestStep(form, step).length === 0) setStep(index); }}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${active
                ? 'border-teal-500 bg-teal-50 text-teal-950'
                : complete
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 bg-white text-slate-500'}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${active ? 'bg-teal-600 text-white' : complete ? 'bg-emerald-600 text-white' : 'bg-slate-100'}`}>
                {complete ? <CheckCircle2 size={18} /> : <Icon size={18} />}
              </span>
              <span><span className="block text-xs font-medium">Vaihe {index + 1}</span><span className="block text-sm font-semibold">{item.title}</span></span>
            </button>
          );
        })}
      </div>

      {message && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">{message}</div>}
      {errors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Tarkista seuraavat tiedot:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul>
        </div>
      )}

      {step === 0 && (
        <Card>
          <CardHeader><CardTitle>Kohde ja työn sisältö</CardTitle></CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Tilaaja-asiakkuus *</Label>
              {accounts.length === 1 ? (
                <div className="rounded-lg border bg-slate-50 px-3 py-2 text-sm font-medium">{accounts[0].customerName}</div>
              ) : (
                <Select value={form.customerId} disabled={Boolean(draftId)} onValueChange={(value) => updateForm('customerId', value)}>
                  <SelectTrigger><SelectValue placeholder="Valitse asiakkuus" /></SelectTrigger>
                  <SelectContent>{accounts.map((account) => <SelectItem key={account.customerId} value={account.customerId}>{account.customerName}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="request-title">Työn otsikko *</Label>
              <Input id="request-title" value={form.title} onChange={(event) => updateForm('title', event.target.value)} placeholder="Esim. A 12 – keittiön uusiminen" maxLength={180} />
            </div>
            <div className="space-y-2">
              <Label>Työn tyyppi *</Label>
              <Select value={form.requestType} onValueChange={(value) => updateForm('requestType', value as ProjectRequestFormValues['requestType'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROJECT_REQUEST_TYPES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-reference">Tilaajan viite</Label>
              <Input id="customer-reference" value={form.customerReference} onChange={(event) => updateForm('customerReference', event.target.value)} placeholder="Tilausnumero, kustannuspaikka tai sopimusviite" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="request-location">Kohteen osoite / sijainti *</Label>
              <Input id="request-location" value={form.location} onChange={(event) => updateForm('location', event.target.value)} placeholder="Katuosoite, postinumero ja paikkakunta" />
            </div>
            <div className="space-y-2"><Label htmlFor="building">Rakennus</Label><Input id="building" value={form.building} onChange={(event) => updateForm('building', event.target.value)} placeholder="Esim. B" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="staircase">Rappu</Label><Input id="staircase" value={form.staircase} onChange={(event) => updateForm('staircase', event.target.value)} placeholder="A" /></div>
              <div className="space-y-2"><Label htmlFor="apartment">Asunto</Label><Input id="apartment" value={form.apartment} onChange={(event) => updateForm('apartment', event.target.value)} placeholder="12" /></div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="request-description">Työn kuvaus *</Label>
              <Textarea
                id="request-description"
                rows={8}
                value={form.description}
                onChange={(event) => updateForm('description', event.target.value)}
                placeholder={'Kuvaa mitä pitää tehdä, mikä on nykyinen tilanne ja millainen lopputulos tarvitaan.\n\nMainitse myös vahingot, kiireellisyys ja muut työn suunnitteluun vaikuttavat tiedot.'}
                maxLength={5000}
              />
              <p className="text-right text-xs text-slate-400">{form.description.length}/5000</p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Aikataulu</CardTitle></CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="start-date">Työ voidaan aloittaa aikaisintaan</Label><Input id="start-date" type="date" value={form.desiredStartDate} onChange={(event) => updateForm('desiredStartDate', event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="end-date">Työn on oltava valmis viimeistään</Label><Input id="end-date" type="date" value={form.desiredEndDate} onChange={(event) => updateForm('desiredEndDate', event.target.value)} /></div>
              <div className="space-y-2"><Label>Onko valmistumispäivä ehdoton?</Label><Select value={form.deadlineFlexibility} onValueChange={(value) => updateForm('deadlineFlexibility', value as ProjectRequestFormValues['deadlineFlexibility'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DEADLINE_FLEXIBILITY_OPTIONS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="deadline-reason">Miksi määräpäivä on tärkeä?</Label><Input id="deadline-reason" value={form.deadlineReason} onChange={(event) => updateForm('deadlineReason', event.target.value)} placeholder="Muutto, sopimuksen alkaminen, luovutus…" /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Asuminen ja sopimustilanne</CardTitle></CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2"><Label>Kohteen käyttötilanne *</Label><Select value={form.occupancyStatus} onValueChange={(value) => updateForm('occupancyStatus', value as ProjectRequestFormValues['occupancyStatus'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{OCCUPANCY_OPTIONS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Onko uusi asukas tulossa?</Label><Select value={form.incomingResidentStatus} onValueChange={(value) => updateForm('incomingResidentStatus', value as ProjectRequestFormValues['incomingResidentStatus'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{YES_NO_UNKNOWN_OPTIONS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
              {(form.occupancyStatus === 'Asuttu' || form.occupancyStatus === 'Tyhjenee ennen työn alkua') && (
                <div className="rounded-xl border bg-slate-50 p-4 sm:col-span-2">
                  <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={form.currentResidentMovingOut} onChange={(event) => updateForm('currentResidentMovingOut', event.target.checked)} className="h-4 w-4 rounded border-slate-300" /> Nykyinen asukas muuttaa pois</label>
                  {form.currentResidentMovingOut && <div className="mt-4 max-w-sm space-y-2"><Label htmlFor="move-out-date">Poismuuttopäivä</Label><Input id="move-out-date" type="date" value={form.currentResidentMoveOutDate} onChange={(event) => updateForm('currentResidentMoveOutDate', event.target.value)} /></div>}
                </div>
              )}
              {form.incomingResidentStatus === 'Kyllä' && <div className="space-y-2"><Label htmlFor="move-in-date">Uuden asukkaan muuttopäivä *</Label><Input id="move-in-date" type="date" value={form.incomingResidentMoveInDate} onChange={(event) => updateForm('incomingResidentMoveInDate', event.target.value)} /></div>}
              <div className="space-y-2"><Label>Uuden sopimuksen tilanne</Label><Select value={form.incomingContractStatus} onValueChange={(value) => updateForm('incomingContractStatus', value as ProjectRequestFormValues['incomingContractStatus'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CONTRACT_STATUS_OPTIONS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Pääsy kohteeseen</CardTitle></CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2"><Label>Pääsytapa {form.occupancyStatus === 'Asuttu' ? '*' : ''}</Label><Select value={form.accessMethod || undefined} onValueChange={(value) => updateForm('accessMethod', value as ProjectRequestFormValues['accessMethod'])}><SelectTrigger><SelectValue placeholder="Valitse pääsytapa" /></SelectTrigger><SelectContent>{ACCESS_METHOD_OPTIONS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="working-hours">Sallitut työajat</Label><Input id="working-hours" value={form.allowedWorkingHours} onChange={(event) => updateForm('allowedWorkingHours', event.target.value)} placeholder="Arkisin 7.00–16.00" /></div>
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="access-notes">Pääsyä koskevat lisätiedot</Label><Textarea id="access-notes" rows={4} value={form.accessNotes} onChange={(event) => updateForm('accessNotes', event.target.value)} placeholder="Avainten nouto, kulkuluvat, hälytykset, pysäköinti tai muut käytännöt" /></div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>Kuvat ja asiakirjat</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <label
              className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-teal-500 hover:bg-teal-50"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); void addFiles(event.dataTransfer.files); }}
            >
              <UploadCloud size={38} className="text-teal-700" />
              <span className="mt-3 font-semibold text-slate-900">Lisää kuvia tai asiakirjoja</span>
              <span className="mt-1 max-w-xl text-sm leading-6 text-slate-500">Pudota tiedostot tähän tai valitse laitteelta. Tuetut muodot: kuvat, PDF, Word, Excel, CSV ja tekstitiedostot.</span>
              <span className="mt-3 text-xs text-slate-400">Enintään 20 tiedostoa · 20 Mt/tiedosto · yhteensä 100 Mt</span>
              <input type="file" multiple className="sr-only" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" onChange={(event) => { if (event.target.files) void addFiles(event.target.files); event.target.value = ''; }} />
            </label>

            {uploads.map((upload) => <div key={upload.id} className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${upload.status === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-blue-200 bg-blue-50 text-blue-900'}`}><Loader2 size={16} className={upload.status === 'uploading' ? 'animate-spin' : ''} /><span className="font-medium">{upload.name}</span><span className="ml-auto">{upload.error || (upload.status === 'uploading' ? 'Ladataan…' : 'Valmis')}</span></div>)}

            {attachments.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {attachments.map((attachment) => {
                  const Icon = attachmentIcon(attachment.mimeType);
                  const imageUrl = attachmentUrls[attachment.id];
                  return (
                    <div key={attachment.id} className="overflow-hidden rounded-xl border bg-white">
                      {imageUrl ? <button type="button" className="block h-44 w-full bg-slate-100" onClick={() => void openAttachment(attachment)}><img src={imageUrl} alt={attachment.description || attachment.fileName} className="h-full w-full object-cover" /></button> : <button type="button" className="flex h-32 w-full items-center justify-center bg-slate-50 text-slate-500" onClick={() => void openAttachment(attachment)}><Icon size={42} /></button>}
                      <div className="space-y-3 p-4">
                        <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{attachment.fileName}</p><p className="text-xs text-slate-500">{formatBytes(attachment.sizeBytes)}</p></div><Button variant="ghost" size="icon" onClick={() => void removeAttachment(attachment)} aria-label="Poista liite"><Trash2 size={16} className="text-red-600" /></Button></div>
                        <div className="space-y-1"><Label htmlFor={`attachment-${attachment.id}`} className="text-xs">Tiedoston kuvaus</Label><Input id={`attachment-${attachment.id}`} value={attachment.description} onChange={(event) => setAttachments((current) => current.map((item) => item.id === attachment.id ? { ...item, description: event.target.value } : item))} onBlur={() => void saveAttachmentDescription(attachment)} placeholder="Esim. Keittiön nykytilanne" maxLength={500} /></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Yhteystiedot</CardTitle></CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-3">
              <div className="space-y-2"><Label htmlFor="contact-name">Tilaajan yhteyshenkilö</Label><Input id="contact-name" value={form.contactName} onChange={(event) => updateForm('contactName', event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="contact-phone">Puhelin</Label><Input id="contact-phone" type="tel" value={form.contactPhone} onChange={(event) => updateForm('contactPhone', event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="contact-email">Sähköposti</Label><Input id="contact-email" type="email" value={form.contactEmail} onChange={(event) => updateForm('contactEmail', event.target.value)} /></div>
              <div className="rounded-xl border bg-slate-50 p-4 sm:col-span-3">
                <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={form.residentContactAllowed} onChange={(event) => updateForm('residentContactAllowed', event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300" /><span><span className="block font-semibold text-slate-900">Työnjohto saa olla suoraan yhteydessä asukkaaseen tai kohteen yhteyshenkilöön</span><span className="mt-1 block text-slate-500">Yhteystiedot näkyvät vain työpyyntöä käsittelevälle organisaatiolle.</span></span></label>
              </div>
              {form.residentContactAllowed && <><div className="space-y-2"><Label htmlFor="resident-name">Asukkaan / kohteen yhteyshenkilö *</Label><Input id="resident-name" value={form.residentContactName} onChange={(event) => updateForm('residentContactName', event.target.value)} /></div><div className="space-y-2"><Label htmlFor="resident-phone">Puhelin</Label><Input id="resident-phone" type="tel" value={form.residentContactPhone} onChange={(event) => updateForm('residentContactPhone', event.target.value)} /></div><div className="space-y-2"><Label htmlFor="resident-email">Sähköposti</Label><Input id="resident-email" type="email" value={form.residentContactEmail} onChange={(event) => updateForm('residentContactEmail', event.target.value)} /></div></>}
              <div className="space-y-2 sm:col-span-3"><Label htmlFor="contact-instructions">Yhteydenottoa koskevat ohjeet</Label><Textarea id="contact-instructions" rows={3} value={form.contactInstructions} onChange={(event) => updateForm('contactInstructions', event.target.value)} placeholder="Sopivat yhteydenottoajat tai muut ohjeet" /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Työpyynnön yhteenveto</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><Badge variant="outline">{form.requestType}</Badge><h2 className="mt-3 text-2xl font-bold text-slate-950">{form.title || 'Työn otsikko puuttuu'}</h2><p className="mt-1 text-sm text-slate-500">{locationSummary || 'Kohde puuttuu'}</p></div><Badge className={form.occupancyStatus === 'Asuttu' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-800'}>{form.occupancyStatus}</Badge></div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{form.description || 'Työn kuvaus puuttuu.'}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Aloitus aikaisintaan</p><p className="mt-1 font-medium">{dateLabel(form.desiredStartDate)}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Valmis viimeistään</p><p className="mt-1 font-medium">{dateLabel(form.desiredEndDate)}</p><p className="text-xs text-slate-500">{form.deadlineFlexibility}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Uusi asukas</p><p className="mt-1 font-medium">{form.incomingResidentStatus}</p><p className="text-xs text-slate-500">{form.incomingResidentMoveInDate ? dateLabel(form.incomingResidentMoveInDate) : form.incomingContractStatus}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Liitteet</p><p className="mt-1 font-medium">{attachments.length} tiedostoa</p><p className="text-xs text-slate-500">{formatBytes(attachmentTotal)}</p></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border p-4"><p className="flex items-center gap-2 text-sm font-semibold"><UserRound size={17} className="text-teal-700" /> Yhteyshenkilö</p><p className="mt-2 text-sm text-slate-600">{form.contactName || 'Ei määritetty'}{form.contactPhone ? ` · ${form.contactPhone}` : ''}{form.contactEmail ? ` · ${form.contactEmail}` : ''}</p></div><div className="rounded-xl border p-4"><p className="text-sm font-semibold">Pääsy kohteeseen</p><p className="mt-2 text-sm text-slate-600">{form.accessMethod || 'Ei määritetty'}{form.allowedWorkingHours ? ` · ${form.allowedWorkingHours}` : ''}</p></div></div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl border bg-white/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void saveDraftNow(true)} disabled={saving || submitting} className="gap-2"><Save size={16} /> Tallenna luonnos</Button>
          {step > 0 && <Button variant="ghost" onClick={previousStep} disabled={saving || submitting} className="gap-2"><ArrowLeft size={16} /> Edellinen</Button>}
        </div>
        {step < 3 ? <Button onClick={nextStep} disabled={saving || submitting} className="gap-2">Seuraava <ArrowRight size={16} /></Button> : <Button onClick={() => void sendRequest()} disabled={saving || submitting || uploads.some((item) => item.status === 'uploading')} className="gap-2 bg-teal-600 hover:bg-teal-700">{submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Lähetä työpyyntö</Button>}
      </div>
    </div>
  );
}
