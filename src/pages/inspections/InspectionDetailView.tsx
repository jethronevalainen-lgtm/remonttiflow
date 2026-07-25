import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { AlertTriangle, ChevronLeft, Image as ImageIcon, Loader2, Printer, ShieldCheck, Signature } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useInspectionDetail } from '@/hooks/useInspectionData';
import {
  addInspectionSignature, approveInspection, createAttachmentUrl, createInspectionFinding,
  saveInspectionResult, uploadInspectionAttachment, voidInspection,
  type InspectionResultDetail, type InspectionResultStatus, type ProjectUnit,
} from '@/lib/supabase/inspectionEntities';
import { cn } from '@/lib/utils';
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
  projects: Array<{ id: string; name: string }>;
  units: ProjectUnit[];
  people: Array<{ userId: string; name: string; email: string }>;
  onBack: () => void;
  onWorkspaceRefresh: () => Promise<unknown>;
}

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
      for (const result of results) {
        await saveInspectionResult({ inspectionId, itemId: result.itemId, status: 'Kunnossa', comment: comments[result.id], measurementValue: result.measurementValue, measurementUnit: result.measurementUnit });
      }
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

  const openAttachment = async (path: string) => {
    try { window.open(await createAttachmentUrl(path), '_blank', 'noopener,noreferrer'); }
    catch (caught) { fail(caught, 'Liitteen avaaminen epäonnistui.'); }
  };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (error || !detail) return <div className="space-y-4"><Button variant="ghost" onClick={onBack}><ChevronLeft size={16} className="mr-1" />Takaisin</Button><Card className="border-red-200"><CardContent className="p-6 text-red-700">{error ?? 'Tarkastusta ei löytynyt.'}</CardContent></Card></div>;

  const openFindings = detail.findings.filter(isFindingOpen);
  const blockingFindings = openFindings.filter((finding) => BLOCKING_SEVERITIES.includes(finding.severity));
  const locked = ['Hyväksytty', 'Mitätöity'].includes(detail.inspection.status);
  const canApprove = canManage && !locked && detail.inspection.progress === 100 && blockingFindings.length === 0;

  return (
    <div className="space-y-5 print:space-y-3">
      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={onBack} className="w-fit"><ChevronLeft size={17} className="mr-1" />Kaikki tarkastukset</Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer size={16} className="mr-2" />Tulosta / PDF</Button>
          {canManage && !locked && <Button variant="outline" onClick={() => setSignatureOpen(true)}><Signature size={16} className="mr-2" />Lisää hyväksyntä</Button>}
          {canApprove && <Button onClick={() => setApprovalOpen(true)}><ShieldCheck size={16} className="mr-2" />Hyväksy tarkastus</Button>}
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
            <p className="mt-1 text-sm text-text-secondary">{detail.inspection.inspectionType} · tarkastaja {personName(people, detail.inspection.inspectorId)}</p>
          </div>
          <div className="w-full sm:w-56"><div className="mb-1 flex justify-between text-sm"><span>Eteneminen</span><strong>{detail.inspection.progress}%</strong></div><Progress value={detail.inspection.progress} /></div>
        </div>
        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-text-muted">Suunniteltu</p><p className="font-medium">{formatDate(detail.inspection.scheduledDate)}</p></div><div><p className="text-text-muted">Aloitettu</p><p className="font-medium">{formatDateTime(detail.inspection.startedAt)}</p></div><div><p className="text-text-muted">Hyväksytty</p><p className="font-medium">{formatDateTime(detail.inspection.approvedAt)}</p></div><div><p className="text-text-muted">Avoimet puutteet</p><p className="font-medium">{openFindings.length}</p></div></div>
        {detail.inspection.summary && <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm"><strong>Yhteenveto:</strong> {detail.inspection.summary}</div>}
      </CardContent></Card>

      {blockingFindings.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Hyväksyntä estetty:</strong> {blockingFindings.length} luovutuksen estävää puutetta on avoinna.</div>}

      {sections.map((results) => <InspectionSectionCard key={results[0].sectionId} results={results} attachments={detail.attachments} canManage={canManage} locked={locked} savingKey={savingKey} comments={comments} onCommentChange={(id, value) => setComments((previous) => ({ ...previous, [id]: value }))} onStatus={saveStatus} onSaveComment={saveComment} onMarkSection={markSectionOkay} onUpload={uploadResult} onOpenAttachment={openAttachment} />)}

      <Card className="print:shadow-none"><CardHeader><CardTitle>Puutteet ja korjaukset</CardTitle></CardHeader><CardContent className="space-y-3">
        {detail.findings.map((finding) => <div key={finding.id} className="rounded-xl border p-4"><div className="flex flex-col gap-3 sm:flex-row sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{finding.title}</h3><Badge className={cn('border-0', severityClasses(finding.severity))}>{finding.severity}</Badge><Badge className={cn('border-0', findingStatusClasses(finding.status))}>{finding.status}</Badge></div><p className="mt-1 text-sm text-text-secondary">{finding.location || 'Sijaintia ei kirjattu'} · määräaika {formatDate(finding.dueDate)}</p>{finding.description && <p className="mt-2 whitespace-pre-wrap text-sm">{finding.description}</p>}{finding.correctionNote && <p className="mt-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Korjaajan ilmoitus: {finding.correctionNote}</p>}{finding.rejectionReason && <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-900">Hylkäyksen syy: {finding.rejectionReason}</p>}</div><div className="text-sm sm:text-right"><p className="text-text-muted">Vastuuhenkilö</p><p className="font-medium">{finding.contractorName || personName(people, finding.assigneeUserId)}</p></div></div><div className="mt-3 flex flex-wrap gap-2">{detail.attachments.filter((attachment) => attachment.findingId === finding.id).map((attachment) => <button key={attachment.id} type="button" onClick={() => void openAttachment(attachment.objectPath)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs hover:bg-slate-50"><ImageIcon size={14} />{attachment.kind}: {attachment.fileName}</button>)}</div></div>)}
        {detail.findings.length === 0 && <p className="text-sm text-text-secondary">Tarkastuksessa ei ole kirjattuja puutteita.</p>}
      </CardContent></Card>

      <Card className="print:shadow-none"><CardHeader><CardTitle className="flex items-center gap-2"><Signature size={18} />Hyväksyntämerkinnät</CardTitle></CardHeader><CardContent className="space-y-2">{detail.signatures.map((signature) => <div key={signature.id} className="rounded-xl border p-4"><div className="flex flex-col gap-1 sm:flex-row sm:justify-between"><div><p className="font-semibold">{signature.signerName}</p><p className="text-sm text-text-secondary">{signature.signerRole}{signature.signerCompany ? ` · ${signature.signerCompany}` : ''}</p></div><p className="text-xs text-text-muted">{formatDateTime(signature.signedAt)}</p></div>{signature.note && <p className="mt-2 text-sm">{signature.note}</p>}</div>)}{detail.signatures.length === 0 && <p className="text-sm text-text-secondary">Ei hyväksyntämerkintöjä.</p>}</CardContent></Card>

      <FindingDialog result={findingResult} people={people} busy={savingKey === 'finding'} onClose={() => setFindingResult(null)} onSubmit={submitFinding} />
      <SignatureDialog open={signatureOpen} busy={savingKey === 'signature'} onClose={() => setSignatureOpen(false)} onSubmit={async (draft) => { setSavingKey('signature'); setOperationError(null); try { await addInspectionSignature({ organizationId, inspectionId, signerName: draft.name, signerRole: draft.role, signerCompany: draft.company, note: draft.note, userId }); setSignatureOpen(false); await refreshAll(); } catch (caught) { fail(caught, 'Hyväksyntämerkinnän tallennus epäonnistui.'); } finally { setSavingKey(null); } }} />
      <ApprovalDialog open={approvalOpen} busy={savingKey === 'approve'} onClose={() => setApprovalOpen(false)} onSubmit={async (summary) => { setSavingKey('approve'); setOperationError(null); try { await approveInspection(inspectionId, summary); setApprovalOpen(false); await refreshAll(); } catch (caught) { fail(caught, 'Hyväksyntä epäonnistui.'); } finally { setSavingKey(null); } }} />
      <VoidDialog open={voidOpen} busy={savingKey === 'void'} onClose={() => setVoidOpen(false)} onSubmit={async (reason) => { setSavingKey('void'); setOperationError(null); try { await voidInspection(inspectionId, reason); setVoidOpen(false); await refreshAll(); } catch (caught) { fail(caught, 'Mitätöinti epäonnistui.'); } finally { setSavingKey(null); } }} />
    </div>
  );
}
