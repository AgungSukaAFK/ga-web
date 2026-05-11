# Outline Pengembangan Modul Petty Cash (Kas Kecil)

Modul ini memfasilitasi pengajuan dana operasional skala kecil. Dirancang sebagai **sistem yang terisolasi** dari alur Material Request (MR) dan Purchase Order (PO), dengan halaman manajemen dan persetujuan (approval) yang berdiri sendiri.

## Alur Kerja (Workflow) Petty Cash Standalone

1. **Pengajuan (Create):** User mengisi form Petty Cash (Reimbursement / Cash Advance), nominal, tujuan, cost center, dan unggah bukti/struk awal.
2. **Persetujuan (Approval) Khusus PC:** - Dokumen masuk ke status `Pending Approval`.
   - Atasan / Finance / GA akan menyetujui langsung melalui halaman khusus Petty Cash (bukan di halaman validasi MR/PO). Alur persetujuannya linier dan lebih sederhana (misal: Dept Head -> Finance).
3. **Pencairan & Settlement:** - Jika _Reimbursement_, setelah disetujui Finance, status langsung menjadi `Settled`.
   - Jika _Cash Advance_, Finance menandai `Cash Distributed`, lalu User wajib melakukan _Settlement_ (unggah struk aktual). Setelah diverifikasi Finance, status menjadi `Settled`.
4. **Budgeting:** Tetap memotong tabel `cost_centers` dan tercatat di `cost_center_history`.

---

## Tahap 1: Persiapan Database (Supabase)

Pembuatan tabel baru khusus untuk Petty Cash.

- **Tabel `petty_cash_requests`**:
  - Kolom: `id`, `kode_pc` (Unik per company), `user_id`, `company_code`, `department`, `cost_center_id`, `type`, `amount`, `purpose`, `status`.
  - Kolom tambahan untuk workflow: `actual_amount` (nominal riil saat settlement).
  - Kolom JSONB: `approvals` (riwayat siapa saja yang sudah approve PC ini), `attachments`, `settlement_attachments`.
  - Timestamps: `created_at`, `updated_at`, `needed_date`.

## Tahap 2: Definisi Type & Interface (`type/index.ts`)

- Menambahkan interface `PettyCashRequest` dan payload form.
- Menambahkan enum status khusus Petty Cash (Pending Approval, Cash Distributed, Pending Settlement, Settled, Rejected).

## Tahap 3: Pembuatan Backend Logic (`services/pettyCashService.ts`)

- Membuat file service 100% baru, terpisah dari MR/PO.
- **`generatePCCode`**: Fungsi generator kode (contoh: `GIS/PC/IV/24/IT/1`).
- **`createPettyCash`**: Fungsi Insert dengan Auto-Retry (Race Condition Fix).
- **`fetchPettyCash`**: Mengambil data PC berdasarkan role (User biasa lihat miliknya, Finance/GA lihat semua).
- **`processPettyCashApproval`**: Logic untuk memproses _approve/reject_ dan _settlement_ yang langsung memotong budget `cost_centers`.

## Tahap 4: Update Navigasi Sidebar (`components/app-sidebar.tsx`)

- Menyisipkan kategori menu baru **"Petty Cash"**.
- Sub-menu:
  - _Pengajuan PC Saya_ (`/petty-cash`)
  - _Buat Pengajuan_ (`/petty-cash/buat`)
  - _Manajemen & Approval PC_ (`/petty-cash/management`) -> _Hanya muncul untuk role Atasan/Finance/GA._

## Tahap 5: Halaman Utama (Daftar Pengajuan Saya)

- **Path**: `app/(With Sidebar)/petty-cash/page.tsx`
- **UI**: Tabel responsif list PC milik user yang sedang login.

## Tahap 6: Halaman Form Pengajuan (Create Petty Cash)

- **Path**: `app/(With Sidebar)/petty-cash/buat/page.tsx`
- **UI**: Layout 2-kolom standar aplikasi. Dropdown Tipe (Reimbursement / Cash Advance), nominal (currency format), Cost Center, Keterangan, dan Upload Struk.

## Tahap 7: Halaman Detail, Approval, & Settlement

- **Path**: `app/(With Sidebar)/petty-cash/[id]/page.tsx`
- **UI**: Menampilkan _read-only_ detail form.
- **Fitur**:
  - **Bagi Approver:** Muncul tombol "Approve" atau "Reject" langsung di halaman ini.
  - **Bagi Pembuat (Cash Advance):** Jika status _Cash Distributed_, muncul form tambahan di bawah untuk input _Actual Amount_ dan upload bukti struk akhir.

## Tahap 8: Halaman Manajemen & Persetujuan (Khusus Approver)

- **Path**: `app/(With Sidebar)/petty-cash/management/page.tsx`
- **UI**: Halaman tabel khusus bagi Dept Head / Finance / GA untuk memantau semua pengajuan Petty Cash perusahaan, melakukan filter, dan memberikan _approval_ atau pencairan dana tanpa mencampuri urusan MR/PO.
