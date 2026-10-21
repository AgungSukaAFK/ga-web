"use client";

// Semua dukungan PWA yg perlu jalan global, dipasang sekali di
// app/layout.tsx:
//  - registrasi service worker (public/sw.js) utk SEMUA user - dibutuhkan
//    halaman fallback offline. Sebelumnya SW baru terdaftar saat user
//    mengaktifkan Notifikasi HP; lib/notifications/push.ts tetap memanggil
//    register() & akan mendapat registrasi yg sama.
//  - warna status bar ikut tema (ThemeColorSync)
//  - link internal _blank tetap di dalam app (StandaloneLinkHandler)

import { useEffect } from "react";
import { ThemeColorSync } from "./theme-color-sync";
import { StandaloneLinkHandler } from "./standalone-link-handler";

function useRegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[PWA] gagal mendaftarkan service worker:", err);
    });
  }, []);
}

export function PwaSupport() {
  useRegisterServiceWorker();
  return (
    <>
      <ThemeColorSync />
      <StandaloneLinkHandler />
    </>
  );
}
