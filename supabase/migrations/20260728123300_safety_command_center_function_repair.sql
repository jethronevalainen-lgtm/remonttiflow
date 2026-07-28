create or replace function private.validate_safety_project_organization()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_project_org uuid;
  v_parent_org uuid;
begin
  if tg_table_name = 'safety_briefings' then
    if new.project_id is not null then
      select organization_id into v_project_org from public.projects where id = new.project_id;
      if v_project_org is distinct from new.organization_id then
        raise exception 'Safety briefing project must belong to the same organization';
      end if;
    end if;
  elsif tg_table_name = 'project_safety_profiles' then
    select organization_id into v_project_org from public.projects where id = new.project_id;
    if v_project_org is distinct from new.organization_id then
      raise exception 'Safety profile project must belong to the same organization';
    end if;
  elsif tg_table_name = 'safety_attachments' then
    if new.safety_item_id is not null then
      select organization_id into v_parent_org from public.safety_items where id = new.safety_item_id;
    else
      select organization_id into v_parent_org from public.safety_briefings where id = new.briefing_id;
    end if;
    if v_parent_org is distinct from new.organization_id then
      raise exception 'Safety attachment parent must belong to the same organization';
    end if;
  end if;
  return new;
end;
$$;
