import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileSignature,
  FileSpreadsheet,
  FileText,
  Globe,
  Headset,
  History,
  Landmark,
  MessageSquareText,
  MoonStar,
  Package,
  PackageCheck,
  Search,
  Send,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Wallet,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { LandingMobileNav } from "@/components/landing/mobile-nav";
import {
  BrowserFrame,
  PhoneFrame,
  ThemedScreenshot,
} from "@/components/landing/screenshot";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { name: "Fitur", href: "#fitur" },
  { name: "Alur Kerja", href: "#alur" },
  { name: "Akses Mobile", href: "#akses" },
  { name: "Pembaruan", href: "#pembaruan" },
];

// Ukuran width/height = ukuran asli file, supaya aspek rasio logo terjaga.
// Lourdes = brand induk, GMI & GIS entitas yang dokumennya dikelola di sini.
const COMPANIES = [
  {
    name: "Lourdes Auto Parts",
    logo: "/lourdes-logo.webp",
    width: 1024,
    height: 392,
    className: "h-12 sm:h-14",
  },
  {
    name: "PT. Garuda Mart Indonesia",
    logo: "/gmi-landscape.webp",
    width: 1080,
    height: 130,
    className: "h-auto w-full max-w-[230px]",
  },
  {
    name: "PT. Global Inti Sejati",
    logo: "/gis-landscape.webp",
    width: 1080,
    height: 261,
    className: "h-auto w-full max-w-[200px]",
  },
];

const HIGHLIGHTS = [
  {
    icon: Globe,
    value: "24/7",
    label: "Akses online",
    desc: "Buka dari kantor, site, atau HP kapan saja.",
  },
  {
    icon: ShieldCheck,
    value: "Berjenjang",
    label: "Approval multi-level",
    desc: "Menyetujui, Mengetahui, hingga Payment Validator.",
  },
  {
    icon: BellRing,
    value: "Real-time",
    label: "Notifikasi & tracking",
    desc: "Push notification ke HP, walau browser ditutup.",
  },
  {
    icon: Building2,
    value: "1 sistem",
    label: "MR · PO · Petty Cash",
    desc: "Satu sumber data untuk Lourdes, GMI, dan GIS.",
  },
];

type Feature = {
  icon: React.ElementType;
  eyebrow: string;
  title: string;
  desc: string;
  points: string[];
  shot: { name: string; alt: string; zoom?: { scale: number; origin: string } };
};

const FEATURES: Feature[] = [
  {
    icon: FileText,
    eyebrow: "Material Request",
    title: "Ajukan kebutuhan barang dalam hitungan menit",
    desc: "Form MR terstandar lengkap dengan prioritas, due date, dan Cost Center. Requester bisa memantau posisi MR-nya kapan saja tanpa perlu bertanya.",
    points: [
      "Template MR & prioritas P0–P4 dengan target tanggal",
      "Sisa budget Cost Center terlihat langsung saat pengajuan",
      "Jalur approval transparan, lengkap dengan tombol Follow-up",
      "Diskusi dengan mention, lampiran file maupun link",
    ],
    shot: {
      name: "mr-detail",
      alt: "Detail Material Request dengan jalur approval berjenjang",
    },
  },
  {
    icon: ShoppingCart,
    eyebrow: "Purchase Order",
    title: "Dari MR ke PO, sampai barang diterima",
    desc: "Purchasing mengonversi MR yang sudah disetujui menjadi PO resmi, lalu setiap item dilacak hingga diterima requester.",
    points: [
      "PO dari master barang & vendor, dengan history harga vendor",
      "Payment Approval & Payment Validator untuk PO bernilai besar",
      "Cetak PO untuk GMI / GIS dan BAST ber-QR code",
      "Konfirmasi terima barang cukup dengan scan QR",
    ],
    shot: {
      name: "po-detail",
      alt: "Detail Purchase Order dengan tracking status item",
    },
  },
  {
    icon: Wallet,
    eyebrow: "Petty Cash",
    title: "Petty Cash tanpa tumpukan kertas",
    desc: "Seluruh siklus kas kecil berjalan digital dan berbasis item, dengan budget per departemen yang terpotong otomatis.",
    points: [
      "Alur Pengajuan → Voucher → Tarik Dana → Deklarasi",
      "Budget per departemen, site & perusahaan dengan riwayat lengkap",
      "Klasifikasi COA GMI / GIS di setiap item",
      "Approver bisa “Edit & Setujui” dengan riwayat revisi tercatat",
    ],
    shot: {
      name: "petty-cash",
      alt: "Detail Pengajuan Petty Cash dengan empat tahap approval",
    },
  },
];

