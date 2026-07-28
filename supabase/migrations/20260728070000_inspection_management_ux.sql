begin;

alter table public.inspections
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists deletion_reason text;

create index if not exists inspections_active_organization_created_idx
  on public.inspections (organization_id, created_at desc)
  where deleted_at is null;

comment on column public.inspections.deleted_at is
  'Käyttöliittymästä poistamisen aikaleima. Rivi säilytetään auditointia varten.';
comment on column public.inspections.deletion_reason is
  'Käyttäjän antama perustelu tarkastuksen poistamiselle.';

create or replace function public.remove_inspection(
  p_inspection_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  inspection_row public.inspections%rowtype;
  normalized_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  select *
  into inspection_row
  from public.inspections
  where id = p_inspection_id
  for update;

  if not found then
    raise exception 'Tarkastusta ei löytynyt.' using errcode = 'P0002';
  end if;

  if not private.is_operational_manager(inspection_row.organization_id, auth.uid()) then
    raise exception 'Tarkastuksen poistamiseen ei ole oikeutta.' using errcode = '42501';
  end if;

  if inspection_row.deleted_at is not null then
    return;
  end if;

  if inspection_row.status in ('Hyväksytty', 'Mitätöity') then
    raise exception 'Hyväksyttyä tai mitätöityä tarkastusta ei voi poistaa. Käytä mitätöintiä ja säilytä auditointijälki.' using errcode = '22023';
  end if;

  if normalized_reason is null or char_length(normalized_reason) < 3 then
    raise exception 'Poistamisen perustelun on oltava vähintään kolme merkkiä.' using errcode = '22023';
  end if;

  update public.inspections
  set deleted_at = now(),
      deleted_by = auth.uid(),
      deletion_reason = normalized_reason,
      updated_at = now()
  where id = p_inspection_id;
end;
$$;

revoke all on function public.remove_inspection(uuid, text) from public, anon;
grant execute on function public.remove_inspection(uuid, text) to authenticated;

drop policy if exists inspections_hide_deleted on public.inspections;
create policy inspections_hide_deleted
on public.inspections
as restrictive
for select
to authenticated
using (deleted_at is null);

commit;
