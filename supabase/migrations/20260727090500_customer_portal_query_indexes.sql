begin;

create index if not exists customer_work_requests_project_org_idx
  on public.customer_work_requests(project_id, organization_id);

create index if not exists customer_work_requests_customer_org_idx
  on public.customer_work_requests(customer_id, organization_id);

create index if not exists customer_work_requests_created_by_idx
  on public.customer_work_requests(created_by);

create index if not exists project_documents_project_org_idx
  on public.project_documents(project_id, organization_id);

create index if not exists change_orders_project_org_idx
  on public.change_orders(project_id, organization_id);

commit;
