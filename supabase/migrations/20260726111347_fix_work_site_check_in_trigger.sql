-- The geofence trigger must only assign fields that exist on
-- work_site_check_ins. The check-in owner is represented by user_id; this
-- table deliberately has no created_by column.
create or replace function private.prepare_work_site_check_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  site_lat double precision;
  site_lon double precision;
  site_radius double precision;
  earth_radius constant double precision := 6371000;
  lat1 double precision;
  lat2 double precision;
  delta_lat double precision;
  delta_lon double precision;
  a double precision;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  new.user_id := auth.uid();

  if new.project_id is not null then
    select p.site_latitude, p.site_longitude, p.site_radius_m
      into site_lat, site_lon, site_radius
      from public.projects p
     where p.id = new.project_id
       and p.organization_id = new.organization_id;

    if site_lat is not null and site_lon is not null and site_radius is not null then
      lat1 := radians(site_lat);
      lat2 := radians(new.latitude);
      delta_lat := radians(new.latitude - site_lat);
      delta_lon := radians(new.longitude - site_lon);
      a := sin(delta_lat / 2)^2 + cos(lat1) * cos(lat2) * sin(delta_lon / 2)^2;
      new.distance_from_site_m := 2 * earth_radius * asin(least(1, sqrt(a)));
      new.geofence_radius_m := site_radius;
      new.within_geofence := new.distance_from_site_m <= site_radius + greatest(coalesce(new.accuracy_m, 0), 0);
    else
      new.distance_from_site_m := null;
      new.geofence_radius_m := null;
      new.within_geofence := null;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.prepare_work_site_check_in() from public, anon, authenticated;
