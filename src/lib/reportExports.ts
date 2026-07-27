import type {
  ReportCenterColumn,
  ReportCenterDataset,
  ReportCenterInsight,
  ReportMetricFormat,
} from '@/lib/supabase/reportCenter';

interface SheetCell {
  value: unknown;
  type?: 'text' | 'number' | 'money' | 'boolean';
  bold?: boolean;
}

function safeFilePart(value: string): string {
  return value
    .toLocaleLowerCase('fi')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9åäö]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'raportti';
}

function datePart(): string {
  return new Date().toISOString().slice(0, 10);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function blobFromBytes(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copy.set(bytes);
  return new Blob([copy.buffer], { type });
}

function formatValue(value: unknown, column?: ReportCenterColumn): string {
  if (value === null || value === undefined || value === '') return '';
  if (column?.type === 'boolean') return value === true || value === 'true' ? 'Kyllä' : 'Ei';
  if (column?.type === 'money') {
    const amount = Number(value);
    return Number.isFinite(amount)
      ? new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(amount)
      : String(value);
  }
  if (column?.type === 'number') {
    const amount = Number(value);
    return Number.isFinite(amount)
      ? new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 2 }).format(amount)
      : String(value);
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
  }
  return String(value);
}

function summaryLabel(key: string): string {
  const labels: Record<string, string> = {
    rowCount: 'Rivejä', hours: 'Tunnit', totalRecordedHours: 'Kirjatut tunnit', overtime: 'Ylityö',
    approvedRows: 'Hyväksyttyjä', pendingRows: 'Odottaa hyväksyntää', rejectedRows: 'Hylättyjä', approvalRate: 'Hyväksymisaste',
    missingDescriptions: 'Puuttuvat selosteet', shortDescriptions: 'Liian lyhyet selosteet',
    openCheckIns: 'Avoimet kirjautumiset', durationHours: 'Läsnäoloaika', longPresence: 'Yli 12 h läsnäolot',
    outsideGeofence: 'Työmaa-alueen ulkopuolella', weakLocation: 'Heikko sijaintitarkkuus',
    amountEur: 'Kulut yhteensä', approvedAmountEur: 'Hyväksytyt kulut', pendingAmountEur: 'Odottaa hyväksyntää',
    rejectedAmountEur: 'Hylätyt kulut', missingAttachments: 'Puuttuvat liitteet',
    budgetEur: 'Budjetti', spentEur: 'Toteuma', overBudgetEur: 'Budjetin ylitys', overBudgetProjects: 'Budjetin ylittäneet',
    delayedProjects: 'Myöhässä', approvedHours: 'Hyväksytyt tunnit', pendingHours: 'Odottavat tunnit', openWorkOrders: 'Avoimet työmääräykset',
    maintenanceDue: 'Huolto 30 päivän sisällä', overdueMaintenance: 'Huolto myöhässä', dueSoonMaintenance: 'Huolto 30 päivän sisällä',
    unassignedEquipment: 'Ilman vastuuhenkilöä', inMaintenance: 'Huollossa',
  };
  return labels[key] || key;
}

function summaryFormat(key: string): ReportMetricFormat {
  if (['amountEur', 'approvedAmountEur', 'pendingAmountEur', 'rejectedAmountEur', 'budgetEur', 'spentEur', 'overBudgetEur'].includes(key)) return 'money';
  if (['hours', 'totalRecordedHours', 'overtime', 'durationHours', 'approvedHours', 'pendingHours'].includes(key)) return 'hours';
  if (key === 'approvalRate') return 'percent';
  return 'number';
}

function metricValue(value: unknown, format: ReportMetricFormat): string {
  const number = Number(value);
  if (format === 'money' && Number.isFinite(number)) return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(number);
  if (format === 'hours' && Number.isFinite(number)) return `${new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 2 }).format(number)} h`;
  if (format === 'percent' && Number.isFinite(number)) return `${new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 1 }).format(number)} %`;
  return Number.isFinite(number) ? new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 2 }).format(number) : String(value ?? '—');
}

