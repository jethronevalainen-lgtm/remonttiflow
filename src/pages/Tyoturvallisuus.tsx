import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Edit3,
  GraduationCap,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import logger from '@/lib/logger';
import {
  createSafetyItemRecord,
  deleteSafetyItemRecord,
  updateSafetyItemRecord,
} from '@/lib/supabase/workforceEntities';
import type { SafetyItem, SafetyItemSeverity, SafetyItemType } from '@/types';

const SAFETY_TYPES: Array<{ value: SafetyItemType; label: string }> = [
  { value: 'risk', label: 'Turvallisuushavainto' },
  { value: 'incident', label: 'Tapaturma / läheltä piti' },
  { value: 'inspection', label: 'Tarkastus' },
  { value: 'training', label: 'Koulutus' },
];
const SEVERITIES: SafetyItemSeverity[] = ['Lievä', 'Keskitasoinen', 'Vakava'];
const STATUSES = ['Avoin', 'Käsittelyssä', 'Korjattu', 'Suljettu'] as const;

interface SafetyForm {
  type: SafetyItemType;
  title: string;
  date: string;
  severity: SafetyItemSeverity | 'Ei määritelty';
  status: string;
}

const emptyForm: SafetyForm = {
  type: 'risk',
  title: '',
  date: new Date().toISOString().slice(0, 10),
  severity: 'Keskitasoinen',
  status: 'Avoin',
};

function typeLabel(type: SafetyItemType) {
  return SAFETY_TYPES.find((item) => item.value === type)?.label ?? type;
}

function typeIcon(type: SafetyItemType) {
  switch (type) {
    case 'incident': return AlertTriangle;
    case 'inspection': return ClipboardCheck;
    case 'training': return GraduationCap;
    default: return ShieldCheck;
  }
}

function statusBadge(status: string) {
  const value = status || 'Avoin';
  const className = value === 'Suljettu' || value === 'Korjattu'
    ? 'bg-emerald-50 text-emerald-700'
    : value === 'Käsittelyssä'
      ? 'bg-amber-50 text-amber-700'
      : 'bg-red-50 text-red-700';
  return <Badge className={`border-0 ${className}`}>{value}</Badge>;
}

function severityBadge(severity: SafetyItemSeverity | undefined) {
  if (!severity) return <span className="text-xs text-text-muted">—</span>;
  const classes: Record<SafetyItemSeverity, string> = {
    Lievä: 'bg-blue-50 text-blue-700',
    Keskitasoinen: 'bg-amber-50 text-amber-700',
    Vakava: 'bg-red-50 text-red-700',
  };
  return <Badge className={`border-0 ${classes[severity]}`}>{severity}</Badge>;
}

