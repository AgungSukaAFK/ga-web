-- Tambah kolom `budget_id` ke petty_cash_pengajuan & petty_cash_voucher -
-- budget yang menanggung dokumen ini (lihat komentar PettyCashBudget di
-- type/index.ts). AUTO-terisi sesuai departemen requester saat Pengajuan
-- dibuat (resolveAutoBudget, services/pettyCashBudgetService.ts), approver
-- Pengajuan boleh ganti lewat "Edit & Setujui" - budget_id lalu disalin
-- forward ke Voucher saat dibuat (sama pola dengan company_code/department).
--
-- Tidak perlu policy RLS baru - policy UPDATE yang sudah ada
-- (petty_cash_pengajuan_update_approver, petty-cash-pengajuan-approval-setup.sql)
-- sudah `with check (true)`, approver yang gilirannya pending sudah boleh
-- update kolom apa pun termasuk kolom baru ini.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SETELAH
-- petty-cash-pengajuan-setup.sql, petty-cash-voucher-setup.sql, &
-- petty-cash-budget-setup.sql.

alter table public.petty_cash_pengajuan
  add column if not exists budget_id bigint references public.petty_cash_budget(id) on delete set null;

alter table public.petty_cash_voucher
  add column if not exists budget_id bigint references public.petty_cash_budget(id) on delete set null;
