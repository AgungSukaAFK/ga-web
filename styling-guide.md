# Styling Guide — Garuda Procure

Panduan ini untuk menyamakan tampilan project Next.js + Supabase lain dengan
web ini (`ga-web`). Isinya: stack, file yang perlu dicopy, design token,
aturan pemakaian komponen, dan daftar aset gambar.

Pasangannya `taste-ui.md` (komponen, pola halaman, aturan interaksi). Dokumen
ini sesuai kondisi kode 4 Nov 2026.

> Prinsip utama: **semua warna lewat token** (`bg-background`, `text-primary`,
> `border`, dst). Hindari warna hardcode (`bg-white`, `text-black`,
> `bg-blue-600`) kecuali untuk badge status (lihat bagian 6). Dengan begitu
> 4 mode tema (plus pilihan System) dan 17 warna aksen otomatis jalan di semua
> halaman.

---

## 1. Stack

| Bagian        | Yang dipakai                                                        |
| ------------- | ------------------------------------------------------------------- |
| Framework     | Next.js 15 (App Router), React 19                                   |
| CSS           | **Tailwind CSS v4** (`@import "tailwindcss"`, tanpa `tailwind.config`) via `@tailwindcss/postcss` |
| Animasi       | `tailwindcss-animate` (`@plugin` di globals.css)                    |
| Komponen      | shadcn/ui style **new-york**, baseColor **neutral**, `cssVariables: true` |
| Primitive     | Radix UI (`@radix-ui/react-*` + `radix-ui`)                         |
| Ikon          | `lucide-react` (satu-satunya library ikon)                         |
| Tema          | `next-themes` + provider custom (`CustomThemeProvider`)            |
| Toast         | `sonner`, dipanggil lewat wrapper `lib/toast.tsx` (bagian 3 & 8)    |
| Export Excel  | `exceljs` lewat `lib/excel-export.ts`                               |
| Chart         | `recharts` + `components/ui/chart.tsx`                              |
| Util class    | `clsx` + `tailwind-merge` → `cn()` di `lib/utils.ts`                |
| Variant       | `class-variance-authority` (cva)                                    |
| Command/combobox | `cmdk`                                                           |

Install di project baru:

```bash
npm i next-themes sonner lucide-react class-variance-authority clsx tailwind-merge \
  cmdk radix-ui recharts react-day-picker date-fns exceljs \
  @radix-ui/react-{accordion,alert-dialog,avatar,checkbox,dialog,dropdown-menu,label,popover,select,separator,slot,tooltip}
npm i -D tailwindcss @tailwindcss/postcss tailwindcss-animate postcss
```

`postcss.config.mjs`:

```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```

---

## 2. File yang dicopy apa adanya

Copy file-file ini dari `ga-web` ke project baru (path sama), lalu sesuaikan
import kalau ada yang tidak ada di project baru.

**Fondasi tema (wajib):**

- `app/globals.css`: semua token warna, 4 mode tema, warna aksen, font, print.
  Bagian `#printable-po-a4`, `.feedback-editor`, `auth-kenburns` dan
  keyframe `docs-*` (halaman Dokumentasi) boleh dibuang kalau tidak dipakai.
- `components.json`: config shadcn (new-york, neutral, lucide).
- `lib/utils.ts`: `cn()` dan helper format (`taste-ui.md` bagian 5–6).
- `lib/theme-provider.tsx`: `CustomThemeProvider`, `accentThemes`, `useCustomTheme`.
- `lib/view-transition.ts`: animasi ganti tema/aksen/font, dipakai `theme-provider`.
- `lib/toast.tsx` + `lib/clipboard.ts`: wrapper toast dengan tombol Salin.
- `lib/fonts.ts`: deklarasi `next/font/google` (Geist default + 6 opsi).
- `lib/font-options.ts`: daftar font/ukuran + `fontInitScript` anti-flash.

**Switcher (taruh di header / halaman auth):**

- `components/theme-switcher.tsx`: Light / Soft Light / Dark / Soft Dark / System.
- `components/accent-theme-switcher.tsx`: pilih warna aksen.
- `components/font-switcher.tsx`: jenis & ukuran font (butuh `ui/slider`, `ui/popover`).

**Komponen UI:** copy seluruh folder `components/ui/`. Beberapa sudah
dimodifikasi dari default shadcn, jadi **jangan** generate ulang lewat
`npx shadcn add`:

- `button.tsx` & `badge.tsx`: versi `forwardRef`/cva dengan shadow halus.
- `searchable-select.tsx`: select dengan pencarian (cmdk).
- `currency-input.tsx`: input Rupiah.
- `sidebar.tsx`: shadcn sidebar (collapsible icon).
- `toast-copy-button.tsx`, `copy-text-button.tsx`: tombol salin, buatan sendiri.

**Komponen layout/pola (opsional tapi dianjurkan):**

- `components/content.tsx`: wrapper Card untuk grid 12 kolom.
- `components/filter-panel.tsx`: panel filter lipat, chip filter aktif, dan helper
  field (`FilterFields`, `FilterField`, `FilterRange`, dst).
- `components/list-search-input.tsx`: kotak cari + ikon bantuan.
- `components/sticky-header-table.tsx`: tabel dengan header menempel di bawah top bar.
- `components/sortable-table-head.tsx`, `components/reorderable-table-head.tsx`:
  header tabel sortable via URL dan header yang bisa digeser.
- `components/row-actions-menu.tsx`: menu titik tiga kolom Aksi.
- `components/excel-download-menu.tsx`: tombol export Excel.
- `components/table-pagination-footer.tsx` + `components/custom-pagination.tsx`:
  footer tabel (jumlah baris, rentang data, paginasi, lompat halaman).
- `components/auth/auth-shell.tsx` + `components/auth/auth-input.tsx`: layout login/sign-up.
- `components/app-sidebar.tsx`, `nav-main.tsx`, `nav-user.tsx`: struktur sidebar
  (isi menu disesuaikan).
- `components/sidebar-search.tsx` + `lib/sidebar/menu-search.ts`: pencarian menu
  di sidebar (isi `MENU_KEYWORDS` disesuaikan dengan URL menu project baru).
- `lib/sidebar/menu-visibility.ts`: tombol "Atur" untuk sembunyikan menu per grup.
- `components/navigation-progress.tsx` + `lib/sidebar/nav-pending.ts`: progress
  bar & spinner saat pindah halaman dari sidebar.
- `components/link-attachment-form.tsx`: form lampiran berupa link (Google Drive)
  untuk file yang terlalu besar diunggah.

---

## 3. Setup root layout

```tsx
// app/layout.tsx
import { CustomThemeProvider } from "@/lib/theme-provider";
import { fontVariables } from "@/lib/fonts";
import { fontInitScript } from "@/lib/font-options";
import { Toaster } from "sonner";
import "./globals.css";

// Warna status bar HP / title bar PWA mengikuti background tema.
export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#18181b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        {/* font & ukuran tersimpan dipasang sebelum render (anti-flash) */}
        <script dangerouslySetInnerHTML={{ __html: fontInitScript }} />
      </head>
      <body className="antialiased">
        <CustomThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          themes={["light", "dark", "soft-light", "soft-dark"]}
          disableTransitionOnChange
        >
          {children}
        </CustomThemeProvider>
        <Toaster
          richColors
          closeButton
          position="bottom-right"
          toastOptions={{
            closeButtonAriaLabel: "Tutup",
            classNames: { content: "flex-1" }, // tombol Salin rapat ke kanan
          }}
        />
      </body>
    </html>
  );
}
```

Catatan: `themes` **harus** berisi keempat mode, karena class `.soft-light` /
`.soft-dark` dipasang oleh next-themes ke `<html>`. Kalau memakai PWA, pasang
juga `<PwaSupport />` setelah `<Toaster>` supaya theme-color ikut tema pilihan
user (`taste-ui.md` 3.16).

---

## 4. Sistem tema

### 4.1 Mode (class di `<html>`)

| Mode         | Karakter                                                         |
| ------------ | ---------------------------------------------------------------- |
| `light`      | Zinc default shadcn: putih bersih, teks zinc-950                 |
| `dark`       | Zinc gelap (`240 5.9% 10%`), tidak hitam pekat                   |
| `soft-light` | Off-white hangat (`40 14% 91.5%`), teks abu tua coklat. Tidak silau |
| `soft-dark`  | Abu kebiruan redup (`215 14% 16.5%`), teks diredam                |

