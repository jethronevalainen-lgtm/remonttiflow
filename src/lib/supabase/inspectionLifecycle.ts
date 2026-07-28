import { supabase } from './client';

function failure(prefix: string, message: string): Error {
  return new Error(`${prefix}: ${message}`);
}

export async function removeInspection(inspectionId: string, reason: string): Promise<void> {
  const normalizedReason = reason.trim();
  if (normalizedReason.length < 3) {
    throw new Error('Kirjaa poistamisen perustelu vähintään kolmella merkillä.');
  }

  const { error } = await supabase.rpc('remove_inspection', {
    p_inspection_id: inspectionId,
    p_reason: normalizedReason,
  });

  if (error) throw failure('Tarkastuksen poistaminen epäonnistui', error.message);
}
