create index if not exists employees_user_id_idx
  on public.employees(user_id);

create index if not exists messages_recipient_user_id_idx
  on public.messages(recipient_user_id);

create index if not exists messages_sender_user_id_idx
  on public.messages(sender_user_id);

create index if not exists project_members_project_organization_idx
  on public.project_members(project_id, organization_id);

create index if not exists shifts_user_id_idx
  on public.shifts(user_id);

create index if not exists work_order_assignees_assigned_by_idx
  on public.work_order_assignees(assigned_by);

create index if not exists work_orders_project_organization_idx
  on public.work_orders(project_id, organization_id);
