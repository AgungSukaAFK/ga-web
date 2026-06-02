-- ============================================================================
-- Fitur: Nonaktifkan / Aktifkan User (Soft Delete)
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor.
--
-- Konsep:
--   * Kolom `is_active` pada tabel `profiles` menjadi satu-satunya sumber
--     kebenaran status akun.
--   * User dengan is_active = false dianggap "tidak ada" oleh sistem:
--       - tidak bisa login / mengakses halaman (diblokir di login & middleware),
--       - tidak muncul di pemilihan user (template approval, mention, dll),
--     namun datanya TETAP ada di database sehingga sewaktu-waktu bisa
--     diaktifkan kembali untuk keperluan audit/review.
--
-- Catatan: aplikasi membaca `is_active` langsung dari tabel `profiles`,
-- sehingga TIDAK wajib mengubah view `users_with_profiles`. (Lihat bagian
-- opsional di bawah bila Anda ingin kolom ini ikut tampil di view.)
-- ============================================================================

-- 1) Tambah kolom is_active (default aktif, dan backfill semua user lama => aktif)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 2) Index parsial untuk mempercepat pencarian user nonaktif (audit) bila perlu
CREATE INDEX IF NOT EXISTS idx_profiles_is_active
  ON public.profiles (is_active);

-- ----------------------------------------------------------------------------
-- (OPSIONAL) Jika Anda ingin kolom is_active juga muncul di view
-- `users_with_profiles`, recreate view dengan menambahkan `p.is_active`.
-- Sesuaikan definisi di bawah dengan definisi view Anda saat ini
-- (jalankan `select pg_get_viewdef('public.users_with_profiles', true);`
-- untuk melihat definisi aslinya terlebih dahulu).
-- Aplikasi TIDAK bergantung pada langkah ini.
-- ----------------------------------------------------------------------------
-- CREATE OR REPLACE VIEW public.users_with_profiles AS
-- SELECT
--   p.*,                 -- pastikan kolom p.is_active ikut terbawa
--   u.email AS email
-- FROM public.profiles p
-- JOIN auth.users u ON u.id = p.id;
