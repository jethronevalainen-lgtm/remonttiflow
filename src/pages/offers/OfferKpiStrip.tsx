import { CheckCircle2, FileText, Percent, Send, Wallet } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import type { Offer, OfferVersion } from '@/lib/supabase/offers';
import { euro, latestVersionForOffer, marginTone } from './offerUi';

interface OfferKpiStripProps {
  offers: Offer[];
  versions: OfferVersion[];
}

export function OfferKpiStrip({ offers, versions }: OfferKpiStripProps) {
  const drafts = offers.filter((offer) => offer.status === 'Luonnos').length;
  const sent = offers.filter((offer) => offer.status === 'Lähetetty').length;
  const accepted = offers.filter((offer) => offer.status === 'Hyväksytty').length;
  const openOffers = offers.filter((offer) => offer.status === 'Luonnos' || offer.status === 'Lähetetty');
  const pipelineCents = openOffers.reduce((sum, offer) => {
    const version = latestVersionForOffer(versions, offer.id);
    return sum + (version?.totalCents ?? 0);
  }, 0);
  const marginSamples = openOffers
    .map((offer) => latestVersionForOffer(versions, offer.id))
    .filter((version): version is OfferVersion => Boolean(version && version.subtotalCents > 0));
  const averageMargin = marginSamples.length
    ? marginSamples.reduce((sum, version) => sum + version.grossMarginPercent, 0) / marginSamples.length
    : 0;

  const items = [
    { label: 'Luonnokset', value: String(drafts), detail: 'Muokattavissa', icon: FileText, tone: 'text-orange-700' },
    { label: 'Lähetetty', value: String(sent), detail: 'Odottaa vastausta', icon: Send, tone: 'text-sky-700' },
    { label: 'Hyväksytty', value: String(accepted), detail: 'Valmis projektiksi', icon: CheckCircle2, tone: 'text-emerald-700' },
    { label: 'Avoin tarjouskanta', value: euro(pipelineCents), detail: `${openOffers.length} avointa`, icon: Wallet, tone: 'text-slate-800' },
    {
      label: 'Keskim. kate',
      value: marginSamples.length ? `${averageMargin.toFixed(1)} %` : '—',
      detail: 'Avoimista tarjouksista',
      icon: Percent,
      tone: marginTone(averageMargin),
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label} className="border-slate-200/80 shadow-none">
            <CardContent className="flex items-start gap-3 p-4">
              <div className="rounded-xl bg-slate-50 p-2.5 text-slate-500">
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
                <p className={`mt-1 break-words font-mono text-lg font-bold ${item.tone}`}>{item.value}</p>
                <p className="mt-0.5 break-words text-xs text-slate-500">{item.detail}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
