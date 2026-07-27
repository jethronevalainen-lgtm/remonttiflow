begin;

alter table public.travel_expenses
  add column if not exists journey_started_at timestamptz,
  add column if not exists journey_ended_at timestamptz,
  add column if not exists distance_km numeric(10,2),
  add column if not exists mileage_cents bigint,
  add column if not exists daily_allowance_cents bigint,
  add column if not exists free_meal_count integer,
  add column if not exists eligibility_confirmed boolean not null default false,
  add column if not exists calculation_snapshot jsonb;

alter table public.travel_expenses
  drop constraint if exists travel_expenses_journey_times_check;
alter table public.travel_expenses
  add constraint travel_expenses_journey_times_check
  check (journey_ended_at is null or journey_started_at is null or journey_ended_at > journey_started_at);
alter table public.travel_expenses
  drop constraint if exists travel_expenses_distance_km_check;
alter table public.travel_expenses
  add constraint travel_expenses_distance_km_check
  check (distance_km is null or distance_km >= 0);
alter table public.travel_expenses
  drop constraint if exists travel_expenses_mileage_cents_check;
alter table public.travel_expenses
  add constraint travel_expenses_mileage_cents_check
  check (mileage_cents is null or mileage_cents >= 0);
alter table public.travel_expenses
  drop constraint if exists travel_expenses_daily_allowance_cents_check;
alter table public.travel_expenses
  add constraint travel_expenses_daily_allowance_cents_check
  check (daily_allowance_cents is null or daily_allowance_cents >= 0);
alter table public.travel_expenses
  drop constraint if exists travel_expenses_free_meal_count_check;
alter table public.travel_expenses
  add constraint travel_expenses_free_meal_count_check
  check (free_meal_count is null or free_meal_count between 0 and 100);

