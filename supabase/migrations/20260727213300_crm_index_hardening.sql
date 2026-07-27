begin;

create index if not exists crm_activities_completed_by_idx
  on public.crm_activities(completed_by);

create index if not exists crm_activities_project_id_idx
  on public.crm_activities(project_id);

create index if not exists crm_activities_site_id_idx
  on public.crm_activities(site_id);

create index if not exists crm_leads_site_id_idx
  on public.crm_leads(site_id);

create index if not exists customer_sites_created_by_idx
  on public.customer_sites(created_by);

create index if not exists customer_sites_customer_id_idx
  on public.customer_sites(customer_id);

create index if not exists projects_customer_site_id_idx
  on public.projects(customer_site_id);

-- The pre-existing crm_activities_customer_idx has the same definition.
drop index if exists public.crm_activities_customer_timeline_idx;

commit;
