-- 0016_followup_announcer.sql
--
-- Announcer Follow-up: akun ber-role `announcer` login di PC ber-speaker
-- (halaman /announcer) dan menyuarakan tiap follow-up approval MR/PO, mis.
-- "Menunggu approval em er, Bapak Agung, dengan kode lima, tujuh, satu".
--
--  1. profiles.sapaan (Bapak/Ibu/Mas/Mba/Kak, NULL = tanpa sapaan) - diatur
--     admin di User Management, dipakai di kalimat pengumuman.
--  2. Tabel `followup_announcements` = antrian pengumuman. Diisi OTOMATIS
--     oleh trigger di material_requests/purchase_orders tiap ada entri baru
--     di `followup_requests` (lihat requestApprovalFollowup,
--     services/approvalService.ts) - bukan dari browser, supaya tetap
--     tercatat walau tab yang menekan Follow-up langsung ditutup.
--     Nama, sapaan, & lokasi approver di-snapshot ke baris ini, jadi akun
--     announcer tidak butuh akses baca ke MR/PO/profiles.
--  3. Anti-spam: dokumen + approver yang sama paling cepat diumumkan lagi
--     5 menit setelah pengumuman sebelumnya (notifikasi in-app ke approver
--     tetap terkirim tiap kali tombol ditekan, ini cuma untuk speaker).
--
-- Filter lokasi, jam & hari aktif, suara, dll diatur PER DEVICE di halaman
-- /announcer (localStorage), bukan di sini.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SETELAH
-- 0015_petty_cash_revisi.sql. Script IDEMPOTENT.

-- ============================================================
-- 1. Sapaan
-- ============================================================

alter table public.profiles
  add column if not exists sapaan text;

alter table public.profiles
  drop constraint if exists profiles_sapaan_check;
alter table public.profiles
  add constraint profiles_sapaan_check
  check (sapaan is null or sapaan in ('Bapak', 'Ibu', 'Mas', 'Mba', 'Kak'));

-- ============================================================
-- 2. Antrian pengumuman
-- ============================================================

create table if not exists public.followup_announcements (
  id bigint generated always as identity primary key,
  resource_type text not null
    check (resource_type in ('material_request', 'purchase_order')),
  resource_id bigint not null,
  kode text not null,
  approver_id uuid not null,
  approver_nama text,
  approver_sapaan text,
  approver_lokasi text,
  requested_by uuid,
  requested_by_nama text,
  created_at timestamptz not null default now()
);

create index if not exists followup_announcements_created_at_idx
  on public.followup_announcements (created_at desc);

-- Dipakai cek anti-spam 5 menit di trigger.
create index if not exists followup_announcements_dedupe_idx
  on public.followup_announcements (resource_type, resource_id, approver_id, created_at desc);

alter table public.followup_announcements enable row level security;

-- Cuma announcer & admin (admin untuk tes/monitor) yang boleh membaca.
-- Tidak ada policy insert/update/delete: baris hanya ditulis trigger
-- (security definer) di bawah.
drop policy if exists "followup_announcements_select" on public.followup_announcements;
create policy "followup_announcements_select"
  on public.followup_announcements
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('announcer', 'admin')
    )
  );

grant select on public.followup_announcements to authenticated;

-- ============================================================
-- 3. Trigger: entri follow-up baru -> antrian pengumuman
-- ============================================================
--
-- Entri baru dicari dengan membandingkan ISI array lama vs baru, bukan
-- panjangnya: requestApprovalFollowup menulis ulang seluruh array dari state
-- halaman, jadi kalau halamannya sudah lama terbuka (follow-up orang lain
-- belum termuat), panjang array bisa tidak bertambah padahal ada entri baru.
--
-- TG_ARGV[0] = resource_type, TG_ARGV[1] = nama kolom kode dokumen.

create or replace function public.enqueue_followup_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb := coalesce(old.followup_requests, '[]'::jsonb);
  v_entry jsonb;
  v_approver uuid;
  v_requester uuid;
  v_kode text := to_jsonb(new) ->> tg_argv[1];
  v_profile record;
begin
  for v_entry in
    select e
    from jsonb_array_elements(coalesce(new.followup_requests, '[]'::jsonb)) e
    where not (v_old @> jsonb_build_array(e))
  loop
    begin
      v_approver := nullif(v_entry ->> 'approver_id', '')::uuid;
      v_requester := nullif(v_entry ->> 'requested_by', '')::uuid;
    exception when invalid_text_representation then
      continue;
    end;
    if v_approver is null then
      continue;
    end if;

    if exists (
      select 1 from public.followup_announcements a
      where a.resource_type = tg_argv[0]
        and a.resource_id = new.id
        and a.approver_id = v_approver
        and a.created_at > now() - interval '5 minutes'
    ) then
      continue;
    end if;

    select p.nama, p.sapaan, p.lokasi into v_profile
    from public.profiles p
    where p.id = v_approver;

    insert into public.followup_announcements (
      resource_type, resource_id, kode,
      approver_id, approver_nama, approver_sapaan, approver_lokasi,
      requested_by, requested_by_nama
    ) values (
      tg_argv[0], new.id, coalesce(v_kode, ''),
      v_approver,
      coalesce(nullif(v_profile.nama, ''), v_entry ->> 'approver_name'),
      v_profile.sapaan,
      v_profile.lokasi,
      v_requester,
      v_entry ->> 'requested_by_name'
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists on_mr_followup_enqueue_announcement on public.material_requests;
create trigger on_mr_followup_enqueue_announcement
  after update of followup_requests on public.material_requests
  for each row
  when (old.followup_requests is distinct from new.followup_requests)
  execute function public.enqueue_followup_announcement('material_request', 'kode_mr');

drop trigger if exists on_po_followup_enqueue_announcement on public.purchase_orders;
create trigger on_po_followup_enqueue_announcement
  after update of followup_requests on public.purchase_orders
  for each row
  when (old.followup_requests is distinct from new.followup_requests)
  execute function public.enqueue_followup_announcement('purchase_order', 'kode_po');

-- ============================================================
-- 4. Realtime
-- ============================================================

do $$
begin
  alter publication supabase_realtime add table public.followup_announcements;
exception
  when duplicate_object then null;
  when others then null;
end $$;
