begin;

-- Project deletion must not erase payroll, diary, safety, shift, driving or
-- waste history. These tables already keep a legacy project label and their
-- project_id columns are nullable, so detach the historical rows instead of
-- blocking the project deletion or cascading the records away.

alter table public.time_entries
  drop constraint if exists time_entries_project_id_fkey;
alter table public.time_entries
  add constraint time_entries_project_id_fkey
  foreign key (project_id)
  references public.projects(id)
  on delete set null;

alter table public.diary_entries
  drop constraint if exists diary_entries_project_id_fkey;
alter table public.diary_entries
  add constraint diary_entries_project_id_fkey
  foreign key (project_id)
  references public.projects(id)
  on delete set null;

alter table public.driving_log_entries
  drop constraint if exists driving_log_entries_project_id_fkey;
alter table public.driving_log_entries
  add constraint driving_log_entries_project_id_fkey
  foreign key (project_id)
  references public.projects(id)
  on delete set null;

alter table public.safety_items
  drop constraint if exists safety_items_project_id_fkey;
alter table public.safety_items
  add constraint safety_items_project_id_fkey
  foreign key (project_id)
  references public.projects(id)
  on delete set null;

alter table public.shifts
  drop constraint if exists shifts_project_id_fkey;
alter table public.shifts
  add constraint shifts_project_id_fkey
  foreign key (project_id)
  references public.projects(id)
  on delete set null;

alter table public.waste_entries
  drop constraint if exists waste_entries_project_id_fkey;
alter table public.waste_entries
  add constraint waste_entries_project_id_fkey
  foreign key (project_id)
  references public.projects(id)
  on delete set null;

commit;
