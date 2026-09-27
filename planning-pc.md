# Planning Petty Cash - Status Berlapis & Dashboard

Dokumen rencana (bukan review kondisi sekarang - untuk itu lihat
[`review-pc.md`](review-pc.md), yang jadi rujukan utama alur & skema di
dokumen ini). Disusun dari hasil baca langsung kode & migrasi di branch
`rombak-petty-cash` per 2026-09-28: `type/enum.ts`,
`services/pettyCashPengajuanService.ts`,
`services/pettyCashVoucherService.ts`,
`services/pettyCashSubVoucherService.ts`,
`services/pettyCashDeklarasiService.ts`, dan migrasi terkait di
`supabase/migrations/`.

Prinsip utama: **jangan ubah `status` mentah yang sudah dipakai di query &
RLS** (`.eq("status", "Approved")` dsb tersebar di banyak tempat, ganti nama
di DB = breaking change besar). Yang diusulkan di sini murni **layer
turunan** (computed di kode FE/service), dipasang di ATAS status mentah yang
sudah ada. Aman, tidak perlu migrasi DB, tidak perlu ubah RLS.

---

## Bagian 1 - Status Berlapis ("Status Utama")

### 1.1 Status mentah yang sudah ada (jangan diubah)

Sudah didefinisikan rapi di `type/enum.ts:467-552`, dipakai lintas halaman
lewat `StatusBadge` per dokumen (`PengajuanVoucherClient.tsx`,
`DeklarasiClient.tsx`, dst). Ini fondasi yang dipakai, bukan diganti:

| Dokumen | Nilai `status` | Warna existing |
| --- | --- | --- |
| Pengajuan | `In Approval`, `Approved`, `Rejected` | kuning / hijau / merah |
| Voucher | `In Approval`, `Approved`, `Selesai`, `Rejected` | kuning / hijau / **emerald** / merah |
| Sub-Voucher (tarikan dana) | `Menunggu Pembayaran`, `Selesai` | kuning / hijau |
| Deklarasi | `In Approval`, `Approved`, `Rejected` | kuning / hijau / merah |

Catatan: `Selesai` di Voucher **tidak pernah** di-set app code, murni hasil
trigger DB `handle_petty_cash_deklarasi_complete_voucher` (lihat
`review-pc.md` bagian 7) begitu SEMUA sub-voucher sudah dideklarasikan &
disetujui dan totalnya menutup `total_amount` Voucher.

Masalahnya: user biasa (requester) tidak pernah melihat cuma SATU dokumen -
dia melihat satu rantai (Pengajuan -> Voucher -> N Sub-Voucher -> N
Deklarasi). 4 status mentah di atas, kalau ditampilkan mentah-mentah per
baris tabel terpisah, tidak menjawab pertanyaan yang sebenarnya user
tanyakan: **"pengajuan saya ini sekarang di titik mana, dan siapa yang harus
gerak sekarang?"**

### 1.2 "Status Utama" - status turunan per rantai Pengajuan

Dihitung dari data chain yang **sudah** diambil satu query lewat
`fetchMyPengajuanWithChain` (`services/pettyCashPengajuanService.ts:342`) -
tidak perlu query tambahan, tinggal 1 fungsi murni
`computePcOverallStatus(pengajuan)` yang menerima hasil query itu.

Urutan prioritas kalau beberapa kondisi kebetulan sama-sama benar: **Ditolak
> Giliran Anda (oranye) > Menunggu orang lain (kuning) > Informasi (biru) >
Tuntas (emerald)**. Giliran Anda selalu dimenangkan supaya user tidak
pernah kelewat langkah yang jadi tanggung jawabnya.

