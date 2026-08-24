-- ============================================================================
-- Fitur: Auto-Detect Template Approval berdasarkan Dokumen (MR/PO) + Departemen
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor.
--
-- Kalau sebelumnya sempat menjalankan versi lama skrip ini (yang menambahkan
-- kolom auto_document_type/auto_department langsung di approval_templates),
-- skrip ini otomatis membersihkan kolom itu dulu - desainnya diganti jadi
-- tabel relasi terpisah supaya SATU template bisa punya LEBIH DARI SATU
-- kombinasi dokumen+departemen auto-detect (bukan cuma satu-satu lagi).
--
-- Konsep:
--   * Tabel `approval_template_auto_rules` menyimpan kombinasi
--     (document_type, department) yang di-set GA sebagai "pemicu" auto-detect
--     untuk sebuah template - satu template boleh punya banyak baris di sini.
--   * Saat GA membuka halaman validasi awal MR/PO, sistem cari baris yang
--     document_type & department-nya cocok dengan dokumen tsb, lalu
--     otomatis menerapkan template terkait sebagai default (GA tetap bisa
--     mengganti/edit manual - lihat material-request/validate/[id]/page.tsx &
--     purchase-order/validate/[id]/page.tsx).
--   * UNIQUE (document_type, department) - satu kombinasi cuma boleh dipegang
--     SATU template (supaya tidak ambigu), tapi satu template boleh punya
--     banyak kombinasi berbeda.
-- ============================================================================

-- Bersihkan desain lama (kolom di approval_templates) kalau pernah dipasang.
DROP INDEX IF EXISTS idx_approval_templates_auto_unique;
ALTER TABLE public.approval_templates
  DROP CONSTRAINT IF EXISTS approval_templates_auto_document_type_check;
ALTER TABLE public.approval_templates
  DROP COLUMN IF EXISTS auto_document_type,
  DROP COLUMN IF EXISTS auto_department;

CREATE TABLE IF NOT EXISTS public.approval_template_auto_rules (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  template_id bigint NOT NULL REFERENCES public.approval_templates(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('material_request', 'purchase_order')),
  department text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (document_type, department)
);

CREATE INDEX IF NOT EXISTS idx_approval_template_auto_rules_template_id
  ON public.approval_template_auto_rules (template_id);

GRANT ALL ON TABLE public.approval_template_auto_rules TO anon;
GRANT ALL ON TABLE public.approval_template_auto_rules TO authenticated;
GRANT ALL ON TABLE public.approval_template_auto_rules TO service_role;
GRANT ALL ON SEQUENCE public.approval_template_auto_rules_id_seq TO anon;
GRANT ALL ON SEQUENCE public.approval_template_auto_rules_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.approval_template_auto_rules_id_seq TO service_role;
