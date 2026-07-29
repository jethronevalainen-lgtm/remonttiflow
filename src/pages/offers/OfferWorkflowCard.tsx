import { useQuery } from '@tanstack/react-query';
import {
  Archive,
  CheckCircle2,
  Copy,
  FolderKanban,
  ReceiptText,
  RefreshCw,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';
import type { Offer, OfferStatus, OfferVersion } from '@/lib/supabase/offers';
import { cn } from '@/lib/utils';
import { statusTone, workflowStep } from './offerUi';

const STEPS = ['Luonnos', 'Lähetetty', 'Tilaus', 'Projekti'] as const;

interface SalesOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  contractValueCents: number;
  costBudgetCents: number;
  targetMarginCents: number;
  targetMarginPercent: number;
  acceptedAt: string;
}

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

function numberValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function euroFromCents(value: number): string {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

function finnishDate(value: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('fi-FI', { dateStyle: 'medium' }).format(parsed);
}

async function loadSalesOrder(offerId: string): Promise<SalesOrderSummary | null> {
  const { data, error } = await supabase
    .from('sales_orders')
    .select('id, order_number, status, contract_value_cents, cost_budget_cents, target_margin_cents, target_margin_percent, accepted_at')
    .eq('offer_id', offerId)
    .maybeSingle();

  if (error) throw new Error(`Tilauksen haku epäonnistui: ${error.message}`);
  if (!data) return null;

  return {
    id: String(data.id),
    orderNumber: String(data.order_number ?? ''),
    status: String(data.status ?? 'Vahvistettu'),
    contractValueCents: numberValue(data.contract_value_cents),
    costBudgetCents: numberValue(data.cost_budget_cents),
    targetMarginCents: numberValue(data.target_margin_cents),
    targetMarginPercent: numberValue(data.target_margin_percent),
    acceptedAt: String(data.accepted_at ?? ''),
  };
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
  const shouldLoadOrder = offer.status === 'Hyväksytty' || hasConvertedProject;
  const awaitingProject = offer.status === 'Hyväksytty' && !hasConvertedProject;
  const orderQuery = useQuery({
    queryKey: ['offer-sales-order', offer.id],
    queryFn: () => loadSalesOrder(offer.id),
    enabled: shouldLoadOrder,
    staleTime: 30_000,
    retry: 1,
  });
  const salesOrder = orderQuery.data ?? null;
  const orderError = orderQuery.error instanceof Error
    ? orderQuery.error.message
    : shouldLoadOrder && !orderQuery.isLoading && !salesOrder
      ? 'Vahvistettua tilausta ei löytynyt. Tietoja ei muutettu; yritä haku uudelleen.'
      : null;

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

        {shouldLoadOrder && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4" aria-live="polite">
            {orderQuery.isLoading && <p className="text-sm text-emerald-900">Haetaan vahvistettua tilausta…</p>}
            {orderError && !orderQuery.isLoading && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="break-words text-sm text-red-700">{orderError}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => void orderQuery.refetch()}
                  disabled={orderQuery.isFetching}
                >
                  <RefreshCw size={14} className={cn('mr-2', orderQuery.isFetching && 'animate-spin')} />
                  Yritä uudelleen
                </Button>
              </div>
            )}
            {salesOrder && !orderQuery.isLoading && (
              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-2">
                    <ReceiptText size={18} className="mt-0.5 shrink-0 text-emerald-700" />
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-emerald-950">
                        Tilaus {salesOrder.orderNumber}
                      </p>
                      <p className="break-words text-xs text-emerald-800">
                        Vahvistettu {finnishDate(salesOrder.acceptedAt)} · tarjousversio on lukittu lähtötasoksi
                      </p>
                    </div>
                  </div>
                  <Badge className="w-fit border-emerald-300 bg-white text-emerald-800">
                    {salesOrder.status}
                  </Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg bg-white/80 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Sopimusarvo</p>
                    <p className="mt-1 break-words font-semibold text-slate-950">
                      {euroFromCents(salesOrder.contractValueCents)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/80 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Kustannusbudjetti</p>
                    <p className="mt-1 break-words font-semibold text-slate-950">
                      {euroFromCents(salesOrder.costBudgetCents)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/80 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Tavoitekate</p>
                    <p className="mt-1 break-words font-semibold text-slate-950">
                      {euroFromCents(salesOrder.targetMarginCents)} · {salesOrder.targetMarginPercent.toLocaleString('fi-FI', { maximumFractionDigits: 1 })} %
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {awaitingProject && salesOrder && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Tilaus on vahvistettu. Luo tai liitä projekti ennen tarjouksen arkistointia, jotta tilaus ei jää ilman tuotantokohdetta.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {draft && (
            <>
              <Button disabled={saving} onClick={() => onTransition('Lähetetty')}>
                <Send size={15} className="mr-2" /> Merkitse lähetetyksi
              </Button>
              <Button variant="outline" disabled={saving} onClick={() => onTransition('Hyväksytty')}>
                <CheckCircle2 size={15} className="mr-2" /> Hyväksy ja muodosta tilaus
              </Button>
              <Button variant="ghost" className="text-red-600" disabled={saving} onClick={onDeleteDraft}>
                <Trash2 size={15} className="mr-2" /> Poista luonnos
              </Button>
            </>
          )}
          {offer.status === 'Lähetetty' && (
            <>
              <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={saving} onClick={() => onTransition('Hyväksytty')}>
                <CheckCircle2 size={15} className="mr-2" /> Hyväksy ja muodosta tilaus
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
            <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={saving || orderQuery.isLoading || !salesOrder} onClick={onConvertProject}>
              <FolderKanban size={15} className="mr-2" /> Luo projekti tilauksesta
            </Button>
          )}
          {hasConvertedProject && (
            <Button disabled={saving} onClick={onOpenProject}>
              <FolderKanban size={15} className="mr-2" /> Avaa projekti
            </Button>
          )}
          {offer.status !== 'Arkistoitu' && !awaitingProject && (
            <Button variant="ghost" disabled={saving} onClick={() => onTransition('Arkistoitu')}>
              <Archive size={15} className="mr-2" /> Arkistoi
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
