import { createClient } from 'npm:@supabase/supabase-js@2.110.8';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json; charset=utf-8',
};

type OrganizationRole = 'admin' | 'supervisor' | 'worker';

interface InviteRequest {
  organizationId?: unknown;
  email?: unknown;
  fullName?: unknown;
  role?: unknown;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function readNamedKey(variableName: string, legacyName: string): string | null {
  const named = Deno.env.get(variableName);
  if (named) {
    try {
      const parsed = JSON.parse(named) as Record<string, string>;
      if (parsed.default) return parsed.default;
      const first = Object.values(parsed).find(Boolean);
      if (first) return first;
    } catch {
      // Fall back to the legacy single-value environment variable below.
    }
  }
  return Deno.env.get(legacyName) ?? null;
}

function isRole(value: unknown): value is OrganizationRole {
  return value === 'admin' || value === 'supervisor' || value === 'worker';
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Vain POST-pyyntö on sallittu.' }, 405);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return json({ error: 'Kirjautuminen vaaditaan.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = readNamedKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
  const secretKey = readNamedKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !publishableKey || !secretKey) {
    return json({ error: 'Palvelimen Supabase-konfiguraatio puuttuu.' }, 503);
  }

  let payload: InviteRequest;
  try {
    payload = await request.json() as InviteRequest;
  } catch {
    return json({ error: 'Pyynnön JSON ei ole kelvollinen.' }, 400);
  }

  const organizationId = typeof payload.organizationId === 'string'
    ? payload.organizationId.trim()
    : '';
  const email = typeof payload.email === 'string'
    ? payload.email.trim().toLowerCase()
    : '';
  const fullName = typeof payload.fullName === 'string'
    ? payload.fullName.trim()
    : '';
  const role = payload.role;

  if (!organizationId || !/^[0-9a-f-]{36}$/i.test(organizationId)) {
    return json({ error: 'Organisaation tunniste puuttuu tai on virheellinen.' }, 400);
  }
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Anna kelvollinen sähköpostiosoite.' }, 400);
  }
  if (fullName.length > 120) {
    return json({ error: 'Nimi on liian pitkä.' }, 400);
  }
  if (!isRole(role)) {
    return json({ error: 'Rooli on virheellinen.' }, 400);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: authorization } },
  });

  const token = authorization.slice('Bearer '.length);
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  const actor = userData.user;
  if (userError || !actor) {
    return json({ error: 'Istunto ei ole voimassa.' }, 401);
  }

  const { data: actorMembership, error: membershipError } = await userClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', actor.id)
    .maybeSingle();

  if (membershipError) {
    return json({ error: 'Käyttöoikeuden tarkistus epäonnistui.' }, 500);
  }
  if (actorMembership?.role !== 'admin') {
    return json({ error: 'Vain organisaation ylläpitäjä voi kutsua käyttäjiä.' }, 403);
  }

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: existingProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, full_name')
    .ilike('email', email)
    .maybeSingle();

  if (profileError) {
    return json({ error: 'Käyttäjän tarkistus epäonnistui.' }, 500);
  }

  let targetUserId = existingProfile?.id ?? null;
  let invited = false;

  if (!targetUserId) {
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin
      .inviteUserByEmail(email, {
        data: fullName ? { full_name: fullName } : undefined,
      });

    if (inviteError || !inviteData.user) {
      const status = inviteError?.status === 429 ? 429 : 400;
      return json({
        error: inviteError?.message || 'Sähköpostikutsun lähettäminen epäonnistui.',
      }, status);
    }

    targetUserId = inviteData.user.id;
    invited = true;
  } else if (fullName && !existingProfile?.full_name) {
    await adminClient
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', targetUserId);
  }

  const { data: existingMembership, error: existingMembershipError } = await adminClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (existingMembershipError) {
    return json({ error: 'Jäsenyyden tarkistus epäonnistui.' }, 500);
  }
  if (existingMembership) {
    return json({ error: 'Käyttäjä kuuluu jo tähän organisaatioon.' }, 409);
  }

  const { error: insertError } = await adminClient
    .from('organization_members')
    .insert({ organization_id: organizationId, user_id: targetUserId, role });

  if (insertError) {
    return json({ error: `Jäsenyyden luominen epäonnistui: ${insertError.message}` }, 400);
  }

  await adminClient.from('audit_logs').insert({
    organization_id: organizationId,
    user_id: actor.id,
    action: invited ? 'organization_member_invited' : 'organization_member_added_existing_user',
    table_name: 'organization_members',
    record_id: targetUserId,
    metadata: { target_user_id: targetUserId, email, role },
  });

  return json({
    ok: true,
    invited,
    userId: targetUserId,
    message: invited
      ? 'Kutsu lähetettiin ja jäsenyys luotiin.'
      : 'Olemassa oleva käyttäjä lisättiin organisaatioon.',
  });
});
