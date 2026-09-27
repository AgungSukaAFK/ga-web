-- ============================================================================
-- Fitur: Nonaktifkan / Aktifkan Cost Center
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor.
--
-- Konsep:
--   * Kolom `is_active` pada tabel `cost_centers` menjadi penanda apakah CC
--     boleh dipilih.
--   * CC dengan is_active = false TIDAK muncul di combobox pemilihan/filter
--     cost center di halaman lain (lihat services/mrService.ts -> fetchActiveCostCenters),
--     namun datanya TETAP ada sehingga MR/PO/Petty Cash lama yang sudah memakai
--     CC tersebut tidak rusak, dan CC bisa diaktifkan kembali sewaktu-waktu.
--   * Halaman Manajemen Cost Center tetap menampilkan SEMUA CC (aktif & nonaktif)
--     agar admin bisa mengaktifkan kembali.
-- ============================================================================

-- 1) Tambah kolom is_active (default aktif, backfill semua CC lama => aktif)
ALTER TABLE public.cost_centers
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 2) Index parsial untuk mempercepat pengambilan CC aktif (dipakai combobox)
CREATE INDEX IF NOT EXISTS idx_cost_centers_is_active
  ON public.cost_centers (is_active);
