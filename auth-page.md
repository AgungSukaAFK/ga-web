# Prompt: Desain Halaman Autentikasi (Grup Lourdes / GMI / GIS)

> Gunakan dokumen ini sebagai instruksi untuk membangun ulang halaman autentikasi
> (login & daftar) dengan desain yang **identik** dengan aplikasi Garuda Procure.
> Perusahaan, logo, dan foto slideshow sama persis — yang berubah hanya **nama
> aplikasi, tagline, dan deskripsi** (lihat bagian *Yang Perlu Disesuaikan*).

---

## 1. Stack yang Diasumsikan

- **Next.js (App Router)** + TypeScript, `"use client"` untuk halaman auth.
- **Tailwind CSS** + **shadcn/ui** (`Button`, `Input`, `Label`, `Alert`, `Dialog`, `DropdownMenu`).
- **lucide-react** untuk ikon, **sonner** untuk toast, **next/image** untuk gambar.
- **next-themes** untuk light/dark + sistem **warna aksen** (class `theme-<nama>` di `<html>`).
- Bahasa UI: **Bahasa Indonesia**.

## 2. Aset yang Wajib Disalin ke `public/`

| File | Kegunaan |
|---|---|
| `lourdes-logo.webp` (1024×392) | Logo induk — Lourdes Auto Parts |
| `gmi-landscape-stroke.webp` (1098×148) | Logo PT. Garuda Mart Indonesia |
| `gis-landscape.webp` (1080×261) | Logo PT. Global Inti Sejati |
| `slide.webp`, `slide2.webp` … `slide6.webp` | Foto latar slideshow |
| `icons/icon-192.png` | Ikon aplikasi di panel kiri (ganti dengan ikon app baru) |

## 3. Struktur Layout

Satu komponen pembungkus **`AuthShell`** dipakai semua halaman auth
(`/auth/login`, `/auth/sign-up`, state sukses daftar). Props: `title`, `description?`, `children`.

### Desktop (`lg` ke atas) — dua kolom
- Grid: `lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]`, `xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]`.
- **Kolom kiri (`<aside>`)**: `sticky top-0 h-svh`, berisi slideshow foto + teks branding.
- **Kolom kanan (`<main>`)**: `bg-background`, form tanpa kartu (border/shadow/blur dihilangkan di `lg`).

### Mobile / tablet — satu kolom
- Slideshow jadi **latar penuh** (`fixed inset-0`) di belakang form.
- Form dibungkus **kartu kaca**: `max-w-md rounded-2xl border bg-background/90 p-6 sm:p-8 shadow-2xl shadow-black/30 backdrop-blur-xl`.
- Teks branding panel kiri **disembunyikan** (`hidden lg:flex`).

### Urutan isi kolom kanan (atas → bawah)
1. **Toolbar kanan atas** (`flex justify-end`): tombol ghost `size="sm"` berurutan —
   `Headset` (Layanan/Hubungi Admin, sementara toast "Layanan chat dengan admin segera hadir."),
   `AccentThemeSwitcher` (ikon `Palette` + bulatan warna aktif), `ThemeSwitcher` (light/dark).
   Di mobile dibungkus pil `rounded-lg bg-background/80 p-0.5 backdrop-blur`; di `lg` transparan.
2. **Area tengah** (`flex flex-1 items-center justify-center py-6`):
   - **Logo perusahaan** (`CompanyLogos`, `lg:-mx-10` agar sedikit melebar).
   - **Divider** gradient: `my-6 h-px bg-gradient-to-r from-transparent via-border to-transparent`.
   - **Judul & deskripsi** center: `h1 text-2xl font-semibold tracking-tight` + `p text-sm text-muted-foreground`, wrapper `mb-6 space-y-1.5`.
   - **Form** (`children`).
3. **Footer**: `text-center text-xs`, `text-white/70` di mobile (di atas foto) / `lg:text-muted-foreground`.
   Isi: `© {tahun berjalan} PT. Garuda Mart Indonesia · <Nama Aplikasi>`.

## 4. Blok Logo Perusahaan (`CompanyLogos`)

Hierarki: **Lourdes = induk** di atas, **GMI & GIS** sejajar di bawahnya dipisah garis vertikal.

```tsx
<div className="flex flex-col items-center gap-4">
  <Image src="/lourdes-logo.webp" alt="Lourdes Auto Parts" width={1024} height={392} priority
         className="h-14 w-auto sm:h-16 lg:h-20" />
  <div className="flex w-full items-center justify-center gap-3 sm:gap-5 lg:gap-6">
    <div className="flex min-w-0 flex-1 justify-end">
      <Image src="/gmi-landscape-stroke.webp" alt="PT. Garuda Mart Indonesia" width={1098} height={148} priority
             className="h-auto w-full max-w-[190px] lg:max-w-[235px]" />
    </div>
    <span className="h-9 w-px shrink-0 bg-border lg:h-12" aria-hidden="true" />
    <div className="flex min-w-0 flex-1 justify-start">
      <Image src="/gis-landscape.webp" alt="PT. Global Inti Sejati" width={1080} height={261} priority
             className="h-auto w-full max-w-[160px] lg:max-w-[195px]" />
    </div>
  </div>
</div>
```

