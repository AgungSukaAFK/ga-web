# sistem.md — Dokumentasi Sistem GarudaProcure

## 1. Ringkasan Sistem
GarudaProcure adalah aplikasi web berbasis **Next.js App Router** dan **TypeScript** untuk mendukung proses **General Affair / Procurement** pada PT. Garuda Mart Indonesia. Dari struktur kode dan metadata aplikasi, sistem ini difokuskan untuk mengelola:

- **Material Request (MR)**
- **Purchase Order (PO)**
- **Approval & validation workflow**
- **Petty Cash**
- **Manajemen vendor**
- **Master barang**
- **Cost center dan kontrol budget**
- **Notifikasi internal**
- **Pelacakan status pengadaan**
- **Stok GA**
- **User management**

Nama aplikasi yang digunakan di UI dan metadata adalah **Garuda Procure**, dengan deskripsi: _“Sistem Manajemen MR & PO - PT. Garuda Mart Indonesia”_.

Secara umum, sistem ini merupakan **platform pengadaan internal** yang menghubungkan proses permintaan barang, persetujuan multi-level, pembuatan purchase order, monitoring status pengadaan, serta modul petty cash dalam satu aplikasi.

---

## 2. Tujuan Bisnis Sistem
Berdasarkan landing page dan modul yang tersedia, tujuan utama sistem ini adalah:

1. **Mendigitalisasi proses pengadaan internal** yang sebelumnya berpotensi manual atau tersebar.
2. **Mempercepat pembuatan MR dan PO** dengan template serta alur kerja terstruktur.
3. **Menyediakan approval berjenjang** sesuai role, department, atau template approval.
4. **Memberikan transparansi status** setiap permintaan, dari dibuat sampai selesai.
5. **Mengontrol biaya dan anggaran** melalui cost center serta budget tracking.
6. **Menyediakan kanal audit trail operasional** melalui status, approval, discussion, dan notification.
7. **Mengintegrasikan kebutuhan operasional GA dan purchasing** dalam satu dashboard aplikasi.
8. **Mendukung kebutuhan skripsi / penelitian sistem informasi**, karena sistem ini memiliki domain proses bisnis yang jelas: procurement workflow, approval engine, budget control, dan digital administration.

---

## 3. Teknologi yang Digunakan

### 3.1 Framework inti
Sistem dibangun menggunakan:

- **Next.js 15.5.9**
- **React 19**
- **TypeScript 5**
- **App Router** milik Next.js

### 3.2 Styling & UI
- **Tailwind CSS 4**
- **shadcn/ui**
- **Radix UI**
- **Lucide React** untuk icon
- **next-themes** untuk theme switching
- **sonner** untuk toast notification

### 3.3 Backend / BaaS
Sistem menggunakan **Supabase** sebagai backend utama, meliputi:

- Authentication
- Database query langsung dari client dan server
- RPC / function database
- Storage untuk attachment
- Session berbasis cookies SSR

### 3.4 Library tambahan yang menunjukkan capability sistem
- **nodemailer** → pengiriman email
- **jspdf** dan **jspdf-autotable** → generasi PDF dokumen
- **xlsx** → ekspor / impor Excel
- **zustand** → state management client-side
- **recharts** → dashboard chart / visualisasi
- **@tiptap/react** dan extension terkait → rich text editor / mention / placeholder
- **qrcode.react** → QR code
- **react-day-picker** → pemilihan tanggal
- **@webscopeio/react-textarea-autocomplete** → autocomplete textarea

---

## 4. Arsitektur Sistem
Secara arsitektural, aplikasi ini adalah **web application full-stack berbasis Next.js + Supabase** dengan karakteristik:

### 4.1 Lapisan presentasi
Direpresentasikan oleh folder:
- `app/`
- `components/`

Lapisan ini menangani:
- halaman publik
- halaman autentikasi
- dashboard dan menu sidebar
- form input bisnis
- komponen UI reusable
- navigasi berdasarkan role/department

