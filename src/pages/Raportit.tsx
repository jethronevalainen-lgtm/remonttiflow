import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  Euro,
  FileText,
  FolderKanban,
  Leaf,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Wrench,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useFinanceFormsData } from '@/hooks/useFinanceFormsData';
import { useReportSummary } from '@/hooks/useReportSummary';
import { useSiteReceipts } from '@/hooks/useSiteReceipts';
import {
  createSavedReport,
  deleteSavedReport,
} from '@/lib/supabase/reporting';

function euro(value: number) {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value);
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function dateTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

export default function Raportit() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const app = useAppDataContext();
  const finance = useFinanceFormsData();
  const receipts = useSiteReceipts();

  const [projectId, setProjectId] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);
  const [reportName, setReportName] = useState('');
  const [saving, setSaving] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);

  const reportQuery = useReportSummary({
    projectId: projectId === 'all' ? undefined : projectId,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  const summary = reportQuery.summary;
  const selectedProject = app.projects.find((project) => project.id === projectId);

  const selectedEstimates = useMemo(
    () => finance.estimates.filter((estimate) => projectId === 'all' || estimate.projectId === projectId),
    [finance.estimates, projectId],
  );
  const selectedForms = useMemo(
    () => finance.submissions.filter((submission) => {
      if (projectId !== 'all' && submission.projectId !== projectId) return false;
      if (dateFrom && submission.submittedAt && submission.submittedAt.slice(0, 10) < dateFrom) return false;
      if (dateTo && submission.submittedAt && submission.submittedAt.slice(0, 10) > dateTo) return false;
      return true;
    }),
    [dateFrom, dateTo, finance.submissions, projectId],
  );
  const selectedReceipts = useMemo(
    () => receipts.receipts.filter((receipt) => {
      if (projectId !== 'all' && receipt.projectId !== projectId) return false;
      const date = receipt.occurredAt.slice(0, 10);
      if (dateFrom && date < dateFrom) return false;
      if (dateTo && date > dateTo) return false;
      return true;
    }),
    [dateFrom, dateTo, projectId, receipts.receipts],
  );

  const wasteUnits = Object.entries(summary?.wasteByUnit ?? {})
    .sort(([left], [right]) => left.localeCompare(right, 'fi'));
  const changeOrderMargin = ((summary?.changeOrderAmountCents ?? 0) - (summary?.changeOrderCostCents ?? 0)) / 100;
  const errors = [
    operationError,
    reportQuery.error,
    app.error,
    finance.error,
    receipts.error,
  ].filter(Boolean).join(' ');

  const exportCsv = () => {
    const rows: unknown[][] = [
      ['VaKantti-raportti'],
      ['Projekti', selectedProject?.name ?? 'Kaikki projektit'],
      ['Alkupäivä', dateFrom || 'Ei rajausta'],
      ['Loppupäivä', dateTo || 'Ei rajausta'],
      ['Muodostettu', new Date().toLocaleString('fi-FI')],
      [],
      ['Mittari', 'Arvo', 'Yksikkö'],
      ['Projektien budjetti', summary?.projectBudget ?? 0, 'EUR'],
      ['Projektien toteuma', summary?.projectSpent ?? 0, 'EUR'],
      ['Hyväksytyt tunnit', summary?.approvedHours ?? 0, 'h'],
      ['Odottavat tunnit', summary?.pendingHours ?? 0, 'h'],
      ['Avoimet työmääräykset', summary?.openWorkOrders ?? 0, 'kpl'],
      ['Avoimet turvallisuusasiat', summary?.openSafety ?? 0, 'kpl'],
      ['Vakavat avoimet turvallisuusasiat', summary?.seriousSafety ?? 0, 'kpl'],
      ['Jätekustannus', summary?.wasteCost ?? 0, 'EUR'],
      ['Hyväksytyt matkakulut', summary?.travelCost ?? 0, 'EUR'],
      ['Muutostöiden myynti', (summary?.changeOrderAmountCents ?? 0) / 100, 'EUR'],
      ['Muutostöiden kustannus', (summary?.changeOrderCostCents ?? 0) / 100, 'EUR'],
      ['Muutostöiden kate', changeOrderMargin, 'EUR'],
      ['Kustannuslaskelmia', selectedEstimates.length, 'kpl'],
      ['Käsittelyä odottavat lomakkeet', selectedForms.filter((item) => item.status === 'Lähetetty').length, 'kpl'],
      ['Allekirjoitetut kuittaukset', selectedReceipts.filter((item) => item.status === 'signed').length, 'kpl'],
      [],
      ['Jätemäärät yksiköittäin'],
      ['Yksikkö', 'Määrä'],
      ...wasteUnits,
    ];

    const csv = rows.map((row) => row.map(csvCell).join(';')).join('\n');
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `vakantti-raportti-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openSave = () => {
    setReportName(selectedProject ? `${selectedProject.name} – raportti` : 'Organisaation raportti');
    setOperationError(null);
    setSaveOpen(true);
  };

  const saveReport = async () => {
    if (!currentOrg || !user || !reportName.trim()) {
      setOperationError('Raportin nimi on pakollinen.');
      return;
    }
    setSaving(true);
    setOperationError(null);
    try {
      await createSavedReport({
        organizationId: currentOrg.id,
        userId: user.id,
        name: reportName,
        reportType: 'organization_summary',
        filters: {
          projectId: projectId === 'all' ? null : projectId,
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
        },
      });
      await reportQuery.refresh();
      setSaveOpen(false);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Raportin tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const applySavedReport = (filters: Record<string, unknown>) => {
    setProjectId(typeof filters.projectId === 'string' && filters.projectId ? filters.projectId : 'all');
    setDateFrom(typeof filters.dateFrom === 'string' ? filters.dateFrom : '');
    setDateTo(typeof filters.dateTo === 'string' ? filters.dateTo : '');
  };

  const removeSaved = async (id: string) => {
    if (!currentOrg) return;
    setSaving(true);
    setOperationError(null);
    try {
      await deleteSavedReport(currentOrg.id, id);
      await reportQuery.refresh();
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tallennetun raportin poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const cards = [
    { label: 'Budjetti', value: euro(summary?.projectBudget ?? 0), detail: `Toteuma ${euro(summary?.projectSpent ?? 0)}`, icon: Euro },
    { label: 'Hyväksytyt tunnit', value: `${(summary?.approvedHours ?? 0).toFixed(1)} h`, detail: `Odottaa ${(summary?.pendingHours ?? 0).toFixed(1)} h`, icon: Clock },
    { label: 'Avoimet työmääräykset', value: String(summary?.openWorkOrders ?? 0), detail: 'palvelimelta laskettu', icon: Wrench },
    { label: 'Turvallisuus', value: String(summary?.openSafety ?? 0), detail: `${summary?.seriousSafety ?? 0} vakavaa`, icon: ShieldCheck },
    { label: 'Jätekustannus', value: euro(summary?.wasteCost ?? 0), detail: `${wasteUnits.length} mittayksikköä`, icon: Leaf },
    { label: 'Matkakulut', value: euro(summary?.travelCost ?? 0), detail: 'vain hyväksytyt', icon: Euro },
    { label: 'Muutostöiden kate', value: euro(changeOrderMargin), detail: `${euro((summary?.changeOrderAmountCents ?? 0) / 100)} myynti`, icon: BarChart3 },
    { label: 'Dokumentointi', value: String(selectedForms.length + selectedReceipts.length), detail: `${selectedReceipts.filter((item) => item.status === 'signed').length} allekirjoitettu`, icon: FileText },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-hero text-text-primary">Raportit</h1>
          <p className="mt-1 text-body-sm text-text-secondary">Palvelinpuolisesti laskettu organisaatio- ja projektiraportointi</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void reportQuery.refresh()} disabled={reportQuery.refreshing}>
            <RefreshCw size={16} className={`mr-2 ${reportQuery.refreshing ? 'animate-spin' : ''}`} /> Päivitä
          </Button>
          <Button variant="outline" onClick={openSave}><Save size={16} className="mr-2" /> Tallenna rajaus</Button>
          <Button onClick={exportCsv} disabled={!summary}><Download size={16} className="mr-2" /> Vie CSV</Button>
        </div>
      </div>

      {errors && <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{errors}</div>}
      {reportQuery.loading && <div className="flex items-center gap-2 rounded-lg border bg-white p-4 text-sm text-text-secondary"><Loader2 size={17} className="animate-spin" />Muodostetaan raporttia tietokannassa…</div>}

      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-3">
          <div className="space-y-2"><Label>Projekti</Label><Select value={projectId} onValueChange={setProjectId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Kaikki projektit</SelectItem>{app.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="report-from">Alkupäivä</Label><Input id="report-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="report-to">Loppupäivä</Label><Input id="report-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map((card) => <Card key={card.label}><CardContent className="p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs text-text-secondary">{card.label}</p><card.icon size={18} className="text-primary" /></div><p className="mt-2 break-words font-mono text-xl font-bold">{card.value}</p><p className="mt-1 text-xs text-text-muted">{card.detail}</p></CardContent></Card>)}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Leaf size={18} /> Jätemäärät yksiköittäin</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {wasteUnits.map(([unit, value]) => <div key={unit} className="flex items-center justify-between rounded-lg border border-slate-200 p-3"><span className="font-medium">{unit}</span><span className="font-mono font-bold">{value.toLocaleString('fi-FI')}</span></div>)}
            {!wasteUnits.length && <p className="py-8 text-center text-sm text-text-secondary">Valitulla rajauksella ei ole jätekirjauksia.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FolderKanban size={18} /> Tallennetut raportit</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {reportQuery.savedReports.map((report) => <div key={report.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"><button type="button" className="min-w-0 flex-1 break-words text-left" onClick={() => applySavedReport(report.filters)}><p className="font-medium">{report.name}</p><p className="text-xs text-text-secondary">{dateTime(report.createdAt)}</p></button><Badge variant="outline">{report.active ? 'Aktiivinen' : 'Pois käytöstä'}</Badge>{report.createdBy === user?.id && <Button variant="ghost" size="sm" className="text-red-600" onClick={() => void removeSaved(report.id)} disabled={saving}><Trash2 size={15} /></Button>}</div>)}
            {!reportQuery.savedReports.length && <div className="py-8 text-center"><FileText size={38} className="mx-auto mb-3 text-text-muted" /><p className="text-sm text-text-secondary">Ei tallennettuja raporttirajauksia.</p><Button variant="outline" size="sm" className="mt-3" onClick={openSave}><Plus size={14} className="mr-1" /> Tallenna nykyinen</Button></div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Raportin sisältö ja luotettavuus</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-4"><CheckCircle2 size={18} className="mb-2 text-emerald-600" /><p className="font-semibold">Tietokantakoonti</p><p className="mt-1 text-text-secondary">Tunnit, kulut, turvallisuus ja muutostyöt lasketaan tietokannassa nykyisellä käyttöoikeudella.</p></div>
          <div className="rounded-xl border border-slate-200 p-4"><Leaf size={18} className="mb-2 text-emerald-600" /><p className="font-semibold">Yksiköt säilyvät erillään</p><p className="mt-1 text-text-secondary">Kilogrammoja, tonneja ja kuutiometrejä ei yhdistetä virheellisesti yhdeksi määräksi.</p></div>
          <div className="rounded-xl border border-slate-200 p-4"><ShieldCheck size={18} className="mb-2 text-emerald-600" /><p className="font-semibold">RLS-suojattu</p><p className="mt-1 text-text-secondary">Raportointifunktio käyttää kutsujan oikeuksia eikä ohita organisaatio- tai projektirajauksia.</p></div>
        </CardContent>
      </Card>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Tallenna raporttirajaus</DialogTitle></DialogHeader>
          <div className="space-y-2"><Label htmlFor="report-name">Nimi *</Label><Input id="report-name" value={reportName} onChange={(event) => setReportName(event.target.value)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setSaveOpen(false)}>Peruuta</Button><Button onClick={() => void saveReport()} disabled={saving}><Save size={15} className="mr-2" />{saving ? 'Tallennetaan…' : 'Tallenna'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
