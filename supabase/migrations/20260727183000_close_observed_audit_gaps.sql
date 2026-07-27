begin;

-- Keep auth function calls in init plans instead of evaluating them once per row.
alter policy project_documents_delete on public.project_documents
using (
  created_by = (select auth.uid())
  or private.has_org_role(organization_id, array['admin', 'supervisor']::text[])
);

alter policy saved_reports_select on public.saved_reports
using (
  created_by = (select auth.uid())
  or private.has_org_role(organization_id, array['admin', 'supervisor']::text[])
);

alter policy saved_reports_insert on public.saved_reports
with check (
  created_by = (select auth.uid())
  and private.is_org_member(organization_id)
);

alter policy saved_reports_update on public.saved_reports
using (created_by = (select auth.uid()))
with check (created_by = (select auth.uid()));

alter policy saved_reports_delete on public.saved_reports
using (created_by = (select auth.uid()));

alter policy time_entry_period_locks_insert on public.time_entry_period_locks
with check (
  private.has_org_role(organization_id, array['admin', 'supervisor']::text[])
  and locked_by = (select auth.uid())
);

-- Merge the project coordinator grant into the existing per-action policies.
-- This preserves the role's access while removing the duplicate permissive ALL policy.
do $$
declare
  v_table record;
  v_policy record;
  v_coordinator_expression constant text :=
    'private.has_org_role(organization_id, ARRAY[''project_coordinator'']::text[])';
  v_has_select boolean;
  v_has_insert boolean;
  v_has_update boolean;
  v_has_delete boolean;
begin
  for v_table in
    select distinct tablename
    from pg_policies
    where schemaname = 'public'
      and policyname = 'project_coordinator_manage'
    order by tablename
  loop
    select *
    into v_policy
    from pg_policies
    where schemaname = 'public'
      and tablename = v_table.tablename
      and policyname <> 'project_coordinator_manage'
      and 'authenticated' = any (roles)
      and cmd = 'ALL'
    order by policyname
    limit 1;

    if found then
      execute format(
        'alter policy %I on public.%I using ((%s) or %s) with check ((%s) or %s)',
        v_policy.policyname,
        v_table.tablename,
        coalesce(v_policy.qual, 'false'),
        v_coordinator_expression,
        coalesce(v_policy.with_check, v_policy.qual, 'false'),
        v_coordinator_expression
      );
    else
      v_has_select := false;
      v_has_insert := false;
      v_has_update := false;
      v_has_delete := false;

      for v_policy in
        select *
        from pg_policies
        where schemaname = 'public'
          and tablename = v_table.tablename
          and policyname <> 'project_coordinator_manage'
          and 'authenticated' = any (roles)
          and cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
        order by cmd, policyname
      loop
        case v_policy.cmd
          when 'SELECT' then
            if not v_has_select then
              execute format(
                'alter policy %I on public.%I using ((%s) or %s)',
                v_policy.policyname,
                v_table.tablename,
                coalesce(v_policy.qual, 'false'),
                v_coordinator_expression
              );
              v_has_select := true;
            end if;
          when 'INSERT' then
            if not v_has_insert then
              execute format(
                'alter policy %I on public.%I with check ((%s) or %s)',
                v_policy.policyname,
                v_table.tablename,
                coalesce(v_policy.with_check, 'false'),
                v_coordinator_expression
              );
              v_has_insert := true;
            end if;
          when 'UPDATE' then
            if not v_has_update then
              execute format(
                'alter policy %I on public.%I using ((%s) or %s) with check ((%s) or %s)',
                v_policy.policyname,
                v_table.tablename,
                coalesce(v_policy.qual, 'false'),
                v_coordinator_expression,
                coalesce(v_policy.with_check, v_policy.qual, 'false'),
                v_coordinator_expression
              );
              v_has_update := true;
            end if;
          when 'DELETE' then
            if not v_has_delete then
              execute format(
                'alter policy %I on public.%I using ((%s) or %s)',
                v_policy.policyname,
                v_table.tablename,
                coalesce(v_policy.qual, 'false'),
                v_coordinator_expression
              );
              v_has_delete := true;
            end if;
        end case;
      end loop;

      if not v_has_select then
        execute format(
          'create policy project_coordinator_select_access on public.%I for select to authenticated using (%s)',
          v_table.tablename,
          v_coordinator_expression
        );
      end if;
      if not v_has_insert then
        execute format(
          'create policy project_coordinator_insert_access on public.%I for insert to authenticated with check (%s)',
          v_table.tablename,
          v_coordinator_expression
        );
      end if;
      if not v_has_update then
        execute format(
          'create policy project_coordinator_update_access on public.%I for update to authenticated using (%s) with check (%s)',
          v_table.tablename,
          v_coordinator_expression,
          v_coordinator_expression
        );
      end if;
      if not v_has_delete then
        execute format(
          'create policy project_coordinator_delete_access on public.%I for delete to authenticated using (%s)',
          v_table.tablename,
          v_coordinator_expression
        );
      end if;
    end if;

    execute format(
      'drop policy if exists project_coordinator_manage on public.%I',
      v_table.tablename
    );
  end loop;
end;
$$;

alter policy time_entries_select on public.time_entries
using (
  private.has_org_role(organization_id, array['admin', 'supervisor', 'project_coordinator']::text[])
  or created_by = (select auth.uid())
);
drop policy if exists time_entries_project_coordinator_select on public.time_entries;

alter policy work_site_check_ins_select on public.work_site_check_ins
using (
  user_id = (select auth.uid())
  or private.has_org_role(organization_id, array['admin', 'supervisor', 'project_coordinator']::text[])
);
drop policy if exists work_site_check_ins_project_coordinator_select on public.work_site_check_ins;

-- Add a covering index for every foreign key that does not already have one.
-- The generated index names are deterministic across environments.
do $$
declare
  v_fk record;
  v_columns text;
  v_index_name text;
begin
  for v_fk in
    select
      constraint_row.oid,
      constraint_row.conname,
      constraint_row.conrelid,
      constraint_row.conkey,
      namespace_row.nspname,
      table_row.relname
    from pg_constraint constraint_row
    join pg_class table_row on table_row.oid = constraint_row.conrelid
    join pg_namespace namespace_row on namespace_row.oid = table_row.relnamespace
    where constraint_row.contype = 'f'
      and namespace_row.nspname = 'public'
      and not exists (
        select 1
        from pg_index index_row
        where index_row.indrelid = constraint_row.conrelid
          and index_row.indisvalid
          and index_row.indisready
          and (
            select array_agg(index_column.attnum order by index_column.ordinality)
            from unnest(index_row.indkey::smallint[]) with ordinality
              as index_column(attnum, ordinality)
            where index_column.ordinality <= cardinality(constraint_row.conkey)
          ) = constraint_row.conkey
      )
    order by namespace_row.nspname, table_row.relname, constraint_row.conname
  loop
    select string_agg(format('%I', attribute_row.attname), ', ' order by key_column.ordinality)
    into v_columns
    from unnest(v_fk.conkey) with ordinality as key_column(attnum, ordinality)
    join pg_attribute attribute_row
      on attribute_row.attrelid = v_fk.conrelid
     and attribute_row.attnum = key_column.attnum;

    v_index_name :=
      left(v_fk.relname || '_' || v_fk.conname || '_fk_idx', 54)
      || '_'
      || substr(md5(v_fk.conname), 1, 8);

    execute format(
      'create index if not exists %I on %I.%I (%s)',
      v_index_name,
      v_fk.nspname,
      v_fk.relname,
      v_columns
    );
  end loop;
end;
$$;

commit;
