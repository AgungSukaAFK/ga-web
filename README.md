# Garuda Procure

Sistem manajemen pengadaan internal (General Affair / Procurement) untuk grup
PT. Garuda Mart Indonesia: Material Request, Purchase Order, approval
berjenjang, Petty Cash, master barang & vendor, cost center, dan stok GA dalam
satu aplikasi web.

## Modul

| Modul                    | Isi                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Material Request (MR)    | Buat MR (template, ambil dari riwayat), validasi GA, approval, level item, terima barang |
| Purchase Order (PO)      | Buat PO dari MR, PO aset / non-aset, approval & payment, penerimaan barang (BAST, QR)  |
| Approval & Validation    | Antrian approval per user, template jalur approval + auto-rule, follow-up approver    |
| Petty Cash               | Pengajuan → Voucher → Sub-Voucher (tarikan dana) → Deklarasi, budget per departemen/site |
| Master data              | Barang, vendor (+ riwayat harga), cost center, request barang baru, stok GA           |
| Notifikasi               | Realtime in-app, Inbox top bar, Web Push (PWA), WhatsApp (Fonnte)                     |
| Global search            | ⌘K / Ctrl+K: cari MR, PO, Petty Cash, barang, vendor, user, menu, dan aksi cepat      |
| Pendukung                | Diskusi per dokumen (mention, gambar), riwayat aktivitas, Update Web, Chat Admin, Feedback, Dokumentasi interaktif |
| Admin                    | User management, MR/PO management, file management, kode global terima barang        |

Akses menu & aksi ditentukan oleh `role` (`requester`, `approver`, `admin`),
departemen, dan company user. Daftar menu per hak akses ada di
[lib/sidebar/nav-config.ts](lib/sidebar/nav-config.ts).

## Stack

- **Next.js 15** (App Router, Turbopack) + **React 19** + **TypeScript**
- **Tailwind CSS 4** + **shadcn/ui** (Radix) + lucide-react, next-themes, sonner
- **Supabase**: auth, Postgres (RLS + RPC), realtime, storage
- **Supabase self-hosted di VPS**: storage khusus attachment baru (upload
  langsung dari browser lewat signed URL, melewati batas body 4.5 MB Vercel)
- Tiptap (rich text + mention), recharts, exceljs, jspdf, qrcode.react, web-push
- Hosting production di **Vercel**

## Menjalankan di lokal

