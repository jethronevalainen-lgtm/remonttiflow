import { useState } from 'react';
import { ExternalLink, MoreHorizontal, Printer, ShieldAlert, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { removeInspection } from '@/lib/supabase/inspectionLifecycle';
import type { InspectionStatus } from '@/lib/supabase/inspectionEntities';

interface Props {
  inspectionId: string;
  title: string;
  status: InspectionStatus;
  canManage: boolean;
  onOpen?: () => void;
  onPrint?: () => void;
  onVoid?: () => void;
  onRemoved: () => Promise<unknown> | unknown;
  triggerLabel?: string;
}

export default function InspectionActionsMenu({
  inspectionId,
  title,
  status,
  canManage,
  onOpen,
  onPrint,
  onVoid,
  onRemoved,
  triggerLabel = 'Tarkastuksen toiminnot',
}: Props) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const removable = canManage && !['Hyväksytty', 'Mitätöity'].includes(status);

  const submitDelete = async () => {
    if (reason.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      await removeInspection(inspectionId, reason);
      setDeleteOpen(false);
      setReason('');
      await onRemoved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tarkastuksen poistaminen epäonnistui.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={triggerLabel}
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal size={18} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56" onClick={(event) => event.stopPropagation()}>
          {onOpen && <DropdownMenuItem onSelect={onOpen}><ExternalLink size={15} className="mr-2" />Avaa tarkastus</DropdownMenuItem>}
          {onPrint && <DropdownMenuItem onSelect={onPrint}><Printer size={15} className="mr-2" />Tulosta / PDF</DropdownMenuItem>}
          {(onOpen || onPrint) && (removable || onVoid) && <DropdownMenuSeparator />}
          {onVoid && <DropdownMenuItem className="text-amber-800 focus:text-amber-900" onSelect={onVoid}><ShieldAlert size={15} className="mr-2" />Mitätöi tarkastus</DropdownMenuItem>}
          {removable && (
            <DropdownMenuItem
              className="text-red-700 focus:bg-red-50 focus:text-red-800"
              onSelect={(event) => {
                event.preventDefault();
                setError(null);
                setDeleteOpen(true);
              }}
            >
              <Trash2 size={15} className="mr-2" />Poista tarkastus
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={deleteOpen} onOpenChange={(open) => !busy && setDeleteOpen(open)}>
        <DialogContent className="sm:max-w-lg" onClick={(event) => event.stopPropagation()}>
          <DialogHeader><DialogTitle>Poista tarkastus</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <strong>{title}</strong> poistetaan normaalista näkymästä. Tiedot säilytetään auditointia varten. Hyväksyttyä tarkastusta ei voi poistaa, vaan se mitätöidään.
            </div>
            <div>
              <Label htmlFor={`inspection-delete-reason-${inspectionId}`}>Poistamisen perustelu *</Label>
              <Textarea
                id={`inspection-delete-reason-${inspectionId}`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="mt-1 min-h-24"
                placeholder="Esimerkiksi: Tarkastus luotiin väärälle kohteelle"
              />
            </div>
            {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setDeleteOpen(false)}>Peruuta</Button>
            <Button variant="destructive" disabled={busy || reason.trim().length < 3} onClick={() => void submitDelete()}>
              {busy ? 'Poistetaan…' : 'Poista tarkastus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
