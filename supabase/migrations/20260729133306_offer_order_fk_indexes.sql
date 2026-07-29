begin;

drop index if exists public.sales_orders_project_idx;
drop index if exists public.projects_sales_order_idx;
drop index if exists public.offers_sales_order_idx;

create index if not exists sales_orders_project_id_fk_idx
  on public.sales_orders (project_id);
create index if not exists sales_orders_customer_id_fk_idx
  on public.sales_orders (customer_id);
create index if not exists sales_orders_offer_id_fk_idx
  on public.sales_orders (offer_id);
create index if not exists sales_orders_accepted_offer_version_id_fk_idx
  on public.sales_orders (accepted_offer_version_id);
create index if not exists sales_orders_created_by_fk_idx
  on public.sales_orders (created_by);

create index if not exists sales_order_lines_organization_id_fk_idx
  on public.sales_order_lines (organization_id);
create index if not exists sales_order_lines_source_offer_line_id_fk_idx
  on public.sales_order_lines (source_offer_line_id);

create index if not exists projects_sales_order_id_fk_idx
  on public.projects (sales_order_id);
create index if not exists projects_source_offer_id_fk_idx
  on public.projects (source_offer_id);
create index if not exists projects_source_offer_version_id_fk_idx
  on public.projects (source_offer_version_id);

create index if not exists offers_sales_order_id_fk_idx
  on public.offers (sales_order_id);

commit;
