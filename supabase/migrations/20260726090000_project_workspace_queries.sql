create or replace view public.project_activity_feed
with (security_invoker = true)
as
select organization_id, project_id, id, 'work_order'::text as event_type,
       title, coalesce(status, '') as detail, coalesce(updated_at, created_at, now()) as event_at,
       created_by as actor_id
from public.work_orders
union all
select organization_id, project_id, id, 'time_entry',
       coalesce(description, 'Tuntikirjaus'), employee || ' · ' || hours::text || ' h',
       coalesce(updated_at, created_at, now()), coalesce(user_id, created_by)
from public.time_entries
where project_id is not null
union all
select organization_id, project_id, id, 'safety',
       title, coalesce(status, ''), coalesce(updated_at, created_at, now()), created_by
from public.safety_items
where project_id is not null
union all
select organization_id, project_id, id, 'diary',
       coalesce(work_phases, 'Työmaapäiväkirja'), coalesce(status, ''),
       coalesce(updated_at, created_at, now()), created_by
from public.diary_entries
where project_id is not null
union all
select organization_id, project_id, id, 'document',
       title, document_type, coalesce(updated_at, created_at, now()), created_by
from public.project_documents
where project_id is not null and archived_at is null
union all
select organization_id, project_id, id, 'change_order',
       title, status, coalesce(updated_at, created_at, now()), created_by
from public.change_orders;

create or replace function public.get_project_workspace_summary(
  p_organization_id uuid,
  p_project_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not private.can_access_project(p_project_id, p_organization_id, auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'open_work_orders', (select count(*) from public.work_orders where organization_id = p_organization_id and project_id = p_project_id and status in ('Avoin','Käynnissä','Odottaa')),
    'pending_hours', (select coalesce(sum(hours + coalesce(overtime, 0)), 0) from public.time_entries where organization_id = p_organization_id and project_id = p_project_id and status = 'Odottaa'),
    'approved_hours', (select coalesce(sum(hours + coalesce(overtime, 0)), 0) from public.time_entries where organization_id = p_organization_id and project_id = p_project_id and status = 'Hyväksytty'),
    'open_safety_items', (select count(*) from public.safety_items where organization_id = p_organization_id and project_id = p_project_id and status not in ('Korjattu','Suljettu','Vahvistettu')),
    'open_findings', (select count(*) from public.inspection_findings where organization_id = p_organization_id and project_id = p_project_id and status not in ('Hyväksytty','Mitätöity')),
    'documents', (select count(*) from public.project_documents where organization_id = p_organization_id and project_id = p_project_id and archived_at is null),
    'change_order_amount_cents', (select coalesce(sum(amount_cents), 0) from public.change_orders where organization_id = p_organization_id and project_id = p_project_id and status in ('Hyväksytty','Toteutuksessa','Valmis')),
    'change_order_cost_cents', (select coalesce(sum(cost_cents), 0) from public.change_orders where organization_id = p_organization_id and project_id = p_project_id and status in ('Hyväksytty','Toteutuksessa','Valmis'))
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_project_workspace_summary(uuid, uuid) from public, anon;
grant execute on function public.get_project_workspace_summary(uuid, uuid) to authenticated;

create or replace function public.get_organization_report_summary(
  p_organization_id uuid,
  p_project_id uuid default null,
  p_date_from date default null,
  p_date_to date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_org_role(p_organization_id, array['admin','supervisor']::text[]) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'project_budget', (select coalesce(sum(budget), 0) from public.projects where organization_id = p_organization_id and (p_project_id is null or id = p_project_id)),
    'project_spent', (select coalesce(sum(spent), 0) from public.projects where organization_id = p_organization_id and (p_project_id is null or id = p_project_id)),
    'approved_hours', (select coalesce(sum(hours + coalesce(overtime, 0)), 0) from public.time_entries where organization_id = p_organization_id and status = 'Hyväksytty' and (p_project_id is null or project_id = p_project_id) and (p_date_from is null or date >= p_date_from) and (p_date_to is null or date <= p_date_to)),
    'pending_hours', (select coalesce(sum(hours + coalesce(overtime, 0)), 0) from public.time_entries where organization_id = p_organization_id and status = 'Odottaa' and (p_project_id is null or project_id = p_project_id) and (p_date_from is null or date >= p_date_from) and (p_date_to is null or date <= p_date_to)),
    'open_work_orders', (select count(*) from public.work_orders where organization_id = p_organization_id and status in ('Avoin','Käynnissä','Odottaa') and (p_project_id is null or project_id = p_project_id)),
    'open_safety', (select count(*) from public.safety_items where organization_id = p_organization_id and status not in ('Korjattu','Suljettu','Vahvistettu') and (p_project_id is null or project_id = p_project_id) and (p_date_from is null or date >= p_date_from) and (p_date_to is null or date <= p_date_to)),
    'serious_safety', (select count(*) from public.safety_items where organization_id = p_organization_id and severity = 'Vakava' and status not in ('Korjattu','Suljettu','Vahvistettu') and (p_project_id is null or project_id = p_project_id)),
    'waste_by_unit', (select coalesce(jsonb_object_agg(unit_key, amount_sum), '{}'::jsonb) from (select coalesce(nullif(trim(unit), ''), 'määrittelemätön') as unit_key, sum(coalesce(amount,0)) as amount_sum from public.waste_entries where organization_id = p_organization_id and (p_project_id is null or project_id = p_project_id) and (p_date_from is null or date >= p_date_from) and (p_date_to is null or date <= p_date_to) group by coalesce(nullif(trim(unit), ''), 'määrittelemätön')) units),
    'waste_cost', (select coalesce(sum(cost), 0) from public.waste_entries where organization_id = p_organization_id and (p_project_id is null or project_id = p_project_id) and (p_date_from is null or date >= p_date_from) and (p_date_to is null or date <= p_date_to)),
    'travel_cost', (select coalesce(sum(amount), 0) from public.travel_expenses where organization_id = p_organization_id and status = 'Hyväksytty' and (p_project_id is null or project_id = p_project_id) and (p_date_from is null or date >= p_date_from) and (p_date_to is null or date <= p_date_to)),
    'change_order_amount_cents', (select coalesce(sum(amount_cents), 0) from public.change_orders where organization_id = p_organization_id and (p_project_id is null or project_id = p_project_id) and status in ('Hyväksytty','Toteutuksessa','Valmis')),
    'change_order_cost_cents', (select coalesce(sum(cost_cents), 0) from public.change_orders where organization_id = p_organization_id and (p_project_id is null or project_id = p_project_id) and status in ('Hyväksytty','Toteutuksessa','Valmis'))
  );
end;
$$;

revoke all on function public.get_organization_report_summary(uuid, uuid, date, date) from public, anon;
grant execute on function public.get_organization_report_summary(uuid, uuid, date, date) to authenticated;
