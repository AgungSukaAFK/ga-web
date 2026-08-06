-- ============================================================================
-- Fitur: Checklist Penerimaan Barang (Receiver) + status Full/Partial Receive
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor.
--
-- Konsep:
--   * `receive_record` menyimpan SATU checklist qty-per-item terakhir yang
--     disubmit Receiver (baik lewat step approval "Receiver" maupun tombol
--     GA Receive manual - keduanya pakai modal & fungsi yang sama, lihat
--     submitReceiveRecord di services/purchaseOrderService.ts). Record ini
--     DITIMPA setiap kali receiver mengedit ulang (bukan log bertumpuk).
--   * Kalau qty diterima semua item persis sama dengan qty PO, PO jadi
--     "Full Received". Kalau ada yang kurang/tidak datang sama sekali,
--     PO jadi "Partial Receive" sampai receiver mengedit checklist-nya
--     sampai sesuai.
-- ============================================================================

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS receive_record jsonb;
