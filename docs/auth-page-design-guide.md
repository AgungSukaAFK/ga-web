# Panduan Desain Halaman Auth (Login / Daftar)

Panduan ini merangkum gaya halaman auth Garuda Procure supaya bisa dipakai ulang di website lain.
Implementasi aslinya ada di `components/auth/auth-shell.tsx`, `components/auth/auth-input.tsx`, dan bagian akhir `app/globals.css`.

Stack acuan: **Next.js (App Router) + React + Tailwind CSS v4 + komponen shadcn/ui + lucide-react + next-themes**.
Kalau stack-nya lain, nilai ukuran, warna, timing, dan strukturnya tetap bisa diikuti. Terjemahkan saja class Tailwind-nya ke CSS biasa.

---

## 1. Konsep

- **Foto nyata di lapangan sebagai identitas.** Latar menampilkan foto kegiatan perusahaan yang berganti pelan, bukan ilustrasi generik.
- **Form tetap jadi fokus.** Foto hanya jadi suasana. Semua teks di atas foto dilindungi overlay gelap.
- **Hierarki grup perusahaan terlihat jelas.** Logo induk di atas, anak perusahaan sejajar di bawahnya.
- **Satu komponen shell dipakai semua halaman auth** (login, daftar, sukses daftar). Halamannya cukup mengisi `title`, `description`, dan isi form.

---

## 2. Tata Letak

### Desktop (≥ 1024px, `lg`)

```
┌───────────────────────────────┬──────────────────────────┐
│ [logo app] Nama App           │        [🎧] [🎨●] [💻]   │
│            Subjudul           │                          │
│                               │       LOGO INDUK         │
│     (slideshow foto +         │   LOGO A   │   LOGO B    │
│      overlay gradasi)         │   ────────────────────   │
│                               │      Judul Halaman       │
│ Headline besar 2 baris        │      deskripsi singkat   │
│ Paragraf pendukung            │      [ form ]            │
│                               │   © tahun · perusahaan   │
└───────────────────────────────┴──────────────────────────┘
```

- Grid dua kolom:
  - `lg`: `grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]`
  - `xl`: `grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]`, jadi panel foto makin lebar di layar besar
- Panel foto `sticky top-0 h-svh`, jadi tidak ikut ter-scroll kalau form-nya panjang.
- Panel form memakai `bg-background` biasa (ikut tema terang/gelap). Padding samping `px-10`, dan `px-16` di `xl`.
- Lebar konten form `max-w-md` (448px), posisinya di tengah secara vertikal.

### Mobile / tablet (< 1024px)

- Foto menjadi **latar penuh** (`fixed inset-0`) di belakang form.
- Form dibungkus **kartu kaca**: `rounded-2xl border bg-background/90 backdrop-blur-xl shadow-2xl shadow-black/30 p-6 sm:p-8`.
- Headline dan nama app di panel kiri **disembunyikan** (`hidden lg:flex`) supaya layar kecil tidak penuh.
- Toolbar kanan atas diberi latar `bg-background/80 backdrop-blur` supaya ikonnya tetap terbaca di atas foto.
- Footer memakai `text-white/70` (di atas foto), lalu berubah jadi `text-muted-foreground` di desktop.

> Trik utamanya: elemen `<aside>` yang sama berperan sebagai latar penuh di mobile dan panel kiri di desktop, cukup dengan
> `fixed inset-0 … lg:sticky lg:inset-auto lg:top-0 lg:h-svh`. Tidak perlu dua komponen terpisah.

### Tinggi layar

Pakai `min-h-svh`, bukan `min-h-screen`. Dengan begitu, di HP tingginya tidak "lompat" waktu address bar browser muncul atau hilang.

---

## 3. Slideshow Latar

### Perilaku

| Parameter | Nilai | Catatan |
|---|---|---|
| Interval ganti | **6000 ms** | Cukup lama untuk dinikmati, tidak bikin pusing |
| Durasi crossfade | **1400 ms** | `transition-opacity ease-in-out` |
| Durasi Ken Burns | interval + 2 × fade = **8800 ms** | Gerak tetap berjalan selama fade-in dan fade-out |
| Zoom | `scale(1.04)` → `scale(1.16)` | Mulai 1.04 supaya pinggir foto tidak kelihatan waktu digeser |
| Geser | ±1–3% per sumbu | **Arahnya beda di tiap foto**, jadi tidak monoton |
| Tab tidak aktif | Rotasi dijeda | Supaya slide tidak loncat beberapa kali waktu user kembali |
| `prefers-reduced-motion` | Animasi zoom/geser mati | Crossfade tetap jalan |

### Hal yang sering salah

