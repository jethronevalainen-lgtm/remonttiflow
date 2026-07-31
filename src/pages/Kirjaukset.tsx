import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  Clock3,
  FileText,
  Gauge,
  Loader2,
  Package,
  Plus,
  Receipt,
  RefreshCw,
  Save,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  createOperationalEntry,
  decideOperationalEntry,
  loadOperationalEntries,
  loadOperationalEntryCatalog,
  type OperationalEntry,
  type OperationalEntryCatalog,
  type OperationalEntryStatus,
  type OperationalEntryType,
} from '@/lib/supabase/operationalEntries';
import { cn } from '@/lib/utils';

const ALL = 'all';

const ENTRY_TYPES: Array<{ value: OperationalEntryType; label: string; description: string; icon: typeof Car }> = [
  { value: 'mileage', label: 'Kilometrit', description: 'Ajettu matka, alku- ja päätepiste sekä työn tarkoitus.', icon: Car },
  { value: 'material', label: 'Materiaalit ja tuotteet', description: 'Työmaalla käytetty materiaali, määrä, yksikkö ja kustannus.', icon: Package },
  { value: 'equipment_usage', label: 'Koneen käyttötunnit', description: 'Kalusto, käyttöaika ja mittarilukemat.', icon: Gauge },
  { value: 'daily_note', label: 'Päivän seloste', description: 'Työmaan tai päivän vapaa operatiivinen seloste.', icon: FileText },
];

const EMPTY_FORM = {
  occurredOn: new Date().toISOString().slice(0, 10),
  projectId: '',
  title: '',
  description: '',
  quantity: '',
  unit: 'kpl',
  distanceKm: '',
  durationHours: '',
  meterStart: '',
  meterEnd: '',
  amountEur: '',
  startLocation: '',
  endLocation: '',
  equipmentId: '',
};