## 5. Slideshow Latar (Crossfade + Ken Burns)

### Data slide (pakai persis, termasuk arah gerak & fokus foto)

```ts
const SLIDES = [
  { src: "/slide2.webp", alt: "Excavator Komatsu PC3000 di area tambang",              kbFrom: "-2%, 1%", kbTo: "2%, -1%",  position: "50% 55%" },
  { src: "/slide.webp",  alt: "Smart Power Management Controller Lourdes Auto Parts", kbFrom: "1%, 1%",  kbTo: "-2%, -2%", position: "60% 40%" },
  { src: "/slide3.webp", alt: "Tim lapangan di depan alat berat Komatsu",             kbFrom: "2%, 0%",  kbTo: "-2%, 1%",  position: "50% 60%" },
  { src: "/slide4.webp", alt: "Pemasangan lampu kerja pada kabin excavator",          kbFrom: "0%, 2%",  kbTo: "-1%, -2%", position: "50% 40%" },
  { src: "/slide5.webp", alt: "Teknisi memasang perangkat di kabin unit baru",        kbFrom: "-1%, -1%", kbTo: "2%, 1%",  position: "50% 45%" },
  { src: "/slide6.webp", alt: "Instalasi perangkat di atap kabin, area yard unit",    kbFrom: "2%, -1%", kbTo: "-1%, 1%",  position: "50% 50%" },
];
const INTERVAL_MS = 6000; // tiap slide tampil 6 detik
const FADE_MS = 1400;     // durasi crossfade
```

### Perilaku
- Semua slide ditumpuk `absolute inset-0`; slide aktif `opacity-100`, lainnya `opacity-0`,
  `transition-opacity ease-in-out` dengan `transitionDuration: FADE_MS`.
- Rotasi pakai `setTimeout` yang di-reset tiap `index` berubah.
- **Jeda rotasi saat tab tidak aktif** (`visibilitychange` / `document.hidden`) agar tidak loncat beberapa slide.
- Simpan `prev` (slide sebelumnya) supaya animasi Ken Burns-nya tetap jalan selama fade-out, lalu dilepas setelah `FADE_MS`.
- `<Image fill priority={i === 0} sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover">`,
  class `auth-kenburns` hanya dipasang pada slide aktif & `prev`.
  Style inline: `objectPosition`, `--kb-from`, `--kb-to`, `--kb-duration: INTERVAL_MS + FADE_MS*2 ms`.
- Wrapper slide `aria-hidden="true"`, `alt=""` (dekoratif).

### CSS global (tambahkan ke `globals.css`)

```css
@keyframes auth-kenburns {
  from { transform: scale(1.04) translate3d(var(--kb-from, 0, 0), 0); }
  to   { transform: scale(1.16) translate3d(var(--kb-to, 0, 0), 0); }
}
.auth-kenburns {
  animation: auth-kenburns var(--kb-duration, 9s) ease-out forwards;
  will-change: transform;
}
@media (prefers-reduced-motion: reduce) {
  .auth-kenburns { animation: none; }
}
```

### Overlay (agar teks/form selalu terbaca)
```tsx
<div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/30" />
<div className="absolute inset-0 bg-gradient-to-r from-slate-950/60 via-transparent to-transparent" />
```
Latar `<aside>`: `bg-slate-950` (fallback sebelum foto termuat).

### Teks branding panel kiri (desktop saja)
`absolute inset-0 hidden flex-col justify-between p-10 xl:p-14 text-white lg:flex`
- **Atas**: kotak ikon `size-14 rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur` berisi ikon app `size-10 rounded-lg`,
  di sampingnya nama app (`text-xl font-semibold tracking-tight`) + subjudul (`text-sm text-white/70`).
- **Bawah** (`max-w-2xl space-y-3`): headline `text-3xl xl:text-4xl font-semibold leading-tight tracking-tight text-balance`
  + paragraf `max-w-xl text-sm xl:text-base leading-relaxed text-white/75`.

## 6. Input Form (`AuthInput`)

Wrapper di atas shadcn `Input`, prop tambahan `icon: LucideIcon`.
- Ikon kiri: `pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground`.
- Input: `h-11 bg-background pl-10` (+ `pr-10` bila password).
- Jika `type="password"` → otomatis ada tombol **lihat/sembunyikan** di kanan
  (`absolute right-1 size-9 rounded-md`, ikon `Eye` / `EyeOff`,
  `aria-label` "Tampilkan password" / "Sembunyikan password").

## 7. Halaman Login (`/auth/login`)

