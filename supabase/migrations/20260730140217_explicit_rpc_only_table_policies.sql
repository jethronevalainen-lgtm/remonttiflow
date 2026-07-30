begin;

-- These tables are intentionally writable only through audited SECURITY DEFINER
-- RPC functions. Explicit restrictive policies make direct client access deny-all.
create policy change_order_counters_rpc_only_deny
on public.change_order_counters
as restrictive
for all
to authenticated
using (false)
with check (false);

create policy time_entry_correction_requests_rpc_only_deny
on public.time_entry_correction_requests
as restrictive
for all
to authenticated
using (false)
with check (false);

commit;
