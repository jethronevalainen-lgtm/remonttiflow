import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  Car,
  Check,
  Download,
  FileSpreadsheet,
  Gauge,
  Loader2,
  LocateFixed,
  Plus,
  RefreshCw,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const tabs = ['subcontractors', 'billing', 'vehicles', 'reports'] as const;
type TabKey = typeof tabs[number];

function money(cents?: number) {
  return cents == null
    ? 'Ei hinnoiteltu'
    : new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: 'Aktiivinen', planned: 'Suunniteltu', completed: 'Valmis', cancelled: 'Peruttu',
    recorded: 'Kirjattu', approved: 'Hyväksytty', billable: 'Laskutettava', queued: 'Lisätty laskulle',
    invoiced: 'Laskutettu', credited: 'Hyvitetty', rejected: 'Hylätty',
  };
  return labels[status] ?? status;
}

function nextStatuses(status: BillingStatus): BillingStatus[] {
  if (status === 'recorded') return ['approved', 'rejected'];
  if (status === 'approved') return ['billable', 'rejected'];
  if (status === 'billable') return ['queued', 'rejected'];
  if (status === 'queued') return ['invoiced', 'rejected'];
  if (status === 'invoiced') return ['credited'];
  return [];
}

function reportRows(data: ConstructionReportingData, type: 'workers' | 'contracts'): ExportCell[][] {
  if (type === 'workers') {
    return [
      ['Työmaa', 'Osoite', 'Työntekijä', 'Veronumero', 'Työnantaja', 'Y-tunnus', 'Henkilöryhmä', 'Ensimmäinen työpäivä', 'Viimeinen työpäivä', 'Työpäivät', 'Tunnit'],
      ...[...data.workerRows, ...data.subcontractorWorkerRows].map((row) => [
        row.projectName, row.siteLocation ?? '', row.workerName, row.taxNumber ?? '', row.employerName,
        row.employerBusinessId ?? '', row.employmentCategory, row.firstWorkDate ?? '', row.lastWorkDate ?? '',
        row.workDays ?? '', row.workHours ?? '',
      ]),
    ];
  }
  return [
    ['Työmaa', 'Osoite', 'Alihankkija', 'Y-tunnus', 'Sopimusnumero', 'Sopimuksen arvo EUR', 'Laskutusperuste', 'Rakentamispalvelu', 'Alkaa', 'Päättyy', '15 000 € raja ylittyy'],
    ...data.contractRows.map((row) => [
      row.projectName, row.siteLocation ?? '', row.subcontractorName, row.businessId ?? '', row.contractNumber ?? '',
      row.contractValueCents == null ? '' : row.contractValueCents / 100, row.billingBasis,
      row.isConstructionService ? 'Kyllä' : 'Ei', row.startsAt ?? '', row.endsAt ?? '',
      row.reportingThresholdExceeded ? 'Kyllä' : 'Ei',
    ]),
  ];
}

