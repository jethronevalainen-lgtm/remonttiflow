import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileUp,
  Flag,
  Image as ImageIcon,
  Loader2,
  Printer,
  ShieldCheck,
  Signature,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useInspectionDetail } from '@/hooks/useInspectionData';
import {
  approveInspection, createAttachmentUrl, createInspectionFinding, downloadInspectionAttachment,
  saveInspectionResult, uploadInspectionAttachment, voidInspection,
  type InspectionAttachment, type InspectionResultDetail, type InspectionResultStatus, type ProjectUnit,
} from '@/lib/supabase/inspectionEntities';
import { addHandwrittenInspectionSignature } from '@/lib/supabase/inspectionSignatures';
import { cn } from '@/lib/utils';
import type { Project } from '@/types';
import { ApprovalDialog, FindingDialog, SignatureDialog, VoidDialog, type FindingDraft } from './InspectionDialogs';
import InspectionSectionCard from './InspectionSectionCard';
import {
  BLOCKING_SEVERITIES, findingStatusClasses, formatDate, formatDateTime,
  inspectionStatusClasses, isFindingOpen, personName, projectName, severityClasses, unitLabel,
} from './inspectionUi';

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
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 break-words font-medium text-text-primary">{value || '—'}</p>
    </div>
  );
}

function WorkflowStep({
  number,
  title,
  description,
  complete,
  active,
}: {
  number: number;
  title: string;
  description: string;
  complete: boolean;
  active: boolean;
}) {
  return (
    <div className={cn(
      'relative rounded-xl border p-4 transition-colors',
      complete && 'border-emerald-200 bg-emerald-50/70',
      active && !complete && 'border-primary/35 bg-primary/5',
      !active && !complete && 'border-slate-200 bg-slate-50/60',
    )}>
      <div className="flex items-start gap-3">
        <span className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
          complete ? 'bg-emerald-600 text-white' : active ? 'bg-primary text-primary-foreground' : 'bg-slate-200 text-slate-600',
        )}>
          {complete ? <CheckCircle2 size={17} /> : number}
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-text-primary">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">{description}</p>
        </div>
      </div>
    </div>
  );
}

