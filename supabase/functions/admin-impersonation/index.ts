import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.110.8';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json; charset=utf-8' };

type OrganizationRole = 'admin' | 'supervisor' | 'project_coordinator' | 'worker' | 'customer';
type Action = 'start' | 'stop';

interface Payload {
  action?: unknown;
  organizationId?: unknown;
  targetUserId?: unknown;
  sessionId?: unknown;
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function namedSecret(name: string, fallback: string): string | null {
  const raw = Deno.env.get(name);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const value of Object.values(parsed)) {
        if (typeof value === 'string' && value.length > 20) return value;
        if (value && typeof value === 'object' && 'key' in value) {
          const key = (value as { key?: unknown }).key;
          if (typeof key === 'string' && key.length > 20) return key;
        }
      }
    } catch {
      // Use the standard Supabase function secret below.
    }
  }
  return Deno.env.get(fallback) ?? null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isRole(value: unknown): value is OrganizationRole {
  return value === 'admin'
    || value === 'supervisor'
    || value === 'project_coordinator'
    || value === 'worker'
    || value === 'customer';
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return response({ error: 'Vain POST-pyyntö on sallittu.' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return response({ error: 'Kirjautuminen vaaditaan.' }, 401);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const publishableKey = namedSecret('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
  const serviceKey = namedSecret('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !publishableKey || !serviceKey) {
    return response({ error: 'Palvelimen Supabase-konfiguraatio puuttuu.' }, 503);
  }

  let payload: Payload;
  try {
    payload = await request.json() as Payload;
  } catch {
    return response({ error: 'Pyynnön JSON ei ole kelvollinen.' }, 400);
  }

  const action: Action = payload.action === 'stop' ? 'stop' : 'start';
  const organizationId = stringValue(payload.organizationId);
  const targetUserId = stringValue(payload.targetUserId);
  const suppliedSessionId = stringValue(payload.sessionId);

  if (!isUuid(organizationId)) {
    return response({ error: 'Organisaation tunniste puuttuu tai on virheellinen.' }, 400);
  }
  if (!isUuid(targetUserId)) {
    return response({ error: 'Valitun käyttäjän tunniste puuttuu tai on virheellinen.' }, 400);
  }
  if (action === 'stop' && !isUuid(suppliedSessionId)) {
    return response({ error: 'Käyttäjänä toimimisen istuntotunniste on virheellinen.' }, 400);
  }

  const userClient = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: authorization } },
  });
  const token = authorization.slice('Bearer '.length);
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) {
    return response({ error: 'Istunto ei ole voimassa.' }, 401);
  }
  const actor = userData.user;

  const { data: actorMembership, error: actorMembershipError } = await userClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', actor.id)
    .maybeSingle();
  if (actorMembershipError) {
    return response({ error: 'Ylläpitäjän käyttöoikeuden tarkistus epäonnistui.' }, 500);
  }
  if (actorMembership?.role !== 'admin') {
    return response({ error: 'Vain organisaation ylläpitäjä voi toimia toisena käyttäjänä.' }, 403);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: targetMembership, error: targetMembershipError } = await admin
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (targetMembershipError) {
    return response({ error: 'Valitun käyttäjän jäsenyyden tarkistus epäonnistui.' }, 500);
  }
  if (!targetMembership || !isRole(targetMembership.role)) {
    return response({ error: 'Valittu käyttäjä ei kuulu tähän organisaatioon.' }, 404);
  }

  if (action === 'stop') {
    await admin.from('audit_logs').insert({
      organization_id: organizationId,
      user_id: actor.id,
      action: 'administrator_impersonation_ended',
      table_name: 'organization_members',
      record_id: targetUserId,
      metadata: {
        session_id: suppliedSessionId,
        target_user_id: targetUserId,
        target_role: targetMembership.role,
        ended_at: new Date().toISOString(),
      },
    });
    return response({ ok: true });
  }

  if (actor.id === targetUserId) {
    return response({ error: 'Omaa käyttäjätiliä ei tarvitse avata käyttäjänä toimimisen kautta.' }, 400);
  }

  const { data: targetAuthData, error: targetAuthError } = await admin.auth.admin.getUserById(targetUserId);
  if (targetAuthError || !targetAuthData.user) {
    return response({ error: 'Valittua Auth-käyttäjää ei löytynyt.' }, 404);
  }
  const targetAuthUser = targetAuthData.user;
  const email = targetAuthUser.email?.trim().toLowerCase() ?? '';
  if (!email) {
    return response({ error: 'Valitulla käyttäjällä ei ole sähköpostiin perustuvaa kirjautumistunnusta.' }, 400);
  }
  if (!targetAuthUser.email_confirmed_at) {
    return response({ error: 'Käyttäjä ei ole vielä aktivoinut kirjautumistunnustaan.' }, 409);
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', targetUserId)
    .maybeSingle();

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  const tokenHash = linkData?.properties?.hashed_token?.trim() ?? '';
  if (linkError || !tokenHash) {
    return response({
      error: linkError?.message || 'Valitulle käyttäjälle ei voitu luoda lyhytkestoista istuntoa.',
    }, linkError?.status === 429 ? 429 : 500);
  }

  const sessionId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const displayName = typeof profile?.full_name === 'string' && profile.full_name.trim()
    ? profile.full_name.trim()
    : email;

  const { error: auditError } = await admin.from('audit_logs').insert({
    organization_id: organizationId,
    user_id: actor.id,
    action: 'administrator_impersonation_started',
    table_name: 'organization_members',
    record_id: targetUserId,
    metadata: {
      session_id: sessionId,
      target_user_id: targetUserId,
      target_role: targetMembership.role,
      started_at: startedAt,
      user_agent: request.headers.get('user-agent'),
    },
  });
  if (auditError) {
    return response({ error: 'Käyttäjänä toimimisen audit-lokia ei voitu tallentaa.' }, 500);
  }

  return response({
    ok: true,
    tokenHash,
    sessionId,
    startedAt,
    target: {
      userId: targetUserId,
      organizationId,
      displayName,
      email: typeof profile?.email === 'string' && profile.email.trim() ? profile.email.trim() : email,
      role: targetMembership.role,
    },
  });
});
