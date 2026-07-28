begin;

alter table public.work_orders
  add column if not exists estimated_minutes integer,
  add column if not exists quantity numeric(12,3),
  add column if not exists quantity_unit text,
  add column if not exists billable boolean not null default true,
  add column if not exists billing_status text not null default 'recorded',
  add column if not exists invoice_reference text,
  add column if not exists invoiced_at timestamptz;

alter table public.work_orders
  drop constraint if exists work_orders_estimated_minutes_check;
alter table public.work_orders
  add constraint work_orders_estimated_minutes_check
  check (estimated_minutes is null or estimated_minutes between 0 and 525600);

alter table public.work_orders
  drop constraint if exists work_orders_quantity_check;
alter table public.work_orders
  add constraint work_orders_quantity_check
  check (quantity is null or quantity >= 0);

alter table public.work_orders
  drop constraint if exists work_orders_quantity_unit_check;
alter table public.work_orders
  add constraint work_orders_quantity_unit_check
  check (quantity_unit is null or char_length(btrim(quantity_unit)) between 1 and 24);

alter table public.work_orders
  drop constraint if exists work_orders_billing_status_check;
alter table public.work_orders
  add constraint work_orders_billing_status_check
  check (billing_status in ('recorded', 'approved', 'billable', 'queued', 'invoiced', 'credited', 'rejected'));

create index if not exists work_orders_org_billing_status_idx
  on public.work_orders (organization_id, billing_status, due_date);
create index if not exists work_orders_org_due_status_idx
  on public.work_orders (organization_id, due_date, status);

create table if not exists public.work_order_saved_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  visible_columns jsonb not null default '[]'::jsonb,
  sort_key text not null default 'dueDate',
  sort_direction text not null default 'asc',
  page_size integer not null default 25,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_order_saved_views_name_check check (char_length(btrim(name)) between 2 and 80),
  constraint work_order_saved_views_filters_check check (jsonb_typeof(filters) = 'object'),
  constraint work_order_saved_views_columns_check check (jsonb_typeof(visible_columns) = 'array'),
  constraint work_order_saved_views_sort_direction_check check (sort_direction in ('asc', 'desc')),
  constraint work_order_saved_views_page_size_check check (page_size in (10, 25, 50, 100))
);

create unique index if not exists work_order_saved_views_org_user_name_unique
  on public.work_order_saved_views (organization_id, user_id, lower(btrim(name)));
create unique index if not exists work_order_saved_views_one_default_per_user
  on public.work_order_saved_views (organization_id, user_id)
  where is_default;
create index if not exists work_order_saved_views_user_idx
  on public.work_order_saved_views (organization_id, user_id, updated_at desc);

alter table public.work_order_saved_views enable row level security;

revoke all on table public.work_order_saved_views from public, anon, authenticated;
grant select, insert, update, delete on table public.work_order_saved_views to authenticated;
grant all on table public.work_order_saved_views to service_role;

drop policy if exists work_order_saved_views_select on public.work_order_saved_views;
create policy work_order_saved_views_select
on public.work_order_saved_views
for select
to authenticated
using (
  user_id = (select auth.uid())
  and private.is_operational_manager(organization_id, (select auth.uid()))
);

drop policy if exists work_order_saved_views_insert on public.work_order_saved_views;
create policy work_order_saved_views_insert
on public.work_order_saved_views
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and private.is_operational_manager(organization_id, (select auth.uid()))
);

drop policy if exists work_order_saved_views_update on public.work_order_saved_views;
create policy work_order_saved_views_update
on public.work_order_saved_views
for update
to authenticated
using (
  user_id = (select auth.uid())
  and private.is_operational_manager(organization_id, (select auth.uid()))
)
with check (
  user_id = (select auth.uid())
  and private.is_operational_manager(organization_id, (select auth.uid()))
);

drop policy if exists work_order_saved_views_delete on public.work_order_saved_views;
create policy work_order_saved_views_delete
on public.work_order_saved_views
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and private.is_operational_manager(organization_id, (select auth.uid()))
);

drop trigger if exists work_order_saved_views_set_updated_at on public.work_order_saved_views;
create trigger work_order_saved_views_set_updated_at
before update on public.work_order_saved_views
for each row execute function public.set_updated_at();

-- Projektikoordinaattori tarvitsee operatiivisessa ohjauksessa kaikkien käynnissä
-- olevien työmääräysistuntojen tilannekuvan, mutta ei henkilöstö- tai palkkatietoja.
drop policy if exists work_order_time_sessions_select on public.work_order_time_sessions;
create policy work_order_time_sessions_select
on public.work_order_time_sessions
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.is_operational_manager(organization_id, (select auth.uid()))
);