function euro(cents: number | null): string {
  return cents == null
    ? '—'
    : new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function dateTime(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

function entryTypeLabel(type: OperationalEntryType): string {
  return ENTRY_TYPES.find((item) => item.value === type)?.label ?? type;
}

function statusClass(status: OperationalEntryStatus): string {
  if (status === 'Hyväksytty') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Hylätty') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function entryPrimary(entry: OperationalEntry): string {
  if (entry.entryType === 'mileage') return `${entry.distanceKm ?? 0} km`;
  if (entry.entryType === 'material') return `${entry.title || 'Materiaali'} · ${entry.quantity ?? 0} ${entry.unit || ''}`;
  if (entry.entryType === 'equipment_usage') return `${entry.equipmentName || 'Kalusto'} · ${entry.durationHours ?? 0} h`;
  return entry.title || entry.description || 'Päivän seloste';
}

function entrySecondary(entry: OperationalEntry): string {
  if (entry.entryType === 'mileage') return [entry.startLocation, entry.endLocation].filter(Boolean).join(' → ') || entry.description || '';
  if (entry.entryType === 'material') return [entry.description, entry.amountCents != null ? euro(entry.amountCents) : null].filter(Boolean).join(' · ');
  if (entry.entryType === 'equipment_usage') {
    const meter = entry.meterStart != null || entry.meterEnd != null ? `mittari ${entry.meterStart ?? '—'}–${entry.meterEnd ?? '—'}` : null;
    return [entry.description, meter].filter(Boolean).join(' · ');
  }
  return entry.description || '';
}

export default function Kirjaukset() {
  const navigate = useNavigate();
  const { currentOrg, currentRole } = useOrganization();
  const management = currentRole === 'admin' || currentRole === 'supervisor';
  const [catalog, setCatalog] = useState<OperationalEntryCatalog>({ projects: [], equipment: [] });
  const [entries, setEntries] = useState<OperationalEntry[]>([]);
  const [entryType, setEntryType] = useState<OperationalEntryType>('mileage');
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterType, setFilterType] = useState(ALL);
  const [filterProject, setFilterProject] = useState(ALL);
  const [filterStatus, setFilterStatus] = useState(ALL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [decisionTarget, setDecisionTarget] = useState<OperationalEntry | null>(null);
  const [decisionStatus, setDecisionStatus] = useState<Extract<OperationalEntryStatus, 'Hyväksytty' | 'Hylätty'>>('Hyväksytty');
  const [rejectionReason, setRejectionReason] = useState('');

  const refresh = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      const [nextCatalog, nextEntries] = await Promise.all([
        loadOperationalEntryCatalog(currentOrg.id),
        loadOperationalEntries({
          organizationId: currentOrg.id,
          entryType: filterType === ALL ? null : filterType as OperationalEntryType,
          projectId: filterProject === ALL ? null : filterProject,
          status: filterStatus === ALL ? null : filterStatus as OperationalEntryStatus,
        }),
      ]);
      setCatalog(nextCatalog);
      setEntries(nextEntries);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kirjausten lataus epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [currentOrg, filterProject, filterStatus, filterType]);

  useEffect(() => { void refresh(); }, [refresh]);

  const selectedEquipment = useMemo(
    () => catalog.equipment.find((item) => item.id === form.equipmentId),
    [catalog.equipment, form.equipmentId],
  );

  const reset = () => {
    setForm({ ...EMPTY_FORM, occurredOn: new Date().toISOString().slice(0, 10) });
    setError(null);
  };

  const save = async () => {
    if (!currentOrg) return;
    const numeric = (value: string): number | null => {
      if (!value.trim()) return null;
      const parsed = Number(value.replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : null;
    };
    const errors: string[] = [];
    const distanceKm = numeric(form.distanceKm);
    const quantity = numeric(form.quantity);
    const durationHours = numeric(form.durationHours);
    const meterStart = numeric(form.meterStart);
    const meterEnd = numeric(form.meterEnd);
    const amountEur = numeric(form.amountEur);

    if (!form.occurredOn) errors.push('Päivämäärä puuttuu.');
    if (entryType === 'mileage' && (!distanceKm || distanceKm <= 0)) errors.push('Anna ajettu kilometrimäärä.');
    if (entryType === 'material' && (!form.title.trim() || !quantity || quantity <= 0 || !form.unit.trim())) errors.push('Anna materiaalin nimi, määrä ja yksikkö.');
    if (entryType === 'equipment_usage' && (!form.equipmentId || !durationHours || durationHours <= 0)) errors.push('Valitse kalusto ja anna käyttötunnit.');
    if (entryType === 'daily_note' && form.description.trim().length < 10) errors.push('Päivän selosteen pitää olla vähintään 10 merkkiä.');
    if (meterStart != null && meterEnd != null && meterEnd < meterStart) errors.push('Loppumittari ei voi olla alkumittaria pienempi.');
    if (errors.length) {
      setError(errors.join(' '));
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await createOperationalEntry({
        organizationId: currentOrg.id,
        entryType,
        occurredOn: form.occurredOn,
        projectId: form.projectId || null,
        equipmentId: form.equipmentId || null,
        title: form.title,
        description: form.description,
        quantity,
        unit: form.unit,
        distanceKm,
        durationHours,
        meterStart,
        meterEnd,
        amountCents: amountEur == null ? null : Math.round(amountEur * 100),
        startLocation: form.startLocation,
        endLocation: form.endLocation,
      });
      setSuccess(`${entryTypeLabel(entryType)} tallennettiin käsiteltäväksi.`);
      reset();
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kirjauksen tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const openDecision = (entry: OperationalEntry, status: Extract<OperationalEntryStatus, 'Hyväksytty' | 'Hylätty'>) => {
    setDecisionTarget(entry);
    setDecisionStatus(status);
    setRejectionReason('');
    setError(null);
  };

  const decide = async () => {
    if (!currentOrg || !decisionTarget) return;
    if (decisionStatus === 'Hylätty' && rejectionReason.trim().length < 3) {
      setError('Anna hylkäykselle perustelu.');
      return;
    }
    setSaving(true);
    try {
      await decideOperationalEntry({
        organizationId: currentOrg.id,
        entryId: decisionTarget.id,
        status: decisionStatus,
        rejectionReason,
      });
      setDecisionTarget(null);
      setSuccess(decisionStatus === 'Hyväksytty' ? 'Kirjaus hyväksyttiin.' : 'Kirjaus hylättiin.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Päätöksen tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950 p-5 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300"><Plus size={16} /> Kirjaukset</div><h1 className="mt-3 text-3xl font-bold tracking-tight">Työmaakirjaukset</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Kilometrit, kulut, materiaalit, koneiden käyttötunnit ja päivän selosteet. Tuntikirjaukset ovat omassa Työaika-näkymässään.</p></div>
          <Badge className="w-fit border-white/20 bg-white/10 px-3 py-2 text-white">{management ? 'Työnjohdon käsittelynäkymä' : 'Omat kirjaukset'}</Badge>
        </div>
      </section>

      {error && <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertTriangle size={18} className="mt-0.5 shrink-0" />{error}</div>}
      {success && <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={18} className="mt-0.5 shrink-0" />{success}</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Button variant="outline" className="h-auto min-h-24 justify-start gap-3 p-4" onClick={() => navigate('/tuntikirjaukset')}><Clock3 size={22} className="shrink-0 text-blue-700" /><span className="text-left"><span className="block font-semibold">Työaika</span><span className="mt-1 block text-xs font-normal text-slate-500">Kellonajat, tauot ja ylityöt</span></span></Button>
        <Button variant="outline" className="h-auto min-h-24 justify-start gap-3 p-4" onClick={() => navigate('/matkakulut')}><Receipt size={22} className="shrink-0 text-emerald-700" /><span className="text-left"><span className="block font-semibold">Kulut ja kuitit</span><span className="mt-1 block text-xs font-normal text-slate-500">Matkakulut ja hyväksyntä</span></span></Button>
        {ENTRY_TYPES.map((type) => <button key={type.value} type="button" onClick={() => { setEntryType(type.value); document.getElementById('new-operational-entry')?.scrollIntoView({ behavior: 'smooth' }); }} className="flex min-h-24 items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-orange-300 hover:bg-orange-50/40"><type.icon size={22} className="mt-0.5 shrink-0 text-orange-700" /><span><span className="block font-semibold text-slate-950">{type.label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{type.description}</span></span></button>)}
      </div>

      <Tabs defaultValue="new" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl border border-slate-200 bg-white p-1"><TabsTrigger value="new" className="min-h-11">Uusi kirjaus</TabsTrigger><TabsTrigger value="entries" className="min-h-11">Kirjaushistoria ({entries.length})</TabsTrigger></TabsList>

        <TabsContent value="new">
          <Card id="new-operational-entry" className="border-slate-200 shadow-sm">
            <CardHeader><CardTitle className="text-lg">Uusi {entryTypeLabel(entryType).toLocaleLowerCase('fi')}</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{ENTRY_TYPES.map((type) => <button key={type.value} type="button" onClick={() => { setEntryType(type.value); reset(); }} className={cn('flex min-h-14 items-center gap-2 rounded-xl border p-3 text-left text-sm font-medium', entryType === type.value ? 'border-orange-400 bg-orange-50 text-orange-900' : 'border-slate-200 hover:bg-slate-50')}><type.icon size={18} />{type.label}</button>)}</div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="operational-date">Päivä *</Label><Input id="operational-date" type="date" value={form.occurredOn} onChange={(event) => setForm((old) => ({ ...old, occurredOn: event.target.value }))} /></div>
                <div className="space-y-2"><Label>Projekti</Label><Select value={form.projectId || 'none'} onValueChange={(value) => setForm((old) => ({ ...old, projectId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei projektia</SelectItem>{catalog.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.projectNumber ? `${project.projectNumber} · ` : ''}{project.name}</SelectItem>)}</SelectContent></Select></div>

                {entryType === 'mileage' && <>
                  <div className="space-y-2"><Label htmlFor="mileage-distance">Kilometrit *</Label><Input id="mileage-distance" inputMode="decimal" value={form.distanceKm} onChange={(event) => setForm((old) => ({ ...old, distanceKm: event.target.value }))} placeholder="Esim. 42,5" /></div>
                  <div className="space-y-2"><Label htmlFor="mileage-title">Matkan tarkoitus</Label><Input id="mileage-title" value={form.title} onChange={(event) => setForm((old) => ({ ...old, title: event.target.value }))} placeholder="Esim. materiaalien nouto" /></div>
                  <div className="space-y-2"><Label htmlFor="mileage-start">Lähtöpaikka</Label><Input id="mileage-start" value={form.startLocation} onChange={(event) => setForm((old) => ({ ...old, startLocation: event.target.value }))} /></div>
                  <div className="space-y-2"><Label htmlFor="mileage-end">Päätepiste</Label><Input id="mileage-end" value={form.endLocation} onChange={(event) => setForm((old) => ({ ...old, endLocation: event.target.value }))} /></div>
                </>}

                {entryType === 'material' && <>
                  <div className="space-y-2"><Label htmlFor="material-title">Materiaali tai tuote *</Label><Input id="material-title" value={form.title} onChange={(event) => setForm((old) => ({ ...old, title: event.target.value }))} placeholder="Esim. kipsilevy 13 mm" /></div>
                  <div className="grid grid-cols-[1fr_120px] gap-3"><div className="space-y-2"><Label htmlFor="material-quantity">Määrä *</Label><Input id="material-quantity" inputMode="decimal" value={form.quantity} onChange={(event) => setForm((old) => ({ ...old, quantity: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="material-unit">Yksikkö *</Label><Input id="material-unit" value={form.unit} onChange={(event) => setForm((old) => ({ ...old, unit: event.target.value }))} /></div></div>
                  <div className="space-y-2"><Label htmlFor="material-amount">Kustannus EUR</Label><Input id="material-amount" inputMode="decimal" value={form.amountEur} onChange={(event) => setForm((old) => ({ ...old, amountEur: event.target.value }))} placeholder="0,00" /></div>
                </>}

                {entryType === 'equipment_usage' && <>
                  <div className="space-y-2 sm:col-span-2"><Label>Kalusto *</Label><Select value={form.equipmentId || 'none'} onValueChange={(value) => setForm((old) => ({ ...old, equipmentId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Valitse kalusto</SelectItem>{catalog.equipment.map((equipment) => <SelectItem key={equipment.id} value={equipment.id}>{equipment.assetNumber ? `${equipment.assetNumber} · ` : ''}{equipment.name}</SelectItem>)}</SelectContent></Select>{selectedEquipment && <p className="text-xs text-slate-500">{selectedEquipment.type} · {selectedEquipment.status}</p>}</div>
                  <div className="space-y-2"><Label htmlFor="equipment-hours">Käyttötunnit *</Label><Input id="equipment-hours" inputMode="decimal" value={form.durationHours} onChange={(event) => setForm((old) => ({ ...old, durationHours: event.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="meter-start">Alkumittari</Label><Input id="meter-start" inputMode="decimal" value={form.meterStart} onChange={(event) => setForm((old) => ({ ...old, meterStart: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="meter-end">Loppumittari</Label><Input id="meter-end" inputMode="decimal" value={form.meterEnd} onChange={(event) => setForm((old) => ({ ...old, meterEnd: event.target.value }))} /></div></div>
                </>}

                {entryType === 'daily_note' && <div className="space-y-2 sm:col-span-2"><Label htmlFor="daily-title">Otsikko</Label><Input id="daily-title" value={form.title} onChange={(event) => setForm((old) => ({ ...old, title: event.target.value }))} placeholder="Esim. Päivän tilanne ja seuraavat työvaiheet" /></div>}

                <div className="space-y-2 sm:col-span-2"><Label htmlFor="operational-description">{entryType === 'daily_note' ? 'Seloste *' : 'Lisätiedot'}</Label><Textarea id="operational-description" rows={5} value={form.description} onChange={(event) => setForm((old) => ({ ...old, description: event.target.value }))} placeholder="Kuvaa työ, käyttötarkoitus, poikkeamat tai muut olennaiset tiedot." /></div>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={reset} disabled={saving}>Tyhjennä</Button><Button className="gap-2" onClick={() => void save()} disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{saving ? 'Tallennetaan…' : 'Tallenna kirjaus'}</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entries">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><CardTitle className="text-lg">Kirjaushistoria</CardTitle><Button variant="outline" size="sm" className="gap-2" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Päivitä</Button></div></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3"><div className="space-y-2"><Label>Tyyppi</Label><Select value={filterType} onValueChange={setFilterType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Kaikki kirjaukset</SelectItem>{ENTRY_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Projekti</Label><Select value={filterProject} onValueChange={setFilterProject}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Kaikki projektit</SelectItem>{catalog.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Tila</Label><Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Kaikki tilat</SelectItem><SelectItem value="Odottaa">Odottaa</SelectItem><SelectItem value="Hyväksytty">Hyväksytty</SelectItem><SelectItem value="Hylätty">Hylätty</SelectItem></SelectContent></Select></div></div>

              {loading && <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" /> Ladataan kirjauksia…</div>}
              {!loading && entries.map((entry) => {
                const type = ENTRY_TYPES.find((item) => item.value === entry.entryType) ?? ENTRY_TYPES[0];
                return <div key={entry.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="flex min-w-0 flex-1 items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700"><type.icon size={21} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-950">{entryPrimary(entry)}</p><Badge variant="outline" className={statusClass(entry.status)}>{entry.status}</Badge></div><p className="mt-1 text-xs text-slate-500">{entry.userName} · {entry.projectName || 'Ei projektia'} · {entry.occurredOn} · kirjattu {dateTime(entry.createdAt)}</p>{entrySecondary(entry) && <p className="mt-3 text-sm leading-6 text-slate-700">{entrySecondary(entry)}</p>}{entry.rejectionReason && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><strong>Hylkäyksen syy:</strong> {entry.rejectionReason}</p>}</div></div>{management && entry.status === 'Odottaa' && <div className="flex gap-2"><Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => openDecision(entry, 'Hyväksytty')}><CheckCircle2 size={15} /> Hyväksy</Button><Button size="sm" variant="destructive" className="gap-1" onClick={() => openDecision(entry, 'Hylätty')}><XCircle size={15} /> Hylkää</Button></div>}</div></div>;
              })}
              {!loading && entries.length === 0 && <div className="py-10 text-center"><FileText size={40} className="mx-auto mb-3 text-slate-400" /><p className="font-semibold text-slate-800">Kirjauksia ei löytynyt</p><p className="mt-1 text-sm text-slate-500">Tee uusi kirjaus tai poista historiaan asetettuja suodattimia.</p></div>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(decisionTarget)} onOpenChange={(open) => !open && setDecisionTarget(null)}><DialogContent><DialogHeader><DialogTitle>{decisionStatus === 'Hyväksytty' ? 'Hyväksy kirjaus' : 'Hylkää kirjaus'}</DialogTitle></DialogHeader><p className="text-sm text-slate-700">{decisionTarget ? entryPrimary(decisionTarget) : ''}</p>{decisionStatus === 'Hylätty' && <div className="space-y-2"><Label htmlFor="operational-rejection">Hylkäyksen syy *</Label><Textarea id="operational-rejection" rows={4} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} /></div>}<DialogFooter><Button variant="outline" onClick={() => setDecisionTarget(null)} disabled={saving}>Peruuta</Button><Button variant={decisionStatus === 'Hylätty' ? 'destructive' : 'default'} onClick={() => void decide()} disabled={saving}>{saving ? 'Tallennetaan…' : decisionStatus}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
