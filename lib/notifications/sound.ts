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
 *   2. Daftarkan label & grup di SOUND_PRESETS
 *   3. Tambahkan case-nya di playSound()
 *
 * RINGTONE CUSTOM ("custom"): BEDA dari preset di atas - bukan disintesis,
 * tapi file audio asli (upload/rekaman) yang disimpan user sendiri di
 * IndexedDB device ini (lihat custom-sound-db.ts & components/
 * custom-ringtone-settings.tsx). Sengaja TIDAK masuk switch playSound() di
 * bawah (itu untuk preset sintesis yang playbacknya sinkron) - pemutarannya
 * lewat playCustomSound() sendiri (async, baca Blob dari IndexedDB dulu).
 * Pemanggil (NotificationProvider, notification-settings.tsx) yang
 * menentukan mana yang dipanggil berdasarkan settings.soundType === "custom".
 */

import { getCustomSoundUrl } from "./custom-sound-db";

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
  | "pop"
  | "softbell"
  | "harp"
  | "kalimba"
  | "droplet"
  | "twinkle"
  | "success"
  | "bubble"
  | "retro"
  | "whistle"
  | "doorbell"
  | "piano"
  | "alert"
  | "urgent"
  | "custom";

export type SoundPresetGroup = "Lembut" | "Ceria" | "Tegas";

export const SOUND_PRESET_GROUPS: SoundPresetGroup[] = [
  "Lembut",
  "Ceria",
  "Tegas",
];

