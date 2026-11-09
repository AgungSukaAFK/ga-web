// src/app/(With Sidebar)/tentang-app/page.tsx
//
// Halaman "Tentang App". Versi aplikasi TIDAK di-hardcode - selalu mengikuti
// postingan terbaru di Update Web (urutan sama dgn halaman /update-web, yaitu
// created_at desc), jadi begitu admin posting update baru, versi di sini ikut
// berubah otomatis. Riwayat rilis singkat juga diambil dari sumber yang sama.

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchUpdateWebPosts } from "@/services/updateWebService";
import { UpdateWebPost } from "@/type/update-web";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BaggageClaim,
  Bell,
  BookOpen,
  Boxes,
  Building2,
  Calculator,
  CheckCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Eye,
  FileBox,
  FileSignature,
  Gauge,
  Headset,
  History,
  Megaphone,
  MessageSquareShare,
  Package,
  PackageCheck,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  UserCog,
  UserPen,
  Users,
  Wallet,
  Workflow,
  XCircle,
  type LucideIcon,
} from "lucide-react";

const NAMA_APLIKASI = "GMI Procure System";
const NAMA_PERUSAHAAN = "PT. Garuda Mart Indonesia / Global Inti Sejati";
const JUMLAH_RIWAYAT = 5;

const formatTanggal = (iso: string) =>
  format(new Date(iso), "d MMMM yyyy", { locale: localeId });

const STATS = [
  { icon: Workflow, value: "5", label: "Tahap Alur Pengadaan" },
  { icon: Gauge, value: "Real-time", label: "Lacak Status MR & PO" },
  { icon: ShieldCheck, value: "Berjenjang", label: "Approval Terstruktur" },
  { icon: Boxes, value: "1", label: "Sumber Data Terpusat" },
];

// Ukuran width/height = ukuran asli file, supaya aspek rasio logo terjaga.
const GRUP_PERUSAHAAN = [
  {
    nama: "Lourdes Auto Parts",
    desc: "Brand suku cadang otomotif yang menjadi wajah operasional sehari-hari, didukung oleh GMI dan GIS.",
    logo: "/lourdes-logo.webp",
    width: 1024,
    height: 392,
  },
  {
    nama: "PT. Garuda Mart Indonesia",
    desc: "GMI - entitas perusahaan yang pengadaan dan petty cash-nya dikelola melalui sistem ini.",
    logo: "/gmi-logo.webp",
    width: 150,
    height: 150,
  },
  {
    nama: "Global Inti Sejati",
    desc: "GIS - entitas perusahaan yang pengadaan dan petty cash-nya dikelola melalui sistem ini.",
    logo: "/gis-logo.webp",
    width: 1464,
    height: 1667,
  },
];

const MODUL: {
  icon: LucideIcon;
  title: string;
  desc: string;
  fitur: string[];
}[] = [
  {
    icon: FileBox,
    title: "Material Request",
    desc: "Pengajuan kebutuhan barang dari setiap departemen dengan format standar.",
    fitur: [
      "Template MR siap pakai",
      "Estimasi harga per item & lampiran",
      "Lacak posisi MR kapan saja",
      "Konfirmasi terima barang oleh requester",
    ],
  },
  {
    icon: BaggageClaim,
    title: "Purchase Order",
    desc: "Konversi MR yang sudah disetujui menjadi PO resmi ke vendor.",
    fitur: [
      "Referensi langsung dari MR",
      "Opsi pengiriman ke KM 10 / site",
      "Quick edit data vendor",
      "Cetak dokumen PO",
    ],
  },
  {
    icon: CheckCheck,
    title: "Approval & Validasi",
    desc: "Persetujuan berjenjang yang berurutan, tercatat, dan bisa diaudit.",
    fitur: [
      "Template approval MR, PO & Petty Cash",
      "Validasi Cost Center oleh GA",
      "Notifikasi ke approver berikutnya",
      "Keterangan approval oleh admin",
    ],
  },
  {
    icon: Wallet,
    title: "Petty Cash",
    desc: "Pengajuan dana operasional kecil hingga deklarasi pertanggungjawaban.",
    fitur: [
      "Pengajuan & template pribadi",
      "Manajemen budget per periode",
      "Approval Petty Cash berjenjang",
      "Deklarasi & unduh Excel",
    ],
  },
  {
    icon: Boxes,
    title: "Master Data & Stok",
    desc: "Satu katalog barang dan vendor yang dipakai bersama seluruh departemen.",
    fitur: [
      "Katalog barang & vendor",
      "Request barang baru ke Purchasing",
      "Stok GA",
      "Manajemen Cost Center",
    ],
  },
  {
    icon: Bell,
    title: "Komunikasi & Bantuan",
    desc: "Semua informasi penting sampai ke orang yang tepat, tanpa perlu bertanya manual.",
    fitur: [
      "Notifikasi & diskusi di dokumen",
      "Announcer follow-up (suara)",
      "Chat Admin & Feedback",
      "Update Web & Dokumentasi",
    ],
  },
];