export default function Toiminnanohjaus() {
  const [params, setParams] = useSearchParams();
  const { currentOrg, currentRole } = useOrganization();
  const { projects, equipment } = useAppDataContext();
  const requested = params.get('tab');
  const activeTab: TabKey = tabs.includes(requested as TabKey) ? requested as TabKey : 'subcontractors';
  const canManage = currentRole === 'admin' || currentRole === 'supervisor';

  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [billingItems, setBillingItems] = useState<BillingItem[]>([]);
  const [positions, setPositions] = useState<VehiclePosition[]>([]);
  const [construction, setConstruction] = useState<ConstructionReportingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [liabilityUntil, setLiabilityUntil] = useState('');
  const [insuranceUntil, setInsuranceUntil] = useState('');
  const [companyNotes, setCompanyNotes] = useState('');

  const [workerCompanyId, setWorkerCompanyId] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [workerTaxNumber, setWorkerTaxNumber] = useState('');
  const [workerEmail, setWorkerEmail] = useState('');

  const [assignmentCompanyId, setAssignmentCompanyId] = useState('');
  const [assignmentProjectId, setAssignmentProjectId] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [contractValue, setContractValue] = useState('');
  const [billingBasis, setBillingBasis] = useState('contract');
  const [contractStarts, setContractStarts] = useState('');
  const [contractEnds, setContractEnds] = useState('');

  const [prices, setPrices] = useState<Record<string, string>>({});
  const [invoiceRefs, setInvoiceRefs] = useState<Record<string, string>>({});

  const [vehicleId, setVehicleId] = useState('');
  const [vehicleProjectId, setVehicleProjectId] = useState('none');
  const [vehicleReference, setVehicleReference] = useState('');

  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [reportProjectId, setReportProjectId] = useState('all');

  const load = useCallback(async (tab: TabKey) => {
    if (!currentOrg || !canManage) return;
    setLoading(true);
    setError(null);
    try {
      if (tab === 'subcontractors') setSubcontractors(await listSubcontractors(currentOrg.id));
      if (tab === 'billing') setBillingItems(await listBillingItems(currentOrg.id));
      if (tab === 'vehicles') setPositions(await listLatestVehiclePositions(currentOrg.id));
      if (tab === 'reports') {
        setConstruction(await getConstructionReporting(
          currentOrg.id,
          reportMonth,
          reportProjectId === 'all' ? undefined : reportProjectId,
        ));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tietojen haku epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [canManage, currentOrg, reportMonth, reportProjectId]);

  useEffect(() => { void load(activeTab); }, [activeTab, load]);

  const run = async (operation: () => Promise<void>, message: string, tab: TabKey) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await operation();
      setSuccess(message);
      await load(tab);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Toiminto epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const addCompany = () => run(async () => {
    if (!currentOrg || companyName.trim().length < 2) throw new Error('Anna alihankkijan nimi.');
    await createSubcontractor({
      organizationId: currentOrg.id,
      companyName,
      businessId,
      contactName,
      contactEmail,
      liabilityDocumentsValidUntil: liabilityUntil,
      insuranceValidUntil: insuranceUntil,
      notes: companyNotes,
    });
    setCompanyName(''); setBusinessId(''); setContactName(''); setContactEmail('');
    setLiabilityUntil(''); setInsuranceUntil(''); setCompanyNotes('');
  }, 'Alihankkija lisättiin.', 'subcontractors');

  const addWorker = () => run(async () => {
    if (!currentOrg || !workerCompanyId || workerName.trim().length < 2) throw new Error('Valitse alihankkija ja anna työntekijän nimi.');
    await createSubcontractorWorker({
      organizationId: currentOrg.id,
      subcontractorId: workerCompanyId,
      name: workerName,
      taxNumber: workerTaxNumber,
      email: workerEmail,
    });
    setWorkerName(''); setWorkerTaxNumber(''); setWorkerEmail('');
  }, 'Alihankkijan työntekijä lisättiin.', 'subcontractors');

  const addAssignment = () => run(async () => {
    if (!currentOrg || !assignmentCompanyId || !assignmentProjectId) throw new Error('Valitse alihankkija ja projekti.');
    const cents = contractValue ? Math.round(Number(contractValue.replace(',', '.')) * 100) : undefined;
    if (cents != null && (!Number.isFinite(cents) || cents < 0)) throw new Error('Sopimuksen arvo ei ole kelvollinen.');
    await createSubcontractorAssignment({
      organizationId: currentOrg.id,
      subcontractorId: assignmentCompanyId,
      projectId: assignmentProjectId,
      contractNumber,
      contractValueCents: cents,
      billingBasis,
      isConstructionService: true,
      startsAt: contractStarts,
      endsAt: contractEnds,
    });
    setContractNumber(''); setContractValue(''); setContractStarts(''); setContractEnds('');
  }, 'Alihankkija liitettiin projektiin.', 'subcontractors');

  const syncBilling = () => run(async () => {
    if (!currentOrg) return;
    const count = await syncBillingItems(currentOrg.id);
    setSuccess(`${count} uutta hyväksyttyä riviä lisättiin laskutusketjuun.`);
  }, 'Laskutusrivit päivitettiin.', 'billing');

  const savePrice = (item: BillingItem) => run(async () => {
    const euros = Number((prices[item.id] ?? '').replace(',', '.'));
    if (!Number.isFinite(euros) || euros < 0) throw new Error('Anna kelvollinen yksikköhinta euroina.');
    await setBillingItemPrice(item.id, Math.round(euros * 100));
  }, 'Hinta tallennettiin.', 'billing');

  const changeStatus = (item: BillingItem, status: BillingStatus) => run(async () => {
    const reference = status === 'invoiced' ? invoiceRefs[item.id] : undefined;
    if (status === 'invoiced' && !reference?.trim()) throw new Error('Anna laskun numero tai viite.');
    await transitionBillingItem(item.id, status, reference);
  }, `Rivi siirrettiin tilaan ${statusLabel(status)}.`, 'billing');

  const savePosition = () => run(async () => {
    if (!currentOrg || !vehicleId) throw new Error('Valitse ajoneuvo tai kalusto.');
    const location = await captureCurrentWorkSiteLocation();
    await recordVehiclePosition({
      organizationId: currentOrg.id,
      equipmentId: vehicleId,
      projectId: vehicleProjectId === 'none' ? undefined : vehicleProjectId,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracyM: location.accuracyM,
      source: 'manual',
      sourceReference: vehicleReference,
    });
  }, 'Sijaintinäyte tallennettiin. Jatkuvaa seurantaa ei käynnistetty.', 'vehicles');

  const exportReport = async (type: 'workers' | 'contracts', format: 'csv' | 'xlsx' | 'print') => {
    if (!construction || !currentOrg) return;
    const rows = reportRows(construction, type);
    const title = type === 'workers' ? 'Rakentamisen työntekijätietojen tarkistusaineisto' : 'Rakentamisen urakkatietojen tarkistusaineisto';
    try {
      if (format === 'csv') downloadCsv(`${title}.csv`, rows);
      if (format === 'xlsx') downloadXlsx(`${title}.xlsx`, title, rows);
      if (format === 'print') openPrintReport(title, rows);
      await recordConstructionExport({
        organizationId: currentOrg.id,
        reportType: type === 'workers' ? 'worker_data' : 'contract_data',
        targetMonth: reportMonth,
        projectId: reportProjectId === 'all' ? undefined : reportProjectId,
        rowCount: Math.max(0, rows.length - 1),
      });
      setSuccess('Vienti muodostettiin ja kirjattiin audit-lokiin.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Raportin vienti epäonnistui.');
    }
  };

  const billingTotals = useMemo(() => {
    const sum = (statuses: BillingStatus[]) => billingItems
      .filter((item) => statuses.includes(item.status))
      .reduce((total, item) => total + (item.totalExVatCents ?? 0), 0);
    return {
      billable: sum(['billable']),
      notQueued: sum(['approved', 'billable']),
      invoiced: sum(['invoiced']),
      missingPrice: billingItems.filter((item) => item.unitPriceCents == null).length,
    };
  }, [billingItems]);

  if (!canManage) return null;

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-500"><Gauge size={29} /></div>
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">Kaupallinen ja ulkoinen toiminta</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">Toiminnanohjaus</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Alihankkijat, laskutusketju, ajoneuvojen sijaintinäytteet ja rakentamisilmoitusten tarkistusaineistot.</p></div>
        </div>
      </div>

      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertTriangle size={18} className="mt-0.5 shrink-0" />{error}</div>}
      {success && <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><Check size={18} className="mt-0.5 shrink-0" />{success}</div>}
      {loading && <div className="flex items-center gap-2 rounded-xl border bg-white p-4 text-sm text-slate-600"><Loader2 size={17} className="animate-spin" />Päivitetään tietoja…</div>}

      <Tabs value={activeTab} onValueChange={(value) => setParams({ tab: value })}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:grid-cols-4">
          <TabsTrigger value="subcontractors">Alihankkijat</TabsTrigger><TabsTrigger value="billing">Laskutus</TabsTrigger><TabsTrigger value="vehicles">Ajoneuvot</TabsTrigger><TabsTrigger value="reports">Rakentamisraportit</TabsTrigger>
        </TabsList>

        <TabsContent value="subcontractors" className="mt-5 space-y-5">
          <div className="grid gap-4 xl:grid-cols-3">
            <Card><CardHeader><CardTitle className="text-base">Uusi alihankkija</CardTitle></CardHeader><CardContent className="space-y-3"><Input placeholder="Yrityksen nimi *" value={companyName} onChange={(e) => setCompanyName(e.target.value)} /><Input placeholder="Y-tunnus" value={businessId} onChange={(e) => setBusinessId(e.target.value)} /><Input placeholder="Yhteyshenkilö" value={contactName} onChange={(e) => setContactName(e.target.value)} /><Input type="email" placeholder="Sähköposti" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /><div className="grid grid-cols-2 gap-2"><div><Label className="text-xs">Tilaajavastuu voimassa</Label><Input type="date" value={liabilityUntil} onChange={(e) => setLiabilityUntil(e.target.value)} /></div><div><Label className="text-xs">Vakuutus voimassa</Label><Input type="date" value={insuranceUntil} onChange={(e) => setInsuranceUntil(e.target.value)} /></div></div><Textarea placeholder="Muistiinpanot" value={companyNotes} onChange={(e) => setCompanyNotes(e.target.value)} /><Button className="w-full" onClick={() => void addCompany()} disabled={saving}><Plus size={16} className="mr-2" />Lisää</Button></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Alihankkijan työntekijä</CardTitle></CardHeader><CardContent className="space-y-3"><Select value={workerCompanyId} onValueChange={setWorkerCompanyId}><SelectTrigger><SelectValue placeholder="Valitse yritys" /></SelectTrigger><SelectContent>{subcontractors.map((item) => <SelectItem key={item.id} value={item.id}>{item.companyName}</SelectItem>)}</SelectContent></Select><Input placeholder="Nimi *" value={workerName} onChange={(e) => setWorkerName(e.target.value)} /><Input placeholder="Veronumero" value={workerTaxNumber} onChange={(e) => setWorkerTaxNumber(e.target.value)} /><Input type="email" placeholder="Sähköposti" value={workerEmail} onChange={(e) => setWorkerEmail(e.target.value)} /><Button className="w-full" variant="outline" onClick={() => void addWorker()} disabled={saving}><UsersRound size={16} className="mr-2" />Lisää työntekijä</Button></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Projektisopimus</CardTitle></CardHeader><CardContent className="space-y-3"><Select value={assignmentCompanyId} onValueChange={setAssignmentCompanyId}><SelectTrigger><SelectValue placeholder="Alihankkija" /></SelectTrigger><SelectContent>{subcontractors.map((item) => <SelectItem key={item.id} value={item.id}>{item.companyName}</SelectItem>)}</SelectContent></Select><Select value={assignmentProjectId} onValueChange={setAssignmentProjectId}><SelectTrigger><SelectValue placeholder="Projekti" /></SelectTrigger><SelectContent>{projects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select><Input placeholder="Sopimusnumero" value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} /><Input inputMode="decimal" placeholder="Arvo € (alv 0)" value={contractValue} onChange={(e) => setContractValue(e.target.value)} /><Select value={billingBasis} onValueChange={setBillingBasis}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="contract">Urakka</SelectItem><SelectItem value="hourly">Tuntilaskutus</SelectItem><SelectItem value="unit">Yksikköhinta</SelectItem><SelectItem value="labour_hire">Työvoiman vuokraus</SelectItem></SelectContent></Select><div className="grid grid-cols-2 gap-2"><Input type="date" value={contractStarts} onChange={(e) => setContractStarts(e.target.value)} /><Input type="date" value={contractEnds} onChange={(e) => setContractEnds(e.target.value)} /></div><Button className="w-full" variant="outline" onClick={() => void addAssignment()} disabled={saving}><Building2 size={16} className="mr-2" />Liitä projektiin</Button></CardContent></Card>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">{subcontractors.map((company) => <Card key={company.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg">{company.companyName}</CardTitle><p className="mt-1 text-sm text-slate-500">{company.businessId || 'Y-tunnus puuttuu'}</p></div><Badge variant="outline">{statusLabel(company.status)}</Badge></div></CardHeader><CardContent className="space-y-3 text-sm"><p>{company.contactName || 'Ei yhteyshenkilöä'} · {company.contactEmail || 'Ei sähköpostia'}</p><div className="rounded-lg bg-slate-50 p-3"><strong>{company.workers.length} työntekijää</strong><p className="mt-1 text-xs text-slate-500">{company.workers.map((item) => `${item.name}${item.taxNumber ? '' : ' (veronumero puuttuu)'}`).join(', ') || 'Ei työntekijöitä'}</p></div><div className="rounded-lg bg-slate-50 p-3"><strong>{company.assignments.length} projektisopimusta</strong><p className="mt-1 text-xs text-slate-500">{company.assignments.map((item) => projects.find((project) => project.id === item.projectId)?.name || 'Tuntematon projekti').join(', ') || 'Ei sopimuksia'}</p></div></CardContent></Card>)}</div>
        </TabsContent>

        <TabsContent value="billing" className="mt-5 space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Laskutettava', money(billingTotals.billable)], ['Laskulle lisäämättä', money(billingTotals.notQueued)], ['Laskutettu', money(billingTotals.invoiced)], ['Hinta puuttuu', `${billingTotals.missingPrice} riviä`]].map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></CardContent></Card>)}</div>
          <div className="flex justify-end"><Button onClick={() => void syncBilling()} disabled={saving}><RefreshCw size={16} className="mr-2" />Muodosta hyväksytyistä kirjauksista</Button></div>
          <Card><CardContent className="space-y-3 p-4">{billingItems.map((item) => <div key={item.id} className="rounded-xl border p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><p className="font-semibold">{item.description}</p><p className="mt-1 text-xs text-slate-500">{projects.find((project) => project.id === item.projectId)?.name || 'Projekti'} · {item.quantity} {item.unit} · {money(item.totalExVatCents)}</p></div><Badge variant="outline">{statusLabel(item.status)}</Badge>{item.unitPriceCents == null && <div className="flex gap-2"><Input className="w-32" placeholder="€/yksikkö" value={prices[item.id] ?? ''} onChange={(e) => setPrices((previous) => ({ ...previous, [item.id]: e.target.value }))} /><Button variant="outline" onClick={() => void savePrice(item)}>Hinnoittele</Button></div>}{item.status === 'queued' && <Input className="w-44" placeholder="Laskun numero" value={invoiceRefs[item.id] ?? ''} onChange={(e) => setInvoiceRefs((previous) => ({ ...previous, [item.id]: e.target.value }))} />}<div className="flex flex-wrap gap-2">{nextStatuses(item.status).map((status) => <Button key={status} size="sm" variant={['rejected', 'credited'].includes(status) ? 'outline' : 'default'} onClick={() => void changeStatus(item, status)}>{statusLabel(status)}</Button>)}</div></div></div>)}{billingItems.length === 0 && <p className="py-10 text-center text-sm text-slate-500">Laskutusrivejä ei ole.</p>}</CardContent></Card>
        </TabsContent>

        <TabsContent value="vehicles" className="mt-5 space-y-5">
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><LocateFixed size={19} />Tallenna yksittäinen sijaintinäyte</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-3"><Select value={vehicleId} onValueChange={setVehicleId}><SelectTrigger><SelectValue placeholder="Ajoneuvo tai kalusto" /></SelectTrigger><SelectContent>{equipment.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select><Select value={vehicleProjectId} onValueChange={setVehicleProjectId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei projektia</SelectItem>{projects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select><Input placeholder="Lähdeviite" value={vehicleReference} onChange={(e) => setVehicleReference(e.target.value)} /><Button className="md:col-span-3" onClick={() => void savePosition()} disabled={saving || !vehicleId}><Car size={16} className="mr-2" />Tallenna nykyinen sijainti</Button><p className="text-xs text-slate-500 md:col-span-3">Tallennetaan yksi sijaintinäyte. Jatkuvaa puhelimen taustaseurantaa ei käynnistetä.</p></CardContent></Card>
          <div className="grid gap-4 lg:grid-cols-2">{positions.map((position) => <Card key={position.id}><CardContent className="p-5"><div className="flex justify-between gap-3"><div><p className="font-semibold">{equipment.find((item) => item.id === position.equipmentId)?.name || 'Ajoneuvo'}</p><p className="mt-1 text-sm text-slate-500">{projects.find((item) => item.id === position.projectId)?.name || 'Ei projektia'}</p></div><Badge variant="outline">{position.source}</Badge></div><p className="mt-4 font-mono text-sm">{position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}</p><Button className="mt-4" variant="outline" onClick={() => window.open(`https://www.openstreetmap.org/?mlat=${position.latitude}&mlon=${position.longitude}#map=16/${position.latitude}/${position.longitude}`, '_blank', 'noopener,noreferrer')}>Avaa kartalla</Button></CardContent></Card>)}</div>
        </TabsContent>

        <TabsContent value="reports" className="mt-5 space-y-5">
          <Card><CardContent className="grid gap-4 p-5 md:grid-cols-3"><div><Label>Kuukausi</Label><Input className="mt-2" type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} /></div><div><Label>Projekti</Label><Select value={reportProjectId} onValueChange={setReportProjectId}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Kaikki projektit</SelectItem>{projects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div><div className="flex items-end"><Button className="w-full" onClick={() => void load('reports')}><RefreshCw size={16} className="mr-2" />Muodosta</Button></div></CardContent></Card>
          <div className="grid gap-4 lg:grid-cols-2">{(['workers', 'contracts'] as const).map((type) => { const count = type === 'workers' ? (construction?.workerRows.length ?? 0) + (construction?.subcontractorWorkerRows.length ?? 0) : construction?.contractRows.length ?? 0; return <Card key={type}><CardHeader><CardTitle className="flex items-center gap-2">{type === 'workers' ? <UsersRound size={19} /> : <Building2 size={19} />}{type === 'workers' ? 'Työntekijätiedot' : 'Urakkatiedot'}</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{count}</p><p className="mt-1 text-sm text-slate-500">tarkistusaineiston riviä</p><div className="mt-5 flex flex-wrap gap-2"><Button size="sm" onClick={() => void exportReport(type, 'xlsx')}><FileSpreadsheet size={15} className="mr-2" />XLSX</Button><Button size="sm" variant="outline" onClick={() => void exportReport(type, 'csv')}><Download size={15} className="mr-2" />CSV</Button><Button size="sm" variant="outline" onClick={() => void exportReport(type, 'print')}>Tulosta/PDF</Button></div></CardContent></Card>; })}</div>
          <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900"><ShieldCheck size={18} className="mt-0.5 shrink-0" /><p>Tämä on tarkistus- ja vientiaineisto. Se ei lähetä ilmoitusta Verohallinnolle automaattisesti.</p></div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
