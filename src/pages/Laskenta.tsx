import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Calculator, Download, Edit3, Euro, Plus, Trash2 } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  useFinanceFormsData,
  type Estimate,
  type EstimateLine,
  type EstimateStatus,
} from '@/hooks/useFinanceFormsData';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import logger from '@/lib/logger';
import {
  createEstimate,
  createEstimateLine,
  deleteEstimate,
  deleteEstimateLine,
  updateEstimate,
  updateEstimateLine,
} from '@/lib/supabase/financeFormsEntities';

const ESTIMATE_STATUSES: EstimateStatus[] = ['Luonnos', 'Hyväksytty', 'Arkistoitu'];

interface EstimateForm {
  name: string;
  projectId: string;
  projectName: string;
  status: EstimateStatus;
  vatRate: string;
  overheadPercent: string;
  riskPercent: string;
  marginPercent: string;
  notes: string;
}

interface LineForm {
  category: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
}

const emptyEstimate: EstimateForm = {
  name: '',
  projectId: '',
  projectName: '',
  status: 'Luonnos',
  vatRate: '0',
  overheadPercent: '0',
  riskPercent: '0',
  marginPercent: '0',
  notes: '',
};

const emptyLine: LineForm = {
  category: 'Työ',
  description: '',
  quantity: '1',
  unit: 'h',
  unitPrice: '0',
};

