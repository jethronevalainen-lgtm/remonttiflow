begin;

alter table public.organization_members
  add column if not exists invitation_status text not null default 'active',
  add column if not exists invited_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists disabled_at timestamptz;

alter table public.organization_members
  drop constraint if exists organization_members_invitation_status_check;
alter table public.organization_members
  add constraint organization_members_invitation_status_check
  check (invitation_status in ('pending', 'active', 'disabled'));

update public.organization_members
set invitation_status = 'active',
    activated_at = coalesce(activated_at, created_at)
where invitation_status = 'active'
  and activated_at is null;

create unique index if not exists employees_active_org_email_unique_idx
  on public.employees (organization_id, lower(trim(email)))
  where archived_at is null and nullif(trim(email), '') is not null;

create unique index if not exists employees_active_org_user_unique_idx
  on public.employees (organization_id, user_id)
  where archived_at is null and user_id is not null;

create index if not exists organization_members_invitation_status_idx
  on public.organization_members (organization_id, invitation_status);

create or replace function private.sync_organization_member_activation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null or new.last_sign_in_at is not null then
    update public.organization_members
    set invitation_status = case when disabled_at is null then 'active' else invitation_status end,
        activated_at = coalesce(activated_at, new.email_confirmed_at, new.last_sign_in_at, now())
    where user_id = new.id
      and invitation_status = 'pending';
  end if;
  return new;
end;
$$;

revoke all on function private.sync_organization_member_activation() from public, anon, authenticated;

drop trigger if exists sync_organization_member_activation on auth.users;
create trigger sync_organization_member_activation
after update of email_confirmed_at, last_sign_in_at on auth.users
for each row
when (new.email_confirmed_at is not null or new.last_sign_in_at is not null)
execute function private.sync_organization_member_activation();

comment on column public.organization_members.invitation_status is
  'pending until the invited account is activated, active after activation, disabled when access is blocked';

commit;
