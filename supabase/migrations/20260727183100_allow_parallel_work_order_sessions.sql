begin;

-- Yhteiselle työmääräykselle voi olla useita tekijöitä. Yhden työntekijän
-- keskeytys tai valmistumismerkintä sulkee aina hänen oman työaikansa, mutta
-- globaali työmääräys pysyy Käynnissä-tilassa niin kauan kuin toisella
-- työntekijällä on aktiivinen istunto.
create or replace function private.transition_my_work_order_impl(
  p_work_order_id uuid,
  p_status text,
  p_worker_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.work_orders%rowtype;
  v_active_session public.work_order_time_sessions%rowtype;
  v_previous_order_id uuid;
  v_employee_id uuid;
  v_other_workers_active boolean := false;
begin
  if v_user_id is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;

  if p_status not in ('Käynnissä', 'Odottaa', 'Valmis') then
    raise exception 'Työmääräyksen tilasiirtymä ei ole sallittu.' using errcode = '23514';
  end if;

  select order_row.*
  into v_order
  from public.work_orders order_row
  where order_row.id = p_work_order_id
  for update;

  if not found then
    raise exception 'Työmääräystä ei löytynyt.' using errcode = '23503';
  end if;

  if not private.can_access_work_order(v_order.id, v_order.organization_id, v_user_id) then
    raise exception 'Työmääräys ei kuulu käyttäjälle.' using errcode = '42501';
  end if;

  if p_status = 'Käynnissä' then
    if v_order.status not in ('Avoin', 'Odottaa', 'Käynnissä') then
      raise exception 'Työtä ei voi käynnistää nykyisestä tilasta.' using errcode = '23514';
    end if;

    select session_row.*
    into v_active_session
    from public.work_order_time_sessions session_row
    where session_row.organization_id = v_order.organization_id
      and session_row.user_id = v_user_id
      and session_row.ended_at is null
    for update;

    -- Tuplapainallus tai verkkopyynnön uusinta on idempotentti.
    if found and v_active_session.work_order_id = v_order.id then
      return;
    end if;

    if found then
      v_previous_order_id := v_active_session.work_order_id;

      perform private.close_work_order_time_session_impl(
        v_order.organization_id,
        v_user_id,
        v_previous_order_id,
        'switched',
        'Työaika päättyi automaattisesti uuden määrätyn työn alkaessa.'
      );

      if not exists (
        select 1
        from public.work_order_time_sessions active_session
        where active_session.work_order_id = v_previous_order_id
          and active_session.ended_at is null
      ) then
        update public.work_orders
        set status = 'Odottaa',
            worker_note = coalesce(
              nullif(worker_note, ''),
              'Työ keskeytyi automaattisesti, kun työntekijä aloitti toisen määrätyn työn.'
            )
        where id = v_previous_order_id
          and status = 'Käynnissä';
      end if;
    end if;

    select employee.id
    into v_employee_id
    from public.employees employee
    where employee.organization_id = v_order.organization_id
      and employee.user_id = v_user_id
    limit 1;

    if v_order.status <> 'Käynnissä' then
      update public.work_orders
      set status = 'Käynnissä',
          worker_note = nullif(btrim(coalesce(p_worker_note, '')), '')
      where id = v_order.id;
    end if;

    insert into public.work_order_time_sessions (
      organization_id,
      work_order_id,
      user_id,
      project_id,
      employee_id
    ) values (
      v_order.organization_id,
      v_order.id,
      v_user_id,
      v_order.project_id,
      v_employee_id
    );

    insert into public.audit_logs (
      organization_id,
      user_id,
      action,
      table_name,
      record_id,
      metadata
    ) values (
      v_order.organization_id,
      v_user_id,
      'work_order_time_started',
      'work_orders',
      v_order.id,
      jsonb_build_object(
        'old_status', v_order.status,
        'new_status', 'Käynnissä',
        'started_at', statement_timestamp(),
        'previous_work_order_id', v_previous_order_id
      )
    );

    return;
  end if;

  if not (
    (v_order.status = 'Käynnissä' and p_status in ('Odottaa', 'Valmis'))
    or (v_order.status = 'Odottaa' and p_status = 'Valmis')
  ) then
    raise exception 'Työmääräyksen tilasiirtymä ei ole sallittu.' using errcode = '23514';
  end if;

  perform private.close_work_order_time_session_impl(
    v_order.organization_id,
    v_user_id,
    v_order.id,
    case when p_status = 'Valmis' then 'completed' else 'paused' end,
    p_worker_note
  );

  select exists (
    select 1
    from public.work_order_time_sessions active_session
    where active_session.work_order_id = v_order.id
      and active_session.ended_at is null
  ) into v_other_workers_active;

  if v_other_workers_active then
    insert into public.audit_logs (
      organization_id,
      user_id,
      action,
      table_name,
      record_id,
      metadata
    ) values (
      v_order.organization_id,
      v_user_id,
      'work_order_worker_time_ended',
      'work_orders',
      v_order.id,
      jsonb_build_object(
        'old_status', v_order.status,
        'requested_status', p_status,
        'effective_status', 'Käynnissä',
        'worker_note', nullif(btrim(coalesce(p_worker_note, '')), ''),
        'other_workers_active', true
      )
    );
    return;
  end if;

  update public.work_orders
  set status = p_status,
      worker_note = nullif(btrim(coalesce(p_worker_note, '')), '')
  where id = v_order.id;

  insert into public.audit_logs (
    organization_id,
    user_id,
    action,
    table_name,
    record_id,
    metadata
  ) values (
    v_order.organization_id,
    v_user_id,
    'work_order_status_changed',
    'work_orders',
    v_order.id,
    jsonb_build_object(
      'old_status', v_order.status,
      'new_status', p_status,
      'worker_note', nullif(btrim(coalesce(p_worker_note, '')), ''),
      'time_closed_automatically', true
    )
  );
end;
$$;

revoke all on function private.transition_my_work_order_impl(uuid, text, text)
from public, anon;
grant execute on function private.transition_my_work_order_impl(uuid, text, text)
to authenticated, service_role;

commit;
