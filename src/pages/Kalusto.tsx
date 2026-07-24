import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Download,
  Edit3,
  MapPin,
  Plus,
  Search,
  Tag,
  Trash2,
  Wrench,
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
  createEquipmentRecord,
  deleteEquipmentRecord,
  updateEquipmentRecord,
} from '@/lib/supabase/organizationEntities';
import type { Equipment, EquipmentStatus } from '@/types';

const ALL = 'Kaikki';
const EQUIPMENT_STATUSES: EquipmentStatus[] = ['Vapaa', 'Käytössä', 'Huollossa', 'Vuokralla'];

interface EquipmentForm {
  name: string;
  type: string;
  serial: string;
  location: string;
  status: EquipmentStatus;
  lastMaintenance: string;
}

const emptyForm: EquipmentForm = {
  name: '',
  type: '',
  serial: '',
  location: '',
  status: 'Vapaa',
  lastMaintenance: '',
};

function statusBadge(status: EquipmentStatus) {
  const classes: Record<EquipmentStatus, string> = {
    Vapaa: 'bg-emerald-50 text-emerald-700',
    Käytössä: 'bg-blue-50 text-blue-700',
    Huollossa: 'bg-amber-50 text-amber-700',
    Vuokralla: 'bg-purple-50 text-purple-700',
  };
  return <Badge className={`border-0 ${classes[status]}`}>{status}</Badge>;
}

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export default function Kalusto() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { equipment, refresh } = useAppDataContext();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Equipment | null>(null);
  const [form, setForm] = useState<EquipmentForm>(emptyForm);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);

  const filteredEquipment = useMemo(() => {
    const query = search.trim().toLowerCase();
    return equipment.filter((item) => {
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.type.toLowerCase().includes(query) ||
        item.serial.toLowerCase().includes(query) ||
        item.location.toLowerCase().includes(query);
      const matchesStatus = statusFilter === ALL || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [equipment, search, statusFilter]);

  const typeCount = new Set(equipment.map((item) => item.type).filter(Boolean)).size;

  const openCreate = () => {
    setEditingEquipment(null);
    setForm(emptyForm);
    setErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const openEdit = (item: Equipment) => {
    setEditingEquipment(item);
    setForm({
      name: item.name,
      type: item.type,
      serial: item.serial,
      location: item.location,
      status: item.status,
      lastMaintenance: item.lastMaintenance,
    });
    setErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const saveEquipment = async () => {
    const nextErrors: string[] = [];
    if (!form.name.trim()) nextErrors.push('Kaluston nimi on pakollinen.');
    if (!form.type.trim()) nextErrors.push('Kalustotyyppi on pakollinen.');
    setErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg) return;

    const payload: Omit<Equipment, 'id'> = {
      name: form.name.trim(),
      type: form.type.trim(),
      serial: form.serial.trim(),
      location: form.location.trim(),
      status: form.status,
      lastMaintenance: form.lastMaintenance,
    };

    setSaving(true);
    setOperationError(null);
    try {
      if (editingEquipment) {
        await updateEquipmentRecord(currentOrg.id, editingEquipment.id, payload);
      } else {
        await createEquipmentRecord(currentOrg.id, user?.id, payload);
      }
      await refresh();
      setDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tallennus epäonnistui.';
      setOperationError(message);
      logger.error('Kalustotietojen tallennus epäonnistui', { error });
    } finally {
      setSaving(false);
    }
  };

  const removeEquipment = async () => {
    if (!deleteTarget || !currentOrg) return;
    setSaving(true);
    setOperationError(null);
    try {
      await deleteEquipmentRecord(currentOrg.id, deleteTarget.id);
      await refresh();
      setDeleteTarget(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Poistaminen epäonnistui.';
      setOperationError(message);
      logger.error('Kaluston poistaminen epäonnistui', { error });
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const rows = equipment.map((item) => [
      item.name,
      item.type,
      item.serial,
      item.location,
      item.status,
      item.lastMaintenance,
    ]);
    const csv = [
      ['Nimi', 'Tyyppi', 'Sarjanumero', 'Sijainti', 'Tila', 'Viimeisin huolto'],
      ...rows,
    ].map((row) => row.map(csvCell).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kalusto-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-hero text-text-primary">Kalusto</h1>
          <p className="mt-1 text-body-sm text-text-secondary">Työkalujen, koneiden ja laitteiden hallinta</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreate} className="gap-2"><Plus size={16} /> Lisää kalusto</Button>
          <Button variant="outline" onClick={exportCsv} disabled={equipment.length === 0} className="gap-2"><Download size={16} /> Vie CSV</Button>
        </div>
      </div>

      {operationError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} /> {operationError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Kalustoa yhteensä', value: equipment.length, icon: Wrench },
          { label: 'Vapaana', value: equipment.filter((item) => item.status === 'Vapaa').length, icon: CheckCircle2 },
          { label: 'Huollossa', value: equipment.filter((item) => item.status === 'Huollossa').length, icon: Calendar },
          { label: 'Kalustotyyppejä', value: typeCount, icon: Tag },
        ].map((item) => (
          <Card key={item.label} className="border-slate-200 shadow-card">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between"><span className="text-xs uppercase tracking-wider text-text-secondary">{item.label}</span><item.icon size={19} className="text-primary" /></div>
              <p className="font-mono text-3xl font-bold text-text-primary">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 sm:max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hae nimellä, tyypillä tai sarjanumerolla…" className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>Kaikki tilat</SelectItem>{EQUIPMENT_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden border-slate-200 shadow-card">
        <CardContent className="p-0">
          <div className="hidden grid-cols-[1.3fr_1fr_1fr_1fr_120px_100px_90px] gap-4 border-b bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted lg:grid">
            <span>Kalusto</span><span>Tyyppi</span><span>Sarjanumero</span><span>Sijainti</span><span>Huollettu</span><span>Tila</span><span className="text-right">Toiminnot</span>
          </div>
          {filteredEquipment.map((item) => (
            <div key={item.id} className="grid grid-cols-1 items-center gap-3 border-b border-slate-100 px-6 py-4 lg:grid-cols-[1.3fr_1fr_1fr_1fr_120px_100px_90px] lg:gap-4">
              <div><p className="font-semibold text-text-primary">{item.name}</p><p className="mt-1 flex items-center gap-1 text-xs text-text-secondary"><MapPin size={12} />{item.location || 'Ei sijaintia'}</p></div>
              <span className="text-sm text-text-primary">{item.type}</span>
              <span className="font-mono text-xs text-text-secondary">{item.serial || '—'}</span>
              <span className="text-sm text-text-secondary">{item.location || '—'}</span>
              <span className="text-sm text-text-secondary">{item.lastMaintenance || '—'}</span>
              <div>{statusBadge(item.status)}</div>
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(item)} aria-label={`Muokkaa ${item.name}`}><Edit3 size={15} /></Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-danger" onClick={() => setDeleteTarget(item)} aria-label={`Poista ${item.name}`}><Trash2 size={15} /></Button>
              </div>
            </div>
          ))}
          {filteredEquipment.length === 0 && <div className="p-12 text-center"><Wrench size={44} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei kalustoa</p><p className="mt-1 text-sm text-text-secondary">Lisää ensimmäinen kone tai muuta hakuehtoja.</p></div>}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>{editingEquipment ? 'Muokkaa kalustoa' : 'Lisää kalusto'}</DialogTitle></DialogHeader>
          {errors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="equipment-name">Nimi *</Label><Input id="equipment-name" value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="equipment-type">Tyyppi *</Label><Input id="equipment-type" value={form.type} onChange={(event) => setForm((previous) => ({ ...previous, type: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="equipment-serial">Sarjanumero</Label><Input id="equipment-serial" value={form.serial} onChange={(event) => setForm((previous) => ({ ...previous, serial: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="equipment-location">Sijainti</Label><Input id="equipment-location" value={form.location} onChange={(event) => setForm((previous) => ({ ...previous, location: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="equipment-maintenance">Viimeisin huolto</Label><Input id="equipment-maintenance" type="date" value={form.lastMaintenance} onChange={(event) => setForm((previous) => ({ ...previous, lastMaintenance: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Tila</Label><Select value={form.status} onValueChange={(value: EquipmentStatus) => setForm((previous) => ({ ...previous, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EQUIPMENT_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void saveEquipment()} disabled={saving}>{saving ? 'Tallennetaan…' : editingEquipment ? 'Tallenna muutokset' : 'Lisää kalusto'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Poista kalusto</DialogTitle></DialogHeader>
          <p className="text-sm text-text-secondary">Poistetaanko <strong>{deleteTarget?.name}</strong> kalustorekisteristä?</p>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={saving}>Peruuta</Button><Button variant="destructive" onClick={() => void removeEquipment()} disabled={saving}>{saving ? 'Poistetaan…' : 'Poista'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
