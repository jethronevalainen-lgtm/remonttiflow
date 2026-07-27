begin;

alter table public.crm_activities
  drop constraint if exists crm_activities_parent_check;

alter table public.crm_activities
  add constraint crm_activities_parent_check check (
    lead_id is not null
    or customer_id is not null
    or site_id is not null
    or project_id is not null
  ) not valid;

alter table public.crm_activities
  validate constraint crm_activities_parent_check;

commit;
