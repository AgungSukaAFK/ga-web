// public/sw.js
//
// Service Worker khusus Web Push - satu-satunya alasan file ini ada.
// Tidak melakukan caching/offline apa pun (bukan full PWA offline-first),
// cuma nangkep event "push" dari browser push service & tampilkan
// notifikasi OS-level, ini yang bikin notifikasi tetap masuk walau tab/
// browser sudah ditutup. Didaftarkan dari lib/notifications/push.ts saat
// user mengaktifkan "Notifikasi HP" (lihat components/notification-settings.tsx).

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

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});
