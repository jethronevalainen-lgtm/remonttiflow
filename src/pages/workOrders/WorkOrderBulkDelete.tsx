import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import { deleteManagedWorkOrders } from '@/lib/supabase/workOrderBulkDelete';
import type { ManagedWorkOrder } from '@/lib/supabase/workManagement';
import type { WorkOrderStatus } from '@/types';
import { cn } from '@/lib/utils';

const ALL = 'Kaikki';
const REVIEW_STATUS = 'Hyväksyttävänä';
type DisplayStatus = WorkOrderStatus | typeof REVIEW_STATUS;

interface Props {
  hidden?: boolean;
}

function displayStatus(order: ManagedWorkOrder): DisplayStatus {
  return order.completionRequestedAt && !order.completionApproved
    ? REVIEW_STATUS
    : order.status;
}

function canSelectForDeletion(order: ManagedWorkOrder): boolean {
  return !order.activeSessionId && order.status !== 'Käynnissä';
}

function assignmentLabel(order: ManagedWorkOrder): string {
  if (order.assignmentScope === 'project_team') return 'Koko projektitiimi';
  return order.assigneeNames.length > 0
    ? order.assigneeNames.join(', ')
    : 'Ei vastuuhenkilöä';
}

function statusTone(status: DisplayStatus): string {
  const tones: Record<DisplayStatus, string> = {
    Avoin: 'border-blue-200 bg-blue-50 text-blue-700',
    Käynnissä: 'border-orange-200 bg-orange-50 text-orange-700',
    Odottaa: 'border-amber-200 bg-amber-50 text-amber-700',
    Hyväksyttävänä: 'border-violet-200 bg-violet-50 text-violet-700',
    Valmis: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Peruttu: 'border-slate-200 bg-slate-50 text-slate-600',
  };
  return tones[status];
}

