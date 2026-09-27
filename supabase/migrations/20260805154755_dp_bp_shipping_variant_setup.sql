-- ============================================================================
-- Fitur: Varian Pengiriman DP & BP + Level Fisik per Item MR
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor.
--
-- Konsep:
--   * PO dengan payment_term "DP & Pelunasan" sekarang punya 2 varian:
--     - "ship_after_dp": barang dikirim begitu DP dibayar, Pelunasan (BP)
--       menyusul belakangan. Approval Payment Validator selesai begitu DP
--       lunas; PO masuk status "Pending Payment BP" (bukan langsung
--       "Pending BAST"), dan baru pindah ke "Pending BAST" setelah BP lunas.
--     - "ship_after_full_payment": barang baru dikirim setelah DP+BP lunas
--       semua (perilaku lama, tidak berubah).
--   * Level per item MR (Open 1/2/3A/3B/4/5/Close) disimpan di kolom `orders`
--     (JSONB) milik material_requests, sama seperti `status` per item - tidak
--     perlu migration terpisah untuk itu.
-- ============================================================================

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS dp_bp_shipping_type text;

-- material_requests.level punya CHECK constraint (chk_level) yang cuma izinin
-- nilai granular lama ('OPEN 1'..'OPEN 5','CLOSE 1'..'CLOSE 3'). MR.level
-- sekarang jadi agregat sederhana ('OPEN'/'CLOSE') dari level item-itemnya
-- (lihat recalculateMrLevel di mrService.ts), jadi constraint-nya perlu
-- ditambah izinin 2 nilai baru itu juga (nilai lama tetap diizinkan biar
-- data lama & dropdown override manual admin tetap valid).
ALTER TABLE public.material_requests DROP CONSTRAINT IF EXISTS chk_level;
ALTER TABLE public.material_requests ADD CONSTRAINT chk_level CHECK (
  level = ANY (ARRAY[
    'OPEN 1', 'OPEN 2', 'OPEN 3A', 'OPEN 3B', 'OPEN 4', 'OPEN 5',
    'CLOSE 1', 'CLOSE 2A', 'CLOSE 2B', 'CLOSE 3',
    'OPEN', 'CLOSE'
  ])
);
