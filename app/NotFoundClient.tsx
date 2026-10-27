"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  LayoutDashboard,
  LogIn,
  SearchX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import {
  buildNavGroups,
  type NavItem,
  type NavProfile,
} from "@/lib/sidebar/nav-config";

const MAX_SUGGESTIONS = 3;
const MIN_SCORE = 0.8;

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        diag + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diag = above;
    }
  }
  return row[b.length];
}

function segmentSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  // "vendors" vs "vendor", "pengajuan" vs "pengajuan-saya"
  if (Math.min(a.length, b.length) >= 2 && (a.includes(b) || b.includes(a))) {
    return 0.9;
  }
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

// Saran menu dari alamat yang tidak ketemu: induk terdekat yang memang ada
// (/petty-cash untuk /petty-cash/xyz) dan menu yang segmennya mirip (salah
// ketik, kurang/lebih huruf). Kandidat = menu sidebar sesuai hak akses user,
// jadi tidak pernah menyarankan halaman yang tidak boleh dibuka.
function suggestRoutes(pathname: string, items: NavItem[]): NavItem[] {
  let path = pathname;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    // URL rusak (mis. "%E0") - pakai apa adanya.
  }
  path = path.toLowerCase().replace(/\/+$/, "");
  const pathSegs = path.split("/").filter(Boolean);
  if (pathSegs.length === 0) return [];

  const seen = new Set<string>();
  const scored: { item: NavItem; score: number }[] = [];

  for (const item of items) {
    if (seen.has(item.url) || item.url === path) continue;
    seen.add(item.url);

    const itemSegs = item.url.split("/").filter(Boolean);
    const depth = itemSegs.length - 1;
    let score: number;

    if (path.startsWith(`${item.url}/`)) {
      score = 0.9 + 0.02 * itemSegs.length;
    } else {
      const last = itemSegs[depth] ?? "";
      score = Math.max(
        ...pathSegs.map(
          (seg, i) => segmentSimilarity(seg, last) * (i === depth ? 1 : 0.85),
        ),
      );
      // Satu induk (mis. /petty-cash/approvel vs /petty-cash/approval).
      const parent = itemSegs.slice(0, depth).join("/");
      if (parent && pathSegs.slice(0, depth).join("/") === parent) {
        score += 0.1;
      }
    }

    if (score >= MIN_SCORE) scored.push({ item, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SUGGESTIONS)
    .map(({ item }) => item);
}

export function NotFoundClient({
  isLoggedIn,
  profile,
}: {
  isLoggedIn: boolean;
  profile: NavProfile;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // window.history baru bisa dibaca setelah mount. Tab baru / link dari luar
  // tidak punya halaman sebelumnya, jadi tombol "Kembali" disembunyikan.
  const [canGoBack, setCanGoBack] = useState(false);
  useEffect(() => {
    setCanGoBack(window.history.length > 1);
  }, []);

  const suggestions = useMemo(
    () =>
      isLoggedIn
        ? suggestRoutes(
            pathname,
            buildNavGroups(profile).flatMap((group) => group.items),
          )
        : [],
    [isLoggedIn, pathname, profile],
  );

  const home = isLoggedIn
    ? { href: "/dashboard", label: "Ke Dashboard", icon: LayoutDashboard }
    : { href: "/auth/login", label: "Ke Halaman Masuk", icon: LogIn };

  return (
    <div className="relative isolate flex min-h-svh flex-col bg-background">
      {/* Grid tipis yang memudar ke tepi - sekadar tekstur latar. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_35%,black,transparent)]"
      />

      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href={isLoggedIn ? "/dashboard" : "/"}
          aria-label="Garuda Procure"
          className="flex items-center gap-2.5"
        >
          <Image
            src="/icons/icon-192.png"
            alt=""
            width={32}
            height={32}
            className="size-8 rounded-lg"
          />
          <span className="text-[15px] font-semibold tracking-tight">
            Garuda
            <span className="font-normal text-muted-foreground">Procure</span>
          </span>
        </Link>
        <ThemeSwitcher />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pt-6 pb-16">
        <div className="w-full max-w-md text-center motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500">
          <div aria-hidden className="relative mx-auto mb-10 w-fit select-none">
            <span className="block bg-gradient-to-b from-foreground/25 to-foreground/0 bg-clip-text text-[7.5rem] leading-none font-bold tracking-tighter text-transparent sm:text-[9rem]">
              404
            </span>
            <span className="absolute bottom-0 left-1/2 flex size-14 -translate-x-1/2 translate-y-1/3 items-center justify-center rounded-2xl border bg-background shadow-sm">
              <SearchX className="size-6 text-muted-foreground" />
            </span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">
            Halaman tidak ditemukan
          </h1>
          <p className="mt-2 text-sm text-balance text-muted-foreground">
            Alamat yang Anda buka tidak ada, sudah dipindahkan, atau mungkin
            salah ketik.
          </p>
          <code className="mt-4 inline-block max-w-full rounded-md border bg-muted/60 px-2.5 py-1 font-mono text-xs break-all text-muted-foreground">
            {pathname}
          </code>

          <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            {canGoBack && (
              <Button
                variant="outline"
                size="lg"
                className="px-5"
                onClick={() => router.back()}
              >
                <ArrowLeft />
                Kembali
              </Button>
            )}
            <Button asChild size="lg" className="px-5">
              <Link href={home.href}>
                <home.icon />
                {home.label}
              </Link>
            </Button>
          </div>

          {suggestions.length > 0 && (
            <div className="mt-10 text-left">
              <p className="mb-2 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Mungkin yang Anda cari
              </p>
              <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
                {suggestions.map((item) => (
                  <li key={item.url}>
                    <Link
                      href={item.url}
                      className="group flex items-center gap-3 px-4 py-3 transition-colors outline-none hover:bg-accent focus-visible:bg-accent"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:text-foreground">
                        <item.icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {item.title}
                        </span>
                        <span className="block truncate font-mono text-xs text-muted-foreground">
                          {item.url}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isLoggedIn && (
            <p className="mt-8 text-xs text-muted-foreground">
              Sampai di sini dari tautan di dalam aplikasi?{" "}
              <Link
                href="/feedback"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Laporkan lewat Feedback
              </Link>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