const CAPABILITIES = [
  {
    icon: History,
    title: "Riwayat aktivitas",
    desc: "Setiap perubahan MR & PO tercatat lengkap: siapa, kapan, dan apa yang diubah.",
  },
  {
    icon: Search,
    title: "Pencarian global",
    desc: "Cari MR, PO, barang, atau menu dari mana saja lewat ⌘K / Ctrl+K.",
  },
  {
    icon: FileSpreadsheet,
    title: "Export & cetak",
    desc: "Tarik data ke Excel dan cetak dokumen resmi dengan kop perusahaan.",
  },
  {
    icon: Building2,
    title: "Multi perusahaan",
    desc: "Dokumen GMI & GIS terpisah rapi, akun Lourdes dapat memantau keduanya.",
  },
  {
    icon: Headset,
    title: "Chat Admin",
    desc: "Kendala di lapangan? Hubungi admin langsung dari dalam aplikasi.",
  },
  {
    icon: MessageSquareText,
    title: "Diskusi per dokumen",
    desc: "Koordinasi requester, GA, purchasing, dan approver di satu thread.",
  },
];

const STEPS = [
  {
    icon: FileSignature,
    title: "Pengajuan MR",
    desc: "Requester membuat Material Request dengan data terstandar & estimasi harga.",
  },
  {
    icon: ClipboardCheck,
    title: "Validasi GA",
    desc: "General Affair menetapkan Cost Center dan template approval yang sesuai.",
  },
  {
    icon: Send,
    title: "Approval Berjenjang",
    desc: "Dokumen dikirim berurutan ke setiap approver, lengkap dengan notifikasi.",
  },
  {
    icon: Package,
    title: "Pembuatan PO",
    desc: "Purchasing mengonversi MR “Waiting PO” menjadi PO resmi ke vendor.",
  },
  {
    icon: PackageCheck,
    title: "Penerimaan Barang",
    desc: "Requester mengonfirmasi penerimaan, MR & PO otomatis selesai.",
  },
];

const ACCESS_POINTS = [
  {
    icon: Smartphone,
    title: "Install seperti aplikasi",
    desc: "Tambahkan ke layar utama HP (PWA), tanpa perlu unduh dari store.",
  },
  {
    icon: BellRing,
    title: "Push notification",
    desc: "Notifikasi approval & update tetap masuk walau browser sudah ditutup.",
  },
  {
    icon: Globe,
    title: "Dari mana saja",
    desc: "Approve dari Head Office, site, branch, atau saat perjalanan dinas.",
  },
  {
    icon: MoonStar,
    title: "Nyaman dipakai lama",
    desc: "Tema terang, gelap & soft, plus pilihan font dan ukuran teks.",
  },
];

// Sorotan pembaruan untuk section "Pembaruan" - update manual tiap ada rilis
// besar (catatan rilis lengkap ada di menu Update Web, khusus user login).
const UPDATES = [
  {
    period: "Oktober 2026",
    items: [
      "Deklarasi Petty Cash",
      "Panel ringkasan saat membuat MR & PO",
      "Urutan kolom tabel MR & PO bisa diatur",
      "Lampiran berupa link untuk file berukuran besar",
    ],
  },
  {
    period: "September 2026",
    items: [
      "Petty Cash berbasis item, dari Pengajuan hingga Deklarasi",
      "Install ke HP (PWA) & push notification",
      "History vendor, template MR & template approval",
    ],
  },
  {
    period: "Agustus 2026",
    items: [
      "Konfirmasi terima barang via QR & cetak BAST",
      "Dashboard baru dengan skor kinerja MR & PO",
    ],
  },
];

function SectionHeading({
  eyebrow,
  title,
  desc,
  className,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-2xl text-center", className)}>
      <p className="text-sm font-semibold text-sky-700 dark:text-sky-400">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {desc && (
        <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
          {desc}
        </p>
      )}
    </div>
  );
}

