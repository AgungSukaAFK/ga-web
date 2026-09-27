# Review Fitur Petty Cash (kondisi kode saat ini, branch `rombak-petty-cash`)

Catatan: dokumen `outline/07-pettycash.md` yang ada di repo itu **outline lama/ideal** (model lump-sum Reimbursement/Cash Advance, tabel `petty_cash_requests`, halaman `/petty-cash/buat`). Itu **sudah tidak dipakai**. Review ini murni dari kode yang jalan sekarang di branch `rombak-petty-cash` (banyak file lama sudah dihapus di git status: `approval-pengajuan`, `approval-voucher`, `approval-deklarasi`, `buat`, `[id]`, `PcDiscussionPanel` - implementasinya cuma tinggal di riwayat git).

Alur baru = **berbasis item/barang**, 4 dokumen berantai: **Pengajuan -> Voucher -> Sub-Voucher (tarikan dana) -> Deklarasi**. Tiap tahap punya jalur approval sendiri-sendiri (approval sekuensial, diambil otomatis dari Template Approval sesuai departemen).

---

## 0. Peta Menu (Sidebar)

Sidebar Petty Cash (`components/app-sidebar.tsx`) berisi 8 menu, semua difilter role:

| Menu                 | URL                             | Siapa yang lihat      |
| -------------------- | ------------------------------- | --------------------- |
| Dashboard Petty Cash | `/petty-cash`                   | semua user            |
| Manajemen Petty Cash | `/petty-cash/management`        | admin only            |
| Manajemen Budget     | `/petty-cash/budgeting`         | admin + GA            |
| Barang Petty Cash    | `/petty-cash/barang`            | admin + GA            |
| Template Approval    | `/petty-cash/template-approval` | admin + GA            |
| Approval Petty Cash  | `/petty-cash/approval`          | admin + role approver |
| Pengajuan Saya       | `/petty-cash/pengajuan-saya`    | semua user            |
| Deklarasi            | `/petty-cash/deklarasi`         | semua user            |

**Catatan:** "Dashboard Petty Cash" (`/petty-cash`) saat ini cuma halaman `ComingSoon` (placeholder kosong) - belum ada isinya. Halaman "Template Pengajuan" (`/petty-cash/template-pengajuan`) juga ada tapi **tidak muncul di sidebar** - cuma bisa diakses lewat URL langsung.

---

## 1. Prasyarat sebelum bisa membuat Pengajuan

Sebelum requester bisa submit Input Pengajuan, sistem cek 3 syarat (`checkPengajuanEligibility`, dicek di halaman "Pengajuan Saya" & "Input Pengajuan" sebelum form ditampilkan, dan dicek ULANG saat submit sebagai jaring pengaman):

1. Departemen requester harus punya **Template Approval "Approval Pengajuan"** yang auto-terapkan (lihat bagian 8).
2. Kombinasi departemen + site requester harus punya **Budget Petty Cash aktif** (lihat bagian 9).
3. Requester **tidak sedang punya Sub-Voucher** (tarikan dana) yang belum dideklarasikan - satu siklus pencairan harus tuntas dulu sebelum boleh mengajukan yang baru.

Kalau salah satu tidak terpenuhi, form tidak ditampilkan - muncul alert berisi alasan spesifik + tombol kembali.

---

## 2. Langkah 1 - Input Pengajuan (`/petty-cash/input-pengajuan`)

Requester mengisi:

- **Tanggal Dibutuhkan** (tidak boleh tanggal lampau, dicek ulang tiap menit pakai jam lokal device requester).
- **Minggu ke-** (cuma bisa pilih minggu ini/minggu depan di bulan berjalan).
- **Catatan** (rich text, opsional, support mention).
- **Daftar Barang** - dari katalog `petty_cash_barang` (combobox search) atau input manual. Wajib nama & qty > 0.
  - **COA (GMI/GIS):** requester non-Lourdes otomatis terkunci ke company sendiri. Akun company "LOURDES" wajib pilih SATU COA dulu untuk SELURUH pengajuan sebelum bisa menambah barang (ganti COA = reset daftar barang).
