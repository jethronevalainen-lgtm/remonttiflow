import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle, Camera, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck,
  FileUp, Image as ImageIcon, Loader2, ShieldCheck, Signature,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useInspectionDetail } from '@/hooks/useInspectionData';
import {
  approveInspection, createAttachmentUrl, createInspectionFinding, downloadInspectionAttachment,
  saveInspectionResult, uploadInspectionAttachment, voidInspection,
  type InspectionAttachment, type InspectionResultDetail, type InspectionResultStatus, type ProjectUnit,
} from '@/lib/supabase/inspectionEntities';
import { addHandwrittenInspectionSignature } from '@/lib/supabase/inspectionSignatures';
import { cn } from '@/lib/utils';
import type { Project } from '@/types';
import InspectionActionsMenu from './InspectionActionsMenu';
import { ApprovalDialog, FindingDialog, SignatureDialog, VoidDialog, type FindingDraft } from './InspectionDialogs';
import GuidedInspectionRunner from './GuidedInspectionRunner';
import InspectionSectionCard from './InspectionSectionCard';
import {
  BLOCKING_SEVERITIES, findingStatusClasses, formatDate, formatDateTime,
  inspectionStatusClasses, isFindingOpen, personName, projectName, severityClasses, unitLabel,
} from './inspectionUi';

type DetailTab = 'summary' | 'inspection' | 'findings' | 'attachments' | 'approval';

interface Props {
  inspectionId: string;
  canManage: boolean;
  currentRole: string | null;
  organizationId: string;
  userId?: string;
  projects: Project[];
  units: ProjectUnit[];
  people: Array<{ userId: string; name: string; email: string }>;
  onBack: () => void;
  onWorkspaceRefresh: () => Promise<unknown>;
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-slate-100 py-3 last:border-b-0 sm:border-b-0 sm:py-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-text-primary">{value || '—'}</p>
    </div>
  );
}

function RequirementCard({
  title,
  detail,
  complete,
  onClick,
}: {
  title: string;
  detail: string;
  complete: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={cn(
      'flex w-full items-start gap-3 rounded-xl border p-4 text-left transition hover:shadow-sm',
      complete ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60',
    )}>
      <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', complete ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-800')}>
        {complete ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
      </span>
      <span className="min-w-0"><span className="block font-semibold text-text-primary">{title}</span><span className="mt-1 block text-xs leading-relaxed text-text-secondary">{detail}</span></span>
    </button>
  );
}

function AttachmentPreview({ attachment, onOpen }: { attachment: InspectionAttachment; onOpen: (path: string) => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setPreviewUrl(null);
    setPreviewState('loading');
    if (!attachment.mimeType.startsWith('image/')) {
      setPreviewState('error');
      return () => { active = false; };
    }
    void downloadInspectionAttachment(attachment.objectPath)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
        setPreviewState('ready');
      })
      .catch(() => {
        if (!active) return;
        setPreviewState('error');
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.mimeType, attachment.objectPath]);

  return (
    <button type="button" onClick={() => onOpen(attachment.objectPath)} className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-primary/40 hover:shadow-sm">
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-slate-100">
        {previewState === 'loading' && <Loader2 size={26} className="animate-spin text-slate-400" />}
        {previewState === 'ready' && previewUrl && <img src={previewUrl} alt={attachment.caption || attachment.fileName} className="h-full w-full object-cover transition group-hover:scale-[1.02]" onError={() => setPreviewState('error')} />}
        {previewState === 'error' && <div className="flex flex-col items-center gap-2 px-3 text-center text-xs text-slate-500"><ImageIcon size={28} className="text-slate-400" /><span>Avaa tiedosto napsauttamalla.</span></div>}
      </div>
      <div className="p-3"><p className="text-xs font-semibold text-primary">{attachment.kind}</p><p className="mt-1 break-words text-sm font-medium">{attachment.fileName}</p><p className="mt-1 text-xs text-text-muted">{formatDateTime(attachment.createdAt)}</p></div>
    </button>
  );
}

