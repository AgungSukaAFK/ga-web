-- 0002_mr_po.sql
--
-- Penyempurnaan modul inti: notifikasi realtime, status aktif user & cost
-- center, stok GA, pembayaran DP/BP & aset di PO, penerimaan barang, migrasi
-- status MR/PO, PPN tax-inclusive, statistik storage, auto-detect template
-- approval, goods receipt (BAST/QR), age tracking MR/PO, tipe vendor.
--
-- Gabungan beberapa migrasi lama, urutan asli dipertahankan & isinya
-- tidak diubah. Tiap bagian diawali penanda "asal: <file lama>".


-- ========================================================================
-- asal: notifications_setup.sql
-- ========================================================================

-- ============================================================================
--  NOTIFICATIONS SETUP  (jalankan SEKALI di Supabase → SQL Editor)
-- ----------------------------------------------------------------------------
--  Memperbaiki 2 akar masalah kenapa notifikasi selalu kosong:
--    1. RLS memblokir INSERT  → kita pakai RPC SECURITY DEFINER, bukan insert
--       langsung dari client. User tidak bisa membuat notif palsu atas nama
--       orang lain (actor_id selalu dipaksa = user yang sedang login).
--    2. Kolom resource_id bertipe uuid, padahal id MR/PO/PC adalah bigint
--       → kita ubah ke text supaya bisa menampung id apa pun.
--
--  Juga: mengaktifkan Realtime + memastikan policy SELECT/UPDATE benar.
--  Script ini IDEMPOTENT (aman dijalankan berulang).
-- ============================================================================

-- 1) resource_id: uuid -> text (id MR/PO/PC adalah bigint, bukan uuid) -------
alter table public.notifications
  alter column resource_id type text using resource_id::text;

-- 2) Pastikan RLS aktif -------------------------------------------------------
alter table public.notifications enable row level security;

-- 3) Policy SELECT: user hanya bisa melihat notif miliknya -------------------
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications
  for select
  to authenticated
  using (auth.uid() = user_id);

-- 4) Policy UPDATE: user hanya bisa update notif miliknya (tandai dibaca) ----
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- CATATAN: TIDAK ADA policy INSERT. Semua pembuatan notif HARUS lewat fungsi
-- create_notifications() di bawah (SECURITY DEFINER), supaya aman & terpusat.

-- 5) Fungsi pembuat notifikasi (dipanggil dari aplikasi via rpc) -------------
--    Input: array JSON, tiap elemen = 1 notif untuk 1 penerima.
--    Contoh elemen:
--    { "user_id": "...", "type": "mr_submitted", "title": "...",
--      "message": "...", "link": "/material-request/123",
--      "resource_id": "123", "resource_type": "material_request" }
create or replace function public.create_notifications(p_notifications jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_count integer;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if p_notifications is null
     or jsonb_typeof(p_notifications) <> 'array' then
    return 0;
  end if;

  insert into public.notifications
    (user_id, actor_id, type, title, message, link,
     resource_id, resource_type, is_read)
  select
    (elem->>'user_id')::uuid,
    v_actor,                                  -- actor selalu = pemanggil (anti-spoof)
    elem->>'type',
    elem->>'title',
    nullif(elem->>'message', ''),
    elem->>'link',
    nullif(elem->>'resource_id', ''),
    nullif(elem->>'resource_type', ''),
    false
  from jsonb_array_elements(p_notifications) as elem
  where coalesce(elem->>'user_id', '') <> ''   -- lewati penerima kosong
    and (elem->>'user_id')::uuid <> v_actor;    -- jangan notif diri sendiri

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Hanya user terautentikasi yang boleh memanggil fungsi ini ------------------
revoke all on function public.create_notifications(jsonb) from public;
grant execute on function public.create_notifications(jsonb) to authenticated;

-- 6) Aktifkan Realtime untuk tabel notifications -----------------------------
--    (abaikan error "already member" bila sudah pernah ditambahkan)
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when others then null;
end $$;

