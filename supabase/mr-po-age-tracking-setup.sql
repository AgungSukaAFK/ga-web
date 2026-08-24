-- ============================================================================
-- Fitur: Umur MR & PO (dari dibuat sampai Full Received)
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor.
--
-- Konsep:
--   * `material_requests` TIDAK punya kolom updated_at sama sekali, dan
--     `purchase_orders.updated_at` di-auto-update trigger `handle_updated_at`
--     pada SETIAP perubahan row (bukan cuma pas Full Received) - jadi
--     keduanya tidak bisa dipakai buat tau "kapan status jadi Full Received".
--   * Kolom baru `full_received_at` di kedua tabel, distempel SEKALI pas
--     status pertama kali jadi "Full Received" (lihat recalculateMrStatus di
--     services/mrService.ts, dan submitReceiveRecord/handleApprovalAction/
--     handleEditDpBpPayment yang manggil deriveReceiveDrivenStatus di
--     services/purchaseOrderService.ts & purchase-order/[id]/page.tsx).
--   * Data lama yang sudah Full Received SEBELUM fitur ini ada TIDAK
--     di-backfill (kolomnya NULL) - UI menampilkan "-" untuk kasus itu,
--     sesuai keputusan user. MR/PO baru ke depannya otomatis tercatat akurat.
-- ============================================================================

ALTER TABLE public.material_requests
  ADD COLUMN IF NOT EXISTS full_received_at timestamp with time zone;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS full_received_at timestamp with time zone;