export default function WorkOrderBulkDelete({ hidden = false }: Props) {
  const { currentOrg } = useOrganization();
  const { effectiveRole, isPreviewing } = useViewAs();
  const { workOrders, loading, refresh } = useRoleWorkspace();
  const { refresh: refreshDomain } = useAppDataContext();

  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canDelete = !isPreviewing
    && (effectiveRole === 'admin' || effectiveRole === 'supervisor');

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fi');
    return workOrders.filter((order) => {
      const matchesStatus = statusFilter === ALL || displayStatus(order) === statusFilter;
      const matchesSearch = !query || [
        order.title,
        order.project,
        order.location,
        order.type,
        order.workReference,
        assignmentLabel(order),
      ].some((value) => value.toLocaleLowerCase('fi').includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [search, statusFilter, workOrders]);

  const selectableVisibleOrders = useMemo(
    () => filteredOrders.filter(canSelectForDeletion),
    [filteredOrders],
  );
  const selectedOrders = useMemo(
    () => workOrders.filter((order) => selectedIds.has(order.id)),
    [selectedIds, workOrders],
  );
  const allVisibleSelected = selectableVisibleOrders.length > 0
    && selectableVisibleOrders.every((order) => selectedIds.has(order.id));
  const someVisibleSelected = selectableVisibleOrders.some((order) => selectedIds.has(order.id));

  useEffect(() => {
    const existingIds = new Set(workOrders.map((order) => order.id));
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => existingIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [workOrders]);

  useEffect(() => {
    if (!hidden) return;
    setOpen(false);
    setConfirmOpen(false);
  }, [hidden]);

  const begin = () => {
    setSearch('');
    setStatusFilter(ALL);
    setSelectedIds(new Set());
    setError(null);
    setSuccess(null);
    setOpen(true);
  };

  const toggleOrder = (id: string, selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleVisible = (selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      selectableVisibleOrders.forEach((order) => {
        if (selected) next.add(order.id);
        else next.delete(order.id);
      });
      return next;
    });
  };

  const removeSelected = async () => {
    if (!currentOrg || !canDelete || selectedOrders.length === 0) return;

    setDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      const deletedCount = await deleteManagedWorkOrders({
        organizationId: currentOrg.id,
        workOrderIds: selectedOrders.map((order) => order.id),
      });
      setSelectedIds(new Set());
      setConfirmOpen(false);
      await Promise.all([refresh(), refreshDomain()]);
      setSuccess(`${deletedCount} työmääräystä poistettiin.`);
    } catch (caught) {
      setConfirmOpen(false);
      setError(caught instanceof Error ? caught.message : 'Työmääräysten poistaminen epäonnistui.');
    } finally {
      setDeleting(false);
    }
  };

  if (!canDelete || hidden || !currentOrg) return null;

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        onClick={begin}
        className="fixed bottom-24 right-4 z-40 gap-2 shadow-lg sm:bottom-6 sm:right-6"
      >
        <Trash2 size={17} /> Massapoisto
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !deleting) {
            setOpen(false);
            setConfirmOpen(false);
          }
        }}
      >
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Poista useita työmääräyksiä</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <ShieldCheck size={19} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Poisto on pysyvä ja auditoitu</p>
                <p className="mt-1 leading-5">
                  Kalenterivaraukset ja vastuuhenkilölinkit poistuvat. Aiemmat tuntikirjaukset säilyvät historiassa ilman työmääräyslinkkiä. Aktiivista työaikaa sisältävää työtä ei voi poistaa.
                </p>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle size={17} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}
            {success && (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <CheckCircle2 size={17} className="mt-0.5 shrink-0" /> {success}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-[1fr_13rem]">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Hae työmääräystä, projektia tai vastuuhenkilöä…"
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[ALL, 'Avoin', 'Odottaa', REVIEW_STATUS, 'Valmis', 'Peruttu', 'Käynnissä'].map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="bulk-delete-select-visible"
                    checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                    disabled={selectableVisibleOrders.length === 0 || deleting}
                    onCheckedChange={(checked) => toggleVisible(checked === true)}
                  />
                  <Label htmlFor="bulk-delete-select-visible" className="cursor-pointer">
                    Valitse kaikki näkyvät poistettavat
                  </Label>
                </div>
                <Badge variant="outline" className="bg-white">{selectedIds.size} valittu</Badge>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
                disabled={selectedIds.size === 0 || deleting}
              >
                Tyhjennä valinta
              </Button>
            </div>

            <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
              {loading && (
                <div className="flex min-h-32 items-center justify-center text-sm text-slate-500">
                  <Loader2 size={19} className="mr-2 animate-spin" /> Ladataan työmääräyksiä…
                </div>
              )}

              {!loading && filteredOrders.map((order) => {
                const selectable = canSelectForDeletion(order);
                const currentStatus = displayStatus(order);
                const selected = selectedIds.has(order.id);
                return (
                  <label
                    key={order.id}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-3 transition-colors',
                      selectable ? 'cursor-pointer border-slate-200 hover:bg-slate-50' : 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60',
                      selected && 'border-red-300 bg-red-50 ring-1 ring-red-200',
                    )}
                  >
                    <Checkbox
                      checked={selected}
                      disabled={!selectable || deleting}
                      onCheckedChange={(checked) => toggleOrder(order.id, checked === true)}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-950">{order.title}</p>
                        <Badge variant="outline" className={statusTone(currentStatus)}>{currentStatus}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {order.projectId ? order.project : 'Yksittäinen työ'}
                        {order.location ? ` · ${order.location}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{assignmentLabel(order)}</p>
                      {!selectable && (
                        <p className="mt-2 text-xs font-medium text-orange-700">Päätä aktiivinen työaika ennen poistamista.</p>
                      )}
                    </div>
                  </label>
                );
              })}

              {!loading && filteredOrders.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                  Hakuehdoilla ei löytynyt työmääräyksiä.
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>Sulje</Button>
            <Button
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
              disabled={selectedOrders.length === 0 || deleting}
              className="gap-2"
            >
              <Trash2 size={16} /> Poista valitut ({selectedOrders.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={(next) => !deleting && setConfirmOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poista {selectedOrders.length} työmääräystä?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-slate-600">
                <p>Valitut työmääräykset poistetaan yhtenä atomisena eränä. Toimintoa ei voi perua.</p>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <ul className="space-y-1">
                    {selectedOrders.slice(0, 8).map((order) => (
                      <li key={order.id} className="font-medium text-slate-800">• {order.title}</li>
                    ))}
                  </ul>
                  {selectedOrders.length > 8 && (
                    <p className="mt-2 text-xs text-slate-500">Lisäksi {selectedOrders.length - 8} muuta työmääräystä.</p>
                  )}
                </div>
                <p>Jos yksikin valittu työ sisältää aktiivisen työajan, koko poisto perutaan eikä mitään poisteta.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Peruuta</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void removeSelected()}
              disabled={deleting || selectedOrders.length === 0}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? <><Loader2 size={15} className="mr-2 animate-spin" />Poistetaan…</> : `Poista ${selectedOrders.length} työmääräystä`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
