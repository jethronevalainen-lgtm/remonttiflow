import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  calculateChangeOrderTotals,
  deleteChangeOrderDraft,
  listManagedChangeOrders,
  nextChangeOrderAction,
  recordManualChangeOrderDecision,
  saveChangeOrderDraft,
  submitChangeOrderToCustomer,
  transitionChangeOrderExecution,
  type ChangeOrderCategory,
  type ChangeOrderDecision,
  type ChangeOrderDraftLineInput,
  type ManagedChangeOrder,
} from '@/lib/supabase/changeOrders';
import { cn } from '@/lib/utils';

const CATEGORIES: ChangeOrderCategory[] = ['Työ', 'Materiaali', 'Kalusto', 'Aliurakka', 'Muu'];

interface DraftLine extends ChangeOrderDraftLineInput {
  key: string;
  quantityInput: string;
  costPriceInput: string;
  salePriceInput: string;
}

interface DraftForm {
  changeOrderId: string | null;
  title: string;
  description: string;
  requestedAt: string;
  vatRate: string;
  scheduleEffectDays: string;
  lines: DraftLine[];
}

interface DecisionForm {
  changeOrder: ManagedChangeOrder | null;
  decision: Extract<ChangeOrderDecision, 'Hyväksytty' | 'Hylätty'>;
  approvedByName: string;
  evidenceNote: string;
}

const emptyLine = (): DraftLine => ({
  key: crypto.randomUUID(),
  category: 'Työ',
  description: '',
  quantity: 1,
  quantityInput: '1',
  unit: 'h',
  costUnitPriceCents: 0,
  costPriceInput: '0',
  saleUnitPriceCents: 0,
  salePriceInput: '0',
  customerVisible: true,
});

const emptyDraft = (): DraftForm => ({
  changeOrderId: null,
  title: '',
  description: '',
  requestedAt: new Date().toISOString().slice(0, 10),
  vatRate: '25,5',
  scheduleEffectDays: '0',
  lines: [emptyLine()],
});

