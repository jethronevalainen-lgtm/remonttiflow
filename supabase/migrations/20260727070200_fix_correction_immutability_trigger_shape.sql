create or replace function private.prevent_payroll_correction_version_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'payroll_correction_versions' then
    if tg_op = 'UPDATE'
       and old.snapshot = '{}'::jsonb
       and new.snapshot <> '{}'::jsonb
       and (pg_catalog.to_jsonb(new) - array['snapshot','employee_count']::text[])
         = (pg_catalog.to_jsonb(old) - array['snapshot','employee_count']::text[]) then
      return new;
    end if;
  end if;

  raise exception 'Hyväksytty palkkakorjausversio on muuttumaton.' using errcode = '42501';
end;
$$;
