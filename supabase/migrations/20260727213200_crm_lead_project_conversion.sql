begin;

create or replace function public.convert_crm_lead_to_project(
  p_organization_id uuid,
  p_lead_id uuid,
  p_project_name text,
  p_start_date date,
  p_end_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.crm_leads%rowtype;
  v_customer_name text;
  v_site_address text;
  v_project_id uuid;
begin
  if auth.uid() is null
     or not private.is_management_user(p_organization_id, auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if nullif(btrim(p_project_name), '') is null then
    raise exception 'project name is required' using errcode = '22023';
  end if;

  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'valid project dates are required' using errcode = '22023';
  end if;

  select *
  into v_lead
  from public.crm_leads
  where id = p_lead_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'crm lead not found' using errcode = 'P0002';
  end if;

  if v_lead.converted_project_id is not null then
    return v_lead.converted_project_id;
  end if;

  if v_lead.stage <> 'Voitettu' then
    raise exception 'only won opportunities can be converted' using errcode = '22023';
  end if;

  select c.name
  into v_customer_name
  from public.customers c
  where c.id = v_lead.customer_id
    and c.organization_id = p_organization_id;

  select nullif(concat_ws(', ', nullif(s.address, ''), nullif(s.postal_code, ''), nullif(s.city, '')), '')
  into v_site_address
  from public.customer_sites s
  where s.id = v_lead.site_id
    and s.organization_id = p_organization_id;

  insert into public.projects (
    organization_id,
    created_by,
    name,
    customer,
    customer_id,
    customer_site_id,
    location,
    status,
    start_date,
    end_date,
    budget,
    spent,
    progress,
    description,
    responsible_supervisor_id,
    project_manager_id
  )
  values (
    p_organization_id,
    auth.uid(),
    btrim(p_project_name),
    coalesce(v_customer_name, nullif(v_lead.company, ''), 'Ei määritetty'),
    v_lead.customer_id,
    v_lead.site_id,
    v_site_address,
    'Suunniteltu',
    p_start_date,
    p_end_date,
    v_lead.value,
    0,
    0,
    coalesce(v_lead.description, v_lead.notes),
    v_lead.assignee_user_id,
    v_lead.assignee_user_id
  )
  returning id into v_project_id;

  update public.crm_leads
  set converted_project_id = v_project_id,
      next_action = null,
      next_action_due_at = null,
      updated_at = now()
  where id = v_lead.id;

  insert into public.crm_activities (
    organization_id,
    lead_id,
    customer_id,
    site_id,
    project_id,
    activity_type,
    subject,
    description,
    completed_at,
    completed_by,
    created_by,
    priority
  )
  values (
    p_organization_id,
    v_lead.id,
    v_lead.customer_id,
    v_lead.site_id,
    v_project_id,
    'Projektiksi muutettu',
    'Voitettu kauppa muutettiin projektiksi',
    btrim(p_project_name),
    now(),
    auth.uid(),
    auth.uid(),
    'Normaali'
  );

  return v_project_id;
end;
$$;

revoke all on function public.convert_crm_lead_to_project(uuid, uuid, text, date, date) from public, anon;
grant execute on function public.convert_crm_lead_to_project(uuid, uuid, text, date, date) to authenticated;

commit;