const PERAN: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: UserPen,
    title: "Requester",
    desc: "Membuat MR & pengajuan Petty Cash, memantau progresnya, lalu mengonfirmasi barang yang diterima.",
  },
  {
    icon: ClipboardCheck,
    title: "General Affair",
    desc: "Memvalidasi MR, menentukan Cost Center, mengatur template approval, dan mengelola Stok GA.",
  },
  {
    icon: BadgeCheck,
    title: "Approver",
    desc: "Meninjau dan menyetujui MR, PO, atau Petty Cash sesuai urutan jalur approval.",
  },
  {
    icon: ShoppingCart,
    title: "Purchasing",
    desc: "Membuat PO dari MR yang disetujui, mengelola vendor, dan menindaklanjuti permintaan barang baru.",
  },
  {
    icon: Calculator,
    title: "Finance",
    desc: "Memantau transaksi Petty Cash dan mengunduh laporan untuk keperluan rekonsiliasi.",
  },
  {
    icon: UserCog,
    title: "Admin",
    desc: "Mengelola user, dokumen, file, pengaturan sistem, serta merilis pengumuman di Update Web.",
  },
];

const MASALAH = [
  {
    icon: Eye,
    title: "Kurang Transparan",
    desc: 'Requester sulit melacak status permintaan. Pertanyaan "MR saya sudah sampai mana?" menjadi sangat umum dan memakan waktu.',
  },
  {
    icon: Clock,
    title: "Lambat & Rawan Kesalahan",
    desc: "Persetujuan berjenjang berjalan lambat, rentan human error (dokumen hilang, salah ketik), dan sulit diaudit.",
  },
  {
    icon: AlertTriangle,
    title: "Tidak Terstandar",
    desc: "Tiap departemen atau lokasi punya cara berbeda, menyulitkan proses validasi dan audit.",
  },
];

const SOLUSI = [
  {
    icon: Workflow,
    title: "Alur Kerja Terstruktur",
    desc: "Seluruh proses pengadaan diformalkan ke dalam lima tahap yang jelas, dari pengajuan MR hingga konfirmasi penerimaan barang.",
  },
  {
    icon: Eye,
    title: "Transparansi Penuh",
    desc: "Setiap pengguna punya dashboard tugas, dan requester bisa melacak progres MR maupun PO kapan saja.",
  },
  {
    icon: ShieldCheck,
    title: "Akuntabilitas yang Jelas",
    desc: "Setiap langkah tercatat: jalur approval, siapa yang menyetujui dan kapan, hingga riwayat perubahan dokumen.",
  },
  {
    icon: Boxes,
    title: "Sentralisasi Data",
    desc: "Item, lampiran, template approval, dan bukti penerimaan tersimpan di satu tempat, memudahkan pelacakan dan audit.",
  },
];

