create or replace function public.approve_inspection(
  p_inspection_id uuid,
  p_summary text
)
returns integer
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
declare
  inspection_row public.inspections%rowtype;
  required_open integer;
  blocking_findings integer;
  handwritten_signatures integer;
  handover_photos integer;
  next_version integer;
  report_snapshot jsonb;
begin
  select * into inspection_row
  from public.inspections
  where id = p_inspection_id
  for update;
  if not found then
    raise exception 'Tarkastusta ei löytynyt.' using errcode = 'P0002';
  end if;
  if not private.has_org_role(inspection_row.organization_id, array['admin','supervisor']) then
    raise exception 'Vain työnjohto voi hyväksyä tarkastuksen.' using errcode = '42501';
  end if;
  if inspection_row.status in ('Hyväksytty','Mitätöity') then
    raise exception 'Tarkastus on jo lukittu.' using errcode = '23514';
  end if;

  select count(*) into required_open
  from public.inspection_results result
  join public.inspection_template_items item on item.id = result.item_id
  where result.inspection_id = p_inspection_id
    and item.required
    and result.status in ('Tarkastamatta','Tarkastettava myöhemmin','Ei voitu tarkastaa');

  select count(*) into blocking_findings
  from public.inspection_findings
  where inspection_id = p_inspection_id
    and severity in ('Korjattava ennen luovutusta','Merkittävä','Kriittinen')
    and status not in ('Hyväksytty','Mitätöity');

  select count(*) into handwritten_signatures
  from public.inspection_signatures
  where inspection_id = p_inspection_id
    and signature_type = 'Käsin allekirjoitettu'
    and nullif(btrim(coalesce(signature_data, '')), '') is not null;

  select count(*) into handover_photos
  from public.inspection_attachments
  where inspection_id = p_inspection_id
    and result_id is null
    and finding_id is null
    and kind in ('Luovutuskuva', 'Yleiskuva')
    and coalesce(mime_type, '') like 'image/%';

  if required_open > 0 then
    raise exception 'Kaikkia pakollisia tarkastuskohtia ei ole käsitelty.'
      using errcode = '23514';
  end if;
  if blocking_findings > 0 then
    raise exception 'Avoimet luovutuksen estävät puutteet on käsiteltävä ennen hyväksyntää.'
      using errcode = '23514';
  end if;
  if handwritten_signatures = 0 then
    raise exception 'Tarkastus on allekirjoitettava käsin ennen hyväksyntää.'
      using errcode = '23514';
  end if;
  if handover_photos = 0 then
    raise exception 'Lisää vähintään yksi luovutus- tai yleiskuva ennen hyväksyntää.'
      using errcode = '23514';
  end if;

  next_version := inspection_row.report_version + 1;

  update public.inspections
  set status = 'Hyväksytty',
      progress = 100,
      summary = nullif(btrim(coalesce(p_summary,'')), ''),
      completed_at = coalesce(completed_at, now()),
      approved_at = now(),
      approved_by = auth.uid(),
      report_version = next_version,
      updated_at = now()
  where id = p_inspection_id;

  select jsonb_build_object(
    'inspection', to_jsonb(inspection),
    'project', to_jsonb(project),
    'unit', to_jsonb(unit_row),
    'template', jsonb_build_object(
      'name', template.name,
      'category', template.category,
      'version', version.version
    ),
    'results', coalesce((
      select jsonb_agg(
        to_jsonb(result)
        || jsonb_build_object(
          'item_title', item.title,
          'item_guidance', item.guidance,
          'section_title', section.title,
          'section_order', section.sort_order,
          'item_order', item.sort_order
        )
        order by section.sort_order, item.sort_order
      )
      from public.inspection_results result
      join public.inspection_template_items item on item.id = result.item_id
      join public.inspection_template_sections section on section.id = item.section_id
      where result.inspection_id = inspection.id
    ), '[]'::jsonb),
    'findings', coalesce((
      select jsonb_agg(to_jsonb(finding) order by finding.created_at)
      from public.inspection_findings finding
      where finding.inspection_id = inspection.id
    ), '[]'::jsonb),
    'signatures', coalesce((
      select jsonb_agg(to_jsonb(signature) order by signature.signed_at)
      from public.inspection_signatures signature
      where signature.inspection_id = inspection.id
    ), '[]'::jsonb),
    'attachments', coalesce((
      select jsonb_agg(to_jsonb(attachment) order by attachment.created_at)
      from public.inspection_attachments attachment
      where attachment.inspection_id = inspection.id
         or attachment.finding_id in (
           select id from public.inspection_findings where inspection_id = inspection.id
         )
    ), '[]'::jsonb)
  )
  into report_snapshot
  from public.inspections inspection
  join public.projects project on project.id = inspection.project_id
  left join public.project_units unit_row on unit_row.id = inspection.unit_id
  join public.inspection_template_versions version on version.id = inspection.template_version_id
  join public.inspection_templates template on template.id = version.template_id
  where inspection.id = p_inspection_id;

  insert into public.inspection_reports (
    organization_id, inspection_id, version, snapshot, generated_by
  ) values (
    inspection_row.organization_id, p_inspection_id, next_version,
    report_snapshot, auth.uid()
  );

  if inspection_row.unit_id is not null then
    update public.project_units
    set status = 'Luovutuskelpoinen',
        actual_completion_date = coalesce(actual_completion_date, current_date),
        updated_at = now()
    where id = inspection_row.unit_id;
  end if;

  return next_version;
end;
$function$;

revoke all on function public.approve_inspection(uuid, text) from public, anon;
grant execute on function public.approve_inspection(uuid, text) to authenticated;
