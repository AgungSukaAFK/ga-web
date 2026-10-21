"use client";

// Tombol "Kembali" yg aman utk PWA. router.back() tidak melakukan apa-apa
// kalau halaman ini yg pertama dibuka di window tsb - kasus umum di PWA:
// app dibuka dari klik notifikasi push langsung ke detail dokumen, dan di
// mode standalone tidak ada tombol back browser. Kalau tidak ada riwayat,
// pindah ke `fallbackHref`.

import { useCallback } from "react";
import { useRouter } from "next/navigation";

export function useGoBack(fallbackHref: string) {
  const router = useRouter();
  return useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.push(fallbackHref);
  }, [router, fallbackHref]);
}
