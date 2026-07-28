import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Download,
  Euro,
  FileText,
  FolderKanban,
  History,
  Loader2,
  MapPin,
  Paperclip,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  UsersRound,
  Wrench,
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
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useProjectWorkspace } from '@/hooks/useProjectWorkspace';
import {
  formatProjectFileSize,
  inferProjectDocumentType,
  PROJECT_DOCUMENT_TYPES,
} from '@/lib/projectDocumentMeta';
import {
  archiveProjectDocument,
  createChangeOrder,
  createProjectDocumentUrl,
  updateChangeOrderStatus,
  uploadProjectDocument,
  type ChangeOrderStatus,
  type ProjectActivityEvent,
} from '@/lib/supabase/projectWorkspace';
import { cn } from '@/lib/utils';

const CHANGE_ORDER_STATUSES: ChangeOrderStatus[] = [
  'Luonnos',
  'Lähetetty',
  'Hyväksytty',
  'Hylätty',
  'Toteutuksessa',
  'Valmis',
];

const WORKSPACE_TABS = new Set(['overview', 'activity', 'documents', 'changes']);

function euro(value: number) {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value);
}

function dateTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

function activityIcon(type: ProjectActivityEvent['eventType']) {
  switch (type) {
    case 'work_order': return ClipboardList;
    case 'time_entry': return Clock3;
    case 'safety': return ShieldCheck;
    case 'diary': return BookOpen;
    case 'document': return FileText;
    case 'change_order': return BriefcaseBusiness;
    default: return History;
  }
}

