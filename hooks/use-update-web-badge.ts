// src/hooks/use-update-web-badge.ts
//
// "Apakah ada postingan Update Web baru yang belum dilihat user ini" - dipakai
// bareng oleh badge merah di components/app-sidebar.tsx (item "Update Web")
// dan widget kecil di Dashboard. Baru = post terbaru dibuat dalam 7 hari
// terakhir DAN id-nya lebih besar dari `last_seen_post_id` user (tabel
// update_web_seen, per akun - lihat supabase/update-web-v2-setup.sql, BUKAN
// localStorage per-device seperti preferensi sidebar di
// lib/sidebar/menu-visibility.ts, supaya konsisten walau ganti perangkat).

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchLatestUpdateWebPost,
  fetchUpdateWebSeenState,
  markUpdateWebSeen,
} from "@/services/updateWebService";
import { UpdateWebPost } from "@/type/update-web";

const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function useUpdateWebBadge(userId: string | null | undefined) {
  const [latestPost, setLatestPost] = useState<UpdateWebPost | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const [post, lastSeenId] = await Promise.all([
          fetchLatestUpdateWebPost(),
          fetchUpdateWebSeenState(userId),
        ]);
        if (cancelled) return;
        setLatestPost(post);
        if (!post) {
          setIsNew(false);
          return;
        }
        const withinWindow =
          Date.now() - new Date(post.created_at).getTime() < NEW_WINDOW_MS;
        setIsNew(
          withinWindow && (lastSeenId === null || lastSeenId < post.id),
        );
      } catch {
        // Best-effort - badge notif bukan fitur kritikal, gagal diam-diam
        // saja daripada mengganggu sidebar/dashboard.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const markSeen = useCallback(async () => {
    if (!userId || !latestPost) return;
    setIsNew(false);
    try {
      await markUpdateWebSeen(userId, latestPost.id);
    } catch {
      // Best-effort - badge tetap ilang di UI biar tidak nyebelin walau
      // sync ke server gagal (akan ke-sync lagi lain kali).
    }
  }, [userId, latestPost]);

  return { latestPost, isNew, loading, markSeen };
}
