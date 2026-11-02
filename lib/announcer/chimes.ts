"use client";

/**
 * lib/announcer/chimes.ts
 *
 * Nada pembuka & penutup Announcer Follow-up ala pengeras suara halte bus /
 * stasiun kereta: pembuka naik sebelum kalimat, penutup turun sesudahnya.
 * Disintesis Web Audio (tanpa file) dengan timbre bel/vibrafon - nada dasar
 * berdengung panjang + parsial atas yang cepat hilang sebagai bunyi ketukan.
 *
 * Disintesis di OfflineAudioContext jadi WAV, lalu diputar lewat elemen
 * <audio> yang sama dengan suara Google (lib/announcer/media-player.ts) -
 * di Safari, Web Audio yang diputar langsung bisa diam setelah elemen <audio>
 * dipakai. Pemutaran langsung via Web Audio cuma cadangan.
 *
 * Pilihan nada di pengaturan juga menerima preset notifikasi
 * (lib/notifications/sound.ts) & "none".
 */

import {
  SOUND_PRESETS,
  SoundPresetId,
  ensureAudioRunning,
  getCtx,
  playSound,
} from "@/lib/notifications/sound";
import { playMedia } from "./media-player";

const G4 = 392;
const C5 = 523.25;
const E5 = 659.25;
const F5 = 698.46;
const G5 = 783.99;
const A5 = 880;
const C6 = 1046.5;

export type ChimeDirection = "naik" | "turun";

type ChimeDef = {
  id: string;
  label: string;
  direction: ChimeDirection;
  notes: number[];
  /** Jarak antar nada (detik). */
  gap: number;
  /** Lama dengung tiap nada (detik). */
  ring: number;
  /** Timbre lebih tajam/berkilau. */
  bright?: boolean;
};

export const ANNOUNCER_CHIMES: ChimeDef[] = [
  {
    id: "halte",
    label: "Halte – 4 nada naik",
    direction: "naik",
    notes: [G4, C5, E5, G5],
    gap: 0.3,
    ring: 1.4,
  },
  {
    id: "halte_cerah",
    label: "Halte cerah – 4 nada naik",
    direction: "naik",
    notes: [C5, E5, G5, C6],
    gap: 0.2,
    ring: 1.1,
    bright: true,
  },
  {
    id: "stasiun",
    label: "Stasiun – 3 nada naik",
    direction: "naik",
    notes: [C5, E5, G5],
    gap: 0.45,
    ring: 1.6,
  },
  {
    id: "ding_dong",
    label: "Ding-dong",
    direction: "naik",
    notes: [A5, F5],
    gap: 0.5,
    ring: 1.6,
  },
  {
    id: "halte_turun",
    label: "Halte – 4 nada turun",
    direction: "turun",
    notes: [G5, E5, C5, G4],
    gap: 0.3,
    ring: 1.4,
  },
  {
    id: "halte_cerah_turun",
    label: "Halte cerah – 4 nada turun",
    direction: "turun",
    notes: [C6, G5, E5, C5],
    gap: 0.2,
    ring: 1.1,
    bright: true,
  },
  {
    id: "stasiun_turun",
    label: "Stasiun – 3 nada turun",
    direction: "turun",
    notes: [G5, E5, C5],
    gap: 0.45,
    ring: 1.6,
  },
  {
    id: "dong_ding",
    label: "Dong-ding",
    direction: "turun",
    notes: [F5, A5],
    gap: 0.5,
    ring: 1.6,
  },
];

// Perkiraan lama preset notifikasi (dimainkan lewat playSound).
const PRESET_DURATION_MS: Partial<Record<SoundPresetId, number>> = {
  pengumuman: 2000,
  doorbell: 1300,
  piano: 1100,
};
const DEFAULT_PRESET_DURATION_MS = 900;

/** Satu ketukan bel di `start` (waktu AudioContext). */
function strike(
  ctx: BaseAudioContext,
  out: AudioNode,
  freq: number,
  start: number,
  ring: number,
  bright: boolean,
) {
  const partials = bright
    ? [
        { mult: 1, gain: 1, dur: ring },
        { mult: 3, gain: 0.22, dur: ring * 0.35 },
        { mult: 6, gain: 0.07, dur: ring * 0.15 },
      ]
    : [
        { mult: 1, gain: 1, dur: ring },
        { mult: 2, gain: 0.16, dur: ring * 0.5 },
        { mult: 4, gain: 0.08, dur: ring * 0.2 },
      ];

  for (const p of partials) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq * p.mult, start);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(p.gain, start + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, start + p.dur);
    osc.connect(g);
    g.connect(out);
    osc.start(start);
    osc.stop(start + p.dur + 0.05);
  }
}

