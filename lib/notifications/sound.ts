"use client";

/**
 * lib/notifications/sound.ts
 *
 * Engine suara notifikasi (disintesis via Web Audio API — tanpa file, offline).
 * Dipakai bersama oleh NotificationProvider (saat notif masuk) dan halaman
 * profil (untuk preview saat user memilih sound).
 *
 * MENAMBAH SOUND BARU:
 *   1. Tambahkan id di SoundPresetId
 *   2. Daftarkan label di SOUND_PRESETS
 *   3. Tambahkan case-nya di playSound()
 */

// Satu AudioContext bersama. Browser memblokir audio sampai "di-unlock"
// lewat gesture user (klik/keydown). unlockAudio() dipanggil dari gesture itu.
let sharedAudioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedAudioCtx) sharedAudioCtx = new Ctor();
  return sharedAudioCtx;
}

/** Buka kunci audio — panggil dari gesture user pertama (klik/keydown). */
export function unlockAudio() {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
}

export type SoundPresetId =
  | "tritone"
  | "crystal"
  | "chime"
  | "marimba"
  | "ding"
  | "pop";

export const SOUND_PRESETS: { id: SoundPresetId; label: string }[] = [
  { id: "tritone", label: "Tri-tone (premium)" },
  { id: "crystal", label: "Crystal" },
  { id: "chime", label: "Chime" },
  { id: "marimba", label: "Marimba" },
  { id: "ding", label: "Ding" },
  { id: "pop", label: "Pop" },
];

/** Satu nada dengan envelope attack-decay yang halus. */
function tone(
  ctx: AudioContext,
  opts: {
    freq: number;
    start: number;
    dur: number;
    type: OscillatorType;
    peak: number;
    glideTo?: number; // opsional: sweep frekuensi (untuk efek "pop")
  },
) {
  const { freq, start, dur, type, peak, glideTo } = opts;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(ctx.destination);

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + dur);

  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(peak, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  osc.start(start);
  osc.stop(start + dur + 0.03);
}

/**
 * Mainkan sound notifikasi.
 * @param preset id sound
 * @param volume 0..1 (master volume dari pengaturan user)
 */
export function playSound(preset: SoundPresetId, volume = 0.6) {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const v = Math.max(0, Math.min(1, volume));
    const now = ctx.currentTime;

    switch (preset) {
      // Tri-tone menaik yang cerah & tegas (terinspirasi nada notif premium).
      case "tritone": {
        [659.25, 783.99, 1046.5].forEach((f, i) =>
          tone(ctx, {
            freq: f,
            start: now + i * 0.13,
            dur: 0.34,
            type: "triangle",
            peak: 0.6 * v,
          }),
        );
        break;
      }

      // Crystal — bell tinggi yang berkilau, decay panjang.
      case "crystal": {
        [1046.5, 1318.51, 1567.98].forEach((f, i) =>
          tone(ctx, {
            freq: f,
            start: now + i * 0.09,
            dur: 0.7,
            type: "sine",
            peak: 0.5 * v,
          }),
        );
        // sedikit harmonik di atas untuk efek "sparkle"
        tone(ctx, {
          freq: 2093,
          start: now + 0.05,
          dur: 0.5,
          type: "sine",
          peak: 0.18 * v,
        });
        break;
      }

      // Chime — dua nada lembut yang menenangkan.
      case "chime": {
        [587.33, 880].forEach((f, i) =>
          tone(ctx, {
            freq: f,
            start: now + i * 0.16,
            dur: 0.5,
            type: "sine",
            peak: 0.5 * v,
          }),
        );
        break;
      }

      // Marimba — hangat & perkusif, decay cepat.
      case "marimba": {
        [523.25, 783.99].forEach((f, i) =>
          tone(ctx, {
            freq: f,
            start: now + i * 0.11,
            dur: 0.22,
            type: "triangle",
            peak: 0.6 * v,
          }),
        );
        break;
      }

      // Ding — satu bell bersih dengan harmonik.
      case "ding": {
        tone(ctx, {
          freq: 880,
          start: now,
          dur: 0.6,
          type: "sine",
          peak: 0.55 * v,
        });
        tone(ctx, {
          freq: 1760,
          start: now,
          dur: 0.4,
          type: "sine",
          peak: 0.2 * v,
        });
        break;
      }

      // Pop — pendek & memantul (sweep naik singkat).
      case "pop": {
        tone(ctx, {
          freq: 420,
          start: now,
          dur: 0.13,
          type: "sine",
          peak: 0.6 * v,
          glideTo: 900,
        });
        break;
      }
    }
  } catch {
    // Non-kritis — abaikan error audio
  }
}
