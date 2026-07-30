do $$
declare
  target_function regprocedure;
begin
  for target_function in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'acknowledge_customer_portal_publication_v3',
        'cancel_customer_portal_order_v3',
        'create_customer_portal_order_v3',
        'customer_portal_home_v3',
        'customer_portal_order_detail_v3',
        'management_customer_portal_dashboard_v3',
        'management_publish_customer_portal_item_v3',
        'management_set_customer_portal_user_v3',
        'management_set_inspection_customer_visibility_v3',
        'management_update_customer_portal_order_v3',
        'mark_customer_portal_order_read_v3',
        'register_customer_order_attachment_v3',
        'send_customer_portal_order_message_v3',
        'update_customer_portal_order_v3'
      ])
  loop
    execute format('revoke all on function %s from public, anon', target_function);
    execute format('grant execute on function %s to authenticated, service_role', target_function);
  end loop;
end;
$$;