function severityLabel(insight: ReportCenterInsight): string {
  if (insight.severity === 'critical') return 'Vaatii toimenpiteen';
  if (insight.severity === 'warning') return 'Tarkistettava';
  if (insight.severity === 'success') return 'Kunnossa';
  return 'Huomio';
}

function contextRows(dataset: ReportCenterDataset): string[][] {
  const context = dataset.context;
  return [
    ['Organisaatio', context?.organizationName || '—'],
    ['Ajanjakso', context?.periodLabel || `${dataset.dateFrom || '—'}–${dataset.dateTo || '—'}`],
    ['Projekti', context?.projectLabel || '—'],
    ['Henkilöt', context?.peopleLabel || '—'],
    ['Tilat', context?.statusLabel || '—'],
    ['Muodostettu', new Date(dataset.generatedAt).toLocaleString('fi-FI')],
  ];
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function downloadReportCsv(dataset: ReportCenterDataset): void {
  const lines: string[][] = [
    [dataset.title],
    ...contextRows(dataset),
    [],
    ['YHTEENVETO'],
    ['Tunnusluku', 'Arvo'],
    ...Object.entries(dataset.summary).map(([key, value]) => [summaryLabel(key), metricValue(value, summaryFormat(key))]),
    [],
    ['TARKISTETTAVAT ASIAT'],
    ['Taso', 'Asia', 'Arvo', 'Selite'],
    ...(dataset.insights ?? []).map((insight) => [
      severityLabel(insight),
      insight.title,
      insight.value === undefined ? '' : metricValue(insight.value, insight.format ?? 'number'),
      insight.description,
    ]),
    [],
    ['AINEISTO'],
    dataset.columns.map((column) => column.label),
    ...dataset.rows.map((row) => dataset.columns.map((column) => formatValue(row[column.key], column))),
  ];
  const csv = lines.map((row) => row.map((cell) => csvCell(cell)).join(';')).join('\r\n');
  downloadBlob(
    new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }),
    `${safeFilePart(dataset.title)}-${datePart()}.csv`,
  );
}

