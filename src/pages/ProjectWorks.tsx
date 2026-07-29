import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  FileText,
  FolderKanban,
  Layers3,
  Loader2,
  LockKeyhole,
  MapPin,
  Pencil,
  Plus,
  Search,
  UserRound,
  UsersRound,
  Wrench,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import {
  loadProjectWorkPlans,
  type ProjectWorkPlanSummary,
} from '@/lib/supabase/projectWorkPlans';
import type { ManagedWorkOrder } from '@/lib/supabase/workManagement';
import type { WorkOrderStatus } from '@/types';
import ProjectContactsFilesPanel from './projectWorks/ProjectContactsFilesPanel';
import ProjectWorkPlanDialog from './projectWorks/ProjectWorkPlanDialog';

const ALL = 'Kaikki';
const STATUS_FILTERS: Array<WorkOrderStatus | typeof ALL> = [ALL, 'Avoin', 'Käynnissä', 'Odottaa', 'Valmis'];

function formatDate(value: string, fallback = 'Ei määritetty') {
  if (!value) return fallback;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

function statusBadge(status: WorkOrderStatus) {
  const styles: Record<WorkOrderStatus, string> = {
    Avoin: 'border-blue-200 bg-blue-50 text-blue-700',
    Käynnissä: 'border-orange-200 bg-orange-50 text-orange-700',
    Odottaa: 'border-amber-200 bg-amber-50 text-amber-700',
    Valmis: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Peruttu: 'border-slate-200 bg-slate-50 text-slate-600',
  };
  return <Badge variant="outline" className={styles[status]}>{status}</Badge>;
}

interface WorkPackageGroup {
  key: string;
  title: string;
  location: string;
  orders: ManagedWorkOrder[];
}

interface WorkPlanGroup {
  id: string;
  name: string;
  description: string;
  status: ProjectWorkPlanSummary['status'];
  progress: number;
  packages: WorkPackageGroup[];
}

function orderMatches(
  order: ManagedWorkOrder,
  search: string,
  statusFilter: WorkOrderStatus | typeof ALL,
): boolean {
  const query = search.trim().toLocaleLowerCase('fi');
  const statusMatches = statusFilter === ALL || order.status === statusFilter;
  if (!statusMatches) return false;
  if (!query) return true;
  return [
    order.title,
    order.location,
    order.type,
    order.workReference,
    order.workPackageTitle,
    ...order.assigneeNames,
  ].some((value) => value.toLocaleLowerCase('fi').includes(query));
}

function packageProgress(orders: ManagedWorkOrder[]): number {
  if (orders.length === 0) return 0;
  const completed = orders.filter((order) => ['Valmis', 'Peruttu'].includes(order.status)).length;
  return Math.round((completed / orders.length) * 100);
}

export default function ProjectWorks({ embedded = false }: { embedded?: boolean }) {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { projects } = useAppDataContext();
  const {
    people,
    projectMemberships,
    workOrders,
    canManage,
    loading,
    error,
    refresh,
  } = useRoleWorkspace();

  const project = projects.find((item) => item.id === projectId);
  const projectOrders = useMemo(
    () => workOrders.filter((item) => item.projectId === projectId),
    [projectId, workOrders],
  );
  const projectMemberIds = useMemo(
    () => new Set(projectMemberships.filter((item) => item.projectId === projectId).map((item) => item.userId)),
    [projectId, projectMemberships],
  );
  const projectPeople = useMemo(
    () => people.filter((person) => projectMemberIds.has(person.userId)),
    [people, projectMemberIds],
  );

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | typeof ALL>(ALL);
  const [planOpen, setPlanOpen] = useState(false);
  const [plans, setPlans] = useState<ProjectWorkPlanSummary[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const organizationId = currentOrg?.id;
  const reloadPlans = useCallback(async () => {
    if (!organizationId || !projectId) return;
    setPlansLoading(true);
    try {
      setPlans(await loadProjectWorkPlans({ organizationId, projectId }));
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Työkokonaisuuksien haku epäonnistui.');
    } finally {
      setPlansLoading(false);
    }
  }, [organizationId, projectId]);

  useEffect(() => {
    void reloadPlans();
  }, [reloadPlans]);

  const orderStatusById = useMemo(
    () => new Map(projectOrders.map((order) => [order.id, order.status])),
    [projectOrders],
  );

  const planGroups = useMemo<WorkPlanGroup[]>(() => {
    const visibleOrders = projectOrders.filter((order) => (
      Boolean(order.workPlanId && order.workPackageKey)
      && orderMatches(order, search, statusFilter)
    ));
    const planMap = new Map(plans.map((plan) => [plan.id, plan]));
    const grouped = new Map<string, Map<string, ManagedWorkOrder[]>>();

    visibleOrders.forEach((order) => {
      const planId = order.workPlanId as string;
      const packageKey = order.workPackageKey;
      const packages = grouped.get(planId) ?? new Map<string, ManagedWorkOrder[]>();
      packages.set(packageKey, [...(packages.get(packageKey) ?? []), order]);
      grouped.set(planId, packages);
    });

    return [...grouped.entries()].map(([planId, packages]) => {
      const plan = planMap.get(planId);
      const packageGroups = [...packages.entries()].map(([key, orders]): WorkPackageGroup => {
        const sortedOrders = [...orders].sort((a, b) => a.phaseOrder - b.phaseOrder || a.title.localeCompare(b.title, 'fi'));
        return {
          key,
          title: sortedOrders[0]?.workPackageTitle || sortedOrders[0]?.location || key,
          location: sortedOrders[0]?.location || '',
          orders: sortedOrders,
        };
      }).sort((a, b) => a.title.localeCompare(b.title, 'fi', { numeric: true }));
      const allOrders = packageGroups.flatMap((item) => item.orders);
      return {
        id: planId,
        name: plan?.name || 'Työkokonaisuus',
        description: plan?.description || '',
        status: plan?.status || 'Suunniteltu',
        progress: plan?.progress ?? packageProgress(allOrders),
        packages: packageGroups,
      };
    }).sort((a, b) => a.name.localeCompare(b.name, 'fi'));
  }, [plans, projectOrders, search, statusFilter]);

  const standaloneOrders = useMemo(
    () => projectOrders.filter((order) => !order.workPlanId && orderMatches(order, search, statusFilter)),
    [projectOrders, search, statusFilter],
  );

  if (!projectId) return null;

  if (!project && !loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <AlertTriangle size={42} className="mx-auto mb-4 text-amber-600" />
          <h1 className="text-xl font-bold">Projektia ei löytynyt</h1>
          <Button className="mt-5" onClick={() => navigate('/projektit')}>Takaisin projekteihin</Button>
        </CardContent>
      </Card>
    );
  }

  const activeCount = projectOrders.filter((order) => order.status === 'Käynnissä').length;
  const openCount = projectOrders.filter((order) => ['Avoin', 'Odottaa'].includes(order.status)).length;
  const doneCount = projectOrders.filter((order) => order.status === 'Valmis').length;
  const targetCount = new Set(projectOrders.filter((order) => order.workPackageKey).map((order) => `${order.workPlanId}:${order.workPackageKey}`)).size;

  return (
    <div className={embedded ? 'space-y-5' : 'mx-auto max-w-[1700px] space-y-5 sm:space-y-6'}>
      {!embedded && <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 to-slate-800 text-white shadow-lg">
        <div className="p-5 sm:p-8">
          <Button variant="ghost" className="mb-4 gap-2 text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => navigate('/projektit')}>
            <ArrowLeft size={16} /> Projektit
          </Button>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
                <FolderKanban size={16} /> Projektin työvaiheet ja tekijät
              </div>
              <h1 className="break-words text-2xl font-bold sm:text-4xl">{project?.name ?? 'Projektin työt'}</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
                Rakenna isosta urakasta selkeitä työkokonaisuuksia. Pidä päähenkilöt, tilaajan yhteystiedot ja projektitiedostot samassa näkymässä, ja seuraa työvaiheiden etenemistä kohdekohtaisesti.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="border-slate-600 bg-white/5 text-white hover:bg-white/10"
                onClick={() => navigate(`/projektit/${projectId}?tab=documents`)}
              >
                <FileText size={16} className="mr-2" /> Tilannekuva ja dokumentit
              </Button>
              <Button variant="outline" className="border-slate-600 bg-white/5 text-white hover:bg-white/10" onClick={() => navigate(`/tyomaaraykset?project=${encodeURIComponent(projectId)}&new=1`)}>
                <Plus size={16} className="mr-2" /> Yksittäinen työ
              </Button>
              <Button className="bg-orange-500 text-white hover:bg-orange-600" onClick={() => setPlanOpen(true)} disabled={!canManage}>
                <Layers3 size={16} className="mr-2" /> Rakenna työkokonaisuus
              </Button>
            </div>
          </div>
        </div>
      </div>}

      {embedded && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Työvaiheet ja tekijät</h2>
            <p className="mt-1 text-sm text-slate-600">Työkokonaisuudet, kohteet, työjärjestys ja vastuuhenkilöt.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => navigate(`/tyomaaraykset?project=${encodeURIComponent(projectId)}&new=1`)}>
              <Plus size={16} className="mr-2" /> Yksittäinen työ
            </Button>
            <Button onClick={() => setPlanOpen(true)} disabled={!canManage}>
              <Layers3 size={16} className="mr-2" /> Rakenna työkokonaisuus
            </Button>
          </div>
        </div>
      )}

      {(error || operationError) && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />{operationError ?? error}
        </div>
      )}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 size={17} />{successMessage}
        </div>
      )}

      {!embedded && <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {[
          { label: 'Työkokonaisuuksia', value: plans.length, icon: Layers3, tone: 'bg-violet-50 text-violet-700' },
          { label: 'Työkohteita', value: targetCount, icon: MapPin, tone: 'bg-slate-100 text-slate-700' },
          { label: 'Avoinna', value: openCount, icon: Wrench, tone: 'bg-blue-50 text-blue-700' },
          { label: 'Käynnissä', value: activeCount, icon: CalendarClock, tone: 'bg-orange-50 text-orange-700' },
          { label: 'Valmiina', value: doneCount, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
        ].map((item) => (
          <Card key={item.label} className="border-slate-200 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{item.label}</p><p className="mt-2 font-mono text-3xl font-bold text-slate-950">{item.value}</p></div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.tone}`}><item.icon size={21} /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>}

      {!embedded && project && currentOrg && (
        <ProjectContactsFilesPanel
          organizationId={currentOrg.id}
          project={project}
          people={people}
          projectPeople={projectPeople}
          currentUserId={user?.id}
          canManage={canManage}
          onError={setOperationError}
          onSuccess={setSuccessMessage}
          onNavigateWorkspaceDocuments={() => navigate(`/projektit/${projectId}?tab=documents`)}
        />
      )}

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hae työkohdetta, vaihetta tai tekijää…" className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2 pb-1">
          {STATUS_FILTERS.map((status) => (
            <Button key={status} variant={statusFilter === status ? 'default' : 'outline'} size="sm" className="shrink-0" onClick={() => setStatusFilter(status)}>
              {status}
            </Button>
          ))}
        </div>
      </div>

      {(loading || plansLoading) && <div className="flex min-h-48 items-center justify-center text-slate-500"><Loader2 size={24} className="mr-2 animate-spin" /> Ladataan projektin työrakennetta…</div>}

      {!loading && !plansLoading && planGroups.map((plan) => (
        <section key={plan.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50/70 p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold text-slate-950">{plan.name}</h2><Badge variant="outline">{plan.status}</Badge></div>{plan.description && <p className="mt-1 text-sm text-slate-600">{plan.description}</p>}<p className="mt-2 text-xs text-slate-500">{plan.packages.length} työkohdetta</p></div>
              <div className="w-full max-w-sm"><div className="mb-2 flex items-center justify-between text-sm"><span className="text-slate-600">Kokonaisuuden eteneminen</span><strong>{Math.round(plan.progress)} %</strong></div><Progress value={plan.progress} /></div>
            </div>
          </div>

          <div className="grid gap-4 p-4 xl:grid-cols-2 sm:p-5">
            {plan.packages.map((workPackage) => {
              const progress = packageProgress(workPackage.orders);
              return (
                <Card key={workPackage.key} className="overflow-hidden border-slate-200 shadow-none">
                  <CardContent className="p-0">
                    <div className="border-b border-slate-100 bg-white p-4">
                      <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-950">{workPackage.title}</h3><p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin size={13} />{workPackage.location}</p></div><Badge variant="secondary">{progress} %</Badge></div>
                      <Progress value={progress} className="mt-3 h-2" />
                    </div>
                    <div className="divide-y divide-slate-100">
                      {workPackage.orders.map((order) => {
                        const predecessorDone = !order.predecessorWorkOrderId
                          || ['Valmis', 'Peruttu'].includes(orderStatusById.get(order.predecessorWorkOrderId) ?? 'Avoin');
                        return (
                          <div key={order.id} className="grid gap-3 p-4 sm:grid-cols-[38px_1fr_auto] sm:items-center">
                            <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${order.status === 'Valmis' ? 'bg-emerald-100 text-emerald-800' : predecessorDone ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-800'}`}>{predecessorDone ? order.phaseOrder || '–' : <LockKeyhole size={14} />}</span>
                            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-slate-900">{order.title}</p>{statusBadge(order.status)}</div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><UsersRound size={13} />{order.assigneeNames.join(', ') || 'Ei tekijää'}</span><span className="inline-flex items-center gap-1"><CalendarClock size={13} />{order.plannedStartDate ? `${formatDate(order.plannedStartDate)}–${formatDate(order.plannedEndDate)}` : 'Ei aikataulua'}</span></div>{!predecessorDone && <p className="mt-2 text-xs font-medium text-amber-700">Edellinen vaihe pitää valmistua ennen aloitusta.</p>}</div>
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/tyomaaraykset?project=${encodeURIComponent(projectId)}`)} aria-label={`Avaa työvaihe ${order.title}`}><Pencil size={16} /></Button>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}

      {!loading && !plansLoading && standaloneOrders.length > 0 && (
        <section className="space-y-3">
          <div><h2 className="text-lg font-semibold">Muut projektin työt</h2><p className="text-sm text-slate-500">Yksittäiset työmääräykset, jotka eivät kuulu vaiheistettuun työkokonaisuuteen.</p></div>
          <div className="grid gap-4 xl:grid-cols-2">
            {standaloneOrders.map((order) => (
              <Card key={order.id} className="overflow-hidden border-slate-200 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="mb-2 flex flex-wrap gap-2">{statusBadge(order.status)}{order.type && <Badge variant="outline">{order.type}</Badge>}</div><h3 className="text-lg font-semibold text-slate-950">{order.title}</h3></div><Button variant="ghost" size="sm" onClick={() => navigate(`/tyomaaraykset?project=${encodeURIComponent(projectId)}`)}><Pencil size={16} /></Button></div>
                  <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"><div className="flex items-start gap-2"><UserRound size={16} className="mt-0.5 text-slate-400" /><div><p className="text-xs uppercase tracking-wide text-slate-400">Tekijät</p><p className="text-sm font-medium text-slate-700">{order.assigneeNames.join(', ') || 'Ei kohdistusta'}</p></div></div><div className="flex items-start gap-2"><CalendarClock size={16} className="mt-0.5 text-slate-400" /><div><p className="text-xs uppercase tracking-wide text-slate-400">Työjakso</p><p className="text-sm font-medium text-slate-700">{order.plannedStartDate ? `${formatDate(order.plannedStartDate)}–${formatDate(order.plannedEndDate)}` : 'Ei aikataulua'}</p></div></div>{order.location && <div className="flex items-start gap-2 sm:col-span-2"><MapPin size={16} className="mt-0.5 text-slate-400" /><div><p className="text-xs uppercase tracking-wide text-slate-400">Kohde</p><p className="text-sm font-medium text-slate-700">{order.location}</p></div></div>}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {!loading && !plansLoading && planGroups.length === 0 && standaloneOrders.length === 0 && (
        <Card className="border-dashed border-slate-300">
          <CardContent className="p-12 text-center">
            <Layers3 size={46} className="mx-auto mb-3 text-slate-300" />
            <h2 className="font-semibold text-slate-800">Projektilla ei ole vielä työkokonaisuutta</h2>
            <p className="mx-auto mt-1 max-w-2xl text-sm text-slate-500">Määritä työkohteet, lisää urakan oikeat työvaiheet ja nimeä jokaiselle vaiheelle yksi tai useampi tekijä.</p>
            <Button className="mt-5" onClick={() => setPlanOpen(true)} disabled={!canManage}><Layers3 size={16} className="mr-2" /> Rakenna työkokonaisuus</Button>
          </CardContent>
        </Card>
      )}

      {project && currentOrg && (
        <ProjectWorkPlanDialog
          open={planOpen}
          organizationId={currentOrg.id}
          project={project}
          people={projectPeople}
          onOpenChange={setPlanOpen}
          onCreated={async (message) => {
            setOperationError(null);
            setSuccessMessage(message);
            await Promise.all([refresh(), reloadPlans()]);
          }}
        />
      )}
    </div>
  );
}
