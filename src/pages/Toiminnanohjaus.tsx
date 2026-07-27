import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Building2,
  Car,
  Check,
  ClipboardList,
  Download,
  Euro,
  FileSpreadsheet,
  Gauge,
  Loader2,
  LocateFixed,
  MapPin,
  Plus,
  RefreshCw,
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
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { downloadCsv, downloadXlsx, openPrintReport, type ExportCell } from '@/lib/reportExport';
import {
  createSubcontractor,
  createSubcontractorAssignment,
  createSubcontractorWorker,
  getConstructionReporting,
  listBillingItems,
  listLatestVehiclePositions,
  listSubcontractors,
  recordConstructionExport,
  recordVehiclePosition,
  setBillingItemPrice,
  syncBillingItems,
  transitionBillingItem,
  type BillingItem,
  type BillingStatus,
  type ConstructionReportingData,
  type Subcontractor,
  type VehiclePosition,
} from '@/lib/supabase/commercialOperations';
import { captureCurrentWorkSiteLocation } from '@/lib/supabase/workSiteCheckIns';

const TAB_KEYS = ['subcontractors', 'billing', 'vehicles', 'reports'] as const;
type TabKey = typeof TAB_KEYS[number];

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function euroFromCents(value?: number) {
  if (value == null) return 'Ei hinnoiteltu';
  return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(value / 100);
}

function dateTime(value?: string) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

function dateLabel(value?: string) {
  if (!value) return 'Ei määritetty';
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: 'Aktiivinen', planned: 'Suunniteltu', completed: 'Valmis', cancelled: 'Peruttu',
    recorded: 'Kirjattu', approved: 'Hyväksytty', billable: 'Laskutettava', queued: 'Lisätty laskulle',
    invoiced: 'Laskutettu', credited: 'Hyvitetty', rejected: 'Hylätty',
  };
  return labels[status] ?? status;
}

function billingActions(status: BillingStatus): BillingStatus[] {
  if (status === 'recorded') return ['approved', 'rejected'];
  if (status === 'approved') return ['billable', 'rejected'];
  if (status === 'billable') return ['queued', 'rejected'];
  if (status === 'queued') return ['invoiced', 'rejected'];
  if (status === 'invoiced') return ['credited'];
  return [];
}

function contractBasisLabel(value: string) {
  const labels: Record<string, string> = { contract: 'Urakka', hourly: 'Tuntilaskutus', unit: 'Yksikköhinta', labour_hire: 'Työvoiman vuokraus' };
  return labels[value] ?? value;
}

function reportRows(data: ConstructionReportingData, type: 'workers' | 'contracts'): ExportCell[][] {
  if (type === 'workers') {
    const rows = [...data.workerRows, ...data.subcontractorWorkerRows];
    return [
      ['Työmaa', 'Osoite', 'Työntekijä', 'Veronumero', 'Työnantaja', 'Y-tunnus', 'Henkilöryhmä', 'Ensimmäinen työpäivä', 'Viimeinen työpäivä', 'Työpäivät', 'Tunnit'],
      ...rows.map((row) => [row.projectName, row.siteLocation ?? '', row.workerName, row.taxNumber ?? '', row.employerName,
        row.employerBusinessId ?? '', row.employmentCategory, row.firstWorkDate ?? '', row.lastWorkDate ?? '', row.workDays ?? '', row.workHours ?? '']),
    ];
  }
  return [
    ['Työmaa', 'Osoite', 'Alihankkija', 'Y-tunnus', 'Sopimusnumero', 'Sopimuksen arvo EUR', 'Laskutusperuste', 'Rakentamispalvelu', 'Alkaa', 'Päättyy', '15 000 € raja ylittyy'],
    ...data.contractRows.map((row) => [row.projectName, row.siteLocation ?? '', row.subcontractorName, row.businessId ?? '',
      row.contractNumber ?? '', row.contractValueCents == null ? '' : row.contractValueCents / 100, contractBasisLabel(row.billingBasis),
      row.isConstructionService ? 'Kyllä' : 'Ei', row.startsAt ?? '', row.endsAt ?? '', row.reportingThresholdExceeded ? 'Kyllä' : 'Ei']),
  ];
}

