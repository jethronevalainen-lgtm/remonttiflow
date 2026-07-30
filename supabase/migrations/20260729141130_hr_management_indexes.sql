begin;

create index if not exists employee_employment_profiles_updated_by_fk_idx
  on public.employee_employment_profiles(updated_by)
  where updated_by is not null;

create index if not exists employee_skills_employee_id_fk_idx
  on public.employee_skills(employee_id);
create index if not exists employee_skills_verified_by_fk_idx
  on public.employee_skills(verified_by)
  where verified_by is not null;
create index if not exists employee_skills_created_by_fk_idx
  on public.employee_skills(created_by)
  where created_by is not null;
create index if not exists employee_skills_updated_by_fk_idx
  on public.employee_skills(updated_by)
  where updated_by is not null;

create index if not exists employee_training_records_employee_id_fk_idx
  on public.employee_training_records(employee_id);
create index if not exists employee_training_records_created_by_fk_idx
  on public.employee_training_records(created_by)
  where created_by is not null;
create index if not exists employee_training_records_updated_by_fk_idx
  on public.employee_training_records(updated_by)
  where updated_by is not null;

create index if not exists employee_goals_employee_id_fk_idx
  on public.employee_goals(employee_id);
create index if not exists employee_goals_created_by_fk_idx
  on public.employee_goals(created_by)
  where created_by is not null;
create index if not exists employee_goals_updated_by_fk_idx
  on public.employee_goals(updated_by)
  where updated_by is not null;

create index if not exists employee_conversations_employee_id_fk_idx
  on public.employee_conversations(employee_id);
create index if not exists employee_conversations_created_by_fk_idx
  on public.employee_conversations(created_by)
  where created_by is not null;
create index if not exists employee_conversations_updated_by_fk_idx
  on public.employee_conversations(updated_by)
  where updated_by is not null;

create index if not exists employee_hr_tasks_employee_id_fk_idx
  on public.employee_hr_tasks(employee_id);
create index if not exists employee_hr_tasks_owner_user_id_fk_idx
  on public.employee_hr_tasks(owner_user_id)
  where owner_user_id is not null;
create index if not exists employee_hr_tasks_created_by_fk_idx
  on public.employee_hr_tasks(created_by)
  where created_by is not null;
create index if not exists employee_hr_tasks_updated_by_fk_idx
  on public.employee_hr_tasks(updated_by)
  where updated_by is not null;

create index if not exists employee_documents_employee_id_fk_idx
  on public.employee_documents(employee_id);
create index if not exists employee_documents_uploaded_by_fk_idx
  on public.employee_documents(uploaded_by)
  where uploaded_by is not null;

create index if not exists employee_hr_events_employee_id_fk_idx
  on public.employee_hr_events(employee_id);
create index if not exists employee_hr_events_created_by_fk_idx
  on public.employee_hr_events(created_by)
  where created_by is not null;

commit;
