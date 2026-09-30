"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Headset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { AccentThemeSwitcher } from "@/components/accent-theme-switcher";
import { cn } from "@/lib/utils";

// Foto latar halaman auth (public/slide*.webp). kbFrom/kbTo = arah geser
// efek Ken Burns (dipakai di keyframe auth-kenburns di globals.css), dibuat
// beda-beda per slide supaya gerakannya tidak monoton.
const SLIDES = [
  { src: "/slide2.webp", alt: "Excavator Komatsu PC3000 di area tambang", kbFrom: "-2%, 1%", kbTo: "2%, -1%", position: "50% 55%" },
  { src: "/slide.webp", alt: "Smart Power Management Controller Lourdes Auto Parts", kbFrom: "1%, 1%", kbTo: "-2%, -2%", position: "60% 40%" },
  { src: "/slide3.webp", alt: "Tim lapangan di depan alat berat Komatsu", kbFrom: "2%, 0%", kbTo: "-2%, 1%", position: "50% 60%" },
  { src: "/slide4.webp", alt: "Pemasangan lampu kerja pada kabin excavator", kbFrom: "0%, 2%", kbTo: "-1%, -2%", position: "50% 40%" },
  { src: "/slide5.webp", alt: "Teknisi memasang perangkat di kabin unit baru", kbFrom: "-1%, -1%", kbTo: "2%, 1%", position: "50% 45%" },
  { src: "/slide6.webp", alt: "Instalasi perangkat di atap kabin, area yard unit", kbFrom: "2%, -1%", kbTo: "-1%, 1%", position: "50% 50%" },
];

const INTERVAL_MS = 6000;
const FADE_MS = 1400;

function BackgroundSlideshow() {
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [hidden, setHidden] = useState(false);

  // Jeda rotasi saat tab tidak aktif supaya tidak "loncat" beberapa slide
  // sekaligus waktu user kembali.
  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Timer di-reset setiap index berubah.
  useEffect(() => {
    if (hidden) return;
    const id = window.setTimeout(() => {
      setPrev(index);
      setIndex((index + 1) % SLIDES.length);
    }, INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [index, hidden]);

  // Slide sebelumnya tetap dianimasikan selama fade-out, lalu dilepas.
  useEffect(() => {
    if (prev === null) return;
    const id = window.setTimeout(() => setPrev(null), FADE_MS);
    return () => window.clearTimeout(id);
  }, [prev]);

  return (
    <>
      <div className="absolute inset-0" aria-hidden="true">
        {SLIDES.map((slide, i) => {
          const active = i === index;
          const animating = active || i === prev;
          return (
            <div
              key={slide.src}
              className={cn(
                "absolute inset-0 transition-opacity ease-in-out",
                active ? "opacity-100" : "opacity-0",
              )}
              style={{ transitionDuration: `${FADE_MS}ms` }}
            >
              <Image
                src={slide.src}
                alt=""
                fill
                priority={i === 0}
                sizes="(min-width: 1024px) 60vw, 100vw"
                className={cn("object-cover", animating && "auth-kenburns")}
                style={
                  {
                    objectPosition: slide.position,
                    "--kb-from": slide.kbFrom,
                    "--kb-to": slide.kbTo,
                    "--kb-duration": `${INTERVAL_MS + FADE_MS * 2}ms`,
                  } as React.CSSProperties
                }
              />
            </div>
          );
        })}
      </div>

      {/* Overlay supaya teks & form tetap terbaca di atas foto apa pun */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/30" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/60 via-transparent to-transparent" />

      {/* Konten panel kiri (desktop saja) */}
      <div className="absolute inset-0 hidden flex-col justify-between p-10 text-white lg:flex xl:p-14">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
            <Image
              src="/icons/icon-192.png"
              alt=""
              width={40}
              height={40}
              className="size-10 rounded-lg"
            />
          </div>
          <div className="leading-tight">
            <p className="text-xl font-semibold tracking-tight">
              Garuda Procure
            </p>
            <p className="text-sm text-white/70">
              Sistem Manajemen MR &amp; PO
            </p>
          </div>
        </div>

        <div className="max-w-2xl space-y-3">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-balance xl:text-4xl">
            Pengadaan yang rapi, dari permintaan hingga barang diterima.
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-white/75 xl:text-base">
            Kelola Material Request, Purchase Order, penerimaan barang, dan
            Petty Cash dalam satu sistem terpadu untuk seluruh grup perusahaan.
          </p>
        </div>
      </div>
    </>
  );
}

// Lourdes = induk, GMI & GIS di bawah naungannya.
export function CompanyLogos({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <Image
        src="/lourdes-logo.webp"
        alt="Lourdes Auto Parts"
        width={1024}
        height={392}
        priority
        className="h-14 w-auto sm:h-16 lg:h-20"
      />
      <div className="flex w-full items-center justify-center gap-3 sm:gap-5 lg:gap-6">
        <div className="flex min-w-0 flex-1 justify-end">
          <Image
            src="/gmi-landscape-stroke.webp"
            alt="PT. Garuda Mart Indonesia"
            width={1098}
            height={148}
            priority
            className="h-auto w-full max-w-[190px] lg:max-w-[235px]"
          />
        </div>
        <span className="h-9 w-px shrink-0 bg-border lg:h-12" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 justify-start">
          <Image
            src="/gis-landscape.webp"
            alt="PT. Global Inti Sejati"
            width={1080}
            height={261}
            priority
            className="h-auto w-full max-w-[160px] lg:max-w-[195px]"
          />
        </div>
      </div>
    </div>
  );
}

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  const year = new Date().getFullYear();

  return (
    <div className="relative min-h-svh w-full lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      {/* Mobile: foto jadi latar penuh di belakang form. Desktop: panel kiri. */}
      <aside className="fixed inset-0 overflow-hidden bg-slate-950 lg:sticky lg:inset-auto lg:top-0 lg:h-svh">
        <BackgroundSlideshow />
      </aside>

      <main className="relative z-10 flex min-h-svh flex-col px-4 py-4 sm:px-8 lg:bg-background lg:px-10 xl:px-16">
        <div className="flex justify-end">
          <div className="flex items-center gap-0.5 rounded-lg bg-background/80 p-0.5 backdrop-blur lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            {/* TODO: nanti diarahkan ke chat dengan admin */}
            <Button
              variant="ghost"
              size="sm"
              title="Layanan / Hubungi Admin"
              aria-label="Layanan / Hubungi Admin"
              onClick={() =>
                toast.info("Layanan chat dengan admin segera hadir.")
              }
            >
              <Headset className="text-muted-foreground" size={16} />
            </Button>
            <AccentThemeSwitcher />
            <ThemeSwitcher />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-6">
          <div className="w-full max-w-md rounded-2xl border bg-background/90 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none">
            <CompanyLogos className="lg:-mx-10" />

            <div className="my-6 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            <div className="mb-6 space-y-1.5 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>

            {children}
          </div>
        </div>

        <p className="text-center text-xs text-white/70 lg:text-muted-foreground">
          © {year} PT. Garuda Mart Indonesia · Garuda Procure
        </p>
      </main>
    </div>
  );
}
