-- Fitur foto profil. File fotonya disimpan di storage VPS (bucket attachment
-- yang sama, prefix `avatars/<user_id>/`) lewat signed upload URL - lihat
-- lib/uploadDirect.ts. Di sini cuma simpan public URL-nya.
--
-- Foto sudah di-crop 1:1 & dikompres di browser (512x512 WebP, umumnya
-- < 100KB) sebelum di-upload, jadi batas 10MB hanya berlaku utk file mentah
-- yang dipilih user, bukan yang tersimpan.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama). User sudah bisa
-- update baris profiles miliknya sendiri (dipakai halaman /profile utk
-- nama/nrp/lokasi), jadi tidak perlu policy baru.

alter table public.profiles
  add column if not exists avatar_url text;