export const SOUND_PRESETS: {
  id: SoundPresetId;
  label: string;
  group: SoundPresetGroup;
}[] = [
  { id: "chime", label: "Chime", group: "Lembut" },
  { id: "crystal", label: "Crystal", group: "Lembut" },
  { id: "ding", label: "Ding", group: "Lembut" },
  { id: "softbell", label: "Soft Bell", group: "Lembut" },
  { id: "harp", label: "Harp", group: "Lembut" },
  { id: "kalimba", label: "Kalimba", group: "Lembut" },
  { id: "droplet", label: "Droplet", group: "Lembut" },
  { id: "tritone", label: "Tri-tone (premium)", group: "Ceria" },
  { id: "marimba", label: "Marimba", group: "Ceria" },
  { id: "pop", label: "Pop", group: "Ceria" },
  { id: "twinkle", label: "Twinkle", group: "Ceria" },
  { id: "success", label: "Success", group: "Ceria" },
  { id: "bubble", label: "Bubble", group: "Ceria" },
  { id: "retro", label: "Retro 8-bit", group: "Ceria" },
  { id: "whistle", label: "Whistle", group: "Ceria" },
  { id: "doorbell", label: "Doorbell", group: "Tegas" },
  { id: "piano", label: "Piano Chord", group: "Tegas" },
  { id: "alert", label: "Alert", group: "Tegas" },
  { id: "urgent", label: "Urgent", group: "Tegas" },
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

      // Soft Bell — bell rendah yang hangat, decay panjang & pelan.
      case "softbell": {
        tone(ctx, {
          freq: 392,
          start: now,
          dur: 1.1,
          type: "sine",
          peak: 0.5 * v,
        });
        tone(ctx, {
          freq: 784,
          start: now,
          dur: 0.8,
          type: "sine",
          peak: 0.16 * v,
        });
        tone(ctx, {
          freq: 1176,
          start: now,
          dur: 0.5,
          type: "sine",
          peak: 0.06 * v,
        });
        break;
      }

      // Harp — glissando pentatonik menaik yang cepat & lembut.
      case "harp": {
        [523.25, 587.33, 659.25, 783.99, 880].forEach((f, i) =>
          tone(ctx, {
            freq: f,
            start: now + i * 0.055,
            dur: 0.55,
            type: "sine",
            peak: 0.38 * v,
          }),
        );
        break;
      }

      // Kalimba — petikan logam kecil: nada dasar + harmonik tinggi tipis.
      case "kalimba": {
        [659.25, 987.77].forEach((f, i) => {
          const start = now + i * 0.13;
          tone(ctx, {
            freq: f,
            start,
            dur: 0.35,
            type: "triangle",
            peak: 0.5 * v,
          });
          tone(ctx, {
            freq: f * 3,
            start,
            dur: 0.12,
            type: "sine",
            peak: 0.08 * v,
          });
        });
        break;
      }

      // Droplet — dua tetes air (sweep turun cepat).
      case "droplet": {
        tone(ctx, {
          freq: 1400,
          start: now,
          dur: 0.12,
          type: "sine",
          peak: 0.55 * v,
          glideTo: 600,
        });
        tone(ctx, {
          freq: 1800,
          start: now + 0.15,
          dur: 0.1,
          type: "sine",
          peak: 0.35 * v,
          glideTo: 850,
        });
        break;
      }

      // Twinkle — arpeggio tinggi 4 nada yang berkilau.
      case "twinkle": {
        [1046.5, 1318.51, 1567.98, 2093].forEach((f, i) =>
          tone(ctx, {
            freq: f,
            start: now + i * 0.07,
            dur: 0.35,
            type: "sine",
            peak: 0.4 * v,
          }),
        );
        break;
      }

      // Success — akor mayor naik, nada terakhir ditahan.
      case "success": {
        [523.25, 659.25, 783.99].forEach((f, i) =>
          tone(ctx, {
            freq: f,
            start: now + i * 0.09,
            dur: 0.2,
            type: "triangle",
            peak: 0.5 * v,
          }),
        );
        tone(ctx, {
          freq: 1046.5,
          start: now + 0.27,
          dur: 0.55,
          type: "triangle",
          peak: 0.55 * v,
        });
        break;
      }

      // Bubble — tiga gelembung "pop" yang makin tinggi.
      case "bubble": {
        [
          [300, 700],
          [400, 900],
          [520, 1150],
        ].forEach(([from, to], i) =>
          tone(ctx, {
            freq: from,
            start: now + i * 0.09,
            dur: 0.1,
            type: "sine",
            peak: 0.5 * v,
            glideTo: to,
          }),
        );
        break;
      }

      // Retro 8-bit — arpeggio square ala game jadul (volume ditekan,
      // gelombang square jauh lebih "keras" dari sine).
      case "retro": {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
          tone(ctx, {
            freq: f,
            start: now + i * 0.07,
            dur: 0.09,
            type: "square",
            peak: 0.22 * v,
          }),
        );
        break;
      }

      // Whistle — siulan naik lalu turun sedikit.
      case "whistle": {
        tone(ctx, {
          freq: 900,
          start: now,
          dur: 0.15,
          type: "sine",
          peak: 0.45 * v,
          glideTo: 1500,
        });
        tone(ctx, {
          freq: 1500,
          start: now + 0.17,
          dur: 0.2,
          type: "sine",
          peak: 0.45 * v,
          glideTo: 1100,
        });
        break;
      }

      // Doorbell — "ding-dong" klasik (E5 lalu C5).
      case "doorbell": {
        [659.25, 523.25].forEach((f, i) => {
          const start = now + i * 0.38;
          tone(ctx, { freq: f, start, dur: 0.8, type: "sine", peak: 0.55 * v });
          tone(ctx, {
            freq: f * 2,
            start,
            dur: 0.4,
            type: "sine",
            peak: 0.15 * v,
          });
        });
        break;
      }

      // Piano Chord — akor C mayor dibunyikan bersamaan.
      case "piano": {
        [523.25, 659.25, 783.99].forEach((f) => {
          tone(ctx, {
            freq: f,
            start: now,
            dur: 0.9,
            type: "triangle",
            peak: 0.3 * v,
          });
          tone(ctx, {
            freq: f * 2,
            start: now,
            dur: 0.35,
            type: "sine",
            peak: 0.06 * v,
          });
        });
        break;
      }

      // Alert — dua beep tegas, cocok untuk yang sering lewat notif.
      case "alert": {
        [0, 0.2].forEach((offset) =>
          tone(ctx, {
            freq: 880,
            start: now + offset,
            dur: 0.13,
            type: "square",
            peak: 0.25 * v,
          }),
        );
        break;
      }

      // Urgent — tiga beep cepat bernada tinggi.
      case "urgent": {
        [0, 0.12, 0.24].forEach((offset) =>
          tone(ctx, {
            freq: 1174.66,
            start: now + offset,
            dur: 0.08,
            type: "triangle",
            peak: 0.55 * v,
          }),
        );
        break;
      }
    }
  } catch {
    // Non-kritis — abaikan error audio
  }
}

/**
 * Mainkan ringtone custom (file audio asli, bukan sintesis) yang tersimpan
 * di IndexedDB device ini. Return `false` kalau belum ada ringtone custom
 * tersimpan (pemanggil bisa fallback ke preset lain / kasih tahu user).
 */
export async function playCustomSound(volume = 0.6): Promise<boolean> {
  try {
    const url = await getCustomSoundUrl();
    if (!url) return false;

    const audio = new Audio(url);
    audio.volume = Math.max(0, Math.min(1, volume));
    await audio.play();
    return true;
  } catch {
    // Non-kritis — abaikan error audio (mis. autoplay diblokir)
    return false;
  }
}
