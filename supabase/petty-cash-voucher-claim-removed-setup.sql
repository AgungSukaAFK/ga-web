-- Alur "Klaim Voucher" sekali-penuh (submitVoucherClaim, status
-- "Permintaan Klaim", policy petty_cash_voucher_update_owner dari
-- petty-cash-voucher-claim-setup.sql) SUDAH DIGANTI oleh tarikan parsial
-- lewat sub-voucher (lihat petty-cash-sub-voucher-setup.sql) - requester
-- tidak lagi pernah meng-update baris petty_cash_voucher-nya sendiri secara
-- langsung (pembuatan sub-voucher lewat RPC SECURITY DEFINER yang TIDAK
-- menyentuh baris Voucher itu sendiri). Policy lama ini jadi izin longgar
-- yang tidak dipakai siapa pun lagi - dicabut di sini supaya tidak
-- menggantung sebagai celah izin yang tidak perlu.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SETELAH
-- petty-cash-sub-voucher-setup.sql (cukup jalankan kalau
-- petty-cash-voucher-claim-setup.sql sebelumnya pernah dijalankan).

drop policy if exists "petty_cash_voucher_update_owner" on public.petty_cash_voucher;
