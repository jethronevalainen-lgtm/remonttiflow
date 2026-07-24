-- Cover every site receipt foreign key used by joins, deletes and ownership checks.
create index if not exists site_receipts_work_order_id_idx
  on public.site_receipts (work_order_id);

create index if not exists site_receipt_attachments_created_by_idx
  on public.site_receipt_attachments (created_by);
