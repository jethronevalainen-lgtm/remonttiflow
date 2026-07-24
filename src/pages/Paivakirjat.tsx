import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Edit3,
  Plus,
  Search,
  Thermometer,
  Trash2,
  Users,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOperationsData } from '@/hooks/useOperationsData';
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
  createDiaryEntryRecord,
  deleteDiaryEntryRecord,
  updateDiaryEntryRecord,
} from '@/lib/supabase/operationsEntities';
import type { DiaryEntry, DiaryStatus } from '@/types';

const DIARY_STATUSES: DiaryStatus[] = ['Luonnos', 'Valmis', 'Lukittu'];

interface DiaryForm {
  date: string;
  project: string;
  author: string;
  weather: string;
  temperature: string;
  workers: string;
  workDescription: string;
  deliveries: string;
  issues: string;
  delays: string;
  status: DiaryStatus;
}

const emptyForm: DiaryForm = {
  date: new Date().toISOString().slice(0, 10),
  project: '',
  author: '',
  weather: '',
  temperature: '',
  workers: '0',
  workDescription: '',
  deliveries: '',
  issues: '',
  delays: '',
  status: 'Luonnos',
};

function statusBadge(status: DiaryStatus | undefined) {
  const value = status ?? 'Luonnos';
  const classes: Record<DiaryStatus, string> = {
    Luonnos: 'bg-amber-50 text-amber-700',
    Valmis: 'bg-emerald-50 text-emerald-700',
    Lukittu: 'bg-slate-100 text-slate-700',
  };
  return <Badge className={`border-0 ${classes[value]}`}>{value}</Badge>;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fi-FI');
}

