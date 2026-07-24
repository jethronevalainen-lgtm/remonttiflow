create index if not exists estimate_lines_estimate_org_idx
  on public.estimate_lines (estimate_id, organization_id);

create index if not exists quantity_takeoff_lines_takeoff_org_idx
  on public.quantity_takeoff_lines (takeoff_id, organization_id);

create index if not exists form_submissions_template_org_idx
  on public.form_submissions (template_id, organization_id);
