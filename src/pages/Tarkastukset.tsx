import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileText,
  ListChecks,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useInspectionWorkspace } from '@/hooks/useInspectionData';
import type {
  FindingStatus,
  InspectionStatus,
  InspectionSummary,
  InspectionTemplateSummary,
} from '@/lib/supabase/inspectionEntities';
import { cn } from '@/lib/utils';
import CreateInspectionDialog from './inspections/CreateInspectionDialog';
import FindingCard from './inspections/FindingCard';
import InspectionActionsMenu from './inspections/InspectionActionsMenu';
import InspectionDetailView from './inspections/InspectionDetailView';
import { BuildingDialog, StairwellDialog, UnitDialog } from './inspections/RegistryDialogs';
import TemplateEditorDialog from './inspections/TemplateEditorDialog';
import {
  INSPECTION_TABS,
  formatDate,
  formatDateTime,
  inspectionStatusClasses,
  isFindingOpen,
  personName,
  projectName,
  todayIso,
  unitLabel,
} from './inspections/inspectionUi';

const INSPECTION_STATUSES: InspectionStatus[] = [
  'Luonnos',
  'Suunniteltu',
  'Käynnissä',
  'Puutteita havaittu',
  'Korjattavana',
  'Uusintatarkastus',
  'Hyväksyttävänä',
  'Hyväksytty',
  'Mitätöity',
];

const ATTENTION_STATUSES: InspectionStatus[] = [
  'Puutteita havaittu',
  'Korjattavana',
  'Uusintatarkastus',
  'Hyväksyttävänä',
];

type InspectionQuickFilter = 'all' | 'attention' | 'in-progress' | 'upcoming' | 'ready';

function inspectionIsOverdue(inspection: InspectionSummary, today: string): boolean {
  return Boolean(
    inspection.scheduledDate
    && inspection.scheduledDate < today
    && !['Hyväksytty', 'Mitätöity'].includes(inspection.status),
  );
}

function inspectionPriority(inspection: InspectionSummary, today: string): number {
  if (inspectionIsOverdue(inspection, today)) return 0;
  if (ATTENTION_STATUSES.includes(inspection.status)) return 1;
  if (inspection.status === 'Käynnissä') return 2;
  if (inspection.status === 'Suunniteltu') return 3;
  if (inspection.status === 'Luonnos') return 4;
  if (inspection.status === 'Hyväksytty') return 5;
  return 6;
}

function inspectionActionLabel(inspection: InspectionSummary): string {
  if (inspection.status === 'Hyväksytty') return 'Avaa raportti';
  if (inspection.status === 'Mitätöity') return 'Avaa tiedot';
  if (inspection.status === 'Hyväksyttävänä' || inspection.progress === 100) return 'Tarkista ja hyväksy';
  if (inspection.progress > 0) return 'Jatka tarkastusta';
  return 'Aloita tarkastus';
}