1. **Foto yang sedang fade-out jangan dilepas animasinya.** Kalau class animasi langsung dicabut, zoom-nya "snap" balik ke skala awal di tengah fade dan kelihatan patah.
   Solusinya: simpan state `prev`, beri class animasi ke slide `active` **dan** `prev`, lalu kosongkan `prev` setelah `FADE_MS`.
2. **Hanya foto pertama yang `priority`.** Foto lain biarkan lazy supaya halaman tetap cepat terbuka.
3. **Atur `object-position` per foto** supaya subjek utama (orang, unit) tidak terpotong di layar tipis/tinggi.
4. Foto di slideshow **tidak** diberi `alt` (`alt=""` + `aria-hidden` di wrapper), karena sifatnya dekoratif.

### CSS

```css
/* Arah geser tiap slide diatur lewat --kb-from / --kb-to */
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

### Data slide

```ts
const SLIDES = [
  { src: "/slide2.webp", kbFrom: "-2%, 1%",  kbTo: "2%, -1%",  position: "50% 55%" },
  { src: "/slide.webp",  kbFrom: "1%, 1%",   kbTo: "-2%, -2%", position: "60% 40%" },
  { src: "/slide3.webp", kbFrom: "2%, 0%",   kbTo: "-2%, 1%",  position: "50% 60%" },
  // ...
];
const INTERVAL_MS = 6000;
const FADE_MS = 1400;
```

Urutkan foto supaya **foto pertama paling kuat**: lebar, subjeknya jelas, dan tidak terlalu ramai teks. Foto ini yang paling sering dilihat.

### Logika (React)

```tsx
const [index, setIndex] = useState(0);
const [prev, setPrev] = useState<number | null>(null);
const [hidden, setHidden] = useState(false);

useEffect(() => {
  const onVisibility = () => setHidden(document.hidden);
  onVisibility();
  document.addEventListener("visibilitychange", onVisibility);
  return () => document.removeEventListener("visibilitychange", onVisibility);
}, []);

useEffect(() => {
  if (hidden) return;
  const id = window.setTimeout(() => {
    setPrev(index);
    setIndex((index + 1) % SLIDES.length);
  }, INTERVAL_MS);
  return () => window.clearTimeout(id);
}, [index, hidden]);

useEffect(() => {
  if (prev === null) return;
  const id = window.setTimeout(() => setPrev(null), FADE_MS);
  return () => window.clearTimeout(id);
}, [prev]);
```

Render: semua foto ditumpuk `absolute inset-0`. Yang aktif `opacity-100`, sisanya `opacity-0`. Tambahkan class `auth-kenburns` kalau `i === index || i === prev`, dan isi CSS variable `--kb-from`, `--kb-to`, `--kb-duration` lewat `style`.

### Overlay (wajib)

Dua lapis gradasi di atas foto:

```html
<div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/30"></div>
<div class="absolute inset-0 bg-gradient-to-r from-slate-950/60 via-transparent to-transparent"></div>
```

- Gradasi vertikal paling gelap di bawah, tempat headline berada.
- Gradasi horizontal menggelapkan sisi kiri, tempat teks rata kiri.
- Warna dasar `<aside>` diisi `bg-slate-950`, jadi sebelum foto termuat tidak muncul kilatan putih.

---

## 4. Konten Panel Foto (desktop)

- **Kiri atas: identitas aplikasi.**
  - Ikon app `size-10 rounded-lg` di dalam kotak kaca `size-14 rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur`
  - Nama app `text-xl font-semibold tracking-tight`, subjudul `text-sm text-white/70`
- **Kiri bawah: headline + paragraf.**
  - Headline `text-3xl xl:text-4xl font-semibold leading-tight tracking-tight text-balance`, maksimal ±2 baris
  - Paragraf `text-sm xl:text-base leading-relaxed text-white/75 max-w-xl`
- Padding panel `p-10`, `xl:p-14`. Susunan `flex flex-col justify-between`.
- Tulisan headline sebagai **manfaat**, bukan nama fitur. Contoh: "Pengadaan yang rapi, dari permintaan hingga barang diterima."

---

## 5. Lockup Logo Grup Perusahaan

### Susunan

```
          [ LOGO INDUK ]
   [ LOGO ANAK A ] │ [ LOGO ANAK B ]
