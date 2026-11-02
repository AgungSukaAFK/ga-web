"use client";

/**
 * Halaman standby Announcer Follow-up - dibuka di PC ber-speaker oleh akun
 * role `announcer` (admin juga bisa, untuk tes). Logika antrian/realtime di
 * use-announcer-engine.ts, pengaturan per device di
 * lib/announcer/settings.ts.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  VolumeX,
  Loader2,
  MapPin,
  Megaphone,
  Play,
  RotateCcw,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import {
  ensureAudioRunning,
  getAudioState,
  resetAudioContext,
  tryUnlockAudio,
  unlockAudio,
} from "@/lib/notifications/sound";
import {
  LOKASI_KOSONG,
  ejaanFromSettings,
  isWithinActiveHours,
  useAnnouncerSettings,
} from "@/lib/announcer/settings";
import {
  buildAnnouncementText,
  getSynth,
  indonesianVoices,
  isIndonesianVoice,
  loadVoices,
  pickVoice,
  voiceLabel,
} from "@/lib/announcer/speech";
import {
  GoogleVoice,
  fetchGoogleVoices,
  getGoogleTtsState,
  googleVoiceLabel,
  unlockGooglePlayback,
  useGoogleTtsState,
} from "@/lib/announcer/google-tts";
import {
  AnnouncerItemStatus,
  matchesLokasi,
  useAnnouncerEngine,
} from "./use-announcer-engine";
import {
  AnnouncerSettingsSheet,
  SAMPLE_ANNOUNCEMENT,
} from "./AnnouncerSettingsSheet";

const ALLOWED_ROLES = ["announcer", "admin"];

const STATUS_LABEL: Record<AnnouncerItemStatus, string> = {
  menunggu: "Antre",
  diputar: "Diumumkan…",
  diumumkan: "Diumumkan",
  gagal: "Gagal bersuara",
  luar_jam: "Di luar jam aktif",
  terlewat: "Terlewat",
  beda_lokasi: "Lokasi lain",
  riwayat: "Riwayat",
};

const STATUS_CLASS: Record<AnnouncerItemStatus, string> = {
  menunggu:
    "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300",
  diputar: "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-300",
  diumumkan:
    "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  gagal: "border-transparent bg-red-500/15 text-red-700 dark:text-red-300",
  luar_jam: "border-transparent bg-muted text-muted-foreground",
  terlewat: "border-transparent bg-muted text-muted-foreground",
  beda_lokasi: "border-transparent bg-muted text-muted-foreground",
  riwayat: "border-transparent bg-muted text-muted-foreground",
};

const DAY_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const GOOGLE_REFRESH_MS = 10 * 60_000;

const formatNumber = (n: number) => n.toLocaleString("id-ID");

function StatusCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5 rounded-lg border bg-card p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function QuotaBar({
  label,
  used,
  limit,
  charsPerAnnouncement,
}: {
  label: string;
  used: number;
  limit: number;
  charsPerAnnouncement: number;
}) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 100;
  const sisa = Math.max(0, limit - used);
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          sisa {formatNumber(sisa)} / {formatNumber(limit)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            pct >= 90
              ? "bg-red-500"
              : pct >= 70
                ? "bg-amber-500"
                : "bg-emerald-500",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        ± {formatNumber(Math.floor(sisa / Math.max(1, charsPerAnnouncement)))}{" "}
        pengumuman lagi
      </p>
    </div>
  );
}

const formatTime = (date: Date, withSeconds = false) =>
  date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    hour12: false,
  });

/** "Sen–Jum" untuk hari berurutan, selain itu didaftar satu-satu. */
function formatDays(days: number[]) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const sorted = order.filter((d) => days.includes(d));
  if (sorted.length === 0) return "Tidak ada hari";
  if (sorted.length === 7) return "Setiap hari";
  const indexes = sorted.map((d) => order.indexOf(d));
  const consecutive = indexes.every((v, i) => i === 0 || v === indexes[i - 1] + 1);
  if (consecutive && sorted.length > 2) {
    return `${DAY_SHORT[sorted[0]]}–${DAY_SHORT[sorted[sorted.length - 1]]}`;
  }
  return sorted.map((d) => DAY_SHORT[d]).join(", ");
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

