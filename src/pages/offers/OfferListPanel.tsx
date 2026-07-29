import { AlertTriangle, Loader2, Search, UserRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Offer, OfferVersion } from '@/lib/supabase/offers';
import { cn } from '@/lib/utils';
import {
  date,
  euro,
  expiryLabel,
  latestVersionForOffer,
  marginTone,
  OFFER_STATUSES,
  statusTone,
} from './offerUi';

interface OfferListItemMeta {
  customerName?: string;
  assigneeName?: string;
}

interface OfferListPanelProps {
  offers: Offer[];
  versions: OfferVersion[];
  selectedOfferId?: string;
  search: string;
  statusFilter: string;
  scopeFilter: string;
  loading: boolean;
  metaForOffer: (offer: Offer) => OfferListItemMeta;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onScopeFilterChange: (value: string) => void;
  onSelect: (offerId: string) => void;
}

export function OfferListPanel({
  offers,
  versions,
  selectedOfferId,
  search,
  statusFilter,
  scopeFilter,
  loading,
  metaForOffer,
  onSearchChange,
  onStatusFilterChange,
  onScopeFilterChange,
  onSelect,
}: OfferListPanelProps) {
  return (
    <Card className="h-fit border-slate-200/80 shadow-none xl:sticky xl:top-4">
      <CardContent className="space-y-3 p-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Hae nimeä, numeroa tai asiakasta"
            className="pl-9"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger><SelectValue placeholder="Tila" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Kaikki tilat</SelectItem>
              {OFFER_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={scopeFilter} onValueChange={onScopeFilterChange}>
            <SelectTrigger><SelectValue placeholder="Näytä" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Kaikki tarjoukset</SelectItem>
              <SelectItem value="mine">Omat</SelectItem>
              <SelectItem value="expiring">Vanhenevat / vanhentuneet</SelectItem>
              <SelectItem value="convertible">Hyväksytty ilman projektia</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-[68vh] space-y-2 overflow-y-auto pr-1">
          {offers.map((offer) => {
            const version = latestVersionForOffer(versions, offer.id);
            const meta = metaForOffer(offer);
            const expiry = expiryLabel(offer.validUntil, offer.status);
            const selected = selectedOfferId === offer.id;
            return (
              <button
                key={offer.id}
                type="button"
                onClick={() => onSelect(offer.id)}
                className={cn(
                  'w-full rounded-xl border p-3 text-left transition',
                  selected
                    ? 'border-orange-400 bg-orange-50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-slate-900">{offer.name}</p>
                    <p className="mt-0.5 break-words font-mono text-xs text-slate-500">
                      {offer.offerNumber || 'Numero muodostuu tallennuksessa'}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn('shrink-0', statusTone(offer.status))}>
                    {offer.status}
                  </Badge>
                </div>
                <p className="mt-2 break-words text-sm text-slate-600">
                  {meta.customerName || 'Ei asiakasta'}
                </p>
                {meta.assigneeName && (
                  <p className="mt-1 flex items-start gap-1 break-words text-xs text-slate-500">
                    <UserRound size={12} className="mt-0.5 shrink-0" />
                    {meta.assigneeName}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">Voimassa {date(offer.validUntil)}</p>
                    {expiry && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-amber-700">
                        <AlertTriangle size={12} className="shrink-0" />
                        {expiry}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <strong className="font-mono text-sm text-slate-900">
                      {version ? euro(version.totalCents) : '—'}
                    </strong>
                    {version && version.subtotalCents > 0 && (
                      <p className={cn('text-xs font-semibold', marginTone(version.grossMarginPercent))}>
                        Kate {version.grossMarginPercent.toFixed(1)} %
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {!loading && offers.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              Ei tarjouksia valituilla suodattimilla.
            </div>
          )}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 size={17} className="animate-spin" />
              Ladataan tarjouksia…
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
