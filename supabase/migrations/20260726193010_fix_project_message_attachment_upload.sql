begin;

-- Supabase Storage upload uses INSERT ... RETURNING and therefore also needs a
-- SELECT policy before the attachment metadata row exists. Permit the owner to
-- read only the exact project-scoped object they just uploaded; all other reads
-- continue to require visible message metadata.
drop policy if exists project_message_files_select on storage.objects;
create policy project_message_files_select
on storage.objects for select to authenticated
using (
  bucket_id = 'project-message-attachments'
  and (
    (
      owner_id = (select auth.uid())::text
      and private.can_collaborate_on_project(
        private.try_uuid((storage.foldername(name))[2]),
        private.try_uuid((storage.foldername(name))[1]),
        (select auth.uid())
      )
    )
    or exists (
      select 1
      from public.project_message_attachments a
      where a.storage_path = objects.name
        and private.can_read_project_message(a.message_id, (select auth.uid()))
    )
  )
);

commit;