const AUDIO_CHECK_MS = 2_000;
// Timer yang "telat" jauh melebihi intervalnya = komputer baru bangun dari
// sleep.
const WAKE_GAP_MS = 30_000;

/**
 * Jaga audio tetap hidup selama standby - terutama Safari, yang setelah Mac
 * sleep / ganti perangkat output bisa diam padahal AudioContext "running",
 * atau masuk state "interrupted". AudioContext dibuat ulang saat itu terjadi
 * (kalau sedang tidak ada suara yang diputar), dan klik/tombol apa pun di
 * halaman membangunkannya. Return state AudioContext untuk ditampilkan.
 */
function useAudioHealth(active: boolean, isPlaying: () => boolean) {
  const [audioState, setAudioState] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    const refresh = () => setAudioState(getAudioState());
    const resetIfIdle = () => {
      if (!isPlaying()) resetAudioContext().then(refresh);
    };

    let last = Date.now();
    const tick = setInterval(() => {
      const now = Date.now();
      if (
        document.visibilityState === "visible" &&
        now - last > WAKE_GAP_MS
      ) {
        resetIfIdle();
      }
      last = now;
      refresh();
    }, AUDIO_CHECK_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        ensureAudioRunning().then(refresh);
      }
    };
    const onGesture = () => {
      unlockAudio();
      unlockGooglePlayback();
      setTimeout(refresh, 300);
    };
    const devices = navigator.mediaDevices;
    devices?.addEventListener?.("devicechange", resetIfIdle);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    refresh();

    return () => {
      clearInterval(tick);
      devices?.removeEventListener?.("devicechange", resetIfIdle);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, [active, isPlaying]);

  return audioState;
}

// Layar & tab jangan tidur selama standby. Lock dilepas browser tiap tab
// tersembunyi, jadi diminta ulang saat terlihat lagi.
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const next = await navigator.wakeLock.request("screen");
        if (cancelled) next.release();
        else lock = next;
      } catch {
        // Ditolak (mis. baterai hemat) - non-kritis.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release();
    };
  }, [active]);
}

