import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  FolderKanban,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search,
  Sparkles,
  UserRound,
  UsersRound,
  Wrench,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import {
  createProjectWorkDrafts,
  generateProjectWorkLabels,
  normalizeProjectWorkLines,
  type ProjectWorkDraft,
} from '@/lib/projectWorkDrafts';
import { createProjectWorkOrdersBulk } from '@/lib/supabase/projectWorkBulk';
import type { WorkOrderOccupancyStatus } from '@/lib/supabase/workManagement';
import type { WorkOrderPriority, WorkOrderStatus } from '@/types';

const ALL = 'Kaikki';
const UNASSIGNED = '__unassigned__';
const STATUS_FILTERS: Array<WorkOrderStatus | typeof ALL> = [ALL, 'Avoin', 'Käynnissä', 'Odottaa', 'Valmis'];
const PRIORITIES: WorkOrderPriority[] = ['Korkea', 'Normaali', 'Matala'];
const OCCUPANCY_OPTIONS: Array<{ value: WorkOrderOccupancyStatus; label: string }> = [
  { value: 'unknown', label: 'Ei tiedossa' },
  { value: 'occupied', label: 'Asuttu työn aikana' },
  { value: 'vacant', label: 'Tyhjä / asumaton' },
  { value: 'partly_occupied', label: 'Osittain käytössä' },
];

interface BulkDefaultsForm {
  type: string;
  description: string;
  plannedStartDate: string;
  plannedEndDate: string;
  dueDate: string;
  plannedStartTime: string;
  plannedEndTime: string;
  priority: WorkOrderPriority;
  occupancyStatus: WorkOrderOccupancyStatus;
  residentNotificationRequired: boolean;
}

const EMPTY_DEFAULTS: BulkDefaultsForm = {
  type: 'Keittiöremontti',
  description: '',
  plannedStartDate: '',
  plannedEndDate: '',
  dueDate: '',
  plannedStartTime: '07:00',
  plannedEndTime: '15:30',
  priority: 'Normaali',
  occupancyStatus: 'unknown',
  residentNotificationRequired: false,
};

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

