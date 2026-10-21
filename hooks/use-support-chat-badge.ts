// src/hooks/use-support-chat-badge.ts
//
// Angka badge menu Chat Admin di sidebar (lihat support_badge_counts di
// supabase/migrations/0007_chat_admin.sql): `userUnread` = percakapan milik user yang
// punya balasan admin belum dibaca, `adminWaiting` = percakapan yang
// menunggu dibalas admin IT. Di-refresh realtime tiap ada perubahan di
// support_tickets (RLS sudah membatasi event ke tiket yang boleh dilihat).

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchSupportBadgeCounts } from "@/services/supportChatService";

export function useSupportChatBadge(userId: string | null | undefined) {
  const [counts, setCounts] = useState({ userUnread: 0, adminWaiting: 0 });

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const refresh = async () => {
      try {
        const c = await fetchSupportBadgeCounts();
        if (!cancelled)
          setCounts({ userUnread: c.user_unread, adminWaiting: c.admin_waiting });
      } catch {
        // Best-effort - badge bukan fitur kritikal.
      }
    };
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
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;
      channel = supabase
        .channel(`support-badge-${userId}`)
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
  }, [userId]);

  return counts;
}
