// public/sw.js
//
// Service Worker Garuda Procure. Tugasnya cuma dua:
//  1. Web Push: tangkap event "push" & tampilkan notifikasi OS-level (tetap
//     masuk walau tab/app ditutup). Subscription-nya dibuat dari
//     lib/notifications/push.ts saat user mengaktifkan "Notifikasi HP".
//  2. Fallback offline: kalau navigasi halaman gagal karena tidak ada
//     koneksi, tampilkan /offline.html (di-precache saat install).
// Sengaja TIDAK meng-cache halaman/data lain (bukan offline-first) - data
// MR/PO/PC harus selalu segar dari server. Didaftarkan utk semua user oleh
// components/pwa/pwa-support.tsx.
//
// Naikkan CACHE_VERSION kalau offline.html berubah supaya cache lama dibuang.

const CACHE_VERSION = "v1";
const OFFLINE_CACHE = `offline-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("offline-") && k !== OFFLINE_CACHE)
          .map((k) => caches.delete(k)),
      );
      // Navigation preload: request halaman jalan paralel dgn start-up SW,
      // jadi adanya SW tidak memperlambat navigasi.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  // Hanya navigasi halaman (bukan RSC/fetch API/asset) - sisanya dibiarkan
  // lewat jaringan biasa tanpa campur tangan SW.
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        const preloaded = await event.preloadResponse;
        if (preloaded) return preloaded;
        return await fetch(event.request);
      } catch {
        const cache = await caches.open(OFFLINE_CACHE);
        const offline = await cache.match(OFFLINE_URL);
        return (
          offline ||
          new Response("Offline", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
        );
      }
    })(),
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: "Garuda Procure", body: "Ada notifikasi baru." };
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: "Garuda Procure", body: event.data.text() };
    }
  }

  const title = payload.title || "Garuda Procure";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Klik notifikasi (dari push maupun dari NotificationProvider):
//  - sudah ada window di URL tujuan -> fokuskan saja;
//  - ada window app lain yg terbuka (mis. PWA di halaman lain) -> fokuskan
//    & pindahkan ke URL tujuan, jangan buka window baru;
//  - tidak ada -> buka window baru.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification.data?.url || "/",
    self.location.origin,
  ).href;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      const exact = clientList.find((c) => c.url === targetUrl);
      if (exact) return exact.focus();

      const appClient = clientList.find((c) =>
        c.url.startsWith(self.location.origin),
      );
      if (appClient) {
        try {
          const focused = await appClient.focus();
          // navigate() hanya bisa utk client yg dikontrol SW ini.
          return await (focused || appClient).navigate(targetUrl);
        } catch {
          // jatuh ke openWindow di bawah
        }
      }

      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })(),
  );
});
