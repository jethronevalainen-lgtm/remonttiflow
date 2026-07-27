begin;

alter table public.organization_members
  drop constraint if exists organization_members_role_check;
alter table public.organization_members
  add constraint organization_members_role_check
  check (role in ('admin', 'supervisor', 'project_coordinator', 'worker', 'customer'));

create or replace function private.is_operational_manager(p_organization_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = p_user_id
      and om.role in ('admin', 'supervisor', 'project_coordinator')
  );
$$;

create or replace function private.is_internal_org_member(p_organization_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = p_user_id
      and om.role in ('admin', 'supervisor', 'project_coordinator', 'worker')
  );
$$;

grant execute on function private.is_operational_manager(uuid, uuid) to authenticated;
grant execute on function private.is_internal_org_member(uuid, uuid) to authenticated;

create or replace function private.can_access_project(p_project_id uuid, p_organization_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select private.is_operational_manager(p_organization_id, p_user_id)
  or exists (
    select 1 from public.project_members pm
    where pm.project_id = p_project_id
      and pm.organization_id = p_organization_id
      and pm.user_id = p_user_id
  )
  or exists (
    select 1
    from public.work_orders wo
    join public.work_order_assignees wa
      on wa.work_order_id = wo.id
     and wa.organization_id = wo.organization_id
    where wo.project_id = p_project_id
      and wo.organization_id = p_organization_id
      and wa.user_id = p_user_id
  );
$$;

create or replace function private.can_access_work_order(p_work_order_id uuid, p_organization_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select private.is_operational_manager(p_organization_id, p_user_id)
  or exists (
    select 1 from public.work_order_assignees wa
    where wa.work_order_id = p_work_order_id
      and wa.organization_id = p_organization_id
      and wa.user_id = p_user_id
  )
  or exists (
    select 1
    from public.work_orders wo
    join public.project_members pm
      on pm.project_id = wo.project_id
     and pm.organization_id = wo.organization_id
    where wo.id = p_work_order_id
      and wo.organization_id = p_organization_id
      and wo.assignment_scope = 'project_team'
      and pm.user_id = p_user_id
  );
$$;

create or replace function private.can_collaborate_on_project(p_project_id uuid, p_organization_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select private.is_operational_manager(p_organization_id, p_user_id)
  or exists (
    select 1
    from public.project_members pm
    join public.organization_members om
      on om.organization_id = pm.organization_id
     and om.user_id = pm.user_id
     and om.role in ('admin', 'supervisor', 'project_coordinator', 'worker')
    where pm.project_id = p_project_id
      and pm.organization_id = p_organization_id
      and pm.user_id = p_user_id
  )
  or exists (
    select 1
    from public.work_orders wo
    join public.work_order_assignees wa
      on wa.work_order_id = wo.id
     and wa.organization_id = wo.organization_id
    join public.organization_members om
      on om.organization_id = wa.organization_id
     and om.user_id = wa.user_id
     and om.role in ('admin', 'supervisor', 'project_coordinator', 'worker')
    where wo.project_id = p_project_id
      and wo.organization_id = p_organization_id
      and wa.user_id = p_user_id
  )
  or private.is_customer_project_user(p_project_id, p_organization_id, p_user_id);
$$;

create or replace function private.can_use_internal_project_channel(p_project_id uuid, p_organization_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select private.is_operational_manager(p_organization_id, p_user_id)
  or exists (
    select 1
    from public.project_members pm
    join public.organization_members om
      on om.organization_id = pm.organization_id
     and om.user_id = pm.user_id
     and om.role = 'worker'
    where pm.project_id = p_project_id
      and pm.organization_id = p_organization_id
      and pm.user_id = p_user_id
  )
  or exists (
    select 1
    from public.work_orders wo
    join public.work_order_assignees wa
      on wa.work_order_id = wo.id
     and wa.organization_id = wo.organization_id
    join public.organization_members om
      on om.organization_id = wa.organization_id
     and om.user_id = wa.user_id
     and om.role = 'worker'
    where wo.project_id = p_project_id
      and wo.organization_id = p_organization_id
      and wa.user_id = p_user_id
  );
$$;

grant execute on function private.can_access_project(uuid, uuid, uuid) to authenticated;
grant execute on function private.can_access_work_order(uuid, uuid, uuid) to authenticated;
grant execute on function private.can_collaborate_on_project(uuid, uuid, uuid) to authenticated;
grant execute on function private.can_use_internal_project_channel(uuid, uuid, uuid) to authenticated;

create or replace function public.list_operational_directory(p_organization_id uuid)
returns table (user_id uuid, display_name text, role text, avatar_url text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_operational_manager(p_organization_id, auth.uid()) then
    raise exception 'Operatiivisen henkilöhakemiston käyttöoikeus puuttuu.' using errcode = '42501';
  end if;
  return query
  select om.user_id,
         coalesce(nullif(trim(p.full_name), ''), 'Nimetön käyttäjä'),
         om.role,
         p.avatar_url
  from public.organization_members om
  join public.profiles p on p.id = om.user_id
  where om.organization_id = p_organization_id
    and om.role in ('admin', 'supervisor', 'project_coordinator', 'worker')
  order by coalesce(nullif(trim(p.full_name), ''), 'Nimetön käyttäjä');
end;
$$;
revoke all on function public.list_operational_directory(uuid) from public, anon;
grant execute on function public.list_operational_directory(uuid) to authenticated;

drop policy if exists organization_members_select on public.organization_members;
create policy organization_members_select on public.organization_members
for select to authenticated
using (
  user_id = (select auth.uid())
  or private.is_operational_manager(organization_id, (select auth.uid()))
);

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.organization_members self_member
    join public.organization_members peer_member
      on peer_member.organization_id = self_member.organization_id
    where self_member.user_id = (select auth.uid())
      and self_member.role in ('admin', 'supervisor', 'project_coordinator', 'worker')
      and peer_member.user_id = profiles.id
      and peer_member.role in ('admin', 'supervisor', 'project_coordinator', 'worker')
  )
);

do $$
declare
  v_table_name text;
  operational_tables text[] := array[
    'announcements', 'billing_items', 'change_orders', 'construction_reporting_exports',
    'crm_activities', 'crm_leads', 'customer_contacts', 'customer_work_requests', 'customers',
    'diary_entries', 'equipment', 'equipment_maintenance', 'equipment_reservations',
    'estimate_lines', 'estimates', 'finding_actions', 'form_submissions', 'form_templates',
    'inspection_attachments', 'inspection_audit_events', 'inspection_findings',
    'inspection_reports', 'inspection_results', 'inspection_signatures', 'inspections',
    'offer_lines', 'offer_versions', 'offers', 'project_buildings', 'project_documents',
    'project_members', 'project_phases', 'project_requests', 'project_stairwells',
    'project_units', 'projects', 'quantity_takeoff_lines', 'quantity_takeoffs',
    'record_attachments', 'safety_items', 'saved_reports', 'site_receipt_attachments',
    'site_receipts', 'waste_entries', 'work_order_assignees', 'work_orders'
  ];
begin
  foreach v_table_name in array operational_tables loop
    if to_regclass(format('public.%I', v_table_name)) is not null
       and exists (
         select 1 from information_schema.columns c
         where c.table_schema = 'public'
           and c.table_name = v_table_name
           and c.column_name = 'organization_id'
       ) then
      execute format('drop policy if exists project_coordinator_manage on public.%I', v_table_name);
      execute format(
        'create policy project_coordinator_manage on public.%I for all to authenticated using (private.has_org_role(organization_id, array[''project_coordinator'']::text[])) with check (private.has_org_role(organization_id, array[''project_coordinator'']::text[]))',
        v_table_name
      );
    end if;
  end loop;
end;
$$;

drop policy if exists time_entries_project_coordinator_select on public.time_entries;
create policy time_entries_project_coordinator_select on public.time_entries
for select to authenticated
using (private.has_org_role(organization_id, array['project_coordinator']::text[]));

drop policy if exists work_site_check_ins_project_coordinator_select on public.work_site_check_ins;
create policy work_site_check_ins_project_coordinator_select on public.work_site_check_ins
for select to authenticated
using (private.has_org_role(organization_id, array['project_coordinator']::text[]));

create unique index if not exists supervisor_team_members_one_active_supervisor_idx
  on public.supervisor_team_members (organization_id, employee_id)
  where is_active;

create or replace function private.set_employee_supervisor(p_organization_id uuid, p_employee_id uuid, p_supervisor_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not private.has_org_role(p_organization_id, array['admin', 'supervisor']::text[]) then
    raise exception 'Vain ylläpitäjä tai työnjohtaja voi määrittää esihenkilön.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.employees e
    where e.id = p_employee_id
      and e.organization_id = p_organization_id
      and e.archived_at is null
  ) then
    raise exception 'Työntekijää ei löytynyt.' using errcode = '23503';
  end if;
  if p_supervisor_user_id is not null and not exists (
    select 1 from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = p_supervisor_user_id
      and om.role = 'supervisor'
  ) then
    raise exception 'Esihenkilöksi voi valita vain Työnjohtaja-roolissa olevan käyttäjän.' using errcode = '23514';
  end if;
  update public.supervisor_team_members
  set is_active = false, removed_at = now(), updated_at = now()
  where organization_id = p_organization_id
    and employee_id = p_employee_id
    and is_active
    and (p_supervisor_user_id is null or supervisor_user_id <> p_supervisor_user_id);
  if p_supervisor_user_id is not null then
    insert into public.supervisor_team_members (
      organization_id, supervisor_user_id, employee_id, assigned_by,
      is_active, assigned_at, removed_at
    ) values (
      p_organization_id, p_supervisor_user_id, p_employee_id, auth.uid(),
      true, now(), null
    )
    on conflict (organization_id, supervisor_user_id, employee_id)
    do update set
      is_active = true,
      assigned_by = auth.uid(),
      assigned_at = now(),
      removed_at = null,
      updated_at = now();
  end if;
  insert into public.audit_logs (
    organization_id, user_id, action, table_name, record_id, metadata
  ) values (
    p_organization_id, auth.uid(), 'employee_supervisor_changed',
    'supervisor_team_members', p_employee_id,
    jsonb_build_object('supervisor_user_id', p_supervisor_user_id)
  );
end;
$$;

create or replace function public.set_employee_supervisor(
  p_organization_id uuid,
  p_employee_id uuid,
  p_supervisor_user_id uuid default null
)
returns void
language sql
set search_path = pg_catalog, public, private
as $$ select private.set_employee_supervisor($1, $2, $3) $$;
revoke all on function public.set_employee_supervisor(uuid, uuid, uuid) from public, anon;
grant execute on function public.set_employee_supervisor(uuid, uuid, uuid) to authenticated;

drop policy if exists supervisor_team_members_select on public.supervisor_team_members;
create policy supervisor_team_members_select on public.supervisor_team_members
for select to authenticated
using (private.has_org_role(organization_id, array['admin', 'supervisor']::text[]));

do $$
declare
  function_record record;
  original_definition text;
  next_definition text;
  operational_function_names text[] := array[
    'convert_customer_work_request', 'create_operational_entry', 'decide_operational_entry',
    'management_live_operations', 'operational_entries_for_user', 'operational_entry_catalog',
    'project_conversation_participants_v2', 'replace_project_members',
    'require_commercial_management', 'rotate_work_site_qr_token', 'save_work_order',
    'transition_inspection_finding_impl', 'approve_inspection', 'convert_offer_to_project',
    'create_inspection', 'create_inspection_finding', 'create_offer', 'create_offer_version',
    'get_organization_report_summary', 'save_inspection_result', 'transition_offer'
  ];
begin
  for function_record in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('private', 'public')
      and p.prokind = 'f'
      and p.proname = any(operational_function_names)
  loop
    original_definition := pg_get_functiondef(function_record.oid);
    next_definition := original_definition;
    next_definition := replace(next_definition, 'private.is_management_user(', 'private.is_operational_manager(');
    next_definition := replace(next_definition, 'array[''admin'', ''supervisor'']', 'array[''admin'', ''supervisor'', ''project_coordinator'']');
    next_definition := replace(next_definition, 'ARRAY[''admin''::text, ''supervisor''::text]', 'ARRAY[''admin''::text, ''supervisor''::text, ''project_coordinator''::text]');
    next_definition := replace(next_definition, 'om.role in (''admin'', ''supervisor'')', 'om.role in (''admin'', ''supervisor'', ''project_coordinator'')');
    if next_definition is distinct from original_definition then
      execute next_definition;
    end if;
  end loop;
end;
$$;

commit;