const findPreset = (id: string) =>
  SOUND_PRESETS.find((p) => p.id === id)?.id;

/**
 * Lama nada (ms) yang ditunggu sebelum lanjut bicara / ke pengumuman
 * berikutnya. Dengung nada terakhir dipotong di sini (sudah ~-48 dB), tidak
 * perlu ditunggu sampai benar-benar hilang. 0 = tidak ada nada.
 */
function chimeLengthMs(id: string): number {
  const def = ANNOUNCER_CHIMES.find((c) => c.id === id);
  if (def) {
    return Math.round(
      ((def.notes.length - 1) * def.gap + def.ring * 0.6) * 1000,
    );
  }
  const preset = findPreset(id);
  if (!preset) return 0;
  return PRESET_DURATION_MS[preset] ?? DEFAULT_PRESET_DURATION_MS;
}

/** Jadwalkan nada `id` di `ctx` mulai `start` (detik, waktu context). */
function scheduleChime(
  ctx: BaseAudioContext,
  id: string,
  volume: number,
  start: number,
) {
  const def = ANNOUNCER_CHIMES.find((c) => c.id === id);
  if (!def) {
    const preset = findPreset(id);
    if (preset) playSound(preset, volume, ctx);
    return;
  }
  const master = ctx.createGain();
  master.gain.value = 0.42 * Math.max(0, Math.min(1, volume));
  master.connect(ctx.destination);
  def.notes.forEach((freq, i) =>
    strike(ctx, master, freq, start + i * def.gap, def.ring, !!def.bright),
  );
}

// ─────────────────────────────────────────────
// Render ke WAV
// ─────────────────────────────────────────────

const SAMPLE_RATE = 44_100;
const FADE_OUT_S = 0.04;

/** AudioBuffer mono -> WAV PCM 16-bit. */
function encodeWav(buffer: AudioBuffer): Blob {
  const samples = buffer.getChannelData(0);
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true); // ukuran chunk fmt
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true); // byte per detik
  view.setUint16(32, 2, true); // byte per sampel
  view.setUint16(34, 16, true); // bit per sampel
  ascii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) =>
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true),
  );
  return new Blob([view.buffer], { type: "audio/wav" });
}

async function renderChime(id: string): Promise<string | null> {
  if (typeof window === "undefined" || !window.OfflineAudioContext) {
    return null;
  }
  const seconds = chimeLengthMs(id) / 1000;
  const ctx = new OfflineAudioContext(
    1,
    Math.ceil(seconds * SAMPLE_RATE),
    SAMPLE_RATE,
  );
  // Volume diatur di elemen <audio>, jadi render dengan volume penuh.
  scheduleChime(ctx, id, 1, 0);
  const buffer = await ctx.startRendering();

  // Dengung yang terpotong di akhir dibuat memudar supaya tidak "klik".
  const samples = buffer.getChannelData(0);
  const fade = Math.min(samples.length, Math.round(FADE_OUT_S * SAMPLE_RATE));
  for (let i = 0; i < fade; i++) {
    samples[samples.length - 1 - i] *= i / fade;
  }
  return URL.createObjectURL(encodeWav(buffer));
}

// id nada -> object URL WAV (null = render tidak didukung/gagal).
const rendered = new Map<string, Promise<string | null>>();

function renderedChime(id: string) {
  let url = rendered.get(id);
  if (!url) {
    url = renderChime(id).catch(() => null);
    rendered.set(id, url);
  }
  return url;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Mainkan nada `id` (nada announcer, preset notifikasi, atau "none").
 * Selesai (resolve) setelah nadanya habis - pemanggil menunggu ini sebelum
 * lanjut bicara / ke pengumuman berikutnya.
 */
export async function playChime(id: string, volume: number): Promise<void> {
  const ms = chimeLengthMs(id);
  if (!ms) return;

  const url = await renderedChime(id);
  if (url && (await playMedia(url, volume)) !== "error") return;

  // Cadangan: putar langsung lewat Web Audio.
  try {
    if (!(await ensureAudioRunning())) return;
    const ctx = getCtx();
    if (!ctx) return;
    scheduleChime(ctx, id, volume, ctx.currentTime + 0.02);
  } catch {
    // Non-kritis - abaikan error audio.
    return;
  }
  await sleep(ms);
}
