import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  getOfferPhaseTemplate,
  mergePhaseSelections,
  type OfferPhaseDefinition,
} from '@/lib/pricing/offerPhases';
import { cn } from '@/lib/utils';
import { PhaseTemplatesPicker } from './PhaseTemplatesPicker';
import { type OfferWizardForm, UNSECTIONED } from './offerUi';

interface PersonOption {
  userId: string;
  name: string;
}

interface CustomerOption {
  id: string;
  name: string;
}

interface LeadOption {
  id: string;
  name: string;
  company: string;
  stage: string;
  customerId?: string;
  description?: string;
  assigneeUserId?: string;
}

interface ProjectOption {
  id: string;
  name: string;
}

interface OfferCreateWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: OfferWizardForm;
  onFormChange: (form: OfferWizardForm) => void;
  customers: CustomerOption[];
  crmLeads: LeadOption[];
  projects: ProjectOption[];
  people: PersonOption[];
  errors: string[];
  saving: boolean;
  onSelectLead: (crmLeadId: string) => void;
  onSubmit: (phases: OfferPhaseDefinition[]) => void;
}

const STEPS = [
  { id: 'basics', title: 'Perustiedot', hint: 'Asiakas ja tarjouksen nimi' },
  { id: 'phases', title: 'Työvaiheet', hint: 'Rakenna laskennan osiot' },
  { id: 'pricing', title: 'Hinnoittelu', hint: 'Kate, riski ja ehdot' },
  { id: 'review', title: 'Valmis', hint: 'Tarkista ja luo' },
] as const;

