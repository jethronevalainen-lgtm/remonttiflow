begin;

create table if not exists public.equipment_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  returned_at timestamptz,
  assigned_by uuid references auth.users(id) on delete set null,
  returned_by uuid references auth.users(id) on delete set null,
  notes text,
  return_notes text,
  created_at timestamptz not null default now(),
  constraint equipment_assignments_dates_check
    check (returned_at is null or returned_at >= assigned_at)
);

create unique index if not exists equipment_assignments_one_active_idx
  on public.equipment_assignments(equipment_id)
  where returned_at is null;

create index if not exists equipment_assignments_employee_idx
  on public.equipment_assignments(organization_id, employee_id, assigned_at desc);

create index if not exists equipment_assignments_equipment_history_idx
  on public.equipment_assignments(organization_id, equipment_id, assigned_at desc);

alter table public.equipment_assignments enable row level security;

drop policy if exists equipment_assignments_select on public.equipment_assignments;
create policy equipment_assignments_select
  on public.equipment_assignments
  for select
  to authenticated
  using (private.is_org_member(organization_id));

create or replace function public.assign_equipment_to_employee(
  p_organization_id uuid,
  p_equipment_id uuid,
  p_employee_id uuid,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  assignment_id uuid;
  employee_user_id uuid;
begin
  if auth.uid() is null
     or not private.has_org_role(p_organization_id, array['admin','supervisor']::text[]) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  perform 1
  from public.equipment
  where id = p_equipment_id
    and organization_id = p_organization_id
    and archived_at is null
  for update;

  if not found then
    raise exception 'Kalustoa ei löytynyt.' using errcode = 'P0002';
  end if;

  select e.user_id
  into employee_user_id
  from public.employees e
  where e.id = p_employee_id
    and e.organization_id = p_organization_id
    and e.archived_at is null
    and e.status <> 'Eroonnut';

  if not found then
    raise exception 'Työntekijää ei löytynyt tai hän ei ole aktiivinen.' using errcode = 'P0002';
  end if;

  update public.equipment_assignments
  set returned_at = now(),
      returned_by = auth.uid(),
      return_notes = 'Siirretty toiselle työntekijälle'
  where organization_id = p_organization_id
    and equipment_id = p_equipment_id
    and returned_at is null;

  insert into public.equipment_assignments (
    organization_id,
    equipment_id,
    employee_id,
    assigned_by,
    notes
  ) values (
    p_organization_id,
    p_equipment_id,
    p_employee_id,
    auth.uid(),
    nullif(btrim(p_notes), '')
  )
  returning id into assignment_id;

  update public.equipment
  set responsible_user_id = employee_user_id,
      status = 'Käytössä'
  where id = p_equipment_id
    and organization_id = p_organization_id;

  return assignment_id;
end;
$$;

create or replace function public.return_equipment_from_employee(
  p_organization_id uuid,
  p_equipment_id uuid,
  p_return_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not private.has_org_role(p_organization_id, array['admin','supervisor']::text[]) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  perform 1
  from public.equipment
  where id = p_equipment_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Kalustoa ei löytynyt.' using errcode = 'P0002';
  end if;

  update public.equipment_assignments
  set returned_at = now(),
      returned_by = auth.uid(),
      return_notes = nullif(btrim(p_return_notes), '')
  where organization_id = p_organization_id
    and equipment_id = p_equipment_id
    and returned_at is null;

  if not found then
    raise exception 'Kalustolla ei ole aktiivista haltijaa.' using errcode = 'P0002';
  end if;

  update public.equipment
  set responsible_user_id = null,
      status = case when status = 'Käytössä' then 'Vapaa' else status end
  where id = p_equipment_id
    and organization_id = p_organization_id;
end;
$$;

revoke all on function public.assign_equipment_to_employee(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.assign_equipment_to_employee(uuid, uuid, uuid, text) to authenticated;

revoke all on function public.return_equipment_from_employee(uuid, uuid, text) from public, anon;
grant execute on function public.return_equipment_from_employee(uuid, uuid, text) to authenticated;

revoke insert, update, delete on public.equipment_assignments from anon, authenticated;
grant select on public.equipment_assignments to authenticated;

-- Preserve the same append-only audit trail used by the other operational tables.
drop trigger if exists audit_equipment_assignments_change on public.equipment_assignments;
create trigger audit_equipment_assignments_change
after insert or update or delete on public.equipment_assignments
for each row execute function private.audit_business_change();

commit;