| # | Status Utama (label tampilan) | Kondisi pemicu | Warna | Giliran |
| --- | --- | --- | --- | --- |
| 1 | Menunggu Persetujuan Pengajuan | `pengajuan.status = In Approval` | Kuning | Approver |
| 2 | Pengajuan Ditolak | `pengajuan.status = Rejected` | Merah | Selesai (ajukan baru) |
| 3 | **Menunggu Diajukan ke Voucher** | `pengajuan.status = Approved` & belum ada Voucher | **Oranye** | **Anda** |
| 4 | Menunggu Persetujuan Voucher | `voucher.status = In Approval` | Kuning | Approver |
| 5 | Voucher Ditolak | `voucher.status = Rejected` | Merah | lihat temuan 3.2 |
| 6 | **Menunggu Ditarik (Belum Ada Tarikan Dana)** | `voucher.status = Approved` & belum ada Sub-Voucher | **Oranye** | **Anda** |
| 7 | Tarikan Diproses, Menunggu Dibayar Finance | ada Sub-Voucher `Menunggu Pembayaran` | Kuning | Finance/GA |
| 8 | **Menunggu Anda: Ajukan Deklarasi** | ada Sub-Voucher `Selesai` tanpa Deklarasi | **Oranye** | **Anda** |
| 9 | Deklarasi Menunggu Persetujuan | ada Deklarasi `In Approval` | Kuning | Approver |
| 10 | Deklarasi Ditolak, Perlu Tindak Lanjut | ada Deklarasi `Rejected` | Merah | lihat temuan 3.2 |
| 11 | Sebagian Tuntas, Sisa Bisa Ditarik | semua Sub-Voucher yang ada sudah tuntas (Deklarasi Approved) TAPI total ditarik < `total_amount` Voucher | Biru | Anda (opsional) |
| 12 | Tuntas | `voucher.status = Selesai` | Emerald | - |

Baris 3, 6, 8 (oranye, "Giliran: Anda") adalah **3 titik paling penting di
seluruh dokumen ini** - lihat 1.3.

Kalau kondisinya campuran (misal: 2 tarikan sudah didekralasikan disetujui,
1 masih menunggu pembayaran) - status utama tetap 1 baris sesuai prioritas
di atas, tapi tempel pecahan di sampingnya, contoh: **"Menunggu Dibayar
Finance (2/3 tarikan tuntas)"**. Jangan sembunyikan pecahannya, jangan juga
pecah jadi banyak badge lepas di baris yang sama.

### 1.3 Tiga "titik senyap" - paling penting untuk diperbaiki

Ini akar masalah kebingungan yang sebenarnya, bukan soal nama status. Tiga
kondisi ini **tidak punya representasi status sama sekali** di database saat
ini - statusnya cuma "tidak ada baris anak", jadi user yang melihat
"Disetujui" mengira prosesnya beres, padahal masih ada langkah lanjutan yang
harus DIA lakukan sendiri:

1. Pengajuan `Approved` tapi belum diajukan jadi Voucher
   (`app/(With Sidebar)/petty-cash/pengajuan-voucher`).
2. Voucher `Approved` tapi belum ada Tarikan Dana sama sekali.
3. Sub-Voucher `Selesai` (dana sudah cair) tapi belum diajukan Deklarasi.

Rekomendasi: badge oranye "Menunggu Anda" di status utama (1.2) itu langkah
pertama. Langkah kedua, lebih kuat: **notifikasi** (in-app minimal, bisa
lanjut email/WA) begitu user masuk salah satu dari 3 kondisi ini - lihat
Bagian 3.

---

## Bagian 2 - Rancangan Dashboard Petty Cash (`/petty-cash`)

Saat ini `app/(With Sidebar)/petty-cash/page.tsx` cuma render
`<ComingSoon />` - benar-benar kosong (dikonfirmasi baca file-nya langsung).
Ini pengganti totalnya. Stack yang dipakai: komponen shadcn yang sudah ada
(`Card`, `Badge`, `Tabs`, `Table`), chart pakai **Recharts** (sudah jadi
dependency, `package.json`) lewat wrapper `components/ui/chart.tsx` yang
sudah ada - tidak perlu install apa pun yang baru.

### 2.1 Prinsip desain

- **Actionable-first**: hal pertama yang dilihat requester adalah "apa yang
  harus saya lakukan sekarang", bukan sekadar angka statistik pasif.
- **Klik-able, bukan dekoratif**: tiap kartu, baris, dan chart bisa diklik
  untuk drill-down ke halaman/data terkait. Tidak ada widget yang cuma
  "dilihat lalu mentok".
- **Satu sumber data, dipakai ulang**: pakai query chain yang sudah ada
  (`fetchMyPengajuanWithChain`) plus fungsi `computePcOverallStatus` dari
  Bagian 1 - dashboard dan halaman "Pengajuan Saya" jadi konsisten karena
  logikanya sama, tidak dihitung dua cara berbeda.
