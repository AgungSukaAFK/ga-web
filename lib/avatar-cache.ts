"use client";

// Cache foto profil user lain (userId -> avatar_url) untuk <UserAvatar>.
// Diskusi (jsonb) & jalur approval cuma menyimpan userid + nama, jadi URL
// fotonya dicari di sini. Semua permintaan dalam 1 tick digabung jadi SATU
// query `profiles.in(id, [...])`, dan hasilnya di-cache selama sesi tab
// (termasuk yang tidak punya foto = null) supaya tidak query berulang.

import { createClient } from "@/lib/supabase/client";

const CHUNK = 100;

// undefined = belum diketahui, null = user tanpa foto.
const cache = new Map<string, string | null>();
const inflight = new Set<string>();
const pending = new Set<string>();
const listeners = new Set<() => void>();
let scheduled = false;

function notify() {
  listeners.forEach((l) => l());
}

async function flush() {
  scheduled = false;
  const ids = Array.from(pending);
  pending.clear();
  ids.forEach((id) => inflight.add(id));

  const supabase = createClient();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { data } = await supabase
      .from("profiles")
      .select("id, avatar_url")
      .in("id", chunk);
    const found = new Map(
      (data ?? []).map((p) => [
        p.id as string,
        (p.avatar_url as string) || null,
      ]),
    );
    // Gagal / tidak ketemu -> null, supaya tidak di-retry terus (fallback
    // inisial tetap tampil).
    chunk.forEach((id) => {
      cache.set(id, found.get(id) ?? null);
      inflight.delete(id);
    });
  }
  notify();
}

export function requestAvatar(userId: string) {
  if (cache.has(userId) || inflight.has(userId) || pending.has(userId)) return;
  pending.add(userId);
  if (!scheduled) {
    scheduled = true;
    queueMicrotask(flush);
  }
}

export function getCachedAvatar(userId: string): string | null | undefined {
  return cache.get(userId);
}

// Dipanggil setelah user ganti/hapus fotonya sendiri supaya semua
// <UserAvatar> miliknya langsung ikut berubah.
export function setCachedAvatar(userId: string, url: string | null) {
  cache.set(userId, url);
  notify();
}

export function subscribeAvatars(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