export function OfferCreateWizard({
  open,
  onOpenChange,
  form,
  onFormChange,
  customers,
  crmLeads,
  projects,
  people,
  errors,
  saving,
  onSelectLead,
  onSubmit,
}: OfferCreateWizardProps) {
  const [step, setStep] = useState(0);
  const [customPhases, setCustomPhases] = useState<OfferPhaseDefinition[]>([]);

  const template = getOfferPhaseTemplate(form.templateId);
  const phases = useMemo(
    () => mergePhaseSelections(form.templateId, customPhases),
    [customPhases, form.templateId],
  );

  const patch = (partial: Partial<OfferWizardForm>) => onFormChange({ ...form, ...partial });

  const selectTemplate = (templateId: string) => {
    const next = getOfferPhaseTemplate(templateId);
    patch({
      templateId,
      marginPercent: String(next.suggestedMarginPercent),
      overheadPercent: String(next.suggestedOverheadPercent),
      riskPercent: String(next.suggestedRiskPercent),
      deliveryTime: form.deliveryTime || next.defaultDeliveryTime,
      terms: form.terms || next.defaultTerms,
    });
    setCustomPhases([]);
  };

  const canContinueBasics = Boolean(form.name.trim())
    && Boolean(form.customerId || form.crmLeadId || form.projectId);

  const goNext = () => {
    if (step === 0 && !canContinueBasics) return;
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const goBack = () => setStep((current) => Math.max(current - 1, 0));

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setStep(0);
      setCustomPhases([]);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={18} className="text-orange-500" />
            Uusi tarjous
          </DialogTitle>
        </DialogHeader>

        <ol className="grid gap-2 sm:grid-cols-4">
          {STEPS.map((item, index) => {
            const active = step === index;
            const done = step > index;
            return (
              <li
                key={item.id}
                className={cn(
                  'rounded-xl border px-3 py-2',
                  active && 'border-orange-300 bg-orange-50',
                  done && 'border-emerald-200 bg-emerald-50',
                  !active && !done && 'border-slate-200 bg-white',
                )}
              >
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Vaihe {index + 1}
                </span>
                <span className="block break-words text-sm font-semibold text-slate-900">{item.title}</span>
                <span className="mt-0.5 block break-words text-xs text-slate-500">{item.hint}</span>
              </li>
            );
          })}
        </ol>

        {errors.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errors.map((error) => <p key={error}>{error}</p>)}
          </div>
        )}

        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Tarjouksen nimi *</Label>
              <Input
                value={form.name}
                placeholder="Esim. Kylpyhuoneremontti – Mannerheimintie 12"
                onChange={(event) => patch({ name: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>CRM-mahdollisuus</Label>
              <Select
                value={form.crmLeadId || UNSECTIONED}
                onValueChange={(value) => onSelectLead(value === UNSECTIONED ? '' : value)}
              >
                <SelectTrigger><SelectValue placeholder="Valitse" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSECTIONED}>Ei CRM-mahdollisuutta</SelectItem>
                  {crmLeads.filter((item) => !['Voitettu', 'Hävitty'].includes(item.stage)).map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name} · {item.company}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Asiakas</Label>
              <Select
                value={form.customerId || UNSECTIONED}
                onValueChange={(value) => patch({ customerId: value === UNSECTIONED ? '' : value })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSECTIONED}>Ei asiakasta</SelectItem>
                  {customers.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nykyinen projekti</Label>
              <Select
                value={form.projectId || UNSECTIONED}
                onValueChange={(value) => patch({ projectId: value === UNSECTIONED ? '' : value })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSECTIONED}>Ei projektia</SelectItem>
                  {projects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Vastuuhenkilö</Label>
              <Select
                value={form.assignedUserId || UNSECTIONED}
                onValueChange={(value) => patch({ assignedUserId: value === UNSECTIONED ? '' : value })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSECTIONED}>Ei vastuuhenkilöä</SelectItem>
                  {people.map((person) => (
                    <SelectItem key={person.userId} value={person.userId}>{person.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Voimassa asti</Label>
              <Input
                type="date"
                value={form.validUntil}
                onChange={(event) => patch({ validUntil: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Tarjousnumero</Label>
              <Input
                value={form.offerNumber}
                placeholder="Muodostetaan automaattisesti"
                onChange={(event) => patch({ offerNumber: event.target.value })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Sisäinen huomio</Label>
              <Textarea
                value={form.notes}
                rows={3}
                onChange={(event) => patch({ notes: event.target.value })}
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <PhaseTemplatesPicker
            selectedTemplateId={form.templateId}
            onSelectTemplate={selectTemplate}
            customPhases={customPhases}
            onCustomPhasesChange={setCustomPhases}
          />
        )}

        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>ALV %</Label>
              <Input type="number" value={form.vatRate} onChange={(event) => patch({ vatRate: event.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Tavoitekate % myynnistä</Label>
              <Input type="number" value={form.marginPercent} onChange={(event) => patch({ marginPercent: event.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Yleiskulut %</Label>
              <Input type="number" value={form.overheadPercent} onChange={(event) => patch({ overheadPercent: event.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Riskivaraus %</Label>
              <Input type="number" value={form.riskPercent} onChange={(event) => patch({ riskPercent: event.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Maksuehto</Label>
              <Input value={form.paymentTerms} onChange={(event) => patch({ paymentTerms: event.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Toimitusaika</Label>
              <Input
                value={form.deliveryTime}
                placeholder="Esim. 4–6 viikkoa"
                onChange={(event) => patch({ deliveryTime: event.target.value })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Ehdot ja rajaukset</Label>
              <Textarea
                value={form.terms}
                rows={5}
                onChange={(event) => patch({ terms: event.target.value })}
              />
            </div>
            <p className="break-words text-sm text-slate-500 sm:col-span-2">
              Pohja suosittelee katetta {template.suggestedMarginPercent} %, yleiskuluja {template.suggestedOverheadPercent} % ja riskiä {template.suggestedRiskPercent} %. Voit muuttaa arvoja ennen luontia.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white">
              <p className="text-xs uppercase tracking-wide text-slate-300">Luodaan tarjous</p>
              <h3 className="mt-1 break-words text-xl font-bold">{form.name || 'Nimetön tarjous'}</h3>
              <p className="mt-2 break-words text-sm text-slate-300">
                {(customers.find((item) => item.id === form.customerId)?.name)
                  || (crmLeads.find((item) => item.id === form.crmLeadId)?.company)
                  || 'Ei asiakasta'}
                {' · '}
                {template.name}
                {' · '}
                {phases.length} työvaihetta
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryRow label="Voimassa" value={form.validUntil || '—'} />
              <SummaryRow label="Maksuehto" value={form.paymentTerms || '—'} />
              <SummaryRow label="Toimitusaika" value={form.deliveryTime || '—'} />
              <SummaryRow
                label="Hinnoittelu"
                value={`Kate ${form.marginPercent} % · Yleiskulu ${form.overheadPercent} % · Riski ${form.riskPercent} % · ALV ${form.vatRate} %`}
              />
            </div>
            {phases.length > 0 ? (
              <ol className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                {phases.map((phase, index) => (
                  <li key={phase.title} className="break-words text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">{index + 1}. {phase.title}</span>
                    {phase.description ? ` — ${phase.description}` : ''}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                Tarjous luodaan ilman valmiita vaiheita. Voit lisätä osioita heti luonnoksen jälkeen.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            {step > 0 && (
              <Button type="button" variant="outline" onClick={goBack} disabled={saving}>
                <ChevronLeft size={16} className="mr-1" /> Takaisin
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
              Peruuta
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={goNext} disabled={step === 0 && !canContinueBasics}>
                Jatka <ChevronRight size={16} className="ml-1" />
              </Button>
            ) : (
              <Button type="button" onClick={() => onSubmit(phases)} disabled={saving}>
                <Check size={16} className="mr-1" />
                {saving ? 'Luodaan…' : 'Luo tarjous'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}
