import {
  useCallback, useEffect, useRef, useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Eraser, Loader2, PenLine } from 'lucide-react';

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

interface SignatureDraft {
  name: string;
  role: string;
  company: string;
  note: string;
  signatureData: string;
}

export function SignatureDialog({ open, busy, error, defaultName = '', onClose, onSubmit }: {
  open: boolean;
  busy: boolean;
  error?: string | null;
  defaultName?: string;
  onClose: () => void;
  onSubmit: (draft: SignatureDraft) => Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [draft, setDraft] = useState({ name: defaultName, role: 'Työnjohtaja', company: '', note: '' });
  const [hasSignature, setHasSignature] = useState(false);

  const prepareCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = Math.max(canvas.getBoundingClientRect().width, 320);
    const height = 176;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = '#0f172a';
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 2.25;
  }, []);

  useEffect(() => {
    if (!open) return;
    setDraft({ name: defaultName, role: 'Työnjohtaja', company: '', note: '' });
    setHasSignature(false);
    drawingRef.current = false;
    const frame = window.requestAnimationFrame(prepareCanvas);
    return () => window.cancelAnimationFrame(frame);
  }, [defaultName, open, prepareCanvas]);

  const pointOf = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const startDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (busy) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const context = event.currentTarget.getContext('2d');
    if (!context) return;
    const point = pointOf(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineTo(point.x + 0.1, point.y + 0.1);
    context.stroke();
    drawingRef.current = true;
    setHasSignature(true);
  };

  const draw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || busy) return;
    event.preventDefault();
    const context = event.currentTarget.getContext('2d');
    if (!context) return;
    const point = pointOf(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const stopDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const context = event.currentTarget.getContext('2d');
    context?.closePath();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const clearSignature = () => {
    prepareCanvas();
    drawingRef.current = false;
    setHasSignature(false);
  };

  const submit = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature || !draft.name.trim() || !draft.role.trim()) return;
    await onSubmit({ ...draft, signatureData: canvas.toDataURL('image/png') });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Allekirjoita itselleluovutus</DialogTitle></DialogHeader>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          Allekirjoitus vahvistaa, että tarkastustiedot on kirjattu ja kohde on tarkastettu. Hyväksyminen tehdään erikseen tarkastuksen valmistuttua.
        </div>
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label>Nimi *</Label><Input value={draft.name} onChange={(event) => setDraft((previous) => ({ ...previous, name: event.target.value }))} /></div>
          <div><Label>Rooli *</Label><Input value={draft.role} onChange={(event) => setDraft((previous) => ({ ...previous, role: event.target.value }))} /></div>
          <div className="sm:col-span-2"><Label>Organisaatio</Label><Input value={draft.company} onChange={(event) => setDraft((previous) => ({ ...previous, company: event.target.value }))} /></div>
          <div className="sm:col-span-2"><Label>Huomautus</Label><Textarea value={draft.note} onChange={(event) => setDraft((previous) => ({ ...previous, note: event.target.value }))} /></div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label className="flex items-center gap-2"><PenLine size={16} />Allekirjoitus *</Label>
            <Button type="button" variant="ghost" size="sm" disabled={!hasSignature || busy} onClick={clearSignature}><Eraser size={15} className="mr-1" />Tyhjennä</Button>
          </div>
          <canvas
            ref={canvasRef}
            aria-label="Piirrä allekirjoitus tähän"
            className="h-44 w-full touch-none rounded-xl border-2 border-dashed border-slate-300 bg-white shadow-inner"
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerCancel={stopDrawing}
          />
          <p className="text-xs text-text-secondary">Piirrä allekirjoitus sormella, hiirellä tai kosketuskynällä.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>Peruuta</Button>
          <Button disabled={!draft.name.trim() || !draft.role.trim() || !hasSignature || busy} onClick={() => void submit()}>{busy && <Loader2 size={16} className="mr-2 animate-spin" />}Tallenna allekirjoitus</Button>
        </DialogFooter>
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