function euroFromCents(cents: number) {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function statusBadge(status: EstimateStatus) {
  const classes: Record<EstimateStatus, string> = {
    Luonnos: 'bg-amber-50 text-amber-700',
    Hyväksytty: 'bg-emerald-50 text-emerald-700',
    Arkistoitu: 'bg-slate-100 text-slate-700',
  };
  return <Badge className={`border-0 ${classes[status]}`}>{status}</Badge>;
}

function calculateTotals(estimate: Estimate, lines: EstimateLine[]) {
  const directCents = Math.round(lines.reduce(
    (sum, line) => sum + line.quantity * line.unitPriceCents,
    0,
  ));
  const overheadCents = Math.round(directCents * estimate.overheadPercent / 100);
  const riskCents = Math.round(directCents * estimate.riskPercent / 100);
  const marginCents = Math.round(directCents * estimate.marginPercent / 100);
  const beforeVatCents = directCents + overheadCents + riskCents + marginCents;
  const vatCents = Math.round(beforeVatCents * estimate.vatRate / 100);
  return {
    directCents,
    overheadCents,
    riskCents,
    marginCents,
    beforeVatCents,
    vatCents,
    totalCents: beforeVatCents + vatCents,
  };
}

export default function Laskenta() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { projects } = useAppDataContext();
  const { estimates, estimateLines, loading, error, refresh } = useFinanceFormsData();
  const [selectedId, setSelectedId] = useState<string>('');
  const [estimateDialogOpen, setEstimateDialogOpen] = useState(false);
  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [editingEstimate, setEditingEstimate] = useState<Estimate | null>(null);
  const [editingLine, setEditingLine] = useState<EstimateLine | null>(null);
  const [deleteEstimateTarget, setDeleteEstimateTarget] = useState<Estimate | null>(null);
  const [deleteLineTarget, setDeleteLineTarget] = useState<EstimateLine | null>(null);
  const [estimateForm, setEstimateForm] = useState<EstimateForm>(emptyEstimate);
  const [lineForm, setLineForm] = useState<LineForm>(emptyLine);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedEstimate = estimates.find((item) => item.id === selectedId) ?? estimates[0] ?? null;
  const selectedLines = useMemo(
    () => selectedEstimate
      ? estimateLines.filter((line) => line.estimateId === selectedEstimate.id)
      : [],
    [estimateLines, selectedEstimate],
  );
  const totals = selectedEstimate ? calculateTotals(selectedEstimate, selectedLines) : null;

  const openEstimateCreate = () => {
    setEditingEstimate(null);
    setEstimateForm(emptyEstimate);
    setFormErrors([]);
    setOperationError(null);
    setEstimateDialogOpen(true);
  };

  const openEstimateEdit = (estimate: Estimate) => {
    setEditingEstimate(estimate);
    setEstimateForm({
      name: estimate.name,
      projectId: estimate.projectId ?? '',
      projectName: estimate.projectName,
      status: estimate.status,
      vatRate: String(estimate.vatRate),
      overheadPercent: String(estimate.overheadPercent),
      riskPercent: String(estimate.riskPercent),
      marginPercent: String(estimate.marginPercent),
      notes: estimate.notes,
    });
    setFormErrors([]);
    setOperationError(null);
    setEstimateDialogOpen(true);
  };

  const selectProject = (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    setEstimateForm((previous) => ({
      ...previous,
      projectId,
      projectName: project?.name ?? previous.projectName,
    }));
  };

  const saveEstimate = async () => {
    const vatRate = Number(estimateForm.vatRate);
    const overheadPercent = Number(estimateForm.overheadPercent);
    const riskPercent = Number(estimateForm.riskPercent);
    const marginPercent = Number(estimateForm.marginPercent);
    const percentages = [vatRate, overheadPercent, riskPercent, marginPercent];
    const nextErrors: string[] = [];
    if (!estimateForm.name.trim()) nextErrors.push('Laskelman nimi on pakollinen.');
    if (percentages.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
      nextErrors.push('Kaikkien prosenttien pitää olla 0–100.');
    }
    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg) return;

    const payload: Omit<Estimate, 'id'> = {
      name: estimateForm.name.trim(),
      projectId: estimateForm.projectId || undefined,
      projectName: estimateForm.projectName.trim(),
      status: estimateForm.status,
      vatRate,
      overheadPercent,
      riskPercent,
      marginPercent,
      notes: estimateForm.notes.trim(),
    };

    setSaving(true);
    setOperationError(null);
    try {
      if (editingEstimate) {
        await updateEstimate(currentOrg.id, editingEstimate.id, payload);
      } else {
        await createEstimate(currentOrg.id, user?.id, payload);
      }
      await refresh();
      setEstimateDialogOpen(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Tallennus epäonnistui.';
      setOperationError(message);
      logger.error('Kustannuslaskelman tallennus epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  const openLineCreate = () => {
    if (!selectedEstimate) return;
    setEditingLine(null);
    setLineForm(emptyLine);
    setFormErrors([]);
    setOperationError(null);
    setLineDialogOpen(true);
  };

  const openLineEdit = (line: EstimateLine) => {
    setEditingLine(line);
    setLineForm({
      category: line.category,
      description: line.description,
      quantity: String(line.quantity),
      unit: line.unit,
      unitPrice: String(line.unitPriceCents / 100),
    });
    setFormErrors([]);
    setOperationError(null);
    setLineDialogOpen(true);
  };

  const saveLine = async () => {
    const quantity = Number(lineForm.quantity);
    const unitPriceEuros = Number(lineForm.unitPrice);
    const nextErrors: string[] = [];
    if (!selectedEstimate) nextErrors.push('Valitse laskelma.');
    if (!lineForm.category.trim()) nextErrors.push('Kustannuslaji on pakollinen.');
    if (!lineForm.description.trim()) nextErrors.push('Kuvaus on pakollinen.');
    if (!Number.isFinite(quantity) || quantity < 0) nextErrors.push('Määrä ei voi olla negatiivinen.');
    if (!lineForm.unit.trim()) nextErrors.push('Yksikkö on pakollinen.');
    if (!Number.isFinite(unitPriceEuros) || unitPriceEuros < 0) nextErrors.push('Yksikköhinta ei voi olla negatiivinen.');
    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg || !selectedEstimate) return;

    const payload: Omit<EstimateLine, 'id'> = {
      estimateId: selectedEstimate.id,
      category: lineForm.category.trim(),
      description: lineForm.description.trim(),
      quantity,
      unit: lineForm.unit.trim(),
      unitPriceCents: Math.round(unitPriceEuros * 100),
    };

    setSaving(true);
    setOperationError(null);
    try {
      if (editingLine) await updateEstimateLine(currentOrg.id, editingLine.id, payload);
      else await createEstimateLine(currentOrg.id, user?.id, payload);
      await refresh();
      setLineDialogOpen(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Tallennus epäonnistui.';
      setOperationError(message);
      logger.error('Kustannusrivin tallennus epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  const removeEstimate = async () => {
    if (!currentOrg || !deleteEstimateTarget) return;
    setSaving(true);
    try {
      await deleteEstimate(currentOrg.id, deleteEstimateTarget.id);
      if (selectedId === deleteEstimateTarget.id) setSelectedId('');
      await refresh();
      setDeleteEstimateTarget(null);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const removeLine = async () => {
    if (!currentOrg || !deleteLineTarget) return;
    setSaving(true);
    try {
      await deleteEstimateLine(currentOrg.id, deleteLineTarget.id);
      await refresh();
      setDeleteLineTarget(null);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    if (!selectedEstimate || !totals) return;
    const rows = selectedLines.map((line) => [
      line.category,
      line.description,
      line.quantity,
      line.unit,
      (line.unitPriceCents / 100).toFixed(2),
      (line.quantity * line.unitPriceCents / 100).toFixed(2),
    ]);
    const summary = [
      ['Suorat kustannukset', (totals.directCents / 100).toFixed(2)],
      [`Yleiskulut ${selectedEstimate.overheadPercent}%`, (totals.overheadCents / 100).toFixed(2)],
      [`Riskivaraus ${selectedEstimate.riskPercent}%`, (totals.riskCents / 100).toFixed(2)],
      [`Kate ${selectedEstimate.marginPercent}%`, (totals.marginCents / 100).toFixed(2)],
      [`ALV ${selectedEstimate.vatRate}%`, (totals.vatCents / 100).toFixed(2)],
      ['Yhteensä', (totals.totalCents / 100).toFixed(2)],
    ];
    const csv = [
      ['Kustannuslaji', 'Kuvaus', 'Määrä', 'Yksikkö', 'Yksikköhinta EUR', 'Yhteensä EUR'],
      ...rows,
      [],
      ...summary,
    ].map((row) => row.map(csvCell).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedEstimate.name.replaceAll(' ', '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-hero text-text-primary">Kustannuslaskenta</h1><p className="mt-1 text-body-sm text-text-secondary">Laskelmat, kustannusrivit, yleiskulut, riskivaraus, kate ja ALV</p></div>
        <Button onClick={openEstimateCreate} className="gap-2"><Plus size={16} /> Uusi laskelma</Button>
      </div>

      {(error || operationError) && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={16} />{operationError ?? error}</div>}

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <Card className="h-fit"><CardContent className="p-3"><div className="space-y-2">{estimates.map((estimate) => { const lines = estimateLines.filter((line) => line.estimateId === estimate.id); const estimateTotals = calculateTotals(estimate, lines); return <button key={estimate.id} type="button" onClick={() => setSelectedId(estimate.id)} className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedEstimate?.id === estimate.id ? 'border-primary bg-primary-light' : 'border-slate-200 hover:bg-slate-50'}`}><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{estimate.name}</p><p className="text-xs text-text-secondary">{estimate.projectName || 'Ei projektia'}</p></div>{statusBadge(estimate.status)}</div><p className="mt-2 font-mono text-sm font-bold">{euroFromCents(estimateTotals.totalCents)}</p></button>; })}{!loading && estimates.length === 0 && <div className="p-8 text-center"><Calculator size={38} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei laskelmia</p></div>}</div></CardContent></Card>

        {selectedEstimate && totals ? <div className="space-y-4">
          <Card><CardContent className="p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><h2 className="text-xl font-bold">{selectedEstimate.name}</h2>{statusBadge(selectedEstimate.status)}</div><p className="mt-1 text-sm text-text-secondary">{selectedEstimate.projectName || 'Ei projektia'} · {selectedEstimate.notes || 'Ei lisätietoja'}</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => openEstimateEdit(selectedEstimate)}><Edit3 size={15} className="mr-1" /> Muokkaa</Button><Button variant="outline" onClick={exportCsv}><Download size={15} className="mr-1" /> CSV</Button><Button variant="ghost" className="text-danger" onClick={() => setDeleteEstimateTarget(selectedEstimate)}><Trash2 size={15} /></Button></div></div></CardContent></Card>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Card><CardContent className="p-4"><p className="text-xs text-text-secondary">Suorat kustannukset</p><p className="mt-1 font-mono text-xl font-bold">{euroFromCents(totals.directCents)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-text-secondary">Lisät yhteensä</p><p className="mt-1 font-mono text-xl font-bold">{euroFromCents(totals.overheadCents + totals.riskCents + totals.marginCents)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-text-secondary">ALV</p><p className="mt-1 font-mono text-xl font-bold">{euroFromCents(totals.vatCents)}</p></CardContent></Card><Card className="border-primary bg-primary-light"><CardContent className="p-4"><p className="text-xs text-primary">Yhteensä</p><p className="mt-1 font-mono text-xl font-bold text-primary">{euroFromCents(totals.totalCents)}</p></CardContent></Card></div>

          <div className="flex justify-end"><Button onClick={openLineCreate} className="gap-2"><Plus size={15} /> Lisää kustannusrivi</Button></div>
          <Card className="overflow-hidden"><CardContent className="p-0"><div className="hidden grid-cols-[150px_1fr_90px_80px_120px_120px_80px] gap-3 border-b bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted lg:grid"><span>Laji</span><span>Kuvaus</span><span>Määrä</span><span>Yks.</span><span>Yks. hinta</span><span>Yhteensä</span><span /></div>{selectedLines.map((line) => <div key={line.id} className="grid grid-cols-1 items-center gap-3 border-b border-slate-100 px-5 py-4 lg:grid-cols-[150px_1fr_90px_80px_120px_120px_80px]"><span className="text-sm font-medium">{line.category}</span><span className="text-sm">{line.description}</span><span className="font-mono text-sm">{line.quantity}</span><span className="text-sm text-text-secondary">{line.unit}</span><span className="font-mono text-sm">{euroFromCents(line.unitPriceCents)}</span><span className="font-mono text-sm font-semibold">{euroFromCents(Math.round(line.quantity * line.unitPriceCents))}</span><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openLineEdit(line)}><Edit3 size={14} /></Button><Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-danger" onClick={() => setDeleteLineTarget(line)}><Trash2 size={14} /></Button></div></div>)}{selectedLines.length === 0 && <div className="p-10 text-center text-sm text-text-secondary">Ei kustannusrivejä.</div>}</CardContent></Card>

          <Card><CardContent className="space-y-2 p-5"><div className="flex justify-between text-sm"><span>Suorat kustannukset</span><span>{euroFromCents(totals.directCents)}</span></div><div className="flex justify-between text-sm"><span>Yleiskulut {selectedEstimate.overheadPercent}%</span><span>{euroFromCents(totals.overheadCents)}</span></div><div className="flex justify-between text-sm"><span>Riskivaraus {selectedEstimate.riskPercent}%</span><span>{euroFromCents(totals.riskCents)}</span></div><div className="flex justify-between text-sm"><span>Kate {selectedEstimate.marginPercent}%</span><span>{euroFromCents(totals.marginCents)}</span></div><div className="flex justify-between border-t pt-2 font-semibold"><span>Veroton summa</span><span>{euroFromCents(totals.beforeVatCents)}</span></div><div className="flex justify-between text-sm"><span>ALV {selectedEstimate.vatRate}%</span><span>{euroFromCents(totals.vatCents)}</span></div><div className="flex justify-between border-t pt-3 text-lg font-bold"><span>Yhteensä</span><span>{euroFromCents(totals.totalCents)}</span></div><p className="pt-2 text-xs text-text-muted">Yleiskulut, riskivaraus ja kate lasketaan kukin suorista kustannuksista. ALV lasketaan verottomasta loppusummasta.</p></CardContent></Card>
        </div> : <Card><CardContent className="p-12 text-center"><Euro size={42} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Valitse tai luo laskelma</p></CardContent></Card>}
      </div>

      <Dialog open={estimateDialogOpen} onOpenChange={setEstimateDialogOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{editingEstimate ? 'Muokkaa laskelmaa' : 'Uusi laskelma'}</DialogTitle></DialogHeader>{formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}<div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="estimate-name">Nimi *</Label><Input id="estimate-name" value={estimateForm.name} onChange={(event) => setEstimateForm((previous) => ({ ...previous, name: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label>Projekti</Label>{projects.length > 0 ? <Select value={estimateForm.projectId} onValueChange={selectProject}><SelectTrigger><SelectValue placeholder="Valitse projekti" /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select> : <Input value={estimateForm.projectName} onChange={(event) => setEstimateForm((previous) => ({ ...previous, projectName: event.target.value }))} />}</div><div className="space-y-2"><Label>Tila</Label><Select value={estimateForm.status} onValueChange={(status: EstimateStatus) => setEstimateForm((previous) => ({ ...previous, status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ESTIMATE_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="estimate-vat">ALV %</Label><Input id="estimate-vat" type="number" min="0" max="100" step="0.1" value={estimateForm.vatRate} onChange={(event) => setEstimateForm((previous) => ({ ...previous, vatRate: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="estimate-overhead">Yleiskulut %</Label><Input id="estimate-overhead" type="number" min="0" max="100" step="0.1" value={estimateForm.overheadPercent} onChange={(event) => setEstimateForm((previous) => ({ ...previous, overheadPercent: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="estimate-risk">Riskivaraus %</Label><Input id="estimate-risk" type="number" min="0" max="100" step="0.1" value={estimateForm.riskPercent} onChange={(event) => setEstimateForm((previous) => ({ ...previous, riskPercent: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="estimate-margin">Kate %</Label><Input id="estimate-margin" type="number" min="0" max="100" step="0.1" value={estimateForm.marginPercent} onChange={(event) => setEstimateForm((previous) => ({ ...previous, marginPercent: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="estimate-notes">Huomiot</Label><Textarea id="estimate-notes" value={estimateForm.notes} onChange={(event) => setEstimateForm((previous) => ({ ...previous, notes: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setEstimateDialogOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void saveEstimate()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={lineDialogOpen} onOpenChange={setLineDialogOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{editingLine ? 'Muokkaa kustannusriviä' : 'Uusi kustannusrivi'}</DialogTitle></DialogHeader>{formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}<div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="line-category">Kustannuslaji *</Label><Input id="line-category" value={lineForm.category} onChange={(event) => setLineForm((previous) => ({ ...previous, category: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="line-description">Kuvaus *</Label><Input id="line-description" value={lineForm.description} onChange={(event) => setLineForm((previous) => ({ ...previous, description: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="line-quantity">Määrä</Label><Input id="line-quantity" type="number" min="0" step="0.01" value={lineForm.quantity} onChange={(event) => setLineForm((previous) => ({ ...previous, quantity: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="line-unit">Yksikkö *</Label><Input id="line-unit" value={lineForm.unit} onChange={(event) => setLineForm((previous) => ({ ...previous, unit: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="line-price">Yksikköhinta €</Label><Input id="line-price" type="number" min="0" step="0.01" value={lineForm.unitPrice} onChange={(event) => setLineForm((previous) => ({ ...previous, unitPrice: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setLineDialogOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void saveLine()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(deleteEstimateTarget)} onOpenChange={(open) => !open && setDeleteEstimateTarget(null)}><DialogContent><DialogHeader><DialogTitle>Poista laskelma</DialogTitle></DialogHeader><p className="text-sm text-text-secondary">Poistetaanko laskelma <strong>{deleteEstimateTarget?.name}</strong> ja kaikki sen kustannusrivit?</p><DialogFooter><Button variant="outline" onClick={() => setDeleteEstimateTarget(null)}>Peruuta</Button><Button variant="destructive" onClick={() => void removeEstimate()} disabled={saving}>Poista</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={Boolean(deleteLineTarget)} onOpenChange={(open) => !open && setDeleteLineTarget(null)}><DialogContent><DialogHeader><DialogTitle>Poista kustannusrivi</DialogTitle></DialogHeader><p className="text-sm text-text-secondary">Poistetaanko <strong>{deleteLineTarget?.description}</strong>?</p><DialogFooter><Button variant="outline" onClick={() => setDeleteLineTarget(null)}>Peruuta</Button><Button variant="destructive" onClick={() => void removeLine()} disabled={saving}>Poista</Button></DialogFooter></DialogContent></Dialog>
    </motion.div>
  );
}