### 4.2 Lapisan logika bisnis
Direpresentasikan terutama oleh folder:
- `services/`
- sebagian utilitas di `lib/`

Lapisan ini menangani:
- query data ke Supabase
- pembuatan kode dokumen (MR/PO/PC)
- approval processing
- filtering dan pagination
- transformasi data hasil join
- update status proses
- upload attachment
- notifikasi
- dashboard analytics

### 4.3 Lapisan data dan integrasi
Direpresentasikan oleh:
- `lib/supabase/`
- folder `supabase/` berisi SQL setup
- route API pada `app/api/`

Lapisan ini menangani:
- koneksi browser dan server ke Supabase
- session handling berbasis cookie
- middleware auth & route protection
- RPC/function database
- setup SQL tabel/fitur tertentu
- endpoint API internal seperti send-email

### 4.4 Pola arsitektur yang tampak
Sistem ini tidak memisahkan backend sebagai service terpisah, namun menggunakan pola:

**Frontend Next.js + service layer + Supabase BaaS**

Dengan kata lain:
- UI memanggil fungsi service
- service menggunakan Supabase client
- Supabase menangani database, auth, storage, dan sebagian logic via RPC / SQL

Model ini cocok untuk aplikasi enterprise internal skala kecil–menengah yang butuh delivery cepat.

---

## 5. Struktur Folder Utama

### 5.1 Root structure
Folder utama yang teridentifikasi:

- `app` → seluruh route aplikasi berbasis App Router
- `components` → komponen UI dan komponen domain
- `hooks` → custom hooks
- `lib` → utility, provider, constant, integrasi
- `services` → business/data service layer
- `supabase` → SQL setup dan konfigurasi data
- `type` → type definition domain
- `public` → aset statis
- `outline` → kemungkinan catatan/perancangan dokumen

### 5.2 Folder `app/`
Subfolder penting yang ditemukan:

- `app/(With Sidebar)` → area utama aplikasi setelah login
- `app/api` → API route internal
- `app/approval-po` → approval PO publik/dinamis tertentu
- `app/auth` → autentikasi
- `app/pending-approval` → halaman user belum lengkap/menunggu approval profil
- `app/protected` → area proteksi tambahan
- `app/page.tsx` → landing page publik
- `app/layout.tsx` → root layout aplikasi

### 5.3 Folder `app/(With Sidebar)/`
Ini adalah area inti sistem operasional. Modul yang terdeteksi:

- `approval-validation`
- `barang`
- `cost-center-management`
- `dashboard`
- `dokumentasi`
- `feedback`
- `item-requests`
- `material-request`
- `mr-management`
- `notifications`
- `petty-cash`
- `po-management`
- `profile`
- `purchase-order`
- `request-new-item`
- `stok-ga`
- `tentang-app`
- `user-management`
- `vendor`

Dari daftar ini terlihat bahwa sistem memiliki cakupan cukup luas dan sudah melampaui sekadar CRUD sederhana.

### 5.4 Folder `services/`
Service yang tersedia:

- `approvalService.ts`
- `approvalTemplateService.ts`
- `costCenterService.ts`
- `dashboardService.ts`
- `discussionService.ts`
- `gaStockService.ts`
- `logService.ts`
- `mrService.ts`
- `notificationService.ts`
- `pcApprovalTemplateService.ts`
- `pettyCashService.ts`
- `purchaseOrderService.ts`
- `userService.ts`
- `vendorService.ts`

Ini menunjukkan bahwa logika bisnis utama dipisahkan berdasarkan domain.

### 5.5 Folder `type/`
Type utama:
- `index.ts`
- `enum.ts`
- `comboboxData.tsx`

Folder ini penting karena memetakan model data sistem.

---

## 6. Modul Fungsional Sistem

### 6.1 Modul autentikasi dan otorisasi
Sistem memiliki modul autentikasi melalui Supabase Auth dengan karakteristik:

