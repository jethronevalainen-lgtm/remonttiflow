-- public.complete_work_site_check_in is a SECURITY INVOKER wrapper around the
-- private SECURITY DEFINER implementation. The authenticated role therefore
-- needs EXECUTE on the private implementation; the function itself still
-- validates auth.uid(), check-in ownership and organization membership.

grant execute on function private.complete_work_site_check_in_impl(uuid) to authenticated;
