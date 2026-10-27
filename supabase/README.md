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
