import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  HardHat,
  Loader2,
  ShieldCheck,
  Trash2,
  XCircle,
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
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import {
  reviewWorkOrderCompletion,
  saveManagedWorkOrder,
  type ManagedWorkOrder,
} from '@/lib/supabase/workManagement';
import { cn } from '@/lib/utils';
import LegacyWorkOrders from './Tyomaaraykset';
import WorkOrderControlPanel from './workOrders/WorkOrderControlPanel';
import WorkOrderDialog from './workOrders/WorkOrderDialog';
import {
  EMPTY_WORK_ORDER_FORM,
  type WorkOrderFormValues,
} from './workOrders/workOrderForm';

export default function TyomaarayksetV2() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
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

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedWorkOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedWorkOrder | null>(null);
  const [reviewTarget, setReviewTarget] = useState<ManagedWorkOrder | null>(null);
  const [reviewApproved, setReviewApproved] = useState(true);
  const [reviewNote, setReviewNote] = useState('');
  const [form, setForm] = useState<WorkOrderFormValues>(EMPTY_WORK_ORDER_FORM);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationSuccess, setOperationSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const projectFilterId = new URLSearchParams(location.search).get('project') ?? '';
  const selectedProjectMemberIds = new Set(
    projectMemberships
      .filter((membership) => membership.projectId === form.projectId)
      .map((membership) => membership.userId),
  );
  const organizationUserIds = new Set(people.map((person) => person.userId));

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const projectId = params.get('project');
    if (!canManage || params.get('new') !== '1' || !projectId || !projects.some((project) => project.id === projectId)) return;

    setEditing(null);
    setForm({ ...EMPTY_WORK_ORDER_FORM, projectId });
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
    navigate(`/tyomaaraykset?project=${encodeURIComponent(projectId)}`, { replace: true });
  }, [canManage, location.search, navigate, projects]);

  if (!canManage) return <LegacyWorkOrders />;

  const refreshEverything = async () => {
    await Promise.all([refresh(), refreshDomain()]);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_WORK_ORDER_FORM, projectId: projectFilterId });
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const openEdit = (order: ManagedWorkOrder) => {
    setEditing(order);
    setForm({
      title: order.title,
      projectId: order.projectId ?? '',
      location: order.location,
      dueDate: order.dueDate,
      plannedStartDate: order.plannedStartDate,
      plannedEndDate: order.plannedEndDate,
      plannedStartTime: order.plannedStartTime,
      plannedEndTime: order.plannedEndTime,
      plannedWeekdays: order.plannedWeekdays,
      calendarSyncEnabled: order.calendarSyncEnabled,
      occupancyStatus: order.occupancyStatus,
      workReference: order.workReference,
      startConstraints: order.startConstraints,
      accessNotes: order.accessNotes,
      residentNotificationRequired: order.residentNotificationRequired,
      priority: order.priority,
      status: order.status,
      type: order.type,
      description: order.description,
      assignmentScope: order.projectId ? order.assignmentScope : 'people',
      assigneeUserIds: order.assigneeUserIds,
    });
    setFormErrors([]);
    setOperationError(null);
    setDialogOpen(true);
  };

  const validateForm = () => {
    const errors: string[] = [];
    if (!form.title.trim()) errors.push('Työmääräyksen otsikko on pakollinen.');
    if (form.assignmentScope === 'people' && form.assigneeUserIds.length === 0) {
      errors.push('Valitse vähintään yksi vastuuhenkilö.');
    }
    if (!form.projectId && form.assignmentScope === 'project_team') {
      errors.push('Koko projektitiimi voidaan valita vain projektiin liitetylle työmääräykselle.');
    }
    if (
      form.projectId
      && form.assignmentScope === 'people'
      && form.assigneeUserIds.some((userId) => !selectedProjectMemberIds.has(userId))
    ) {
      errors.push('Projektiin liitetyn työmääräyksen vastuuhenkilöiden täytyy kuulua projektitiimiin.');
    }
    if (!form.projectId && form.assigneeUserIds.some((userId) => !organizationUserIds.has(userId))) {
      errors.push('Vastuuhenkilön täytyy kuulua organisaatioon.');
    }
    if (form.projectId && form.assignmentScope === 'project_team' && selectedProjectMemberIds.size === 0) {
      errors.push('Valitulla projektilla ei ole projektitiimiä. Lisää tiimi ennen koko tiimille kohdistamista.');
    }
    if (form.plannedEndDate && !form.plannedStartDate) {
      errors.push('Valitse työn aloituspäivä ennen suunniteltua valmistumista.');
    }
    if (form.plannedStartDate && !form.plannedEndDate) {
      errors.push('Valitse suunniteltu valmistumispäivä.');
    }
    if (form.plannedStartDate && form.plannedEndDate < form.plannedStartDate) {
      errors.push('Suunniteltu valmistuminen ei voi olla ennen aloituspäivää.');
    }
    if (form.plannedStartDate && form.plannedEndTime <= form.plannedStartTime) {
      errors.push('Päivittäisen päättymisajan pitää olla alkamisajan jälkeen.');
    }
    if (form.plannedStartDate && form.plannedWeekdays.length === 0) {
      errors.push('Valitse vähintään yksi työpäivä.');
    }
    if (form.dueDate && form.plannedEndDate && form.dueDate < form.plannedEndDate) {
      errors.push('Määräpäivä ei voi olla ennen suunniteltua valmistumista.');
    }
    return errors;
  };

  const save = async () => {
    const errors = validateForm();
    setFormErrors(errors);
    if (errors.length > 0 || !currentOrg) return;

    setSaving(true);
    setOperationError(null);
    setOperationSuccess(null);
    try {
      await saveManagedWorkOrder({
        organizationId: currentOrg.id,
        workOrderId: editing?.id,
        projectId: form.projectId || undefined,
        title: form.title.trim(),
        location: form.location.trim(),
        dueDate: form.dueDate,
        plannedStartDate: form.plannedStartDate,
        plannedEndDate: form.plannedEndDate,
        plannedStartTime: form.plannedStartTime,
        plannedEndTime: form.plannedEndTime,
        plannedWeekdays: form.plannedWeekdays,
        calendarSyncEnabled: form.calendarSyncEnabled,
        occupancyStatus: form.occupancyStatus,
        workReference: form.workReference.trim(),
        startConstraints: form.startConstraints.trim(),
        accessNotes: form.accessNotes.trim(),
        residentNotificationRequired: form.residentNotificationRequired,
        priority: form.priority,
        status: form.status,
        description: form.description.trim(),
        type: form.type.trim(),
        assignmentScope: form.projectId ? form.assignmentScope : 'people',
        assigneeUserIds: form.assignmentScope === 'people' ? form.assigneeUserIds : [],
      });
      await refreshEverything();
      setDialogOpen(false);
      setOperationSuccess(editing ? 'Työmääräys päivitettiin.' : 'Työmääräys luotiin.');
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setOperationError(null);
    setOperationSuccess(null);
    try {
      const removed = await deleteWorkOrder(deleteTarget.id);
      if (!removed) throw new Error('Työmääräyksen poistaminen epäonnistui.');
      setDeleteTarget(null);
      await refreshEverything();
      setOperationSuccess('Työmääräys poistettiin.');
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const openReview = (order: ManagedWorkOrder, approved: boolean) => {
    setReviewTarget(order);
    setReviewApproved(approved);
    setReviewNote('');
    setOperationError(null);
  };

  const reviewCompletion = async () => {
    if (!reviewTarget) return;
    const note = reviewNote.trim();
    if (!reviewApproved && note.length < 3) {
      setOperationError('Kirjoita, mitä työssä pitää korjata tai jatkaa.');
      return;
    }

    setSaving(true);
    setOperationError(null);
    setOperationSuccess(null);
    try {
      await reviewWorkOrderCompletion({
        workOrderId: reviewTarget.id,
        approved: reviewApproved,
        reviewNote: note,
      });
      await refreshEverything();
      setReviewTarget(null);
      setOperationSuccess(reviewApproved ? 'Työ hyväksyttiin valmiiksi.' : 'Työ palautettiin tekijälle jatkettavaksi.');
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Valmistumispyynnön käsittely epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  if (!currentOrg) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <AlertTriangle size={20} className="mr-2" /> Aktiivista organisaatiota ei ole valittu.
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-[1800px] space-y-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
              <HardHat size={16} /> Operatiivinen työnhallinta
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Työmääräykset</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Kohdista työt, seuraa aikatauluja ja työaikaa, käsittele valmistumiset sekä ohjaa laskutus samasta näkymästä.
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2 bg-orange-500 text-white hover:bg-orange-600">
            Luo työmääräys
          </Button>
        </div>
      </div>

      {operationError && !reviewTarget && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" /> {operationError}
        </div>
      )}
      {operationSuccess && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" /> {operationSuccess}
        </div>
      )}

      <WorkOrderControlPanel
        canCreate
        error={error}
        loading={loading}
        organizationId={currentOrg.id}
        orders={workOrders}
        people={people}
        projectFilterId={projectFilterId}
        projectMemberships={projectMemberships}
        projects={projects}
        onCreate={openCreate}
        onDelete={setDeleteTarget}
        onEdit={openEdit}
        onRefresh={refreshEverything}
        onReview={openReview}
      />

      <WorkOrderDialog
        open={dialogOpen}
        editing={Boolean(editing)}
        saving={saving}
        errors={formErrors}
        form={form}
        projects={projects}
        people={people}
        projectMemberships={projectMemberships}
        onChange={setForm}
        onClose={() => setDialogOpen(false)}
        onSave={() => void save()}
      />

      <Dialog
        open={Boolean(reviewTarget)}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setReviewTarget(null);
            setOperationError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{reviewApproved ? 'Hyväksy työ valmiiksi' : 'Palauta työ jatkettavaksi'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {operationError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle size={17} className="mt-0.5 shrink-0" /> {operationError}
              </div>
            )}
            <div className={cn(
              'rounded-xl border p-4 text-sm',
              reviewApproved
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                : 'border-amber-200 bg-amber-50 text-amber-950',
            )}>
              <p className="flex items-center gap-2 font-semibold">
                {reviewApproved ? <ShieldCheck size={17} /> : <XCircle size={17} />}
                {reviewTarget?.title}
              </p>
              <p className="mt-2 whitespace-pre-wrap leading-6">{reviewTarget?.completionRequestNote}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-note">
                {reviewApproved ? 'Hyväksynnän huomio' : 'Mitä pitää korjata tai jatkaa? *'}
              </Label>
              <Textarea
                id="review-note"
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder={reviewApproved ? 'Valinnainen huomio hyväksynnästä' : 'Anna tekijälle selkeä korjausohje.'}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewTarget(null)} disabled={saving}>Peruuta</Button>
            <Button
              onClick={() => void reviewCompletion()}
              disabled={saving}
              className={reviewApproved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}
            >
              {saving ? <><Loader2 size={15} className="mr-2 animate-spin" />Tallennetaan…</> : reviewApproved ? 'Hyväksy valmiiksi' : 'Palauta jatkettavaksi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Trash2 size={18} /> Poista työmääräys</AlertDialogTitle>
            <AlertDialogDescription>
              Poistetaanko <strong>{deleteTarget?.title}</strong>? Myös siihen linkitetyt kalenterivaraukset poistetaan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Peruuta</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()} disabled={saving} className="bg-red-600 hover:bg-red-700">
              Poista
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