- login menggunakan **email atau NRP**
- signup user baru
- pengecekan user aktif / nonaktif (`is_active`)
- middleware route protection
- redirect otomatis untuk user belum lengkap profilnya
- public path dan protected path dipisahkan

#### Ciri penting:
- Login tidak hanya menerima email, tetapi juga **NRP**, kemudian sistem mencari email berdasarkan tabel `profiles`.
- User yang berhasil login tetap akan dicek lagi status `is_active`-nya.
- Akun nonaktif akan langsung disign-out.
- User tanpa `nrp` atau `company` akan diarahkan ke `/pending-approval`.

### 6.2 Modul profil pengguna
Tabel `profiles` tampak menjadi pusat identitas pengguna. Field yang terlihat:

- `id`
- `role`
- `lokasi`
- `department`
- `nama`
- `nrp`
- `company`
- `email`
- `is_active`

Profil ini dipakai untuk:
- menentukan menu sidebar
- menentukan hak akses
- validasi kelengkapan akun
- filter data per company
- approval routing

### 6.3 Modul dashboard
Dashboard menyediakan statistik dan visualisasi seperti:

- jumlah MR open/closed/total/rejected/waiting PO
- jumlah PO pending/completed/total
- tren bulanan MR vs PO
- distribusi MR per departemen
- daftar MR terbaru

Sumber data dashboard berasal dari:
- query count langsung ke tabel `material_requests` dan `purchase_orders`
- RPC Supabase seperti:
  - `get_monthly_mr_po_trend`
  - `get_mr_distribution_by_dept`

### 6.4 Modul Material Request (MR)
MR adalah salah satu domain inti. Model `MaterialRequest` mencakup:

- kode MR
- user pembuat
- kategori
- status
- remarks
- cost estimation
- department
- due date
- orders/item list
- approvals
- attachments
- discussions
- company code
- tujuan site
- cost center
- prioritas
- level/status tracking proses

Fitur yang dapat diinferensikan:
- membuat MR
- melihat daftar MR
- approval MR
- manajemen MR oleh admin/purchasing
- diskusi terkait MR
- lampiran dokumen
- penghitungan prioritas berdasarkan due date
- tracking level proses pengadaan

### 6.5 Modul Purchase Order (PO)
PO adalah domain utama kedua. Fitur yang tampak:

- mengambil daftar PO dengan pagination dan filter
- mencari PO berdasarkan kode, status, vendor, atau MR terkait
- generate kode PO otomatis
- create PO dari MR
- update PO
- validate PO
- close PO dengan BAST
- upload attachment PO
- menambahkan attachment baru ke PO
- menandai barang diterima oleh GA

Field penting pada PO:
- `kode_po`
- `mr_id`
- `user_id`
- `status`
- `vendor_details`
- `items`
- `currency`
- `discount`
- `tax`
- `postage`
- `total_price`
- `payment_term`
- `shipping_address`
- `notes`
- `attachments`
- `approvals`
- `pph_type`, `pph_rate`, `pph_amount`

### 6.6 Modul approval dan validation
Approval merupakan engine penting dalam sistem ini.

Objek approval berisi:
- `type`
- `status`
- `userid`
- `nama`
- `email`
- `role`
- `department`
- `processed_at`

Jenis approval yang didefinisikan:
- `Mengetahui`
- `Menyetujui`
- `Payment Approval`
- `Payment Validator`

Approval digunakan setidaknya pada:
- MR
- PO
- Petty Cash

Ada juga konsep:
- template approval
- approval template khusus petty cash
- payment validator legacy user id

### 6.7 Modul petty cash
Selain procurement formal, sistem juga mengelola petty cash.

Jenis petty cash:
- Reimbursement
- Cash Advance
- Pembayaran Langsung
- Transport & Perjalanan
- Entertain & Konsumsi
- Lainnya

Status petty cash:
- Pending Validation
- In Approval
- Cash Distributed
- Pending Settlement
- Settled
- Rejected

