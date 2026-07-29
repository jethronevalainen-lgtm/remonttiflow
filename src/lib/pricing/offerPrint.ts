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

function sectionSaleTotal(lines: OfferLine[]): number {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0);
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
  const visibleSections = input.sections.filter((section) => section.customerVisible);
  const sectionHtml = visibleSections
    .map((section, index) => {
      const sectionLines = input.lines.filter((line) => line.sectionId === section.id);
      if (!sectionLines.some((line) => line.customerVisible)) return '';
      const phaseTotal = sectionSaleTotal(sectionLines.filter((line) => line.customerVisible));
      return `<section class="phase">
        <div class="phase-head">
          <div>
            <span class="phase-index">Vaihe ${index + 1}</span>
            <h2>${escapeHtml(section.title)}</h2>
          </div>
          <div class="phase-total">${escapeHtml(euro(phaseTotal))}</div>
        </div>
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
    ? `<section class="phase">
        <div class="phase-head">
          <div>
            <span class="phase-index">Muut</span>
            <h2>Muut työt ja tuotteet</h2>
          </div>
          <div class="phase-total">${escapeHtml(euro(sectionSaleTotal(unsectioned)))}</div>
        </div>
        <table>
          <thead><tr><th>Työ tai tuote</th><th class="number">Määrä</th><th>Yks.</th><th class="number">Yksikköhinta</th><th class="number">Yhteensä</th></tr></thead>
          <tbody>${rows(unsectioned)}</tbody>
        </table>
      </section>`
    : '';

  const phaseCount = visibleSections.filter((section) => (
    input.lines.some((line) => line.sectionId === section.id && line.customerVisible)
  )).length + (unsectioned.length ? 1 : 0);

  return `<!doctype html>
<html lang="fi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(input.offer.offerNumber)} – ${escapeHtml(input.offer.name)}</title>
  <style>
    :root {
      --ink: #0f172a;
      --muted: #64748b;
      --line: #e2e8f0;
      --accent: #ea580c;
      --soft: #fff7ed;
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      color: var(--ink);
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%); }
    main {
      width: min(100%, 960px);
      margin: 0 auto;
      background: white;
      padding: 48px;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.08);
    }
    header {
      display: flex;
      justify-content: space-between;
      gap: 32px;
      padding-bottom: 28px;
      border-bottom: 4px solid var(--accent);
      background:
        radial-gradient(circle at top right, rgba(234, 88, 12, 0.12), transparent 42%),
        linear-gradient(180deg, #fff 0%, #fffaf5 100%);
      margin: -48px -48px 0;
      padding: 48px 48px 28px;
    }
    h1 { margin: 8px 0 0; font-size: 34px; letter-spacing: -0.03em; }
    h2 { margin: 0; font-size: 20px; letter-spacing: -0.02em; }
    p { margin: 4px 0; line-height: 1.55; }
    .brand {
      color: var(--accent);
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
      font-size: 13px;
    }
    .offer-kicker {
      margin-top: 10px;
      color: var(--muted);
      font-size: 14px;
    }
    .meta { min-width: 280px; }
    .meta-card {
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 16px 18px;
      background: white;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      padding: 6px 0;
      border-bottom: 1px dashed #edf2f7;
      font-size: 14px;
    }
    .meta-row:last-child { border-bottom: 0; }
    .intro {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      margin-top: 28px;
    }
    .box {
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 18px;
      background: linear-gradient(180deg, #ffffff, #f8fafc);
    }
    .box strong { display: block; margin-bottom: 8px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
    .phase {
      margin-top: 28px;
      border: 1px solid var(--line);
      border-radius: 18px;
      overflow: hidden;
      background: white;
    }
    .phase-head {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: end;
      padding: 18px 18px 12px;
      background: linear-gradient(90deg, var(--soft), white 55%);
      border-bottom: 1px solid #fed7aa;
    }
    .phase-index {
      display: inline-block;
      margin-bottom: 6px;
      color: var(--accent);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .phase-total {
      font-size: 18px;
      font-weight: 800;
      white-space: nowrap;
    }
    .section-description {
      margin: 0;
      padding: 0 18px 8px;
      color: #475569;
      font-size: 14px;
    }
    table { width: 100%; border-collapse: collapse; }
    th {
      background: #f8fafc;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .06em;
      text-align: left;
      color: var(--muted);
    }
    th, td { border-bottom: 1px solid var(--line); padding: 12px 18px; vertical-align: top; }
    tr:last-child td { border-bottom: 0; }
    .number { text-align: right; white-space: nowrap; }
    .note { margin-top: 4px; color: var(--muted); font-size: 12px; }
    .option { margin-top: 4px; color: #b45309; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .totals {
      width: min(100%, 420px);
      margin: 32px 0 0 auto;
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 18px 20px;
      background: linear-gradient(180deg, #fff7ed, #ffffff);
    }
    .total-row { display: flex; justify-content: space-between; gap: 20px; padding: 8px 0; }
    .grand-total {
      margin-top: 8px;
      padding-top: 14px;
      border-top: 2px solid var(--ink);
      font-size: 22px;
      font-weight: 800;
    }
    .terms {
      margin-top: 36px;
      padding: 22px;
      border-radius: 18px;
      border: 1px solid var(--line);
      background: #f8fafc;
      white-space: pre-wrap;
    }
    footer { margin-top: 36px; color: var(--muted); font-size: 11px; }
    .actions {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      justify-content: center;
      gap: 10px;
      padding: 12px;
      background: #0f172a;
    }
    .actions button {
      border: 0;
      border-radius: 999px;
      background: var(--accent);
      color: white;
      padding: 10px 18px;
      font-weight: 700;
      cursor: pointer;
    }
    @media print {
      body { background: white; }
      main { width: auto; padding: 16mm 14mm; box-shadow: none; }
      header { margin: -16mm -14mm 0; padding: 16mm 14mm 8mm; }
      .actions { display: none; }
      section, table, .box, .phase, .totals { break-inside: avoid; }
    }
    @media (max-width: 760px) {
      main { padding: 24px 16px; }
      header, .intro { display: block; }
      header { margin: -24px -16px 0; padding: 24px 16px 18px; }
      .meta, .intro .box { margin-top: 14px; }
      .phase-head { display: block; }
      .phase-total { margin-top: 10px; }
      table { font-size: 12px; }
      th, td { padding: 10px 12px; }
    }
  </style>
</head>
<body>
  <div class="actions"><button type="button" onclick="window.print()">Tulosta tai tallenna PDF</button></div>
  <main>
    <header>
      <div>
        <div class="brand">${escapeHtml(input.companyName)}</div>
        <h1>Tarjous</h1>
        <p class="offer-kicker">${escapeHtml(input.offer.name)}</p>
        <p class="offer-kicker">${escapeHtml(String(phaseCount))} hinnoiteltua vaihetta · versio ${escapeHtml(input.version.versionNumber)}</p>
      </div>
      <div class="meta">
        <div class="meta-card">
          <div class="meta-row"><span>Tarjousnumero</span><strong>${escapeHtml(input.offer.offerNumber)}</strong></div>
          <div class="meta-row"><span>Päiväys</span><strong>${escapeHtml(date(input.version.createdAt))}</strong></div>
          <div class="meta-row"><span>Voimassa</span><strong>${escapeHtml(date(input.offer.validUntil))}</strong></div>
        </div>
      </div>
    </header>
    <div class="intro">
      <div class="box"><strong>Asiakas</strong><p>${escapeHtml(input.customerName || 'Asiakas')}</p>${input.offer.customerReference ? `<p>Viite: ${escapeHtml(input.offer.customerReference)}</p>` : ''}</div>
      <div class="box"><strong>Toimitusaika</strong><p>${escapeHtml(input.offer.deliveryTime || 'Sovitaan erikseen')}</p></div>
      <div class="box"><strong>Maksuehto</strong><p>${escapeHtml(input.offer.paymentTerms || '14 päivää netto')}</p></div>
    </div>
    ${input.version.notes ? `<section class="terms" style="margin-top:24px"><h2 style="margin-bottom:8px;font-size:16px">Tarjouksen sisältö</h2><p>${escapeHtml(input.version.notes)}</p></section>` : ''}
    ${sectionHtml}
    ${unsectionedHtml}
    <div class="totals">
      <div class="total-row"><span>Veroton hinta</span><strong>${escapeHtml(euro(input.version.subtotalCents))}</strong></div>
      <div class="total-row"><span>ALV ${escapeHtml(input.version.vatRate)} %</span><strong>${escapeHtml(euro(input.version.taxCents))}</strong></div>
      <div class="total-row grand-total"><span>Yhteensä</span><span>${escapeHtml(euro(input.version.totalCents))}</span></div>
    </div>
    ${input.version.terms ? `<div class="terms"><h2 style="margin-bottom:8px;font-size:16px">Ehdot ja rajaukset</h2><p>${escapeHtml(input.version.terms)}</p></div>` : ''}
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
