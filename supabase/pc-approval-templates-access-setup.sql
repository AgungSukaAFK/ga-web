-- Mengeraskan akses tabel `pc_approval_templates` (template approval khusus
-- Petty Cash - SUDAH terpisah dari `approval_templates` milik MR/PO,
-- tabelnya sendiri sudah ada duluan, ini cuma menambah audit trail + RLS
-- yang benar).
--
-- Sebelumnya RLS-nya "Enable all access for authenticated users" - SIAPA
-- SAJA yang login bisa CRUD bebas. Sekarang: SELECT dibatasi ke admin/GA/
-- Finance (Finance TETAP perlu baca utk memilih template saat validasi awal
-- petty cash, lihat fetchPcTemplateList di app/(With Sidebar)/petty-cash/[id]/page.tsx
-- - itu FITUR LAIN yang sudah ada duluan, sengaja TIDAK diubah di sini).
-- INSERT/UPDATE/DELETE (kelola template) dibatasi ketat admin/GA SAJA -
-- itulah fitur "Template Approval" petty cash yang baru (halaman
-- /petty-cash/template-approval).
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama).

alter table public.pc_approval_templates
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

-- created_by/updated_by di-set otomatis dari sesi (auth.uid()), sama seperti
-- petty_cash_barang - lihat supabase/petty-cash-barang-setup.sql.
create or replace function public.handle_pc_approval_templates_audit()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
    new.created_at := now();
    new.updated_at := now();
  elsif tg_op = 'UPDATE' then
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists on_pc_approval_templates_write on public.pc_approval_templates;
create trigger on_pc_approval_templates_write
  before insert or update on public.pc_approval_templates
  for each row execute function public.handle_pc_approval_templates_audit();

drop policy if exists "Enable all access for authenticated users" on public.pc_approval_templates;
drop policy if exists "Enable read for authenticated users" on public.pc_approval_templates;

create policy "pc_approval_templates_select"
  on public.pc_approval_templates
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'admin'
          or p.department in ('General Affair', 'HRGA-HSE')
          or p.department = 'Finance'
        )
    )
  );

create policy "pc_approval_templates_insert"
  on public.pc_approval_templates
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'admin' or p.department in ('General Affair', 'HRGA-HSE'))
    )
  );

create policy "pc_approval_templates_update"
  on public.pc_approval_templates
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'admin' or p.department in ('General Affair', 'HRGA-HSE'))
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'admin' or p.department in ('General Affair', 'HRGA-HSE'))
    )
  );

create policy "pc_approval_templates_delete"
  on public.pc_approval_templates
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'admin' or p.department in ('General Affair', 'HRGA-HSE'))
    )
  );
