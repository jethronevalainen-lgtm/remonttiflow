begin;

create index if not exists customer_user_projects_project_org_idx
  on public.customer_user_projects(project_id, organization_id);

create index if not exists customer_user_projects_created_by_idx
  on public.customer_user_projects(created_by);

create index if not exists customer_users_customer_id_idx
  on public.customer_users(customer_id);

create index if not exists customer_users_user_id_idx
  on public.customer_users(user_id);

drop policy if exists customer_work_requests_select
  on public.customer_work_requests;

create policy customer_work_requests_select
on public.customer_work_requests
for select
to authenticated
using (
  private.has_org_role(organization_id, array['admin', 'supervisor']::text[])
  or (
    project_id is not null
    and private.customer_user_can_access_project(
      project_id,
      organization_id,
      (select auth.uid())
    )
  )
);

commit;
