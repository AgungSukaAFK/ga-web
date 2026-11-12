# Planning: Dashboard Insight Tahap 1

Dokumen ini adalah instruksi kerja untuk menambah 4 insight baru di halaman Dashboard (`/dashboard`). Ditulis supaya bisa dieksekusi langkah demi langkah oleh programmer junior atau model AI. **Ikuti urutan langkahnya, jangan loncat.**

---

## 0. Ringkasan

| # | Insight | Bentuk UI | Sumber data |
|---|---------|-----------|-------------|
| A | **Top barang di MR** + status stok GA | Tabel | `material_requests.orders` (json) + `ga_stocks` |
| B | **Top barang di PO** berdasarkan nilai Rp | Bar chart horizontal | `purchase_orders.items` (jsonb) |
| C | **Top vendor** berdasarkan nilai belanja | Tabel | `purchase_orders.vendor_details` + `total_price` |
| D | **Rata-rata waktu approval** MR & PO | Kartu angka | `approvals` (jsonb) di MR & PO |

Semua insight **mengikuti filter periode** (bulan/minggu) yang sudah ada di dashboard.

### Yang TIDAK dikerjakan di tahap ini
- Budget per cost center (sudah diputuskan tidak dipakai).
- Waktu approval **per approver** (sudah diputuskan tidak dipakai; cukup rata-rata keseluruhan).
- Item tahap 2 (lihat bagian 9).
- Jangan refactor kode dashboard yang sudah ada. Jangan tambah library baru.

### Ringkasan file yang disentuh

| Aksi | File |
|------|------|
| Baru | `supabase/migrations/0025_dashboard_insights.sql` |
| Baru | `services/dashboardInsightService.ts` |
| Baru | `components/dashboard/insights/top-mr-items-card.tsx` |
| Baru | `components/dashboard/insights/top-po-items-card.tsx` |
| Baru | `components/dashboard/insights/top-vendors-card.tsx` |
| Baru | `components/dashboard/insights/approval-time-card.tsx` |
| Ubah (sedikit) | `app/(With Sidebar)/dashboard/page.tsx` |

---

## 1. Baca dulu sebelum mulai

Baca file ini supaya paham polanya. Jangan diubah kecuali disebut di langkah.

1. `services/dashboardService.ts`: lihat `applyCompanyScope` (aturan filter company) dan `fetchDepartmentMrDistribution` (contoh memanggil RPC).
2. `app/(With Sidebar)/dashboard/page.tsx`: lihat `effectiveRange` (rentang tanggal terpilih), `profile` (berisi `company`), dan section chart `"Pipeline Barang MR"` (contoh bar chart horizontal recharts).
3. `components/content.tsx`: wrapper kartu (`title`, `description`, `className`).
4. `type/index.ts`: interface `Order` (item MR), `POItem` (item PO), `Approval`.
5. `type/enum.ts`: `APPROVAL_TYPE_*`, `MR_ITEM_STATUSES`, `INACTIVE_DOC_STATUSES`.
6. `lib/utils.ts`: `formatCurrency` (format Rupiah).

---

## 2. Aturan umum (WAJIB diikuti di semua langkah)

1. **Filter company** harus sama dengan `applyCompanyScope`:
   - User company `LOURDES` melihat semua data.
   - User company lain (GMI/GIS) melihat data company sendiri **dan** `LOURDES`.
   - Di SQL: `(p_company_code = 'LOURDES' OR x.company_code IN (p_company_code, 'LOURDES'))`.
   - Pengecualian: stok GA (`ga_stocks`) hanya dihitung dari company user sendiri (LOURDES = semua), karena stok itu fisik per gudang.
2. **Dokumen yang tidak dihitung:**
   - MR berstatus `Rejected` atau `Cancelled`.
   - PO berstatus `Rejected`, `Cancelled`, atau `Draft`.
   - Item MR yang `status`-nya `Cancelled` atau `Replaced`.
3. **Filter periode:** pakai `created_at` dokumen, kecuali insight D (waktu approval) yang pakai **waktu approval terakhir** (alasan: lihat langkah 1, RPC 4).
4. **Semua agregasi di database (RPC)**, bukan di browser. Data item ada di kolom JSON. Kalau diambil semua lalu dihitung di client, dashboard jadi berat.
5. RPC memakai `SECURITY INVOKER` (default) supaya RLS tetap berlaku. **Jangan** pakai `SECURITY DEFINER`.
6. Teks UI pakai Bahasa Indonesia, mengikuti gaya kartu yang sudah ada.
7. Setiap kartu insight **mengambil datanya sendiri** dan punya state loading/error sendiri. Kalau satu RPC gagal, sisa dashboard tetap jalan.