```

- **Induk di atas, di tengah, paling tinggi.** Ini menegaskan bahwa perusahaan lain berada di bawah naungannya.
- Anak perusahaan sejajar dan dipisah garis vertikal tipis (`w-px bg-border`).
- Di bawah lockup ada pemisah bergradasi, lalu judul halaman:
  `my-6 h-px bg-gradient-to-r from-transparent via-border to-transparent`

### Ukuran

| Elemen | Mobile | `sm` | `lg` |
|---|---|---|---|
| Logo induk (tinggi) | `h-14` | `h-16` | `h-20` |
| Logo anak landscape lebar (rasio ±7:1) | `max-w-[190px]` | sama | `max-w-[235px]` |
| Logo anak landscape sedang (rasio ±4:1) | `max-w-[160px]` | sama | `max-w-[195px]` |
| Garis pemisah | `h-9` | `h-9` | `h-12` |
| Jarak antar logo anak | `gap-3` | `gap-5` | `gap-6` |

Prinsip ukurannya:

- **Logo anak diatur lewat lebar maksimum, bukan tinggi.** Logo landscape punya rasio yang beda-beda. Kalau tingginya disamakan, logo yang sangat lebar jadi terlalu kecil dan tulisannya tidak terbaca.
- **Samakan bobot visual, bukan angka.** Logo dengan teks tipis/kecil perlu sedikit lebih besar supaya terlihat setara. Cek dengan screenshot, jangan hanya dari angka.
- Bungkus tiap logo anak dengan `flex min-w-0 flex-1`, logo kiri `justify-end` dan logo kanan `justify-start`, lalu pasang `w-full h-auto max-w-[…]` di gambarnya. Dengan begitu logo mengecil sendiri di HP 360px tanpa membuat halaman bisa digeser ke samping.
- Di desktop, baris logo boleh **lebih lebar dari form** dengan margin negatif (`lg:-mx-10`), jadi logo bisa besar tanpa ikut melebarkan form.

### Stroke putih untuk tema gelap

Logo berwarna gelap (navy, hitam) akan tenggelam di latar gelap. Solusinya, beri **outline putih ±5px** (di gambar lebar ±1000px) langsung di file gambarnya:

- File asli tetap disimpan, hasilnya ditulis ke file baru (misalnya `logo-stroke.webp`).
- Di tema terang, stroke putih tidak kelihatan di atas latar putih. Artinya satu file bisa dipakai untuk dua tema.
- Stroke di file lebih tajam dan lebih ringan daripada `filter: drop-shadow(...)` bertumpuk di CSS.

Script Node (butuh `sharp`, yang biasanya sudah ada di proyek Next.js):

```js
// node stroke.cjs input.webp output.webp 5
const sharp = require("sharp");
const [src, out, R = "5"] = process.argv.slice(2);
const r = Number(R), pad = r + 4;

(async () => {
  const base = sharp(src).extend({
    top: pad, bottom: pad, left: pad, right: pad,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  const { data, info } = await base.clone().ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  const a = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = data[i * 4 + 3];

  // Dilasi alpha dengan kernel lingkaran radius r (tepi di-antialias)
  const offs = [];
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const d = Math.hypot(dx, dy);
      if (d <= r + 0.5) offs.push([dx, dy, Math.min(1, r + 1 - d)]);
    }

  const m = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let best = 0;
      for (const [dx, dy, f] of offs) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const v = a[yy * w + xx] * f;
        if (v > best) { best = v; if (best >= 255) break; }
      }
      const o = (y * w + x) * 4;
      m[o] = m[o + 1] = m[o + 2] = 255;
      m[o + 3] = best;
    }

  await sharp(m, { raw: { width: w, height: h, channels: 4 } })
    .composite([{ input: await base.png().toBuffer() }])
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(out);
})();
```

Syaratnya, logo harus **PNG/WebP dengan latar transparan**. Kalau latarnya putih solid, hapus dulu latarnya.

---

## 6. Toolbar Kanan Atas

Urutannya dari kiri ke kanan: **Layanan (🎧 `Headset`) → Warna aksen (🎨 + titik warna) → Tema (☀️/🌙/💻)**.

- Semua tombol `variant="ghost" size="sm"`, ikon 16px `text-muted-foreground`.
- Dibungkus `flex items-center gap-0.5 rounded-lg p-0.5`. Di mobile ditambah `bg-background/80 backdrop-blur`, di desktop latarnya transparan.
- Tombol yang cuma berisi ikon **wajib** punya `aria-label` dan `title`.
- Tombol Layanan (sementara): tampilkan toast "Layanan chat dengan admin segera hadir." Nanti bisa diganti dengan membuka panel chat.
- Pilihan warna aksen menampilkan titik warna aktif di samping ikon palet, jadi user langsung tahu tema yang sedang dipakai.

---

## 7. Form

### Header

- Judul `text-2xl font-semibold tracking-tight`, di tengah.
  - Login: **"Selamat datang kembali"**
  - Daftar: **"Daftar Akun Baru"**
- Deskripsi `text-sm text-muted-foreground`, satu kalimat.
- Jarak ke form `mb-6`, antar field `space-y-4`, label ke input `space-y-2`.

### Input

| Properti | Nilai |
|---|---|
| Tinggi | **`h-11` (44px)**, ukuran minimal target sentuh |
| Ikon kiri | 16px, `left-3`, `text-muted-foreground`, `pointer-events-none` |
| Padding kiri | `pl-10` |
| Latar | `bg-background` (tetap solid walau kartunya transparan) |
| Password | Tombol mata di kanan (`size-9`, `right-1`), input `pr-10` |

Ikon yang dipakai (lucide): `UserRound` (Email/NRP), `Mail` (email), `LockKeyhole` (password), `Eye`/`EyeOff` (lihat password).

Komponen `AuthInput` otomatis menambahkan tombol lihat/sembunyikan untuk `type="password"`:

```tsx
<AuthInput icon={LockKeyhole} id="password" name="password" type="password"
           autoComplete="current-password" required />
