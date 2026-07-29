begin;

revoke all on table public.sales_orders, public.sales_order_lines from anon;
revoke all on table public.sales_orders, public.sales_order_lines from authenticated;
grant select on table public.sales_orders, public.sales_order_lines to authenticated;

commit;
