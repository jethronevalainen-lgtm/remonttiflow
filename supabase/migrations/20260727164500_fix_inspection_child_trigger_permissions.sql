begin;

-- Child-row immutability must be checked independently of the caller's RLS
-- visibility. The trigger function only resolves the parent inspection and
-- rejects writes after approval/voiding; it does not expose data to callers.
alter function private.enforce_inspection_child_immutability() security definer;
alter function private.enforce_inspection_child_immutability() set search_path = '';

-- Keep both internal functions unavailable as direct application RPCs.
revoke all on function private.enforce_inspection_child_immutability()
  from public, anon, authenticated, service_role;
revoke all on function private.inspection_parent_is_approved(uuid)
  from public, anon, authenticated, service_role;

commit;
