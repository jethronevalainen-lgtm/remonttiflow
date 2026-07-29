begin;

-- Projektin elinkaaren ainoa käsin asetettava päätetila on Valmis.
-- Muut tilat muodostuvat aloitus- ja tavoitevalmistumispäivistä.
create or replace function private.project_lifecycle_status(
  p_status text,
  p_start_date date,
  p_end_date date,
  p_reference_date date
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_status = 'Valmis' then 'Valmis'
    when p_end_date is not null and p_end_date < p_reference_date then 'Myöhässä'
    when p_start_date is not null and p_start_date <= p_reference_date then 'Aktiivinen'
    else 'Suunniteltu'
  end;
$$;

revoke all on function private.project_lifecycle_status(text, date, date, date) from public, anon, authenticated;

create or replace function private.normalize_project_lifecycle_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.status := private.project_lifecycle_status(
    new.status,
    new.start_date,
    new.end_date,
    timezone('Europe/Helsinki', now())::date
  );
  return new;
end;
$$;

revoke all on function private.normalize_project_lifecycle_status() from public, anon, authenticated;

drop trigger if exists normalize_project_lifecycle_status on public.projects;
create trigger normalize_project_lifecycle_status
before insert or update of status, start_date, end_date
on public.projects
for each row
execute function private.normalize_project_lifecycle_status();

-- Päivämäärien järjestys varmistetaan myös tietokannassa, ei vain lomakkeella.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.projects'::regclass
      and conname = 'projects_date_order_check'
  ) then
    alter table public.projects
      add constraint projects_date_order_check
      check (start_date is null or end_date is null or end_date >= start_date);
  end if;
end;
$$;

-- Normalisoi mahdollinen vanha data heti migraation yhteydessä.
update public.projects p
set status = private.project_lifecycle_status(
  p.status,
  p.start_date,
  p.end_date,
  timezone('Europe/Helsinki', now())::date
)
where p.status <> 'Valmis'
  and p.status is distinct from private.project_lifecycle_status(
    p.status,
    p.start_date,
    p.end_date,
    timezone('Europe/Helsinki', now())::date
  );

create or replace function private.refresh_project_lifecycle_statuses(
  p_reference_date date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer := 0;
begin
  update public.projects p
  set status = private.project_lifecycle_status(
    p.status,
    p.start_date,
    p.end_date,
    p_reference_date
  )
  where p.status <> 'Valmis'
    and p.status is distinct from private.project_lifecycle_status(
      p.status,
      p.start_date,
      p.end_date,
      p_reference_date
    );

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function private.refresh_project_lifecycle_statuses(date) from public, anon, authenticated;

-- Tila päivittyy myös ilman projektirivin muuta muokkausta, kun päivä vaihtuu.
do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job where jobname = 'vakantti-project-lifecycle'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'vakantti-project-lifecycle',
    '7 * * * *',
    $$select private.refresh_project_lifecycle_statuses(timezone('Europe/Helsinki', now())::date);$$
  );
exception
  when undefined_table or undefined_function then
    null;
end;
$$;

comment on function private.project_lifecycle_status(text, date, date, date) is
  'Derives Suunniteltu, Aktiivinen or Myöhässä from project dates while preserving explicit Valmis status.';
comment on function private.refresh_project_lifecycle_statuses(date) is
  'Refreshes stored non-completed project statuses for reporting and integrations.';

commit;