Pilihan kelima, **System**, bukan class tersendiri: next-themes memasang
`light` atau `dark` sesuai pengaturan OS.

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
| `destructive`            | Hapus, reject, error. Di dark & soft-dark nilainya merah terang supaya `text-destructive` terbaca; isian solid (`Button`, `Badge`) diredam `dark:bg-destructive/60` |
| `border`, `input`, `ring` | Garis, border input, focus ring                  |
| `sidebar-*`              | Khusus sidebar shadcn. `--sidebar-ring` mengikuti `--ring`, jadi ikut warna aksen |
| `chart-1..5`             | Seri chart (oklch, beda antara light & dark)      |

Radius: `--radius: 0.5rem` → `rounded-lg` = 0.5rem, `rounded-md` = 6px,
`rounded-sm` = 4px. Card memakai `rounded-xl`.

### 4.4 Border

Border default diatur di globals.css per mode (gray-200 di light,
`--border` di soft, zinc-600-ish di dark). Cukup tulis `border` / `border-b`
tanpa warna. Jangan menambah `border-gray-200` manual.

---

## 5. Tipografi

- Font default **Geist** (`--font-geist-sans`), dipasang ke `body` via `--font-app`.
- User bisa ganti font (`html[data-font=...]`): Inter, Plus Jakarta Sans,
  Poppins, Nunito, Roboto, Atkinson Hyperlegible, Font Sistem.
- Ukuran font global via `html[data-font-size=sm|lg|xl]` (87.5% / 112.5% / 125%).
  Karena itu **selalu pakai unit rem** (class Tailwind biasa). Hindari `px`
  untuk teks & spacing, kecuali `text-[10px]`/`text-[11px]` untuk label mikro.
- Saat print, ukuran & font selalu kembali ke default.

Skala yang dipakai:

| Elemen                        | Class                                                    |
| ----------------------------- | -------------------------------------------------------- |
| Judul halaman auth            | `text-2xl font-semibold tracking-tight`                  |
| Hero/headline besar           | `text-3xl xl:text-4xl font-semibold leading-tight tracking-tight text-balance` |
| Judul card (`CardTitle`)      | `leading-none font-semibold` (default komponen)          |
| Deskripsi / teks bantu        | `text-sm text-muted-foreground`                          |
| Teks tabel                    | `text-sm` (default `Table`)                              |
| Kode dokumen di tabel         | `font-mono text-xs font-semibold`                        |
| Angka di footer & kolom uang  | `tabular-nums`                                           |
| Label kecil / section label   | `text-xs font-medium text-muted-foreground`              |
| Badge count / chip            | `text-[11px] font-semibold` / `text-xs`                  |

Bobot: `font-medium` untuk tombol & label, `font-semibold` untuk judul.
Hampir tidak pernah `font-bold`.

---

## 6. Warna status (badge)

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
  Sistem baru memakai satu `StatusBadge` (`taste-ui.md` 9.5), bukan
  `getStatusBadge` per halaman.
- **Badge jumlah notifikasi** di sidebar: `rounded-full bg-red-500 text-white
  text-[10px] font-bold`, maksimal tampil `99+`. Saat sidebar diciutkan, badge
  pindah ke pojok ikon (`absolute -top-1.5 -right-1.5 h-4 w-4 text-[9px]`).

Untuk aksi utama tetap pakai `Button` default (warna `primary`), **bukan**
`bg-green-600` dsb.

---

## 7. Layout

### 7.1 Halaman dengan sidebar

Route group `app/(With Sidebar)/layout.tsx`:

```tsx
<NavigationProgress />   {/* progress bar navigasi, di luar SidebarProvider */}
<SidebarProvider>
  <AppSidebar className="shadow-lg no-print" />
  <SidebarInset>
    <TopbarProvider>
      {/* data-app-topbar dibaca StickyHeaderTable & panel ringkasan form */}
      <header data-app-topbar className="no-print sticky top-0 z-40 mb-4 flex shrink-0 flex-col border-b border-border/60 bg-background/90 backdrop-blur-md …">
        <div className="flex h-14 items-center gap-2 transition-[height] ease-linear md:h-16 md:group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          {/* SidebarTrigger, Separator, Breadcrumb, TopbarSearch, TopbarActions */}
        </div>
      </header>
    </TopbarProvider>
    <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 pt-0 break-words">
      <div className="grid grid-cols-12 items-start gap-4 md:gap-6 auto-rows-auto [&>*]:min-w-0">
        {children}
      </div>
    </div>
  </SidebarInset>
</SidebarProvider>
```

