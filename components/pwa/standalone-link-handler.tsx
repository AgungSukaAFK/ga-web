"use client";

// Di PWA standalone, link internal ber-target="_blank" (mis. "Lihat Detail"
// dokumen PC dari halaman approval) tidak membuka tab baru - di iOS jadinya
// browser overlay terpisah, di Android tab Chrome. User keluar dari app,
// dan di iOS sesi login di browser itu belum tentu sama dgn sesi di PWA.
// Komponen ini mencegat klik tsb & menavigasi di dalam app saja (balik pakai
// gesture/tombol back).
//
// Yang TIDAK dicegat (tetap _blank):
//  - link ke origin lain (lampiran storage, link vendor, wa.me, dst) ->
//    memang sebaiknya dibuka di browser overlay;
//  - /api/* & path ber-ekstensi file, atau link ber-atribut download;
//  - link ber-atribut data-pwa-new-window: dipakai di halaman form (mis.
//    buat/edit PO) supaya isian form yg belum disimpan tidak hilang.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isStandalone } from "@/lib/pwa";

export function StandaloneLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey ||
        !isStandalone()
      )
        return;

      const anchor = (e.target as Element | null)?.closest?.("a");
      if (
        !anchor ||
        anchor.target !== "_blank" ||
        anchor.hasAttribute("download") ||
        anchor.hasAttribute("data-pwa-new-window")
      )
        return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname.startsWith("/api/") || /\.\w+$/.test(url.pathname))
        return;

      e.preventDefault();
      router.push(url.pathname + url.search + url.hash);
    };

    // Bubble phase di document: handler onClick React (mis. <Link>) sudah
    // jalan duluan, jadi defaultPrevented dari mereka tetap dihormati.
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [router]);

  return null;
}