- `title`: **"Selamat datang kembali"**, `description`: **"Masuk dengan Email atau NRP Anda untuk melanjutkan."**
- Form `space-y-4`, tiap field `space-y-2` (Label + AuthInput):
  1. **Email atau NRP** — ikon `UserRound`, `autoComplete="username"`, `autoFocus`, placeholder `email@example.com atau 123456`.
  2. **Password** — ikon `LockKeyhole`, placeholder `••••••••`. Di kanan label ada tombol teks
     **"Lupa password?"** (`text-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-4`).
- Error → shadcn `Alert variant="destructive"` (judul "Login Gagal") **dan** `toast.error`.
- Tombol submit `h-11 w-full`: ikon `LogIn` + "Masuk"; saat loading `Loader2 animate-spin` + "Memproses...". Semua input `disabled` saat loading.
- Di bawah form: `mt-6 text-center text-sm text-muted-foreground` → "Belum punya akun? **Daftar di sini**"
  (link `font-medium text-foreground underline underline-offset-4 hover:text-primary`).
- Query `?reason=deactivated` → tampilkan error "Akun Anda telah dinonaktifkan. Silakan hubungi administrator."
- Query `?next=` → setelah login redirect ke path itu (validasi hanya path internal, tolak `//` & URL absolut), default `/dashboard`.
- **Dialog Lupa Password** (`sm:max-w-md`): judul dengan ikon `Building2` "Lupa Password?",
  deskripsi "Reset password mandiri lewat email tidak tersedia untuk sistem ini.",
  kotak `rounded-md border p-3` berikon `Headset text-primary`: hubungi **IT** atau **Admin General Affair (GA)**
  di **Head Office PT. Garuda Mart Indonesia**; catatan muted: siapkan Nama, Email/NRP, dan Departemen.
  Tombol footer "Mengerti".

## 8. Halaman Daftar (`/auth/sign-up`)

- `title`: **"Daftar Akun Baru"**, `description`: **"Buat akun untuk dapat mengakses sistem."**
- Field: **Email** (ikon `Mail`, placeholder `nama@perusahaan.com`), **Password**, **Ulangi Password** (ikon `LockKeyhole`, `autoComplete="new-password"`).
- Validasi live: jika konfirmasi tidak cocok → border `border-destructive`, `aria-invalid`, teks `text-xs text-destructive` "Konfirmasi password belum cocok."
- Tombol: ikon `UserPlus` + "Daftar". Link bawah: "Sudah punya akun? **Login di sini**".
- **State sukses** tetap memakai `AuthShell` yang sama: pesan bahwa akun dibuat, hubungi admin untuk NRP & aktivasi,
  tombol `h-11 w-full` "Kembali ke Halaman Login".

## 9. Tema & Warna

- Gunakan token shadcn (`bg-background`, `text-muted-foreground`, `border`, `primary`) — **jangan hardcode warna** selain overlay `slate-950` dan teks putih di atas foto.
- Harus terlihat benar di **light & dark mode**.
- Warna aksen perusahaan (grup "Warna Perusahaan" di dropdown):
  - **GMI**: `#242365` (navy)
  - **GIS**: `rgb(23 88 49)` (hijau tua)
  - Grup "Umum": zinc (default), blue, sky, cyan, teal, emerald, green, amber, orange, red, rose, pink, fuchsia, purple, violet, indigo (palet shadcn).
- Aksen diterapkan sebagai class `theme-<nama>` di `<html>` (kecuali `zinc`), disimpan di `localStorage` key `accent-theme`.

## 10. Aksesibilitas & Detail

- Tinggi layar pakai `min-h-svh` / `h-svh` (aman di browser mobile).
- Hormati `prefers-reduced-motion` (Ken Burns dimatikan).
- Semua tombol ikon punya `title` / `aria-label`.
- Foto slide pertama `priority`; logo `priority`.

---

## Yang Perlu Disesuaikan per Aplikasi

| Bagian | Nilai di Garuda Procure | Ganti dengan |
|---|---|---|
| Nama aplikasi (panel kiri & footer) | `Garuda Procure` | `<NAMA_APLIKASI>` |
| Subjudul panel kiri | `Sistem Manajemen MR & PO` | `<SUBJUDUL>` |
| Headline panel kiri | "Pengadaan yang rapi, dari permintaan hingga barang diterima." | `<HEADLINE>` |
| Deskripsi panel kiri | "Kelola Material Request, Purchase Order, penerimaan barang, dan Petty Cash dalam satu sistem terpadu untuk seluruh grup perusahaan." | `<DESKRIPSI>` |
| Ikon aplikasi | `/icons/icon-192.png` | ikon app baru |
| Login pakai NRP | Ya (Email atau NRP) | sesuaikan mekanisme auth |
| Redirect setelah login | `/dashboard` | sesuaikan |

Logo perusahaan (Lourdes, GMI, GIS), foto slideshow, warna, layout, dan copy
"Lupa password" **tetap sama**.
