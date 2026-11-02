"use client";

/**
 * lib/announcer/settings.ts
 *
 * Pengaturan Announcer Follow-up PER DEVICE (localStorage) - tiap PC
 * announcer bisa beda lokasi, jam kerja (WIB/WITA/WIT ikut jam PC-nya), dan
 * suara (daftar suara TTS memang beda tiap browser/OS). Pola sama dengan
 * lib/notifications/settings.ts.
 */

import { useEffect, useState } from "react";
import type { SoundPresetId } from "@/lib/notifications/sound";

/** Nilai khusus di `lokasi` untuk approver yang lokasi profilnya kosong. */
export const LOKASI_KOSONG = "__kosong__";

export const DEFAULT_TEMPLATE =
  "Menunggu approval {jenis}, {sapaan} {approver}, dengan kode {kode}";

export type AnnouncerSettings = {
  /** Lokasi profil approver yang diumumkan di device ini. Kosong = belum dipilih, tidak ada yang bunyi. */
  lokasi: string[];
  /** Hari aktif, 0 = Minggu ... 6 = Sabtu (sama dengan Date.getDay()). */
  activeDays: number[];
  /** "HH:MM", jam lokal PC. */
  startTime: string;
  endTime: string;
  /** voiceURI SpeechSynthesisVoice. null = pilih otomatis suara Indonesia terbaik. */
  voiceURI: string | null;
  rate: number;
  pitch: number;
  /** 0..1, berlaku untuk suara & nada pembuka. */
  volume: number;
  /** Nada sebelum kalimat. "none" = langsung bicara. */
  chime: Exclude<SoundPresetId, "custom"> | "none";
  /** Kalimat diucapkan berapa kali per pengumuman. */
  repeat: number;
  template: string;
};

export const DEFAULT_ANNOUNCER_SETTINGS: AnnouncerSettings = {
  lokasi: [],
  activeDays: [1, 2, 3, 4, 5],
  startTime: "08:00",
  endTime: "17:00",
  voiceURI: null,
  rate: 0.9,
  pitch: 1,
  volume: 1,
  chime: "pengumuman",
  repeat: 2,
  template: DEFAULT_TEMPLATE,
};

const STORAGE_KEY = "ga-announcer-settings";
const CHANGE_EVENT = "ga-announcer-settings-changed";

export function loadAnnouncerSettings(): AnnouncerSettings {
  if (typeof window === "undefined") return DEFAULT_ANNOUNCER_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ANNOUNCER_SETTINGS;
    // Merge dengan default supaya field baru tetap punya nilai.
    return { ...DEFAULT_ANNOUNCER_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_ANNOUNCER_SETTINGS;
  }
}

export function saveAnnouncerSettings(settings: AnnouncerSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: settings }));
  } catch {
    // abaikan (mis. localStorage penuh / diblokir)
  }
}

export function useAnnouncerSettings() {
  const [settings, setSettings] = useState<AnnouncerSettings>(
    DEFAULT_ANNOUNCER_SETTINGS,
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Baca nilai asli setelah mount (hindari mismatch hidrasi SSR).
    setSettings(loadAnnouncerSettings());
    setLoaded(true);

    const onChange = () => setSettings(loadAnnouncerSettings());
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const update = (patch: Partial<AnnouncerSettings>) => {
    const next = { ...loadAnnouncerSettings(), ...patch };
    saveAnnouncerSettings(next);
    setSettings(next);
  };

  return { settings, update, loaded };
}

// ID pengumuman terakhir yang sudah ditangani device ini (diputar atau
// dilewati). Dipakai saat halaman dibuka ulang/reconnect untuk tahu mana
// yang terlewat.
const LAST_ID_KEY = "ga-announcer-last-id";

export function loadLastHandledId(): number | null {
  try {
    const raw = localStorage.getItem(LAST_ID_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Cuma bisa naik, kecuali `force` (mis. database di-reset, id mulai dari kecil lagi). */
export function saveLastHandledId(id: number, force = false) {
  try {
    const current = loadLastHandledId();
    if (force || current === null || id > current) {
      localStorage.setItem(LAST_ID_KEY, String(id));
    }
  } catch {
    // abaikan
  }
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * Apakah `date` (jam lokal PC) masuk jam & hari aktif. Jam selesai tidak
 * termasuk (17:00 sudah di luar). Kalau jam mulai > jam selesai, dianggap
 * melewati tengah malam (mis. 20:00-06:00) dan harinya ikut hari mulai.
 */
export function isWithinActiveHours(
  settings: Pick<AnnouncerSettings, "activeDays" | "startTime" | "endTime">,
  date = new Date(),
): boolean {
  const start = toMinutes(settings.startTime);
  const end = toMinutes(settings.endTime);
  const now = date.getHours() * 60 + date.getMinutes();
  const day = date.getDay();

  if (start === end) return false;
  if (start < end) {
    return settings.activeDays.includes(day) && now >= start && now < end;
  }
  if (now >= start) return settings.activeDays.includes(day);
  if (now < end) return settings.activeDays.includes((day + 6) % 7);
  return false;
}
