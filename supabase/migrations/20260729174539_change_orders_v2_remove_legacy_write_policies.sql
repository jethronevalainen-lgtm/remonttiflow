begin;

drop policy if exists change_orders_insert on public.change_orders;
drop policy if exists change_orders_update on public.change_orders;
drop policy if exists change_orders_delete on public.change_orders;

commit;