create or replace function private.bulk_update_work_orders_impl(
  p_organization_id uuid,
  p_work_order_ids uuid[],
  p_patch jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_count integer;
  v_status text;
  v_priority text;
  v_billing_status text;
  v_due_date date;
  v_shift_days integer;
  v_estimated_minutes integer;
  v_quantity numeric(12,3);
  v_quantity_unit text;
  v_billable boolean;
  v_assignee_ids uuid[];
  v_assignee_label text;
begin
  if auth.uid() is null
     or not private.is_operational_manager(p_organization_id, auth.uid()) then
    raise exception 'Työmääräysten massamuokkaus vaatii operatiivisen työnjohdon oikeuden.' using errcode = '42501';
  end if;

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then
    raise exception 'Muutos on tyhjä.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_patch) patch_key
    where patch_key not in (
      'status', 'priority', 'billing_status', 'due_date', 'schedule_shift_days',
      'estimated_minutes', 'quantity', 'quantity_unit', 'billable', 'assignee_user_ids'
    )
  ) then
    raise exception 'Muutos sisältää tuntemattoman kentän.' using errcode = '23514';
  end if;

  select coalesce(array_agg(distinct requested_id), array[]::uuid[])
  into v_ids
  from unnest(coalesce(p_work_order_ids, array[]::uuid[])) requested_id
  where requested_id is not null;

  if cardinality(v_ids) = 0 then
    raise exception 'Valitse vähintään yksi työmääräys.' using errcode = '23514';
  end if;
  if cardinality(v_ids) > 500 then
    raise exception 'Yhdellä kertaa voi käsitellä enintään 500 työmääräystä.' using errcode = '23514';
  end if;

  select count(*)::integer
  into v_count
  from public.work_orders wo
  where wo.organization_id = p_organization_id
    and wo.id = any(v_ids);

  if v_count <> cardinality(v_ids) then
    raise exception 'Kaikkia valittuja työmääräyksiä ei löytynyt tästä organisaatiosta.' using errcode = '23503';
  end if;

  if p_patch ? 'status' then
    v_status := p_patch ->> 'status';
    if v_status not in ('Avoin', 'Käynnissä', 'Odottaa', 'Valmis', 'Peruttu') then
      raise exception 'Virheellinen työmääräyksen tila.' using errcode = '23514';
    end if;
  end if;

  if p_patch ? 'priority' then
    v_priority := p_patch ->> 'priority';
    if v_priority not in ('Korkea', 'Normaali', 'Matala') then
      raise exception 'Virheellinen prioriteetti.' using errcode = '23514';
    end if;
  end if;

  if p_patch ? 'billing_status' then
    v_billing_status := p_patch ->> 'billing_status';
    if v_billing_status not in ('recorded', 'approved', 'billable', 'queued', 'invoiced', 'credited', 'rejected') then
      raise exception 'Virheellinen laskutuksen tila.' using errcode = '23514';
    end if;
  end if;

  if p_patch ? 'due_date' then
    begin
      v_due_date := nullif(p_patch ->> 'due_date', '')::date;
    exception when invalid_datetime_format then
      raise exception 'Virheellinen määräpäivä.' using errcode = '22007';
    end;
  end if;

  if p_patch ? 'schedule_shift_days' then
    v_shift_days := (p_patch ->> 'schedule_shift_days')::integer;
    if v_shift_days not between -3650 and 3650 then
      raise exception 'Aikataulusiirto on sallitun rajan ulkopuolella.' using errcode = '23514';
    end if;
  end if;

  if p_patch ? 'estimated_minutes' then
    v_estimated_minutes := nullif(p_patch ->> 'estimated_minutes', '')::integer;
    if v_estimated_minutes is not null and v_estimated_minutes not between 0 and 525600 then
      raise exception 'Tuntiarvio on virheellinen.' using errcode = '23514';
    end if;
  end if;

  if p_patch ? 'quantity' then
    v_quantity := nullif(p_patch ->> 'quantity', '')::numeric(12,3);
    if v_quantity is not null and v_quantity < 0 then
      raise exception 'Määrä ei voi olla negatiivinen.' using errcode = '23514';
    end if;
  end if;

  if p_patch ? 'quantity_unit' then
    v_quantity_unit := nullif(btrim(p_patch ->> 'quantity_unit'), '');
    if v_quantity_unit is not null and char_length(v_quantity_unit) > 24 then
      raise exception 'Määrän yksikkö on liian pitkä.' using errcode = '23514';
    end if;
  end if;

  if p_patch ? 'billable' then
    v_billable := (p_patch ->> 'billable')::boolean;
  end if;

  if p_patch ? 'assignee_user_ids' then
    if jsonb_typeof(p_patch -> 'assignee_user_ids') <> 'array' then
      raise exception 'Vastuuhenkilöiden pitää olla lista.' using errcode = '23514';
    end if;

    select coalesce(array_agg(distinct assignee_text::uuid), array[]::uuid[])
    into v_assignee_ids
    from jsonb_array_elements_text(p_patch -> 'assignee_user_ids') assignee_text;

    if cardinality(v_assignee_ids) = 0 then
      raise exception 'Valitse vähintään yksi vastuuhenkilö.' using errcode = '23514';
    end if;

    if exists (
      select 1
      from unnest(v_assignee_ids) requested_user_id
      where not exists (
        select 1
        from public.organization_members om
        where om.organization_id = p_organization_id
          and om.user_id = requested_user_id
          and om.role in ('admin', 'supervisor', 'project_coordinator', 'worker')
      )
    ) then
      raise exception 'Vastuuhenkilön pitää kuulua organisaation sisäisiin käyttäjiin.' using errcode = '23503';
    end if;

    if exists (
      select 1
      from public.work_orders wo
      cross join unnest(v_assignee_ids) requested_user_id
      where wo.organization_id = p_organization_id
        and wo.id = any(v_ids)
        and wo.project_id is not null
        and not exists (
          select 1
          from public.project_members pm
          where pm.organization_id = p_organization_id
            and pm.project_id = wo.project_id
            and pm.user_id = requested_user_id
        )
    ) then
      raise exception 'Kaikkien vastuuhenkilöiden pitää kuulua jokaisen valitun työn projektitiimiin.' using errcode = '23503';
    end if;

    select string_agg(
      coalesce(nullif(btrim(profile.full_name), ''), nullif(btrim(profile.email), ''), 'Nimetön käyttäjä'),
      ', ' order by coalesce(nullif(btrim(profile.full_name), ''), profile.email)
    )
    into v_assignee_label
    from public.profiles profile
    where profile.id = any(v_assignee_ids);
  end if;

  update public.work_orders wo
  set status = case when p_patch ? 'status' then v_status else wo.status end,
      priority = case when p_patch ? 'priority' then v_priority else wo.priority end,
      billing_status = case when p_patch ? 'billing_status' then v_billing_status else wo.billing_status end,
      invoiced_at = case
        when p_patch ? 'billing_status' and v_billing_status = 'invoiced' then coalesce(wo.invoiced_at, statement_timestamp())
        when p_patch ? 'billing_status' and v_billing_status <> 'invoiced' then null
        else wo.invoiced_at
      end,
      due_date = case when p_patch ? 'due_date' then v_due_date else wo.due_date end,
      planned_start_date = case
        when p_patch ? 'schedule_shift_days' and wo.planned_start_date is not null then wo.planned_start_date + v_shift_days
        else wo.planned_start_date
      end,
      planned_end_date = case
        when p_patch ? 'schedule_shift_days' and wo.planned_end_date is not null then wo.planned_end_date + v_shift_days
        else wo.planned_end_date
      end,
      estimated_minutes = case when p_patch ? 'estimated_minutes' then v_estimated_minutes else wo.estimated_minutes end,
      quantity = case when p_patch ? 'quantity' then v_quantity else wo.quantity end,
      quantity_unit = case when p_patch ? 'quantity_unit' then v_quantity_unit else wo.quantity_unit end,
      billable = case when p_patch ? 'billable' then v_billable else wo.billable end,
      assignment_scope = case when p_patch ? 'assignee_user_ids' then 'people' else wo.assignment_scope end,
      assignee = case when p_patch ? 'assignee_user_ids' then coalesce(v_assignee_label, '') else wo.assignee end,
      started_at = case
        when p_patch ? 'status' and v_status = 'Käynnissä' then coalesce(wo.started_at, statement_timestamp())
        when p_patch ? 'status' and v_status = 'Avoin' then null
        else wo.started_at
      end,
      completed_at = case
        when p_patch ? 'status' and v_status = 'Valmis' then coalesce(wo.completed_at, statement_timestamp())
        when p_patch ? 'status' and v_status <> 'Valmis' then null
        else wo.completed_at
      end,
      updated_at = statement_timestamp()
  where wo.organization_id = p_organization_id
    and wo.id = any(v_ids);

  if p_patch ? 'assignee_user_ids' then
    delete from public.work_order_assignees wa
    where wa.organization_id = p_organization_id
      and wa.work_order_id = any(v_ids);

    insert into public.work_order_assignees (
      organization_id,
      work_order_id,
      user_id,
      assigned_by
    )
    select p_organization_id, selected_order_id, selected_user_id, auth.uid()
    from unnest(v_ids) selected_order_id
    cross join unnest(v_assignee_ids) selected_user_id;
  end if;

  insert into public.audit_logs (
    organization_id,
    user_id,
    action,
    table_name,
    record_id,
    metadata
  )
  select
    p_organization_id,
    auth.uid(),
    'work_order_bulk_updated',
    'work_orders',
    selected_order_id,
    jsonb_build_object('patch', p_patch, 'batch_size', cardinality(v_ids))
  from unnest(v_ids) selected_order_id;

  return v_count;
end;
$$;

revoke all on function private.bulk_update_work_orders_impl(uuid, uuid[], jsonb) from public, anon;
grant execute on function private.bulk_update_work_orders_impl(uuid, uuid[], jsonb) to authenticated, service_role;

create or replace function public.bulk_update_work_orders(
  p_organization_id uuid,
  p_work_order_ids uuid[],
  p_patch jsonb
)
returns integer
language sql
set search_path = ''
as $$
  select private.bulk_update_work_orders_impl($1, $2, $3)
$$;

revoke all on function public.bulk_update_work_orders(uuid, uuid[], jsonb) from public, anon;
grant execute on function public.bulk_update_work_orders(uuid, uuid[], jsonb) to authenticated;

commit;