- **Lampiran** (opsional, maks 5MB per file).
- Panel kanan menampilkan preview **Budget** yang akan otomatis terpasang (berdasar departemen+site+company), tapi ini cuma preview - resolusi sebenarnya terjadi lagi saat submit.
- Bisa apply **Template Pengajuan** pribadi lewat `?template=<id>` (isi barang tersimpan, lihat bagian 10).

Saat submit (`createPettyCashPengajuan`):

- Generate kode: `{COMPANY}/PC-PJN/{bulan-romawi}/{tahun}/{dept}/{urutan}`.
- Jalur approval **otomatis** diambil dari Template Approval yang cocok departemen+site+company (kalau tidak ada, submit ditolak dengan pesan error, bukan dibuat approvals kosong).
- Budget **otomatis** diisi (`budget_id`) - kalau tidak ada budget aktif utk kombinasi itu, submit juga ditolak.
- Status awal: **"In Approval"**.
- Ada retry logic (sampai 5x) kalau kode/id bentrok (race condition antar submit bersamaan).

---

## 3. Langkah 2 - Approval Pengajuan

Approver (siapa saja yang tercantum di jalur approval template) melihat antrian di **`/petty-cash/approval`** (sesi pertama, "Approval Pengajuan") atau langsung dari halaman detail **`/petty-cash/pengajuan/[id]`**.

Approval **sekuensial** - approver ke-2 baru bisa proses kalau approver ke-1 sudah "approved" (dicek pakai `isMyApprovalTurn`, bukan cuma "ada namanya di daftar"). Ada 3 aksi (`PcApprovalActions`, dipakai sama persis di semua tahap Voucher/Deklarasi juga):

- **Tolak** - wajib isi alasan, status dokumen langsung "Rejected" (tidak lanjut ke approver berikutnya), alasan dicatat sebagai entri diskusi `[PENOLAKAN] ...`.
- **Setujui Langsung** - approve step miliknya. Kalau dia approver terakhir, status naik jadi **"Approved"**.
- **Edit & Setujui** - approver boleh mengedit tanggal/minggu/catatan/item/lampiran (dan khusus Pengajuan: boleh ganti Budget) SEKALIGUS approve. Versi sebelum diedit disimpan ke `revisions[]` (riwayat versi, bisa dilihat lewat `PcRevisionHistory`).

Begitu "Approved", dokumen ini siap dibuatkan Voucher.

---

## 4. Langkah 3 - Pengajuan Voucher (`/petty-cash/pengajuan-voucher`)

Requester memilih salah satu Pengajuan miliknya yang **status "Approved"** dan belum pernah dibuatkan Voucher. Dialog preview menampilkan item **snapshot persis** dari Pengajuan asalnya (tidak bisa diedit di sini). Klik "Kirim Voucher" -> `createVoucherFromPengajuan`:

- Kode: `{COMPANY}/PC-VCR/{bulan-romawi}/{tahun}/{dept}/{urutan}`.
- Item/qty/harga/catatan/lampiran **disalin apa adanya**.
- Jalur approval diambil dari Template Approval bertipe **"Approval Voucher"** (terpisah dari template Pengajuan, departemen sama).
- Satu Pengajuan cuma boleh punya SATU Voucher (unique constraint di DB).
- Status awal "In Approval".

## 5. Langkah 4 - Approval Voucher

Sama persis mekanismenya dengan Approval Pengajuan (approve/reject/edit&setujui, sekuensial) - sesi kedua di halaman `/petty-cash/approval`, atau di `/petty-cash/voucher/[id]`. Bedanya jalur approvernya beda (dari template "Approval Voucher").

---

## 6. Langkah 5 - Tarik Dana / Sub-Voucher (masih di halaman `/petty-cash/pengajuan-voucher`, tabel "Voucher Saya")

