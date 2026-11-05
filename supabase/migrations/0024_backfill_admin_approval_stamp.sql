-- 0024_backfill_admin_approval_stamp.sql
--
-- Isi approvals[].processed_by_admin utk approval MR & PO yang sudah telanjur
-- diproses admin sebelum field itu ada, supaya keterangan "Disetujui oleh
-- Admin ..." juga muncul di dokumen lama. Sumbernya activity_logs:
--
--  - ADMIN_OVERRIDE_APPROVAL: form MR/PO Management & Aksi Admin. Dipakai log
--    terakhir tiap step (metadata.changes), jadi step yang sesudahnya
--    dikembalikan ke pending tidak ikut.
--  - UPDATE_PAYMENT_DP_BP: step Payment Validator yang selesai lewat dialog
--    DP/BP oleh admin.
--  - RECEIVE_GOODS: step Receiver yang diselesaikan admin lewat Terima Barang.
--
-- Step hanya ditandai kalau status & waktunya cocok dengan log: processed_at
-- paling lama 1 jam sebelum log (preview Aksi Admin dihitung saat dialog
-- dibuka) dan paling lama 5 menit sesudahnya (jam browser bisa selisih).
-- Dua sumber terakhir memakai jendela +-5 menit dan role admin saat ini.
--
-- Yang TIDAK bisa ditandai: Petty Cash (override-nya tidak pernah masuk
-- activity_logs) dan override lama yang log-nya tidak punya metadata.changes.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SETELAH
-- 0023_requester_receipt.sql. Script IDEMPOTENT: step yang sudah punya
-- processed_by_admin dilewati. Tidak mengubah status dokumen.

begin;

create temporary table tmp_admin_stamp on commit drop as
with steps as (
  select 'material_request' as resource_type, m.id::text as resource_id,
         (s.ord - 1)::int as idx, s.elem
  from public.material_requests m
  cross join lateral jsonb_array_elements(m.approvals) with ordinality s(elem, ord)
  where jsonb_typeof(m.approvals) = 'array'
  union all
  select 'purchase_order', p.id::text, (s.ord - 1)::int, s.elem
  from public.purchase_orders p
  cross join lateral jsonb_array_elements(p.approvals) with ordinality s(elem, ord)
  where jsonb_typeof(p.approvals) = 'array'
),
processed as (
  select resource_type, resource_id, idx, elem,
         (elem->>'processed_at')::timestamptz as processed_at
  from steps
  where elem->>'status' in ('approved', 'rejected')
    and elem->>'processed_at' ~ '^\d{4}-\d{2}-\d{2}'
    and coalesce(jsonb_typeof(elem->'processed_by_admin'), 'null') = 'null'
),
override_logs as (
  select distinct on (l.resource_type, l.resource_id, (c.value->>'index')::int)
         l.resource_type, l.resource_id, (c.value->>'index')::int as idx,
         c.value->>'to' as to_status, l.user_id, l.created_at
  from public.activity_logs l
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(l.metadata->'changes') = 'array'
         then l.metadata->'changes' else '[]'::jsonb end
  ) c
  where l.action_type = 'ADMIN_OVERRIDE_APPROVAL'
    and l.resource_type in ('material_request', 'purchase_order')
  order by l.resource_type, l.resource_id, (c.value->>'index')::int, l.created_at desc
),
matches as (
  select p.resource_type, p.resource_id, p.idx, o.user_id, o.created_at
  from processed p
  join override_logs o using (resource_type, resource_id, idx)
  where o.to_status = p.elem->>'status'
    and o.user_id::text <> p.elem->>'userid'
    and p.processed_at between o.created_at - interval '1 hour'
                           and o.created_at + interval '5 minutes'
  union all
  select p.resource_type, p.resource_id, p.idx, l.user_id, l.created_at
  from processed p
  join public.activity_logs l
    on l.resource_type = p.resource_type
   and l.resource_id = p.resource_id
   and l.action_type = case
         when p.elem->>'type' = 'Receiver' then 'RECEIVE_GOODS'
         when p.elem->>'type' = 'Payment Validator'
           or p.elem->>'userid' = '06122d13-9918-40ac-9034-41e849c5c3e2'
           then 'UPDATE_PAYMENT_DP_BP'
       end
  join public.profiles a on a.id = l.user_id and a.role = 'admin'
  where p.resource_type = 'purchase_order'
    and p.elem->>'status' = 'approved'
    and l.user_id::text <> p.elem->>'userid'
    and p.processed_at between l.created_at - interval '5 minutes'
                           and l.created_at + interval '5 minutes'
)
select distinct on (m.resource_type, m.resource_id, m.idx)
       m.resource_type, m.resource_id, m.idx,
       jsonb_build_object(
         'userid', m.user_id,
         'nama', coalesce(nullif(btrim(pr.nama), ''), pr.email, 'Unknown')
       ) as stamp
from matches m
left join public.profiles pr on pr.id = m.user_id
order by m.resource_type, m.resource_id, m.idx, m.created_at desc;

update public.material_requests t
set approvals = (
  select jsonb_agg(
           case when x.stamp is null then s.elem
                else s.elem || jsonb_build_object('processed_by_admin', x.stamp) end
           order by s.ord)
  from jsonb_array_elements(t.approvals) with ordinality s(elem, ord)
  left join tmp_admin_stamp x
    on x.resource_type = 'material_request'
   and x.resource_id = t.id::text
   and x.idx = s.ord - 1
)
where t.id::text in (
  select resource_id from tmp_admin_stamp where resource_type = 'material_request'
);

update public.purchase_orders t
set approvals = (
  select jsonb_agg(
           case when x.stamp is null then s.elem
                else s.elem || jsonb_build_object('processed_by_admin', x.stamp) end
           order by s.ord)
  from jsonb_array_elements(t.approvals) with ordinality s(elem, ord)
  left join tmp_admin_stamp x
    on x.resource_type = 'purchase_order'
   and x.resource_id = t.id::text
   and x.idx = s.ord - 1
)
where t.id::text in (
  select resource_id from tmp_admin_stamp where resource_type = 'purchase_order'
);

commit;