-- ============================================================================
--  SELESAI. Cara cepat tes dari SQL Editor (ganti <UUID_USER_ANDA>):
--    select public.create_notifications(
--      jsonb_build_array(jsonb_build_object(
--        'user_id','<UUID_USER_ANDA>', 'type','info',
--        'title','Tes Notifikasi', 'message','Halo dunia',
--        'link','/notifications'
--      ))
--    );
--  Lalu cek: select * from public.notifications order by created_at desc;
-- ============================================================================


-- ========================================================================
-- asal: user_active_status_setup.sql
-- ========================================================================

-- ============================================================================
-- Fitur: Nonaktifkan / Aktifkan User (Soft Delete)
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor.
--
-- Konsep:
--   * Kolom `is_active` pada tabel `profiles` menjadi satu-satunya sumber
--     kebenaran status akun.
--   * User dengan is_active = false dianggap "tidak ada" oleh sistem:
--       - tidak bisa login / mengakses halaman (diblokir di login & middleware),
--       - tidak muncul di pemilihan user (template approval, mention, dll),
--     namun datanya TETAP ada di database sehingga sewaktu-waktu bisa
--     diaktifkan kembali untuk keperluan audit/review.
--
-- Catatan: aplikasi membaca `is_active` langsung dari tabel `profiles`,
-- sehingga TIDAK wajib mengubah view `users_with_profiles`. (Lihat bagian
-- opsional di bawah bila Anda ingin kolom ini ikut tampil di view.)
-- ============================================================================

-- 1) Tambah kolom is_active (default aktif, dan backfill semua user lama => aktif)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 2) Index parsial untuk mempercepat pencarian user nonaktif (audit) bila perlu
CREATE INDEX IF NOT EXISTS idx_profiles_is_active
  ON public.profiles (is_active);

-- ----------------------------------------------------------------------------
-- (OPSIONAL) Jika Anda ingin kolom is_active juga muncul di view
-- `users_with_profiles`, recreate view dengan menambahkan `p.is_active`.
-- Sesuaikan definisi di bawah dengan definisi view Anda saat ini
-- (jalankan `select pg_get_viewdef('public.users_with_profiles', true);`
-- untuk melihat definisi aslinya terlebih dahulu).
-- Aplikasi TIDAK bergantung pada langkah ini.
-- ----------------------------------------------------------------------------
-- CREATE OR REPLACE VIEW public.users_with_profiles AS
-- SELECT
--   p.*,                 -- pastikan kolom p.is_active ikut terbawa
--   u.email AS email
-- FROM public.profiles p
-- JOIN auth.users u ON u.id = p.id;


-- ========================================================================
-- asal: cost_center_active_status_setup.sql
-- ========================================================================

-- ============================================================================
-- Fitur: Nonaktifkan / Aktifkan Cost Center
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor.
--
-- Konsep:
--   * Kolom `is_active` pada tabel `cost_centers` menjadi penanda apakah CC
--     boleh dipilih.
--   * CC dengan is_active = false TIDAK muncul di combobox pemilihan/filter
--     cost center di halaman lain (lihat services/mrService.ts -> fetchActiveCostCenters),
--     namun datanya TETAP ada sehingga MR/PO/Petty Cash lama yang sudah memakai
--     CC tersebut tidak rusak, dan CC bisa diaktifkan kembali sewaktu-waktu.
--   * Halaman Manajemen Cost Center tetap menampilkan SEMUA CC (aktif & nonaktif)
--     agar admin bisa mengaktifkan kembali.
-- ============================================================================

-- 1) Tambah kolom is_active (default aktif, backfill semua CC lama => aktif)
ALTER TABLE public.cost_centers
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 2) Index parsial untuk mempercepat pengambilan CC aktif (dipakai combobox)
CREATE INDEX IF NOT EXISTS idx_cost_centers_is_active
  ON public.cost_centers (is_active);


-- ========================================================================
-- asal: ga_stock_setup.sql
-- ========================================================================

-- ============================================================================
-- Fitur: Stok GA
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor.
--
-- Konsep:
--   * Tabel `ga_stocks` menyimpan stok yang dikelola GA. TIDAK semua barang
--     punya stok — hanya barang yang sengaja ditambahkan GA.
--   * Stok bersifat PER PERUSAHAAN: satu barang bisa punya stok berbeda di tiap
--     company (GMI / GIS / LOURDES). Keunikan dijaga (barang_id, company_code).
--   * Hanya GA & Admin yang mengakses (di-gate di sisi aplikasi).
-- ============================================================================