Begitu Voucher **"Approved"**, requester bisa **tarik dana bertahap** (tidak harus sekali penuh) lewat dialog "Tarik Dana". Ini **menggantikan alur klaim lama** (klaim sekali-penuh sudah dihapus).

- Requester isi nominal tarikan (maks = `min(sisa Voucher, sisa Budget departemen)`) + catatan.
- Diproses lewat **RPC `create_petty_cash_sub_voucher`** (SECURITY DEFINER, bukan insert langsung dari client) - satu transaksi database yang:
  1. Lock baris Voucher (`for update`), validasi status "Approved" & pemilik.
  2. Validasi nominal tidak melebihi sisa Voucher.
  3. Potong `petty_cash_budget.current_budget` sekaligus (dengan guard `current_budget >= p_amount` di WHERE, jadi race-safe kalau ada 2 tarikan hampir bersamaan).
  4. Insert baris `petty_cash_sub_voucher` + catat ke `petty_cash_budget_history`.
- Kode sub-voucher: `{kode_voucher}-SV{urutan}`.
- **Voucher TETAP berstatus "Approved" selama masih bisa ditarik** - tidak ada approval terpisah untuk tarikan ini, ini murni transaksi keuangan langsung.
- Tabel "Voucher Saya" menampilkan progress bar (total ditarik / total Voucher).

---

## 7. Langkah 6 & 7 - Deklarasi (`/petty-cash/deklarasi`) + Approval Deklarasi

Requester pilih salah satu Sub-Voucher miliknya yang belum dideklarasikan. Form deklarasi:

- Item AWAL disalin dari **Voucher induknya** (bukan dari sub-voucher, karena sub-voucher cuma nominal, tidak punya rincian barang).
- **Qty, harga satuan, dan catatan per baris BOLEH disesuaikan** ke pemakaian riil (struk asli bisa beda dari rencana) - beda dari Voucher yang snapshot apa adanya. COA per baris tetap tidak bisa diubah.
- Upload bukti struk/nota (opsional).

Submit -> `createDeklarasiFromSubVoucher`:

- Kode: `{COMPANY}/PC-DKL/{bulan-romawi}/{tahun}/{dept}/{urutan}`.
- Jalur approval dari Template "Approval Deklarasi" (terpisah lagi).
- Satu Sub-Voucher cuma boleh dipakai untuk SATU Deklarasi.
- Status awal "In Approval" -> approve/reject/edit&setujui sama seperti tahap lain (sesi ketiga di `/petty-cash/approval`, atau `/petty-cash/deklarasi/[id]`).

**Auto-complete Voucher (trigger DB, `handle_petty_cash_deklarasi_complete_voucher`):**
Begitu sebuah Deklarasi disetujui ("Approved"), trigger DB otomatis cek: apakah SEMUA sub-voucher milik Voucher induknya sudah punya Deklarasi yang "Approved", DAN total yang sudah ditarik >= total Voucher? Kalau ya, Voucher dinaikkan ke status **"Selesai"**. Status ini **tidak pernah** di-set dari kode aplikasi - murni hasil trigger ini. Kalau requester masih menyisakan sisa Voucher yang belum ditarik, Voucher akan tetap "Approved" selamanya sampai ditarik & dideklarasikan semua.

---

## 8. Pengajuan Saya (`/petty-cash/pengajuan-saya`) - Pusat Dokumen

Halaman utama requester untuk memantau semua dokumennya sendiri. Satu query (`fetchMyPengajuanWithChain`) mengambil tiap Pengajuan berikut SELURUH turunannya (Voucher -> Sub-Voucher -> Deklarasi) sekaligus. Dari data yang sama, ada 3 tab:

- **Pengajuan** - list semua Pengajuan + status Voucher-nya (kalau ada).
- **Voucher & Sub-Voucher** - list Voucher + progress tarikan + berapa sub-voucher yang sudah dideklarasikan.
- **Deklarasi** - list semua Deklarasi.

