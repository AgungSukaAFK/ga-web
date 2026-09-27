-- ============================================================================
-- Fitur: Klasifikasi Vendor (HO / Branch / Site)
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor.
--
-- Konsep:
--   * Kolom `tipe_vendor` pada tabel `vendors` menandai cakupan vendor:
--     'HO' (Head Office), 'Branch' (Cabang), atau 'Site' (Lokasi Proyek).
--   * Nullable & tanpa default - vendor lama yang belum diklasifikasi akan
--     tampil "-" di UI sampai admin mengisinya lewat form Edit Vendor.
-- ============================================================================

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS tipe_vendor text;

ALTER TABLE public.vendors
  DROP CONSTRAINT IF EXISTS vendors_tipe_vendor_check;

ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_tipe_vendor_check
  CHECK (tipe_vendor IS NULL OR tipe_vendor IN ('HO', 'Branch', 'Site'));

CREATE INDEX IF NOT EXISTS idx_vendors_tipe_vendor
  ON public.vendors (tipe_vendor);
