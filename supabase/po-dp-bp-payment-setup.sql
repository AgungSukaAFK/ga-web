-- ============================================================================
-- Fitur: Progress Pembayaran DP & BP (Pelunasan) pada Purchase Order
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor.
--
-- Konsep:
--   * PO dengan payment_term "DP & Pelunasan" (mis. "DP 30% - Pelunasan 70%")
--     dibayar dalam 2 tahap: DP (Down Payment) lalu BP/Pelunasan (Balance Payment).
--   * Kolom `dp_paid` & `bp_paid` menandai tahap mana yang sudah dibayar.
--     Diisi oleh Finance (approver bertipe "Payment Validator") lewat checkbox
--     saat approve PO (lihat purchase-order/[id]/page.tsx).
--   * PO baru dianggap "Paid" (isPoPaid) & lanjut status "Pending BAST" begitu
--     dp_paid DAN bp_paid sama-sama true. Selama belum lunas, approval Payment
--     Validator tetap "pending" dan PO tertahan di status "Pending Payment".
-- ============================================================================

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS dp_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bp_paid boolean NOT NULL DEFAULT false;
