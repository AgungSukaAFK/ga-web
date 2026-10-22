# Taste UI — Garuda Procure

Panduan **komponen, pola halaman, dan "rasa" interaksi** untuk membangun sistem
baru yang tampilan dan perilakunya identik dengan `ga-web`.

Dokumen ini pasangan dari dua dokumen lain:

| Dokumen            | Isinya                                                                 |
| ------------------ | ---------------------------------------------------------------------- |
| `styling-guide.md` | Visual: stack, token warna, 4 mode tema, aksen, tipografi, aset gambar |
| `taste-ui.md`      | **Ini.** Komponen apa yang dipakai, kapan, bagaimana halaman disusun, dan aturan interaksinya |
| `update.md`        | Implementasi lengkap fitur Update Web (database, service, halaman)     |

Label di dokumen ini:

- Tanpa label = **bagian inti**, wajib ada di sistem baru.
- *(opsional)* = bawa kalau sistem baru butuh fiturnya.
- **⚙ versi standar** = di `ga-web` masih tersebar/duplikat; sistem baru
  memakai versi rapi di **bagian 9** (kode siap pakai), bukan file aslinya.

---

## 0. Mulai cepat

1. Ikuti `styling-guide.md` bagian 1–3: stack, file fondasi, root layout.
2. Copy file di **Lampiran A** kolom "Copy", lalu buat file di kolom
   "Buat baru" dari kode di bagian 9. Jangan generate ulang
   `components/ui/*` lewat `npx shadcn add`, karena beberapa sudah dimodifikasi.
3. Susun app shell (bagian 2): isi `lib/sidebar/nav-config.ts` sesuai modul
   sistem baru, pasang top bar (3.2a), lalu sesuaikan global search (3.2b).
4. Bangun tiap halaman dari **resep** di bagian 4 (list, form, detail, dashboard).
5. Sebelum fitur dianggap selesai, cek **checklist** di bagian 8.

---

## 1. Prinsip "rasa" (wajib dibaca)

Ini yang membuat sistem terasa "sama", lebih dari sekadar warna:

1. **Bahasa Indonesia, singkat, ramah.** Label tombol berupa kata kerja
   ("Buat Material Request", "Simpan", "Submit Ulang"). Pesan error menjelaskan
   apa yang salah *dan* apa yang harus dilakukan.
2. **Semua yang bisa di-share ada di URL.** Pencarian, filter, sort, page,
   dan limit disimpan di query string, bukan `useState`. Link bisa dikirim ke
   orang lain dan tombol Back browser bekerja.
3. **Preferensi tampilan disimpan per perangkat** (`localStorage`), bukan di
   database: tema, aksen, font, menu yang disembunyikan, panel filter
   terbuka/tertutup, urutan kolom tabel, riwayat global search. Selalu
   dibungkus `try/catch` dan dibaca setelah mount (hindari hydration mismatch).
4. **Actionable-first.** Angka dan status sebisa mungkin bisa diklik dan
   membawa user ke tempat aksinya (stat card → daftar, "Perlu Aksi Anda" →
   halaman yang menangani). Hindari badge yang cuma pajangan.
5. **Feedback instan.** Klik menu langsung aktif + spinner, tombol submit
   berubah jadi "Mengajukan...", toast `loading` diganti `success/error` di
   toast yang sama.
6. **Satu kebutuhan, satu komponen.** Kalau sudah ada `FilterPanel`,
   `CustomPagination`, `ConfirmDialog`, `DiscussionPanel`, pakai itu. Jangan
   bikin varian baru.
7. **Mobile & layar sentuh tetap layak.** Grid turun ke 1 kolom, tabel lebar
   boleh scroll horizontal di dalam card (bukan seluruh halaman), panel
   samping berubah jadi overlay. Aksi yang di desktop baru muncul saat hover
   harus **selalu terlihat di layar sentuh** (`pointer-fine:` /
   `pointer-coarse:`, bukan `md:`), dan app tetap enak dipakai sebagai PWA
   (lihat 3.16).
8. **Jejak selalu ada.** Dokumen penting punya Riwayat Aktivitas, jalur
   approval dengan waktu proses, dan diskusi. User tidak perlu bertanya
   "ini nyangkut di siapa?".
9. **Konfirmasi untuk yang tidak bisa dibatalkan** (hapus, reject, logout),
   tidak untuk aksi biasa.
10. **Hormati preferensi aksesibilitas:** ukuran font global (rem), fokus
    terlihat, `aria-label` di tombol ikon, `prefers-reduced-motion`.

---

## 2. Anatomi app shell

```
┌──────────────┬────────────────────────────────────────────────────────┐
│ [Logo]       │ ☰ │ Breadcrumb › URL   [🔍 Cari… ⌘K]   📥 🎧 🎨 │ (👤)  │ ← top bar sticky
│ [AppSwitch]  ├────────────────────────────────────────────────────────┤   h-14 / md:h-16
│ 🔍 Cari menu │  grid-cols-12 gap-4 md:gap-6                            │
│──────────────│  ┌────────────── <Content size="lg"> ──────────────┐   │
│ Admin   Atur │  │ Judul                          [Aksi utama]     │   │
│  • Menu      │  │ Deskripsi                                       │   │
│ Menu    Atur │  │ ...                                             │   │
│  • Dashboard │  └─────────────────────────────────────────────────┘   │
│  • Notif (3) │  ┌──── size="md" ────┐ ┌──── size="md" ────┐          │
│ Modul X Atur │  └───────────────────┘ └───────────────────┘          │
│ About        │                                                        │
│──────────────│                                                        │
│ [👤 Nama ▾]  │                                                        │
└──────────────┴────────────────────────────────────────────────────────┘
```

| Bagian              | File                                        | Catatan                                                     |
| ------------------- | ------------------------------------------- | ----------------------------------------------------------- |
| Layout route group  | `app/(With Sidebar)/layout.tsx`             | `SidebarProvider` + `SidebarInset` + top bar + grid 12 kolom |
| Daftar menu per role | `lib/sidebar/nav-config.ts`                | `buildNavGroups(profile)`: **satu sumber** utk sidebar & global search |
| Sidebar             | `components/app-sidebar.tsx`                | Ambil `buildNavGroups`, tambah badge & status aktif          |
| Grup menu           | `components/nav-main.tsx`                   | Label grup, tombol "Atur", badge, state pending             |
| Top bar             | `components/topbar/*`                       | lihat 3.2a (search 3.2b)                                    |
| Menu user (footer)  | `components/nav-user.tsx`                   | Avatar, nama/email, My Profile, Lihat Foto, Log out         |
| Pencarian menu      | `components/sidebar-search.tsx` + `lib/sidebar/menu-search.ts` | lihat 3.2                               |
| Sembunyikan menu    | `lib/sidebar/menu-visibility.ts`            | lihat 3.2                                                   |
| Progress navigasi   | `components/navigation-progress.tsx` + `lib/sidebar/nav-pending.ts` | lihat 3.2                         |
| Primitive sidebar   | `components/ui/sidebar.tsx`                 | shadcn, `collapsible="icon"`                                |

Detail visual shell (class link aktif, breadcrumb) ada di
`styling-guide.md` bagian 7.1. Header di sana masih versi lama (`h-16`, tidak
sticky); versi sekarang dijelaskan di 3.2a.

**Cara menyusun menu:**

- Semua menu ditulis **sekali** di `lib/sidebar/nav-config.ts`.
  `buildNavGroups(profile)` mengembalikan `{ label, items, hideable }[]`
  sesuai hak akses. Sidebar dan global search (3.2b) sama-sama memanggilnya,
  jadi hasil "Menu" di search selalu sama dengan menu yang memang boleh
  dibuka user.
- Menu dikelompokkan ke grup berlabel (contoh di ga-web: Admin, Menu, Petty
  Cash, About). Grup kosong (karena role) tidak dirender.
- Item: `{ title, url, icon (lucide) }`. Visibilitas per role ditulis
  sebagai `visible: boolean` lalu di-filter:

  ```ts
  // lib/sidebar/nav-config.ts
  function buildXxxItems(profile: NavProfile): NavItem[] {
    const items = [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, visible: true },
      { title: "Approval", url: "/approval", icon: CheckCheck, visible: isApprover },
      { title: "Manajemen User", url: "/user-management", icon: Users, visible: isAdmin },
    ];
    return items.filter((i) => i.visible).map(({ visible, ...rest }) => rest);
  }
  ```
  (pola `buildPettyCashItems`; hindari pola `splice` bertingkat seperti
  `buildMainItems` di ga-web, karena susah dibaca.)
- `AppSidebar` menambahkan **badge** lewat map URL → angka, lalu
  `markActive`:

  ```ts
  const badges = { "/notifications": unreadCount, "/chat-admin": supportBadge.userUnread || undefined };
  ```
  Angkanya datang dari provider/hook (`useNotification`,
  `useSupportChatBadge`, `useUpdateWebBadge`), bukan query di sidebar.
- Menu aktif memakai **longest match** (`markActive`): `/petty-cash/approval`
  tidak ikut mengaktifkan `/petty-cash`.

---

## 3. Katalog komponen

Format tiap entri: **kegunaan → kapan dipakai → API penting → aturan**.

### 3.1 Fondasi `components/ui/*`

Copy seluruh folder. Yang perlu diketahui karena berbeda dari shadcn default:

| Komponen                | Catatan                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| `button`, `badge`       | Versi cva + `forwardRef`, shadow halus                                  |
| `searchable-select`     | Select + pencarian (cmdk). API mirip `ui/select`: `SearchableSelect`, `…Trigger`, `…Value placeholder`, `…Content searchPlaceholder emptyText`, `…Item`, `…Group`, `…Label` |
| `currency-input`        | Input Rupiah: tampil `Rp 1.500.000`, nilai yang dikirim berupa angka    |
| `sidebar`               | shadcn sidebar, dipakai dengan `collapsible="icon"`                     |
| `table`                 | Sudah `overflow-x-auto`                                                 |
| `dialog`, `alert-dialog` | Sudah `max-h-[calc(100dvh-2rem)] overflow-y-auto`: isi yang lebih tinggi dari layar (umum di HP/PWA) bisa di-scroll. Dialog yang mengatur scroll sendiri menimpanya lewat `className` |
| `chart`                 | Wrapper recharts (`ChartContainer`, tooltip, legend)                    |

Belum ada `ui/switch`. `notification-settings.tsx` membuat switch sederhana
sendiri. Kalau sistem baru butuh switch di banyak tempat, tambahkan
`ui/switch` dari shadcn sekali saja.

### 3.2 Shell & navigasi

#### Pencarian menu sidebar
`SidebarSearch` (UI) + `lib/sidebar/menu-search.ts` (logika). Skornya
(`scoreMenuItem`) juga dipakai global search (3.2b) untuk hasil Menu & Aksi.

- Cocok ke judul, **singkatan otomatis** ("mr" → Material Request), kata
  kunci tambahan per URL (`MENU_KEYWORDS`), kata kunci per grup
  (`GROUP_KEYWORDS`), dan tahan typo 1 huruf.
- **Enter** = buka hasil teratas, **Esc** = kosongkan. Query bertahan saat
  pindah halaman (localStorage).
- Sidebar diciutkan → jadi tombol ikon yang membuka sidebar lalu fokus ke input.
- Tidak ada hasil → ikon `SearchX` + "Tidak ada menu untuk "…"" + link "Hapus pencarian".
- **Adaptasi wajib:** isi ulang `MENU_KEYWORDS` dan `GROUP_KEYWORDS` dengan
  URL dan istilah sistem baru. Tanpa itu, pencarian hanya cocok ke judul.

#### "Atur" menu per grup
Tombol ghost kecil "Atur" di kanan label grup → popover checklist menu.
Disimpan per perangkat, sinkron antar tab. Grup wajib (About) memakai
`hideable={false}`. Saat mencari, menu tersembunyi tetap ikut dicari.

#### Feedback navigasi
- `setPendingNavUrl(url)` saat menu diklik → item langsung aktif
  (`bg-primary/10`), ikon diganti `Loader2` berputar.
- `<NavigationProgress />` (taruh di luar `SidebarProvider`): bar `h-0.5`
  di atas layar, jalan ke ~85%, penuh saat pathname berubah, batal otomatis 20 detik.
- Ctrl/Cmd/Shift/klik tengah tidak memicu loading. Di mobile, sidebar
  menutup setelah klik.

#### NavUser
Dropdown di footer sidebar: avatar + nama + email → My Profile, Lihat Foto
Profil, Log out (dengan `ConfirmDialog`). Isinya sama persis dengan menu
profil di top bar (3.2a); keduanya tetap ada (sidebar diciutkan / mobile
tetap punya akses profil di top bar). Link "My Profile" di ga-web masih
`<a href>`; di sistem baru pakai `next/link`.

