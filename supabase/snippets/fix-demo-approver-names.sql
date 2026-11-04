-- ============================================================================
-- Koreksi data demo: `approvals[].nama` di MR & PO berisi email, karena dibuat
-- oleh versi lama seed-demo-bulk.mjs. Diganti nama dari `profiles`.
--
-- Khusus database dev/demo - cuma menyentuh approver @demo.com, jadi tidak
-- mengubah apa pun di production. Aman dijalankan ulang.
-- ============================================================================

update public.material_requests m
set approvals = (
  select jsonb_agg(
    case
      when a ->> 'nama' like '%@demo.com' and nullif(btrim(p.nama), '') is not null
        then jsonb_set(a, '{nama}', to_jsonb(p.nama))
      else a
    end
    order by t.ord
  )
  from jsonb_array_elements(m.approvals) with ordinality as t(a, ord)
  left join public.profiles p on p.id::text = a ->> 'userid'
)
where jsonb_typeof(m.approvals) = 'array'
  and jsonb_array_length(m.approvals) > 0
  and exists (
    select 1 from jsonb_array_elements(m.approvals) as x(a)
    where a ->> 'nama' like '%@demo.com'
  );

update public.purchase_orders po
set approvals = (
  select jsonb_agg(
    case
      when a ->> 'nama' like '%@demo.com' and nullif(btrim(p.nama), '') is not null
        then jsonb_set(a, '{nama}', to_jsonb(p.nama))
      else a
    end
    order by t.ord
  )
  from jsonb_array_elements(po.approvals) with ordinality as t(a, ord)
  left join public.profiles p on p.id::text = a ->> 'userid'
)
where jsonb_typeof(po.approvals) = 'array'
  and jsonb_array_length(po.approvals) > 0
  and exists (
    select 1 from jsonb_array_elements(po.approvals) as x(a)
    where a ->> 'nama' like '%@demo.com'
  );
