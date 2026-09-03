-- Tambah klasifikasi "Tipe Approval" ke pc_approval_templates - satu template
-- kini eksplisit menandakan untuk tahap apa dia dipakai: "Approval
-- Pengajuan", "Approval Voucher", atau "Approval Deklarasi" (lihat rangkaian
-- tahapan Petty Cash item-based di komentar PcApprovalType, type/index.ts:
-- Pengajuan -> Approval Pengajuan -> Pengajuan Voucher -> Approval Voucher ->
-- Claim Voucher -> Deklarasi -> Approval Deklarasi). Baru tahap "Approval
-- Pengajuan" yang sudah dipakai (Input Pengajuan, lihat resolvePcAutoTemplate
-- di services/pcApprovalTemplateService.ts) - Voucher & Deklarasi disiapkan
-- tipenya duluan supaya templatenya bisa dibuat sebelum alurnya sendiri jadi.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SETELAH
-- pc-approval-templates-access-setup.sql & pc-approval-template-auto-rules-setup.sql.

alter table public.pc_approval_templates
  add column if not exists approval_type text
    not null default 'Approval Pengajuan'
    check (approval_type in ('Approval Pengajuan', 'Approval Voucher', 'Approval Deklarasi'));

-- Default di atas cuma buat ngisi data lama (semua template yang sudah ada
-- memang dipakai utk Input Pengajuan) - template baru wajib kirim nilainya
-- eksplisit dari form (lihat PcApprovalTemplateForm.tsx).
alter table public.pc_approval_templates alter column approval_type drop default;

-- pc_approval_template_auto_rules sebelumnya unique per departemen SAJA
-- (`department text not null unique`) - artinya satu departemen cuma bisa
-- auto-terapkan SATU template dari SELURUH tipe. Sekarang tiap tahap
-- (Pengajuan/Voucher/Deklarasi) butuh auto-rule sendiri per departemen, jadi
-- approval_type didenormalisasi ke tabel ini juga (diisi dari approval_type
-- template-nya saat disimpan, lihat savePcAutoRules di
-- pcApprovalTemplateService.ts) dan constraint unique diganti jadi per
-- (department, approval_type).
alter table public.pc_approval_template_auto_rules
  add column if not exists approval_type text
    not null default 'Approval Pengajuan'
    check (approval_type in ('Approval Pengajuan', 'Approval Voucher', 'Approval Deklarasi'));

alter table public.pc_approval_template_auto_rules alter column approval_type drop default;

alter table public.pc_approval_template_auto_rules
  drop constraint if exists pc_approval_template_auto_rules_department_key;

alter table public.pc_approval_template_auto_rules
  drop constraint if exists pc_approval_template_auto_rules_department_approval_type_key;
alter table public.pc_approval_template_auto_rules
  add constraint pc_approval_template_auto_rules_department_approval_type_key
  unique (department, approval_type);

-- resolve_pc_auto_template sekarang butuh tahu tahap approval yang dicari.
-- Signature lama cuma 1 argumen (p_department) - drop dulu supaya tidak
-- ninggalin overload lama yang bikin ambigu saat dipanggil dengan 1 argumen
-- (PostgREST/Supabase manggil pakai named params, jadi overload lama & baru
-- bisa sama-sama "cocok" kalau tidak di-drop).
drop function if exists public.resolve_pc_auto_template(text);

create or replace function public.resolve_pc_auto_template(
  p_department text,
  p_approval_type text default 'Approval Pengajuan'
)
returns table (template_id bigint, template_name text, approval_path jsonb)
language sql
security definer
set search_path = public
as $$
  select t.id, t.template_name, t.approval_path
  from public.pc_approval_template_auto_rules r
  join public.pc_approval_templates t on t.id = r.template_id
  where r.department = p_department
    and r.approval_type = p_approval_type
  limit 1;
$$;

grant execute on function public.resolve_pc_auto_template(text, text) to authenticated;