export default function AnnouncerClient() {
  const router = useRouter();
  const supabase = createClient();
  const [auth, setAuth] = useState<"loading" | "forbidden" | "ok">("loading");
  const [profile, setProfile] = useState<{
    nama: string | null;
    role: string | null;
  } | null>(null);
  const { settings, update, loaded } = useAnnouncerSettings();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [started, setStarted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showOtherLokasi, setShowOtherLokasi] = useState(false);
  const [googleVoices, setGoogleVoices] = useState<GoogleVoice[] | null>(null);
  const [googleVoicesError, setGoogleVoicesError] = useState<string | null>(
    null,
  );
  const googleTts = useGoogleTtsState();
  const now = useNow();

  useEffect(() => {
    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login?next=/announcer");
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("nama, role")
        .eq("id", user.id)
        .single();
      setProfile(data);
      setAuth(data && ALLOWED_ROLES.includes(data.role) ? "ok" : "forbidden");
    };
    check();
  }, [router, supabase]);

  useEffect(() => {
    const synth = getSynth();
    const refresh = () =>
      loadVoices().then((v) => {
        setVoices(v);
        setVoicesLoaded(true);
      });
    refresh();
    synth?.addEventListener("voiceschanged", refresh);
    return () => synth?.removeEventListener("voiceschanged", refresh);
  }, []);

  // Daftar suara Google + pemakaian kuota; diulang berkala supaya sisa kuota
  // di layar ikut terbarui walau dipakai PC announcer lain.
  useEffect(() => {
    if (auth !== "ok") return;
    const load = () =>
      fetchGoogleVoices()
        .then((v) => {
          setGoogleVoices(v);
          setGoogleVoicesError(null);
        })
        .catch((err) => setGoogleVoicesError(err.message));
    load();
    const t = setInterval(load, GOOGLE_REFRESH_MS);
    return () => clearInterval(t);
  }, [auth]);

  // PC yang dibuka dengan flag autoplay (lihat panduan di Pengaturan)
  // langsung standby tanpa perlu klik.
  useEffect(() => {
    if (auth !== "ok") return;
    tryUnlockAudio().then((ok) => {
      if (ok) setStarted(true);
    });
  }, [auth]);

  useWakeLock(started);

  const engine = useAnnouncerEngine({
    enabled: started && auth === "ok" && loaded,
    settings,
    voices,
  });

  const currentIdRef = useRef(engine.currentId);
  currentIdRef.current = engine.currentId;
  const isPlaying = useCallback(() => currentIdRef.current !== null, []);
  const audioState = useAudioHealth(started, isPlaying);

  const handleStart = () => {
    unlockAudio();
    unlockGooglePlayback();
    // Utterance kosong di dalam gesture klik "membuka" speechSynthesis di
    // browser yang mewajibkan aktivasi user.
    const synth = getSynth();
    if (synth) {
      const primer = new SpeechSynthesisUtterance(" ");
      primer.volume = 0;
      synth.speak(primer);
    }
    setStarted(true);
  };

  const handleTest = async (
    jenis: keyof typeof SAMPLE_ANNOUNCEMENT,
    cadangan = false,
  ) => {
    unlockAudio();
    unlockGooglePlayback();
    const ok = await engine.test(
      SAMPLE_ANNOUNCEMENT[jenis],
      cadangan ? { ...settings, engine: "browser" } : undefined,
    );
    if (!ok) {
      toast.error("Tes suara gagal", {
        description: cadangan
          ? "Suara cadangan tidak keluar. Pastikan browser punya suara Bahasa Indonesia (pakai Microsoft Edge) dan volume tidak nol."
          : "Suara tidak keluar. Cek pilihan suara, volume, atau tunggu pengumuman yang sedang diputar selesai.",
      });
    } else if (!cadangan && settings.engine === "google") {
      const { error } = getGoogleTtsState();
      if (error) {
        toast.warning("Google tidak dipakai, suara cadangan berhasil", {
          description: error,
        });
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const activeNow = now ? isWithinActiveHours(settings, now) : false;
  const hasIndonesianVoice = voices.some(isIndonesianVoice);
  const fallbackVoice = pickVoice(voices, settings.voiceURI);
  const offlineVoice = indonesianVoices(voices).find((v) => v.localService);
  const googleInUse =
    settings.engine === "google" &&
    !googleVoicesError &&
    googleTts.pausedUntil <= (now?.getTime() ?? 0);
  // Perkiraan karakter per pengumuman (kalimat diulang = 1x panggilan Google).
  const charsPerAnnouncement = buildAnnouncementText(
    settings.template,
    SAMPLE_ANNOUNCEMENT.material_request,
    "speech",
    ejaanFromSettings(settings),
  ).length;
  const current = engine.items.find((it) => it.id === engine.currentId);

  const lokasiSummary = useMemo(() => {
    if (settings.lokasi.length === 0) return "Belum pilih lokasi";
    const names = settings.lokasi.map((l) =>
      l === LOKASI_KOSONG ? "Tanpa lokasi" : l,
    );
    return names.length > 3
      ? `${names.slice(0, 3).join(", ")} +${names.length - 3}`
      : names.join(", ");
  }, [settings.lokasi]);

  const visibleItems = useMemo(
    () =>
      [...engine.items]
        .reverse()
        .filter(
          (it) => showOtherLokasi || matchesLokasi(it, settings.lokasi),
        ),
    [engine.items, showOtherLokasi, settings.lokasi],
  );

  if (auth === "loading") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (auth === "forbidden") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-4">
        <div className="max-w-sm space-y-4 text-center">
          <Megaphone className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Khusus akun Announcer</h1>
          <p className="text-sm text-muted-foreground">
            Halaman ini hanya untuk akun ber-role Announcer atau Admin.
          </p>
          <Button asChild>
            <Link href="/dashboard">Kembali ke Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  const connection = engine.syncError
    ? {
        label: "Gagal sinkron",
        dot: "bg-red-500",
        title: engine.syncError,
      }
    : engine.realtimeStatus === "online"
      ? { label: "Online", dot: "bg-emerald-500", title: "Realtime tersambung" }
      : {
          label: engine.realtimeStatus === "connecting" ? "Menyambung…" : "Menyambung ulang…",
          dot: "bg-amber-500",
          title: "Realtime belum tersambung - sementara dicek berkala tiap 10 detik",
        };

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Megaphone className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold leading-tight">
              Announcer Follow-up
            </h1>
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              {lokasiSummary}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {started && (
            <span
              title={connection.title}
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
            >
              <span className={cn("size-2 rounded-full", connection.dot)} />
              {connection.label}
            </span>
          )}
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs",
              activeNow
                ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                : "text-muted-foreground",
            )}
          >
            {activeNow ? "Jam aktif" : "Di luar jam aktif"} ·{" "}
            {settings.startTime}–{settings.endTime},{" "}
            {formatDays(settings.activeDays)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="mr-1.5 h-4 w-4" />
            Pengaturan
          </Button>
          {profile?.role === "admin" && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4 md:p-6">
        {started && audioState && audioState !== "running" && (
          <div className="flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
            <VolumeX className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <div>
              <p className="font-medium">
                Audio browser terhenti
                {audioState === "interrupted" && " (dihentikan Safari)"}
              </p>
              <p className="text-muted-foreground">
                Klik di mana saja di halaman ini untuk mengaktifkan lagi.
                Sementara itu pengumuman tetap diucapkan suara cadangan, tanpa
                nada pembuka/penutup.
              </p>
            </div>
          </div>
        )}
        {settings.lokasi.length === 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="flex-1">
              Belum ada lokasi yang dipilih, jadi tidak ada follow-up yang akan
              diumumkan di PC ini.
            </div>
            <Button size="sm" onClick={() => setSettingsOpen(true)}>
              Pilih lokasi
            </Button>
          </div>
        )}
        {voicesLoaded && !hasIndonesianVoice && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              Browser ini tidak punya suara Bahasa Indonesia, jadi tidak ada
              suara cadangan kalau Google gagal. Pakai Microsoft Edge
              (disarankan) atau Google Chrome.
            </div>
          </div>
        )}

        <section
          className={cn(
            "grid gap-3",
            settings.engine === "google" ? "md:grid-cols-3" : "md:grid-cols-2",
          )}
        >
          <StatusCard title="Mesin suara">
            {settings.engine === "google" ? (
              googleInUse ? (
                <>
                  <p className="truncate font-medium">
                    Google · {googleVoiceLabel(settings.googleVoice)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Kalau gagal, otomatis pakai suara cadangan
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-amber-700 dark:text-amber-300">
                    Sementara pakai suara cadangan
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {googleTts.error ?? googleVoicesError}
                  </p>
                </>
              )
            ) : (
              <>
                <p className="font-medium">Browser saja</p>
                <p className="text-xs text-muted-foreground">
                  Google Cloud tidak dipakai
                </p>
              </>
            )}
          </StatusCard>

          {settings.engine === "google" && (
            <StatusCard title="Kuota gratis Google (karakter)">
              {googleTts.usage ? (
                <>
                  <QuotaBar
                    label="Hari ini"
                    used={googleTts.usage.today}
                    limit={googleTts.usage.dailyLimit}
                    charsPerAnnouncement={charsPerAnnouncement}
                  />
                  <QuotaBar
                    label="Bulan ini"
                    used={googleTts.usage.month}
                    limit={googleTts.usage.monthlyLimit}
                    charsPerAnnouncement={charsPerAnnouncement}
                  />
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {googleVoicesError
                    ? "Tidak tersedia"
                    : googleVoices
                      ? "Data pemakaian belum tersedia"
                      : "Memuat…"}
                </p>
              )}
            </StatusCard>
          )}

          <StatusCard title="Suara cadangan">
            {fallbackVoice ? (
              <p className="truncate font-medium">{voiceLabel(fallbackVoice)}</p>
            ) : (
              <p className="font-medium text-red-600 dark:text-red-400">
                Tidak ada suara Indonesia
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {offlineVoice
                ? `Tanpa internet: ${voiceLabel(offlineVoice)}`
                : "Belum ada suara offline (lihat Pengaturan)"}
            </p>
          </StatusCard>
        </section>

        <section className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-[auto_1fr] md:items-center md:gap-8 md:p-6">
          <div>
            <p className="text-5xl font-semibold tabular-nums tracking-tight md:text-6xl">
              {now ? formatTime(now, true) : "--.--.--"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {now?.toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="min-w-0 md:border-l md:pl-8">
            {current ? (
              <>
                <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-60 motion-reduce:hidden" />
                    <span className="relative inline-flex size-2 rounded-full bg-blue-500" />
                  </span>
                  Sedang diumumkan
                </p>
                <p className="mt-2 text-2xl font-semibold leading-snug md:text-3xl">
                  {buildAnnouncementText(settings.template, current, "display")}
                </p>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {current.kode}
                  {current.requested_by_nama &&
                    ` · diminta ${current.requested_by_nama}`}
                </p>
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  Standby
                </p>
                <p className="mt-2 text-xl font-medium md:text-2xl">
                  Menunggu follow-up approval…
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {engine.lastSyncAt
                    ? `Sinkron terakhir ${formatTime(engine.lastSyncAt, true)}`
                    : "Belum sinkron"}
                </p>
              </>
            )}
            {engine.queueLength > 1 && (
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                {engine.queueLength - 1} pengumuman lagi dalam antrean
              </p>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Riwayat follow-up</h2>
            <div className="flex items-center gap-2">
              <Checkbox
                id="show-other-lokasi"
                checked={showOtherLokasi}
                onCheckedChange={(v) => setShowOtherLokasi(!!v)}
              />
              <Label
                htmlFor="show-other-lokasi"
                className="cursor-pointer text-xs font-normal text-muted-foreground"
              >
                Tampilkan lokasi lain
              </Label>
            </div>
          </div>

          {visibleItems.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Belum ada follow-up.
            </p>
          ) : (
            <ul className="space-y-2">
              {visibleItems.map((it) => (
                <li
                  key={it.id}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3",
                    it.status === "diputar" && "border-blue-500/50 bg-blue-500/5",
                  )}
                >
                  <div className="w-12 shrink-0 pt-0.5 text-sm tabular-nums text-muted-foreground">
                    {formatTime(new Date(it.created_at))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">
                      {buildAnnouncementText(settings.template, it, "display")}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {it.kode} · {it.approver_lokasi || "Tanpa lokasi"}
                      {it.requested_by_nama &&
                        ` · diminta ${it.requested_by_nama}`}
                    </p>
                  </div>
                  <Badge className={cn("shrink-0", STATUS_CLASS[it.status])}>
                    {STATUS_LABEL[it.status]}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    title="Putar ulang"
                    aria-label="Putar ulang"
                    disabled={
                      !started ||
                      it.status === "menunggu" ||
                      it.status === "diputar"
                    }
                    onClick={() => engine.replay(it.id)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {!started && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/95 px-4 backdrop-blur-sm">
          <div className="max-w-md space-y-5 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Megaphone className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">Siap standby</h2>
              <p className="text-sm text-muted-foreground">
                Browser butuh satu klik sebelum boleh mengeluarkan suara. Klik
                tombol di bawah, lalu biarkan halaman ini tetap terbuka.
              </p>
            </div>
            <Button size="lg" onClick={handleStart}>
              <Play className="mr-2 h-5 w-5" />
              Mulai Standby
            </Button>
            <p className="text-xs text-muted-foreground">
              Supaya langsung aktif setelah PC restart tanpa klik, lihat
              &quot;Setup PC announcer&quot; di{" "}
              <button
                type="button"
                className="underline underline-offset-2"
                onClick={() => setSettingsOpen(true)}
              >
                Pengaturan
              </button>
              .
            </p>
          </div>
        </div>
      )}

      <AnnouncerSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        update={update}
        voices={voices}
        googleVoices={googleVoices}
        googleVoicesError={googleVoicesError}
        onTest={handleTest}
        onLogout={handleLogout}
      />
    </div>
  );
}