create table if not exists public.ga_stocks (
  id           bigint generated always as identity primary key,
  barang_id    bigint not null references public.barang (id) on delete cascade,
  company_code text   not null,
  quantity     numeric not null default 0,
  location     text,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz,
  updated_by   uuid references public.profiles (id),
  -- Satu baris stok per barang per perusahaan
  unique (barang_id, company_code)
);

create index if not exists idx_ga_stocks_barang
  on public.ga_stocks (barang_id);

create index if not exists idx_ga_stocks_company
  on public.ga_stocks (company_code);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
-- Tabel ini terkena RLS. Tanpa policy, semua operasi ditolak
-- ("new row violates row-level security policy").
-- Pembatasan GA & Admin sudah di-gate di sisi aplikasi (UI + guard halaman),
-- jadi di sini cukup mengizinkan user yang sudah login (authenticated),
-- konsisten dengan tabel lain (cost_centers, barang, dll).
-- ----------------------------------------------------------------------------
alter table public.ga_stocks enable row level security;

drop policy if exists "ga_stocks_select" on public.ga_stocks;
create policy "ga_stocks_select" on public.ga_stocks
  for select to authenticated using (true);

drop policy if exists "ga_stocks_insert" on public.ga_stocks;
create policy "ga_stocks_insert" on public.ga_stocks
  for insert to authenticated with check (true);

drop policy if exists "ga_stocks_update" on public.ga_stocks;
create policy "ga_stocks_update" on public.ga_stocks
  for update to authenticated using (true) with check (true);

drop policy if exists "ga_stocks_delete" on public.ga_stocks;
create policy "ga_stocks_delete" on public.ga_stocks
  for delete to authenticated using (true);


-- ========================================================================
-- asal: po_dp_bp_payment_setup.sql
-- ========================================================================

-- ============================================================================
-- Fitur: Progress Pembayaran DP & BP (Pelunasan) pada Purchase Order
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor.
--
-- Konsep:
--   * PO dengan payment_term "DP & Pelunasan" (mis. "DP 30% - Pelunasan 70%")
--     dibayar dalam 2 tahap: DP (Down Payment) lalu BP/Pelunasan (Balance Payment).
--   * Kolom `dp_paid` & `bp_paid` menandai tahap mana yang sudah dibayar.
--     Diisi oleh Finance (approver bertipe "Payment Validator") lewat checkbox
--     saat approve PO (lihat purchase-order/[id]/page.tsx).
--   * PO baru dianggap "Paid" (isPoPaid) & lanjut status "Pending BAST" begitu
--     dp_paid DAN bp_paid sama-sama true. Selama belum lunas, approval Payment
--     Validator tetap "pending" dan PO tertahan di status "Pending Payment".
-- ============================================================================

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS dp_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bp_paid boolean NOT NULL DEFAULT false;


-- ========================================================================
-- asal: po_asset_separation_setup.sql
-- ========================================================================

-- ============================================================================
-- Fitur: Pemisahan PO Asset vs PO Barang Biasa (Goods)
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor.
--
-- Konsep:
--   * 1 PO tidak boleh mencampur item asset (barang.is_asset = true) dengan
--     item goods biasa - dicegah di level aplikasi saat purchasing menambah
--     item ke PO (lihat purchase-order/create/page.tsx).
--   * Kolom `is_asset` di sini menyimpan status itu di level PO (dihitung
--     dari item-item-nya saat PO dibuat), dipakai untuk filter/tampilan
--     tanpa perlu parsing kode_po.
--   * kode_po PO asset otomatis dapat tambahan segmen "/AST/" (mis.
--     "GMI/PO/AST/VIII/26/HO/1") sebagai penanda visual, dengan nomor urut
--     yang TETAP satu rangkaian dengan PO biasa (bukan counter terpisah).
-- ============================================================================

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS is_asset boolean NOT NULL DEFAULT false;


-- ========================================================================
-- asal: dp_bp_shipping_variant_setup.sql
-- ========================================================================

