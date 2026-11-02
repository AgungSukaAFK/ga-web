"use client";

/**
 * lib/announcer/google-tts.ts
 *
 * Suara Google Cloud Text-to-Speech untuk Announcer Follow-up, lewat
 * app/api/announcer/tts/route.ts (API key cuma di server). Audio (MP3)
 * diputar lewat elemen <audio> - lihat bagian "Pemutaran" di bawah untuk
 * kenapa bukan Web Audio.
 *
 * Gagal = pemanggil memakai suara cadangan (browser). Supaya pengumuman
 * berikutnya tidak ikut menunggu timeout, Google lalu DIJEDA: sampai kuota
 * tersedia lagi kalau penyebabnya batas kuota, atau PAUSE_AFTER_ERROR_MS untuk
 * error lain. Status (sisa kuota, error, jeda) ditampilkan di halaman
 * announcer lewat useGoogleTtsState().
 */

import { useSyncExternalStore } from "react";
import type { SpeakResult } from "./speech";

export type GoogleVoice = { name: string; gender: string };

export type TtsUsage = {
  today: number;
  month: number;
  dailyLimit: number;
  monthlyLimit: number;
};

const API_URL = "/api/announcer/tts";
const REQUEST_TIMEOUT_MS = 6_000;
const PAUSE_AFTER_ERROR_MS = 2 * 60_000;

// ─────────────────────────────────────────────
// Status (dibaca UI)
// ─────────────────────────────────────────────

export type GoogleTtsState = {
  usage: TtsUsage | null;
  /** Pesan siap tampil, null = panggilan terakhir berhasil. */
  error: string | null;
  quotaReached: "daily_limit" | "monthly_limit" | null;
  /** Epoch ms - sebelum ini Google dilewati & langsung pakai suara cadangan. */
  pausedUntil: number;
};

const INITIAL_STATE: GoogleTtsState = {
  usage: null,
  error: null,
  quotaReached: null,
  pausedUntil: 0,
};
let state = INITIAL_STATE;
const listeners = new Set<() => void>();

function setState(patch: Partial<GoogleTtsState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const getGoogleTtsState = () => state;

export function useGoogleTtsState(): GoogleTtsState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => INITIAL_STATE,
  );
}

// Kuota dihitung per tanggal UTC di database (lihat 0017_announcer_tts.sql).
function nextQuotaReset(reason: "daily_limit" | "monthly_limit") {
  const now = new Date();
  return reason === "daily_limit"
    ? Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    : Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
}

const QUOTA_TEXT = {
  daily_limit: "Kuota Google hari ini habis",
  monthly_limit: "Kuota gratis Google bulan ini habis",
};

const ERROR_TEXT: Record<string, string> = {
  not_configured: "GOOGLE_TTS_API_KEY belum diisi di server",
  forbidden: "akun ini tidak punya akses",
};

async function readError(res: Response) {
  try {
    const body = await res.json();
    if (body?.usage) setState({ usage: body.usage });
    return {
      code: body?.error as string | undefined,
      message: ERROR_TEXT[body?.error] ?? body?.error ?? `HTTP ${res.status}`,
    };
  } catch {
    return { code: undefined, message: `HTTP ${res.status}` };
  }
}

function pauseAfterFailure(code: string | undefined, message: string) {
  if (code === "daily_limit" || code === "monthly_limit") {
    setState({
      error: QUOTA_TEXT[code],
      quotaReached: code,
      pausedUntil: nextQuotaReset(code),
    });
  } else {
    setState({
      error: message,
      quotaReached: null,
      pausedUntil: Date.now() + PAUSE_AFTER_ERROR_MS,
    });
  }
}

// ─────────────────────────────────────────────
// API
// ─────────────────────────────────────────────

/** Daftar suara id-ID + pemakaian kuota terbaru. */
export async function fetchGoogleVoices(): Promise<GoogleVoice[]> {
  const res = await fetch(API_URL);
  if (!res.ok) {
    const { message } = await readError(res);
    throw new Error(message);
  }
  const body = await res.json();
  if (body.usage) setState({ usage: body.usage });
  return body.voices ?? [];
}

// HD (Chirp 3) paling natural, lalu WaveNet, lalu Standard.
const tierOf = (name: string) =>
  name.includes("Chirp3-HD") ? 0 : name.includes("Wavenet") ? 1 : 2;

export const sortGoogleVoices = (voices: GoogleVoice[]) =>
  [...voices].sort(
    (a, b) => tierOf(a.name) - tierOf(b.name) || a.name.localeCompare(b.name),
  );

/** "id-ID-Chirp3-HD-Charon" -> "Charon (HD, paling natural)". */
export function googleVoiceLabel(name: string): string {
  const short = name.replace(/^id-ID-/, "");
  const hd = short.match(/^Chirp3-HD-(.+)$/);
  if (hd) return `${hd[1]} (HD, paling natural)`;
  const [tier, variant] = short.split("-");
  return `${tier === "Wavenet" ? "WaveNet" : tier} ${variant ?? ""}`.trim();
}

