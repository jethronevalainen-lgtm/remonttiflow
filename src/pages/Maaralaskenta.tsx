import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Download, Edit3, Plus, Ruler, Trash2 } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  useFinanceFormsData,
  type QuantityTakeoff,
  type QuantityTakeoffLine,
  type TakeoffStatus,
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
  createTakeoff,
  createTakeoffLine,
  deleteTakeoff,
  deleteTakeoffLine,
  updateTakeoff,
  updateTakeoffLine,
} from '@/lib/supabase/financeFormsEntities';

const TAKEOFF_STATUSES: TakeoffStatus[] = ['Luonnos', 'Valmis', 'Arkistoitu'];

interface TakeoffForm {
  name: string;
  projectId: string;
  projectName: string;
  status: TakeoffStatus;
  notes: string;
}

interface LineForm {
  workPhase: string;
  description: string;
  quantity: string;
  unit: string;
  wastePercent: string;
  notes: string;
}

const emptyTakeoff: TakeoffForm = {
  name: '',
  projectId: '',
  projectName: '',
  status: 'Luonnos',
  notes: '',
};

const emptyLine: LineForm = {
  workPhase: '',
  description: '',
  quantity: '',
  unit: 'm²',
  wastePercent: '0',
  notes: '',
};

function statusBadge(status: TakeoffStatus) {
  const classes: Record<TakeoffStatus, string> = {
    Luonnos: 'bg-amber-50 text-amber-700',
    Valmis: 'bg-emerald-50 text-emerald-700',
    Arkistoitu: 'bg-slate-100 text-slate-700',
  };
  return <Badge className={`border-0 ${classes[status]}`}>{status}</Badge>;
}