-- ============================================================================
-- Fitur: Varian Pengiriman DP & BP + Level Fisik per Item MR
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor.
--
-- Konsep:
--   * PO dengan payment_term "DP & Pelunasan" sekarang punya 2 varian:
--     - "ship_after_dp": barang dikirim begitu DP dibayar, Pelunasan (BP)
--       menyusul belakangan. Approval Payment Validator selesai begitu DP
--       lunas; PO masuk status "Pending Payment BP" (bukan langsung
--       "Pending BAST"), dan baru pindah ke "Pending BAST" setelah BP lunas.
--     - "ship_after_full_payment": barang baru dikirim setelah DP+BP lunas
--       semua (perilaku lama, tidak berubah).
--   * Level per item MR (Open 1/2/3A/3B/4/5/Close) disimpan di kolom `orders`
--     (JSONB) milik material_requests, sama seperti `status` per item - tidak
--     perlu migration terpisah untuk itu.
-- ============================================================================

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS dp_bp_shipping_type text;

-- material_requests.level punya CHECK constraint (chk_level) yang cuma izinin
-- nilai granular lama ('OPEN 1'..'OPEN 5','CLOSE 1'..'CLOSE 3'). MR.level
-- sekarang jadi agregat sederhana ('OPEN'/'CLOSE') dari level item-itemnya
-- (lihat recalculateMrLevel di mrService.ts), jadi constraint-nya perlu
-- ditambah izinin 2 nilai baru itu juga (nilai lama tetap diizinkan biar
-- data lama & dropdown override manual admin tetap valid).
ALTER TABLE public.material_requests DROP CONSTRAINT IF EXISTS chk_level;
ALTER TABLE public.material_requests ADD CONSTRAINT chk_level CHECK (
  level = ANY (ARRAY[
    'OPEN 1', 'OPEN 2', 'OPEN 3A', 'OPEN 3B', 'OPEN 4', 'OPEN 5',
    'CLOSE 1', 'CLOSE 2A', 'CLOSE 2B', 'CLOSE 3',
    'OPEN', 'CLOSE'
  ])
);


-- ========================================================================
-- asal: po_receive_record_setup.sql
-- ========================================================================

-- ============================================================================
-- Fitur: Checklist Penerimaan Barang (Receiver) + status Full/Partial Receive
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor.
--
-- Konsep:
--   * `receive_record` menyimpan SATU checklist qty-per-item terakhir yang
--     disubmit Receiver (baik lewat step approval "Receiver" maupun tombol
--     GA Receive manual - keduanya pakai modal & fungsi yang sama, lihat
--     submitReceiveRecord di services/purchaseOrderService.ts). Record ini
--     DITIMPA setiap kali receiver mengedit ulang (bukan log bertumpuk).
--   * Kalau qty diterima semua item persis sama dengan qty PO, PO jadi
--     "Full Received". Kalau ada yang kurang/tidak datang sama sekali,
--     PO jadi "Partial Receive" sampai receiver mengedit checklist-nya
--     sampai sesuai.
-- ============================================================================

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS receive_record jsonb;


-- ========================================================================
-- asal: po_status_migration.sql
-- ========================================================================

-- ============================================================================
-- Migrasi data lama: status PO "Pending BAST" / "Pending Payment BP" /
-- "Completed" (dihapus dari kosakata status PO) -> "Pending Receive" /
-- "Full Received" (lihat po-receive-record-setup.sql untuk fitur barunya).
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor, SETELAH menjalankan
-- po-receive-record-setup.sql. Best-effort untuk data lama - PO lama tidak
-- punya checklist qty per item (fitur baru), jadi tidak ada `receive_record`
-- yang bisa direkonstruksi; PO yang di-backfill jadi "Full Received" di sini
-- TIDAK akan punya riwayat receive yang bisa dicetak/diedit sampai receiver
-- mengeditnya manual lewat modal baru.
-- ============================================================================

-- 1) "Completed" (status akhir lama) -> "Full Received" (status akhir baru).
--    Tidak ambigu, sama-sama berarti "sudah beres semua".
UPDATE public.purchase_orders
SET status = 'Full Received'
WHERE status = 'Completed';