#### App switcher, pindah antar aplikasi *(opsional)*
`TeamSwitcher`: dropdown di bawah logo untuk berpindah ke web lain dalam
grup (daftar di `lib/constants/web-apps.ts`, label role di
`WEB_ROLE_LABELS`). Hanya dipakai kalau sistem baru bagian dari ekosistem
multi-app; di ga-web hanya tampil untuk departemen GA.

### 3.2a Top bar

```
☰ │ Garuda Procure › Material Request › Buat   [🔍 Cari MR, PO, barang, menu…  ⌘K]   📥³ 🎧 🎨 │ (👤 Nama)
└──────── kiri: breadcrumb ──────────┘ └───── tengah (lg+) ─────┘ └──── kanan: aksi ────┘
```

| Bagian             | File                                  | Isi                                                      |
| ------------------ | ------------------------------------- | -------------------------------------------------------- |
| Provider profil    | `topbar/topbar.tsx` (`TopbarProvider`, `useTopbarProfileData`) | Profil user diambil **sekali**, dibagi ke semua bagian top bar; ikut berubah saat event `AVATAR_UPDATED_EVENT` |
| Deretan aksi       | `topbar/topbar.tsx` (`TopbarActions`) | Inbox → Chat Admin → Tampilan → pemisah → Profil         |
| Tombol ikon        | `topbar/topbar-icon-button.tsx`       | Dasar semua tombol ikon top bar + badge angka            |
| Global search      | `topbar/topbar-search.tsx`            | lihat 3.2b                                               |
| Inbox              | `topbar/topbar-inbox.tsx` + `use-inbox.ts` | Rangkuman semua notif                               |
| Chat Admin         | `topbar/topbar-chat-admin.tsx`        | Shortcut modul Chat Admin *(opsional, ikut modulnya)*    |
| Tampilan           | `topbar/topbar-appearance.tsx`        | Tema, aksen, font dalam satu popover                     |
| Profil             | `topbar/topbar-profile.tsx`           | Sama dengan NavUser                                      |

**Header** (`app/(With Sidebar)/layout.tsx`):

- `sticky top-0 z-40`, tinggi `h-14` (mobile) / `md:h-16`, `h-12` saat
  sidebar mode ikon. Latar `bg-background/90` + `backdrop-blur-md`; blur &
  saturasi lebih kuat baru mulai `md:` (repaint tiap scroll berat di HP
  kelas bawah).
- Pemisah bawah: `border-b border-border/60` + garis gradien aksen tipis
  (`after:` `h-px bg-gradient-to-r from-transparent via-primary/30
  to-transparent`). Tanpa shadow.
- Breadcrumb: di mobile cuma crumb terakhir (`truncate`), crumb sebelumnya
  dan root "Garuda Procure" muncul mulai `md:`. Segmen UUID di akhir URL
  tidak ditampilkan.
- Header diberi `no-print`.

**`TopbarIconButton`** (wajib dipakai untuk semua tombol ikon di top bar):

```tsx
<TopbarIconButton label="Inbox" badge={unreadCount}><Inbox /></TopbarIconButton>
<TopbarIconButton label="Global Search" className="lg:hidden" onClick={open}><Search /></TopbarIconButton>
```
- `ghost` bulat, `size-8` di mobile tapi area tap diperluas 2px tiap sisi
  (`after:-inset-0.5`) → 36px efektif; `sm:size-9`. Antar tombol `gap-1`.
- Badge merah `bg-red-600` (bukan `--destructive`, supaya teks putih lolos
  AA di semua tema), `ring-2 ring-background`, `99+` kalau lebih.
- `label` jadi `title` + `aria-label`; kalau ada badge, aria-label jadi
  "Inbox (3 baru)".
- Bisa `asChild` (badge tetap masuk ke child lewat `Slottable`).
- `data-[state=open]:bg-accent`: tombol tetap tersorot selama popover-nya
  terbuka.

**Popover/dropdown top bar** selalu `align="end" sideOffset={8}
collisionPadding={8}` dan lebar `w-[min(24rem,calc(100vw-1rem))]` (angka
rem disesuaikan isinya) supaya tidak keluar layar di HP.

#### Inbox
Satu daftar *quick access* yang menggabungkan semua sumber notifikasi:

| Sumber        | Asal data                                        | Warna ikon     |
| ------------- | ------------------------------------------------ | -------------- |
| Notifikasi    | `useNotification()` (kecuali tipe `support_message`, sudah diwakili item chat) | `bg-primary` |
| Chat Admin    | 1 item per percakapan yang menunggu user ini (balasan admin; admin IT: pesan user yang belum dibalas), realtime | `bg-sky-600` |
| Update Web    | Postingan terbaru (`useUpdateWebBadge`)          | `bg-amber-600` |

- Header popover: "Inbox" + pill "`N` baru" + tombol ghost "Tandai semua
  dibaca". Di bawahnya chip filter Semua / Notifikasi / Chat / Update,
  masing-masing dengan jumlah belum dibaca, scroll horizontal tanpa
  scrollbar.
- Baris: avatar pelaku + ikon sumber kecil di pojok (tanpa pelaku → ikon
  sumber saja), judul (`font-semibold` kalau belum dibaca), pesan
  `line-clamp-2`, "Sumber · 5 menit yang lalu". Belum dibaca =
  `bg-primary/[0.06]` + garis aksen kiri + titik primary.
- Klik → tandai dibaca + tutup + pindah ke `href`.
- Hanya **7 hari terakhir, maks. 20 item** (`INBOX_MAX_AGE_DAYS`,
  `INBOX_MAX_ITEMS`), ditulis juga di footer, plus link "Semua
  notifikasi" ke `/notifications`. Daftar lengkap tetap di halaman masing-masing.
- Kosong → ikon `Inbox` + "Inbox kosong".

#### Chat Admin *(opsional, ikut modul Chat Admin)*
Selalu **dropdown**, tidak langsung pindah halaman: user yang cuma
penasaran dengan ikonnya tidak kehilangan isian form yang sedang diketik.
User biasa: satu kalimat info + "Buka Chat Admin" / "Lihat Balasan". Admin
IT: "Inbox Chat Admin" + "Chat Saya", masing-masing dengan pill angka.

#### Tampilan
Satu tombol `Palette` → popover berisi `Tabs` **Tema / Aksen / Font**:
- Tema: grid 3 kolom opsi `THEME_OPTIONS` (ikon + label).
- Aksen: "Warna Perusahaan" (grid 2, swatch + label) lalu "Warna Umum"
  (grid 4 swatch bulat, ✓ di yang terpilih).
- Font: `FontSettingsPanel` (slider ukuran + daftar jenis font), komponen
  yang sama dengan `FontSwitcher`.
- **Animasi ganti tampilan** lewat `runViewTransition`
  (`lib/view-transition.ts`): ganti mode terang/gelap → tampilan baru
  menyebar melingkar dari tombol yang diklik (`origin:
  originFromEvent(e)`); aksen & jenis font → cross-fade 250ms (sudah
  dibungkus di `setAccent` / `setFontFamily` milik `CustomThemeProvider`).
  Ukuran font sengaja tanpa animasi (slider). Penanda opsi terpilih punya
  `viewTransitionName` sendiri (`appearance-mode/-accent/-font`) sehingga
  bergeser ke opsi baru. Browser tanpa dukungan / `prefers-reduced-motion`
  → langsung berubah tanpa animasi.
- Di mana pun tema diganti (switcher, search, profil), panggil
  `runViewTransition(() => setTheme(v))`, jangan `setTheme` langsung.

#### Profil
Avatar (+ nama mulai `lg:`) → dropdown: kepala berisi avatar, nama, email →
My Profile, Lihat Foto Profil (hanya kalau ada foto), lalu **Log out** merah
(`text-destructive focus:bg-destructive/10`) dengan konfirmasi. Selama
profil dimuat: `Skeleton` bulat seukuran avatar. Di ga-web konfirmasinya
masih `MyAlertDialog`; sistem baru memakai `ConfirmDialog` (9.4).

### 3.2b Global search (⌘K)

Satu kotak untuk mencari **menu, aksi cepat, dan data** (dokumen, master
data, user). File: `topbar/topbar-search.tsx` (UI & keyboard),
`topbar/search-sections.ts` (penyusun hasil, fungsi murni),
`topbar/use-global-search.ts` (data, cache, riwayat), RPC di
`supabase/migrations/0008_global_search.sql`.

**Tampilan**

- `lg` ke atas: field inline di tengah top bar (`max-w-md`, `bg-muted/40`,
  fokus → `bg-background` + ring) dengan panel hasil di popover di
  bawahnya (`w-[min(34rem,calc(100vw-2rem))]`).
- Di bawah `lg`: `TopbarIconButton` 🔍 yang membuka **dialog yang menempel di
  atas layar** (`top-3`, `sm:top-[12vh]`), bukan di tengah, supaya tidak
  tertutup keyboard virtual. Ada tombol "Batal" di samping field.
- Placeholder menyebut apa saja yang bisa dicari: "Cari MR, PO, barang,
  menu…". Shortcut `⌘K` / `Ctrl K` (dideteksi setelah mount) tampil sebagai
  `kbd` di kanan field, hilang saat field fokus; saat ada isi diganti tombol ✕.
- Baris hasil: kotak ikon jenis data, judul (bagian yang cocok ditandai
  `<mark className="bg-primary/15">`), subjudul, dan di kanan pill status +
  nominal (`formatCurrency`) atau nama grup menu.
- Footer panel desktop: petunjuk `↑↓ pilih · Enter buka · Esc tutup`.

**Keyboard & perilaku**

- `⌘K`/`Ctrl+K` di mana saja: fokus ke field inline kalau tampil, kalau
  tidak buka dialog. `↑/↓` pilih (berputar), `Enter` buka, `Esc` kosongkan
  & tutup. Pilihan kembali ke item teratas tiap query/hasil berubah.
- **Enter sebelum hasil server datang** (mis. tempel kode MR lalu Enter):
  tunggu hasilnya (`flush()`), lalu buka yang teratas. Kode persis selalu di
  urutan pertama.
- Klik di panel tidak mencuri fokus dari input (`onMouseDown`
  `preventDefault`). Combobox ARIA lengkap (`role="combobox"`,
  `aria-activedescendant`, `role="listbox"/"option"`, grup berlabel).
- Navigasi memanggil `setPendingNavUrl` (progress bar & highlight sidebar
  sama seperti klik menu), kecuali kalau cuma query string yang berubah.

**Susunan hasil** (`buildSections`)

| Kondisi                | Urutan grup                                                     |
| ---------------------- | --------------------------------------------------------------- |
| Query kosong           | Menunggu approval Anda → Terakhir dibuka → Pencarian terakhir → Aksi cepat |
| Query mirip kode (ada angka atau `/`) | Paling cocok → MR → PO → Petty Cash → Barang → Vendor → User → Menu → Aksi |
| Query biasa            | Paling cocok → Menu → Aksi → Barang → Vendor → User → MR → PO → Petty Cash |

- **Paling cocok** = baris yang kode / part number / email-nya persis sama
  dengan query.
- **Menunggu approval Anda**: dokumen yang sudah giliran user (RPC
  `global_search_pending`, terbaru di atas). Kalau totalnya lebih banyak
  dari yang tampil → item redup "Lihat N approval MR/PO lainnya" ke halaman
  approval.
- Grup data yang penuh (5 baris) dapat item redup "Lihat semua hasil X" ke
  halaman list dengan `?search=` (karena itu halaman list **wajib** membaca
  `?search=` dari URL, 3.4).
- **Menu & Aksi** memakai `scoreMenuItem` dengan skor minimal 20
  (`MIN_LOCAL_SCORE`): cocok cuma sebagai subsequence tidak cukup, salah
  ketik 1 huruf masih lolos.
- **Aksi cepat** (`QUICK_ACTIONS`): Buat MR, Buat PO, Ajukan Petty Cash
  (ditandai `featured` → tampil juga saat query kosong), Profil Saya,
  `Tema: <mode>` (mode yang sedang aktif tidak ditawarkan), Keluar (dengan
  konfirmasi). Tiap aksi punya `keywords` dan `visible(profile)` yang
  **harus sama dengan aturan tombol aslinya** di halaman (mis. "Buat PO"
  hanya untuk yang `canCreatePO`).
- Item "Pencarian terakhir" mengisi ulang kotak search (`fillQuery`), tidak
  pindah halaman.

**Status & pesan**

