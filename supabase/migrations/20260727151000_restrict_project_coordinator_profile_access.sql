begin;

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
      and self_member.role in ('admin', 'supervisor', 'worker')
      and peer_member.user_id = profiles.id
      and peer_member.role in ('admin', 'supervisor', 'project_coordinator', 'worker')
  )
);

comment on function public.list_operational_directory(uuid) is
  'Restricted project directory for admin, supervisor and project coordinator. Returns only display identity fields and never employee HR, contact, payroll, absence or travel data.';

commit;
