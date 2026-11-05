-- 0023_requester_receipt.sql
--
-- Konfirmasi terima barang langsung dari requester (halaman MR & scan QR
-- BAST), walaupun langkah GA/pembayaran di sistem belum jalan - lihat
-- lib/requesterReceipt.ts & confirmRequesterReceipt di services/mrService.ts.
--
-- Satu konfirmasi mengubah `material_requests.orders` DAN `receive_record`/
-- `status` beberapa PO sekaligus. RPC ini menyimpan semuanya dalam SATU
-- transaksi (tidak ada kondisi MR sudah selesai tapi PO gagal tersimpan) dan
-- menolak kalau dokumennya berubah sejak dibaca (DOC_CHANGED) - jadi tidak
-- menimpa GA yang kebetulan submit "Terima Barang" di saat bersamaan.
-- `material_requests` tidak punya updated_at, jadi pembandingnya isi `orders`.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SEBELUM deploy
-- kode fiturnya. Script IDEMPOTENT.

create or replace function public.apply_requester_receipt(
  p_mr_id bigint,
  p_expected_orders jsonb,
  p_orders jsonb,
  p_pos jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_mr public.material_requests%rowtype;
  v_po jsonb;
  v_po_row public.purchase_orders%rowtype;
begin
  if v_actor is null and not v_is_service then
    raise exception 'Not authenticated';
  end if;
  if jsonb_typeof(p_orders) is distinct from 'array' then
    raise exception 'Data item MR tidak valid.';
  end if;

  -- PO dulu, lalu MR (urutan lock sama dengan admin_apply_document_action).
  for v_po in
    select value
    from jsonb_array_elements(coalesce(p_pos, '[]'::jsonb))
    order by (value->>'id')::bigint
  loop
    select * into v_po_row
    from public.purchase_orders
    where id = (v_po->>'id')::bigint
    for update;

    if not found then
      raise exception 'PO % tidak ditemukan.', v_po->>'id';
    end if;
    if v_po_row.mr_id is distinct from p_mr_id then
      raise exception 'PO % bukan milik MR ini.', v_po_row.kode_po;
    end if;
    if v_po_row.status is distinct from v_po->>'expected_status'
       or coalesce(v_po_row.receive_record, 'null'::jsonb)
          is distinct from coalesce(v_po->'expected_receive_record', 'null'::jsonb)
       or v_po_row.closed_remainder is not null then
      raise exception 'DOC_CHANGED: PO % sudah berubah.', v_po_row.kode_po;
    end if;
  end loop;

  select * into v_mr
  from public.material_requests
  where id = p_mr_id
  for update;

  if not found then
    raise exception 'MR tidak ditemukan.';
  end if;
  if not v_is_service and v_mr.userid is distinct from v_actor and not exists (
    select 1 from public.profiles p
    where p.id = v_actor
      and (p.role = 'admin' or p.department in ('General Affair', 'HRGA-HSE'))
  ) then
    raise exception 'Hanya requester MR ini yang boleh mengonfirmasi penerimaan.';
  end if;
  if v_mr.status in ('Rejected', 'Cancelled') then
    raise exception 'MR ini sudah tidak aktif.';
  end if;
  if coalesce(v_mr.orders::jsonb, '[]'::jsonb)
     is distinct from coalesce(p_expected_orders, '[]'::jsonb) then
    raise exception 'DOC_CHANGED: Item MR sudah berubah.';
  end if;

  for v_po in select value from jsonb_array_elements(coalesce(p_pos, '[]'::jsonb))
  loop
    update public.purchase_orders
    set status = v_po->>'status',
        receive_record = nullif(v_po->'receive_record', 'null'::jsonb),
        full_received_at = case
          when v_po ? 'full_received_at'
            then nullif(v_po->>'full_received_at', '')::timestamptz
          else full_received_at
        end
    where id = (v_po->>'id')::bigint;
  end loop;

  update public.material_requests
  set orders = p_orders::json
  where id = p_mr_id;
end;
$$;

revoke all on function public.apply_requester_receipt(bigint, jsonb, jsonb, jsonb)
  from public, anon;
grant execute on function public.apply_requester_receipt(bigint, jsonb, jsonb, jsonb)
  to authenticated, service_role;
