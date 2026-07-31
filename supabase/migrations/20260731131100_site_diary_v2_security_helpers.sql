begin;

create or replace function private.can_read_site_diary(p_diary_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.diary_entries d
    where d.id = p_diary_id
      and (
        private.has_org_role(d.organization_id, array['admin', 'supervisor', 'project_coordinator'])
        or (
          d.project_id is not null
          and private.is_internal_org_member(d.organization_id, p_user_id)
          and private.can_access_project(d.project_id, d.organization_id, p_user_id)
        )
        or (
          d.visible_to_customer
          and d.project_id is not null
          and private.customer_user_can_access_project(d.project_id, d.organization_id, p_user_id)
        )
      )
  );
$$;

create or replace function private.can_edit_site_diary(p_diary_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.diary_entries d
    left join public.site_diary_settings settings
      on settings.organization_id = d.organization_id
    where d.id = p_diary_id
      and d.locked_at is null
      and d.status in ('Luonnos', 'Täydennettävä')
      and d.project_id is not null
      and private.can_access_project(d.project_id, d.organization_id, p_user_id)
      and (
        private.has_org_role(d.organization_id, array['admin', 'supervisor', 'project_coordinator'])
        or (
          coalesce(settings.allow_worker_contributions, true)
          and private.is_internal_org_member(d.organization_id, p_user_id)
        )
      )
  );
$$;

create or replace function private.can_manage_site_diary(p_diary_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.diary_entries d
    where d.id = p_diary_id
      and d.locked_at is null
      and d.status <> 'Mitätöity'
      and d.project_id is not null
      and private.can_access_project(d.project_id, d.organization_id, p_user_id)
      and private.has_org_role(d.organization_id, array['admin', 'supervisor', 'project_coordinator'])
  );
$$;

create or replace function private.can_sign_site_diary(p_diary_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.diary_entries d
    where d.id = p_diary_id
      and d.locked_at is null
      and d.status in ('Tarkastettu', 'Odottaa kuittausta')
      and d.project_id is not null
      and private.can_access_project(d.project_id, d.organization_id, p_user_id)
      and private.has_org_role(d.organization_id, array['admin', 'supervisor'])
  );
$$;

create or replace function private.prevent_locked_site_diary_child_change()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  target_diary_id uuid;
  parent_locked_at timestamptz;
begin
  target_diary_id := case when tg_op = 'DELETE' then old.diary_id else new.diary_id end;

  select d.locked_at into parent_locked_at
  from public.diary_entries d
  where d.id = target_diary_id;

  if parent_locked_at is not null then
    raise exception 'Lukitun työmaapäiväkirjan sisältöä ei voi muuttaa. Luo korjausversio.'
      using errcode = '55000';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.enforce_site_diary_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  old_without_allowed jsonb;
  new_without_allowed jsonb;
begin
  if tg_op = 'DELETE' then
    if old.locked_at is not null or old.status in ('Lukittu', 'Mitätöity') then
      raise exception 'Lukittua tai mitätöityä työmaapäiväkirjaa ei voi poistaa.' using errcode = '55000';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.locked_at is not null then
    old_without_allowed := to_jsonb(old) - array['is_current', 'updated_at'];
    new_without_allowed := to_jsonb(new) - array['is_current', 'updated_at'];
    if old_without_allowed is distinct from new_without_allowed then
      raise exception 'Lukittua työmaapäiväkirjaa ei voi muuttaa. Luo korjausversio.'
        using errcode = '55000';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'Mitätöity' then
    raise exception 'Mitätöityä työmaapäiväkirjaa ei voi muuttaa.' using errcode = '55000';
  end if;

  if new.status = 'Lukittu' and new.locked_at is null then
    raise exception 'Päiväkirja voidaan lukita vain hallitun lukitusketjun kautta.' using errcode = '55000';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_site_diary_lifecycle on public.diary_entries;
create trigger enforce_site_diary_lifecycle
  before update or delete on public.diary_entries
  for each row execute function private.enforce_site_diary_lifecycle();

-- Lock child content together with its parent diary.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'site_diary_weather_observations',
    'site_diary_workforce_rows',
    'site_diary_work_items',
    'site_diary_events',
    'site_diary_attachments',
    'site_diary_signatures'
  ]
  loop
    execute format('drop trigger if exists prevent_locked_diary_change on public.%I', table_name);
    execute format(
      'create trigger prevent_locked_diary_change before insert or update or delete on public.%I for each row execute function private.prevent_locked_site_diary_child_change()',
      table_name
    );
  end loop;
end;
$$;

commit;