| Kondisi                           | Tampilan                                            |
| --------------------------------- | --------------------------------------------------- |
| Profil belum dimuat               | Spinner "Memuat…"                                   |
| Query < 3 huruf                   | Hanya menu/aksi (lokal) + catatan "Ketik minimal 3 huruf untuk mencari dokumen & data." |
| Mencari, belum ada hasil          | Spinner "Mencari…" (ikon 🔍 di field ikut jadi spinner) |
| Mencari, ada hasil query sebelumnya | Hasil lama tetap tampil (tidak berkedip tiap ketikan) |
| Gagal                             | "Pencarian data gagal dimuat." + tombol "Coba lagi" |
| Tidak ada hasil                   | Ikon `SearchX` + "Tidak ada hasil untuk "…""        |
| Query kosong & tidak ada riwayat  | "Ketik nomor MR/PO, nama barang, vendor, atau menu." |

**Supaya ringan untuk database**

- **Satu RPC per query** (`global_search(q, limit)`), bukan query per tabel
  dari browser; maks. 5 baris per grup, hanya kolom ringan (tanpa JSON item).
- Dikirim setelah berhenti mengetik **250ms** dan minimal **3 huruf**.
  Request basi dibatalkan (`AbortController`).
- Hasil di-cache 60 detik per akun (maks. 40 query): hapus satu huruf lalu
  ketik lagi tidak memicu request baru.
- Antrian approval hanya diambil saat search dibuka, maks. 1× per menit.
- RPC `SECURITY INVOKER` (RLS tetap berlaku) dan **menerapkan aturan batas
  company yang sama dengan halaman list**, supaya search tidak menampilkan
  dokumen yang di list disembunyikan. Pencocokan: semua kata harus ada
  (urutan bebas), dengan index trigram untuk ekspresi yang dicari.

**Riwayat**: dokumen yang dibuka lewat search (maks. 5) dan query yang
menghasilkan sesuatu yang dibuka (maks. 4), per akun per perangkat di
`ga-global-search-history:<userId>`. Ada tombol "Hapus riwayat".

**Adaptasi wajib:**
- `KIND_META` (label, ikon, `href` detail per jenis data) dan `DATA_GROUPS`
  (grup + `listHref`) di `search-sections.ts`.
- `QUICK_ACTIONS` dengan aksi utama sistem baru dan aturan `visible` yang
  sama dengan halamannya.
- RPC `global_search` / `global_search_pending`: tabel, kolom yang dicari,
  aturan batas akses, dan status antrian approval sistem baru. Ekspresi di
  index trigram harus sama persis dengan yang dipakai di `WHERE`.
- Placeholder field dan pesan kosong menyebut entitas sistem baru.

### 3.3 Layout konten

#### `<Content>`
Card yang sekaligus menjadi kolom grid. **Setiap blok konten halaman adalah
`<Content>`**, jangan memakai `<Card>` langsung di level halaman.

```tsx
<Content
  title="Daftar Material Request"
  description="Kelola seluruh data Material Request"
  cardAction={<Button asChild><Link href="/x/buat"><Plus /> Buat</Link></Button>}
>
  …
</Content>

<Content size="md" title="Data Profil">…</Content>        {/* 6/12 di lg */}
<Content size="xs">…</Content>                             {/* stat card */}
<Content id="section-lampiran" title="Lampiran">…</Content> {/* target scroll */}
```

| Prop          | Fungsi                                                             |
| ------------- | ------------------------------------------------------------------ |
| `size`        | `lg` 12 kolom (default), `md` 6, `sm` 4, `xs` 6/4/3 (sm/lg/xl)     |
| `title`, `description`, `cardAction` | Header card; aksi di kanan, turun ke bawah di mobile |
| `cardFooter`  | Footer card                                                        |
| `id`          | Target `scrollToFormSection` / anchor                              |
| `className`   | Override lebar, mis. `lg:col-span-8` untuk layout detail 8/4       |

#### `InfoItem`, pasangan label–nilai **⚙ versi standar (9.1)**
Dipakai di kartu "Informasi Utama" halaman detail: ikon + label abu-abu di
kiri (1/3), nilai `font-semibold` di kanan (2/3), atau bertumpuk
(`isBlock`) untuk teks panjang.

```tsx
<div className="space-y-3">
  <InfoItem icon={User} label="Requester" value={doc.requester_name} />
  <InfoItem icon={Building2} label="Departemen" value={doc.department} />
  <InfoItem icon={FileText} label="Keterangan" value={doc.remarks} isBlock />
</div>
```

#### Skeleton loading
Skeleton meniru bentuk layout akhir, bukan spinner di tengah halaman:

```tsx
const DetailSkeleton = () => (
  <>
    <div className="col-span-12"><Skeleton className="h-12 w-1/2" /></div>
    <Content className="col-span-12 lg:col-span-8"><Skeleton className="h-64 w-full" /></Content>
    <Content className="col-span-12 lg:col-span-4"><Skeleton className="h-64 w-full" /></Content>
  </>
);
```

Spinner (`Loader2 animate-spin`) hanya untuk area kecil: dalam dialog,
tombol, atau popover.

### 3.4 Halaman list / tabel

Susunan dari atas ke bawah, di dalam satu `<Content>`:

```
[🔍 Cari Kode, Requester...........................] [Excel ▾] [Cetak]
┌ Filter (3) ▾ ─────────────────────────────────────────── ✕ Reset ┐
│ (Status: Approved ✕) (Departemen: IT ✕) (Tanggal: 01 Okt – 09 Okt ✕) │
├───────────────────────────────────────────────────────────────────┤
│ grid 1/2/4 kolom berisi field filter (hanya saat dibuka)          │
└───────────────────────────────────────────────────────────────────┘
              Urutan kolom sudah diubah. [↺ Kembalikan urutan bawaan]   ← hanya kalau diubah
┌ Tabel (border rounded-md, overflow-x-auto, header bg-muted/50) ───┐
│ No │ ⋮⋮Kode ↕ │ ⋮⋮Tanggal ↓ │ ⋮⋮Status │ … │ ⋮⋮Total ↕ │    Aksi    │
└───────────────────────────────────────────────────────────────────┘
  (⋮⋮ = grip, muncul saat hover; header bisa digeser. No & Aksi tetap)
Tampilkan [25 ▾] per halaman                    ‹ 1 2 3 … 9 ›
```

| Bagian            | Komponen / util                                         |
| ----------------- | ------------------------------------------------------- |
| Kotak cari        | `Input` + ikon `Search` + `useUrlSearchInput`           |
| Panel filter      | `FilterPanel` + helper `formatFilterDate/Rupiah/Range`, `filterOptionLabel` |
| Header sortable   | `SortableTableHead` + `resolveSort`                     |
| Header bisa digeser | `ReorderableHeaderRow` + `ReorderableTableHead` + `useColumnOrder` + `ColumnOrderReset` |
| Paginasi          | `CustomPagination` (**satu-satunya** komponen paginasi) |
| Jumlah baris      | `ui/select` berisi `LIMIT_OPTIONS` (`type/enum.ts`)     |
| Export            | `exportStyledExcel` + `fetchAllRows` (`lib/excel-export.ts`) |
| Quick view        | Klik baris → `Dialog` ringkasan → tombol "Lihat Detail Lengkap" |
| Cetak *(opsional)* | `window.print()` + class `no-print` / `#printable-area` |

#### `useUrlSearchInput(urlValue, onCommit, delay = 500)`
Input pencarian yang tersinkron ke `?search=` dengan debounce. **Wajib
dipakai** daripada pola `useState` + `useEffect` push, karena pola itu merusak
tombol Back browser (penjelasan lengkap di komentar file).

```tsx
const [searchInput, setSearchInput, resetSearchInput] = useUrlSearchInput(
  searchParams.get("search") || "",
  (value) => router.push(`${pathname}?${createQueryString({ search: value, page: 1 })}`),
);
<Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
```

#### `FilterPanel`
```tsx
const activeFilters: ActiveFilter[] = [];
if (status) activeFilters.push({
  key: "status", label: "Status", value: status,
  onRemove: () => handleFilterChange({ status: "" }),
});
if (startDate || endDate) activeFilters.push({
  key: "date", label: "Tanggal",
  value: formatFilterRange(startDate, endDate, formatFilterDate),
  onRemove: () => handleFilterChange({ startDate: "", endDate: "" }),
});

<FilterPanel activeFilters={activeFilters} onReset={clearFilters}>
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">Status</label>
      <SearchableSelect …/>
    </div>
  </div>
</FilterPanel>
```
- Tertutup saat pertama kali dibuka. Status buka/tutup diingat global.
- Chip filter aktif selalu tampil walau panel tertutup; bisa dihapus satu-satu.
- Mengubah filter apa pun → reset `page` ke 1.

#### `SortableTableHead` + `resolveSort`
```tsx
const SORT_COLUMNS = { kode: { column: "kode_mr" }, umur: { column: "created_at", invert: true } };
const sort = resolveSort(searchParams.get("sort") || "", SORT_COLUMNS, "umur.asc");
query.order(sort.column, { ascending: sort.ascending });

<SortableTableHead sortKey="kode" currentSort={sortParam} onSortChange={setSort}>Kode</SortableTableHead>
<SortableTableHead sortKey="total" defaultDirection="desc" className="text-right" …>Total</SortableTableHead>
```
Klik berputar: arah default → kebalikannya → kembali ke urutan bawaan
(param `sort` dihapus). Key di luar whitelist diabaikan.

Isi header yang bisa diklik tersedia terpisah sebagai `SortButton` (+
`sortAriaValue` untuk `aria-sort`), dipakai kalau `<th>`-nya bukan
`SortableTableHead`, mis. di `ReorderableTableHead`.

#### Kolom yang bisa digeser (`useColumnOrder`)
Untuk list utama yang kolomnya banyak (di ga-web: Material Request &
Purchase Order). User menggeser header untuk mengubah urutan kolom;
urutannya diingat per tabel per perangkat.

```tsx
// Di luar komponen (referensi stabil). Kolom di antara "No" & "Aksi".
// `sortDirection` diisi = bisa di-sort; id-nya harus ada di SORTABLE_COLUMNS.
const MR_COLUMNS = [
  { id: "kode_mr", label: "Kode MR", sortDirection: "asc" },
  { id: "status", label: "Status" },
  { id: "created_at", label: "Tanggal Dibuat", sortDirection: "desc" },
  { id: "cost_estimation", label: "Total Estimasi", sortDirection: "desc", className: "text-right" },
] as const satisfies readonly ReorderableColumn[];
type MrColumnId = (typeof MR_COLUMNS)[number]["id"];

const columnOrder = useColumnOrder("table-column-order:material-request", MR_COLUMNS);

// Isi 1 sel per id kolom
const renderCell = (row: Row, id: MrColumnId) => {
  switch (id) {
    case "kode_mr": return <TableCell>…</TableCell>;
    case "status": return <TableCell><StatusBadge status={row.status} /></TableCell>;
    // … semua id wajib ada (TypeScript menjaga lewat MrColumnId)
  }
};

{columnOrder.isCustomOrder && <ColumnOrderReset onReset={columnOrder.resetOrder} />}

<TableHeader className="bg-muted/50">
  <ReorderableHeaderRow order={columnOrder.order} onMove={columnOrder.moveColumn}>
    <TableHead className="w-[50px]">No</TableHead>
    {columnOrder.orderedColumns.map((column) => (
      <ReorderableTableHead key={column.id} column={column}
        sort={{ currentSort: sortParam, onSortChange: (sort) => handleFilterChange({ sort }) }} />
    ))}
    <TableHead className="text-right no-print">Aksi</TableHead>
  </ReorderableHeaderRow>
</TableHeader>
<TableBody>
  {rows.map((row, i) => (
    <TableRow key={row.id}>
      <TableCell>{(page - 1) * limit + i + 1}</TableCell>
      {columnOrder.order.map((id) => <Fragment key={id}>{renderCell(row, id)}</Fragment>)}
      <TableCell className="text-right no-print">…</TableCell>
    </TableRow>
  ))}
</TableBody>
```

- **No & Aksi tidak ikut digeser** (ditulis di luar daftar kolom).
- Interaksi: `cursor-grab`, ikon `GripVertical` muncul saat hover header,
  kolom yang sedang digeser `opacity-40`, garis `bg-primary` di sisi
  tempat kolom akan jatuh (digeser ke kanan → sisi kanan target, ke kiri →
  sisi kiri). `title="Geser untuk memindahkan kolom"`.
- Memakai drag & drop HTML5 bawaan (tanpa library): jalan di desktop, tidak
  di layar sentuh. Di layar sentuh urutan bawaan tetap dipakai.
