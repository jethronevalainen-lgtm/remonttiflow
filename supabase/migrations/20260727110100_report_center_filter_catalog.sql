begin;

create or replace function public.report_center_filter_catalog(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan.' using errcode = '42501';
  end if;
  if not private.has_org_role(p_organization_id, array['admin', 'supervisor']::text[]) then
    raise exception 'Vain työnjohto voi käyttää raporttisuodattimia.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'projectNumber', p.project_number,
        'status', p.status
      ) order by p.name)
      from public.projects p
      where p.organization_id = p_organization_id
        and p.archived_at is null
    ), '[]'::jsonb),
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', om.user_id,
        'name', coalesce(nullif(btrim(pr.full_name), ''), nullif(btrim(pr.email), ''), 'Käyttäjä'),
        'email', pr.email,
        'role', om.role
      ) order by coalesce(pr.full_name, pr.email))
      from public.organization_members om
      left join public.profiles pr on pr.id = om.user_id
      where om.organization_id = p_organization_id
        and om.role in ('admin', 'supervisor', 'worker')
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.report_center_filter_catalog(uuid) from public, anon;
grant execute on function public.report_center_filter_catalog(uuid) to authenticated;

commit;
