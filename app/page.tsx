import React from "react";
import { FileText, Users, TrendingUp, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { AuthButton } from "@/components/auth-button";
import ToggleMenu from "@/components/toggle-menu";
import MenuOpen from "@/components/menu-open";
import Image from "next/image";

// Menambahkan tipe untuk props komponen

const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={`bg-card text-card-foreground rounded-xl border border-border shadow-xs ${className}`}
    {...props}
  />
);

const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div className={`flex flex-col space-y-1.5 p-6 ${className}`} {...props} />
);

const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  ...props
}) => (
  <h3
    className={`text-2xl font-semibold leading-none tracking-tight ${className}`}
    {...props}
  />
);

const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  ...props
}) => <p className={`text-sm text-muted-foreground ${className}`} {...props} />;

const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => <div className={`p-6 pt-0 ${className}`} {...props} />;

interface NavLink {
  name: string;
  href: string;
}

// Komponen Utama Aplikasi
const App: React.FC = () => {
  const navLinks: NavLink[] = [
    { name: "Fitur Utama", href: "#fitur" },
    { name: "Manfaat", href: "#manfaat" },
    { name: "Kontak", href: "#kontak" },
  ];
  return (
    <div className="bg-background text-foreground font-sans antialiased">
      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <a href="#" className="flex items-center gap-2">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-primary"
            >
              <path
                d="M12 2L2 7V17L12 22L22 17V7L12 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 7L12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 22V12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M22 7L12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M17 4.5L7 9.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="font-bold text-lg">
              Garuda<span className="font-light">Procure</span>
            </span>
          </a>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                {link.name}
              </a>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-4">
            <ThemeSwitcher />
            <AuthButton />
          </div>
          <ToggleMenu />
        </div>
        <MenuOpen />
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative py-20 md:py-32 bg-background">
          <div className="absolute inset-0 bg-grid-slate-100 mask-[linear-gradient(to_bottom,white_20%,transparent_100%)] dark:bg-grid-slate-700/40"></div>
          <div className="container mx-auto px-4 md:px-6 text-center relative">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tighter text-foreground leading-tight">
              Modernisasi Proses Pengadaan <br className="hidden md:block" />{" "}
              untuk <span className="text-primary">General Affair</span>
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground">
              Buat Material Request (MR) dan Purchase Order (PO) dalam hitungan
              menit dengan alur persetujuan yang fleksibel dan transparan.
              Dirancang khusus untuk PT. Garuda Mart Indonesia.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Button className="px-8 py-3 text-lg">
                <a href="dashboard">Mulai Sekarang</a>{" "}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            <div className="mt-16 mx-auto max-w-5xl">
              <div className="rounded-xl bg-background shadow-2xl ring-1 ring-ring/10">
                <Image
                  src="/dashboard.png"
                  alt="[Tampilan dashboard aplikasi MR & PO]"
                  className="rounded-xl object-cover"
                  width={1920}
                  height={1080}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="fitur" className="py-20 md:py-28 bg-secondary/40">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">
                Fitur Utama
              </h2>
              <p className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
                Semua yang Anda Butuhkan untuk Efisiensi
              </p>
              <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
                Sistem kami dirancang untuk menyederhanakan proses, mengurangi
                pekerjaan manual, dan memberikan visibilitas penuh.
              </p>
            </div>
            <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <div className="bg-primary/10 text-primary rounded-lg p-3 w-max">
                    <FileText className="h-8 w-8" />
                  </div>
                  <CardTitle className="pt-4">
                    Pembuatan MR & PO Cepat
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Buat Material Request dan Purchase Order dengan template
                    yang sudah disesuaikan. Kurangi waktu administrasi dan fokus
                    pada hal yang lebih strategis.
                  </CardDescription>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="bg-primary/10 text-primary rounded-lg p-3 w-max">
                    <Users className="h-8 w-8" />
                  </div>
                  <CardTitle className="pt-4">
                    Alur Persetujuan Dinamis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Atur alur persetujuan multi-level sesuai kebutuhan
                    departemen. Notifikasi otomatis memastikan proses berjalan
                    lancar tanpa penundaan.
                  </CardDescription>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="bg-primary/10 text-primary rounded-lg p-3 w-max">
                    <TrendingUp className="h-8 w-8" />
                  </div>
                  <CardTitle className="pt-4">Pelacakan Real-time</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Pantau status setiap permintaan dari pengajuan hingga barang
                    diterima. Dapatkan visibilitas penuh atas semua proses
                    pengadaan.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* How it Works / Benefits Section */}
        <section id="manfaat" className="py-20 md:py-28 bg-background">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">
                Proses yang Disederhanakan
              </h2>
              <p className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
                Hanya 3 Langkah Mudah
              </p>
            </div>
            <div className="relative mt-16">
              <div className="grid gap-12 md:grid-cols-3">
                {/* Step 1 */}
                <div className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xl">
                    1
                  </div>
                  <h3 className="mt-6 text-xl font-bold text-foreground">
                    Buat Permintaan
                  </h3>
                  <p className="mt-2 text-muted-foreground">
                    Isi form Material Request dengan mudah, lampirkan dokumen
                    pendukung jika perlu, dan kirim.
                  </p>
                </div>
                {/* Step 2 */}
                <div className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xl">
                    2
                  </div>
                  <h3 className="mt-6 text-xl font-bold text-foreground">
                    Proses Persetujuan
                  </h3>
                  <p className="mt-2 text-muted-foreground">
                    Sistem secara otomatis mengirimkan permintaan ke pihak yang
                    berwenang sesuai alur yang telah ditentukan.
                  </p>
                </div>
                {/* Step 3 */}
                <div className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xl">
                    3
                  </div>
                  <h3 className="mt-6 text-xl font-bold text-foreground">
                    PO Terbit & Terkirim
                  </h3>
                  <p className="mt-2 text-muted-foreground">
                    Setelah disetujui, Purchase Order dibuat secara otomatis dan
                    dapat langsung dikirimkan ke vendor.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-primary">
          <div className="container mx-auto max-w-4xl py-16 px-4 text-center sm:py-20 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-extrabold text-primary-foreground sm:text-4xl">
              <span className="block">
                Siap untuk mentransformasi proses pengadaan?
              </span>
            </h2>
            <p className="mt-4 text-lg leading-6 text-primary-foreground/80">
              Tingkatkan efisiensi dan transparansi di departemen General Affair
              Anda hari ini.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer id="kontak" className="bg-gray-950 text-secondary-foreground">
        <div className="container mx-auto py-12 px-4 md:px-6">
          <div className="xl:grid xl:grid-cols-3 xl:gap-8">
            <div className="space-y-4">
              <a href="#" className="flex items-center gap-2">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-white"
                >
                  <path
                    d="M12 2L2 7V17L12 22L22 17V7L12 2Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M2 7L12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 22V12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M22 7L12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M17 4.5L7 9.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="font-bold text-lg">GarudaProcure</span>
              </a>
              <p className="text-sm text-muted-foreground">
                Sistem Manajemen MR & PO untuk General Affair <br />
                PT. Garuda Mart Indonesia.
              </p>
            </div>
            <div className="mt-12 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
              <div className="md:grid md:grid-cols-2 md:gap-8">
                <div>
                  <h3 className="text-sm font-semibold tracking-wider uppercase">
                    Solusi
                  </h3>
                  <ul className="mt-4 space-y-2">
                    <li>
                      <a
                        href="#fitur"
                        className="text-base text-muted-foreground hover:text-primary-foreground"
                      >
                        Fitur
                      </a>
                    </li>
                    <li>
                      <a
                        href="#manfaat"
                        className="text-base text-muted-foreground hover:text-primary-foreground"
                      >
                        Manfaat
                      </a>
                    </li>
                  </ul>
                </div>
                <div className="mt-12 md:mt-0">
                  <h3 className="text-sm font-semibold tracking-wider uppercase">
                    Perusahaan
                  </h3>
                  <ul className="mt-4 space-y-2">
                    <li>
                      <a
                        href="#"
                        className="text-base text-muted-foreground hover:text-primary-foreground"
                      >
                        Tentang Kami
                      </a>
                    </li>
                    <li>
                      <a
                        href="#"
                        className="text-base text-muted-foreground hover:text-primary-foreground"
                      >
                        Karir
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="md:grid md:grid-cols-2 md:gap-8">
                <div>
                  <h3 className="text-sm font-semibold tracking-wider uppercase">
                    Legal
                  </h3>
                  <ul className="mt-4 space-y-2">
                    <li>
                      <a
                        href="#"
                        className="text-base text-muted-foreground hover:text-primary-foreground"
                      >
                        Kebijakan Privasi
                      </a>
                    </li>
                    <li>
                      <a
                        href="#"
                        className="text-base text-muted-foreground hover:text-primary-foreground"
                      >
                        Syarat & Ketentuan
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-12 border-t border-border/20 pt-8">
            <p className="text-base text-muted-foreground xl:text-center">
              &copy; {new Date().getFullYear()} PT. Garuda Mart Indonesia. Semua
              Hak Cipta Dilindungi.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