create or replace function private.calculate_domestic_travel_allowance_impl(
  p_organization_id uuid,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_distance_km numeric default 0,
  p_use_own_car boolean default true,
  p_free_meal_count integer default 0,
  p_eligibility_confirmed boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  rules public.organization_time_rules;
  duration_minutes bigint;
  full_days integer;
  remaining_minutes integer;
  mileage bigint := 0;
  per_diem bigint := 0;
  allowance_units integer := 0;
  allowance_type text := 'none';
  requires_manual_review boolean := false;
  warnings jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not private.is_org_member(p_organization_id) then
    raise exception 'Organisaatiojäsenyys vaaditaan.' using errcode='42501';
  end if;
  if p_started_at is null or p_ended_at is null or p_ended_at <= p_started_at then
    raise exception 'Matkan alku- ja päättymisaika ovat virheelliset.' using errcode='23514';
  end if;
  if coalesce(p_distance_km,0) < 0 then
    raise exception 'Kilometrimäärä ei voi olla negatiivinen.' using errcode='23514';
  end if;
  if coalesce(p_free_meal_count,0) < 0 then
    raise exception 'Ilmaisten aterioiden määrä ei voi olla negatiivinen.' using errcode='23514';
  end if;

  select * into rules from public.organization_time_rules where organization_id=p_organization_id;
  if rules.organization_id is null then
    raise exception 'Organisaation matkakorvaussäännöt puuttuvat.' using errcode='23514';
  end if;
  if (p_started_at at time zone coalesce(rules.timezone,'Europe/Helsinki'))::date < rules.expense_rates_valid_from then
    warnings := warnings || jsonb_build_array('Matka on ennen organisaation matkakorvaushintojen voimassaoloa.');
    requires_manual_review := true;
  end if;
  if not p_eligibility_confirmed then
    warnings := warnings || jsonb_build_array('Työmatkan verovapauden etäisyys- ja tilapäisyysedellytyksiä ei ole vahvistettu.');
    requires_manual_review := true;
  end if;

  duration_minutes := floor(extract(epoch from (p_ended_at-p_started_at))/60)::bigint;
  if p_use_own_car then
    mileage := round(coalesce(p_distance_km,0)*rules.kilometer_allowance_cents_per_km)::bigint;
  end if;

  if duration_minutes <= 360 then
    per_diem := 0;
    allowance_type := 'none';
  elsif duration_minutes <= 600 then
    per_diem := rules.partial_daily_allowance_cents;
    allowance_units := 1;
    allowance_type := 'partial';
  elsif duration_minutes <= 1440 then
    per_diem := rules.full_daily_allowance_cents;
    allowance_units := 1;
    allowance_type := 'full';
  else
    full_days := floor(duration_minutes/1440)::integer;
    remaining_minutes := (duration_minutes % 1440)::integer;
    per_diem := full_days*rules.full_daily_allowance_cents;
    allowance_units := full_days;
    allowance_type := 'multi_day';
    if remaining_minutes >= 120 and remaining_minutes <= 360 then
      per_diem := per_diem+rules.partial_daily_allowance_cents;
      allowance_units := allowance_units+1;
    elsif remaining_minutes > 360 then
      per_diem := per_diem+rules.full_daily_allowance_cents;
      allowance_units := allowance_units+1;
    end if;
    if p_free_meal_count > 0 then
      warnings := warnings || jsonb_build_array('Yli vuorokauden matkan ilmaiset ateriat on kohdistettava matkavuorokausittain ennen hyväksyntää.');
      requires_manual_review := true;
    end if;
  end if;

  if duration_minutes <= 600 and per_diem > 0 and p_free_meal_count >= 1 then
    per_diem := round(per_diem/2.0)::bigint;
  elsif duration_minutes > 600 and duration_minutes <= 1440 and per_diem > 0 and p_free_meal_count >= 2 then
    per_diem := round(per_diem/2.0)::bigint;
  end if;

  return jsonb_build_object(
    'durationMinutes',duration_minutes,
    'distanceKm',round(coalesce(p_distance_km,0),2),
    'useOwnCar',p_use_own_car,
    'mileageRateCentsPerKm',rules.kilometer_allowance_cents_per_km,
    'mileageCents',mileage,
    'partialDailyAllowanceCents',rules.partial_daily_allowance_cents,
    'fullDailyAllowanceCents',rules.full_daily_allowance_cents,
    'dailyAllowanceCents',per_diem,
    'allowanceUnits',allowance_units,
    'allowanceType',allowance_type,
    'freeMealCount',coalesce(p_free_meal_count,0),
    'totalCents',mileage+per_diem,
    'eligibilityConfirmed',p_eligibility_confirmed,
    'requiresManualReview',requires_manual_review,
    'warnings',warnings,
    'ratesValidFrom',rules.expense_rates_valid_from,
    'timezone',rules.timezone
  );
end;
$$;

create or replace function public.calculate_domestic_travel_allowance(
  p_organization_id uuid,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_distance_km numeric default 0,
  p_use_own_car boolean default true,
  p_free_meal_count integer default 0,
  p_eligibility_confirmed boolean default false
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$ select private.calculate_domestic_travel_allowance_impl($1,$2,$3,$4,$5,$6,$7) $$;

create or replace function private.create_calculated_travel_expense_impl(
  p_organization_id uuid,
  p_project_id uuid,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_distance_km numeric default 0,
  p_use_own_car boolean default true,
  p_free_meal_count integer default 0,
  p_eligibility_confirmed boolean default false,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  calculation jsonb;
  result_id uuid;
  employee_id_value uuid;
  employee_name text;
  timezone_value text;
  total_cents bigint;
begin
  if auth.uid() is null or not private.is_org_member(p_organization_id) then
    raise exception 'Organisaatiojäsenyys vaaditaan.' using errcode='42501';
  end if;
  if p_project_id is not null and not private.can_access_project(p_project_id,p_organization_id,auth.uid()) then
    raise exception 'Projektin käyttöoikeus puuttuu.' using errcode='42501';
  end if;
  calculation := private.calculate_domestic_travel_allowance_impl(
    p_organization_id,p_started_at,p_ended_at,p_distance_km,p_use_own_car,p_free_meal_count,p_eligibility_confirmed
  );
  if not p_eligibility_confirmed then
    raise exception 'Vahvista, että kyseessä on korvaukseen oikeuttava työmatka.' using errcode='23514';
  end if;
  total_cents := (calculation->>'totalCents')::bigint;
  if total_cents <= 0 then
    raise exception 'Laskettu korvaus on 0 euroa. Tarkista matkan tiedot.' using errcode='23514';
  end if;

  select e.id,e.name into employee_id_value,employee_name
  from public.employees e
  where e.organization_id=p_organization_id and e.user_id=auth.uid() and e.archived_at is null
  order by e.created_at desc limit 1;
  employee_name := coalesce(employee_name,auth.jwt()->>'email','Käyttäjä');
  select coalesce(r.timezone,'Europe/Helsinki') into timezone_value
  from public.organization_time_rules r where r.organization_id=p_organization_id;

  insert into public.travel_expenses(
    organization_id,created_by,user_id,employee_id,date,employee,project_id,type,description,amount,status,
    journey_started_at,journey_ended_at,distance_km,mileage_cents,daily_allowance_cents,free_meal_count,
    eligibility_confirmed,calculation_snapshot
  ) values (
    p_organization_id,auth.uid(),auth.uid(),employee_id_value,
    (p_started_at at time zone coalesce(timezone_value,'Europe/Helsinki'))::date,employee_name,p_project_id,
    'Automaattinen matkalasku',coalesce(nullif(btrim(coalesce(p_description,'')),''),'Kilometrikorvaus ja kotimaan päiväraha'),
    total_cents/100.0,'Odottaa',p_started_at,p_ended_at,p_distance_km,
    (calculation->>'mileageCents')::bigint,(calculation->>'dailyAllowanceCents')::bigint,
    p_free_meal_count,true,calculation
  ) returning id into result_id;

  insert into public.audit_logs(organization_id,user_id,action,table_name,record_id,metadata)
  values(p_organization_id,auth.uid(),'calculated_travel_expense_created','travel_expenses',result_id,
    jsonb_build_object('requires_manual_review',(calculation->>'requiresManualReview')::boolean,
      'has_mileage',(calculation->>'mileageCents')::bigint>0,'has_daily_allowance',(calculation->>'dailyAllowanceCents')::bigint>0));
  return result_id;
end;
$$;

create or replace function public.create_calculated_travel_expense(
  p_organization_id uuid,
  p_project_id uuid,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_distance_km numeric default 0,
  p_use_own_car boolean default true,
  p_free_meal_count integer default 0,
  p_eligibility_confirmed boolean default false,
  p_description text default null
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public
as $$ select private.create_calculated_travel_expense_impl($1,$2,$3,$4,$5,$6,$7,$8,$9) $$;

revoke all on function private.calculate_domestic_travel_allowance_impl(uuid,timestamptz,timestamptz,numeric,boolean,integer,boolean) from public,anon;
revoke all on function private.create_calculated_travel_expense_impl(uuid,uuid,timestamptz,timestamptz,numeric,boolean,integer,boolean,text) from public,anon;
grant execute on function private.calculate_domestic_travel_allowance_impl(uuid,timestamptz,timestamptz,numeric,boolean,integer,boolean) to authenticated;
grant execute on function private.create_calculated_travel_expense_impl(uuid,uuid,timestamptz,timestamptz,numeric,boolean,integer,boolean,text) to authenticated;

revoke all on function public.calculate_domestic_travel_allowance(uuid,timestamptz,timestamptz,numeric,boolean,integer,boolean) from public,anon;
revoke all on function public.create_calculated_travel_expense(uuid,uuid,timestamptz,timestamptz,numeric,boolean,integer,boolean,text) from public,anon;
grant execute on function public.calculate_domestic_travel_allowance(uuid,timestamptz,timestamptz,numeric,boolean,integer,boolean) to authenticated;
grant execute on function public.create_calculated_travel_expense(uuid,uuid,timestamptz,timestamptz,numeric,boolean,integer,boolean,text) to authenticated;

commit;
