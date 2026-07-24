import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  Edit3,
  Euro,
  MapPin,
  Plus,
  Route,
  Trash2,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import logger from '@/lib/logger';
import {
  createDrivingLogRecord,
  createTravelExpenseRecord,
  deleteDrivingLogRecord,
  deleteTravelExpenseRecord,
  updateDrivingLogRecord,
  updateTravelExpenseRecord,
} from '@/lib/supabase/operationsEntities';
import type {
  DrivingLogEntry,
  TravelExpense,
  TravelExpenseStatus,
} from '@/types';

interface TripForm {
  date: string;
  driver: string;
  startAddress: string;
  endAddress: string;
  distance: string;
  purpose: string;
  project: string;
}

interface ExpenseForm {
  date: string;
  employee: string;
  type: string;
  description: string;
  amount: string;
  status: TravelExpenseStatus;
}

const emptyTrip: TripForm = {
  date: new Date().toISOString().slice(0, 10),
  driver: '',
  startAddress: '',
  endAddress: '',
  distance: '',
  purpose: '',
  project: '',
};

const emptyExpense: ExpenseForm = {
  date: new Date().toISOString().slice(0, 10),
  employee: '',
  type: 'Kilometrikorvaus',
  description: '',
  amount: '',
  status: 'Odottaa',
};

const EXPENSE_STATUSES: TravelExpenseStatus[] = ['Odottaa', 'Hyväksytty', 'Hylätty'];

function money(value: number) {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value);
}

function statusBadge(status: TravelExpenseStatus) {
  const classes: Record<TravelExpenseStatus, string> = {
    Odottaa: 'bg-amber-50 text-amber-700',
    Hyväksytty: 'bg-emerald-50 text-emerald-700',
    Hylätty: 'bg-red-50 text-red-700',
  };
  return <Badge className={`border-0 ${classes[status]}`}>{status}</Badge>;
}

