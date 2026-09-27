-- Halaman Management Petty Cash (admin only, /petty-cash/management) -
-- admin bisa override status & approvals Pengajuan/Voucher/Deklarasi apa pun
-- (mis. dokumen nyangkut karena approver salah pencet/resign) tanpa harus
-- jadi bagian dari approvals array atau pemilik dokumennya. Policy UPDATE
-- yang sudah ada (petty_cash_*_update_approver/_owner) TIDAK mengizinkan ini
-- - makanya ditambah policy admin terpisah di sini. Postgres meng-OR-kan
-- semua policy permissive untuk command yang sama, jadi ini menambah, bukan
-- menggantikan, policy update yang sudah ada.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), setelah
-- petty-cash-pengajuan-setup.sql, petty-cash-voucher-setup.sql, dan
-- petty-cash-deklarasi-setup.sql (tabelnya harus sudah ada duluan).

drop policy if exists "petty_cash_pengajuan_update_admin" on public.petty_cash_pengajuan;
create policy "petty_cash_pengajuan_update_admin"
  on public.petty_cash_pengajuan
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "petty_cash_voucher_update_admin" on public.petty_cash_voucher;
create policy "petty_cash_voucher_update_admin"
  on public.petty_cash_voucher
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "petty_cash_deklarasi_update_admin" on public.petty_cash_deklarasi;
create policy "petty_cash_deklarasi_update_admin"
  on public.petty_cash_deklarasi
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
