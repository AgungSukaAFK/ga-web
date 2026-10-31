# Handoff ga-web → wms-gmi: sistem tema

Dikumpulkan 30 Okt 2026 dari: memory Claude untuk project ini, `taste-ui.md`, `styling-guide.md` (versi terakhir sebelum dihapus), dan riwayat git `main` (HEAD `b1c4758`). Isi kode tidak dijelaskan ulang.

**Batas sumber (baca dulu):**
- **Memory Claude untuk ga-web tidak punya catatan apa pun tentang tema.** Isinya hanya 2 feedback umum: jangan mematikan `npm run dev` dan jangan menambah atribusi Claude di commit. Jadi semua poin "masukan user", "mode paling banyak dipakai", dan "QA yang benar-benar dijalankan" = **tidak diketahui**, kecuali yang tersirat dari pesan commit.
- **`styling-guide.md` sudah tidak ada di working tree.** File ini dibuat di `5289c05` (12 Okt 2026) dan dihapus di `a0f2455` (22 Okt 2026, "Improve ui guide"). Kutipan di bawah diambil dari `git show a0f2455^:styling-guide.md`.
- Pesan commit di repo ini sangat pendek, jadi "penyebab" di bawah sering disimpulkan dari diff. Poin seperti itu diberi tanda **(disimpulkan)**.
- Riwayat tema: `ef02353` (6 Nov 2025, tema + aksen awal) → `c4faba4` (30 Sep 2026, GMI resmi) → `a800bc5` (9 Okt 2026, soft-light/soft-dark) → `0150da2` (9 Okt 2026, font) → `df085bd` (14 Okt 2026, sapu warna) → `8d930da` (21 Okt 2026, view transition, theme-color, offline) → `a5da961` (27 Okt 2026, merah di dark).

---

## 1. Bug & perbaikan setelah dark/soft mode dinyalakan