Butuh: Node.js 20+, Docker, dan [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

```bash
npm install

# 1. Supabase lokal (Docker): API :54321, Studio :54323, email (Inbucket) :54324
supabase start

# 2. Skema database (semua migrasi + seed barang)
supabase db reset

# 3. Data demo (opsional, urut)
node supabase/scripts/seed-demo-users.mjs        # user demo, password "demo123"
node supabase/scripts/seed-demo-bulk.mjs         # ~150 MR + PO, vendor, item request
node supabase/scripts/seed-demo-petty-cash.mjs   # data Petty Cash lengkap

# 4. Dev server -> http://localhost:3000
npm run dev
```

Login demo: `admin1@demo.com` / `demo123` (juga `requester.<departemen>@demo.com`
dan `approver.<departemen>@demo.com`, lihat
[seed-demo-users.mjs](supabase/scripts/seed-demo-users.mjs)).

### Environment

| File                     | Dipakai untuk                                                                 |
| ------------------------ | ----------------------------------------------------------------------------- |
| `.env`                   | Nilai production (dari [.env.example](.env.example))                          |
| `.env.development.local` | Override otomatis saat `next dev`: mengarahkan auth/db/storage ke **Supabase lokal** (pakai demo key bawaan `supabase status`) |

Dengan dua file itu, `npm run dev` **tidak menyentuh production sama sekali**.
`npm run dev:prod` sengaja mengarah ke production, jadi hati-hati.

| Variabel                                                   | Fungsi                                                   |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY` | Supabase utama dari browser & server component |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`                        | Supabase utama dari middleware                           |
| `SUPABASE_SERVICE_ROLE_KEY`                                | Operasi admin di server (`lib/supabase/admin.ts`, `storage-admin.ts`) |
| `VPS_SUPABASE_URL`, `VPS_SUPABASE_SERVICE_ROLE_KEY`, `VPS_SUPABASE_STORAGE_BUCKET` | Storage attachment di VPS (server) |
| `NEXT_PUBLIC_VPS_SUPABASE_URL`, `NEXT_PUBLIC_VPS_SUPABASE_ANON_KEY` | Upload langsung dari browser ke storage VPS (anon key, **bukan** service role) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push. Generate sekali (`npx web-push generate-vapid-keys`); jangan diganti setelah user mulai subscribe |
| `NEXT_PUBLIC_FONNTE_TOKEN`                                 | Notifikasi WhatsApp lewat Fonnte                         |
| `NEXT_PUBLIC_GOA_URL`                                      | Base URL web GOA untuk app switcher di sidebar           |

## Scripts

| Perintah              | Fungsi                                                         |
| --------------------- | -------------------------------------------------------------- |
| `npm run dev`         | Dev server (Turbopack), ke Supabase lokal                      |
| `npm run dev:prod`    | Dev server, ke Supabase **production** (`.env` saja)           |
| `npm run build`       | Build production                                               |
| `npm run start`       | Jalankan hasil build                                           |
| `npm run build:local` / `start:local` | Build & jalankan dengan env lokal (`.env.development.local` + `.env`) |
| `npm run lint`        | ESLint                                                         |

## Database & migrasi

Semua skema ada di [supabase/migrations/](supabase/migrations/), aturan
lengkapnya di [supabase/README.md](supabase/README.md). Singkatnya:

- Nama file `NNNN_nama_singkat.sql`. Perubahan baru = file baru dengan nomor
  berikutnya; file yang sudah jalan di production tidak diedit lagi.
- Lokal: `supabase db reset`. Production: jalankan isi file baru di Supabase
  SQL Editor, urut sesuai nomor.
- `0007_chat_admin.sql` dan `0008_global_search.sql` **belum dijalankan di
  production**; fitur Chat Admin & global search butuh keduanya.

Script Node di [supabase/scripts/](supabase/scripts/) untuk seed demo dan
sinkronisasi/diagnosa data lama. Baca komentar di atas tiap file sebelum
menjalankannya ke production.

## Struktur folder

```
app/
  (With Sidebar)/     halaman utama (sidebar + top bar), satu folder per modul
  auth/               login, daftar, konfirmasi email
  approval-*/         halaman publik tanpa login (verifikasi dokumen dari QR)
  goods-receipt/      terima barang via token
  api/push/           kirim Web Push
components/
  ui/                 primitive shadcn (sudah dimodifikasi, jangan generate ulang)
  topbar/             top bar: global search, Inbox, Chat Admin, Tampilan, Profil
  petty-cash/, support-chat/, update-web/, dashboard/, pwa/, ...
services/             akses data per modul (MR, PO, Petty Cash, vendor, notifikasi, ...)
lib/                  helper: supabase client, notifikasi, sidebar, tema/font, attachment, export
hooks/                React hook bersama
type/                 tipe & enum (status, opsi combobox)
supabase/             migrasi, seed, script, snippet
public/               ikon, manifest PWA, service worker (sw.js), offline.html
```

## Dokumentasi

| Dokumen                                                             | Isi                                                               |
| ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [sistem.md](sistem.md)                                              | Gambaran sistem: arsitektur, modul, role, model data, workflow    |
| [taste-ui.md](taste-ui.md)                                          | Panduan komponen, pola halaman, dan aturan interaksi UI           |
| [auth-page.md](auth-page.md), [docs/auth-page-design-guide.md](docs/auth-page-design-guide.md) | Desain halaman login / daftar |
| [planning-update-web.md](planning-update-web.md)                    | Cara kerja fitur Update Web                                       |
| [review-pc.md](review-pc.md), [planning-pc.md](planning-pc.md)      | Alur & rencana modul Petty Cash                                   |
| [supabase/README.md](supabase/README.md)                            | Struktur folder supabase & aturan migrasi                         |
