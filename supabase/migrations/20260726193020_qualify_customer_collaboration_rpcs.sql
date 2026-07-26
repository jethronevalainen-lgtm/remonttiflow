begin;

create or replace function public.customer_project_documents_v2(p_project_id uuid)
returns table (
  id uuid,
  project_id uuid,
  document_type text,
  title text,
  description text,
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  project_row public.projects%rowtype;
begin
  select p.* into project_row
  from public.projects p
  where p.id = p_project_id;

  if project_row.id is null
     or not private.is_customer_project_user(project_row.id, project_row.organization_id, auth.uid()) then
    raise exception 'Projektin dokumentteihin ei ole käyttöoikeutta.' using errcode = '42501';
  end if;

  return query
  select d.id, d.project_id, d.document_type, d.title, d.description,
         d.storage_path, d.file_name, d.mime_type, d.size_bytes, d.created_at
  from public.project_documents d
  where d.project_id = project_row.id
    and d.organization_id = project_row.organization_id
    and d.archived_at is null
    and d.visible_to_roles && array['customer']::text[]
  order by d.created_at desc;
end;
$$;

create or replace function public.customer_project_change_orders_v2(p_project_id uuid)
returns table (
  id uuid,
  project_id uuid,
  change_number text,
  title text,
  description text,
  status text,
  amount_cents bigint,
  requested_at date,
  customer_decision text,
  customer_decision_note text,
  submitted_to_customer_at timestamptz,
  customer_decided_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  project_row public.projects%rowtype;
begin
  select p.* into project_row
  from public.projects p
  where p.id = p_project_id;

  if project_row.id is null
     or not private.is_customer_project_user(project_row.id, project_row.organization_id, auth.uid()) then
    raise exception 'Projektin muutostöihin ei ole käyttöoikeutta.' using errcode = '42501';
  end if;

  return query
  select c.id, c.project_id, c.change_number, c.title, c.description, c.status,
         c.amount_cents, c.requested_at, c.customer_decision,
         c.customer_decision_note, c.submitted_to_customer_at, c.customer_decided_at
  from public.change_orders c
  where c.project_id = project_row.id
    and c.organization_id = project_row.organization_id
    and c.customer_visible = true
  order by c.submitted_to_customer_at desc nulls last, c.created_at desc;
end;
$$;

revoke all on function public.customer_project_documents_v2(uuid) from public, anon;
revoke all on function public.customer_project_change_orders_v2(uuid) from public, anon;
grant execute on function public.customer_project_documents_v2(uuid) to authenticated;
grant execute on function public.customer_project_change_orders_v2(uuid) to authenticated;

commit;