```

### Atribut yang wajib diisi

- `autoComplete`: `username` / `current-password` (login), `email` / `new-password` (daftar), supaya password manager bekerja.
- `autoFocus` di field pertama.
- `required` dan `disabled={loading}` di semua input.

### Tautan & aksi sekunder

- "Lupa password?" ditaruh **sejajar dengan label Password** (`flex justify-between`), bukan di bawah input. Style: `text-sm text-muted-foreground hover:text-foreground hover:underline`.
- Tautan pindah halaman (login ↔ daftar) ada di bawah tombol: `mt-6 text-center text-sm text-muted-foreground`, dengan link `font-medium text-foreground underline underline-offset-4 hover:text-primary`.

### Tombol utama

- `h-11 w-full`, warna `primary` (ikut warna aksen).
- Ikon di depan teks: `LogIn` (Masuk) atau `UserPlus` (Daftar).
- Saat loading, ikon diganti `Loader2 animate-spin` dan teks jadi **"Memproses..."**. Tombol di-disable.

### Validasi & error

- Konfirmasi password dicek **langsung saat mengetik**: border `border-destructive`, `aria-invalid`, dan pesan kecil `text-xs text-destructive` di bawah field.
- Error dari server tampil dua kali dengan tujuan berbeda:
  - `Alert variant="destructive"` di atas tombol, supaya tetap kelihatan
  - toast error, sebagai notifikasi sekilas

### Halaman sukses

Tetap memakai shell yang sama. Isinya ikon `CheckCircle2` dalam lingkaran `size-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400`, paragraf penjelasan, lalu tombol penuh "Kembali ke Halaman Login".

---

## 8. Warna & Tema

- **Semua warna UI pakai token tema** (`background`, `foreground`, `muted-foreground`, `border`, `primary`), tidak ada warna hardcode. Tema terang/gelap dan warna aksen jadi otomatis ikut.
- Pengecualian: elemen yang **selalu di atas foto** memakai putih dan slate tetap (`text-white`, `text-white/70`, `bg-slate-950`), karena latarnya selalu gelap apa pun temanya.
- Shadow kartu mobile `shadow-black/30`, cukup dalam supaya kartu "terangkat" dari foto.

---

## 9. Aset & Performa

| Aset | Rekomendasi |
|---|---|
| Foto slide | WebP, sisi panjang 1600–1920px, ±80–400 KB per file, 5–6 foto |
| Logo | WebP transparan, lebar ±1000px (tetap tajam di layar retina) |
| Ikon app | PNG 192px |

- `sizes="(min-width: 1024px) 60vw, 100vw"` untuk foto slide, jadi HP tidak mengunduh versi desktop.
- Logo dan foto pertama pakai `priority`. Sisanya lazy.
- Kalau pakai middleware auth, **pastikan file statis (`.webp`, `.png`) dikecualikan dari matcher**. Kalau tidak, gambar di halaman login ikut ter-redirect dan tidak muncul.

---

## 10. Checklist Implementasi

- [ ] Satu komponen `AuthShell` dipakai login, daftar, dan halaman sukses
- [ ] `<aside>` foto: `fixed inset-0` di mobile, `lg:sticky lg:top-0 lg:h-svh` di desktop
- [ ] Slideshow: 6 s interval, 1.4 s fade, Ken Burns dengan arah berbeda tiap foto
- [ ] Slide `prev` tetap dianimasikan selama fade-out
- [ ] Rotasi dijeda saat tab tersembunyi, dan animasi mati untuk `prefers-reduced-motion`
- [ ] Dua lapis overlay gradasi di atas foto
- [ ] Lockup logo: induk di atas, anak perusahaan sejajar di bawah, ukuran logo anak diatur lewat `max-w`
- [ ] Logo gelap diberi stroke putih di file-nya
- [ ] Toolbar kanan atas: layanan, aksen, tema, masing-masing dengan `aria-label`
- [ ] Input `h-11` dengan ikon, toggle password, dan `autoComplete` yang benar
- [ ] Tombol utama ada state loading, error tampil sebagai Alert + toast
- [ ] Dicek di 360px, 390px, 1024px, dan 1440px, di tema terang dan gelap, tanpa scroll horizontal
