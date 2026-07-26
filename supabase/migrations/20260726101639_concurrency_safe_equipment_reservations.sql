begin;

create extension if not exists btree_gist with schema extensions;

-- The previous BEFORE trigger used a visibility-dependent EXISTS query and
-- could allow two concurrent transactions to double-book the same equipment.
drop trigger if exists prevent_equipment_reservation_overlap on public.equipment_reservations;
drop function if exists private.prevent_equipment_reservation_overlap();

alter table public.equipment_reservations
  drop constraint if exists equipment_reservations_no_overlap;

alter table public.equipment_reservations
  add constraint equipment_reservations_no_overlap
  exclude using gist (
    organization_id with =,
    equipment_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status <> 'Peruttu');

commit;