---

## 3. Langkah 1: Migration SQL (4 RPC)

Buat file `supabase/migrations/0025_dashboard_insights.sql` dengan isi di bawah, **persis**.

> **Cara menjalankan:** migration di project ini dijalankan manual lewat **SQL Editor Supabase** oleh pemilik project. Kalau kamu tidak punya akses, buat filenya saja lalu minta pemilik project menjalankannya. Langkah 2 dst. tetap bisa dikoding, tapi baru bisa dites setelah SQL ini dijalankan.

```sql
-- 0025_dashboard_insights.sql
--
-- RPC untuk 4 insight baru di Dashboard (planning-dashboard-insight.md):
--   1. get_dashboard_top_mr_items  : barang paling sering diminta di MR + stok GA
--   2. get_dashboard_top_po_items  : barang dengan nilai belanja PO terbesar
--   3. get_dashboard_top_vendors   : vendor dengan nilai belanja PO terbesar
--   4. get_dashboard_approval_time : rata-rata & median waktu approval MR / PO
--
-- Filter company sama dengan applyCompanyScope di services/dashboardService.ts:
-- LOURDES lihat semua; company lain lihat miliknya sendiri + LOURDES.
-- Semua fungsi SECURITY INVOKER (default) supaya RLS tetap berlaku.
-- Script idempotent (create or replace), aman dijalankan ulang.

-- ---------------------------------------------------------------------------
-- 1. Top barang di MR
-- ---------------------------------------------------------------------------
-- Ranking = jumlah MR berbeda yang berisi barang tsb (BUKAN jumlah qty, karena
-- satuan/UOM tiap MR bisa beda). Barang dikelompokkan per part_number; kalau
-- kosong, per barang_id; kalau kosong juga, per nama (lowercase).
create or replace function public.get_dashboard_top_mr_items(
  p_company_code text,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_limit int default 10
)
returns table (
  item_key text,
  barang_id bigint,
  part_number text,
  item_name text,
  mr_count bigint,
  line_count bigint,
  department_count bigint,
  in_catalog boolean,
  stock_qty numeric
)
language sql
stable
set search_path = public
as $$
  with lines as (
    select
      mr.id as mr_id,
      mr.department,
      mr.created_at,
      nullif(trim(o.elem->>'part_number'), '') as part_number,
      case when (o.elem->>'barang_id') ~ '^\d+$'
           then (o.elem->>'barang_id')::bigint end as barang_id,
      nullif(trim(o.elem->>'name'), '') as item_name
    from public.material_requests mr
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(mr.orders::jsonb) = 'array'
           then mr.orders::jsonb else '[]'::jsonb end
    ) as o(elem)
    where mr.created_at >= p_start_date
      and mr.created_at <= p_end_date
      and mr.status not in ('Rejected', 'Cancelled')
      and coalesce(o.elem->>'status', 'Pending') not in ('Cancelled', 'Replaced')
      and (p_company_code = 'LOURDES' or mr.company_code in (p_company_code, 'LOURDES'))
  ),
  grouped as (
    select
      coalesce('PN:' || upper(l.part_number),
               'ID:' || l.barang_id::text,
               'NM:' || lower(l.item_name)) as item_key,
      max(l.barang_id) as barang_id,
      max(l.part_number) as part_number,
      (array_agg(l.item_name order by l.created_at desc))[1] as item_name,
      count(distinct l.mr_id) as mr_count,
      count(*) as line_count,
      count(distinct l.department) as department_count
    from lines l
    where l.part_number is not null or l.barang_id is not null or l.item_name is not null
    group by 1
    order by count(distinct l.mr_id) desc, count(*) desc
    limit greatest(coalesce(p_limit, 10), 1)
  )
  select
    g.item_key,
    g.barang_id,
    g.part_number,
    g.item_name,
    g.mr_count,
    g.line_count,
    g.department_count,
    (g.barang_id is not null) as in_catalog,
    case when g.barang_id is null then null else (
      select coalesce(sum(s.quantity), 0)
      from public.ga_stocks s
      where s.barang_id = g.barang_id
        and (p_company_code = 'LOURDES' or s.company_code = p_company_code)
    ) end as stock_qty
  from grouped g
  order by g.mr_count desc, g.line_count desc;
$$;

-- ---------------------------------------------------------------------------
-- 2. Top barang di PO (berdasarkan nilai)
-- ---------------------------------------------------------------------------
-- Nilai = jumlah items[].total_price (fallback qty * price), SEBELUM pajak/
-- diskon/ongkir level PO. Hanya PO bermata uang IDR supaya tidak tercampur.
-- uom diisi kalau semua baris barang tsb pakai satuan yang sama, selain itu null.
create or replace function public.get_dashboard_top_po_items(
  p_company_code text,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_limit int default 10
)
returns table (
  item_key text,
  barang_id bigint,
  part_number text,
  item_name text,
  po_count bigint,
  total_value numeric,
  total_qty numeric,
  uom text
)
language sql
stable
set search_path = public
as $$
  with lines as (
    select
      po.id as po_id,
      po.created_at,
      nullif(trim(i.elem->>'part_number'), '') as part_number,
      case when (i.elem->>'barang_id') ~ '^\d+$'
           then (i.elem->>'barang_id')::bigint end as barang_id,
      nullif(trim(i.elem->>'name'), '') as item_name,
      case when (i.elem->>'qty') ~ '^-?\d+(\.\d+)?$'
           then (i.elem->>'qty')::numeric else 0 end as qty,
      case when (i.elem->>'price') ~ '^-?\d+(\.\d+)?$'
           then (i.elem->>'price')::numeric else 0 end as price,
      case when (i.elem->>'total_price') ~ '^-?\d+(\.\d+)?$'
           then (i.elem->>'total_price')::numeric end as line_total,
      nullif(trim(i.elem->>'uom'), '') as uom
    from public.purchase_orders po
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(po.items) = 'array' then po.items else '[]'::jsonb end
    ) as i(elem)
    where po.created_at >= p_start_date
      and po.created_at <= p_end_date
      and po.status not in ('Rejected', 'Cancelled', 'Draft')
      and coalesce(po.currency, 'IDR') = 'IDR'
      and (p_company_code = 'LOURDES' or po.company_code in (p_company_code, 'LOURDES'))
  )
  select
    coalesce('PN:' || upper(l.part_number),
             'ID:' || l.barang_id::text,
             'NM:' || lower(l.item_name)) as item_key,
    max(l.barang_id) as barang_id,
    max(l.part_number) as part_number,
    (array_agg(l.item_name order by l.created_at desc))[1] as item_name,
    count(distinct l.po_id) as po_count,
    sum(coalesce(l.line_total, l.qty * l.price)) as total_value,
    sum(l.qty) as total_qty,
    case when count(distinct l.uom) = 1 then max(l.uom) end as uom
  from lines l
  where l.part_number is not null or l.barang_id is not null or l.item_name is not null
  group by 1
  order by sum(coalesce(l.line_total, l.qty * l.price)) desc
  limit greatest(coalesce(p_limit, 10), 1);
$$;

-- ---------------------------------------------------------------------------
-- 3. Top vendor (berdasarkan nilai belanja)
-- ---------------------------------------------------------------------------
-- Nilai = purchase_orders.total_price (SUDAH termasuk pajak/diskon/ongkir).
-- Nama vendor: vendor_details.nama_vendor (format baru) -> vendor_details.name
-- (format lama) -> items[0].vendor_name -> '(Tanpa vendor)'.
create or replace function public.get_dashboard_top_vendors(
  p_company_code text,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_limit int default 10
)
returns table (
  vendor_name text,
  po_count bigint,
  total_value numeric,
  last_po_at timestamptz
)
language sql
stable
set search_path = public
as $$
  with pos as (
    select
      po.id,
      po.created_at,
      coalesce(po.total_price, 0) as total_price,
      coalesce(
        nullif(trim(po.vendor_details->>'nama_vendor'), ''),
        nullif(trim(po.vendor_details->>'name'), ''),
        nullif(trim(po.items->0->>'vendor_name'), ''),
        '(Tanpa vendor)'
      ) as vendor_name
    from public.purchase_orders po
    where po.created_at >= p_start_date
      and po.created_at <= p_end_date
      and po.status not in ('Rejected', 'Cancelled', 'Draft')
      and coalesce(po.currency, 'IDR') = 'IDR'
      and (p_company_code = 'LOURDES' or po.company_code in (p_company_code, 'LOURDES'))
  )
  select
    (array_agg(p.vendor_name order by p.created_at desc))[1] as vendor_name,
    count(*) as po_count,
    sum(p.total_price) as total_value,
    max(p.created_at) as last_po_at
  from pos p
  group by upper(p.vendor_name)
  order by sum(p.total_price) desc
  limit greatest(coalesce(p_limit, 10), 1);
$$;

-- ---------------------------------------------------------------------------
-- 4. Rata-rata waktu approval
-- ---------------------------------------------------------------------------
-- Waktu approval = dari dokumen dibuat (created_at) sampai step approval
-- TERAKHIR di-approve (max approvals[].processed_at).
-- Step "Payment Validator" & "Receiver" TIDAK dihitung (itu tahap bayar &
-- terima barang, bukan approval).
-- Dokumen dihitung hanya kalau SEMUA step approval-nya sudah approved dan
-- punya processed_at. Filter periode pakai waktu approval terakhir (bukan
-- created_at), supaya dokumen yang dibuat di akhir periode dan belum selesai
-- tidak membuat rata-rata bias.
-- Selalu mengembalikan 2 baris: 'MR' dan 'PO' (angka null kalau tidak ada data).
create or replace function public.get_dashboard_approval_time(
  p_company_code text,
  p_start_date timestamptz,
  p_end_date timestamptz
)
returns table (
  doc_type text,
  doc_count bigint,
  avg_hours numeric,
  median_hours numeric
)
language sql
stable
set search_path = public
as $$
  with docs as (
    select 'MR'::text as doc_type, mr.id, mr.created_at, mr.approvals
    from public.material_requests mr
    where mr.status not in ('Rejected', 'Cancelled')
      and (p_company_code = 'LOURDES' or mr.company_code in (p_company_code, 'LOURDES'))
    union all
    select 'PO'::text, po.id, po.created_at, po.approvals
    from public.purchase_orders po
    where po.status not in ('Rejected', 'Cancelled', 'Draft')
      and (p_company_code = 'LOURDES' or po.company_code in (p_company_code, 'LOURDES'))
  ),
  per_doc as (
    select
      d.doc_type,
      d.id,
      d.created_at,
      count(*) as step_count,
      count(*) filter (
        where s.elem->>'status' = 'approved'
          and nullif(s.elem->>'processed_at', '') is not null
      ) as done_count,
      max(nullif(s.elem->>'processed_at', '')::timestamptz) as approved_at
    from docs d
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(d.approvals) = 'array' then d.approvals else '[]'::jsonb end
    ) as s(elem)
    where coalesce(s.elem->>'type', '') not in ('Payment Validator', 'Receiver')
    group by d.doc_type, d.id, d.created_at
  ),
  done as (
    select
      p.doc_type,
      greatest(extract(epoch from (p.approved_at - p.created_at)) / 3600.0, 0) as hours
    from per_doc p
    where p.step_count > 0
      and p.done_count = p.step_count
      and p.approved_at >= p_start_date
      and p.approved_at <= p_end_date
  )
  select
    t.doc_type,
    count(d.hours) as doc_count,
    round(avg(d.hours)::numeric, 1) as avg_hours,
    round((percentile_cont(0.5) within group (order by d.hours))::numeric, 1) as median_hours
  from (values ('MR'), ('PO')) as t(doc_type)
  left join done d on d.doc_type = t.doc_type
  group by t.doc_type
  order by t.doc_type;
$$;

grant execute on function public.get_dashboard_top_mr_items(text, timestamptz, timestamptz, int) to authenticated;
grant execute on function public.get_dashboard_top_po_items(text, timestamptz, timestamptz, int) to authenticated;
grant execute on function public.get_dashboard_top_vendors(text, timestamptz, timestamptz, int) to authenticated;
grant execute on function public.get_dashboard_approval_time(text, timestamptz, timestamptz) to authenticated;
```

