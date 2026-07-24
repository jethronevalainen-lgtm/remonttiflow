begin;

alter table public.profiles
  add column if not exists email text;

update public.profiles p
set email = lower(u.email)
from auth.users u
where u.id = p.id
  and u.email is not null
  and p.email is distinct from lower(u.email);

create unique index if not exists profiles_email_lower_key
  on public.profiles (lower(email))
  where email is not null;

create index if not exists organization_members_role_idx
  on public.organization_members (organization_id, role);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    lower(new.email),
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
      updated_at = now();
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create or replace function private.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.profiles
  set email = lower(new.email),
      updated_at = now()
  where id = new.id;
  return new;
end;
$$;

revoke all on function private.sync_profile_email() from public, anon, authenticated;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.sync_profile_email();

create or replace function private.prevent_last_organization_admin()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  other_admins integer;
begin
  if old.role = 'admin'
     and (tg_op = 'DELETE' or new.role <> 'admin') then
    select count(*)
    into other_admins
    from public.organization_members
    where organization_id = old.organization_id
      and role = 'admin'
      and user_id <> old.user_id;

    if other_admins = 0 then
      raise exception 'Organisaatiolla pitää olla vähintään yksi ylläpitäjä.'
        using errcode = '23514';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_last_organization_admin() from public, anon, authenticated;

drop trigger if exists organization_members_last_admin_guard on public.organization_members;
create trigger organization_members_last_admin_guard
  before update of role or delete on public.organization_members
  for each row execute function private.prevent_last_organization_admin();

create or replace function private.audit_organization_member_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_org uuid;
  target_user uuid;
  action_name text;
  details jsonb;
begin
  target_org := coalesce(new.organization_id, old.organization_id);
  target_user := coalesce(new.user_id, old.user_id);

  if tg_op = 'INSERT' then
    action_name := 'organization_member_added';
    details := jsonb_build_object('role', new.role);
  elsif tg_op = 'UPDATE' then
    action_name := 'organization_member_role_changed';
    details := jsonb_build_object('old_role', old.role, 'new_role', new.role);
  else
    action_name := 'organization_member_removed';
    details := jsonb_build_object('role', old.role);
  end if;

  insert into public.audit_logs (
    organization_id,
    user_id,
    action,
    table_name,
    record_id,
    metadata
  ) values (
    target_org,
    auth.uid(),
    action_name,
    'organization_members',
    target_user,
    details || jsonb_build_object('target_user_id', target_user)
  );

  return coalesce(new, old);
end;
$$;

revoke all on function private.audit_organization_member_change() from public, anon, authenticated;

drop trigger if exists organization_members_audit on public.organization_members;
create trigger organization_members_audit
  after insert or update of role or delete on public.organization_members
  for each row execute function private.audit_organization_member_change();

commit;
