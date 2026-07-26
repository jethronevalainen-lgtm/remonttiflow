alter table public.safety_items drop constraint if exists safety_items_type_check;
alter table public.safety_items add constraint safety_items_type_check check (
  type = any (array['observation','near_miss','incident','inspection','action','risk','training']::text[])
);

alter table public.safety_items drop constraint if exists safety_items_status_check;
alter table public.safety_items add constraint safety_items_status_check check (
  status = any (array['Ilmoitettu','Avoin','Arvioitu','Osoitettu','Käsittelyssä','Korjattavana','Ilmoitettu korjatuksi','Korjattu','Vahvistettu','Suljettu']::text[])
);
