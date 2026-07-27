begin;

insert into public.customers (
  organization_id,
  name,
  type,
  status,
  notes
)
select
  p.organization_id,
  trim(p.customer),
  'Yritys',
  'Aktiivinen',
  'Luotu automaattisesti legacy-projektin tilaajakytkentää varten.'
from public.projects p
where p.archived_at is null
  and p.customer_id is null
  and nullif(trim(p.customer), '') is not null
  and not exists (
    select 1
    from public.customers c
    where c.organization_id = p.organization_id
      and lower(trim(c.name)) = lower(trim(p.customer))
      and c.archived_at is null
  )
group by p.organization_id, trim(p.customer);

update public.projects p
set customer_id = c.id,
    updated_at = now()
from public.customers c
where p.customer_id is null
  and p.archived_at is null
  and c.organization_id = p.organization_id
  and c.archived_at is null
  and lower(trim(c.name)) = lower(trim(p.customer));

commit;
