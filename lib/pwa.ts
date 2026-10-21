// Helper PWA (app dibuka dari ikon home screen, mode "standalone" di
// public/manifest.json).

// true kalau app sedang jalan sebagai PWA ter-install (tanpa UI browser).
// navigator.standalone = versi lama iOS Safari.
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
