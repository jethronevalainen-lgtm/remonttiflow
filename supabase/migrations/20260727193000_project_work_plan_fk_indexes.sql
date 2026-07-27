begin;

create index if not exists project_work_plans_project_id_fk_idx
  on public.project_work_plans (project_id);

create index if not exists project_work_plans_created_by_fk_idx
  on public.project_work_plans (created_by);

commit;
