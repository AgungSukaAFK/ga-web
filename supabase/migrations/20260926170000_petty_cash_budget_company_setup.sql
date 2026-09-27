-- Budget Petty Cash TERNYATA harus dipisah per PERUSAHAAN (company_code)
-- juga, bukan cuma departemen+site - dua requester beda company (mis. GMI
-- vs GIS) yang kebetulan sama departemen+site-nya (mis. "General Affair" +
-- "Head Office") SEHARUSNYA tidak berbagi satu pool budget yang sama.
-- Kolom `company_code` di sini SAMA maknanya dengan `company_code` di
-- petty_cash_pengajuan/voucher (snapshot profiles.company requester, lihat
-- komentar di type/index.ts) - dipakai resolveAutoBudget(department, site,
-- companyCode) mencocokkan budget yang PERSIS sama department & site &
-- company-nya (bukan wildcard/fallback, konsisten dgn pola site).
--
-- UI Manajemen Budget-nya juga dirombak supaya pola & tampilannya identik
-- dengan app/(With Sidebar)/cost-center-management/CostCenterClient.tsx
-- (search + pagination + filter "Perusahaan" khusus admin company LOURDES,
-- lihat services/costCenterService.ts fetchCostCenters) - bedanya Budget
-- tidak punya kolom "Kode" seperti Cost Center.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SETELAH
-- petty-cash-budget-site-setup.sql.

alter table public.petty_cash_budget
  add column if not exists company_code text;

-- Ganti aturan unik "satu kombinasi departemen+site" jadi "satu kombinasi
-- departemen+site+company" - drop index lama, buat yang baru.
drop index if exists idx_petty_cash_budget_department_site_active;

create unique index if not exists idx_petty_cash_budget_department_site_company_active
  on public.petty_cash_budget (department, site, company_code)
  where is_active;

create index if not exists idx_petty_cash_budget_company_code
  on public.petty_cash_budget (company_code);