function AttachmentPreview({ attachment, onOpen }: {
  attachment: InspectionAttachment;
  onOpen: (path: string) => void;
}) {
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
        setPreviewUrl(null);
        setPreviewState('error');
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.mimeType, attachment.objectPath]);

  return (
    <button
      type="button"
      onClick={() => onOpen(attachment.objectPath)}
      className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-primary/40 hover:shadow-sm"
    >
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-slate-100">
        {previewState === 'loading' && <Loader2 size={26} className="animate-spin text-slate-400" />}
        {previewState === 'ready' && previewUrl && (
          <img
            src={previewUrl}
            alt={attachment.caption || attachment.fileName}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
            onError={() => {
              setPreviewUrl(null);
              setPreviewState('error');
            }}
          />
        )}
        {previewState === 'error' && (
          <div className="flex flex-col items-center gap-2 px-3 text-center text-xs text-slate-500">
            <ImageIcon size={28} className="text-slate-400" />
            <span>Esikatselua ei voitu ladata. Avaa tiedosto napsauttamalla.</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-xs font-semibold text-primary">{attachment.kind}</p>
        <p className="mt-1 truncate text-sm font-medium">{attachment.fileName}</p>
        <p className="mt-1 text-xs text-text-muted">{formatDateTime(attachment.createdAt)}</p>
      </div>
    </button>
  );
}

const uploadLabelClasses = 'inline-flex min-h-10 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground';

export default function InspectionDetailView({
  inspectionId, canManage, currentRole, organizationId, userId,
  projects, units, people, onBack, onWorkspaceRefresh,
}: Props) {
  const { detail, loading, error, refresh } = useInspectionDetail(inspectionId);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [findingResult, setFindingResult] = useState<InspectionResultDetail | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [activeStage, setActiveStage] = useState(0);
  const initializedInspectionRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (!detail || sections.length === 0 || initializedInspectionRef.current === inspectionId) return;
    const storageKey = `inspection-stage:${inspectionId}`;
    const savedStage = Number(window.sessionStorage.getItem(storageKey));
    const firstIncomplete = sections.findIndex((results) =>
      results.some((result) => result.status === 'Tarkastamatta'));
    const fallbackStage = firstIncomplete >= 0 ? firstIncomplete : sections.length;
    const maxStage = sections.length + 2;
    setActiveStage(Number.isInteger(savedStage) && savedStage >= 0 && savedStage <= maxStage
      ? savedStage
      : fallbackStage);
    initializedInspectionRef.current = inspectionId;
  }, [detail, inspectionId, sections]);

  useEffect(() => {
    if (initializedInspectionRef.current !== inspectionId) return;
    window.sessionStorage.setItem(`inspection-stage:${inspectionId}`, String(activeStage));
  }, [activeStage, inspectionId]);

  const refreshAll = async () => { await Promise.all([refresh(), onWorkspaceRefresh()]); };
  const fail = (caught: unknown, fallback: string) => setOperationError(caught instanceof Error ? caught.message : fallback);
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const openSignature = () => { setOperationError(null); setSignatureOpen(true); };
  const goToStage = (stage: number) => {
    setActiveStage(stage);
    window.requestAnimationFrame(() => scrollTo('inspection-guided-flow'));
  };

  const saveStatus = async (result: InspectionResultDetail, status: InspectionResultStatus) => {
    if (!canManage) return;
    if (status === 'Puute') {
      setFindingResult({ ...result, comment: comments[result.id] ?? result.comment });
      return;
    }
    setSavingKey(result.id); setOperationError(null);
    try {
      await saveInspectionResult({ inspectionId, itemId: result.itemId, status, comment: comments[result.id], measurementValue: result.measurementValue, measurementUnit: result.measurementUnit });
      await refreshAll();
    } catch (caught) { fail(caught, 'Tarkastuskohdan tallennus epäonnistui.'); }
    finally { setSavingKey(null); }
  };

  const saveComment = async (result: InspectionResultDetail) => {
    setSavingKey(`comment-${result.id}`); setOperationError(null);
    try {
      await saveInspectionResult({ inspectionId, itemId: result.itemId, status: result.status, comment: comments[result.id], measurementValue: result.measurementValue, measurementUnit: result.measurementUnit });
      await refreshAll();
    } catch (caught) { fail(caught, 'Kommentin tallennus epäonnistui.'); }
    finally { setSavingKey(null); }
  };

  const markSectionOkay = async (results: InspectionResultDetail[]) => {
    const uncheckedResults = results.filter((result) => result.status === 'Tarkastamatta');
    if (uncheckedResults.length === 0) return;
    setSavingKey(`section-${results[0]?.sectionId ?? ''}`); setOperationError(null);
    try {
      await Promise.all(uncheckedResults.map((result) => saveInspectionResult({
        inspectionId,
        itemId: result.itemId,
        status: 'Kunnossa',
        comment: comments[result.id],
        measurementValue: result.measurementValue,
        measurementUnit: result.measurementUnit,
      })));
      await refreshAll();
    } catch (caught) { fail(caught, 'Osion tallennus epäonnistui.'); }
    finally { setSavingKey(null); }
  };

  const submitFinding = async (draft: FindingDraft) => {
    if (!findingResult) return;
    setSavingKey('finding'); setOperationError(null);
    try {
      await createInspectionFinding({ inspectionId, resultId: findingResult.id, ...draft });
      setFindingResult(null);
      await refreshAll();
    } catch (caught) { fail(caught, 'Puutteen tallennus epäonnistui.'); }
    finally { setSavingKey(null); }
  };

  const uploadResult = async (event: ChangeEvent<HTMLInputElement>, result: InspectionResultDetail) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !userId) return;
    setSavingKey(`upload-${result.id}`); setOperationError(null);
    try {
      await uploadInspectionAttachment({ organizationId, inspectionId, resultId: result.id, file, kind: result.status === 'Puute' ? 'Puutekuva' : 'Yleiskuva', userId });
      await refreshAll();
    } catch (caught) { fail(caught, 'Liitteen lähetys epäonnistui.'); }
    finally { setSavingKey(null); }
  };

  const uploadInspectionFile = async (event: ChangeEvent<HTMLInputElement>, kind: 'Luovutuskuva' | 'Yleiskuva' | 'Asiakirja') => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !userId) return;
    setSavingKey(`inspection-upload-${kind}`); setOperationError(null);
    try {
      await uploadInspectionAttachment({ organizationId, inspectionId, file, kind, userId });
      await refreshAll();
    } catch (caught) { fail(caught, 'Tarkastuksen liitteen lähetys epäonnistui.'); }
    finally { setSavingKey(null); }
  };

  const openAttachment = async (path: string) => {
    try { window.open(await createAttachmentUrl(path), '_blank', 'noopener,noreferrer'); }
    catch (caught) { fail(caught, 'Liitteen avaaminen epäonnistui.'); }
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
  const hasHandoverPhoto = inspectionAttachments.some((attachment) =>
    ['Luovutuskuva', 'Yleiskuva'].includes(attachment.kind) && attachment.mimeType.startsWith('image/'));
  const hasHandwrittenSignature = detail.signatures.some((signature) => Boolean(signature.signatureData));
  const inspectionComplete = detail.inspection.progress === 100;
  const findingsReady = inspectionComplete && blockingFindings.length === 0;
  const preSignatureBlockers = [
    !inspectionComplete ? 'Käsittele kaikki tarkastuskohdat.' : null,
    blockingFindings.length > 0 ? `Sulje ${blockingFindings.length} luovutuksen estävää puutetta.` : null,
    !hasHandoverPhoto ? 'Lisää vähintään yksi luovutus- tai yleiskuva.' : null,
  ].filter((item): item is string => Boolean(item));
  const approvalBlockers = [
    ...preSignatureBlockers,
    !hasHandwrittenSignature ? 'Allekirjoita tarkastus.' : null,
  ].filter((item): item is string => Boolean(item));
  const signatureReady = canManage && !locked && preSignatureBlockers.length === 0;
  const canApprove = canManage && !locked && approvalBlockers.length === 0;
  const workflowActiveStep = !inspectionComplete ? 1 : blockingFindings.length > 0 ? 2 : !hasHandoverPhoto ? 3 : 4;
  const sectionIsComplete = (results: InspectionResultDetail[]) =>
    results.length > 0 && results.every((result) => result.status !== 'Tarkastamatta');
  const sectionStageCount = sections.length;
  const findingsStageIndex = sectionStageCount;
  const attachmentsStageIndex = sectionStageCount + 1;
  const signatureStageIndex = sectionStageCount + 2;
  const firstIncompleteSectionIndex = sections.findIndex((results) => !sectionIsComplete(results));
  const guidedStages = [
    ...sections.map((results, index) => ({
      title: results[0]?.sectionTitle || `Tarkastusvaihe ${index + 1}`,
      description: `${results.filter((result) => result.status !== 'Tarkastamatta').length}/${results.length} kohtaa käsitelty`,
      complete: sectionIsComplete(results),
      available: index === 0 || sections.slice(0, index).every(sectionIsComplete),
    })),
    {
      title: 'Puutteet',
      description: blockingFindings.length > 0 ? `${blockingFindings.length} estävää puutetta avoinna` : 'Tarkista ja sulje havaitut puutteet',
      complete: findingsReady,
      available: inspectionComplete,
    },
    {
      title: 'Luovutuskuvat',
      description: hasHandoverPhoto ? 'Valmis kohde dokumentoitu' : 'Ota vähintään yksi kuva valmiista kohteesta',
      complete: hasHandoverPhoto,
      available: findingsReady,
    },
    {
      title: 'Allekirjoitus',
      description: hasHandwrittenSignature ? 'Allekirjoitus tallennettu' : 'Vahvista tarkastus allekirjoituksella',
      complete: hasHandwrittenSignature,
      available: findingsReady && hasHandoverPhoto,
    },
  ];
  const activeGuidedStage = guidedStages[activeStage] ?? guidedStages[0];
  const canAdvanceGuidedStage = activeStage < sectionStageCount
    ? sectionIsComplete(sections[activeStage] ?? [])
    : activeStage === findingsStageIndex
      ? blockingFindings.length === 0
      : activeStage === attachmentsStageIndex
        ? hasHandoverPhoto
        : false;
  const nextGuidedStageLabel = activeStage + 1 < sectionStageCount
    ? `Jatka: ${sections[activeStage + 1]?.[0]?.sectionTitle || 'seuraava vaihe'}`
    : activeStage < sectionStageCount
      ? 'Jatka puutteisiin'
      : activeStage === findingsStageIndex
        ? 'Jatka luovutuskuviin'
        : 'Jatka allekirjoitukseen';

  const nextAction = !inspectionComplete
    ? {
        title: 'Jatka tarkastusta',
        description: `${completedResults}/${detail.results.length} tarkastuskohtaa käsitelty.`,
        action: () => goToStage(firstIncompleteSectionIndex >= 0 ? firstIncompleteSectionIndex : 0),
        icon: ClipboardCheck,
      }
    : blockingFindings.length > 0
      ? {
          title: 'Käsittele avoimet puutteet',
          description: `${blockingFindings.length} puutetta estää luovutuksen.`,
          action: () => goToStage(findingsStageIndex),
          icon: AlertTriangle,
        }
      : !hasHandoverPhoto
        ? {
            title: 'Ota luovutuskuva',
            description: 'Dokumentoi valmis kohde ennen allekirjoitusta.',
            action: () => goToStage(attachmentsStageIndex),
            icon: Camera,
          }
        : !hasHandwrittenSignature
          ? {
              title: 'Allekirjoita tarkastus',
              description: 'Tarkastustyö on valmis. Tee allekirjoitus ennen hyväksyntää.',
              action: () => goToStage(signatureStageIndex),
              icon: Signature,
            }
          : { title: 'Hyväksy tarkastus', description: 'Kaikki luovutuksen vaatimukset täyttyvät.', action: () => setApprovalOpen(true), icon: ShieldCheck };

  return (
    <div className="space-y-5 print:space-y-3">
      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={onBack} className="w-fit"><ChevronLeft size={17} className="mr-1" />Kaikki tarkastukset</Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer size={16} className="mr-2" />Tulosta / PDF</Button>
          {currentRole === 'admin' && detail.inspection.status === 'Hyväksytty' && <Button variant="destructive" onClick={() => setVoidOpen(true)}>Mitätöi</Button>}
        </div>
      </div>

      {operationError && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 print:hidden"><AlertTriangle size={17} className="mt-0.5 shrink-0" />{operationError}</div>}

      <Card className="overflow-hidden print:border-0 print:shadow-none"><CardContent className="p-5 sm:p-6 print:p-0">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2"><Badge className={cn('border-0', inspectionStatusClasses(detail.inspection.status))}>{detail.inspection.status}</Badge><Badge variant="outline">Raporttiversio {detail.inspection.reportVersion || '—'}</Badge></div>
            <h1 className="text-2xl font-bold sm:text-3xl">{detail.inspection.title}</h1>
            <p className="mt-1 text-sm text-text-secondary">{projectName(projects, detail.inspection.projectId)} · {unitLabel(units, detail.inspection.unitId)}</p>
            <p className="mt-1 text-sm text-text-secondary">{detail.inspection.inspectionType}</p>
          </div>
          <div className="w-full rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:w-72">
            <div className="mb-2 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Tarkastustyö</p><p className="mt-1 text-sm text-text-secondary">{completedResults}/{detail.results.length} kohtaa käsitelty</p></div><strong className="text-2xl">{detail.inspection.progress}%</strong></div>
            <Progress value={detail.inspection.progress} />
          </div>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-5">
          <h2 className="mb-3 text-lg font-semibold">Alkutiedot</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DetailValue label="Kiinteistö" value={[project?.name, project?.location].filter(Boolean).join(' · ')} />
            <DetailValue label="Huoneisto" value={unit?.unitCode || 'Koko kohde'} />
            <DetailValue label="Työnumero" value={project?.projectNumber || '—'} />
            <DetailValue label="Tarkastuksen päivämäärä" value={formatDate(detail.inspection.scheduledDate)} />
            <DetailValue label="Työmaan aloitus" value={formatDate(project?.startDate)} />
            <DetailValue label="Työmaan luovutus" value={formatDate(project?.endDate)} />
            <DetailValue label="Asukkaalle luovutus" value={formatDate(unit?.plannedCompletionDate)} />
            <DetailValue label="Tarkastuksen suorittaja" value={personName(people, detail.inspection.inspectorId)} />
          </div>
        </div>

        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3"><div><p className="text-text-muted">Aloitettu</p><p className="font-medium">{formatDateTime(detail.inspection.startedAt)}</p></div><div><p className="text-text-muted">Hyväksytty</p><p className="font-medium">{formatDateTime(detail.inspection.approvedAt)}</p></div><div><p className="text-text-muted">Avoimet puutteet</p><p className="font-medium">{openFindings.length}</p></div></div>
        {detail.inspection.summary && <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm"><strong>Yhteenveto:</strong> {detail.inspection.summary}</div>}
      </CardContent></Card>

      {!locked && (
        <Card className="border-slate-200 print:hidden">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><CardTitle className="flex items-center gap-2"><Flag size={19} />Tarkastuksen eteneminen</CardTitle><p className="mt-1 text-sm text-text-secondary">Allekirjoitus avautuu vasta, kun tarkastus, puutteet ja luovutuskuvat ovat kunnossa.</p></div>
              {canManage && <Button onClick={nextAction.action}><nextAction.icon size={16} className="mr-2" />{nextAction.title}</Button>}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4">
              <WorkflowStep number={1} title="Tarkasta työ" description={`${completedResults}/${detail.results.length} kohtaa käsitelty`} complete={inspectionComplete} active={workflowActiveStep === 1} />
              <WorkflowStep number={2} title="Käsittele puutteet" description={blockingFindings.length > 0 ? `${blockingFindings.length} luovutuksen estävää puutetta` : inspectionComplete ? 'Ei avoimia estäviä puutteita' : 'Valmistuu tarkastuksen jälkeen'} complete={findingsReady} active={workflowActiveStep === 2} />
              <WorkflowStep number={3} title="Dokumentoi luovutus" description={hasHandoverPhoto ? 'Luovutuskuva lisätty' : 'Lisää vähintään yksi valmis kuva'} complete={hasHandoverPhoto} active={workflowActiveStep === 3} />
              <WorkflowStep number={4} title="Allekirjoita ja hyväksy" description={hasHandwrittenSignature ? 'Allekirjoitettu – valmis hyväksyttäväksi' : 'Viimeinen vaihe tehdään tarkastuksen lopussa'} complete={hasHandwrittenSignature && canApprove} active={workflowActiveStep === 4} />
            </div>
            <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm"><strong>Seuraavaksi:</strong> {nextAction.description}</div>
          </CardContent>
        </Card>
      )}


      {canManage && !locked && guidedStages.length > 0 && (
        <Card id="inspection-guided-flow" className="scroll-mt-6 border-primary/20 print:hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2"><ClipboardCheck size={19} />Ohjattu itselleluovutus</CardTitle>
            <p className="text-sm text-text-secondary">Etene vaihe kerrallaan. Seuraava vaihe avautuu, kun nykyinen vaihe on käsitelty.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto pb-1">
              <div className="flex min-w-max gap-2">
                {guidedStages.map((stage, index) => (
                  <button
                    key={`${index}-${stage.title}`}
                    type="button"
                    disabled={!stage.available && index !== activeStage}
                    onClick={() => goToStage(index)}
                    className={cn(
                      'flex w-52 items-start gap-3 rounded-xl border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45',
                      index === activeStage ? 'border-primary bg-primary/5 shadow-sm' : 'border-slate-200 bg-white hover:border-primary/30',
                    )}
                  >
                    <span className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      stage.complete ? 'bg-emerald-600 text-white' : index === activeStage ? 'bg-primary text-primary-foreground' : 'bg-slate-200 text-slate-700',
                    )}>
                      {stage.complete ? <CheckCircle2 size={15} /> : index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-text-primary">{stage.title}</span>
                      <span className="mt-1 block text-xs leading-snug text-text-secondary">{stage.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Vaihe {activeStage + 1}/{guidedStages.length}</p>
                  <p className="mt-1 font-semibold text-text-primary">{activeGuidedStage?.title}</p>
                  <p className="mt-1 text-sm text-text-secondary">{activeGuidedStage?.description}</p>
                </div>
                {!canAdvanceGuidedStage && activeStage < signatureStageIndex && (
                  <Badge className="mt-2 w-fit border-0 bg-amber-50 text-amber-800 sm:mt-0">Käsittele vaihe loppuun</Badge>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="outline" disabled={activeStage === 0 || Boolean(savingKey)} onClick={() => goToStage(Math.max(0, activeStage - 1))}>
                <ChevronLeft size={16} className="mr-2" />Edellinen vaihe
              </Button>
              {activeStage < signatureStageIndex && (
                <Button disabled={!canAdvanceGuidedStage || Boolean(savingKey)} onClick={() => goToStage(Math.min(signatureStageIndex, activeStage + 1))}>
                  {nextGuidedStageLabel}<ChevronRight size={16} className="ml-2" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div id="inspection-sections" className={cn('scroll-mt-6 space-y-5', canManage && !locked && activeStage >= sectionStageCount && 'hidden', 'print:block')}>
        {sections.map((results, index) => (
          <div key={results[0].sectionId} className={cn(canManage && !locked && activeStage !== index && 'hidden', 'print:block')}>
            <InspectionSectionCard results={results} attachments={detail.attachments} canManage={canManage} locked={locked} savingKey={savingKey} comments={comments} onCommentChange={(id, value) => setComments((previous) => ({ ...previous, [id]: value }))} onStatus={saveStatus} onSaveComment={saveComment} onMarkSection={markSectionOkay} onUpload={uploadResult} onOpenAttachment={openAttachment} />
          </div>
        ))}
      </div>

      <Card id="inspection-findings" className={cn('scroll-mt-6 print:shadow-none', canManage && !locked && activeStage !== findingsStageIndex && 'hidden', 'print:block')}><CardHeader><CardTitle>Puutteet ja korjaukset</CardTitle><p className="text-sm text-text-secondary">Luovutuksen estävät puutteet on suljettava ennen loppudokumentointia ja allekirjoitusta.</p></CardHeader><CardContent className="space-y-3">
        {detail.findings.map((finding) => <div key={finding.id} className="rounded-xl border p-4"><div className="flex flex-col gap-3 sm:flex-row sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{finding.title}</h3><Badge className={cn('border-0', severityClasses(finding.severity))}>{finding.severity}</Badge><Badge className={cn('border-0', findingStatusClasses(finding.status))}>{finding.status}</Badge></div><p className="mt-1 text-sm text-text-secondary">{finding.location || 'Sijaintia ei kirjattu'} · määräaika {formatDate(finding.dueDate)}</p>{finding.description && <p className="mt-2 whitespace-pre-wrap text-sm">{finding.description}</p>}{finding.correctionNote && <p className="mt-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Korjaajan ilmoitus: {finding.correctionNote}</p>}{finding.rejectionReason && <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-900">Hylkäyksen syy: {finding.rejectionReason}</p>}</div><div className="text-sm sm:text-right"><p className="text-text-muted">Vastuuhenkilö</p><p className="font-medium">{finding.contractorName || personName(people, finding.assigneeUserId)}</p></div></div><div className="mt-3 flex flex-wrap gap-2">{detail.attachments.filter((attachment) => attachment.findingId === finding.id).map((attachment) => <button key={attachment.id} type="button" onClick={() => void openAttachment(attachment.objectPath)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs hover:bg-slate-50"><ImageIcon size={14} />{attachment.kind}: {attachment.fileName}</button>)}</div></div>)}
        {detail.findings.length === 0 && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><CheckCircle2 size={18} />Tarkastuksessa ei ole kirjattuja puutteita.</div>}
      </CardContent></Card>

      <Card id="inspection-attachments" className={cn('scroll-mt-6 print:shadow-none', canManage && !locked && activeStage !== attachmentsStageIndex && 'hidden', 'print:block')}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Camera size={19} />Luovutuskuvat ja dokumentit</CardTitle>
          <p className="text-sm text-text-secondary">Kun tarkastuskohdat ja puutteet on käsitelty, dokumentoi valmis kohde vähintään yhdellä luovutus- tai yleiskuvalla.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {canManage && !locked && userId && (
              <>
                <label className={uploadLabelClasses}><Camera size={16} className="mr-2" />Ota luovutuskuva<input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => void uploadInspectionFile(event, 'Luovutuskuva')} /></label>
                <label className={uploadLabelClasses}><ImageIcon size={16} className="mr-2" />Valitse kuva<input className="sr-only" type="file" accept="image/*" onChange={(event) => void uploadInspectionFile(event, 'Yleiskuva')} /></label>
                <label className={uploadLabelClasses}><FileUp size={16} className="mr-2" />Lisää asiakirja<input className="sr-only" type="file" accept="image/*,application/pdf" onChange={(event) => void uploadInspectionFile(event, 'Asiakirja')} /></label>
              </>
            )}
            <Badge className={cn('border-0', hasHandoverPhoto ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800')}>
              {hasHandoverPhoto ? <CheckCircle2 size={14} className="mr-1" /> : <AlertTriangle size={14} className="mr-1" />}
              {hasHandoverPhoto ? 'Luovutuskuva lisätty' : 'Luovutuskuva puuttuu'}
            </Badge>
            {savingKey?.startsWith('inspection-upload-') && <span className="inline-flex items-center text-sm text-text-secondary"><Loader2 size={15} className="mr-1 animate-spin" />Lähetetään…</span>}
          </div>
          {inspectionAttachments.length > 0
            ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{inspectionAttachments.map((attachment) => <AttachmentPreview key={attachment.id} attachment={attachment} onOpen={(path) => void openAttachment(path)} />)}</div>
            : <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-sm text-text-secondary">Tarkastukseen ei ole vielä lisätty luovutuskuvia tai asiakirjoja.</div>}
        </CardContent>
      </Card>

      <Card id="inspection-signatures" className={cn('scroll-mt-6 overflow-hidden border-slate-200 print:shadow-none', canManage && !locked && activeStage !== signatureStageIndex && 'hidden', 'print:block')}>
        <CardHeader className="bg-slate-50/70">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><CardTitle className="flex items-center gap-2"><Signature size={18} />Luovutus, allekirjoitus ja hyväksyntä</CardTitle><p className="mt-1 text-sm text-text-secondary">Tämä on tarkastuksen viimeinen vaihe. Allekirjoita vasta, kun työ on tarkastettu, puutteet käsitelty ja luovutuskuvat lisätty.</p></div>
            {hasHandwrittenSignature && <Badge className="w-fit border-0 bg-emerald-50 text-emerald-800"><CheckCircle2 size={14} className="mr-1" />Allekirjoitettu</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-5 sm:p-6">
          {detail.signatures.map((signature) => <div key={signature.id} className="rounded-xl border p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold">{signature.signerName}</p><p className="text-sm text-text-secondary">{signature.signerRole}{signature.signerCompany ? ` · ${signature.signerCompany}` : ''}</p>{signature.note && <p className="mt-2 text-sm">{signature.note}</p>}</div><div className="w-full sm:w-72">{signature.signatureData ? <img src={signature.signatureData} alt={`${signature.signerName}, allekirjoitus`} className="h-24 w-full rounded-lg border bg-white object-contain p-2" /> : <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-xs text-text-muted">Ei piirrettyä allekirjoitusta</div>}<p className="mt-1 text-right text-xs text-text-muted">{formatDateTime(signature.signedAt)}</p></div></div></div>)}

          {!locked && canManage && (
            <div className={cn('rounded-xl border p-4 print:hidden', preSignatureBlockers.length === 0 ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/70')}>
              {preSignatureBlockers.length > 0 ? (
                <div className="flex gap-3"><AlertTriangle size={19} className="mt-0.5 shrink-0 text-amber-700" /><div><p className="font-semibold text-amber-950">Viimeinen vaihe ei ole vielä valmis.</p><ul className="mt-2 space-y-1 text-sm text-amber-950">{preSignatureBlockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}</ul></div></div>
              ) : (
                <div className="flex gap-3"><CheckCircle2 size={19} className="mt-0.5 shrink-0 text-emerald-700" /><div><p className="font-semibold text-emerald-950">Tarkastus on valmis allekirjoitettavaksi.</p><p className="mt-1 text-sm text-emerald-900">Allekirjoituksen jälkeen tarkastus voidaan hyväksyä ja raporttiversio lukitaan.</p></div></div>
              )}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" disabled={!signatureReady || Boolean(savingKey)} onClick={openSignature}><Signature size={16} className="mr-2" />{hasHandwrittenSignature ? 'Lisää allekirjoitus' : 'Allekirjoita tarkastus'}</Button>
                <Button disabled={!canApprove || Boolean(savingKey)} onClick={() => setApprovalOpen(true)}><ShieldCheck size={16} className="mr-2" />Hyväksy ja lukitse tarkastus</Button>
              </div>
            </div>
          )}

          {detail.signatures.length === 0 && locked && <p className="text-sm text-text-secondary">Tarkastukselle ei ole tallennettu allekirjoitusta.</p>}
          {locked && <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm"><ShieldCheck size={18} />Tarkastus on {detail.inspection.status.toLowerCase()} eikä sen sisältöä voi enää muuttaa.</div>}
        </CardContent>
      </Card>

      <FindingDialog result={findingResult} people={people} busy={savingKey === 'finding'} onClose={() => setFindingResult(null)} onSubmit={submitFinding} />
      <SignatureDialog defaultName={personName(people, userId)} open={signatureOpen} busy={savingKey === 'signature'} error={signatureOpen ? operationError : null} onClose={() => setSignatureOpen(false)} onSubmit={async (draft) => { setSavingKey('signature'); setOperationError(null); try { await addHandwrittenInspectionSignature({ organizationId, inspectionId, signerName: draft.name, signerRole: draft.role, signerCompany: draft.company, signatureData: draft.signatureData, note: draft.note, userId }); setSignatureOpen(false); await refreshAll(); } catch (caught) { fail(caught, 'Allekirjoituksen tallennus epäonnistui.'); } finally { setSavingKey(null); } }} />
      <ApprovalDialog open={approvalOpen} busy={savingKey === 'approve'} onClose={() => setApprovalOpen(false)} onSubmit={async (summary) => { setSavingKey('approve'); setOperationError(null); try { await approveInspection(inspectionId, summary); setApprovalOpen(false); await refreshAll(); } catch (caught) { fail(caught, 'Hyväksyntä epäonnistui.'); } finally { setSavingKey(null); } }} />
      <VoidDialog open={voidOpen} busy={savingKey === 'void'} onClose={() => setVoidOpen(false)} onSubmit={async (reason) => { setSavingKey('void'); setOperationError(null); try { await voidInspection(inspectionId, reason); setVoidOpen(false); await refreshAll(); } catch (caught) { fail(caught, 'Mitätöinti epäonnistui.'); } finally { setSavingKey(null); } }} />
    </div>
  );
}
