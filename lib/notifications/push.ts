"use client";

/**
 * lib/notifications/push.ts
 *
 * Web Push subscription management (sisi browser). Beda dari
 * lib/notifications/settings.ts (preferensi tampilan/alert LOKAL) - file ini
 * yang bikin notifikasi beneran bisa masuk ke HP walau browser/tab sudah
 * ditutup, karena subscription-nya didaftarkan ke push service OS (FCM/APNs/
 * dst) lewat Service Worker (public/sw.js), bukan cuma listener JS di tab.
 *
 * Alur singkat: register SW -> minta izin Notification -> pushManager.
 * subscribe() pakai VAPID public key -> simpan subscription (endpoint+keys)
 * ke tabel `push_subscriptions` (lihat supabase/push-notifications-setup.sql).
 * Pengiriman aktualnya di server (app/api/push/send/route.ts) - VAPID
 * PRIVATE key tidak boleh pernah ada di browser.
 */

import { createClient } from "@/lib/supabase/client";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    !!VAPID_PUBLIC_KEY
  );
}

export type PushSubscriptionStatus = "subscribed" | "unsubscribed" | "unsupported";

/** Cek status subscription push DI DEVICE/BROWSER INI (bukan global per akun). */
export async function getPushSubscriptionStatus(): Promise<PushSubscriptionStatus> {
  if (!isPushSupported()) return "unsupported";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return "unsubscribed";
    const sub = await reg.pushManager.getSubscription();
    return sub ? "subscribed" : "unsubscribed";
  } catch {
    return "unsubscribed";
  }
}

/**
 * Aktifkan Web Push untuk device/browser ini, lalu simpan subscription-nya
 * atas nama `userId`. HARUS dipanggil dari dalam user gesture (klik tombol)
 * karena Notification.requestPermission() butuh itu di banyak browser.
 */
export async function subscribeToPush(userId: string): Promise<void> {
  if (!isPushSupported()) {
    throw new Error(
      "Push notification tidak didukung di browser ini. Di iPhone, tambahkan dulu situs ini ke Home Screen lewat Safari (Share > Add to Home Screen), lalu buka dari ikonnya.",
    );
  }

  // Di iOS, Push API HANYA aktif kalau situs berjalan sebagai installed
  // home-screen app - selama masih tab Safari biasa, requestPermission()
  // di bawah akan SELALU resolve "denied" diam-diam tanpa dialog apa pun.
  // Deteksi ini DULUAN supaya pesannya jelas ("belum di-install", bukan
  // "ditolak" yang menyesatkan - user bisa kira browser-nya yang salah).
  const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone ===
      true;
  if (isIOS && !isStandalone) {
    throw new Error(
      "Di iPhone, notifikasi cuma bisa aktif kalau web ini sudah di-install ke Home Screen. Install dulu lewat tombol Install di atas, buka dari ikonnya, baru aktifkan Notifikasi HP.",
    );
  }

  // Kalau user PERNAH menolak sebelumnya, browser tidak akan munculkan
  // dialog izin lagi - requestPermission() di bawah bakal langsung resolve
  // "denied" lagi tanpa prompt. Tangkap kondisi ini duluan biar pesannya
  // instruktif (arahkan ke pengaturan situs), bukan sekadar "ditolak".
  if (Notification.permission === "denied") {
    throw new Error(
      "Notifikasi diblokir di browser ini. Buka pengaturan situs (ikon gembok/info di address bar) > Notifications > Allow, lalu coba lagi.",
    );
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Izin notifikasi ditolak.");
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
    });
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Gagal membuat subscription push (data tidak lengkap).");
  }

  const supabase = createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw error;
}

/** Matikan Web Push untuk device/browser ini saja. */
export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  const supabase = createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