export default function Tyoturvallisuus() {
  const { user } = useAuth();
  const { currentOrg, currentRole } = useOrganization();
  const { safetyItems, refresh } = useAppDataContext();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('Kaikki');
  const [statusFilter, setStatusFilter] = useState('Kaikki');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SafetyItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SafetyItem | null>(null);
  const [form, setForm] = useState<SafetyForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canManage = currentRole === 'admin' || currentRole === 'supervisor';
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return safetyItems.filter((item) => {
      const matchesSearch = !query || item.title.toLowerCase().includes(query);
      const matchesType = typeFilter === 'Kaikki' || item.type === typeFilter;
      const matchesStatus = statusFilter === 'Kaikki' || item.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [safetyItems, search, statusFilter, typeFilter]);

  const openCount = safetyItems.filter((item) => !['Suljettu', 'Korjattu'].includes(item.status)).length;
  const seriousCount = safetyItems.filter((item) => item.severity === 'Vakava' && !['Suljettu', 'Korjattu'].includes(item.status)).length;
  const inspectionCount = safetyItems.filter((item) => item.type === 'inspection').length;
  const trainingCount = safetyItems.filter((item) => item.type === 'training').length;

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) });
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const openEdit = (item: SafetyItem) => {
    if (!canManage) return;
    setEditing(item);
    setForm({
      type: item.type,
      title: item.title,
      date: /^\d{4}-/.test(item.date) ? item.date : '',
      severity: item.severity ?? 'Ei määritelty',
      status: item.status || 'Avoin',
    });
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const save = async () => {
    const nextErrors: string[] = [];
    if (!form.title.trim()) nextErrors.push('Kuvaus on pakollinen.');
    if (!form.date) nextErrors.push('Päivämäärä on pakollinen.');
    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg) return;

    const payload: Omit<SafetyItem, 'id'> = {
      type: form.type,
      title: form.title.trim(),
      date: form.date,
      severity: form.severity === 'Ei määritelty' ? undefined : form.severity,
      status: canManage ? form.status : 'Avoin',
    };

    setSaving(true);
    setOperationError(null);
    try {
      if (editing) await updateSafetyItemRecord(currentOrg.id, editing.id, payload);
      else await createSafetyItemRecord(currentOrg.id, user?.id, payload);
      await refresh();
      setDialogOpen(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Tallennus epäonnistui.';
      setOperationError(message);
      logger.error('Turvallisuushavainnon tallennus epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (item: SafetyItem, status: string) => {
    if (!currentOrg || !canManage) return;
    setOperationError(null);
    try {
      await updateSafetyItemRecord(currentOrg.id, item.id, { status });
      await refresh();
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tilan päivitys epäonnistui.');
    }
  };

  const removeItem = async () => {
    if (!currentOrg || !deleteTarget || !canManage) return;
    setSaving(true);
    try {
      await deleteSafetyItemRecord(currentOrg.id, deleteTarget.id);
      await refresh();
      setDeleteTarget(null);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-hero text-text-primary">Työturvallisuus</h1><p className="mt-1 text-body-sm text-text-secondary">Havainnot, tapahtumat, tarkastukset ja korjaavat toimenpiteet</p></div>
        <Button onClick={openCreate} className="gap-2"><Plus size={16} /> Uusi havainto</Button>
      </div>

      {operationError && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={16} />{operationError}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        { label: 'Avoimet asiat', value: openCount, icon: AlertTriangle },
        { label: 'Vakavat avoimet', value: seriousCount, icon: AlertCircle },
        { label: 'Tarkastukset', value: inspectionCount, icon: ClipboardCheck },
        { label: 'Koulutukset', value: trainingCount, icon: GraduationCap },
      ].map((item) => <Card key={item.label}><CardContent className="p-5"><div className="mb-2 flex justify-between text-sm text-text-secondary"><span>{item.label}</span><item.icon size={18} className="text-primary" /></div><p className="font-mono text-3xl font-bold">{item.value}</p></CardContent></Card>)}</div>

      <div className="grid gap-3 sm:grid-cols-[1fr_210px_210px]"><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hae kuvauksesta…" className="pl-9" /></div><Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Kaikki">Kaikki tyypit</SelectItem>{SAFETY_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Kaikki">Kaikki tilat</SelectItem>{STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>

      <Card className="overflow-hidden"><CardContent className="p-0"><div className="hidden grid-cols-[120px_180px_1fr_130px_120px_190px] gap-3 border-b bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted lg:grid"><span>Päivä</span><span>Tyyppi</span><span>Kuvaus</span><span>Vakavuus</span><span>Tila</span><span className="text-right">Toiminnot</span></div>{filteredItems.map((item) => { const Icon = typeIcon(item.type); return <div key={item.id} className="grid grid-cols-1 items-center gap-3 border-b border-slate-100 px-6 py-4 lg:grid-cols-[120px_180px_1fr_130px_120px_190px]"><span className="text-sm text-text-secondary">{item.date}</span><span className="flex items-center gap-2 text-sm"><Icon size={15} className="text-primary" />{typeLabel(item.type)}</span><span className="font-medium">{item.title}</span><div>{severityBadge(item.severity)}</div><div>{statusBadge(item.status)}</div><div className="flex justify-end gap-1">{canManage && !['Korjattu', 'Suljettu'].includes(item.status) && <Button variant="ghost" size="sm" className="text-emerald-700" onClick={() => void updateStatus(item, 'Korjattu')}><CheckCircle2 size={15} className="mr-1" /> Korjattu</Button>}{canManage && <><Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(item)}><Edit3 size={15} /></Button><Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-danger" onClick={() => setDeleteTarget(item)}><Trash2 size={15} /></Button></>}</div></div>; })}{filteredItems.length === 0 && <div className="p-12 text-center"><ShieldCheck size={44} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei turvallisuustietoja</p><p className="mt-1 text-sm text-text-secondary">Luo ensimmäinen turvallisuushavainto tai muuta suodattimia.</p></div>}</CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{editing ? 'Muokkaa turvallisuustietoa' : 'Uusi turvallisuushavainto'}</DialogTitle></DialogHeader>{formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}<div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Tyyppi</Label><Select value={form.type} onValueChange={(type: SafetyItemType) => setForm((previous) => ({ ...previous, type }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SAFETY_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="safety-date">Päivä *</Label><Input id="safety-date" type="date" value={form.date} onChange={(event) => setForm((previous) => ({ ...previous, date: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="safety-title">Kuvaus *</Label><Input id="safety-title" value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))} /></div><div className="space-y-2"><Label>Vakavuus</Label><Select value={form.severity} onValueChange={(severity: SafetyForm['severity']) => setForm((previous) => ({ ...previous, severity }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Ei määritelty">Ei määritelty</SelectItem>{SEVERITIES.map((severity) => <SelectItem key={severity} value={severity}>{severity}</SelectItem>)}</SelectContent></Select></div>{canManage && <div className="space-y-2"><Label>Tila</Label><Select value={form.status} onValueChange={(status) => setForm((previous) => ({ ...previous, status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>}</div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void save()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}><DialogContent><DialogHeader><DialogTitle>Poista turvallisuustieto</DialogTitle></DialogHeader><p className="text-sm text-text-secondary">Poistetaanko <strong>{deleteTarget?.title}</strong>?</p><DialogFooter><Button variant="outline" onClick={() => setDeleteTarget(null)}>Peruuta</Button><Button variant="destructive" onClick={() => void removeItem()} disabled={saving}>Poista</Button></DialogFooter></DialogContent></Dialog>
    </motion.div>
  );
}