### Cek setelah SQL dijalankan (di SQL Editor)

```sql
-- Ganti 'GMI' dan rentang tanggal sesuai data yang ada.
select * from get_dashboard_top_mr_items('GMI', '2026-10-01', '2026-10-31 23:59:59', 10);
select * from get_dashboard_top_po_items('GMI', '2026-10-01', '2026-10-31 23:59:59', 10);
select * from get_dashboard_top_vendors('GMI', '2026-10-01', '2026-10-31 23:59:59', 10);
select * from get_dashboard_approval_time('GMI', '2026-10-01', '2026-10-31 23:59:59');

-- Cek mata uang PO. Kalau ada selain IDR, beri tahu pemilik project
-- (PO non-IDR sengaja tidak dihitung di insight B & C).
select currency, count(*) from purchase_orders group by 1;

-- Cek processed_at di approval. Kalau banyak yang null, rata-rata waktu
-- approval akan dihitung dari sedikit dokumen saja; laporkan ke pemilik project.
select
  count(*) filter (where s.elem->>'status' = 'approved') as approved_steps,
  count(*) filter (where s.elem->>'status' = 'approved'
                   and nullif(s.elem->>'processed_at', '') is null) as approved_tanpa_waktu
from material_requests m
cross join lateral jsonb_array_elements(m.approvals) s(elem)
where jsonb_typeof(m.approvals) = 'array';
```

