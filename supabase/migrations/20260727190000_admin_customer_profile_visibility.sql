begin;

alter policy profiles_select on public.profiles
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.organization_members self_member
    join public.organization_members peer_member
      on peer_member.organization_id = self_member.organization_id
    where self_member.user_id = (select auth.uid())
      and peer_member.user_id = profiles.id
      and (
        self_member.role = 'admin'
        or (
          self_member.role = any (array['supervisor', 'worker']::text[])
          and peer_member.role = any (
            array['admin', 'supervisor', 'project_coordinator', 'worker']::text[]
          )
        )
      )
  )
);

commit;