export default function Toiminnanohjaus() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentOrg, currentRole } = useOrganization();
  const { projects, equipment } = useAppDataContext();
  const canManage = currentRole === 'admin' || currentRole === 'supervisor';
  const requestedTab = searchParams.get('tab');
  const activeTab: TabKey = TAB_KEYS.includes(requestedTab as TabKey) ? requestedTab as TabKey : 'subcontractors';

  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [billingItems, setBillingItems] = useState<BillingItem[]>([]);
  const [vehiclePositions, setVehiclePositions] = useState<VehiclePosition[]>([]);
  const [construction, setConstruction] = useState<ConstructionReportingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [companyOpen, setCompanyOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [liabilityUntil, setLiabilityUntil] = useState('');
  const [insuranceUntil, setInsuranceUntil] = useState('');
  const [companyNotes, setCompanyNotes] = useState('');

  const [workerOpen, setWorkerOpen] = useState(false);
  const [workerCompanyId, setWorkerCompanyId] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [workerTaxNumber, setWorkerTaxNumber] = useState('');
  const [workerEmail, setWorkerEmail] = useState('');
  const [workerPhone, setWorkerPhone] = useState('');
  const [workerValidFrom, setWorkerValidFrom] = useState('');
  const [workerValidUntil, setWorkerValidUntil] = useState('');

  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignmentCompanyId, setAssignmentCompanyId] = useState('');
  const [assignmentProjectId, setAssignmentProjectId] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [contractValue, setContractValue] = useState('');
  const [billingBasis, setBillingBasis] = useState('contract');
  const [contractStarts, setContractStarts] = useState('');
  const [contractEnds, setContractEnds] = useState('');

  const [billingPrices, setBillingPrices] = useState<Record<string, string>>({});
  const [invoiceReferences, setInvoiceReferences] = useState<Record<string, string>>({});

  const [vehicleEquipmentId, setVehicleEquipmentId] = useState('');
  const [vehicleProjectId, setVehicleProjectId] = useState('');
  const [vehicleReference, setVehicleReference] = useState('');

  const [reportMonth, setReportMonth] = useState(currentMonth());
  const [reportProjectId, setReportProjectId] = useState('all');

  const loadTab = useCallback(async (tab: TabKey) => {
    if (!currentOrg || !canManage) return;
    setLoading(true);
    setError(null);
    try {
      if (tab === 'subcontractors') setSubcontractors(await listSubcontractors(currentOrg.id));
      if (tab === 'billing') setBillingItems(await listBillingItems(currentOrg.id));
      if (tab === 'vehicles') setVehiclePositions(await listLatestVehiclePositions(currentOrg.id));
      if (tab === 'reports') setConstruction(await getConstructionReporting(currentOrg.id, reportMonth, reportProjectId === 'all' ? undefined : reportProjectId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tietojen haku epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [canManage, currentOrg, reportMonth, reportProjectId]);

  useEffect(() => { void loadTab(activeTab); }, [activeTab, loadTab]);

  const selectTab = (value: string) => {
    if (TAB_KEYS.includes(value as TabKey)) setSearchParams({ tab: value });
  };

  const resetMessage = () => { setError(null); setSuccess(null); };

  const saveCompany = async () => {
    if (!currentOrg || companyName.trim().length < 2) { setError('Anna alihankkijan nimi.'); return; }
    setSaving(true); resetMessage();
    try {
      await createSubcontractor({ organizationId: currentOrg.id, companyName, businessId, contactName, contactEmail, contactPhone,
        liabilityDocumentsValidUntil: liabilityUntil, insuranceValidUntil: insuranceUntil, notes: companyNotes });
      setCompanyOpen(false); setCompanyName(''); setBusinessId(''); setContactName(''); setContactEmail(''); setContactPhone('');
      setLiabilityUntil(''); setInsuranceUntil(''); setCompanyNotes(''); setSuccess('Alihankkija lisättiin.');
      await loadTab('subcontractors');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Tallennus epäonnistui.'); }
    finally { setSaving(false); }
  };

  const saveWorker = async () => {
    if (!currentOrg || !workerCompanyId || workerName.trim().length < 2) { setError('Valitse alihankkija ja anna työntekijän nimi.'); return; }
    setSaving(true); resetMessage();
    try {
      await createSubcontractorWorker({ organizationId: currentOrg.id, subcontractorId: workerCompanyId, name: workerName,
        taxNumber: workerTaxNumber, email: workerEmail, phone: workerPhone, validFrom: workerValidFrom, validUntil: workerValidUntil });
      setWorkerOpen(false); setWorkerName(''); setWorkerTaxNumber(''); setWorkerEmail(''); setWorkerPhone('');
      setWorkerValidFrom(''); setWorkerValidUntil(''); setSuccess('Alihankkijan työntekijä lisättiin.');
      await loadTab('subcontractors');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Tallennus epäonnistui.'); }
    finally { setSaving(false); }
  };

  const saveAssignment = async () => {
    if (!currentOrg || !assignmentCompanyId || !assignmentProjectId) { setError('Valitse alihankkija ja projekti.'); return; }
    const cents = contractValue ? Math.round(Number(contractValue.replace(',', '.')) * 100) : undefined;
    if (cents != null && (!Number.isFinite(cents) || cents < 0)) { setError('Sopimuksen arvo ei ole kelvollinen.'); return; }
    setSaving(true); resetMessage();
    try {
      await createSubcontractorAssignment({ organizationId: currentOrg.id, subcontractorId: assignmentCompanyId,
        projectId: assignmentProjectId, contractNumber, contractValueCents: cents, billingBasis,
        isConstructionService: true, startsAt: contractStarts, endsAt: contractEnds });
      setAssignmentOpen(false); setContractNumber(''); setContractValue(''); setContractStarts(''); setContractEnds('');
      setSuccess('Alihankkija liitettiin projektiin.'); await loadTab('subcontractors');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Tallennus epäonnistui.'); }
    finally { setSaving(false); }
  };

  const syncBilling = async () => {
    if (!currentOrg) return;
    setSaving(true); resetMessage();
    try { const count = await syncBillingItems(currentOrg.id); setSuccess(`${count} uutta hyväksyttyä riviä lisättiin laskutusketjuun.`); await loadTab('billing'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Laskutusrivien muodostaminen epäonnistui.'); }
    finally { setSaving(false); }
  };

  const savePrice = async (item: BillingItem) => {
    const euros = Number((billingPrices[item.id] ?? '').replace(',', '.'));
    if (!Number.isFinite(euros) || euros < 0) { setError('Anna kelvollinen yksikköhinta euroina.'); return; }
    setSaving(true); resetMessage();
    try { await setBillingItemPrice(item.id, Math.round(euros * 100)); setSuccess('Hinta tallennettiin.'); await loadTab('billing'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Hinnan tallennus epäonnistui.'); }
    finally { setSaving(false); }
  };

  const changeBillingStatus = async (item: BillingItem, status: BillingStatus) => {
    const reference = status === 'invoiced' ? invoiceReferences[item.id] : undefined;
    if (status === 'invoiced' && !reference?.trim()) { setError('Anna laskun numero tai viite.'); return; }
    setSaving(true); resetMessage();
    try { await transitionBillingItem(item.id, status, reference); setSuccess(`Rivi siirrettiin tilaan ${statusLabel(status)}.`); await loadTab('billing'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Tilamuutos epäonnistui.'); }
    finally { setSaving(false); }
  };

  const saveVehiclePosition = async () => {
    if (!currentOrg || !vehicleEquipmentId) { setError('Valitse ajoneuvo tai kalusto.'); return; }
    setSaving(true); resetMessage();
    try {
      const location = await captureCurrentWorkSiteLocation();
      await recordVehiclePosition({ organizationId: currentOrg.id, equipmentId: vehicleEquipmentId,
        projectId: vehicleProjectId || undefined, latitude: location.latitude, longitude: location.longitude,
        accuracyM: location.accuracyM, source: 'manual', sourceReference: vehicleReference });
      setSuccess('Yksittäinen sijaintinäyte tallennettiin. Jatkuvaa taustaseurantaa ei käynnistetty.'); await loadTab('vehicles');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Sijainnin tallennus epäonnistui.'); }
    finally { setSaving(false); }
  };

  const exportReport = async (type: 'workers' | 'contracts', format: 'csv' | 'xlsx' | 'print') => {
    if (!construction || !currentOrg) return;
    const rows = reportRows(construction, type);
    const base = `vakantti-${type === 'workers' ? 'tyontekijatiedot' : 'urakkatiedot'}-${reportMonth}`;
    try {
      if (format === 'csv') downloadCsv(`${base}.csv`, rows);
      if (format === 'xlsx') downloadXlsx(`${base}.xlsx`, type === 'workers' ? 'Työntekijätiedot' : 'Urakkatiedot', rows);
      if (format === 'print') openPrintReport(type === 'workers' ? 'Rakentamisen työntekijätietojen tarkistusaineisto' : 'Rakentamisen urakkatietojen tarkistusaineisto', rows);
      await recordConstructionExport({ organizationId: currentOrg.id, reportType: type === 'workers' ? 'worker_data' : 'contract_data',
        targetMonth: reportMonth, projectId: reportProjectId === 'all' ? undefined : reportProjectId, rowCount: Math.max(0, rows.length - 1) });
      setSuccess('Vienti muodostettiin ja kirjattiin audit-lokiin.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Raportin vienti epäonnistui.'); }
  };

  const billingTotals = useMemo(() => {
    const sum = (statuses: BillingStatus[]) => billingItems.filter((item) => statuses.includes(item.status)).reduce((total, item) => total + (item.totalExVatCents ?? 0), 0);
    return { billable: sum(['billable']), unqueued: sum(['approved', 'billable']), invoiced: sum(['invoiced']), missingPrice: billingItems.filter((item) => item.unitPriceCents == null).length };
  }, [billingItems]);

  if (!canManage) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-[1500px] space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl sm:p-8">
        <div className="flex items-start gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-500"><Gauge size={29} /></div>
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">Kaupallinen ja ulkoinen toiminta</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Toiminnanohjaus</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Alihankkijat, laskutettavat työt, ajoneuvojen viimeisimmät sijaintinäytteet ja rakentamisilmoitusten tarkistusaineistot.</p></div></div>
      </div>

      {error && <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertTriangle size={18} className="mt-0.5 shrink-0" /><span className="min-w-0 flex-1">{error}</span><button type="button" aria-label="Sulje" onClick={() => setError(null)}><X size={16} /></button></div>}
      {success && <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><Check size={18} className="mt-0.5 shrink-0" />{success}</div>}
      {loading && <div className="flex items-center gap-2 rounded-xl border bg-white p-4 text-sm text-slate-600"><Loader2 size={17} className="animate-spin" />Päivitetään tietoja…</div>}

      <Tabs value={activeTab} onValueChange={selectTab}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:grid-cols-4">
          <TabsTrigger value="subcontractors">Alihankkijat</TabsTrigger><TabsTrigger value="billing">Laskutus</TabsTrigger>
          <TabsTrigger value="vehicles">Ajoneuvot</TabsTrigger><TabsTrigger value="reports">Rakentamisraportit</TabsTrigger>
        </TabsList>

        <TabsContent value="subcontractors" className="mt-5 space-y-5">
          <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => setWorkerOpen(true)}><UsersRound size={16} className="mr-2" />Lisää työntekijä</Button>
            <Button variant="outline" onClick={() => setAssignmentOpen(true)}><ClipboardList size={16} className="mr-2" />Liitä projektiin</Button>
            <Button onClick={() => setCompanyOpen(true)}><Plus size={16} className="mr-2" />Uusi alihankkija</Button></div>
          {subcontractors.length === 0 && <Card><CardContent className="py-12 text-center text-sm text-slate-500">Alihankkijoita ei ole vielä lisätty.</CardContent></Card>}
          <div className="grid gap-4 xl:grid-cols-2">{subcontractors.map((company) => {
            const expired = [company.liabilityDocumentsValidUntil, company.insuranceValidUntil].some((value) => value && value < new Date().toISOString().slice(0, 10));
            return <Card key={company.id} className="border-slate-200 shadow-sm"><CardHeader className="p-5"><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Building2 size={19} className="text-orange-600" />{company.companyName}</CardTitle><p className="mt-1 text-sm text-slate-500">{company.businessId || 'Y-tunnusta ei määritetty'}</p></div><Badge variant={expired ? 'destructive' : 'outline'}>{expired ? 'Asiakirja vanhentunut' : statusLabel(company.status)}</Badge></div></CardHeader>
              <CardContent className="space-y-4 p-5 pt-0"><div className="grid gap-2 text-sm sm:grid-cols-2"><p><span className="text-slate-500">Yhteyshenkilö:</span> {company.contactName || '—'}</p><p><span className="text-slate-500">Sähköposti:</span> {company.contactEmail || '—'}</p><p><span className="text-slate-500">Tilaajavastuu:</span> {dateLabel(company.liabilityDocumentsValidUntil)}</p><p><span className="text-slate-500">Vakuutus:</span> {dateLabel(company.insuranceValidUntil)}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Työntekijät ({company.workers.length})</p><div className="mt-2 space-y-2">{company.workers.slice(0, 5).map((worker) => <div key={worker.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm"><span>{worker.name}</span><span className={worker.taxNumber ? 'text-emerald-700' : 'text-amber-700'}>{worker.taxNumber ? 'Veronumero tallennettu' : 'Veronumero puuttuu'}</span></div>)}</div></div>
                <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Projektisopimukset ({company.assignments.length})</p><div className="mt-2 space-y-2">{company.assignments.map((assignment) => { const project = projects.find((item) => item.id === assignment.projectId); return <div key={assignment.id} className="rounded-lg border border-slate-200 p-3 text-sm"><div className="flex justify-between gap-3"><strong>{project?.name || 'Tuntematon projekti'}</strong><Badge variant="outline">{contractBasisLabel(assignment.billingBasis)}</Badge></div><p className="mt-1 text-slate-500">{assignment.contractNumber || 'Ei sopimusnumeroa'} · {euroFromCents(assignment.contractValueCents)}</p></div>; })}</div></div>
              </CardContent></Card>;
          })}</div>
        </TabsContent>

        <TabsContent value="billing" className="mt-5 space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
            ['Laskutettava', euroFromCents(billingTotals.billable)], ['Laskulle lisäämättä', euroFromCents(billingTotals.unqueued)],
            ['Laskutettu', euroFromCents(billingTotals.invoiced)], ['Hinta puuttuu', `${billingTotals.missingPrice} riviä`],
          ].map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 break-words text-xl font-bold">{value}</p></CardContent></Card>)}</div>
          <div className="flex justify-end"><Button onClick={() => void syncBilling()} disabled={saving}><RefreshCw size={16} className="mr-2" />Muodosta hyväksytyistä kirjauksista</Button></div>
          <Card><CardHeader><CardTitle>Laskutusketju</CardTitle></CardHeader><CardContent className="space-y-3">{billingItems.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Laskutusrivejä ei ole.</p>}
            {billingItems.map((item) => { const project = projects.find((entry) => entry.id === item.projectId); return <div key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-950">{item.description}</p><Badge variant="outline">{statusLabel(item.status)}</Badge></div><p className="mt-1 text-xs text-slate-500">{project?.name || 'Projekti'} · {item.quantity} {item.unit} · {euroFromCents(item.totalExVatCents)}</p></div>
              {item.unitPriceCents == null && <div className="flex gap-2"><Input className="w-32" inputMode="decimal" placeholder="€/yksikkö" value={billingPrices[item.id] ?? ''} onChange={(event) => setBillingPrices((previous) => ({ ...previous, [item.id]: event.target.value }))} /><Button variant="outline" onClick={() => void savePrice(item)}>Tallenna</Button></div>}
              {item.status === 'queued' && <Input className="w-44" placeholder="Laskun numero" value={invoiceReferences[item.id] ?? ''} onChange={(event) => setInvoiceReferences((previous) => ({ ...previous, [item.id]: event.target.value }))} />}
              <div className="flex flex-wrap gap-2">{billingActions(item.status).map((status) => <Button key={status} size="sm" variant={status === 'rejected' || status === 'credited' ? 'outline' : 'default'} onClick={() => void changeBillingStatus(item, status)}>{statusLabel(status)}</Button>)}</div></div></div>; })}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="vehicles" className="mt-5 space-y-5">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><LocateFixed size={19} className="text-orange-600" />Tallenna yksittäinen sijaintinäyte</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-3"><div className="space-y-2"><Label>Ajoneuvo tai kalusto</Label><Select value={vehicleEquipmentId} onValueChange={setVehicleEquipmentId}><SelectTrigger><SelectValue placeholder="Valitse" /></SelectTrigger><SelectContent>{equipment.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Projekti</Label><Select value={vehicleProjectId || 'none'} onValueChange={(value) => setVehicleProjectId(value === 'none' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei projektia</SelectItem>{projects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Lähdeviite</Label><Input value={vehicleReference} onChange={(event) => setVehicleReference(event.target.value)} placeholder="Esim. kuljettaja tai laite" /></div><Button className="md:col-span-3" onClick={() => void saveVehiclePosition()} disabled={saving || !vehicleEquipmentId}><MapPin size={17} className="mr-2" />Tallenna nykyinen sijainti</Button>
            <p className="text-xs leading-5 text-slate-500 md:col-span-3">Sovellus tallentaa vain tämänhetkisen sijaintinäytteen. Mapon- tai muun GPS-järjestelmän lähde voidaan tuoda samaan tietomalliin integraation kautta.</p></CardContent></Card>
          <div className="grid gap-4 lg:grid-cols-2">{vehiclePositions.map((position) => { const asset = equipment.find((item) => item.id === position.equipmentId); const project = projects.find((item) => item.id === position.projectId); return <Card key={position.id}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 font-semibold"><Car size={18} className="text-orange-600" />{asset?.name || 'Ajoneuvo'}</p><p className="mt-1 text-sm text-slate-500">{project?.name || 'Ei projektia'} · {dateTime(position.recordedAt)}</p></div><Badge variant="outline">{position.source}</Badge></div><p className="mt-4 font-mono text-sm">{position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}</p><p className="mt-1 text-xs text-slate-500">Tarkkuus {position.accuracyM == null ? 'ei tiedossa' : `${Math.round(position.accuracyM)} m`}</p><Button className="mt-4" variant="outline" onClick={() => window.open(`https://www.openstreetmap.org/?mlat=${position.latitude}&mlon=${position.longitude}#map=16/${position.latitude}/${position.longitude}`, '_blank', 'noopener,noreferrer')}>Avaa kartalla</Button></CardContent></Card>; })}</div>
        </TabsContent>

        <TabsContent value="reports" className="mt-5 space-y-5">
          <Card><CardContent className="grid gap-4 p-5 md:grid-cols-3"><div className="space-y-2"><Label>Kuukausi</Label><Input type="month" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} /></div><div className="space-y-2"><Label>Projekti</Label><Select value={reportProjectId} onValueChange={setReportProjectId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Kaikki projektit</SelectItem>{projects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div><div className="flex items-end"><Button className="w-full" onClick={() => void loadTab('reports')}><RefreshCw size={16} className="mr-2" />Muodosta tarkistusaineisto</Button></div></CardContent></Card>
          <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2"><UsersRound size={19} />Työntekijätiedot</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{(construction?.workerRows.length ?? 0) + (construction?.subcontractorWorkerRows.length ?? 0)}</p><p className="mt-1 text-sm text-slate-500">työntekijä- ja alihankkijariviä</p><div className="mt-5 flex flex-wrap gap-2"><Button size="sm" onClick={() => void exportReport('workers', 'xlsx')}><FileSpreadsheet size={15} className="mr-2" />XLSX</Button><Button size="sm" variant="outline" onClick={() => void exportReport('workers', 'csv')}><Download size={15} className="mr-2" />CSV</Button><Button size="sm" variant="outline" onClick={() => void exportReport('workers', 'print')}>Tulosta/PDF</Button></div></CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Building2 size={19} />Urakkatiedot</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{construction?.contractRows.length ?? 0}</p><p className="mt-1 text-sm text-slate-500">sopimusriviä · yli 15 000 € ilman ALV:tä merkitään</p><div className="mt-5 flex flex-wrap gap-2"><Button size="sm" onClick={() => void exportReport('contracts', 'xlsx')}><FileSpreadsheet size={15} className="mr-2" />XLSX</Button><Button size="sm" variant="outline" onClick={() => void exportReport('contracts', 'csv')}><Download size={15} className="mr-2" />CSV</Button><Button size="sm" variant="outline" onClick={() => void exportReport('contracts', 'print')}>Tulosta/PDF</Button></div></CardContent></Card></div>
          <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900"><ShieldCheck size={18} className="mt-0.5 shrink-0" /><p>Tämä on tarkistus- ja vientiaineisto. Se ei lähetä ilmoitusta Verohallinnolle automaattisesti. Varmista tiedot ennen OmaVero- tai Ilmoitin.fi-ilmoitusta.</p></div>
        </TabsContent>
      </Tabs>

      <Dialog open={companyOpen} onOpenChange={setCompanyOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Uusi alihankkija</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Yrityksen nimi *</Label><Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} /></div><div className="space-y-2"><Label>Y-tunnus</Label><Input value={businessId} onChange={(event) => setBusinessId(event.target.value)} /></div><div className="space-y-2"><Label>Yhteyshenkilö</Label><Input value={contactName} onChange={(event) => setContactName(event.target.value)} /></div><div className="space-y-2"><Label>Sähköposti</Label><Input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} /></div><div className="space-y-2"><Label>Puhelin</Label><Input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} /></div><div className="space-y-2"><Label>Tilaajavastuu voimassa</Label><Input type="date" value={liabilityUntil} onChange={(event) => setLiabilityUntil(event.target.value)} /></div><div className="space-y-2"><Label>Vakuutus voimassa</Label><Input type="date" value={insuranceUntil} onChange={(event) => setInsuranceUntil(event.target.value)} /></div><div className="space-y-2 sm:col-span-2"><Label>Muistiinpanot</Label><Textarea value={companyNotes} onChange={(event) => setCompanyNotes(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setCompanyOpen(false)}>Peruuta</Button><Button onClick={() => void saveCompany()} disabled={saving}>Tallenna</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={workerOpen} onOpenChange={setWorkerOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Alihankkijan työntekijä</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Alihankkija *</Label><Select value={workerCompanyId} onValueChange={setWorkerCompanyId}><SelectTrigger><SelectValue placeholder="Valitse" /></SelectTrigger><SelectContent>{subcontractors.map((item) => <SelectItem key={item.id} value={item.id}>{item.companyName}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2 sm:col-span-2"><Label>Nimi *</Label><Input value={workerName} onChange={(event) => setWorkerName(event.target.value)} /></div><div className="space-y-2"><Label>Veronumero</Label><Input value={workerTaxNumber} onChange={(event) => setWorkerTaxNumber(event.target.value)} /></div><div className="space-y-2"><Label>Sähköposti</Label><Input type="email" value={workerEmail} onChange={(event) => setWorkerEmail(event.target.value)} /></div><div className="space-y-2"><Label>Puhelin</Label><Input value={workerPhone} onChange={(event) => setWorkerPhone(event.target.value)} /></div><div className="space-y-2"><Label>Oikeus alkaa</Label><Input type="date" value={workerValidFrom} onChange={(event) => setWorkerValidFrom(event.target.value)} /></div><div className="space-y-2"><Label>Oikeus päättyy</Label><Input type="date" value={workerValidUntil} onChange={(event) => setWorkerValidUntil(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setWorkerOpen(false)}>Peruuta</Button><Button onClick={() => void saveWorker()} disabled={saving}>Tallenna</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={assignmentOpen} onOpenChange={setAssignmentOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Liitä alihankkija projektiin</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Alihankkija *</Label><Select value={assignmentCompanyId} onValueChange={setAssignmentCompanyId}><SelectTrigger><SelectValue placeholder="Valitse" /></SelectTrigger><SelectContent>{subcontractors.map((item) => <SelectItem key={item.id} value={item.id}>{item.companyName}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2 sm:col-span-2"><Label>Projekti *</Label><Select value={assignmentProjectId} onValueChange={setAssignmentProjectId}><SelectTrigger><SelectValue placeholder="Valitse" /></SelectTrigger><SelectContent>{projects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Sopimusnumero</Label><Input value={contractNumber} onChange={(event) => setContractNumber(event.target.value)} /></div><div className="space-y-2"><Label>Sopimuksen arvo € (alv 0)</Label><Input inputMode="decimal" value={contractValue} onChange={(event) => setContractValue(event.target.value)} /></div><div className="space-y-2 sm:col-span-2"><Label>Laskutusperuste</Label><Select value={billingBasis} onValueChange={setBillingBasis}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="contract">Urakka</SelectItem><SelectItem value="hourly">Tuntilaskutus</SelectItem><SelectItem value="unit">Yksikköhinta</SelectItem><SelectItem value="labour_hire">Työvoiman vuokraus</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Alkaa</Label><Input type="date" value={contractStarts} onChange={(event) => setContractStarts(event.target.value)} /></div><div className="space-y-2"><Label>Päättyy</Label><Input type="date" value={contractEnds} onChange={(event) => setContractEnds(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setAssignmentOpen(false)}>Peruuta</Button><Button onClick={() => void saveAssignment()} disabled={saving}>Tallenna</Button></DialogFooter></DialogContent></Dialog>
    </motion.div>
  );
}