**Selesai kalau:** keempat query di atas jalan tanpa error, dan `get_dashboard_approval_time` selalu mengembalikan 2 baris (`MR` dan `PO`).

---

## 4. Langkah 2: Service

Buat file `services/dashboardInsightService.ts`. Polanya sama dengan `fetchDepartmentMrDistribution`.

```ts
"use client";

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export interface InsightRangeInput {
  companyCode: string;
  startDate: string; // ISO string
  endDate: string; // ISO string
}

export interface TopMrItem {
  item_key: string;
  barang_id: number | null;
  part_number: string | null;
  item_name: string | null;
  mr_count: number;
  line_count: number;
  department_count: number;
  in_catalog: boolean;
  stock_qty: number | null; // null = barang non-katalog (stok tidak bisa dicek)
}

export interface TopPoItem {
  item_key: string;
  barang_id: number | null;
  part_number: string | null;
  item_name: string | null;
  po_count: number;
  total_value: number;
  total_qty: number;
  uom: string | null; // null = satuan campur
}

export interface TopVendor {
  vendor_name: string;
  po_count: number;
  total_value: number;
  last_po_at: string;
}

export interface ApprovalTimeRow {
  doc_type: "MR" | "PO";
  doc_count: number;
  avg_hours: number | null;
  median_hours: number | null;
}
```