| # | Komponen/halaman | Gejala | Penyebab | Perbaikan | Commit |
|---|---|---|---|---|---|
| 1 | Halaman publik verifikasi PO `app/approval-po/[id]/page.tsx` | Teks putih di atas kartu putih saat dark **(disimpulkan dari judul commit)** | `bg-gray-100` / `bg-white` / `text-gray-900/700/500` / `text-blue-600` di-hardcode | Kelas hardcode dihapus, **bukan diganti token**, sehingga kartu jadi transparan (`"rounded-lg border  p-8"`) | `b969ef0` |
| 2 | Ringkasan Grand Total di detail PO | Angka Pajak/Ongkir hitam di latar gelap | `text-gray-900` | Diganti `text-muted-foreground`. "Diskon" sempat diubah ke `text-destructive-foreground` (putih, jadi hilang di light), lalu typo `text-destructive-foregrounde` (kelas tidak ada) di `5140f5a`. Blok ini ditulis ulang tanpa warna di `ba524c3` | `a18ab7b`, `5140f5a`, `ba524c3` |
| 3 | List MR & MR Management | Badge status, header tabel, dan kartu tabel tetap putih/terang | Badge tanpa varian `dark:`, `bg-white` di wadah tabel, `TableHeader bg-gray-50`, `text-gray-900` | Badge diberi `dark:`, `bg-white`→`bg-card`, `bg-gray-50`→`bg-muted/50`, panel filter `bg-muted/50 dark:bg-muted/10`, `SelectTrigger`/input di panel filter diberi `bg-background` agar tidak menyatu dengan panel | `de21228` |
| 4 | Semua border di soft-light/soft-dark/dark | Border terlalu terang ("garis putih") di soft-dark | Aturan kompatibilitas v3 `border-color: var(--color-gray-200)` berlaku di semua mode | Override border per mode: soft memakai `--border`, dark memakai zinc-600-ish ([app/globals.css:450](app/globals.css#L450) dan sesudahnya) | `a800bc5` |
| 5 | Kontrol native (scrollbar, date input, autofill) di mode soft | **Tidak diketahui** apakah pernah jadi bug | next-themes hanya mengisi `color-scheme` untuk nilai `light`/`dark` **(disimpulkan)** | `color-scheme: light/dark` ditulis manual di `.soft-light`/`.soft-dark` ([app/globals.css:119](app/globals.css#L119), [app/globals.css:151](app/globals.css#L151)) | `a800bc5` |
| 6 | Toast sonner di mode soft | Wrapper `components/ui/sonner.tsx` memetakan soft→light/dark dan memakai token popover | Sonner hanya mengenal light/dark/system | Lihat **bug terbuka** di bawah tabel: wrapper ini tidak dipakai | `a800bc5` |
| 7 | ~15 halaman (Barang, MR, PO create/edit/detail, Item Request, User Mgmt, Tentang App, Pending Approval) | Alert amber/orange/yellow/green dan badge tetap pastel terang di dark, tombol `bg-blue-600`/`bg-green-600` tidak ikut aksen, hero Tentang App memakai gradient biru tetap | Kelas warna tanpa `dark:` dan warna aksi hardcode | Tambah pola `dark:bg-X-900/30-40 dark:text-X-200/300 dark:border-X-800`. Tombol hardcode → `Button` default (primary). Gradient hero → `bg-primary text-primary-foreground`. Link `text-blue-600` → `text-primary`. `--sidebar-ring` → `hsl(var(--ring))` agar ikut aksen | `df085bd` |
| 8 | Teks merah di semua dark mode (`text-destructive`, error, tombol hapus) | Teks merah tidak terbaca | `--destructive` bawaan shadcn untuk dark adalah `0 62.8% 30.6%` (merah tua); soft-dark `0 60% 45%` | Token dinaikkan ke red-400 (`0 91% 71%` dark, `0 90% 74%` soft-dark; kontras dicatat 6.4:1 dan 5.4:1, [app/globals.css:102](app/globals.css#L102), [app/globals.css:167](app/globals.css#L167)). Efek sampingnya, fill solid dengan teks putih jadi terlalu terang, jadi semua `bg-destructive` solid diberi `dark:bg-destructive/60 dark:hover:bg-destructive/50` (Button, Badge, dan 7 pemakaian custom) | `a5da961` |
| 9 | Item "Keluar" di menu profil top bar | Merah tidak terbaca di dark | Sama dengan #8 | Hardcode `dark:text-red-400 dark:focus:bg-red-950/40`. Commit ini 29 menit **sebelum** perbaikan token di #8, jadi sekarang kemungkinan redundan **(disimpulkan)** | `07951cd` |
| 10 | Logo perusahaan (`components/company-logo-badge.tsx`) | Logo navy/hitam tenggelam di dark; versi awalnya memakai kotak `bg-white` | Aset logo gelap | Kotak putih dibuang. Landscape memakai aset ber-stroke putih (`gmi-landscape-stroke.webp`), logo kotak memakai `drop-shadow` putih 1px di 4 arah | `cfbf347` → `0129bb6` |
| 11 | Chart dashboard (recharts) | **Tidak diketahui** gejalanya | Palet pie memakai `hsl(var(--chart-n))`, padahal token `--chart-n` berformat **oklch**, sehingga `hsl(oklch(...))` tidak valid **(disimpulkan)** | Pie diganti palet hex Tailwind-500 (`PIE_COLORS`). Area memakai `var(--color-mr/po)` dari ChartConfig. Grid `stroke="hsl(var(--border))"`. Tooltip custom `bg-background` + `text-muted-foreground` | `22566ea` → `a532022`, `ed8c8bf` |
| 12 | Chip mention di rich text (Tiptap) | – | – | Ditulis langsung dengan `dark:` (`text-amber-600 dark:text-amber-400`, dst.) di [components/rich-content-view.tsx:73-75](components/rich-content-view.tsx#L73-L75) | `aec1bda` |
| 13 | Dialog/AlertDialog | Isi terpotong di HP (bukan bug tema) | Tidak ada `max-h` | `max-h-[calc(100dvh-2rem)] overflow-y-auto` | `8d930da` |

**Bug terbuka yang ditemukan saat menyusun laporan ini (belum diperbaiki, belum diuji visual):**
- **Toast:** [app/layout.tsx:7](app/layout.tsx#L7) mengimpor `Toaster` langsung dari `"sonner"`, bukan dari `components/ui/sonner.tsx`. Akibatnya pemetaan soft→base dan token popover di wrapper tidak pernah berlaku. Prop `theme` juga tidak diisi, jadi toast kemungkinan selalu terang (default sonner) di dark/soft-dark. Selain itu, wrapper menulis `"var(--popover)"` padahal token berformat HSL mentah dan butuh `hsl(var(--popover))`.
- **Token chart:** [app/globals.css:28-32](app/globals.css#L28-L32) `--color-chart-n: hsl(var(--chart-n))` tidak valid karena token-nya oklch. Saat ini tidak ada kelas `bg-chart-*` yang memakainya, jadi belum terlihat.
- **Aksen tanpa anti-flash:** font & ukuran font punya init script di `<head>` (`lib/font-options.ts`), tetapi aksen dibaca di `useEffect` ([lib/theme-provider.tsx:73](lib/theme-provider.tsx#L73)). Kemungkinan ada kedip ke zinc saat load **(disimpulkan, tidak diketahui apakah pernah dikeluhkan)**.

**Tidak ditemukan commit perbaikan tema** (status bug: tidak diketahui) untuk: tabel & sticky header, Sheet, Select/Popover/Command (selain #3), Calendar/DatePicker, Tiptap editor/prose (`@tailwindcss/typography` tidak terpasang), QR (hanya ada di dokumen cetak yang selalu putih), kanvas/tanda tangan (tidak ada komponen TTD kanvas; "TTD" adalah tanda tangan di dokumen cetak), cropper (latar `#fff` untuk PNG transparan disengaja, [components/image-crop-dialog.tsx:435](components/image-crop-dialog.tsx#L435)), input autofill (tidak ada CSS `-webkit-autofill`), scrollbar, skeleton.

## 2. Aturan warna hardcode

Pemetaan yang dipakai di commit perbaikan (`de21228`, `df085bd`, `b969ef0`, `a18ab7b`):

| Hardcode | Menjadi | Contoh commit |
|---|---|---|
| `bg-white` (wadah/kartu) | `bg-card` | `de21228` (tabel MR Mgmt) |
| `bg-white` (trigger/input) | `bg-background` | `de21228` (combobox filter) |
| `bg-gray-50`, `bg-gray-50/50` (header tabel, hover) | `bg-muted/50` | `de21228` |
| `bg-gray-100` (latar halaman) | `bg-muted`, atau dihapus | `df085bd` (pending-approval), `b969ef0` |
| `text-gray-900` | `text-foreground` / `text-muted-foreground` | `de21228`, `a18ab7b` |
| `text-gray-500`, `hover:bg-gray-100` | `text-muted-foreground`, `hover:bg-muted` | `df085bd` |
| `border-slate-300`, `border-blue-100` | `border-border` / `border` tanpa warna | `df085bd` |
| `text-blue-600` (link) | `text-primary` | `df085bd` |
| `bg-blue-600`/`bg-green-600` (tombol aksi) | `Button` default (primary) | `df085bd` |
| Gradient dekoratif biru/cyan | `bg-primary` + `primary-foreground/xx` | `df085bd` (tentang-app) |
| Warna semantik `-50/-100` + `-600/-700/-800` | Tetap, ditambah `dark:bg-X-900/30-40 dark:text-X-200/300 dark:border-X-800` | `df085bd`, `de21228` |
| Status abu `border-gray-300 text-gray-500 bg-gray-50` | `border-border text-muted-foreground bg-muted` | `df085bd` |
| `bg-slate-600` (badge solid) | `bg-slate-600 dark:bg-slate-700` | `de21228` |

**Sengaja dibiarkan hardcode:**
- Dokumen cetak: `bg-white text-black` di [PaginatedPrintDocument.tsx:254](app/(With%20Sidebar)/purchase-order/[id]/PaginatedPrintDocument.tsx#L254) (`ed8c8bf`), `border-black`/`text-gray-*`/`bg-gray-100` di `PrintablePO.tsx` dan `components/petty-cash/PrintablePettyCashDocument.tsx`. Watermark `text-gray-400/30` ([PaginatedPrintDocument.tsx:193](app/(With%20Sidebar)/purchase-order/[id]/PaginatedPrintDocument.tsx#L193)).
- Badge status dokumen solid `text-white bg-X-500` (styling-guide §6 di bawah).
- Badge jumlah notifikasi `bg-red-500 text-white`.
- Label pie chart `fill="white"` dan palet hex `PIE_COLORS` (`a532022`).
- Kartu putih di hero Tentang App: `bg-white` tetap dipertahankan di `df085bd` (hanya ring-nya yang diubah).
- Preview kertas, panel yang selalu gelap: **tidak diketahui** (tidak ditemukan contoh di riwayat).

Perintah sapu yang dianjurkan (styling-guide §11 langkah 4):
`grep -rnE "bg-(white|black)|text-(gray|slate|zinc)-[0-9]|bg-(indigo|violet|purple)-[0-9]|from-(indigo|purple|blue)" app components`

## 3. Aksen

- **GMI:** awalnya `215 75% 32%` (biru), lalu diganti ke navy resmi `#242365` = `240.9 48.6% 26.7%` di `c4faba4`. Versi dark `241 50% 66%` dengan foreground gelap `241 50% 10%`. Navy asli di latar gelap hampir tidak terlihat, jadi dibuat terang dengan teks gelap **(alasan disimpulkan, konsisten dengan komentar "teks primary tetap kontras dengan background gelap" di globals.css)**.
- **GIS:** `144 58.6% 21.8%` (= `rgb(23 88 49)`), dark `144 45% 45%` dengan foreground `144 60% 8%`.
- **Soft-dark:** awalnya hanya `.dark.theme-*` yang punya override. Di `a800bc5`, GMI/GIS diberi selector `.soft-dark.theme-*`, dan 15 aksen umum diberi versi setara Tailwind 400 + foreground gelap (`H 60% 12%`) supaya tombol/badge/`text-primary` kontras di latar abu ([app/globals.css:325-398](app/globals.css#L325-L398)).
- **Amber/yellow + primary-foreground:** tidak ada commit khusus. Di soft-dark sudah tertangani oleh pola foreground gelap. Di light, kontras teks putih di amber: **tidak diketahui** (tidak pernah dicatat).
- **Komponen yang salah pakai `primary`:** tidak ditemukan commit yang memperbaiki pemakaian `primary` untuk hal non-aksen. Masalah yang terjadi justru kebalikannya: warna aksi hardcode (`bg-blue-600`, `text-blue-600`, gradient biru) yang tidak ikut aksen, diperbaiki di `df085bd`. Soft-light/soft-dark tanpa aksen memakai `primary` abu-coklat/abu-terang (`30 7% 25%`, `210 16% 87%`), bukan zinc.

## 4. Font

- Diperkenalkan di `0150da2`: 8 pilihan font + 4 ukuran (`html[data-font]`, `html[data-font-size]`), init script anti-flash di `<head>`.
- **Masalah yang tercatat di commit yang sama:** `Badge` diubah dari `<div>` ke `<span>`, dan `<p>` di Step dokumentasi diubah ke `<div>`. Kemungkinan karena ada markup tidak valid/hydration warning (`div` di dalam `p`) yang muncul saat area itu disentuh **(disimpulkan)**.
- **Weight:** Atkinson hanya dimuat `400, 700` ([lib/fonts.ts:52](lib/fonts.ts#L52)), padahal UI banyak memakai `font-medium`/`font-semibold`, sehingga browser membulatkan atau mensintesis weight. Poppins `300–700`. Belum pernah tercatat sebagai keluhan: **tidak diketahui**.
- **Lebar kolom / tabular-nums / layout bergeser:** tidak ada commit perbaikan terkait ganti font. `tabular-nums` sudah dipakai sejak `41b4f55` untuk alasan lain. **Tidak diketahui.**
- **Cetak:**
  - `PaginatedPrintDocument` memasang `html[data-printing]` lewat `useLayoutEffect` **sebelum** pengukuran pagination. Tujuannya mengembalikan root font-size ke 100% agar tinggi terukur sama dengan hasil cetak (`0150da2`, [app/globals.css:430](app/globals.css#L430)).
  - `@media print` memaksa font-size 100% dan `--font-app` kembali ke Geist ([app/globals.css:431-436](app/globals.css#L431-L436)).
  - Catatan: `data-printing` hanya me-reset **ukuran**, bukan jenis font. Konsistensi jenis font saat pengukuran bergantung pada kelas `font-sans` di dokumen ([PaginatedPrintDocument.tsx:254](app/(With%20Sidebar)/purchase-order/[id]/PaginatedPrintDocument.tsx#L254)), yaitu stack default Tailwind dan bukan `--font-app` **(disimpulkan)**.
- **Ukuran font tanpa animasi** (slider berjalan beruntun dan jadi patah-patah), aksen & jenis font memakai cross-fade (`8d930da`, [lib/theme-provider.tsx](lib/theme-provider.tsx)).

## 5. Cetak & PWA

- **Cetak tetap terang:** tidak ada aturan global "paksa light" di `@media print` (tidak ada `color-scheme`/`print-color-adjust`). Hasil cetak terang karena dokumen cetak meng-hardcode `bg-white text-black` (lihat §2), sedangkan shell disembunyikan (`.no-print`, `[data-slot="sidebar"]`, [app/globals.css:524](app/globals.css#L524) dst.). Elemen bertoken yang **tidak** diberi `no-print` akan ikut tercetak dengan warna tema aktif **(disimpulkan)**.
- **Logo cetak:** preload semua logo perusahaan supaya "Cetak GMI/GIS" tidak mencetak logo lama (`129d38a`).
- **theme-color-sync** (`8d930da`, `components/pwa/theme-color-sync.tsx`):
  - `viewport.themeColor` hanya bisa mengikuti tema sistem (light `#ffffff` / dark `#18181b`).
  - Setelah hydrate, komponen menyalin `getComputedStyle(body).backgroundColor` ke semua `<meta name="theme-color">`, menghapus atribut `media`, dan memantau perubahan `class` di `<html>`.
  - Untuk soft mode, first paint memakai warna sistem dan baru menyesuaikan setelah hydrate.
- **offline.html** (`8d930da`): membaca `localStorage.theme`. `dark`/`soft-dark`/`system`+prefers-dark dirender dengan palet zinc gelap; selain itu terang. **Soft mode tidak punya palet sendiri** dan aksen diabaikan.
- **Larangan:** jangan memanggil `setTheme` langsung; selalu lewat `runViewTransition` (taste-ui.md §7).

## 6. Masukan user setelah rilis tema

- Mode paling banyak dipakai: **tidak diketahui** (tidak ada catatan di memory, tidak ada telemetri di repo).
- Keluhan: **tidak diketahui** dari memory. Yang tersirat dari pesan commit:
  - "teks merah tidak terbaca saat dark mode" (`a5da961`)
  - "text putih saat dark mode di halaman approval-po" (`b969ef0`)
  - "warna pada topbar" (`07951cd`)
  - "bug warna pada Grand Total" (`a18ab7b`)
  - Siapa pelapornya: tidak diketahui.
- Permintaan revisi/keputusan yang tersirat:
  - Aksen GMI diganti ke navy resmi `#242365` (`c4faba4`).
  - Logo tanpa kotak putih di dark (`0129bb6`).
  - Tambah mode soft karena light terlalu silau dan dark terlalu pekat (komentar CSS di `a800bc5`).
  - Alasan/pemintanya: tidak diketahui.

## 7. Checklist QA tema

Yang **terdokumentasi** (apakah benar-benar dijalankan sebelum rilis: **tidak diketahui**):
- styling-guide §11 langkah 9: uji light, soft-light, dark, soft-dark × aksen default, GMI, dan satu warna umum; ukuran font "Sangat Besar"; lebar 375px; sidebar mode ikon; `prefers-reduced-motion`.
- taste-ui.md §8: uji di 4 mode + 1 aksen non-default; font "Sangat Besar" + sidebar ikon; bagian yang tidak dicetak diberi `no-print`.
- Catatan: kedua checklist tidak menyebut mode **System**, cetak di dark mode, toast, atau PWA standalone.

Yang **paling sering terlewat** (disimpulkan dari commit perbaikan):
1. `bg-destructive`/`text-destructive` di dark (`a5da961`, `07951cd`)
2. Badge/alert semantik `-50/-100` tanpa `dark:` (`de21228`, `df085bd`)
3. `bg-white`/`bg-gray-*` di halaman di luar layout sidebar (`b969ef0`, `df085bd` pending-approval)
4. `text-gray-900` di angka/total (`a18ab7b`)
5. Warna aksi hardcode yang tidak ikut aksen (`df085bd`)

## 8. Bagian `styling-guide.md` yang relevan (salinan apa adanya)

Sumber: `git show a0f2455^:styling-guide.md`. Catatan: guide ini masih menyebut "4 mode" dan belum menyebut mode System.

### 4. Sistem tema (aturan mode & token)

### 4.1 Mode (class di `<html>`)

| Mode         | Karakter                                                         |
| ------------ | ---------------------------------------------------------------- |
| `light`      | Zinc default shadcn: putih bersih, teks zinc-950                 |
| `dark`       | Zinc gelap (`240 5.9% 10%`), tidak hitam pekat                   |
| `soft-light` | Off-white hangat (`40 14% 91.5%`), teks abu tua coklat. Tidak silau |
| `soft-dark`  | Abu kebiruan redup (`215 14% 16.5%`), teks diredam                |

`soft-dark` dihitung sebagai dark: `@custom-variant dark (&:is(.dark *, .soft-dark *));`
jadi utility `dark:` tetap berlaku di soft-dark.

### 4.2 Warna aksen (class `theme-<name>` di `<html>`)

Aksen **hanya** mengubah `--primary`, `--primary-foreground`, `--ring`.

- **Perusahaan:** `theme-gmi` (navy `#242365`), `theme-gis` (hijau `rgb(23 88 49)`).
  Di dark/soft-dark otomatis memakai versi lebih terang.
- **Umum:** blue, sky, cyan, teal, emerald, green, amber, orange, red, rose,
  pink, fuchsia, purple, violet, indigo. Di soft-dark memakai shade setara
  Tailwind 400 dengan teks gelap.
- `zinc` = default (tanpa class).

Disimpan di `localStorage["accent-theme"]`.

### 4.3 Token warna

Format token: HSL **tanpa** `hsl()` (`--primary: 240 5.9% 10%`), dibungkus
di `@theme` → `--color-primary: hsl(var(--primary))`. Kalau menambah token
baru, ikuti pola yang sama dan definisikan nilainya di **keempat** mode.

| Token                    | Pakai untuk                                       |
| ------------------------ | ------------------------------------------------- |
| `background/foreground`  | Latar halaman & teks utama                        |
| `card`, `popover`        | Permukaan card, dropdown, dialog                  |
| `primary`                | Tombol utama, link, indikator aktif, badge count  |
| `secondary`              | Tombol sekunder, badge netral                     |
| `muted / muted-foreground` | Latar redup, teks keterangan/label kecil        |
| `accent`                 | Hover item menu/ghost button, item terpilih       |
| `destructive`            | Hapus, reject, error                              |
| `border`, `input`, `ring` | Garis, border input, focus ring                  |
| `sidebar-*`              | Khusus sidebar shadcn                             |
| `chart-1..5`             | Seri chart (oklch, beda antara light & dark)      |

Radius: `--radius: 0.5rem` → `rounded-lg` = 0.5rem, `rounded-md` = 6px,
`rounded-sm` = 4px. Card memakai `rounded-xl`.

### 4.4 Border

Border default diatur di globals.css per mode (gray-200 di light,
`--border` di soft, zinc-600-ish di dark). Cukup tulis `border` / `border-b`
tanpa warna. Jangan menambah `border-gray-200` manual.

### 6. Warna status (badge)

Status per item/voucher memakai **badge outline lembut** dengan pola tetap (light: `-50/-700/-200`,
dark: `-900/40 / -300 / -800`). Simpan map-nya di satu file konstanta
(di ga-web: `type/enum.ts`), jangan ditulis inline di tiap halaman.

```ts
const tone = (c: string) =>
  `bg-${c}-50 text-${c}-700 border-${c}-200 dark:bg-${c}-900/40 dark:text-${c}-300 dark:border-${c}-800`;
// ⚠️ Tailwind tidak bisa membaca class dinamis seperti di atas.
// Tulis string lengkapnya, contoh:
export const STATUS_COLORS: Record<string, string> = {
  Pending:   "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700",
  Process:   "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
  Waiting:   "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800",
  Approved:  "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800",
  Completed: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800",
  Rejected:  "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
};

<Badge variant="outline" className={STATUS_COLORS[status] ?? STATUS_COLORS.Pending}>
  {status}
</Badge>
```

Arti warna yang konsisten dipakai:

| Warna        | Makna                                   |
| ------------ | --------------------------------------- |
| gray         | Draft / pending / default               |
| blue         | Sedang diproses / menunggu tindakan     |
| sky, indigo  | Tahap lanjutan proses                   |
| yellow/amber | Menunggu approval, sebagian, perhatian  |
| orange       | Butuh dokumen / tindak lanjut           |
| green        | Approved                                |
| emerald      | Selesai / closed (sedikit lebih tebal: `-100/-800`) |
| red          | Rejected / masalah                      |

Pengecualian yang memang dipakai:

- **Status dokumen MR/PO** (header halaman detail) memakai badge **solid**:
  `border-transparent text-white bg-<warna>-500` (pending = `bg-secondary`,
  rejected = `bg-destructive`). Sumbernya `getStatusBadge` di halaman detail;
  halaman Dokumentasi menyalin map yang sama (`DOC_STATUS_COLORS` di
  `dokumentasi/_components/primitives.tsx`) supaya tampilannya identik.
- **Badge jumlah notifikasi** di sidebar: `rounded-full bg-red-500 text-white
  text-[10px] font-bold`, maksimal tampil `99+`. Saat sidebar diciutkan, badge
  pindah ke pojok ikon (`absolute -top-1.5 -right-1.5 h-4 w-4 text-[9px]`).

Untuk aksi utama tetap pakai `Button` default (warna `primary`), **bukan**
`bg-green-600` dsb.

### 7.1 Halaman dengan sidebar (visual shell)

Route group `app/(With Sidebar)/layout.tsx`:

```tsx
<NavigationProgress />   {/* progress bar navigasi, di luar SidebarProvider */}
<SidebarProvider>
  <AppSidebar className="shadow-lg no-print" />
  <SidebarInset>
    <header className="no-print flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
        <Breadcrumb>{/* breadcrumb otomatis dari pathname */}</Breadcrumb>
      </div>
    </header>
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="grid grid-cols-12 items-start gap-4 md:gap-6 auto-rows-auto">
        {children}
      </div>
    </div>
  </SidebarInset>
</SidebarProvider>
```

- Sidebar: `collapsible="icon"`, logo perusahaan (`/lourdes-logo.webp`) full
  width di `SidebarHeader`, lalu `SidebarSearch`, menu dikelompokkan via
  `NavMain label="..."` (Admin, Menu, Petty Cash, About), `NavUser` di footer.
- Link menu pakai `next/link` (bukan `<a>`), class
  `rounded-md px-3 py-2 hover:bg-accent active:scale-[0.98]`; aktif `bg-primary/5`.
- Tiap grup (kecuali About) punya tombol **Atur** (`ghost`, `h-6 text-[11px]`)
  untuk menyembunyikan menu; pilihan disimpan per grup.
- Breadcrumb: segmen URL di-Title-Case, segmen UUID terakhir disembunyikan.

### 9. Do & Don't (aturan token)

| ✅ Lakukan                                         | ❌ Hindari                                           |
| ------------------------------------------------- | --------------------------------------------------- |
| `bg-background`, `bg-card`, `text-muted-foreground` | `bg-white`, `text-gray-500`, `text-black`          |
| `text-primary` / `Button` default untuk aksen       | `bg-indigo-600` / gradient ungu-biru ala template AI |
| `border` tanpa warna                                | `border-gray-200` manual                            |
| `shadow-sm` / `shadow-xs` di card & chip           | `shadow-2xl` di mana-mana, glow, glassmorphism di halaman app |
| `rounded-md` (kontrol), `rounded-xl` (card)         | `rounded-3xl` / pill untuk semua hal                |
| Unit rem (class Tailwind)                           | `px` hardcode untuk font-size                       |
| Badge status dari map konstanta                     | Warna status ditulis ulang di tiap halaman          |
| Satu library ikon (lucide)                          | Emoji sebagai ikon UI, campur library ikon          |
| Tes di 4 mode + minimal 1 aksen non-default         | Hanya tes di light mode                             |
| Copy bahasa Indonesia, singkat & jelas              | Copy marketing berlebihan ("✨ Supercharge your…") |

## 9. (Tahap berikutnya) Riwayat Aktivitas

**Skema** (dari [supabase/migrations/0001_baseline.sql:434](supabase/migrations/0001_baseline.sql#L434), 1083, 1087, 1119, 1597):

```sql
CREATE TABLE IF NOT EXISTS "public"."activity_logs" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "text" NOT NULL,
    "description" "text",
    "metadata" "jsonb"
);
ALTER TABLE "public"."activity_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."activity_logs_id_seq" START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1);
ALTER TABLE ONLY "public"."activity_logs" ADD CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id");
CREATE INDEX "idx_activity_logs_resource_id" ON "public"."activity_logs" USING "btree" ("resource_id");
CREATE INDEX "idx_activity_logs_user_id" ON "public"."activity_logs" USING "btree" ("user_id");
ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");
GRANT ALL ON TABLE "public"."activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_logs" TO "service_role";
```

- **RLS:** di migrasi **tidak ada** `ENABLE ROW LEVEL SECURITY` maupun policy untuk `activity_logs` (bandingkan dengan tabel lain di [0001_baseline.sql:1300-1351](supabase/migrations/0001_baseline.sql#L1300-L1351)), padahal `anon` mendapat `GRANT ALL`. Status RLS di DB produksi: **tidak diketahui**, jadi perlu dicek langsung di Supabase. Jangan meniru pola ini di wms-gmi.
- **Index:** tidak ada index komposit `(resource_type, resource_id, created_at)`, padahal itulah pola query `fetchActivityLogs`.
- **`services/logService.ts`** (53 baris):
  - `logActivity(userId, actionType, resourceType, resourceId, description, metadata?)` melakukan insert dari **browser client**. Kalau gagal, hanya `console.error` dan tidak dilempar, jadi kegagalan log tidak terlihat oleh user.
  - `fetchActivityLogs(resourceType, resourceId)` men-select `*, users_with_profiles!user_id (nama, email)`, diurutkan `created_at desc`, tanpa limit/paginasi. Kalau error, mengembalikan `[]`.
- **Pembaca log:** `components/activity-log-dialog.tsx`, dipakai di detail MR, detail PO, dan edit MR Management.
- **`action_type`** (55 pemanggil `logActivity` + 1 insert langsung). Satu aksi lintas dokumen sering dicatat **dua kali** dengan `resource_type` berbeda (MR & PO); ini disengaja agar muncul di kedua riwayat:
  - **material_request:**
    - `CREATE_MR`, `UPDATE_MR`, `UPDATE_MR_ADMIN`, `UPDATE_MR_DEPARTMENT`, `DELETE_MR`, `RESUBMIT_MR`
    - `VALIDATE_MR`, `REJECT_MR`, `HOLD_MR`, `APPROVE_MR`, `REJECT_MR_APPROVER`
    - `CONVERT_MR_COMPANY`, `CONVERT_MR_ITEM_BARANG`, `USE_GA_STOCK`, `UPDATE_ITEM_STATUS`
    - `UPLOAD_ATTACHMENT`, `REMOVE_ATTACHMENT`, `UPLOAD_ITEM_BAST`, `REMOVE_ITEM_BAST`
    - `ADD_MANUAL_PO_LINK`, `REMOVE_MANUAL_PO_LINK`, `TOGGLE_PAYMENT_ISSUE`, `ADD_MR_DISCUSSION`
    - `REQUEST_FOLLOWUP_MR_APPROVAL`, `ADMIN_OVERRIDE_APPROVAL`
    - Juga `CREATE_PO`, `UPDATE_PO`, `VALIDATE_PO`, `REJECT_PO_VALIDATION` yang dicatat ke MR
  - **purchase_order:**
    - `CREATE_PO`, `UPDATE_PO`, `CHANGE_PO_TYPE`, `VALIDATE_PO`, `REJECT_PO_VALIDATION`, `APPROVE_PO`, `REJECT_PO`
    - `CONVERT_PO_ITEM_BARANG`, `UPDATE_ITEM_STATUS`, `UPDATE_PAYMENT_DP_BP`, `TOGGLE_PAYMENT_ISSUE`
    - `UPLOAD_ATTACHMENT_PO`, `REMOVE_ITEM_BAST`, `RECEIVE_GOODS`
    - `EDIT_DELIVERY_TO_REQUESTER`, `SEND_TO_REQUESTER`
    - `ADD_MANUAL_PO_LINK`, `REMOVE_MANUAL_PO_LINK`
    - `REQUEST_FOLLOWUP_PO_APPROVAL`, `ADMIN_OVERRIDE_APPROVAL`
    - `GOODS_RECEIPT_CONFIRMED` (insert langsung di `services/goodsReceiptService.ts`, bukan lewat `logActivity`)
  - **mr_template:** `CREATE_MR_TEMPLATE`, `UPDATE_MR_TEMPLATE`, `DELETE_MR_TEMPLATE`
  - **system_settings:** `UPDATE_GOODS_RECEIPT_CODE`
  - Satu pemanggil memakai variabel `actionType` ([purchase-order/[id]/page.tsx:659](app/(With%20Sidebar)/purchase-order/[id]/page.tsx#L659)).
- **Lokasi pemanggil:**
  - `material-request/[id]/page.tsx` (14)
  - `purchase-order/[id]/page.tsx` (14)
  - `material-request/validate/[id]` (4), `purchase-order/validate/[id]` (4)
  - `mr-management/edit/[id]` (4), `PoEditForm.tsx` (3), `MrTemplateClient.tsx` (3)
  - `purchase-order/create` (2), `MrManagementClient.tsx` (2), `services/adminApprovalOverrideService.ts` (2)
  - `material-request/buat`, `discussion-component.tsx`, `followup-approval-button.tsx`, `GoodsReceiptSettingsClient.tsx` (masing-masing 1)
- **Tidak memakai `activity_logs`:** Petty Cash punya tabel sendiri (`petty_cash_budget_history`, `petty_cash_admin_audit_log`, [0004_petty_cash.sql:886](supabase/migrations/0004_petty_cash.sql#L886), [0004_petty_cash.sql:2216](supabase/migrations/0004_petty_cash.sql#L2216)). Riwayat Cost Center memakai `components/budget-history-dialog.tsx` (`305071a`).
- **Siapa "Sistem":** label fallback ketika join `users_with_profiles` bernilai null ([components/activity-log-dialog.tsx:124](components/activity-log-dialog.tsx#L124)). Aktor nyata tanpa login adalah service account **"Publik (Scan QR)"** (penerimaan barang via QR). Alasannya `user_id` NOT NULL + FK ke `auth.users`; nama penerima sebenarnya disimpan di `goods_receipt.receiver_name` ([0002_mr_po.sql:711-716](supabase/migrations/0002_mr_po.sql#L711-L716)).
- **Masalah yang pernah terjadi:**
  - Overflow/scroll dialog riwayat aktivitas MR/PO, diperbaiki dengan `min-h-0` lalu `h-[60vh]` (`11af29c`, `d37f298`).
  - `035b21a` "Refinement logging" **bukan** tentang `activity_logs`; isinya mengurangi log API Gateway Supabase dengan meng-cache `auth.getUser()`.
  - Aksi yang lupa dicatat, log ganda yang tidak disengaja: **tidak diketahui**.
- **Ukuran tabel/performa saat ini:** **tidak diketahui** (tidak bisa dibaca dari repo; perlu query `select count(*)` / `pg_total_relation_size` di Supabase).

---

## Top 10 hal yang paling mungkin rusak saat tema dipasang di aplikasi lain

1. **Warna semantik hardcode tanpa `dark:`** (badge, alert, panel `-50/-100`). Ini kategori bug terbanyak di riwayat (`de21228`, `df085bd`). Sapu dengan grep §2 dan pakai satu map status.
2. **`--destructive` dark bawaan shadcn.** Kalau token lama yang tersalin, teks merah tidak terbaca. Kalau token baru yang tersalin tetapi `dark:bg-destructive/60` di Button/Badge/AlertDialogAction terlewat, fill merah dengan teks putih gagal kontras (`a5da961`).
3. **Toaster diimpor langsung dari `sonner`**, sehingga toast tidak ikut tema/soft ([app/layout.tsx:7](app/layout.tsx#L7)). Pakai wrapper dan perbaiki `var(--popover)` → `hsl(var(--popover))`.
4. **`@custom-variant dark` tidak menyertakan `.soft-dark`.** Tanpa ini, semua `dark:` mati di soft-dark (`a800bc5`).
5. **Border gray-200 terang di soft/dark.** Override border per mode di globals.css ikut tersalin? (`a800bc5`)
6. **Format token campur HSL vs oklch.** `hsl(var(--chart-n))` tidak valid ([app/globals.css:28-32](app/globals.css#L28-L32), `a532022`). Chart recharts di wms-gmi harus memakai `var(--chart-n)` langsung atau palet hex.
7. **Aksen tanpa versi soft-dark/dark.** Kalau menambah aksen baru (mis. warna WMS), wajib membuat `.dark.theme-x, .soft-dark.theme-x` dengan foreground gelap (`a800bc5`, `c4faba4`).
8. **Halaman di luar layout utama** (publik/QR, auth, pending-approval, offline.html) yang memakai `bg-white`/`bg-gray-100`. Pernah rusak di `b969ef0` dan `df085bd`. offline.html tidak mengenal soft/aksen.
9. **Cetak bergantung pada hardcode `bg-white text-black` + `no-print`**, bukan aturan global. Elemen bertoken yang lupa diberi `no-print` akan tercetak gelap. `data-printing` hanya me-reset ukuran font, bukan jenis font.
10. **Logo/gambar gelap di dark** (butuh aset ber-stroke atau outline drop-shadow, `0129bb6`), kedip aksen saat load (tanpa init script), dan key `localStorage` (`theme`, `accent-theme`, `font-family`, `font-size`) yang saling menimpa bila wms-gmi dan ga-web berbagi domain (taste-ui.md §3.12, "Adaptasi wajib").
