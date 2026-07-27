-- PR #76 landed after the global RPC hardening migration.
-- Move its privileged implementations into private and retain stable public wrappers.

grant usage on schema private to authenticated, service_role;

alter function public.report_center_filter_catalog(uuid) set schema private;
alter function public.report_center_data(uuid, text, uuid, date, date, text[], uuid[]) set schema private;

revoke all on function private.report_center_filter_catalog(uuid) from public, anon, authenticated;
revoke all on function private.report_center_data(uuid, text, uuid, date, date, text[], uuid[]) from public, anon, authenticated;

grant execute on function private.report_center_filter_catalog(uuid) to authenticated, service_role;
grant execute on function private.report_center_data(uuid, text, uuid, date, date, text[], uuid[]) to authenticated, service_role;

create function public.report_center_filter_catalog(p_organization_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.report_center_filter_catalog(p_organization_id)
$$;

create function public.report_center_data(
  p_organization_id uuid,
  p_report_type text,
  p_project_id uuid default null,
  p_date_from date default null,
  p_date_to date default null,
  p_statuses text[] default null,
  p_user_ids uuid[] default null
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.report_center_data(
    p_organization_id,
    p_report_type,
    p_project_id,
    p_date_from,
    p_date_to,
    p_statuses,
    p_user_ids
  )
$$;

revoke all on function public.report_center_filter_catalog(uuid) from public, anon;
revoke all on function public.report_center_data(uuid, text, uuid, date, date, text[], uuid[]) from public, anon;

grant execute on function public.report_center_filter_catalog(uuid) to authenticated, service_role;
grant execute on function public.report_center_data(uuid, text, uuid, date, date, text[], uuid[]) to authenticated, service_role;