Fitur yang terlihat:
- generate kode petty cash otomatis
- buat pengajuan petty cash
- lihat petty cash milik user
- manajemen petty cash
- approval petty cash
- template approval petty cash
- settlement attachment
- filter berdasarkan company dan role

### 6.8 Modul cost center dan budget control
Ada modul khusus `cost-center-management` dan type `CostCenter` serta `CostCenterHistory`.

Data yang tampak:
- nama cost center
- kode
- company code
- initial budget
- current budget
- active status
- riwayat perubahan budget

Artinya sistem tidak hanya mengelola dokumen, tetapi juga **pengendalian anggaran**.

### 6.9 Modul master barang
Domain `Barang` menyimpan master item pengadaan, dengan atribut:
- part number
- part name
- category
- uom
- vendor
- is_asset
- last purchase price
- link

Fitur terkait:
- pencarian barang (`searchBarang`)
- integrasi item MR dengan barang master
- update `last_purchase_price` setelah PO dibuat
- request barang baru
- item request approval/pemrosesan

### 6.10 Modul vendor
Terdapat modul vendor dengan model:
- `kode_vendor`
- `nama_vendor`
- `pic_contact_person`
- `alamat`
- `email`

Pada PO, detail vendor disimpan sebagai `vendor_details`, mengindikasikan sistem menyimpan snapshot vendor saat PO dibuat.

### 6.11 Modul stok GA
Adanya modul `stok-ga` dan type `GaStock` menunjukkan sistem juga mengelola persediaan General Affair, dengan data:
- barang_id
- company_code
- quantity
- location
- note
- updated_by
- relasi ke master barang

### 6.12 Modul notifikasi
Sistem memiliki modul notifikasi internal dengan fitur:
- mengambil notifikasi user saat login
- join dengan `profiles` untuk nama actor/pengirim
- tandai satu notifikasi sudah dibaca
- tandai semua notifikasi sudah dibaca
- membuat notifikasi via RPC `create_notifications`

Jenis notifikasi sangat kaya, misalnya:
- mention
- approval_mr
- approval_po
- info
- mr_submitted
- mr_validated
- mr_approved_step
- mr_fully_approved
- mr_rejected
- po_submitted
- po_validated
- po_approved_step
- po_fully_approved
- po_rejected
- pc_submitted
- pc_routed
- pc_approved_step
- pc_fully_approved
- pc_rejected

Ini menandakan sistem berorientasi event/workflow.

### 6.13 Modul feedback dan dokumentasi
Karena terdapat halaman `feedback`, `dokumentasi`, dan `tentang-app`, sistem ini juga menyediakan:
- kanal umpan balik pengguna
- dokumentasi internal
- informasi aplikasi

Ini penting untuk adopsi organisasi.

---

## 7. Routing dan Navigasi Berdasarkan Role
Sidebar utama dihasilkan dinamis sesuai profil user.

### 7.1 Menu dasar
Menu utama mencakup:
- Dashboard
- Material Request
- Notifikasi
- Purchase Order
- Barang
- Vendor
- Dokumentasi
- Feedback
- Tentang App
- Petty Cash

### 7.2 Menu khusus berdasarkan role/department
Beberapa menu hanya muncul untuk kondisi tertentu:

- **Admin**:
  - User Management
  - MR Management
  - PO Management
  - Cost Center Management

- **Approver**:
  - Approval & Validation

- **Purchasing / Admin**:
  - Permintaan Barang

- **GA Department / Admin**:
  - Stok GA

- **Approver / Admin / Finance / GA**:
  - Manajemen PC
  - Template Approval PC

### 7.3 Implikasi desain akses
Artinya sistem menggunakan kombinasi otorisasi berbasis:
- role
- department
- company

Bukan sekadar satu role global.

---

## 8. Model Data Inti

### 8.1 Profile
Mewakili identitas user dan dasar access control.

### 8.2 MaterialRequest
Entitas permintaan barang/jasa internal.

### 8.3 Order
Sub-item dalam MR. Masing-masing order bisa memiliki:
- barang_id
- part_number
- status item
- referensi PO
- catatan perubahan

