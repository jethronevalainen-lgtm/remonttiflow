import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  FilePenLine,
  GitBranch,
  Loader2,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  createPayrollCorrectionRequest,
  deletePayrollCorrectionLine,
  listPayrollCorrectionEmployees,
  listPayrollCorrectionLines,
  listPayrollCorrectionPeriods,
  listPayrollCorrectionRequests,
  listPayrollCorrectionVersions,
  reviewPayrollCorrectionRequest,
  savePayrollCorrectionLine,
  submitPayrollCorrectionRequest,
  type PayrollCorrectionCategory,
  type PayrollCorrectionDirection,
  type PayrollCorrectionEmployee,
  type PayrollCorrectionLine,
  type PayrollCorrectionPeriod,
  type PayrollCorrectionRequest,
  type PayrollCorrectionSourceType,
  type PayrollCorrectionStatus,
  type PayrollCorrectionVersion,
} from '@/lib/supabase/payrollCorrections';

interface LineForm {
  employeeId: string;
  direction: PayrollCorrectionDirection;
  category: PayrollCorrectionCategory;
  amount: string;
  description: string;
  effectiveDate: string;
  sourceType: PayrollCorrectionSourceType;
}

const CATEGORIES: PayrollCorrectionCategory[] = ['Palkka', 'Ylityö', 'Lisä', 'Matkakulu', 'Muu'];
const SOURCES: PayrollCorrectionSourceType[] = ['Manuaalinen', 'Tuntikirjaus', 'Matkakulu'];

function euro(cents: number) {
  return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('fi-FI').format(new Date(`${value}T00:00:00`));
}

