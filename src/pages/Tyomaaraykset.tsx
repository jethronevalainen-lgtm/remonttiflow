import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  HardHat,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Search,
  Trash2,
  UserRound,
  UsersRound,
} from 'lucide-react';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
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
  saveManagedWorkOrder,
  transitionMyWorkOrder,
  type ManagedWorkOrder,
} from '@/lib/supabase/workManagement';
import { cn } from '@/lib/utils';
import type {
  WorkAssignmentScope,
  WorkOrderPriority,
  WorkOrderStatus,
} from '@/types';

const STATUSES: WorkOrderStatus[] = ['Avoin', 'Käynnissä', 'Odottaa', 'Valmis', 'Peruttu'];
const PRIORITIES: WorkOrderPriority[] = ['Korkea', 'Normaali', 'Matala'];
const ALL = 'Kaikki';

interface WorkOrderForm {
  title: string;
  projectId: string;
  dueDate: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  type: string;
  description: string;
  assignmentScope: WorkAssignmentScope;
  assigneeUserIds: string[];
}

const EMPTY_FORM: WorkOrderForm = {
  title: '',
  projectId: '',
  dueDate: '',
  priority: 'Normaali',
  status: 'Avoin',
  type: '',
  description: '',
  assignmentScope: 'people',
  assigneeUserIds: [],
};

