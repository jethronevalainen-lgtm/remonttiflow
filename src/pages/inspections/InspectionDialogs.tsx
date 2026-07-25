import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { FindingSeverity, InspectionResultDetail } from '@/lib/supabase/inspectionEntities';

export interface FindingDraft {
  title: string;
  description: string;
  location: string;
  category: string;
  severity: FindingSeverity;
  assigneeUserId?: string;
  contractorName: string;
  dueDate: string;
}

export function FindingDialog({
  result,
  people,
  busy,
  onClose,
  onSubmit,
}: {
  result: InspectionResultDetail | null;
  people: Array<{ userId: string; name: string; email: string }>;
  busy: boolean;
  onClose: () => void;
  onSubmit: (draft: FindingDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<FindingDraft>({
    title: '', description: '', location: '', category: '',
    severity: 'Korjattava ennen luovutusta', contractorName: '', dueDate: '',
  });

  useEffect(() => {
    if (!result) return;
    setDraft({
      title: result.itemTitle,
      description: result.comment || result.guidance,
      location: result.sectionTitle,
      category: result.sectionTitle,
      severity: 'Korjattava ennen luovutusta',
      contractorName: '',
      dueDate: '',
    });
  }, [result]);

  return (
    <Dialog open={Boolean(result)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Kirjaa tarkastuspuute</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Otsikko *</Label><Input value={draft.title} onChange={(event) => setDraft((previous) => ({ ...previous, title: event.target.value }))} /></div>
          <div className="sm:col-span-2"><Label>Kuvaus</Label><Textarea value={draft.description} onChange={(event) => setDraft((previous) => ({ ...previous, description: event.target.value }))} /></div>
          <div><Label>Sijainti</Label><Input value={draft.location} onChange={(event) => setDraft((previous) => ({ ...previous, location: event.target.value }))} /></div>
          <div><Label>Puuteluokka</Label><Input value={draft.category} onChange={(event) => setDraft((previous) => ({ ...previous, category: event.target.value }))} /></div>
          <div>
            <Label>Vakavuus</Label>
            <Select value={draft.severity} onValueChange={(value) => setDraft((previous) => ({ ...previous, severity: value as FindingSeverity }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(['Vähäinen', 'Korjattava ennen luovutusta', 'Merkittävä', 'Kriittinen'] as FindingSeverity[]).map((severity) => <SelectItem key={severity} value={severity}>{severity}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Korjauksen määräpäivä</Label><Input type="date" value={draft.dueDate} onChange={(event) => setDraft((previous) => ({ ...previous, dueDate: event.target.value }))} /></div>
          <div>
            <Label>Vastuuhenkilö</Label>
            <Select value={draft.assigneeUserId ?? 'none'} onValueChange={(value) => setDraft((previous) => ({ ...previous, assigneeUserId: value === 'none' ? undefined : value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">Ei nimetty</SelectItem>{people.map((person) => <SelectItem key={person.userId} value={person.userId}>{person.name || person.email}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Ulkopuolinen urakoitsija</Label><Input value={draft.contractorName} onChange={(event) => setDraft((previous) => ({ ...previous, contractorName: event.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Peruuta</Button>
          <Button disabled={!draft.title.trim() || busy} onClick={() => void onSubmit(draft)}>{busy && <Loader2 size={16} className="mr-2 animate-spin" />}Tallenna puute</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SignatureDialog({ open, busy, onClose, onSubmit }: {
  open: boolean; busy: boolean; onClose: () => void;
  onSubmit: (draft: { name: string; role: string; company: string; note: string }) => Promise<void>;
}) {
  const [draft, setDraft] = useState({ name: '', role: 'Työnjohtaja', company: '', note: '' });
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Lisää hyväksyntämerkintä</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Nimi *</Label><Input value={draft.name} onChange={(event) => setDraft((previous) => ({ ...previous, name: event.target.value }))} /></div>
          <div><Label>Rooli *</Label><Input value={draft.role} onChange={(event) => setDraft((previous) => ({ ...previous, role: event.target.value }))} /></div>
          <div><Label>Organisaatio</Label><Input value={draft.company} onChange={(event) => setDraft((previous) => ({ ...previous, company: event.target.value }))} /></div>
          <div><Label>Huomautus</Label><Textarea value={draft.note} onChange={(event) => setDraft((previous) => ({ ...previous, note: event.target.value }))} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Peruuta</Button><Button disabled={!draft.name.trim() || !draft.role.trim() || busy} onClick={() => void onSubmit(draft)}>Vahvista</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ApprovalDialog({ open, busy, onClose, onSubmit }: {
  open: boolean; busy: boolean; onClose: () => void; onSubmit: (summary: string) => Promise<void>;
}) {
  const [summary, setSummary] = useState('');
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Hyväksy tarkastus</DialogTitle></DialogHeader>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Hyväksyntä lukitsee tarkastuksen sisällön ja muodostaa muuttumattoman raporttiversion.</div>
        <div><Label>Luovutuksen yhteenveto</Label><Textarea value={summary} onChange={(event) => setSummary(event.target.value)} className="min-h-28" /></div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Peruuta</Button><Button disabled={busy} onClick={() => void onSubmit(summary)}>{busy && <Loader2 size={16} className="mr-2 animate-spin" />}Hyväksy ja lukitse</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VoidDialog({ open, busy, onClose, onSubmit }: {
  open: boolean; busy: boolean; onClose: () => void; onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Mitätöi hyväksytty tarkastus</DialogTitle></DialogHeader>
        <div><Label>Mitätöinnin perustelu *</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-28" /></div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Peruuta</Button><Button variant="destructive" disabled={!reason.trim() || busy} onClick={() => void onSubmit(reason)}>Mitätöi tarkastus</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
