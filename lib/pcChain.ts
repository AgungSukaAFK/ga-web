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

/**
 * Permintaan pembatalan Pengajuan yang masih menunggu Finance (paling
 * banyak 1, dijaga unique index parsial - lihat
 * supabase/migrations/0015_petty_cash_revisi.sql), null kalau tidak ada.
 */
export const getPendingPembatalan = <T extends { status: string }>(
  list: T | T[] | null | undefined,
): T | null =>
  toEmbedArray(list).find((p) => p.status === "Menunggu Persetujuan") ?? null;

/**
 * Pengajuan boleh diajukan pembatalan oleh pemiliknya: masih In Approval/
 * Approved, belum ada permintaan yang menunggu, dan belum ada tarikan yang
 * dibayar Finance. Aturan yang sama dicek ulang di RPC
 * request_petty_cash_pembatalan - ini cuma utk menampilkan tombol.
 */
export const canRequestPembatalan = (pengajuan: {
  status: string;
  petty_cash_pembatalan?: { status: string }[] | null;
  petty_cash_voucher?:
    | {
        status?: string;
        petty_cash_sub_voucher?: { status: string }[] | null;
      }[]
    | null;
}): boolean => {
  if (pengajuan.status !== "In Approval" && pengajuan.status !== "Approved")
    return false;
  if (getPendingPembatalan(pengajuan.petty_cash_pembatalan)) return false;
  return !toEmbedArray(pengajuan.petty_cash_voucher).some((v) =>
    toEmbedArray(v.petty_cash_sub_voucher).some((sv) => sv.status === "Selesai"),
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

export interface PcPenarikanSummary {
  // Basis saldo: Voucher aktif (nilainya bisa beda dari Pengajuan kalau
  // diedit approver Voucher), atau Pengajuan sendiri kalau belum di-voucher.
  basisLabel: "Voucher" | "Pengajuan";
  basisKode: string | null;
  nilai: number;
  totalDitarik: number;
  sisaSaldo: number;
  // Urut dari tarikan PERTAMA - yang terakhir = tarikan paling baru.
  penarikan: {
    id: number;
    kode: string;
    amount: number;
    status: string;
    created_at?: string | Date;
  }[];
  budgetName: string | null;
  budgetRemaining: number | null;
}

/**
 * Ringkasan saldo & riwayat penarikan (Sub-Voucher/Tarik Dana) sebuah
 * Pengajuan - dipakai cetak Input Pengajuan (PrintablePettyCashDocument).
 * Butuh embed petty_cash_voucher -> petty_cash_sub_voucher dari
 * fetchPengajuanById. Budget diambil dari Voucher (budget_id disalin dari
 * Pengajuan, tapi bisa diganti approver Voucher), fallback ke Pengajuan.
 */
export const buildPcPenarikanSummary = (pengajuan: {
  kode_pengajuan: string;
  total_amount: number;
  petty_cash_budget?: { name: string; current_budget: number } | null;
  petty_cash_voucher?:
    | {
        id: number;
        kode_voucher?: string;
        status?: string;
        created_at?: string | Date;
        total_amount?: number;
        petty_cash_budget?: { name: string; current_budget: number } | null;
        petty_cash_sub_voucher?:
          | {
              id: number;
              kode_sub_voucher: string;
              amount: number;
              status: string;
              created_at?: string | Date;
            }[]
          | null;
      }[]
    | null;
}): PcPenarikanSummary => {
  const voucher = getActiveDoc(pengajuan.petty_cash_voucher);
  // Tarikan yang dibatalkan sudah di-refund - tidak dihitung sbg penarikan.
  const penarikan = [...toEmbedArray(voucher?.petty_cash_sub_voucher)]
    .filter((sv) => sv.status !== "Dibatalkan")
    .sort((a, b) => createdTime(a) - createdTime(b))
    .map((sv) => ({
      id: sv.id,
      kode: sv.kode_sub_voucher,
      amount: Number(sv.amount) || 0,
      status: sv.status,
      created_at: sv.created_at,
    }));
  const nilai = Number(voucher?.total_amount ?? pengajuan.total_amount) || 0;
  const totalDitarik = penarikan.reduce((sum, p) => sum + p.amount, 0);
  const budget = voucher?.petty_cash_budget ?? pengajuan.petty_cash_budget;
  return {
    basisLabel: voucher ? "Voucher" : "Pengajuan",
    basisKode: voucher?.kode_voucher ?? pengajuan.kode_pengajuan,
    nilai,
    totalDitarik,
    sisaSaldo: nilai - totalDitarik,
    penarikan,
    budgetName: budget?.name ?? null,
    budgetRemaining: budget ? Number(budget.current_budget) : null,
  };
};
