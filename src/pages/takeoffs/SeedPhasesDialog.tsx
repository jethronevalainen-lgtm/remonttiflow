import { useMemo, useState } from 'react';
import { Layers3 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  getOfferPhaseTemplate,
  OFFER_PHASE_TEMPLATES,
} from '@/lib/pricing/offerPhases';
import { cn } from '@/lib/utils';

interface SeedPhasesDialogProps {
  open: boolean;
  saving: boolean;
  existingPhases: string[];
  onOpenChange: (open: boolean) => void;
  onSeed: (templateId: string) => void;
}

export function SeedPhasesDialog({
  open,
  saving,
  existingPhases,
  onOpenChange,
  onSeed,
}: SeedPhasesDialogProps) {
  const [templateId, setTemplateId] = useState('bathroom');
  const template = getOfferPhaseTemplate(templateId);
  const existing = useMemo(
    () => new Set(existingPhases.map((phase) => phase.toLocaleLowerCase('fi-FI'))),
    [existingPhases],
  );
  const newPhases = template.phases.filter(
    (phase) => !existing.has(phase.title.toLocaleLowerCase('fi-FI')),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lisää työvaihepohjasta</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600">
          Valitse pohja. Jo olemassa olevat työvaiheet ohitetaan automaattisesti.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {OFFER_PHASE_TEMPLATES.filter((item) => item.id !== 'blank').map((item) => {
            const active = templateId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTemplateId(item.id)}
                className={cn(
                  'rounded-xl border p-3 text-left transition',
                  active
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-slate-200 hover:bg-slate-50',
                )}
              >
                <p className="break-words font-semibold text-slate-900">{item.name}</p>
                <p className="mt-1 break-words text-xs text-slate-500">{item.summary}</p>
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Layers3 size={16} className="text-orange-600" />
            <p className="font-semibold text-slate-900">Lisättävät vaiheet</p>
            <Badge variant="outline">{newPhases.length} uutta</Badge>
          </div>
          {newPhases.length === 0 ? (
            <p className="text-sm text-slate-500">Kaikki tämän pohjan vaiheet ovat jo laskelmassa.</p>
          ) : (
            <ul className="space-y-2">
              {newPhases.map((phase) => (
                <li key={phase.title} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <p className="break-words text-sm font-semibold">{phase.title}</p>
                  <p className="mt-0.5 break-words text-xs text-slate-500">{phase.description}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Peruuta
          </Button>
          <Button
            onClick={() => onSeed(templateId)}
            disabled={saving || newPhases.length === 0}
          >
            {saving ? 'Lisätään…' : `Lisää ${newPhases.length} riviä`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
