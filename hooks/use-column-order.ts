// src/hooks/use-column-order.ts
//
// Urutan kolom tabel list yang bisa diatur user dengan menggeser header
// (components/reorderable-table-head.tsx). Disimpan di localStorage per
// tabel, jadi berlaku per browser - tidak ikut pindah device.
//
// Isi storage selalu dicocokkan ulang dengan daftar kolom di kode: id yang
// sudah tidak ada dibuang, kolom baru disisipkan di posisi bawaannya. Jadi
// menambah / menghapus kolom tidak perlu migrasi storage. Kalau urutannya
// kembali sama dengan bawaan, storage dihapus supaya perubahan urutan bawaan
// di kode nantinya ikut berlaku.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

function readStoredOrder(key: string): string[] | null {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : null;
  } catch {
    return null;
  }
}

function writeStoredOrder(key: string, order: string[] | null) {
  try {
    if (order) window.localStorage.setItem(key, JSON.stringify(order));
    else window.localStorage.removeItem(key);
  } catch {
    // Storage tidak tersedia (mis. private mode) - cukup berlaku di sesi ini.
  }
}

function reconcileOrder<Id extends string>(
  stored: string[],
  defaults: readonly Id[],
): Id[] {
  const known = new Set<string>(defaults);
  const result = [...new Set(stored)].filter((id): id is Id => known.has(id));
  defaults.forEach((id, i) => {
    if (!result.includes(id)) result.splice(Math.min(i, result.length), 0, id);
  });
  return result;
}

function isSameOrder(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

export function useColumnOrder<C extends { id: string }>(
  storageKey: string,
  // Harus referensi stabil (konstanta di luar komponen).
  columns: readonly C[],
) {
  type Id = C["id"];
  const defaultOrder = useMemo(() => columns.map((c) => c.id as Id), [columns]);
  const [order, setOrder] = useState<Id[]>(defaultOrder);

  // Baca setelah mount (bukan di initializer) supaya render server & client
  // pertama sama.
  useEffect(() => {
    const stored = readStoredOrder(storageKey);
    setOrder(stored ? reconcileOrder(stored, defaultOrder) : defaultOrder);
  }, [storageKey, defaultOrder]);

  // Pindahkan `from` ke posisi `to`: digeser ke kanan -> jatuh setelah `to`,
  // ke kiri -> sebelum `to`.
  const moveColumn = useCallback(
    (from: string, to: string) => {
      const fromIndex = order.indexOf(from as Id);
      const toIndex = order.indexOf(to as Id);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
      const next = [...order];
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, from as Id);
      setOrder(next);
      writeStoredOrder(
        storageKey,
        isSameOrder(next, defaultOrder) ? null : next,
      );
    },
    [order, storageKey, defaultOrder],
  );

  const resetOrder = useCallback(() => {
    setOrder(defaultOrder);
    writeStoredOrder(storageKey, null);
  }, [storageKey, defaultOrder]);

  const orderedColumns = useMemo(() => {
    const byId = new Map(columns.map((c) => [c.id, c]));
    return order.map((id) => byId.get(id)!);
  }, [columns, order]);

  return {
    order,
    orderedColumns,
    moveColumn,
    resetOrder,
    isCustomOrder: !isSameOrder(order, defaultOrder),
  };
}
