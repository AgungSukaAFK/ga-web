"use client";

/**
 * lib/sidebar/nav-pending.ts
 *
 * Menyimpan URL menu sidebar yang baru diklik & sedang dimuat, supaya ada
 * feedback instan (highlight + spinner di item, progress bar di atas) selama
 * Next.js menyiapkan halaman tujuan. Dikosongkan lagi oleh
 * <NavigationProgress /> begitu pathname berubah.
 */

import { useSyncExternalStore } from "react";

let pendingUrl: string | null = null;
const listeners = new Set<() => void>();

export function setPendingNavUrl(url: string | null) {
  if (pendingUrl === url) return;
  pendingUrl = url;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePendingNavUrl() {
  return useSyncExternalStore(
    subscribe,
    () => pendingUrl,
    () => null,
  );
}
