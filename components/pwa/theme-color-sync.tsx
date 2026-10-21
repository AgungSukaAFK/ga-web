"use client";

// Samakan warna status bar HP / title bar PWA (<meta name="theme-color">)
// dgn background tema yg sedang aktif. Meta bawaan dari `viewport` di
// app/layout.tsx cuma bisa ikut tema sistem (media query); komponen ini
// menimpanya supaya ikut tema pilihan user (light/dark/soft-light/
// soft-dark) - dipantau lewat perubahan class di <html> oleh next-themes.

import { useEffect } from "react";

function syncThemeColor() {
  const color = getComputedStyle(document.body).backgroundColor;
  if (!color) return;
  const metas = document.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  metas.forEach((meta) => {
    // Hapus media supaya warna tema pilihan user yg berlaku, bukan tema
    // sistem.
    meta.removeAttribute("media");
    meta.content = color;
  });
}

export function ThemeColorSync() {
  useEffect(() => {
    syncThemeColor();
    const observer = new MutationObserver(syncThemeColor);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return null;
}
