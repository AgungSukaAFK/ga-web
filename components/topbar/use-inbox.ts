"use client";

// Inbox top bar = pusat quick access yg menggabungkan semua sumber notif:
//  - Notifikasi umum (NotificationProvider). Notif `support_message`
//    dikecualikan - chat sudah diwakili item per percakapan di bawah.
//  - Chat Admin: 1 item per percakapan (support_tickets) yg menunggu
//    perhatian user ini - balasan admin utk tiket miliknya, atau (admin IT)
//    pesan user yg belum dibalas. Status baca ikut state tiket.
//  - Update Web: postingan terbaru (hooks/use-update-web-badge.ts).
// Item otomatis keluar dari Inbox setelah INBOX_MAX_AGE_DAYS hari, atau
// tergeser kalau jumlahnya melewati INBOX_MAX_ITEMS. Datanya sendiri tetap
// ada di halaman masing-masing (/notifications, /chat-admin, /update-web).

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useNotification } from "@/components/providers/NotificationProvider";
import { useUpdateWebBadge } from "@/hooks/use-update-web-badge";
import { isITAdmin } from "@/lib/constants/departments";
import {
  chatAdminLink,
  fetchRecentSupportTickets,
  isTicketUnread,
  markSupportTicketRead,
} from "@/services/supportChatService";
import { SupportTicket } from "@/type";
import type { TopbarProfileData } from "./topbar";

export const INBOX_MAX_AGE_DAYS = 7;
export const INBOX_MAX_ITEMS = 20;
const MAX_AGE_MS = INBOX_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

export type InboxSource = "notification" | "chat" | "update";

export type InboxItem = {
  key: string;
  source: InboxSource;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  href: string;
  actorId?: string;
  actorName?: string;
  actorAvatar?: string | null;
  // Tandai dibaca saat item dibuka.
  markRead: () => void;
};

// Tiket yg relevan utk Inbox user ini, beserta sudut pandangnya.
function ticketView(
  t: SupportTicket,
  userId: string,
  itAdmin: boolean,
): { asAdmin: boolean } | null {
  // Tiket milik sendiri: masuk Inbox kalau pesan terakhir dari admin.
  if (t.user_id === userId) return t.last_sender_is_admin ? { asAdmin: false } : null;
  // Antrian admin IT: pesan user yg belum dibalas.
  if (itAdmin && !t.last_sender_is_admin && t.status !== "selesai")
    return { asAdmin: true };
  return null;
}

function useInboxTickets(userId: string | undefined) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  const refresh = useCallback(async () => {
    try {
      setTickets(
        await fetchRecentSupportTickets(new Date(Date.now() - MAX_AGE_MS)),
      );
    } catch {
      // Best-effort - Inbox tetap jalan dgn sumber lain.
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    // Satu kirim pesan = beberapa event beruntun, cukup refresh sekali.
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, 400);
    };

    refresh();
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token)
        await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;
      channel = supabase
        .channel(`inbox-tickets-${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "support_tickets" },
          scheduleRefresh,
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  return { tickets, setTickets, refresh };
}

export function useInbox(profile: TopbarProfileData | null) {
  const userId = profile?.id;
  const itAdmin = isITAdmin(profile);
  const { notifications, markAsRead } = useNotification();
  const { latestPost, isNew: updateIsNew, markSeen } =
    useUpdateWebBadge(userId);
  const { tickets, setTickets, refresh } = useInboxTickets(userId);
  // Dihitung ulang tiap Inbox dibuka/ada data baru - cukup utk batas 7 hari.
  const [now, setNow] = useState(() => Date.now());

  const items = useMemo<InboxItem[]>(() => {
    if (!userId) return [];
    const all: InboxItem[] = [];

    for (const n of notifications) {
      if (n.type === "support_message") continue;
      all.push({
        key: `notif-${n.id}`,
        source: "notification",
        title: n.title,
        message: n.message,
        time: n.created_at,
        unread: !n.is_read,
        href: n.link || "/notifications",
        actorId: n.actor_id,
        actorName: n.actor_name,
        actorAvatar: n.actor_avatar ?? null,
        markRead: () => {
          if (!n.is_read) markAsRead(n.id);
        },
      });
    }

    for (const t of tickets) {
      const view = ticketView(t, userId, itAdmin);
      if (!view) continue;
      const unread = isTicketUnread(t, view.asAdmin);
      all.push({
        key: `chat-${t.id}`,
        source: "chat",
        title: view.asAdmin
          ? `${t.user_nama || t.user_email || "User"}: ${t.subjek}`
          : `Balasan admin: ${t.subjek}`,
        message: t.last_message_preview || "",
        time: t.last_message_at,
        unread,
        href: chatAdminLink(t.id, view.asAdmin),
        actorId: view.asAdmin ? t.user_id : undefined,
        actorName: view.asAdmin ? (t.user_nama ?? undefined) : undefined,
        markRead: () => {
          // Notif support_message utk tiket ini ikut dibaca, supaya
          // halaman Notifikasi & badge sidebar tetap sinkron.
          notifications
            .filter(
              (n) =>
                n.type === "support_message" &&
                n.resource_id === String(t.id) &&
                !n.is_read,
            )
            .forEach((n) => markAsRead(n.id));
          if (!unread) return;
          const readAt = new Date().toISOString();
          setTickets((prev) =>
            prev.map((x) =>
              x.id !== t.id
                ? x
                : view.asAdmin
                  ? { ...x, admin_last_read_at: readAt }
                  : { ...x, user_last_read_at: readAt },
            ),
          );
          markSupportTicketRead(t.id);
        },
      });
    }

    if (latestPost) {
      all.push({
        key: `update-${latestPost.id}`,
        source: "update",
        title: `Update Web v${latestPost.version}`,
        message: latestPost.title,
        time: latestPost.created_at,
        unread: updateIsNew,
        href: "/update-web",
        actorId: latestPost.created_by ?? undefined,
        actorName: latestPost.created_by_profile?.nama ?? undefined,
        markRead: () => {
          if (updateIsNew) markSeen();
        },
      });
    }

    return all
      .filter((i) => now - new Date(i.time).getTime() < MAX_AGE_MS)
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, INBOX_MAX_ITEMS);
  }, [
    userId,
    itAdmin,
    notifications,
    tickets,
    latestPost,
    updateIsNew,
    now,
    markAsRead,
    markSeen,
    setTickets,
  ]);

  const unreadCount = items.filter((i) => i.unread).length;

  const markAllRead = useCallback(() => {
    items.filter((i) => i.unread).forEach((i) => i.markRead());
  }, [items]);

  // Dipanggil saat popover dibuka: segarkan batas umur & data tiket.
  const onOpen = useCallback(() => {
    setNow(Date.now());
    refresh();
  }, [refresh]);

  return { items, unreadCount, markAllRead, onOpen };
}
