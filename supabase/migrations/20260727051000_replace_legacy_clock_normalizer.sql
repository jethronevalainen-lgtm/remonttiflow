-- The payroll v2 foundation already had a clock normalizer that inferred the
-- break mode from break_minutes. Replace it with the explicit break_source
-- normalizer so the user's choice (none/manual/automatic) is preserved.

drop trigger if exists normalize_time_entry_clock_values on public.time_entries;
drop function if exists private.normalize_time_entry_clock_values();