- State drag ada di context `ReorderableHeaderRow`, bukan di halaman,
  supaya menggeser header tidak me-render ulang ribuan baris data.
- Drag dari luar header tabel itu (teks, file, tabel lain) diabaikan.
- Isi storage selalu dicocokkan ulang dengan daftar kolom di kode: id yang
  sudah tidak ada dibuang, kolom baru disisipkan di posisi bawaannya. Jadi
  menambah/menghapus kolom **tidak perlu migrasi storage**. Kalau urutan
  kembali sama dengan bawaan, storage dihapus.
- Bar "Urutan kolom sudah diubah. [Kembalikan urutan bawaan]" (`text-xs`,
  rata kanan) di bawah panel filter, hanya saat urutan berbeda.
- Key storage: `table-column-order:<nama-tabel>`.
- Urutan geser hanya untuk tampilan tabel. Export Excel menyusun kolomnya
  sendiri di fungsi export dan tidak ikut berubah.

#### Quick view
Klik baris tabel membuka `Dialog` berisi ringkasan dokumen (info utama +
daftar item ringkas). Footer: "Tutup" (outline) dan "Lihat Detail Lengkap"
(primary, ikon `Eye`). Link kode dokumen di baris tetap langsung ke detail
(`onClick={e => e.stopPropagation()}`).

#### Aturan tabel
- Kolom pertama nomor urut: `(page - 1) * limit + index + 1`.
- Kolom status memakai `StatusBadge` (9.5).
- Angka/uang rata kanan (`text-right`, `tabular-nums`).
- Tabel sangat lebar boleh `min-w-[…px]` di dalam wrapper `overflow-x-auto`.
- Kosong: satu baris `colSpan` penuh, `text-center text-muted-foreground`,
  teks "Tidak ada data ditemukan."
- Export Excel berupa dropdown dua opsi: **"Sesuai filter (N data)"** dan
  **"Semua data"**. Kalau tidak ada data → `toast` info, bukan file kosong.

### 3.5 Form create / edit

#### `FormSummaryLayout`, panel ringkasan form
Membungkus seluruh form. Menyediakan:

