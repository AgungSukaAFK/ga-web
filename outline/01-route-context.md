# 🗺️ 01. Route Context & Navigation Map

Dokumen ini memetakan struktur routing aplikasi **Garuda Procure** (Next.js App Router). Gunakan panduan ini untuk memahami _entry point_ fitur, logika proteksi (middleware), dan service utama yang bekerja di balik setiap halaman.

## 🔒 1. Authentication & Access Control (Public/Protected)

**Context:** Gerbang masuk sistem dan penanganan state user yang belum terverifikasi.

| Route Path          | Deskripsi & Konteks Pengembangan                                                                                                                                                           | Logic / Service Terkait                                  |
| :------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------- |
| `/auth/login`       | Halaman Login. Entry point utama.                                                                                                                                                          | `supabase.auth.signInWithPassword`                       |
| `/auth/sign-up`     | Pendaftaran User Baru.                                                                                                                                                                     | `supabase.auth.signUp`                                   |
| `/pending-approval` | **Critical Route:** Halaman "Limbo" untuk user yang sudah login tapi belum memiliki data `nrp` atau `company` di profilnya. Middleware memaksa redirect ke sini jika profil tidak lengkap. | **Middleware Rule:** Cek profil user (`nrp`, `company`). |
| `/` (Root)          | Logic Redirect: <br>1. Belum Login -> `/auth/login` <br>2. Profil Incomplete -> `/pending-approval` <br>3. Valid -> `/dashboard`                                                           | `middleware.ts`                                          |
| `/approval-po/[id]` | **Dynamic Public Route:** Halaman khusus untuk akses approval PO (mungkin via link email) yang diloloskan oleh middleware tanpa login ketat (situational).                                 | `dynamicPublicPatterns` di `middleware.ts`               |

---

## 📦 2. Core Module: Material Request (MR)

**Context:** Modul _Requester_. Tempat user mengajukan permintaan barang.

| Route Path                        | Fitur & Logika Bisnis                                                                                                                          | Key Files / Services                                      |
| :-------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------- |
| `/material-request`               | **List View:** Daftar MR user sendiri. <br>• Filter: Status, Tanggal. <br>• Pagination: Server-side.                                           | `mrService.ts`                                            |
| `/material-request/buat`          | **Create Form:** Form kompleks multi-step. <br>• **Logic:** Generate No MR (`generateMRCode`), Upload Attachment, Validasi Budget Cost Center. | `mrService.createMaterialRequest`, `costCenterService.ts` |
| `/material-request/[id]`          | **Detail View:** <br>• Tracking Status Approval (Timeline). <br>• Diskusi/Komentar (`discussion-component.tsx`).                               | `mrService.fetchMaterialRequestById`                      |
| `/material-request/validate/[id]` | **Validation View:** Interface khusus (biasanya untuk GA/Admin) untuk memvalidasi MR sebelum masuk _approval chain_ manajemen.                 | `approvalService.ts`                                      |

---

## 🛒 3. Core Module: Purchase Order (PO)

**Context:** Modul _Procurement/GA_. Mengubah MR menjadi PO ke Vendor.

| Route Path                      | Fitur & Logika Bisnis                                                                                                                                                                                                   | Key Files / Services                          |
| :------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------- |
| `/purchase-order`               | **List View:** Daftar PO global (tergantung role). <br>• Filter: Payment Status, Vendor.                                                                                                                                | `purchaseOrderService.fetchPurchaseOrders`    |
| `/purchase-order/create`        | **PO Generator:** <br>• **Fitur Kunci:** Mengambil satu/banyak MR (`mr_id`) untuk diproses. <br>• **Logic:** Mengunci data vendor (Snapshot) ke JSON `vendor_details`. Mengubah status MR terkait menjadi `On Process`. | `purchaseOrderService.createPurchaseOrder`    |
| `/purchase-order/[id]`          | **Detail View:** Cetak PO, lihat item, total harga (Tax/Discount logic).                                                                                                                                                | `purchaseOrderService.fetchPurchaseOrderById` |
| `/purchase-order/validate/[id]` | **Validation View:** Mirip MR, PO harus divalidasi admin sebelum dikirim ke approver (Direksi).                                                                                                                         | `purchaseOrderService.validatePurchaseOrder`  |
| `/purchase-order/edit/[id]`     | **Edit PO:** Revisi PO yang masih draft atau direject.                                                                                                                                                                  | `purchaseOrderService.updatePurchaseOrder`    |

---

## ✅ 4. Approval Center (The Workflow Engine)

**Context:** Dashboard tunggal untuk para _Approver_ (Manager, GM, BOD) melakukan review.

| Route Path             | Fitur & Logika Bisnis                                                                                                                                                                             | Key Files / Services                                                                         |
| :--------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------- |
| `/approval-validation` | **My Tasks (Inbox):** <br>• Hanya menampilkan item di mana **giliran user tersebut** untuk approve. <br>• **Sequential Logic:** User B tidak melihat task jika User A (sebelumnya) belum approve. | `approvalService.fetchMyPendingMrApprovals` <br> `approvalService.fetchMyPendingPoApprovals` |

---

## 🛠️ 5. Admin & Management Scope

**Context:** Fitur "Super User" atau Admin GA untuk intervensi data.

| Route Path                 | Fungsi Utama                                                                                       | Service                  |
| :------------------------- | :------------------------------------------------------------------------------------------------- | :----------------------- |
| `/mr-management`           | Monitoring MR lintas user/departemen. Fitur filter lebih agresif dibanding view user biasa.        | `MrManagementClient.tsx` |
| `/mr-management/edit/[id]` | **Edit Paksa:** Admin dapat mengoreksi MR yang salah (misal salah Cost Center) meski sudah submit. | -                        |
| `/po-management`           | Monitoring PO tingkat lanjut.                                                                      | `PoManagementClient.tsx` |
| `/user-management`         | Manajemen User, Role, dan Assign Department/Approver.                                              | `userService.ts`         |
| `/vendor`                  | Database Vendor. CRUD data supplier.                                                               | `vendorService.ts`       |

---

## 🗃️ 6. Master Data & Settings

**Context:** Data referensi sistem.

| Route Path                | Entitas       | Keterangan                                                                                      |
| :------------------------ | :------------ | :---------------------------------------------------------------------------------------------- |
| `/barang`                 | `Barang`      | Katalog Item (Part Number, UOM). Digunakan untuk _autocomplete_ saat buat MR/PO.                |
| `/cost-center-management` | `CostCenter`  | **Critical:** Mengatur `current_budget`. MR tidak bisa dibuat jika budget di sini habis/kurang. |
| `/request-new-item`       | `ItemRequest` | Form user meminta penambahan item baru ke master barang.                                        |

---

## 📊 7. Utility & Dashboard

| Route Path       | Fitur                                                                        |
| :--------------- | :--------------------------------------------------------------------------- |
| `/dashboard`     | Statistik ringkas (Cards & Charts). Logic di `services/dashboardService.ts`. |
| `/notifications` | Pusat notifikasi real-time (Supabase Realtime) atau history notif.           |
| `/profile`       | User settings (Ganti password, update foto profil).                          |
| `/feedback`      | Form feedback pengguna sistem.                                               |
