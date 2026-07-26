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

const DEFAULT_APP_ORIGIN = 'https://vakantti.pages.dev';

type OrganizationRole = 'admin' | 'supervisor' | 'worker' | 'customer';

interface InviteRequest {
  organizationId?: unknown;
  email?: unknown;
  fullName?: unknown;
  role?: unknown;
  customerId?: unknown;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function readNamedKey(variableName: string, legacyName: string): string | null {
  const named = Deno.env.get(variableName);
  if (named) {
    try {
      const parsed = JSON.parse(named) as Record<string, unknown>;
      for (const value of Object.values(parsed)) {
        if (typeof value === 'string' && value.length > 20) return value;
        if (value && typeof value === 'object' && 'key' in value) {
          const key = (value as { key?: unknown }).key;
          if (typeof key === 'string' && key.length > 20) return key;
        }
      }
    } catch {
      // Fall back to the legacy single-value environment variable below.
    }
  }
  return Deno.env.get(legacyName) ?? null;
}

function isRole(value: unknown): value is OrganizationRole {
  return value === 'admin' || value === 'supervisor' || value === 'worker' || value === 'customer';
}

function activationUrl(): string {
  const configured = Deno.env.get('VAKANTTI_APP_URL')?.trim() || DEFAULT_APP_ORIGIN;
  const origin = new URL(configured);
  if (origin.protocol !== 'https:') {
    throw new Error('VaKantin kutsuosoitteen pitää käyttää HTTPS-yhteyttä.');
  }
  return new URL('/auth/callback', origin.origin).toString();
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
  const customerId = typeof payload.customerId === 'string' ? payload.customerId.trim() : '';

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
  if (role === 'customer' && (!customerId || !/^[0-9a-f-]{36}$/i.test(customerId))) {
    return json({ error: 'Valitse tilaajakäyttäjälle asiakas.' }, 400);
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
    let redirectTo: string;
    try {
      redirectTo = activationUrl();
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Kutsun palautusosoite on virheellinen.' }, 503);
    }

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin
      .inviteUserByEmail(email, {
        data: fullName ? { full_name: fullName } : undefined,
        redirectTo,
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

  if (role === 'customer') {
    const { data: customer, error: customerError } = await adminClient
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (customerError || !customer) {
      await adminClient.from('organization_members').delete()
        .eq('organization_id', organizationId).eq('user_id', targetUserId);
      return json({ error: 'Valittu asiakas ei kuulu organisaatioon.' }, 400);
    }
    const { error: linkError } = await adminClient.from('customer_users').insert({
      organization_id: organizationId, customer_id: customerId, user_id: targetUserId,
    });
    if (linkError) {
      await adminClient.from('organization_members').delete()
        .eq('organization_id', organizationId).eq('user_id', targetUserId);
      return json({ error: `Tilaajakytkennän luominen epäonnistui: ${linkError.message}` }, 400);
    }
  }

  await adminClient.from('audit_logs').insert({
    organization_id: organizationId,
    user_id: actor.id,
    action: invited ? 'organization_member_invited' : 'organization_member_added_existing_user',
    table_name: 'organization_members',
    record_id: targetUserId,
    metadata: {
      target_user_id: targetUserId,
      email,
      role,
      customer_id: customerId || null,
      activation_origin: DEFAULT_APP_ORIGIN,
    },
  });

  return json({
    ok: true,
    invited,
    userId: targetUserId,
    message: invited
      ? 'Kutsu lähetettiin VaKantin tuotanto-osoitteeseen.'
      : 'Olemassa oleva käyttäjä lisättiin organisaatioon.',
  });
});