- **Dua varian sesuai role**: requester biasa vs approver/Finance/GA/admin
  melihat susunan widget yang beda (lihat 2.4), tapi dalam SATU halaman
  `/petty-cash`, bukan route terpisah - dibedakan lewat cek `profile.role`
  (pola yang sama seperti sudah dipakai di
  `PettyCashManagementClient.tsx:267`).
- Konsisten dengan palet warna yang **sudah ada** di `type/enum.ts` (lihat
  1.2) - cuma nambah satu warna baru (oranye, untuk "giliran Anda").

### 2.2 Layout - varian Requester (semua user)

```
+----------------------------------------------------------------+
| Halo, {nama}                                    28 September   |
+----------------------------------------------------------------+
| [Pengajuan Aktif]  [Perlu Tindakan Saya]  [Menunggu Orang Lain] [Tercairkan Bulan Ini] |
|      klik->list         klik->panel #2         klik->list           +trend kecil      |
+----------------------------------------------------------------+
|  PERLU TINDAKAN ANDA                                    (3)    |
|  -------------------------------------------------------------  |
|  [oranye] PC-PJN/... "ATK Kantor"  -> [Ajukan Voucher]          |
|  [oranye] PC-VCR/... "Konsumsi Rapat" -> [Tarik Dana]           |
|  [oranye] PC-SV/...  "Transport Site" -> [Ajukan Deklarasi]     |
+----------------------------------------------------------------+
|  PENGAJUAN BERJALAN                    |  BUDGET DEPARTEMEN     |
|  card per pengajuan, mini-stepper:     |  (donut/bar chart)     |
|  Pengajuan(v) Voucher(v) Tarik(2/3)    |  terpakai vs sisa,     |
|  Deklarasi(1/3)  [klik -> expand chain]|  klik -> /budgeting    |
+----------------------------------------------------------------+
|  AKTIVITAS TERBARU                     |  AKSI CEPAT            |
|  timeline 8-10 event terakhir,         |  [+ Buat Pengajuan]    |
|  filter chip: Semua/Pengajuan/Voucher/ |  [Ajukan Deklarasi]    |
|  Tarikan/Deklarasi                     |  [Lihat Semua Saya]    |
+----------------------------------------------------------------+
```

**Kartu ringkasan (baris atas, 4 kartu, semua klik-able):**

1. **Pengajuan Aktif** - hitung pengajuan yang status utamanya belum
   terminal (`Tuntas`/`Rejected`). Klik -> `/petty-cash/pengajuan-saya` tab
   Pengajuan, filter aktif.
2. **Perlu Tindakan Saya** - hitung baris #3/#6/#8 di tabel 1.2. Kartu ini
   dikasih aksen visual beda (border oranye, bukan cuma teks) karena paling
   penting. Klik -> scroll/fokus ke panel "Perlu Tindakan Anda" di bawahnya.
