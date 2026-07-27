-- Keep privileged implementations out of the PostgREST-exposed public schema.
-- Public signatures remain stable through SECURITY INVOKER wrappers.

grant usage on schema private to authenticated, service_role;

alter function public.operational_entry_catalog(uuid) set schema private;
alter function public.create_operational_entry(uuid, text, date, uuid, uuid, uuid, text, text, numeric, text, numeric, numeric, numeric, numeric, bigint, text, text) set schema private;
alter function public.operational_entries_for_user(uuid, text, date, date, uuid, text) set schema private;
alter function public.decide_operational_entry(uuid, uuid, text, text) set schema private;

revoke all on function private.operational_entry_catalog(uuid) from public, anon, authenticated;
revoke all on function private.create_operational_entry(uuid, text, date, uuid, uuid, uuid, text, text, numeric, text, numeric, numeric, numeric, numeric, bigint, text, text) from public, anon, authenticated;
revoke all on function private.operational_entries_for_user(uuid, text, date, date, uuid, text) from public, anon, authenticated;
revoke all on function private.decide_operational_entry(uuid, uuid, text, text) from public, anon, authenticated;

grant execute on function private.operational_entry_catalog(uuid) to authenticated, service_role;
grant execute on function private.create_operational_entry(uuid, text, date, uuid, uuid, uuid, text, text, numeric, text, numeric, numeric, numeric, numeric, bigint, text, text) to authenticated, service_role;
grant execute on function private.operational_entries_for_user(uuid, text, date, date, uuid, text) to authenticated, service_role;
grant execute on function private.decide_operational_entry(uuid, uuid, text, text) to authenticated, service_role;

create function public.operational_entry_catalog(p_organization_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.operational_entry_catalog(p_organization_id)
$$;

create function public.create_operational_entry(
  p_organization_id uuid,
  p_entry_type text,
  p_occurred_on date,
  p_project_id uuid default null,
  p_work_order_id uuid default null,
  p_equipment_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_quantity numeric default null,
  p_unit text default null,
  p_distance_km numeric default null,
  p_duration_hours numeric default null,
  p_meter_start numeric default null,
  p_meter_end numeric default null,
  p_amount_cents bigint default null,
  p_start_location text default null,
  p_end_location text default null
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.create_operational_entry(
    p_organization_id,
    p_entry_type,
    p_occurred_on,
    p_project_id,
    p_work_order_id,
    p_equipment_id,
    p_title,
    p_description,
    p_quantity,
    p_unit,
    p_distance_km,
    p_duration_hours,
    p_meter_start,
    p_meter_end,
    p_amount_cents,
    p_start_location,
    p_end_location
  )
$$;

create function public.operational_entries_for_user(
  p_organization_id uuid,
  p_entry_type text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_project_id uuid default null,
  p_status text default null
)
returns table(
  id uuid,
  user_id uuid,
  user_name text,
  project_id uuid,
  project_name text,
  work_order_id uuid,
  work_order_title text,
  equipment_id uuid,
  equipment_name text,
  entry_type text,
  occurred_on date,
  title text,
  description text,
  quantity numeric,
  unit text,
  distance_km numeric,
  duration_hours numeric,
  meter_start numeric,
  meter_end numeric,
  amount_cents bigint,
  start_location text,
  end_location text,
  status text,
  rejection_reason text,
  created_at timestamptz,
  approved_at timestamptz
)
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  select * from private.operational_entries_for_user(
    p_organization_id,
    p_entry_type,
    p_date_from,
    p_date_to,
    p_project_id,
    p_status
  )
$$;

create function public.decide_operational_entry(
  p_organization_id uuid,
  p_entry_id uuid,
  p_status text,
  p_rejection_reason text default null
)
returns void
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.decide_operational_entry(
    p_organization_id,
    p_entry_id,
    p_status,
    p_rejection_reason
  )
$$;

revoke all on function public.operational_entry_catalog(uuid) from public, anon;
revoke all on function public.create_operational_entry(uuid, text, date, uuid, uuid, uuid, text, text, numeric, text, numeric, numeric, numeric, numeric, bigint, text, text) from public, anon;
revoke all on function public.operational_entries_for_user(uuid, text, date, date, uuid, text) from public, anon;
revoke all on function public.decide_operational_entry(uuid, uuid, text, text) from public, anon;

grant execute on function public.operational_entry_catalog(uuid) to authenticated, service_role;
grant execute on function public.create_operational_entry(uuid, text, date, uuid, uuid, uuid, text, text, numeric, text, numeric, numeric, numeric, numeric, bigint, text, text) to authenticated, service_role;
grant execute on function public.operational_entries_for_user(uuid, text, date, date, uuid, text) to authenticated, service_role;
grant execute on function public.decide_operational_entry(uuid, uuid, text, text) to authenticated, service_role;