-- 2) "Pending BAST" / "Pending Payment BP" -> tergantung apakah GA sudah
--    sempat klik tombol "GA Receive" versi LAMA (sebelum checklist qty ada).
--    Aksi lama itu menaikkan level item MR yang di-cover PO ini ke
--    "Open 5"/"Close" TANPA mengubah status PO - jadi kita deteksi "sudah
--    diterima" dengan mengecek semua item PO ini levelnya sudah di situ.
--    Kalau sudah -> anggap "Full Received" (tidak ada data mismatch dari
--    dulu, satu-satunya asumsi yang masuk akal). Kalau belum -> "Pending
--    Receive" (memang belum pernah diterima sama sekali).
UPDATE public.purchase_orders po
SET status = 'Full Received'
WHERE po.status IN ('Pending BAST', 'Pending Payment BP')
  AND po.mr_id IS NOT NULL
  AND jsonb_array_length(COALESCE(po.items::jsonb, '[]'::jsonb)) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(po.items::jsonb) AS item
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.material_requests mr,
           jsonb_array_elements(mr.orders::jsonb) AS ord
      WHERE mr.id = po.mr_id
        AND ord->>'part_number' = item->>'part_number'
        AND ord->>'level' IN ('Open 5', 'Close')
    )
  );

UPDATE public.purchase_orders
SET status = 'Pending Receive'
WHERE status IN ('Pending BAST', 'Pending Payment BP');


-- ========================================================================
-- asal: mr_status_migration.sql
-- ========================================================================

-- ============================================================================
-- Migrasi data lama: status MR "Pending BAST" / "Completed" (dihapus dari
-- kosakata status MR, disamakan dengan penamaan status PO) -> "Pending
-- Receive" / "Partial Receive" / "Full Received" (lihat recalculateMrStatus
-- di services/mrService.ts untuk logic barunya).
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor, SETELAH deploy perubahan
-- kode terkait. Status "Pending BAST" SEBAGAI STATUS ITEM (per barang di
-- dalam MR, field orders[].status) TIDAK berubah/tidak disentuh skrip ini -
-- yang diganti cuma status MR (material_requests.status).
--
-- Status baru dihitung ulang dari agregat item di `orders` (sama seperti
-- recalculateMrStatus), bukan sekadar rename 1:1, karena "Pending BAST" lama
-- bisa saja sekarang sudah "Partial Receive" atau "Full Received" kalau ada
-- item yang sempat di-BAST setelah status MR terakhir dihitung.
-- ============================================================================

WITH item_agg AS (
  SELECT
    mr.id,
    bool_and(ord->>'status' = 'Completed') AS all_completed,
    bool_or(ord->>'status' = 'Completed') AS some_completed,
    bool_and(
      ord->>'status' IN ('Pending BAST', 'Completed')
      OR ord->>'level' IN ('Open 3A', 'Open 3B', 'Open 4', 'Open 5', 'Close')
    ) AS all_linked
  FROM public.material_requests mr,
       jsonb_array_elements(COALESCE(mr.orders::jsonb, '[]'::jsonb)) AS ord
  WHERE mr.status IN ('Pending BAST', 'Completed')
    AND ord->>'status' IS DISTINCT FROM 'Cancelled'
  GROUP BY mr.id
)
UPDATE public.material_requests mr
SET status = CASE
  WHEN item_agg.all_completed THEN 'Full Received'
  WHEN item_agg.all_linked AND item_agg.some_completed THEN 'Partial Receive'
  WHEN item_agg.all_linked THEN 'Pending Receive'
  ELSE 'On Process'
END
FROM item_agg
WHERE mr.id = item_agg.id
  AND mr.status <> CASE
    WHEN item_agg.all_completed THEN 'Full Received'
    WHEN item_agg.all_linked AND item_agg.some_completed THEN 'Partial Receive'
    WHEN item_agg.all_linked THEN 'Pending Receive'
    ELSE 'On Process'
  END;


-- ========================================================================
-- asal: po_tax_included_setup.sql
-- ========================================================================

