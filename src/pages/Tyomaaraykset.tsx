import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wrench,
  ChevronRight,
  Plus,
  Search,
  Pencil,
  Trash2,
  Play,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { EmptyState } from '@/components/states';
import { cn } from '@/lib/utils';
import { useAppDataContext } from '@/contexts/AppDataContext';
import type { WorkOrder, WorkOrderStatus, WorkOrderPriority } from '@/types';

/* ─── Vakiot ─── */
const STATUSES: WorkOrderStatus[] = ['Avoin', 'Käynnissä', 'Odottaa', 'Valmis', 'Peruttu'];
const PRIORITIES: WorkOrderPriority[] = ['Korkea', 'Normaali', 'Matala'];

const ALL = 'Kaikki';

const formatDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fi-FI');
};

/* ─── Merkit ─── */
const getStatusBadge = (status: WorkOrderStatus) => {
  switch (status) {
    case 'Avoin':
      return <Badge className="bg-info-light text-info border-0 font-medium">Avoin</Badge>;
    case 'Käynnissä':
      return (
        <Badge className="bg-primary-light text-primary border-0 font-medium">Käynnissä</Badge>
      );
    case 'Odottaa':
      return (
        <Badge className="bg-warning-light text-warning border-0 font-medium">Odottaa</Badge>
      );
    case 'Valmis':
      return <Badge className="bg-success-light text-success border-0 font-medium">Valmis</Badge>;
    case 'Peruttu':
      return (
        <Badge className="bg-bg-light text-text-secondary border border-[#E2E8F0] font-medium">
          Peruttu
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const getPriorityBadge = (priority: WorkOrderPriority) => {
  switch (priority) {
    case 'Korkea':
      return <Badge className="bg-danger-light text-danger border-0 font-medium">Korkea</Badge>;
    case 'Normaali':
      return <Badge className="bg-info-light text-info border-0 font-medium">Normaali</Badge>;
    case 'Matala':
      return (
        <Badge className="bg-bg-light text-text-secondary border border-[#E2E8F0] font-medium">
          Matala
        </Badge>
      );
    default:
      return <Badge variant="secondary">{priority}</Badge>;
  }
};

/* ─── Lomake ─── */
interface WorkOrderForm {
  title: string;
  project: string;
  assignee: string;
  dueDate: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  description: string;
}

type FormErrors = Partial<Record<keyof WorkOrderForm, string>>;

const emptyForm: WorkOrderForm = {
  title: '',
  project: '',
  assignee: '',
  dueDate: '',
  priority: 'Normaali',
  status: 'Avoin',
  description: '',
};

/* ─── Komponentti ─── */
export default function Tyomaaraykset() {
  const { workOrders, projects, addWorkOrder, updateWorkOrder, deleteWorkOrder } =
    useAppDataContext();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [priorityFilter, setPriorityFilter] = useState<string>(ALL);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkOrder | null>(null);
  const [form, setForm] = useState<WorkOrderForm>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});

  const projectNames = useMemo(() => projects.map(p => p.name), [projects]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workOrders.filter(wo => {
      const matchesSearch =
        !q ||
        wo.title.toLowerCase().includes(q) ||
        wo.project.toLowerCase().includes(q) ||
        wo.assignee.toLowerCase().includes(q);
      const matchesStatus = statusFilter === ALL || wo.status === statusFilter;
      const matchesPriority = priorityFilter === ALL || wo.priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [workOrders, search, statusFilter, priorityFilter]);

  const openCount = workOrders.filter(wo => wo.status === 'Avoin').length;
  const inProgressCount = workOrders.filter(wo => wo.status === 'Käynnissä').length;
  const doneCount = workOrders.filter(wo => wo.status === 'Valmis').length;
  const highPriorityOpen = workOrders.filter(
    wo => wo.priority === 'Korkea' && wo.status !== 'Valmis' && wo.status !== 'Peruttu',
  ).length;

  const openCreateDialog = () => {
    setEditingOrder(null);
    setForm(emptyForm);
    setErrors({});
    setDialogOpen(true);
  };

  const openEditDialog = (order: WorkOrder) => {
    setEditingOrder(order);
    setForm({
      title: order.title,
      project: order.project,
      assignee: order.assignee,
      dueDate: order.dueDate,
      priority: order.priority,
      status: order.status,
      description: order.description ?? '',
    });
    setErrors({});
    setDialogOpen(true);
  };

  const setField = <K extends keyof WorkOrderForm>(field: K, value: WorkOrderForm[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.title.trim()) next.title = 'Otsikko on pakollinen';
    if (!form.project) next.project = 'Valitse projekti';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const payload = {
      title: form.title.trim(),
      project: form.project,
      assignee: form.assignee.trim(),
      dueDate: form.dueDate,
      priority: form.priority,
      status: form.status,
      description: form.description.trim() || undefined,
    };
    if (editingOrder) {
      updateWorkOrder(editingOrder.id, payload);
    } else {
      addWorkOrder(payload);
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (deleteTarget) {
      deleteWorkOrder(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const statusFilters = [
    { key: ALL, count: workOrders.length, icon: Wrench },
    { key: 'Avoin', count: openCount, icon: Clock },
    { key: 'Käynnissä', count: inProgressCount, icon: Play },
    { key: 'Valmis', count: doneCount, icon: CheckCircle },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-6"
    >
      {/* ── Sivun otsikko ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-body-sm text-text-secondary mb-1">
            <span>Dashboard</span>
            <ChevronRight size={14} />
            <span className="text-text-primary font-medium">Työmääräykset</span>
          </div>
          <h1 className="text-hero text-text-primary">Työmääräykset</h1>
          <p className="text-body-sm text-text-secondary mt-1">
            Työmääräysten hallinta ja seuranta
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="bg-primary hover:bg-primary-hover text-white gap-2"
            onClick={openCreateDialog}
          >
            <Plus size={16} /> Uusi työmääräys
          </Button>
        </div>
      </div>

      {/* ── Tilastot ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Avoimet',
            value: openCount,
            icon: Clock,
            color: 'text-info',
            bg: 'bg-info-light',
          },
          {
            label: 'Käynnissä',
            value: inProgressCount,
            icon: Play,
            color: 'text-primary',
            bg: 'bg-primary-light',
          },
          {
            label: 'Valmiit',
            value: doneCount,
            icon: CheckCircle,
            color: 'text-success',
            bg: 'bg-success-light',
          },
          {
            label: 'Korkea prioriteetti',
            value: highPriorityOpen,
            icon: AlertTriangle,
            color: 'text-danger',
            bg: 'bg-danger-light',
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06, duration: 0.2 }}
          >
            <Card className="border border-[#E2E8F0] shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-caption text-text-secondary uppercase tracking-wider">
                    {stat.label}
                  </span>
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      stat.bg,
                    )}
                  >
                    <stat.icon size={20} className={stat.color} />
                  </div>
                </div>
                <p className="text-[28px] font-bold text-text-primary font-mono leading-none">
                  {stat.value}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── Suodattimet ── */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {statusFilters.map(filter => (
            <button
              key={filter.key}
              onClick={() => setStatusFilter(filter.key)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all',
                statusFilter === filter.key
                  ? 'bg-primary-light border-primary text-primary'
                  : 'bg-white border-[#E2E8F0] text-text-secondary hover:border-[#CBD5E1]',
              )}
            >
              <filter.icon size={14} />
              {filter.key}
              <span className="font-mono text-xs">{filter.count}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 lg:ml-auto">
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[160px] h-10 border-[#E2E8F0]">
              <SelectValue placeholder="Prioriteetti" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Kaikki prioriteetit</SelectItem>
              {PRIORITIES.map(p => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1 lg:w-64">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <Input
              placeholder="Hae työmääräyksiä..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-10 border-[#E2E8F0] focus:border-primary focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* ── Työmääräyslista ── */}
      {workOrders.length === 0 ? (
        <EmptyState
          icon={<Wrench size={40} />}
          title="Ei työmääräyksiä"
          description="Työmääräyksiä ei ole vielä luotu. Lisää ensimmäinen työmääräys aloittaaksesi."
          action={
            <Button
              className="bg-primary hover:bg-primary-hover text-white gap-2"
              onClick={openCreateDialog}
            >
              <Plus size={16} /> Uusi työmääräys
            </Button>
          }
        />
      ) : (
        <Card className="border border-[#E2E8F0] shadow-card overflow-hidden">
          <CardContent className="p-0">
            {/* Taulukon otsikko */}
            <div className="hidden lg:grid lg:grid-cols-[1fr_150px_120px_110px_110px_130px_100px] gap-4 px-6 py-3 bg-bg-light border-b border-[#E2E8F0]">
              <span className="text-caption text-text-muted uppercase tracking-wider font-semibold">
                Otsikko
              </span>
              <span className="text-caption text-text-muted uppercase tracking-wider font-semibold">
                Projekti
              </span>
              <span className="text-caption text-text-muted uppercase tracking-wider font-semibold">
                Vastaava
              </span>
              <span className="text-caption text-text-muted uppercase tracking-wider font-semibold">
                Eräpäivä
              </span>
              <span className="text-caption text-text-muted uppercase tracking-wider font-semibold">
                Prioriteetti
              </span>
              <span className="text-caption text-text-muted uppercase tracking-wider font-semibold">
                Tila
              </span>
              <span className="text-caption text-text-muted uppercase tracking-wider font-semibold text-right">
                Toiminnot
              </span>
            </div>

            {/* Rivit */}
            {filteredOrders.map(order => (
              <div
                key={order.id}
                className={cn(
                  'grid grid-cols-1 lg:grid-cols-[1fr_150px_120px_110px_110px_130px_100px] gap-2 lg:gap-4 px-6 py-4 border-b border-[#F1F5F9] hover:bg-bg-light transition-colors items-center',
                  order.priority === 'Korkea' &&
                    order.status !== 'Valmis' &&
                    order.status !== 'Peruttu' &&
                    'border-l-[3px] border-l-danger',
                )}
              >
                <div>
                  <p className="text-sm font-semibold text-text-primary">{order.title}</p>
                  {order.description && (
                    <p className="text-body-sm text-text-secondary mt-0.5 line-clamp-1">
                      {order.description}
                    </p>
                  )}
                  <div className="flex lg:hidden flex-wrap items-center gap-2 mt-2">
                    {getPriorityBadge(order.priority)}
                    {getStatusBadge(order.status)}
                  </div>
                </div>
                <span className="text-body-sm text-text-secondary hidden lg:block truncate">
                  {order.project}
                </span>
                <span className="text-body-sm text-text-secondary hidden lg:block">
                  {order.assignee || '—'}
                </span>
                <span className="text-body-sm text-text-secondary hidden lg:block">
                  {formatDate(order.dueDate)}
                </span>
                <div className="hidden lg:block">{getPriorityBadge(order.priority)}</div>
                <div className="hidden lg:block">
                  <Select
                    value={order.status}
                    onValueChange={v =>
                      updateWorkOrder(order.id, { status: v as WorkOrderStatus })
                    }
                  >
                    <SelectTrigger className="h-8 w-[120px] border-[#E2E8F0] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map(s => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-text-secondary hover:text-primary"
                    onClick={() => openEditDialog(order)}
                    aria-label={`Muokkaa työmääräystä ${order.title}`}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-text-secondary hover:text-danger"
                    onClick={() => setDeleteTarget(order)}
                    aria-label={`Poista työmääräys ${order.title}`}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            ))}

            {filteredOrders.length === 0 && (
              <div className="p-12 text-center">
                <Wrench size={48} className="mx-auto text-text-muted mb-4" />
                <p className="text-h3 text-text-primary mb-1">Ei hakutuloksia</p>
                <p className="text-body-sm text-text-secondary">
                  Suodattimilla ei löytynyt työmääräyksiä
                </p>
              </div>
            )}

            <div className="flex items-center justify-between px-6 py-3 border-t border-[#E2E8F0] bg-bg-light">
              <span className="text-body-sm text-text-secondary">
                Näytetään {filteredOrders.length} / {workOrders.length}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Luonti-/muokkausdialogi ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-h2">
              {editingOrder ? 'Muokkaa työmääräystä' : 'Uusi työmääräys'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="wo-title">Otsikko *</Label>
              <Input
                id="wo-title"
                value={form.title}
                onChange={e => setField('title', e.target.value)}
                placeholder="esim. LVI-asennus kerrostalo"
                aria-invalid={!!errors.title}
              />
              {errors.title && <p className="text-sm text-danger">{errors.title}</p>}
            </div>
            <div className="space-y-2">
              <Label>Projekti *</Label>
              <Select value={form.project} onValueChange={v => setField('project', v)}>
                <SelectTrigger aria-invalid={!!errors.project}>
                  <SelectValue placeholder="Valitse projekti" />
                </SelectTrigger>
                <SelectContent>
                  {projectNames.map(name => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                  {form.project && !projectNames.includes(form.project) && (
                    <SelectItem value={form.project}>{form.project}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {errors.project && <p className="text-sm text-danger">{errors.project}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="wo-assignee">Vastaava</Label>
                <Input
                  id="wo-assignee"
                  value={form.assignee}
                  onChange={e => setField('assignee', e.target.value)}
                  placeholder="esim. Jukka L."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wo-due">Eräpäivä</Label>
                <Input
                  id="wo-due"
                  type="date"
                  value={form.dueDate}
                  onChange={e => setField('dueDate', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prioriteetti</Label>
                <Select
                  value={form.priority}
                  onValueChange={v => setField('priority', v as WorkOrderPriority)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Valitse prioriteetti" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tila</Label>
                <Select
                  value={form.status}
                  onValueChange={v => setField('status', v as WorkOrderStatus)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Valitse tila" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wo-description">Kuvaus</Label>
              <Textarea
                id="wo-description"
                value={form.description}
                onChange={e => setField('description', e.target.value)}
                placeholder="Työn tarkempi kuvaus..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Peruuta
            </Button>
            <Button
              className="bg-primary hover:bg-primary-hover text-white"
              onClick={handleSave}
            >
              {editingOrder ? 'Tallenna muutokset' : 'Lisää työmääräys'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Poiston vahvistus ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poista työmääräys</AlertDialogTitle>
            <AlertDialogDescription>
              Haluatko varmasti poistaa työmääräyksen{' '}
              <span className="font-semibold">{deleteTarget?.title}</span>? Toimintoa ei voi
              peruuttaa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Peruuta</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger hover:bg-danger/90 text-white"
              onClick={handleDelete}
            >
              Poista
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