Lalu buat 4 fungsi berikut:

| Fungsi | RPC | Return |
|--------|-----|--------|
| `fetchTopMrItems(input, limit = 10)` | `get_dashboard_top_mr_items` | `Promise<TopMrItem[]>` |
| `fetchTopPoItems(input, limit = 10)` | `get_dashboard_top_po_items` | `Promise<TopPoItem[]>` |
| `fetchTopVendors(input, limit = 10)` | `get_dashboard_top_vendors` | `Promise<TopVendor[]>` |
| `fetchApprovalTime(input)` | `get_dashboard_approval_time` | `Promise<ApprovalTimeRow[]>` |

Parameter RPC: `p_company_code`, `p_start_date`, `p_end_date`, dan `p_limit` (kecuali approval time).

**Penting:** Supabase mengembalikan kolom `bigint`/`numeric` bisa sebagai **string**. Di setiap fungsi, map hasilnya dan ubah semua kolom angka dengan `Number(...)`. Untuk kolom yang boleh null (`stock_qty`, `avg_hours`, `median_hours`, `barang_id`), pertahankan `null`: `x == null ? null : Number(x)`.

Contoh satu fungsi:

```ts
export const fetchTopVendors = async (
  { companyCode, startDate, endDate }: InsightRangeInput,
  limit = 10,
): Promise<TopVendor[]> => {
  const { data, error } = await supabase.rpc("get_dashboard_top_vendors", {
    p_company_code: companyCode,
    p_start_date: startDate,
    p_end_date: endDate,
    p_limit: limit,
  });
  if (error) throw error;

  return (data || []).map((row: any) => ({
    vendor_name: row.vendor_name,
    po_count: Number(row.po_count),
    total_value: Number(row.total_value),
    last_po_at: row.last_po_at,
  }));
};
```

**Selesai kalau:** `npx tsc --noEmit` tidak menambah error baru.

---

## 5. Langkah 3: Komponen kartu

Buat folder `components/dashboard/insights/`. Semua komponen:

- Diawali `"use client";`.
- Menerima props yang sama:
  ```ts
  interface InsightCardProps {
    companyCode: string;
    startDate: string; // ISO
    endDate: string;   // ISO
    className?: string;
  }
  ```
