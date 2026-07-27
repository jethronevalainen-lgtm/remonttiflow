begin;

create or replace function public.delete_work_orders_bulk(
  p_organization_id uuid,
  p_work_order_ids uuid[]
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_requested_count integer;
  v_found_count integer;
  v_deleted_count integer;
  v_active_titles text;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  if p_organization_id is null then
    raise exception 'Organisaatio puuttuu.' using errcode = '23502';
  end if;

  if not private.has_org_role(p_organization_id, array['admin', 'supervisor']) then
    raise exception 'Vain työnjohtaja tai pääkäyttäjä voi poistaa työmääräyksiä.' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct candidate.id), '{}'::uuid[])
    into v_ids
    from unnest(coalesce(p_work_order_ids, '{}'::uuid[])) as candidate(id)
   where candidate.id is not null;

  v_requested_count := cardinality(v_ids);

  if v_requested_count = 0 then
    raise exception 'Valitse vähintään yksi poistettava työmääräys.' using errcode = '22023';
  end if;

  if v_requested_count > 200 then
    raise exception 'Kerralla voi poistaa enintään 200 työmääräystä.' using errcode = '22023';
  end if;

  perform 1
    from public.work_orders work_order
   where work_order.organization_id = p_organization_id
     and work_order.id = any(v_ids)
   for update;

  select count(*)
    into v_found_count
    from public.work_orders work_order
   where work_order.organization_id = p_organization_id
     and work_order.id = any(v_ids);

  if v_found_count <> v_requested_count then
    raise exception 'Osa valituista työmääräyksistä puuttuu tai kuuluu toiseen organisaatioon.' using errcode = '42501';
  end if;

  select string_agg(work_order.title, ', ' order by work_order.title)
    into v_active_titles
    from public.work_orders work_order
   where work_order.organization_id = p_organization_id
     and work_order.id = any(v_ids)
     and exists (
       select 1
         from public.work_order_time_sessions time_session
        where time_session.work_order_id = work_order.id
          and time_session.ended_at is null
     );

  if v_active_titles is not null then
    raise exception 'Päätä aktiivinen työaika ennen poistamista: %', v_active_titles using errcode = '23514';
  end if;

  insert into public.audit_logs (
    organization_id,
    user_id,
    action,
    table_name,
    record_id,
    metadata
  )
  select
    work_order.organization_id,
    auth.uid(),
    'work_order_deleted_bulk',
    'work_orders',
    work_order.id,
    jsonb_build_object(
      'title', work_order.title,
      'status', work_order.status,
      'project_id', work_order.project_id,
      'deleted_in_batch_size', v_requested_count
    )
  from public.work_orders work_order
  where work_order.organization_id = p_organization_id
    and work_order.id = any(v_ids);

  delete from public.work_orders work_order
   where work_order.organization_id = p_organization_id
     and work_order.id = any(v_ids);

  get diagnostics v_deleted_count = row_count;

  if v_deleted_count <> v_requested_count then
    raise exception 'Kaikkia valittuja työmääräyksiä ei voitu poistaa.' using errcode = 'P0001';
  end if;

  return v_deleted_count;
end;
$$;

revoke all on function public.delete_work_orders_bulk(uuid, uuid[]) from public, anon;
grant execute on function public.delete_work_orders_bulk(uuid, uuid[]) to authenticated;

comment on function public.delete_work_orders_bulk(uuid, uuid[]) is
  'Poistaa 1–200 työmääräystä atomisesti. Sallittu vain admin- ja supervisor-rooleille. Aktiivista työaikaa sisältävä erä hylätään kokonaan.';

commit;
