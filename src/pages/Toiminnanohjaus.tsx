import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Car,
  Check,
  ClipboardList,
  Clock3,
  Download,
  Euro,
  FileSpreadsheet,
  FileText,
  Gauge,
  Loader2,
  LocateFixed,
  MapPin,
  Package,
  Plus,
  Printer,
  RefreshCw,
  Route,
  ShieldCheck,
  UsersRound,
  Wrench,
  X,
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
import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { captureCurrentWorkSiteLocation } from '@/lib/supabase/workSiteCheckIns';
import {
  createOperationalEntry,
  createSubcontractor,
  createSubcontractorAssignment,
  createSubcontractorWorker,
  createVehiclePosition,
  getConstructionReporting,
  listBillingItems,
  listLatestVehiclePositions,
  listOperationalEntries,
  listSubcontractors,
  recordConstructionExport,
  reviewOperationalEntry,
  syncBillingItems,
  transitionBillingItem,
  updateBillingItemPrice,
  type BillingItem,
  type BillingStatus,
  type ConstructionReportingData,
  type OperationalEntry,
  type OperationalEntryType,
  type Subcontractor,
  type VehiclePosition,
} from '@/lib/supabase/workinfoSuite';
import { downloadCsv, downloadXlsx, openPrintReport, type ExportCell } from '@/lib/reportExport';
import { cn } from '@/lib/utils';

const TAB_KEYS = ['entries', 'subcontractors', 'billing', 'vehicles', 'reports'] as const;
type TabKey = typeof TAB_KEYS[number];

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function moneyFromCents(value?: number) {
  if (value == null) return 'Ei määritetty';
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value / 100);
}

function dateTime(value?: string) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: 'Luonnos',
    submitted: 'Odottaa käsittelyä',
    approved: 'Hyväksytty',
    rejected: 'Hylätty',
    recorded: 'Kirjattu',
    billable: 'Laskutettava',
    queued: 'Lisätty laskulle',
    invoiced: 'Laskutettu',
    credited: 'Hyvitetty',
    active: 'Aktiivinen',
  };
  return labels[status] ?? status;
}

function entryTypeLabel(type: OperationalEntryType) {
  return type === 'material' ? 'Materiaali' : type === 'equipment' ? 'Konekirjaus' : 'Päivän seloste';
}

function billingNextActions(status: BillingStatus): BillingStatus[] {
  if (status === 'recorded') return ['approved', 'rejected'];
  if (status === 'approved') return ['billable', 'rejected'];
  if (status === 'billable') return ['queued', 'rejected'];
  if (status === 'queued') return ['invoiced', 'rejected'];
  if (status === 'invoiced') return ['credited'];
  return [];
}

function reportRows(data: ConstructionReportingData, kind: 'workers' | 'contracts'): ExportCell[][] {
  if (kind === 'workers') {
    const rows = [...data.workerRows, ...data.subcontractorWorkerRows];
    return [
      ['Työmaa', 'Osoite', 'Työntekijä', 'Veronumero', 'Työnantaja', 'Y-tunnus', 'Henkilöryhmä', 'Ensimmäinen työpäivä', 'Viimeinen työpäivä', 'Oikeus alkaa', 'Oikeus päättyy'],
      ...rows.map((row) => [
        row.projectName,
        row.siteLocation ?? '',
        row.workerName,
        row.taxNumber ?? '',
        row.employerName,
        row.employerBusinessId ?? '',
        row.employmentCategory,
        row.firstWorkDate ?? '',
        row.lastWorkDate ?? '',
        row.validFrom ?? '',
        row.validUntil ?? '',
      ]),
    ];
  }
  return [
    ['Työmaa', 'Osoite', 'Alihankkija', 'Y-tunnus', 'Sopimusnumero', 'Sopimuksen arvo EUR', 'Laskutusperuste', 'Rakentamispalvelu', 'Alkaa', 'Päättyy', '15 000 € raja ylittyy'],
    ...data.contractRows.map((row) => [
      row.projectName,
      row.siteLocation ?? '',
      row.subcontractorName,
      row.businessId ?? '',
      row.contractNumber ?? '',
      row.contractValueCents == null ? '' : row.contractValueCents / 100,
      row.billingBasis,
      row.isConstructionService ? 'Kyllä' : 'Ei',
      row.startsAt ?? '',
      row.endsAt ?? '',
      row.reportingThresholdExceeded ? 'Kyllä' : 'Ei',
    ]),
  ];
}

