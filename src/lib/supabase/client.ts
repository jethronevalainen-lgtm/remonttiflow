/**
 * Supabase client singleton.
 *
 * Reads the connection settings from Vite env vars (typed via vite/client):
 *   - VITE_SUPABASE_URL
 *   - VITE_SUPABASE_ANON_KEY
 *
 * Fails fast at module load with a clear Finnish error when the variables
 * are missing, so a broken dev setup surfaces immediately instead of as
 * cryptic network errors later.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase-ympäristömuuttujat puuttuvat. Lisää VITE_SUPABASE_URL ja ' +
      'VITE_SUPABASE_ANON_KEY projektin .env-tiedostoon ja käynnistä ' +
      'kehityspalvelin uudelleen.',
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