const TAHAPAN = [
  {
    icon: FileSignature,
    title: "Pengajuan MR",
    desc: "Requester membuat Material Request dengan data terstandar, termasuk estimasi harga tiap item.",
  },
  {
    icon: ClipboardCheck,
    title: "Validasi GA",
    desc: "General Affair menentukan Cost Center dan menerapkan template approval yang sesuai.",
  },
  {
    icon: CheckCheck,
    title: "Approval Berjenjang",
    desc: "MR/PO dikirim berurutan ke setiap approver, dengan notifikasi agar tidak ada penundaan.",
  },
  {
    icon: Package,
    title: "Pembuatan PO",
    desc: 'Purchasing mengonversi MR berstatus "Waiting PO" menjadi PO resmi menggunakan master data barang.',
  },
  {
    icon: PackageCheck,
    title: "Penerimaan Barang",
    desc: "Requester mengonfirmasi penerimaan dan bukti, yang otomatis menyelesaikan MR dan PO terkait.",
  },
];

const BANTUAN = [
  {
    icon: BookOpen,
    title: "Dokumentasi",
    desc: "Panduan langkah demi langkah tiap fitur.",
    href: "/dokumentasi",
  },
  {
    icon: Megaphone,
    title: "Update Web",
    desc: "Catatan rilis & pengumuman terbaru.",
    href: "/update-web",
  },
  {
    icon: Headset,
    title: "Chat Admin",
    desc: "Tanya langsung ke tim admin.",
    href: "/chat-admin",
  },
  {
    icon: MessageSquareShare,
    title: "Feedback",
    desc: "Kirim saran atau laporkan kendala.",
    href: "/feedback",
  },
];

function SectionHeading({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        {title}
      </h2>
      {desc && (
        <p className="mt-3 leading-relaxed text-muted-foreground">{desc}</p>
      )}
    </div>
  );
}

function useRiwayatRilis() {
  const [posts, setPosts] = useState<UpdateWebPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let aktif = true;
    fetchUpdateWebPosts()
      .then((data) => aktif && setPosts(data))
      .catch(() => aktif && setPosts([]))
      .finally(() => aktif && setLoading(false));
    return () => {
      aktif = false;
    };
  }, []);

  return { posts, loading, latest: posts[0] ?? null };
}

