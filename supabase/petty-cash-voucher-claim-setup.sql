-- "Claim Voucher" Petty Cash - begitu sebuah Voucher (petty_cash_voucher)
-- sudah "Approved", requester (pemilik dokumen) bisa mengajukan klaim
-- pencairan lewat /petty-cash/claim-voucher (lihat submitVoucherClaim,
-- services/pettyCashVoucherService.ts), yang menaikkan status jadi
-- "Permintaan Klaim".
--
-- Policy UPDATE yang sudah ada (petty_cash_voucher_update_approver, lihat
-- petty-cash-voucher-setup.sql) cuma mengizinkan APPROVER yang namanya ada
-- di `approvals` - requester/pemilik dokumen BUKAN approver, jadi butuh
-- policy UPDATE terpisah supaya dia bisa update baris miliknya sendiri.
-- Postgres meng-OR-kan semua policy permissive untuk command yang sama,
-- jadi ini menambah izin, bukan menggantikan yang sudah ada.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SETELAH
-- petty-cash-voucher-setup.sql.

drop policy if exists "petty_cash_voucher_update_owner" on public.petty_cash_voucher;
create policy "petty_cash_voucher_update_owner"
  on public.petty_cash_voucher
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