-- ============================================================================
-- Fitur: Info PPN saat harga item PO sudah termasuk pajak (tax-inclusive)
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor.
--
-- Latar belakang: form create/edit PO sudah lama punya checkbox "Harga Item
-- Sudah Termasuk PPN?", tapi flag-nya cuma state lokal di form - gak pernah
-- disimpan ke DB. Kalau dicentang, `tax` cuma di-nol-in, jadi PO yang
-- harganya sudah termasuk PPN keliatan identik di DB dengan PO yang PPN-nya
-- 0% - detail page & cetak PDF cuma bisa nebak-nebak dari situ.
--
-- Kolom baru:
--   * tax_included: true kalau harga item di PO ini sudah termasuk PPN.
--     `tax` TETAP 0 saat true (gak ada nominal tambahan ke total - PPN-nya
--     udah nempel di harga item), cuma dipakai UI buat nampilin info PPN
--     (lihat ppn_rate) tanpa mengubah harga/total.
--   * ppn_rate: persentase PPN yang dipakai (mis. 11) - baik pas
--     tax_included true (buat hitung info PPN = subtotal x ppn_rate%)
--     maupun false (tau tarif yang dipakai ngitung `tax`, gak perlu ditebak
--     dari tax/dpp lagi). Null utk PO lama sebelum kolom ini ada, atau saat
--     admin pakai mode input manual (bukan persentase).
--
-- PO lama (dibuat sebelum fitur ini) tetap tax_included=false secara
-- default - kalau dulu PO itu sebenarnya tax-inclusive, ambiguitasnya
-- (sama seperti dulu) baru hilang begitu PO-nya diedit ulang & checkbox-nya
-- dicentang ulang.
-- ============================================================================

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS tax_included boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ppn_rate numeric NULL;


-- ========================================================================
-- asal: po_tax_included_vendor_backfill.sql
-- ========================================================================

-- ============================================================================
-- Backfill tax_included/ppn_rate PO lama, berdasarkan nama vendor
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor, SETELAH
-- po-tax-included-setup.sql (kolom tax_included/ppn_rate harus sudah ada).
--
-- Aturan (sama seperti auto-detect di form create/edit PO, lihat
-- isMarketplaceVendor di type/enum.ts):
--   * Vendor yang namanya mengandung "Tokopedia"/"Tokped"/"Shopee"/"Shope"
--     (case-insensitive) -> PPN dianggap flat 0% (BUKAN "termasuk" - beneran
--     gak ada PPN, transaksi marketplace). tax jadi 0, tax_included=false,
--     ppn_rate=0.
--   * Vendor lain yang tax-nya MASIH 0 (ambigu, sebelum fitur ini gak ada
--     cara tau apa itu inclusive atau emang 0%) -> anggap harga sudah
--     termasuk PPN 11% (tax_included=true, ppn_rate=11), sesuai instruksi.
--   * PO yang tax-nya SUDAH > 0 (nominal PPN eksklusif beneran pernah
--     dibayar/dicatat) TIDAK disentuh tax_included/tax-nya - itu data
--     finansial asli, bukan ambigu. Cuma ppn_rate-nya di-backfill (dihitung
--     dari tax/subtotal) biar detail/cetak gak perlu nebak dari situ lagi.
--
-- Skrip ini idempotent - PO yang ppn_rate-nya sudah keisi (baik dari fitur
-- baru maupun dari run sebelumnya) dilewati (WHERE ppn_rate IS NULL), aman
-- dijalankan ulang.
-- ============================================================================

-- 1) Vendor marketplace -> PPN 0% flat.
UPDATE public.purchase_orders
SET tax = 0, tax_included = false, ppn_rate = 0
WHERE ppn_rate IS NULL
  AND (
    (vendor_details->>'nama_vendor') ILIKE '%tokopedia%' OR
    (vendor_details->>'nama_vendor') ILIKE '%tokped%' OR
    (vendor_details->>'nama_vendor') ILIKE '%shopee%' OR
    (vendor_details->>'nama_vendor') ILIKE '%shope%'
  );

