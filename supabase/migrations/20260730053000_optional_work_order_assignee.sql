begin;

-- Allow work orders to be created without assignees.
-- Assignees can be added later when the work is distributed from the list.

create or replace function private.save_work_order(
  p_organization_id uuid,
  p_work_order_id uuid,
  p_project_id uuid,
  p_title text,
  p_due_date date,
  p_priority text,
  p_status text,
  p_description text,
  p_type text,
  p_assignment_scope text,
  p_assignee_user_ids uuid[],
  p_location text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  result_id uuid;
  project_name text;
  assignee_label text;
  normalized_user_ids uuid[] := coalesce(p_assignee_user_ids, array[]::uuid[]);
begin
  normalized_user_ids := array_remove(normalized_user_ids, null);

  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;
  if not private.has_org_role(p_organization_id, array['admin', 'supervisor', 'project_coordinator']) then
    raise exception 'Vain työnjohto voi tallentaa työmääräyksiä.' using errcode = '42501';
  end if;
  if nullif(trim(p_title), '') is null then
    raise exception 'Työmääräyksen otsikko on pakollinen.' using errcode = '23514';
  end if;
  if p_priority not in ('Korkea', 'Normaali', 'Matala') then
    raise exception 'Virheellinen prioriteetti.' using errcode = '23514';
  end if;
  if p_status not in ('Avoin', 'Käynnissä', 'Odottaa', 'Valmis', 'Peruttu') then
    raise exception 'Virheellinen tila.' using errcode = '23514';
  end if;
  if p_assignment_scope not in ('people', 'project_team') then
    raise exception 'Virheellinen kohdistustapa.' using errcode = '23514';
  end if;
  if p_project_id is null and p_assignment_scope = 'project_team' then
    raise exception 'Koko projektitiimi voidaan valita vain projektiin liitetylle työmääräykselle.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from unnest(normalized_user_ids) requested(user_id)
    where not exists (
      select 1
      from public.organization_members om
      where om.organization_id = p_organization_id
        and om.user_id = requested.user_id
    )
  ) then
    raise exception 'Työmääräyksen vastuuhenkilön täytyy kuulua organisaatioon.' using errcode = '23503';
  end if;

  if p_project_id is null then
    project_name := 'Yksittäinen työ';
  else
    select name into project_name
    from public.projects
    where id = p_project_id
      and organization_id = p_organization_id;

    if project_name is null then
      raise exception 'Projektia ei löytynyt.' using errcode = '23503';
    end if;

    if p_assignment_scope = 'project_team' and not exists (
      select 1
      from public.project_members
      where project_id = p_project_id
        and organization_id = p_organization_id
    ) then
      raise exception 'Lisää projektille vähintään yksi tiimin jäsen ennen kohdistamista.' using errcode = '23514';
    end if;

    if p_assignment_scope = 'people' and cardinality(normalized_user_ids) > 0 and exists (
      select 1
      from unnest(normalized_user_ids) requested(user_id)
      where not exists (
        select 1
        from public.project_members pm
        where pm.project_id = p_project_id
          and pm.organization_id = p_organization_id
          and pm.user_id = requested.user_id
      )
    ) then
      raise exception 'Projektiin liitetyn työmääräyksen vastuuhenkilön täytyy kuulua projektitiimiin.' using errcode = '23503';
    end if;
  end if;

  select string_agg(
    coalesce(nullif(trim(p.full_name), ''), p.email),
    ', ' order by coalesce(p.full_name, p.email)
  )
  into assignee_label
  from public.profiles p
  where p.id = any(normalized_user_ids);

  if p_assignment_scope = 'project_team' then
    assignee_label := 'Projektitiimi';
  end if;

  if p_work_order_id is null then
    insert into public.work_orders (
      organization_id,
      created_by,
      project_id,
      project,
      title,
      assignee,
      due_date,
      priority,
      status,
      description,
      type,
      assignment_scope,
      location,
      started_at,
      completed_at
    ) values (
      p_organization_id,
      auth.uid(),
      p_project_id,
      project_name,
      trim(p_title),
      coalesce(assignee_label, ''),
      p_due_date,
      p_priority,
      p_status,
      nullif(trim(coalesce(p_description, '')), ''),
      nullif(trim(coalesce(p_type, '')), ''),
      p_assignment_scope,
      nullif(trim(coalesce(p_location, '')), ''),
      case when p_status = 'Käynnissä' then now() else null end,
      case when p_status = 'Valmis' then now() else null end
    )
    returning id into result_id;
  else
    update public.work_orders
    set project_id = p_project_id,
        project = project_name,
        title = trim(p_title),
        assignee = coalesce(assignee_label, ''),
        due_date = p_due_date,
        priority = p_priority,
        status = p_status,
        description = nullif(trim(coalesce(p_description, '')), ''),
        type = nullif(trim(coalesce(p_type, '')), ''),
        assignment_scope = p_assignment_scope,
        location = nullif(trim(coalesce(p_location, '')), ''),
        started_at = case
          when p_status = 'Käynnissä' then coalesce(started_at, now())
          when p_status = 'Avoin' then null
          else started_at
        end,
        completed_at = case
          when p_status = 'Valmis' then coalesce(completed_at, now())
          else null
        end,
        updated_at = now()
    where id = p_work_order_id
      and organization_id = p_organization_id
    returning id into result_id;

    if result_id is null then
      raise exception 'Työmääräystä ei löytynyt.' using errcode = '23503';
    end if;
  end if;

  delete from public.work_order_assignees
  where work_order_id = result_id
    and organization_id = p_organization_id;

  insert into public.work_order_assignees (
    organization_id,
    work_order_id,
    user_id,
    assigned_by
  )
  select p_organization_id, result_id, requested.user_id, auth.uid()
  from (select distinct unnest(normalized_user_ids) as user_id) requested;

  insert into public.audit_logs (
    organization_id,
    user_id,
    action,
    table_name,
    record_id,
    metadata
  ) values (
    p_organization_id,
    auth.uid(),
    case when p_work_order_id is null then 'work_order_created' else 'work_order_updated' end,
    'work_orders',
    result_id,
    jsonb_build_object(
      'project_id', p_project_id,
      'standalone', p_project_id is null,
      'location', nullif(trim(coalesce(p_location, '')), ''),
      'assignment_scope', p_assignment_scope,
      'assignee_user_ids', normalized_user_ids,
      'status', p_status
    )
  );

  return result_id;
end;
$$;

commit;
