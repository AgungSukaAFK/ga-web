-- ============================================================================
-- Fitur: Pemisahan PO Asset vs PO Barang Biasa (Goods)
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor.
--
-- Konsep:
--   * 1 PO tidak boleh mencampur item asset (barang.is_asset = true) dengan
--     item goods biasa - dicegah di level aplikasi saat purchasing menambah
--     item ke PO (lihat purchase-order/create/page.tsx).
--   * Kolom `is_asset` di sini menyimpan status itu di level PO (dihitung
--     dari item-item-nya saat PO dibuat), dipakai untuk filter/tampilan
--     tanpa perlu parsing kode_po.
--   * kode_po PO asset otomatis dapat tambahan segmen "/AST/" (mis.
--     "GMI/PO/AST/VIII/26/HO/1") sebagai penanda visual, dengan nomor urut
--     yang TETAP satu rangkaian dengan PO biasa (bukan counter terpisah).
-- ============================================================================

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS is_asset boolean NOT NULL DEFAULT false;
