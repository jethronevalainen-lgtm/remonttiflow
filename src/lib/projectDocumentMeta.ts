export const PROJECT_DOCUMENT_TYPES = [
  'Sopimus',
  'Suunnitelma',
  'Pöytäkirja',
  'Valokuva',
  'Tarjous',
  'Laskelma',
  'Käyttöohje',
  'Excel / taulukko',
  'PDF',
  'Muu',
] as const;

export type ProjectDocumentType = (typeof PROJECT_DOCUMENT_TYPES)[number];

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp']);
const EXCEL_EXTENSIONS = new Set(['xls', 'xlsx', 'xlsm', 'csv', 'ods']);
const PDF_EXTENSIONS = new Set(['pdf']);

function extensionOf(fileName: string): string {
  const parts = fileName.split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1]?.toLocaleLowerCase('fi') ?? '';
}

/** Infers a sensible document type label from file name / MIME type. */
export function inferProjectDocumentType(fileName: string, mimeType = ''): ProjectDocumentType {
  const extension = extensionOf(fileName);
  const mime = mimeType.toLocaleLowerCase('fi');

  if (mime.startsWith('image/') || IMAGE_EXTENSIONS.has(extension)) return 'Valokuva';
  if (mime.includes('pdf') || PDF_EXTENSIONS.has(extension)) return 'PDF';
  if (
    mime.includes('spreadsheet')
    || mime.includes('excel')
    || mime === 'text/csv'
    || EXCEL_EXTENSIONS.has(extension)
  ) {
    return 'Excel / taulukko';
  }
  return 'Muu';
}

export function formatProjectFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kt`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mt`;
}

export function projectDocumentKind(fileName: string, mimeType = ''): 'image' | 'pdf' | 'spreadsheet' | 'other' {
  const type = inferProjectDocumentType(fileName, mimeType);
  if (type === 'Valokuva') return 'image';
  if (type === 'PDF') return 'pdf';
  if (type === 'Excel / taulukko') return 'spreadsheet';
  return 'other';
}
