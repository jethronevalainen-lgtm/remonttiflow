begin;

drop index if exists public.offers_organization_offer_number_uidx;

create index if not exists offer_events_created_by_idx
  on public.offer_events (created_by);
create index if not exists offer_events_offer_org_idx
  on public.offer_events (offer_id, organization_id);
create index if not exists offer_events_organization_id_idx
  on public.offer_events (organization_id);
create index if not exists offer_events_version_org_idx
  on public.offer_events (offer_version_id, organization_id);

create index if not exists offer_lines_catalog_org_idx
  on public.offer_lines (source_catalog_item_id, organization_id);
create index if not exists offer_lines_section_org_idx
  on public.offer_lines (section_id, organization_id);
create index if not exists offer_lines_takeoff_org_idx
  on public.offer_lines (source_takeoff_line_id, organization_id);

create index if not exists offer_sections_created_by_idx
  on public.offer_sections (created_by);
create index if not exists offer_sections_organization_id_idx
  on public.offer_sections (organization_id);
create index if not exists offer_sections_version_org_idx
  on public.offer_sections (offer_version_id, organization_id);

create index if not exists offers_accepted_version_org_idx
  on public.offers (accepted_version_id, organization_id);

create index if not exists price_catalog_items_created_by_idx
  on public.price_catalog_items (created_by);

commit;
