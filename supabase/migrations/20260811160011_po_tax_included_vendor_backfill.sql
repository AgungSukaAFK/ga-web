-- ============================================================================
-- Backfill tax_included/ppn_rate PO lama, berdasarkan nama vendor
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor, SETELAH
-- po-tax-included-setup.sql (kolom tax_included/ppn_rate harus sudah ada).
--
-- Aturan (sama seperti auto-detect di form create/edit PO, lihat
-- isMarketplaceVendor di type/enum.ts):
--   * Vendor yang namanya mengandung "Tokopedia"/"Tokped"/"Shopee"/"Shope"
--     (case-insensitive) -> PPN dianggap flat 0% (BUKAN "termasuk" - beneran
--     gak ada PPN, transaksi marketplace). tax jadi 0, tax_included=false,
--     ppn_rate=0.
--   * Vendor lain yang tax-nya MASIH 0 (ambigu, sebelum fitur ini gak ada
--     cara tau apa itu inclusive atau emang 0%) -> anggap harga sudah
--     termasuk PPN 11% (tax_included=true, ppn_rate=11), sesuai instruksi.
--   * PO yang tax-nya SUDAH > 0 (nominal PPN eksklusif beneran pernah
--     dibayar/dicatat) TIDAK disentuh tax_included/tax-nya - itu data
--     finansial asli, bukan ambigu. Cuma ppn_rate-nya di-backfill (dihitung
--     dari tax/subtotal) biar detail/cetak gak perlu nebak dari situ lagi.
--
-- Skrip ini idempotent - PO yang ppn_rate-nya sudah keisi (baik dari fitur
-- baru maupun dari run sebelumnya) dilewati (WHERE ppn_rate IS NULL), aman
-- dijalankan ulang.
-- ============================================================================

-- 1) Vendor marketplace -> PPN 0% flat.
UPDATE public.purchase_orders
SET tax = 0, tax_included = false, ppn_rate = 0
WHERE ppn_rate IS NULL
  AND (
    (vendor_details->>'nama_vendor') ILIKE '%tokopedia%' OR
    (vendor_details->>'nama_vendor') ILIKE '%tokped%' OR
    (vendor_details->>'nama_vendor') ILIKE '%shopee%' OR
    (vendor_details->>'nama_vendor') ILIKE '%shope%'
  );

-- 2) Vendor lain, tax masih 0 (ambigu) -> anggap inclusive PPN 11%.
UPDATE public.purchase_orders
SET tax_included = true, ppn_rate = 11
WHERE ppn_rate IS NULL
  AND tax = 0
  AND NOT (
    (vendor_details->>'nama_vendor') ILIKE '%tokopedia%' OR
    (vendor_details->>'nama_vendor') ILIKE '%tokped%' OR
    (vendor_details->>'nama_vendor') ILIKE '%shopee%' OR
    (vendor_details->>'nama_vendor') ILIKE '%shope%'
  );

-- 3) PO dengan tax > 0 (PPN eksklusif asli) - backfill ppn_rate doang buat
--    ditampilkan, tax_included tetap false (default kolom), tax-nya TIDAK
--    diubah.
WITH item_agg AS (
  SELECT
    po.id,
    SUM((item->>'price')::numeric * (item->>'qty')::numeric) AS subtotal
  FROM public.purchase_orders po,
       jsonb_array_elements(po.items::jsonb) AS item
  WHERE po.ppn_rate IS NULL AND po.tax > 0
  GROUP BY po.id
)
UPDATE public.purchase_orders po
SET ppn_rate = ROUND(
  (po.tax / NULLIF(item_agg.subtotal - COALESCE(po.discount, 0), 0)) * 100
)
FROM item_agg
WHERE po.id = item_agg.id
  AND (item_agg.subtotal - COALESCE(po.discount, 0)) > 0;
