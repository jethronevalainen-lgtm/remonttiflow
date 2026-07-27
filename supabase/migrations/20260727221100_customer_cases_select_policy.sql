begin;

-- One permissive SELECT policy avoids evaluating two separate policies for
-- every row while retaining both management and customer-portal access.
drop policy if exists customer_cases_management_select on public.customer_cases;
drop policy if exists customer_cases_customer_select on public.customer_cases;
drop policy if exists customer_cases_select on public.customer_cases;

create policy customer_cases_select
on public.customer_cases for select to authenticated
using (
  private.is_management_user(organization_id, (select auth.uid()))
  or (
    customer_visible
    and project_id is not null
    and private.customer_user_can_access_project(project_id, organization_id, (select auth.uid()))
  )
);

commit;
