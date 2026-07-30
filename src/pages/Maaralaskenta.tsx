import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  FilePlus2,
  Layers3,
  Plus,
  RefreshCw,
  Ruler,
  Trash2,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  useFinanceFormsData,
  type QuantityTakeoff,
  type QuantityTakeoffLine,
  type TakeoffStatus,
} from '@/hooks/useFinanceFormsData';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import logger from '@/lib/logger';
import { getOfferPhaseTemplate } from '@/lib/pricing/offerPhases';
import {
  createTakeoff,
  createTakeoffLine,
  createTakeoffLines,
  deleteTakeoff,
  deleteTakeoffLine,
  updateTakeoff,
  updateTakeoffLine,
} from '@/lib/supabase/financeFormsEntities';
import { cn } from '@/lib/utils';
import { SeedPhasesDialog } from './takeoffs/SeedPhasesDialog';
import { TakeoffCreateWizard, type TakeoffCreateDraft } from './takeoffs/TakeoffCreateWizard';
import { TakeoffKpiStrip } from './takeoffs/TakeoffKpiStrip';
import { TakeoffListPanel } from './takeoffs/TakeoffListPanel';
import { TakeoffPhaseGroups } from './takeoffs/TakeoffPhaseGroups';
import { TakeoffSummaryPanel } from './takeoffs/TakeoffSummaryPanel';
import {
  COMMON_UNITS,
  exportTakeoffCsv,
  filterTakeoffs,
  linesFromPhases,
  statusTone,
  TAKEOFF_STATUSES,
} from './takeoffs/takeoffUi';

interface TakeoffForm {
  name: string;
  projectId: string;
  projectName: string;
  status: TakeoffStatus;
  notes: string;
}

interface LineForm {
  workPhase: string;
  description: string;
  quantity: string;
  unit: string;
  wastePercent: string;
  notes: string;
}

const emptyTakeoff: TakeoffForm = {
  name: '',
  projectId: '',
  projectName: '',
  status: 'Luonnos',
  notes: '',
};

const emptyLine: LineForm = {
  workPhase: '',
  description: '',
  quantity: '',
  unit: 'm²',
  wastePercent: '5',
  notes: '',
};

