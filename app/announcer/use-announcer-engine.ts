"use client";

/**
 * Mesin Announcer Follow-up: terima pengumuman baru dari
 * `followup_announcements`, saring per lokasi & jam aktif device ini, lalu
 * suarakan satu per satu (tidak pernah tumpang tindih).
 *
 * Supaya tidak ada yang terlewat:
 *  - Realtime (INSERT) sebagai jalur utama, langganan dibuat ulang otomatis
 *    kalau channel error/putus.
 *  - Polling cadangan (id > id terbesar yang sudah dilihat) - menutup celah
 *    saat websocket putus tanpa ketahuan.
 *  - Catch-up saat halaman dibuka ulang: id > id terakhir yang ditangani
 *    device ini (localStorage). Yang umurnya > CATCH_UP_MS cuma dicatat
 *    "Terlewat", tidak diputar, supaya PC yang mati semalaman tidak
 *    memborong pengumuman basi saat dinyalakan.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { playSound } from "@/lib/notifications/sound";
import {
  AnnouncerSettings,
  LOKASI_KOSONG,
  ejaanFromSettings,
  isWithinActiveHours,
  loadLastHandledId,
  saveLastHandledId,
} from "@/lib/announcer/settings";
import {
  AnnouncementTextData,
  buildAnnouncementText,
  pickFallbackVoice,
  pickVoice,
  speak,
} from "@/lib/announcer/speech";
import {
  fetchAnnouncementsAfter,
  fetchRecentAnnouncements,
} from "@/services/followupAnnouncementService";
import { FollowupAnnouncement } from "@/type";

// Polling cuma cadangan: jarang saat realtime sehat, rapat saat realtime
// putus (tiap request = 1 baris log Supabase).
const POLL_INTERVAL_ONLINE_MS = 30_000;
const POLL_INTERVAL_OFFLINE_MS = 10_000;
const CATCH_UP_MS = 10 * 60_000;
const MAX_ITEMS = 100;
const GAP_BETWEEN_ANNOUNCEMENTS_MS = 1500;
const GAP_BETWEEN_REPEATS_MS = 800;
const RESUBSCRIBE_MIN_MS = 5_000;
const RESUBSCRIBE_MAX_MS = 60_000;

// Lama nada pembuka sebelum kalimat mulai (perkiraan per preset).
const CHIME_WAIT_MS: Partial<Record<string, number>> = {
  pengumuman: 2000,
  doorbell: 1300,
  piano: 1100,
};
const DEFAULT_CHIME_WAIT_MS = 900;

export type AnnouncerItemStatus =
  | "menunggu"
  | "diputar"
  | "diumumkan"
  | "gagal"
  | "luar_jam"
  | "terlewat"
  | "beda_lokasi"
  | "riwayat";

export type AnnouncerItem = FollowupAnnouncement & {
  status: AnnouncerItemStatus;
};

// `manual` = putar ulang dari riwayat: tetap diputar walau di luar jam aktif.
type QueueItem = AnnouncerItem & { manual?: boolean };

export type RealtimeStatus = "connecting" | "online" | "reconnecting";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const matchesLokasi = (
  row: Pick<FollowupAnnouncement, "approver_lokasi">,
  lokasi: string[],
) => lokasi.includes(row.approver_lokasi || LOKASI_KOSONG);

/** Satu pengumuman: nada pembuka lalu kalimat diulang `repeat` kali. */
async function announce(
  data: AnnouncementTextData,
  settings: AnnouncerSettings,
  voices: SpeechSynthesisVoice[],
): Promise<boolean> {
  const text = buildAnnouncementText(
    settings.template,
    data,
    "speech",
    ejaanFromSettings(settings),
  );

  if (settings.chime !== "none") {
    playSound(settings.chime, settings.volume);
    await sleep(CHIME_WAIT_MS[settings.chime] ?? DEFAULT_CHIME_WAIT_MS);
  }

  let voice = pickVoice(voices, settings.voiceURI);
  let spoken = false;
  const repeat = Math.max(1, settings.repeat);
  for (let i = 0; i < repeat; i++) {
    const opts = {
      rate: settings.rate,
      pitch: settings.pitch,
      volume: settings.volume,
    };
    let result = await speak(text, { voice, ...opts });
    if (result === "error") {
      // Mis. suara Online (Natural) Edge saat internet putus -> pakai suara
      // Indonesia offline untuk sisa pengumuman ini.
      const fallback = pickFallbackVoice(voices, voice);
      if (fallback) {
        voice = fallback;
        result = await speak(text, { voice, ...opts });
      }
    }
    if (result === "ok") spoken = true;
    if (i < repeat - 1) await sleep(GAP_BETWEEN_REPEATS_MS);
  }
  return spoken;
}