3. **Menunggu Orang Lain** - hitung baris kuning (#1/#4/#7/#9). Informasi
   saja, supaya user tidak was-was ("bukan saya yang lambat, ini memang lagi
   ditunggu approve").
4. **Tercairkan Bulan Ini** - jumlah Rupiah dari Sub-Voucher `Selesai` bulan
   berjalan, dengan sparkline kecil recharts dibanding bulan lalu.

**Panel "Perlu Tindakan Anda"** - bukan cuma angka, tapi list interaktif:
tiap baris = satu dokumen di status oranye, dengan tombol aksi yang deep-link
langsung ke halaman terkait (mis. tombol "Ajukan Voucher" langsung buka
dialog voucher untuk pengajuan itu di `/petty-cash/pengajuan-voucher`, bukan
cuma pindah ke halaman lalu user cari sendiri). Ini realisasi paling
konkret dari "titik senyap" di 1.3.

**Kartu Pengajuan Berjalan** - satu kartu ringkas per pengajuan aktif,
dengan **mini stepper horizontal** 4 titik (Pengajuan - Voucher - Tarikan
Dana - Deklarasi), tiap titik dicentang hijau kalau tuntas, dan kalau
tahapnya punya banyak anak (tarikan/deklarasi) tampilkan pecahan di titiknya
(`2/3`). Klik kartu -> expand accordion detail rantai lengkap - **pakai
ulang** komponen accordion yang sudah ada di
`app/(With Sidebar)/petty-cash/pengajuan-saya/PengajuanSayaClient.tsx`
(sudah ada modal accordion rantai dokumen, jangan bikin ulang dari nol).

**Widget Budget** - bar/donut chart (Recharts lewat `components/ui/chart.tsx`)
untuk kombinasi departemen+site milik user: terpakai vs sisa. Klik -> kalau
role admin/GA, ke `/petty-cash/budgeting`; kalau requester biasa, expand
riwayat pemakaian singkat (read-only, tanpa pindah halaman).

**Aktivitas Terbaru** - feed kronologis (approve/reject/tarik dana/upload
bukti bayar) lintas 4 dokumen milik user, dengan filter chip cepat. Klik
baris -> ke dokumen terkait.

### 2.3 Layout - varian Approver / Finance / GA / Admin

Ganti panel "Perlu Tindakan Anda" jadi **"Antrian Approval & Pencairan
Saya"**, gabungan dari 3 sesi approval yang sudah ada di
`/petty-cash/approval` (Pengajuan/Voucher/Deklarasi) **plus satu sesi baru**
khusus Finance/GA: **"Tarikan Menunggu Dibayar"** (Sub-Voucher status
`Menunggu Pembayaran`) - baris #7 di tabel 1.2 ini juga butuh giliran orang,
tapi bukan lewat mekanisme `approvals` jsonb seperti 3 sesi lain, jadi
gampang kelewat kalau dashboard cuma nampilkan 3 sesi approval yang sudah
ada.

Widget tambahan untuk role ini:

- **Ringkasan Perusahaan** - stacked bar chart jumlah dokumen per status per
  departemen, bulan berjalan.
- **Dokumen Nyangkut Lama** - tabel dokumen yang sudah > N hari (misal 5
  hari kerja) diam di status kuning (`In Approval` / `Menunggu Pembayaran`)
  tanpa bergerak. Sangat berguna untuk admin memantau bottleneck approver
  yang lupa/cuti. Klik baris -> halaman detail dokumen (panel Override Admin
  sudah ada di sana).
- **Departemen Mendekati Limit Budget** - list departemen dengan sisa budget
  di bawah ambang tertentu (misal < 15%), badge merah.

### 2.4 File/komponen - REALISASI (lihat Status Implementasi di akhir dokumen)

| File | Isi |
| --- | --- |
| `app/(With Sidebar)/petty-cash/page.tsx` | diganti, render `PcDashboardClient` (hapus `<ComingSoon />`) |
| `app/(With Sidebar)/petty-cash/PcDashboardClient.tsx` | **baru** - komponen utama, orkestrasi fetch + layout 2.2/2.3 |
| `services/pettyCashDashboardService.ts` | **baru** - `computePcOverallStatus`, `computeChainSteps`, `buildActionItems`, `summarizeOverallStatus`, `buildActivityFeed`, `formatRelativeTime`. Fetch data TETAP di `PcDashboardClient.tsx` sendiri (pola `Promise.all` yang sama seperti `PengajuanSayaClient.tsx`/`ApprovalPettyCashClient.tsx`), BUKAN satu `fetchDashboardSummary` tunggal seperti draft awal - supaya query yang dipakai tetap fungsi service yang SUDAH ada & teruji (`fetchPengajuanApprovalQueue` dkk.), bukan query baru. |
| `components/petty-cash/PcStatCard.tsx` | **baru** - kartu ringkasan klik-able |
| `components/petty-cash/PcActionNeededList.tsx` | **baru** - panel "Perlu Tindakan Anda" |
| `components/petty-cash/PcActivityFeed.tsx` | **baru** - feed aktivitas + filter chip (tidak ada di rencana awal, ditambah saat implementasi) |
| `components/petty-cash/PcChainStepper.tsx` | **baru** - mini stepper 4 titik |
| `components/petty-cash/PcBudgetChart.tsx` | **baru** - progres 1 baris (requester) atau bar chart Recharts multi-departemen (admin/GA) |
| `type/enum.ts` | ditambah `PC_OVERALL_STATUS_COLORS`/`_COLOR_DEFAULT` (12 key di 1.2 + 1 warna oranye baru) |
| `app/(With Sidebar)/petty-cash/pengajuan-saya/PengajuanSayaClient.tsx` | ditambah dukungan deep-link `?open=<id pengajuan>` (baca `useSearchParams`, auto-buka modal rantai) - supaya kartu/baris di Dashboard bisa langsung buka detail lengkap, bukan cuma pindah halaman. `page.tsx`-nya dibungkus `<Suspense>` mengikuti pola `budgeting/page.tsx` & `input-pengajuan/page.tsx` yang sudah lebih dulu pakai `useSearchParams`. |

---

## Bagian 3 - Saran Tambahan

- **Notifikasi di 3 titik senyap (1.3)** - in-app dulu (badge count di
  sidebar menu Petty Cash + panel dashboard), email/WhatsApp menyusul kalau
  infrastrukturnya sudah ada di tempat lain di aplikasi ini.
- **Warna status sudah konsisten** - koreksi dari saran saya sebelumnya:
  setelah cek `type/enum.ts`, warnanya **sudah** konsisten lintas 4 dokumen
  (kuning=menunggu, hijau=approved, merah=ditolak, emerald=tuntas). Jangan
  bikin skema warna baru dari nol, cukup **perluas** dengan 1 warna oranye
  untuk status turunan "giliran Anda" (1.2), supaya tetap satu bahasa visual.
- **Tooltip istilah** - "Voucher" dan "Deklarasi" istilah akuntansi yang
  belum tentu familiar buat requester non-finance. Tooltip singkat di badge
  status utama akan membantu (`title="Voucher = surat pencairan dana dari
  Pengajuan yang disetujui"` dst).
- **Temuan: 2 titik jalan buntu setelah ditolak** (dicek langsung di kode,
  bukan dugaan):
  1. `fetchApprovedPengajuanForVoucher`
     (`services/pettyCashVoucherService.ts:134`) menyaring pengajuan
     berdasarkan ADA/TIDAKNYA baris Voucher, tanpa peduli statusnya. Begitu
     Voucher pertama Ditolak, Pengajuan itu **tidak akan pernah muncul lagi**
     untuk dibuatkan Voucher baru lewat jalur normal.
  2. Pola yang sama persis terjadi di `fetchSubVouchersForDeklarasi`
     (`services/pettyCashSubVoucherService.ts:96`) plus constraint unik
     `petty_cash_deklarasi_sub_voucher_id_key` (unique per `sub_voucher_id`,
     lihat migrasi `20260923135339_...`) - begitu Deklarasi pertama untuk
     satu Sub-Voucher Ditolak, tidak ada jalur ajukan ulang Deklarasi untuk
     Sub-Voucher yang sama.

  Satu-satunya jalur pemulihan saat ini adalah **Admin Override** (panel
  yang sudah ada di halaman detail dokumen). Perlu diputuskan: apakah ini
  memang disengaja (recovery WAJIB lewat admin), atau perlu dibuka jalur
  self-service (requester bisa ajukan ulang sendiri tanpa harus minta admin
  tiap kali ditolak). Kalau memang disengaja, sebaiknya pesannya dipertegas
  di UI ("Voucher ditolak - hubungi Admin/GA untuk melanjutkan") supaya user
  tidak bingung mencari tombol "ajukan ulang" yang memang tidak ada.
- **Manfaatkan status Sub-Voucher yang baru aktif dipakai** - fitur
  pembayaran tarikan (`mark_petty_cash_sub_voucher_paid`,
  `PcSubVoucherPaymentForm.tsx`) baru ditambahkan di branch ini. Pastikan
  dashboard varian Finance/GA (2.3) memasukkan antrian "Tarikan Menunggu
  Dibayar" - kalau tidak, sesi ini gampang kelewat karena secara mekanisme
  beda dari 3 sesi approval `approvals` jsonb yang sudah lazim.
- **Dashboard sebagai pusat "apa yang harus saya lakukan"** - dengan Bagian
  2 berdiri, halaman `/petty-cash` (yang sekarang kosong) jadi pintu masuk
  utama, bukan lagi `/petty-cash/pengajuan-saya`. Sidebar bisa dipertimbangkan
  urutan ulang supaya Dashboard jadi menu pertama yang kebuka.

---

## Roadmap Implementasi (usulan urutan)

1. **Fase 1 - Fondasi status turunan**: `computePcOverallStatus()` +
   `PC_OVERALL_STATUS_COLORS`. Pasang di `pengajuan-saya` dulu (paling murah,
   halaman sudah ada, sudah pegang data chain-nya).
2. **Fase 2 - Dashboard v1**: kartu ringkasan + panel "Perlu Tindakan Anda" +
   kartu Pengajuan Berjalan (stepper). Ini yang paling langsung menjawab
   masalah "user bingung harus ngapain".
3. **Fase 3 - Chart & varian admin/Finance**: widget budget, Ringkasan
   Perusahaan, Dokumen Nyangkut Lama, antrian Tarikan Menunggu Dibayar.
4. **Fase 4 - Notifikasi** untuk 3 titik senyap (1.3) + perbaikan/penegasan
   2 jalan buntu (Bagian 3).

---

## Status Implementasi (2026-09-28)

Fase 1-3 **sudah dikerjakan** di branch ini (lihat 2.4 utk daftar file).
Ringkasan apa yang jadi vs belum:

**Sudah jalan:**

- Status Utama 12-state (1.2) + 3 titik senyap ditandai oranye (1.3).
- Dashboard `/petty-cash` penuh: kartu ringkasan, panel "Perlu Tindakan
  Anda" (CTA deep-link langsung), panel "Perlu Anda Proses" (approver/
  Finance), kartu "Pengajuan Berjalan" ber-stepper, widget Budget (progres
  1-baris utk requester / bar chart Recharts multi-departemen utk admin),
  Aktivitas Terbaru (feed + filter chip, dari timestamp yang sudah ada,
  TANPA tabel log baru), Aksi Cepat.
- Bagian Admin/GA: Budget Lintas Departemen, Departemen Mendekati Limit
  Budget, Dokumen Nyangkut Lama (>= 5 hari sejak diajukan, lintas 4
  dokumen), Aktivitas Departemen Bulan Ini.
- Deep-link `?open=<id>` di `/petty-cash/pengajuan-saya` supaya tombol di
  Dashboard buka langsung modal rantai lengkap.

**Insight baru yang ketemu SAAT develop (koreksi dari draft awal Bagian
2.3):** approver Petty Cash BUKAN role global - `fetchPengajuanApprovalQueue`
dkk. murni cek keberadaan `userid` di kolom `approvals`, tidak peduli
`profiles.role`. Artinya siapa pun (role "user" biasa) bisa saja tercantum
sbg approver di Template Approval departemen lain. Karena itu panel "Perlu
Anda Proses" di Dashboard TIDAK digating oleh role - ditampilkan ke SIAPA
PUN begitu antriannya tidak kosong, beda dari draft awal yang membagi
Dashboard jadi 2 "varian" role terpisah. Satu orang sekarang bisa sekaligus
requester (selalu punya panel "Perlu Tindakan Anda") dan approver dadakan.

**Belum dikerjakan (di luar cakupan sesi ini, perlu keputusan/effort
terpisah):**

- **Fase 4 (notifikasi)** - baru sebatas panel in-app "Perlu Tindakan Anda"
  di Dashboard sendiri. Belum ada badge count di sidebar, belum ada
  email/WhatsApp.
- **2 jalan buntu setelah ditolak** (Bagian 3) - belum diperbaiki/
  dipertegas pesannya, masih perlu keputusan produk (self-service ajukan
  ulang, atau pertegas "hubungi Admin").
- **Tooltip istilah** "Voucher"/"Deklarasi" - belum ditambahkan.

**Verifikasi yang sudah dilakukan:** `tsc --noEmit` bersih & `next lint`
bersih (0 warning/error) utk semua file baru/diubah. **Belum** sempat
diverifikasi lewat `next build` penuh maupun klik manual di browser -
sengaja dihindari karena ada `next dev` yang sedang berjalan (lihat memori
"jangan matikan dev server"), dan `next build` bisa bentrok tulis ke
`.next/` yang sama. Disarankan cek manual di browser (halaman `/petty-cash`)
sebelum dianggap final.