function dateTimeLabel(value?: string) {
  if (!value) return 'Ei tietoa';
  return new Intl.DateTimeFormat('fi-FI', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function statusBadge(status: PayrollCorrectionStatus) {
  const classes: Record<PayrollCorrectionStatus, string> = {
    Luonnos: 'bg-slate-100 text-slate-700',
    'Odottaa hyväksyntää': 'bg-amber-50 text-amber-800',
    Hyväksytty: 'bg-emerald-50 text-emerald-800',
    Hylätty: 'bg-red-50 text-red-800',
  };
  return <Badge className={`border-0 ${classes[status]}`}>{status}</Badge>;
}

function blankLine(period?: PayrollCorrectionPeriod, employeeId = ''): LineForm {
  return {
    employeeId,
    direction: 'Lisäys',
    category: 'Muu',
    amount: '',
    description: '',
    effectiveDate: period?.periodEnd ?? '',
    sourceType: 'Manuaalinen',
  };
}

export default function PayrollCorrectionsPanel() {
  const { currentOrg, currentRole } = useOrganization();
  const [periods, setPeriods] = useState<PayrollCorrectionPeriod[]>([]);
  const [employees, setEmployees] = useState<PayrollCorrectionEmployee[]>([]);
  const [requests, setRequests] = useState<PayrollCorrectionRequest[]>([]);
  const [versions, setVersions] = useState<PayrollCorrectionVersion[]>([]);
  const [lines, setLines] = useState<PayrollCorrectionLine[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const [lineOpen, setLineOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<PayrollCorrectionLine | null>(null);
  const [lineForm, setLineForm] = useState<LineForm>(() => blankLine());
  const [deleteTarget, setDeleteTarget] = useState<PayrollCorrectionLine | null>(null);
  const [submitTarget, setSubmitTarget] = useState<PayrollCorrectionRequest | null>(null);
  const [reviewTarget, setReviewTarget] = useState<PayrollCorrectionRequest | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'approve' | 'reject'>('approve');
  const [reviewNote, setReviewNote] = useState('');

  const isAdmin = currentRole === 'admin';
  const selectedPeriod = periods.find((period) => period.id === selectedPeriodId);
  const selectedRequest = requests.find((request) => request.id === selectedRequestId);
  const pendingCount = requests.filter((request) => request.status === 'Odottaa hyväksyntää').length;
  const draftCount = requests.filter((request) => request.status === 'Luonnos').length;
  const correctionTotal = useMemo(
    () => versions.reduce((sum, version) => sum + version.adjustmentTotalCents, 0),
    [versions],
  );

  const loadPeriods = useCallback(async () => {
    if (!currentOrg) {
      setPeriods([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await listPayrollCorrectionPeriods(currentOrg.id);
      setPeriods(next);
      setSelectedPeriodId((current) => current && next.some((period) => period.id === current)
        ? current
        : next[0]?.id ?? '');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Palkkakorjausten haku epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [currentOrg]);

  const loadSelectedPeriod = useCallback(async () => {
    if (!currentOrg || !selectedPeriodId) {
      setEmployees([]);
      setRequests([]);
      setVersions([]);
      return;
    }
    setError(null);
    try {
      const [nextEmployees, nextRequests, nextVersions] = await Promise.all([
        listPayrollCorrectionEmployees(currentOrg.id, selectedPeriodId),
        listPayrollCorrectionRequests(currentOrg.id, selectedPeriodId),
        isAdmin ? listPayrollCorrectionVersions(currentOrg.id, selectedPeriodId) : Promise.resolve([]),
      ]);
      setEmployees(nextEmployees);
      setRequests(nextRequests);
      setVersions(nextVersions);
      setSelectedRequestId((current) => current && nextRequests.some((request) => request.id === current)
        ? current
        : nextRequests[0]?.id ?? '');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Palkkakauden korjaustietojen haku epäonnistui.');
    }
  }, [currentOrg, isAdmin, selectedPeriodId]);

  const loadLines = useCallback(async () => {
    if (!selectedRequestId) {
      setLines([]);
      return;
    }
    try {
      setLines(await listPayrollCorrectionLines(selectedRequestId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Korjausrivien haku epäonnistui.');
    }
  }, [selectedRequestId]);

  useEffect(() => { void loadPeriods(); }, [loadPeriods]);
  useEffect(() => { void loadSelectedPeriod(); }, [loadSelectedPeriod]);
  useEffect(() => { void loadLines(); }, [loadLines]);

  const refreshAll = async () => {
    await loadPeriods();
    await loadSelectedPeriod();
    await loadLines();
  };

  const createRequest = async () => {
    if (!currentOrg || !selectedPeriod) return;
    if (requestReason.trim().length < 10) {
      setError('Korjauksen syyn pitää olla vähintään 10 merkkiä.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const id = await createPayrollCorrectionRequest({
        organizationId: currentOrg.id,
        payrollPeriodId: selectedPeriod.id,
        reason: requestReason.trim(),
      });
      setRequestOpen(false);
      setRequestReason('');
      await loadSelectedPeriod();
      setSelectedRequestId(id);
      setSuccess('Korjauspyyntö luotiin luonnokseksi. Lisää vähintään yksi korjausrivi.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Korjauspyynnön luonti epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const openLineCreate = () => {
    setEditingLine(null);
    setLineForm(blankLine(selectedPeriod, employees[0]?.employeeId));
    setError(null);
    setLineOpen(true);
  };

  const openLineEdit = (line: PayrollCorrectionLine) => {
    setEditingLine(line);
    setLineForm({
      employeeId: line.employeeId,
      direction: line.direction,
      category: line.category,
      amount: new Intl.NumberFormat('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(line.amountCents / 100),
      description: line.description,
      effectiveDate: line.effectiveDate,
      sourceType: line.sourceType ?? 'Manuaalinen',
    });
    setError(null);
    setLineOpen(true);
  };

  const saveLine = async () => {
    if (!selectedRequest || !selectedPeriod) return;
    const amount = Number(lineForm.amount.replace(/\s/g, '').replace(',', '.'));
    const amountCents = Math.round(amount * 100);
    if (!lineForm.employeeId) {
      setError('Valitse työntekijä.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0 || amountCents < 1) {
      setError('Korjaussumman pitää olla positiivinen euromäärä.');
      return;
    }
    if (lineForm.description.trim().length < 3) {
      setError('Korjausrivin kuvauksen pitää olla vähintään 3 merkkiä.');
      return;
    }
    if (!lineForm.effectiveDate) {
      setError('Korjauksen päivämäärä puuttuu.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await savePayrollCorrectionLine({
        requestId: selectedRequest.id,
        lineId: editingLine?.id,
        employeeId: lineForm.employeeId,
        direction: lineForm.direction,
        category: lineForm.category,
        amountCents,
        description: lineForm.description.trim(),
        effectiveDate: lineForm.effectiveDate,
        sourceType: lineForm.sourceType,
      });
      setLineOpen(false);
      setEditingLine(null);
      await loadSelectedPeriod();
      await loadLines();
      setSuccess(editingLine ? 'Korjausrivi päivitettiin.' : 'Korjausrivi lisättiin.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Korjausrivin tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const deleteLine = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setError(null);
    try {
      await deletePayrollCorrectionLine(deleteTarget.id);
      setDeleteTarget(null);
      await loadSelectedPeriod();
      await loadLines();
      setSuccess('Korjausrivi poistettiin.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Korjausrivin poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const submitRequest = async () => {
    if (!submitTarget) return;
    setSaving(true);
    setError(null);
    try {
      await submitPayrollCorrectionRequest(submitTarget.id);
      setSubmitTarget(null);
      await loadSelectedPeriod();
      setSuccess('Korjauspyyntö lähetettiin adminin hyväksyttäväksi. Rivejä ei voi enää muuttaa.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Korjauspyynnön lähettäminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const reviewRequest = async () => {
    if (!reviewTarget || !isAdmin) return;
    if (reviewDecision === 'reject' && reviewNote.trim().length < 3) {
      setError('Hylkäyksen perustelun pitää olla vähintään 3 merkkiä.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await reviewPayrollCorrectionRequest({
        requestId: reviewTarget.id,
        decision: reviewDecision,
        reviewNote: reviewNote.trim() || undefined,
      });
      setReviewTarget(null);
      setReviewNote('');
      await refreshAll();
      setSuccess(reviewDecision === 'approve'
        ? 'Korjaus hyväksyttiin ja uusi muuttumaton palkkakausiversio luotiin.'
        : 'Korjauspyyntö hylättiin.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Korjauspyynnön käsittely epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Card><CardContent className="flex min-h-48 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></CardContent></Card>;
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2"><GitBranch className="text-primary" size={22} /><h2 className="text-2xl font-bold text-text-primary">Lukitun palkkakauden korjaukset</h2></div>
          <p className="mt-1 max-w-3xl text-sm text-text-secondary">Alkuperäistä snapshotia ei muuteta. Hyväksytty korjaus luo uuden version, lisäys- tai hyvitysrivit ja täydellisen käsittelyhistorian.</p>
        </div>
        {selectedPeriod && <Button className="gap-2" onClick={() => { setRequestReason(''); setRequestOpen(true); }}><Plus size={16} />Uusi korjauspyyntö</Button>}
      </div>

      {error && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertTriangle size={18} className="shrink-0" />{error}</div>}
      {success && <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={18} className="shrink-0" />{success}</div>}

      {periods.length === 0 ? (
        <Card><CardContent className="p-10 text-center"><FilePenLine size={40} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei lukittuja palkkakausia</p><p className="mt-1 text-sm text-text-secondary">Korjausketju tulee käyttöön, kun ensimmäinen palkkakausi lukitaan.</p></CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle className="text-lg">Valitse palkkakausi</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {periods.map((period) => (
                <button
                  key={period.id}
                  type="button"
                  onClick={() => setSelectedPeriodId(period.id)}
                  className={`rounded-xl border p-4 text-left transition ${selectedPeriodId === period.id ? 'border-primary bg-primary-light/40 ring-1 ring-primary' : 'border-slate-200 hover:border-primary/50'}`}
                >
                  <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{dateLabel(period.periodStart)}–{dateLabel(period.periodEnd)}</p><p className="mt-1 text-xs text-text-secondary">{period.employeeCount} työntekijää · lukittu {dateTimeLabel(period.lockedAt)}</p></div><Badge variant="outline">v{period.correctionVersion}</Badge></div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs"><div><p className="text-text-secondary">Alkuperäinen</p><p className="font-mono font-semibold">{euro(period.baseTotalCents)}</p></div><div><p className="text-text-secondary">Korjaukset</p><p className={`font-mono font-semibold ${period.correctionTotalCents < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{period.correctionTotalCents > 0 ? '+' : ''}{euro(period.correctionTotalCents)}</p></div><div><p className="text-text-secondary">Korjattu</p><p className="font-mono font-semibold">{euro(period.correctedTotalCents)}</p></div></div>
                  {period.openRequestCount > 0 && <p className="mt-3 text-xs font-medium text-amber-800">{period.openRequestCount} avoinna olevaa pyyntöä</p>}
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card><CardContent className="p-4"><div className="flex items-center justify-between text-xs text-text-secondary"><span>Luonnokset</span><FilePenLine size={17} className="text-primary" /></div><p className="mt-2 font-mono text-2xl font-bold">{draftCount}</p></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center justify-between text-xs text-text-secondary"><span>Odottaa hyväksyntää</span><ShieldCheck size={17} className="text-primary" /></div><p className="mt-2 font-mono text-2xl font-bold">{pendingCount}</p></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center justify-between text-xs text-text-secondary"><span>Hyväksytyt korjaukset</span><CircleDollarSign size={17} className="text-primary" /></div><p className={`mt-2 font-mono text-2xl font-bold ${correctionTotal < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{correctionTotal > 0 ? '+' : ''}{euro(correctionTotal)}</p></CardContent></Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
            <Card className="overflow-hidden">
              <CardHeader><CardTitle className="text-lg">Korjauspyynnöt</CardTitle></CardHeader>
              <CardContent className="p-0">
                {requests.map((request) => (
                  <button key={request.id} type="button" onClick={() => setSelectedRequestId(request.id)} className={`w-full border-t p-4 text-left first:border-t-0 ${selectedRequestId === request.id ? 'bg-primary-light/40' : 'hover:bg-slate-50'}`}>
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0 break-words"><p className="font-medium">{request.requesterName}</p><p className="mt-1 whitespace-pre-wrap text-xs text-text-secondary">{request.reason}</p></div>{statusBadge(request.status)}</div>
                    <div className="mt-3 flex items-center justify-between text-xs"><span>{request.lineCount} riviä</span><span className={`font-mono font-semibold ${request.adjustmentTotalCents < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{request.adjustmentTotalCents > 0 ? '+' : ''}{euro(request.adjustmentTotalCents)}</span></div>
                  </button>
                ))}
                {requests.length === 0 && <div className="p-8 text-center text-sm text-text-secondary">Tälle kaudelle ei ole korjauspyyntöjä.</div>}
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle className="text-lg">Pyynnön sisältö</CardTitle>{selectedRequest && <p className="mt-1 text-xs text-text-secondary">Luotu {dateTimeLabel(selectedRequest.createdAt)} · {selectedRequest.requesterName}</p>}</div>{selectedRequest && statusBadge(selectedRequest.status)}</CardHeader>
              <CardContent className="p-0">
                {!selectedRequest ? <div className="p-10 text-center text-sm text-text-secondary">Valitse korjauspyyntö.</div> : (
                  <>
                    <div className="border-t p-5"><p className="text-sm font-medium">Korjauksen syy</p><p className="mt-1 text-sm text-text-secondary">{selectedRequest.reason}</p>{selectedRequest.reviewNote && <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm"><strong>Käsittelymerkintä:</strong> {selectedRequest.reviewNote}</div>}</div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3"><div className="text-sm"><strong>{selectedRequest.lineCount} riviä</strong> · yhteismuutos <span className={selectedRequest.adjustmentTotalCents < 0 ? 'text-red-700' : 'text-emerald-700'}>{selectedRequest.adjustmentTotalCents > 0 ? '+' : ''}{euro(selectedRequest.adjustmentTotalCents)}</span></div>{selectedRequest.status === 'Luonnos' && <Button size="sm" variant="outline" className="gap-2" onClick={openLineCreate}><Plus size={14} />Lisää rivi</Button>}</div>
                    {lines.map((line) => <div key={line.id} className="grid gap-3 border-t px-5 py-4 text-sm md:grid-cols-[110px_1fr_130px_auto] md:items-center"><div><p>{dateLabel(line.effectiveDate)}</p><Badge variant="outline" className="mt-1">{line.category}</Badge></div><div><p className="font-medium">{line.employeeName}</p><p className="text-xs text-text-secondary">{line.description} · {line.sourceType || 'Ei lähdettä'}</p></div><p className={`font-mono font-semibold ${line.direction === 'Hyvitys' ? 'text-red-700' : 'text-emerald-700'}`}>{line.direction === 'Lisäys' ? '+' : '−'}{euro(line.amountCents)}</p>{selectedRequest.status === 'Luonnos' && <div className="flex justify-end gap-1"><Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openLineEdit(line)} aria-label="Muokkaa korjausriviä"><Pencil size={14} /></Button><Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-700" onClick={() => setDeleteTarget(line)} aria-label="Poista korjausrivi"><Trash2 size={14} /></Button></div>}</div>)}
                    {lines.length === 0 && <div className="border-t p-8 text-center text-sm text-text-secondary">Korjausrivejä ei ole vielä lisätty.</div>}
                    <div className="flex flex-wrap justify-end gap-2 border-t bg-slate-50 px-5 py-4">
                      {selectedRequest.status === 'Luonnos' && <Button className="gap-2" disabled={selectedRequest.lineCount < 1 || selectedRequest.adjustmentTotalCents === 0} onClick={() => setSubmitTarget(selectedRequest)}><Send size={15} />Lähetä hyväksyttäväksi</Button>}
                      {isAdmin && selectedRequest.status === 'Odottaa hyväksyntää' && <><Button variant="outline" className="gap-2 text-red-700" onClick={() => { setReviewDecision('reject'); setReviewNote(''); setReviewTarget(selectedRequest); }}><XCircle size={15} />Hylkää</Button><Button className="gap-2" onClick={() => { setReviewDecision('approve'); setReviewNote(''); setReviewTarget(selectedRequest); }}><CheckCircle2 size={15} />Hyväksy ja versioi</Button></>}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {isAdmin && <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><GitBranch size={18} className="text-primary" />Muuttumattomat korjausversiot</CardTitle></CardHeader>
            <CardContent className="p-0">
              {versions.map((version) => <div key={version.id} className="grid gap-3 border-t px-5 py-4 text-sm first:border-t-0 lg:grid-cols-[90px_1fr_150px_150px_180px] lg:items-center"><Badge className="w-fit border-0 bg-indigo-50 text-indigo-800">Versio {version.versionNumber}</Badge><div><p className="font-medium">{version.reason}</p><p className="text-xs text-text-secondary">{version.lineCount} riviä · {version.employeeCount} työntekijää · {version.approverName}</p></div><div><p className="text-xs text-text-secondary">Tämän version muutos</p><p className={`font-mono font-semibold ${version.adjustmentTotalCents < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{version.adjustmentTotalCents > 0 ? '+' : ''}{euro(version.adjustmentTotalCents)}</p></div><div><p className="text-xs text-text-secondary">Korjattu yhteensä</p><p className="font-mono font-semibold">{euro(version.correctedTotalCents)}</p></div><p className="text-text-secondary">Hyväksytty {dateTimeLabel(version.approvedAt)}</p></div>)}
              {versions.length === 0 && <div className="p-8 text-center text-sm text-text-secondary">Hyväksyttyjä korjausversioita ei ole.</div>}
            </CardContent>
          </Card>}
        </>
      )}

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Uusi korjauspyyntö</DialogTitle></DialogHeader><div className="space-y-2"><Label htmlFor="correction-reason">Korjauksen syy *</Label><Textarea id="correction-reason" value={requestReason} onChange={(event) => setRequestReason(event.target.value)} rows={5} maxLength={2000} placeholder="Kuvaa mitä lukitussa palkka-aineistossa pitää korjata ja miksi." /></div><DialogFooter><Button variant="outline" onClick={() => setRequestOpen(false)}>Peruuta</Button><Button onClick={() => void createRequest()} disabled={saving}>{saving ? 'Luodaan…' : 'Luo luonnos'}</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={lineOpen} onOpenChange={setLineOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{editingLine ? 'Muokkaa korjausriviä' : 'Lisää korjausrivi'}</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Työntekijä *</Label><Select value={lineForm.employeeId} onValueChange={(value) => setLineForm((current) => ({ ...current, employeeId: value }))}><SelectTrigger><SelectValue placeholder="Valitse työntekijä" /></SelectTrigger><SelectContent>{employees.map((employee) => <SelectItem key={employee.employeeId} value={employee.employeeId}>{employee.employeeName} · nykyinen {euro(employee.correctedTotalCents)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Suunta *</Label><Select value={lineForm.direction} onValueChange={(value: PayrollCorrectionDirection) => setLineForm((current) => ({ ...current, direction: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Lisäys">Lisäys</SelectItem><SelectItem value="Hyvitys">Hyvitys</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Luokka *</Label><Select value={lineForm.category} onValueChange={(value: PayrollCorrectionCategory) => setLineForm((current) => ({ ...current, category: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="correction-amount">Summa € *</Label><Input id="correction-amount" inputMode="decimal" value={lineForm.amount} onChange={(event) => setLineForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0,00" /></div><div className="space-y-2"><Label htmlFor="correction-date">Kohdistuspäivä *</Label><Input id="correction-date" type="date" min={selectedPeriod?.periodStart} max={selectedPeriod?.periodEnd} value={lineForm.effectiveDate} onChange={(event) => setLineForm((current) => ({ ...current, effectiveDate: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label>Lähde</Label><Select value={lineForm.sourceType} onValueChange={(value: PayrollCorrectionSourceType) => setLineForm((current) => ({ ...current, sourceType: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SOURCES.map((source) => <SelectItem key={source} value={source}>{source}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="correction-description">Kuvaus *</Label><Textarea id="correction-description" value={lineForm.description} onChange={(event) => setLineForm((current) => ({ ...current, description: event.target.value }))} rows={4} maxLength={1000} /></div></div><DialogFooter><Button variant="outline" onClick={() => setLineOpen(false)}>Peruuta</Button><Button onClick={() => void saveLine()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna rivi'}</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={Boolean(reviewTarget)} onOpenChange={(open) => { if (!open) setReviewTarget(null); }}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{reviewDecision === 'approve' ? 'Hyväksy ja luo uusi versio' : 'Hylkää korjauspyyntö'}</DialogTitle></DialogHeader><div className="space-y-3">{reviewTarget && <div className="rounded-lg bg-slate-50 p-3 text-sm"><p>{reviewTarget.reason}</p><p className={`mt-2 font-mono font-semibold ${reviewTarget.adjustmentTotalCents < 0 ? 'text-red-700' : 'text-emerald-700'}`}>Yhteismuutos {reviewTarget.adjustmentTotalCents > 0 ? '+' : ''}{euro(reviewTarget.adjustmentTotalCents)}</p></div>}<div className="space-y-2"><Label htmlFor="review-note">{reviewDecision === 'reject' ? 'Hylkäyksen perustelu *' : 'Tarkistusmerkintä'}</Label><Textarea id="review-note" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={4} maxLength={1000} /></div>{reviewDecision === 'approve' && <p className="text-xs text-text-secondary">Hyväksyntä kopioi korjausrivit muuttumattomaan versioon. Alkuperäistä palkkakausisnapshotia ei muuteta.</p>}</div><DialogFooter><Button variant="outline" onClick={() => setReviewTarget(null)}>Peruuta</Button><Button variant={reviewDecision === 'reject' ? 'destructive' : 'default'} onClick={() => void reviewRequest()} disabled={saving}>{saving ? 'Käsitellään…' : reviewDecision === 'approve' ? 'Hyväksy ja versioi' : 'Hylkää pyyntö'}</Button></DialogFooter></DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Poistetaanko korjausrivi?</AlertDialogTitle><AlertDialogDescription>Rivi poistetaan luonnoksesta. Lähetettyä tai käsiteltyä korjauspyyntöä ei voi muuttaa.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => void deleteLine()}>Poista</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

      <AlertDialog open={Boolean(submitTarget)} onOpenChange={(open) => { if (!open) setSubmitTarget(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Lähetetäänkö korjauspyyntö?</AlertDialogTitle><AlertDialogDescription>Lähettämisen jälkeen rivejä ei voi enää muuttaa. Admin hyväksyy tai hylkää pyynnön erikseen.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction onClick={() => void submitRequest()}>Lähetä hyväksyttäväksi</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </section>
  );
}
