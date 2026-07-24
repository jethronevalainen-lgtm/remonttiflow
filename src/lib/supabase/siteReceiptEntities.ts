import { supabase } from './client';
import type {
  SiteReceipt,
  SiteReceiptAttachment,
  SiteReceiptAttachmentKind,
  SiteReceiptStatus,
  SiteReceiptType,
} from '@/types';

const RECEIPT_BUCKET = 'site-receipts';
export const MAX_RECEIPT_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_RECEIPT_FILES = 5;
export const RECEIPT_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
] as const;

type Row = Record<string, unknown>;

export interface PendingReceiptFile {
  file: File;
  kind: Exclude<SiteReceiptAttachmentKind, 'signature'>;
}

export interface CreateSiteReceiptInput {
  projectId?: string;
  workOrderId?: string;
  project: string;
  title: string;
  type: SiteReceiptType;
  referenceNumber?: string;
  occurredAt: string;
  signerName: string;
  signerRole?: string;
  signerCompany?: string;
  notes?: string;
  signature: Blob;
  files: PendingReceiptFile[];
}

function toRow(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Tietokanta palautti virheellisen kuittaustietueen.');
  }
  return value as Row;
}

function text(row: Row, key: string): string {
  return typeof row[key] === 'string' ? (row[key] as string) : '';
}

function optionalText(row: Row, key: string): string | undefined {
  const value = text(row, key);
  return value || undefined;
}