function effectiveQuantity(line: QuantityTakeoffLine) {
  return line.quantity * (1 + line.wastePercent / 100);
}

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export default function Maaralaskenta() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { projects } = useAppDataContext();
  const { takeoffs, takeoffLines, loading, error, refresh } = useFinanceFormsData();
  const [selectedId, setSelectedId] = useState('');
  const [takeoffDialogOpen, setTakeoffDialogOpen] = useState(false);
  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [editingTakeoff, setEditingTakeoff] = useState<QuantityTakeoff | null>(null);
  const [editingLine, setEditingLine] = useState<QuantityTakeoffLine | null>(null);
  const [deleteTakeoffTarget, setDeleteTakeoffTarget] = useState<QuantityTakeoff | null>(null);
  const [deleteLineTarget, setDeleteLineTarget] = useState<QuantityTakeoffLine | null>(null);
  const [takeoffForm, setTakeoffForm] = useState<TakeoffForm>(emptyTakeoff);
  const [lineForm, setLineForm] = useState<LineForm>(emptyLine);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedTakeoff = takeoffs.find((item) => item.id === selectedId) ?? takeoffs[0] ?? null;
  const selectedLines = useMemo(
    () => selectedTakeoff
      ? takeoffLines.filter((line) => line.takeoffId === selectedTakeoff.id)
      : [],
    [selectedTakeoff, takeoffLines],
  );
  const phaseGroups = useMemo(() => {
    const groups = new Map<string, QuantityTakeoffLine[]>();
    selectedLines.forEach((line) => {
      groups.set(line.workPhase, [...(groups.get(line.workPhase) ?? []), line]);
    });
    return [...groups.entries()];
  }, [selectedLines]);

  const openTakeoffCreate = () => {
    setEditingTakeoff(null);
    setTakeoffForm(emptyTakeoff);
    setFormErrors([]);
    setOperationError(null);
    setTakeoffDialogOpen(true);
  };

  const openTakeoffEdit = (takeoff: QuantityTakeoff) => {
    setEditingTakeoff(takeoff);
    setTakeoffForm({
      name: takeoff.name,
      projectId: takeoff.projectId ?? '',
      projectName: takeoff.projectName,
      status: takeoff.status,
      notes: takeoff.notes,
    });
    setFormErrors([]);
    setOperationError(null);
    setTakeoffDialogOpen(true);
  };

  const saveTakeoff = async () => {
    const nextErrors: string[] = [];
    if (!takeoffForm.name.trim()) nextErrors.push('Määrälaskelman nimi on pakollinen.');
    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg) return;

    const payload: Omit<QuantityTakeoff, 'id'> = {
      name: takeoffForm.name.trim(),
      projectId: takeoffForm.projectId || undefined,
      projectName: takeoffForm.projectName.trim(),
      status: takeoffForm.status,
      notes: takeoffForm.notes.trim(),
    };
    setSaving(true);
    setOperationError(null);
    try {
      if (editingTakeoff) await updateTakeoff(currentOrg.id, editingTakeoff.id, payload);
      else await createTakeoff(currentOrg.id, user?.id, payload);
      await refresh();
      setTakeoffDialogOpen(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Tallennus epäonnistui.';
      setOperationError(message);
      logger.error('Määrälaskelman tallennus epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  const openLineCreate = () => {
    if (!selectedTakeoff) return;
    setEditingLine(null);
    setLineForm(emptyLine);
    setFormErrors([]);
    setOperationError(null);
    setLineDialogOpen(true);
  };

  const openLineEdit = (line: QuantityTakeoffLine) => {
    setEditingLine(line);
    setLineForm({
      workPhase: line.workPhase,
      description: line.description,
      quantity: String(line.quantity),
      unit: line.unit,
      wastePercent: String(line.wastePercent),
      notes: line.notes,
    });
    setFormErrors([]);
    setOperationError(null);
    setLineDialogOpen(true);
  };

  const saveLine = async () => {
    const quantity = Number(lineForm.quantity);
    const wastePercent = Number(lineForm.wastePercent);
    const nextErrors: string[] = [];
    if (!selectedTakeoff) nextErrors.push('Valitse määrälaskelma.');
    if (!lineForm.workPhase.trim()) nextErrors.push('Työvaihe on pakollinen.');
    if (!lineForm.description.trim()) nextErrors.push('Kuvaus on pakollinen.');
    if (!Number.isFinite(quantity) || quantity < 0) nextErrors.push('Määrä ei voi olla negatiivinen.');
    if (!lineForm.unit.trim()) nextErrors.push('Yksikkö on pakollinen.');
    if (!Number.isFinite(wastePercent) || wastePercent < 0 || wastePercent > 100) {
      nextErrors.push('Hukan pitää olla 0–100 %.');
    }
    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg || !selectedTakeoff) return;

    const payload: Omit<QuantityTakeoffLine, 'id'> = {
      takeoffId: selectedTakeoff.id,
      workPhase: lineForm.workPhase.trim(),
      description: lineForm.description.trim(),
      quantity,
      unit: lineForm.unit.trim(),
      wastePercent,
      notes: lineForm.notes.trim(),
    };
    setSaving(true);
    setOperationError(null);
    try {
      if (editingLine) await updateTakeoffLine(currentOrg.id, editingLine.id, payload);
      else await createTakeoffLine(currentOrg.id, user?.id, payload);
      await refresh();
      setLineDialogOpen(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Tallennus epäonnistui.';
      setOperationError(message);
      logger.error('Määrärivin tallennus epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  const removeTakeoff = async () => {
    if (!currentOrg || !deleteTakeoffTarget) return;
    setSaving(true);
    try {
      await deleteTakeoff(currentOrg.id, deleteTakeoffTarget.id);
      if (selectedId === deleteTakeoffTarget.id) setSelectedId('');
      await refresh();
      setDeleteTakeoffTarget(null);
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
      await deleteTakeoffLine(currentOrg.id, deleteLineTarget.id);
      await refresh();
      setDeleteLineTarget(null);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    if (!selectedTakeoff) return;
    const rows = selectedLines.map((line) => [
      line.workPhase,
      line.description,
      line.quantity,
      line.unit,
      line.wastePercent,
      effectiveQuantity(line).toFixed(3),
      line.notes,
    ]);
    const csv = [
      ['Työvaihe', 'Kuvaus', 'Määrä', 'Yksikkö', 'Hukka %', 'Hukallinen määrä', 'Huomiot'],
      ...rows,
    ].map((row) => row.map(csvCell).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedTakeoff.name.replaceAll(' ', '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-hero text-text-primary">Määrälaskenta</h1><p className="mt-1 text-body-sm text-text-secondary">Työvaihekohtaiset määrät, yksiköt ja hukkaprosentit</p></div>
        <Button onClick={openTakeoffCreate} className="gap-2"><Plus size={16} /> Uusi määrälaskelma</Button>
      </div>

      {(error || operationError) && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={16} />{operationError ?? error}</div>}

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <Card className="h-fit"><CardContent className="space-y-2 p-3">{takeoffs.map((takeoff) => { const lines = takeoffLines.filter((line) => line.takeoffId === takeoff.id); return <button key={takeoff.id} type="button" onClick={() => setSelectedId(takeoff.id)} className={`w-full rounded-lg border p-3 text-left ${selectedTakeoff?.id === takeoff.id ? 'border-primary bg-primary-light' : 'border-slate-200 hover:bg-slate-50'}`}><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{takeoff.name}</p><p className="text-xs text-text-secondary">{takeoff.projectName || 'Ei projektia'}</p></div>{statusBadge(takeoff.status)}</div><p className="mt-2 text-xs text-text-secondary">{lines.length} määräriviä</p></button>; })}{!loading && takeoffs.length === 0 && <div className="p-8 text-center"><Ruler size={38} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei määrälaskelmia</p></div>}</CardContent></Card>

        {selectedTakeoff ? <div className="space-y-4"><Card><CardContent className="p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><h2 className="text-xl font-bold">{selectedTakeoff.name}</h2>{statusBadge(selectedTakeoff.status)}</div><p className="mt-1 text-sm text-text-secondary">{selectedTakeoff.projectName || 'Ei projektia'} · {selectedTakeoff.notes || 'Ei lisätietoja'}</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => openTakeoffEdit(selectedTakeoff)}><Edit3 size={15} className="mr-1" /> Muokkaa</Button><Button variant="outline" onClick={exportCsv}><Download size={15} className="mr-1" /> CSV</Button><Button variant="ghost" className="text-danger" onClick={() => setDeleteTakeoffTarget(selectedTakeoff)}><Trash2 size={15} /></Button></div></div></CardContent></Card>

          <div className="flex justify-end"><Button onClick={openLineCreate} className="gap-2"><Plus size={15} /> Lisää määrärivi</Button></div>
          {phaseGroups.map(([phase, lines]) => <Card key={phase} className="overflow-hidden"><CardContent className="p-0"><div className="border-b bg-slate-50 px-5 py-3"><h3 className="font-semibold">{phase}</h3><p className="text-xs text-text-secondary">{lines.length} riviä</p></div><div className="hidden grid-cols-[1.4fr_100px_80px_100px_130px_1fr_80px] gap-3 border-b px-5 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted lg:grid"><span>Kuvaus</span><span>Määrä</span><span>Yks.</span><span>Hukka</span><span>Hukallinen määrä</span><span>Huomiot</span><span /></div>{lines.map((line) => <div key={line.id} className="grid grid-cols-1 items-center gap-3 border-b border-slate-100 px-5 py-4 lg:grid-cols-[1.4fr_100px_80px_100px_130px_1fr_80px]"><span className="text-sm font-medium">{line.description}</span><span className="font-mono text-sm">{line.quantity.toLocaleString('fi-FI')}</span><span className="text-sm text-text-secondary">{line.unit}</span><span className="font-mono text-sm">{line.wastePercent}%</span><span className="font-mono text-sm font-semibold">{effectiveQuantity(line).toLocaleString('fi-FI', { maximumFractionDigits: 3 })} {line.unit}</span><span className="truncate text-sm text-text-secondary">{line.notes || '—'}</span><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openLineEdit(line)}><Edit3 size={14} /></Button><Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-danger" onClick={() => setDeleteLineTarget(line)}><Trash2 size={14} /></Button></div></div>)}</CardContent></Card>)}
          {selectedLines.length === 0 && <Card><CardContent className="p-10 text-center text-sm text-text-secondary">Ei määrärivejä.</CardContent></Card>}
        </div> : <Card><CardContent className="p-12 text-center"><Ruler size={42} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Valitse tai luo määrälaskelma</p></CardContent></Card>}
      </div>

      <Dialog open={takeoffDialogOpen} onOpenChange={setTakeoffDialogOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{editingTakeoff ? 'Muokkaa määrälaskelmaa' : 'Uusi määrälaskelma'}</DialogTitle></DialogHeader>{formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}<div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="takeoff-name">Nimi *</Label><Input id="takeoff-name" value={takeoffForm.name} onChange={(event) => setTakeoffForm((previous) => ({ ...previous, name: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label>Projekti</Label>{projects.length > 0 ? <Select value={takeoffForm.projectId} onValueChange={(projectId) => { const project = projects.find((item) => item.id === projectId); setTakeoffForm((previous) => ({ ...previous, projectId, projectName: project?.name ?? previous.projectName })); }}><SelectTrigger><SelectValue placeholder="Valitse projekti" /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select> : <Input value={takeoffForm.projectName} onChange={(event) => setTakeoffForm((previous) => ({ ...previous, projectName: event.target.value }))} />}</div><div className="space-y-2"><Label>Tila</Label><Select value={takeoffForm.status} onValueChange={(status: TakeoffStatus) => setTakeoffForm((previous) => ({ ...previous, status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TAKEOFF_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="takeoff-notes">Huomiot</Label><Textarea id="takeoff-notes" value={takeoffForm.notes} onChange={(event) => setTakeoffForm((previous) => ({ ...previous, notes: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setTakeoffDialogOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void saveTakeoff()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={lineDialogOpen} onOpenChange={setLineDialogOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{editingLine ? 'Muokkaa määräriviä' : 'Uusi määrärivi'}</DialogTitle></DialogHeader>{formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}<div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="takeoff-phase">Työvaihe *</Label><Input id="takeoff-phase" value={lineForm.workPhase} onChange={(event) => setLineForm((previous) => ({ ...previous, workPhase: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="takeoff-description">Kuvaus *</Label><Input id="takeoff-description" value={lineForm.description} onChange={(event) => setLineForm((previous) => ({ ...previous, description: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="takeoff-quantity">Määrä</Label><Input id="takeoff-quantity" type="number" min="0" step="0.001" value={lineForm.quantity} onChange={(event) => setLineForm((previous) => ({ ...previous, quantity: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="takeoff-unit">Yksikkö *</Label><Input id="takeoff-unit" value={lineForm.unit} onChange={(event) => setLineForm((previous) => ({ ...previous, unit: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="takeoff-waste">Hukka %</Label><Input id="takeoff-waste" type="number" min="0" max="100" step="0.1" value={lineForm.wastePercent} onChange={(event) => setLineForm((previous) => ({ ...previous, wastePercent: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="takeoff-line-notes">Huomiot</Label><Textarea id="takeoff-line-notes" value={lineForm.notes} onChange={(event) => setLineForm((previous) => ({ ...previous, notes: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setLineDialogOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void saveLine()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(deleteTakeoffTarget)} onOpenChange={(open) => !open && setDeleteTakeoffTarget(null)}><DialogContent><DialogHeader><DialogTitle>Poista määrälaskelma</DialogTitle></DialogHeader><p className="text-sm text-text-secondary">Poistetaanko <strong>{deleteTakeoffTarget?.name}</strong> ja kaikki sen rivit?</p><DialogFooter><Button variant="outline" onClick={() => setDeleteTakeoffTarget(null)}>Peruuta</Button><Button variant="destructive" onClick={() => void removeTakeoff()} disabled={saving}>Poista</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={Boolean(deleteLineTarget)} onOpenChange={(open) => !open && setDeleteLineTarget(null)}><DialogContent><DialogHeader><DialogTitle>Poista määrärivi</DialogTitle></DialogHeader><p className="text-sm text-text-secondary">Poistetaanko <strong>{deleteLineTarget?.description}</strong>?</p><DialogFooter><Button variant="outline" onClick={() => setDeleteLineTarget(null)}>Peruuta</Button><Button variant="destructive" onClick={() => void removeLine()} disabled={saving}>Poista</Button></DialogFooter></DialogContent></Dialog>
    </motion.div>
  );
}
