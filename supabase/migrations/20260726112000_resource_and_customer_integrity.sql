begin;

create or replace function private.enforce_single_primary_customer_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_primary then
    update public.customer_contacts
    set is_primary = false, updated_at = now()
    where organization_id = new.organization_id
      and customer_id = new.customer_id
      and id is distinct from new.id
      and is_primary;
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_single_primary_customer_contact() from public, anon, authenticated;
drop trigger if exists enforce_single_primary_customer_contact on public.customer_contacts;
create trigger enforce_single_primary_customer_contact
before insert or update of is_primary, customer_id on public.customer_contacts
for each row execute function private.enforce_single_primary_customer_contact();

create or replace function private.prevent_equipment_reservation_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ends_at <= new.starts_at then
    raise exception 'Varauksen päättymisajan pitää olla alkamisajan jälkeen.' using errcode = '23514';
  end if;
  if new.status not in ('Palautettu', 'Peruttu') and exists (
    select 1
    from public.equipment_reservations existing
    where existing.organization_id = new.organization_id
      and existing.equipment_id = new.equipment_id
      and existing.id is distinct from new.id
      and existing.status not in ('Palautettu', 'Peruttu')
      and tstzrange(existing.starts_at, existing.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'Kalusto on jo varattu valitulla ajalla.' using errcode = '23P01';
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_equipment_reservation_overlap() from public, anon, authenticated;
drop trigger if exists prevent_equipment_reservation_overlap on public.equipment_reservations;
create trigger prevent_equipment_reservation_overlap
before insert or update of equipment_id, starts_at, ends_at, status on public.equipment_reservations
for each row execute function private.prevent_equipment_reservation_overlap();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'employee_certifications_dates_check') then
    alter table public.employee_certifications
      add constraint employee_certifications_dates_check
      check (expires_at is null or issued_at is null or expires_at >= issued_at);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'employee_absences_dates_check') then
    alter table public.employee_absences
      add constraint employee_absences_dates_check
      check (end_date >= start_date);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_maintenance_cost_check') then
    alter table public.equipment_maintenance
      add constraint equipment_maintenance_cost_check
      check (cost_cents >= 0);
  end if;
end
$$;

commit;
