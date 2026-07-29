import { Check, Layers3 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  getOfferPhaseTemplate,
  OFFER_PHASE_TEMPLATES,
  type OfferPhaseDefinition,
  type OfferPhaseTemplate,
} from '@/lib/pricing/offerPhases';
import { cn } from '@/lib/utils';

interface PhaseTemplatesPickerProps {
  selectedTemplateId: string;
  onSelectTemplate: (templateId: string) => void;
  customPhases: OfferPhaseDefinition[];
  onCustomPhasesChange: (phases: OfferPhaseDefinition[]) => void;
  existingTitles?: string[];
  compact?: boolean;
}

export function PhaseTemplatesPicker({
  selectedTemplateId,
  onSelectTemplate,
  customPhases,
  onCustomPhasesChange,
  existingTitles = [],
  compact = false,
}: PhaseTemplatesPickerProps) {
  const selected = getOfferPhaseTemplate(selectedTemplateId);
  const existing = new Set(existingTitles.map((title) => title.toLocaleLowerCase('fi-FI')));

  const toggleCustomPhase = (phase: OfferPhaseDefinition) => {
    const key = phase.title.toLocaleLowerCase('fi-FI');
    if (customPhases.some((item) => item.title.toLocaleLowerCase('fi-FI') === key)) {
      onCustomPhasesChange(customPhases.filter((item) => item.title.toLocaleLowerCase('fi-FI') !== key));
      return;
    }
    onCustomPhasesChange([...customPhases, phase]);
  };

  return (
    <div className="space-y-4">
      <div className={cn('grid gap-3', compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3')}>
        {OFFER_PHASE_TEMPLATES.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            active={template.id === selectedTemplateId}
            onSelect={() => onSelectTemplate(template.id)}
          />
        ))}
      </div>

      {selected.phases.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Layers3 size={16} className="text-orange-600" />
            <p className="font-semibold text-slate-900">Pohjan työvaiheet</p>
            <Badge variant="outline">{selected.phases.length} vaihetta</Badge>
          </div>
          <ol className="space-y-2">
            {selected.phases.map((phase, index) => {
              const alreadyExists = existing.has(phase.title.toLocaleLowerCase('fi-FI'));
              return (
                <li
                  key={`${selected.id}-${phase.title}`}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-slate-900">
                        {index + 1}. {phase.title}
                      </p>
                      <p className="mt-0.5 break-words text-xs text-slate-500">{phase.description}</p>
                    </div>
                    {alreadyExists && (
                      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Jo tarjouksessa</Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {selectedTemplateId !== 'blank' && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Lisää yksittäisiä vaiheita muista pohjista</p>
          <div className="flex flex-wrap gap-2">
            {OFFER_PHASE_TEMPLATES
              .filter((template) => template.id !== selectedTemplateId && template.id !== 'blank')
              .flatMap((template) => template.phases.map((phase) => ({ ...phase, source: template.name })))
              .filter((phase, index, all) => (
                all.findIndex((item) => item.title.toLocaleLowerCase('fi-FI') === phase.title.toLocaleLowerCase('fi-FI')) === index
              ))
              .slice(0, 12)
              .map((phase) => {
                const active = customPhases.some(
                  (item) => item.title.toLocaleLowerCase('fi-FI') === phase.title.toLocaleLowerCase('fi-FI'),
                );
                return (
                  <Button
                    key={phase.title}
                    type="button"
                    size="sm"
                    variant={active ? 'default' : 'outline'}
                    onClick={() => toggleCustomPhase(phase)}
                  >
                    {active && <Check size={14} className="mr-1" />}
                    {phase.title}
                  </Button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  active,
  onSelect,
}: {
  template: OfferPhaseTemplate;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'rounded-xl border p-4 text-left transition',
        active
          ? 'border-orange-400 bg-orange-50 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="break-words font-semibold text-slate-900">{template.name}</p>
        {active && (
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white">
            <Check size={14} />
          </span>
        )}
      </div>
      <p className="mt-1 break-words text-sm text-slate-600">{template.summary}</p>
      <p className="mt-3 text-xs font-medium text-slate-500">
        {template.phases.length
          ? `${template.phases.length} työvaihetta · kate ${template.suggestedMarginPercent} %`
          : 'Ei valmiita vaiheita'}
      </p>
    </button>
  );
}