function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function excelColumn(index: number): string {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function numericCell(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function reportSheetRows(dataset: ReportCenterDataset): { rows: SheetCell[][]; dataHeaderRow: number } {
  const rows: SheetCell[][] = [];

  rows.push([{ value: dataset.title, bold: true }]);
  for (const contextRow of contextRows(dataset)) {
    rows.push(contextRow.map((value): SheetCell => ({ value })));
  }

  rows.push([]);
  rows.push([{ value: 'Yhteenveto', bold: true }]);
  rows.push([{ value: 'Tunnusluku', bold: true }, { value: 'Arvo', bold: true }]);
  for (const [key, value] of Object.entries(dataset.summary)) {
    const type: SheetCell['type'] = Number.isFinite(Number(value)) ? 'number' : 'text';
    rows.push([
      { value: summaryLabel(key) },
      { value, type },
    ]);
  }

  rows.push([]);
  rows.push([{ value: 'Tarkistettavat asiat', bold: true }]);
  rows.push([
    { value: 'Taso', bold: true },
    { value: 'Asia', bold: true },
    { value: 'Arvo', bold: true },
    { value: 'Selite', bold: true },
  ]);
  for (const insight of dataset.insights ?? []) {
    const valueType: SheetCell['type'] = typeof insight.value === 'number' ? 'number' : 'text';
    rows.push([
      { value: severityLabel(insight) },
      { value: insight.title },
      { value: insight.value ?? '', type: valueType },
      { value: insight.description },
    ]);
  }

  rows.push([]);
  rows.push([{ value: 'Aineisto', bold: true }]);
  const dataHeaderRow = rows.length + 1;
  rows.push(dataset.columns.map((column): SheetCell => ({ value: column.label, bold: true })));
  for (const row of dataset.rows) {
    rows.push(dataset.columns.map((column): SheetCell => ({ value: row[column.key], type: column.type })));
  }
  return { rows, dataHeaderRow };
}

function sheetXml(dataset: ReportCenterDataset): string {
  const sheet = reportSheetRows(dataset);
  const columnCount = Math.max(1, ...sheet.rows.map((row) => row.length));
  const body = sheet.rows.map((row, rowIndex) => {
    const cells = row.map((cell, columnIndex) => {
      const reference = `${excelColumn(columnIndex)}${rowIndex + 1}`;
      if (cell.type === 'number' || cell.type === 'money') {
        const number = numericCell(cell.value);
        if (number !== null) return `<c r="${reference}" s="${cell.bold ? 2 : 1}"><v>${number}</v></c>`;
      }
      if (cell.type === 'boolean') {
        return `<c r="${reference}" t="b" s="${cell.bold ? 2 : 0}"><v>${cell.value === true || cell.value === 'true' ? 1 : 0}</v></c>`;
      }
      const rendered = typeof cell.value === 'string' ? cell.value : formatValue(cell.value);
      return `<c r="${reference}" t="inlineStr" s="${cell.bold ? 2 : 0}"><is><t xml:space="preserve">${xmlEscape(rendered)}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');

  const widths = Array.from({ length: columnCount }, (_, columnIndex) => {
    const lengths = sheet.rows.slice(0, 250).map((row) => String(row[columnIndex]?.value ?? '').length + 2);
    const width = Math.min(55, Math.max(12, ...lengths));
    return `<col min="${columnIndex + 1}" max="${columnIndex + 1}" width="${width}" customWidth="1"/>`;
  }).join('');
  const endColumn = excelColumn(columnCount - 1);
  const endRow = Math.max(sheet.dataHeaderRow, sheet.rows.length);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="${sheet.dataHeaderRow}" topLeftCell="A${sheet.dataHeaderRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths}</cols><sheetData>${body}</sheetData><autoFilter ref="A${sheet.dataHeaderRow}:${endColumn}${endRow}"/></worksheet>`;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function u16(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

function u32(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(new ArrayBuffer(parts.reduce((sum, part) => sum + part.length, 0)));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

interface ZipEntry { name: string; data: Uint8Array; crc: number; offset: number; }

function zipStore(files: Array<{ name: string; content: string }>): Uint8Array {
  const encoder = new TextEncoder();
  const entries: ZipEntry[] = [];
  const localParts: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const header = concatBytes([
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name,
    ]);
    localParts.push(header, data);
    entries.push({ name: file.name, data, crc, offset });
    offset += header.length + data.length;
  }
  const locals = concatBytes(localParts);
  const central = concatBytes(entries.map((entry) => {
    const name = encoder.encode(entry.name);
    return concatBytes([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(entry.crc), u32(entry.data.length), u32(entry.data.length), u16(name.length),
      u16(0), u16(0), u16(0), u16(0), u32(0), u32(entry.offset), name,
    ]);
  }));
  const end = concatBytes([
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(central.length), u32(locals.length), u16(0),
  ]);
  return concatBytes([locals, central, end]);
}

export function downloadReportXlsx(dataset: ReportCenterDataset): void {
  const files = [
    {
      name: '[Content_Types].xml',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    },
    {
      name: '_rels/.rels',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    },
    {
      name: 'xl/workbook.xml',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Raportti" sheetId="1" r:id="rId1"/></sheets></workbook>',
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    },
    {
      name: 'xl/styles.xml',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>',
    },
    { name: 'xl/worksheets/sheet1.xml', content: sheetXml(dataset) },
  ];
  const archive = zipStore(files);
  downloadBlob(
    blobFromBytes(archive, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    `${safeFilePart(dataset.title)}-${datePart()}.xlsx`,
  );
}

function pdfCharCode(char: string): number {
  const code = char.charCodeAt(0);
  if (code <= 255) return code;
  const winAnsi: Record<string, number> = { '€': 128, '–': 150, '—': 151, '“': 147, '”': 148, '’': 146, '…': 133 };
  return winAnsi[char] ?? 63;
}

function latin1Bytes(value: string): Uint8Array {
  const result = new Uint8Array(new ArrayBuffer(value.length));
  for (let index = 0; index < value.length; index += 1) result[index] = pdfCharCode(value[index]);
  return result;
}

function pdfEscape(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function wrapText(value: string, maxLength = 105): string[] {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (!clean) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of clean.split(' ')) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxLength) current = candidate;
    else {
      if (current) lines.push(current);
      current = word.length > maxLength ? `${word.slice(0, maxLength - 1)}…` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function reportPdfLines(dataset: ReportCenterDataset): string[] {
  const lines = [dataset.title, ...contextRows(dataset).map(([label, value]) => `${label}: ${value}`), '', 'YHTEENVETO'];
  for (const [key, value] of Object.entries(dataset.summary)) lines.push(`${summaryLabel(key)}: ${metricValue(value, summaryFormat(key))}`);
  lines.push('', 'TARKISTETTAVAT ASIAT');
  if (!dataset.insights?.length) lines.push('Ei automaattisia huomioita.');
  for (const insight of dataset.insights ?? []) {
    const value = insight.value === undefined ? '' : ` (${metricValue(insight.value, insight.format ?? 'number')})`;
    lines.push(...wrapText(`${severityLabel(insight)}: ${insight.title}${value} — ${insight.description}`));
  }
  lines.push('', 'AINEISTO');
  const maximumRows = 500;
  for (const row of dataset.rows.slice(0, maximumRows)) {
    const content = dataset.columns.map((column) => `${column.label}: ${formatValue(row[column.key], column) || '—'}`).join(' | ');
    lines.push(...wrapText(content), '');
  }
  if (dataset.rows.length > maximumRows) lines.push(`PDF-esitys rajattiin ensimmäiseen ${maximumRows} riviin. CSV- ja Excel-viennit sisältävät kaikki ${dataset.rows.length} riviä.`);
  return lines;
}

function makePdf(lines: string[]): Uint8Array {
  const maxLines = 49;
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += maxLines) pages.push(lines.slice(index, index + maxLines));
  if (!pages.length) pages.push(['Raportti on tyhjä.']);

  const objects: string[] = [];
  const pageNumbers: number[] = [];
  const contentNumbers: number[] = [];
  let nextObject = 4;
  pages.forEach(() => {
    pageNumbers.push(nextObject++);
    contentNumbers.push(nextObject++);
  });
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageNumbers.map((number) => `${number} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';

  pages.forEach((pageLines, pageIndex) => {
    const numberedLines = [...pageLines, '', `Sivu ${pageIndex + 1}/${pages.length}`];
    const body = ['BT', '/F1 9 Tf', '40 800 Td', ...numberedLines.flatMap((line, lineIndex) => [lineIndex ? '0 -15 Td' : '', `(${pdfEscape(line)}) Tj`]).filter(Boolean), 'ET'].join('\n');
    const bodyLength = latin1Bytes(body).length;
    objects[contentNumbers[pageIndex]] = `<< /Length ${bodyLength} >>\nstream\n${body}\nendstream`;
    objects[pageNumbers[pageIndex]] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentNumbers[pageIndex]} 0 R >>`;
  });

  const parts: Uint8Array[] = [latin1Bytes('%PDF-1.4\n%âãÏÓ\n')];
  const offsets: number[] = [0];
  let offset = parts[0].length;
  for (let number = 1; number < objects.length; number += 1) {
    const objectBytes = latin1Bytes(`${number} 0 obj\n${objects[number]}\nendobj\n`);
    offsets[number] = offset;
    parts.push(objectBytes);
    offset += objectBytes.length;
  }
  const xrefOffset = offset;
  const xref = [`xref\n0 ${objects.length}\n`, '0000000000 65535 f \n', ...offsets.slice(1).map((entry) => `${String(entry).padStart(10, '0')} 00000 n \n`), `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`].join('');
  parts.push(latin1Bytes(xref));
  return concatBytes(parts);
}

export function downloadReportPdf(dataset: ReportCenterDataset): void {
  const pdf = makePdf(reportPdfLines(dataset));
  downloadBlob(blobFromBytes(pdf, 'application/pdf'), `${safeFilePart(dataset.title)}-${datePart()}.pdf`);
}

function htmlEscape(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export function printReport(dataset: ReportCenterDataset): void {
  const popup = window.open('', '_blank', 'noopener,noreferrer');
  if (!popup) throw new Error('Tulostusikkunaa ei voitu avata. Salli ponnahdusikkunat ja yritä uudelleen.');
  const header = dataset.columns.map((column) => `<th>${htmlEscape(column.label)}</th>`).join('');
  const body = dataset.rows.map((row) => `<tr>${dataset.columns.map((column) => `<td>${htmlEscape(formatValue(row[column.key], column))}</td>`).join('')}</tr>`).join('');
  const context = contextRows(dataset).map(([label, value]) => `<div><strong>${htmlEscape(label)}:</strong> ${htmlEscape(value)}</div>`).join('');
  const summary = Object.entries(dataset.summary).map(([key, value]) => `<div class="metric"><span>${htmlEscape(summaryLabel(key))}</span><strong>${htmlEscape(metricValue(value, summaryFormat(key)))}</strong></div>`).join('');
  const insights = (dataset.insights ?? []).map((insight) => `<div class="insight ${insight.severity}"><strong>${htmlEscape(severityLabel(insight))}: ${htmlEscape(insight.title)}</strong>${insight.value === undefined ? '' : `<b>${htmlEscape(metricValue(insight.value, insight.format ?? 'number'))}</b>`}<p>${htmlEscape(insight.description)}</p></div>`).join('');
  popup.document.write(`<!doctype html><html lang="fi"><head><meta charset="utf-8"><title>${htmlEscape(dataset.title)}</title><style>body{font-family:Arial,sans-serif;color:#0f172a;margin:28px}h1{font-size:24px;margin:0 0 8px}h2{font-size:16px;margin:22px 0 10px}.meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 20px;color:#475569;font-size:11px;margin-bottom:18px}.summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.metric{border:1px solid #cbd5e1;border-radius:6px;padding:8px}.metric span{display:block;color:#64748b;font-size:9px;text-transform:uppercase}.metric strong{display:block;font-size:16px;margin-top:4px}.insights{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.insight{border:1px solid #cbd5e1;border-radius:6px;padding:9px;font-size:10px}.insight b{float:right}.insight p{color:#475569;margin:5px 0 0}.insight.critical{border-color:#fca5a5;background:#fef2f2}.insight.warning{border-color:#fcd34d;background:#fffbeb}.insight.success{border-color:#86efac;background:#f0fdf4}table{width:100%;border-collapse:collapse;font-size:9px;margin-top:10px}th,td{border:1px solid #cbd5e1;padding:5px;vertical-align:top;text-align:left}th{background:#f1f5f9}tr:nth-child(even){background:#f8fafc}@page{size:landscape;margin:10mm}@media print{body{margin:0}.summary{grid-template-columns:repeat(4,minmax(0,1fr))}}</style></head><body><h1>${htmlEscape(dataset.title)}</h1><div class="meta">${context}</div><h2>Yhteenveto</h2><div class="summary">${summary}</div>${insights ? `<h2>Tarkistettavat asiat</h2><div class="insights">${insights}</div>` : ''}<h2>Aineisto (${dataset.rows.length} riviä)</h2><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
  popup.document.close();
}
