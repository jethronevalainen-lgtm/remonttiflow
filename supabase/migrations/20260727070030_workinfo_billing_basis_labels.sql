alter table public.subcontractor_project_assignments
  drop constraint if exists subcontractor_project_assignments_billing_basis_check;

alter table public.subcontractor_project_assignments
  add constraint subcontractor_project_assignments_billing_basis_check check (
    billing_basis in (
      'contract', 'hourly', 'unit', 'labour_hire',
      'urakka', 'tuntityö', 'yksikköhinta'
    )
  );
