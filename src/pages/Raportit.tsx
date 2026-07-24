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
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useFinanceFormsData } from '@/hooks/useFinanceFormsData';
import { useOperationsData } from '@/hooks/useOperationsData';
import { useSchedulingData } from '@/hooks/useSchedulingData';
import { useSiteReceipts } from '@/hooks/useSiteReceipts';
import { calculateEstimateTotals } from '@/lib/financeCalculations';

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

function inDateRange(value: string | undefined, from: string, to: string) {
  if (!value) return false;
  const date = value.slice(0, 10);
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function matchesProject(value: string | undefined, selectedName: string) {
  return !selectedName || value === selectedName;
}

export default function Raportit() {
  const app = useAppDataContext();
  const operations = useOperationsData();
  const scheduling = useSchedulingData();
  const finance = useFinanceFormsData();
  const receipts = useSiteReceipts();

  const [projectId, setProjectId] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const selectedProject = app.projects.find((project) => project.id === projectId) ?? null;
  const selectedProjectName = selectedProject?.name ?? '';

  const report = useMemo(() => {
    const projects = selectedProject ? [selectedProject] : app.projects;
    const timeEntries = app.timeEntries.filter(
      (entry) =>
        inDateRange(entry.date, dateFrom, dateTo) &&
        matchesProject(entry.project, selectedProjectName),
    );
    const workOrders = app.workOrders.filter((order) =>
      matchesProject(order.project, selectedProjectName),
    );
    const safetyItems = app.safetyItems.filter((item) =>
      inDateRange(item.date, dateFrom, dateTo),
    );
    const wasteEntries = operations.wasteEntries.filter(
      (entry) =>
        inDateRange(entry.date, dateFrom, dateTo) &&
        matchesProject(entry.project, selectedProjectName),
    );
    const diaryEntries = operations.diaryEntries.filter(
      (entry) =>
        inDateRange(entry.date, dateFrom, dateTo) &&
        matchesProject(entry.project, selectedProjectName),
    );
    const travelExpenses = operations.travelExpenses.filter((entry) =>
      inDateRange(entry.date, dateFrom, dateTo),
    );
    const phases = scheduling.phases.filter(
      (phase) => !selectedProject || phase.projectId === selectedProject.id,
    );
    const estimates = finance.estimates.filter(
      (estimate) => !selectedProject || estimate.projectId === selectedProject.id,
    );
    const formSubmissions = finance.submissions.filter(
      (submission) =>
        (!selectedProject || submission.projectId === selectedProject.id) &&
        (!submission.submittedAt || inDateRange(submission.submittedAt, dateFrom, dateTo)),
    );
    const siteReceipts = receipts.receipts.filter(
      (receipt) =>
        (!selectedProject || receipt.projectId === selectedProject.id) &&
        inDateRange(receipt.occurredAt, dateFrom, dateTo),
    );

    const directEstimateCents = estimates.reduce((sum, estimate) => {
      const lines = finance.estimateLines.filter((line) => line.estimateId === estimate.id);
      return sum + calculateEstimateTotals(estimate, lines).totalCents;
    }, 0);

    return {
      projects,
      timeEntries,
      workOrders,
      safetyItems,
      wasteEntries,
      diaryEntries,
      travelExpenses,
      phases,
      estimates,
      formSubmissions,
      siteReceipts,
      projectBudget: projects.reduce((sum, project) => sum + project.budget, 0),
      projectSpent: projects.reduce((sum, project) => sum + project.spent, 0),
      approvedHours: timeEntries
        .filter((entry) => entry.status === 'Hyväksytty')
        .reduce((sum, entry) => sum + entry.hours + entry.overtime, 0),
      pendingHours: timeEntries
        .filter((entry) => entry.status === 'Odottaa')
        .reduce((sum, entry) => sum + entry.hours + entry.overtime, 0),
      openOrders: workOrders.filter((order) =>
        ['Avoin', 'Käynnissä', 'Odottaa'].includes(order.status),
      ).length,
      openSafety: safetyItems.filter((item) =>
        !['Suljettu', 'Korjattu', 'Valmis'].includes(item.status),
      ).length,
      seriousSafety: safetyItems.filter((item) => item.severity === 'Vakava').length,
      wasteAmount: wasteEntries.reduce((sum, entry) => sum + entry.amount, 0),
      wasteCost: wasteEntries.reduce((sum, entry) => sum + entry.cost, 0),
      travelCost: travelExpenses.reduce((sum, entry) => sum + entry.amount, 0),
      latePhases: phases.filter((phase) => phase.status === 'Myöhässä').length,
      estimateTotal: directEstimateCents / 100,
      pendingForms: formSubmissions.filter((item) => item.status === 'Lähetetty').length,
      approvedForms: formSubmissions.filter((item) => item.status === 'Hyväksytty').length,
      signedReceipts: siteReceipts.filter((item) => item.status === 'signed').length,
    };
  }, [
    app.projects,
    app.safetyItems,
    app.timeEntries,
    app.workOrders,
    dateFrom,
    dateTo,
    finance.estimateLines,
    finance.estimates,
    finance.submissions,
    operations.diaryEntries,
    operations.travelExpenses,
    operations.wasteEntries,
    receipts.receipts,
    scheduling.phases,
    selectedProject,
    selectedProjectName,
  ]);

  const errors = [app.error, operations.error, scheduling.error, finance.error, receipts.error]
    .filter(Boolean)
    .join(' ');

  const exportCsv = () => {
    const rows: unknown[][] = [
      ['Raportin rajaus', selectedProject?.name ?? 'Kaikki projektit'],
      ['Alkupäivä', dateFrom || 'Ei rajausta'],
      ['Loppupäivä', dateTo || 'Ei rajausta'],
      [],
      ['Mittari', 'Arvo'],
      ['Projektien budjetti EUR', report.projectBudget.toFixed(2)],
      ['Projektien toteuma EUR', report.projectSpent.toFixed(2)],
      ['Kustannuslaskelmien summa EUR', report.estimateTotal.toFixed(2)],
      ['Hyväksytyt tunnit', report.approvedHours.toFixed(2)],
      ['Odottavat tunnit', report.pendingHours.toFixed(2)],
      ['Avoimet työmääräykset', report.openOrders],
      ['Avoimet turvallisuusasiat', report.openSafety],
      ['Jätemäärä', report.wasteAmount.toFixed(2)],
      ['Jätekustannus EUR', report.wasteCost.toFixed(2)],
      ['Matkakulut EUR', report.travelCost.toFixed(2)],
      ['Myöhässä olevat vaiheet', report.latePhases],
      ['Käsittelyä odottavat lomakkeet', report.pendingForms],
      ['Allekirjoitetut kuittaukset', report.signedReceipts],
      [],
      ['Projekti', 'Tila', 'Edistyminen %', 'Budjetti EUR', 'Toteuma EUR'],
      ...report.projects.map((project) => [
        project.name,
        project.status,
        project.progress,
        project.budget.toFixed(2),
        project.spent.toFixed(2),
      ]),
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

  const cards = [
    { label: 'Budjetti', value: euro(report.projectBudget), detail: `Toteuma ${euro(report.projectSpent)}`, icon: Euro },
    { label: 'Hyväksytyt tunnit', value: `${report.approvedHours.toFixed(1)} h`, detail: `Odottaa ${report.pendingHours.toFixed(1)} h`, icon: Clock },
    { label: 'Avoimet työmääräykset', value: String(report.openOrders), detail: `${report.workOrders.length} yhteensä`, icon: Wrench },
    { label: 'Turvallisuus', value: String(report.openSafety), detail: `${report.seriousSafety} vakavaa`, icon: ShieldCheck },
    { label: 'Jätehuolto', value: report.wasteAmount.toFixed(1), detail: euro(report.wasteCost), icon: Leaf },
    { label: 'Laskelmat', value: euro(report.estimateTotal), detail: `${report.estimates.length} laskelmaa`, icon: BarChart3 },
    { label: 'Lomakkeet', value: String(report.pendingForms), detail: `${report.approvedForms} hyväksytty`, icon: FileText },
    { label: 'Kuittaukset', value: String(report.signedReceipts), detail: `${report.siteReceipts.length} yhteensä`, icon: CheckCircle2 },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-hero text-text-primary">Raportit</h1>
          <p className="mt-1 text-body-sm text-text-secondary">
            Reaaliaikainen yhteenveto organisaation tuotantotiedoista
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} className="gap-2">
          <Download size={16} /> Vie CSV
        </Button>
      </div>

      {errors && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} /> {errors}
        </div>
      )}

      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Projekti</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Kaikki projektit</SelectItem>
                {app.projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label htmlFor="report-from" className="text-sm font-medium">Alkupäivä</label>
            <Input id="report-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label htmlFor="report-to" className="text-sm font-medium">Loppupäivä</label>
            <Input id="report-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-text-secondary">{card.label}</p>
                <card.icon size={18} className="text-primary" />
              </div>
              <p className="mt-2 break-words font-mono text-xl font-bold">{card.value}</p>
              <p className="mt-1 text-xs text-text-muted">{card.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="border-b bg-slate-50 px-5 py-3">
              <h2 className="font-semibold">Projektien tilanne</h2>
            </div>
            {report.projects.map((project) => {
              const budgetUse = project.budget > 0 ? project.spent / project.budget * 100 : 0;
              return (
                <div key={project.id} className="grid gap-3 border-b border-slate-100 px-5 py-4 lg:grid-cols-[1fr_120px_110px_160px] lg:items-center">
                  <div><p className="font-medium">{project.name}</p><p className="text-xs text-text-secondary">{project.customer || 'Ei asiakasta'}</p></div>
                  <Badge variant="outline" className="w-fit">{project.status}</Badge>
                  <div><p className="text-xs text-text-muted">Edistyminen</p><p className="font-mono font-semibold">{project.progress}%</p></div>
                  <div><p className="text-xs text-text-muted">Budjetin käyttö</p><p className="font-mono font-semibold">{budgetUse.toFixed(1)}%</p></div>
                </div>
              );
            })}
            {report.projects.length === 0 && <div className="p-12 text-center"><FolderKanban size={42} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei projekteja</p></div>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5">
            <h2 className="font-semibold">Operatiivinen yhteenveto</h2>
            <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm"><Users size={16} /> Aktiivinen henkilöstö</span><strong>{app.employees.filter((item) => item.status === 'Aktiivinen').length}</strong></div>
            <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm"><Wrench size={16} /> Kalustoa käytössä</span><strong>{app.equipment.filter((item) => item.status === 'Käytössä').length}</strong></div>
            <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm"><FolderKanban size={16} /> Myöhässä olevat vaiheet</span><strong>{report.latePhases}</strong></div>
            <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm"><FileText size={16} /> Päiväkirjamerkinnät</span><strong>{report.diaryEntries.length}</strong></div>
            <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm"><Euro size={16} /> Matkakulut</span><strong>{euro(report.travelCost)}</strong></div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