Klik baris di tab mana pun membuka modal accordion yang sama, menampilkan **rantai dokumen lengkap** (Pengajuan -> Voucher -> tiap Sub-Voucher & Deklarasinya), tiap section punya link "Detail Lengkap / Cetak" ke halaman `[id]` masing-masing. Ada filter search, status, company, rentang tanggal per tab.

## 9. Approval Petty Cash (`/petty-cash/approval`) - Antrian Gabungan

Satu halaman berisi 3 sesi terpisah (dulu 3 menu berbeda, sekarang digabung): antrian Approval Pengajuan, Approval Voucher, Approval Deklarasi - masing-masing cuma menampilkan dokumen yang **sedang giliran** user login (bukan cuma "namanya ada di daftar approver"). Klik "Proses" buka dialog detail + 3 tombol aksi (Tolak/Setujui Langsung/Edit & Setujui) seperti dijelaskan di atas.

## 10. Halaman Detail per Dokumen (`/petty-cash/{pengajuan,voucher,deklarasi}/[id]`)

Ketiganya punya arsitektur identik:

- Info lengkap dokumen (requester, departemen, budget, item, approval, lampiran).
- Tombol **Cetak** - generate versi print dengan QR code yang mengarah ke halaman verifikasi publik (`/approval-pc-{pengajuan,voucher,deklarasi}/[id]`, read-only, tetap butuh login, dipakai buat verifikasi keaslian dokumen fisik).
- Tombol approve/reject/edit&setujui muncul HANYA kalau memang giliran approval user itu.
- **Panel Diskusi** (`DiscussionPanel`) - semua user login bisa kirim komentar/pertanyaan terkait dokumen, terlepas dari approval.
- **Panel Override Admin** (`PcAdminOverridePanel`) - HANYA muncul untuk role admin. Bisa paksa ubah status dokumen & status tiap approver satu-satu (untuk kasus dokumen nyangkut, mis. approver resign). Proteksi asli ada di RLS DB, bukan cuma UI.
- Voucher punya tambahan: tabel riwayat Sub-Voucher (tarikan dana) & status deklarasinya.

## 11. Management Petty Cash (`/petty-cash/management`) - Admin Only

Monitoring semua dokumen lintas user/departemen (3 tab: Pengajuan/Voucher/Deklarasi), search + filter status. Klik baris buka dialog **preview read-only** - untuk override paksa, admin diarahkan ke link "Detail Lengkap" (halaman `[id]` di atas, bagian 10), tidak lagi di dialog ini.

## 12. Manajemen Budget (`/petty-cash/budgeting`) - Admin/GA

Kelola pool budget per kombinasi **Departemen + Site + Company (GMI/GIS/LOURDES)**. Fitur:

- Buat budget baru (nama, dept, site, company, initial budget).
- Edit/Top-up (wajib isi alasan, tercatat di `petty_cash_budget_history`).
- Aktifkan/Nonaktifkan (budget nonaktif tidak lagi auto-terpasang ke Pengajuan baru).
- Lihat riwayat perubahan (initial/top-up/deduction dari tarikan sub-voucher/deactivate).
- Admin company LOURDES bisa lihat semua company; admin GMI/GIS dikunci ke company sendiri.

Kombinasi dept+site+company ini **otomatis** dipasangkan ke Pengajuan requester yang match saat submit (bagian 2).

## 13. Barang Petty Cash (`/petty-cash/barang`) - Admin/GA

Katalog barang khusus Petty Cash (terpisah dari katalog `barang` utama MR/PO). CRUD part_number/nama/kategori/UOM/vendor/harga terakhir/link/deskripsi/COA. COA menentukan requester company mana yang bisa melihat barang ini di combobox pencarian saat Input Pengajuan.

## 14. Template Approval (`/petty-cash/template-approval`) - Admin/GA

Kelola jalur approval untuk 3 tipe tahap (**Approval Pengajuan / Approval Voucher / Approval Deklarasi** - eksplisit dipilih per template, bukan disatukan). Tiap template:

- Punya `approval_path` (daftar approver berurutan: nama, departemen, role).
- Punya `auto_rules` (kombinasi departemen + site + company) yang menentukan template mana yang otomatis dipakai saat requester submit dokumen sesuai tahapnya. Satu kombinasi cuma boleh terhubung ke SATU template per tipe approval.
- Bisa diduplikasi (copy jadi template baru dengan nama beda).

**Tidak ada mekanisme pilih template manual saat submit** - murni auto-resolve berdasar dept+site+company+tipe approval. Kalau kombinasi belum diset GA/Admin, submit di tahap itu akan ditolak dengan pesan error yang jelas.

## 15. Template Pengajuan (`/petty-cash/template-pengajuan`) - Personal, tidak ada di sidebar

Daftar barang siap pakai **milik pribadi tiap user** (beda dari katalog Barang Petty Cash yang dishare semua orang) - untuk kebutuhan rutin (mis. "ATK Bulanan"). Dibuat/dikelola user sendiri, lalu tinggal "Gunakan" saat Input Pengajuan lewat `?template=<id>` supaya tidak input ulang barang yang sama tiap kali.

---

## Ringkasan Status per Dokumen

| Dokumen     | Status yang mungkin                          | Siapa yang set                                                                                                                  |
| ----------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Pengajuan   | In Approval, Approved, Rejected              | app code (approve/reject step)                                                                                                  |
| Voucher     | In Approval, Approved, **Selesai**, Rejected | app code utk 3 pertama; **"Selesai" HANYA dari trigger DB**                                                                     |
| Deklarasi   | In Approval, Approved, Rejected              | app code                                                                                                                        |
| Sub-Voucher | `status` default "Aktif"                     | field ini di-set saat insert tapi **tidak pernah diubah/dibaca lagi** di kode aplikasi manapun (kemungkinan sisa/belum dipakai) |

---

## Hal-hal yang Perlu Diperhatikan (temuan sepintas saat review)

- **Dashboard Petty Cash kosong** - menu paling atas di sidebar cuma placeholder "Coming Soon", belum ada konten (ringkasan/statistik apa pun).
- **`petty_cash_sub_voucher.status`** tidak pernah dibaca/diupdate di UI manapun - field yang sudah ada di DB tapi belum ada gunanya di alur saat ini.
- **Auto-resolve template/budget itu keras (hard-block)** - kalau GA/Admin belum setting Template Approval atau Budget untuk kombinasi dept+site+company tertentu, requester di kombinasi itu **sama sekali tidak bisa** mengajukan apa pun (bukan cuma warning). Ini konsisten di 3 tahap (Pengajuan/Voucher/Deklarasi) sehingga kalau setup-nya di GA belum lengkap, requester bisa nyangkut di tengah alur (mis. Pengajuan berhasil dibuat, tapi pas mau bikin Voucher ternyata template "Approval Voucher" untuk dept itu belum ada).
- **Approval bersifat strict-sequential** dan dicek 2x (query DB pakai `contains` jsonb yang longgar, lalu difilter ulang di app pakai `isMyApprovalTurn`) - jadi approver ke-2/ke-3 tidak akan melihat dokumen di antriannya sampai approver sebelumnya benar-benar approve, meski secara query DB dokumen itu "match".
- **Override Admin** mengubah status & approvals langsung tanpa validasi konsistensi (mis. admin bisa saja set status "Approved" padahal masih ada approver berstatus "pending") - fitur ini memang didesain sebagai jalan pintas darurat, bukan alur normal.
- Beberapa route sudah dihapus dari struktur baru (`/petty-cash/buat`, `/petty-cash/[id]`, `/petty-cash/approval-pengajuan|voucher|deklarasi`) tapi komentar-komentar di kode masih menyebut nama-nama itu sebagai referensi sejarah - tidak masalah, tapi bisa membingungkan kalau dibaca sekilas.