function statusClass(status: string) {
  if (['Valmis', 'Hyväksytty'].includes(status)) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (['Hylätty'].includes(status)) return 'border-red-200 bg-red-50 text-red-700';
  if (['Toteutuksessa', 'Käynnissä', 'Lähetetty'].includes(status)) return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export default function ProjectWorkspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { currentOrg, currentRole } = useOrganization();
  const { projects, workOrders, timeEntries, safetyItems } = useAppDataContext();
  const workspace = useProjectWorkspace(projectId);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const project = projects.find((item) => item.id === projectId);
  const canManage = currentRole === 'admin' || currentRole === 'supervisor';
  const requestedTab = searchParams.get('tab') ?? 'overview';
  const activeTab = WORKSPACE_TABS.has(requestedTab) ? requestedTab : 'overview';
  const [documentDialog, setDocumentDialog] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentType, setDocumentType] = useState('Muu');
  const [documentDescription, setDocumentDescription] = useState('');
  const [changeDialog, setChangeDialog] = useState(false);
  const [changeNumber, setChangeNumber] = useState('');
  const [changeTitle, setChangeTitle] = useState('');
  const [changeDescription, setChangeDescription] = useState('');
  const [changeStatus, setChangeStatus] = useState<ChangeOrderStatus>('Luonnos');
  const [changeAmount, setChangeAmount] = useState('0');
  const [changeCost, setChangeCost] = useState('0');
  const [changeRequestedAt, setChangeRequestedAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);

  const projectOrders = useMemo(
    () => workOrders.filter((item) => item.projectId === projectId || item.project === project?.name),
    [project?.name, projectId, workOrders],
  );
  const projectHours = useMemo(
    () => timeEntries.filter((item) => item.projectId === projectId || item.project === project?.name),
    [project?.name, projectId, timeEntries],
  );
  const projectSafety = useMemo(
    () => safetyItems.filter((item) => item.projectId === projectId || item.project === project?.name),
    [project?.name, projectId, safetyItems],
  );

  const openDocument = () => {
    setDocumentFile(null);
    setDocumentTitle('');
    setDocumentType('Muu');
    setDocumentDescription('');
    setOperationError(null);
    setDocumentDialog(true);
  };

  const saveDocument = async () => {
    if (!currentOrg || !projectId || !user || !documentFile) {
      setOperationError('Valitse tiedosto ennen tallentamista.');
      return;
    }
    if (!documentTitle.trim()) {
      setOperationError('Dokumentin otsikko on pakollinen.');
      return;
    }
    if (documentFile.size > 25 * 1024 * 1024) {
      setOperationError('Tiedosto ylittää 25 Mt kokorajan.');
      return;
    }
    setSaving(true);
    setOperationError(null);
    try {
      await uploadProjectDocument({
        organizationId: currentOrg.id,
        projectId,
        userId: user.id,
        file: documentFile,
        title: documentTitle,
        documentType,
        description: documentDescription,
      });
      await workspace.refresh();
      setDocumentDialog(false);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Dokumentin tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const showDocument = async (storagePath: string) => {
    setOperationError(null);
    try {
      const url = await createProjectDocumentUrl(storagePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Dokumentin avaaminen epäonnistui.');
    }
  };

  const removeDocument = async (documentId: string) => {
    if (!currentOrg) return;
    setSaving(true);
    setOperationError(null);
    try {
      await archiveProjectDocument(currentOrg.id, documentId);
      await workspace.refresh();
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Dokumentin arkistointi epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const openChange = () => {
    setChangeNumber('');
    setChangeTitle('');
    setChangeDescription('');
    setChangeStatus('Luonnos');
    setChangeAmount('0');
    setChangeCost('0');
    setChangeRequestedAt(new Date().toISOString().slice(0, 10));
    setOperationError(null);
    setChangeDialog(true);
  };

  const saveChange = async () => {
    const amount = Number(changeAmount.replace(',', '.'));
    const cost = Number(changeCost.replace(',', '.'));
    if (!currentOrg || !projectId || !changeTitle.trim()) {
      setOperationError('Muutostyön otsikko on pakollinen.');
      return;
    }
    if (![amount, cost].every((value) => Number.isFinite(value) && value >= 0)) {
      setOperationError('Myynti- ja kustannussummien pitää olla nollaa suurempia tai nolla.');
      return;
    }
    setSaving(true);
    setOperationError(null);
    try {
      await createChangeOrder({
        organizationId: currentOrg.id,
        projectId,
        userId: user?.id,
        changeNumber,
        title: changeTitle,
        description: changeDescription,
        status: changeStatus,
        amountCents: Math.round(amount * 100),
        costCents: Math.round(cost * 100),
        requestedAt: changeRequestedAt,
      });
      await workspace.refresh();
      setChangeDialog(false);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Muutostyön tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const changeState = async (id: string, status: ChangeOrderStatus) => {
    if (!currentOrg) return;
    setSaving(true);
    setOperationError(null);
    try {
      await updateChangeOrderStatus(currentOrg.id, id, status);
      await workspace.refresh();
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Muutostyön päivitys epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  if (!projectId) return null;

  if (!project && !workspace.loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <AlertTriangle size={42} className="mx-auto mb-4 text-amber-600" />
          <h1 className="text-xl font-bold">Projektia ei löytynyt</h1>
          <p className="mt-2 text-sm text-text-secondary">Projekti on poistettu tai sinulla ei ole oikeutta nähdä sitä.</p>
          <Button className="mt-5" onClick={() => navigate('/projektit')}>Takaisin projekteihin</Button>
        </CardContent>
      </Card>
    );
  }

  const summary = workspace.summary;
  const marginCents = (summary?.changeOrderAmountCents ?? 0) - (summary?.changeOrderCostCents ?? 0);

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 sm:space-y-6">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 to-slate-800 text-white shadow-lg">
        <div className="p-5 sm:p-8">
          <Button variant="ghost" className="mb-4 gap-2 text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => navigate('/projektit')}>
            <ArrowLeft size={16} /> Projektit
          </Button>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className="border-slate-600 bg-slate-800 text-slate-100">{project?.status ?? 'Ladataan'}</Badge>
                {project?.location && <span className="flex items-center gap-1 text-sm text-slate-300"><MapPin size={14} />{project.location}</span>}
              </div>
              <h1 className="break-words text-2xl font-bold sm:text-4xl">{project?.name ?? 'Projektityötila'}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{project?.customer}{project?.description ? ` · ${project.description}` : ''}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="border-slate-600 bg-white/5 text-white hover:bg-white/10" onClick={() => void workspace.refresh()} disabled={workspace.refreshing}>
                <RefreshCw size={16} className={workspace.refreshing ? 'mr-2 animate-spin' : 'mr-2'} /> Päivitä
              </Button>
              {canManage && <Button className="bg-orange-500 text-white hover:bg-orange-600" onClick={() => navigate(`/tyomaaraykset?project=${encodeURIComponent(projectId)}&new=1`)}><ClipboardList size={16} className="mr-2" /> Uusi työmääräys</Button>}
              {canManage && <Button className="bg-orange-500 text-white hover:bg-orange-600" onClick={openChange}><Plus size={16} className="mr-2" /> Muutostyö</Button>}
              <Button className="bg-white text-slate-950 hover:bg-slate-100" onClick={openDocument}><Upload size={16} className="mr-2" /> Dokumentti</Button>
            </div>
          </div>
          {project && <div className="mt-6"><div className="mb-2 flex justify-between text-xs text-slate-300"><span>Projektin eteneminen</span><strong>{project.progress}%</strong></div><Progress value={project.progress} className="h-2 bg-slate-700" /></div>}
        </div>
      </div>

      {(workspace.error || operationError) && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />{operationError ?? workspace.error}
        </div>
      )}
      {workspace.loading && <div className="flex items-center gap-2 rounded-xl border bg-white p-4 text-sm text-text-secondary"><Loader2 size={17} className="animate-spin" />Ladataan projektin tilannekuvaa…</div>}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Avoimet työmääräykset', value: summary?.openWorkOrders ?? projectOrders.filter((item) => !['Valmis', 'Peruttu'].includes(item.status)).length, detail: `${projectOrders.length} yhteensä`, icon: Wrench, tone: 'bg-orange-50 text-orange-700' },
          { label: 'Hyväksytyt tunnit', value: `${(summary?.approvedHours ?? projectHours.filter((item) => item.status === 'Hyväksytty').reduce((sum, item) => sum + item.hours + item.overtime, 0)).toFixed(1)} h`, detail: `${(summary?.pendingHours ?? projectHours.filter((item) => item.status === 'Odottaa').reduce((sum, item) => sum + item.hours + item.overtime, 0)).toFixed(1)} h odottaa`, icon: Clock3, tone: 'bg-blue-50 text-blue-700' },
          { label: 'Laatu ja turvallisuus', value: (summary?.openFindings ?? 0) + (summary?.openSafetyItems ?? projectSafety.filter((item) => !['Korjattu', 'Suljettu'].includes(item.status)).length), detail: `${summary?.openFindings ?? 0} tarkastuspuutetta`, icon: ShieldCheck, tone: 'bg-red-50 text-red-700' },
          { label: 'Muutostöiden kate', value: euro(marginCents / 100), detail: `${workspace.changeOrders.length} muutostyötä`, icon: Euro, tone: 'bg-emerald-50 text-emerald-700' },
        ].map((item) => (
          <Card key={item.label} className="border-slate-200 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{item.label}</p><p className="mt-2 break-words font-mono text-2xl font-bold text-slate-950">{item.value}</p><p className="mt-1 text-xs text-slate-500">{item.detail}</p></div>
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', item.tone)}><item.icon size={19} /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const next = new URLSearchParams(searchParams);
          if (value === 'overview') next.delete('tab');
          else next.set('tab', value);
          setSearchParams(next, { replace: true });
        }}
        className="space-y-4"
      >
        <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
          <TabsTrigger value="overview">Tilannekuva</TabsTrigger>
          <TabsTrigger value="activity">Tapahtumat</TabsTrigger>
          <TabsTrigger value="documents">Dokumentit ({workspace.documents.length})</TabsTrigger>
          <TabsTrigger value="changes">Muutostyöt ({workspace.changeOrders.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FolderKanban size={19} /> Projektin perustiedot</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {[
                  ['Asiakas', project?.customer || '—'],
                  ['Sijainti', project?.location || '—'],
                  ['Aloitus', project?.startDate || '—'],
                  ['Valmistuminen', project?.endDate || '—'],
                  ['Budjetti', euro(project?.budget ?? 0)],
                  ['Toteutunut', euro(project?.spent ?? 0)],
                ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 p-4"><p className="text-xs uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-900">{value}</p></div>)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><UsersRound size={19} /> Pikatoiminnot</CardTitle></CardHeader>
              <CardContent className="grid gap-2">
                {[
                  { label: 'Työmääräykset', path: `/tyomaaraykset?project=${encodeURIComponent(projectId)}`, icon: ClipboardList },
                  { label: 'Aikataulu', path: '/aikataulutus', icon: Clock3 },
                  { label: 'Tarkastukset', path: '/tarkastukset', icon: CheckCircle2 },
                  { label: 'Päiväkirjat', path: '/paivakirjat', icon: BookOpen },
                  { label: 'Turvallisuus', path: '/tyoturvallisuus', icon: ShieldCheck },
                  { label: 'Raportit', path: '/raportit', icon: Download },
                ].map((item) => <Button key={item.path} variant="outline" className="justify-start gap-3" onClick={() => navigate(item.path)}><item.icon size={17} />{item.label}</Button>)}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><History size={19} /> Viimeisimmät tapahtumat</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {workspace.activity.slice(0, 8).map((event) => { const Icon = activityIcon(event.eventType); return <div key={`${event.eventType}-${event.id}`} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700"><Icon size={17} /></div><div className="min-w-0 flex-1"><p className="font-medium text-slate-900">{event.title}</p><p className="mt-0.5 text-xs text-slate-500">{event.detail}</p></div><span className="shrink-0 text-xs text-slate-400">{dateTime(event.eventAt)}</span></div>; })}
              {!workspace.loading && workspace.activity.length === 0 && <p className="py-8 text-center text-sm text-text-secondary">Projektilla ei ole vielä tapahtumia.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card><CardHeader><CardTitle>Projektin tapahtumahistoria</CardTitle></CardHeader><CardContent className="space-y-2">{workspace.activity.map((event) => { const Icon = activityIcon(event.eventType); return <div key={`${event.eventType}-${event.id}`} className="flex items-start gap-3 border-b border-slate-100 py-3"><Icon size={18} className="mt-0.5 shrink-0 text-orange-600" /><div className="min-w-0 flex-1"><p className="font-medium">{event.title}</p><p className="text-sm text-text-secondary">{event.detail}</p></div><span className="text-xs text-text-muted">{dateTime(event.eventAt)}</span></div>; })}{!workspace.loading && workspace.activity.length === 0 && <p className="py-10 text-center text-sm text-text-secondary">Ei tapahtumia.</p>}</CardContent></Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <div className="flex justify-end"><Button onClick={openDocument}><Upload size={16} className="mr-2" /> Lisää dokumentti</Button></div>
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {workspace.documents.map((document) => <Card key={document.id}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Paperclip size={18} /></div><Badge variant="outline">{document.documentType}</Badge></div><h3 className="mt-4 break-words font-semibold">{document.title}</h3><p className="mt-1 break-words text-sm text-text-secondary">{document.fileName}</p>{document.description && <p className="mt-2 break-words text-xs text-text-secondary">{document.description}</p>}<div className="mt-4 flex items-center justify-between text-xs text-text-muted"><span>Versio {document.version}</span><span>{formatProjectFileSize(document.sizeBytes)}</span></div><div className="mt-4 flex gap-2"><Button variant="outline" size="sm" className="flex-1" onClick={() => void showDocument(document.storagePath)}><FileText size={14} className="mr-1" /> Avaa</Button>{canManage && <Button variant="ghost" size="sm" className="text-red-600" onClick={() => void removeDocument(document.id)}><Trash2 size={15} /></Button>}</div></CardContent></Card>)}
            {!workspace.loading && workspace.documents.length === 0 && <Card className="lg:col-span-2 xl:col-span-3"><CardContent className="p-12 text-center"><FileText size={44} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold">Ei dokumentteja</p><p className="mt-1 text-sm text-text-secondary">Lisää ensimmäinen projektidokumentti.</p></CardContent></Card>}
          </div>
        </TabsContent>

        <TabsContent value="changes" className="space-y-4">
          {canManage && <div className="flex justify-end"><Button onClick={openChange}><Plus size={16} className="mr-2" /> Uusi muutostyö</Button></div>}
          <Card><CardContent className="p-0"><div className="hidden grid-cols-[120px_1.3fr_140px_140px_170px] gap-3 border-b bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 lg:grid"><span>Tunnus</span><span>Muutostyö</span><span>Myynti</span><span>Kustannus</span><span>Tila</span></div>{workspace.changeOrders.map((change) => <div key={change.id} className="grid gap-3 border-b border-slate-100 px-5 py-4 lg:grid-cols-[120px_1.3fr_140px_140px_170px] lg:items-center"><span className="font-mono text-sm">{change.changeNumber || '—'}</span><div><p className="font-semibold">{change.title}</p><p className="line-clamp-1 text-xs text-text-secondary">{change.description || 'Ei lisätietoja'}</p></div><span className="font-mono text-sm">{euro(change.amountCents / 100)}</span><span className="font-mono text-sm">{euro(change.costCents / 100)}</span><div>{canManage ? <Select value={change.status} onValueChange={(value: ChangeOrderStatus) => void changeState(change.id, value)} disabled={saving}><SelectTrigger className={cn('h-9', statusClass(change.status))}><SelectValue /></SelectTrigger><SelectContent>{CHANGE_ORDER_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select> : <Badge variant="outline" className={statusClass(change.status)}>{change.status}</Badge>}</div></div>)}{!workspace.loading && workspace.changeOrders.length === 0 && <div className="p-12 text-center"><BriefcaseBusiness size={44} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold">Ei muutostöitä</p></div>}</CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={documentDialog} onOpenChange={setDocumentDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Lisää projektidokumentti</DialogTitle></DialogHeader>
          <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.xlsm,.csv,.ods,.txt,.zip" className="hidden" onChange={(event) => { const file = event.target.files?.[0] ?? null; setDocumentFile(file); if (file) { if (!documentTitle) setDocumentTitle(file.name.replace(/\.[^.]+$/, '')); setDocumentType(inferProjectDocumentType(file.name, file.type)); } }} />
          <div className="space-y-4">
            <Button type="button" variant="outline" className="h-auto min-h-20 w-full whitespace-normal border-dashed" onClick={() => fileInputRef.current?.click()}><Upload size={20} className="mr-2 shrink-0" /><span className="break-words text-left">{documentFile ? `${documentFile.name} · ${formatProjectFileSize(documentFile.size)}` : 'Valitse enintään 25 Mt tiedosto'}</span></Button>
            <div className="space-y-2"><Label htmlFor="document-title">Otsikko *</Label><Input id="document-title" value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} /></div>
            <div className="space-y-2"><Label>Tyyppi</Label><Select value={documentType} onValueChange={setDocumentType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PROJECT_DOCUMENT_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="document-description">Kuvaus</Label><Textarea id="document-description" value={documentDescription} onChange={(event) => setDocumentDescription(event.target.value)} rows={3} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDocumentDialog(false)}>Peruuta</Button><Button onClick={() => void saveDocument()} disabled={saving || !documentFile}>{saving ? 'Tallennetaan…' : 'Tallenna dokumentti'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={changeDialog} onOpenChange={setChangeDialog}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Uusi muutostyö</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="change-number">Tunnus</Label><Input id="change-number" value={changeNumber} onChange={(event) => setChangeNumber(event.target.value)} placeholder="MT-001" /></div>
            <div className="space-y-2"><Label>Tila</Label><Select value={changeStatus} onValueChange={(value: ChangeOrderStatus) => setChangeStatus(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CHANGE_ORDER_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="change-title">Otsikko *</Label><Input id="change-title" value={changeTitle} onChange={(event) => setChangeTitle(event.target.value)} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="change-description">Kuvaus</Label><Textarea id="change-description" value={changeDescription} onChange={(event) => setChangeDescription(event.target.value)} rows={4} /></div>
            <div className="space-y-2"><Label htmlFor="change-amount">Myyntihinta €</Label><Input id="change-amount" inputMode="decimal" value={changeAmount} onChange={(event) => setChangeAmount(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="change-cost">Arvioitu kustannus €</Label><Input id="change-cost" inputMode="decimal" value={changeCost} onChange={(event) => setChangeCost(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="change-requested">Pyydetty</Label><Input id="change-requested" type="date" value={changeRequestedAt} onChange={(event) => setChangeRequestedAt(event.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setChangeDialog(false)}>Peruuta</Button><Button onClick={() => void saveChange()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna muutostyö'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
