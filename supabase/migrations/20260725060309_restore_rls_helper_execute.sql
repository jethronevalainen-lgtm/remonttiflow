begin;

-- RLS policies on projects, work_orders and work_order_assignees invoke these
-- fixed-search-path SECURITY DEFINER helpers. Revoking EXECUTE from the
-- authenticated role made every affected SELECT fail with HTTP 403 before the
-- policy could evaluate.
revoke all on function private.can_access_project(uuid, uuid, uuid)
  from public, anon;
revoke all on function private.can_access_work_order(uuid, uuid, uuid)
  from public, anon;

grant execute on function private.can_access_project(uuid, uuid, uuid)
  to authenticated;
grant execute on function private.can_access_work_order(uuid, uuid, uuid)
  to authenticated;

commit;
