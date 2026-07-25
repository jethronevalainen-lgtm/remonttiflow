create index if not exists work_site_check_ins_user_id_idx
  on public.work_site_check_ins (user_id);

create index if not exists work_site_check_ins_project_id_idx
  on public.work_site_check_ins (project_id)
  where project_id is not null;
