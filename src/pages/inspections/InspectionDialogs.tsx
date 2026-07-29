import {
  useCallback, useEffect, useRef, useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { AlertTriangle, CheckCircle2, Eraser, Loader2, PenLine } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { FindingSeverity, InspectionResultDetail } from '@/lib/supabase/inspectionEntities';
import { cn } from '@/lib/utils';
import { todayIso } from './inspectionUi';
import {
  findingBlocksHandover,
  findingRequiresDueDate,
  findingRequiresOwner,
  suggestedFindingDueDate,
} from './inspectionWorkflow';

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

type AssignmentMode = 'internal' | 'external';

const SEVERITY_OPTIONS: Array<{ value: FindingSeverity; label: string; detail: string; className: string }> = [
  {
    value: 'Vähäinen',
    label: 'Vähäinen',
    detail: 'Ei estä luovutusta, mutta havainto jää raportille ja seurattavaksi.',
    className: 'border-slate-200 bg-slate-50 text-slate-800',
  },
  {
    value: 'Korjattava ennen luovutusta',
    label: 'Korjattava ennen luovutusta',
    detail: 'Kohdetta ei voi hyväksyä ennen korjauksen tarkistamista.',
    className: 'border-amber-200 bg-amber-50 text-amber-950',
  },
  {
    value: 'Merkittävä',
    label: 'Merkittävä',
    detail: 'Selvä laatu-, toimivuus- tai sopimuspoikkeama. Korjaa kiireellisesti.',
    className: 'border-orange-200 bg-orange-50 text-orange-950',
  },
  {
    value: 'Kriittinen',
    label: 'Kriittinen',
    detail: 'Turvallisuus-, vahinko- tai käyttöeste. Reagoi välittömästi.',
    className: 'border-red-200 bg-red-50 text-red-950',
  },
];

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
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>('internal');
  const [dueDateEdited, setDueDateEdited] = useState(false);

  useEffect(() => {
    if (!result) return;
    const severity: FindingSeverity = 'Korjattava ennen luovutusta';
    setDraft({
      title: result.itemTitle,
      description: result.comment || result.guidance,
      location: result.sectionTitle,
      category: result.sectionTitle,
      severity,
      contractorName: '',
      dueDate: suggestedFindingDueDate(severity, todayIso()),
    });
    setAssignmentMode('internal');
    setDueDateEdited(false);
  }, [result]);

  const chooseSeverity = (severity: FindingSeverity) => {
    setDraft((previous) => ({
      ...previous,
      severity,
      dueDate: dueDateEdited ? previous.dueDate : suggestedFindingDueDate(severity, todayIso()),
    }));
  };

  const chooseAssignmentMode = (mode: AssignmentMode) => {
    setAssignmentMode(mode);
    setDraft((previous) => mode === 'internal'
      ? { ...previous, contractorName: '' }
      : { ...previous, assigneeUserId: undefined });
  };

  const blocksHandover = findingBlocksHandover(draft.severity);
  const dueDateRequired = findingRequiresDueDate(draft.severity);
  const ownerRequired = findingRequiresOwner(draft.severity);
  const ownerAssigned = Boolean(draft.assigneeUserId || draft.contractorName.trim());
  const valid = Boolean(
    draft.title.trim()
    && (!dueDateRequired || draft.dueDate)
    && (!ownerRequired || ownerAssigned),
  );

  return (
    <Dialog open={Boolean(result)} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Kirjaa tarkastuspuute</DialogTitle>
          <p className="text-sm text-text-secondary">Määritä poikkeaman vakavuus, korjausvastuu ja määräpäivä. Näiden perusteella puute ohjautuu korjaukseen ja uusintatarkastukseen.</p>
        </DialogHeader>

        <div className="space-y-5">
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Puute *</Label>
              <Input value={draft.title} onChange={(event) => setDraft((previous) => ({ ...previous, title: event.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>Kuvaus ja havainto</Label>
              <Textarea value={draft.description} onChange={(event) => setDraft((previous) => ({ ...previous, description: event.target.value }))} className="min-h-24" placeholder="Kuvaa mitä havaittiin, missä ja miten se poikkeaa vaatimuksesta." />
            </div>
            <div>
              <Label>Sijainti</Label>
              <Input value={draft.location} onChange={(event) => setDraft((previous) => ({ ...previous, location: event.target.value }))} />
            </div>
            <div>
              <Label>Puuteluokka</Label>
              <Input value={draft.category} onChange={(event) => setDraft((previous) => ({ ...previous, category: event.target.value }))} />
            </div>
          </section>

          <section className="space-y-3 border-t border-slate-200 pt-5">
            <div>
              <Label>Vakavuus *</Label>
              <p className="mt-1 text-xs text-text-secondary">Valitse todellisen vaikutuksen mukaan. Luovutuksen estävät puutteet vaativat vastuun ja määräpäivän.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {SEVERITY_OPTIONS.map((option) => {
                const selected = draft.severity === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => chooseSeverity(option.value)}
                    className={cn(
                      'rounded-xl border p-4 text-left transition',
                      option.className,
                      selected ? 'ring-2 ring-slate-900/20 ring-offset-2' : 'opacity-80 hover:opacity-100',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="font-semibold">{option.label}</p><p className="mt-1 text-xs leading-relaxed opacity-80">{option.detail}</p></div>
                      {selected && <CheckCircle2 size={18} className="shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
            {blocksHandover && (
              <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                <div><p className="font-semibold">Tämä puute estää luovutuksen.</p><p className="mt-1 text-xs">Korjaus pitää ilmoittaa valmiiksi ja hyväksyä uusintatarkastuksessa ennen tarkastuksen hyväksyntää.</p></div>
              </div>
            )}
          </section>

          <section className="space-y-3 border-t border-slate-200 pt-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Label>Korjausvastuu {ownerRequired ? '*' : ''}</Label>
                <p className="mt-1 text-xs text-text-secondary">Valitse organisaation henkilö tai nimeä ulkopuolinen urakoitsija.</p>
              </div>
              <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button type="button" onClick={() => chooseAssignmentMode('internal')} className={cn('rounded-md px-3 py-1.5 text-sm font-medium', assignmentMode === 'internal' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary')}>Oma henkilö</button>
                <button type="button" onClick={() => chooseAssignmentMode('external')} className={cn('rounded-md px-3 py-1.5 text-sm font-medium', assignmentMode === 'external' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary')}>Urakoitsija</button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {assignmentMode === 'internal' ? (
                <div>
                  <Label>Vastuuhenkilö {ownerRequired ? '*' : ''}</Label>
                  <Select value={draft.assigneeUserId ?? 'none'} onValueChange={(value) => setDraft((previous) => ({ ...previous, assigneeUserId: value === 'none' ? undefined : value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ei nimetty</SelectItem>
                      {people.map((person) => <SelectItem key={person.userId} value={person.userId}>{person.name || person.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label>Ulkopuolinen urakoitsija {ownerRequired ? '*' : ''}</Label>
                  <Input value={draft.contractorName} onChange={(event) => setDraft((previous) => ({ ...previous, contractorName: event.target.value }))} placeholder="Yritys tai vastuuhenkilö" />
                </div>
              )}
              <div>
                <Label>Korjauksen määräpäivä {dueDateRequired ? '*' : ''}</Label>
                <Input
                  type="date"
                  min={todayIso()}
                  value={draft.dueDate}
                  onChange={(event) => {
                    setDueDateEdited(true);
                    setDraft((previous) => ({ ...previous, dueDate: event.target.value }));
                  }}
                />
                <p className="mt-1 text-xs text-text-secondary">Ehdotus määräytyy vakavuuden mukaan, mutta voit muuttaa päivää.</p>
              </div>
            </div>

            {!valid && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {!draft.title.trim() && <p>Kirjaa puutteelle otsikko.</p>}
                {dueDateRequired && !draft.dueDate && <p>Luovutuksen estävälle puutteelle tarvitaan määräpäivä.</p>}
                {ownerRequired && !ownerAssigned && <p>Luovutuksen estävälle puutteelle tarvitaan vastuuhenkilö tai urakoitsija.</p>}
              </div>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>Peruuta</Button>
          <Button disabled={!valid || busy} onClick={() => void onSubmit(draft)}>
            {busy && <Loader2 size={16} className="mr-2 animate-spin" />} Kirjaa puute ja avaa korjaus
          </Button>
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
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSummary('');
    setConfirmed(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Hyväksy ja lukitse tarkastus</DialogTitle></DialogHeader>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <p className="font-semibold">Hyväksyntä muodostaa muuttumattoman raporttiversion.</p>
          <p className="mt-1">Tarkastuskohtia, puutteita, kuvia tai allekirjoituksia ei voi tämän jälkeen muuttaa ilman tarkastuksen mitätöintiä.</p>
        </div>
        <div>
          <Label>Luovutuksen yhteenveto</Label>
          <Textarea value={summary} onChange={(event) => setSummary(event.target.value)} className="min-h-28" placeholder="Kirjaa luovutuksen kannalta olennainen yhteenveto tai jäljelle jäävät vähäiset havainnot." />
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm">
          <Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} />
          <span><strong className="block text-text-primary">Vahvistan tarkastuksen oikeellisuuden</strong><span className="mt-1 block text-text-secondary">Olen tarkistanut kohdat, puutteet, luovutuskuvat ja allekirjoituksen ennen lukitsemista.</span></span>
        </label>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>Peruuta</Button>
          <Button disabled={busy || !confirmed} onClick={() => void onSubmit(summary)}>{busy && <Loader2 size={16} className="mr-2 animate-spin" />}Hyväksy ja lukitse</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VoidDialog({ open, busy, onClose, onSubmit }: {
  open: boolean; busy: boolean; onClose: () => void; onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Mitätöi hyväksytty tarkastus</DialogTitle></DialogHeader>
        <div><Label>Mitätöinnin perustelu *</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-28" /></div>
        <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Peruuta</Button><Button variant="destructive" disabled={!reason.trim() || busy} onClick={() => void onSubmit(reason)}>Mitätöi tarkastus</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
