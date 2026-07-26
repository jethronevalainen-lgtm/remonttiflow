import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Download,
  Edit3,
  Euro,
  Plus,
  Recycle,
  Search,
  Trash2,
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
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOperationsData } from '@/hooks/useOperationsData';
import logger from '@/lib/logger';
import {
  createWasteEntryRecord,
  deleteWasteEntryRecord,
  updateWasteEntryRecord,
} from '@/lib/supabase/operationsEntities';
import type { WasteEntry } from '@/types';

const UNITS = ['kg', 't', 'm³', 'kpl', 'l'];

interface WasteForm {
  date: string;
  projectId: string;
  project: string;
  wasteType: string;
  amount: string;
  unit: string;
  cost: string;
  destination: string;
  receiptNumber: string;
  hazardous: boolean;
  notes: string;
}

const emptyForm: WasteForm = {
  date: new Date().toISOString().slice(0, 10),
  projectId: '',
  project: '',
  wasteType: '',
  amount: '',
  unit: 'kg',
  cost: '0',
  destination: '',
  receiptNumber: '',
  hazardous: false,
  notes: '',
};

function money(value: number) {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value);
}

function csvCell(value: string | number | boolean) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export default function Jatehuolto() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { projects } = useAppDataContext();
  const { wasteEntries, loading, error, refresh } = useOperationsData();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WasteEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WasteEntry | null>(null);
  const [form, setForm] = useState<WasteForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fi');
    return wasteEntries.filter((entry) =>
      !query || [
        entry.project,
        entry.wasteType,
        entry.destination ?? '',
        entry.receiptNumber ?? '',
        entry.notes ?? '',
      ].some((value) => value.toLocaleLowerCase('fi').includes(query)),
    );
  }, [search, wasteEntries]);

  const totalsByUnit = useMemo(() => {
    const totals = new Map<string, number>();
    wasteEntries.forEach((entry) => {
      const unit = entry.unit ?? entry.method ?? 'määrittelemätön';
      totals.set(unit, (totals.get(unit) ?? 0) + entry.amount);
    });
    return [...totals.entries()].sort(([left], [right]) => left.localeCompare(right, 'fi'));
  }, [wasteEntries]);
  const totalCost = wasteEntries.reduce((sum, entry) => sum + entry.cost, 0);
  const hazardousCount = wasteEntries.filter((entry) => entry.hazardous).length;
  const projectCount = new Set(
    wasteEntries.map((entry) => entry.projectId || entry.project).filter(Boolean),
  ).size;

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) });
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const openEdit = (entry: WasteEntry) => {
    setEditing(entry);
    setForm({
      date: entry.date,
      projectId: entry.projectId ?? '',
      project: entry.project,
      wasteType: entry.wasteType,
      amount: String(entry.amount),
      unit: entry.unit ?? entry.method ?? 'kg',
      cost: String(entry.cost),
      destination: entry.destination ?? '',
      receiptNumber: entry.receiptNumber ?? '',
      hazardous: entry.hazardous ?? false,
      notes: entry.notes ?? '',
    });
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const selectProject = (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    setForm((previous) => ({
      ...previous,
      projectId,
      project: project?.name ?? previous.project,
    }));
  };

  const save = async () => {
    const amount = Number(form.amount);
    const cost = Number(form.cost);
    const nextErrors: string[] = [];
    if (!form.date) nextErrors.push('Päivämäärä on pakollinen.');
    if (!form.project.trim()) nextErrors.push('Projekti on pakollinen.');
    if (!form.wasteType.trim()) nextErrors.push('Jätelaji on pakollinen.');
    if (!Number.isFinite(amount) || amount <= 0) nextErrors.push('Määrän pitää olla positiivinen numero.');
    if (!form.unit.trim()) nextErrors.push('Yksikkö on pakollinen.');
    if (!Number.isFinite(cost) || cost < 0) nextErrors.push('Kustannus ei voi olla negatiivinen.');
    if (form.hazardous && !form.destination.trim()) {
      nextErrors.push('Vaaralliselle jätteelle pitää merkitä vastaanottopaikka.');
    }
    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg) return;

    const payload: Omit<WasteEntry, 'id'> = {
      date: form.date,
      projectId: form.projectId || undefined,
      project: form.project.trim(),
      wasteType: form.wasteType.trim(),
      amount,
      method: form.unit.trim(),
      unit: form.unit.trim(),
      cost,
      destination: form.destination.trim() || undefined,
      receiptNumber: form.receiptNumber.trim() || undefined,
      hazardous: form.hazardous,
      notes: form.notes.trim() || undefined,
    };

    setSaving(true);
    setOperationError(null);
    try {
      if (editing) await updateWasteEntryRecord(currentOrg.id, editing.id, payload);
      else await createWasteEntryRecord(currentOrg.id, user?.id, payload);
      await refresh();
      setDialogOpen(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Tallennus epäonnistui.';
      setOperationError(message);
      logger.error('Jätekirjauksen tallennus epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  const removeEntry = async () => {
    if (!deleteTarget || !currentOrg) return;
    setSaving(true);
    setOperationError(null);
    try {
      await deleteWasteEntryRecord(currentOrg.id, deleteTarget.id);
      await refresh();
      setDeleteTarget(null);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const rows = wasteEntries.map((entry) => [
      entry.date,
      entry.project,
      entry.wasteType,
      entry.amount,
      entry.unit ?? entry.method,
      entry.cost,
      entry.destination ?? '',
      entry.receiptNumber ?? '',
      entry.hazardous ?? false,
      entry.notes ?? '',
    ]);
    const csv = [
      ['Päivä', 'Projekti', 'Jätelaji', 'Määrä', 'Yksikkö', 'Kustannus', 'Vastaanottopaikka', 'Tosite', 'Vaarallinen jäte', 'Huomiot'],
      ...rows,
    ].map((row) => row.map(csvCell).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `jatehuolto-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-hero text-text-primary">Jätehuolto</h1>
          <p className="mt-1 text-body-sm text-text-secondary">Projektisidonnaiset jätemäärät, tositteet ja kustannukset yksiköittäin</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreate}><Plus size={16} className="mr-2" /> Uusi kirjaus</Button>
          <Button variant="outline" onClick={exportCsv} disabled={!wasteEntries.length}><Download size={16} className="mr-2" /> Vie CSV</Button>
        </div>
      </div>

      {(error || operationError) && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={16} />{operationError ?? error}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><CardContent className="p-5"><div className="flex justify-between"><p className="text-xs uppercase tracking-wider text-text-secondary">Kirjauksia</p><Recycle size={18} className="text-primary" /></div><p className="mt-2 font-mono text-2xl font-bold">{wasteEntries.length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs uppercase tracking-wider text-text-secondary">Määrät yksiköittäin</p><div className="mt-2 flex flex-wrap gap-1">{totalsByUnit.map(([unit, value]) => <Badge key={unit} variant="outline">{value.toLocaleString('fi-FI')} {unit}</Badge>)}{!totalsByUnit.length && <span>—</span>}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex justify-between"><p className="text-xs uppercase tracking-wider text-text-secondary">Kustannukset</p><Euro size={18} className="text-primary" /></div><p className="mt-2 font-mono text-2xl font-bold">{money(totalCost)}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs uppercase tracking-wider text-text-secondary">Projektit / vaaralliset</p><p className="mt-2 font-mono text-2xl font-bold">{projectCount} / {hazardousCount}</p></CardContent></Card>
      </div>

      <div className="relative max-w-md"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hae projektilla, jätelajilla tai tositteella…" className="pl-9" /></div>

      <Card className="overflow-hidden"><CardContent className="p-0">
        {filteredEntries.map((entry) => <div key={entry.id} className="grid gap-3 border-b px-5 py-4 lg:grid-cols-[100px_1fr_1fr_120px_120px_1fr_90px] lg:items-center"><span className="text-sm text-text-secondary">{entry.date}</span><span className="font-medium">{entry.project}</span><div><span>{entry.wasteType}</span>{entry.hazardous && <Badge className="ml-2 border-0 bg-red-50 text-red-700">Vaarallinen</Badge>}</div><span className="font-mono text-sm">{entry.amount.toLocaleString('fi-FI')} {entry.unit ?? entry.method}</span><span className="font-mono text-sm">{money(entry.cost)}</span><div className="text-sm text-text-secondary"><p>{entry.destination || '—'}</p><p className="text-xs">{entry.receiptNumber || entry.notes || ''}</p></div><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => openEdit(entry)}><Edit3 size={15} /></Button><Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteTarget(entry)}><Trash2 size={15} /></Button></div></div>)}
        {!loading && !filteredEntries.length && <div className="p-12 text-center"><Recycle size={44} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei jätekirjauksia</p></div>}
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? 'Muokkaa jätekirjausta' : 'Uusi jätekirjaus'}</DialogTitle></DialogHeader>
          {formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Päivämäärä *</Label><Input type="date" value={form.date} onChange={(event) => setForm((previous) => ({ ...previous, date: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Projekti *</Label>{projects.length ? <Select value={form.projectId} onValueChange={selectProject}><SelectTrigger><SelectValue placeholder="Valitse projekti" /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select> : <Input value={form.project} onChange={(event) => setForm((previous) => ({ ...previous, project: event.target.value }))} />}</div>
            <div className="space-y-2 sm:col-span-2"><Label>Jätelaji *</Label><Input value={form.wasteType} onChange={(event) => setForm((previous) => ({ ...previous, wasteType: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Määrä *</Label><Input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm((previous) => ({ ...previous, amount: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Yksikkö *</Label><Select value={form.unit} onValueChange={(unit) => setForm((previous) => ({ ...previous, unit }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{UNITS.map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Kustannus €</Label><Input type="number" min="0" step="0.01" value={form.cost} onChange={(event) => setForm((previous) => ({ ...previous, cost: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Tositteen numero</Label><Input value={form.receiptNumber} onChange={(event) => setForm((previous) => ({ ...previous, receiptNumber: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Vastaanottopaikka</Label><Input value={form.destination} onChange={(event) => setForm((previous) => ({ ...previous, destination: event.target.value }))} /></div>
            <label className="flex items-center gap-2 sm:col-span-2"><Checkbox checked={form.hazardous} onCheckedChange={(value) => setForm((previous) => ({ ...previous, hazardous: value === true }))} /><span className="text-sm font-medium">Vaarallinen jäte</span></label>
            <div className="space-y-2 sm:col-span-2"><Label>Huomiot</Label><Textarea value={form.notes} onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))} rows={3} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Peruuta</Button><Button onClick={() => void save()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Poistetaanko jätekirjaus?</AlertDialogTitle><AlertDialogDescription>Poistoa ei voi perua.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => void removeEntry()}>Poista</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </motion.div>
  );
}
