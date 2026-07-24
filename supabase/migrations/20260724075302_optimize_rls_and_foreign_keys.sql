-- Avoid re-evaluating auth.uid() for every candidate row in RLS policies.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.organization_members om_self
      join public.organization_members om_peer
        on om_peer.organization_id = om_self.organization_id
      where om_self.user_id = (select auth.uid())
        and om_peer.user_id = profiles.id
    )
  );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists time_entries_update on public.time_entries;
create policy time_entries_update on public.time_entries
  for update to authenticated
  using (
    private.has_org_role(organization_id, array['admin', 'supervisor'])
    or (created_by = (select auth.uid()) and status = 'Odottaa')
  )
  with check (private.is_org_member(organization_id));

-- Cover foreign keys used by joins, deletes and tenant activity queries.
create index if not exists announcements_created_by_idx
  on public.announcements (created_by);
create index if not exists audit_logs_user_id_idx
  on public.audit_logs (user_id);
create index if not exists crm_leads_created_by_idx
  on public.crm_leads (created_by);
create index if not exists customers_created_by_idx
  on public.customers (created_by);
create index if not exists diary_entries_created_by_idx
  on public.diary_entries (created_by);
create index if not exists driving_log_entries_created_by_idx
  on public.driving_log_entries (created_by);
create index if not exists employees_created_by_idx
  on public.employees (created_by);
create index if not exists equipment_created_by_idx
  on public.equipment (created_by);
create index if not exists messages_created_by_idx
  on public.messages (created_by);
create index if not exists projects_created_by_idx
  on public.projects (created_by);
create index if not exists projects_customer_id_idx
  on public.projects (customer_id);
create index if not exists safety_items_created_by_idx
  on public.safety_items (created_by);
create index if not exists shifts_created_by_idx
  on public.shifts (created_by);
create index if not exists time_entries_employee_id_idx
  on public.time_entries (employee_id);
create index if not exists travel_expenses_created_by_idx
  on public.travel_expenses (created_by);
create index if not exists waste_entries_created_by_idx
  on public.waste_entries (created_by);
create index if not exists work_orders_created_by_idx
  on public.work_orders (created_by);
