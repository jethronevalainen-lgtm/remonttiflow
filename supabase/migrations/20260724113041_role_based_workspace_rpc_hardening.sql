begin;

create or replace function private.enforce_worker_work_order_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if private.has_org_role(old.organization_id, array['admin', 'supervisor']) then
    return new;
  end if;

  if auth.uid() is null or not private.can_access_work_order(old.id, old.organization_id, auth.uid()) then
    raise exception 'Työmääräys ei kuulu käyttäjälle.' using errcode = '42501';
  end if;

  if new.organization_id is distinct from old.organization_id
     or new.project_id is distinct from old.project_id
     or new.title is distinct from old.title
     or new.project is distinct from old.project
     or new.assignee is distinct from old.assignee
     or new.due_date is distinct from old.due_date
     or new.priority is distinct from old.priority
     or new.description is distinct from old.description
     or new.type is distinct from old.type
     or new.assignment_scope is distinct from old.assignment_scope
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Työntekijä voi muuttaa vain oman työn tilaa ja työhuomiota.' using errcode = '42501';
  end if;

  if not (
    (old.status = 'Avoin' and new.status = 'Käynnissä')
    or (old.status = 'Käynnissä' and new.status in ('Odottaa', 'Valmis'))
    or (old.status = 'Odottaa' and new.status in ('Käynnissä', 'Valmis'))
  ) then
    raise exception 'Työmääräyksen tilasiirtymä ei ole sallittu.' using errcode = '23514';
  end if;

  new.started_at := case
    when new.status = 'Käynnissä' then coalesce(old.started_at, now())
    else old.started_at
  end;
  new.completed_at := case when new.status = 'Valmis' then now() else null end;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.enforce_worker_work_order_update()
from public, anon, authenticated;

drop trigger if exists work_orders_worker_update_guard on public.work_orders;
create trigger work_orders_worker_update_guard
before update on public.work_orders
for each row execute function private.enforce_worker_work_order_update();

alter function public.replace_project_members(uuid, uuid, uuid[]) security invoker;
alter function public.save_work_order(uuid, uuid, uuid, text, date, text, text, text, text, text, uuid[]) security invoker;
alter function public.transition_my_work_order(uuid, text, text) security invoker;

create or replace function public.transition_my_work_order(
  p_work_order_id uuid,
  p_status text,
  p_worker_note text default null
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  current_order public.work_orders%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  select * into current_order
  from public.work_orders
  where id = p_work_order_id;

  if current_order.id is null then
    raise exception 'Työmääräystä ei löytynyt.' using errcode = '23503';
  end if;

  if not private.can_access_work_order(
    current_order.id,
    current_order.organization_id,
    auth.uid()
  ) then
    raise exception 'Työmääräys ei kuulu käyttäjälle.' using errcode = '42501';
  end if;

  update public.work_orders
  set status = p_status,
      worker_note = nullif(trim(coalesce(p_worker_note, '')), '')
  where id = current_order.id;

  insert into public.audit_logs (
    organization_id, user_id, action, table_name, record_id, metadata
  ) values (
    current_order.organization_id,
    auth.uid(),
    'work_order_status_changed',
    'work_orders',
    current_order.id,
    jsonb_build_object(
      'old_status', current_order.status,
      'new_status', p_status,
      'worker_note', nullif(trim(coalesce(p_worker_note, '')), '')
    )
  );
end;
$$;

drop policy if exists work_orders_update on public.work_orders;
create policy work_orders_update on public.work_orders for update to authenticated
using (
  private.has_org_role(organization_id, array['admin', 'supervisor'])
  or private.can_access_work_order(id, organization_id, (select auth.uid()))
)
with check (
  private.has_org_role(organization_id, array['admin', 'supervisor'])
  or private.can_access_work_order(id, organization_id, (select auth.uid()))
);

commit;
