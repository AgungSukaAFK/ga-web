-- Tambahan KEDUA untuk fitur Update Web (setelah update-web-setup.sql) - 2
-- perubahan:
--
--  1. REACTION DIBATASI 1 PER USER PER POST (sebelumnya 1 user bisa pasang
--     banyak emoji berbeda sekaligus di post yang sama). Ganti unique
--     constraint dari (post_id, user_id, emoji) jadi (post_id, user_id) -
--     ganti reaction = hapus baris lama, insert baris baru (lihat
--     setUpdateWebPostReaction di services/updateWebService.ts), TIDAK ada
--     lagi multi-row per user per post.
--
--  2. TABEL update_web_seen - "sudah dilihat sampai post mana" PER USER
--     (bukan per-device/localStorage kayak preferensi sidebar di
--     lib/sidebar/menu-visibility.ts) supaya badge notif di sidebar &
--     section di Dashboard konsisten walau user ganti perangkat/browser.
--     Dipakai bareng window 7 hari (dihitung di client dari
--     update_web_posts.created_at, bukan di sini) utk nentuin badge "ada
--     update baru" tampil atau tidak - lihat hooks/use-update-web-badge.ts.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SETELAH
-- update-web-setup.sql.

-- ============================================================
-- 1. Reaction: 1 user cuma boleh 1 reaction aktif per post
-- ============================================================

-- Jaga-jaga kalau sempat ada baris test dgn >1 emoji per user per post dari
-- sebelum migrasi ini - simpan yang paling baru (id terbesar) per
-- (post_id, user_id), buang sisanya, supaya constraint baru di bawah tidak
-- gagal karena data lama melanggarnya.
delete from public.update_web_post_reactions a
using public.update_web_post_reactions b
where a.post_id = b.post_id
  and a.user_id = b.user_id
  and a.id < b.id;

alter table public.update_web_post_reactions
  drop constraint if exists update_web_post_reactions_post_id_user_id_emoji_key;

alter table public.update_web_post_reactions
  add constraint update_web_post_reactions_post_id_user_id_key unique (post_id, user_id);

-- ============================================================
-- 2. Tabel update_web_seen (per user, cross-device)
-- ============================================================

create table if not exists public.update_web_seen (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_seen_post_id bigint references public.update_web_posts(id) on delete set null,
  last_seen_at timestamptz not null default now()
);

alter table public.update_web_seen enable row level security;

drop policy if exists "update_web_seen_select_own" on public.update_web_seen;
create policy "update_web_seen_select_own"
  on public.update_web_seen
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "update_web_seen_insert_own" on public.update_web_seen;
create policy "update_web_seen_insert_own"
  on public.update_web_seen
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "update_web_seen_update_own" on public.update_web_seen;
create policy "update_web_seen_update_own"
  on public.update_web_seen
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
