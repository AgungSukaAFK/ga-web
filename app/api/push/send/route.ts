// app/api/push/send/route.ts
//
// Server-only endpoint buat kirim Web Push - satu-satunya tempat
// VAPID_PRIVATE_KEY dipakai (TIDAK BOLEH pernah ada di kode client). Dipanggil
// dari dispatchPushChannel (lib/notifications/client.ts) tiap kali ada
// notifikasi in-app baru dibuat - fire-and-forget, kegagalan di sini tidak
// boleh mengganggu notifikasi in-app yang sudah tersimpan.
//
// Subscription per device diambil dari tabel `push_subscriptions` (lihat
// supabase/push-notifications-setup.sql) - kalau push service bilang
// endpoint sudah tidak valid lagi (404/410, mis. user uninstall/clear data),
// baris subscription itu langsung dihapus supaya tidak terus dicoba.

import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

interface PushSendBody {
  userIds: string[];
  title: string;
  body: string;
  url?: string;
}

export async function POST(request: Request) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    // Belum dikonfigurasi (VAPID key belum di-generate/di-set di .env) -
    // jangan lempar 500 berisik, cukup no-op supaya tidak spam error log.
    return NextResponse.json({ sent: 0, skipped: "vapid_not_configured" });
  }

  let payload: PushSendBody;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const userIds = [...new Set(payload.userIds || [])].filter(Boolean);
  if (userIds.length === 0 || !payload.title) {
    return NextResponse.json({ sent: 0 });
  }

  const supabase = createAdminClient();
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (error) {
    console.error("[push/send] Failed to fetch subscriptions:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body || "",
    url: payload.url || "/",
  });

  const staleIds: number[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notificationPayload,
        );
        sent++;
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          staleIds.push(sub.id);
        } else {
          console.error("[push/send] Send failed:", err?.message || err);
        }
      }
    }),
  );

  if (staleIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", staleIds);
  }

  return NextResponse.json({ sent, stale: staleIds.length });
}
