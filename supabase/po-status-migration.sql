-- ============================================================================
-- Migrasi data lama: status PO "Pending BAST" / "Pending Payment BP" /
-- "Completed" (dihapus dari kosakata status PO) -> "Pending Receive" /
-- "Full Received" (lihat po-receive-record-setup.sql untuk fitur barunya).
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor, SETELAH menjalankan
-- po-receive-record-setup.sql. Best-effort untuk data lama - PO lama tidak
-- punya checklist qty per item (fitur baru), jadi tidak ada `receive_record`
-- yang bisa direkonstruksi; PO yang di-backfill jadi "Full Received" di sini
-- TIDAK akan punya riwayat receive yang bisa dicetak/diedit sampai receiver
-- mengeditnya manual lewat modal baru.
-- ============================================================================

-- 1) "Completed" (status akhir lama) -> "Full Received" (status akhir baru).
--    Tidak ambigu, sama-sama berarti "sudah beres semua".
UPDATE public.purchase_orders
SET status = 'Full Received'
WHERE status = 'Completed';

-- 2) "Pending BAST" / "Pending Payment BP" -> tergantung apakah GA sudah
--    sempat klik tombol "GA Receive" versi LAMA (sebelum checklist qty ada).
--    Aksi lama itu menaikkan level item MR yang di-cover PO ini ke
--    "Open 5"/"Close" TANPA mengubah status PO - jadi kita deteksi "sudah
--    diterima" dengan mengecek semua item PO ini levelnya sudah di situ.
--    Kalau sudah -> anggap "Full Received" (tidak ada data mismatch dari
--    dulu, satu-satunya asumsi yang masuk akal). Kalau belum -> "Pending
--    Receive" (memang belum pernah diterima sama sekali).
UPDATE public.purchase_orders po
SET status = 'Full Received'
WHERE po.status IN ('Pending BAST', 'Pending Payment BP')
  AND po.mr_id IS NOT NULL
  AND jsonb_array_length(COALESCE(po.items::jsonb, '[]'::jsonb)) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(po.items::jsonb) AS item
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.material_requests mr,
           jsonb_array_elements(mr.orders::jsonb) AS ord
      WHERE mr.id = po.mr_id
        AND ord->>'part_number' = item->>'part_number'
        AND ord->>'level' IN ('Open 5', 'Close')
    )
  );

UPDATE public.purchase_orders
SET status = 'Pending Receive'
WHERE status IN ('Pending BAST', 'Pending Payment BP');
