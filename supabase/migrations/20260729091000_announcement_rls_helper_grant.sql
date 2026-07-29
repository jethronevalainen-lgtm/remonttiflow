begin;

grant execute on function private.is_announcement_manager(uuid, uuid) to authenticated;

commit;