- Mengambil data sendiri di `useEffect` dengan dependency `[companyCode, startDate, endDate]`. Pakai flag `let cancelled = false` dan set `cancelled = true` di cleanup, supaya hasil request lama tidak menimpa hasil baru saat user cepat ganti bulan.
- Punya 3 tampilan state:
  - **Loading:** `<Skeleton className="h-[300px] w-full" />`
  - **Error:** teks kecil `text-sm text-muted-foreground`: "Gagal memuat data." Tidak pakai toast, supaya tidak spam toast kalau RPC belum dijalankan. Log error dengan `console.error`.
  - **Kosong:** teks "Belum ada data pada periode ini."
- Dibungkus `<Content size="md" title=... description=... className={className}>` dari `@/components/content`.
- Format Rupiah pakai `formatCurrency` dari `@/lib/utils`.

### 5A. `top-mr-items-card.tsx`: `TopMrItemsCard`

- **Judul:** "Barang Paling Sering Diminta (MR)"
- **Deskripsi:** "Berdasarkan jumlah MR yang memuat barang tersebut, periode terpilih."
- **Data:** `fetchTopMrItems(input, 10)`
- **Tampilan:** tabel (`Table`, `TableHeader`, `TableRow`, `TableHead`, `TableBody`, `TableCell` dari `@/components/ui/table`).

| Kolom | Isi |
|-------|-----|
| `#` | Nomor urut 1..10 |
| Barang | `item_name` (tebal). Di bawahnya `part_number` kecil abu-abu (`text-xs text-muted-foreground`), kalau ada. |
| Jumlah MR | `mr_count` (rata kanan) |
| Dept | `department_count` (rata kanan) |
| Stok GA | Badge, lihat aturan di bawah |

Aturan badge Stok GA (`Badge` dari `@/components/ui/badge`):

| Kondisi | Badge |
|---------|-------|
| `in_catalog === false` | `variant="outline"`, teks "Non-katalog" |
| `stock_qty === 0` | `variant="destructive"`, teks "Tidak ada stok" |
| `stock_qty > 0` | `variant="secondary"`, teks `Stok: {stock_qty}` |

Tambahan: baris dengan `stock_qty === 0` **dan** `department_count >= 2` diberi latar `bg-destructive/5`. Tambahkan juga keterangan kecil di bawah tabel: "Baris berwarna = diminta ≥2 departemen tapi stok GA kosong (kandidat untuk distok)."

Tabel harus bisa di-scroll horizontal di layar HP: bungkus dengan `<div className="overflow-x-auto">`.

### 5B. `top-po-items-card.tsx`: `TopPoItemsCard`

- **Judul:** "Barang dengan Belanja Terbesar (PO)"
- **Deskripsi:** "Total nilai barang di PO (sebelum pajak & diskon), periode terpilih."
- **Data:** `fetchTopPoItems(input, 10)`
- **Tampilan:** bar chart horizontal recharts. Contek pola section "Pipeline Barang MR" di `dashboard/page.tsx`:
  - `ResponsiveContainer width="100%" height={360}`
  - `BarChart layout="vertical"`
  - `XAxis type="number"`: tick diformat ringkas pakai helper lokal `formatShortRupiah`: `>= 1e9` → `"1,2 M"`, `>= 1e6` → `"3,4 jt"`, `>= 1e3` → `"5 rb"`.
  - `YAxis type="category" dataKey="label" width={160}`: `label` = `item_name`, dipotong maksimal 22 karakter + "…".
  - `Bar dataKey="total_value" fill="var(--color-po)" radius={[0, 4, 4, 0]}`
- **Tooltip custom** menampilkan:
  - nama barang lengkap + part number
  - "Nilai: {formatCurrency(total_value)}"
  - "Jumlah PO: {po_count}"
  - "Qty: {total_qty} {uom}". Kalau `uom` null tulis "Qty: {total_qty} (satuan beragam)".

  Style tooltip disamakan dengan `CustomTooltip` di `dashboard/page.tsx` (salin markup-nya, jangan import dari page).

> `var(--color-po)` didefinisikan di `<style>` dalam `dashboard/page.tsx`, jadi tetap terbaca selama kartu ini dirender di halaman dashboard.

### 5C. `top-vendors-card.tsx`: `TopVendorsCard`

- **Judul:** "Top Vendor"
- **Deskripsi:** "Berdasarkan total nilai PO (termasuk pajak), periode terpilih."
- **Data:** `fetchTopVendors(input, 10)`
- **Tampilan:** tabel.

