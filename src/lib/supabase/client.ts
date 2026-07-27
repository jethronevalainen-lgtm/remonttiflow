import {
  createClient,
  type Session,
  type SupabaseClient,
} from '@supabase/supabase-js';

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

const browserAuthOptions = {
  detectSessionInUrl: false,
} as const;

/**
 * The administrator client owns the normal, persisted browser session.
 * Impersonation never replaces this session, so returning to the administrator
 * does not require copying refresh tokens into another browser storage key.
 */
export const administratorSupabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      ...browserAuthOptions,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);

/**
 * A separate memory-only client is used while an administrator acts as another
 * user. Its JWT is the selected user's real Supabase session, so every query,
 * mutation, Storage request and RPC is evaluated by RLS as that user.
 * Reloading the page automatically ends impersonation and restores the normal
 * administrator client.
 */
const impersonationSupabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      ...browserAuthOptions,
      persistSession: false,
      autoRefreshToken: true,
      storageKey: 'vakantti-memory-impersonation',
    },
  },
);

type ActiveClientListener = (client: SupabaseClient) => void;

let activeSupabase: SupabaseClient = administratorSupabase;
let impersonationActive = false;
const activeClientListeners = new Set<ActiveClientListener>();

function publishActiveClient(client: SupabaseClient, impersonating: boolean): void {
  activeSupabase = client;
  impersonationActive = impersonating;
  activeClientListeners.forEach((listener) => listener(client));
}

/**
 * Existing repository modules import one shared `supabase` value. The proxy
 * keeps that API stable while routing every operation to the currently active
 * authenticated client.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const value = Reflect.get(activeSupabase as object, property, activeSupabase);
    return typeof value === 'function' ? value.bind(activeSupabase) : value;
  },
});

export function getActiveSupabaseClient(): SupabaseClient {
  return activeSupabase;
}

export function isImpersonationClientActive(): boolean {
  return impersonationActive;
}

export function subscribeActiveSupabaseClient(listener: ActiveClientListener): () => void {
  activeClientListeners.add(listener);
  return () => activeClientListeners.delete(listener);
}

export async function activateImpersonationSession(tokenHash: string): Promise<Session> {
  const normalizedTokenHash = tokenHash.trim();
  if (!normalizedTokenHash) throw new Error('Käyttäjänä toimimisen kertakäyttöinen tunniste puuttuu.');

  const { data, error } = await impersonationSupabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: normalizedTokenHash,
  });
  if (error || !data.session) {
    throw new Error(error?.message || 'Käyttäjän istuntoa ei voitu avata.');
  }

  publishActiveClient(impersonationSupabase, true);
  return data.session;
}

export async function deactivateImpersonationSession(): Promise<void> {
  if (!impersonationActive) return;

  publishActiveClient(administratorSupabase, false);
  const { error } = await impersonationSupabase.auth.signOut({ scope: 'local' });
  if (error) {
    // The administrator session is already active. The short-lived target JWT
    // expires independently even if local revocation happens to fail.
    console.warn('Käyttäjänä toimimisen istunnon paikallinen sulkeminen epäonnistui.', error);
  }
}
