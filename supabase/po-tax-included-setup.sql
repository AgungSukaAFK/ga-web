-- ============================================================================
-- Fitur: Info PPN saat harga item PO sudah termasuk pajak (tax-inclusive)
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor.
--
-- Latar belakang: form create/edit PO sudah lama punya checkbox "Harga Item
-- Sudah Termasuk PPN?", tapi flag-nya cuma state lokal di form - gak pernah
-- disimpan ke DB. Kalau dicentang, `tax` cuma di-nol-in, jadi PO yang
-- harganya sudah termasuk PPN keliatan identik di DB dengan PO yang PPN-nya
-- 0% - detail page & cetak PDF cuma bisa nebak-nebak dari situ.
--
-- Kolom baru:
--   * tax_included: true kalau harga item di PO ini sudah termasuk PPN.
--     `tax` TETAP 0 saat true (gak ada nominal tambahan ke total - PPN-nya
--     udah nempel di harga item), cuma dipakai UI buat nampilin info PPN
--     (lihat ppn_rate) tanpa mengubah harga/total.
--   * ppn_rate: persentase PPN yang dipakai (mis. 11) - baik pas
--     tax_included true (buat hitung info PPN = subtotal x ppn_rate%)
--     maupun false (tau tarif yang dipakai ngitung `tax`, gak perlu ditebak
--     dari tax/dpp lagi). Null utk PO lama sebelum kolom ini ada, atau saat
--     admin pakai mode input manual (bukan persentase).
--
-- PO lama (dibuat sebelum fitur ini) tetap tax_included=false secara
-- default - kalau dulu PO itu sebenarnya tax-inclusive, ambiguitasnya
-- (sama seperti dulu) baru hilang begitu PO-nya diedit ulang & checkbox-nya
-- dicentang ulang.
-- ============================================================================

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS tax_included boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ppn_rate numeric NULL;
