import { createClient } from '@supabase/supabase-js';

/**
 * Public browser configuration for the hosted VaKantti backend.
 *
 * Supabase publishable keys are intentionally safe to embed in a browser
 * bundle. Row Level Security remains the actual authorization boundary.
 * Environment variables override these defaults for local, staging and
 * preview environments.
 */
const DEFAULT_SUPABASE_URL = 'https://qnqhqtzssauwucgnpvfp.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_6_STwirtdiJMbWFregmWgg_GtNCC7Fp';

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_SUPABASE_URL;
const supabasePublishableKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  DEFAULT_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl.startsWith('https://')) {
  throw new Error('Supabase-osoitteen pitää käyttää HTTPS-yhteyttä.');
}

/**
 * The database schema is queried through an explicit repository/mapping
 * layer. Keeping the raw client untyped prevents stale hand-written database
 * types from silently describing columns that do not exist in production.
 */
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
