import { useState } from 'react';
import { Layers3 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { TakeoffStatus } from '@/hooks/useFinanceFormsData';
import {
  getOfferPhaseTemplate,
  OFFER_PHASE_TEMPLATES,
  type OfferPhaseDefinition,
} from '@/lib/pricing/offerPhases';
import { cn } from '@/lib/utils';
import { TAKEOFF_STATUSES } from './takeoffUi';

export interface TakeoffCreateDraft {
  name: string;
  projectId: string;
  projectName: string;
  status: TakeoffStatus;
  notes: string;
  templateId: string;
  phases: OfferPhaseDefinition[];
}

interface ProjectOption {
  id: string;
  name: string;
}

interface TakeoffCreateWizardProps {
  open: boolean;
  saving: boolean;
  errors: string[];
  projects: ProjectOption[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: TakeoffCreateDraft) => void;
}

const emptyDraft = (): TakeoffCreateDraft => ({
  name: '',
  projectId: '',
  projectName: '',
  status: 'Luonnos',
  notes: '',
  templateId: 'blank',
  phases: [],
});

export function TakeoffCreateWizard({
  open,
  saving,
  errors,
  projects,
  onOpenChange,
  onSubmit,
}: TakeoffCreateWizardProps) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<TakeoffCreateDraft>(emptyDraft);

  const reset = () => {
    setStep(1);
    setDraft(emptyDraft());
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const selectTemplate = (templateId: string) => {
    const template = getOfferPhaseTemplate(templateId);
    setDraft((previous) => ({
      ...previous,
      templateId,
      phases: template.phases,
      name: previous.name.trim() || (templateId === 'blank' ? previous.name : template.name),
    }));
  };

  const canContinue = draft.name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Uusi määrälaskelma</DialogTitle>
        </DialogHeader>

        <div className="mb-2 flex flex-wrap gap-2">
          {[
            { id: 1, label: 'Perustiedot' },
            { id: 2, label: 'Työvaiheet' },
            { id: 3, label: 'Valmis' },
          ].map((item) => (
            <Badge
              key={item.id}
              variant="outline"
              className={cn(
                step === item.id
                  ? 'border-orange-300 bg-orange-50 text-orange-800'
                  : step > item.id
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'text-slate-500',
              )}
            >
              {item.id}. {item.label}
            </Badge>
          ))}
        </div>

        {errors.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errors.map((item) => <p key={item} className="break-words">{item}</p>)}
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="takeoff-create-name">Nimi *</Label>
              <Input
                id="takeoff-create-name"
                value={draft.name}
                onChange={(event) => setDraft((previous) => ({ ...previous, name: event.target.value }))}
                placeholder="Esim. Demokatu 12 – määrät"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Projekti</Label>
              {projects.length > 0 ? (
                <Select
                  value={draft.projectId || '__none__'}
                  onValueChange={(projectId) => {
                    if (projectId === '__none__') {
                      setDraft((previous) => ({ ...previous, projectId: '', projectName: '' }));
                      return;
                    }
                    const project = projects.find((item) => item.id === projectId);
                    setDraft((previous) => ({
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
                  value={draft.projectName}
                  onChange={(event) => setDraft((previous) => ({
                    ...previous,
                    projectName: event.target.value,
                  }))}
                  placeholder="Projektin nimi"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Tila</Label>
              <Select
                value={draft.status}
                onValueChange={(status: TakeoffStatus) => setDraft((previous) => ({ ...previous, status }))}
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
              <Label htmlFor="takeoff-create-notes">Huomiot</Label>
              <Textarea
                id="takeoff-create-notes"
                value={draft.notes}
                onChange={(event) => setDraft((previous) => ({ ...previous, notes: event.target.value }))}
                placeholder="Mittauspäivä, pohjakuvat, rajaukset…"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Valitse työvaihepohja. Pohja luo määrärivit valmiiksi — täydennä vain määrät.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {OFFER_PHASE_TEMPLATES.map((template) => {
                const active = draft.templateId === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => selectTemplate(template.id)}
                    className={cn(
                      'rounded-xl border p-4 text-left transition',
                      active
                        ? 'border-orange-400 bg-orange-50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                    )}
                  >
                    <p className="break-words font-semibold text-slate-900">{template.name}</p>
                    <p className="mt-1 break-words text-xs text-slate-500">{template.summary}</p>
                    <p className="mt-2 text-xs font-medium text-slate-600">
                      {template.phases.length > 0
                        ? `${template.phases.length} työvaihetta`
                        : 'Ilman valmiita vaiheita'}
                    </p>
                  </button>
                );
              })}
            </div>
            {draft.phases.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Layers3 size={16} className="text-orange-600" />
                  <p className="font-semibold text-slate-900">Luotavat rivit</p>
                  <Badge variant="outline">{draft.phases.length}</Badge>
                </div>
                <ol className="space-y-2">
                  {draft.phases.map((phase, index) => (
                    <li key={phase.title} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <p className="break-words text-sm font-semibold text-slate-900">
                        {index + 1}. {phase.title}
                      </p>
                      <p className="mt-0.5 break-words text-xs text-slate-500">{phase.description}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">Tarkista ennen luontia</p>
            <p className="break-words text-sm text-slate-700"><span className="text-slate-500">Nimi:</span> {draft.name || '—'}</p>
            <p className="break-words text-sm text-slate-700">
              <span className="text-slate-500">Projekti:</span> {draft.projectName || 'Ei projektia'}
            </p>
            <p className="break-words text-sm text-slate-700"><span className="text-slate-500">Tila:</span> {draft.status}</p>
            <p className="break-words text-sm text-slate-700">
              <span className="text-slate-500">Työvaiheet:</span>{' '}
              {draft.phases.length > 0
                ? `${draft.phases.length} riviä pohjasta “${getOfferPhaseTemplate(draft.templateId).name}”`
                : 'Ei automaattisia rivejä'}
            </p>
            {draft.notes && (
              <p className="break-words text-sm text-slate-700">
                <span className="text-slate-500">Huomiot:</span> {draft.notes}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep((previous) => previous - 1)} disabled={saving}>
                Takaisin
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
              Peruuta
            </Button>
            {step < 3 ? (
              <Button onClick={() => setStep((previous) => previous + 1)} disabled={!canContinue}>
                Jatka
              </Button>
            ) : (
              <Button onClick={() => onSubmit(draft)} disabled={saving || !canContinue}>
                {saving ? 'Luodaan…' : 'Luo määrälaskelma'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
