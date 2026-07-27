begin;

drop policy if exists customer_user_projects_no_direct_access
  on public.customer_user_projects;

create policy customer_user_projects_no_direct_access
on public.customer_user_projects
for all
to authenticated
using (false)
with check (false);

commit;
