begin;

create or replace function private.guard_change_order_line_draft()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_id uuid := case when tg_op = 'DELETE' then old.change_order_id else new.change_order_id end;
  v_status text;
begin
  select status into v_status from public.change_orders where id = v_id;

  if not found and tg_op = 'DELETE' then
    return old;
  end if;

  if v_status is distinct from 'Luonnos' then
    raise exception 'Muutostyön rivejä voi muokata vain luonnoksessa.' using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

commit;
