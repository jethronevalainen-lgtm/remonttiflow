begin;

-- Työaika käynnistyy työmääräyksen tilasiirtymästä. Avoin istunto pidetään
-- erillään palkkaan menevästä time_entries-taulusta, koska keskeneräisellä
-- kirjauksella ei vielä ole loppuaikaa eikä maksettavaa kestoa.
create table if not exists public.work_order_time_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  started_at timestamptz not null default statement_timestamp(),
  ended_at timestamptz,
  end_reason text check (end_reason is null or end_reason in ('paused', 'completed', 'switched')),
  time_entry_id uuid references public.time_entries(id) on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint work_order_time_sessions_end_after_start
    check (ended_at is null or ended_at > started_at)
);

comment on table public.work_order_time_sessions is
  'Palvelimen kellottama työmääräyskohtainen työaika. Avoin istunto syntyy määrätyn työn käynnistämisestä ja muuttuu tuntikirjaukseksi keskeytyksessä, vaihdossa tai valmistumisessa.';
comment on column public.work_order_time_sessions.end_reason is
  'paused = työntekijä keskeytti, completed = työ valmistui, switched = käyttäjä aloitti toisen määrätyn työn.';

alter table public.time_entries
  add column if not exists work_session_id uuid references public.work_order_time_sessions(id) on delete set null;

create unique index if not exists work_order_time_sessions_one_active_per_user_idx
  on public.work_order_time_sessions (organization_id, user_id)
  where ended_at is null;
create index if not exists work_order_time_sessions_order_started_idx
  on public.work_order_time_sessions (work_order_id, started_at desc);
create index if not exists work_order_time_sessions_org_started_idx
  on public.work_order_time_sessions (organization_id, started_at desc);
create index if not exists time_entries_work_session_id_idx
  on public.time_entries (work_session_id)
  where work_session_id is not null;

alter table public.work_order_time_sessions enable row level security;

drop policy if exists work_order_time_sessions_select on public.work_order_time_sessions;
create policy work_order_time_sessions_select
on public.work_order_time_sessions
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.has_org_role(organization_id, array['admin', 'supervisor'])
);

-- Istuntoja ei luoda tai suljeta suoraan Data API:n kautta. Kaikki muutokset
-- kulkevat transition_my_work_order-RPC:n läpi, jotta tila ja työaika ovat sama
-- transaktio.
revoke all on table public.work_order_time_sessions from anon, authenticated;
grant select on table public.work_order_time_sessions to authenticated;
grant all on table public.work_order_time_sessions to service_role;