export default function Tarkastukset() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { currentOrg, currentRole } = useOrganization();
  const { projects } = useAppDataContext();
  const workspace = useInspectionWorkspace();
  const canManage = ['admin', 'supervisor', 'project_coordinator'].includes(currentRole ?? '');
  const projectFilterId = searchParams.get('project') ?? '';
  const projectFilter = projects.find((project) => project.id === projectFilterId);
  const canEditTemplates = currentRole === 'admin';
  const [tab, setTab] = useState(canManage ? 'overview' : 'findings');
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [quickFilter, setQuickFilter] = useState<InspectionQuickFilter>('all');
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [buildingOpen, setBuildingOpen] = useState(false);
  const [stairwellOpen, setStairwellOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<InspectionTemplateSummary | null>(null);

  useEffect(() => {
    if (!canManage && tab !== 'findings') setTab('findings');
  }, [canManage, tab]);

  useEffect(() => {
    setStatusFilter('all');
    setQuickFilter('all');
    setSearch('');
  }, [tab]);

  if (!currentOrg) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-text-secondary">
          Valitse organisaatio ennen tarkastusten käyttöä.
        </CardContent>
      </Card>
    );
  }

  if (selectedInspectionId) {
    return (
      <InspectionDetailView
        inspectionId={selectedInspectionId}
        canManage={canManage}
        currentRole={currentRole}
        organizationId={currentOrg.id}
        userId={user?.id}
        projects={projects}
        units={workspace.units}
        people={workspace.people}
        onBack={() => setSelectedInspectionId(null)}
        onWorkspaceRefresh={workspace.refresh}
      />
    );
  }

  const today = todayIso();
  const scopedInspections = workspace.inspections.filter((inspection) => (
    !projectFilterId || inspection.projectId === projectFilterId
  ));
  const activeFindings = workspace.findings.filter((finding) => (
    isFindingOpen(finding) && (!projectFilterId || finding.projectId === projectFilterId)
  ));
  const overdueFindings = activeFindings.filter((finding) => finding.dueDate && finding.dueDate < today);
  const criticalFindings = activeFindings.filter((finding) => finding.severity === 'Kriittinen');
  const pendingInspections = scopedInspections.filter((inspection) => (
    !['Hyväksytty', 'Mitätöity'].includes(inspection.status)
  ));
  const overdueInspections = pendingInspections.filter((inspection) => inspectionIsOverdue(inspection, today));
  const attentionInspections = pendingInspections.filter((inspection) => (
    inspectionIsOverdue(inspection, today) || ATTENTION_STATUSES.includes(inspection.status)
  ));
  const inProgressInspections = pendingInspections.filter((inspection) => (
    inspection.status === 'Käynnissä' || (inspection.progress > 0 && inspection.progress < 100)
  ));
  const readyForReview = pendingInspections.filter((inspection) => (
    inspection.progress === 100 || inspection.status === 'Hyväksyttävänä'
  ));
  const scopedUnits = workspace.units.filter((unit) => !projectFilterId || unit.projectId === projectFilterId);
  const readyUnits = scopedUnits.filter((unit) => unit.status === 'Luovutuskelpoinen');
  const upcomingInspections = pendingInspections.filter((inspection) => {
    if (!inspection.scheduledDate) return false;
    const date = new Date(`${inspection.scheduledDate}T12:00:00`);
    const start = new Date(`${today}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return date >= start && date <= end;
  });

  const prioritizedInspections = [...scopedInspections].sort((left, right) => {
    const priorityDifference = inspectionPriority(left, today) - inspectionPriority(right, today);
    if (priorityDifference !== 0) return priorityDifference;
    const leftDate = left.scheduledDate || '9999-12-31';
    const rightDate = right.scheduledDate || '9999-12-31';
    if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
    return right.createdAt.localeCompare(left.createdAt);
  });

  const inspectionQuery = search.trim().toLocaleLowerCase('fi');
  const filteredInspections = prioritizedInspections.filter((inspection) => {
    if (statusFilter !== 'all' && inspection.status !== statusFilter) return false;
    if (quickFilter === 'attention' && !attentionInspections.some((item) => item.id === inspection.id)) return false;
    if (quickFilter === 'in-progress' && !inProgressInspections.some((item) => item.id === inspection.id)) return false;
    if (quickFilter === 'upcoming' && !upcomingInspections.some((item) => item.id === inspection.id)) return false;
    if (quickFilter === 'ready' && !readyForReview.some((item) => item.id === inspection.id)) return false;
    const text = `${inspection.title} ${inspection.inspectionType} ${projectName(projects, inspection.projectId)} ${unitLabel(workspace.units, inspection.unitId)} ${personName(workspace.people, inspection.inspectorId)}`.toLocaleLowerCase('fi');
    return !inspectionQuery || text.includes(inspectionQuery);
  });

  const findingQuery = search.trim().toLocaleLowerCase('fi');
  const filteredFindings = workspace.findings
    .filter((finding) => {
      if (projectFilterId && finding.projectId !== projectFilterId) return false;
      if (statusFilter !== 'all' && finding.status !== statusFilter) return false;
      const text = `${finding.title} ${finding.description} ${finding.location} ${projectName(projects, finding.projectId)} ${unitLabel(workspace.units, finding.unitId)}`.toLocaleLowerCase('fi');
      return !findingQuery || text.includes(findingQuery);
    })
    .sort((left, right) => {
      const leftOverdue = Boolean(left.dueDate && left.dueDate < today && isFindingOpen(left));
      const rightOverdue = Boolean(right.dueDate && right.dueDate < today && isFindingOpen(right));
      if (leftOverdue !== rightOverdue) return leftOverdue ? -1 : 1;
      if (left.severity === 'Kriittinen' && right.severity !== 'Kriittinen') return -1;
      if (right.severity === 'Kriittinen' && left.severity !== 'Kriittinen') return 1;
      return (left.dueDate || '9999-12-31').localeCompare(right.dueDate || '9999-12-31');
    });

  const metricCards = [
    {
      label: 'Vaatii huomiota',
      value: attentionInspections.length,
      detail: `${overdueInspections.length} tarkastusta myöhässä`,
      icon: AlertTriangle,
      tab: 'inspections',
      filter: 'attention' as InspectionQuickFilter,
    },
    {
      label: 'Avoimet puutteet',
      value: activeFindings.length,
      detail: `${criticalFindings.length} kriittistä`,
      icon: ClipboardList,
      tab: 'findings',
    },
    {
      label: 'Korjaukset myöhässä',
      value: overdueFindings.length,
      detail: 'määräaika on ylitetty',
      icon: Clock3,
      tab: 'findings',
    },
    {
      label: 'Valmiina hyväksyntään',
      value: readyForReview.length,
      detail: `${readyUnits.length} luovutuskelpoista huoneistoa`,
      icon: FileCheck2,
      tab: 'inspections',
      filter: 'ready' as InspectionQuickFilter,
    },
  ];

  const quickFilters: Array<{ value: InspectionQuickFilter; label: string; count: number }> = [
    { value: 'all', label: 'Kaikki', count: scopedInspections.length },
    { value: 'attention', label: 'Vaatii huomiota', count: attentionInspections.length },
    { value: 'in-progress', label: 'Kesken', count: inProgressInspections.length },
    { value: 'upcoming', label: 'Seuraavat 7 päivää', count: upcomingInspections.length },
    { value: 'ready', label: 'Hyväksyttävänä', count: readyForReview.length },
  ];

  const filtersActive = Boolean(search || statusFilter !== 'all' || quickFilter !== 'all');
  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setQuickFilter('all');
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-hero text-text-primary">Tarkastukset</h1>
          <p className="mt-1 max-w-3xl text-body-sm text-text-secondary">
            Tee itselleluovutus, kirjaa puutteet ja vie kohde hallitusti hyväksyntään.
          </p>
          {projectFilter && (
            <Badge variant="outline" className="mt-3 max-w-full whitespace-normal">
              Rajattu projektiin: {projectFilter.name}
            </Badge>
          )}
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            variant="outline"
            size="icon"
            onClick={() => void workspace.refresh()}
            aria-label="Päivitä tarkastukset"
            disabled={workspace.refreshing}
          >
            <RefreshCw size={17} className={workspace.refreshing ? 'animate-spin' : ''} />
          </Button>
          {canManage && (
            <Button onClick={() => setInspectionOpen(true)} className="flex-1 sm:flex-none">
              <Plus size={17} className="mr-2" /> Uusi tarkastus
            </Button>
          )}
        </div>
      </div>

      {workspace.error && (
        <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" /> {workspace.error}
        </div>
      )}
      {(workspace.loading || workspace.refreshing) && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
          <Loader2 size={16} className="animate-spin" />
          {workspace.loading ? 'Ladataan tarkastuksia…' : 'Päivitetään tarkastuksia…'}
        </div>
      )}

      {canManage && !workspace.loading && (
        <div className={cn(
          'flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between',
          attentionInspections.length > 0
            ? 'border-amber-200 bg-amber-50/70'
            : 'border-emerald-200 bg-emerald-50/70',
        )}>
          <div className="flex min-w-0 items-start gap-3">
            <span className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              attentionInspections.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700',
            )}>
              {attentionInspections.length > 0 ? <AlertTriangle size={19} /> : <CheckCircle2 size={19} />}
            </span>
            <div>
              <p className="font-semibold text-text-primary">
                {attentionInspections.length > 0
                  ? `${attentionInspections.length} tarkastusta vaatii toimenpiteen`
                  : 'Tarkastusten tilanne on hallinnassa'}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                {attentionInspections.length > 0
                  ? `${overdueInspections.length} myöhässä ja ${readyForReview.length} valmiina tarkistettavaksi.`
                  : `${upcomingInspections.length} tarkastusta on suunniteltu seuraavalle seitsemälle päivälle.`}
              </p>
            </div>
          </div>
          <Button
            variant={attentionInspections.length > 0 ? 'default' : 'outline'}
            onClick={() => {
              setTab('inspections');
              setQuickFilter(attentionInspections.length > 0 ? 'attention' : 'upcoming');
            }}
            className="w-full sm:w-auto"
          >
            Avaa työjono <ArrowRight size={16} className="ml-2" />
          </Button>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList className="inline-flex h-auto min-w-max gap-1 rounded-xl border border-slate-200 bg-white p-1 sm:grid sm:min-w-full sm:grid-cols-3 lg:grid-cols-6">
            {INSPECTION_TABS
              .filter((item) => canManage || item.value === 'findings')
              .map((item) => (
                <TabsTrigger key={item.value} value={item.value} className="min-w-32 whitespace-nowrap px-4 py-2 sm:min-w-0">
                  {item.label}
                </TabsTrigger>
              ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-5 space-y-5">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {metricCards.map((item) => (
              <button
                key={item.label}
                type="button"
                className="min-w-0 text-left"
                onClick={() => {
                  setTab(item.tab);
                  if (item.filter) setQuickFilter(item.filter);
                }}
              >
                <Card className="h-full transition hover:border-primary/30 hover:shadow-md">
                  <CardContent className="p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-light">
                        <item.icon size={18} className="text-primary" />
                      </div>
                      <ArrowRight size={15} className="text-text-muted" />
                    </div>
                    <p className="font-mono text-2xl font-bold sm:text-3xl">{item.value}</p>
                    <p className="mt-0.5 text-sm font-semibold sm:text-base">{item.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-text-secondary">{item.detail}</p>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ClipboardCheck size={18} /> Seuraavat tehtävät
                  </CardTitle>
                  <p className="mt-1 text-sm text-text-secondary">Tarkastukset kiireellisimmästä alkaen.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setTab('inspections')}>
                  Kaikki <ArrowRight size={14} className="ml-1" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {prioritizedInspections.filter((inspection) => !['Hyväksytty', 'Mitätöity'].includes(inspection.status)).slice(0, 6).map((inspection) => {
                  const overdue = inspectionIsOverdue(inspection, today);
                  return (
                    <button
                      key={inspection.id}
                      type="button"
                      onClick={() => setSelectedInspectionId(inspection.id)}
                      className="w-full rounded-xl border p-3 text-left transition hover:border-primary/30 hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 break-words">
                          <div className="flex flex-wrap items-center gap-2">
                            {overdue && <Badge className="border-0 bg-red-50 text-red-700">Myöhässä</Badge>}
                            <Badge className={cn('border-0', inspectionStatusClasses(inspection.status))}>{inspection.status}</Badge>
                          </div>
                          <p className="mt-2 font-semibold">{inspection.title}</p>
                          <p className="mt-1 text-xs text-text-secondary">
                            {projectName(projects, inspection.projectId)} · {unitLabel(workspace.units, inspection.unitId)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={cn('text-xs font-medium', overdue && 'text-red-700')}>
                            {formatDate(inspection.scheduledDate)}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-primary">{inspectionActionLabel(inspection)}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <Progress value={inspection.progress} className="h-1.5 flex-1" />
                        <span className="text-xs font-bold">{inspection.progress}%</span>
                      </div>
                    </button>
                  );
                })}
                {pendingInspections.length === 0 && (
                  <div className="py-8 text-center">
                    <CheckCircle2 size={28} className="mx-auto text-emerald-600" />
                    <p className="mt-3 font-semibold">Ei avoimia tarkastuksia</p>
                    <p className="mt-1 text-sm text-text-secondary">Kaikki tarkastukset on hyväksytty tai mitätöity.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle size={18} /> Kiireelliset puutteet
                </CardTitle>
                <p className="mt-1 text-sm text-text-secondary">Kriittiset ja määräajan ylittäneet korjaukset.</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {[...criticalFindings, ...overdueFindings.filter((item) => item.severity !== 'Kriittinen')]
                  .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index)
                  .slice(0, 7)
                  .map((finding) => (
                    <button
                      key={finding.id}
                      type="button"
                      onClick={() => setSelectedInspectionId(finding.inspectionId)}
                      className="flex w-full items-start gap-3 rounded-xl border p-3 text-left transition hover:border-primary/30 hover:bg-slate-50"
                    >
                      <span className={cn(
                        'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
                        finding.severity === 'Kriittinen' ? 'bg-red-500' : 'bg-amber-500',
                      )} />
                      <div className="min-w-0 break-words">
                        <p className="font-semibold">{finding.title}</p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {projectName(projects, finding.projectId)} · {unitLabel(workspace.units, finding.unitId)} · {formatDate(finding.dueDate)}
                        </p>
                      </div>
                    </button>
                  ))}
                {criticalFindings.length + overdueFindings.length === 0 && (
                  <div className="py-8 text-center">
                    <CheckCircle2 size={28} className="mx-auto text-emerald-600" />
                    <p className="mt-3 font-semibold">Ei kiireellisiä puutteita</p>
                    <p className="mt-1 text-sm text-text-secondary">Luovutusta estäviä määräaikapoikkeamia ei ole.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="inspections" className="mt-5 space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {quickFilters.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setQuickFilter(item.value)}
                className={cn(
                  'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition',
                  quickFilter === item.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-slate-200 bg-white text-text-secondary hover:border-primary/30 hover:text-text-primary',
                )}
              >
                {item.label}
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-xs',
                  quickFilter === item.value ? 'bg-white/20' : 'bg-slate-100 text-text-primary',
                )}>
                  {item.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 lg:flex-row">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
                placeholder="Hae tarkastusta, projektia, kohdetta tai tarkastajaa…"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Kaikki tarkastustilat</SelectItem>
                {INSPECTION_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
              </SelectContent>
            </Select>
            {filtersActive && (
              <Button variant="ghost" onClick={clearFilters} className="w-full lg:w-auto">
                <X size={16} className="mr-2" /> Tyhjennä rajaukset
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 text-sm text-text-secondary">
            <p>{filteredInspections.length} tarkastusta</p>
            <span className="hidden items-center gap-1 sm:flex"><SlidersHorizontal size={14} /> Kiireellisimmät ensin</span>
          </div>

          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {filteredInspections.map((inspection) => {
              const openFindingCount = activeFindings.filter((finding) => finding.inspectionId === inspection.id).length;
              const overdue = inspectionIsOverdue(inspection, today);
              return (
                <Card key={inspection.id} className={cn(
                  'relative overflow-hidden transition hover:border-primary/30 hover:shadow-md',
                  overdue && 'border-red-200',
                )}>
                  <button
                    type="button"
                    onClick={() => setSelectedInspectionId(inspection.id)}
                    className="block h-full w-full text-left"
                  >
                    <CardContent className="flex h-full flex-col p-5 pr-14">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                          overdue ? 'bg-red-50 text-red-700' : 'bg-primary-light text-primary',
                        )}>
                          <ClipboardList size={18} />
                        </div>
                        <div className="min-w-0 flex-1 break-words">
                          <div className="flex flex-wrap items-center gap-2">
                            {overdue && <Badge className="border-0 bg-red-50 text-red-700">Myöhässä</Badge>}
                            <Badge className={cn('border-0', inspectionStatusClasses(inspection.status))}>{inspection.status}</Badge>
                          </div>
                          <h3 className="mt-3 font-semibold">{inspection.title}</h3>
                          <p className="mt-1 text-sm text-text-secondary">
                            {projectName(projects, inspection.projectId)} · {unitLabel(workspace.units, inspection.unitId)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-text-secondary">
                        <div>
                          <p className="text-text-muted">Tarkastuspäivä</p>
                          <p className={cn('mt-0.5 font-medium text-text-primary', overdue && 'text-red-700')}>
                            {formatDate(inspection.scheduledDate)}
                          </p>
                        </div>
                        <div>
                          <p className="text-text-muted">Tarkastaja</p>
                          <p className="mt-0.5 break-words font-medium text-text-primary">
                            {personName(workspace.people, inspection.inspectorId)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-xs">
                        <span>{inspection.progress === 100 ? 'Kaikki kohdat käsitelty' : 'Tarkastuksen eteneminen'}</span>
                        <strong>{inspection.progress}%</strong>
                      </div>
                      <Progress value={inspection.progress} className="mt-1.5 h-2" />

                      <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-100 pt-3 text-xs">
                        <div className="min-w-0 text-text-secondary">
                          <p className="truncate">{inspection.inspectionType}</p>
                          <p className={cn('mt-1', openFindingCount ? 'font-semibold text-amber-800' : '')}>
                            {openFindingCount} avointa puutetta
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold text-primary">
                          {inspectionActionLabel(inspection)} <ArrowRight size={14} className="ml-1 inline" />
                        </span>
                      </div>
                    </CardContent>
                  </button>
                  <div className="absolute right-2 top-2">
                    <InspectionActionsMenu
                      inspectionId={inspection.id}
                      title={inspection.title}
                      status={inspection.status}
                      canManage={canManage}
                      onOpen={() => setSelectedInspectionId(inspection.id)}
                      onRemoved={workspace.refresh}
                    />
                  </div>
                </Card>
              );
            })}
            {filteredInspections.length === 0 && (
              <Card className="lg:col-span-2 xl:col-span-3">
                <CardContent className="p-10 text-center">
                  <Search size={30} className="mx-auto text-text-muted" />
                  <p className="mt-3 font-semibold">Tarkastuksia ei löytynyt</p>
                  <p className="mt-1 text-sm text-text-secondary">Muuta hakua tai poista rajauksia.</p>
                  {filtersActive && <Button variant="outline" className="mt-4" onClick={clearFilters}>Näytä kaikki tarkastukset</Button>}
                  {!filtersActive && canManage && <Button className="mt-4" onClick={() => setInspectionOpen(true)}><Plus size={16} className="mr-2" />Luo ensimmäinen tarkastus</Button>}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="findings" className="mt-5 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Hae puutetta, sijaintia tai kohdetta…" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Kaikki puutetilat</SelectItem>
                {(['Avoin', 'Osoitettu', 'Työn alla', 'Ilmoitettu korjatuksi', 'Odottaa uusintatarkastusta', 'Hyväksytty', 'Hylätty', 'Mitätöity'] as FindingStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            {filteredFindings.map((finding) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                canManage={canManage}
                organizationId={currentOrg.id}
                userId={user?.id}
                project={projectName(projects, finding.projectId)}
                unit={unitLabel(workspace.units, finding.unitId)}
                assignee={finding.contractorName || personName(workspace.people, finding.assigneeUserId)}
                onRefresh={workspace.refresh}
                onOpenInspection={() => setSelectedInspectionId(finding.inspectionId)}
              />
            ))}
            {filteredFindings.length === 0 && (
              <Card>
                <CardContent className="p-10 text-center">
                  <CheckCircle2 size={30} className="mx-auto text-emerald-600" />
                  <p className="mt-3 font-semibold">Ei näytettäviä puutteita</p>
                  <p className="mt-1 text-sm text-text-secondary">Hakuehtoihin sopivia puutteita ei ole.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="units" className="mt-5 space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Kohderekisteri</h2>
              <p className="mt-1 text-sm text-text-secondary">Rakennukset, raput ja huoneistot muodostavat tarkastusten kohdehierarkian.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setBuildingOpen(true)}><Building2 size={16} className="mr-2" />Lisää rakennus</Button>
              <Button variant="outline" onClick={() => setStairwellOpen(true)}>Lisää rappu</Button>
              <Button onClick={() => setUnitOpen(true)}><Plus size={16} className="mr-2" />Lisää huoneisto</Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {scopedUnits.map((unit) => {
              const openCount = activeFindings.filter((finding) => finding.unitId === unit.id).length;
              return (
                <Card key={unit.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold">{unit.unitCode}</h3>
                        <p className="text-sm text-text-secondary">{projectName(projects, unit.projectId)}</p>
                      </div>
                      <Badge variant="outline">{unit.status}</Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div><p className="text-text-muted">Tyyppi</p><p className="font-medium">{unit.unitType || '—'}</p></div>
                      <div><p className="text-text-muted">Pinta-ala</p><p className="font-medium">{unit.areaM2 ? `${unit.areaM2} m²` : '—'}</p></div>
                      <div><p className="text-text-muted">Avoimet puutteet</p><p className={cn('font-medium', openCount > 0 && 'text-amber-800')}>{openCount}</p></div>
                      <div><p className="text-text-muted">Valmistuminen</p><p className="font-medium">{formatDate(unit.plannedCompletionDate)}</p></div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {scopedUnits.length === 0 && (
              <Card className="sm:col-span-2 xl:col-span-4">
                <CardContent className="p-10 text-center">
                  <Building2 size={30} className="mx-auto text-text-muted" />
                  <p className="mt-3 font-semibold">Kohderekisteri on tyhjä</p>
                  <p className="mt-1 text-sm text-text-secondary">Lisää ensin rakennus tai suoraan tarkastettava huoneisto.</p>
                  <Button className="mt-4" onClick={() => setUnitOpen(true)}><Plus size={16} className="mr-2" />Lisää huoneisto</Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="templates" className="mt-5 space-y-4">
          <Card className="border-blue-100 bg-blue-50/50">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary"><Settings2 size={19} /></div>
                <div>
                  <h2 className="font-semibold">Tarkastuspohjat ja tarkastuskohdat</h2>
                  <p className="mt-1 text-sm text-text-secondary">Muokkaa osioita, selkeitä tarkastuskysymyksiä, työohjeita ja puutekuvan vaatimuksia. Uusi versio ei muuta aiempia tarkastuksia.</p>
                </div>
              </div>
              {canEditTemplates && (
                <Button onClick={() => { setEditingTemplate(null); setTemplateOpen(true); }}>
                  <Plus size={16} className="mr-2" /> Luo tarkastuspohja
                </Button>
              )}
            </CardContent>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {workspace.templates.map((template) => (
              <Card key={template.id}>
                <CardContent className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light"><ListChecks size={18} className="text-primary" /></div>
                    <div className="flex gap-2"><Badge variant="outline">v{template.version}</Badge>{template.system && <Badge className="border-0 bg-blue-50 text-blue-700">VaKantti</Badge>}</div>
                  </div>
                  <h3 className="mt-4 font-semibold">{template.name}</h3>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-text-muted">{template.category}</p>
                  <p className="mt-2 flex-1 text-sm text-text-secondary">{template.description}</p>
                  {canEditTemplates && (
                    <Button variant="outline" size="sm" className="mt-4 w-fit" onClick={() => { setEditingTemplate(template); setTemplateOpen(true); }}>
                      {template.system ? 'Mukauta omaan käyttöön' : 'Muokkaa tarkastuskohtia'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="reports" className="mt-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {workspace.reports.map((report) => {
              const inspection = workspace.inspections.find((item) => item.id === report.inspectionId);
              return (
                <Card key={report.id}>
                  <CardContent className="flex h-full flex-col p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50"><FileText size={18} className="text-emerald-700" /></div>
                      <Badge variant="outline">Versio {report.version}</Badge>
                    </div>
                    <h3 className="mt-4 font-semibold">{inspection?.title ?? 'Hyväksytty tarkastus'}</h3>
                    <p className="mt-1 flex-1 text-sm text-text-secondary">{inspection ? `${projectName(projects, inspection.projectId)} · ${unitLabel(workspace.units, inspection.unitId)}` : 'Arkistoitu raportti'}</p>
                    <p className="mt-3 text-xs text-text-muted">Muodostettu {formatDateTime(report.generatedAt)}</p>
                    <Button variant="outline" size="sm" className="mt-4 w-fit" onClick={() => setSelectedInspectionId(report.inspectionId)}><Printer size={15} className="mr-2" />Avaa ja tulosta PDF</Button>
                  </CardContent>
                </Card>
              );
            })}
            {workspace.reports.length === 0 && (
              <Card className="sm:col-span-2 xl:col-span-3">
                <CardContent className="p-10 text-center">
                  <FileText size={30} className="mx-auto text-text-muted" />
                  <p className="mt-3 font-semibold">Hyväksyttyjä raportteja ei ole vielä</p>
                  <p className="mt-1 text-sm text-text-secondary">Raporttiversio muodostuu, kun tarkastus hyväksytään.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <CreateInspectionDialog
        open={inspectionOpen}
        organizationId={currentOrg.id}
        currentUserId={user?.id}
        projects={projects}
        templates={workspace.templates}
        units={workspace.units}
        people={workspace.people}
        onClose={() => setInspectionOpen(false)}
        onCreated={async (ids) => {
          await workspace.refresh();
          if (ids.length === 1) setSelectedInspectionId(ids[0]);
        }}
      />
      <BuildingDialog open={buildingOpen} organizationId={currentOrg.id} currentUserId={user?.id} projects={projects} onSaved={workspace.refresh} onClose={() => setBuildingOpen(false)} />
      <StairwellDialog open={stairwellOpen} organizationId={currentOrg.id} currentUserId={user?.id} projects={projects} buildings={workspace.buildings} onSaved={workspace.refresh} onClose={() => setStairwellOpen(false)} />
      <UnitDialog open={unitOpen} organizationId={currentOrg.id} currentUserId={user?.id} projects={projects} buildings={workspace.buildings} stairwells={workspace.stairwells} people={workspace.people} onSaved={workspace.refresh} onClose={() => setUnitOpen(false)} />
      <TemplateEditorDialog open={templateOpen} organizationId={currentOrg.id} template={editingTemplate} onPublished={workspace.refresh} onClose={() => setTemplateOpen(false)} />
    </div>
  );
}
