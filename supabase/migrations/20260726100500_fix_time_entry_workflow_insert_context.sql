create or replace function private.enforce_time_entry_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org_id uuid;
  is_manager boolean;
  is_admin boolean;
begin
  if tg_op = 'INSERT' then
    target_org_id := new.organization_id;
  else
    target_org_id := coalesce(new.organization_id, old.organization_id);
  end if;

  is_manager := private.has_org_role(target_org_id, array['admin','supervisor']::text[]);
  is_admin := private.has_org_role(target_org_id, array['admin']::text[]);

  if tg_op = 'INSERT' then
    if not is_manager then
      new.user_id := auth.uid();
      new.created_by := auth.uid();
      new.status := 'Odottaa';
      new.approved_by := null;
      new.approved_at := null;
      new.rejection_reason := null;
      new.locked_at := null;
    end if;
    return new;
  end if;

  if old.locked_at is not null and not is_admin then
    raise exception 'Lukittua palkkakauden tuntikirjausta ei voi muuttaa.' using errcode = '42501';
  end if;

  if not is_manager then
    if old.user_id is distinct from auth.uid() and old.created_by is distinct from auth.uid() then
      raise exception 'Voit muuttaa vain omaa tuntikirjaustasi.' using errcode = '42501';
    end if;
    if old.status <> 'Odottaa' then
      raise exception 'Vain odottavaa tuntikirjausta voi muuttaa.' using errcode = '42501';
    end if;
    if new.organization_id is distinct from old.organization_id
       or new.user_id is distinct from old.user_id
       or new.employee_id is distinct from old.employee_id
       or new.created_by is distinct from old.created_by
       or new.status is distinct from old.status
       or new.approved_by is distinct from old.approved_by
       or new.approved_at is distinct from old.approved_at
       or new.rejection_reason is distinct from old.rejection_reason
       or new.locked_at is distinct from old.locked_at then
      raise exception 'Työntekijä ei voi muuttaa hyväksyntä- tai omistajatietoja.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status = 'Hyväksytty' and old.status is distinct from 'Hyväksytty' then
    new.approved_by := auth.uid();
    new.approved_at := now();
    new.rejection_reason := null;
  elsif new.status = 'Hylätty' and old.status is distinct from 'Hylätty' then
    if length(trim(coalesce(new.rejection_reason, ''))) < 3 then
      raise exception 'Hylkäyksen perustelu on pakollinen.' using errcode = '23514';
    end if;
    new.approved_by := null;
    new.approved_at := null;
  elsif new.status = 'Odottaa' then
    new.approved_by := null;
    new.approved_at := null;
    new.rejection_reason := null;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_time_entry_workflow() from public, anon, authenticated;