function formatDate(value: string) {
  if (!value) return 'Ei määräaikaa';
  const parsed = new Date(value);
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

function priorityBadge(priority: WorkOrderPriority) {
  const styles: Record<WorkOrderPriority, string> = {
    Korkea: 'border-red-200 bg-red-50 text-red-700',
    Normaali: 'border-slate-200 bg-slate-50 text-slate-700',
    Matala: 'border-blue-100 bg-blue-50 text-blue-600',
  };
  return <Badge variant="outline" className={styles[priority]}>{priority}</Badge>;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function assignmentLabel(order: ManagedWorkOrder) {
  if (order.assignmentScope === 'project_team') return 'Koko projektitiimi';
  if (order.assigneeNames.length > 0) return order.assigneeNames.join(', ');
  return 'Vastuuhenkilö puuttuu';
}

export default function Tyomaaraykset() {
  const { currentOrg, currentRole } = useOrganization();
  const { projects, deleteWorkOrder, refresh: refreshDomain } = useAppDataContext();
  const {
    people,
    projectMemberships,
    workOrders,
    canManage,
    loading,
    error,
    refresh,
  } = useRoleWorkspace();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedWorkOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedWorkOrder | null>(null);
  const [transitionTarget, setTransitionTarget] = useState<ManagedWorkOrder | null>(null);
  const [transitionStatus, setTransitionStatus] = useState<'Odottaa' | 'Valmis'>('Valmis');
  const [workerNote, setWorkerNote] = useState('');
  const [form, setForm] = useState<WorkOrderForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fi');
    return workOrders.filter((order) => {
      const matchesSearch = !query || [
        order.title,
        order.project,
        order.description,
        assignmentLabel(order),
      ].some((value) => value.toLocaleLowerCase('fi').includes(query));
      const matchesStatus = statusFilter === ALL || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter, workOrders]);

  const activeOrders = workOrders.filter((order) => order.status === 'Käynnissä');
  const openOrders = workOrders.filter((order) => order.status === 'Avoin');
  const waitingOrders = workOrders.filter((order) => order.status === 'Odottaa');
  const doneOrders = workOrders.filter((order) => order.status === 'Valmis');
  const selectedProjectMemberIds = new Set(
    projectMemberships
      .filter((membership) => membership.projectId === form.projectId)
      .map((membership) => membership.userId),
  );

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const openEdit = (order: ManagedWorkOrder) => {
    setEditing(order);
    setForm({
      title: order.title,
      projectId: order.projectId,
      dueDate: order.dueDate,
      priority: order.priority,
      status: order.status,
      type: order.type,
      description: order.description,
      assignmentScope: order.assignmentScope,
      assigneeUserIds: order.assigneeUserIds,
    });
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const toggleAssignee = (userId: string, checked: boolean) => {
    setForm((previous) => ({
      ...previous,
      assigneeUserIds: checked
        ? [...new Set([...previous.assigneeUserIds, userId])]
        : previous.assigneeUserIds.filter((id) => id !== userId),
    }));
  };

  const save = async () => {
    const nextErrors: string[] = [];
    if (!form.title.trim()) nextErrors.push('Työmääräyksen otsikko on pakollinen.');
    if (!form.projectId) nextErrors.push('Valitse projekti.');
    if (form.assignmentScope === 'people' && form.assigneeUserIds.length === 0) {
      nextErrors.push('Valitse vähintään yksi vastuuhenkilö.');
    }
    if (form.assignmentScope === 'project_team' && selectedProjectMemberIds.size === 0) {
      nextErrors.push('Valitulla projektilla ei ole projektitiimiä. Lisää tiimi ensin Projektit-näkymässä.');
    }
    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg || !canManage) return;

    setSaving(true);
    setOperationError(null);
    try {
      await saveManagedWorkOrder({
        organizationId: currentOrg.id,
        workOrderId: editing?.id,
        projectId: form.projectId,
        title: form.title.trim(),
        dueDate: form.dueDate,
        priority: form.priority,
        status: form.status,
        description: form.description.trim(),
        type: form.type.trim(),
        assignmentScope: form.assignmentScope,
        assigneeUserIds: form.assignmentScope === 'people' ? form.assigneeUserIds : [],
      });
      await Promise.all([refresh(), refreshDomain()]);
      setDialogOpen(false);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget || !canManage) return;
    deleteWorkOrder(deleteTarget.id);
    setDeleteTarget(null);
    await refresh();
  };

  const runTransition = async (
    order: ManagedWorkOrder,
    nextStatus: 'Käynnissä' | 'Odottaa' | 'Valmis',
    note = '',
  ) => {
    setSaving(true);
    setOperationError(null);
    try {
      await transitionMyWorkOrder({
        workOrderId: order.id,
        status: nextStatus,
        workerNote: note,
      });
      await Promise.all([refresh(), refreshDomain()]);
      setTransitionTarget(null);
      setWorkerNote('');
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tilan päivitys epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const openTransition = (order: ManagedWorkOrder, nextStatus: 'Odottaa' | 'Valmis') => {
    setTransitionTarget(order);
    setTransitionStatus(nextStatus);
    setWorkerNote(order.workerNote);
    setOperationError(null);
  };

  const pageTitle = canManage ? 'Työmääräysten ohjaus' : 'Minun työni';
  const pageDescription = canManage
    ? 'Kohdista tehtävät projekteille, tiimeille ja vastuuhenkilöille'
    : 'Näet vain sinulle määrätyt tai projektitiimillesi kuuluvat tehtävät';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-[1500px] space-y-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
              {canManage ? <HardHat size={16} /> : <ClipboardList size={16} />}
              {canManage ? 'Työnjohto' : 'Työntekijän työtila'}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{pageTitle}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{pageDescription}</p>
          </div>
          {canManage && (
            <Button onClick={openCreate} className="gap-2 bg-orange-500 text-white hover:bg-orange-600">
              <Plus size={17} /> Uusi työmääräys
            </Button>
          )}
        </div>
      </div>

      {(error || operationError) && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={17} /> {operationError ?? error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Avoimet', value: openOrders.length, icon: ClipboardList, tone: 'bg-blue-50 text-blue-700' },
          { label: 'Käynnissä', value: activeOrders.length, icon: PlayCircle, tone: 'bg-orange-50 text-orange-700' },
          { label: 'Odottaa', value: waitingOrders.length, icon: PauseCircle, tone: 'bg-amber-50 text-amber-700' },
          { label: 'Valmiit', value: doneOrders.length, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
        ].map((item) => (
          <Card key={item.label} className="border-slate-200 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-xs font-medium uppercase tracking-wider text-slate-500">{item.label}</p><p className="mt-2 font-mono text-3xl font-bold text-slate-950">{item.value}</p></div>
                <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', item.tone)}><item.icon size={21} /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-2">
          {[ALL, 'Avoin', 'Käynnissä', 'Odottaa', 'Valmis'].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStatusFilter(item)}
              className={cn(
                'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                statusFilter === item
                  ? 'border-orange-300 bg-orange-50 text-orange-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="relative lg:ml-auto lg:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hae tehtävää tai projektia…" className="pl-9" />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {filteredOrders.map((order) => (
          <Card key={order.id} className={cn('overflow-hidden border-slate-200 shadow-sm transition-shadow hover:shadow-md', order.priority === 'Korkea' && !['Valmis', 'Peruttu'].includes(order.status) && 'border-l-4 border-l-red-500')}>
            <CardContent className="p-0">
              <div className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap gap-2">{statusBadge(order.status)}{priorityBadge(order.priority)}</div>
                    <h2 className="text-lg font-semibold text-slate-950">{order.title}</h2>
                    <p className="mt-1 text-sm text-slate-500">{order.project}</p>
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(order)} aria-label={`Muokkaa ${order.title}`}><Pencil size={16} /></Button>
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteTarget(order)} aria-label={`Poista ${order.title}`}><Trash2 size={16} /></Button>
                    </div>
                  )}
                </div>

                {order.description && <p className="text-sm leading-6 text-slate-600">{order.description}</p>}

                <div className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                  <div className="flex items-start gap-2"><CalendarDays size={16} className="mt-0.5 text-slate-400" /><div><p className="text-xs uppercase tracking-wide text-slate-400">Määräaika</p><p className="text-sm font-medium text-slate-700">{formatDate(order.dueDate)}</p></div></div>
                  <div className="flex items-start gap-2">{order.assignmentScope === 'project_team' ? <UsersRound size={16} className="mt-0.5 text-slate-400" /> : <UserRound size={16} className="mt-0.5 text-slate-400" />}<div><p className="text-xs uppercase tracking-wide text-slate-400">Vastuu</p><p className="text-sm font-medium text-slate-700">{assignmentLabel(order)}</p></div></div>
                </div>

                {order.workerNote && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <strong>Työhuomio:</strong> {order.workerNote}
                  </div>
                )}

                {!canManage && !['Valmis', 'Peruttu'].includes(order.status) && (
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    {order.status === 'Avoin' && <Button onClick={() => void runTransition(order, 'Käynnissä')} disabled={saving} className="gap-2"><PlayCircle size={16} /> Aloita työ</Button>}
                    {order.status === 'Odottaa' && <Button onClick={() => void runTransition(order, 'Käynnissä')} disabled={saving} className="gap-2"><PlayCircle size={16} /> Jatka työtä</Button>}
                    {order.status === 'Käynnissä' && <Button variant="outline" onClick={() => openTransition(order, 'Odottaa')} disabled={saving} className="gap-2"><PauseCircle size={16} /> Keskeytä</Button>}
                    {['Käynnissä', 'Odottaa'].includes(order.status) && <Button onClick={() => openTransition(order, 'Valmis')} disabled={saving} className="gap-2 bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 size={16} /> Merkitse valmiiksi</Button>}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && filteredOrders.length === 0 && (
        <Card className="border-dashed border-slate-300"><CardContent className="p-12 text-center"><ClipboardList size={46} className="mx-auto mb-3 text-slate-300" /><h2 className="font-semibold text-slate-800">{canManage ? 'Työmääräyksiä ei löytynyt' : 'Sinulle ei ole määrätty töitä'}</h2><p className="mt-1 text-sm text-slate-500">{canManage ? 'Muuta hakua tai luo uusi työmääräys.' : 'Uudet tehtävät näkyvät tässä, kun työnjohto kohdistaa ne sinulle tai projektitiimillesi.'}</p></CardContent></Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? 'Muokkaa työmääräystä' : 'Uusi työmääräys'}</DialogTitle></DialogHeader>
          {formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="work-title">Tehtävä *</Label><Input id="work-title" value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Projekti *</Label><Select value={form.projectId} onValueChange={(projectId) => setForm((previous) => ({ ...previous, projectId }))}><SelectTrigger><SelectValue placeholder="Valitse projekti" /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="work-due">Määräaika</Label><Input id="work-due" type="date" value={form.dueDate} onChange={(event) => setForm((previous) => ({ ...previous, dueDate: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="work-type">Työlaji</Label><Input id="work-type" value={form.type} onChange={(event) => setForm((previous) => ({ ...previous, type: event.target.value }))} placeholder="Esim. kirvesmiestyö" /></div>
            <div className="space-y-2"><Label>Prioriteetti</Label><Select value={form.priority} onValueChange={(priority: WorkOrderPriority) => setForm((previous) => ({ ...previous, priority }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Tila</Label><Select value={form.status} onValueChange={(status: WorkOrderStatus) => setForm((previous) => ({ ...previous, status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 sm:col-span-2"><Label>Kohdistus</Label><Select value={form.assignmentScope} onValueChange={(assignmentScope: WorkAssignmentScope) => setForm((previous) => ({ ...previous, assignmentScope }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="people">Nimetyt henkilöt</SelectItem><SelectItem value="project_team">Koko projektitiimi</SelectItem></SelectContent></Select></div>
            {form.assignmentScope === 'people' && (
              <div className="space-y-2 sm:col-span-2">
                <Label>Vastuuhenkilöt *</Label>
                <div className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
                  {people.map((person) => (
                    <label key={person.userId} className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-slate-50">
                      <Checkbox checked={form.assigneeUserIds.includes(person.userId)} onCheckedChange={(checked) => toggleAssignee(person.userId, checked === true)} />
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{initials(person.name)}</span>
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{person.name}</span><span className="block truncate text-xs text-slate-500">{person.email || person.role}</span></span>
                    </label>
                  ))}
                  {people.length === 0 && <p className="text-sm text-slate-500 sm:col-span-2">Organisaatioon ei ole vielä kutsuttu käyttäjiä.</p>}
                </div>
              </div>
            )}
            {form.assignmentScope === 'project_team' && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 sm:col-span-2">
                Tehtävä näkyy kaikille valitun projektin tiimijäsenille. Projektissa on nyt <strong>{selectedProjectMemberIds.size}</strong> jäsentä.
              </div>
            )}
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="work-description">Työohje</Label><Textarea id="work-description" value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} rows={5} placeholder="Kerro tehtävän rajaus, laatuvaatimukset ja tarvittavat tarkistukset." /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void save()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna työmääräys'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(transitionTarget)} onOpenChange={(open) => !open && setTransitionTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{transitionStatus === 'Valmis' ? 'Merkitse työ valmiiksi' : 'Keskeytä työ'}</DialogTitle></DialogHeader>
          <div className="space-y-3"><p className="text-sm text-slate-600">{transitionTarget?.title}</p><div className="space-y-2"><Label htmlFor="worker-note">Työhuomio</Label><Textarea id="worker-note" value={workerNote} onChange={(event) => setWorkerNote(event.target.value)} placeholder={transitionStatus === 'Valmis' ? 'Mitä tehtiin ja mitä työnjohdon pitää tietää?' : 'Miksi työ odottaa ja mitä tarvitaan jatkamiseen?'} rows={4} /></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setTransitionTarget(null)} disabled={saving}>Peruuta</Button><Button onClick={() => transitionTarget && void runTransition(transitionTarget, transitionStatus, workerNote)} disabled={saving} className={transitionStatus === 'Valmis' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}>{saving ? 'Tallennetaan…' : transitionStatus === 'Valmis' ? 'Merkitse valmiiksi' : 'Keskeytä työ'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Poista työmääräys</AlertDialogTitle><AlertDialogDescription>Poistetaanko <strong>{deleteTarget?.title}</strong>? Toimintoa ei voi perua.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction onClick={() => void remove()} className="bg-red-600 hover:bg-red-700">Poista</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      {!canManage && currentRole === 'worker' && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"><Clock3 size={16} /> Työnjohto näkee tilapäivityksesi ja työhuomiosi välittömästi.</div>
      )}
    </motion.div>
  );
}
