begin;

do $$
declare
  v_table_name text;
  v_base_name text;
  v_coordinator_expression constant text :=
    'private.has_org_role(organization_id, ARRAY[''project_coordinator'']::text[])';
begin
  foreach v_table_name in array array[
    'announcements',
    'crm_leads',
    'customers',
    'diary_entries',
    'equipment',
    'safety_items',
    'waste_entries'
  ] loop
    select policyname
      into v_base_name
    from pg_policies
    where schemaname = 'public'
      and tablename = v_table_name
      and cmd = 'DELETE'
      and policyname <> 'project_coordinator_delete_access'
    order by policyname
    limit 1;

    if v_base_name is null then
      raise exception 'DELETE policy is missing for public.%', v_table_name;
    end if;

    execute format(
      'alter policy %I on public.%I using (private.has_org_role(organization_id, ARRAY[''admin'', ''supervisor'', ''project_coordinator'']::text[]))',
      v_base_name,
      v_table_name
    );
    execute format(
      'drop policy if exists project_coordinator_delete_access on public.%I',
      v_table_name
    );

    v_base_name := null;
    select policyname
      into v_base_name
    from pg_policies
    where schemaname = 'public'
      and tablename = v_table_name
      and cmd = 'UPDATE'
      and policyname <> 'project_coordinator_update_access'
    order by policyname
    limit 1;

    if v_base_name is null then
      raise exception 'UPDATE policy is missing for public.%', v_table_name;
    end if;

    execute format(
      'alter policy %I on public.%I using (private.has_org_role(organization_id, ARRAY[''admin'', ''supervisor'', ''project_coordinator'']::text[])) with check (private.has_org_role(organization_id, ARRAY[''admin'', ''supervisor'', ''project_coordinator'']::text[]))',
      v_base_name,
      v_table_name
    );
    execute format(
      'drop policy if exists project_coordinator_update_access on public.%I',
      v_table_name
    );
  end loop;
end;
$$;

commit;
