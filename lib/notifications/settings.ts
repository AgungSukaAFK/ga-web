"use client";

/**
 * lib/notifications/settings.ts
 *
 * Preferensi notifikasi per-device (disimpan di localStorage).
 * Default: notifikasi NYALA.
 *
 * Catatan: ini preferensi tampilan/alert sisi klien (sound, volume, dsb).
 * Notif tetap tersimpan di DB & badge tetap update walau alert dimatikan —
 * yang dikontrol di sini hanya pengalaman alert realtime (sound/browser/toast).
 */

import { useEffect, useState } from "react";
import { SoundPresetId } from "./sound";

export type NotifSettings = {
  /** Master: kalau false, tidak ada sound/browser/toast saat notif masuk. */
  enabled: boolean;
  /** Mainkan sound saat notif masuk. */
  sound: boolean;
  /** Volume sound, 0..1. */
  volume: number;
  /** Pilihan sound. */
  soundType: SoundPresetId;
  /** Tampilkan notifikasi browser (OS-level) saat tab tidak fokus. */
  browser: boolean;
};

export const DEFAULT_NOTIF_SETTINGS: NotifSettings = {
  enabled: true,
  sound: true,
  volume: 0.6,
  soundType: "tritone",
  browser: true,
};

const STORAGE_KEY = "ga-notif-settings";
const CHANGE_EVENT = "ga-notif-settings-changed";

export function loadNotifSettings(): NotifSettings {
  if (typeof window === "undefined") return DEFAULT_NOTIF_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_NOTIF_SETTINGS;
    // Merge dengan default supaya field baru tetap punya nilai.
    return { ...DEFAULT_NOTIF_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_NOTIF_SETTINGS;
  }
}

export function saveNotifSettings(settings: NotifSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    // Beritahu komponen lain (provider, dll) di tab yang sama.
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: settings }));
  } catch {
    // abaikan (mis. localStorage penuh / diblokir)
  }
}

/**
 * Hook React untuk membaca & mengubah pengaturan notifikasi.
 * Tersinkron antar komponen (event) dan antar tab (storage event).
 */
export function useNotifSettings() {
  const [settings, setSettings] = useState<NotifSettings>(
    DEFAULT_NOTIF_SETTINGS,
  );

  useEffect(() => {
    // Baca nilai asli setelah mount (hindari mismatch hidrasi SSR).
    setSettings(loadNotifSettings());

    const onChange = () => setSettings(loadNotifSettings());
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const update = (patch: Partial<NotifSettings>) => {
    const next = { ...loadNotifSettings(), ...patch };
    saveNotifSettings(next);
    setSettings(next);
  };

  return { settings, update };
}
