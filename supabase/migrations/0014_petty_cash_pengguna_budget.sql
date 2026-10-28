-- 0014_petty_cash_pengguna_budget.sql
--
-- Petty Cash: "Pengguna Budget" di Input Pengajuan - orang yang memakai
-- dana pengajuan ini. Defaultnya requester sendiri; requester bisa
-- menggantinya ke user lain saat submit (checkbox "Saya pengguna budget-nya"
-- di InputPengajuanClient.tsx). Pengguna Budget TIDAK ikut approval - cuma
-- tercantum namanya di detail dokumen & kolom tanda tangan cetak
-- (Pengajuan/Voucher/Sub-Voucher/Deklarasi, di-join lewat Pengajuan asal).
--
-- Nama & departemen di-snapshot saat submit (sama perlakuannya dengan
-- `approvals` yang menyimpan nama/departemen approver), supaya histori
-- dokumen tidak berubah kalau profil user itu diedit belakangan. Baris lama
-- dibiarkan null = dianggap requester sendiri (fallback di app).
--
-- Level approver (Dicek/Disetujui/Dijalankan Oleh) TIDAK butuh migrasi -
-- disimpan sbg field `level` di tiap elemen jsonb `approval_path`
-- (pc_approval_templates) & `approvals` (dokumen), ikut ter-copy apa adanya.
--
-- Tidak ada perubahan RLS: policy insert petty_cash_pengajuan cuma
-- memvalidasi user_id/company/department requester, Pengguna Budget boleh
-- user mana pun yang aktif.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), aman diulang.

alter table public.petty_cash_pengajuan
  add column if not exists pengguna_budget_id uuid
    references public.profiles(id) on delete set null,
  add column if not exists pengguna_budget_nama text,
  add column if not exists pengguna_budget_department text;