/** Suara Chirp 3 HD tidak mendukung pengaturan nada. */
export const googleVoiceSupportsPitch = (name: string) =>
  !name.includes("Chirp");

// ─────────────────────────────────────────────
// Pemutaran
// ─────────────────────────────────────────────
//
// Lewat SATU elemen <audio> yang dipakai ulang, bukan Web Audio: di Safari,
// AudioBufferSourceNode bisa "selesai" normal tanpa ada suara yang keluar
// (AudioContext running tapi diam), sedangkan media element memutar MP3
// dengan andal di semua browser. Elemen yang sama dipakai terus karena
// browser yang mewajibkan gesture cukup di-unlock sekali
// (unlockGooglePlayback, dipanggil dari klik "Mulai Standby" / klik halaman).

// WAV hening 10 ms, cuma untuk membuka kunci elemen di dalam gesture.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";

let player: HTMLAudioElement | null = null;
let playing = false;

function getPlayer(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!player) {
    player = new Audio();
    player.preload = "auto";
  }
  return player;
}

/** Panggil dari gesture user (klik/keydown). */
export function unlockGooglePlayback() {
  const el = getPlayer();
  if (!el || playing) return;
  el.src = SILENT_WAV;
  el.play().catch(() => {});
}

// Kalimat yang diulang ("Diucapkan 2x") & tes berulang tidak memanggil API
// lagi. Nilainya object URL Blob MP3, di-revoke saat keluar dari cache.
const CACHE_MAX = 20;
const cache = new Map<string, string>();

/**
 * Ambil audio satu kalimat (object URL MP3). Lempar error (pesan siap tampil)
 * kalau gagal atau Google sedang dijeda - pemanggil memakai suara cadangan.
 */
export async function synthesizeGoogle(
  text: string,
  opts: { voice: string; rate: number; pitch: number },
): Promise<string> {
  // Pitch pengaturan 0.5..1.5 -> semitone Google -10..+10.
  const semitones = Math.round((opts.pitch - 1) * 200) / 10;
  const key = `${opts.voice}|${opts.rate}|${semitones}|${text}`;
  const hit = cache.get(key);
  if (hit) return hit;

  if (Date.now() < state.pausedUntil) {
    throw new Error(state.error ?? "Google TTS sedang dijeda");
  }

  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voice: opts.voice,
        rate: opts.rate,
        pitch: semitones,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    const message = "tidak tersambung ke server suara Google";
    pauseAfterFailure(undefined, message);
    throw new Error(message);
  }

  if (!res.ok) {
    const { code, message } = await readError(res);
    pauseAfterFailure(code, message);
    throw new Error(state.error ?? message);
  }

  const usageHeader = res.headers.get("X-TTS-Usage");
  let url: string;
  try {
    url = URL.createObjectURL(await res.blob());
  } catch {
    const message = "audio dari Google tidak terunduh utuh";
    pauseAfterFailure(undefined, message);
    throw new Error(message);
  }

  cache.set(key, url);
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value!;
    URL.revokeObjectURL(cache.get(oldest)!);
    cache.delete(oldest);
  }
  setState({
    error: null,
    quotaReached: null,
    pausedUntil: 0,
    ...(usageHeader ? { usage: JSON.parse(usageHeader) } : {}),
  });
  return url;
}

// Batas tunggu sampai audio mulai (metadata termuat); setelah itu batasnya
// durasi audio + kelonggaran.
const LOAD_TIMEOUT_MS = 10_000;

/** Putar audio hasil synthesizeGoogle. "error" = diblokir/gagal diputar. */
export function playGoogleAudio(
  url: string,
  volume: number,
): Promise<SpeakResult> {
  const el = getPlayer();
  if (!el) return Promise.resolve("error");

  return new Promise((resolve) => {
    let finished = false;
    let watchdog = setTimeout(() => stop("timeout"), LOAD_TIMEOUT_MS);

    function finish(result: SpeakResult) {
      if (finished) return;
      finished = true;
      playing = false;
      clearTimeout(watchdog);
      el!.onloadedmetadata = el!.onended = el!.onerror = null;
      resolve(result);
    }
    function stop(result: SpeakResult) {
      el!.pause();
      finish(result);
    }

    el.onloadedmetadata = () => {
      clearTimeout(watchdog);
      const seconds = Number.isFinite(el.duration) ? el.duration : 10;
      watchdog = setTimeout(() => stop("timeout"), (seconds + 3) * 1000);
    };
    el.onended = () => finish("ok");
    el.onerror = () => finish("error");

    playing = true;
    el.pause();
    el.src = url;
    el.volume = Math.max(0, Math.min(1, volume));
    el.play().catch((err) => {
      // Mis. NotAllowedError: autoplay diblokir & elemen belum di-unlock.
      console.warn("[Announcer] Audio Google tidak bisa diputar:", err?.name);
      finish("error");
    });
  });
}