export default function Matkakulut() {
  const { user, profile } = useAuth();
  const { currentOrg } = useOrganization();
  const { drivingLog, travelExpenses, loading, error, refresh } = useOperationsData();
  const [activeTab, setActiveTab] = useState('trips');
  const [tripDialogOpen, setTripDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<DrivingLogEntry | null>(null);
  const [editingExpense, setEditingExpense] = useState<TravelExpense | null>(null);
  const [deleteTrip, setDeleteTrip] = useState<DrivingLogEntry | null>(null);
  const [deleteExpense, setDeleteExpense] = useState<TravelExpense | null>(null);
  const [tripForm, setTripForm] = useState<TripForm>(emptyTrip);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(emptyExpense);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const totalDistance = drivingLog.reduce((sum, entry) => sum + entry.distance, 0);
  const pendingAmount = travelExpenses
    .filter((expense) => expense.status === 'Odottaa')
    .reduce((sum, expense) => sum + expense.amount, 0);
  const approvedAmount = travelExpenses
    .filter((expense) => expense.status === 'Hyväksytty')
    .reduce((sum, expense) => sum + expense.amount, 0);

  const openTripCreate = () => {
    setEditingTrip(null);
    setTripForm({
      ...emptyTrip,
      date: new Date().toISOString().slice(0, 10),
      driver: profile?.full_name || user?.email || '',
    });
    setFormErrors([]);
    setOperationError(null);
    setTripDialogOpen(true);
  };

  const openTripEdit = (entry: DrivingLogEntry) => {
    setEditingTrip(entry);
    setTripForm({
      date: entry.date,
      driver: entry.driver,
      startAddress: entry.startAddress,
      endAddress: entry.endAddress,
      distance: String(entry.distance),
      purpose: entry.purpose,
      project: entry.project ?? '',
    });
    setFormErrors([]);
    setOperationError(null);
    setTripDialogOpen(true);
  };

  const saveTrip = async () => {
    const distance = Number(tripForm.distance);
    const nextErrors: string[] = [];
    if (!tripForm.date) nextErrors.push('Päivämäärä on pakollinen.');
    if (!tripForm.driver.trim()) nextErrors.push('Kuljettaja on pakollinen.');
    if (!tripForm.startAddress.trim() || !tripForm.endAddress.trim()) nextErrors.push('Lähtö- ja päätepiste ovat pakollisia.');
    if (!Number.isFinite(distance) || distance <= 0) nextErrors.push('Matkan pitää olla positiivinen kilometrimäärä.');
    if (!tripForm.purpose.trim()) nextErrors.push('Matkan tarkoitus on pakollinen.');
    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg) return;

    const payload: Omit<DrivingLogEntry, 'id'> = {
      date: tripForm.date,
      driver: tripForm.driver.trim(),
      vehicle: '',
      startAddress: tripForm.startAddress.trim(),
      endAddress: tripForm.endAddress.trim(),
      distance,
      purpose: tripForm.purpose.trim(),
      project: tripForm.project.trim() || undefined,
    };

    setSaving(true);
    setOperationError(null);
    try {
      if (editingTrip) await updateDrivingLogRecord(currentOrg.id, editingTrip.id, payload);
      else await createDrivingLogRecord(currentOrg.id, user?.id, payload);
      await refresh();
      setTripDialogOpen(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Tallennus epäonnistui.';
      setOperationError(message);
      logger.error('Ajopäiväkirjan tallennus epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  const openExpenseCreate = () => {
    setEditingExpense(null);
    setExpenseForm({
      ...emptyExpense,
      date: new Date().toISOString().slice(0, 10),
      employee: profile?.full_name || user?.email || '',
    });
    setFormErrors([]);
    setOperationError(null);
    setExpenseDialogOpen(true);
  };

  const openExpenseEdit = (expense: TravelExpense) => {
    setEditingExpense(expense);
    setExpenseForm({
      date: expense.date,
      employee: expense.employee,
      type: expense.type,
      description: expense.description,
      amount: String(expense.amount),
      status: expense.status,
    });
    setFormErrors([]);
    setOperationError(null);
    setExpenseDialogOpen(true);
  };

  const saveExpense = async () => {
    const amount = Number(expenseForm.amount);
    const nextErrors: string[] = [];
    if (!expenseForm.date) nextErrors.push('Päivämäärä on pakollinen.');
    if (!expenseForm.employee.trim()) nextErrors.push('Työntekijä on pakollinen.');
    if (!expenseForm.type.trim()) nextErrors.push('Kulutyyppi on pakollinen.');
    if (!Number.isFinite(amount) || amount <= 0) nextErrors.push('Summan pitää olla positiivinen.');
    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg) return;

    const payload: Omit<TravelExpense, 'id'> = {
      date: expenseForm.date,
      employee: expenseForm.employee.trim(),
      type: expenseForm.type.trim(),
      description: expenseForm.description.trim(),
      amount,
      status: expenseForm.status,
    };

    setSaving(true);
    setOperationError(null);
    try {
      if (editingExpense) await updateTravelExpenseRecord(currentOrg.id, editingExpense.id, payload);
      else await createTravelExpenseRecord(currentOrg.id, user?.id, payload);
      await refresh();
      setExpenseDialogOpen(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Tallennus epäonnistui.';
      setOperationError(message);
      logger.error('Matkakulun tallennus epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  const removeTrip = async () => {
    if (!deleteTrip || !currentOrg) return;
    setSaving(true);
    try {
      await deleteDrivingLogRecord(currentOrg.id, deleteTrip.id);
      await refresh();
      setDeleteTrip(null);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const removeExpense = async () => {
    if (!deleteExpense || !currentOrg) return;
    setSaving(true);
    try {
      await deleteTravelExpenseRecord(currentOrg.id, deleteExpense.id);
      await refresh();
      setDeleteExpense(null);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-hero text-text-primary">Matkakulut ja ajopäiväkirja</h1>
        <p className="mt-1 text-body-sm text-text-secondary">Tallenna työajot ja erilliset korvaushakemukset ilman automaattisia korvausolettamia</p>
      </div>

      {(error || operationError) && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={16} />{operationError ?? error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5"><div className="mb-2 flex justify-between text-sm text-text-secondary"><span>Ajettu yhteensä</span><Route size={18} className="text-primary" /></div><p className="font-mono text-3xl font-bold">{totalDistance.toLocaleString('fi-FI')} km</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="mb-2 flex justify-between text-sm text-text-secondary"><span>Odottaa käsittelyä</span><Euro size={18} className="text-amber-600" /></div><p className="font-mono text-3xl font-bold">{money(pendingAmount)}</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="mb-2 flex justify-between text-sm text-text-secondary"><span>Hyväksytty</span><CheckCircle2 size={18} className="text-emerald-600" /></div><p className="font-mono text-3xl font-bold">{money(approvedAmount)}</p></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList><TabsTrigger value="trips">Ajopäiväkirja</TabsTrigger><TabsTrigger value="expenses">Korvaushakemukset</TabsTrigger></TabsList>
          {activeTab === 'trips' ? <Button onClick={openTripCreate} className="gap-2"><Plus size={16} /> Lisää ajo</Button> : <Button onClick={openExpenseCreate} className="gap-2"><Plus size={16} /> Lisää matkakulu</Button>}
        </div>

        <TabsContent value="trips" className="mt-4">
          <Card className="overflow-hidden"><CardContent className="p-0">
            <div className="hidden grid-cols-[110px_1fr_1.3fr_100px_1.2fr_90px] gap-3 border-b bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted lg:grid"><span>Päivä</span><span>Kuljettaja</span><span>Reitti</span><span>Matka</span><span>Tarkoitus / projekti</span><span className="text-right">Toiminnot</span></div>
            {drivingLog.map((entry) => <div key={entry.id} className="grid grid-cols-1 items-center gap-3 border-b border-slate-100 px-6 py-4 lg:grid-cols-[110px_1fr_1.3fr_100px_1.2fr_90px]"><span className="text-sm text-text-secondary">{entry.date}</span><span className="font-medium">{entry.driver}</span><span className="flex items-center gap-1 text-sm text-text-secondary"><MapPin size={13} />{entry.startAddress} → {entry.endAddress}</span><span className="font-mono text-sm">{entry.distance.toLocaleString('fi-FI')} km</span><div><p className="text-sm">{entry.purpose}</p><p className="text-xs text-text-secondary">{entry.project || 'Ei projektia'}</p></div><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openTripEdit(entry)}><Edit3 size={15} /></Button><Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-danger" onClick={() => setDeleteTrip(entry)}><Trash2 size={15} /></Button></div></div>)}
            {!loading && drivingLog.length === 0 && <div className="p-12 text-center"><Car size={44} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei ajopäiväkirjamerkintöjä</p></div>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <Card className="overflow-hidden"><CardContent className="p-0">
            <div className="hidden grid-cols-[110px_1fr_1fr_1.5fr_110px_110px_90px] gap-3 border-b bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted lg:grid"><span>Päivä</span><span>Työntekijä</span><span>Tyyppi</span><span>Selite</span><span>Summa</span><span>Tila</span><span className="text-right">Toiminnot</span></div>
            {travelExpenses.map((expense) => <div key={expense.id} className="grid grid-cols-1 items-center gap-3 border-b border-slate-100 px-6 py-4 lg:grid-cols-[110px_1fr_1fr_1.5fr_110px_110px_90px]"><span className="text-sm text-text-secondary">{expense.date}</span><span className="font-medium">{expense.employee}</span><span className="text-sm">{expense.type}</span><span className="text-sm text-text-secondary">{expense.description || '—'}</span><span className="font-mono text-sm">{money(expense.amount)}</span><div>{statusBadge(expense.status)}</div><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openExpenseEdit(expense)}><Edit3 size={15} /></Button><Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-danger" onClick={() => setDeleteExpense(expense)}><Trash2 size={15} /></Button></div></div>)}
            {!loading && travelExpenses.length === 0 && <div className="p-12 text-center"><Euro size={44} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei korvaushakemuksia</p></div>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={tripDialogOpen} onOpenChange={setTripDialogOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{editingTrip ? 'Muokkaa ajoa' : 'Uusi ajo'}</DialogTitle></DialogHeader>{formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}<div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="trip-date">Päivä *</Label><Input id="trip-date" type="date" value={tripForm.date} onChange={(event) => setTripForm((previous) => ({ ...previous, date: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="trip-driver">Kuljettaja *</Label><Input id="trip-driver" value={tripForm.driver} onChange={(event) => setTripForm((previous) => ({ ...previous, driver: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="trip-from">Lähtö *</Label><Input id="trip-from" value={tripForm.startAddress} onChange={(event) => setTripForm((previous) => ({ ...previous, startAddress: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="trip-to">Määränpää *</Label><Input id="trip-to" value={tripForm.endAddress} onChange={(event) => setTripForm((previous) => ({ ...previous, endAddress: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="trip-distance">Matka km *</Label><Input id="trip-distance" type="number" min="0" step="0.1" value={tripForm.distance} onChange={(event) => setTripForm((previous) => ({ ...previous, distance: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="trip-project">Projekti</Label><Input id="trip-project" value={tripForm.project} onChange={(event) => setTripForm((previous) => ({ ...previous, project: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="trip-purpose">Tarkoitus *</Label><Textarea id="trip-purpose" value={tripForm.purpose} onChange={(event) => setTripForm((previous) => ({ ...previous, purpose: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setTripDialogOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void saveTrip()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{editingExpense ? 'Muokkaa matkakulua' : 'Uusi matkakulu'}</DialogTitle></DialogHeader>{formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}<div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="expense-date">Päivä *</Label><Input id="expense-date" type="date" value={expenseForm.date} onChange={(event) => setExpenseForm((previous) => ({ ...previous, date: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="expense-employee">Työntekijä *</Label><Input id="expense-employee" value={expenseForm.employee} onChange={(event) => setExpenseForm((previous) => ({ ...previous, employee: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="expense-type">Kulutyyppi *</Label><Input id="expense-type" value={expenseForm.type} onChange={(event) => setExpenseForm((previous) => ({ ...previous, type: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="expense-amount">Summa € *</Label><Input id="expense-amount" type="number" min="0" step="0.01" value={expenseForm.amount} onChange={(event) => setExpenseForm((previous) => ({ ...previous, amount: event.target.value }))} /></div><div className="space-y-2"><Label>Tila</Label><Select value={expenseForm.status} onValueChange={(value: TravelExpenseStatus) => setExpenseForm((previous) => ({ ...previous, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EXPENSE_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="expense-description">Selite</Label><Textarea id="expense-description" value={expenseForm.description} onChange={(event) => setExpenseForm((previous) => ({ ...previous, description: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setExpenseDialogOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void saveExpense()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(deleteTrip)} onOpenChange={(open) => !open && setDeleteTrip(null)}><DialogContent><DialogHeader><DialogTitle>Poista ajo</DialogTitle></DialogHeader><p className="text-sm text-text-secondary">Poistetaanko ajo {deleteTrip?.startAddress} → {deleteTrip?.endAddress}?</p><DialogFooter><Button variant="outline" onClick={() => setDeleteTrip(null)}>Peruuta</Button><Button variant="destructive" onClick={() => void removeTrip()} disabled={saving}>Poista</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={Boolean(deleteExpense)} onOpenChange={(open) => !open && setDeleteExpense(null)}><DialogContent><DialogHeader><DialogTitle>Poista matkakulu</DialogTitle></DialogHeader><p className="text-sm text-text-secondary">Poistetaanko {deleteExpense?.type}, {deleteExpense && money(deleteExpense.amount)}?</p><DialogFooter><Button variant="outline" onClick={() => setDeleteExpense(null)}>Peruuta</Button><Button variant="destructive" onClick={() => void removeExpense()} disabled={saving}>Poista</Button></DialogFooter></DialogContent></Dialog>
    </motion.div>
  );
}
