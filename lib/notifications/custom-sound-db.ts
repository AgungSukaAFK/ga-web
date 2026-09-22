"use client";

/**
 * lib/notifications/custom-sound-db.ts
 *
 * Penyimpanan ringtone custom notifikasi - 100% LOKAL di IndexedDB device
 * ini, file audio-nya TIDAK PERNAH dikirim/di-upload ke server (beda dari
 * attachment lain di app ini). Konsekuensinya: harus di-set ulang di tiap
 * device/browser yang dipakai (tidak sinkron), dan hilang kalau data situs
 * di-clear oleh user/browser.
 *
 * Cuma nyimpen SATU ringtone custom per device - cukup buat kebutuhan "1
 * nada custom pilihan saya", bukan library banyak nada.
 */

const DB_NAME = "ga-notif-custom-sound";
const STORE_NAME = "sound";
const RECORD_KEY = "current";

export interface CustomSoundRecord {
  blob: Blob;
  name: string;
  duration: number;
  savedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCustomSound(
  blob: Blob,
  name: string,
  duration: number,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const record: CustomSoundRecord = { blob, name, duration, savedAt: Date.now() };
    tx.objectStore(STORE_NAME).put(record, RECORD_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  invalidateUrlCache();
}

export async function getCustomSound(): Promise<CustomSoundRecord | null> {
  const db = await openDb();
  const result = await new Promise<CustomSoundRecord | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(RECORD_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function deleteCustomSound(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(RECORD_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  invalidateUrlCache();
}

// Cache object URL dalam memori supaya tiap notif masuk tidak perlu
// roundtrip baca IndexedDB ulang - cukup sekali per sesi tab, di-invalidate
// tiap kali ringtone-nya diganti/dihapus.
let cachedUrlPromise: Promise<string | null> | null = null;

function invalidateUrlCache() {
  cachedUrlPromise = null;
}

/** Object URL siap-pakai buat elemen <audio> - null kalau belum ada ringtone custom. */
export function getCustomSoundUrl(): Promise<string | null> {
  if (!cachedUrlPromise) {
    cachedUrlPromise = getCustomSound().then((rec) =>
      rec ? URL.createObjectURL(rec.blob) : null,
    );
  }
  return cachedUrlPromise;
}