function numeric(row: Row, key: string): number {
  const value = row[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function enumValue<T extends string>(
  row: Row,
  key: string,
  options: readonly T[],
  fallback: T,
): T {
  const value = row[key];
  return typeof value === 'string' && options.includes(value as T)
    ? (value as T)
    : fallback;
}

function mapAttachment(value: unknown): SiteReceiptAttachment {
  const row = toRow(value);
  return {
    id: text(row, 'id'),
    receiptId: text(row, 'receipt_id'),
    kind: enumValue<SiteReceiptAttachmentKind>(
      row,
      'kind',
      ['photo', 'document', 'signature'],
      'document',
    ),
    fileName: text(row, 'file_name'),
    storagePath: text(row, 'storage_path'),
    mimeType: text(row, 'mime_type'),
    sizeBytes: numeric(row, 'size_bytes'),
    createdAt: text(row, 'created_at'),
  };
}

function mapReceipt(value: unknown): SiteReceipt {
  const row = toRow(value);
  const attachments = Array.isArray(row.site_receipt_attachments)
    ? row.site_receipt_attachments.map(mapAttachment)
    : [];

  return {
    id: text(row, 'id'),
    organizationId: text(row, 'organization_id'),
    projectId: optionalText(row, 'project_id'),
    workOrderId: optionalText(row, 'work_order_id'),
    project: text(row, 'project'),
    title: text(row, 'title'),
    type: enumValue<SiteReceiptType>(
      row,
      'receipt_type',
      [
        'work_acceptance',
        'delivery_receipt',
        'measurement_record',
        'waybill',
        'material_receipt',
        'other',
      ],
      'other',
    ),
    referenceNumber: optionalText(row, 'reference_number'),
    occurredAt: text(row, 'occurred_at'),
    signerName: text(row, 'signer_name'),
    signerRole: optionalText(row, 'signer_role'),
    signerCompany: optionalText(row, 'signer_company'),
    notes: optionalText(row, 'notes'),
    status: enumValue<SiteReceiptStatus>(row, 'status', ['draft', 'signed', 'voided'], 'draft'),
    signedAt: optionalText(row, 'signed_at'),
    voidedAt: optionalText(row, 'voided_at'),
    voidReason: optionalText(row, 'void_reason'),
    createdBy: text(row, 'created_by'),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
    attachments: attachments.sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
  };
}

export async function loadSiteReceipts(organizationId: string): Promise<SiteReceipt[]> {
  const { data, error } = await supabase
    .from('site_receipts')
    .select('*, site_receipt_attachments(*)')
    .eq('organization_id', organizationId)
    .order('occurred_at', { ascending: false });

  if (error) throw new Error(`Kuittausten haku epäonnistui: ${error.message}`);
  return (Array.isArray(data) ? data : []).map(mapReceipt);
}

function extensionFor(fileName: string, mimeType: string): string {
  const candidate = fileName.split('.').pop()?.toLowerCase();
  if (candidate && /^[a-z0-9]{1,8}$/.test(candidate)) return candidate;

  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'application/pdf': 'pdf',
  };
  return extensions[mimeType] ?? 'bin';
}

function assertFile(file: Blob, fileName: string) {
  if (file.size > MAX_RECEIPT_FILE_BYTES) {
    throw new Error(`Tiedosto ${fileName} ylittää 10 Mt kokorajan.`);
  }
  if (!RECEIPT_FILE_TYPES.includes(file.type as (typeof RECEIPT_FILE_TYPES)[number])) {
    throw new Error(`Tiedoston ${fileName} muotoa ei tueta.`);
  }
}

export async function createSignedSiteReceiptRecord(
  organizationId: string,
  createdBy: string,
  input: CreateSiteReceiptInput,
): Promise<string> {
  if (input.files.length > MAX_RECEIPT_FILES) {
    throw new Error(`Kuittaukseen voi lisätä enintään ${MAX_RECEIPT_FILES} liitettä.`);
  }

  assertFile(input.signature, 'allekirjoitus.png');
  input.files.forEach(({ file }) => assertFile(file, file.name));

  const receiptId = crypto.randomUUID();
  const uploadedPaths: string[] = [];

  const { error: insertError } = await supabase.from('site_receipts').insert({
    id: receiptId,
    organization_id: organizationId,
    project_id: input.projectId ?? null,
    work_order_id: input.workOrderId ?? null,
    project: input.project,
    title: input.title,
    receipt_type: input.type,
    reference_number: input.referenceNumber ?? null,
    occurred_at: input.occurredAt,
    signer_name: input.signerName,
    signer_role: input.signerRole ?? null,
    signer_company: input.signerCompany ?? null,
    notes: input.notes ?? null,
    status: 'draft',
    created_by: createdBy,
  });

  if (insertError) {
    throw new Error(`Kuittauksen tallennus epäonnistui: ${insertError.message}`);
  }

  const uploads: Array<{
    body: Blob;
    fileName: string;
    kind: SiteReceiptAttachmentKind;
  }> = [
    { body: input.signature, fileName: 'allekirjoitus.png', kind: 'signature' },
    ...input.files.map(({ file, kind }) => ({ body: file, fileName: file.name, kind })),
  ];

  try {
    const attachmentRows: Array<Record<string, unknown>> = [];

    for (const upload of uploads) {
      const extension = extensionFor(upload.fileName, upload.body.type);
      const storagePath = `${organizationId}/${receiptId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(RECEIPT_BUCKET)
        .upload(storagePath, upload.body, {
          cacheControl: '3600',
          contentType: upload.body.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Liitteen ${upload.fileName} tallennus epäonnistui: ${uploadError.message}`);
      }

      uploadedPaths.push(storagePath);
      attachmentRows.push({
        organization_id: organizationId,
        receipt_id: receiptId,
        kind: upload.kind,
        file_name: upload.fileName,
        storage_path: storagePath,
        mime_type: upload.body.type,
        size_bytes: upload.body.size,
        created_by: createdBy,
      });
    }

    const { error: attachmentError } = await supabase
      .from('site_receipt_attachments')
      .insert(attachmentRows);
    if (attachmentError) {
      throw new Error(`Liitetietojen tallennus epäonnistui: ${attachmentError.message}`);
    }

    const { error: finalizeError } = await supabase
      .from('site_receipts')
      .update({ status: 'signed', signed_at: new Date().toISOString() })
      .eq('id', receiptId)
      .eq('organization_id', organizationId)
      .eq('status', 'draft');
    if (finalizeError) {
      throw new Error(`Kuittauksen allekirjoituksen lukitus epäonnistui: ${finalizeError.message}`);
    }

    return receiptId;
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(RECEIPT_BUCKET).remove(uploadedPaths);
    }
    await supabase
      .from('site_receipts')
      .delete()
      .eq('id', receiptId)
      .eq('organization_id', organizationId)
      .eq('status', 'draft');
    throw error;
  }
}

export async function voidSiteReceiptRecord(
  organizationId: string,
  receiptId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase
    .from('site_receipts')
    .update({
      status: 'voided',
      voided_at: new Date().toISOString(),
      void_reason: reason,
    })
    .eq('id', receiptId)
    .eq('organization_id', organizationId)
    .eq('status', 'signed');

  if (error) throw new Error(`Kuittauksen mitätöinti epäonnistui: ${error.message}`);
}

export async function createSiteReceiptAttachmentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .createSignedUrl(storagePath, 10 * 60);
  if (error) throw new Error(`Liitteen avaaminen epäonnistui: ${error.message}`);
  return data.signedUrl;
}