- Header: class lengkap dan perilakunya di `taste-ui.md` 3.2a. Blur di top bar
  fungsional (konten lewat di belakangnya), bukan dekorasi.
- Jangan memasang `overflow-*` di elemen antara `<main>` dan tabel. Header
  tabel sticky berhenti menempel kalau ada ancestor yang overflow.
- Sidebar: `collapsible="icon"`, logo perusahaan (`/lourdes-logo.webp`) full
  width di `SidebarHeader`, lalu `SidebarSearch`, menu dikelompokkan via
  `NavMain label="..."` (Admin, Menu, Petty Cash, About), `NavUser` di footer.
- Link menu pakai `next/link` (bukan `<a>`), class
  `rounded-md px-3 py-2 hover:bg-accent active:scale-[0.98]`; aktif `bg-primary/5`.
- Tiap grup (kecuali About) punya tombol **Atur** (`ghost`, `h-6 text-[11px]`)
  untuk menyembunyikan menu; pilihan disimpan per grup.
- Breadcrumb: segmen URL di-Title-Case, segmen UUID terakhir disembunyikan.

### 7.1a Pencarian menu sidebar

- Input `SidebarInput` dengan ikon `Search` kiri (`pl-8`) dan tombol `X` kanan
  (`h-5 w-5 rounded-sm`) saat ada isi. Placeholder `Cari menu...`.
- Cocok ke judul, singkatan (`mr`, `po`, `pc`), sinonim ID/EN, nama grup, dan
  tahan typo ringan. Grup tanpa hasil disembunyikan, tombol "Atur" disembunyikan
  dan menu yang di-hide tetap ikut dicari.
- **Enter** membuka hasil teratas, **Esc** mengosongkan. Query disimpan di
  `localStorage` agar tidak hilang saat pindah halaman.
- Sidebar diciutkan: tampil sebagai tombol ikon `Search` (aktif bila ada query)
  yang membuka sidebar lalu fokus ke input.
- Tidak ada hasil: blok tengah `py-8 text-sm text-muted-foreground` dengan ikon
  `SearchX` (`h-6 w-6 opacity-60`), query di-`font-medium text-foreground`, dan
  link "Hapus pencarian" `text-xs text-primary hover:underline`.

### 7.1b Feedback navigasi

Klik menu sidebar harus terasa instan walau halaman tujuan masih dimuat:

- Item yang diklik langsung jadi aktif (`bg-primary/10`), ikonnya diganti
  `Loader2 animate-spin text-primary`, `aria-busy` dipasang.
- `NavigationProgress`: bar `h-0.5 bg-primary` fixed di atas layar (`z-[100]`,
  `no-print`), jalan pelan ke ~85%, penuh + fade saat pathname berubah, auto
  batal setelah 20 detik.
- Ctrl/Cmd/Shift/klik tengah (buka tab baru) **tidak** memicu loading.
- Di mobile, sidebar ditutup otomatis setelah klik menu.

### 7.2 Konten halaman: `<Content>`

Setiap blok konten adalah Card di grid 12 kolom:

```tsx
<Content title="Daftar MR" description="..." cardAction={<Button>Tambah</Button>}>
  ...
</Content>
<Content size="md" title="Ringkasan">...</Content>   {/* setengah lebar di lg */}
```

| size | Lebar                                   |
| ---- | --------------------------------------- |
| `lg` | penuh (default)                         |
| `md` | 6/12 di `lg`                            |
| `sm` | 4/12 di `lg`                            |
| `xs` | 6/12 `sm`, 4/12 `lg`, 3/12 `xl` (stat card) |

Mobile selalu `col-span-12`.

### 7.3 Halaman list (pola standar)

Urutan dari atas: **kotak cari + Excel → FilterPanel → tabel → footer**.
Pemakaian tiap komponen ada di `taste-ui.md` 3.4. Yang di sini hanya visualnya:

| Bagian        | Tampilan                                                              |
| ------------- | --------------------------------------------------------------------- |
| Kotak cari    | `Input pl-10 pr-10`, ikon `Search h-5 w-5 text-muted-foreground` di kiri, tombol bantuan `CircleHelp` (`ghost`, `h-8 w-8`) di kanan, popover `w-72` berisi daftar 2 kolom |
| Tombol Excel  | `outline`, `w-full md:w-auto`, ikon `Newspaper` + `ChevronDown`, menu `w-64` |
| FilterPanel   | `rounded-lg border bg-muted/50 dark:bg-muted/10`, tombol "Filter" ghost + badge count `bg-primary`, chip `h-7 rounded-full border bg-background text-xs shadow-xs` |
| Isi filter    | Grid `auto-fit` minimal `8.5rem` per field, label `text-xs font-medium text-muted-foreground`, field rentang memakai container query |
| Header tabel  | Menempel di bawah top bar. `th` latar **solid** `bg-muted` (bukan `/50`, supaya baris di bawahnya tidak tembus), `rounded-t-md border-x border-t`, pembungkus `z-30 bg-card pt-2` |
| Isi tabel     | `rounded-md border overflow-x-auto`, tabel lebar diberi `min-w-[…px]`  |
| Header sort   | Seluruh sel `h-10` bisa diklik. Ikon `h-3.5 w-3.5`: `opacity-40` saat tidak aktif, penuh saat hover; kolom aktif `text-foreground` |
| Baris         | Bisa diklik: `cursor-pointer hover:bg-muted/50 transition-colors`      |
| Kolom Aksi    | Rata kanan, selalu tombol `ghost h-8 w-8 p-0` ikon `MoreHorizontal`    |
| Footer        | `mt-6`, `text-sm text-muted-foreground tabular-nums`, select `h-8 w-[88px] bg-background`, input halaman `h-8 w-14 text-center`. `flex-wrap`, jadi grup turun utuh saat sempit |

- Loading: header tetap tampil, hanya isi tabel yang diganti. List utama memakai
  baris `Skeleton h-8 w-full`, master data boleh satu baris `Loader2` di tengah.
- Kosong: satu baris `colSpan` penuh, `h-24 text-center`.
- Di mobile, angka halaman disembunyikan; tersisa tombol sebelumnya/berikutnya
  dan isian "Hal.".

### 7.4 Halaman auth (login/sign-up)

`AuthShell`: split screen.

- Desktop: kiri slideshow foto (`slide*.webp`, efek Ken Burns, fade 1.4s,
  ganti tiap 6s) dengan overlay `from-slate-950 via-slate-950/55`, logo app
  di kotak `rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur`,
  headline + subjudul `text-white/75`. Kanan: form di `bg-background`.
- Mobile: foto jadi latar penuh, form di kartu
  `rounded-2xl border bg-background/90 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl`.
- Atas kanan: tombol bantuan + AccentThemeSwitcher + FontSwitcher + ThemeSwitcher
  (semua `variant="ghost" size="sm"`, ikon `size={16} text-muted-foreground`).
- Logo grup: Lourdes di atas, GMI | GIS di bawah dipisah garis vertikal `bg-border`.
- Pemisah: `h-px bg-gradient-to-r from-transparent via-border to-transparent`.
- Input: `AuthInput` (ikon kiri, `h-11 pl-10`, toggle lihat password).
- Footer: `© {tahun} PT. Garuda Mart Indonesia · <Nama App>` `text-xs`.

---

## 8. Komponen & detail kecil

**Button**: `h-9 px-4 rounded-md text-sm font-medium`, ikon otomatis `size-4`.

- `default`: aksi utama (1 per area).
- `outline`: aksi sekunder di toolbar/form.
- `ghost`: tombol ikon di header, toggle, item menu.
- `destructive`: hapus/reject (selalu dengan `ConfirmDialog`).
- `size="sm"` (`h-8 text-xs`) untuk toolbar & tombol di dalam tabel.
- Tombol ikon saja: `size="icon"` atau `ghost sm` + `title`/`aria-label`.

**Ikon**: lucide, `size-4` / `size={16}` standar, `h-3.5 w-3.5` di chip kecil.
Ikon dekoratif di header pakai `text-muted-foreground`.

**Card**: `rounded-xl border bg-card py-6 shadow-sm`, padding horizontal `px-6`.

**Input**: shadcn default `h-9`. Di form auth `h-11`.

**Select**: pakai `SearchableSelect` jika opsi > ~7 item, selain itu `ui/select`.

**Dialog**: `ui/dialog` untuk form/detail, `ConfirmDialog` untuk konfirmasi.

**Dropdown aksi**: label "Aksi" di atas, item berikon `mr-2 h-4 w-4`, item
berbahaya `text-destructive focus:text-destructive` dan diletakkan paling bawah.

