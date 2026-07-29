import {
  Archive,
  CheckCircle2,
  Copy,
  FolderKanban,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Offer, OfferStatus, OfferVersion } from '@/lib/supabase/offers';
import { cn } from '@/lib/utils';
import { statusTone, workflowStep } from './offerUi';

const STEPS = ['Luonnos', 'Lähetetty', 'Hyväksytty', 'Projekti'] as const;

interface OfferWorkflowCardProps {
  offer: Offer;
  versions: OfferVersion[];
  selectedVersion: OfferVersion;
  draft: boolean;
  hasConvertedProject: boolean;
  saving: boolean;
  onSelectVersion: (versionId: string) => void;
  onTransition: (status: OfferStatus) => void;
  onNewVersion: () => void;
  onConvertProject: () => void;
  onOpenProject: () => void;
  onDeleteDraft: () => void;
}

export function OfferWorkflowCard({
  offer,
  versions,
  selectedVersion,
  draft,
  hasConvertedProject,
  saving,
  onSelectVersion,
  onTransition,
  onNewVersion,
  onConvertProject,
  onOpenProject,
  onDeleteDraft,
}: OfferWorkflowCardProps) {
  const step = hasConvertedProject ? 3 : workflowStep(offer.status);
  const locked = selectedVersion.status !== 'Luonnos';

  return (
    <Card className="border-slate-200/80 shadow-none">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-base">Työnkulku ja versiot</CardTitle>
            <p className="mt-1 break-words text-sm text-slate-500">
              {locked
                ? 'Valittu versio on lukittu. Tee uusi versio, jos sisältöä pitää muuttaa.'
                : 'Muokkaa rivejä ja asetuksia, tulosta asiakkaalle ja merkitse lähetetyksi.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {versions.map((version) => (
              <Button
                key={version.id}
                size="sm"
                variant={selectedVersion.id === version.id ? 'default' : 'outline'}
                onClick={() => onSelectVersion(version.id)}
              >
                v{version.versionNumber} · {version.status}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="grid gap-2 sm:grid-cols-4">
          {STEPS.map((label, index) => {
            const active = step === index;
            const done = step > index;
            return (
              <li
                key={label}
                className={cn(
                  'rounded-xl border px-3 py-2 text-sm',
                  active && 'border-orange-300 bg-orange-50 text-orange-900',
                  done && 'border-emerald-200 bg-emerald-50 text-emerald-800',
                  !active && !done && 'border-slate-200 bg-white text-slate-500',
                )}
              >
                <span className="block text-[11px] font-semibold uppercase tracking-wide opacity-70">
                  Vaihe {index + 1}
                </span>
                <span className="break-words font-semibold">{label}</span>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={statusTone(offer.status)}>{offer.status}</Badge>
          <Badge variant="outline" className={statusTone(selectedVersion.status)}>
            Versio {selectedVersion.versionNumber}: {selectedVersion.status}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          {draft && (
            <>
              <Button disabled={saving} onClick={() => onTransition('Lähetetty')}>
                <Send size={15} className="mr-2" /> Merkitse lähetetyksi
              </Button>
              <Button variant="outline" disabled={saving} onClick={() => onTransition('Hyväksytty')}>
                <CheckCircle2 size={15} className="mr-2" /> Hyväksy suoraan
              </Button>
              <Button variant="ghost" className="text-red-600" disabled={saving} onClick={onDeleteDraft}>
                <Trash2 size={15} className="mr-2" /> Poista luonnos
              </Button>
            </>
          )}
          {offer.status === 'Lähetetty' && (
            <>
              <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={saving} onClick={() => onTransition('Hyväksytty')}>
                <CheckCircle2 size={15} className="mr-2" /> Merkitse hyväksytyksi
              </Button>
              <Button variant="outline" className="text-red-600" disabled={saving} onClick={() => onTransition('Hylätty')}>
                <XCircle size={15} className="mr-2" /> Merkitse hylätyksi
              </Button>
              <Button variant="outline" disabled={saving} onClick={onNewVersion}>
                <Copy size={15} className="mr-2" /> Uusi versio
              </Button>
            </>
          )}
          {(offer.status === 'Hylätty' || offer.status === 'Vanhentunut') && (
            <Button variant="outline" disabled={saving} onClick={onNewVersion}>
              <Copy size={15} className="mr-2" /> Tee uusi versio
            </Button>
          )}
          {offer.status === 'Hyväksytty' && !hasConvertedProject && (
            <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={saving} onClick={onConvertProject}>
              <FolderKanban size={15} className="mr-2" /> Luo projekti
            </Button>
          )}
          {hasConvertedProject && (
            <Button disabled={saving} onClick={onOpenProject}>
              <FolderKanban size={15} className="mr-2" /> Avaa projekti
            </Button>
          )}
          {offer.status !== 'Arkistoitu' && (
            <Button variant="ghost" disabled={saving} onClick={() => onTransition('Arkistoitu')}>
              <Archive size={15} className="mr-2" /> Arkistoi
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
