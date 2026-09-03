-- Auto-terapkan Template Approval Petty Cash berdasarkan departemen -
-- padanan `approval_template_auto_rules` milik MR/PO, tapi lebih simpel:
-- Petty Cash cuma satu "jenis dokumen" (pengajuan), jadi rule-nya cukup
-- per-departemen (bukan per document_type+department seperti MR/PO).
--
-- Dipakai oleh: Input Pengajuan Petty Cash (petty_cash_pengajuan) - begitu
-- user submit, sistem cari rule utk departemen-nya lalu langsung terapkan
-- approval_path template yang cocok tanpa perlu validasi manual GA.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama).

create table if not exists public.pc_approval_template_auto_rules (
  id bigint generated always as identity primary key,
  template_id bigint not null references public.pc_approval_templates(id) on delete cascade,
  department text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_pc_approval_template_auto_rules_template_id
  on public.pc_approval_template_auto_rules (template_id);

alter table public.pc_approval_template_auto_rules enable row level security;

-- Tabel mentah ini cuma diakses dari halaman kelola Template Approval
-- (admin/GA). Requester biasa TIDAK baca tabel ini langsung - mereka pakai
-- RPC resolve_pc_auto_template() di bawah (security definer, hasil dibatasi
-- ke approval_path yang relevan saja).
drop policy if exists "pc_approval_template_auto_rules_select" on public.pc_approval_template_auto_rules;
create policy "pc_approval_template_auto_rules_select"
  on public.pc_approval_template_auto_rules
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'admin' or p.department in ('General Affair', 'HRGA-HSE'))
    )
  );

drop policy if exists "pc_approval_template_auto_rules_insert" on public.pc_approval_template_auto_rules;
create policy "pc_approval_template_auto_rules_insert"
  on public.pc_approval_template_auto_rules
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'admin' or p.department in ('General Affair', 'HRGA-HSE'))
    )
  );

drop policy if exists "pc_approval_template_auto_rules_update" on public.pc_approval_template_auto_rules;
create policy "pc_approval_template_auto_rules_update"
  on public.pc_approval_template_auto_rules
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

drop policy if exists "pc_approval_template_auto_rules_delete" on public.pc_approval_template_auto_rules;
create policy "pc_approval_template_auto_rules_delete"
  on public.pc_approval_template_auto_rules
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'admin' or p.department in ('General Affair', 'HRGA-HSE'))
    )
  );

-- Dipanggil dari client saat submit Input Pengajuan (semua user login boleh,
-- lihat grant di bawah) - security definer supaya bisa baca
-- pc_approval_template_auto_rules & pc_approval_templates tanpa perlu buka
-- akses baca tabel mentahnya ke semua orang. Return NULL (0 baris) kalau
-- departemen belum punya rule.
create or replace function public.resolve_pc_auto_template(p_department text)
returns table (template_id bigint, template_name text, approval_path jsonb)
language sql
security definer
set search_path = public
as $$
  select t.id, t.template_name, t.approval_path
  from public.pc_approval_template_auto_rules r
  join public.pc_approval_templates t on t.id = r.template_id
  where r.department = p_department
  limit 1;
$$;

grant execute on function public.resolve_pc_auto_template(text) to authenticated;
