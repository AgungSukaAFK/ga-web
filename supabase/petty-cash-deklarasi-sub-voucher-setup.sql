-- Deklarasi sekarang dibuat PER SUB-VOUCHER (tarikan dana parsial), bukan
-- lagi per Voucher penuh - lihat komentar PettyCashSubVoucher &
-- PettyCashDeklarasi di type/index.ts, dan
-- petty-cash-sub-voucher-setup.sql untuk alasan lengkapnya. Satu Voucher
-- yang ditarik 3x (3 sub-voucher) sekarang bisa punya 3 Deklarasi terpisah,
-- satu per tarikan.
--
-- `voucher_id` yang sudah ada TETAP DIPERTAHANKAN (cuma jadi denormalisasi
-- dari sub_voucher.voucher_id, diisi apa adanya oleh app code saat insert)
-- supaya tampilan "Dari Voucher X" yang sudah ada tidak perlu join
-- tambahan - unique constraint-nya yang pindah ke sub_voucher_id.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SETELAH
-- petty-cash-deklarasi-setup.sql & petty-cash-sub-voucher-setup.sql.

alter table public.petty_cash_deklarasi
  add column if not exists sub_voucher_id bigint references public.petty_cash_sub_voucher(id) on delete restrict;

alter table public.petty_cash_deklarasi
  drop constraint if exists petty_cash_deklarasi_voucher_id_key;

alter table public.petty_cash_deklarasi
  add constraint petty_cash_deklarasi_sub_voucher_id_key unique (sub_voucher_id);

-- Insert policy diganti total - dulu wajib voucher berstatus "Permintaan
-- Klaim" (status itu sudah tidak ada lagi), sekarang wajib merujuk ke
-- sub-voucher milik requester sendiri yang voucher_id-nya konsisten.
drop policy if exists "petty_cash_deklarasi_insert" on public.petty_cash_deklarasi;
create policy "petty_cash_deklarasi_insert"
  on public.petty_cash_deklarasi
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company = petty_cash_deklarasi.company_code
        and p.department = petty_cash_deklarasi.department
    )
    and exists (
      select 1 from public.petty_cash_sub_voucher sv
      where sv.id = petty_cash_deklarasi.sub_voucher_id
        and sv.voucher_id = petty_cash_deklarasi.voucher_id
        and sv.user_id = auth.uid()
    )
  );