function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/icons/icon-192.png"
        alt=""
        width={32}
        height={32}
        className="size-8 rounded-lg"
      />
      <span className="text-[15px] font-semibold tracking-tight">
        Garuda<span className="font-normal text-muted-foreground">Procure</span>
      </span>
    </span>
  );
}

export default async function LandingPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = !!data?.claims;

  const primaryCta = isLoggedIn
    ? { href: "/dashboard", label: "Buka Dashboard" }
    : { href: "/auth/login", label: "Masuk ke Aplikasi" };

  return (
    <div className="min-h-svh bg-background text-foreground antialiased">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Garuda Procure">
            <BrandMark />
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.name}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            <ThemeSwitcher />
            <div className="hidden items-center gap-2 md:flex">
              {isLoggedIn ? (
                <Button asChild size="sm">
                  <Link href="/dashboard">
                    Buka Dashboard <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="sm" variant="ghost">
                    <Link href="/auth/login">Masuk</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href="/auth/sign-up">Daftar</Link>
                  </Button>
                </>
              )}
            </div>
            <LandingMobileNav links={NAV_LINKS} isLoggedIn={isLoggedIn} />
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
          >
            <div className="absolute inset-0 [background-image:linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,black,transparent)] opacity-60" />
            <div className="absolute -top-40 left-1/2 h-[480px] w-[880px] -translate-x-1/2 rounded-full bg-gradient-to-r from-sky-300/40 via-cyan-200/30 to-emerald-300/40 blur-3xl dark:from-sky-500/15 dark:via-cyan-500/10 dark:to-emerald-500/15" />
          </div>

          <div className="relative mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-24 lg:px-8">
            <div className="mx-auto max-w-3xl text-center motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700">
              <span className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs backdrop-blur">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                Platform pengadaan internal Lourdes · GMI · GIS
              </span>

              <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-balance sm:text-6xl">
                Pengadaan &amp; Petty Cash,{" "}
                <span className="bg-gradient-to-r from-sky-600 to-emerald-600 bg-clip-text text-transparent dark:from-sky-400 dark:to-emerald-400">
                  rapi dalam satu sistem.
                </span>
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
                Garuda Procure menyatukan Material Request, Purchase Order,
                penerimaan barang, hingga Petty Cash dengan approval berjenjang
                yang transparan, untuk seluruh tim{" "}
                <span className="whitespace-nowrap font-medium text-foreground">
                  Lourdes Auto Parts
                </span>
                ,{" "}
                <span className="whitespace-nowrap font-medium text-foreground">
                  PT. Garuda Mart Indonesia
                </span>
                , dan{" "}
                <span className="whitespace-nowrap font-medium text-foreground">
                  PT. Global Inti Sejati
                </span>
                .
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="h-11 w-full px-6 sm:w-auto"
                >
                  <Link href={primaryCta.href}>
                    {primaryCta.label} <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-11 w-full bg-background/60 px-6 sm:w-auto"
                >
                  <a href="#fitur">Lihat Fitur</a>
                </Button>
              </div>

              <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                {[
                  "Akses 24/7",
                  "Bisa di-install di HP",
                  "Notifikasi real-time",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Preview produk */}
            <div className="mx-auto mt-14 max-w-5xl pb-16 sm:mt-20 sm:pb-28 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 motion-safe:duration-1000">
              <div className="relative">
                <BrowserFrame title="Garuda Procure · Dashboard">
                  <ThemedScreenshot
                    name="dashboard"
                    alt="Dashboard Garuda Procure: skor kinerja serta ringkasan MR dan PO"
                    sizes="(min-width: 1024px) 1024px, 100vw"
                    priority
                  />
                </BrowserFrame>

                <PhoneFrame className="absolute -bottom-16 -right-3 hidden w-[200px] md:block lg:-right-10 lg:w-[220px]">
                  <ThemedScreenshot
                    name="mobile"
                    alt="Garuda Procure di HP: daftar tugas yang perlu tindakan"
                    width={720}
                    height={1559}
                    sizes="220px"
                    priority
                  />
                </PhoneFrame>

                <div className="absolute -left-10 top-1/3 hidden w-60 rounded-xl border bg-background/95 p-3.5 shadow-xl backdrop-blur lg:block">
                  <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Workflow className="size-3.5 text-sky-600 dark:text-sky-400" />
                    Jalur Approval
                  </p>
                  <ul className="mt-2.5 space-y-2 text-[13px]">
                    <li className="flex items-center justify-between gap-2">
                      <span>Kepala Departemen</span>
                      <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span>General Manager</span>
                      <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                    </li>
                    <li className="flex items-center justify-between gap-2 font-medium">
                      <span>Executive Manager</span>
                      <Clock className="size-4 text-amber-500" />
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Grup perusahaan */}
        <section className="border-y bg-muted/30 py-12">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm font-medium text-muted-foreground">
              Satu sistem untuk seluruh grup perusahaan
            </p>
            {/* Latar putih tetap putih di dark mode supaya logo terbaca */}
            <ul className="mt-6 grid gap-3 sm:grid-cols-3 sm:gap-4">
              {COMPANIES.map((c) => (
                <li
                  key={c.name}
                  className="flex h-24 items-center justify-center rounded-xl bg-white px-6 shadow-xs ring-1 ring-black/5 dark:ring-white/10"
                >
                  <Image
                    src={c.logo}
                    alt={c.name}
                    width={c.width}
                    height={c.height}
                    className={cn("w-auto object-contain", c.className)}
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Highlight */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {HIGHLIGHTS.map(({ icon: Icon, value, label, desc }) => (
              <div key={label} className="bg-background p-6">
                <Icon className="size-5 text-sky-700 dark:text-sky-400" />
                <p className="mt-4 text-2xl font-bold tracking-tight">
                  {value}
                </p>
                <p className="mt-0.5 text-sm font-medium">{label}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Modul utama */}
        <section id="fitur" className="scroll-mt-16 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Modul Utama"
              title="Semua alur pengadaan, dalam satu tempat"
              desc="Dari permintaan barang, pembelian, hingga kas kecil. Setiap dokumen punya jejak yang jelas dan bisa dipantau semua pihak terkait."
            />

            <div className="mt-16 space-y-20 sm:mt-20 sm:space-y-28">
              {FEATURES.map((f, i) => (
                <div
                  key={f.eyebrow}
                  className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14"
                >
                  <div
                    className={cn("lg:col-span-5", i % 2 === 1 && "lg:order-2")}
                  >
                    <div className="inline-flex items-center gap-2 rounded-lg bg-sky-50 px-2.5 py-1 text-sm font-medium text-sky-800 ring-1 ring-sky-100 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-900/60">
                      <f.icon className="size-4" />
                      {f.eyebrow}
                    </div>
                    <h3 className="mt-4 text-2xl font-bold tracking-tight text-balance sm:text-3xl">
                      {f.title}
                    </h3>
                    <p className="mt-4 leading-relaxed text-muted-foreground">
                      {f.desc}
                    </p>
                    <ul className="mt-6 space-y-3">
                      {f.points.map((p) => (
                        <li
                          key={p}
                          className="flex gap-3 text-sm leading-relaxed"
                        >
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div
                    className={cn("lg:col-span-7", i % 2 === 1 && "lg:order-1")}
                  >
                    <div className="rounded-2xl bg-gradient-to-br from-sky-100/80 via-slate-50 to-emerald-100/70 p-2 ring-1 ring-black/5 sm:p-4 dark:from-sky-950/60 dark:via-slate-900/40 dark:to-emerald-950/50 dark:ring-white/5">
                      <BrowserFrame
                        title={`Garuda Procure · ${f.eyebrow}`}
                        className="shadow-xl"
                      >
                        <ThemedScreenshot
                          name={f.shot.name}
                          alt={f.shot.alt}
                          zoom={f.shot.zoom}
                          sizes="(min-width: 1024px) 640px, 100vw"
                        />
                      </BrowserFrame>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Kontrol & akuntabilitas */}
        <section className="bg-muted/30 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Kontrol & Akuntabilitas"
              title="Approval fleksibel, budget tetap terkendali"
              desc="Atur siapa menyetujui apa, pantau pemakaian budget, dan pastikan setiap keputusan tercatat."
            />

            <div className="mt-14 grid gap-4 lg:grid-cols-5">
              <div className="flex flex-col overflow-hidden rounded-2xl border bg-background lg:col-span-3">
                <div className="p-6 sm:p-8">
                  <Workflow className="size-5 text-sky-700 dark:text-sky-400" />
                  <h3 className="mt-4 text-lg font-semibold">
                    Template approval per departemen
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Jalur approval MR & PO otomatis dipilih sesuai departemen,
                    termasuk Payment Approval & Validator. Approver berhalangan?
                    Gunakan fitur substitusi approver.
                  </p>
                </div>
                <div className="mt-auto pl-6 sm:pl-8">
                  <div className="overflow-hidden rounded-tl-xl border-l border-t">
                    <ThemedScreenshot
                      name="approval-template"
                      alt="Manajemen template approval MR dan PO"
                      zoom={{ scale: 1.45, origin: "0% 0%" }}
                      sizes="(min-width: 1024px) 640px, 100vw"
                      className="aspect-[16/8]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col overflow-hidden rounded-2xl border bg-background lg:col-span-2">
                <div className="p-6 sm:p-8">
                  <Landmark className="size-5 text-sky-700 dark:text-sky-400" />
                  <h3 className="mt-4 text-lg font-semibold">
                    Cost Center & budget
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Initial dan current budget per Cost Center, top-up, serta
                    riwayat pemakaian yang selalu terbarui.
                  </p>
                </div>
                <div className="mt-auto pl-6 sm:pl-8">
                  <div className="overflow-hidden rounded-tl-xl border-l border-t">
                    <ThemedScreenshot
                      name="cost-center"
                      alt="Manajemen Cost Center dengan initial dan current budget"
                      height={1147}
                      zoom={{ scale: 1.9, origin: "6% 0%" }}
                      sizes="(min-width: 1024px) 420px, 100vw"
                      className="aspect-[4/3]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CAPABILITIES.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="rounded-2xl border bg-background p-6"
                >
                  <div className="flex size-9 items-center justify-center rounded-lg bg-sky-50 text-sky-700 ring-1 ring-sky-100 dark:bg-sky-950/50 dark:text-sky-400 dark:ring-sky-900/60">
                    <Icon className="size-4" />
                  </div>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Alur kerja */}
        <section id="alur" className="scroll-mt-16 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Alur Kerja"
              title="Lima tahap, dari permintaan hingga barang diterima"
              desc="Setiap MR melewati tahapan yang sama, sehingga semua pihak tahu posisi dan tanggung jawabnya."
            />
            <ol className="relative mt-14 grid gap-4 lg:grid-cols-5 lg:gap-6">
              <div
                aria-hidden="true"
                className="absolute left-[10%] right-[10%] top-6 hidden h-px bg-gradient-to-r from-sky-500/0 via-sky-500/40 to-emerald-500/0 lg:block"
              />
              {STEPS.map(({ icon: Icon, title, desc }, i) => (
                <li
                  key={title}
                  className="relative flex gap-4 rounded-2xl border bg-background p-5 lg:flex-col lg:items-center lg:border-0 lg:bg-transparent lg:p-0 lg:text-center"
                >
                  <div className="relative flex size-12 shrink-0 items-center justify-center rounded-xl border bg-background shadow-sm">
                    <Icon className="size-5 text-sky-700 dark:text-sky-400" />
                    <span className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
                      {i + 1}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold lg:mt-4">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {desc}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Akses 24/7 */}
        <section id="akses" className="scroll-mt-16 px-4 sm:px-6 lg:px-8">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-slate-950 text-white">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
            >
              <div className="absolute -left-24 -top-24 size-96 rounded-full bg-sky-500/25 blur-3xl" />
              <div className="absolute -bottom-32 right-0 size-96 rounded-full bg-emerald-500/20 blur-3xl" />
            </div>
            <div className="relative grid items-center gap-12 px-6 py-14 sm:px-12 lg:grid-cols-2 lg:py-16">
              <div>
                <p className="text-sm font-semibold text-sky-300">Akses 24/7</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                  Approval tidak perlu menunggu kembali ke kantor
                </h2>
                <p className="mt-4 leading-relaxed text-slate-300">
                  Garuda Procure berjalan online sepenuhnya. Tim di Head Office,
                  site, maupun branch dapat mengajukan, menyetujui, dan memantau
                  dokumen kapan saja.
                </p>
                <ul className="mt-8 grid gap-5 sm:grid-cols-2">
                  {ACCESS_POINTS.map(({ icon: Icon, title, desc }) => (
                    <li key={title}>
                      <Icon className="size-5 text-emerald-300" />
                      <p className="mt-3 font-medium">{title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-400">
                        {desc}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-center lg:justify-end lg:pr-8">
                <PhoneFrame className="w-[260px] rotate-2 sm:w-[280px]">
                  <ThemedScreenshot
                    name="mobile"
                    alt="Dashboard Garuda Procure di HP"
                    width={720}
                    height={1559}
                    sizes="280px"
                  />
                </PhoneFrame>
              </div>
            </div>
          </div>
        </section>

        {/* Pengembangan aktif */}
        <section id="pembaruan" className="scroll-mt-16 py-16 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <p className="text-sm font-semibold text-sky-700 dark:text-sky-400">
                Pengembangan Aktif
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                Terus diperbarui, mengikuti kebutuhan tim di lapangan
              </h2>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Fitur baru dan perbaikan dirilis secara rutin berdasarkan
                masukan pengguna. Punya ide atau menemukan kendala? Sampaikan
                lewat menu Feedback, tim pengembang akan menindaklanjutinya.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="outline">
                  <Link href="/update-web">
                    <Sparkles className="size-4" /> Catatan rilis lengkap
                  </Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link href="/feedback">
                    <MessageSquareText className="size-4" /> Kirim feedback
                  </Link>
                </Button>
              </div>
            </div>

            <ol className="relative space-y-8 border-l pl-6 sm:pl-8">
              {UPDATES.map((u, i) => (
                <li key={u.period} className="relative">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute -left-[29px] top-1 size-3 rounded-full border-2 border-background sm:-left-[37px]",
                      i === 0
                        ? "bg-emerald-500 ring-4 ring-emerald-500/20"
                        : "bg-muted-foreground/40",
                    )}
                  />
                  <p className="text-sm font-semibold">
                    {u.period}
                    {i === 0 && (
                      <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900/60">
                        Terbaru
                      </span>
                    )}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {u.items.map((item) => (
                      <li
                        key={item}
                        className="flex gap-2.5 text-sm text-muted-foreground"
                      >
                        <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 pb-16 sm:px-6 sm:pb-24 lg:px-8">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl">
            <Image
              src="/slide4.webp"
              alt=""
              fill
              sizes="(min-width: 1152px) 1152px, 100vw"
              className="object-cover object-[50%_40%]"
            />
            {/* HP: teks menutupi seluruh foto, jadi overlay lebih rata */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/75 to-slate-950/55 sm:bg-gradient-to-r sm:from-slate-950/90 sm:via-slate-950/70 sm:to-slate-950/20" />
            <div className="relative max-w-xl px-6 py-16 text-white sm:px-12 sm:py-20">
              <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                Siap merapikan proses pengadaan tim Anda?
              </h2>
              <p className="mt-4 leading-relaxed text-white/80">
                Masuk dengan Email atau NRP. Belum punya akun? Daftar, lalu
                tunggu verifikasi dan pemberian NRP oleh administrator.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="h-11 bg-white px-6 text-slate-900 hover:bg-white/90"
                >
                  <Link href={primaryCta.href}>
                    {primaryCta.label} <ArrowRight className="size-4" />
                  </Link>
                </Button>
                {!isLoggedIn && (
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="h-11 border-white/30 bg-white/5 px-6 text-white hover:bg-white/15 hover:text-white"
                  >
                    <Link href="/auth/sign-up">Daftar Akun</Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr] lg:px-8">
          <div className="max-w-sm">
            <BrandMark />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Sistem Manajemen Material Request, Purchase Order &amp; Petty Cash
              untuk Lourdes Auto Parts, PT. Garuda Mart Indonesia, dan PT.
              Global Inti Sejati.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold">Produk</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold">Akun & Bantuan</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {[
                ...(isLoggedIn
                  ? [{ name: "Dashboard", href: "/dashboard" }]
                  : [
                      { name: "Masuk", href: "/auth/login" },
                      { name: "Daftar Akun", href: "/auth/sign-up" },
                    ]),
                { name: "Dokumentasi", href: "/dokumentasi" },
                { name: "Tentang Aplikasi", href: "/tentang-app" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t">
          <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted-foreground sm:px-6 lg:px-8">
            © {new Date().getFullYear()} PT. Garuda Mart Indonesia · Garuda
            Procure
          </p>
        </div>
      </footer>
    </div>
  );
}
