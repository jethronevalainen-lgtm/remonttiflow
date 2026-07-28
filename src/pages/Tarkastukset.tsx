import { useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowRight, Building2, ClipboardCheck, ClipboardList, Clock3,
  FileCheck2, FileText, ListChecks, Loader2, Plus, Printer, RefreshCw, Search,
  Settings2,
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
import type { FindingStatus, InspectionStatus, InspectionTemplateSummary } from '@/lib/supabase/inspectionEntities';
import { cn } from '@/lib/utils';
import CreateInspectionDialog from './inspections/CreateInspectionDialog';
import FindingCard from './inspections/FindingCard';
import InspectionActionsMenu from './inspections/InspectionActionsMenu';
import InspectionDetailView from './inspections/InspectionDetailView';
import { BuildingDialog, StairwellDialog, UnitDialog } from './inspections/RegistryDialogs';
import TemplateEditorDialog from './inspections/TemplateEditorDialog';
import {
  INSPECTION_TABS, formatDate, formatDateTime, inspectionStatusClasses,
  isFindingOpen, personName, projectName, todayIso, unitLabel,
} from './inspections/inspectionUi';

const INSPECTION_STATUSES: InspectionStatus[] = [
  'Luonnos', 'Suunniteltu', 'Käynnissä', 'Puutteita havaittu', 'Korjattavana',
  'Uusintatarkastus', 'Hyväksyttävänä', 'Hyväksytty', 'Mitätöity',
];

export default function Tarkastukset() {
  const { user } = useAuth();
  const { currentOrg, currentRole } = useOrganization();
  const { projects } = useAppDataContext();
  const workspace = useInspectionWorkspace();
  const canManage = ['admin', 'supervisor', 'project_coordinator'].includes(currentRole ?? '');
  const canEditTemplates = currentRole === 'admin';
  const [tab, setTab] = useState(canManage ? 'overview' : 'findings');
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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
    setSearch('');
  }, [tab]);

  if (!currentOrg) {
    return <Card><CardContent className="p-6 text-sm text-text-secondary">Valitse organisaatio ennen tarkastusten käyttöä.</CardContent></Card>;
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

  const activeFindings = workspace.findings.filter(isFindingOpen);
  const overdueFindings = activeFindings.filter((finding) => finding.dueDate && finding.dueDate < todayIso());
  const criticalFindings = activeFindings.filter((finding) => finding.severity === 'Kriittinen');
  const pendingInspections = workspace.inspections.filter((inspection) => !['Hyväksytty', 'Mitätöity'].includes(inspection.status));
  const readyUnits = workspace.units.filter((unit) => unit.status === 'Luovutuskelpoinen');
  const upcomingInspections = workspace.inspections.filter((inspection) => {
    if (!inspection.scheduledDate) return false;
    const date = new Date(`${inspection.scheduledDate}T12:00:00`);
    const today = new Date(`${todayIso()}T00:00:00`);
    const end = new Date(today);
    end.setDate(end.getDate() + 7);
    return date >= today && date <= end;
  });

  const inspectionQuery = search.trim().toLocaleLowerCase('fi');
  const filteredInspections = workspace.inspections.filter((inspection) => {
    if (statusFilter !== 'all' && inspection.status !== statusFilter) return false;
    const text = `${inspection.title} ${inspection.inspectionType} ${projectName(projects, inspection.projectId)} ${unitLabel(workspace.units, inspection.unitId)} ${personName(workspace.people, inspection.inspectorId)}`.toLocaleLowerCase('fi');
    return !inspectionQuery || text.includes(inspectionQuery);
  });

  const findingQuery = search.trim().toLocaleLowerCase('fi');
  const filteredFindings = workspace.findings.filter((finding) => {
    if (statusFilter !== 'all' && finding.status !== statusFilter) return false;
    const text = `${finding.title} ${finding.description} ${finding.location} ${projectName(projects, finding.projectId)} ${unitLabel(workspace.units, finding.unitId)}`.toLocaleLowerCase('fi');
    return !findingQuery || text.includes(findingQuery);
  });

  const metricCards = [
    { label: 'Avoimet tarkastukset', value: pendingInspections.length, detail: `${upcomingInspections.length} seuraavan 7 päivän aikana`, icon: ClipboardList, tab: 'inspections' },
    { label: 'Avoimet puutteet', value: activeFindings.length, detail: `${criticalFindings.length} kriittistä`, icon: AlertTriangle, tab: 'findings' },
    { label: 'Myöhässä', value: overdueFindings.length, detail: 'korjauksen määräaika ylitetty', icon: Clock3, tab: 'findings' },
    { label: 'Luovutuskelpoiset', value: readyUnits.length, detail: `${workspace.units.length} huoneistoa rekisterissä`, icon: FileCheck2, tab: 'units' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-hero text-text-primary">Tarkastukset ja itselleluovutukset</h1>
          <p className="mt-1 max-w-3xl text-body-sm text-text-secondary">Tarkasta työ, kirjaa puutteet, dokumentoi luovutus ja hyväksy raportti samassa prosessissa.</p>
        </div>
        {canManage && <Button onClick={() => setInspectionOpen(true)} className="w-full sm:w-auto"><Plus size={17} className="mr-2" />Uusi tarkastus</Button>}
      </div>

      {workspace.error && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertTriangle size={17} className="shrink-0" />{workspace.error}</div>}
      {(workspace.loading || workspace.refreshing) && <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800"><Loader2 size={16} className="animate-spin" />{workspace.loading ? 'Ladataan tarkastuksia…' : 'Päivitetään tarkastuksia…'}</div>}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
          {INSPECTION_TABS.filter((item) => canManage || item.value === 'findings').map((item) => <TabsTrigger key={item.value} value={item.value} className="whitespace-nowrap px-4 py-2">{item.label}</TabsTrigger>)}
        </TabsList>

        <TabsContent value="overview" className="mt-5 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metricCards.map((item) => (
              <button key={item.label} type="button" className="text-left" onClick={() => setTab(item.tab)}>
                <Card className="h-full transition-shadow hover:shadow-md"><CardContent className="p-5"><div className="mb-4 flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light"><item.icon size={19} className="text-primary" /></div><ArrowRight size={16} className="text-text-muted" /></div><p className="font-mono text-3xl font-bold">{item.value}</p><p className="font-semibold">{item.label}</p><p className="mt-1 text-xs text-text-secondary">{item.detail}</p></CardContent></Card>
              </button>
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2 text-lg"><ClipboardCheck size={18} />Seuraavat tarkastukset</CardTitle><Button variant="ghost" size="sm" onClick={() => setTab('inspections')}>Kaikki <ArrowRight size={14} className="ml-1" /></Button></CardHeader>
              <CardContent className="space-y-2">
                {upcomingInspections.slice(0, 6).map((inspection) => <button key={inspection.id} type="button" onClick={() => setSelectedInspectionId(inspection.id)} className="w-full rounded-xl border p-3 text-left hover:bg-slate-50"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{inspection.title}</p><p className="mt-1 text-xs text-text-secondary">{projectName(projects, inspection.projectId)} · {unitLabel(workspace.units, inspection.unitId)}</p></div><div className="text-right"><Badge className={cn('border-0', inspectionStatusClasses(inspection.status))}>{inspection.status}</Badge><p className="mt-1 text-xs">{formatDate(inspection.scheduledDate)}</p></div></div><Progress value={inspection.progress} className="mt-3 h-1.5" /></button>)}
                {upcomingInspections.length === 0 && <p className="py-8 text-center text-sm text-text-secondary">Ei tarkastuksia seuraavan seitsemän päivän aikana.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><AlertTriangle size={18} />Kiireelliset puutteet</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {[...criticalFindings, ...overdueFindings.filter((item) => item.severity !== 'Kriittinen')].slice(0, 7).map((finding) => <button key={finding.id} type="button" onClick={() => setSelectedInspectionId(finding.inspectionId)} className="flex w-full items-start gap-3 rounded-xl border p-3 text-left hover:bg-slate-50"><span className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', finding.severity === 'Kriittinen' ? 'bg-red-500' : 'bg-amber-500')} /><div className="min-w-0"><p className="truncate font-semibold">{finding.title}</p><p className="mt-1 text-xs text-text-secondary">{projectName(projects, finding.projectId)} · {unitLabel(workspace.units, finding.unitId)} · {formatDate(finding.dueDate)}</p></div></button>)}
                {criticalFindings.length + overdueFindings.length === 0 && <p className="py-8 text-center text-sm text-text-secondary">Ei kiireellisiä tarkastuspuutteita.</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="inspections" className="mt-5 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Hae nimellä, kohteella tai tarkastajalla…" /></div>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Kaikki tilat</SelectItem>{INSPECTION_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select>
            <Button variant="outline" size="icon" onClick={() => void workspace.refresh()} aria-label="Päivitä tarkastukset"><RefreshCw size={16} /></Button>
          </div>

          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {filteredInspections.map((inspection) => {
              const openFindingCount = activeFindings.filter((finding) => finding.inspectionId === inspection.id).length;
              return (
                <Card key={inspection.id} className="relative overflow-hidden transition-shadow hover:shadow-md">
                  <button type="button" onClick={() => setSelectedInspectionId(inspection.id)} className="block w-full text-left">
                    <CardContent className="p-5 pr-14">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light"><ClipboardList size={18} className="text-primary" /></div>
                        <div className="min-w-0 flex-1"><Badge className={cn('border-0', inspectionStatusClasses(inspection.status))}>{inspection.status}</Badge><h3 className="mt-3 truncate font-semibold">{inspection.title}</h3><p className="mt-1 truncate text-sm text-text-secondary">{projectName(projects, inspection.projectId)} · {unitLabel(workspace.units, inspection.unitId)}</p></div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-text-secondary">
                        <div><p className="text-text-muted">Päivä</p><p className="mt-0.5 font-medium text-text-primary">{formatDate(inspection.scheduledDate)}</p></div>
                        <div><p className="text-text-muted">Tarkastaja</p><p className="mt-0.5 truncate font-medium text-text-primary">{personName(workspace.people, inspection.inspectorId)}</p></div>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-xs"><span>{inspection.progress === 100 ? 'Kaikki kohdat käsitelty' : 'Tarkastuskohdat'}</span><strong>{inspection.progress}%</strong></div>
                      <Progress value={inspection.progress} className="mt-1.5 h-2" />
                      <div className="mt-3 flex items-center justify-between text-xs text-text-secondary"><span>{inspection.inspectionType}</span><span className={openFindingCount ? 'font-semibold text-amber-800' : ''}>{openFindingCount} avointa puutetta</span></div>
                    </CardContent>
                  </button>
                  <div className="absolute right-2 top-2">
                    <InspectionActionsMenu inspectionId={inspection.id} title={inspection.title} status={inspection.status} canManage={canManage} onOpen={() => setSelectedInspectionId(inspection.id)} onRemoved={workspace.refresh} />
                  </div>
                </Card>
              );
            })}
            {filteredInspections.length === 0 && <Card className="lg:col-span-2 xl:col-span-3"><CardContent className="p-10 text-center text-sm text-text-secondary">Hakuehdoilla ei löytynyt tarkastuksia.</CardContent></Card>}
          </div>
        </TabsContent>

        <TabsContent value="findings" className="mt-5 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Hae puutteita…" /></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Kaikki tilat</SelectItem>{(['Avoin', 'Osoitettu', 'Työn alla', 'Ilmoitettu korjatuksi', 'Odottaa uusintatarkastusta', 'Hyväksytty', 'Hylätty', 'Mitätöity'] as FindingStatus[]).map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-3">{filteredFindings.map((finding) => <FindingCard key={finding.id} finding={finding} canManage={canManage} organizationId={currentOrg.id} userId={user?.id} project={projectName(projects, finding.projectId)} unit={unitLabel(workspace.units, finding.unitId)} assignee={finding.contractorName || personName(workspace.people, finding.assigneeUserId)} onRefresh={workspace.refresh} onOpenInspection={() => setSelectedInspectionId(finding.inspectionId)} />)}{filteredFindings.length === 0 && <Card><CardContent className="p-10 text-center text-sm text-text-secondary">Ei näytettäviä puutteita.</CardContent></Card>}</div>
        </TabsContent>

        <TabsContent value="units" className="mt-5 space-y-4">
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setBuildingOpen(true)}><Building2 size={16} className="mr-2" />Lisää rakennus</Button><Button variant="outline" onClick={() => setStairwellOpen(true)}>Lisää rappu</Button><Button onClick={() => setUnitOpen(true)}><Plus size={16} className="mr-2" />Lisää huoneisto</Button></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{workspace.units.map((unit) => { const openCount = activeFindings.filter((finding) => finding.unitId === unit.id).length; return <Card key={unit.id}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold">{unit.unitCode}</h3><p className="text-sm text-text-secondary">{projectName(projects, unit.projectId)}</p></div><Badge variant="outline">{unit.status}</Badge></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-text-muted">Tyyppi</p><p className="font-medium">{unit.unitType || '—'}</p></div><div><p className="text-text-muted">Pinta-ala</p><p className="font-medium">{unit.areaM2 ? `${unit.areaM2} m²` : '—'}</p></div><div><p className="text-text-muted">Avoimet puutteet</p><p className="font-medium">{openCount}</p></div><div><p className="text-text-muted">Valmistuminen</p><p className="font-medium">{formatDate(unit.plannedCompletionDate)}</p></div></div></CardContent></Card>; })}{workspace.units.length === 0 && <Card className="sm:col-span-2 xl:col-span-4"><CardContent className="p-10 text-center text-sm text-text-secondary">Huoneistorekisteri on tyhjä.</CardContent></Card>}</div>
        </TabsContent>

        <TabsContent value="templates" className="mt-5 space-y-4">
          <Card className="border-blue-100 bg-blue-50/50"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary"><Settings2 size={19} /></div><div><h2 className="font-semibold">Tarkastuskysymysten asetukset</h2><p className="mt-1 text-sm text-text-secondary">Muokkaa osioita, kysymyksiä, ohjetekstejä ja kuvavaatimuksia. Muutos julkaistaan uutena versiona eikä muuta vanhoja tarkastuksia.</p></div></div>{canEditTemplates && <Button onClick={() => { setEditingTemplate(null); setTemplateOpen(true); }}><Plus size={16} className="mr-2" />Luo tarkastuspohja</Button>}</CardContent></Card>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {workspace.templates.map((template) => (
              <Card key={template.id}><CardContent className="p-5"><div className="flex items-start justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light"><ListChecks size={18} className="text-primary" /></div><div className="flex gap-2"><Badge variant="outline">v{template.version}</Badge>{template.system && <Badge className="border-0 bg-blue-50 text-blue-700">VaKantti</Badge>}</div></div><h3 className="mt-4 font-semibold">{template.name}</h3><p className="mt-1 text-xs font-medium uppercase tracking-wide text-text-muted">{template.category}</p><p className="mt-2 min-h-10 text-sm text-text-secondary">{template.description}</p>{canEditTemplates && <Button variant="outline" size="sm" className="mt-4" onClick={() => { setEditingTemplate(template); setTemplateOpen(true); }}>{template.system ? 'Mukauta omaan käyttöön' : 'Muokkaa kysymyksiä'}</Button>}</CardContent></Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="reports" className="mt-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{workspace.reports.map((report) => { const inspection = workspace.inspections.find((item) => item.id === report.inspectionId); return <Card key={report.id}><CardContent className="p-5"><div className="flex items-start justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50"><FileText size={18} className="text-emerald-700" /></div><Badge variant="outline">Versio {report.version}</Badge></div><h3 className="mt-4 font-semibold">{inspection?.title ?? 'Hyväksytty tarkastus'}</h3><p className="mt-1 text-sm text-text-secondary">{inspection ? `${projectName(projects, inspection.projectId)} · ${unitLabel(workspace.units, inspection.unitId)}` : 'Arkistoitu raportti'}</p><p className="mt-2 text-xs text-text-muted">Muodostettu {formatDateTime(report.generatedAt)}</p><Button variant="outline" size="sm" className="mt-4" onClick={() => setSelectedInspectionId(report.inspectionId)}><Printer size={15} className="mr-2" />Avaa ja tulosta PDF</Button></CardContent></Card>; })}{workspace.reports.length === 0 && <Card className="sm:col-span-2 xl:col-span-3"><CardContent className="p-10 text-center text-sm text-text-secondary">Hyväksyttyjä raporttiversioita ei ole vielä.</CardContent></Card>}</div>
        </TabsContent>
      </Tabs>

      <CreateInspectionDialog open={inspectionOpen} organizationId={currentOrg.id} currentUserId={user?.id} projects={projects} templates={workspace.templates} units={workspace.units} people={workspace.people} onClose={() => setInspectionOpen(false)} onCreated={async (ids) => { await workspace.refresh(); if (ids.length === 1) setSelectedInspectionId(ids[0]); }} />
      <BuildingDialog open={buildingOpen} organizationId={currentOrg.id} currentUserId={user?.id} projects={projects} onSaved={workspace.refresh} onClose={() => setBuildingOpen(false)} />
      <StairwellDialog open={stairwellOpen} organizationId={currentOrg.id} currentUserId={user?.id} projects={projects} buildings={workspace.buildings} onSaved={workspace.refresh} onClose={() => setStairwellOpen(false)} />
      <UnitDialog open={unitOpen} organizationId={currentOrg.id} currentUserId={user?.id} projects={projects} buildings={workspace.buildings} stairwells={workspace.stairwells} people={workspace.people} onSaved={workspace.refresh} onClose={() => setUnitOpen(false)} />
      <TemplateEditorDialog open={templateOpen} organizationId={currentOrg.id} template={editingTemplate} onPublished={workspace.refresh} onClose={() => setTemplateOpen(false)} />
    </div>
  );
}