function parseDecimal(value: string): number {
  const parsed = Number(value.replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function eurosToCents(value: string): number {
  const parsed = parseDecimal(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : Number.NaN;
}

function euro(cents: number): string {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function dateTime(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

function statusClass(status: string): string {
  if (status === 'Valmis' || status === 'Hyväksytty') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Hylätty') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'Lähetetty' || status === 'Toteutuksessa') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function draftFromChangeOrder(changeOrder: ManagedChangeOrder): DraftForm {
  return {
    changeOrderId: changeOrder.id,
    title: changeOrder.title,
    description: changeOrder.description ?? '',
    requestedAt: changeOrder.requestedAt ?? new Date().toISOString().slice(0, 10),
    vatRate: String(changeOrder.vatRate).replace('.', ','),
    scheduleEffectDays: String(changeOrder.scheduleEffectDays),
    lines: changeOrder.lines.length > 0
      ? changeOrder.lines.map((line) => ({
          key: line.id ?? crypto.randomUUID(),
          category: line.category,
          description: line.description,
          quantity: line.quantity,
          quantityInput: String(line.quantity).replace('.', ','),
          unit: line.unit,
          costUnitPriceCents: line.costUnitPriceCents,
          costPriceInput: String(line.costUnitPriceCents / 100).replace('.', ','),
          saleUnitPriceCents: line.saleUnitPriceCents,
          salePriceInput: String(line.saleUnitPriceCents / 100).replace('.', ','),
          customerVisible: line.customerVisible,
        }))
      : [emptyLine()],
  };
}

function lineForSave(line: DraftLine): ChangeOrderDraftLineInput {
  return {
    category: line.category,
    description: line.description.trim(),
    quantity: parseDecimal(line.quantityInput),
    unit: line.unit.trim(),
    costUnitPriceCents: eurosToCents(line.costPriceInput),
    saleUnitPriceCents: eurosToCents(line.salePriceInput),
    customerVisible: line.customerVisible,
  };
}

export default function ChangeOrderManager({
  organizationId,
  projectId,
  enabled,
  onChanged,
}: {
  organizationId: string;
  projectId: string;
  enabled: boolean;
  onChanged?: () => void | Promise<void>;
}) {
  const queryClient = useQueryClient();
  const queryKey = ['change-orders-v2', organizationId, projectId] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => listManagedChangeOrders(organizationId, projectId),
    enabled: enabled && Boolean(organizationId && projectId),
    staleTime: 15_000,
    retry: 1,
  });

  const [draftOpen, setDraftOpen] = useState(false);
  const [draft, setDraft] = useState<DraftForm>(emptyDraft);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionForm, setDecisionForm] = useState<DecisionForm>({
    changeOrder: null,
    decision: 'Hyväksytty',
    approvedByName: '',
    evidenceNote: '',
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedLines = useMemo(() => draft.lines.map(lineForSave), [draft.lines]);
  const totals = useMemo(() => calculateChangeOrderTotals(
    normalizedLines.filter((line) => [
      line.quantity,
      line.costUnitPriceCents,
      line.saleUnitPriceCents,
    ].every(Number.isFinite)),
  ), [normalizedLines]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey });
    await onChanged?.();
  };

  const startNew = () => {
    setDraft(emptyDraft());
    setError(null);
    setDraftOpen(true);
  };

  const startEdit = (changeOrder: ManagedChangeOrder) => {
    setDraft(draftFromChangeOrder(changeOrder));
    setError(null);
    setDraftOpen(true);
  };

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setDraft((previous) => ({
      ...previous,
      lines: previous.lines.map((line) => line.key === key ? { ...line, ...patch } : line),
    }));
  };

  const removeLine = (key: string) => {
    setDraft((previous) => ({
      ...previous,
      lines: previous.lines.length > 1
        ? previous.lines.filter((line) => line.key !== key)
        : previous.lines,
    }));
  };

  const saveDraft = async () => {
    const vatRate = parseDecimal(draft.vatRate);
    const scheduleEffectDays = Number(draft.scheduleEffectDays);
    if (!draft.title.trim()) {
      setError('Muutostyön otsikko on pakollinen.');
      return;
    }
    if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
      setError('Arvonlisäveron pitää olla välillä 0–100 %.');
      return;
    }
    if (!Number.isInteger(scheduleEffectDays) || Math.abs(scheduleEffectDays) > 3650) {
      setError('Aikatauluvaikutuksen pitää olla kokonaisia päiviä.');
      return;
    }
    if (normalizedLines.length === 0 || normalizedLines.some((line) => (
      line.description.length < 2
      || !Number.isFinite(line.quantity)
      || line.quantity <= 0
      || !line.unit
      || !Number.isFinite(line.costUnitPriceCents)
      || line.costUnitPriceCents < 0
      || !Number.isFinite(line.saleUnitPriceCents)
      || line.saleUnitPriceCents < 0
    ))) {
      setError('Täydennä jokaisen hinnoittelurivin kuvaus, määrä, yksikkö ja hinnat.');
      return;
    }
    if (totals.saleCents <= 0) {
      setError('Muutostyön myyntihinnan pitää olla nollaa suurempi.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveChangeOrderDraft({
        organizationId,
        projectId,
        changeOrderId: draft.changeOrderId,
        title: draft.title,
        description: draft.description,
        requestedAt: draft.requestedAt,
        vatRate,
        scheduleEffectDays,
        lines: normalizedLines,
      });
      setDraftOpen(false);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Muutostyön tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const run = async (changeOrderId: string, operation: () => Promise<void>) => {
    setBusyId(changeOrderId);
    setError(null);
    try {
      await operation();
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Muutostyön käsittely epäonnistui.');
    } finally {
      setBusyId(null);
    }
  };

  const openDecision = (changeOrder: ManagedChangeOrder) => {
    setDecisionForm({
      changeOrder,
      decision: 'Hyväksytty',
      approvedByName: '',
      evidenceNote: '',
    });
    setError(null);
    setDecisionOpen(true);
  };

  const saveDecision = async () => {
    const changeOrder = decisionForm.changeOrder;
    if (!changeOrder) return;
    if (decisionForm.approvedByName.trim().length < 2 || decisionForm.evidenceNote.trim().length < 5) {
      setError('Kirjaa tilaajan nimi sekä päätöksen todiste, esimerkiksi sähköposti tai pöytäkirja.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await recordManualChangeOrderDecision({
        changeOrderId: changeOrder.id,
        decision: decisionForm.decision,
        approvedByName: decisionForm.approvedByName,
        evidenceNote: decisionForm.evidenceNote,
      });
      setDecisionOpen(false);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tilaajapäätöksen kirjaaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  if (!enabled) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-950">Lisä- ja muutostyöt</h2>
          <p className="mt-1 text-sm text-slate-600">Hinnoittelu, tilaajapäätös, toteutus ja laskutus etenevät lukitussa järjestyksessä.</p>
        </div>
        <Button onClick={startNew}><Plus size={16} className="mr-2" /> Uusi muutostyö</Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {query.isLoading && (
        <div className="flex items-center gap-2 rounded-xl border bg-white p-4 text-sm text-slate-600">
          <Loader2 size={17} className="animate-spin" /> Haetaan muutostöitä…
        </div>
      )}
      {query.error instanceof Error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{query.error.message}</div>
      )}

      <div className="space-y-3">
        {(query.data ?? []).map((changeOrder) => {
          const nextAction = nextChangeOrderAction(changeOrder.status);
          const isBusy = busyId === changeOrder.id;
          return (
            <Card key={changeOrder.id} className={cn(
              changeOrder.status === 'Lähetetty' && 'border-amber-300',
              changeOrder.status === 'Hyväksytty' && 'border-emerald-300',
            )}>
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{changeOrder.changeNumber ?? 'Muutostyö'}</Badge>
                      <Badge variant="outline" className={statusClass(changeOrder.status)}>{changeOrder.status}</Badge>
                      <Badge variant="outline">Versio {changeOrder.customerVersion}</Badge>
                      {changeOrder.decisionSource && (
                        <Badge variant="outline">{changeOrder.decisionSource === 'customer_portal' ? 'Tilaajaportaali' : 'Kirjattu päätös'}</Badge>
                      )}
                    </div>
                    <h3 className="mt-3 break-words text-lg font-semibold text-slate-950">{changeOrder.title}</h3>
                    {changeOrder.description && <p className="mt-1 break-words text-sm leading-6 text-slate-600">{changeOrder.description}</p>}
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Myynti</p><p className="mt-1 font-mono font-semibold">{euro(changeOrder.amountCents)}</p></div>
                      <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Kustannus</p><p className="mt-1 font-mono font-semibold">{euro(changeOrder.costCents)}</p></div>
                      <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Kate</p><p className="mt-1 font-mono font-semibold">{euro(changeOrder.amountCents - changeOrder.costCents)}</p></div>
                      <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Aikataulu</p><p className="mt-1 font-semibold">{changeOrder.scheduleEffectDays > 0 ? `+${changeOrder.scheduleEffectDays}` : changeOrder.scheduleEffectDays} pv</p></div>
                    </div>
                    <details className="mt-4 rounded-xl border border-slate-200 bg-white">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3 text-sm font-semibold text-slate-800">
                        <span>{changeOrder.lineCount} hinnoitteluriviä · ALV {changeOrder.vatRate.toLocaleString('fi-FI')} %</span>
                        <ChevronDown size={16} />
                      </summary>
                      <div className="border-t border-slate-200">
                        {changeOrder.lines.map((line) => (
                          <div key={line.id ?? line.lineNumber} className="grid gap-2 border-b border-slate-100 px-3 py-3 text-sm last:border-0 md:grid-cols-[100px_minmax(0,1fr)_100px_130px_130px] md:items-center">
                            <span className="text-slate-500">{line.category}</span>
                            <span className="break-words font-medium">{line.description}</span>
                            <span>{line.quantity.toLocaleString('fi-FI')} {line.unit}</span>
                            <span className="font-mono">{euro(line.costTotalCents)}</span>
                            <span className="font-mono font-semibold">{euro(line.saleTotalCents)}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                      {changeOrder.submittedToCustomerAt && <span>Lähetetty {dateTime(changeOrder.submittedToCustomerAt)}</span>}
                      {changeOrder.customerDecidedAt && <span>Päätetty {dateTime(changeOrder.customerDecidedAt)}</span>}
                      {changeOrder.approvedByName && <span>Päättäjä {changeOrder.approvedByName}</span>}
                    </div>
                    {changeOrder.decisionEvidenceNote && (
                      <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                        <strong>Päätöksen todiste:</strong> {changeOrder.decisionEvidenceNote}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 xl:w-64 xl:flex-col">
                    {(changeOrder.status === 'Luonnos' || changeOrder.status === 'Hylätty') && (
                      <Button variant="outline" onClick={() => startEdit(changeOrder)} disabled={isBusy}>
                        <Pencil size={15} className="mr-2" /> {changeOrder.status === 'Hylätty' ? 'Tee uusi versio' : 'Muokkaa'}
                      </Button>
                    )}
                    {nextAction === 'submit' && (
                      <Button onClick={() => void run(changeOrder.id, () => submitChangeOrderToCustomer(changeOrder.id))} disabled={isBusy}>
                        {isBusy ? <Loader2 size={15} className="mr-2 animate-spin" /> : <Send size={15} className="mr-2" />} Lähetä tilaajalle
                      </Button>
                    )}
                    {nextAction === 'decision' && (
                      <Button variant="outline" onClick={() => openDecision(changeOrder)} disabled={isBusy}>
                        <FileCheck2 size={15} className="mr-2" /> Kirjaa tilaajan päätös
                      </Button>
                    )}
                    {nextAction === 'start' && (
                      <Button onClick={() => void run(changeOrder.id, () => transitionChangeOrderExecution(changeOrder.id, 'Toteutuksessa'))} disabled={isBusy}>
                        <Clock3 size={15} className="mr-2" /> Aloita toteutus
                      </Button>
                    )}
                    {nextAction === 'complete' && (
                      <Button onClick={() => void run(changeOrder.id, () => transitionChangeOrderExecution(changeOrder.id, 'Valmis'))} disabled={isBusy}>
                        <CheckCircle2 size={15} className="mr-2" /> Merkitse valmiiksi
                      </Button>
                    )}
                    {changeOrder.status === 'Luonnos' && (
                      <Button variant="ghost" className="text-red-600" onClick={() => void run(changeOrder.id, () => deleteChangeOrderDraft(changeOrder.id))} disabled={isBusy}>
                        <Trash2 size={15} className="mr-2" /> Poista luonnos
                      </Button>
                    )}
                    {changeOrder.status === 'Valmis' && (
                      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
                        <CheckCircle2 size={17} /> Muutostyö valmis
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!query.isLoading && (query.data?.length ?? 0) === 0 && (
          <Card className="border-dashed"><CardContent className="p-10 text-center"><CircleDollarSign size={42} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold">Ei lisä- tai muutostöitä</p><p className="mt-1 text-sm text-slate-500">Luo ensimmäinen muutostyö rivikohtaisella hinnoittelulla.</p></CardContent></Card>
        )}
      </div>

      <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader><DialogTitle>{draft.changeOrderId ? 'Muokkaa muutostyön luonnosta' : 'Uusi lisä- tai muutostyö'}</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="change-title">Otsikko *</Label><Input id="change-title" value={draft.title} onChange={(event) => setDraft((old) => ({ ...old, title: event.target.value }))} /></div>
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="change-description">Kuvaus</Label><Textarea id="change-description" rows={3} value={draft.description} onChange={(event) => setDraft((old) => ({ ...old, description: event.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="change-requested">Pyydetty</Label><Input id="change-requested" type="date" value={draft.requestedAt} onChange={(event) => setDraft((old) => ({ ...old, requestedAt: event.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="change-vat">ALV %</Label><Input id="change-vat" inputMode="decimal" value={draft.vatRate} onChange={(event) => setDraft((old) => ({ ...old, vatRate: event.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="change-schedule">Vaikutus aikatauluun, päivää</Label><Input id="change-schedule" inputMode="numeric" value={draft.scheduleEffectDays} onChange={(event) => setDraft((old) => ({ ...old, scheduleEffectDays: event.target.value }))} /></div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Hinnoittelurivit</h3><p className="text-sm text-slate-500">Tilaajalle näkyvät rivit muodostavat päätettävän version.</p></div><Button type="button" variant="outline" onClick={() => setDraft((old) => ({ ...old, lines: [...old.lines, emptyLine()] }))}><Plus size={15} className="mr-2" /> Lisää rivi</Button></div>
              {draft.lines.map((line, index) => (
                <div key={line.key} className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between"><p className="font-semibold">Rivi {index + 1}</p><Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={() => removeLine(line.key)} disabled={draft.lines.length === 1}><Trash2 size={15} /></Button></div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                    <div className="space-y-2"><Label>Laji</Label><Select value={line.category} onValueChange={(category: ChangeOrderCategory) => updateLine(line.key, { category })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2 sm:col-span-2"><Label>Kuvaus *</Label><Input value={line.description} onChange={(event) => updateLine(line.key, { description: event.target.value })} /></div>
                    <div className="space-y-2"><Label>Määrä</Label><Input inputMode="decimal" value={line.quantityInput} onChange={(event) => updateLine(line.key, { quantityInput: event.target.value })} /></div>
                    <div className="space-y-2"><Label>Yksikkö</Label><Input value={line.unit} onChange={(event) => updateLine(line.key, { unit: event.target.value })} /></div>
                    <label className="flex min-h-11 items-center gap-2 self-end rounded-md border border-slate-200 px-3 text-sm"><input type="checkbox" checked={line.customerVisible} onChange={(event) => updateLine(line.key, { customerVisible: event.target.checked })} /> Näytä tilaajalle</label>
                    <div className="space-y-2 lg:col-start-3"><Label>Kustannus €/yks.</Label><Input inputMode="decimal" value={line.costPriceInput} onChange={(event) => updateLine(line.key, { costPriceInput: event.target.value })} /></div>
                    <div className="space-y-2"><Label>Myynti €/yks.</Label><Input inputMode="decimal" value={line.salePriceInput} onChange={(event) => updateLine(line.key, { salePriceInput: event.target.value })} /></div>
                    <div className="self-end rounded-lg bg-slate-50 p-3 text-sm"><span className="text-slate-500">Kustannus</span><p className="font-mono font-semibold">{euro(Number.isFinite(eurosToCents(line.costPriceInput) * parseDecimal(line.quantityInput)) ? Math.round(eurosToCents(line.costPriceInput) * parseDecimal(line.quantityInput)) : 0)}</p></div>
                    <div className="self-end rounded-lg bg-emerald-50 p-3 text-sm"><span className="text-emerald-700">Myynti</span><p className="font-mono font-semibold text-emerald-950">{euro(Number.isFinite(eurosToCents(line.salePriceInput) * parseDecimal(line.quantityInput)) ? Math.round(eurosToCents(line.salePriceInput) * parseDecimal(line.quantityInput)) : 0)}</p></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4">
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Myynti</p><p className="mt-1 font-mono text-lg font-bold">{euro(totals.saleCents)}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Kustannus</p><p className="mt-1 font-mono text-lg font-bold">{euro(totals.costCents)}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Kate</p><p className="mt-1 font-mono text-lg font-bold">{euro(totals.marginCents)}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Kate-%</p><p className="mt-1 font-mono text-lg font-bold">{totals.marginPercent.toLocaleString('fi-FI', { maximumFractionDigits: 1 })} %</p></div>
            </div>
            {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDraftOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void saveDraft()} disabled={saving}>{saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}Tallenna luonnos</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={decisionOpen} onOpenChange={setDecisionOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Kirjaa tilaajan päätös</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="font-semibold">{decisionForm.changeOrder?.title}</p><p className="mt-1 text-2xl font-bold">{euro(decisionForm.changeOrder?.amountCents ?? 0)}</p><p className="mt-1 text-xs text-slate-500">Kirjaa tähän vain tilaajan muualla antama todennettava päätös. Tilaajaportaalissa tehty päätös tallentuu automaattisesti.</p></div>
            <div className="space-y-2"><Label>Päätös</Label><Select value={decisionForm.decision} onValueChange={(decision: DecisionForm['decision']) => setDecisionForm((old) => ({ ...old, decision }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Hyväksytty">Hyväksytty</SelectItem><SelectItem value="Hylätty">Hylätty</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="decision-name">Tilaajan päättäjän nimi *</Label><Input id="decision-name" value={decisionForm.approvedByName} onChange={(event) => setDecisionForm((old) => ({ ...old, approvedByName: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="decision-evidence">Päätöksen todiste *</Label><Textarea id="decision-evidence" rows={4} value={decisionForm.evidenceNote} onChange={(event) => setDecisionForm((old) => ({ ...old, evidenceNote: event.target.value }))} placeholder="Esim. hyväksyntä sähköpostissa 29.7.2026 tai työmaakokouksen pöytäkirja 12 §" /></div>
            {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDecisionOpen(false)} disabled={saving}>Peruuta</Button><Button variant={decisionForm.decision === 'Hylätty' ? 'destructive' : 'default'} onClick={() => void saveDecision()} disabled={saving}>{decisionForm.decision === 'Hyväksytty' ? <CheckCircle2 size={16} className="mr-2" /> : <XCircle size={16} className="mr-2" />}{saving ? 'Tallennetaan…' : decisionForm.decision}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
