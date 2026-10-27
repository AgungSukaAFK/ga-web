// src/lib/pcChain.ts
//
// Helper rantai dokumen Petty Cash yang bisa punya "anak" berulang setelah
// ditolak: Voucher per Pengajuan (supabase/migrations/0010_petty_cash_voucher_ulang.sql)
// dan Deklarasi per tarikan/Sub-Voucher (0009_petty_cash_pengembalian.sql).
// Yang ditolak tetap tersimpan sbg riwayat, requester boleh mengajukan
// ulang, dan paling banyak 1 yang AKTIF (status selain "Rejected") - dijaga
// unique index parsial di DB. Semua tampilan yang dulu mengambil `[0]`
// memilih dokumen yang berlaku lewat helper di sini supaya caranya sama di
// mana-mana.

type ChainDocLike = {
  id: number;
  status?: string;
  total_amount?: number;
  created_at?: string | Date;
};

/**
 * Embed PostgREST utk relasi yang FK-nya masih UNIQUE (sebelum migrasi
 * 0009/0010 dijalankan) dikirim sbg objek one-to-one, bukan array - samakan
 * jadi array supaya pemanggil tidak perlu peduli bentuknya.
 */
export const toEmbedArray = <T>(value: T | T[] | null | undefined): T[] =>
  Array.isArray(value) ? value : value ? [value] : [];

const createdTime = (d: ChainDocLike) =>
  d.created_at ? new Date(d.created_at).getTime() : 0;

/** Dokumen aktif (belum ditolak), null kalau tidak ada. */
export const getActiveDoc = <T extends ChainDocLike>(
  list: T | T[] | null | undefined,
): T | null =>
  toEmbedArray(list).find((d) => d.status !== "Rejected") ?? null;

/**
 * Dokumen yang berlaku: yang aktif kalau ada, kalau tidak yang ditolak
 * paling akhir (supaya status "Ditolak" tetap kelihatan sampai requester
 * mengajukan ulang). Null kalau belum pernah dibuat.
 */
export const pickCurrentDoc = <T extends ChainDocLike>(
  list: T | T[] | null | undefined,
): T | null => {
  const active = getActiveDoc(list);
  if (active) return active;
  return toEmbedArray(list).reduce<T | null>(
    (latest, d) => (!latest || createdTime(d) > createdTime(latest) ? d : latest),
    null,
  );
};

/** Semua dokumen, terbaru di atas (aktif + riwayat yang ditolak). */
export const sortDocsNewestFirst = <T extends ChainDocLike>(
  list: T | T[] | null | undefined,
): T[] => [...toEmbedArray(list)].sort((a, b) => createdTime(b) - createdTime(a));

/**
 * Sisa dana tarikan yang masih bisa dikembalikan: nominal tarikan - total
 * Deklarasi yang disetujui - pengembalian yang belum ditolak. Null kalau
 * Deklarasi-nya belum disetujui (sisa belum pasti). Rumus yang sama dicek
 * ulang di RPC create_petty_cash_pengembalian.
 */
export const computeSisaPengembalian = (sv: {
  amount: number;
  petty_cash_deklarasi?: ChainDocLike | ChainDocLike[] | null;
  petty_cash_pengembalian?: { amount: number; status: string }[] | null;
}): number | null => {
  const approved = toEmbedArray(sv.petty_cash_deklarasi).find(
    (d) => d.status === "Approved",
  );
  if (!approved) return null;
  const returned = toEmbedArray(sv.petty_cash_pengembalian)
    .filter((p) => p.status !== "Ditolak")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  return Number(sv.amount) - Number(approved.total_amount ?? 0) - returned;
};