**Toast**: `toast.success / error / warning / info` dari `@/lib/toast`, bukan
langsung dari `sonner`. Semua toast otomatis punya tombol tutup dan tombol Salin,
kecuali `toast.loading`. Toast yang butuh aksi pakai `action: { label, onClick }`.

**Lapisan (z-index)**: header tabel `z-30`, top bar `z-40`, progress navigasi
`z-[100]`.

**Fokus**: `focus-visible:ring-1 focus-visible:ring-ring` (button),
`focus-visible:ring-2` (chip/link kecil). Jangan hilangkan outline tanpa ganti ring.

**Hover list item**: `rounded-md px-2 py-1.5 hover:bg-accent`, terpilih `bg-accent`
+ ikon `Check` di kanan.

**Item terpilih (swatch/opsi)**: `border-primary` atau `ring-2 ring-offset-2 ring-offset-background`.

**Transisi**: `transition-colors` di elemen interaktif; `transition-transform` +
`rotate-180` untuk chevron. Hormati `prefers-reduced-motion` untuk animasi besar.

**Animasi custom**: keyframe ditaruh di `globals.css` dengan prefix per fitur
(`auth-*`, `docs-*`), durasi/posisi bisa di-override lewat CSS variable
(`--docs-duration`, `--docs-from`, `--docs-to`), delay lewat `style={{ animationDelay }}`.
Setiap animasi baru **wajib** punya blok `@media (prefers-reduced-motion: reduce)`:
animasi berulang dimatikan, animasi masuk dibuat instan (`animation-duration: 0.01ms`).
Contoh yang tersedia: `docs-fade-up` (masuk konten), `docs-pop` (status baru),
`docs-ring` (pulse ring `--primary` untuk langkah aktif), `docs-grow-x`.

**Lampiran**: upload file biasa, plus `LinkAttachmentForm` (outline button
"Tambah Link", ikon `Plus` + `Link2`) untuk file besar via link Google Drive.
Validasi lewat `toast.warning`, bukan teks error inline.

**Angka & tanggal**: format `id-ID` (`Rp 150.000`, `09 Okt 2026`).

**Print**: `.no-print` untuk menyembunyikan elemen saat cetak,
`.print-only` untuk elemen yang hanya muncul saat cetak. `@page { size: A4; margin: 15mm }`.
Header sticky disembunyikan saat cetak; `<thead>` asli yang tampil.

---

## 9. Do & Don't

| ✅ Lakukan                                         | ❌ Hindari                                           |
| ------------------------------------------------- | --------------------------------------------------- |
| `bg-background`, `bg-card`, `text-muted-foreground` | `bg-white`, `text-gray-500`, `text-black`          |
| `text-primary` / `Button` default untuk aksen       | `bg-indigo-600` / gradient ungu-biru ala template AI |
| `border` tanpa warna                                | `border-gray-200` manual                            |
| `shadow-sm` / `shadow-xs` di card & chip           | `shadow-2xl` di mana-mana, glow, glassmorphism di halaman app |
| Latar solid `bg-muted` di header tabel sticky      | Latar transparan yang membuat baris tembus saat scroll |
| Kolom Aksi selalu menu titik tiga                  | Deretan tombol ikon berbeda-beda di tiap tabel      |
| `rounded-md` (kontrol), `rounded-xl` (card)         | `rounded-3xl` / pill untuk semua hal                |
| Unit rem (class Tailwind)                           | `px` hardcode untuk font-size                       |
| Badge status dari map konstanta                     | Warna status ditulis ulang di tiap halaman          |
| Satu library ikon (lucide)                          | Emoji sebagai ikon UI, campur library ikon          |
| Tes di 4 mode + minimal 1 aksen non-default         | Hanya tes di light mode                             |
| Copy bahasa Indonesia, singkat & jelas              | Copy marketing berlebihan ("✨ Supercharge your…") |

---

## 10. Aset gambar

Semua aset ada di `public/` (kecuali yang ditandai `app/`). Path di bawah
relatif terhadap root project.

### 10.1 Logo perusahaan: **copy** (dipakai lintas project grup)

| File                             | Ukuran | Dipakai di                                  |
| -------------------------------- | ------ | ------------------------------------------- |
| `public/lourdes-logo.webp`       | 44K    | Header sidebar, halaman auth, Tentang App, kop dokumen |
| `public/gmi-logo.webp`           | 4K     | Kop dokumen (logo kotak GMI), Tentang App  |
| `public/gis-logo.webp`           | 132K   | Kop dokumen (logo kotak GIS), Tentang App  |
| `public/gmi-landscape-stroke.webp` | 32K  | Logo GMI landscape di halaman auth          |
| `public/gis-landscape.webp`      | 32K    | Logo GIS landscape di halaman auth          |
| `public/lourdes.png`             | 92K    | Ikon notifikasi push/browser                |

