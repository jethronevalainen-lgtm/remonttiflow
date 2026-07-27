import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Building2,
  Car,
  Check,
  Download,
  Euro,
  FileSpreadsheet,
  FileText,
  Gauge,
  Loader2,
  LocateFixed,
  MapPin,
  Plus,
  Printer,
  RefreshCw,
  ShieldCheck,
  UsersRound,
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
  loadBusinessOperations,
  loadConstructionReporting,
  recordConstructionExport,
  saveSubcontractor,
  saveSubcontractorAssignment,
  saveSubcontractorWorker,
  saveVehiclePosition,
  setBillingItemPrice,
  syncBillingItems,
  transitionBillingItem,
  type BillingItem,
  type BillingStatus,
  type BusinessOperationsData,
  type ConstructionReportingData,
} from '@/lib/supabase/businessOperations';
import { captureCurrentWorkSiteLocation } from '@/lib/supabase/workSiteCheckIns';
import {
  downloadReportCsv,
  downloadReportPdf,
  downloadReportXlsx,
  printReport,
} from '@/lib/reportExports';
import type { ReportCenterDataset } from '@/lib/supabase/reportCenter';
import { cn } from '@/lib/utils';

const EMPTY_DATA: BusinessOperationsData = {
  projects: [],
  equipment: [],
  subcontractors: [],
  billingItems: [],
  vehiclePositions: [],
  summary: { activeSubcontractors: 0, billableCents: 0, queuedCents: 0, invoicedCents: 0, trackedVehicles: 0 },
};

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function money(cents: number | null | undefined) {
  if (cents == null) return 'Ei määritetty';
  return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function dateLabel(value: string | null | undefined) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

function dateTime(value: string | null | undefined) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

const BILLING_LABELS: Record<BillingStatus, string> = {
  recorded: 'Kirjattu',
  approved: 'Hyväksytty',
  billable: 'Laskutettava',
  queued: 'Lisätty laskulle',
  invoiced: 'Laskutettu',
  credited: 'Hyvitetty',
  rejected: 'Ei laskuteta',
};

function nextBillingStatuses(status: BillingStatus): BillingStatus[] {
  if (status === 'recorded') return ['approved', 'rejected'];
  if (status === 'approved') return ['billable', 'rejected'];
  if (status === 'billable') return ['queued', 'rejected'];
  if (status === 'queued') return ['invoiced', 'rejected'];
  if (status === 'invoiced') return ['credited'];
  return [];
}

function reportingDatasets(data: ConstructionReportingData, organizationId: string): {
  workers: ReportCenterDataset;
  contracts: ReportCenterDataset;
} {
  const workers = [...data.workerRows, ...data.subcontractorWorkerRows].map((row) => ({
    projectName: row.projectName,
    siteLocation: row.siteLocation,
    workerName: row.workerName,
    taxNumber: row.taxNumber,
    employerName: row.employerName || 'Oma organisaatio',
    employerBusinessId: row.employerBusinessId,
    employmentCategory: row.employmentCategory,
    firstWorkDate: row.firstWorkDate || row.validFrom,
    lastWorkDate: row.lastWorkDate || row.validUntil,
    sharedConstructionSite: row.sharedConstructionSite,
  }));
  const contracts = data.contractRows.map((row) => ({
    projectName: row.projectName,
    siteLocation: row.siteLocation,
    subcontractorName: row.subcontractorName,
    businessId: row.businessId,
    contractNumber: row.contractNumber,
    contractValue: row.contractValueCents == null ? null : row.contractValueCents / 100,
    billingBasis: row.billingBasis,
    isConstructionService: row.isConstructionService,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    reportingThresholdExceeded: row.reportingThresholdExceeded,
  }));
  const base = {
    dateFrom: data.targetMonth,
    dateTo: data.targetMonth,
    generatedAt: new Date().toISOString(),
    organizationId,
    projectId: null,
    summary: {},
  };
  return {
    workers: {
      ...base,
      reportType: 'site_presence',
      title: 'Rakentamisen työntekijätietojen tarkistusaineisto',
      columns: [
        { key: 'projectName', label: 'Työmaa', type: 'text' },
        { key: 'siteLocation', label: 'Osoite', type: 'text' },
        { key: 'workerName', label: 'Työntekijä', type: 'text' },
        { key: 'taxNumber', label: 'Veronumero', type: 'text' },
        { key: 'employerName', label: 'Työnantaja', type: 'text' },
        { key: 'employerBusinessId', label: 'Y-tunnus', type: 'text' },
        { key: 'employmentCategory', label: 'Henkilöryhmä', type: 'text' },
        { key: 'firstWorkDate', label: 'Ensimmäinen työpäivä', type: 'text' },
        { key: 'lastWorkDate', label: 'Viimeinen työpäivä', type: 'text' },
        { key: 'sharedConstructionSite', label: 'Yhteinen työmaa', type: 'boolean' },
      ],
      rows: workers,
    },
    contracts: {
      ...base,
      reportType: 'projects',
      title: 'Rakentamisen urakkatietojen tarkistusaineisto',
      columns: [
        { key: 'projectName', label: 'Työmaa', type: 'text' },
        { key: 'siteLocation', label: 'Osoite', type: 'text' },
        { key: 'subcontractorName', label: 'Alihankkija', type: 'text' },
        { key: 'businessId', label: 'Y-tunnus', type: 'text' },
        { key: 'contractNumber', label: 'Sopimusnumero', type: 'text' },
        { key: 'contractValue', label: 'Sopimuksen arvo', type: 'money' },
        { key: 'billingBasis', label: 'Laskutusperuste', type: 'text' },
        { key: 'isConstructionService', label: 'Rakentamispalvelu', type: 'boolean' },
        { key: 'startsAt', label: 'Alkaa', type: 'text' },
        { key: 'endsAt', label: 'Päättyy', type: 'text' },
        { key: 'reportingThresholdExceeded', label: '15 000 € raja ylittyy', type: 'boolean' },
      ],
      rows: contracts,
    },
  };
}

export default function Toiminnanohjaus() {
  const { currentOrg } = useOrganization();
  const [data, setData] = useState<BusinessOperationsData>(EMPTY_DATA);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tab, setTab] = useState('subcontractors');

  const [companyOpen, setCompanyOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [liabilityUntil, setLiabilityUntil] = useState('');
  const [insuranceUntil, setInsuranceUntil] = useState('');
  const [notes, setNotes] = useState('');

  const [workerOpen, setWorkerOpen] = useState(false);
  const [workerCompanyId, setWorkerCompanyId] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [workerEmail, setWorkerEmail] = useState('');
  const [workerPhone, setWorkerPhone] = useState('');
  const [workerTaxNumber, setWorkerTaxNumber] = useState('');
  const [workerFrom, setWorkerFrom] = useState('');
  const [workerUntil, setWorkerUntil] = useState('');

  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignmentCompanyId, setAssignmentCompanyId] = useState('');
  const [assignmentProjectId, setAssignmentProjectId] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [contractValue, setContractValue] = useState('');
  const [billingBasis, setBillingBasis] = useState('contract');
  const [contractFrom, setContractFrom] = useState('');
  const [contractUntil, setContractUntil] = useState('');

  const [billingPrices, setBillingPrices] = useState<Record<string, string>>({});

  const [vehicleEquipmentId, setVehicleEquipmentId] = useState('');
  const [vehicleProjectId, setVehicleProjectId] = useState('');
  const [vehicleReference, setVehicleReference] = useState('');
  const [selectedPositionId, setSelectedPositionId] = useState('');

  const [reportMonth, setReportMonth] = useState(currentMonth());
  const [reportProjectId, setReportProjectId] = useState('all');
  const [reporting, setReporting] = useState<ConstructionReportingData | null>(null);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    setError(null);
    try {
      const next = await loadBusinessOperations(currentOrg.id);
      setData(next);
      if (!selectedPositionId && next.vehiclePositions[0]) setSelectedPositionId(next.vehiclePositions[0].id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Toiminnanohjauksen lataus epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [currentOrg, selectedPositionId]);

  useEffect(() => { void load(); }, [load]);

  const selectedPosition = data.vehiclePositions.find((item) => item.id === selectedPositionId) || data.vehiclePositions[0];
  const selectedEquipment = data.equipment.find((item) => item.id === selectedPosition?.equipmentId);
  const vehicleEquipment = useMemo(
    () => data.equipment.filter((item) => /auto|ajoneuvo|paketti|kuorma|van/i.test(`${item.type} ${item.name}`)),
    [data.equipment],
  );

  const run = async (task: () => Promise<void>, message: string) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await task();
      setSuccess(message);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const createCompany = async () => {
    if (!currentOrg || companyName.trim().length < 2) { setError('Yrityksen nimi on pakollinen.'); return; }
    await run(async () => {
      await saveSubcontractor(currentOrg.id, { companyName, businessId, contactName, contactEmail, contactPhone, liabilityDocumentsValidUntil: liabilityUntil, insuranceValidUntil: insuranceUntil, notes });
      setCompanyOpen(false);
      setCompanyName(''); setBusinessId(''); setContactName(''); setContactEmail(''); setContactPhone(''); setLiabilityUntil(''); setInsuranceUntil(''); setNotes('');
    }, 'Alihankkija lisättiin.');
  };

  const createWorker = async () => {
    if (!currentOrg || !workerCompanyId || workerName.trim().length < 2) { setError('Valitse alihankkija ja anna työntekijän nimi.'); return; }
    await run(async () => {
      await saveSubcontractorWorker(currentOrg.id, { subcontractorId: workerCompanyId, name: workerName, email: workerEmail, phone: workerPhone, taxNumber: workerTaxNumber, validFrom: workerFrom, validUntil: workerUntil });
      setWorkerOpen(false);
      setWorkerName(''); setWorkerEmail(''); setWorkerPhone(''); setWorkerTaxNumber(''); setWorkerFrom(''); setWorkerUntil('');
    }, 'Alihankkijan työntekijä lisättiin.');
  };

  const createAssignment = async () => {
    if (!currentOrg || !assignmentCompanyId || !assignmentProjectId) { setError('Valitse alihankkija ja projekti.'); return; }
    const cents = contractValue ? Math.round(Number(contractValue.replace(',', '.')) * 100) : null;
    if (cents != null && (!Number.isFinite(cents) || cents < 0)) { setError('Sopimuksen arvo ei ole kelvollinen.'); return; }
    await run(async () => {
      await saveSubcontractorAssignment(currentOrg.id, { subcontractorId: assignmentCompanyId, projectId: assignmentProjectId, contractNumber, contractValueCents: cents, billingBasis, isConstructionService: true, startsAt: contractFrom, endsAt: contractUntil });
      setAssignmentOpen(false);
      setContractNumber(''); setContractValue(''); setContractFrom(''); setContractUntil('');
    }, 'Alihankkija liitettiin projektiin.');
  };

  const syncBilling = async () => {
    if (!currentOrg) return;
    let count = 0;
    await run(async () => { count = await syncBillingItems(currentOrg.id); }, `${count} laskutusriviä muodostettiin.`);
  };

  const savePrice = async (item: BillingItem) => {
    if (!currentOrg) return;
    const euros = Number((billingPrices[item.id] || '').replace(',', '.'));
    if (!Number.isFinite(euros) || euros < 0) { setError('Anna kelvollinen yksikköhinta euroina.'); return; }
    await run(() => setBillingItemPrice(currentOrg.id, item.id, Math.round(euros * 100)), 'Laskutushinta tallennettiin.');
  };

  const changeBillingStatus = async (item: BillingItem, status: BillingStatus) => {
    if (!currentOrg) return;
    const invoiceReference = status === 'invoiced' ? window.prompt('Laskun numero tai viite') || '' : undefined;
    if (status === 'invoiced' && !invoiceReference.trim()) return;
    await run(() => transitionBillingItem(currentOrg.id, item.id, status, invoiceReference), `Rivi siirrettiin tilaan ${BILLING_LABELS[status]}.`);
  };

  const captureVehicle = async () => {
    if (!currentOrg || !vehicleEquipmentId) { setError('Valitse ajoneuvo.'); return; }
    await run(async () => {
      const location = await captureCurrentWorkSiteLocation();
      await saveVehiclePosition(currentOrg.id, { equipmentId: vehicleEquipmentId, projectId: vehicleProjectId || null, latitude: location.latitude, longitude: location.longitude, accuracyM: location.accuracyM, source: 'manual', sourceReference: vehicleReference });
    }, 'Ajoneuvon sijaintipiste tallennettiin. Jatkuvaa taustaseurantaa ei käynnistetty.');
  };

  const loadReporting = async () => {
    if (!currentOrg) return;
    setLoading(true);
    setError(null);
    try {
      setReporting(await loadConstructionReporting(currentOrg.id, reportMonth, reportProjectId === 'all' ? undefined : reportProjectId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Raportin muodostaminen epäonnistui.');
    } finally {
      setLoading(false);
    }
  };

  const exportReporting = async (kind: 'workers' | 'contracts', format: 'csv' | 'xlsx' | 'pdf' | 'print') => {
    if (!currentOrg || !reporting) return;
    const dataset = reportingDatasets(reporting, currentOrg.id)[kind];
    try {
      if (format === 'csv') downloadReportCsv(dataset);
      if (format === 'xlsx') downloadReportXlsx(dataset);
      if (format === 'pdf') downloadReportPdf(dataset);
      if (format === 'print') printReport(dataset);
      await recordConstructionExport(currentOrg.id, kind === 'workers' ? 'worker_data' : 'contract_data', reportMonth, reportProjectId === 'all' ? undefined : reportProjectId, dataset.rows.length);
      setSuccess('Raportin muodostaminen kirjattiin audit-lokiin.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Raportin vienti epäonnistui.');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-[1500px] space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300"><Gauge size={17} /> Työnjohdon toiminnanohjaus</div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Alihankinta, laskutus ja kalusto</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">Hallittu kokonaisuus työmaiden kumppaneille, laskutusvalmiudelle, ajoneuvosijainneille ja rakentamisen ilmoitusaineistoille.</p>
          </div>
          <Button variant="outline" className="w-fit border-slate-600 bg-slate-900 text-white hover:bg-slate-800 hover:text-white" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={cn('mr-2', loading && 'animate-spin')} />Päivitä</Button>
        </div>
      </div>

      {error && <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertTriangle size={19} className="mt-0.5 shrink-0" />{error}</div>}
      {success && <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><Check size={18} className="mt-0.5 shrink-0" />{success}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ['Aktiiviset alihankkijat', String(data.summary.activeSubcontractors), Building2],
          ['Laskutettava', money(data.summary.billableCents), Euro],
          ['Laskulle lisätty', money(data.summary.queuedCents), FileText],
          ['Laskutettu', money(data.summary.invoicedCents), FileSpreadsheet],
          ['Seuratut ajoneuvot', String(data.summary.trackedVehicles), Car],
        ].map(([label, value, Icon]) => <Card key={String(label)} className="min-w-0"><CardContent className="p-4"><div className="flex items-center justify-between gap-2"><p className="text-xs text-slate-500">{String(label)}</p><Icon size={18} className="text-orange-600" /></div><p className="mt-2 break-words font-mono text-xl font-bold text-slate-950">{String(value)}</p></CardContent></Card>)}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 md:grid-cols-4">
          <TabsTrigger value="subcontractors">Alihankkijat</TabsTrigger>
          <TabsTrigger value="billing">Laskutus</TabsTrigger>
          <TabsTrigger value="vehicles">Ajoneuvot</TabsTrigger>
          <TabsTrigger value="reporting">Rakentamisilmoitukset</TabsTrigger>
        </TabsList>

        <TabsContent value="subcontractors" className="mt-5 space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-bold">Alihankkijarekisteri</h2><p className="mt-1 text-sm text-slate-500">Yritykset, henkilöt, veronumerot, asiakirjojen voimassaolo ja projektisopimukset.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!data.subcontractors.length} onClick={() => setWorkerOpen(true)}><UsersRound size={16} className="mr-2" />Työntekijä</Button><Button variant="outline" disabled={!data.subcontractors.length || !data.projects.length} onClick={() => setAssignmentOpen(true)}><FileText size={16} className="mr-2" />Sopimus</Button><Button onClick={() => setCompanyOpen(true)}><Plus size={16} className="mr-2" />Alihankkija</Button></div></div>
          <div className="grid gap-4 xl:grid-cols-2">{data.subcontractors.map((company) => {
            const today = new Date().toISOString().slice(0, 10);
            const expired = Boolean((company.liabilityDocumentsValidUntil && company.liabilityDocumentsValidUntil < today) || (company.insuranceValidUntil && company.insuranceValidUntil < today));
            return <Card key={company.id} className="min-w-0"><CardHeader><div className="flex items-start justify-between gap-3"><div className="min-w-0"><CardTitle className="truncate">{company.companyName}</CardTitle><p className="mt-1 text-sm text-slate-500">{company.businessId || 'Y-tunnus puuttuu'} · {company.contactName || 'Yhteyshenkilö puuttuu'}</p></div><Badge className={expired ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}>{expired ? 'Asiakirja vanhentunut' : 'Aktiivinen'}</Badge></div></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Työntekijät</p><p className="mt-1 text-xl font-bold">{company.workers.length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Sopimukset</p><p className="mt-1 text-xl font-bold">{company.assignments.length}</p></div></div><div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Työntekijät</p>{company.workers.slice(0, 5).map((worker) => <div key={worker.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{worker.name}</p><p className="truncate text-xs text-slate-500">Veronumero {worker.taxNumber || 'puuttuu'} · voimassa {dateLabel(worker.validUntil)}</p></div><Badge variant="outline">{worker.status}</Badge></div>)}{!company.workers.length && <p className="text-sm text-slate-500">Ei työntekijöitä.</p>}</div><div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Projektisopimukset</p>{company.assignments.map((assignment) => { const project = data.projects.find((item) => item.id === assignment.projectId); return <div key={assignment.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{project?.name || 'Tuntematon projekti'}</p><p className="mt-1 text-xs text-slate-500">{assignment.contractNumber || 'Sopimusnumero puuttuu'} · {assignment.billingBasis}</p></div><Badge className={(assignment.contractValueCents || 0) > 1_500_000 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}>{money(assignment.contractValueCents)}</Badge></div></div>; })}{!company.assignments.length && <p className="text-sm text-slate-500">Ei projektisopimuksia.</p>}</div></CardContent></Card>;
          })}</div>
          {!data.subcontractors.length && !loading && <Card><CardContent className="py-14 text-center"><Building2 size={44} className="mx-auto text-slate-300" /><p className="mt-4 font-semibold">Alihankkijoita ei ole vielä lisätty</p></CardContent></Card>}
        </TabsContent>

        <TabsContent value="billing" className="mt-5 space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-bold">Laskutusketju</h2><p className="mt-1 text-sm text-slate-500">Hyväksytyt tunnit, materiaalit ja konekirjaukset etenevät hallitusti laskutukseen.</p></div><Button onClick={() => void syncBilling()} disabled={saving}><RefreshCw size={16} className={cn('mr-2', saving && 'animate-spin')} />Muodosta hyväksytyistä</Button></div>
          <Card><CardContent className="space-y-3 p-4 sm:p-6">{data.billingItems.map((item) => { const project = data.projects.find((row) => row.id === item.projectId); return <div key={item.id} className="grid gap-3 rounded-xl border p-4 xl:grid-cols-[minmax(0,1fr)_160px_150px_auto] xl:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.description}</p><Badge variant="outline">{BILLING_LABELS[item.status]}</Badge></div><p className="mt-1 text-xs text-slate-500">{project?.name || 'Tuntematon projekti'} · {item.quantity} {item.unit} · ALV {item.vatRate} %</p>{item.invoiceReference && <p className="mt-1 text-xs text-slate-500">Laskuviite {item.invoiceReference}</p>}</div><div><p className="text-xs text-slate-500">Yksikköhinta</p>{item.unitPriceCents == null ? <div className="mt-1 flex gap-2"><Input inputMode="decimal" placeholder="€/yks." value={billingPrices[item.id] || ''} onChange={(event) => setBillingPrices((previous) => ({ ...previous, [item.id]: event.target.value }))} /><Button size="icon" aria-label="Tallenna hinta" onClick={() => void savePrice(item)}><Check size={15} /></Button></div> : <p className="mt-1 font-mono font-semibold">{money(item.unitPriceCents)}</p>}</div><div><p className="text-xs text-slate-500">Veroton arvo</p><p className="mt-1 font-mono text-lg font-bold">{money(item.totalExVatCents)}</p></div><div className="flex flex-wrap gap-2 xl:justify-end">{nextBillingStatuses(item.status).map((status) => <Button key={status} size="sm" variant={status === 'rejected' || status === 'credited' ? 'outline' : 'default'} disabled={saving || (status === 'billable' && item.unitPriceCents == null)} onClick={() => void changeBillingStatus(item, status)}>{BILLING_LABELS[status]}</Button>)}</div></div>; })}{!data.billingItems.length && !loading && <div className="py-14 text-center"><Euro size={44} className="mx-auto text-slate-300" /><p className="mt-4 font-semibold">Laskutusrivejä ei ole vielä muodostettu</p></div>}</CardContent></Card>
        </TabsContent>

        <TabsContent value="vehicles" className="mt-5 space-y-5">
          <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]"><Card className="h-fit"><CardHeader><CardTitle>Tallenna ajoneuvon sijainti</CardTitle><p className="text-sm text-slate-500">Yksittäinen sijaintinäyte tai ulkoisen GPS-palvelun lähdeviite.</p></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label>Ajoneuvo</Label><Select value={vehicleEquipmentId} onValueChange={setVehicleEquipmentId}><SelectTrigger><SelectValue placeholder="Valitse ajoneuvo" /></SelectTrigger><SelectContent>{vehicleEquipment.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Projekti</Label><Select value={vehicleProjectId || 'none'} onValueChange={(value) => setVehicleProjectId(value === 'none' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei projektia</SelectItem>{data.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="vehicle-reference">Lähdeviite</Label><Input id="vehicle-reference" value={vehicleReference} onChange={(event) => setVehicleReference(event.target.value)} placeholder="Esim. Mapon-laitetunnus tai huomio" /></div><Button className="w-full" onClick={() => void captureVehicle()} disabled={saving || !vehicleEquipmentId}><LocateFixed size={17} className="mr-2" />Tallenna nykyinen sijainti</Button><p className="text-xs leading-5 text-slate-500">VaKantti tallentaa yhden pisteen. Puhelimen jatkuvaa taustaseurantaa ei käynnistetä.</p></CardContent></Card><Card className="overflow-hidden"><CardContent className="p-0">{selectedPosition ? <div className="grid min-h-[600px] lg:grid-cols-[280px_minmax(0,1fr)]"><div className="space-y-2 overflow-y-auto border-r p-3">{data.vehiclePositions.map((position) => { const equipment = data.equipment.find((item) => item.id === position.equipmentId); return <button key={position.id} type="button" onClick={() => setSelectedPositionId(position.id)} className={cn('w-full rounded-xl border p-3 text-left', selectedPosition.id === position.id ? 'border-orange-300 bg-orange-50' : 'hover:bg-slate-50')}><p className="font-semibold">{equipment?.name || 'Ajoneuvo'}</p><p className="mt-1 text-xs text-slate-500">{dateTime(position.recordedAt)} · {position.source}</p></button>; })}</div><div className="flex min-h-[600px] flex-col"><div className="border-b p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{selectedEquipment?.name || 'Ajoneuvo'}</p><p className="mt-1 text-xs text-slate-500">{selectedPosition.latitude.toFixed(6)}, {selectedPosition.longitude.toFixed(6)} · tarkkuus {selectedPosition.accuracyM == null ? '—' : `${Math.round(selectedPosition.accuracyM)} m`}</p></div><Button variant="outline" onClick={() => window.open(`https://www.openstreetmap.org/?mlat=${selectedPosition.latitude}&mlon=${selectedPosition.longitude}#map=16/${selectedPosition.latitude}/${selectedPosition.longitude}`, '_blank', 'noopener,noreferrer')}><MapPin size={15} className="mr-2" />Avaa kartta</Button></div></div><iframe title="Ajoneuvon sijainti" className="min-h-[520px] w-full flex-1 border-0" src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedPosition.longitude - 0.01}%2C${selectedPosition.latitude - 0.006}%2C${selectedPosition.longitude + 0.01}%2C${selectedPosition.latitude + 0.006}&layer=mapnik&marker=${selectedPosition.latitude}%2C${selectedPosition.longitude}`} /></div></div> : <div className="flex min-h-[600px] flex-col items-center justify-center p-8 text-center"><Car size={52} className="text-slate-300" /><p className="mt-4 font-semibold">Ajoneuvosijainteja ei ole vielä</p></div>}</CardContent></Card></div>
        </TabsContent>

        <TabsContent value="reporting" className="mt-5 space-y-5">
          <Card className="border-amber-200 bg-amber-50"><CardContent className="flex items-start gap-3 p-4 text-sm leading-6 text-amber-900"><ShieldCheck size={20} className="mt-0.5 shrink-0" /><div><p className="font-semibold">Tarkistus- ja vientiaineisto</p><p>VaKantti kokoaa tallennetut työntekijä- ja urakkatiedot. Vastuuhenkilön pitää tarkistaa tiedot ennen viranomaisilmoitusta. Tämä näkymä ei lähetä aineistoa automaattisesti Verohallinnolle.</p></div></CardContent></Card>
          <Card><CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_1fr_auto]"><div className="space-y-2"><Label htmlFor="report-month">Kuukausi</Label><Input id="report-month" type="month" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} /></div><div className="space-y-2"><Label>Projekti</Label><Select value={reportProjectId} onValueChange={setReportProjectId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Kaikki projektit</SelectItem>{data.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div><div className="flex items-end"><Button onClick={() => void loadReporting()} disabled={loading}><RefreshCw size={16} className={cn('mr-2', loading && 'animate-spin')} />Muodosta aineisto</Button></div></CardContent></Card>
          <div className="grid gap-5 xl:grid-cols-2">{(['workers', 'contracts'] as const).map((kind) => { const count = kind === 'workers' ? (reporting?.workerRows.length || 0) + (reporting?.subcontractorWorkerRows.length || 0) : reporting?.contractRows.length || 0; return <Card key={kind}><CardHeader><CardTitle>{kind === 'workers' ? 'Työntekijätiedot' : 'Urakkatiedot'}</CardTitle><p className="text-sm text-slate-500">{count} riviä valitulla rajauksella</p></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Button variant="outline" disabled={!reporting} onClick={() => void exportReporting(kind, 'csv')}><Download size={15} className="mr-1" />CSV</Button><Button variant="outline" disabled={!reporting} onClick={() => void exportReporting(kind, 'xlsx')}><FileSpreadsheet size={15} className="mr-1" />XLSX</Button><Button variant="outline" disabled={!reporting} onClick={() => void exportReporting(kind, 'pdf')}><FileText size={15} className="mr-1" />PDF</Button><Button disabled={!reporting} onClick={() => void exportReporting(kind, 'print')}><Printer size={15} className="mr-1" />Tulosta</Button></div><div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">{kind === 'workers' ? 'Työmaalla kirjautuneet omat työntekijät ja aktiivisiin sopimuksiin liitetyt alihankkijoiden työntekijät.' : 'Rakentamispalveluksi merkityt sopimukset, sopimusarvot ja 15 000 euron tarkistusraja.'}</div></CardContent></Card>; })}</div>
        </TabsContent>
      </Tabs>

      <Dialog open={companyOpen} onOpenChange={setCompanyOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Uusi alihankkija</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="company-name">Yrityksen nimi *</Label><Input id="company-name" value={companyName} onChange={(event) => setCompanyName(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="business-id">Y-tunnus</Label><Input id="business-id" value={businessId} onChange={(event) => setBusinessId(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="contact-name">Yhteyshenkilö</Label><Input id="contact-name" value={contactName} onChange={(event) => setContactName(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="contact-email">Sähköposti</Label><Input id="contact-email" type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="contact-phone">Puhelin</Label><Input id="contact-phone" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="liability-until">Tilaajavastuu voimassa</Label><Input id="liability-until" type="date" value={liabilityUntil} onChange={(event) => setLiabilityUntil(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="insurance-until">Vakuutus voimassa</Label><Input id="insurance-until" type="date" value={insuranceUntil} onChange={(event) => setInsuranceUntil(event.target.value)} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="company-notes">Muistiinpanot</Label><Textarea id="company-notes" value={notes} onChange={(event) => setNotes(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setCompanyOpen(false)}>Peruuta</Button><Button onClick={() => void createCompany()} disabled={saving}>{saving && <Loader2 size={15} className="mr-2 animate-spin" />}Tallenna</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={workerOpen} onOpenChange={setWorkerOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Alihankkijan työntekijä</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Alihankkija *</Label><Select value={workerCompanyId} onValueChange={setWorkerCompanyId}><SelectTrigger><SelectValue placeholder="Valitse yritys" /></SelectTrigger><SelectContent>{data.subcontractors.map((company) => <SelectItem key={company.id} value={company.id}>{company.companyName}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="worker-name">Nimi *</Label><Input id="worker-name" value={workerName} onChange={(event) => setWorkerName(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="worker-email">Sähköposti</Label><Input id="worker-email" value={workerEmail} onChange={(event) => setWorkerEmail(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="worker-phone">Puhelin</Label><Input id="worker-phone" value={workerPhone} onChange={(event) => setWorkerPhone(event.target.value)} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="worker-tax-number">Veronumero</Label><Input id="worker-tax-number" value={workerTaxNumber} onChange={(event) => setWorkerTaxNumber(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="worker-from">Oikeus alkaa</Label><Input id="worker-from" type="date" value={workerFrom} onChange={(event) => setWorkerFrom(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="worker-until">Oikeus päättyy</Label><Input id="worker-until" type="date" value={workerUntil} onChange={(event) => setWorkerUntil(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setWorkerOpen(false)}>Peruuta</Button><Button onClick={() => void createWorker()} disabled={saving}>Tallenna</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={assignmentOpen} onOpenChange={setAssignmentOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Alihankkijan projektisopimus</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Alihankkija *</Label><Select value={assignmentCompanyId} onValueChange={setAssignmentCompanyId}><SelectTrigger><SelectValue placeholder="Valitse yritys" /></SelectTrigger><SelectContent>{data.subcontractors.map((company) => <SelectItem key={company.id} value={company.id}>{company.companyName}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2 sm:col-span-2"><Label>Projekti *</Label><Select value={assignmentProjectId} onValueChange={setAssignmentProjectId}><SelectTrigger><SelectValue placeholder="Valitse projekti" /></SelectTrigger><SelectContent>{data.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="contract-number">Sopimusnumero</Label><Input id="contract-number" value={contractNumber} onChange={(event) => setContractNumber(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="contract-value">Sopimuksen arvo euroina</Label><Input id="contract-value" inputMode="decimal" value={contractValue} onChange={(event) => setContractValue(event.target.value)} /></div><div className="space-y-2 sm:col-span-2"><Label>Laskutusperuste</Label><Select value={billingBasis} onValueChange={setBillingBasis}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="contract">Urakka</SelectItem><SelectItem value="hourly">Tuntityö</SelectItem><SelectItem value="unit">Yksikköhinta</SelectItem><SelectItem value="labour_hire">Työvoiman vuokraus</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="contract-from">Alkaa</Label><Input id="contract-from" type="date" value={contractFrom} onChange={(event) => setContractFrom(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="contract-until">Päättyy</Label><Input id="contract-until" type="date" value={contractUntil} onChange={(event) => setContractUntil(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setAssignmentOpen(false)}>Peruuta</Button><Button onClick={() => void createAssignment()} disabled={saving}>Tallenna</Button></DialogFooter></DialogContent></Dialog>
    </motion.div>
  );
}
