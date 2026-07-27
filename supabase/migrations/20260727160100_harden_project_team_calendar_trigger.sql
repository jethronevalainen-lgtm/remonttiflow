begin;

create or replace function private.sync_project_team_work_order_calendars()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_id uuid;
begin
  if tg_op = 'DELETE' then
    for order_id in
      select work_order.id
      from public.work_orders work_order
      where work_order.organization_id = old.organization_id
        and work_order.project_id = old.project_id
        and work_order.assignment_scope = 'project_team'
    loop
      perform private.sync_work_order_calendar(order_id);
    end loop;
    return old;
  end if;

  if tg_op = 'INSERT' then
    for order_id in
      select work_order.id
      from public.work_orders work_order
      where work_order.organization_id = new.organization_id
        and work_order.project_id = new.project_id
        and work_order.assignment_scope = 'project_team'
    loop
      perform private.sync_work_order_calendar(order_id);
    end loop;
    return new;
  end if;

  if old.organization_id is distinct from new.organization_id
     or old.project_id is distinct from new.project_id
     or old.user_id is distinct from new.user_id then
    for order_id in
      select work_order.id
      from public.work_orders work_order
      where work_order.organization_id = old.organization_id
        and work_order.project_id = old.project_id
        and work_order.assignment_scope = 'project_team'
    loop
      perform private.sync_work_order_calendar(order_id);
    end loop;

    for order_id in
      select work_order.id
      from public.work_orders work_order
      where work_order.organization_id = new.organization_id
        and work_order.project_id = new.project_id
        and work_order.assignment_scope = 'project_team'
    loop
      perform private.sync_work_order_calendar(order_id);
    end loop;
  end if;

  return new;
end;
$$;

revoke all on function private.sync_project_team_work_order_calendars() from public, anon, authenticated;

commit;