export default function Maaralaskenta() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { projects } = useAppDataContext();
  const { takeoffs, takeoffLines, loading, error, refresh } = useFinanceFormsData();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedId, setSelectedId] = useState(searchParams.get('takeoff') ?? '');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [seedOpen, setSeedOpen] = useState(false);
  const [takeoffDialogOpen, setTakeoffDialogOpen] = useState(false);
  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [editingTakeoff, setEditingTakeoff] = useState<QuantityTakeoff | null>(null);
  const [editingLine, setEditingLine] = useState<QuantityTakeoffLine | null>(null);
  const [deleteTakeoffTarget, setDeleteTakeoffTarget] = useState<QuantityTakeoff | null>(null);
  const [deleteLineTarget, setDeleteLineTarget] = useState<QuantityTakeoffLine | null>(null);
  const [takeoffForm, setTakeoffForm] = useState<TakeoffForm>(emptyTakeoff);
  const [lineForm, setLineForm] = useState<LineForm>(emptyLine);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filteredTakeoffs = useMemo(
    () => filterTakeoffs(takeoffs, takeoffLines, search, statusFilter),
    [takeoffs, takeoffLines, search, statusFilter],
  );

  const selectedTakeoff = useMemo(() => {
    if (selectedId) {
      const match = takeoffs.find((item) => item.id === selectedId);
      if (match) return match;
    }
    return filteredTakeoffs[0] ?? takeoffs[0] ?? null;
  }, [selectedId, takeoffs, filteredTakeoffs]);

  const selectedLines = useMemo(
    () => (selectedTakeoff
      ? takeoffLines.filter((line) => line.takeoffId === selectedTakeoff.id)
      : []),
    [selectedTakeoff, takeoffLines],
  );

  const existingPhases = useMemo(
    () => [...new Set(selectedLines.map((line) => line.workPhase))],
    [selectedLines],
  );

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (selectedTakeoff?.id) next.set('takeoff', selectedTakeoff.id);
    else next.delete('takeoff');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [selectedTakeoff?.id, searchParams, setSearchParams]);

  const selectTakeoff = (takeoffId: string) => {
    setSelectedId(takeoffId);
    setOperationError(null);
    setSuccessMessage(null);
  };

  const flashSuccess = (message: string) => {
    setSuccessMessage(message);
    setOperationError(null);
  };

  const openTakeoffEdit = (takeoff: QuantityTakeoff) => {
    setEditingTakeoff(takeoff);
    setTakeoffForm({
      name: takeoff.name,
      projectId: takeoff.projectId ?? '',
      projectName: takeoff.projectName,
      status: takeoff.status,
      notes: takeoff.notes,
    });
    setFormErrors([]);
    setTakeoffDialogOpen(true);
  };

  const saveTakeoffEdit = async () => {
    const nextErrors: string[] = [];
    if (!takeoffForm.name.trim()) nextErrors.push('Määrälaskelman nimi on pakollinen.');
    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg || !editingTakeoff) return;

    setSaving(true);
    try {
      await updateTakeoff(currentOrg.id, editingTakeoff.id, {
        name: takeoffForm.name.trim(),
        projectId: takeoffForm.projectId || undefined,
        projectName: takeoffForm.projectName.trim(),
        status: takeoffForm.status,
        notes: takeoffForm.notes.trim(),
      });
      await refresh();
      setTakeoffDialogOpen(false);
      flashSuccess('Määrälaskelma päivitettiin.');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Tallennus epäonnistui.';
      setOperationError(message);
      logger.error('Määrälaskelman päivitys epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  const createFromWizard = async (draft: TakeoffCreateDraft) => {
    const nextErrors: string[] = [];
    if (!draft.name.trim()) nextErrors.push('Määrälaskelman nimi on pakollinen.');
    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg) return;

    setSaving(true);
    setOperationError(null);
    try {
      const takeoffId = await createTakeoff(currentOrg.id, user?.id, {
        name: draft.name.trim(),
        projectId: draft.projectId || undefined,
        projectName: draft.projectName.trim(),
        status: draft.status,
        notes: draft.notes.trim(),
      });
      const seeded = linesFromPhases(takeoffId, draft.phases);
      await createTakeoffLines(currentOrg.id, user?.id, seeded);
      await refresh();
      setSelectedId(takeoffId);
      setCreateOpen(false);
      flashSuccess(
        seeded.length > 0
          ? `Määrälaskelma luotiin ${seeded.length} työvaiheella. Täydennä määrät.`
          : 'Määrälaskelma luotiin.',
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Luonti epäonnistui.';
      setFormErrors([message]);
      setOperationError(message);
      logger.error('Määrälaskelman luonti epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  const openLineCreate = (workPhase = '') => {
    if (!selectedTakeoff) return;
    setEditingLine(null);
    setLineForm({ ...emptyLine, workPhase });
    setFormErrors([]);
    setLineDialogOpen(true);
  };

  const openLineEdit = (line: QuantityTakeoffLine) => {
    setEditingLine(line);
    setLineForm({
      workPhase: line.workPhase,
      description: line.description,
      quantity: String(line.quantity),
      unit: line.unit,
      wastePercent: String(line.wastePercent),
      notes: line.notes,
    });
    setFormErrors([]);
    setLineDialogOpen(true);
  };

  const saveLine = async () => {
    const quantity = Number(lineForm.quantity.replace(',', '.'));
    const wastePercent = Number(lineForm.wastePercent.replace(',', '.'));
    const nextErrors: string[] = [];
    if (!selectedTakeoff) nextErrors.push('Valitse määrälaskelma.');
    if (!lineForm.workPhase.trim()) nextErrors.push('Työvaihe on pakollinen.');
    if (!lineForm.description.trim()) nextErrors.push('Kuvaus on pakollinen.');
    if (!Number.isFinite(quantity) || quantity < 0) nextErrors.push('Määrä ei voi olla negatiivinen.');
    if (!lineForm.unit.trim()) nextErrors.push('Yksikkö on pakollinen.');
    if (!Number.isFinite(wastePercent) || wastePercent < 0 || wastePercent > 100) {
      nextErrors.push('Hukan pitää olla 0–100 %.');
    }
    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg || !selectedTakeoff) return;

    const payload: Omit<QuantityTakeoffLine, 'id'> = {
      takeoffId: selectedTakeoff.id,
      workPhase: lineForm.workPhase.trim(),
      description: lineForm.description.trim(),
      quantity,
      unit: lineForm.unit.trim(),
      wastePercent,
      notes: lineForm.notes.trim(),
    };
    setSaving(true);
    try {
      if (editingLine) await updateTakeoffLine(currentOrg.id, editingLine.id, payload);
      else await createTakeoffLine(currentOrg.id, user?.id, payload);
      await refresh();
      setLineDialogOpen(false);
      flashSuccess(editingLine ? 'Määrärivi päivitettiin.' : 'Määrärivi lisättiin.');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Tallennus epäonnistui.';
      setOperationError(message);
      logger.error('Määrärivin tallennus epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  const seedFromTemplate = async (templateId: string) => {
    if (!currentOrg || !selectedTakeoff) return;
    const template = getOfferPhaseTemplate(templateId);
    const skip = new Set(existingPhases.map((phase) => phase.toLocaleLowerCase('fi-FI')));
    const lines = linesFromPhases(selectedTakeoff.id, template.phases, { skipExistingPhases: skip });
    if (lines.length === 0) return;
    setSaving(true);
    try {
      await createTakeoffLines(currentOrg.id, user?.id, lines);
      await refresh();
      setSeedOpen(false);
      flashSuccess(`Lisättiin ${lines.length} työvaihetta pohjasta “${template.name}”.`);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Pohjan lisäys epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const markReady = async () => {
    if (!currentOrg || !selectedTakeoff) return;
    setSaving(true);
    try {
      await updateTakeoff(currentOrg.id, selectedTakeoff.id, { status: 'Valmis' });
      await refresh();
      flashSuccess('Määrälaskelma merkitty valmiiksi.');
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tilapäivitys epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const duplicateTakeoff = async () => {
    if (!currentOrg || !selectedTakeoff) return;
    setSaving(true);
    try {
      const takeoffId = await createTakeoff(currentOrg.id, user?.id, {
        name: `${selectedTakeoff.name} (kopio)`,
        projectId: selectedTakeoff.projectId,
        projectName: selectedTakeoff.projectName,
        status: 'Luonnos',
        notes: selectedTakeoff.notes,
      });
      await createTakeoffLines(
        currentOrg.id,
        user?.id,
        selectedLines.map((line) => ({
          takeoffId,
          workPhase: line.workPhase,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          wastePercent: line.wastePercent,
          notes: line.notes,
        })),
      );
      await refresh();
      setSelectedId(takeoffId);
      flashSuccess('Määrälaskelma kopioitiin.');
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Kopiointi epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const removeTakeoff = async () => {
    if (!currentOrg || !deleteTakeoffTarget) return;
    setSaving(true);
    try {
      await deleteTakeoff(currentOrg.id, deleteTakeoffTarget.id);
      if (selectedId === deleteTakeoffTarget.id) setSelectedId('');
      await refresh();
      setDeleteTakeoffTarget(null);
      flashSuccess('Määrälaskelma poistettiin.');
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const removeLine = async () => {
    if (!currentOrg || !deleteLineTarget) return;
    setSaving(true);
    try {
      await deleteTakeoffLine(currentOrg.id, deleteLineTarget.id);
      await refresh();
      setDeleteLineTarget(null);
      flashSuccess('Määrärivi poistettiin.');
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const unitSuggestions = useMemo(() => {
    const used = selectedLines.map((line) => line.unit).filter(Boolean);
    return [...new Set([...COMMON_UNITS, ...used])];
  }, [selectedLines]);

  const phaseSuggestions = useMemo(() => {
    const fromSelected = existingPhases;
    const fromAll = takeoffLines.map((line) => line.workPhase).filter(Boolean);
    return [...new Set([...fromSelected, ...fromAll])].sort((a, b) => a.localeCompare(b, 'fi'));
  }, [existingPhases, takeoffLines]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-hero text-text-primary">Määrälaskenta</h1>
          <p className="mt-1 max-w-2xl break-words text-body-sm text-text-secondary">
            Kerää työvaihekohtaiset määrät, yksiköt ja hukkaprosentit — vie sitten valmiit rivit
            suoraan tarjouslaskentaan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw size={16} className={cn('mr-2', loading && 'animate-spin')} />
            Päivitä
          </Button>
          <Button asChild variant="outline">
            <Link to="/tarjoukset"><FilePlus2 size={16} className="mr-2" /> Tarjoukset</Link>
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus size={16} /> Uusi määrälaskelma
          </Button>
        </div>
      </div>

      <TakeoffKpiStrip takeoffs={takeoffs} takeoffLines={takeoffLines} />

      {(error || operationError) && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p className="break-words">{operationError ?? error}</p>
        </div>
      )}
      {successMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <p className="break-words">{successMessage}</p>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <TakeoffListPanel
          takeoffs={filteredTakeoffs}
          takeoffLines={takeoffLines}
          selectedTakeoffId={selectedTakeoff?.id}
          search={search}
          statusFilter={statusFilter}
          loading={loading}
          onSearchChange={setSearch}
          onStatusFilterChange={setStatusFilter}
          onSelect={selectTakeoff}
        />

        {selectedTakeoff ? (
          <div className="space-y-4">
            <Card className="border-slate-200/80 shadow-none">
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="break-words text-xl font-bold text-slate-900">{selectedTakeoff.name}</h2>
                      <Badge variant="outline" className={statusTone(selectedTakeoff.status)}>
                        {selectedTakeoff.status}
                      </Badge>
                    </div>
                    <p className="mt-1 break-words text-sm text-slate-600">
                      {selectedTakeoff.projectName || 'Ei projektia'}
                      {selectedTakeoff.notes ? ` · ${selectedTakeoff.notes}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => openTakeoffEdit(selectedTakeoff)}>
                      <Edit3 size={15} className="mr-1" /> Muokkaa
                    </Button>
                    <Button variant="outline" onClick={() => exportTakeoffCsv(selectedTakeoff.name, selectedLines)}>
                      <Download size={15} className="mr-1" /> CSV
                    </Button>
                    <Button variant="outline" onClick={() => void duplicateTakeoff()} disabled={saving}>
                      <Copy size={15} className="mr-1" /> Kopioi
                    </Button>
                    {selectedTakeoff.status !== 'Valmis' && (
                      <Button variant="outline" onClick={() => void markReady()} disabled={saving}>
                        <CheckCircle2 size={15} className="mr-1" /> Merkitse valmiiksi
                      </Button>
                    )}
                    <Button asChild>
                      <Link to={`/tarjoukset?importTakeoff=${selectedTakeoff.id}`}>
                        <FilePlus2 size={15} className="mr-1" /> Vie tarjoukseen
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-danger"
                      onClick={() => setDeleteTakeoffTarget(selectedTakeoff)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => openLineCreate()} className="gap-2">
                    <Plus size={15} /> Lisää määrärivi
                  </Button>
                  <Button variant="outline" onClick={() => setSeedOpen(true)} className="gap-2">
                    <Layers3 size={15} /> Lisää työvaihepohjasta
                  </Button>
                </div>
              </CardContent>
            </Card>

            <TakeoffSummaryPanel lines={selectedLines} />
            <TakeoffPhaseGroups
              lines={selectedLines}
              onEdit={openLineEdit}
              onDelete={setDeleteLineTarget}
            />
          </div>
        ) : (
          <Card className="border-slate-200/80 shadow-none">
            <CardContent className="p-12 text-center">
              <Ruler size={42} className="mx-auto mb-3 text-slate-300" />
              <p className="font-semibold text-slate-900">Valitse tai luo määrälaskelma</p>
              <p className="mt-1 break-words text-sm text-slate-500">
                Aloita uudella laskelmalla ja työvaihepohjalla — täydennä määrät vaiheittain.
              </p>
              <Button className="mt-4 gap-2" onClick={() => setCreateOpen(true)}>
                <Plus size={16} /> Uusi määrälaskelma
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <TakeoffCreateWizard
        open={createOpen}
        saving={saving}
        errors={formErrors}
        projects={projects.map((project) => ({ id: project.id, name: project.name }))}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setFormErrors([]);
        }}
        onSubmit={(draft) => void createFromWizard(draft)}
      />

      <SeedPhasesDialog
        open={seedOpen}
        saving={saving}
        existingPhases={existingPhases}
        onOpenChange={setSeedOpen}
        onSeed={(templateId) => void seedFromTemplate(templateId)}
      />

      <Dialog open={takeoffDialogOpen} onOpenChange={setTakeoffDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Muokkaa määrälaskelmaa</DialogTitle>
          </DialogHeader>
          {formErrors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formErrors.map((item) => <p key={item} className="break-words">{item}</p>)}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="takeoff-name">Nimi *</Label>
              <Input
                id="takeoff-name"
                value={takeoffForm.name}
                onChange={(event) => setTakeoffForm((previous) => ({ ...previous, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Projekti</Label>
              {projects.length > 0 ? (
                <Select
                  value={takeoffForm.projectId || '__none__'}
                  onValueChange={(projectId) => {
                    if (projectId === '__none__') {
                      setTakeoffForm((previous) => ({ ...previous, projectId: '', projectName: '' }));
                      return;
                    }
                    const project = projects.find((item) => item.id === projectId);
                    setTakeoffForm((previous) => ({
                      ...previous,
                      projectId,
                      projectName: project?.name ?? previous.projectName,
                    }));
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Valitse projekti" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Ei projektia</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={takeoffForm.projectName}
                  onChange={(event) => setTakeoffForm((previous) => ({
                    ...previous,
                    projectName: event.target.value,
                  }))}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Tila</Label>
              <Select
                value={takeoffForm.status}
                onValueChange={(status: TakeoffStatus) => setTakeoffForm((previous) => ({ ...previous, status }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TAKEOFF_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="takeoff-notes">Huomiot</Label>
              <Textarea
                id="takeoff-notes"
                value={takeoffForm.notes}
                onChange={(event) => setTakeoffForm((previous) => ({ ...previous, notes: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTakeoffDialogOpen(false)} disabled={saving}>Peruuta</Button>
            <Button onClick={() => void saveTakeoffEdit()} disabled={saving}>
              {saving ? 'Tallennetaan…' : 'Tallenna'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={lineDialogOpen} onOpenChange={setLineDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingLine ? 'Muokkaa määräriviä' : 'Uusi määrärivi'}</DialogTitle>
          </DialogHeader>
          {formErrors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formErrors.map((item) => <p key={item} className="break-words">{item}</p>)}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="takeoff-phase">Työvaihe *</Label>
              <Input
                id="takeoff-phase"
                list="takeoff-phase-suggestions"
                value={lineForm.workPhase}
                onChange={(event) => setLineForm((previous) => ({ ...previous, workPhase: event.target.value }))}
                placeholder="Esim. Laatoitus ja pinnat"
              />
              <datalist id="takeoff-phase-suggestions">
                {phaseSuggestions.map((phase) => <option key={phase} value={phase} />)}
              </datalist>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="takeoff-description">Kuvaus *</Label>
              <Input
                id="takeoff-description"
                value={lineForm.description}
                onChange={(event) => setLineForm((previous) => ({ ...previous, description: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="takeoff-quantity">Määrä</Label>
              <Input
                id="takeoff-quantity"
                type="number"
                min="0"
                step="0.001"
                value={lineForm.quantity}
                onChange={(event) => setLineForm((previous) => ({ ...previous, quantity: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="takeoff-unit">Yksikkö *</Label>
              <Input
                id="takeoff-unit"
                list="takeoff-unit-suggestions"
                value={lineForm.unit}
                onChange={(event) => setLineForm((previous) => ({ ...previous, unit: event.target.value }))}
              />
              <datalist id="takeoff-unit-suggestions">
                {unitSuggestions.map((unit) => <option key={unit} value={unit} />)}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="takeoff-waste">Hukka %</Label>
              <Input
                id="takeoff-waste"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={lineForm.wastePercent}
                onChange={(event) => setLineForm((previous) => ({ ...previous, wastePercent: event.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="takeoff-line-notes">Huomiot</Label>
              <Textarea
                id="takeoff-line-notes"
                value={lineForm.notes}
                onChange={(event) => setLineForm((previous) => ({ ...previous, notes: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLineDialogOpen(false)} disabled={saving}>Peruuta</Button>
            <Button onClick={() => void saveLine()} disabled={saving}>
              {saving ? 'Tallennetaan…' : 'Tallenna'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTakeoffTarget)} onOpenChange={(open) => !open && setDeleteTakeoffTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Poista määrälaskelma</DialogTitle></DialogHeader>
          <p className="break-words text-sm text-text-secondary">
            Poistetaanko <strong>{deleteTakeoffTarget?.name}</strong> ja kaikki sen rivit?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTakeoffTarget(null)}>Peruuta</Button>
            <Button variant="destructive" onClick={() => void removeTakeoff()} disabled={saving}>Poista</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteLineTarget)} onOpenChange={(open) => !open && setDeleteLineTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Poista määrärivi</DialogTitle></DialogHeader>
          <p className="break-words text-sm text-text-secondary">
            Poistetaanko <strong>{deleteLineTarget?.description}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteLineTarget(null)}>Peruuta</Button>
            <Button variant="destructive" onClick={() => void removeLine()} disabled={saving}>Poista</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
