import { useMemo, useState } from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOperationsData } from '@/hooks/useOperationsData';
import logger from '@/lib/logger';
import {
  createDrivingLogRecord,
  createTravelExpenseRecord,
  deleteDrivingLogRecord,
  deleteTravelExpenseRecord,
  updateDrivingLogRecord,
  updateTravelExpenseRecord,
} from '@/lib/supabase/operationsEntities';
import type { DrivingLogEntry, TravelExpense, TravelExpenseStatus } from '@/types';

interface TripForm {
  date: string;
  driver: string;
  equipmentId: string;
  projectId: string;
  project: string;
  startAddress: string;
  endAddress: string;
  distance: string;
  startOdometerKm: string;
  endOdometerKm: string;
  purpose: string;
}

interface ExpenseForm {
  date: string;
  employee: string;
  projectId: string;
  type: string;
  description: string;
  amount: string;
  status: TravelExpenseStatus;
}

const emptyTrip: TripForm = {
  date: new Date().toISOString().slice(0, 10),
  driver: '',
  equipmentId: '',
  projectId: '',
  project: '',
  startAddress: '',
  endAddress: '',
  distance: '',
  startOdometerKm: '',
  endOdometerKm: '',
  purpose: '',
};
const emptyExpense: ExpenseForm = {
  date: new Date().toISOString().slice(0, 10),
  employee: '',
  projectId: '',
  type: 'Kilometrikorvaus',
  description: '',
  amount: '',
  status: 'Odottaa',
};

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
  const { currentOrg, currentRole } = useOrganization();
  const { projects, equipment } = useAppDataContext();
  const { drivingLog, travelExpenses, loading, error, refresh } = useOperationsData();
  const [activeTab, setActiveTab] = useState('trips');
  const [tripDialogOpen, setTripDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<DrivingLogEntry | null>(null);
  const [editingExpense, setEditingExpense] = useState<TravelExpense | null>(null);
  const [deleteTrip, setDeleteTrip] = useState<DrivingLogEntry | null>(null);
  const [deleteExpense, setDeleteExpense] = useState<TravelExpense | null>(null);
  const [rejectExpense, setRejectExpense] = useState<TravelExpense | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [tripForm, setTripForm] = useState<TripForm>(emptyTrip);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(emptyExpense);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canApprove = currentRole === 'admin' || currentRole === 'supervisor';
  const aliases = useMemo(() => [profile?.full_name, user?.email]
    .filter(Boolean)
    .map((value) => value!.toLocaleLowerCase('fi')), [profile?.full_name, user?.email]);
  const visibleTrips = useMemo(() => canApprove
    ? drivingLog
    : drivingLog.filter((entry) => entry.userId === user?.id || (!entry.userId && aliases.includes(entry.driver.toLocaleLowerCase('fi')))),
  [aliases, canApprove, drivingLog, user?.id]);
  const visibleExpenses = useMemo(() => canApprove
    ? travelExpenses
    : travelExpenses.filter((entry) => entry.userId === user?.id || (!entry.userId && aliases.includes(entry.employee.toLocaleLowerCase('fi')))),
  [aliases, canApprove, travelExpenses, user?.id]);

  const totalDistance = visibleTrips.reduce((sum, entry) => sum + entry.distance, 0);
  const pendingAmount = visibleExpenses.filter((expense) => expense.status === 'Odottaa').reduce((sum, expense) => sum + expense.amount, 0);
  const approvedAmount = visibleExpenses.filter((expense) => expense.status === 'Hyväksytty').reduce((sum, expense) => sum + expense.amount, 0);

  const openTripCreate = () => {
    setEditingTrip(null);
    setTripForm({ ...emptyTrip, date: new Date().toISOString().slice(0, 10), driver: profile?.full_name || user?.email || '' });
    setFormErrors([]);
    setOperationError(null);
    setTripDialogOpen(true);
  };

  const openTripEdit = (entry: DrivingLogEntry) => {
    if (!canApprove && entry.userId && entry.userId !== user?.id) return;
    setEditingTrip(entry);
    setTripForm({
      date: entry.date,
      driver: entry.driver,
      equipmentId: entry.equipmentId ?? '',
      projectId: entry.projectId ?? '',
      project: entry.project ?? '',
      startAddress: entry.startAddress,
      endAddress: entry.endAddress,
      distance: String(entry.distance),
      startOdometerKm: entry.startOdometerKm == null ? '' : String(entry.startOdometerKm),
      endOdometerKm: entry.endOdometerKm == null ? '' : String(entry.endOdometerKm),
      purpose: entry.purpose,
    });
    setFormErrors([]);
    setOperationError(null);
    setTripDialogOpen(true);
  };

  const selectTripProject = (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    setTripForm((previous) => ({ ...previous, projectId, project: project?.name ?? previous.project }));
  };

  const saveTrip = async () => {
    const distance = Number(tripForm.distance);
    const startOdometer = tripForm.startOdometerKm === '' ? undefined : Number(tripForm.startOdometerKm);
    const endOdometer = tripForm.endOdometerKm === '' ? undefined : Number(tripForm.endOdometerKm);
    const nextErrors: string[] = [];
    if (!tripForm.date) nextErrors.push('Päivämäärä on pakollinen.');
    if (!tripForm.driver.trim()) nextErrors.push('Kuljettaja on pakollinen.');
    if (!tripForm.startAddress.trim() || !tripForm.endAddress.trim()) nextErrors.push('Lähtö- ja päätepiste ovat pakollisia.');
    if (!Number.isFinite(distance) || distance <= 0) nextErrors.push('Matkan pitää olla positiivinen kilometrimäärä.');
    if (!tripForm.purpose.trim()) nextErrors.push('Matkan tarkoitus on pakollinen.');
    if (startOdometer !== undefined && endOdometer !== undefined && endOdometer < startOdometer) nextErrors.push('Loppumittari ei voi olla alkumittaria pienempi.');
    setFormErrors(nextErrors);
    if (nextErrors.length || !currentOrg) return;

    const selectedEquipment = equipment.find((item) => item.id === tripForm.equipmentId);
    const payload: Omit<DrivingLogEntry, 'id'> = {
      date: tripForm.date,
      userId: editingTrip?.userId ?? user?.id,
      driver: tripForm.driver.trim(),
      equipmentId: tripForm.equipmentId || undefined,
      vehicle: selectedEquipment?.name ?? '',
      projectId: tripForm.projectId || undefined,
      project: tripForm.project.trim() || undefined,
      startAddress: tripForm.startAddress.trim(),
      endAddress: tripForm.endAddress.trim(),
      distance,
      startOdometerKm: startOdometer,
      endOdometerKm: endOdometer,
      purpose: tripForm.purpose.trim(),
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
    setExpenseForm({ ...emptyExpense, date: new Date().toISOString().slice(0, 10), employee: profile?.full_name || user?.email || '' });
    setFormErrors([]);
    setOperationError(null);
    setExpenseDialogOpen(true);
  };

  const openExpenseEdit = (expense: TravelExpense) => {
    if (!canApprove && expense.status !== 'Odottaa') return;
    setEditingExpense(expense);
    setExpenseForm({
      date: expense.date,
      employee: expense.employee,
      projectId: expense.projectId ?? '',
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
    if (nextErrors.length || !currentOrg) return;

    const payload: Omit<TravelExpense, 'id'> = {
      date: expenseForm.date,
      userId: editingExpense?.userId ?? user?.id,
      employee: expenseForm.employee.trim(),
      projectId: expenseForm.projectId || undefined,
      type: expenseForm.type.trim(),
      description: expenseForm.description.trim(),
      amount,
      status: canApprove ? expenseForm.status : 'Odottaa',
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

  const setExpenseStatus = async (expense: TravelExpense, status: TravelExpenseStatus, reason?: string) => {
    if (!currentOrg || !canApprove || !user) return;
    setSaving(true);
    setOperationError(null);
    try {
      await updateTravelExpenseRecord(currentOrg.id, expense.id, {
        status,
        approvedBy: status === 'Hyväksytty' ? user.id : undefined,
        approvedAt: status === 'Hyväksytty' ? new Date().toISOString() : undefined,
        rejectionReason: status === 'Hylätty' ? reason : undefined,
      });
      await refresh();
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Käsittely epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const rejectSelectedExpense = async () => {
    if (!rejectExpense || rejectionReason.trim().length < 3) {
      setOperationError('Hylkäyksen perustelun pitää olla vähintään 3 merkkiä.');
      return;
    }
    await setExpenseStatus(rejectExpense, 'Hylätty', rejectionReason.trim());
    setRejectExpense(null);
    setRejectionReason('');
  };

  const removeTrip = async () => {
    if (!deleteTrip || !currentOrg) return;
    setSaving(true);
    try { await deleteDrivingLogRecord(currentOrg.id, deleteTrip.id); await refresh(); setDeleteTrip(null); }
    catch (caught) { setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.'); }
    finally { setSaving(false); }
  };

  const removeExpense = async () => {
    if (!deleteExpense || !currentOrg) return;
    setSaving(true);
    try { await deleteTravelExpenseRecord(currentOrg.id, deleteExpense.id); await refresh(); setDeleteExpense(null); }
    catch (caught) { setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.'); }
    finally { setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div><h1 className="text-hero text-text-primary">Matkakulut ja ajopäiväkirja</h1><p className="mt-1 text-body-sm text-text-secondary">Käyttäjä-, projekti- ja ajoneuvosidonnaiset ajot sekä hyväksyttävät korvaushakemukset</p></div>
      {(error || operationError) && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={16} />{operationError ?? error}</div>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><Card><CardContent className="p-5"><div className="mb-2 flex justify-between text-sm text-text-secondary"><span>Ajettu yhteensä</span><Route size={18} className="text-primary" /></div><p className="font-mono text-3xl font-bold">{totalDistance.toLocaleString('fi-FI')} km</p></CardContent></Card><Card><CardContent className="p-5"><div className="mb-2 flex justify-between text-sm text-text-secondary"><span>Odottaa käsittelyä</span><Euro size={18} className="text-amber-600" /></div><p className="font-mono text-3xl font-bold">{money(pendingAmount)}</p></CardContent></Card><Card><CardContent className="p-5"><div className="mb-2 flex justify-between text-sm text-text-secondary"><span>Hyväksytty</span><CheckCircle2 size={18} className="text-emerald-600" /></div><p className="font-mono text-3xl font-bold">{money(approvedAmount)}</p></CardContent></Card></div>

      <Tabs value={activeTab} onValueChange={setActiveTab}><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><TabsList><TabsTrigger value="trips">Ajopäiväkirja</TabsTrigger><TabsTrigger value="expenses">Korvaushakemukset</TabsTrigger></TabsList>{activeTab === 'trips' ? <Button onClick={openTripCreate} className="gap-2"><Plus size={16} /> Lisää ajo</Button> : <Button onClick={openExpenseCreate} className="gap-2"><Plus size={16} /> Lisää matkakulu</Button>}</div>
        <TabsContent value="trips" className="mt-4"><Card className="overflow-hidden"><CardContent className="p-0"><div className="hidden grid-cols-[100px_1fr_1.3fr_100px_1.2fr_90px] gap-3 border-b bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted lg:grid"><span>Päivä</span><span>Kuljettaja</span><span>Reitti</span><span>Matka</span><span>Tarkoitus / projekti</span><span></span></div>{visibleTrips.map((entry) => <div key={entry.id} className="grid gap-3 border-b px-6 py-4 lg:grid-cols-[100px_1fr_1.3fr_100px_1.2fr_90px] lg:items-center"><span className="text-sm text-text-secondary">{entry.date}</span><div><p className="font-medium">{entry.driver}</p><p className="text-xs text-text-secondary">{equipment.find((item) => item.id === entry.equipmentId)?.name || 'Ajoneuvoa ei valittu'}</p></div><div className="text-sm"><p className="flex items-center gap-1"><MapPin size={13} />{entry.startAddress}</p><p className="flex items-center gap-1"><MapPin size={13} />{entry.endAddress}</p></div><span className="font-mono">{entry.distance.toLocaleString('fi-FI')} km</span><div><p>{entry.purpose}</p><p className="text-xs text-text-secondary">{entry.project || 'Ei projektia'}</p></div><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openTripEdit(entry)}><Edit3 size={15} /></Button><Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600" onClick={() => setDeleteTrip(entry)}><Trash2 size={15} /></Button></div></div>)}{!loading && !visibleTrips.length && <div className="p-12 text-center"><Car size={44} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei ajoja</p></div>}</CardContent></Card></TabsContent>
        <TabsContent value="expenses" className="mt-4"><Card className="overflow-hidden"><CardContent className="p-0"><div className="hidden grid-cols-[100px_1fr_1fr_120px_110px_170px] gap-3 border-b bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted lg:grid"><span>Päivä</span><span>Työntekijä</span><span>Kulu</span><span>Summa</span><span>Tila</span><span></span></div>{visibleExpenses.map((expense) => <div key={expense.id} className="grid gap-3 border-b px-6 py-4 lg:grid-cols-[100px_1fr_1fr_120px_110px_170px] lg:items-center"><span className="text-sm text-text-secondary">{expense.date}</span><span className="font-medium">{expense.employee}</span><div><p>{expense.type}</p><p className="text-xs text-text-secondary">{expense.description || projects.find((item) => item.id === expense.projectId)?.name || 'Ei kuvausta'}</p>{expense.rejectionReason && <p className="text-xs text-red-600">Hylkäys: {expense.rejectionReason}</p>}</div><span className="font-mono font-semibold">{money(expense.amount)}</span><div>{statusBadge(expense.status)}</div><div className="flex justify-end gap-1">{canApprove && expense.status === 'Odottaa' && <><Button variant="ghost" size="sm" className="text-emerald-700" onClick={() => void setExpenseStatus(expense, 'Hyväksytty')}><CheckCircle2 size={15} /></Button><Button variant="ghost" size="sm" className="text-red-700" onClick={() => { setRejectExpense(expense); setRejectionReason(''); }}><XCircle size={15} /></Button></>}<Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={!canApprove && expense.status !== 'Odottaa'} onClick={() => openExpenseEdit(expense)}><Edit3 size={15} /></Button><Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600" onClick={() => setDeleteExpense(expense)}><Trash2 size={15} /></Button></div></div>)}{!loading && !visibleExpenses.length && <div className="p-12 text-center"><Euro size={44} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei korvaushakemuksia</p></div>}</CardContent></Card></TabsContent>
      </Tabs>

      <Dialog open={tripDialogOpen} onOpenChange={setTripDialogOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editingTrip ? 'Muokkaa ajoa' : 'Uusi ajo'}</DialogTitle></DialogHeader>{formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}<div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="trip-date">Päivä *</Label><Input id="trip-date" type="date" value={tripForm.date} onChange={(event) => setTripForm((previous) => ({ ...previous, date: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="trip-driver">Kuljettaja *</Label><Input id="trip-driver" value={tripForm.driver} onChange={(event) => setTripForm((previous) => ({ ...previous, driver: event.target.value }))} disabled={!canApprove} /></div><div className="space-y-2"><Label>Ajoneuvo</Label><Select value={tripForm.equipmentId || 'none'} onValueChange={(value) => setTripForm((previous) => ({ ...previous, equipmentId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei ajoneuvoa</SelectItem>{equipment.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Projekti</Label><Select value={tripForm.projectId || 'none'} onValueChange={(value) => value === 'none' ? setTripForm((previous) => ({ ...previous, projectId: '', project: '' })) : selectTripProject(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei projektia</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="trip-start">Lähtö *</Label><Input id="trip-start" value={tripForm.startAddress} onChange={(event) => setTripForm((previous) => ({ ...previous, startAddress: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="trip-end">Päätepiste *</Label><Input id="trip-end" value={tripForm.endAddress} onChange={(event) => setTripForm((previous) => ({ ...previous, endAddress: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="trip-distance">Matka km *</Label><Input id="trip-distance" type="number" min="0" step="0.1" value={tripForm.distance} onChange={(event) => setTripForm((previous) => ({ ...previous, distance: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="trip-purpose">Tarkoitus *</Label><Input id="trip-purpose" value={tripForm.purpose} onChange={(event) => setTripForm((previous) => ({ ...previous, purpose: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="trip-odometer-start">Alkumittari km</Label><Input id="trip-odometer-start" type="number" value={tripForm.startOdometerKm} onChange={(event) => setTripForm((previous) => ({ ...previous, startOdometerKm: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="trip-odometer-end">Loppumittari km</Label><Input id="trip-odometer-end" type="number" value={tripForm.endOdometerKm} onChange={(event) => setTripForm((previous) => ({ ...previous, endOdometerKm: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setTripDialogOpen(false)}>Peruuta</Button><Button onClick={() => void saveTrip()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{editingExpense ? 'Muokkaa matkakulua' : 'Uusi matkakulu'}</DialogTitle></DialogHeader>{formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}<div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="expense-date">Päivä *</Label><Input id="expense-date" type="date" value={expenseForm.date} onChange={(event) => setExpenseForm((previous) => ({ ...previous, date: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="expense-employee">Työntekijä *</Label><Input id="expense-employee" value={expenseForm.employee} onChange={(event) => setExpenseForm((previous) => ({ ...previous, employee: event.target.value }))} disabled={!canApprove} /></div><div className="space-y-2"><Label>Projekti</Label><Select value={expenseForm.projectId || 'none'} onValueChange={(value) => setExpenseForm((previous) => ({ ...previous, projectId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei projektia</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="expense-type">Kulutyyppi *</Label><Input id="expense-type" value={expenseForm.type} onChange={(event) => setExpenseForm((previous) => ({ ...previous, type: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="expense-amount">Summa € *</Label><Input id="expense-amount" type="number" min="0" step="0.01" value={expenseForm.amount} onChange={(event) => setExpenseForm((previous) => ({ ...previous, amount: event.target.value }))} /></div>{canApprove && <div className="space-y-2"><Label>Tila</Label><Select value={expenseForm.status} onValueChange={(status: TravelExpenseStatus) => setExpenseForm((previous) => ({ ...previous, status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(['Odottaa','Hyväksytty','Hylätty'] as TravelExpenseStatus[]).map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>}<div className="space-y-2 sm:col-span-2"><Label htmlFor="expense-description">Kuvaus</Label><Textarea id="expense-description" value={expenseForm.description} onChange={(event) => setExpenseForm((previous) => ({ ...previous, description: event.target.value }))} rows={3} /></div></div><DialogFooter><Button variant="outline" onClick={() => setExpenseDialogOpen(false)}>Peruuta</Button><Button onClick={() => void saveExpense()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(rejectExpense)} onOpenChange={(open) => { if (!open) setRejectExpense(null); }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Hylkää korvaushakemus</DialogTitle></DialogHeader><div className="space-y-2"><Label htmlFor="expense-rejection">Perustelu *</Label><Textarea id="expense-rejection" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={4} /></div><DialogFooter><Button variant="outline" onClick={() => setRejectExpense(null)}>Peruuta</Button><Button variant="destructive" onClick={() => void rejectSelectedExpense()}>Hylkää</Button></DialogFooter></DialogContent></Dialog>

      <AlertDialog open={Boolean(deleteTrip || deleteExpense)} onOpenChange={(open) => { if (!open) { setDeleteTrip(null); setDeleteExpense(null); } }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Poistetaanko kirjaus?</AlertDialogTitle><AlertDialogDescription>Poistoa ei voi perua.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteTrip ? void removeTrip() : void removeExpense()}>Poista</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </motion.div>
  );
}
