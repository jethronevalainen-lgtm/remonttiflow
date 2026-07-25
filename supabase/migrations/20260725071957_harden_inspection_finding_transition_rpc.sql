alter function public.transition_inspection_finding(uuid, text, text) set schema private;
alter function private.transition_inspection_finding(uuid, text, text) rename to transition_inspection_finding_impl;

revoke all on function private.transition_inspection_finding_impl(uuid, text, text) from public, anon;
grant execute on function private.transition_inspection_finding_impl(uuid, text, text) to authenticated;

create function public.transition_inspection_finding(
  p_finding_id uuid,
  p_status text,
  p_note text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.transition_inspection_finding_impl(p_finding_id, p_status, p_note);
$$;

revoke all on function public.transition_inspection_finding(uuid, text, text) from public, anon;
grant execute on function public.transition_inspection_finding(uuid, text, text) to authenticated;
