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

import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOperationsData } from '@/hooks/useOperationsData';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import logger from '@/lib/logger';
import {
  createWasteEntryRecord,
  deleteWasteEntryRecord,
  updateWasteEntryRecord,
} from '@/lib/supabase/operationsEntities';
import type { WasteEntry } from '@/types';

interface WasteForm {
  date: string;
  project: string;
  wasteType: string;
  amount: string;
  unit: string;
  cost: string;
  notes: string;
}

const emptyForm: WasteForm = {
  date: new Date().toISOString().slice(0, 10),
  project: '',
  wasteType: '',
  amount: '',
  unit: 'kg',
  cost: '0',
  notes: '',
};

function money(value: number) {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value);
}

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export default function Jatehuolto() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
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
    const query = search.trim().toLowerCase();
    return wasteEntries.filter((entry) =>
      !query ||
      entry.project.toLowerCase().includes(query) ||
      entry.wasteType.toLowerCase().includes(query) ||
      (entry.notes ?? '').toLowerCase().includes(query),
    );
  }, [search, wasteEntries]);

  const totalAmount = wasteEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const totalCost = wasteEntries.reduce((sum, entry) => sum + entry.cost, 0);
  const typeCount = new Set(wasteEntries.map((entry) => entry.wasteType).filter(Boolean)).size;
  const projectCount = new Set(wasteEntries.map((entry) => entry.project).filter(Boolean)).size;

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
      project: entry.project,
      wasteType: entry.wasteType,
      amount: String(entry.amount),
      unit: entry.unit ?? entry.method ?? 'kg',
      cost: String(entry.cost),
      notes: entry.notes ?? '',
    });
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
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
    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg) return;

    const payload: Omit<WasteEntry, 'id'> = {
      date: form.date,
      project: form.project.trim(),
      wasteType: form.wasteType.trim(),
      amount,
      method: form.unit.trim(),
      unit: form.unit.trim(),
      cost,
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
      const message = caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.';
      setOperationError(message);
      logger.error('Jätekirjauksen poistaminen epäonnistui', { error: caught });
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
      entry.notes ?? '',
    ]);
    const csv = [
      ['Päivä', 'Projekti', 'Jätelaji', 'Määrä', 'Yksikkö', 'Kustannus', 'Huomiot'],
      ...rows,
    ].map((row) => row.map(csvCell).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
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
          <p className="mt-1 text-body-sm text-text-secondary">Työmaiden jätemäärät, jätelajit ja kustannukset</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreate} className="gap-2"><Plus size={16} /> Uusi kirjaus</Button>
          <Button variant="outline" onClick={exportCsv} disabled={wasteEntries.length === 0} className="gap-2"><Download size={16} /> Vie CSV</Button>
        </div>
      </div>

      {(error || operationError) && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={16} />{operationError ?? error}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Kirjauksia', value: wasteEntries.length, icon: Recycle },
          { label: 'Määrä yhteensä', value: totalAmount.toLocaleString('fi-FI'), icon: Recycle },
          { label: 'Kustannukset', value: money(totalCost), icon: Euro },
          { label: 'Projektit / jätelajit', value: `${projectCount} / ${typeCount}`, icon: Recycle },
        ].map((item) => <Card key={item.label} className="border-slate-200 shadow-card"><CardContent className="p-5"><div className="mb-3 flex justify-between"><span className="text-xs uppercase tracking-wider text-text-secondary">{item.label}</span><item.icon size={18} className="text-primary" /></div><p className="font-mono text-2xl font-bold">{item.value}</p></CardContent></Card>)}
      </div>

      <div className="relative max-w-md"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hae projektilla tai jätelajilla…" className="pl-9" /></div>

      <Card className="overflow-hidden border-slate-200 shadow-card">
        <CardContent className="p-0">
          <div className="hidden grid-cols-[110px_1.2fr_1fr_100px_110px_1fr_90px] gap-3 border-b bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted lg:grid"><span>Päivä</span><span>Projekti</span><span>Jätelaji</span><span>Määrä</span><span>Kustannus</span><span>Huomiot</span><span className="text-right">Toiminnot</span></div>
          {filteredEntries.map((entry) => (
            <div key={entry.id} className="grid grid-cols-1 items-center gap-3 border-b border-slate-100 px-6 py-4 lg:grid-cols-[110px_1.2fr_1fr_100px_110px_1fr_90px]">
              <span className="text-sm text-text-secondary">{entry.date}</span>
              <span className="font-medium text-text-primary">{entry.project}</span>
              <span className="text-sm text-text-secondary">{entry.wasteType}</span>
              <span className="font-mono text-sm">{entry.amount.toLocaleString('fi-FI')} {entry.unit ?? entry.method}</span>
              <span className="font-mono text-sm">{money(entry.cost)}</span>
              <span className="truncate text-sm text-text-secondary">{entry.notes || '—'}</span>
              <div className="flex justify-end gap-1"><Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(entry)} aria-label={`Muokkaa ${entry.wasteType}`}><Edit3 size={15} /></Button><Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-danger" onClick={() => setDeleteTarget(entry)} aria-label={`Poista ${entry.wasteType}`}><Trash2 size={15} /></Button></div>
            </div>
          ))}
          {!loading && filteredEntries.length === 0 && <div className="p-12 text-center"><Recycle size={44} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei jätekirjauksia</p><p className="mt-1 text-sm text-text-secondary">Luo ensimmäinen kirjaus.</p></div>}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>{editing ? 'Muokkaa jätekirjausta' : 'Uusi jätekirjaus'}</DialogTitle></DialogHeader>
          {formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="waste-date">Päivämäärä *</Label><Input id="waste-date" type="date" value={form.date} onChange={(event) => setForm((previous) => ({ ...previous, date: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="waste-project">Projekti *</Label><Input id="waste-project" value={form.project} onChange={(event) => setForm((previous) => ({ ...previous, project: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="waste-type">Jätelaji *</Label><Input id="waste-type" value={form.wasteType} onChange={(event) => setForm((previous) => ({ ...previous, wasteType: event.target.value }))} placeholder="Esim. puu, metalli, vaarallinen jäte" /></div>
            <div className="space-y-2"><Label htmlFor="waste-amount">Määrä *</Label><Input id="waste-amount" type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm((previous) => ({ ...previous, amount: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="waste-unit">Yksikkö *</Label><Input id="waste-unit" value={form.unit} onChange={(event) => setForm((previous) => ({ ...previous, unit: event.target.value }))} placeholder="kg, t, m³" /></div>
            <div className="space-y-2"><Label htmlFor="waste-cost">Kustannus €</Label><Input id="waste-cost" type="number" min="0" step="0.01" value={form.cost} onChange={(event) => setForm((previous) => ({ ...previous, cost: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="waste-notes">Huomiot</Label><Textarea id="waste-notes" value={form.notes} onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void save()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}><DialogContent><DialogHeader><DialogTitle>Poista jätekirjaus</DialogTitle></DialogHeader><p className="text-sm text-text-secondary">Poistetaanko {deleteTarget?.wasteType}-kirjaus projektilta {deleteTarget?.project}?</p><DialogFooter><Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={saving}>Peruuta</Button><Button variant="destructive" onClick={() => void removeEntry()} disabled={saving}>{saving ? 'Poistetaan…' : 'Poista'}</Button></DialogFooter></DialogContent></Dialog>
    </motion.div>
  );
}