export default function ProjectWorks() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
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
  const [bulkOpen, setBulkOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [titlePrefix, setTitlePrefix] = useState('Keittiö');
  const [sequencePrefix, setSequencePrefix] = useState('A');
  const [sequenceStart, setSequenceStart] = useState('1');
  const [sequenceCount, setSequenceCount] = useState('15');
  const [defaultAssigneeUserId, setDefaultAssigneeUserId] = useState('');
  const [drafts, setDrafts] = useState<ProjectWorkDraft[]>([]);
  const [defaults, setDefaults] = useState<BulkDefaultsForm>(EMPTY_DEFAULTS);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fi');
    return projectOrders.filter((order) => {
      const matchesStatus = statusFilter === ALL || order.status === statusFilter;
      const matchesSearch = !query || [
        order.title,
        order.location,
        order.type,
        order.workReference,
        ...order.assigneeNames,
      ].some((value) => value.toLocaleLowerCase('fi').includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [projectOrders, search, statusFilter]);

  const openBulk = () => {
    const firstAssignee = projectPeople[0]?.userId ?? '';
    setPasteValue('');
    setTitlePrefix('Keittiö');
    setSequencePrefix('A');
    setSequenceStart('1');
    setSequenceCount('15');
    setDefaultAssigneeUserId(firstAssignee);
    setDrafts([]);
    setDefaults(EMPTY_DEFAULTS);
    setFormErrors([]);
    setOperationError(null);
    setSuccessMessage(null);
    setBulkOpen(true);
  };

  const buildDrafts = (labels: string[]) => {
    setDrafts(createProjectWorkDrafts(labels, titlePrefix, defaultAssigneeUserId));
    setFormErrors([]);
  };

  const createFromPaste = () => {
    const labels = normalizeProjectWorkLines(pasteValue);
    if (labels.length === 0) {
      setFormErrors(['Syötä vähintään yksi huoneisto, tila tai työn tunnus.']);
      return;
    }
    buildDrafts(labels);
  };

  const createSequence = () => {
    const start = Number(sequenceStart);
    const count = Number(sequenceCount);
    if (!Number.isFinite(start) || !Number.isFinite(count) || count < 1 || count > 100) {
      setFormErrors(['Anna kelvollinen aloitusnumero ja 1–100 työn määrä.']);
      return;
    }
    buildDrafts(generateProjectWorkLabels({ prefix: sequencePrefix, start, count }));
  };

  const updateDraft = (id: string, patch: Partial<ProjectWorkDraft>) => {
    setDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, ...patch } : draft));
  };

  const assignAll = (userId: string) => {
    const normalized = userId === UNASSIGNED ? '' : userId;
    setDefaultAssigneeUserId(normalized);
    setDrafts((current) => current.map((draft) => ({ ...draft, assigneeUserId: normalized })));
  };

  const validateBulk = () => {
    const errors: string[] = [];
    if (drafts.length === 0) errors.push('Luo ensin vähintään yksi työ.');
    if (drafts.some((draft) => !draft.title.trim())) errors.push('Jokaisella työllä pitää olla nimi.');
    if (drafts.some((draft) => !draft.assigneeUserId)) errors.push('Valitse asentaja jokaiselle työlle.');
    if (defaults.plannedStartDate && !defaults.plannedEndDate) errors.push('Valitse myös suunniteltu valmistumispäivä.');
    if (!defaults.plannedStartDate && defaults.plannedEndDate) errors.push('Valitse myös työn aloituspäivä.');
    if (defaults.plannedStartDate && defaults.plannedEndDate < defaults.plannedStartDate) {
      errors.push('Suunniteltu valmistuminen ei voi olla ennen aloitusta.');
    }
    if (defaults.plannedStartDate && defaults.plannedEndTime <= defaults.plannedStartTime) {
      errors.push('Päivittäisen päättymisajan pitää olla aloitusajan jälkeen.');
    }
    if (defaults.dueDate && defaults.plannedEndDate && defaults.dueDate < defaults.plannedEndDate) {
      errors.push('Viimeistään valmis -päivä ei voi olla ennen suunniteltua valmistumista.');
    }
    return errors;
  };

  const saveBulk = async () => {
    const errors = validateBulk();
    setFormErrors(errors);
    if (errors.length > 0 || !currentOrg || !projectId || !canManage) return;

    setSaving(true);
    setOperationError(null);
    try {
      const createdIds = await createProjectWorkOrdersBulk({
        organizationId: currentOrg.id,
        projectId,
        items: drafts.map((draft) => ({
          title: draft.title.trim(),
          location: draft.location.trim(),
          assigneeUserId: draft.assigneeUserId,
        })),
        defaults: {
          dueDate: defaults.dueDate,
          plannedStartDate: defaults.plannedStartDate,
          plannedEndDate: defaults.plannedStartDate ? defaults.plannedEndDate || defaults.plannedStartDate : '',
          plannedStartTime: defaults.plannedStartTime,
          plannedEndTime: defaults.plannedEndTime,
          plannedWeekdays: [1, 2, 3, 4, 5],
          calendarSyncEnabled: Boolean(defaults.plannedStartDate),
          occupancyStatus: defaults.occupancyStatus,
          residentNotificationRequired: defaults.residentNotificationRequired,
          priority: defaults.priority,
          status: 'Avoin',
          description: defaults.description.trim(),
          type: defaults.type.trim(),
        },
      });
      await refresh();
      setBulkOpen(false);
      setSuccessMessage(`${createdIds.length} työtä luotiin ja kohdistettiin asentajille.`);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Töiden luonti epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

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

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 sm:space-y-6">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 to-slate-800 text-white shadow-lg">
        <div className="p-5 sm:p-8">
          <Button variant="ghost" className="mb-4 gap-2 text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => navigate('/projektit')}>
            <ArrowLeft size={16} /> Projektit
          </Button>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
                <FolderKanban size={16} /> Projektin työt
              </div>
              <h1 className="break-words text-2xl font-bold sm:text-4xl">{project?.name ?? 'Projektin työt'}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Luo projektin alle huoneistot, keittiöt tai muut työkohteet ja määritä jokaiselle oma asentaja.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="border-slate-600 bg-white/5 text-white hover:bg-white/10" onClick={() => navigate(`/projektit/${projectId}/tyotila`)}>
                <FileText size={16} className="mr-2" /> Tilannekuva ja dokumentit
              </Button>
              <Button variant="outline" className="border-slate-600 bg-white/5 text-white hover:bg-white/10" onClick={() => navigate(`/tyomaaraykset?project=${encodeURIComponent(projectId)}&new=1`)}>
                <Plus size={16} className="mr-2" /> Yksittäinen työ
              </Button>
              <Button className="bg-orange-500 text-white hover:bg-orange-600" onClick={openBulk} disabled={!canManage}>
                <Sparkles size={16} className="mr-2" /> Luo useita töitä
              </Button>
            </div>
          </div>
        </div>
      </div>

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

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Työt yhteensä', value: projectOrders.length, icon: ClipboardList, tone: 'bg-slate-100 text-slate-700' },
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
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hae työtä, huoneistoa tai asentajaa…" className="pl-9" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((status) => (
            <Button key={status} variant={statusFilter === status ? 'default' : 'outline'} size="sm" className="shrink-0" onClick={() => setStatusFilter(status)}>
              {status}
            </Button>
          ))}
        </div>
      </div>

      {loading && <div className="flex min-h-48 items-center justify-center text-slate-500"><Loader2 size={24} className="mr-2 animate-spin" /> Ladataan projektin töitä…</div>}

      {!loading && (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredOrders.map((order) => (
            <Card key={order.id} className="overflow-hidden border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap gap-2">{statusBadge(order.status)}{order.type && <Badge variant="outline">{order.type}</Badge>}</div>
                    <h2 className="text-lg font-semibold text-slate-950">{order.title}</h2>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/tyomaaraykset?project=${encodeURIComponent(projectId)}`)} aria-label={`Avaa ${order.title} työmääräyksissä`}>
                    <Pencil size={16} />
                  </Button>
                </div>

                <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                  <div className="flex items-start gap-2"><UserRound size={16} className="mt-0.5 text-slate-400" /><div><p className="text-xs uppercase tracking-wide text-slate-400">Asentaja</p><p className="text-sm font-medium text-slate-700">{order.assigneeNames.join(', ') || 'Ei kohdistusta'}</p></div></div>
                  <div className="flex items-start gap-2"><CalendarClock size={16} className="mt-0.5 text-slate-400" /><div><p className="text-xs uppercase tracking-wide text-slate-400">Työjakso</p><p className="text-sm font-medium text-slate-700">{order.plannedStartDate ? `${formatDate(order.plannedStartDate)}–${formatDate(order.plannedEndDate)}` : 'Ei aikataulua'}</p></div></div>
                  {order.location && <div className="flex items-start gap-2 sm:col-span-2"><MapPin size={16} className="mt-0.5 text-slate-400" /><div><p className="text-xs uppercase tracking-wide text-slate-400">Huoneisto tai kohde</p><p className="text-sm font-medium text-slate-700">{order.location}</p></div></div>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && filteredOrders.length === 0 && (
        <Card className="border-dashed border-slate-300">
          <CardContent className="p-12 text-center">
            <ClipboardList size={46} className="mx-auto mb-3 text-slate-300" />
            <h2 className="font-semibold text-slate-800">Projektilla ei ole vielä töitä</h2>
            <p className="mt-1 text-sm text-slate-500">Luo esimerkiksi 15 keittiötä kerralla ja määritä asentaja jokaiselle riville.</p>
            <Button className="mt-5" onClick={openBulk}><Sparkles size={16} className="mr-2" /> Luo useita töitä</Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={bulkOpen} onOpenChange={(open) => !saving && setBulkOpen(open)}>
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader><DialogTitle>Luo projektin alle useita töitä</DialogTitle></DialogHeader>

          {formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}
          {operationError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{operationError}</div>}

          {projectPeople.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              <div className="flex items-start gap-3"><UsersRound size={20} className="mt-0.5 shrink-0" /><div><p className="font-semibold">Projektilla ei ole asentajia tiimissä.</p><p className="mt-1">Lisää asentajat ensin Projektit-näkymän Tiimi-toiminnolla. Työ voidaan kohdistaa vain projektitiimiin kuuluvalle henkilölle.</p></div></div>
            </div>
          ) : (
            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                <h3 className="font-semibold text-slate-950">1. Muodosta työlista</h3>
                <p className="mt-1 text-sm text-slate-500">Käytä numerosarjaa tai liitä huoneistot ja kohteet yksi per rivi.</p>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3 rounded-xl bg-slate-50 p-4">
                    <Label>Numerosarja</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label htmlFor="sequence-prefix" className="text-xs text-slate-500">Tunnus</Label><Input id="sequence-prefix" value={sequencePrefix} onChange={(event) => setSequencePrefix(event.target.value)} placeholder="A" /></div>
                      <div><Label htmlFor="sequence-start" className="text-xs text-slate-500">Alkaa</Label><Input id="sequence-start" type="number" min="0" value={sequenceStart} onChange={(event) => setSequenceStart(event.target.value)} /></div>
                      <div><Label htmlFor="sequence-count" className="text-xs text-slate-500">Määrä</Label><Input id="sequence-count" type="number" min="1" max="100" value={sequenceCount} onChange={(event) => setSequenceCount(event.target.value)} /></div>
                    </div>
                    <Button variant="outline" className="w-full" onClick={createSequence}><Sparkles size={15} className="mr-2" /> Muodosta sarja</Button>
                  </div>
                  <div className="space-y-3 rounded-xl bg-slate-50 p-4">
                    <Label htmlFor="paste-list">Liitä oma lista</Label>
                    <Textarea id="paste-list" value={pasteValue} onChange={(event) => setPasteValue(event.target.value)} rows={4} placeholder={'A1\nA2\nA3\nB4'} />
                    <Button variant="outline" className="w-full" onClick={createFromPaste}><Plus size={15} className="mr-2" /> Tee riveiksi</Button>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="title-prefix">Työn nimen alku</Label><Input id="title-prefix" value={titlePrefix} onChange={(event) => setTitlePrefix(event.target.value)} placeholder="Keittiö" /></div>
                  <div className="space-y-2"><Label>Oletusasentaja kaikille</Label><Select value={defaultAssigneeUserId || UNASSIGNED} onValueChange={assignAll}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={UNASSIGNED}>Ei valintaa</SelectItem>{projectPeople.map((person) => <SelectItem key={person.userId} value={person.userId}>{person.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
              </section>

              {drafts.length > 0 && (
                <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold text-slate-950">2. Tarkista työt ja asentajat</h3><p className="mt-1 text-sm text-slate-500">{drafts.length} työtä. Jokaisen rivin asentajan voi vaihtaa erikseen.</p></div><Badge variant="secondary">{drafts.length}/100</Badge></div>
                  <div className="mt-4 space-y-2">
                    {drafts.map((draft, index) => (
                      <div key={draft.id} className="grid gap-2 rounded-xl border border-slate-200 p-3 lg:grid-cols-[52px_1.2fr_1fr_1fr_auto] lg:items-end">
                        <div className="flex h-10 items-center justify-center rounded-lg bg-slate-100 font-mono text-sm font-bold text-slate-600">{index + 1}</div>
                        <div className="space-y-1"><Label className="text-xs text-slate-500">Työn nimi</Label><Input value={draft.title} onChange={(event) => updateDraft(draft.id, { title: event.target.value })} /></div>
                        <div className="space-y-1"><Label className="text-xs text-slate-500">Huoneisto / kohde</Label><Input value={draft.location} onChange={(event) => updateDraft(draft.id, { location: event.target.value })} /></div>
                        <div className="space-y-1"><Label className="text-xs text-slate-500">Asentaja *</Label><Select value={draft.assigneeUserId || UNASSIGNED} onValueChange={(value) => updateDraft(draft.id, { assigneeUserId: value === UNASSIGNED ? '' : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={UNASSIGNED}>Valitse asentaja</SelectItem>{projectPeople.map((person) => <SelectItem key={person.userId} value={person.userId}>{person.name}</SelectItem>)}</SelectContent></Select></div>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDrafts((current) => current.filter((item) => item.id !== draft.id))}>Poista</Button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 sm:p-5">
                <h3 className="font-semibold text-blue-950">3. Yhteiset työ- ja aikataulutiedot</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2"><Label htmlFor="bulk-type">Työlaji</Label><Input id="bulk-type" value={defaults.type} onChange={(event) => setDefaults((current) => ({ ...current, type: event.target.value }))} /></div>
                  <div className="space-y-2"><Label>Prioriteetti</Label><Select value={defaults.priority} onValueChange={(priority: WorkOrderPriority) => setDefaults((current) => ({ ...current, priority }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Kohteen käyttö</Label><Select value={defaults.occupancyStatus} onValueChange={(occupancyStatus: WorkOrderOccupancyStatus) => setDefaults((current) => ({ ...current, occupancyStatus }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{OCCUPANCY_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label htmlFor="bulk-start">Aloitus</Label><Input id="bulk-start" type="date" value={defaults.plannedStartDate} onChange={(event) => setDefaults((current) => ({ ...current, plannedStartDate: event.target.value, plannedEndDate: current.plannedEndDate || event.target.value }))} /></div>
                  <div className="space-y-2"><Label htmlFor="bulk-end">Suunniteltu valmistuminen</Label><Input id="bulk-end" type="date" min={defaults.plannedStartDate || undefined} value={defaults.plannedEndDate} onChange={(event) => setDefaults((current) => ({ ...current, plannedEndDate: event.target.value }))} /></div>
                  <div className="space-y-2"><Label htmlFor="bulk-due">Viimeistään valmis</Label><Input id="bulk-due" type="date" min={defaults.plannedEndDate || defaults.plannedStartDate || undefined} value={defaults.dueDate} onChange={(event) => setDefaults((current) => ({ ...current, dueDate: event.target.value }))} /></div>
                  <div className="space-y-2"><Label htmlFor="bulk-start-time">Päivittäinen aloitus</Label><Input id="bulk-start-time" type="time" value={defaults.plannedStartTime} onChange={(event) => setDefaults((current) => ({ ...current, plannedStartTime: event.target.value }))} /></div>
                  <div className="space-y-2"><Label htmlFor="bulk-end-time">Päivittäinen lopetus</Label><Input id="bulk-end-time" type="time" value={defaults.plannedEndTime} onChange={(event) => setDefaults((current) => ({ ...current, plannedEndTime: event.target.value }))} /></div>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-blue-200 bg-white p-3"><Checkbox checked={defaults.residentNotificationRequired} onCheckedChange={(checked) => setDefaults((current) => ({ ...current, residentNotificationRequired: checked === true }))} /><span className="text-sm font-medium text-slate-800">Asukkaalle ilmoitettava ennen aloitusta</span></label>
                  <div className="space-y-2 sm:col-span-2 lg:col-span-3"><Label htmlFor="bulk-description">Yhteinen työohje</Label><Textarea id="bulk-description" rows={3} value={defaults.description} onChange={(event) => setDefaults((current) => ({ ...current, description: event.target.value }))} placeholder="Rajaus, laatuvaatimukset, materiaalit ja tarkistukset" /></div>
                </div>
              </section>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={saving}>Peruuta</Button>
            <Button onClick={() => void saveBulk()} disabled={saving || projectPeople.length === 0 || drafts.length === 0}>
              {saving && <Loader2 size={16} className="mr-2 animate-spin" />}
              Luo {drafts.length || ''} työtä
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
