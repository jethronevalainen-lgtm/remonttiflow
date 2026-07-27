import { supabase } from './client';

interface SignatureImageRow {
  id: string;
  signature_data: string | null;
}

function failure(prefix: string, message: string): Error {
  return new Error(`${prefix}: ${message}`);
}

export async function loadInspectionSignatureData(inspectionId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('inspection_signatures')
    .select('id, signature_data')
    .eq('inspection_id', inspectionId);
  if (error) throw failure('Allekirjoituskuvien haku epäonnistui', error.message);
  return Object.fromEntries(
    ((data ?? []) as SignatureImageRow[])
      .filter((row) => row.id && row.signature_data)
      .map((row) => [row.id, row.signature_data as string]),
  );
}

export async function addHandwrittenInspectionSignature(input: {
  organizationId: string;
  inspectionId: string;
  signerName: string;
  signerRole: string;
  signerCompany?: string;
  signatureData: string;
  note?: string;
  userId?: string;
}): Promise<void> {
  if (!input.signatureData.startsWith('data:image/png;base64,')) {
    throw new Error('Allekirjoituksen kuvatieto on virheellinen.');
  }
  const { error } = await supabase.from('inspection_signatures').insert({
    organization_id: input.organizationId,
    inspection_id: input.inspectionId,
    signer_name: input.signerName.trim(),
    signer_role: input.signerRole.trim(),
    signer_company: input.signerCompany?.trim() || null,
    signature_type: 'Käsin allekirjoitettu',
    signature_data: input.signatureData,
    note: input.note?.trim() || null,
    signed_by: input.userId ?? null,
  });
  if (error) throw failure('Allekirjoituksen tallennus epäonnistui', error.message);
}
