"use client";

/**
 * lib/sidebar/menu-visibility.ts
 *
 * Preferensi "menu mana yang disembunyikan" per grup sidebar (Admin, Menu,
 * Petty Cash), per-device (disimpan di localStorage) - BUKAN di database,
 * supaya tiap user bebas atur tanpa ikut ke akun/device lain. Grup "About"
 * sengaja tidak pernah dikaitkan ke hook ini (lihat app-sidebar.tsx) supaya
 * selalu tampil semua.
 */

import { useEffect, useState } from "react";

export type HiddenMenuMap = Record<string, string[]>; // groupLabel -> url[] yang disembunyikan

const STORAGE_KEY = "ga-sidebar-hidden-menu";
const CHANGE_EVENT = "ga-sidebar-hidden-menu-changed";

export function loadHiddenMenuMap(): HiddenMenuMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveHiddenMenuMap(map: HiddenMenuMap) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    // Beritahu instance NavMain lain di tab yang sama (storage event browser
    // cuma nyampe ke tab LAIN, bukan tab asal yang nulis).
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: map }));
  } catch {
    // abaikan (mis. localStorage penuh / diblokir)
  }
}

/**
 * Hook React untuk membaca & mengubah menu apa saja yang disembunyikan pada
 * satu grup sidebar (dikunci oleh label grup, mis. "Admin", "Menu", "Petty
 * Cash"). Tersinkron antar komponen (custom event) & antar tab (storage
 * event bawaan browser).
 */
export function useSidebarGroupVisibility(groupLabel: string) {
  const [hiddenUrls, setHiddenUrls] = useState<string[]>([]);

  useEffect(() => {
    // Baca nilai asli setelah mount (hindari mismatch hidrasi SSR).
    const sync = () => setHiddenUrls(loadHiddenMenuMap()[groupLabel] ?? []);
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [groupLabel]);

  const setGroupHidden = (urls: string[]) => {
    const map = loadHiddenMenuMap();
    map[groupLabel] = urls;
    saveHiddenMenuMap(map);
    setHiddenUrls(urls);
  };

  const toggleUrl = (url: string, hidden: boolean) => {
    const current = loadHiddenMenuMap()[groupLabel] ?? [];
    const next = hidden
      ? Array.from(new Set([...current, url]))
      : current.filter((u) => u !== url);
    setGroupHidden(next);
  };

  return { hiddenUrls, toggleUrl, setGroupHidden };
}