export default function Toiminnanohjaus() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { currentOrg, currentRole } = useOrganization();
  const { projects, workOrders, equipment } = useAppDataContext();
  const canManage = currentRole === 'admin' || currentRole === 'supervisor';
  const requestedTab = searchParams.get('tab');
  const activeTab: TabKey = TAB_KEYS.includes(requestedTab as TabKey) ? requestedTab as TabKey : 'entries';

  const [entries, setEntries] = useState<OperationalEntry[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [billingItems, setBillingItems] = useState<BillingItem[]>([]);
  const [vehiclePositions, setVehiclePositions] = useState<VehiclePosition[]>([]);
  const [construction, setConstruction] = useState<ConstructionReportingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [entryOpen, setEntryOpen] = useState(false);
  const [entryType, setEntryType] = useState<OperationalEntryType>('material');
  const [entryProjectId, setEntryProjectId] = useState('');
  const [entryWorkOrderId, setEntryWorkOrderId] = useState('');
  const [entryEquipmentId, setEntryEquipmentId] = useState('');
  const [entryTitle, setEntryTitle] = useState('');
  const [entryDescription, setEntryDescription] = useState('');
  const [entryQuantity, setEntryQuantity] = useState('');
  const [entryUnit, setEntryUnit] = useState('kpl');
  const [entryUnitCost, setEntryUnitCost] = useState('');

  const [subcontractorOpen, setSubcontractorOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [liabilityUntil, setLiabilityUntil] = useState('');
  const [insuranceUntil, setInsuranceUntil] = useState('');
  const [subcontractorNotes, setSubcontractorNotes] = useState('');

  const [workerOpen, setWorkerOpen] = useState(false);
  const [selectedSubcontractorId, setSelectedSubcontractorId] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [workerEmail, setWorkerEmail] = useState('');
  const [workerPhone, setWorkerPhone] = useState('');
  const [workerTaxNumber, setWorkerTaxNumber] = useState('');
  const [workerValidFrom, setWorkerValidFrom] = useState('');
  const [workerValidUntil, setWorkerValidUntil] = useState('');

  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignmentSubcontractorId, setAssignmentSubcontractorId] = useState('');
  const [assignmentProjectId, setAssignmentProjectId] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [contractValue, setContractValue] = useState('');
  const [billingBasis, setBillingBasis] = useState('urakka');
  const [contractStartsAt, setContractStartsAt] = useState('');
  const [contractEndsAt, setContractEndsAt] = useState('');

  const [billingPrices, setBillingPrices] = useState<Record<string, string>>({});
  const [invoiceRefs, setInvoiceRefs] = useState<Record<string, string>>({});

  const [selectedVehiclePositionId, setSelectedVehiclePositionId] = useState('');
  const [vehicleEquipmentId, setVehicleEquipmentId] = useState('');
  const [vehicleProjectId, setVehicleProjectId] = useState('');
  const [vehicleSourceReference, setVehicleSourceReference] = useState('');

  const [reportMonth, setReportMonth] = useState(currentMonth());
  const [reportProjectId, setReportProjectId] = useState('all');

  const selectedProjectOrders = useMemo(
    () => workOrders.filter((order) => !entryProjectId || order.projectId === entryProjectId),
    [entryProjectId, workOrders],
  );
  const selectedVehiclePosition = vehiclePositions.find((item) => item.id === selectedVehiclePositionId) ?? vehiclePositions[0];
  const selectedVehicleEquipment = equipment.find((item) => item.id === selectedVehiclePosition?.equipmentId);

  const loadTab = useCallback(async (tab: TabKey = activeTab) => {
    if (!currentOrg) return;
    setLoading(true);
    setError(null);
    try {
      if (tab === 'entries') setEntries(await listOperationalEntries(currentOrg.id));
      if (tab === 'subcontractors' && canManage) setSubcontractors(await listSubcontractors(currentOrg.id));
      if (tab === 'billing' && canManage) setBillingItems(await listBillingItems(currentOrg.id));
      if (tab === 'vehicles' && canManage) {
        const next = await listLatestVehiclePositions(currentOrg.id);
        setVehiclePositions(next);
        if (next.length > 0 && !selectedVehiclePositionId) setSelectedVehiclePositionId(next[0].id);
      }
      if (tab === 'reports' && canManage) {
        setConstruction(await getConstructionReporting(currentOrg.id, reportMonth, reportProjectId === 'all' ? undefined : reportProjectId));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tietojen haku epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, canManage, currentOrg, reportMonth, reportProjectId, selectedVehiclePositionId]);

  useEffect(() => { void loadTab(activeTab); }, [activeTab, loadTab]);

  const selectTab = (value: string) => {
    if (!TAB_KEYS.includes(value as TabKey)) return;
    setSearchParams({ tab: value });
  };

  const resetMessages = () => { setError(null); setSuccess(null); };

  const saveEntry = async () => {
    if (!currentOrg || !user || !entryTitle.trim()) {
      setError('Kirjauksen otsikko on pakollinen.');
      return;
    }
    const quantity = entryQuantity ? Number(entryQuantity) : undefined;
    const unitCostCents = entryUnitCost ? Math.round(Number(entryUnitCost.replace(',', '.')) * 100) : undefined;
    if (quantity != null && (!Number.isFinite(quantity) || quantity <= 0)) {
      setError('Määrän pitää olla positiivinen numero.');
      return;
    }
    if (unitCostCents != null && (!Number.isFinite(unitCostCents) || unitCostCents < 0)) {
      setError('Yksikköhinta ei ole kelvollinen.');
      return;
    }
    setSaving(true); resetMessages();
    try {
      await createOperationalEntry({
        organizationId: currentOrg.id,
        userId: user.id,
        projectId: entryProjectId || undefined,
        workOrderId: entryWorkOrderId || undefined,
        equipmentId: entryEquipmentId || undefined,
        entryType,
        title: entryTitle,
        description: entryDescription,
        quantity,
        unit: entryUnit,
        unitCostCents,
      });
      setEntryOpen(false);
      setEntryTitle(''); setEntryDescription(''); setEntryQuantity(''); setEntryUnitCost('');
      setSuccess('Kirjaus tallennettiin käsiteltäväksi.');
      await loadTab('entries');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kirjauksen tallennus epäonnistui.');
    } finally { setSaving(false); }
  };

  const decideEntry = async (entry: OperationalEntry, status: 'approved' | 'rejected') => {
    if (!currentOrg || !user) return;
    const rejectionReason = status === 'rejected' ? window.prompt('Hylkäyksen syy') ?? '' : undefined;
    if (status === 'rejected' && !rejectionReason?.trim()) return;
    setSaving(true); resetMessages();
    try {
      await reviewOperationalEntry(currentOrg.id, entry.id, status, user.id, rejectionReason);
      setSuccess(status === 'approved' ? 'Kirjaus hyväksyttiin.' : 'Kirjaus hylättiin.');
      await loadTab('entries');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Käsittely epäonnistui.'); }
    finally { setSaving(false); }
  };

  const saveSubcontractor = async () => {
    if (!currentOrg || !user || !companyName.trim()) { setError('Yrityksen nimi on pakollinen.'); return; }
    setSaving(true); resetMessages();
    try {
      await createSubcontractor({
        organizationId: currentOrg.id,
        userId: user.id,
        companyName,
        businessId,
        contactName,
        contactEmail,
        contactPhone,
        liabilityDocumentsValidUntil: liabilityUntil,
        insuranceValidUntil: insuranceUntil,
        notes: subcontractorNotes,
      });
      setSubcontractorOpen(false); setCompanyName(''); setBusinessId(''); setContactName(''); setContactEmail(''); setContactPhone(''); setLiabilityUntil(''); setInsuranceUntil(''); setSubcontractorNotes('');
      setSuccess('Alihankkija lisättiin.');
      await loadTab('subcontractors');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Alihankkijan tallennus epäonnistui.'); }
    finally { setSaving(false); }
  };

  const saveWorker = async () => {
    if (!currentOrg || !user || !selectedSubcontractorId || !workerName.trim()) { setError('Valitse alihankkija ja anna työntekijän nimi.'); return; }
    setSaving(true); resetMessages();
    try {
      await createSubcontractorWorker({ organizationId: currentOrg.id, subcontractorId: selectedSubcontractorId, userId: user.id, name: workerName, email: workerEmail, phone: workerPhone, taxNumber: workerTaxNumber, validFrom: workerValidFrom, validUntil: workerValidUntil });
      setWorkerOpen(false); setWorkerName(''); setWorkerEmail(''); setWorkerPhone(''); setWorkerTaxNumber(''); setWorkerValidFrom(''); setWorkerValidUntil('');
      setSuccess('Alihankkijan työntekijä lisättiin.');
      await loadTab('subcontractors');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Työntekijän tallennus epäonnistui.'); }
    finally { setSaving(false); }
  };

  const saveAssignment = async () => {
    if (!currentOrg || !user || !assignmentSubcontractorId || !assignmentProjectId) { setError('Valitse alihankkija ja projekti.'); return; }
    const cents = contractValue ? Math.round(Number(contractValue.replace(',', '.')) * 100) : undefined;
    if (cents != null && (!Number.isFinite(cents) || cents < 0)) { setError('Sopimuksen arvo ei ole kelvollinen.'); return; }
    setSaving(true); resetMessages();
    try {
      await createSubcontractorAssignment({ organizationId: currentOrg.id, subcontractorId: assignmentSubcontractorId, projectId: assignmentProjectId, userId: user.id, contractNumber, contractValueCents: cents, billingBasis, isConstructionService: true, startsAt: contractStartsAt, endsAt: contractEndsAt });
      setAssignmentOpen(false); setContractNumber(''); setContractValue(''); setContractStartsAt(''); setContractEndsAt('');
      setSuccess('Alihankkija liitettiin projektiin.');
      await loadTab('subcontractors');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Projektikytkennän tallennus epäonnistui.'); }
    finally { setSaving(false); }
  };

  const syncBilling = async () => {
    if (!currentOrg) return;
    setSaving(true); resetMessages();
    try {
      const count = await syncBillingItems(currentOrg.id);
      setSuccess(`${count} uutta hyväksyttyä tuntikirjausta lisättiin laskutusketjuun.`);
      await loadTab('billing');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Laskutusrivien muodostaminen epäonnistui.'); }
    finally { setSaving(false); }
  };

  const saveBillingPrice = async (item: BillingItem) => {
    if (!currentOrg) return;
    const euros = Number((billingPrices[item.id] ?? '').replace(',', '.'));
    if (!Number.isFinite(euros) || euros < 0) { setError('Anna kelvollinen yksikköhinta euroina.'); return; }
    setSaving(true); resetMessages();
    try {
      await updateBillingItemPrice(currentOrg.id, item.id, Math.round(euros * 100));
      setSuccess('Laskutushinta tallennettiin.');
      await loadTab('billing');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Hinnan tallennus epäonnistui.'); }
    finally { setSaving(false); }
  };

  const changeBillingStatus = async (item: BillingItem, status: BillingStatus) => {
    const reference = status === 'invoiced' ? (invoiceRefs[item.id] ?? window.prompt('Laskun numero tai viite') ?? '') : invoiceRefs[item.id];
    if (status === 'invoiced' && !reference?.trim()) return;
    setSaving(true); resetMessages();
    try {
      await transitionBillingItem(item.id, status, reference);
      setSuccess(`Laskutusrivi siirrettiin tilaan ${statusLabel(status)}.`);
      await loadTab('billing');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Laskutusrivin tilan muutos epäonnistui.'); }
    finally { setSaving(false); }
  };

  const saveVehiclePosition = async () => {
    if (!currentOrg || !user || !vehicleEquipmentId) { setError('Valitse ajoneuvo.'); return; }
    setSaving(true); resetMessages();
    try {
      const location = await captureCurrentWorkSiteLocation();
      await createVehiclePosition({ organizationId: currentOrg.id, equipmentId: vehicleEquipmentId, projectId: vehicleProjectId || undefined, userId: user.id, latitude: location.latitude, longitude: location.longitude, accuracyM: location.accuracyM, source: 'manual', sourceReference: vehicleSourceReference });
      setSuccess('Ajoneuvon nykyinen sijainti tallennettiin. Jatkuvaa taustaseurantaa ei käynnistetty.');
      await loadTab('vehicles');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Sijainnin tallennus epäonnistui.'); }
    finally { setSaving(false); }
  };

  const refreshReport = async () => {
    if (!currentOrg) return;
    setLoading(true); resetMessages();
    try { setConstruction(await getConstructionReporting(currentOrg.id, reportMonth, reportProjectId === 'all' ? undefined : reportProjectId)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Raportin muodostaminen epäonnistui.'); }
    finally { setLoading(false); }
  };

  const exportReport = async (kind: 'workers' | 'contracts', format: 'csv' | 'xlsx' | 'print') => {
    if (!construction || !currentOrg || !user) return;
    const rows = reportRows(construction, kind);
    const base = `vakantti-${kind === 'workers' ? 'tyontekijatiedot' : 'urakkatiedot'}-${reportMonth}`;
    try {
      if (format === 'csv') downloadCsv(`${base}.csv`, rows);
      if (format === 'xlsx') downloadXlsx(`${base}.xlsx`, kind === 'workers' ? 'Työntekijätiedot' : 'Urakkatiedot', rows);
      if (format === 'print') openPrintReport(kind === 'workers' ? 'Rakentamisen työntekijätiedot' : 'Rakentamisen urakkatiedot', rows);
      await recordConstructionExport({ organizationId: currentOrg.id, userId: user.id, reportType: kind === 'workers' ? 'worker_data' : 'contract_data', targetMonth: reportMonth, projectId: reportProjectId === 'all' ? undefined : reportProjectId, rowCount: Math.max(0, rows.length - 1) });
      setSuccess('Raportin muodostaminen kirjattiin audit-lokiin.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Raportin vienti epäonnistui.'); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-[1500px] space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300"><Gauge size={17} /> Operatiivinen keskus</div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Toiminnanohjaus</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">Työaika, työselosteet, materiaalit, koneet, alihankinta, laskutusvalmius ja rakentamisraportit yhdessä työtilassa.</p>
          </div>
          <Button variant="outline" className="w-fit border-slate-600 bg-slate-900 text-white hover:bg-slate-800 hover:text-white" onClick={() => navigate('/dashboard')}>Tilannekuva <ArrowRight size={15} className="ml-2" /></Button>
        </div>
      </div>

      {error && <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertTriangle size={18} className="mt-0.5 shrink-0" /><span className="min-w-0 flex-1">{error}</span><button type="button" aria-label="Sulje virhe" onClick={() => setError(null)}><X size={16} /></button></div>}
      {success && <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><Check size={18} className="mt-0.5 shrink-0" />{success}</div>}

      <Tabs value={activeTab} onValueChange={selectTab}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:grid-cols-5">
          <TabsTrigger value="entries">Kirjaukset</TabsTrigger>
          <TabsTrigger value="subcontractors" disabled={!canManage}>Alihankkijat</TabsTrigger>
          <TabsTrigger value="billing" disabled={!canManage}>Laskutus</TabsTrigger>
          <TabsTrigger value="vehicles" disabled={!canManage}>Ajoneuvot</TabsTrigger>
          <TabsTrigger value="reports" disabled={!canManage}>Raportit</TabsTrigger>
        </TabsList>

        <TabsContent value="entries" className="mt-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Työaika', detail: 'Kellonajat, tauot ja seloste', icon: Clock3, action: () => navigate('/tuntikirjaukset') },
              { label: 'Kilometrit ja kulut', detail: 'Ajopäiväkirja, päivärahat ja kuitit', icon: Route, action: () => navigate('/matkakulut') },
              { label: 'Materiaali', detail: 'Käytetyt tuotteet ja määrät', icon: Package, action: () => { setEntryType('material'); setEntryOpen(true); } },
              { label: 'Kone tai päivän seloste', detail: 'Käyttötunnit ja työmaan raportti', icon: Wrench, action: () => { setEntryType('equipment'); setEntryOpen(true); } },
            ].map((item) => <Button key={item.label} variant="outline" className="h-auto min-h-24 justify-start gap-4 p-4 text-left" onClick={item.action}><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><item.icon size={21} /></div><span><span className="block font-semibold">{item.label}</span><span className="mt-1 block text-xs font-normal leading-5 text-slate-500">{item.detail}</span></span></Button>)}
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-3 p-4 sm:p-6"><div><CardTitle>Materiaalit, koneet ja päivän selosteet</CardTitle><p className="mt-1 text-sm text-slate-500">Työntekijä näkee omat kirjauksensa. Työnjohto voi tarkastaa ja hyväksyä kaikki.</p></div><Button onClick={() => setEntryOpen(true)}><Plus size={16} className="mr-2" />Uusi kirjaus</Button></CardHeader>
            <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
              {entries.map((entry) => {
                const project = projects.find((item) => item.id === entry.projectId);
                return <div key={entry.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-slate-200 p-4 lg:flex-row lg:items-center"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">{entry.entryType === 'material' ? <Package size={19} /> : entry.entryType === 'equipment' ? <Wrench size={19} /> : <FileText size={19} />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-950">{entry.title}</p><Badge variant="outline">{entryTypeLabel(entry.entryType)}</Badge><Badge className={entry.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : entry.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}>{statusLabel(entry.status)}</Badge></div><p className="mt-1 text-xs text-slate-500">{project?.name ?? 'Ei projektia'} · {dateTime(entry.occurredAt)}</p>{entry.description && <p className="mt-2 text-sm leading-6 text-slate-700">{entry.description}</p>}</div><div className="shrink-0 text-sm"><p className="font-mono font-semibold">{entry.quantity != null ? `${entry.quantity} ${entry.unit ?? ''}` : ''}</p>{entry.unitCostCents != null && <p className="text-xs text-slate-500">{moneyFromCents(entry.unitCostCents)} / {entry.unit ?? 'yks.'}</p>}</div>{canManage && entry.status === 'submitted' && <div className="flex shrink-0 gap-2"><Button size="sm" variant="outline" onClick={() => void decideEntry(entry, 'rejected')} disabled={saving}>Hylkää</Button><Button size="sm" onClick={() => void decideEntry(entry, 'approved')} disabled={saving}>Hyväksy</Button></div>}</div>;
              })}
              {!loading && entries.length === 0 && <div className="py-10 text-center text-sm text-slate-500">Kirjauksia ei ole vielä.</div>}
              {loading && <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500"><Loader2 size={17} className="animate-spin" />Ladataan kirjauksia…</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subcontractors" className="mt-5 space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-bold text-slate-950">Alihankkijat ja työmaaoikeudet</h2><p className="mt-1 text-sm text-slate-500">Yritykset, työntekijät, veronumerot, sopimukset ja projektikytkennät.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setWorkerOpen(true)} disabled={subcontractors.length === 0}><UsersRound size={16} className="mr-2" />Lisää työntekijä</Button><Button variant="outline" onClick={() => setAssignmentOpen(true)} disabled={subcontractors.length === 0}><ClipboardList size={16} className="mr-2" />Liitä projektiin</Button><Button onClick={() => setSubcontractorOpen(true)}><Plus size={16} className="mr-2" />Uusi alihankkija</Button></div></div>
          <div className="grid gap-4 xl:grid-cols-2">
            {subcontractors.map((company) => {
              const today = new Date().toISOString().slice(0, 10);
              const documentsExpired = Boolean(company.liabilityDocumentsValidUntil && company.liabilityDocumentsValidUntil < today);
              const insuranceExpired = Boolean(company.insuranceValidUntil && company.insuranceValidUntil < today);
              return <Card key={company.id} className="min-w-0 border-slate-200 shadow-sm"><CardHeader className="p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><CardTitle className="truncate">{company.companyName}</CardTitle><p className="mt-1 text-sm text-slate-500">{company.businessId || 'Y-tunnus puuttuu'} · {company.contactName || 'Yhteyshenkilö puuttuu'}</p></div><Badge className={documentsExpired || insuranceExpired ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}>{documentsExpired || insuranceExpired ? 'Asiakirja vanhentunut' : 'Aktiivinen'}</Badge></div></CardHeader><CardContent className="space-y-4 p-5 pt-0"><div className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Työntekijät</p><p className="mt-1 text-xl font-bold">{company.workers.length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Projektit</p><p className="mt-1 text-xl font-bold">{company.assignments.length}</p></div></div><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Työntekijät</p><div className="mt-2 space-y-2">{company.workers.slice(0, 5).map((worker) => <div key={worker.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{worker.name}</p><p className="truncate text-xs text-slate-500">Veronumero {worker.taxNumber || 'puuttuu'}</p></div><Badge variant="outline">{worker.status}</Badge></div>)}{company.workers.length === 0 && <p className="text-sm text-slate-500">Ei työntekijöitä.</p>}</div></div><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sopimukset ja projektit</p><div className="mt-2 space-y-2">{company.assignments.map((assignment) => { const project = projects.find((item) => item.id === assignment.projectId); return <div key={assignment.id} className="rounded-lg border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{project?.name ?? 'Tuntematon projekti'}</p><p className="mt-1 text-xs text-slate-500">{assignment.contractNumber || 'Sopimusnumero puuttuu'} · {assignment.billingBasis}</p></div><Badge className={(assignment.contractValueCents ?? 0) > 1_500_000 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}>{moneyFromCents(assignment.contractValueCents)}</Badge></div></div>; })}{company.assignments.length === 0 && <p className="text-sm text-slate-500">Ei projektikytkentöjä.</p>}</div></div></CardContent></Card>;
            })}
          </div>
          {!loading && subcontractors.length === 0 && <Card><CardContent className="py-14 text-center"><Building2 size={44} className="mx-auto text-slate-300" /><p className="mt-4 font-semibold">Alihankkijoita ei ole vielä lisätty</p><p className="mt-1 text-sm text-slate-500">Lisää yritys, sen työntekijät ja projektisopimukset.</p></CardContent></Card>}
        </TabsContent>

        <TabsContent value="billing" className="mt-5 space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-bold text-slate-950">Laskutusketju</h2><p className="mt-1 text-sm text-slate-500">Hyväksytyistä tunneista muodostetut laskutusrivit. Puuttuva hinta estää laskutusvalmiuden.</p></div><Button onClick={() => void syncBilling()} disabled={saving}><RefreshCw size={16} className={cn('mr-2', saving && 'animate-spin')} />Muodosta hyväksytyistä tunneista</Button></div>
          <Card className="border-slate-200 shadow-sm"><CardContent className="space-y-3 p-4 sm:p-6">{billingItems.map((item) => { const project = projects.find((projectItem) => projectItem.id === item.projectId); const actions = billingNextActions(item.status); return <div key={item.id} className="grid min-w-0 gap-3 rounded-xl border border-slate-200 p-4 xl:grid-cols-[minmax(0,1fr)_150px_170px_auto] xl:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-950">{item.description}</p><Badge variant="outline">{statusLabel(item.status)}</Badge></div><p className="mt-1 text-xs text-slate-500">{project?.name ?? 'Tuntematon projekti'} · {item.quantity.toFixed(2)} {item.unit} · ALV {item.vatRate.toFixed(1)} %</p>{item.invoiceReference && <p className="mt-1 text-xs text-slate-500">Laskuviite {item.invoiceReference}</p>}</div><div><p className="text-xs text-slate-500">Yksikköhinta</p>{item.unitPriceCents == null ? <div className="mt-1 flex gap-2"><Input inputMode="decimal" placeholder="€/h" value={billingPrices[item.id] ?? ''} onChange={(event) => setBillingPrices((previous) => ({ ...previous, [item.id]: event.target.value }))} /><Button size="icon" aria-label="Tallenna hinta" onClick={() => void saveBillingPrice(item)}><Check size={15} /></Button></div> : <p className="mt-1 font-mono font-semibold">{moneyFromCents(item.unitPriceCents)}</p>}</div><div><p className="text-xs text-slate-500">Veroton arvo</p><p className="mt-1 font-mono text-lg font-bold">{moneyFromCents(item.totalExVatCents)}</p></div><div className="flex flex-wrap gap-2 xl:justify-end">{actions.map((status) => <Button key={status} size="sm" variant={status === 'rejected' || status === 'credited' ? 'outline' : 'default'} onClick={() => void changeBillingStatus(item, status)} disabled={saving || (status === 'billable' && item.unitPriceCents == null)}>{statusLabel(status)}</Button>)}</div></div>; })}{!loading && billingItems.length === 0 && <div className="py-12 text-center"><Euro size={42} className="mx-auto text-slate-300" /><p className="mt-3 font-semibold">Laskutusrivejä ei ole</p><p className="mt-1 text-sm text-slate-500">Muodosta rivit hyväksytyistä tuntikirjauksista.</p></div>}</CardContent></Card>
        </TabsContent>

        <TabsContent value="vehicles" className="mt-5 space-y-5">
          <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
            <Card className="h-fit border-slate-200 shadow-sm"><CardHeader><CardTitle>Ajoneuvon sijainti</CardTitle><p className="text-sm text-slate-500">Manuaalinen piste tai myöhemmin ulkoisen GPS-integraation tuoma sijainti.</p></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label>Ajoneuvo</Label><Select value={vehicleEquipmentId} onValueChange={setVehicleEquipmentId}><SelectTrigger><SelectValue placeholder="Valitse ajoneuvo" /></SelectTrigger><SelectContent>{equipment.filter((item) => /auto|ajoneuvo|paketti|kuorma/i.test(`${item.type} ${item.name}`)).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Nykyinen projekti</Label><Select value={vehicleProjectId || 'none'} onValueChange={(value) => setVehicleProjectId(value === 'none' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei projektia</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="vehicle-reference">Lähdeviite</Label><Input id="vehicle-reference" value={vehicleSourceReference} onChange={(event) => setVehicleSourceReference(event.target.value)} placeholder="Esim. Mapon-laite tai kuljettajan huomio" /></div><Button className="w-full" onClick={() => void saveVehiclePosition()} disabled={saving || !vehicleEquipmentId}><LocateFixed size={17} className="mr-2" />Tallenna tämän laitteen sijainti</Button><p className="text-xs leading-5 text-slate-500">Toiminto tallentaa yhden sijaintipisteen. Se ei käynnistä jatkuvaa puhelimen taustaseurantaa.</p></CardContent></Card>
            <Card className="min-w-0 overflow-hidden border-slate-200 shadow-sm"><CardContent className="p-0">{selectedVehiclePosition ? <div className="grid min-h-[600px] lg:grid-cols-[300px_minmax(0,1fr)]"><div className="space-y-2 overflow-y-auto border-r border-slate-200 p-3">{vehiclePositions.map((position) => { const asset = equipment.find((item) => item.id === position.equipmentId); return <button key={position.id} type="button" onClick={() => setSelectedVehiclePositionId(position.id)} className={cn('w-full rounded-xl border p-3 text-left', selectedVehiclePosition.id === position.id ? 'border-orange-300 bg-orange-50' : 'border-slate-200 hover:bg-slate-50')}><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white"><Car size={19} /></div><div className="min-w-0"><p className="truncate font-semibold">{asset?.name ?? 'Ajoneuvo'}</p><p className="mt-1 text-xs text-slate-500">{dateTime(position.recordedAt)}</p><p className="mt-1 text-xs text-slate-500">Lähde: {position.source}</p></div></div></button>; })}</div><div className="flex min-h-[600px] flex-col"><div className="border-b border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-slate-950">{selectedVehicleEquipment?.name ?? 'Ajoneuvo'}</p><p className="mt-1 text-xs text-slate-500">{selectedVehiclePosition.latitude.toFixed(6)}, {selectedVehiclePosition.longitude.toFixed(6)} · {dateTime(selectedVehiclePosition.recordedAt)}</p></div><Button variant="outline" onClick={() => window.open(`https://www.openstreetmap.org/?mlat=${selectedVehiclePosition.latitude}&mlon=${selectedVehiclePosition.longitude}#map=16/${selectedVehiclePosition.latitude}/${selectedVehiclePosition.longitude}`, '_blank', 'noopener,noreferrer')}><MapPin size={15} className="mr-2" />Avaa kartalla</Button></div></div><iframe title="Ajoneuvon sijainti kartalla" className="min-h-[520px] w-full flex-1 border-0" src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedVehiclePosition.longitude - 0.01}%2C${selectedVehiclePosition.latitude - 0.006}%2C${selectedVehiclePosition.longitude + 0.01}%2C${selectedVehiclePosition.latitude + 0.006}&layer=mapnik&marker=${selectedVehiclePosition.latitude}%2C${selectedVehiclePosition.longitude}`} /></div></div> : <div className="flex min-h-[600px] flex-col items-center justify-center p-8 text-center"><Car size={52} className="text-slate-300" /><h2 className="mt-5 text-xl font-bold">Ajoneuvosijainteja ei ole</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Tallenna ensimmäinen manuaalinen piste tai liitä myöhemmin ulkoinen GPS-palvelu samaan tietomalliin.</p></div>}</CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="mt-5 space-y-5">
          <Card className="border-amber-200 bg-amber-50"><CardContent className="flex items-start gap-3 p-4 text-sm leading-6 text-amber-900"><ShieldCheck size={20} className="mt-0.5 shrink-0" /><div><p className="font-semibold">Tarkistus- ja vientityökalu, ei suora viranomaislähetys</p><p>VaKantti kokoaa järjestelmään tallennetut työntekijä- ja urakkatiedot. Organisaation vastuuhenkilön pitää tarkistaa aineisto ennen ilmoittamista.</p></div></CardContent></Card>
          <Card className="border-slate-200 shadow-sm"><CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_1fr_auto]"><div className="space-y-2"><Label htmlFor="report-month">Kuukausi</Label><Input id="report-month" type="month" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} /></div><div className="space-y-2"><Label>Projekti</Label><Select value={reportProjectId} onValueChange={setReportProjectId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Kaikki projektit</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div><div className="flex items-end"><Button className="w-full md:w-auto" onClick={() => void refreshReport()} disabled={loading}><RefreshCw size={16} className={cn('mr-2', loading && 'animate-spin')} />Muodosta</Button></div></CardContent></Card>
          <div className="grid gap-5 xl:grid-cols-2">
            {(['workers', 'contracts'] as const).map((kind) => { const rowCount = kind === 'workers' ? (construction?.workerRows.length ?? 0) + (construction?.subcontractorWorkerRows.length ?? 0) : construction?.contractRows.length ?? 0; return <Card key={kind} className="border-slate-200 shadow-sm"><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{kind === 'workers' ? 'Rakentamisen työntekijätiedot' : 'Rakentamisen urakkatiedot'}</CardTitle><p className="mt-1 text-sm text-slate-500">{rowCount} riviä valitulla rajauksella</p></div><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">{kind === 'workers' ? <UsersRound size={21} /> : <Building2 size={21} />}</div></div></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-3 gap-2"><Button variant="outline" onClick={() => void exportReport(kind, 'csv')} disabled={!construction}><Download size={15} className="mr-1" />CSV</Button><Button variant="outline" onClick={() => void exportReport(kind, 'xlsx')} disabled={!construction}><FileSpreadsheet size={15} className="mr-1" />XLSX</Button><Button onClick={() => void exportReport(kind, 'print')} disabled={!construction}><Printer size={15} className="mr-1" />PDF</Button></div><div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">{kind === 'workers' ? 'Sisältää omat työntekijät ja alihankkijoiden työntekijät, veronumerot, työnantajat sekä ensimmäisen ja viimeisen työpäivän.' : 'Sisältää rakentamispalveluksi merkityt alihankintasopimukset, sopimusarvot, kaudet ja 15 000 euron tarkistusrajan.'}</div></CardContent></Card>; })}
          </div>
          <Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle>Muut raportit</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Button variant="outline" className="h-auto min-h-16 justify-start gap-3 p-4" onClick={() => navigate('/raportit')}><FileText size={19} className="text-orange-600" /><span className="text-left"><span className="block font-semibold">Projektit ja talous</span><span className="block text-xs font-normal text-slate-500">Tunnit, kulut, turvallisuus ja dokumentointi</span></span></Button><Button variant="outline" className="h-auto min-h-16 justify-start gap-3 p-4" onClick={() => navigate('/palkka-aineisto')}><Euro size={19} className="text-orange-600" /><span className="text-left"><span className="block font-semibold">Palkka-aineisto</span><span className="block text-xs font-normal text-slate-500">Lukitut palkkakaudet ja matkakulut</span></span></Button><Button variant="outline" className="h-auto min-h-16 justify-start gap-3 p-4" onClick={() => navigate('/tuntikirjaukset')}><Clock3 size={19} className="text-orange-600" /><span className="text-left"><span className="block font-semibold">Työaikaraportti</span><span className="block text-xs font-normal text-slate-500">Työntekijä-, projekti- ja hyväksyntärajaukset</span></span></Button></CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={entryOpen} onOpenChange={setEntryOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Uusi toiminnan kirjaus</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Tyyppi</Label><Select value={entryType} onValueChange={(value: OperationalEntryType) => setEntryType(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="material">Materiaali</SelectItem><SelectItem value="equipment">Konekirjaus</SelectItem><SelectItem value="daily_note">Päivän seloste</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Projekti</Label><Select value={entryProjectId || 'none'} onValueChange={(value) => { setEntryProjectId(value === 'none' ? '' : value); setEntryWorkOrderId(''); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei projektia</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2 sm:col-span-2"><Label>Työmääräys</Label><Select value={entryWorkOrderId || 'none'} onValueChange={(value) => setEntryWorkOrderId(value === 'none' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei työmääräystä</SelectItem>{selectedProjectOrders.map((order) => <SelectItem key={order.id} value={order.id}>{order.title}</SelectItem>)}</SelectContent></Select></div>{entryType === 'equipment' && <div className="space-y-2 sm:col-span-2"><Label>Kalusto</Label><Select value={entryEquipmentId || 'none'} onValueChange={(value) => setEntryEquipmentId(value === 'none' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei kalustokytkentää</SelectItem>{equipment.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>}<div className="space-y-2 sm:col-span-2"><Label htmlFor="entry-title">Otsikko *</Label><Input id="entry-title" value={entryTitle} onChange={(event) => setEntryTitle(event.target.value)} placeholder={entryType === 'material' ? 'Esim. tasoite' : entryType === 'equipment' ? 'Esim. henkilönostimen käyttö' : 'Päivän työt'} /></div><div className="space-y-2"><Label htmlFor="entry-quantity">Määrä</Label><Input id="entry-quantity" inputMode="decimal" value={entryQuantity} onChange={(event) => setEntryQuantity(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="entry-unit">Yksikkö</Label><Input id="entry-unit" value={entryUnit} onChange={(event) => setEntryUnit(event.target.value)} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="entry-unit-cost">Yksikkökustannus euroina</Label><Input id="entry-unit-cost" inputMode="decimal" value={entryUnitCost} onChange={(event) => setEntryUnitCost(event.target.value)} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="entry-description">Kuvaus</Label><Textarea id="entry-description" rows={4} value={entryDescription} onChange={(event) => setEntryDescription(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setEntryOpen(false)}>Peruuta</Button><Button onClick={() => void saveEntry()} disabled={saving}>{saving && <Loader2 size={15} className="mr-2 animate-spin" />}Tallenna</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={subcontractorOpen} onOpenChange={setSubcontractorOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Uusi alihankkija</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="company-name">Yrityksen nimi *</Label><Input id="company-name" value={companyName} onChange={(event) => setCompanyName(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="business-id">Y-tunnus</Label><Input id="business-id" value={businessId} onChange={(event) => setBusinessId(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="contact-name">Yhteyshenkilö</Label><Input id="contact-name" value={contactName} onChange={(event) => setContactName(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="contact-email">Sähköposti</Label><Input id="contact-email" type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="contact-phone">Puhelin</Label><Input id="contact-phone" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="liability-until">Tilaajavastuuasiakirjat voimassa</Label><Input id="liability-until" type="date" value={liabilityUntil} onChange={(event) => setLiabilityUntil(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="insurance-until">Vakuutus voimassa</Label><Input id="insurance-until" type="date" value={insuranceUntil} onChange={(event) => setInsuranceUntil(event.target.value)} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="subcontractor-notes">Muistiinpanot</Label><Textarea id="subcontractor-notes" value={subcontractorNotes} onChange={(event) => setSubcontractorNotes(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setSubcontractorOpen(false)}>Peruuta</Button><Button onClick={() => void saveSubcontractor()} disabled={saving}>Tallenna</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={workerOpen} onOpenChange={setWorkerOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Alihankkijan työntekijä</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Alihankkija *</Label><Select value={selectedSubcontractorId} onValueChange={setSelectedSubcontractorId}><SelectTrigger><SelectValue placeholder="Valitse yritys" /></SelectTrigger><SelectContent>{subcontractors.map((company) => <SelectItem key={company.id} value={company.id}>{company.companyName}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="worker-name">Nimi *</Label><Input id="worker-name" value={workerName} onChange={(event) => setWorkerName(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="worker-email">Sähköposti</Label><Input id="worker-email" type="email" value={workerEmail} onChange={(event) => setWorkerEmail(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="worker-phone">Puhelin</Label><Input id="worker-phone" value={workerPhone} onChange={(event) => setWorkerPhone(event.target.value)} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="worker-tax">Veronumero</Label><Input id="worker-tax" value={workerTaxNumber} onChange={(event) => setWorkerTaxNumber(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="worker-from">Oikeus alkaa</Label><Input id="worker-from" type="date" value={workerValidFrom} onChange={(event) => setWorkerValidFrom(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="worker-until">Oikeus päättyy</Label><Input id="worker-until" type="date" value={workerValidUntil} onChange={(event) => setWorkerValidUntil(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setWorkerOpen(false)}>Peruuta</Button><Button onClick={() => void saveWorker()} disabled={saving}>Tallenna</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={assignmentOpen} onOpenChange={setAssignmentOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Liitä alihankkija projektiin</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Alihankkija *</Label><Select value={assignmentSubcontractorId} onValueChange={setAssignmentSubcontractorId}><SelectTrigger><SelectValue placeholder="Valitse yritys" /></SelectTrigger><SelectContent>{subcontractors.map((company) => <SelectItem key={company.id} value={company.id}>{company.companyName}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2 sm:col-span-2"><Label>Projekti *</Label><Select value={assignmentProjectId} onValueChange={setAssignmentProjectId}><SelectTrigger><SelectValue placeholder="Valitse projekti" /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="contract-number">Sopimusnumero</Label><Input id="contract-number" value={contractNumber} onChange={(event) => setContractNumber(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="contract-value">Sopimuksen arvo euroina</Label><Input id="contract-value" inputMode="decimal" value={contractValue} onChange={(event) => setContractValue(event.target.value)} /></div><div className="space-y-2 sm:col-span-2"><Label>Laskutusperuste</Label><Select value={billingBasis} onValueChange={setBillingBasis}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="urakka">Urakka</SelectItem><SelectItem value="tuntityö">Tuntityö</SelectItem><SelectItem value="yksikköhinta">Yksikköhinta</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="contract-start">Alkaa</Label><Input id="contract-start" type="date" value={contractStartsAt} onChange={(event) => setContractStartsAt(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="contract-end">Päättyy</Label><Input id="contract-end" type="date" value={contractEndsAt} onChange={(event) => setContractEndsAt(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setAssignmentOpen(false)}>Peruuta</Button><Button onClick={() => void saveAssignment()} disabled={saving}>Tallenna</Button></DialogFooter></DialogContent></Dialog>
    </motion.div>
  );
}