-- 2) Vendor lain, tax masih 0 (ambigu) -> anggap inclusive PPN 11%.
UPDATE public.purchase_orders
SET tax_included = true, ppn_rate = 11
WHERE ppn_rate IS NULL
  AND tax = 0
  AND NOT (
    (vendor_details->>'nama_vendor') ILIKE '%tokopedia%' OR
    (vendor_details->>'nama_vendor') ILIKE '%tokped%' OR
    (vendor_details->>'nama_vendor') ILIKE '%shopee%' OR
    (vendor_details->>'nama_vendor') ILIKE '%shope%'
  );

-- 3) PO dengan tax > 0 (PPN eksklusif asli) - backfill ppn_rate doang buat
--    ditampilkan, tax_included tetap false (default kolom), tax-nya TIDAK
--    diubah.
WITH item_agg AS (
  SELECT
    po.id,
    SUM((item->>'price')::numeric * (item->>'qty')::numeric) AS subtotal
  FROM public.purchase_orders po,
       jsonb_array_elements(po.items::jsonb) AS item
  WHERE po.ppn_rate IS NULL AND po.tax > 0
  GROUP BY po.id
)
UPDATE public.purchase_orders po
SET ppn_rate = ROUND(
  (po.tax / NULLIF(item_agg.subtotal - COALESCE(po.discount, 0), 0)) * 100
)
FROM item_agg
WHERE po.id = item_agg.id
  AND (item_agg.subtotal - COALESCE(po.discount, 0)) > 0;


-- ========================================================================
-- asal: file_management_storage_stats_rpc.sql
-- ========================================================================

-- File Management (admin) - storage size/date lookup.
--
-- Jalankan SEKALI lewat SQL Editor Supabase, di KEDUA project berikut:
--   1. Project Supabase Cloud utama (yang dipakai auth/db + attachment lama)
--   2. Project Supabase VPS self-hosted (VPS_SUPABASE_URL)
--
-- Fungsi ini membaca storage.objects (size & created_at asli tiap file) dalam
-- satu query, dipakai halaman /file-management supaya tidak perlu memanggil
-- storage.list() folder-per-folder (bisa ribuan request kalau file terorganisir
-- per kode_mr/kode_po).

create or replace function public.get_storage_object_stats(p_bucket_id text)
returns table (name text, size bigint, created_at timestamptz)
language sql
security definer
set search_path = storage, public
as $$
  select
    o.name,
    coalesce((o.metadata->>'size')::bigint, 0) as size,
    o.created_at
  from storage.objects o
  where o.bucket_id = p_bucket_id;
$$;

grant execute on function public.get_storage_object_stats(text) to service_role;


-- ========================================================================
-- asal: approval_template_auto_detect_setup.sql
-- ========================================================================

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


-- ========================================================================
-- asal: goods_receipt_setup.sql
-- ========================================================================

-- Fitur Cetak BAST + Scan QR Goods Receipt Confirmation.
--
-- 1. app_settings: tabel key/value generik, admin-editable, dipakai buat
--    nyimpen "kode global" penerimaan barang (passphrase bersama, plain
--    text sesuai keputusan user - bukan di-hash).
-- 2. purchase_orders.receipt_token: token acak unik per PO, dipakai sebagai
--    URL publik `/goods-receipt/<token>` yang di-encode ke QR code di BAST.
--    Di-generate sekali (lazy, saat pertama kali "Cetak BAST" diklik) dan
--    dipakai ulang di reprint - BUKAN dirotasi tiap cetak.
-- 3. purchase_orders.goods_receipt: snapshot hasil konfirmasi penerimaan
--    (nama penerima, waktu, qty & foto per item) - sekali diisi, PO ini
--    dianggap "sudah diterima" dan token-nya jadi single-use (re-scan cuma
--    nampilin info, gak bisa submit ulang).
-- 4. Service account "Publik (Scan QR)": dipakai sebagai actor/user_id di
--    activity_logs & updated_by saat konfirmasi datang dari scan QR publik
--    TANPA login (kode global doang) - supaya FK ke auth.users tetap valid
--    tanpa perlu bikin kolom nullable. Nama penerima yang sesungguhnya
--    selalu tersimpan terpisah di goods_receipt.receiver_name.

create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.app_settings (key, value)
  values ('goods_receipt_global_code', 'GANTI-KODE-INI')
  on conflict (key) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "Admin can read app_settings" on public.app_settings;