Ini menunjukkan tracking dilakukan tidak hanya di level dokumen, tetapi juga level item.

### 8.4 PurchaseOrder
Entitas pemesanan ke vendor, dapat terhubung ke satu MR.

### 8.5 POItem
Item yang dipesan pada PO, memiliki qty, price, total_price, vendor_name, dan opsional description/link.

### 8.6 Vendor
Master vendor.

### 8.7 Barang
Master item/material.

### 8.8 CostCenter dan CostCenterHistory
Kontrol anggaran dan audit perubahan budget.

### 8.9 Notification
Entitas notifikasi berbasis event.

### 8.10 PettyCashRequest
Entitas pengajuan petty cash yang memiliki approval dan settlement.

---

## 9. Workflow Bisnis Utama

### 9.1 Workflow Material Request
1. User login.
2. User membuat MR.
3. MR berisi orders/item, attachments, remarks, due date, tujuan site, company, dan cost center.
4. MR memasuki status awal approval/validation.
5. Approval berjalan sesuai template dan approver terkait.
6. Setelah approval selesai, MR dapat menunggu pembuatan PO.
7. Status dan level MR berubah sesuai progres operasional.

### 9.2 Workflow Purchase Order
1. PO dibuat berdasarkan MR yang sudah layak diproses.
2. Sistem generate `kode_po` otomatis berdasar company, bulan Romawi, tahun, lokasi, dan nomor urut.
3. PO disimpan dengan status awal `Pending Validation`.
4. Saat insert, ada mekanisme retry untuk mencegah bentrok kode PO.
5. Setelah PO dibuat:
   - harga terakhir barang di-update
   - status item MR terkait di-update menjadi `PO Created`
   - status MR diubah ke `On Process`
   - level MR diubah ke `OPEN 3A`
6. PO dapat melalui approval, payment validation, BAST, dan completion.
7. Attachment seperti invoice/BAST dapat diunggah ke Supabase Storage bucket `po`.

### 9.3 Workflow status level MR
Sistem mendefinisikan level proses MR secara detail, antara lain:
- OPEN 1: menunggu approval awal
- OPEN 2: menunggu PO SCM
- OPEN 3A / 3B: menunggu pengiriman vendor
- OPEN 4: vendor kirim, belum tiba
- OPEN 5: tiba di warehouse
- CLOSE 1: kirim ke site
- CLOSE 2A / 2B: diterima site, dokumen proses
- CLOSE 3: selesai dan update sistem

Ini adalah salah satu kekuatan sistem dari sisi penelitian, karena menyediakan **status operasional granular**.

### 9.4 Workflow Petty Cash
1. User membuat pengajuan petty cash.
2. Sistem generate kode PC otomatis.
3. Status awal: `Pending Validation`.
4. Approval berjalan.
5. Dana didistribusikan.
6. Settlement dilakukan dan attachment settlement diunggah.
7. Status akhir menjadi `Settled` atau `Rejected`.

---

## 10. Mekanisme Kode Dokumen
Sistem memiliki pola penomoran otomatis.

### 10.1 Kode PO
Format:
`{COMPANY}/PO/{ROMAN_MONTH}/{YY}/{LOKASI}/{NUMBER}`

Contoh pola:
`GMI/PO/VI/26/HO/123`

Unsur pembentuk:
- company_code
- bulan Romawi
- 2 digit tahun
- singkatan lokasi
- nomor urut tahunan per company

### 10.2 Kode Petty Cash
Format:
`{COMPANY}/PC/{ROMAN_MONTH}/{YY}/{DEPT}/{NUMBER}`

Contoh pola:
`GMI/PC/VI/26/GA/10`

### 10.3 Nilai analitis
Pola penomoran ini menunjukkan sistem memperhatikan:
- keterbacaan administratif
- identifikasi dokumen secara organisasi
- grouping berdasarkan company/lokasi/departemen

---

## 11. Autentikasi, Session, dan Keamanan