| Kolom | Isi |
|-------|-----|
| `#` | Nomor urut |
| Vendor | `vendor_name`. Di bawahnya teks kecil "PO terakhir: {formatDateFriendly(last_po_at)}" (`formatDateFriendly` dari `@/lib/utils`) |
| Jumlah PO | `po_count` (rata kanan) |
| Total Nilai | `formatCurrency(total_value)` (rata kanan). Di bawahnya bar tipis porsi: `<div className="h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-primary" style={{ width: pct + "%" }} /></div>` dengan `pct = total_value / total_value vendor #1 * 100` |

Bungkus tabel dengan `<div className="overflow-x-auto">`.

### 5D. `approval-time-card.tsx`: `ApprovalTimeCard`

- **Judul:** "Rata-rata Waktu Approval"
- **Deskripsi:** "Dari dokumen dibuat sampai approval terakhir disetujui (tidak termasuk pembayaran & penerimaan barang). Dihitung dari dokumen yang selesai di-approve pada periode terpilih."
- **Data:** `fetchApprovalTime(input)`
- **Tampilan:** 2 blok berdampingan (`grid grid-cols-1 sm:grid-cols-2 gap-4`), satu untuk MR dan satu untuk PO. Tiap blok (`rounded-lg border p-4`) berisi:
  - Label kecil: "Material Request" / "Purchase Order"
  - Angka besar (`text-3xl font-bold`): `formatDuration(avg_hours)`
  - Baris kecil: "Median: {formatDuration(median_hours)}"
  - Baris kecil: "{doc_count} dokumen"
  - Kalau `doc_count === 0`: angka besar diganti "–" dan baris kecil "Belum ada dokumen selesai di-approve".
- **Helper lokal** `formatDuration(hours: number | null): string`:
  - `null` → `"–"`
  - `< 1` → `"< 1 jam"`
  - `< 24` → `` `${Math.round(hours)} jam` ``
  - `>= 24` → hari dengan 1 desimal, format Indonesia: `` `${(hours / 24).toLocaleString("id-ID", { maximumFractionDigits: 1 })} hari` ``

  Contoh: `30` → `"1,3 hari"`, `5.4` → `"5 jam"`.
- Tidak perlu skeleton setinggi 300px. Pakai `<Skeleton className="h-[140px] w-full" />`.

**Selesai kalau:** keempat file ada, `npx tsc --noEmit` dan `npm run lint` tidak menambah error baru.

---

## 6. Langkah 4: Pasang di halaman dashboard

Ubah `app/(With Sidebar)/dashboard/page.tsx`. **Perubahannya hanya tambahan**, jangan ubah logic lain.

1. Import 4 komponen dari `@/components/dashboard/insights/...`.
2. Cari section `<Content ... title="Pipeline Barang MR" ...>`. **Tepat setelah** penutup `</Content>` section itu, dan **sebelum** section "Material Request Terbaru", tambahkan:

```tsx
{profile?.company && (
  <>
    <TopMrItemsCard
      companyCode={profile.company}
      startDate={effectiveRange.start.toISOString()}
      endDate={effectiveRange.end.toISOString()}
      className="col-span-12 lg:col-span-7"
    />
    <ApprovalTimeCard
      companyCode={profile.company}
      startDate={effectiveRange.start.toISOString()}
      endDate={effectiveRange.end.toISOString()}
      className="col-span-12 lg:col-span-5"
    />
    <TopPoItemsCard
      companyCode={profile.company}
      startDate={effectiveRange.start.toISOString()}
      endDate={effectiveRange.end.toISOString()}
      className="col-span-12 lg:col-span-7"
    />
    <TopVendorsCard
      companyCode={profile.company}
      startDate={effectiveRange.start.toISOString()}
      endDate={effectiveRange.end.toISOString()}
      className="col-span-12 lg:col-span-5"
    />
  </>
)}
```

> `effectiveRange.start.toISOString()` menghasilkan string baru tiap render, tapi nilainya sama selama periode tidak berubah. `useEffect` di komponen membandingkan string, jadi **tidak** akan fetch ulang terus-menerus. Jangan diganti jadi object `Date` sebagai dependency.

3. **Jangan** masukkan fetch insight ke `Promise.all` di `loadDashboard`. Kartu insight sengaja fetch sendiri (aturan umum no. 7).

