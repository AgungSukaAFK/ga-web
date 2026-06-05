-- ============================================================================
-- Fitur: Stok GA
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor.
--
-- Konsep:
--   * Tabel `ga_stocks` menyimpan stok yang dikelola GA. TIDAK semua barang
--     punya stok — hanya barang yang sengaja ditambahkan GA.
--   * Stok bersifat PER PERUSAHAAN: satu barang bisa punya stok berbeda di tiap
--     company (GMI / GIS / LOURDES). Keunikan dijaga (barang_id, company_code).
--   * Hanya GA & Admin yang mengakses (di-gate di sisi aplikasi).
-- ============================================================================

create table if not exists public.ga_stocks (
  id           bigint generated always as identity primary key,
  barang_id    bigint not null references public.barang (id) on delete cascade,
  company_code text   not null,
  quantity     numeric not null default 0,
  location     text,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz,
  updated_by   uuid references public.profiles (id),
  -- Satu baris stok per barang per perusahaan
  unique (barang_id, company_code)
);

create index if not exists idx_ga_stocks_barang
  on public.ga_stocks (barang_id);

create index if not exists idx_ga_stocks_company
  on public.ga_stocks (company_code);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
-- Tabel ini terkena RLS. Tanpa policy, semua operasi ditolak
-- ("new row violates row-level security policy").
-- Pembatasan GA & Admin sudah di-gate di sisi aplikasi (UI + guard halaman),
-- jadi di sini cukup mengizinkan user yang sudah login (authenticated),
-- konsisten dengan tabel lain (cost_centers, barang, dll).
-- ----------------------------------------------------------------------------
alter table public.ga_stocks enable row level security;

drop policy if exists "ga_stocks_select" on public.ga_stocks;
create policy "ga_stocks_select" on public.ga_stocks
  for select to authenticated using (true);

drop policy if exists "ga_stocks_insert" on public.ga_stocks;
create policy "ga_stocks_insert" on public.ga_stocks
  for insert to authenticated with check (true);

drop policy if exists "ga_stocks_update" on public.ga_stocks;
create policy "ga_stocks_update" on public.ga_stocks
  for update to authenticated using (true) with check (true);

drop policy if exists "ga_stocks_delete" on public.ga_stocks;
create policy "ga_stocks_delete" on public.ga_stocks
  for delete to authenticated using (true);