const uploadLabelClasses = 'inline-flex min-h-10 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground';

export default function InspectionDetailView({
  inspectionId, canManage, currentRole, organizationId, userId,
  projects, units, people, onBack, onWorkspaceRefresh,
}: Props) {
  const { detail, loading, error, refresh } = useInspectionDetail(inspectionId);
  const [tab, setTab] = useState<DetailTab>('summary');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [findingResult, setFindingResult] = useState<InspectionResultDetail | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);

  useEffect(() => {
    if (detail) setComments(Object.fromEntries(detail.results.map((result) => [result.id, result.comment])));
  }, [detail]);

  const sections = useMemo(() => {
    if (!detail) return [];
    const grouped = detail.results.reduce<Record<string, InspectionResultDetail[]>>((result, item) => {
      (result[item.sectionId] ??= []).push(item);
      return result;
    }, {});
    return Object.values(grouped).sort((a, b) => a[0].sectionOrder - b[0].sectionOrder);
  }, [detail]);

  const refreshAll = async () => { await Promise.all([refresh(), onWorkspaceRefresh()]); };
  const fail = (caught: unknown, fallback: string) => setOperationError(caught instanceof Error ? caught.message : fallback);

  const saveStatus = async (result: InspectionResultDetail, status: InspectionResultStatus) => {
    if (!canManage) return;
    if (status === 'Puute') {
      setFindingResult({ ...result, comment: comments[result.id] ?? result.comment });
      return;
    }
    setSavingKey(result.id);
    setOperationError(null);
    try {
      const savedOnline = await saveInspectionResult({ inspectionId, itemId: result.itemId, status, comment: comments[result.id], measurementValue: result.measurementValue, measurementUnit: result.measurementUnit });
      if (savedOnline) await refreshAll();
    } catch (caught) {
      fail(caught, 'Tarkastuskohdan tallennus epäonnistui.');
    } finally {
      setSavingKey(null);
    }
  };

  const saveComment = async (result: InspectionResultDetail) => {
    setSavingKey(`comment-${result.id}`);
    setOperationError(null);
    try {
      const savedOnline = await saveInspectionResult({ inspectionId, itemId: result.itemId, status: result.status, comment: comments[result.id], measurementValue: result.measurementValue, measurementUnit: result.measurementUnit });
      if (savedOnline) await refreshAll();
    } catch (caught) {
      fail(caught, 'Kommentin tallennus epäonnistui.');
    } finally {
      setSavingKey(null);
    }
  };

  const markSectionOkay = async (results: InspectionResultDetail[]) => {
    const uncheckedResults = results.filter((result) => result.status === 'Tarkastamatta');
    if (!uncheckedResults.length) return;
    setSavingKey(`section-${results[0]?.sectionId ?? ''}`);
    setOperationError(null);
    try {
      const outcomes = await Promise.all(uncheckedResults.map((result) => saveInspectionResult({
        inspectionId,
        itemId: result.itemId,
        status: 'Kunnossa',
        comment: comments[result.id],
        measurementValue: result.measurementValue,
        measurementUnit: result.measurementUnit,
      })));
      if (outcomes.every(Boolean)) await refreshAll();
    } catch (caught) {
      fail(caught, 'Osion tallennus epäonnistui.');
    } finally {
      setSavingKey(null);
    }
  };

  const submitFinding = async (draft: FindingDraft) => {
    if (!findingResult) return;
    setSavingKey('finding');
    setOperationError(null);
    try {
      await createInspectionFinding({ inspectionId, resultId: findingResult.id, ...draft });
      setFindingResult(null);
      await refreshAll();
    } catch (caught) {
      fail(caught, 'Puutteen tallennus epäonnistui.');
    } finally {
      setSavingKey(null);
    }
  };

  const uploadResult = async (event: ChangeEvent<HTMLInputElement>, result: InspectionResultDetail) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !userId) return;
    setSavingKey(`upload-${result.id}`);
    setOperationError(null);
    try {
      const savedOnline = await uploadInspectionAttachment({ organizationId, inspectionId, resultId: result.id, file, kind: result.status === 'Puute' ? 'Puutekuva' : 'Yleiskuva', userId });
      if (savedOnline) await refreshAll();
    } catch (caught) {
      fail(caught, 'Liitteen lähetys epäonnistui.');
    } finally {
      setSavingKey(null);
    }
  };

  const uploadInspectionFile = async (event: ChangeEvent<HTMLInputElement>, kind: 'Luovutuskuva' | 'Yleiskuva' | 'Asiakirja') => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !userId) return;
    setSavingKey(`inspection-upload-${kind}`);
    setOperationError(null);
    try {
      const savedOnline = await uploadInspectionAttachment({ organizationId, inspectionId, file, kind, userId });
      if (savedOnline) await refreshAll();
    } catch (caught) {
      fail(caught, 'Tarkastuksen liitteen lähetys epäonnistui.');
    } finally {
      setSavingKey(null);
    }
  };

  const openAttachment = async (path: string) => {
    try {
      window.open(await createAttachmentUrl(path), '_blank', 'noopener,noreferrer');
    } catch (caught) {
      fail(caught, 'Liitteen avaaminen epäonnistui.');
    }
  };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (error || !detail) return <div className="space-y-4"><Button variant="ghost" onClick={onBack}><ChevronLeft size={16} className="mr-1" />Takaisin</Button><Card className="border-red-200"><CardContent className="p-6 text-red-700">{error ?? 'Tarkastusta ei löytynyt.'}</CardContent></Card></div>;

  const project = projects.find((item) => item.id === detail.inspection.projectId);
  const unit = units.find((item) => item.id === detail.inspection.unitId);
  const inspectionAttachments = detail.attachments.filter((attachment) => !attachment.resultId && !attachment.findingId);
  const openFindings = detail.findings.filter(isFindingOpen);
  const blockingFindings = openFindings.filter((finding) => BLOCKING_SEVERITIES.includes(finding.severity));
  const locked = ['Hyväksytty', 'Mitätöity'].includes(detail.inspection.status);
  const completedResults = detail.results.filter((result) => result.status !== 'Tarkastamatta').length;
  const inspectionComplete = detail.inspection.progress === 100;
  const hasHandoverPhoto = inspectionAttachments.some((attachment) => ['Luovutuskuva', 'Yleiskuva'].includes(attachment.kind) && attachment.mimeType.startsWith('image/'));
  const hasHandwrittenSignature = detail.signatures.some((signature) => Boolean(signature.signatureData));
  const findingsReady = inspectionComplete && blockingFindings.length === 0;
  const preSignatureBlockers = [
    !inspectionComplete ? 'Käsittele kaikki tarkastuskohdat.' : null,
    blockingFindings.length > 0 ? `Sulje ${blockingFindings.length} luovutuksen estävää puutetta.` : null,
    !hasHandoverPhoto ? 'Lisää vähintään yksi luovutus- tai yleiskuva.' : null,
  ].filter((item): item is string => Boolean(item));
  const approvalBlockers = [...preSignatureBlockers, !hasHandwrittenSignature ? 'Allekirjoita tarkastus.' : null].filter((item): item is string => Boolean(item));
  const signatureReady = canManage && !locked && preSignatureBlockers.length === 0;
  const canApprove = canManage && !locked && approvalBlockers.length === 0;
  const nextAction = !inspectionComplete
    ? { label: 'Jatka tarkastusta', detail: `${completedResults}/${detail.results.length} tarkastuskohtaa käsitelty`, tab: 'inspection' as DetailTab }
    : blockingFindings.length > 0
      ? { label: 'Käsittele puutteet', detail: `${blockingFindings.length} puutetta estää luovutuksen`, tab: 'findings' as DetailTab }
      : !hasHandoverPhoto
        ? { label: 'Lisää luovutuskuva', detail: 'Dokumentoi valmis kohde', tab: 'attachments' as DetailTab }
        : !hasHandwrittenSignature
          ? { label: 'Allekirjoita tarkastus', detail: 'Allekirjoitus puuttuu', tab: 'approval' as DetailTab }
          : { label: 'Hyväksy tarkastus', detail: 'Kaikki vaatimukset täyttyvät', tab: 'approval' as DetailTab };

  return (
    <div className="space-y-4 print:space-y-3">
      <div className="sticky top-0 z-20 -mx-2 flex flex-col gap-3 border-b bg-background/95 px-2 py-3 backdrop-blur print:static print:border-0 print:bg-white sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={onBack} className="w-fit print:hidden"><ChevronLeft size={17} className="mr-1" />Kaikki tarkastukset</Button>
        <div className="flex items-center gap-2 print:hidden">
          {!locked && canManage && <Button onClick={() => setTab(nextAction.tab)}><ClipboardCheck size={16} className="mr-2" />{nextAction.label}</Button>}
          <InspectionActionsMenu
            inspectionId={inspectionId}
            title={detail.inspection.title}
            status={detail.inspection.status}
            canManage={canManage}
            onPrint={() => window.print()}
            onVoid={currentRole === 'admin' && detail.inspection.status === 'Hyväksytty' ? () => setVoidOpen(true) : undefined}
            onRemoved={async () => { await onWorkspaceRefresh(); onBack(); }}
          />
        </div>
      </div>

      {operationError && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 print:hidden"><AlertTriangle size={17} className="mt-0.5 shrink-0" />{operationError}</div>}

      <Card className="overflow-hidden print:border-0 print:shadow-none">
        <CardContent className="p-5 sm:p-6 print:p-0">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge className={cn('border-0', inspectionStatusClasses(detail.inspection.status))}>{detail.inspection.status}</Badge>
                <Badge variant="outline">{detail.inspection.reportVersion ? `Raportti v${detail.inspection.reportVersion}` : 'Raporttia ei muodostettu'}</Badge>
              </div>
              <h1 className="text-2xl font-bold sm:text-3xl">{detail.inspection.title}</h1>
              <p className="mt-1 text-sm text-text-secondary">{projectName(projects, detail.inspection.projectId)} · {unitLabel(units, detail.inspection.unitId)} · {detail.inspection.inspectionType}</p>
            </div>
            <div className="w-full rounded-xl border border-slate-200 bg-slate-50/70 p-4 lg:w-80">
              <div className="mb-2 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Tarkastuskohdat</p><p className="mt-1 text-sm text-text-secondary">{completedResults}/{detail.results.length} käsitelty</p></div><strong className="text-2xl">{detail.inspection.progress}%</strong></div>
              <Progress value={detail.inspection.progress} />
              <p className="mt-2 text-xs text-text-secondary">Valmistumisprosentti ei tarkoita hyväksyntää. Hyväksyntä näkyy erillisenä tilana.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(value) => setTab(value as DetailTab)}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-1 print:hidden sm:grid-cols-5">
          <TabsTrigger value="summary" className="whitespace-normal">Yhteenveto</TabsTrigger>
          <TabsTrigger value="inspection" className="whitespace-normal">Tarkastus <span className="ml-1 text-xs text-text-muted">{completedResults}/{detail.results.length}</span></TabsTrigger>
          <TabsTrigger value="findings" className="whitespace-normal">Puutteet <span className="ml-1 text-xs text-text-muted">{openFindings.length}</span></TabsTrigger>
          <TabsTrigger value="attachments" className="whitespace-normal">Kuvat ja liitteet</TabsTrigger>
          <TabsTrigger value="approval" className="whitespace-normal">Hyväksyntä</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4 space-y-4">
          {!locked && (
            <Card className="border-primary/20">
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Seuraava toimenpide</p><h2 className="mt-1 text-lg font-semibold">{nextAction.label}</h2><p className="mt-1 text-sm text-text-secondary">{nextAction.detail}</p></div>
                {canManage && <Button onClick={() => setTab(nextAction.tab)}>{nextAction.label}<ChevronRight size={16} className="ml-2" /></Button>}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 print:grid-cols-4">
            <RequirementCard title="Tarkastuskohdat" detail={`${completedResults}/${detail.results.length} kohtaa käsitelty`} complete={inspectionComplete} onClick={() => setTab('inspection')} />
            <RequirementCard title="Puutteet" detail={blockingFindings.length ? `${blockingFindings.length} luovutuksen estävää puutetta` : 'Ei avoimia estäviä puutteita'} complete={findingsReady} onClick={() => setTab('findings')} />
            <RequirementCard title="Luovutuskuvat" detail={hasHandoverPhoto ? 'Valmis kohde dokumentoitu' : 'Luovutuskuva puuttuu'} complete={hasHandoverPhoto} onClick={() => setTab('attachments')} />
            <RequirementCard title="Allekirjoitus" detail={hasHandwrittenSignature ? 'Allekirjoitus tallennettu' : 'Allekirjoitus puuttuu'} complete={hasHandwrittenSignature} onClick={() => setTab('approval')} />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-lg">Tarkastuksen tiedot</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-x-6 rounded-xl border border-slate-200 px-4 sm:grid-cols-2 sm:py-4 lg:grid-cols-4">
                <DetailValue label="Kiinteistö" value={[project?.name, project?.location].filter(Boolean).join(' · ')} />
                <DetailValue label="Huoneisto" value={unit?.unitCode || 'Koko kohde'} />
                <DetailValue label="Työnumero" value={project?.projectNumber || '—'} />
                <DetailValue label="Tarkastuspäivä" value={formatDate(detail.inspection.scheduledDate)} />
                <DetailValue label="Työmaan aloitus" value={formatDate(project?.startDate)} />
                <DetailValue label="Työmaan luovutus" value={formatDate(project?.endDate)} />
                <DetailValue label="Asukkaalle luovutus" value={formatDate(unit?.plannedCompletionDate)} />
                <DetailValue label="Tarkastaja" value={personName(people, detail.inspection.inspectorId)} />
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div><p className="text-text-muted">Aloitettu</p><p className="font-medium">{formatDateTime(detail.inspection.startedAt)}</p></div><div><p className="text-text-muted">Hyväksytty</p><p className="font-medium">{formatDateTime(detail.inspection.approvedAt)}</p></div><div><p className="text-text-muted">Avoimet puutteet</p><p className="font-medium">{openFindings.length}</p></div></div>
              {detail.inspection.summary && <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm"><strong>Yhteenveto:</strong> {detail.inspection.summary}</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inspection" className="mt-4">
          <div className="print:hidden">
            <GuidedInspectionRunner
              results={detail.results}
              attachments={detail.attachments}
              canManage={canManage}
              locked={locked}
              savingKey={savingKey}
              comments={comments}
              onCommentChange={(id, value) => setComments((previous) => ({ ...previous, [id]: value }))}
              onStatus={saveStatus}
              onSaveComment={saveComment}
              onUpload={uploadResult}
              onOpenAttachment={openAttachment}
            />
          </div>
          <div className="hidden space-y-3 print:block">
            {sections.map((results) => (
              <InspectionSectionCard
                key={results[0].sectionId}
                results={results}
                attachments={detail.attachments}
                canManage={false}
                locked
                savingKey={null}
                comments={comments}
                onCommentChange={() => undefined}
                onStatus={saveStatus}
                onSaveComment={saveComment}
                onMarkSection={markSectionOkay}
                onUpload={uploadResult}
                onOpenAttachment={openAttachment}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="findings" className="mt-4">
          <Card><CardHeader><CardTitle>Puutteet ja korjaukset</CardTitle><p className="text-sm text-text-secondary">Luovutuksen estävät puutteet on suljettava ennen hyväksyntää.</p></CardHeader><CardContent className="space-y-3">
            {detail.findings.map((finding) => <div key={finding.id} className="rounded-xl border p-4"><div className="flex flex-col gap-3 sm:flex-row sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{finding.title}</h3><Badge className={cn('border-0', severityClasses(finding.severity))}>{finding.severity}</Badge><Badge className={cn('border-0', findingStatusClasses(finding.status))}>{finding.status}</Badge></div><p className="mt-1 text-sm text-text-secondary">{finding.location || 'Sijaintia ei kirjattu'} · määräaika {formatDate(finding.dueDate)}</p>{finding.description && <p className="mt-2 whitespace-pre-wrap text-sm">{finding.description}</p>}{finding.correctionNote && <p className="mt-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Korjaajan ilmoitus: {finding.correctionNote}</p>}{finding.rejectionReason && <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-900">Hylkäyksen syy: {finding.rejectionReason}</p>}</div><div className="text-sm sm:text-right"><p className="text-text-muted">Vastuuhenkilö</p><p className="font-medium">{finding.contractorName || personName(people, finding.assigneeUserId)}</p></div></div><div className="mt-3 flex flex-wrap gap-2">{detail.attachments.filter((attachment) => attachment.findingId === finding.id).map((attachment) => <button key={attachment.id} type="button" onClick={() => void openAttachment(attachment.objectPath)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs hover:bg-slate-50"><ImageIcon size={14} />{attachment.kind}: {attachment.fileName}</button>)}</div></div>)}
            {detail.findings.length === 0 && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><CheckCircle2 size={18} />Tarkastuksessa ei ole kirjattuja puutteita.</div>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="attachments" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Camera size={19} />Luovutuskuvat ja dokumentit</CardTitle><p className="text-sm text-text-secondary">Dokumentoi valmis kohde vähintään yhdellä luovutus- tai yleiskuvalla.</p></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 print:hidden">
                {canManage && !locked && userId && <><label className={uploadLabelClasses}><Camera size={16} className="mr-2" />Ota luovutuskuva<input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => void uploadInspectionFile(event, 'Luovutuskuva')} /></label><label className={uploadLabelClasses}><ImageIcon size={16} className="mr-2" />Valitse kuva<input className="sr-only" type="file" accept="image/*" onChange={(event) => void uploadInspectionFile(event, 'Yleiskuva')} /></label><label className={uploadLabelClasses}><FileUp size={16} className="mr-2" />Lisää asiakirja<input className="sr-only" type="file" accept="image/*,application/pdf" onChange={(event) => void uploadInspectionFile(event, 'Asiakirja')} /></label></>}
                <Badge className={cn('border-0', hasHandoverPhoto ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800')}>{hasHandoverPhoto ? <CheckCircle2 size={14} className="mr-1" /> : <AlertTriangle size={14} className="mr-1" />}{hasHandoverPhoto ? 'Luovutuskuva lisätty' : 'Luovutuskuva puuttuu'}</Badge>
                {savingKey?.startsWith('inspection-upload-') && <span className="inline-flex items-center text-sm text-text-secondary"><Loader2 size={15} className="mr-1 animate-spin" />Lähetetään…</span>}
              </div>
              {inspectionAttachments.length > 0 ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{inspectionAttachments.map((attachment) => <AttachmentPreview key={attachment.id} attachment={attachment} onOpen={(path) => void openAttachment(path)} />)}</div> : <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-sm text-text-secondary">Tarkastukseen ei ole vielä lisätty luovutuskuvia tai asiakirjoja.</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approval" className="mt-4">
          <Card className="overflow-hidden">
            <CardHeader className="bg-slate-50/70"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle className="flex items-center gap-2"><Signature size={18} />Allekirjoitus ja hyväksyntä</CardTitle><p className="mt-1 text-sm text-text-secondary">Allekirjoita vasta, kun tarkastus, puutteet ja luovutuskuvat ovat kunnossa.</p></div>{hasHandwrittenSignature && <Badge className="w-fit border-0 bg-emerald-50 text-emerald-800"><CheckCircle2 size={14} className="mr-1" />Allekirjoitettu</Badge>}</div></CardHeader>
            <CardContent className="space-y-4 p-5 sm:p-6">
              {detail.signatures.map((signature) => <div key={signature.id} className="rounded-xl border p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold">{signature.signerName}</p><p className="text-sm text-text-secondary">{signature.signerRole}{signature.signerCompany ? ` · ${signature.signerCompany}` : ''}</p>{signature.note && <p className="mt-2 text-sm">{signature.note}</p>}</div><div className="w-full sm:w-72">{signature.signatureData ? <img src={signature.signatureData} alt={`${signature.signerName}, allekirjoitus`} className="h-24 w-full rounded-lg border bg-white object-contain p-2" /> : <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-xs text-text-muted">Ei piirrettyä allekirjoitusta</div>}<p className="mt-1 text-right text-xs text-text-muted">{formatDateTime(signature.signedAt)}</p></div></div></div>)}

              {!locked && canManage && <div className={cn('rounded-xl border p-4 print:hidden', preSignatureBlockers.length === 0 ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/70')}>{preSignatureBlockers.length > 0 ? <div className="flex gap-3"><AlertTriangle size={19} className="mt-0.5 shrink-0 text-amber-700" /><div><p className="font-semibold text-amber-950">Hyväksynnän vaatimuksia puuttuu.</p><ul className="mt-2 space-y-1 text-sm text-amber-950">{preSignatureBlockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}</ul></div></div> : <div className="flex gap-3"><CheckCircle2 size={19} className="mt-0.5 shrink-0 text-emerald-700" /><div><p className="font-semibold text-emerald-950">Tarkastus on valmis allekirjoitettavaksi.</p><p className="mt-1 text-sm text-emerald-900">Hyväksyntä lukitsee sisällön ja muodostaa raporttiversion.</p></div></div>}<div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end"><Button variant="outline" disabled={!signatureReady || Boolean(savingKey)} onClick={() => { setOperationError(null); setSignatureOpen(true); }}><Signature size={16} className="mr-2" />{hasHandwrittenSignature ? 'Lisää allekirjoitus' : 'Allekirjoita tarkastus'}</Button><Button disabled={!canApprove || Boolean(savingKey)} onClick={() => setApprovalOpen(true)}><ShieldCheck size={16} className="mr-2" />Hyväksy ja lukitse tarkastus</Button></div></div>}
              {detail.signatures.length === 0 && locked && <p className="text-sm text-text-secondary">Tarkastukselle ei ole tallennettu allekirjoitusta.</p>}
              {locked && <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm"><ShieldCheck size={18} />Tarkastus on {detail.inspection.status.toLowerCase()} eikä sen sisältöä voi enää muuttaa.</div>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <FindingDialog result={findingResult} people={people} busy={savingKey === 'finding'} onClose={() => setFindingResult(null)} onSubmit={submitFinding} />
      <SignatureDialog defaultName={personName(people, userId)} open={signatureOpen} busy={savingKey === 'signature'} error={signatureOpen ? operationError : null} onClose={() => setSignatureOpen(false)} onSubmit={async (draft) => { setSavingKey('signature'); setOperationError(null); try { await addHandwrittenInspectionSignature({ organizationId, inspectionId, signerName: draft.name, signerRole: draft.role, signerCompany: draft.company, signatureData: draft.signatureData, note: draft.note, userId }); setSignatureOpen(false); await refreshAll(); } catch (caught) { fail(caught, 'Allekirjoituksen tallennus epäonnistui.'); } finally { setSavingKey(null); } }} />
      <ApprovalDialog open={approvalOpen} busy={savingKey === 'approve'} onClose={() => setApprovalOpen(false)} onSubmit={async (summary) => { setSavingKey('approve'); setOperationError(null); try { await approveInspection(inspectionId, summary); setApprovalOpen(false); await refreshAll(); } catch (caught) { fail(caught, 'Hyväksyntä epäonnistui.'); } finally { setSavingKey(null); } }} />
      <VoidDialog open={voidOpen} busy={savingKey === 'void'} onClose={() => setVoidOpen(false)} onSubmit={async (reason) => { setSavingKey('void'); setOperationError(null); try { await voidInspection(inspectionId, reason); setVoidOpen(false); await refreshAll(); } catch (caught) { fail(caught, 'Mitätöinti epäonnistui.'); } finally { setSavingKey(null); } }} />
    </div>
  );
}