### 10.2 Foto latar halaman auth: **copy** jika memakai `AuthShell`

| File                  | Ukuran |
| --------------------- | ------ |
| `public/slide.webp`   | 88K    |
| `public/slide2.webp`  | 388K   |
| `public/slide3.webp`  | 388K   |
| `public/slide4.webp`  | 80K    |
| `public/slide5.webp`  | 92K    |
| `public/slide6.webp`  | 84K    |

Urutan & `objectPosition` tiap slide diatur di array `SLIDES` di
`components/auth/auth-shell.tsx`.

### 10.3 Ikon aplikasi: **sesuaikan** (spesifik "Garuda Procure")

Copy kalau project baru belum punya ikon sendiri, lalu ganti nanti:

| File                      | Fungsi                                  |
| ------------------------- | --------------------------------------- |
| `public/icon.svg`         | Favicon SVG                             |
| `public/icons/icon-192.png` | Favicon PNG, apple-touch-icon, logo app di halaman auth |
| `public/icons/icon-512.png` | Ikon PWA (manifest)                    |
| `public/icons/icon-maskable-512.png` | Ikon PWA maskable (Android)   |
| `app/favicon.ico`         | Favicon fallback                        |
| `public/manifest.json`    | Bukan gambar; ubah `name`, `short_name`, `description` |

### 10.4 Tidak perlu dicopy

| File                                   | Alasan                                              |
| -------------------------------------- | --------------------------------------------------- |
| `public/landing/`                      | Aset landing page app ini                           |
| `app/opengraph-image.png`, `app/twitter-image.png` | Preview share link khusus app ini; buat baru |
| `public/gmi-landscape.webp`, `public/gmi.jpg` | Tidak direferensikan di kode (versi lama)    |
| `public/sw.js`, `public/offline.html`  | Bukan bagian styling. Bawa hanya kalau memakai PWA, lalu adaptasi (`taste-ui.md` 3.16) |

Ringkasnya, perintah copy minimal (dari root `ga-web`, ganti `../project-baru`):

```bash
DEST=../project-baru
mkdir -p $DEST/public/icons
cp public/{lourdes-logo.webp,gmi-logo.webp,gis-logo.webp,gmi-landscape-stroke.webp,gis-landscape.webp,lourdes.png} $DEST/public/
cp public/slide{,2,3,4,5,6}.webp $DEST/public/          # jika pakai AuthShell
cp public/icon.svg $DEST/public/ && cp public/icons/*.png $DEST/public/icons/   # sementara, ganti nanti
```

---

## 11. Checklist migrasi project lain

1. Pastikan Tailwind v4 (hapus `tailwind.config.*` lama, pindah ke `@import "tailwindcss"`).
2. Copy file di bagian 2, timpa `app/globals.css` & `components/ui/*`.
3. Update `app/layout.tsx` sesuai bagian 3.
4. Cari & ganti warna hardcode:
   `grep -rnE "bg-(white|black)|text-(gray|slate|zinc)-[0-9]|bg-(indigo|violet|purple)-[0-9]|from-(indigo|purple|blue)" app components`
   lalu ganti dengan token (bagian 4.3) atau map status (bagian 6).
5. Hapus gradient/glow/glassmorphism dekoratif di halaman app.
6. Bungkus halaman dalam layout sidebar + `<Content>` (bagian 7). Header top bar
   wajib punya atribut `data-app-topbar`.
7. Copy aset di bagian 10.
8. Pasang `<NavigationProgress />` di layout sidebar dan isi `MENU_KEYWORDS`
   untuk menu project baru.
9. Ganti `import { toast } from "sonner"` menjadi `@/lib/toast`.
10. Susun halaman list dengan komponen di bagian 7.3.
11. Tes: light, soft-light, dark, soft-dark × aksen default, GMI, dan satu warna umum;
    ukuran font "Sangat Besar"; lebar mobile 375px; sidebar mode ikon;
    `prefers-reduced-motion`. Di tabel lebar, scroll vertikal dan horizontal
    untuk memastikan header tetap menempel dan sejajar dengan kolomnya.