- **Bar submit** di akhir form: badge progres `3/5`, petunjuk ("Lengkapi 2
  langkah wajib…"), badge "Belum disimpan", link "Lihat ringkasan", tombol submit.
- **Panel kanan** (bisa dibuka/tutup): checklist langkah, nilai saat ini,
  konten tambahan (mis. total biaya), penjelasan "setelah diajukan…", tombol submit.
  - Desktop ≥1280px: panel mendorong form (form menyempit).
  - Layar kecil: overlay + backdrop, tutup dengan Esc.
  - Status buka/tutup diingat.
- **Tab vertikal "Ringkasan"** di tepi kanan layar saat panel tertutup
  (ada titik amber kalau ada perubahan belum disimpan).
- Klik baris checklist → scroll + highlight ring ke section (`targetId`).
- Klik submit saat masih ada langkah `todo` → scroll ke langkah pertama
  yang kurang, bukan submit.

```tsx
<FormSummaryLayout
  summary={{
    title: "Ringkasan MR",
    subtitle: <span className="font-mono">{kode}</span>,
    checks: [
      { id: "kategori", label: "Kategori", status: kategori ? "done" : "todo",
        value: kategori, targetId: "field-kategori" },
      { id: "items", label: "Barang", status: items.length ? "done" : "todo",
        hint: "Minimal 1 barang", targetId: "section-items" },
      { id: "lampiran", label: "Lampiran", status: files.length ? "done" : "optional",
        targetId: "section-lampiran" },
    ],
    submitLabel: "Ajukan MR",
    submittingLabel: "Mengajukan...",
    onSubmit: handleSubmit,
    submitting,
    disabled: uploading,          // proses lain, BUKAN karena form belum lengkap
    dirty,                        // dari useUnsavedChanges
    nextSteps: <>MR akan divalidasi oleh tim GA.</>,
    children: <TotalBiaya />,
  }}
>
  <Content title="Informasi Utama">…</Content>
  <Content id="section-items" title="Order Item">…</Content>
  <Content id="section-lampiran" title="Lampiran File">…</Content>
</FormSummaryLayout>
```

Status checklist:

| Status      | Arti                                             | Memblok submit | Dihitung progres |
| ----------- | ------------------------------------------------ | -------------- | ---------------- |
| `done`      | Terpenuhi                                        | –              | ✔ selesai         |
| `todo`      | Wajib, belum diisi                               | **Ya**         | ✔ belum           |
| `suggested` | Disarankan (halaman edit yang validasinya longgar) | Tidak        | ✔ belum           |
| `warning`   | Terpenuhi tapi perlu perhatian                   | Tidak          | ✔ selesai         |
| `optional`  | Opsional & kosong                                | Tidak          | ✘                 |

Helper ikutan:
- `useUnsavedChanges(value, ready)` → `{ dirty, resetBaseline }`.
  Panggil `resetBaseline()` setelah simpan.
- `scrollToFormSection(id)` untuk scroll + highlight manual.
- `enabled={false}` mematikan panel (mis. halaman detail yang hanya jadi form
  saat mode edit).
- Logika checklist yang kompleks dipisah ke file sendiri (contoh
  `lib/mrEditSummaryChecks.ts`).

#### Input
| Kebutuhan                    | Komponen                                         |
| ---------------------------- | ------------------------------------------------ |
| Pilihan ≤ ~7                 | `ui/select`                                      |
| Pilihan banyak / bisa dicari | `SearchableSelect` atau wrapper `Combobox` (`data: {value,label}[]`) |
| Uang                         | `CurrencyInput`                                  |
| Tanggal                      | `DatePicker` (`components/date-picker.tsx`); di panel filter boleh `<Input type="date">` |
| Teks panjang + mention       | `RichMentionEditor` (lihat 3.7)                  |
| Cari entitas dari DB         | Pola combobox async + `debounceAsync` (contoh `BarangSearchCombobox`, `VendorSearchCombobox`) |

Field selalu: `Label` di atas, input full width, `id` untuk target scroll,
pesan bantu `text-xs text-muted-foreground` di bawah.

#### Lampiran
- Upload langsung ke storage via signed URL (`lib/uploadDirect.ts`), batas
  `MAX_ATTACHMENT_SIZE_BYTES` (`lib/attachments.ts`), cek dengan
  `getAttachmentSizeError(file)`; pesan error upload lewat `getUploadErrorMessage(err)`.
- File terlalu besar → `LinkAttachmentForm`: lampiran berupa link (Google
  Drive dll), disimpan sebagai attachment `is_link: true`.
- Progress lewat toast: `toast.loading("Mengunggah 3 file...")` →
  `toast.success(..., { id })`.

#### Pilih dari template / riwayat *(opsional)*
Di form create, tombol "Pakai Template" dan "Ambil dari Riwayat" membuka
dialog daftar ringkas yang bisa di-expand per item, lalu mengisi form.
Contoh: `MrTemplatePickerDialog`, `MrHistoryPickerDialog`. Setelah diterapkan
→ `toast.success("Template diterapkan.")`, beri tombol "Lepas" untuk mengosongkan.

### 3.6 Halaman detail & workflow

#### Struktur halaman detail
```
KODE-DOKUMEN-001                                [Riwayat Aktivitas] [Edit] [Hapus] [Level]
Dibuat pada Kamis, 9 Oktober 2026 · [Status] · Umur: 3 Hari 4 Jam
[Banner aksi kontekstual, mis. "2 barang sedang dikirim ke Anda" + tombol]
┌──────────── lg:col-span-8 ────────────┐ ┌──── lg:col-span-4 ────┐
│ Informasi Utama (InfoItem)            │ │ Tindakan              │
│ Daftar Item (tabel)                   │ │ Jalur Approval        │
│ …                                     │ │ Lampiran              │
│                                       │ │ Diskusi               │
└───────────────────────────────────────┘ └───────────────────────┘
```
- Judul: kode dokumen `text-3xl font-bold`, baris bawahnya meta +
  `StatusBadge tone="solid"` (9.5).
- Tombol header `size="sm"`; aksi destruktif `variant="destructive"` via `ConfirmDialog`.
- Tombol "Kembali" (outline, ikon `ArrowLeft`) memakai
  `useGoBack(fallbackHref)`, bukan `router.back()`: kalau halaman ini yang
  pertama dibuka di window itu (mis. dari klik notifikasi push di PWA, yang
  tidak punya tombol back browser), user dibawa ke `fallbackHref`.
- **Kartu "Tindakan"** selalu ada di kolom kanan atas. Isinya tombol
  approve/reject *hanya* jika giliran user; kalau bukan, tampilkan teks
  penjelasan (mis. "Menunggu approval dari X").
- Mode edit di halaman yang sama (`isEditing`) memakai
  `FormSummaryLayout enabled={isEditing}`; lebar kolom memakai container
  query `@4xl/form:col-span-8` / `@4xl/form:col-span-4` supaya tetap rapi saat
  panel ringkasan terbuka.
- Banner kontekstual: `rounded-lg border border-amber-200 bg-amber-50 p-4`
  (dark: `border-amber-900 bg-amber-950/40`) + ikon + teks + tombol aksi.
- Data tidak ditemukan → `<Content>Data tidak ditemukan</Content>`.

#### Jalur Approval, stepper vertikal **⚙ versi standar (9.2)**
Daftar approver berurutan. Tiap baris: `UserAvatar` + nama + badge
departemen + tipe approval (Mengetahui/Menyetujui/…) + waktu diproses +
badge status. **Baris yang sedang giliran** diberi
`bg-primary/10 ring-2 ring-primary/50`, dan di baris itu bisa ditaruh aksi
(mis. tombol Follow-up).

```tsx
<Content title="Jalur Approval">
  <ApprovalPath
    approvals={doc.approvals}
    emptyText="Jalur approval belum ditentukan oleh GA."
    renderTurnAction={(step) =>
      step.userid !== currentUser.id && <FollowupButton approver={step} />}
  />
</Content>
```

#### Stepper rantai proses, horizontal **⚙ versi standar (9.3)**
`StepChain`: titik bernomor yang dihubungkan garis. State `done` (hijau + ✓),
`current` (oranye), `rejected` (merah + ✕), `pending` (abu-abu). Label kecil
di bawah titik, opsional `detail` tebal. Cocok untuk kartu ringkasan
("Pengajuan → Voucher → Tarikan Dana → Deklarasi").

```tsx
<StepChain steps={[
  { key: "ajuan", label: "Pengajuan", state: "done" },
  { key: "voucher", label: "Voucher", state: "current", detail: "Menunggu GA" },
  { key: "dana", label: "Tarikan Dana", state: "pending" },
]} />
```

#### Riwayat Aktivitas
`<ActivityLogDialog resourceType="material_request" resourceId={id} />`:
tombol outline "Riwayat Aktivitas" → dialog timeline (titik primary + garis
vertikal), tiap entri berisi waktu, badge `action_type`, nama pelaku ("Sistem"
kalau kosong), deskripsi yang dipotong 1 baris + "Lihat selengkapnya".
Data diambil saat dialog dibuka. Butuh tabel log + `services/logService.ts`
(`logActivity`, `fetchActivityLogs`). **Setiap aksi penting wajib memanggil
`logActivity`.**

#### Follow-up approval *(opsional)*
`FollowupApprovalButton`: tombol "Follow-up" ke approver yang sedang
giliran → konfirmasi → kirim notifikasi + catat log, menampilkan kapan
terakhir follow-up (`formatRelativeTime`). Di ga-web masih terikat ke tabel
MR/PO (`resourceType` dipetakan langsung ke nama tabel); saat dibawa, ganti
pemetaan itu dengan prop `table` atau callback `onRequest`.

#### Riwayat revisi *(opsional)*
`PcRevisionHistory`: badge "Versi Asli", "Revisi 2", …, "Versi Terkini";
klik → lihat isi versi itu (read-only). Dipakai kalau approver boleh
mengedit dokumen sebelum menyetujui ("Edit & Setujui").

### 3.7 Diskusi & rich text

#### `DiscussionPanel`
Panel chat per dokumen. **Sepenuhnya controlled**: komponen tidak
menyimpan ke DB sendiri; caller yang menentukan lewat `onSubmit`.

```tsx
<DiscussionPanel
  discussions={doc.discussions}
  onSubmit={async (payload) => { await saveDiscussion(payload); refetch(); }}
  storagePathPrefix={`discussions/mr/${doc.id}`}
  currentUserId={user.id}
  allowReply
/>
```
- Bubble (`DiscussionMessageBubble`): pesan sendiri di kanan (`bg-primary/10`),
  orang lain di kiri (`bg-muted/50`), lebar mengikuti isi (maks 70% di desktop).
- Balas pesan: kutipan di bubble, klik → scroll + highlight pesan asli.
- Gambar: drag & drop, paste, atau tombol toolbar. Sticker/emoji lewat
  `EmojiStickerPicker`.
- Enter = kirim (kecuali sedang di list atau popup mention terbuka).
- List pesan `max-h-96 overflow-y-auto`; kosong → "Belum ada diskusi."

#### `RichMentionEditor` / `RichContentView`
Editor Tiptap (bold/italic/list) dengan **4 jenis mention**:
`@` user, `#` barang, `$` vendor, `/` dokumen. Sumber data di
`services/mentionSearchService.ts`. Handle ref: `getJSON`, `getText`,
`getMentions`, `isEmpty`, `clear`, `focus`.
`RichContentView` merender hasilnya (read-only). Simpan sebagai JSON string
(`stringifyRichContent`), ambil teks polos dengan `extractPlainText`.
**Adaptasi:** `@` user tetap; ganti `#` / `$` / `/` dengan entitas sistem baru
(atau buang yang tidak perlu) di `components/tiptap/mention-extensions.tsx`
dan `mentionSearchService.ts`.

#### `NoteWithLinks`
Teks catatan biasa yang otomatis mengubah URL (termasuk domain tanpa
`http`) jadi link, dengan tanda baca akhir kalimat dibuang.

### 3.8 User & avatar

| Komponen               | Fungsi                                                         |
| ---------------------- | -------------------------------------------------------------- |
| `UserAvatar`           | Avatar dari `userId` (URL di-cache), fallback inisial. Klik → `UserProfileCard` (matikan dengan `profileCard={false}`) |
| `UserProfileCard`      | Popover kartu nama: foto, nama, departemen, lokasi, perusahaan; di-cache per sesi |
| `AvatarViewerDialog`   | Lihat foto ukuran penuh                                         |
| `ProfileAvatarDialog`  | Ganti foto profil (pakai `ImageCropDialog`)                     |
| `ImageCropDialog`      | Pilih file / kamera / paste → crop (zoom, geser) → `onSave(blob)`. Props: `aspect`, `outputWidth`, `guide="circle"`/`"rect"`, `allowCamera`, `initialFile`. Maks 10 MB |

Aturan: di mana pun nama orang tampil (tabel, approval, diskusi), pakai
`UserAvatar` supaya profilnya bisa diklik. Klik di dalam popover tidak ikut
memicu `onClick` baris tabel (sudah ditangani dengan `stopPropagation`).

### 3.9 Dialog, konfirmasi, toast

| Kebutuhan                       | Pakai                                                     |
| ------------------------------- | --------------------------------------------------------- |
| Form / detail di atas halaman   | `ui/dialog` (`sm:max-w-…`, isi panjang `max-h-[80vh]` + `ScrollArea`) |
| Konfirmasi aksi                 | `ConfirmDialog` **⚙ versi standar (9.4)**, satu-satunya komponen konfirmasi |
| Panel samping                   | `ui/sheet`                                                |
| Info kecil saat hover / klik    | `Tooltip` / `Popover`                                     |

```tsx
{/* Pakai trigger */}
<ConfirmDialog title="Hapus vendor ini?" destructive confirmText="Hapus"
  onConfirm={() => deleteVendor(id)}>
  <Button variant="destructive" size="sm">Hapus</Button>
</ConfirmDialog>

{/* Dikontrol dari luar (mis. dari item dropdown) */}
<ConfirmDialog open={logoutOpen} onOpenChange={setLogoutOpen}
  title="Keluar dari aplikasi?" description="Anda perlu login lagi untuk masuk."
  confirmText="Log out" onConfirm={handleLogout} />
```
Kalau `onConfirm` async, dialog tetap terbuka dan tombol menampilkan spinner
sampai selesai; kalau gagal (throw), dialog tidak menutup.

**Toast (`sonner`)**, posisi kanan bawah, `richColors`:

```ts
const id = toast.loading("Mengajukan MR...");
try {
  await submit();
  toast.success("Material Request berhasil dibuat dan menunggu validasi!", { id });
} catch (err) {
  toast.error(`Gagal mengajukan MR: ${err.message}`, { id });
}
toast.error("Gagal generate kode MR", { description: error.message });
toast.warning("Profil belum lengkap.");
toast.info("Harga estimasi otomatis terisi dari database.");
```
- Sukses: kalimat lengkap, sebut objeknya.
- Gagal: `"Gagal <aksi>"` + detail di `description` atau setelah titik dua.
- Validasi sederhana di client cukup toast error; validasi form panjang
  memakai checklist `FormSummaryLayout`.

**Empty state**: teks `text-sm text-muted-foreground` di tengah, satu
kalimat ("Belum ada riwayat aktivitas."). Kalau ada aksi pemulihan, tambah
link/tombol kecil ("Hapus pencarian", "Reset filter").

### 3.10 Notifikasi

| Bagian                     | File                                                       |
| -------------------------- | ---------------------------------------------------------- |
| Provider realtime          | `components/providers/NotificationProvider.tsx` → `useNotification()` = `{ unreadCount, notifications, refreshNotifications, markAsRead, markAllRead }` |
| Kirim notifikasi           | `lib/notifications/client.ts` (`sendNotification(s)`, helper per event) |
| Halaman Notifikasi         | `app/(With Sidebar)/notifications/page.tsx`                |
| Pengaturan                 | `components/notification-settings.tsx`                     |
| Suara notifikasi *(opsional)* | `lib/notifications/sound.ts`, `settings.ts`             |
| Ringtone custom *(opsional)* | `components/custom-ringtone-settings.tsx` + `lib/notifications/custom-sound-db.ts` (IndexedDB) |
| Push browser *(opsional)*  | `lib/notifications/push.ts`, `app/api/push/send/route.ts`, `public/sw.js` |
| Install PWA *(opsional)*   | `lib/pwa/use-install-prompt.ts` + `public/manifest.json` (lihat 3.16) |
| Inbox top bar              | `components/topbar/topbar-inbox.tsx` + `use-inbox.ts` (lihat 3.2a) |

Pola halaman Notifikasi:
- Filter Semua/Belum dibaca, per modul, per kategori, dan pencarian, semuanya
  dijalankan di query (bukan memfilter data yang sudah dimuat).
- Dikelompokkan per tanggal: "Hari ini", "Kemarin", lalu tanggal.
- "Muat lebih banyak" (30 per halaman), bukan paginasi.
- Toggle dibaca/belum per item, "Tandai semua dibaca". Tombol toggle per
  item baru muncul saat hover hanya di perangkat berpointer
  (`pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100`); di layar
  sentuh selalu terlihat.
- **Pilih banyak (checkbox):**
  - Tiap baris punya `Checkbox` di kiri (di atas overlay klik baris,
    `relative z-[1]`); baris terpilih `bg-primary/10`.
  - Bar seleksi di atas daftar (`min-h-11 border-b`): checkbox "Pilih
    semua" (berubah jadi "`N` dipilih"), lalu di kanan **Tandai dibaca**,
    **Tandai belum dibaca** (label pendek "Dibaca"/"Belum" di mobile), dan
    ✕ "Batalkan pilihan".
  - Hanya item yang statusnya benar-benar berubah yang di-update, dalam
    satu query (`.in("id", ids)`). Selesai → `toast.success("3 notifikasi
    ditandai sudah dibaca")`, pilihan dikosongkan, badge disegarkan.
  - Pilihan dikosongkan saat filter berubah; id yang sudah tidak ada di
    daftar dibuang otomatis.
  - "Pilih semua" = semua yang **sudah dimuat**, bukan seluruh data.
- Badge sidebar, Inbox top bar, dan halaman ini sinkron karena semuanya
  lewat provider.
- Notifikasi browser ditampilkan lewat **service worker**
  (`registration.showNotification`, `data: { url }`), baru jatuh ke
  `new Notification()` kalau tidak ada registrasi: Chrome Android & PWA iOS
  tidak mendukung `new Notification()`. Klik notifikasi di `sw.js`: fokus ke
  window yang sudah di URL itu → kalau tidak ada, fokus ke window app lain
  dan pindahkan ke URL itu → baru buka window baru.
- Hook badge yang dipakai di beberapa tempat sekaligus (sidebar, top bar,
  dashboard) harus sinkron antar-instance: `useUpdateWebBadge` memancarkan
  event `update-web-seen`; `useSupportChatBadge` memberi nama channel
  realtime unik per pemakaian.

**Adaptasi:** kategori dan jenis event (`NotificationEventType`,
`CATEGORIES` di halaman notifikasi) disesuaikan dengan modul sistem baru.

### 3.11 Dashboard

| Komponen               | Fungsi                                                         |
| ---------------------- | -------------------------------------------------------------- |
| Panel "Perlu Aksi Anda" | Daftar dokumen yang menunggu user, tiap baris deep-link ke halaman aksinya (contoh `PcActionNeededList`, kartu "Perlu Aksi Anda" di dashboard) |
| Feed aktivitas         | Aktivitas terbaru + chip filter jenis (contoh `PcActivityFeed`) |
| `ClickableStatCard`    | Kartu angka + ikon + deskripsi; klik → dialog tabel drill-down berpaginasi. `mode="server"` (`fetchPage` dipanggil saat dibuka) atau `mode="client"` (`items` sudah ada) |
| Chart                  | `ui/chart` + recharts, mis. "Tren Harian MR vs PO"            |
| Sapaan + avatar        | `DashboardProfileAvatar` (bentuk avatar bisa diganti user)    |
| `ScoreStatCard` *(opsional)* | Skor/grade A–E (hijau → merah) untuk umur dokumen      |

Urutan dashboard: sapaan/profil → banner info → **yang perlu aksi** →
stat card (grid `size="xs"`) → chart. Hal yang butuh aksi selalu di atas
angka statistik.

### 3.12 Kustomisasi oleh user

Semua bisa diatur user sendiri, disimpan per perangkat:

| Preferensi                     | Pilihan                                              | Tempat atur            | Key penyimpanan (ga-web)         |
| ------------------------------ | ---------------------------------------------------- | ---------------------- | -------------------------------- |
| Mode tema                      | Light, Soft Light, Dark, Soft Dark, System           | Top bar "Tampilan", profil, halaman auth, global search | next-themes (`theme`) |
| Warna aksen                    | Default, GMI, GIS + 15 warna umum                    | Top bar "Tampilan", profil, halaman auth | `accent-theme`  |
| Jenis font                     | Geist, Inter, Plus Jakarta Sans, Poppins, Nunito, Roboto, Atkinson Hyperlegible, Font Sistem | Top bar "Tampilan", profil, auth | `font-family` |
| Ukuran font                    | Kecil 87.5%, Menengah, Besar 112.5%, Sangat Besar 125% | Top bar "Tampilan", profil, auth | `font-size`         |
| Menu sidebar tersembunyi       | per grup                                             | Tombol "Atur"          | `ga-sidebar-hidden-menu`         |
| Query cari menu                | –                                                    | Sidebar                | `ga-sidebar-search`              |
| Riwayat global search          | dokumen terakhir dibuka + query terakhir, per akun   | Global search ("Hapus riwayat") | `ga-global-search-history:<userId>` |
| Urutan kolom tabel             | per tabel                                            | Geser header tabel     | `table-column-order:<tabel>`     |
| Panel filter terbuka           | ya/tidak                                             | Tombol "Filter"        | `filter-panel-open`              |
| Panel ringkasan form terbuka   | ya/tidak                                             | Tab "Ringkasan"        | `ga-web:form-summary-open`       |
| Notifikasi (suara, volume, …)  | –                                                    | Profil                 | `ga-notif-settings`              |
| Bentuk avatar dashboard        | –                                                    | Dashboard              | `dashboard-avatar-shape`         |

**Adaptasi wajib:** ganti semua key di atas dengan prefix sistem baru
(mis. `hr:sidebar-hidden-menu`). Kalau dua sistem dibuka di domain yang sama
dengan key yang sama, preferensinya saling menimpa.

### 3.13 Halaman profil
Kartu berurutan: **Data Profil** (`size="md"`, termasuk ganti/hapus foto) →
**Tampilan** (`AccentThemeSwitcher`, `FontSwitcher`, `ThemeSwitcher`) →
**Pengaturan Notifikasi**. Data tambahan khusus domain (di ga-web:
Rekening Bank untuk petty cash) ditaruh paling bawah.

Foto profil yang bisa diklik untuk diganti: overlay `bg-black/50` + ikon
kamera saat hover (`pointer-coarse:hidden`); di layar sentuh diganti badge
kamera kecil `bg-primary` di pojok kanan bawah yang selalu tampil.

### 3.14 Halaman auth
`AuthShell` + `AuthInput`. Spesifikasi visual di `styling-guide.md` 7.4 dan
`docs/auth-page-design-guide.md`. Tambah halaman `pending-approval` kalau
akun baru harus diaktifkan admin dulu.

### 3.15 Modul pendukung *(semua opsional)*

| Modul                    | Isi                                                                 | Referensi |
| ------------------------ | ------------------------------------------------------------------- | --------- |
| Update Web               | Changelog/pengumuman, editor Tiptap + gambar/video, reaction + konfeti emoji, komentar, badge "baru" di sidebar, banner di dashboard | `update.md` |
| Feedback                 | Form saran/bug untuk user + halaman kelola khusus admin IT          | `app/(With Sidebar)/feedback/`, `feedback-management/` |
| Dokumentasi interaktif   | Pilih peran → langkah milik peran itu di-highlight; `FlowStepper` mode visual (mock UI beranimasi, autoplay) / teks; FAQ | `app/(With Sidebar)/dokumentasi/_components/` |
| Tentang App              | Info aplikasi, versi, logo grup                                     | `app/(With Sidebar)/tentang-app/` |
| Verifikasi publik + cetak | Halaman tanpa login dari scan QR di dokumen cetak (verifikasi PO, terima barang via token); menu cetak dengan QR atau tanda tangan basah (`PcPrintMenu`) | `app/approval-*/`, `app/goods-receipt/[token]/` |
| Kamera + cap foto        | `CameraCaptureDialog` + `lib/photoStamp.ts` (cap waktu, lokasi, perangkat di foto bukti) | |
| Template approval        | Builder jalur approval: tambah approver, atur tipe, naik/turun urutan, aturan auto-terapkan per jenis dokumen & departemen | `app/(With Sidebar)/approval-validation/templates/` |
| Cetak list               | Tombol "Cetak" di toolbar list                                      | 3.4 |
| Chat Admin               | Chat user ↔ admin IT per topik (percakapan), inbox bersama admin, badge realtime, shortcut top bar | `app/(With Sidebar)/chat-admin/`, `chat-admin-management/`, `components/support-chat/*`, `services/supportChatService.ts`, `supabase/migrations/0007_chat_admin.sql` |

#### Chat Admin *(opsional)*
- **Halaman user** (`/chat-admin`) dan **Inbox Chat Admin** khusus admin IT
  (`/chat-admin-management`) memakai komponen yang sama
  (`SupportTicketList`, `SupportChatThread`, `useSupportTickets`); bedanya
  hanya `asAdmin` (sisi bubble, penanda dibaca) dan tombol di
  `headerActions`.
- **Pola dua panel** di dalam satu `<Content>`: grid
  `md:grid-cols-[minmax(260px,340px)_1fr]`, tinggi
  `h-[calc(100svh-15rem)] min-h-[480px]`, `rounded-lg border`. Kiri daftar
  percakapan, kanan isi chat. Di mobile hanya satu panel yang tampil:
  daftar, atau thread (dengan tombol kembali `onBack`).
- Percakapan terpilih disimpan di `?t=<id>`, jadi link dari notifikasi
  langsung membuka percakapannya. Belum memilih → ikon `Headset` dalam
  lingkaran `bg-primary/10` + kalimat petunjuk.
- Tombol utama "Percakapan Baru" di `cardAction` → dialog singkat
  (kategori, subjek, pesan pertama, lampiran opsional).
- Status percakapan: `menunggu` / `dibalas` / `selesai`; user bisa
  menandai "Selesai", admin bisa Ambil, alihkan ke admin IT lain, tandai
  selesai / buka kembali, dan hapus (dengan konfirmasi).
- Kotak ketik (`SupportComposer`): Enter = kirim, Shift+Enter = baris baru
  (di HP Enter tetap baris baru). Lampiran 1 file lewat tombol klip atau
  paste; file baru di-upload saat pesan dikirim, bukan saat dipilih,
  supaya lampiran yang batal tidak menyampah di storage.
- Halaman auth punya tombol `Headset` → `ChatAdminInfoDialog`: user yang
  belum bisa login diarahkan minta bantuan ke Department Head (Chat Admin
  baru bisa dipakai setelah login).

### 3.16 PWA & perangkat sentuh

#### Aturan layar sentuh (inti)
- Aksi yang hanya muncul saat hover memakai varian **pointer**, bukan
  breakpoint: `pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100`
  (contoh: tombol Balas di bubble diskusi, toggle dibaca di notifikasi).
  Tablet besar dengan layar sentuh tetap bisa melihat tombolnya.
- Overlay yang hanya muncul saat hover diganti penanda yang selalu tampil
  di `pointer-coarse:` (contoh: ikon kamera foto profil, tombol di thumbnail
  editor Update Web).
- Field input teks `text-base md:text-sm` (16px di HP, supaya iOS tidak
  zoom otomatis saat fokus).
- `crypto.randomUUID()` hanya ada di HTTPS/localhost; buka app lewat IP LAN
  dari HP membuatnya undefined. Pakai `randomUUID()` dari `lib/utils.ts`.
- Unduhan file dari blob (export Excel): `URL.revokeObjectURL` ditunda
  (10 detik), karena Safari iOS/PWA bisa membatalkan unduhan kalau URL-nya
  dicabut terlalu cepat.

#### PWA *(opsional)*
`<PwaSupport />` dipasang sekali di `app/layout.tsx`:

| Bagian                    | File                                         | Fungsi                                                        |
| ------------------------- | -------------------------------------------- | ------------------------------------------------------------- |
| Registrasi service worker | `components/pwa/pwa-support.tsx`             | Didaftarkan untuk **semua** user (dibutuhkan halaman offline), bukan hanya saat push diaktifkan |
| Warna status bar          | `components/pwa/theme-color-sync.tsx`        | `<meta name="theme-color">` mengikuti background tema pilihan user (dipantau dari class `<html>`); `viewport.themeColor` di layout hanya untuk first paint |
| Link di dalam app         | `components/pwa/standalone-link-handler.tsx` | Di mode standalone, link internal `target="_blank"` dibuka di dalam app (bukan browser overlay yang sesinya bisa beda) |
| Deteksi standalone        | `lib/pwa.ts` (`isStandalone()`)              | `display-mode: standalone` atau `navigator.standalone` (iOS lama) |
| Fallback offline          | `public/sw.js` + `public/offline.html`       | Navigasi gagal karena offline → halaman "Kamu sedang offline" + "Coba lagi" (muat ulang otomatis saat online). Tidak meng-cache halaman/data lain |
| Manifest                  | `public/manifest.json`                       | `id`, `name`/`short_name`, `display: standalone`, ikon `any` + `maskable` |
| iOS                       | `metadata.appleWebApp` di `app/layout.tsx`   | `capable`, judul di bawah ikon, status bar `default`          |

- `StandaloneLinkHandler` **tidak** mencegat link ke origin lain
  (lampiran, wa.me), `/api/*`, path berekstensi file, link `download`, dan
  link ber-atribut **`data-pwa-new-window`**. Pasang atribut itu pada link
  `_blank` di halaman form (mis. "Buka detail MR" di form buat PO) supaya
  isian yang belum disimpan tidak hilang.
- Data MR/PO/PC selalu segar dari server: service worker sengaja **bukan**
  offline-first. Naikkan `CACHE_VERSION` di `sw.js` kalau `offline.html`
  berubah.
- Tombol "Kembali" di halaman detail/form memakai `useGoBack` (3.6).

---

## 4. Resep halaman

### 4.1 List page
```tsx
"use client";
export default function XxxClient() {
  const router = useRouter(); const pathname = usePathname(); const sp = useSearchParams();
  const page = Number(sp.get("page") || 1);
  const limit = Number(sp.get("limit") || 25);
  const status = sp.get("status") || "";
  const sortParam = sp.get("sort") || "";

  const createQueryString = (updates: Record<string, string | number>) => { /* merge ke sp, hapus yg kosong */ };
  const handleFilterChange = (u: Record<string, string | number>) =>
    router.push(`${pathname}?${createQueryString({ ...u, page: 1 })}`);
  const [searchInput, setSearchInput] = useUrlSearchInput(sp.get("search") || "",
    (v) => handleFilterChange({ search: v }));

  // fetch: .range((page-1)*limit, page*limit-1) + filter + resolveSort(...)

  return (
    <Content title="Daftar Xxx" description="…" cardAction={<TombolBuat />}>
      <div className="mb-6 flex flex-col gap-4 no-print">
        <div className="flex flex-col gap-4 md:flex-row">{/* cari + Excel */}</div>
        <FilterPanel activeFilters={activeFilters} onReset={() => router.push(pathname)}>…</FilterPanel>
      </div>
      {loading ? <Skeleton className="h-96 w-full" /> : <div className="overflow-x-auto rounded-md border bg-card"><Table>…</Table></div>}
      <div className="mt-4 flex flex-col items-center justify-between gap-4 sm:flex-row">
        {/* Select limit */}
        <CustomPagination currentPage={page} totalPages={Math.ceil(total / limit)}
          onPageChange={(p) => router.push(`${pathname}?${createQueryString({ page: p })}`)} />
      </div>
    </Content>
  );
}
```
`page.tsx` server membungkus client component dalam `<Suspense>` (karena `useSearchParams`).

### 4.2 Form create
`FormSummaryLayout` → beberapa `<Content id=…>` per section → submit dari
summary. Kode dokumen di-generate di awal dan tampil sebagai subtitle.
Setelah sukses: toast sukses → `router.push` ke list.

### 4.3 Detail + workflow
Header (kode, meta, `StatusBadge` solid, aksi) → banner kontekstual →
kolom 8 (`InfoItem`, item) / kolom 4 (Tindakan, `ApprovalPath`, Lampiran,
`DiscussionPanel`). Skeleton dengan bentuk yang sama.

### 4.4 Inbox approval
Satu `<Content>` per antrian dengan judul yang menjelaskan siapa harus
berbuat apa: "Menunggu Persetujuan Anda (Material Request)", "Menunggu
Validasi Anda (Purchase Order)". Tabel ringkas + tombol ke detail.
Antrian kosong tetap tampil dengan teks kosong (user yakin tidak ada tugas).

### 4.5 Dashboard
Lihat 3.11.

### 4.6 Master data (CRUD sederhana)
List page (4.1) + tombol "Tambah" → `Dialog` form (atau halaman `tambah/`
kalau field banyak) + hapus via `ConfirmDialog destructive`. Contoh di
ga-web: Vendor, Cost Center, Barang.

---

## 5. Format & copy

| Data                | Format                                          | Helper (`lib/utils.ts`)          |
| ------------------- | ----------------------------------------------- | -------------------------------- |
| Uang                | `Rp 1.500.000`                                  | `formatCurrency`, `CurrencyInput` |
| Tanggal (header, info) | `Kamis, 9 Oktober 2026`                      | `formatDateFriendly`, `formatDate` |
| Tanggal (chip filter) | `09 Okt 2026`                                 | `formatFilterDate`               |
| Tanggal + jam       | `9 Oktober 2026 14.30 WIB` (zona Asia/Jakarta)  | `formatDateWithTime`             |
| Relatif             | `5 menit yang lalu`                             | `formatRelativeTime`             |
| Umur dokumen        | `3 Hari 4 Jam`                                  | `formatAge`                      |
| Tanggal lokal (YYYY-MM-DD) | untuk input/filter                       | `getLocalDateString`             |
| Kode dokumen        | `font-mono`, boleh pecah baris (`[overflow-wrap:anywhere]`) | –                    |
| Gabung class        | –                                               | `cn`                             |

Locale selalu `id-ID`. Angka di tabel/badge memakai `tabular-nums`.

Kosakata yang konsisten: **Ajukan / Submit Ulang / Simpan / Batal / Hapus /
Setujui / Tolak / Lihat Detail / Riwayat Aktivitas / Lampiran / Diskusi /
Tindakan / Jalur Approval.** Status dokumen tetap dalam bahasa Inggris seperti
di database (Pending Approval, Approved, Rejected, …).

---

## 6. Utilitas & hook lain

| File                              | Isi                                                        |
| --------------------------------- | ---------------------------------------------------------- |
| `hooks/use-url-search-input.ts`   | lihat 3.4                                                  |
| `hooks/use-column-order.ts`       | `useColumnOrder(key, columns)` → `{ order, orderedColumns, moveColumn, resetOrder, isCustomOrder }` (3.4) |
| `hooks/use-go-back.ts`            | `useGoBack(fallbackHref)`: kembali ke halaman sebelumnya, atau ke fallback kalau tidak ada riwayat (3.6) |
| `hooks/use-mobile.ts`             | `useIsMobile()`                                            |
| `hooks/use-support-chat-badge.ts`, `hooks/use-update-web-badge.ts` | Angka badge Chat Admin / penanda Update Web baru, realtime & sinkron antar-instance (3.10) |
| `lib/sidebar/nav-config.ts`       | `buildNavGroups(profile)`: daftar menu per hak akses (2)   |
| `lib/view-transition.ts`          | `runViewTransition(update, { origin? })`, `originFromEvent(e)` (3.2a) |
| `lib/pwa.ts`                      | `isStandalone()` (3.16)                                    |
| `lib/utils.ts` → `randomUUID`     | UUID v4 yang jalan di luar secure context (3.16)           |
| `hooks/use-image-attachment-upload.ts` | Upload gambar untuk diskusi                           |
| `lib/excel-export.ts`             | `exportStyledExcel(data, fileName, sheet?)`, `fetchAllRows(buildQuery)` (melewati batas 1000 baris Supabase) |
| `lib/attachments.ts`              | `resolveAttachmentUrl`, `normalizeLinkUrl`, `formatFileSize`, `getAttachmentSizeError`, `getUploadErrorMessage`, batas ukuran |
| `lib/uploadDirect.ts`             | Upload via signed URL                                       |
| `lib/rich-content.ts`             | `parseRichValue`, `stringifyRichContent`, `extractPlainText` |
| `lib/debounce-async.ts`           | Debounce untuk fungsi async (pencarian combobox)           |
| `lib/safe-next-path.ts`           | Validasi `?next=` setelah login                            |
| `lib/avatar.ts`, `lib/avatar-cache.ts` | Inisial, event avatar berubah, cache URL                |
| `lib/emoji-confetti.ts`           | `fireEmojiConfetti(emoji)` (Update Web, opsional)          |

---

## 7. Larangan

| Jangan                                                          | Gantinya                                       |
| --------------------------------------------------------------- | ---------------------------------------------- |
| Simpan filter/search/page di `useState`                         | URL search params + `useUrlSearchInput`        |
| Komponen pagination / konfirmasi / filter baru                  | `CustomPagination`, `ConfirmDialog`, `FilterPanel` |
| `<Card>` langsung di level halaman                              | `<Content>`                                    |
| Spinner satu halaman penuh                                      | Skeleton berbentuk layout                      |
| Menyimpan preferensi tampilan ke database                       | `localStorage` (per perangkat), key ber-prefix sistem |
| `<a href>` untuk navigasi internal                              | `next/link`                                    |
| Fungsi `getStatusBadge` / map warna di tiap halaman             | `StatusBadge` + map di `lib/constants/status.ts` |
| Menulis ulang markup jalur approval / label–nilai per halaman   | `ApprovalPath`, `InfoItem`                     |
| Toast terpisah untuk loading dan hasil                          | `toast.loading` → `toast.success/error({ id })` |
| Hapus/reject tanpa konfirmasi                                   | `ConfirmDialog`                                |
| Aksi penting tanpa log                                          | `logActivity(...)`                             |
| Teks UI bahasa Inggris campur ("Continue", "Cancel")            | Bahasa Indonesia ("Lanjutkan", "Batal")        |
| Menulis daftar menu di sidebar dan di tempat lain terpisah      | `buildNavGroups` di `lib/sidebar/nav-config.ts` |
| Pencarian global dengan query per tabel dari browser            | Satu RPC (`global_search`) dengan batas akses yang sama dengan list |
| Tombol ikon top bar dari `Button` biasa                          | `TopbarIconButton`                             |
| `setTheme(v)` langsung                                          | `runViewTransition(() => setTheme(v))`         |
| `router.back()` di tombol "Kembali"                             | `useGoBack(fallbackHref)`                      |
| Aksi hover-only dengan `md:opacity-0 md:group-hover:…`           | `pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100` |
| `crypto.randomUUID()` langsung                                  | `randomUUID()` dari `lib/utils.ts`             |
| `URL.revokeObjectURL` langsung setelah klik unduh               | Tunda (`setTimeout`, 10 detik)                 |

---

## 8. Checklist fitur selesai

- [ ] Halaman memakai `<Content>` di grid 12 kolom, rapi di lebar 375px.
- [ ] List: search/filter/sort/page di URL; tombol Back browser bekerja.
- [ ] Ada skeleton saat loading, empty state, dan pesan error yang jelas.
- [ ] Form panjang memakai `FormSummaryLayout`; field wajib masuk checklist.
- [ ] Aksi async: tombol disabled + label "...ing", toast loading → hasil.
- [ ] Aksi destruktif lewat `ConfirmDialog`; aksi penting dicatat ke log.
- [ ] Status memakai `StatusBadge`; nama orang memakai `UserAvatar`.
- [ ] Diuji di light, soft-light, dark, soft-dark + 1 aksen non-default.
- [ ] Diuji dengan ukuran font "Sangat Besar" dan sidebar mode ikon.
- [ ] Menu baru ditambahkan ke `lib/sidebar/nav-config.ts` (otomatis ikut
      sidebar & global search) **dan** `MENU_KEYWORDS`.
- [ ] Jenis dokumen/data baru yang perlu dicari: ditambahkan ke RPC
      `global_search` + `KIND_META`/`DATA_GROUPS`, dan halaman list-nya
      membaca `?search=`. Aksi "Buat X" baru masuk `QUICK_ACTIONS` dengan
      aturan `visible` yang sama dengan tombolnya.
- [ ] List dengan banyak kolom: pertimbangkan `useColumnOrder`; kolom baru
      ditambahkan ke konstanta kolom **dan** `renderCell`.
- [ ] Aksi hover-only tetap terlihat di layar sentuh (`pointer-fine:`).
- [ ] Tombol "Kembali" memakai `useGoBack`.
- [ ] Bagian yang tidak perlu dicetak diberi `no-print`.

---

## 9. Komponen versi standar (kode siap pakai)

Di `ga-web` komponen-komponen ini masih tersebar, duplikat, atau terikat ke
satu modul. Sistem baru **membuat file ini** dari kode di bawah, bukan
menyalin versi lamanya.

### 9.1 `components/info-item.tsx`
Diekstrak dari `InfoItem` lokal di `material-request/[id]/page.tsx`.

```tsx
import { cn } from "@/lib/utils";

export function InfoItem({
  icon: Icon,
  label,
  value,
  isBlock = false,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  /** Label di atas nilai (untuk teks panjang), bukan berdampingan. */
  isBlock?: boolean;
}) {
  return (
    <div
      className={cn(
        isBlock ? "flex flex-col gap-1" : "grid grid-cols-3 items-start gap-x-2",
      )}
    >
      <div className="col-span-1 mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4 flex-shrink-0" />
        {label}
      </div>
      <div className="col-span-2 min-w-0 whitespace-pre-wrap text-sm font-semibold [overflow-wrap:anywhere]">
        {value || "-"}
      </div>
    </div>
  );
}
```

### 9.2 `components/approval-path.tsx`
Diekstrak dari kartu "Jalur Approval" di halaman detail MR & PO.

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import { cn, formatDateWithTime } from "@/lib/utils";

export type ApprovalStep = {
  userid: string;
  nama: string;
  department?: string | null;
  /** Mis. "Mengetahui", "Menyetujui". */
  type?: string | null;
  status: "pending" | "approved" | "rejected";
  processed_at?: string | null;
};

/** Index approver yang sedang giliran, atau -1 (selesai / ada yang menolak). */
export function getCurrentTurnIndex(approvals: ApprovalStep[]) {
  const i = approvals.findIndex((a) => a.status === "pending");
  if (i === -1) return -1;
  return approvals.slice(0, i).every((a) => a.status === "approved") ? i : -1;
}

const STATUS_VARIANT = {
  approved: "outline",
  rejected: "destructive",
  pending: "secondary",
} as const;

export function ApprovalPath({
  approvals,
  emptyText = "Jalur approval belum ditentukan.",
  renderTurnAction,
}: {
  approvals: ApprovalStep[];
  emptyText?: string;
  /** Aksi tambahan di baris approver yang sedang giliran (mis. Follow-up). */
  renderTurnAction?: (step: ApprovalStep, index: number) => React.ReactNode;
}) {
  if (approvals.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground">{emptyText}</p>
    );
  }

  const turnIndex = getCurrentTurnIndex(approvals);

  return (
    <ul className="space-y-2">
      {approvals.map((step, index) => {
        const isTurn = index === turnIndex;
        const action = isTurn ? renderTurnAction?.(step, index) : null;
        return (
          <li
            key={`${step.userid}-${index}`}
            className={cn(
              "flex flex-col gap-2 rounded-md p-3 transition-all",
              isTurn && "bg-primary/10 ring-2 ring-primary/50",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <UserAvatar
                userId={step.userid}
                name={step.nama}
                className="h-9 w-9"
                fallbackClassName="text-xs"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2 font-semibold">
                  <span className="break-words">{step.nama}</span>
                  {step.department && (
                    <Badge variant="outline">{step.department}</Badge>
                  )}
                </div>
                {step.type && (
                  <p className="text-sm text-muted-foreground">{step.type}</p>
                )}
                {step.status !== "pending" && step.processed_at && (
                  <p className="text-xs italic text-muted-foreground">
                    {formatDateWithTime(step.processed_at)}
                  </p>
                )}
              </div>
              <Badge
                variant={STATUS_VARIANT[step.status]}
                className="shrink-0 capitalize"
              >
                {step.status}
              </Badge>
            </div>
            {action && <div className="flex justify-end">{action}</div>}
          </li>
        );
      })}
    </ul>
  );
}
```

Kartu "Tindakan" memakai helper yang sama untuk menentukan apakah user yang
login sedang giliran:

```ts
const turn = getCurrentTurnIndex(doc.approvals);
const isMyTurn = turn !== -1 && doc.approvals[turn].userid === currentUser.id;
```

### 9.3 `components/step-chain.tsx`
`PcChainStepper` dengan tipe generik (tidak bergantung ke service petty cash).

```tsx
import { CheckIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepChainItem = {
  key: string;
  label: string;
  state: "done" | "current" | "rejected" | "pending";
  /** Teks kecil tebal di bawah label, mis. nominal atau nama PIC. */
  detail?: string;
};

const DOT_CLASS: Record<StepChainItem["state"], string> = {
  done: "bg-green-600 border-green-600 text-white dark:bg-green-500 dark:border-green-500",
  current: "bg-orange-500 border-orange-500 text-white",
  rejected: "bg-red-600 border-red-600 text-white dark:bg-red-500 dark:border-red-500",
  pending: "bg-muted border-muted-foreground/30 text-muted-foreground",
};

export function StepChain({ steps }: { steps: StepChainItem[] }) {
  return (
    <div className="flex items-start">
      {steps.map((step, idx) => (
        <div key={step.key} className="flex flex-1 items-start last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold",
                DOT_CLASS[step.state],
              )}
              title={step.label}
            >
              {step.state === "done" ? (
                <CheckIcon className="h-3.5 w-3.5" />
              ) : step.state === "rejected" ? (
                <XIcon className="h-3.5 w-3.5" />
              ) : (
                idx + 1
              )}
            </div>
            <span className="max-w-16 text-center text-[10px] leading-tight text-muted-foreground">
              {step.label}
              {step.detail && (
                <>
                  <br />
                  <span className="font-medium text-foreground">{step.detail}</span>
                </>
              )}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div
              className={cn(
                "mt-3 h-0.5 flex-1",
                step.state === "done"
                  ? "bg-green-600 dark:bg-green-500"
                  : "bg-muted-foreground/20",
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
```

### 9.4 `components/confirm-dialog.tsx`
Menggantikan **dua** komponen di ga-web: `confirm-dialog.tsx` (default teks
masih Inggris, hanya mode trigger) dan `dialog-confirm.tsx` /
`MyAlertDialog` (hanya mode controlled). Versi ini mendukung keduanya,
default bahasa Indonesia, varian destruktif, dan `onConfirm` async.

```tsx
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

type ConfirmDialogProps = {
  title?: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** Tombol konfirmasi merah (hapus, tolak). */
  destructive?: boolean;
  /** Boleh async: dialog menunggu selesai, tetap terbuka kalau throw. */
  onConfirm: () => void | Promise<void>;
  /** Elemen pemicu (mode trigger). Kosongkan kalau pakai `open`. */
  children?: React.ReactNode;
  /** Mode controlled. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function ConfirmDialog({
  title = "Apakah Anda yakin?",
  description = "Tindakan ini tidak bisa dibatalkan.",
  confirmText = "Ya, lanjutkan",
  cancelText = "Batal",
  destructive = false,
  onConfirm,
  children,
  open: openProp,
  onOpenChange,
}: ConfirmDialogProps) {
  const [innerOpen, setInnerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const open = openProp ?? innerOpen;

  const setOpen = (next: boolean) => {
    if (openProp === undefined) setInnerOpen(next);
    onOpenChange?.(next);
  };

  const handleConfirm = async (e: React.MouseEvent) => {
    // Tahan dialog tetap terbuka sampai onConfirm selesai.
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !loading && setOpen(next)}>
      {children && <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className={destructive ? buttonVariants({ variant: "destructive" }) : undefined}
          >
            {loading && <Loader2 className="animate-spin" />}
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### 9.5 `lib/constants/status.ts` + `components/status-badge.tsx`
Di ga-web warna status tersebar: map lembut di `type/enum.ts`, badge solid
ditulis inline lewat `getStatusBadge` di halaman detail MR/PO, dan salinan
map solid di halaman Dokumentasi. Sistem baru memakai **satu file konstanta**
dengan dua tone:

| Tone    | Dipakai untuk                                                 |
| ------- | ------------------------------------------------------------- |
| `solid` | Status **dokumen** di header halaman detail (paling menonjol) |
| `soft`  | Semua tempat lain: kolom tabel, status item, chip, riwayat    |

Arti warna mengikuti `styling-guide.md` bagian 6 (abu = pending, biru =
proses, kuning/amber = menunggu/sebagian, oranye = perlu tindak lanjut,
hijau = approved, emerald = selesai, merah = ditolak).

```ts
// lib/constants/status.ts
const SOLID = "border-transparent text-white";

export const SOFT = {
  gray: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700",
  blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
  sky: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-800",
  amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800",
  orange: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800",
  green: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800",
  emerald: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800",
  red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
} as const;

export const SOLID_TONE = {
  gray: "border-transparent bg-secondary text-secondary-foreground",
  blue: `${SOLID} bg-blue-500`,
  sky: `${SOLID} bg-cyan-500`,
  amber: `${SOLID} bg-amber-600`,
  orange: `${SOLID} bg-orange-500`,
  green: `${SOLID} bg-green-500`,
  emerald: `${SOLID} bg-emerald-600`,
  red: "border-transparent bg-destructive text-white",
} as const;

export type StatusColor = keyof typeof SOFT;

/** Satu-satunya tempat status → warna. Isi sesuai status sistem baru. */
export const STATUS_COLOR: Record<string, StatusColor> = {
  Draft: "gray",
  "Pending Validation": "gray",
  "Pending Approval": "gray",
  "On Process": "sky",
  "Waiting PO": "blue",
  "On Hold": "orange",
  "Partial Receive": "amber",
  Approved: "green",
  "Full Received": "green",
  Completed: "emerald",
  Rejected: "red",
};
```

```tsx
// components/status-badge.tsx
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SOFT, SOLID_TONE, STATUS_COLOR } from "@/lib/constants/status";

export function StatusBadge({
  status,
  label,
  tone = "soft",
  className,
}: {
  status: string;
  /** Teks tampilan kalau beda dari nilai status di DB. */
  label?: string;
  tone?: "soft" | "solid";
  className?: string;
}) {
  const color = STATUS_COLOR[status] ?? "gray";
  return (
    <Badge
      variant="outline"
      className={cn(tone === "solid" ? SOLID_TONE[color] : SOFT[color], className)}
    >
      {label ?? status ?? "N/A"}
    </Badge>
  );
}
```

```tsx
<StatusBadge status={doc.status} tone="solid" />   {/* header detail */}
<StatusBadge status={row.status} />                {/* kolom tabel */}
```

Badge approval per orang (`approved` / `rejected` / `pending`) tetap memakai
varian bawaan `Badge` seperti di `ApprovalPath`, karena itu status langkah,
bukan status dokumen.

---

## Lampiran A. Peta file

| Area                 | Copy dari ga-web                                                                           | Copy lalu adaptasi                                              | Buat baru (bagian 9) | Jangan dibawa |
| -------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | -------------------- | ------------- |
| Fondasi              | `components/ui/*`, `lib/utils.ts`, `lib/theme-provider.tsx`, `lib/fonts.ts`, `lib/font-options.ts`, `app/globals.css`, `components.json` | key localStorage di `theme-provider` & `font-options` (prefix) | – | – |
| Shell                | `nav-main`, `sidebar-search`, `navigation-progress`, `lib/sidebar/nav-pending.ts`          | `app-sidebar` (badge), `lib/sidebar/nav-config.ts` (menu & role), `nav-user` (Link + `ConfirmDialog`), `lib/sidebar/menu-search.ts` (keyword), `lib/sidebar/menu-visibility.ts` (prefix key) | – | – |
| Top bar              | `topbar/topbar-icon-button`, `topbar/topbar-appearance`, `lib/view-transition.ts`, blok "View transitions" di `globals.css` | `topbar/topbar.tsx` (urutan aksi, kolom profil), `topbar/topbar-profile` (`MyAlertDialog` → `ConfirmDialog`), `topbar/topbar-inbox` + `use-inbox.ts` (sumber notif) | – | – |
| Global search        | `topbar/topbar-search.tsx`, `topbar/use-global-search.ts`                                  | `topbar/search-sections.ts` (`KIND_META`, `DATA_GROUPS`, `QUICK_ACTIONS`, placeholder), RPC `supabase/migrations/0008_global_search.sql` (tabel, kolom, batas akses), key riwayat (prefix) | – | – |
| Shell *(opsional)*   | –                                                                                          | `team-switcher` + `lib/constants/web-apps.ts`                    | – | – |
| Layout               | `content`                                                                                  | –                                                               | `info-item`          | – |
| List                 | `filter-panel`, `sortable-table-head`, `reorderable-table-head`, `custom-pagination`, `hooks/use-url-search-input.ts`, `hooks/use-column-order.ts`, `lib/excel-export.ts` | key `table-column-order:` (prefix) | – | `pagination.tsx`, `pagination-components.tsx` |
| Form                 | `form-summary-panel`, `combobox`, `date-picker`, `link-attachment-form`, `lib/attachments.ts`, `lib/uploadDirect.ts`, `lib/debounce-async.ts` | checklist per form (pola `lib/mrEditSummaryChecks.ts`), key localStorage panel ringkasan | – | – |
| Detail & workflow    | `activity-log-dialog`, `services/logService.ts`, `hooks/use-go-back.ts`                    | `followup-approval-button` *(opsional)*, `PcRevisionHistory` *(opsional)* | `approval-path`, `step-chain` | `petty-cash/PcChainStepper.tsx` |
| Status               | –                                                                                          | –                                                               | `lib/constants/status.ts`, `status-badge` | `getStatusBadge` inline di halaman |
| Konfirmasi           | –                                                                                          | –                                                               | `confirm-dialog`     | `confirm-dialog.tsx` lama, `dialog-confirm.tsx` |
| Diskusi              | `discussion-panel`, `discussion-message-bubble`, `discussion-attachment-view`, `message-attachment-toolbar`, `emoji-sticker-picker`, `rich-content-view`, `note-with-links`, `message-with-mentions`, `lib/discussion-reply.ts`, `lib/rich-content.ts`, `hooks/use-image-attachment-upload.ts` | `rich-mention-editor`, `components/tiptap/*`, `services/mentionSearchService.ts` (jenis mention) | – | – |
| User                 | `user-avatar`, `user-profile-card`, `avatar-viewer-dialog`, `profile-avatar-dialog`, `image-crop-dialog`, `lib/avatar.ts`, `lib/avatar-cache.ts` | – | – | – |
| Notifikasi           | `providers/NotificationProvider`, `notification-settings`                                  | `lib/notifications/client.ts` (event), halaman notifikasi (kategori), `lib/notifications/settings.ts` (prefix key) | – | – |
| Notifikasi *(opsional)* | `lib/notifications/sound.ts`, `custom-ringtone-settings`, `lib/notifications/custom-sound-db.ts`, `lib/notifications/push.ts`, `lib/pwa/use-install-prompt.ts` | `app/api/push/send/route.ts` | – | – |
| PWA *(opsional)*     | `components/pwa/*`, `lib/pwa.ts`                                                           | `public/sw.js` (nama app, `CACHE_VERSION`), `public/offline.html` (teks & warna), `public/manifest.json` + ikon maskable, `metadata.appleWebApp` & `viewport.themeColor` di `app/layout.tsx` | – | – |
| Chat Admin *(opsional)* | `components/support-chat/*`, `hooks/use-support-chat-badge.ts`                          | `app/(With Sidebar)/chat-admin*/`, `services/supportChatService.ts`, `supabase/migrations/0007_chat_admin.sql`, `topbar/topbar-chat-admin`, `auth/chat-admin-info-dialog` (siapa yang dihubungi) | – | – |
| Dashboard            | `dashboard/clickable-stat-card`                                                            | `dashboard-profile-avatar`, pola `PcActionNeededList` & `PcActivityFeed` | – | `chart-1`, `chart-2`, `dashboard-header` |
| Dashboard *(opsional)* | –                                                                                        | `dashboard/score-stat-card`                                     | – | – |
| Kustomisasi          | `theme-switcher`, `accent-theme-switcher`, `font-switcher`                                 | –                                                               | – | – |
| Auth                 | `auth/auth-input`                                                                          | `auth/auth-shell` (headline, slide), `app/pending-approval`      | – | `sign-up-form`, `auth-button`, `logout-button` |
| Modul opsional       | –                                                                                          | Update Web (`update.md`), Feedback, Dokumentasi, Tentang App, verifikasi publik + cetak, `CameraCaptureDialog` + `lib/photoStamp.ts`, template approval | – | – |
| Sisa template starter | –                                                                                         | –                                                               | – | `app/protected/*`, `components/tutorial/*`, `hero`, `deploy-button`, `env-var-warning`, `next-logo`, `supabase-logo`, landing `app/page.tsx` + `menu-open` + `toggle-menu` |
| Domain procurement   | –                                                                                          | –                                                               | – | `asset-goods-badge`, `item-level-badge`, `item-vendor-history-popover`, `pic-popover`, `pic-ga-popover`, `pic-po-popover`, `bank-account-form-dialog`, `approver-search-add`, `components/petty-cash/*` (selain yang diadaptasi di atas), `lib/poAssetMarker.ts`, `lib/pcApprovalFlow.ts`, `lib/companyDetails.ts`, `lib/mrEditSummaryChecks.ts` (hanya contoh pola) |

## Lampiran B. Ringkasan keputusan (21 Okt 2026)

- **Inti:** app shell, pencarian & "Atur" menu, feedback navigasi, NavUser,
  `Content`, pola list lengkap (URL state, filter, sort, paginasi, limit,
  export Excel, quick view), `FormSummaryLayout`, input standar, lampiran,
  struktur detail, Riwayat Aktivitas, diskusi + rich editor + mention +
  emoji, avatar & crop foto, notifikasi realtime, dashboard (perlu aksi,
  stat card), kustomisasi tampilan, profil, halaman auth.
- **Opsional:** app switcher, cetak list, template/riwayat picker,
  follow-up approval, riwayat revisi, suara/ringtone/push/PWA, skor A–E,
  Update Web, Feedback, Dokumentasi interaktif, Tentang App, verifikasi
  publik + cetak QR, kamera + cap foto, builder template approval.
- **Versi standar (bagian 9):** `InfoItem`, `ApprovalPath`, `StepChain`,
  `ConfirmDialog` (gabungan dua komponen lama), `StatusBadge` + satu map
  status; `CustomPagination` jadi satu-satunya paginasi.
- **Tidak dibawa:** sisa template starter Supabase, landing page, komponen
  khusus domain procurement.
- Kode `ga-web` sendiri tidak diubah oleh keputusan ini.

**Tambahan 22 Okt 2026** (top bar, kolom tabel, PWA):

- **Inti:** top bar (header sticky, `TopbarIconButton`, Inbox, Tampilan,
  menu profil), global search ⌘K beserta RPC-nya, `nav-config` sebagai satu
  sumber menu, header tabel yang bisa digeser (`useColumnOrder`) untuk list
  utama, pilih banyak di halaman Notifikasi, animasi ganti tampilan
  (`runViewTransition`), `useGoBack`, aturan layar sentuh (`pointer-fine:`),
  `randomUUID`, dialog yang bisa di-scroll.
- **Opsional:** PWA (service worker, offline, theme-color, link
  standalone), modul Chat Admin beserta shortcut-nya di top bar.
- Logout di top bar & global search memakai `ConfirmDialog` (9.4), bukan
  `MyAlertDialog` seperti di ga-web.
