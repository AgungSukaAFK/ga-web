-- Auto-terapkan Template Approval Petty Cash sekarang butuh cocok
-- department + site/lokasi + company (perusahaan) SEKALIGUS - bukan cuma
-- departemen saja seperti sebelumnya (lihat
-- pc-approval-template-auto-rules-setup.sql &
-- pc-approval-template-approval-type-setup.sql). Konsisten dengan pola yang
-- sama dipakai Budget Petty Cash (resolveAutoBudget, lihat
-- petty-cash-budget-site-setup.sql & petty-cash-budget-company-setup.sql) -
-- dua requester beda site/company yang kebetulan sama departemennya
-- SEHARUSNYA bisa punya jalur approval auto yang berbeda.
--
-- `site` nullable di kolom DB (requester yang belum punya site di
-- profile-nya tetap bisa ke-match ke rule yang site-nya juga belum diisi,
-- lihat resolvePcAutoTemplate & RPC di bawah - "IS NOT DISTINCT FROM"
-- dipakai supaya NULL = NULL match seperti biasa) - `company_code` juga
-- nullable di kolom DB tapi form kelola template (PcApprovalTemplateForm)
-- mewajibkan diisi utk baris baru, mirror form Budget.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SETELAH
-- pc-approval-template-approval-type-setup.sql.

alter table public.pc_approval_template_auto_rules
  add column if not exists site text,
  add column if not exists company_code text;

-- Constraint unique lama "satu kombinasi departemen+tipe approval" diganti
-- jadi "satu kombinasi departemen+site+perusahaan+tipe approval".
alter table public.pc_approval_template_auto_rules
  drop constraint if exists pc_approval_template_auto_rules_department_approval_type_key;

alter table public.pc_approval_template_auto_rules
  drop constraint if exists pc_approval_template_auto_rules_dept_site_company_type_key;
alter table public.pc_approval_template_auto_rules
  add constraint pc_approval_template_auto_rules_dept_site_company_type_key
  unique (department, site, company_code, approval_type);

-- Signature lama cuma 2 argumen (p_department, p_approval_type) - drop dulu
-- supaya tidak ninggalin overload lama yang bikin ambigu saat dipanggil
-- (sama alasan seperti saat approval_type ditambahkan, lihat
-- pc-approval-template-approval-type-setup.sql).
drop function if exists public.resolve_pc_auto_template(text, text);

create or replace function public.resolve_pc_auto_template(
  p_department text,
  p_site text,
  p_company_code text,
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
    and r.site is not distinct from p_site
    and r.company_code is not distinct from p_company_code
    and r.approval_type = p_approval_type
  limit 1;
$$;

grant execute on function public.resolve_pc_auto_template(text, text, text, text) to authenticated;