### 11.1 Session handling
Sistem menggunakan **Supabase SSR** dengan cookie-based session.

Terdapat helper:
- `lib/supabase/client.ts` → browser client
- `lib/supabase/server.ts` → server client
- `middleware.ts` → validasi auth global

### 11.2 Middleware keamanan
Middleware melakukan:
- membuat server client Supabase
- membaca / menulis cookie sesi
- memvalidasi user lewat `supabase.auth.getUser()`
- membedakan auth path, public path, dan dynamic public path
- redirect ke login jika belum login
- cek profil `nrp` dan `company`
- redirect ke `/pending-approval` bila profil belum lengkap
- redirect user login dari auth page ke `/`

### 11.3 Soft delete / deactivated account
Akun nonaktif ditangani di beberapa lapisan:
- saat login
- saat middleware session check

Jika `profiles.is_active === false`, user akan dikeluarkan dan diarahkan ke login.

### 11.4 Catatan keamanan arsitektur
Karena banyak operasi dilakukan dari service layer memakai Supabase client, maka keamanan riil kemungkinan besar sangat bergantung pada:
- **RLS Supabase**
- **RPC dengan SECURITY DEFINER**
- pembatasan akses di level query/database

Salah satu indikasinya adalah fungsi notifikasi memakai RPC `create_notifications` karena insert langsung diblokir RLS.

---

## 12. Database dan Integrasi Supabase
Walaupun schema lengkap tabel tidak seluruhnya dibaca, dari type dan service dapat diidentifikasi tabel/entitas utama berikut:

- `profiles`
- `material_requests`
- `purchase_orders`
- `petty_cash_requests`
- `notifications`
- `barang`
- `vendors` atau tabel vendor sejenis
- `cost_centers`
- relasi `users_with_profiles`

### 12.1 SQL setup yang tersedia
Folder `supabase/` berisi:
- `cost-center-active-status-setup.sql`
- `ga-stock-setup.sql`
- `notifications-setup.sql`
- `user-active-status-setup.sql`

Artinya sebagian fitur dikembangkan melalui script SQL terpisah, misalnya:
- aktivasi/nonaktivasi cost center
- setup stok GA
- setup notifikasi
- setup status aktif user

### 12.2 RPC yang teridentifikasi
- `get_monthly_mr_po_trend`
- `get_mr_distribution_by_dept`
- `create_notifications`

Ini menunjukkan sebagian logic agregasi dan workflow ditempatkan di database.

### 12.3 Storage
PO attachment diunggah ke bucket Supabase Storage bernama:
- `po`

Jenis file yang diakomodasi:
- po
- finance
- bast
- invoice

---

## 13. API Internal
Terdapat route API internal:
- `app/api/v1/send-email/route.ts`

Keberadaan endpoint ini, ditambah dependency `nodemailer`, `SMTP_*`, dan `SES_FROM`, menunjukkan sistem mendukung **pengiriman email** untuk kebutuhan notifikasi atau dokumen.

Selain itu ada folder:
- `lib/amazon_ses`
- `lib/fonnte`
- `lib/notifications`

Dari nama folder dapat diinferensikan bahwa sistem berpotensi mendukung:
- email via SMTP / Amazon SES
- notifikasi WhatsApp / messaging via Fonnte
- orkestrasi notifikasi multi-channel

Namun untuk penelitian, bagian ini sebaiknya ditulis sebagai **indikasi integrasi**, kecuali sudah diverifikasi lebih dalam isi filenya.

---

