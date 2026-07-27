begin;

drop policy if exists customer_work_requests_select on public.customer_work_requests;
create policy customer_work_requests_select
on public.customer_work_requests
for select
to authenticated
using (
  private.has_org_role(organization_id, array['admin', 'supervisor']::text[])
  or (
    project_id is not null
    and private.customer_user_can_access_project(project_id, organization_id, auth.uid())
  )
);

create or replace function public.admin_preview_customer_accounts_v2(
  p_organization_id uuid,
  p_customer_ids uuid[],
  p_project_ids uuid[],
  p_access_scope text
)
returns table(
  customer_id uuid,
  customer_name text,
  access_scope text,
  visible_project_count bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not private.has_org_role(p_organization_id, array['admin']::text[]) then
    raise exception 'Vain ylläpitäjä voi esikatsella tilaajaportaalia.' using errcode = '42501';
  end if;
  if p_access_scope not in ('all_projects', 'selected_projects') then
    raise exception 'Virheellinen esikatselun laajuus.' using errcode = '23514';
  end if;

  return query
  select
    c.id,
    c.name,
    p_access_scope,
    count(p.id) filter (
      where p.archived_at is null
        and (
          p_access_scope = 'all_projects'
          or p.id = any(coalesce(p_project_ids, '{}'::uuid[]))
        )
    )
  from public.customers c
  left join public.projects p
    on p.organization_id = c.organization_id
   and p.customer_id = c.id
  where c.organization_id = p_organization_id
    and c.id = any(coalesce(p_customer_ids, '{}'::uuid[]))
    and c.archived_at is null
  group by c.id, c.name
  order by c.name;
end;
$$;

revoke all on function public.admin_preview_customer_accounts_v2(uuid, uuid[], uuid[], text) from public, anon;
grant execute on function public.admin_preview_customer_accounts_v2(uuid, uuid[], uuid[], text) to authenticated;

commit;
