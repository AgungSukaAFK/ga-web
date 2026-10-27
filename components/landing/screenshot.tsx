import Image from "next/image";
import { cn } from "@/lib/utils";

// Screenshot app untuk landing page (public/landing/<name>-light.webp &
// <name>-dark.webp). Diambil dari dev server + Supabase LOKAL yang isinya
// data demo (seed supabase/scripts/seed-demo-*.mjs), bukan data production -
// nama orang juga sudah disamarkan. Kalau ambil ulang, pakai ukuran viewport
// 1440x900 @2x lalu resize ke lebar 1920 supaya rasio di sini tetap cocok.
//
// Dua varian di-render sekaligus, yang tampil ikut tema aktif (utility
// `dark:` juga berlaku untuk soft-dark). Varian yang tersembunyi + lazy tidak
// diunduh browser; `priority` (hero) sengaja memuat keduanya supaya tidak
// ada kedip saat ganti tema.
export function ThemedScreenshot({
  name,
  alt,
  width = 1920,
  height = 1200,
  sizes,
  priority,
  zoom,
  className,
}: {
  name: string;
  alt: string;
  width?: number;
  height?: number;
  sizes: string;
  priority?: boolean;
  /** Perbesar bagian tertentu (mis. kartu Jalur Approval) tanpa crop ulang file. */
  zoom?: { scale: number; origin: string };
  className?: string;
}) {
  const style = zoom
    ? { transform: `scale(${zoom.scale})`, transformOrigin: zoom.origin }
    : undefined;
  const common = {
    width,
    height,
    sizes,
    priority,
    style,
    draggable: false,
  };

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Image
        {...common}
        src={`/landing/${name}-light.webp`}
        alt={alt}
        className="block h-auto w-full select-none dark:hidden"
      />
      <Image
        {...common}
        src={`/landing/${name}-dark.webp`}
        alt={alt}
        className="hidden h-auto w-full select-none dark:block"
      />
    </div>
  );
}

export function BrowserFrame({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-background shadow-2xl shadow-slate-900/10 ring-1 ring-black/5 dark:shadow-black/40 dark:ring-white/5",
        className,
      )}
    >
      <div className="flex h-9 items-center gap-3 border-b bg-muted/60 px-3.5">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-rose-400/80" />
          <span className="size-2.5 rounded-full bg-amber-400/80" />
          <span className="size-2.5 rounded-full bg-emerald-400/80" />
        </div>
        <div className="mx-auto w-full max-w-xs truncate rounded-md bg-background/80 px-3 py-0.5 text-center text-[11px] text-muted-foreground ring-1 ring-border">
          {title}
        </div>
        <div className="w-[42px]" aria-hidden="true" />
      </div>
      {children}
    </div>
  );
}

export function PhoneFrame({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative rounded-[2.25rem] bg-slate-900 px-2 pb-2 pt-6 shadow-2xl shadow-slate-900/30 ring-1 ring-white/10 dark:bg-slate-800",
        className,
      )}
    >
      {/* Speaker di bezel, bukan notch - supaya tidak menutupi header app */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-2.5 h-1.5 w-14 -translate-x-1/2 rounded-full bg-white/15"
      />
      <div className="overflow-hidden rounded-[1.5rem] bg-background">
        {children}
      </div>
    </div>
  );
}
