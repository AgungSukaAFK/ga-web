"use client";

/**
 * lib/announcer/media-player.ts
 *
 * Pemutar audio Announcer: suara Google (MP3) & nada pembuka/penutup (WAV,
 * dirender di lib/announcer/chimes.ts) diputar lewat SATU elemen <audio> yang
 * dipakai ulang, bukan Web Audio. Di Safari, Web Audio bisa "selesai" normal
 * tanpa ada suara yang keluar (AudioContext running tapi diam) - terutama
 * setelah elemen <audio> memutar sesuatu - sedangkan media element memutar
 * dengan andal di semua browser.
 *
 * Satu elemen karena browser yang mewajibkan gesture cukup di-unlock sekali
 * (unlockMediaPlayer, dipanggil dari klik "Mulai Standby" / klik halaman),
 * dan pemutarannya memang selalu bergantian (nada -> kalimat -> nada).
 */

import type { SpeakResult } from "./speech";

// WAV hening 10 ms, cuma untuk membuka kunci elemen di dalam gesture.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";

// Batas tunggu sampai audio mulai (metadata termuat); setelah itu batasnya
// durasi audio + kelonggaran.
const LOAD_TIMEOUT_MS = 10_000;

let player: HTMLAudioElement | null = null;
/** Akhiri pemutaran yang sedang jalan - dipanggil saat diganti audio lain. */
let interrupt: (() => void) | null = null;

function getPlayer(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!player) {
    player = new Audio();
    player.preload = "auto";
  }
  return player;
}

/** Panggil dari gesture user (klik/keydown). */
export function unlockMediaPlayer() {
  const el = getPlayer();
  if (!el || interrupt) return;
  el.src = SILENT_WAV;
  el.play().catch(() => {});
}

/**
 * Putar `url` (MP3/WAV, biasanya object URL) sampai habis. "error" =
 * diblokir/gagal diputar/dipotong audio lain.
 */
export function playMedia(url: string, volume: number): Promise<SpeakResult> {
  const el = getPlayer();
  if (!el) return Promise.resolve("error");
  interrupt?.();

  return new Promise((resolve) => {
    let finished = false;
    let watchdog = setTimeout(() => stop("timeout"), LOAD_TIMEOUT_MS);

    function finish(result: SpeakResult) {
      if (finished) return;
      finished = true;
      interrupt = null;
      clearTimeout(watchdog);
      el!.onloadedmetadata = el!.onended = el!.onerror = null;
      resolve(result);
    }
    function stop(result: SpeakResult) {
      el!.pause();
      finish(result);
    }
    // Elemennya langsung dipakai audio baru, jadi jangan di-pause.
    interrupt = () => finish("error");

    el.onloadedmetadata = () => {
      clearTimeout(watchdog);
      const seconds = Number.isFinite(el.duration) ? el.duration : 10;
      watchdog = setTimeout(() => stop("timeout"), (seconds + 3) * 1000);
    };
    el.onended = () => finish("ok");
    el.onerror = () => finish("error");

    el.pause();
    el.src = url;
    el.volume = Math.max(0, Math.min(1, volume));
    el.play().catch((err) => {
      if (finished) return; // AbortError karena sudah diganti audio lain
      // Mis. NotAllowedError: autoplay diblokir & elemen belum di-unlock.
      console.warn("[Announcer] Audio tidak bisa diputar:", err?.name);
      finish("error");
    });
  });
}
