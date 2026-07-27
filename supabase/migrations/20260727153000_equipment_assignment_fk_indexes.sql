create index if not exists equipment_assignments_employee_id_idx
  on public.equipment_assignments(employee_id);

create index if not exists equipment_assignments_assigned_by_idx
  on public.equipment_assignments(assigned_by);

create index if not exists equipment_assignments_returned_by_idx
  on public.equipment_assignments(returned_by);
