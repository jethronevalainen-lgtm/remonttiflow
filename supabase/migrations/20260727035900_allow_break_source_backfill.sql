begin;

alter table public.time_entries
  add column if not exists break_source text not null default 'manual';

create or replace function private.enforce_time_entry_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org_id uuid;
  is_manager boolean;
  payroll_lock_context boolean;
begin
  if tg_op = 'INSERT' then
    target_org_id := new.organization_id;
  else
    target_org_id := coalesce(new.organization_id, old.organization_id);
  end if;

  is_manager := private.has_org_role(target_org_id, array['admin','supervisor']::text[]);
  payroll_lock_context := coalesce(current_setting('vakantti.payroll_lock', true), '') = 'on';

  if tg_op = 'INSERT' then
    if not is_manager then
      new.user_id := auth.uid();
      new.created_by := auth.uid();
      new.status := 'Odottaa';
      new.approved_by := null;
      new.approved_at := null;
      new.rejection_reason := null;
      new.locked_at := null;
      new.payroll_period_id := null;
    end if;
    return new;
  end if;

  -- Versioned database migrations may backfill only the source marker. The
  -- complete row comparison prevents this path from changing hours, owners,
  -- approvals, locks or any other business data.
  if auth.uid() is null
     and (pg_catalog.to_jsonb(new) - 'break_source')
       = (pg_catalog.to_jsonb(old) - 'break_source') then
    return new;
  end if;

  if old.locked_at is not null then
    raise exception 'Lukittua palkkakauden tuntikirjausta ei voi muuttaa. Tee korjaus erillisellä korjausketjulla.' using errcode = '42501';
  end if;

  if (new.locked_at is distinct from old.locked_at or new.payroll_period_id is distinct from old.payroll_period_id)
     and not payroll_lock_context then
    raise exception 'Palkkakausilukituksen voi tehdä vain palkka-aineiston lukitustoiminnolla.' using errcode = '42501';
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
       or new.locked_at is distinct from old.locked_at
       or new.payroll_period_id is distinct from old.payroll_period_id then
      raise exception 'Työntekijä ei voi muuttaa hyväksyntä-, omistaja- tai palkkakausitietoja.' using errcode = '42501';
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

commit;
