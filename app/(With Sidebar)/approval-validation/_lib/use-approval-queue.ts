// app/(With Sidebar)/approval-validation/_lib/use-approval-queue.ts
//
// Data halaman Approval & Validation + sinkron realtime. Antrian dimuat ulang
// (debounce) setiap kali:
// - ada perubahan di tabel material_requests / purchase_orders (Supabase
//   Realtime, lihat migrasi 0027_realtime_mr_po.sql) - menangkap aksi di tab
//   lain maupun oleh user lain;
// - tab ini kembali aktif / jaringan tersambung lagi (event realtime yang
//   terlewat saat tab tidur / offline);
// - fallback berkala, kalau koneksi realtime tidak tersedia.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isGADepartment, isITAdmin } from "@/lib/constants/departments";
import {
  fetchMyPendingMrApprovals,
  fetchMyPendingPoApprovals,
  fetchPendingValidationMRs,
  fetchPendingValidationPOs,
  fetchPosReadyForGaReceive,
} from "@/services/approvalService";
import type { MaterialRequest, PurchaseOrder, User as Profile } from "@/type";
import { fromMr, fromPo, type QueueItem, type QueueKind } from "./queue";

export type LiveStatus = "connecting" | "live" | "offline";

const DEBOUNCE_MS = 700;
// Realtime aktif -> cukup jarang (jaring pengaman). Tanpa realtime -> lebih sering.
const POLL_LIVE_MS = 5 * 60 * 1000;
const POLL_OFFLINE_MS = 45 * 1000;
// Highlight "Baru" utk dokumen yang baru masuk antrian.
const FRESH_MS = 20 * 1000;

export interface QueueAccess {
  canValidate: boolean;
  canReceive: boolean;
}

export function getQueueAccess(profile: Profile | null): QueueAccess {
  return {
    // Sama dengan gate lama halaman ini.
    canValidate: isGADepartment(profile?.department) || isITAdmin(profile),
    // Sama dengan gate `isGA` di halaman detail PO.
    canReceive:
      isGADepartment(profile?.department) || profile?.role === "admin",
  };
}

export function useApprovalQueue() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [live, setLive] = useState<LiveStatus>("connecting");
  const [freshKeys, setFreshKeys] = useState<Set<string>>(new Set());

  const liveRef = useRef<LiveStatus>("connecting");
  const profileRef = useRef<Profile | null>(null);
  const knownKeysRef = useRef<Set<string> | null>(null);
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);
  const freshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    // Satu fetch berjalan pada satu waktu; permintaan saat sedang fetch
    // digabung jadi satu fetch susulan.
    if (inFlightRef.current) {
      pendingRef.current = true;
      return;
    }
    inFlightRef.current = true;
    setRefreshing(true);
    const supabase = createClient();

    try {
      let prof = profileRef.current;
      if (!prof) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Sesi login tidak ditemukan.");
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        prof = (data as Profile) ?? ({ id: user.id } as Profile);
        profileRef.current = prof;
        setProfile(prof);
      }

      const userId = prof.id;
      const access = getQueueAccess(prof);
      const empty = Promise.resolve([] as never[]);
      const [mrVal, poVal, mrApp, poApp, poRecv] = await Promise.all([
        access.canValidate ? fetchPendingValidationMRs() : empty,
        access.canValidate ? fetchPendingValidationPOs() : empty,
        fetchMyPendingMrApprovals(userId),
        fetchMyPendingPoApprovals(userId),
        access.canReceive ? fetchPosReadyForGaReceive() : empty,
      ]);

      const now = Date.now();
      const next: QueueItem[] = [
        ...(mrVal as MaterialRequest[]).map((m) =>
          fromMr(m, "mr-validation", userId, now),
        ),
        ...((poVal || []) as PurchaseOrder[]).map((p) =>
          fromPo(p, "po-validation", userId, now),
        ),
        ...mrApp.map((m) => fromMr(m, "mr-approval", userId, now)),
        ...poApp.map((p) => fromPo(p, "po-approval", userId, now)),
        ...(poRecv as PurchaseOrder[]).map((p) =>
          fromPo(p, "po-receive", userId, now),
        ),
      ];

      // Tandai dokumen yang baru masuk sejak muatan sebelumnya.
      const known = knownKeysRef.current;
      if (known) {
        const added = next.filter((i) => !known.has(i.key)).map((i) => i.key);
        if (added.length) {
          setFreshKeys((prev) => new Set([...prev, ...added]));
          if (freshTimerRef.current) clearTimeout(freshTimerRef.current);
          freshTimerRef.current = setTimeout(
            () => setFreshKeys(new Set()),
            FRESH_MS,
          );
        }
      }
      knownKeysRef.current = new Set(next.map((i) => i.key));

      setItems(next);
      setError(null);
      setLastUpdated(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data.");
    } finally {
      inFlightRef.current = false;
      setLoading(false);
      setRefreshing(false);
      if (pendingRef.current) {
        pendingRef.current = false;
        void load();
      }
    }
  }, []);

  // Debounce: satu aksi approval bisa memicu beberapa event beruntun.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefresh = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void load();
    }, DEBOUNCE_MS);
  }, [load]);

  // Muatan awal + realtime.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void load();

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      // Tanpa token, realtime konek sebagai anon dan RLS memblokir event.
      if (session?.access_token)
        await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;
      channel = supabase
        .channel(`approval-queue-${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "material_requests" },
          scheduleRefresh,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "purchase_orders" },
          scheduleRefresh,
        )
        .subscribe((status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") {
            // Tersambung lagi setelah putus -> ada event yang mungkin terlewat.
            if (liveRef.current === "offline") scheduleRefresh();
            liveRef.current = "live";
            setLive("live");
          } else if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            liveRef.current = "offline";
            setLive("offline");
          }
        });
    })();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (freshTimerRef.current) clearTimeout(freshTimerRef.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [load, scheduleRefresh]);

  // Tab aktif lagi / online lagi.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", scheduleRefresh);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", scheduleRefresh);
    };
  }, [scheduleRefresh]);

  // Fallback berkala (hanya saat tab terlihat).
  useEffect(() => {
    const id = setInterval(
      () => {
        if (document.visibilityState === "visible") void load();
      },
      live === "live" ? POLL_LIVE_MS : POLL_OFFLINE_MS,
    );
    return () => clearInterval(id);
  }, [live, load]);

  const countsByKind = items.reduce(
    (acc, i) => ({ ...acc, [i.kind]: (acc[i.kind] || 0) + 1 }),
    {} as Partial<Record<QueueKind, number>>,
  );

  return {
    profile,
    access: getQueueAccess(profile),
    items,
    countsByKind,
    loading,
    refreshing,
    error,
    lastUpdated,
    live,
    freshKeys,
    refresh: load,
  };
}