export function useAnnouncerEngine({
  enabled,
  settings,
  voices,
}: {
  enabled: boolean;
  settings: AnnouncerSettings;
  voices: SpeechSynthesisVoice[];
}) {
  const [items, setItems] = useState<AnnouncerItem[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeStatus>("connecting");
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [queueLength, setQueueLength] = useState(0);

  // Dibaca dari callback async/realtime - selalu nilai terbaru.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const voicesRef = useRef(voices);
  voicesRef.current = voices;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const seenIdsRef = useRef(new Set<number>());
  const maxSeenIdRef = useRef(0);
  const queueRef = useRef<QueueItem[]>([]);
  const processingRef = useRef(false);
  const realtimeOnlineRef = useRef(false);

  const setItemStatus = useCallback(
    (id: number, status: AnnouncerItemStatus) =>
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, status } : it)),
      ),
    [],
  );

  // Simpan progres: semua id <= nilai ini sudah ditangani (diputar /
  // dilewati). Yang masih antre belum dianggap selesai, jadi kalau halaman
  // ditutup sebelum sempat diputar, dibuka lagi tetap ikut catch-up.
  const persistProgress = useCallback(() => {
    const queue = queueRef.current;
    const safeId = queue.length ? queue[0].id - 1 : maxSeenIdRef.current;
    if (safeId > 0) saveLastHandledId(safeId);
    setQueueLength(queue.length);
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      while (queueRef.current.length && enabledRef.current) {
        const item = queueRef.current[0];
        const s = settingsRef.current;

        // Antrean bisa menunggu lama - cek ulang jam aktif saat giliran.
        if (!item.manual && !isWithinActiveHours(s)) {
          queueRef.current.shift();
          setItemStatus(item.id, "luar_jam");
          persistProgress();
          continue;
        }

        setCurrentId(item.id);
        setItemStatus(item.id, "diputar");
        let ok = await announce(item, s, voicesRef.current);
        if (!ok && enabledRef.current) {
          await sleep(2000);
          ok = await announce(item, settingsRef.current, voicesRef.current);
        }
        queueRef.current.shift();
        setItemStatus(item.id, ok ? "diumumkan" : "gagal");
        setCurrentId(null);
        persistProgress();
        await sleep(GAP_BETWEEN_ANNOUNCEMENTS_MS);
      }
    } finally {
      processingRef.current = false;
      setCurrentId(null);
    }
  }, [persistProgress, setItemStatus]);

  const enqueue = useCallback(
    (item: QueueItem) => {
      const queue = queueRef.current;
      if (queue.some((q) => q.id === item.id)) return;
      queue.push(item);
      // Yang sedang diputar (index 0) jangan sampai tergeser.
      const [head, ...rest] = queue;
      queueRef.current = processingRef.current
        ? [head, ...rest.sort((a, b) => a.id - b.id)]
        : queue.sort((a, b) => a.id - b.id);
      setQueueLength(queueRef.current.length);
      processQueue();
    },
    [processQueue],
  );

  const handleRows = useCallback(
    (rows: FollowupAnnouncement[], viaRealtime: boolean) => {
      const fresh = rows
        .filter((r) => !seenIdsRef.current.has(r.id))
        .sort((a, b) => a.id - b.id);
      if (!fresh.length) return;

      const s = settingsRef.current;
      const activeNow = isWithinActiveHours(s);
      const newItems: AnnouncerItem[] = [];

      for (const row of fresh) {
        seenIdsRef.current.add(row.id);
        maxSeenIdRef.current = Math.max(maxSeenIdRef.current, row.id);

        const stale =
          !viaRealtime &&
          Date.now() - new Date(row.created_at).getTime() > CATCH_UP_MS;
        const status: AnnouncerItemStatus = !matchesLokasi(row, s.lokasi)
          ? "beda_lokasi"
          : !activeNow
            ? "luar_jam"
            : stale
              ? "terlewat"
              : "menunggu";

        newItems.push({ ...row, status });
      }

      setItems((prev) => [...prev, ...newItems].slice(-MAX_ITEMS));
      for (const item of newItems) {
        if (item.status === "menunggu") enqueue(item);
      }
      persistProgress();
    },
    [enqueue, persistProgress],
  );

  const poll = useCallback(async () => {
    try {
      const rows = await fetchAnnouncementsAfter(maxSeenIdRef.current);
      setLastSyncAt(new Date());
      setSyncError(null);
      handleRows(rows, false);
    } catch (err: any) {
      console.error("[Announcer] polling gagal:", err);
      setSyncError(err?.message || "Gagal sinkron");
    }
  }, [handleRows]);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let resubTimer: ReturnType<typeof setTimeout> | null = null;
    let resubDelay = RESUBSCRIBE_MIN_MS;

    const scheduleResubscribe = () => {
      if (cancelled || resubTimer) return;
      setRealtimeStatus("reconnecting");
      resubTimer = setTimeout(() => {
        resubTimer = null;
        subscribe();
      }, resubDelay);
      resubDelay = Math.min(resubDelay * 2, RESUBSCRIBE_MAX_MS);
    };

    const subscribe = async () => {
      if (channel) {
        const old = channel;
        channel = null;
        supabase.removeChannel(old);
      }

      // Kirim JWT user ke koneksi realtime - tanpa ini websocket konek
      // sebagai anon dan RLS memblokir semua event (lihat
      // NotificationProvider).
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;

      const ch = supabase
        .channel(`followup-announcer-${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "followup_announcements",
          },
          (payload) =>
            handleRows([payload.new as FollowupAnnouncement], true),
        )
        .subscribe((status, err) => {
          // Callback channel lama (sudah diganti/dilepas) diabaikan.
          if (ch !== channel) return;
          console.log("[Announcer] realtime status:", status, err ?? "");
          if (status === "SUBSCRIBED") {
            resubDelay = RESUBSCRIBE_MIN_MS;
            realtimeOnlineRef.current = true;
            setRealtimeStatus("online");
            // Tutup celah selama belum tersambung.
            poll();
          } else if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            realtimeOnlineRef.current = false;
            scheduleResubscribe();
          }
        });
      channel = ch;
    };

    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    const schedulePoll = () => {
      if (cancelled) return;
      pollTimer = setTimeout(
        async () => {
          await poll();
          schedulePoll();
        },
        realtimeOnlineRef.current
          ? POLL_INTERVAL_ONLINE_MS
          : POLL_INTERVAL_OFFLINE_MS,
      );
    };

    const init = async () => {
      // Isi awal: riwayat terbaru. Yang id-nya > id terakhir yang ditangani
      // device ini = terlewat saat halaman tertutup -> catch-up.
      try {
        const recent = await fetchRecentAnnouncements();
        if (cancelled) return;
        let lastHandled = loadLastHandledId();
        const maxRecentId = recent.length ? recent[recent.length - 1].id : 0;
        // Id tersimpan lebih besar dari data yang ada = database lain/di-reset
        // (mis. ganti DB lokal <-> production di localhost). Tanpa ini
        // pengumuman baru ber-id kecil tidak akan pernah diputar.
        if (lastHandled !== null && lastHandled > maxRecentId) {
          lastHandled = maxRecentId;
          saveLastHandledId(maxRecentId, true);
        }
        const history: AnnouncerItem[] = [];
        const missed: FollowupAnnouncement[] = [];

        for (const row of recent) {
          if (lastHandled === null || row.id <= lastHandled) {
            seenIdsRef.current.add(row.id);
            maxSeenIdRef.current = Math.max(maxSeenIdRef.current, row.id);
            history.push({ ...row, status: "riwayat" });
          } else {
            missed.push(row);
          }
        }
        // Device baru: semua yang sudah ada dianggap riwayat.
        if (lastHandled === null && maxSeenIdRef.current > 0) {
          saveLastHandledId(maxSeenIdRef.current);
        }
        if (lastHandled !== null) {
          maxSeenIdRef.current = Math.max(maxSeenIdRef.current, lastHandled);
        }

        setItems(history);
        handleRows(missed, false);
        setLastSyncAt(new Date());
        setSyncError(null);
      } catch (err: any) {
        console.error("[Announcer] gagal memuat riwayat:", err);
        setSyncError(err?.message || "Gagal memuat data");
      }
      if (cancelled) return;
      subscribe();
      schedulePoll();
    };

    init();

    const onOnline = () => {
      poll();
      scheduleResubscribe();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") poll();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    // Token baru (refresh tiap ~1 jam) diteruskan ke realtime supaya
    // channel tidak diputus server saat JWT lama kedaluwarsa.
    const { data: authSub } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "TOKEN_REFRESHED" && session?.access_token) {
          supabase.realtime.setAuth(session.access_token);
        }
      },
    );

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (resubTimer) clearTimeout(resubTimer);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      authSub.subscription.unsubscribe();
      if (channel) {
        const old = channel;
        channel = null;
        supabase.removeChannel(old);
      }
    };
  }, [enabled, handleRows, poll]);

  /** Putar ulang manual satu pengumuman dari riwayat. */
  const replay = useCallback(
    (id: number) => {
      const item = items.find((it) => it.id === id);
      if (!item || queueRef.current.some((q) => q.id === id)) return;
      setItemStatus(id, "menunggu");
      enqueue({ ...item, status: "menunggu", manual: true });
    },
    [items, enqueue, setItemStatus],
  );

  /** Tes suara dengan pengaturan saat ini - tidak masuk riwayat. */
  const test = useCallback(
    async (data: AnnouncementTextData, override?: AnnouncerSettings) => {
      if (processingRef.current) return false;
      processingRef.current = true;
      try {
        return await announce(
          data,
          override ?? settingsRef.current,
          voicesRef.current,
        );
      } finally {
        processingRef.current = false;
        // Pengumuman asli yang masuk selama tes tetap diputar.
        if (queueRef.current.length) processQueue();
      }
    },
    [processQueue],
  );

  return {
    items,
    currentId,
    queueLength,
    realtimeStatus,
    lastSyncAt,
    syncError,
    replay,
    test,
  };
}
