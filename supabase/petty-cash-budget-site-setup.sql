-- Budgeting Petty Cash TERNYATA harus auto-detect dari DEPARTEMEN **DAN**
-- SITE/LOKASI requester (bukan departemen saja seperti versi awal di
-- petty-cash-budget-setup.sql) - satu departemen bisa punya budget berbeda
-- per site (mis. "GA - Head Office" vs "GA - Site BA"). Kolom `site` di
-- sini SAMA maknanya dengan `site` di petty_cash_pengajuan/voucher/deklarasi
-- (snapshot profiles.lokasi requester, lihat komentar di sana) - dipakai
-- resolveAutoBudget(department, site) mencocokkan budget yang PERSIS sama
-- department & site-nya (bukan wildcard/fallback).
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SETELAH
-- petty-cash-budget-setup.sql.

alter table public.petty_cash_budget
  add column if not exists site text;

-- Ganti aturan unik "satu departemen satu budget aktif" jadi "satu
-- kombinasi departemen+site satu budget aktif" - drop index lama, buat yang
-- baru.
drop index if exists idx_petty_cash_budget_department_active;

create unique index if not exists idx_petty_cash_budget_department_site_active
  on public.petty_cash_budget (department, site)
  where is_active;

create index if not exists idx_petty_cash_budget_site
  on public.petty_cash_budget (site);
