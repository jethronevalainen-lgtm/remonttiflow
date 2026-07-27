begin;

-- Työkokonaisuus arkistoidaan tilalla. Sitä ei poisteta sovellusroolilla,
-- koska työmääräykset, tuntitiedot ja hyväksynnät muodostavat auditointiketjun.
drop policy if exists project_work_plans_delete on public.project_work_plans;
revoke delete on public.project_work_plans from authenticated;

-- Estä työkokonaisuuden tai työvaiheen poistaminen, jos siihen kuuluu
-- työmääräyksiä. Näin vaiheketju ei voi muuttua historiassa irralliseksi.
alter table public.work_orders
  drop constraint if exists work_orders_work_plan_id_fkey,
  add constraint work_orders_work_plan_id_fkey
    foreign key (work_plan_id)
    references public.project_work_plans(id)
    on delete restrict;

alter table public.work_orders
  drop constraint if exists work_orders_project_phase_id_fkey,
  add constraint work_orders_project_phase_id_fkey
    foreign key (project_phase_id)
    references public.project_phases(id)
    on delete restrict;

commit;
