-- ============================================================================
-- Migrasi data lama: status MR "Pending BAST" / "Completed" (dihapus dari
-- kosakata status MR, disamakan dengan penamaan status PO) -> "Pending
-- Receive" / "Partial Receive" / "Full Received" (lihat recalculateMrStatus
-- di services/mrService.ts untuk logic barunya).
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor, SETELAH deploy perubahan
-- kode terkait. Status "Pending BAST" SEBAGAI STATUS ITEM (per barang di
-- dalam MR, field orders[].status) TIDAK berubah/tidak disentuh skrip ini -
-- yang diganti cuma status MR (material_requests.status).
--
-- Status baru dihitung ulang dari agregat item di `orders` (sama seperti
-- recalculateMrStatus), bukan sekadar rename 1:1, karena "Pending BAST" lama
-- bisa saja sekarang sudah "Partial Receive" atau "Full Received" kalau ada
-- item yang sempat di-BAST setelah status MR terakhir dihitung.
-- ============================================================================

WITH item_agg AS (
  SELECT
    mr.id,
    bool_and(ord->>'status' = 'Completed') AS all_completed,
    bool_or(ord->>'status' = 'Completed') AS some_completed,
    bool_and(
      ord->>'status' IN ('Pending BAST', 'Completed')
      OR ord->>'level' IN ('Open 3A', 'Open 3B', 'Open 4', 'Open 5', 'Close')
    ) AS all_linked
  FROM public.material_requests mr,
       jsonb_array_elements(COALESCE(mr.orders::jsonb, '[]'::jsonb)) AS ord
  WHERE mr.status IN ('Pending BAST', 'Completed')
    AND ord->>'status' IS DISTINCT FROM 'Cancelled'
  GROUP BY mr.id
)
UPDATE public.material_requests mr
SET status = CASE
  WHEN item_agg.all_completed THEN 'Full Received'
  WHEN item_agg.all_linked AND item_agg.some_completed THEN 'Partial Receive'
  WHEN item_agg.all_linked THEN 'Pending Receive'
  ELSE 'On Process'
END
FROM item_agg
WHERE mr.id = item_agg.id
  AND mr.status <> CASE
    WHEN item_agg.all_completed THEN 'Full Received'
    WHEN item_agg.all_linked AND item_agg.some_completed THEN 'Partial Receive'
    WHEN item_agg.all_linked THEN 'Pending Receive'
    ELSE 'On Process'
  END;