create or replace function private.close_work_order_time_session_impl(
  p_organization_id uuid,
  p_user_id uuid,
  p_work_order_id uuid,
  p_end_reason text,
  p_worker_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.work_order_time_sessions%rowtype;
  v_order public.work_orders%rowtype;
  v_finished_at timestamptz := statement_timestamp();
  v_timezone text := 'Europe/Helsinki';
  v_local_start timestamp without time zone;
  v_local_end timestamp without time zone;
  v_employee_id uuid;
  v_employee_name text;
  v_project_name text;
  v_time_entry_id uuid;
  v_description text;
begin
  if auth.uid() is null or auth.uid() is distinct from p_user_id then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  if p_end_reason not in ('paused', 'completed', 'switched') then
    raise exception 'Tuntematon työajan päättämisen syy.' using errcode = '23514';
  end if;

  select session_row.*
  into v_session
  from public.work_order_time_sessions session_row
  where session_row.organization_id = p_organization_id
    and session_row.user_id = p_user_id
    and session_row.work_order_id = p_work_order_id
    and session_row.ended_at is null
  for update;

  if not found then
    return null;
  end if;

  if v_finished_at <= v_session.started_at then
    raise exception 'Työajan loppu ei voi olla ennen alkua.' using errcode = '23514';
  end if;

  if v_finished_at - v_session.started_at >= interval '24 hours' then
    raise exception 'Avoin työaika on vähintään 24 tuntia. Työnjohdon pitää tarkistaa kirjaus ennen päättämistä.'
      using errcode = '23514';
  end if;

  select order_row.*
  into v_order
  from public.work_orders order_row
  where order_row.id = p_work_order_id
    and order_row.organization_id = p_organization_id;

  if not found then
    raise exception 'Työmääräystä ei löytynyt.' using errcode = '23503';
  end if;

  select coalesce(rules.timezone, 'Europe/Helsinki')
  into v_timezone
  from (select 1) seed
  left join public.organization_time_rules rules
    on rules.organization_id = p_organization_id;

  v_local_start := v_session.started_at at time zone v_timezone;
  v_local_end := v_finished_at at time zone v_timezone;

  select
    employee.id,
    coalesce(
      nullif(btrim(employee.name), ''),
      nullif(btrim(profile.full_name), ''),
      nullif(btrim(profile.email), ''),
      'Työntekijä'
    )
  into v_employee_id, v_employee_name
  from public.profiles profile
  left join public.employees employee
    on employee.organization_id = p_organization_id
   and employee.user_id = profile.id
  where profile.id = p_user_id
  limit 1;

  select coalesce(
    nullif(btrim(project_row.name), ''),
    nullif(btrim(v_order.project), ''),
    'Yksittäinen työ'
  )
  into v_project_name
  from (select 1) seed
  left join public.projects project_row
    on project_row.id = v_order.project_id
   and project_row.organization_id = p_organization_id;

  v_description := concat(
    'Työmääräys: ',
    coalesce(nullif(btrim(v_order.title), ''), 'Nimetön työ'),
    case
      when nullif(btrim(coalesce(p_worker_note, '')), '') is not null
        then E'\nTyöhuomio: ' || btrim(p_worker_note)
      else ''
    end
  );

  -- Alle minuutin vahinkokäynnistys suljetaan ilman palkkariviä. Näin
  -- kellonaikojen pyöristys ei tuota nollapituista tai keinotekoisesti
  -- pidennettyä tuntikirjausta.
  if v_finished_at - v_session.started_at >= interval '1 minute' then
    insert into public.time_entries (
      organization_id,
      created_by,
      user_id,
      project_id,
      work_order_id,
      work_session_id,
      employee_id,
      date,
      employee,
      project,
      hours,
      overtime,
      start_time,
      end_time,
      break_minutes,
      break_source,
      source,
      description,
      status
    ) values (
      p_organization_id,
      p_user_id,
      p_user_id,
      v_order.project_id,
      v_order.id,
      v_session.id,
      v_employee_id,
      v_local_start::date,
      coalesce(v_employee_name, 'Työntekijä'),
      coalesce(v_project_name, 'Yksittäinen työ'),
      0.01,
      0,
      v_local_start::time(0),
      v_local_end::time(0),
      0,
      'automatic',
      'work_order',
      v_description,
      'Odottaa'
    )
    returning id into v_time_entry_id;
  end if;

  update public.work_order_time_sessions
  set ended_at = v_finished_at,
      end_reason = p_end_reason,
      time_entry_id = v_time_entry_id,
      updated_at = v_finished_at
  where id = v_session.id;

  insert into public.audit_logs (
    organization_id,
    user_id,
    action,
    table_name,
    record_id,
    metadata
  ) values (
    p_organization_id,
    p_user_id,
    'work_order_time_stopped',
    'work_order_time_sessions',
    v_session.id,
    jsonb_build_object(
      'work_order_id', p_work_order_id,
      'started_at', v_session.started_at,
      'ended_at', v_finished_at,
      'end_reason', p_end_reason,
      'time_entry_id', v_time_entry_id,
      'discarded_as_short', v_time_entry_id is null
    )
  );

  return v_time_entry_id;
end;
$$;

revoke all on function private.close_work_order_time_session_impl(uuid, uuid, uuid, text, text)
from public, anon;
grant execute on function private.close_work_order_time_session_impl(uuid, uuid, uuid, text, text)
to authenticated, service_role;

create or replace function private.transition_my_work_order_impl(
  p_work_order_id uuid,
  p_status text,
  p_worker_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.work_orders%rowtype;
  v_active_session public.work_order_time_sessions%rowtype;
  v_previous_order_id uuid;
  v_employee_id uuid;
begin
  if v_user_id is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  if p_status not in ('Käynnissä', 'Odottaa', 'Valmis') then
    raise exception 'Työmääräyksen tilasiirtymä ei ole sallittu.' using errcode = '23514';
  end if;

  select order_row.*
  into v_order
  from public.work_orders order_row
  where order_row.id = p_work_order_id
  for update;

  if not found then
    raise exception 'Työmääräystä ei löytynyt.' using errcode = '23503';
  end if;

  if not private.can_access_work_order(v_order.id, v_order.organization_id, v_user_id) then
    raise exception 'Työmääräys ei kuulu käyttäjälle.' using errcode = '42501';
  end if;

  if p_status = 'Käynnissä' then
    if v_order.status not in ('Avoin', 'Odottaa', 'Käynnissä') then
      raise exception 'Työtä ei voi käynnistää nykyisestä tilasta.' using errcode = '23514';
    end if;

    select session_row.*
    into v_active_session
    from public.work_order_time_sessions session_row
    where session_row.organization_id = v_order.organization_id
      and session_row.user_id = v_user_id
      and session_row.ended_at is null
    for update;

    -- Tuplapainallus tai verkkopyynnön uusinta on idempotentti.
    if found and v_active_session.work_order_id = v_order.id then
      return;
    end if;

    if found then
      v_previous_order_id := v_active_session.work_order_id;

      perform private.close_work_order_time_session_impl(
        v_order.organization_id,
        v_user_id,
        v_previous_order_id,
        'switched',
        'Työaika päättyi automaattisesti uuden määrätyn työn alkaessa.'
      );

      -- Jos kukaan muu ei enää työskentele edellisellä työmääräyksellä,
      -- se ei saa jäädä virheellisesti Käynnissä-tilaan.
      if not exists (
        select 1
        from public.work_order_time_sessions active_session
        where active_session.work_order_id = v_previous_order_id
          and active_session.ended_at is null
      ) then
        update public.work_orders
        set status = 'Odottaa',
            worker_note = coalesce(
              nullif(worker_note, ''),
              'Työ keskeytyi automaattisesti, kun työntekijä aloitti toisen määrätyn työn.'
            )
        where id = v_previous_order_id
          and status = 'Käynnissä';
      end if;
    end if;

    select employee.id
    into v_employee_id
    from public.employees employee
    where employee.organization_id = v_order.organization_id
      and employee.user_id = v_user_id
    limit 1;

    if v_order.status <> 'Käynnissä' then
      update public.work_orders
      set status = 'Käynnissä',
          worker_note = nullif(btrim(coalesce(p_worker_note, '')), '')
      where id = v_order.id;
    end if;

    insert into public.work_order_time_sessions (
      organization_id,
      work_order_id,
      user_id,
      project_id,
      employee_id
    ) values (
      v_order.organization_id,
      v_order.id,
      v_user_id,
      v_order.project_id,
      v_employee_id
    );

    insert into public.audit_logs (
      organization_id,
      user_id,
      action,
      table_name,
      record_id,
      metadata
    ) values (
      v_order.organization_id,
      v_user_id,
      'work_order_time_started',
      'work_orders',
      v_order.id,
      jsonb_build_object(
        'old_status', v_order.status,
        'new_status', 'Käynnissä',
        'started_at', statement_timestamp(),
        'previous_work_order_id', v_previous_order_id
      )
    );

    return;
  end if;

  if not (
    (v_order.status = 'Käynnissä' and p_status in ('Odottaa', 'Valmis'))
    or (v_order.status = 'Odottaa' and p_status = 'Valmis')
  ) then
    raise exception 'Työmääräyksen tilasiirtymä ei ole sallittu.' using errcode = '23514';
  end if;

  perform private.close_work_order_time_session_impl(
    v_order.organization_id,
    v_user_id,
    v_order.id,
    case when p_status = 'Valmis' then 'completed' else 'paused' end,
    p_worker_note
  );

  if exists (
    select 1
    from public.work_order_time_sessions active_session
    where active_session.work_order_id = v_order.id
      and active_session.ended_at is null
  ) then
    raise exception 'Toinen työntekijä työskentelee edelleen tällä työmääräyksellä. Työtä ei voi vielä keskeyttää tai merkitä valmiiksi.'
      using errcode = '23514';
  end if;

  update public.work_orders
  set status = p_status,
      worker_note = nullif(btrim(coalesce(p_worker_note, '')), '')
  where id = v_order.id;

  insert into public.audit_logs (
    organization_id,
    user_id,
    action,
    table_name,
    record_id,
    metadata
  ) values (
    v_order.organization_id,
    v_user_id,
    'work_order_status_changed',
    'work_orders',
    v_order.id,
    jsonb_build_object(
      'old_status', v_order.status,
      'new_status', p_status,
      'worker_note', nullif(btrim(coalesce(p_worker_note, '')), ''),
      'time_closed_automatically', true
    )
  );
end;
$$;

revoke all on function private.transition_my_work_order_impl(uuid, text, text)
from public, anon;
grant execute on function private.transition_my_work_order_impl(uuid, text, text)
to authenticated, service_role;

create or replace function public.transition_my_work_order(
  p_work_order_id uuid,
  p_status text,
  p_worker_note text default null
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.transition_my_work_order_impl(
    p_work_order_id,
    p_status,
    p_worker_note
  );
$$;

revoke all on function public.transition_my_work_order(uuid, text, text) from public, anon;
grant execute on function public.transition_my_work_order(uuid, text, text)
to authenticated, service_role;

comment on function public.transition_my_work_order(uuid, text, text) is
  'Käynnistää, keskeyttää tai päättää käyttäjälle määrätyn työn. Käynnistäminen avaa automaattisen työajan ja keskeytys/valmistuminen muodostaa odottavan tuntikirjauksen.';

commit;
