import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import QRCode from 'npm:qrcode@1.5.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json; charset=utf-8' },
  });
}

function getPublishableKey(): string {
  const legacy = Deno.env.get('SUPABASE_ANON_KEY');
  if (legacy) return legacy;
  const raw = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  if (!raw) throw new Error('Supabasen julkaistavaa avainta ei ole saatavilla.');
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  for (const value of Object.values(parsed)) {
    if (typeof value === 'string' && value.length > 20) return value;
    if (value && typeof value === 'object' && 'key' in value) {
      const key = (value as { key?: unknown }).key;
      if (typeof key === 'string' && key.length > 20) return key;
    }
  }
  throw new Error('Supabasen julkaistavan avaimen muotoa ei tunnistettu.');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);

  const authorization = request.headers.get('authorization');
  if (!authorization) return response({ error: 'Kirjautuminen vaaditaan.' }, 401);

  try {
    const body = await request.json() as {
      projectId?: string;
      appOrigin?: string;
      label?: string;
      expiresAt?: string | null;
      requireGeofence?: boolean;
    };
    if (!body.projectId) return response({ error: 'Työmaa puuttuu.' }, 400);

    const originUrl = new URL(body.appOrigin ?? '');
    if (!['http:', 'https:'].includes(originUrl.protocol)) {
      return response({ error: 'Sovelluksen osoite ei ole kelvollinen.' }, 400);
    }
    const appOrigin = originUrl.origin;

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!supabaseUrl) throw new Error('SUPABASE_URL puuttuu.');
    const client = createClient(supabaseUrl, getPublishableKey(), {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await client.rpc('rotate_work_site_qr_token', {
      p_project_id: body.projectId,
      p_label: body.label?.trim() || null,
      p_expires_at: body.expiresAt || null,
      p_require_geofence: body.requireGeofence ?? true,
    });
    if (error) return response({ error: error.message }, 400);

    const record = Array.isArray(data) ? data[0] : data;
    if (!record || typeof record.token !== 'string') {
      throw new Error('QR-tunnisteen luonti ei palauttanut kelvollista tunnistetta.');
    }

    const checkInUrl = `${appOrigin}/#/qr-kirjautuminen?token=${encodeURIComponent(record.token)}`;
    const svg = await QRCode.toString(checkInUrl, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 512,
      color: { dark: '#0f172a', light: '#ffffff' },
    });

    return response({
      projectName: record.project_name,
      expiresAt: record.expires_at,
      requireGeofence: record.require_geofence,
      checkInUrl,
      svg,
    });
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : 'QR-koodin luonti epäonnistui.' }, 500);
  }
});