**Selesai kalau:** halaman dashboard tampil normal dengan 4 kartu baru, dan kartu lama tidak berubah.

---

## 7. Checklist pengujian manual

Jalankan `npm run dev`, buka `/dashboard`, lalu cek:

- [ ] Keempat kartu muncul di bawah "Pipeline Barang MR", dengan layout 7/5 kolom di desktop dan 1 kolom di HP.
- [ ] Ganti bulan (tombol ← →): keempat kartu menampilkan skeleton lalu data baru.
- [ ] Pilih minggu tertentu: data ikut berubah.
- [ ] Pilih bulan tanpa data: tiap kartu menampilkan "Belum ada data pada periode ini." Kartu approval menampilkan "–".
- [ ] Ganti bulan cepat beberapa kali: data yang tampil sesuai bulan terakhir yang dipilih (tidak tertimpa data lama).
- [ ] **Cross-check angka Top MR:** ambil 1 barang dari tabel, cari di halaman list MR dengan kata kunci part number/nama dan periode yang sama. Jumlah MR (selain Rejected/Cancelled) harus sama dengan kolom "Jumlah MR".
- [ ] **Cross-check badge stok:** untuk 1 barang katalog, cek angka stok di halaman stok GA. Harus sama.
- [ ] **Cross-check Top Vendor:** untuk vendor #1, jumlahkan total PO vendor itu di list PO dengan periode sama. Harus sama.
- [ ] **Cross-check waktu approval:** ambil 1–2 MR yang selesai di-approve bulan ini, hitung manual selisih tanggal dibuat dengan approval terakhir. Angkanya harus masuk akal dibanding rata-rata.
- [ ] Login sebagai user company **GMI**: data LOURDES ikut terhitung, data GIS tidak.
- [ ] Login sebagai user **LOURDES**: semua company terhitung.
- [ ] Dark mode: teks, badge, dan bar chart tetap terbaca.
- [ ] Kalau migration SQL belum dijalankan: kartu baru menampilkan "Gagal memuat data." dan kartu lama di dashboard **tetap normal**.

---

## 8. Kasus khusus & FAQ

| Pertanyaan | Jawaban |
|------------|---------|
| Kenapa Top MR pakai jumlah MR, bukan total qty? | Satuan tiap MR bisa beda (pcs, box, rim). Menjumlah qty beda satuan hasilnya menyesatkan. |
| Barang tanpa part number & tanpa barang_id? | Dikelompokkan per nama (huruf kecil). Nama yang ditulis beda ("Kertas A4" vs "kertas a-4") akan terpisah. Itu wajar, tidak perlu diakali. |
| Kenapa nilai Top Barang PO beda dengan Top Vendor? | Top Barang pakai harga item (sebelum pajak/diskon). Top Vendor pakai `total_price` PO (setelah pajak/diskon/ongkir). Sudah dijelaskan di deskripsi kartu. |
| PO mata uang asing? | Tidak dihitung di B & C. Lihat query cek mata uang di langkah 1. |
| Approval yang di-approve admin (override)? | Tetap dihitung, karena `processed_at` tetap terisi. |
| Dokumen yang approval-nya di-reset admin ke pending? | Tidak dihitung sampai semua step approved lagi. |
| Dokumen tanpa step approval sama sekali? | Tidak dihitung (`step_count > 0`). |
| Error `function ... does not exist` di console? | Migration 0025 belum dijalankan di Supabase. Lihat langkah 1. |
| Angka muncul sebagai string / NaN? | Lupa `Number(...)` di service (langkah 2). |

---

## 9. Backlog tahap 2 (JANGAN dikerjakan sekarang)

Dicatat supaya tidak lupa. Dikerjakan setelah tahap 1 dipakai dan dievaluasi.

1. Selisih harga part yang sama antar PO/vendor (harga termurah vs termahal).
2. Estimasi harga MR vs harga real PO.
3. Distribusi MR per departemen ditambah nilai Rp.
4. Tingkat reject MR per departemen.
5. Beban kerja purchasing (jumlah PO per pembuat).
6. User paling banyak membuat MR (hanya untuk admin).
7. Lead time MR → PO → barang diterima.

---

## 10. Saran urutan commit

1. `feat(dashboard): RPC insight dashboard (migration 0025)`
2. `feat(dashboard): service dashboardInsightService`
3. `feat(dashboard): kartu insight top barang, vendor, waktu approval`
4. `feat(dashboard): pasang kartu insight di halaman dashboard`
