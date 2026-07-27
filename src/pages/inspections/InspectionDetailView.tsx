import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  FileUp,
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
  approveInspection, createAttachmentUrl, createInspectionFinding,
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

function AttachmentPreview({ attachment, onOpen }: {
  attachment: InspectionAttachment;
  onOpen: (path: string) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!attachment.mimeType.startsWith('image/')) return () => { active = false; };
    void createAttachmentUrl(attachment.objectPath)
      .then((url) => { if (active) setPreviewUrl(url); })
      .catch(() => { if (active) setPreviewUrl(null); });
    return () => { active = false; };
  }, [attachment.mimeType, attachment.objectPath]);

  return (
    <button
      type="button"
      onClick={() => onOpen(attachment.objectPath)}
      className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-primary/40 hover:shadow-sm"
    >
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-slate-100">
        {previewUrl
          ? <img src={previewUrl} alt={attachment.caption || attachment.fileName} className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
          : <FileUp size={28} className="text-slate-400" />}
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
    setSavingKey(`section-${results[0]?.sectionId ?? ''}`); setOperationError(null);
    try {
      await Promise.all(results.map((result) => saveInspectionResult({
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
  const hasHandoverPhoto = inspectionAttachments.some((attachment) =>
    ['Luovutuskuva', 'Yleiskuva'].includes(attachment.kind) && attachment.mimeType.startsWith('image/'));
  const hasHandwrittenSignature = detail.signatures.some((signature) => Boolean(signature.signatureData));
  const approvalBlockers = [
    detail.inspection.progress < 100 ? 'Kaikkia tarkastuskohtia ei ole käsitelty.' : null,
    blockingFindings.length > 0 ? `${blockingFindings.length} luovutuksen estävää puutetta on avoinna.` : null,
    !hasHandoverPhoto ? 'Lisää vähintään yksi luovutus- tai yleiskuva.' : null,
    !hasHandwrittenSignature ? 'Lisää käsin tehty allekirjoitus.' : null,
  ].filter((item): item is string => Boolean(item));
  const canApprove = canManage && !locked && approvalBlockers.length === 0;

  return (
    <div className="space-y-5 print:space-y-3">
      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={onBack} className="w-fit"><ChevronLeft size={17} className="mr-1" />Kaikki tarkastukset</Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer size={16} className="mr-2" />Tulosta / PDF</Button>
          {canManage && !locked && <Button variant="outline" onClick={() => setSignatureOpen(true)}><Signature size={16} className="mr-2" />Allekirjoita</Button>}
          {canManage && !locked && <Button disabled={!canApprove} onClick={() => setApprovalOpen(true)}><ShieldCheck size={16} className="mr-2" />Hyväksy tarkastus</Button>}
          {currentRole === 'admin' && detail.inspection.status === 'Hyväksytty' && <Button variant="destructive" onClick={() => setVoidOpen(true)}>Mitätöi</Button>}
        </div>
      </div>

      {operationError && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 print:hidden"><AlertTriangle size={17} className="mt-0.5 shrink-0" />{operationError}</div>}

      <Card className="print:border-0 print:shadow-none"><CardContent className="p-5 sm:p-6 print:p-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2"><Badge className={cn('border-0', inspectionStatusClasses(detail.inspection.status))}>{detail.inspection.status}</Badge><Badge variant="outline">Raporttiversio {detail.inspection.reportVersion || '—'}</Badge></div>
            <h1 className="text-2xl font-bold sm:text-3xl">{detail.inspection.title}</h1>
            <p className="mt-1 text-sm text-text-secondary">{projectName(projects, detail.inspection.projectId)} · {unitLabel(units, detail.inspection.unitId)}</p>
            <p className="mt-1 text-sm text-text-secondary">{detail.inspection.inspectionType}</p>
          </div>
          <div className="w-full sm:w-56"><div className="mb-1 flex justify-between text-sm"><span>Eteneminen</span><strong>{detail.inspection.progress}%</strong></div><Progress value={detail.inspection.progress} /></div>
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

      {canManage && !locked && approvalBlockers.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 print:hidden">
          <div className="flex gap-2"><AlertTriangle size={18} className="mt-0.5 shrink-0" /><div><strong>Hyväksyntä ei ole vielä mahdollinen.</strong><ul className="mt-2 space-y-1">{approvalBlockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}</ul></div></div>
        </div>
      )}

      {sections.map((results) => <InspectionSectionCard key={results[0].sectionId} results={results} attachments={detail.attachments} canManage={canManage} locked={locked} savingKey={savingKey} comments={comments} onCommentChange={(id, value) => setComments((previous) => ({ ...previous, [id]: value }))} onStatus={saveStatus} onSaveComment={saveComment} onMarkSection={markSectionOkay} onUpload={uploadResult} onOpenAttachment={openAttachment} />)}

      <Card className="print:shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Camera size={19} />Valokuvat ja dokumentit</CardTitle>
          <p className="text-sm text-text-secondary">Lisää tarkastuksen loppuun vähintään yksi luovutuskuva kohteesta. Voit liittää myös muita yleiskuvia ja tarkastusasiakirjoja.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {canManage && !locked && userId && (
              <>
                <label className={uploadLabelClasses}><Camera size={16} className="mr-2" />Lisää luovutuskuva<input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => void uploadInspectionFile(event, 'Luovutuskuva')} /></label>
                <label className={uploadLabelClasses}><ImageIcon size={16} className="mr-2" />Lisää yleiskuva<input className="sr-only" type="file" accept="image/*" onChange={(event) => void uploadInspectionFile(event, 'Yleiskuva')} /></label>
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
            : <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-sm text-text-secondary">Tarkastukseen ei ole vielä lisätty yleiskuvia tai asiakirjoja.</div>}
        </CardContent>
      </Card>

      <Card className="print:shadow-none"><CardHeader><CardTitle>Puutteet ja korjaukset</CardTitle></CardHeader><CardContent className="space-y-3">
        {detail.findings.map((finding) => <div key={finding.id} className="rounded-xl border p-4"><div className="flex flex-col gap-3 sm:flex-row sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{finding.title}</h3><Badge className={cn('border-0', severityClasses(finding.severity))}>{finding.severity}</Badge><Badge className={cn('border-0', findingStatusClasses(finding.status))}>{finding.status}</Badge></div><p className="mt-1 text-sm text-text-secondary">{finding.location || 'Sijaintia ei kirjattu'} · määräaika {formatDate(finding.dueDate)}</p>{finding.description && <p className="mt-2 whitespace-pre-wrap text-sm">{finding.description}</p>}{finding.correctionNote && <p className="mt-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Korjaajan ilmoitus: {finding.correctionNote}</p>}{finding.rejectionReason && <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-900">Hylkäyksen syy: {finding.rejectionReason}</p>}</div><div className="text-sm sm:text-right"><p className="text-text-muted">Vastuuhenkilö</p><p className="font-medium">{finding.contractorName || personName(people, finding.assigneeUserId)}</p></div></div><div className="mt-3 flex flex-wrap gap-2">{detail.attachments.filter((attachment) => attachment.findingId === finding.id).map((attachment) => <button key={attachment.id} type="button" onClick={() => void openAttachment(attachment.objectPath)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs hover:bg-slate-50"><ImageIcon size={14} />{attachment.kind}: {attachment.fileName}</button>)}</div></div>)}
        {detail.findings.length === 0 && <p className="text-sm text-text-secondary">Tarkastuksessa ei ole kirjattuja puutteita.</p>}
      </CardContent></Card>

      <Card className="print:shadow-none"><CardHeader><CardTitle className="flex items-center gap-2"><Signature size={18} />Allekirjoitukset</CardTitle><p className="text-sm text-text-secondary">Käsin tehty allekirjoitus vaaditaan ennen tarkastuksen hyväksymistä.</p></CardHeader><CardContent className="space-y-3">
        {detail.signatures.map((signature) => <div key={signature.id} className="rounded-xl border p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold">{signature.signerName}</p><p className="text-sm text-text-secondary">{signature.signerRole}{signature.signerCompany ? ` · ${signature.signerCompany}` : ''}</p>{signature.note && <p className="mt-2 text-sm">{signature.note}</p>}</div><div className="w-full sm:w-72">{signature.signatureData ? <img src={signature.signatureData} alt={`${signature.signerName}, allekirjoitus`} className="h-24 w-full rounded-lg border bg-white object-contain p-2" /> : <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-xs text-text-muted">Ei piirrettyä allekirjoitusta</div>}<p className="mt-1 text-right text-xs text-text-muted">{formatDateTime(signature.signedAt)}</p></div></div></div>)}
        {detail.signatures.length === 0 && <p className="text-sm text-text-secondary">Tarkastusta ei ole vielä allekirjoitettu.</p>}
      </CardContent></Card>

      <FindingDialog result={findingResult} people={people} busy={savingKey === 'finding'} onClose={() => setFindingResult(null)} onSubmit={submitFinding} />
      <SignatureDialog defaultName={personName(people, userId)} open={signatureOpen} busy={savingKey === 'signature'} onClose={() => setSignatureOpen(false)} onSubmit={async (draft) => { setSavingKey('signature'); setOperationError(null); try { await addHandwrittenInspectionSignature({ organizationId, inspectionId, signerName: draft.name, signerRole: draft.role, signerCompany: draft.company, signatureData: draft.signatureData, note: draft.note, userId }); setSignatureOpen(false); await refreshAll(); } catch (caught) { fail(caught, 'Allekirjoituksen tallennus epäonnistui.'); } finally { setSavingKey(null); } }} />
      <ApprovalDialog open={approvalOpen} busy={savingKey === 'approve'} onClose={() => setApprovalOpen(false)} onSubmit={async (summary) => { setSavingKey('approve'); setOperationError(null); try { await approveInspection(inspectionId, summary); setApprovalOpen(false); await refreshAll(); } catch (caught) { fail(caught, 'Hyväksyntä epäonnistui.'); } finally { setSavingKey(null); } }} />
      <VoidDialog open={voidOpen} busy={savingKey === 'void'} onClose={() => setVoidOpen(false)} onSubmit={async (reason) => { setSavingKey('void'); setOperationError(null); try { await voidInspection(inspectionId, reason); setVoidOpen(false); await refreshAll(); } catch (caught) { fail(caught, 'Mitätöinti epäonnistui.'); } finally { setSavingKey(null); } }} />
    </div>
  );
}
