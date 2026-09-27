-- Kolom cost_center_id di 3 tabel alur baru Petty Cash (petty_cash_pengajuan,
-- petty_cash_voucher, petty_cash_deklarasi) SELALU diisi null sejak awal
-- (lihat createPettyCashPengajuan, services/pettyCashPengajuanService.ts) dan
-- tidak pernah ditampilkan di UI - sisa rancangan awal yang salah kaprah
-- menyamakan budget Petty Cash dengan Cost Center MR/PO (lihat juga
-- petty-cash-requests-legacy-removed-setup.sql). Budget Petty Cash alur baru
-- sudah 100% pakai petty_cash_budget (per departemen+site), bukan
-- cost_centers.
--
-- Drop kolom ini sekalian membereskan skema supaya Petty Cash benar-benar
-- lepas dari cost_centers milik MR/PO.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SETELAH
-- petty-cash-requests-legacy-removed-setup.sql.

alter table public.petty_cash_pengajuan drop column if exists cost_center_id;
alter table public.petty_cash_voucher drop column if exists cost_center_id;
alter table public.petty_cash_deklarasi drop column if exists cost_center_id;
