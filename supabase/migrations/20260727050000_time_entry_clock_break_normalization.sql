-- Normalize clock-based time entries in one server-side place.
-- Supports overnight shifts, manual/automatic/no-break modes and keeps
-- the legacy hours column synchronized for existing reports.

create or replace function private.normalize_time_entry_clock_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_gross_minutes integer;
  v_break_minutes integer;
  v_auto_after integer;
  v_auto_minutes integer;
  v_shift_start timestamp without time zone;
  v_shift_end timestamp without time zone;
  v_break_start timestamp without time zone;
  v_break_end timestamp without time zone;
begin
  new.break_source := coalesce(nullif(trim(new.break_source), ''), 'manual');

  if new.break_source not in ('none', 'manual', 'automatic') then
    raise exception 'Tuntematon taukotapa.' using errcode = '23514';
  end if;

  if (new.start_time is null) <> (new.end_time is null) then
    raise exception 'Työvuoron alku- ja loppuaika pitää antaa yhdessä.' using errcode = '23514';
  end if;

  if (new.break_start_time is null) <> (new.break_end_time is null) then
    raise exception 'Tauon alku- ja loppuaika pitää antaa yhdessä.' using errcode = '23514';
  end if;

  if new.start_time is null then
    if new.break_source = 'automatic' then
      raise exception 'Automaattinen tauko vaatii työvuoron alku- ja loppuajan.' using errcode = '23514';
    end if;

    new.break_start_time := null;
    new.break_end_time := null;
    new.break_minutes := case
      when new.break_source = 'none' then 0
      else greatest(0, coalesce(new.break_minutes, 0))
    end;
    return new;
  end if;

  if new.start_time = new.end_time then
    raise exception 'Työvuoron alku- ja loppuaika eivät voi olla samat.' using errcode = '23514';
  end if;

  v_gross_minutes := private.clock_duration_minutes(new.start_time, new.end_time);
  if v_gross_minutes <= 0 or v_gross_minutes > 1440 then
    raise exception 'Työvuoron pituuden pitää olla yli 0 ja enintään 24 tuntia.' using errcode = '23514';
  end if;

  if new.break_source = 'automatic' then
    select
      coalesce(r.automatic_break_after_minutes, 360),
      coalesce(r.automatic_break_minutes, 30)
    into v_auto_after, v_auto_minutes
    from (select 1) seed
    left join public.organization_time_rules r
      on r.organization_id = new.organization_id;

    new.break_minutes := case when v_gross_minutes >= v_auto_after then v_auto_minutes else 0 end;
    new.break_start_time := null;
    new.break_end_time := null;
  elsif new.break_source = 'none' then
    new.break_minutes := 0;
    new.break_start_time := null;
    new.break_end_time := null;
  else
    if new.break_start_time is not null then
      v_shift_start := new.date + new.start_time;
      v_shift_end := v_shift_start + (v_gross_minutes * interval '1 minute');
      v_break_start := private.shift_clock_timestamp(new.date, new.start_time, new.break_start_time);
      v_break_minutes := private.clock_duration_minutes(new.break_start_time, new.break_end_time);
      v_break_end := v_break_start + (v_break_minutes * interval '1 minute');

      if v_break_start < v_shift_start or v_break_end > v_shift_end then
        raise exception 'Tauon kellonaikojen pitää olla työvuoron sisällä.' using errcode = '23514';
      end if;
      new.break_minutes := v_break_minutes;
    else
      new.break_minutes := greatest(0, coalesce(new.break_minutes, 0));
    end if;
  end if;

  if new.break_minutes >= v_gross_minutes then
    raise exception 'Tauko ei voi olla yhtä pitkä tai pidempi kuin työvuoro.' using errcode = '23514';
  end if;

  -- Clock entries are authoritative. Payroll classifies overtime from rules,
  -- so the legacy overtime field must not add the same minutes twice.
  new.hours := round(((v_gross_minutes - new.break_minutes)::numeric / 60), 2);
  new.overtime := 0;
  return new;
end;
$$;

revoke all on function private.normalize_time_entry_clock_fields() from public, anon, authenticated;
grant execute on function private.normalize_time_entry_clock_fields() to service_role;

drop trigger if exists normalize_time_entry_clock_fields on public.time_entries;
create trigger normalize_time_entry_clock_fields
before insert or update of
  organization_id,
  date,
  hours,
  overtime,
  start_time,
  end_time,
  break_source,
  break_minutes,
  break_start_time,
  break_end_time
on public.time_entries
for each row
execute function private.normalize_time_entry_clock_fields();

comment on function private.normalize_time_entry_clock_fields() is
  'Normalizes clock-based time entries, automatic/manual breaks and overnight shifts before storage.';
