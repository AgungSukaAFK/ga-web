-- 0013_petty_cash_pengajuan_selesai.sql
--
-- Petty Cash: Pengajuan ikut "Selesai" begitu rantainya tuntas. Sebelumnya
-- cuma Voucher yang naik ke "Selesai" (trigger
-- handle_petty_cash_deklarasi_complete_voucher, 0004) - Pengajuan asalnya
-- tetap "Approved" selamanya walau seluruh proses sudah beres.
--
-- Disinkronkan dari status Voucher AKTIF-nya (bukan dihitung ulang dari
-- Deklarasi) supaya satu sumber kebenaran: semua jalan yang mengubah
-- status Voucher ke/dari "Selesai" - trigger Deklarasi approved,
-- _pc_admin_recheck_voucher_completion setelah admin menghapus
-- Sub-Voucher/Deklarasi, override status oleh admin, maupun admin
-- menghapus Voucher-nya - otomatis ikut terbawa ke Pengajuan:
--   - Voucher jadi "Selesai"            -> Pengajuan "Approved" -> "Selesai"
--   - Voucher turun dari "Selesai"/dihapus -> Pengajuan "Selesai" -> "Approved"
-- Status Pengajuan selain itu (In Approval/Rejected) tidak pernah disentuh.
--
-- SECURITY DEFINER: yang memicu biasanya approver terakhir Deklarasi, yang
-- tidak punya izin UPDATE ke baris Pengajuan orang lain (lihat komentar
-- sama di handle_petty_cash_deklarasi_complete_voucher).
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), aman diulang.

create or replace function public.handle_petty_cash_voucher_sync_pengajuan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.status = 'Selesai' and old.status is distinct from 'Selesai' then
      update public.petty_cash_pengajuan
      set status = 'Selesai', updated_at = now()
      where id = new.pengajuan_id and status = 'Approved';
    elsif old.status = 'Selesai' and new.status is distinct from 'Selesai' then
      update public.petty_cash_pengajuan
      set status = 'Approved', updated_at = now()
      where id = new.pengajuan_id and status = 'Selesai';
    end if;
    return new;
  end if;

  -- DELETE (admin hapus Voucher): Pengajuan kembali bisa dibuatkan Voucher
  -- baru. Kalau Pengajuan-nya sendiri sedang ikut dihapus, update ini
  -- tidak menemukan baris apa pun.
  if old.status = 'Selesai' then
    update public.petty_cash_pengajuan
    set status = 'Approved', updated_at = now()
    where id = old.pengajuan_id and status = 'Selesai';
  end if;
  return old;
end;
$$;

drop trigger if exists on_petty_cash_voucher_sync_pengajuan on public.petty_cash_voucher;
create trigger on_petty_cash_voucher_sync_pengajuan
  after update of status or delete on public.petty_cash_voucher
  for each row execute function public.handle_petty_cash_voucher_sync_pengajuan();

-- Data lama: Pengajuan yang Voucher-nya sudah "Selesai" sebelum trigger ini
-- ada. (updated_at ikut berubah lewat trigger audit - Dashboard memakai
-- processed_at approver utk waktu "Pengajuan disetujui", bukan updated_at.)
update public.petty_cash_pengajuan pj
set status = 'Selesai'
where pj.status = 'Approved'
  and exists (
    select 1 from public.petty_cash_voucher v
    where v.pengajuan_id = pj.id and v.status = 'Selesai'
  );
