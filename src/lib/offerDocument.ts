import type { Customer } from '@/types';
import type {
  Offer,
  OfferLine,
  OfferVersion,
  OrganizationCommercialSettings,
} from '@/lib/supabase/offers';

export interface OfferPrintOrganization {
  name: string;
  businessId?: string;
}

export interface OfferPrintInput {
  organization: OfferPrintOrganization;
  customer?: Customer;
  offer: Offer;
  version: OfferVersion;
  lines: OfferLine[];
  settings: OrganizationCommercialSettings;
  generatedAt?: Date;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function multiline(value?: string): string {
  return escapeHtml(value ?? '').replaceAll('\n', '<br />');
}

export function calculateDirectCents(lines: OfferLine[]): number {
  return lines.reduce(
    (sum, line) => sum + Math.round(line.quantity * line.unitPriceCents),
    0,
  );
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat('fi-FI', {
    maximumFractionDigits: 3,
  }).format(value);
}

function percentageAmount(directCents: number, percentage: number): number {
  return Math.round(directCents * percentage / 100);
}

export function buildOfferPrintHtml(input: OfferPrintInput): string {
  const generatedAt = input.generatedAt ?? new Date();
  const directCents = calculateDirectCents(input.lines);
  const overheadCents = percentageAmount(directCents, input.version.overheadPercent);
  const riskCents = percentageAmount(directCents, input.version.riskPercent);
  const marginCents = percentageAmount(directCents, input.version.marginPercent);
  const vatCents = Math.max(0, input.version.totalCents - input.version.subtotalCents);
  const customer = input.customer;

  const companyAddress = [
    input.settings.companyAddress,
    [input.settings.companyPostalCode, input.settings.companyCity].filter(Boolean).join(' '),
  ].filter(Boolean).map((value) => `<div>${escapeHtml(value as string)}</div>`).join('');

  const customerContact = [
    customer?.contactPerson,
    customer?.email,
    customer?.phone,
  ].filter(Boolean).map((value) => `<div>${escapeHtml(value as string)}</div>`).join('');

  const rows = input.lines.map((line) => {
    const rowTotal = Math.round(line.quantity * line.unitPriceCents);
    return `
      <tr>
        <td>${escapeHtml(line.category)}</td>
        <td>${escapeHtml(line.description)}</td>
        <td class="number">${formatQuantity(line.quantity)}</td>
        <td>${escapeHtml(line.unit)}</td>
        <td class="number">${formatCents(line.unitPriceCents)}</td>
        <td class="number strong">${formatCents(rowTotal)}</td>
      </tr>`;
  }).join('');

  const validUntil = input.offer.validUntil
    ? new Date(`${input.offer.validUntil}T00:00:00`).toLocaleDateString('fi-FI')
    : 'Ei määritetty';

  return `<!doctype html>
<html lang="fi">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(input.offer.offerNumber || input.offer.name)}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #172033; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.45; }
    h1, h2, p { margin: 0; }
    .header { display: flex; justify-content: space-between; gap: 24px; padding-bottom: 18px; border-bottom: 3px solid #f97316; }
    .brand { font-size: 23px; font-weight: 800; letter-spacing: -0.4px; }
    .muted { color: #64748b; }
    .right { text-align: right; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 22px 0; }
    .box { min-height: 110px; padding: 14px; border: 1px solid #dbe2ea; border-radius: 10px; }
    .box h2 { margin-bottom: 8px; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
    .offer-title { margin: 24px 0 14px; font-size: 25px; line-height: 1.15; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 9px 7px; background: #f1f5f9; color: #475569; font-size: 10px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 10px 7px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    .number { text-align: right; white-space: nowrap; }
    .strong { font-weight: 700; }
    .totals { width: 360px; max-width: 100%; margin: 20px 0 0 auto; }
    .total-row { display: flex; justify-content: space-between; gap: 20px; padding: 5px 0; }
    .grand { margin-top: 8px; padding-top: 10px; border-top: 2px solid #172033; font-size: 16px; font-weight: 800; }
    .section { margin-top: 24px; page-break-inside: avoid; }
    .section h2 { margin-bottom: 8px; font-size: 13px; }
    .section-content { padding: 13px; border: 1px solid #dbe2ea; border-radius: 8px; white-space: normal; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #dbe2ea; color: #64748b; font-size: 10px; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <header class="header">
    <div>
      <div class="brand">${escapeHtml(input.organization.name)}</div>
      ${input.organization.businessId ? `<div>Y-tunnus ${escapeHtml(input.organization.businessId)}</div>` : ''}
      ${companyAddress}
      ${input.settings.companyEmail ? `<div>${escapeHtml(input.settings.companyEmail)}</div>` : ''}
      ${input.settings.companyPhone ? `<div>${escapeHtml(input.settings.companyPhone)}</div>` : ''}
    </div>
    <div class="right">
      <div class="muted">TARJOUS</div>
      <div class="strong">${escapeHtml(input.offer.offerNumber || 'Ei tarjousnumeroa')}</div>
      <div>Versio ${input.version.versionNumber}</div>
      <div>Voimassa ${escapeHtml(validUntil)} asti</div>
    </div>
  </header>

  <h1 class="offer-title">${escapeHtml(input.version.title || input.offer.name)}</h1>

  <section class="meta">
    <div class="box">
      <h2>Asiakas</h2>
      <div class="strong">${escapeHtml(customer?.name || 'Asiakasta ei ole valittu')}</div>
      ${customer?.businessId ? `<div>Y-tunnus ${escapeHtml(customer.businessId)}</div>` : ''}
      ${customer?.address ? `<div>${escapeHtml(customer.address)}</div>` : ''}
      ${customerContact}
    </div>
    <div class="box">
      <h2>Tarjouksen tiedot</h2>
      <div><span class="muted">Tila:</span> ${escapeHtml(input.offer.status)}</div>
      <div><span class="muted">Valuutta:</span> EUR</div>
      <div><span class="muted">ALV:</span> ${formatQuantity(input.version.vatRate)} %</div>
      <div><span class="muted">Maksuehto:</span> ${input.settings.defaultPaymentTermDays} pv netto</div>
    </div>
  </section>

  <table>
    <thead>
      <tr>
        <th>Ryhmä</th>
        <th>Kuvaus</th>
        <th class="number">Määrä</th>
        <th>Yks.</th>
        <th class="number">Yksikköhinta</th>
        <th class="number">Yhteensä</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="6">Tarjouksella ei ole rivejä.</td></tr>'}</tbody>
  </table>

  <div class="totals">
    <div class="total-row"><span>Rivit yhteensä</span><span>${formatCents(directCents)}</span></div>
    ${input.version.overheadPercent ? `<div class="total-row"><span>Yleiskulu ${formatQuantity(input.version.overheadPercent)} %</span><span>${formatCents(overheadCents)}</span></div>` : ''}
    ${input.version.riskPercent ? `<div class="total-row"><span>Riskivaraus ${formatQuantity(input.version.riskPercent)} %</span><span>${formatCents(riskCents)}</span></div>` : ''}
    ${input.version.marginPercent ? `<div class="total-row"><span>Kate ${formatQuantity(input.version.marginPercent)} %</span><span>${formatCents(marginCents)}</span></div>` : ''}
    <div class="total-row strong"><span>Veroton hinta</span><span>${formatCents(input.version.subtotalCents)}</span></div>
    <div class="total-row"><span>ALV ${formatQuantity(input.version.vatRate)} %</span><span>${formatCents(vatCents)}</span></div>
    <div class="total-row grand"><span>Yhteensä</span><span>${formatCents(input.version.totalCents)}</span></div>
  </div>

  ${input.version.notes || input.offer.notes ? `
    <section class="section">
      <h2>Lisätiedot</h2>
      <div class="section-content">${multiline(input.version.notes || input.offer.notes)}</div>
    </section>` : ''}

  ${input.version.terms || input.settings.defaultOfferTerms ? `
    <section class="section">
      <h2>Tarjouksen ehdot</h2>
      <div class="section-content">${multiline(input.version.terms || input.settings.defaultOfferTerms)}</div>
    </section>` : ''}

  <footer class="footer">
    Asiakirja muodostettu ${escapeHtml(generatedAt.toLocaleString('fi-FI'))}. Tarkista sisältö ennen lähettämistä.
  </footer>
</body>
</html>`;
}