export default function Paivakirjat() {
  const { user, profile } = useAuth();
  const { currentOrg } = useOrganization();
  const { diaryEntries, loading, error, refresh } = useOperationsData();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DiaryEntry | null>(null);
  const [form, setForm] = useState<DiaryForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return diaryEntries.filter((entry) =>
      !query ||
      entry.project.toLowerCase().includes(query) ||
      entry.author.toLowerCase().includes(query) ||
      entry.workDescription.toLowerCase().includes(query),
    );
  }, [diaryEntries, search]);

  const completed = diaryEntries.filter((entry) => entry.status === 'Valmis' || entry.status === 'Lukittu').length;
  const totalWorkers = diaryEntries.reduce((sum, entry) => sum + entry.workers, 0);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      date: new Date().toISOString().slice(0, 10),
      author: profile?.full_name || user?.email || '',
    });
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const openEdit = (entry: DiaryEntry) => {
    if (entry.status === 'Lukittu') return;
    setEditing(entry);
    setForm({
      date: entry.date,
      project: entry.project,
      author: entry.author,
      weather: entry.weather,
      temperature: entry.temperature,
      workers: String(entry.workers),
      workDescription: entry.workDescription,
      deliveries: entry.deliveries ?? '',
      issues: entry.issues ?? '',
      delays: entry.delays ?? '',
      status: entry.status ?? 'Luonnos',
    });
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const save = async () => {
    const workers = Number(form.workers);
    const nextErrors: string[] = [];
    if (!form.date) nextErrors.push('Päivämäärä on pakollinen.');
    if (!form.project.trim()) nextErrors.push('Projekti on pakollinen.');
    if (!form.workDescription.trim()) nextErrors.push('Tehdyt työt on kuvattava.');
    if (!Number.isInteger(workers) || workers < 0) nextErrors.push('Työntekijämäärän pitää olla nolla tai positiivinen kokonaisluku.');
    if (form.temperature && !Number.isFinite(Number(form.temperature))) nextErrors.push('Lämpötilan pitää olla numero.');
    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg) return;

    const payload: Omit<DiaryEntry, 'id'> = {
      date: form.date,
      project: form.project.trim(),
      author: form.author.trim(),
      weather: form.weather.trim(),
      temperature: form.temperature.trim(),
      workers,
      workDescription: form.workDescription.trim(),
      deliveries: form.deliveries.trim() || undefined,
      issues: form.issues.trim() || undefined,
      delays: form.delays.trim() || undefined,
      status: form.status,
    };

    setSaving(true);
    setOperationError(null);
    try {
      if (editing) await updateDiaryEntryRecord(currentOrg.id, editing.id, payload);
      else await createDiaryEntryRecord(currentOrg.id, user?.id, payload);
      await refresh();
      setDialogOpen(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Tallennus epäonnistui.';
      setOperationError(message);
      logger.error('Työmaapäiväkirjan tallennus epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  const removeEntry = async () => {
    if (!deleteTarget || !currentOrg) return;
    setSaving(true);
    setOperationError(null);
    try {
      await deleteDiaryEntryRecord(currentOrg.id, deleteTarget.id);
      await refresh();
      setDeleteTarget(null);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.';
      setOperationError(message);
      logger.error('Työmaapäiväkirjan poistaminen epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-hero text-text-primary">Työmaapäiväkirjat</h1>
          <p className="mt-1 text-body-sm text-text-secondary">Dokumentoi päivän työt, olosuhteet, toimitukset ja poikkeamat</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus size={16} /> Uusi päiväkirja</Button>
      </div>

      {(error || operationError) && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} /> {operationError ?? error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Merkintöjä', value: diaryEntries.length, icon: BookOpen },
          { label: 'Valmiina', value: completed, icon: CheckCircle2 },
          { label: 'Luonnoksia', value: diaryEntries.filter((entry) => (entry.status ?? 'Luonnos') === 'Luonnos').length, icon: CalendarDays },
          { label: 'Työntekijöitä kirjattu', value: totalWorkers, icon: Users },
        ].map((item) => (
          <Card key={item.label} className="border-slate-200 shadow-card">
            <CardContent className="p-5"><div className="mb-3 flex justify-between"><span className="text-xs uppercase tracking-wider text-text-secondary">{item.label}</span><item.icon size={18} className="text-primary" /></div><p className="font-mono text-3xl font-bold">{item.value}</p></CardContent>
          </Card>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hae projektilla, tekijällä tai työkuvauksella…" className="pl-9" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {filteredEntries.map((entry) => (
          <Card key={entry.id} className="border-slate-200 shadow-card">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-semibold text-text-primary">{entry.project}</p><p className="text-sm text-text-secondary">{formatDate(entry.date)} · {entry.author || 'Tekijä puuttuu'}</p></div>
                {statusBadge(entry.status)}
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-sm">
                <div><p className="text-xs text-text-muted">Sää</p><p className="font-medium">{entry.weather || '—'}</p></div>
                <div><p className="text-xs text-text-muted">Lämpötila</p><p className="flex items-center gap-1 font-medium"><Thermometer size={13} />{entry.temperature ? `${entry.temperature} °C` : '—'}</p></div>
                <div><p className="text-xs text-text-muted">Työntekijät</p><p className="font-medium">{entry.workers}</p></div>
              </div>
              <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Tehdyt työt</p><p className="whitespace-pre-wrap text-sm text-text-primary">{entry.workDescription}</p></div>
              {entry.deliveries && <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Toimitukset</p><p className="text-sm">{entry.deliveries}</p></div>}
              {(entry.issues || entry.delays) && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{entry.issues && <p><strong>Poikkeamat:</strong> {entry.issues}</p>}{entry.delays && <p><strong>Viiveet:</strong> {entry.delays}</p>}</div>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(entry)} disabled={entry.status === 'Lukittu'}><Edit3 size={14} className="mr-1" /> Muokkaa</Button>
                <Button variant="ghost" size="sm" className="text-danger" onClick={() => setDeleteTarget(entry)} disabled={entry.status === 'Lukittu'}><Trash2 size={14} className="mr-1" /> Poista</Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!loading && filteredEntries.length === 0 && <Card className="lg:col-span-2"><CardContent className="p-12 text-center"><BookOpen size={44} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei päiväkirjamerkintöjä</p><p className="mt-1 text-sm text-text-secondary">Luo ensimmäinen työmaapäiväkirja.</p></CardContent></Card>}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? 'Muokkaa päiväkirjaa' : 'Uusi työmaapäiväkirja'}</DialogTitle></DialogHeader>
          {formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="diary-date">Päivämäärä *</Label><Input id="diary-date" type="date" value={form.date} onChange={(event) => setForm((previous) => ({ ...previous, date: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="diary-project">Projekti *</Label><Input id="diary-project" value={form.project} onChange={(event) => setForm((previous) => ({ ...previous, project: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="diary-author">Laatija</Label><Input id="diary-author" value={form.author} onChange={(event) => setForm((previous) => ({ ...previous, author: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Tila</Label><Select value={form.status} onValueChange={(value: DiaryStatus) => setForm((previous) => ({ ...previous, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DIARY_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="diary-weather">Sää</Label><Input id="diary-weather" value={form.weather} onChange={(event) => setForm((previous) => ({ ...previous, weather: event.target.value }))} placeholder="Esim. pilvinen" /></div>
            <div className="space-y-2"><Label htmlFor="diary-temperature">Lämpötila °C</Label><Input id="diary-temperature" type="number" step="0.1" value={form.temperature} onChange={(event) => setForm((previous) => ({ ...previous, temperature: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="diary-workers">Työntekijöitä</Label><Input id="diary-workers" type="number" min="0" step="1" value={form.workers} onChange={(event) => setForm((previous) => ({ ...previous, workers: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="diary-work">Tehdyt työt *</Label><Textarea id="diary-work" rows={4} value={form.workDescription} onChange={(event) => setForm((previous) => ({ ...previous, workDescription: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="diary-deliveries">Toimitukset</Label><Textarea id="diary-deliveries" value={form.deliveries} onChange={(event) => setForm((previous) => ({ ...previous, deliveries: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="diary-issues">Poikkeamat</Label><Textarea id="diary-issues" value={form.issues} onChange={(event) => setForm((previous) => ({ ...previous, issues: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="diary-delays">Viiveet</Label><Textarea id="diary-delays" value={form.delays} onChange={(event) => setForm((previous) => ({ ...previous, delays: event.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void save()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent><DialogHeader><DialogTitle>Poista päiväkirja</DialogTitle></DialogHeader><p className="text-sm text-text-secondary">Poistetaanko päiväkirjamerkintä {deleteTarget && formatDate(deleteTarget.date)}?</p><DialogFooter><Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={saving}>Peruuta</Button><Button variant="destructive" onClick={() => void removeEntry()} disabled={saving}>{saving ? 'Poistetaan…' : 'Poista'}</Button></DialogFooter></DialogContent>
      </Dialog>
    </motion.div>
  );
}
