# supabase/

| Folder | Isi | Untuk |
| --- | --- | --- |
| `migrations/` | Skema database (tabel, RLS, function, trigger, data master) | **Production** + lokal |
| `seeds/` | Data dummy, otomatis dijalankan setelah migrasi saat `supabase db reset` | Lokal saja |
| `scripts/` | Script Node (`node supabase/scripts/<nama>.mjs`) - seed demo, sinkronisasi/diagnosa data | Sesuai komentar di tiap file |
| `snippets/` | Query ad-hoc (tracking, cek data) | Bebas, tidak dijalankan otomatis |
| `prod-dump/`, `migration-reports/` | Dump & laporan dari production | Di-gitignore, jangan di-commit |

## Aturan migrasi

- Nama file: `NNNN_nama_singkat.sql` - nomor 4 digit berurutan, lalu
  underscore (wajib underscore, bukan strip, supaya terbaca Supabase CLI).
  Contoh: `0008_absensi.sql`, `0009_absensi_export.sql`.
- Perubahan baru = **file baru dengan nomor berikutnya**. File yang sudah
  dijalankan di production jangan diedit lagi; kalau perlu koreksi, buat file
  baru.
- Usahakan idempotent (`if not exists`, `create or replace`, `drop ... if
  exists`) supaya aman dijalankan ulang.
- Production: jalankan isi file baru lewat Supabase SQL Editor, urut sesuai
  nomor. Lokal: `supabase db reset` (migrasi + seed).

## Riwayat

`0001`-`0005` adalah gabungan 66 migrasi lama (Jan-Okt 2026), urutan dan isi
aslinya dipertahankan. Tiap bagian diberi penanda `-- asal: <file lama>.sql`,
dan referensi di kode memakai format `0004_petty_cash.sql (asal: ...)` supaya
tetap bisa dicari.

| File | Isi |
| --- | --- |
| `0001_baseline.sql` | Skema awal production + trigger auth.users |
| `0002_mr_po.sql` | Notifikasi, status user/cost center, stok GA, PO/MR, goods receipt, vendor |
| `0003_petty_cash_master.sql` | Master barang PC, template approval PC, nomor dokumen, follow-up, push notif |
| `0004_petty_cash.sql` | Pengajuan, voucher, sub-voucher, deklarasi, budget, diskusi, admin PC |
| `0005_fitur_lanjutan.sql` | Update Web, avatar, template MR, histori, balasan diskusi, kategori barang |
| `0006_feedback.sql` | Feedback user |
| `0007_chat_admin.sql` | Chat Admin (belum dijalankan di production) |
| `0008_global_search.sql` | Global search top bar: RPC `global_search` & `global_search_pending`, index trigram (belum dijalankan di production) |
| `0009_petty_cash_pengembalian.sql` | Petty Cash: Deklarasi boleh diajukan ulang setelah ditolak, batas total Deklarasi = nominal tarikan, Pengembalian Dana Lebih (tabel + RPC konfirmasi Finance) (belum dijalankan di production) |
| `0010_petty_cash_voucher_ulang.sql` | Petty Cash: Voucher boleh diajukan ulang setelah ditolak (unique Voucher aktif per Pengajuan), hapus berantai Pengajuan oleh admin ikut semua Voucher-nya (belum dijalankan di production) |
| `0011_mr_budget_refund.sql` | Budget Cost Center MR: potongan saat Waiting PO tidak dobel kalau MR di-approve ulang, dan dikembalikan saat MR dimundurkan ke tahap sebelum PO (belum dijalankan di production) |
| `0012_petty_cash_barang_coa_per_company.sql` | Barang Petty Cash: `category` + `coa` (centang GMI/GIS) diganti `coa_gmi` & `coa_gis` - COA per company sekaligus kategori, kosong = nonaktif di company itu (belum dijalankan di production) |
| `0013_petty_cash_pengajuan_selesai.sql` | Petty Cash: Pengajuan ikut berstatus "Selesai" begitu Voucher-nya "Selesai" (trigger di `petty_cash_voucher`, turun lagi ke "Approved" kalau Voucher turun/dihapus) + isi data lama (belum dijalankan di production) |
| `0014_petty_cash_pengguna_budget.sql` | Petty Cash: kolom Pengguna Budget (`pengguna_budget_id/_nama/_department`) di `petty_cash_pengajuan` - dipilih requester saat Input Pengajuan, tidak ikut approval (belum dijalankan di production) |
| `0015_petty_cash_revisi.sql` | Petty Cash: flag Eskalasi (GA/admin boleh mengajukan walau tarikan belum dideklarasikan), Metode Pencairan Transfer/Cash/Overbook + rekening di Voucher & Sub-Voucher, Pembatalan Pengajuan (tabel `petty_cash_pembatalan` + RPC approval Finance + refund budget), template Approval Deklarasi wajib ada approver Finance (belum dijalankan di production) |
| `0016_followup_announcer.sql` | Announcer Follow-up: kolom `profiles.sapaan`, role `announcer`, tabel antrian `followup_announcements` (diisi trigger saat tombol Follow-up MR/PO ditekan, anti-spam 5 menit per dokumen + approver) + realtime (belum dijalankan di production) |
| `0017_announcer_tts.sql` | Announcer Follow-up: pencatatan & batas karakter Google Cloud TTS per hari/bulan (`announcer_tts_usage` + RPC `consume_announcer_tts_chars` / `get_announcer_tts_usage`, khusus service role) - sisa kuota tampil di /announcer (belum dijalankan di production) |
| `0018_admin_document_actions.sql` | Aksi Admin dokumen MR & PO: status `Cancelled` + kolom jejak pembatalan (`cancelled_at/by`, `cancel_reason`, `cancelled_from_status`, PO `refund_note`), budget Cost Center ikut dikembalikan saat MR dibatalkan, RPC `admin_apply_document_action` (Batalkan / Buka Kembali MR & PO dalam satu transaksi, khusus admin) (belum dijalankan di production) |
| `0019_admin_close_remainder.sql` | Aksi Admin fase 2: kolom PO `closed_remainder` (sisa barang yang ditutup admin, tidak dihitung ter-PO lagi), RPC `admin_apply_document_action` diperluas untuk Tutup Sisa PO / Tutup Sisa MR + pengembalian budget sebagian (belum dijalankan di production) |
| `0020_admin_approval_shortcuts.sql` | Aksi Admin fase 3: RPC `admin_apply_document_action` bisa menghapus checklist penerimaan (Batalkan Penerimaan) & mengatur `full_received_at` - dipakai Batalkan Status Bayar / Batalkan Penerimaan PO (belum dijalankan di production) |
| `0021_list_search_items.sql` | Search list MR & PO mencari barang: computed field `mr_items_search_text` & `po_items_search_text` |