create policy "Admin can read app_settings" on public.app_settings
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admin can update app_settings" on public.app_settings;
create policy "Admin can update app_settings" on public.app_settings
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

alter table public.purchase_orders
  add column if not exists receipt_token text unique,
  add column if not exists goods_receipt jsonb;

create index if not exists idx_purchase_orders_receipt_token
  on public.purchase_orders (receipt_token);

-- Service account buat konfirmasi via kode global (tanpa login). Password
-- di-random & tidak pernah dipakai untuk login normal - akun ini murni
-- sebagai "actor" placeholder di FK, bukan akun yang bisa dipakai orang.
do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = 'public-scan@internal.garudamart.local';

  if v_user_id is null then
    v_user_id := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) values (
      v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'public-scan@internal.garudamart.local', crypt(gen_random_uuid()::text, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}', '{}'
    );
  end if;

  -- Trigger `handle_new_user` di atas otomatis bikin row profiles kosong
  -- (role 'user') begitu insert auth.users di atas jalan - jadi di sini
  -- harus UPSERT (bukan ON CONFLICT DO NOTHING) supaya nama/role/is_active
  -- yang benar tetap ke-set walau row-nya sudah ada duluan dari trigger.
  insert into public.profiles (id, nama, role, department, company, email, is_active)
  values (
    v_user_id, 'Publik (Scan QR)', 'system', 'System', null,
    'public-scan@internal.garudamart.local', false
  )
  on conflict (id) do update set
    nama = excluded.nama,
    role = excluded.role,
    department = excluded.department,
    is_active = excluded.is_active;
end $$;


-- ========================================================================
-- asal: mr_po_age_tracking_setup.sql
-- ========================================================================

-- ============================================================================
-- Fitur: Umur MR & PO (dari dibuat sampai Full Received)
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor.
--
-- Konsep:
--   * `material_requests` TIDAK punya kolom updated_at sama sekali, dan
--     `purchase_orders.updated_at` di-auto-update trigger `handle_updated_at`
--     pada SETIAP perubahan row (bukan cuma pas Full Received) - jadi
--     keduanya tidak bisa dipakai buat tau "kapan status jadi Full Received".
--   * Kolom baru `full_received_at` di kedua tabel, distempel SEKALI pas
--     status pertama kali jadi "Full Received" (lihat recalculateMrStatus di
--     services/mrService.ts, dan submitReceiveRecord/handleApprovalAction/
--     handleEditDpBpPayment yang manggil deriveReceiveDrivenStatus di
--     services/purchaseOrderService.ts & purchase-order/[id]/page.tsx).
--   * Data lama yang sudah Full Received SEBELUM fitur ini ada TIDAK
--     di-backfill (kolomnya NULL) - UI menampilkan "-" untuk kasus itu,
--     sesuai keputusan user. MR/PO baru ke depannya otomatis tercatat akurat.
-- ============================================================================

ALTER TABLE public.material_requests
  ADD COLUMN IF NOT EXISTS full_received_at timestamp with time zone;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS full_received_at timestamp with time zone;


-- ========================================================================
-- asal: vendor_tipe_setup.sql
-- ========================================================================

-- ============================================================================
-- Fitur: Klasifikasi Vendor (HO / Branch / Site)
-- ----------------------------------------------------------------------------
-- Jalankan skrip ini SEKALI di Supabase SQL Editor.
--
-- Konsep:
--   * Kolom `tipe_vendor` pada tabel `vendors` menandai cakupan vendor:
--     'HO' (Head Office), 'Branch' (Cabang), atau 'Site' (Lokasi Proyek).
--   * Nullable & tanpa default - vendor lama yang belum diklasifikasi akan
--     tampil "-" di UI sampai admin mengisinya lewat form Edit Vendor.
-- ============================================================================

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS tipe_vendor text;

ALTER TABLE public.vendors
  DROP CONSTRAINT IF EXISTS vendors_tipe_vendor_check;

ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_tipe_vendor_check
  CHECK (tipe_vendor IS NULL OR tipe_vendor IN ('HO', 'Branch', 'Site'));

CREATE INDEX IF NOT EXISTS idx_vendors_tipe_vendor
  ON public.vendors (tipe_vendor);