## 14. Environment Variable yang Dibutuhkan
Berdasarkan `.env.example`, sistem memerlukan:

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SMTP_PORT`
- `SMTP_HOST`
- `NEXT_PUBLIC_DEVELOPER_EMAIL`
- `NEXT_PUBLIC_FONNTE_TOKEN`
- `APP_NAME`
- `SES_FROM`
- `SMTP_PASS`
- `SMTP_USER`
- `SUPABASE_ANON_KEY`
- `SUPABASE_URL`

### 14.1 Klasifikasi fungsi environment
- **Supabase client/server**: URL dan key
- **SMTP / SES**: email sending
- **Fonnte**: kemungkinan integrasi WhatsApp API
- **APP_NAME**: identitas aplikasi
- **developer email**: kemungkinan fallback / monitoring

---

## 15. UI/UX dan Pola Interaksi

### 15.1 Landing page
Landing page publik menyampaikan value proposition:
- modernisasi proses pengadaan
- pembuatan MR & PO cepat
- approval dinamis
- pelacakan real-time

### 15.2 Dashboard layout
Setelah login, user masuk ke area dengan:
- sidebar collapsible
- breadcrumb otomatis berdasarkan path
- toast notification
- notifikasi unread badge
- menu yang menyesuaikan role/department

### 15.3 Localization
Banyak label, format tanggal, mata uang, dan teks UI memakai **Bahasa Indonesia** serta format lokal `id-ID`. Ini memperlihatkan sistem ditujukan untuk konteks operasional Indonesia.

### 15.4 Formatting helpers
Utility yang tersedia:
- format tanggal Indonesia
- format currency Rupiah
- format date-time ke WIB
- hitung prioritas berdasarkan due date
- validasi CSV

Ini menunjukkan aplikasi memiliki perhatian pada kualitas data dan keterbacaan operasional.

---

## 16. Fitur Tracking dan Auditabilitas
Sistem cukup kuat pada aspek tracking, dibuktikan oleh:

1. **approval history** pada berbagai dokumen
2. **discussion thread** pada dokumen tertentu
3. **notification event**
4. **status level MR** yang granular
5. **item-level tracking** pada order MR
6. **budget history** pada cost center
7. **attachment history** pada PO dan petty cash

Bagi kebutuhan skripsi, ini bisa dikaji sebagai implementasi:
- workflow information system
- digital approval system
- procurement monitoring system
- budget-aware procurement information system

---

## 17. Kekuatan Sistem
Beberapa kekuatan yang terlihat dari repository ini:

1. **Domain bisnis jelas dan spesifik**: procurement internal + petty cash.
2. **Role-based navigation** sudah diterapkan.
3. **Approval workflow multi-level** tersedia.
4. **Tracking proses sangat detail**, terutama level MR.
5. **Integrasi budget/cost center** memberi nilai kontrol keuangan.
6. **Notifikasi internal** mendukung responsiveness sistem.
7. **Pemakaian Supabase** mempercepat pengembangan full-stack.
8. **TypeScript types cukup kaya**, sehingga domain model terdokumentasi baik di kode.
9. **Penomoran dokumen otomatis** relevan untuk kebutuhan administrasi perusahaan.
10. **Ada pemisahan service layer**, yang memudahkan analisis arsitektur untuk penelitian.

---

## 18. Potensi Kelemahan / Catatan Analisis
Untuk pembelajaran model lain atau pembahasan skripsi, beberapa catatan penting:

1. **README belum mencerminkan sistem aktual**
   - README masih bawaan starter kit Next.js + Supabase.
   - Dokumentasi bisnis sistem belum tergambar dari README.

2. **Arsitektur masih sangat Supabase-centric**
   - Banyak logika langsung mengakses Supabase dari frontend/service layer.
   - Ini cepat dikembangkan, tetapi perlu audit ketat pada RLS dan permission.

3. **Sebagian business rule tersebar**
   - Ada di service, middleware, enum, dan kemungkinan SQL/RPC.
   - Untuk penelitian, ini penting dibahas sebagai tantangan maintainability.

4. **Belum tampak test suite**
   - Dari struktur root yang terbaca, belum terlihat folder test atau konfigurasi test.

5. **Sebagian integrasi belum terdokumentasi penuh**
   - Misalnya Amazon SES, Fonnte, dan notification orchestration.

Catatan ini bukan berarti sistem buruk, tetapi justru berguna untuk analisis akademik.

---

## 19. Relevansi untuk Skripsi
Sistem ini sangat layak dijadikan objek skripsi, terutama untuk tema:

### 19.1 Analisis dan perancangan sistem informasi
Karena sistem memiliki:
- aktor yang jelas
- proses bisnis yang runtut
- dokumen formal (MR, PO, petty cash)
- approval workflow
- data master dan transaksi

### 19.2 Topik yang bisa diangkat
Contoh topik skripsi yang relevan:

1. **Rancang Bangun Sistem Informasi Pengadaan Barang Berbasis Web**
2. **Implementasi Workflow Approval Digital pada Sistem Pengadaan General Affair**
3. **Analisis Efektivitas Digitalisasi Material Request dan Purchase Order**
4. **Perancangan Sistem Monitoring Pengadaan dengan Integrasi Cost Center dan Notifikasi**
5. **Evaluasi User Access Control Berbasis Role dan Department pada Sistem Procurement**
6. **Implementasi Supabase sebagai Backend-as-a-Service pada Sistem Informasi Pengadaan**
7. **Analisis Pelacakan Status Pengadaan Menggunakan Model Workflow Bertingkat**
8. **Pengembangan Sistem Petty Cash Terintegrasi dengan Approval Multi-Level**

### 19.3 Komponen akademik yang mudah diturunkan dari sistem ini
- Identifikasi masalah manual procurement
- Analisis kebutuhan fungsional dan non-fungsional
- Use case diagram
- Activity diagram
- ERD / relasi data
- Sequence diagram approval
- Class/type model
- Evaluasi sistem
- pengujian fungsional modul

---

## 20. Saran Cara Memahami Repository Ini untuk Model Lain
Jika dokumen ini dipakai model lain untuk mempelajari sistem, urutan belajar yang disarankan adalah:

### Tahap 1 — Pahami domain bisnis
Pelajari konsep:
- MR
- PO
- approval
- petty cash
- cost center
- vendor
- barang

### Tahap 2 — Pahami model data
Mulai dari file:
- `type/index.ts`
- `type/enum.ts`

Karena dua file ini mendefinisikan objek dan status inti sistem.

### Tahap 3 — Pahami kontrol akses
Pelajari:
- `middleware.ts`
- `services/userService.ts`
- `components/app-sidebar.tsx`

Karena file-file ini menjelaskan auth, role, department, dan menu akses.

### Tahap 4 — Pahami alur bisnis utama
Fokus ke service:
- `services/purchaseOrderService.ts`
- `services/pettyCashService.ts`
- `services/dashboardService.ts`
- `services/notificationService.ts`
- `services/mrService.ts`
- `services/approvalService.ts`

### Tahap 5 — Pahami tampilan dan route
Lihat:
- `app/page.tsx`
- `app/(With Sidebar)/layout.tsx`
- subroute modul pada `app/(With Sidebar)/...`

### Tahap 6 — Pahami data layer
Lihat:
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- folder `supabase/*.sql`
- route `app/api/v1/send-email/route.ts`

---

## 21. Kesimpulan
GarudaProcure adalah **sistem informasi pengadaan internal berbasis web** yang dibangun dengan **Next.js + TypeScript + Supabase**, dan dirancang untuk mendigitalisasi proses operasional **Material Request, Purchase Order, approval, petty cash, notifikasi, serta kontrol cost center**.

Sistem ini memiliki karakteristik penting:
- modular
- berbasis role dan department
- memiliki workflow approval multi-level
- mendukung tracking status yang detail
- mendukung attachment dan notifikasi
- relevan untuk konteks enterprise internal

Untuk konteks skripsi, sistem ini sangat kaya karena dapat dianalisis dari sisi:
- proses bisnis
- arsitektur aplikasi
- model data
- kontrol akses
- workflow approval
- efektivitas digitalisasi pengadaan

Dengan kata lain, repository ini bukan sekadar template web biasa, tetapi sudah membentuk **sistem informasi operasional perusahaan** yang cukup matang untuk dijadikan objek studi, dokumentasi teknis, maupun dasar analisis akademik.
