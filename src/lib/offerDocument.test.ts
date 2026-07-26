import { describe, expect, it } from 'vitest';

import {
  buildOfferPrintHtml,
  calculateDirectCents,
  escapeHtml,
} from './offerDocument';
import type { Offer, OfferLine, OfferVersion } from './supabase/offers';

const offer: Offer = {
  id: 'offer-1',
  organizationId: 'org-1',
  name: 'Kylpyhuoneremontti',
  status: 'Luonnos',
  currency: 'EUR',
  createdAt: '2026-07-26T10:00:00Z',
  updatedAt: '2026-07-26T10:00:00Z',
};

const version: OfferVersion = {
  id: 'version-1',
  organizationId: 'org-1',
  offerId: 'offer-1',
  versionNumber: 1,
  status: 'Luonnos',
  title: '<Kylpyhuone & sauna>',
  vatRate: 25.5,
  overheadPercent: 10,
  riskPercent: 5,
  marginPercent: 15,
  subtotalCents: 130_000,
  totalCents: 163_150,
  terms: 'Maksuehto 14 pv\nEi käteistä.',
  createdAt: '2026-07-26T10:00:00Z',
};

const lines: OfferLine[] = [
  {
    id: 'line-1',
    organizationId: 'org-1',
    offerVersionId: 'version-1',
    category: 'Työ',
    description: 'Purkutyö <sisältää suojauksen>',
    quantity: 2.5,
    unit: 'h',
    unitPriceCents: 40_000,
    sortOrder: 10,
    createdAt: '2026-07-26T10:00:00Z',
  },
];

describe('offerDocument', () => {
  it('escapes unsafe HTML characters', () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
  });

  it('calculates direct line totals in cents', () => {
    expect(calculateDirectCents(lines)).toBe(100_000);
  });

  it('creates an escaped printable document with totals', () => {
    const html = buildOfferPrintHtml({
      organization: { name: 'Rakennus & Kumppanit' },
      offer,
      version,
      lines,
      settings: {
        organizationId: 'org-1',
        locale: 'fi-FI',
        timezone: 'Europe/Helsinki',
        defaultVatRate: 25.5,
        defaultOverheadPercent: 10,
        defaultRiskPercent: 5,
        defaultMarginPercent: 15,
        defaultHourlyCostCents: 4_000,
        defaultPaymentTermDays: 14,
        defaultOfferValidDays: 30,
      },
      generatedAt: new Date('2026-07-26T10:00:00Z'),
    });

    expect(html).toContain('Rakennus &amp; Kumppanit');
    expect(html).toContain('&lt;Kylpyhuone &amp; sauna&gt;');
    expect(html).toContain('Purkutyö &lt;sisältää suojauksen&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('1 000,00 €');
    expect(html).toContain('1 631,50 €');
  });
});