export default function TentangAppPage() {
  const { posts, loading, latest } = useRiwayatRilis();
  const labelVersi = latest ? `Versi ${latest.version}` : null;
  const riwayat = posts.slice(0, JUMLAH_RIWAYAT);

  return (
    <div className="col-span-12 flex flex-col gap-16 pb-4 xl:col-span-10 xl:col-start-2">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-primary px-6 py-10 text-primary-foreground shadow-lg sm:px-10 sm:py-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:32px_32px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary-foreground/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-primary-foreground/10 blur-3xl"
        />

        <div className="relative grid items-center gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-5 text-center lg:text-left">
            <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
              {loading ? (
                <Skeleton className="h-[22px] w-24 rounded-md bg-primary-foreground/20" />
              ) : (
                labelVersi && (
                  <Link href="/update-web">
                    <Badge className="gap-1 border-primary-foreground/20 bg-primary-foreground text-primary hover:bg-primary-foreground/90">
                      <Sparkles className="h-3 w-3" />
                      {labelVersi}
                    </Badge>
                  </Link>
                )
              )}
              <Badge className="border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/15">
                Procurement
              </Badge>
              <Badge className="border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/15">
                Petty Cash
              </Badge>
            </div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
              Pengadaan barang yang{" "}
              <span className="text-primary-foreground/75">
                terstruktur, transparan, dan akuntabel.
              </span>
            </h1>
            <p className="mx-auto max-w-xl text-base leading-relaxed text-primary-foreground/80 sm:text-lg lg:mx-0">
              <span className="font-semibold text-primary-foreground">
                {NAMA_APLIKASI}
              </span>{" "}
              adalah solusi digital terpusat untuk alur kerja Material Request,
              Purchase Order, hingga Petty Cash di {NAMA_PERUSAHAAN}.
            </p>
          </div>

          <div className="mx-auto w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-primary-foreground/20 sm:p-8">
            <Image
              src="/lourdes-logo.webp"
              alt="Logo Lourdes Auto Parts"
              width={1024}
              height={392}
              className="pointer-events-none h-auto w-full"
              priority
            />
          </div>
        </div>

        <div className="relative mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATS.map(({ icon: Icon, value, label }) => (
            <div
              key={label}
              className="rounded-xl border border-primary-foreground/10 bg-primary-foreground/5 p-4 backdrop-blur-sm"
            >
              <Icon className="h-5 w-5 text-primary-foreground/80" />
              <p className="mt-3 text-lg font-bold sm:text-xl">{value}</p>
              <p className="text-xs text-primary-foreground/70 sm:text-sm">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Versi terbaru & riwayat rilis */}
      <section className="space-y-8">
        <SectionHeading
          eyebrow="Rilis"
          title="Apa yang baru"
          desc="Versi aplikasi mengikuti catatan rilis di Update Web, sehingga selalu sesuai dengan pembaruan terakhir."
        />
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* Kartu versi terbaru */}
          <div className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
            {loading ? (
              <div className="space-y-4 p-6">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-7 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : latest ? (
              <>
                {latest.thumbnail_url && (
                  <div className="relative aspect-[21/9] w-full overflow-hidden border-b bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={latest.thumbnail_url}
                      alt={latest.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-4 p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="gap-1">
                      <Sparkles className="h-3 w-3" />
                      Terbaru · v{latest.version}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Dirilis {formatTanggal(latest.created_at)}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold tracking-tight">
                    {latest.title}
                  </h3>
                  {latest.highlights?.length > 0 && (
                    <ul className="space-y-2">
                      {latest.highlights.slice(0, 5).map((h, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                          <span className="leading-relaxed text-muted-foreground">
                            {h}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link
                    href={`/update-web?post=${latest.id}`}
                    className="group mt-auto inline-flex items-center gap-1 pt-2 text-sm font-semibold text-primary"
                  >
                    Baca catatan rilis lengkap
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center text-muted-foreground">
                <Megaphone className="h-8 w-8" />
                <p className="text-sm">Belum ada catatan rilis.</p>
              </div>
            )}
          </div>

          {/* Riwayat rilis */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <p className="font-semibold">Riwayat Rilis</p>
            </div>
            {loading ? (
              <div className="mt-5 space-y-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            ) : riwayat.length === 0 ? (
              <p className="mt-5 text-sm text-muted-foreground">
                Belum ada riwayat.
              </p>
            ) : (
              <ol className="relative mt-5 space-y-5 border-l pl-5">
                {riwayat.map((post, i) => (
                  <li key={post.id} className="relative">
                    <span
                      aria-hidden
                      className={`absolute -left-[26px] top-1 h-3 w-3 rounded-full ring-4 ring-card ${
                        i === 0 ? "bg-primary" : "bg-muted-foreground/40"
                      }`}
                    />
                    <Link
                      href={`/update-web?post=${post.id}`}
                      className="group block"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-xs font-semibold text-primary">
                          v{post.version}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTanggal(post.created_at)}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-sm font-medium group-hover:text-primary">
                        {post.title}
                      </p>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
            {posts.length > JUMLAH_RIWAYAT && (
              <Link
                href="/update-web"
                className="group mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary"
              >
                Lihat semua ({posts.length})
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Modul */}
      <section className="space-y-8">
        <SectionHeading
          eyebrow="Fitur"
          title="Semua kebutuhan pengadaan dalam satu aplikasi"
          desc="Enam modul utama yang saling terhubung, dari pengajuan hingga laporan."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODUL.map(({ icon: Icon, title, desc, fitur }) => (
            <div
              key={title}
              className="group flex flex-col rounded-xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-4 font-semibold">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {desc}
              </p>
              <ul className="mt-4 space-y-1.5 border-t pt-4">
                {fitur.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary/70" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Alur kerja */}
      <section className="space-y-8">
        <SectionHeading
          eyebrow="Cara Kerja"
          title="5 Tahap Alur Pengadaan"
          desc="Setiap MR bergerak melalui tahapan yang sama, sehingga semua pihak tahu posisi dan tanggung jawabnya."
        />
        <ol className="relative grid gap-4 lg:grid-cols-5">
          <div
            aria-hidden
            className="absolute left-[10%] right-[10%] top-6 hidden h-px bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0 lg:block"
          />
          {TAHAPAN.map(({ icon: Icon, title, desc }, i) => (
            <li
              key={title}
              className="relative flex gap-4 rounded-xl border bg-card p-5 shadow-sm lg:flex-col lg:items-center lg:border-0 lg:bg-transparent lg:p-0 lg:text-center lg:shadow-none"
            >
              <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-4 ring-background">
                <Icon className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background text-[10px] font-bold text-primary ring-1 ring-border">
                  {i + 1}
                </span>
              </div>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {desc}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Peran pengguna */}
      <section className="space-y-8">
        <SectionHeading
          eyebrow="Pengguna"
          title="Setiap peran punya tugas yang jelas"
          desc="Menu dan akses menyesuaikan peran serta departemen, sehingga tiap orang hanya melihat yang relevan untuknya."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PERAN.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="flex gap-4 rounded-xl border bg-card p-5 shadow-sm"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Masalah vs solusi */}
      <section className="space-y-8">
        <SectionHeading
          eyebrow="Latar Belakang"
          title="Dari proses manual ke satu sistem terpadu"
          desc="Sebelumnya, pengadaan barang bergantung pada formulir kertas, spreadsheet, dan email yang terfragmentasi."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-6 dark:border-rose-900/50 dark:bg-rose-950/20">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
              <XCircle className="h-5 w-5" />
              <p className="font-semibold">Sebelum</p>
            </div>
            <ul className="mt-5 space-y-5">
              {MASALAH.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {desc}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-6">
            <div className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="h-5 w-5" />
              <p className="font-semibold">Sesudah, dengan {NAMA_APLIKASI}</p>
            </div>
            <ul className="mt-5 space-y-5">
              {SOLUSI.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {desc}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Grup perusahaan */}
      <section className="space-y-8">
        <SectionHeading
          eyebrow="Grup Perusahaan"
          title="Dikembangkan untuk Lourdes, GMI & GIS"
          desc="Satu sistem yang digunakan bersama oleh seluruh entitas grup, dengan alur dan standar yang sama."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {GRUP_PERUSAHAAN.map(({ nama, desc, logo, width, height }) => (
            <div
              key={nama}
              className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
            >
              {/* Latar putih tetap putih di dark mode agar logo terbaca */}
              <div className="flex h-36 items-center justify-center border-b bg-white p-6">
                <Image
                  src={logo}
                  alt={`Logo ${nama}`}
                  width={width}
                  height={height}
                  className="h-full w-auto max-w-full object-contain transition-transform group-hover:scale-105"
                />
              </div>
              <div className="flex-1 p-5">
                <p className="font-semibold">{nama}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bantuan */}
      <section className="relative overflow-hidden rounded-2xl bg-primary px-6 py-10 text-primary-foreground shadow-lg sm:px-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-primary-foreground/10 blur-2xl"
        />
        <div className="relative space-y-8">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Satu sistem, satu alur, satu sumber data.
            </h2>
            <p className="text-primary-foreground/90">
              Butuh bantuan atau punya ide untuk {NAMA_APLIKASI}? Kami siap
              membantu.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {BANTUAN.map(({ icon: Icon, title, desc, href }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center gap-3 rounded-xl border border-primary-foreground/15 bg-primary-foreground/5 p-4 transition-colors hover:bg-primary-foreground/15"
              >
                <Icon className="h-5 w-5 flex-shrink-0 text-primary-foreground/80" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-primary-foreground/70">{desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 flex-shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <div className="flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" />
          Dikembangkan untuk {NAMA_PERUSAHAAN}
        </p>
        <p className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {NAMA_APLIKASI}
          {labelVersi && <> · {labelVersi}</>}
          {latest && <> · Diperbarui {formatTanggal(latest.created_at)}</>}
        </p>
      </div>
    </div>
  );
}
