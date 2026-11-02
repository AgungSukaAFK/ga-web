"use client";

/**
 * lib/announcer/chimes.ts
 *
 * Nada pembuka & penutup Announcer Follow-up ala pengeras suara halte bus /
 * stasiun kereta: pembuka naik sebelum kalimat, penutup turun sesudahnya.
 * Disintesis Web Audio (tanpa file) dengan timbre bel/vibrafon - nada dasar
 * berdengung panjang + parsial atas yang cepat hilang sebagai bunyi ketukan.
 *
 * Pilihan nada di pengaturan juga menerima preset notifikasi
 * (lib/notifications/sound.ts) & "none".
 */

import {
  SOUND_PRESETS,
  SoundPresetId,
  getCtx,
  playSound,
} from "@/lib/notifications/sound";

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
  ctx: AudioContext,
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

/**
 * Mainkan nada `id` (nada announcer, preset notifikasi, atau "none").
 * Return lama nada dalam ms - pemanggil menunggu segini sebelum lanjut
 * bicara / ke pengumuman berikutnya.
 */
export function playChime(id: string, volume: number): number {
  if (!id || id === "none") return 0;

  const def = ANNOUNCER_CHIMES.find((c) => c.id === id);
  if (!def) {
    if (!SOUND_PRESETS.some((p) => p.id === id)) return 0;
    playSound(id as SoundPresetId, volume);
    return (
      PRESET_DURATION_MS[id as SoundPresetId] ?? DEFAULT_PRESET_DURATION_MS
    );
  }

  try {
    const ctx = getCtx();
    if (!ctx) return 0;
    if ((ctx.state as string) !== "running") ctx.resume().catch(() => {});

    const master = ctx.createGain();
    master.gain.value = 0.42 * Math.max(0, Math.min(1, volume));
    master.connect(ctx.destination);

    const now = ctx.currentTime + 0.02;
    def.notes.forEach((freq, i) =>
      strike(ctx, master, freq, now + i * def.gap, def.ring, !!def.bright),
    );
  } catch {
    // Non-kritis - abaikan error audio.
    return 0;
  }

  // Nada terakhir tidak perlu ditunggu sampai benar-benar hilang.
  return Math.round(((def.notes.length - 1) * def.gap + def.ring * 0.6) * 1000);
}
