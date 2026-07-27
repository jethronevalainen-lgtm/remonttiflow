import type { Offer, OfferLine, OfferSection, OfferVersion } from '@/lib/supabase/offers';

interface OfferPrintInput {
  companyName: string;
  customerName: string;
  offer: Offer;
  version: OfferVersion;
  sections: OfferSection[];
  lines: OfferLine[];
}

function escapeHtml(value: string | number | undefined): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function euro(cents: number): string {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function date(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

function lineTotal(line: OfferLine): number {
  if (line.optional) return 0;
  const effectiveQuantity = line.quantity * (1 + line.wastePercent / 100);
  return Math.round(
    effectiveQuantity * line.saleUnitPriceCents * (1 - line.discountPercent / 100),
  );
}

function rows(lines: OfferLine[]): string {
  return lines
    .filter((line) => line.customerVisible)
    .map((line) => {
      const total = line.optional
        ? `${euro(Math.round(line.quantity * line.saleUnitPriceCents))} (optio)`
        : euro(lineTotal(line));
      return `<tr>
        <td><strong>${escapeHtml(line.description)}</strong>${line.customerNote ? `<div class="note">${escapeHtml(line.customerNote)}</div>` : ''}${line.optional ? '<div class="option">Valinnainen lisätyö</div>' : ''}</td>
        <td class="number">${escapeHtml(new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 3 }).format(line.quantity))}</td>
        <td>${escapeHtml(line.unit)}</td>
        <td class="number">${escapeHtml(euro(line.saleUnitPriceCents))}</td>
        <td class="number"><strong>${escapeHtml(total)}</strong></td>
      </tr>`;
    })
    .join('');
}

export function buildOfferPrintHtml(input: OfferPrintInput): string {
  const sectionHtml = input.sections
    .filter((section) => section.customerVisible)
    .map((section) => {
      const sectionLines = input.lines.filter((line) => line.sectionId === section.id);
      if (!sectionLines.some((line) => line.customerVisible)) return '';
      return `<section>
        <h2>${escapeHtml(section.title)}</h2>
        ${section.description ? `<p class="section-description">${escapeHtml(section.description)}</p>` : ''}
        <table>
          <thead><tr><th>Työ tai tuote</th><th class="number">Määrä</th><th>Yks.</th><th class="number">Yksikköhinta</th><th class="number">Yhteensä</th></tr></thead>
          <tbody>${rows(sectionLines)}</tbody>
        </table>
      </section>`;
    })
    .join('');
  const unsectioned = input.lines.filter((line) => !line.sectionId && line.customerVisible);
  const unsectionedHtml = unsectioned.length
    ? `<section><h2>Muut työt ja tuotteet</h2><table><thead><tr><th>Työ tai tuote</th><th class="number">Määrä</th><th>Yks.</th><th class="number">Yksikköhinta</th><th class="number">Yhteensä</th></tr></thead><tbody>${rows(unsectioned)}</tbody></table></section>`
    : '';

  return `<!doctype html>
<html lang="fi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(input.offer.offerNumber)} – ${escapeHtml(input.offer.name)}</title>
  <style>
    :root { font-family: Inter, Arial, sans-serif; color: #0f172a; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f8fafc; }
    main { width: min(100%, 960px); margin: 0 auto; background: white; padding: 48px; }
    header { display: flex; justify-content: space-between; gap: 32px; padding-bottom: 28px; border-bottom: 3px solid #f97316; }
    h1 { margin: 6px 0 0; font-size: 30px; }
    h2 { margin: 34px 0 10px; font-size: 18px; }
    p { margin: 4px 0; line-height: 1.5; }
    .brand { color: #f97316; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
    .meta { min-width: 280px; }
    .meta-row { display: flex; justify-content: space-between; gap: 20px; padding: 4px 0; }
    .intro { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 28px; }
    .box { border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; text-align: left; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; vertical-align: top; }
    .number { text-align: right; white-space: nowrap; }
    .note { margin-top: 3px; color: #64748b; font-size: 12px; }
    .option { margin-top: 4px; color: #b45309; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .section-description { color: #475569; }
    .totals { width: min(100%, 430px); margin: 32px 0 0 auto; }
    .total-row { display: flex; justify-content: space-between; gap: 20px; padding: 7px 0; }
    .grand-total { margin-top: 8px; padding-top: 12px; border-top: 2px solid #0f172a; font-size: 20px; font-weight: 800; }
    .terms { margin-top: 36px; padding-top: 24px; border-top: 1px solid #cbd5e1; white-space: pre-wrap; }
    footer { margin-top: 44px; color: #64748b; font-size: 11px; }
    .actions { position: sticky; top: 0; display: flex; justify-content: center; padding: 12px; background: #0f172a; }
    .actions button { border: 0; border-radius: 8px; background: #f97316; color: white; padding: 10px 18px; font-weight: 700; cursor: pointer; }
    @media print {
      body { background: white; }
      main { width: auto; padding: 18mm 15mm; }
      .actions { display: none; }
      section, table, .box { break-inside: avoid; }
    }
    @media (max-width: 700px) {
      main { padding: 24px 16px; }
      header, .intro { display: block; }
      .meta, .intro .box { margin-top: 18px; }
      table { font-size: 12px; }
    }
  </style>
</head>
<body>
  <div class="actions"><button type="button" onclick="window.print()">Tulosta tai tallenna PDF</button></div>
  <main>
    <header>
      <div><div class="brand">${escapeHtml(input.companyName)}</div><h1>Tarjous</h1><p>${escapeHtml(input.offer.name)}</p></div>
      <div class="meta">
        <div class="meta-row"><span>Tarjousnumero</span><strong>${escapeHtml(input.offer.offerNumber)}</strong></div>
        <div class="meta-row"><span>Versio</span><strong>${escapeHtml(input.version.versionNumber)}</strong></div>
        <div class="meta-row"><span>Päiväys</span><strong>${escapeHtml(date(input.version.createdAt))}</strong></div>
        <div class="meta-row"><span>Voimassa</span><strong>${escapeHtml(date(input.offer.validUntil))}</strong></div>
      </div>
    </header>
    <div class="intro">
      <div class="box"><strong>Asiakas</strong><p>${escapeHtml(input.customerName || 'Asiakas')}</p>${input.offer.customerReference ? `<p>Viite: ${escapeHtml(input.offer.customerReference)}</p>` : ''}</div>
      <div class="box"><strong>Toimitus ja maksuehto</strong><p>${escapeHtml(input.offer.deliveryTime || 'Sovitaan erikseen')}</p><p>${escapeHtml(input.offer.paymentTerms || '14 päivää netto')}</p></div>
    </div>
    ${input.version.notes ? `<section><h2>Tarjouksen sisältö</h2><p>${escapeHtml(input.version.notes)}</p></section>` : ''}
    ${sectionHtml}
    ${unsectionedHtml}
    <div class="totals">
      <div class="total-row"><span>Veroton hinta</span><strong>${escapeHtml(euro(input.version.subtotalCents))}</strong></div>
      <div class="total-row"><span>ALV ${escapeHtml(input.version.vatRate)} %</span><strong>${escapeHtml(euro(input.version.taxCents))}</strong></div>
      <div class="total-row grand-total"><span>Yhteensä</span><span>${escapeHtml(euro(input.version.totalCents))}</span></div>
    </div>
    ${input.version.terms ? `<div class="terms"><h2>Ehdot ja rajaukset</h2><p>${escapeHtml(input.version.terms)}</p></div>` : ''}
    <footer>Tarjous on laadittu VaKantti-järjestelmällä. Asiakkaalle tarkoitettu tuloste ei sisällä yrityksen sisäisiä kustannustietoja.</footer>
  </main>
</body>
</html>`;
}

export function openOfferPrintWindow(input: OfferPrintInput): void {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) throw new Error('Tulostusikkunan avaaminen estettiin. Salli ponnahdusikkunat ja yritä uudelleen.');
  printWindow.document.open();
  printWindow.document.write(buildOfferPrintHtml(input));
  printWindow.document.close();
}
