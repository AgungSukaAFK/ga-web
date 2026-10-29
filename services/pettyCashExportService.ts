// src/services/pettyCashExportService.ts
//
// "Download Excel - All Document" Petty Cash (halaman Management Petty Cash,
// admin/GA/Finance). Satu file .xlsx berisi beberapa sheet - Ringkasan
// rantai (1 baris per Pengajuan) + tiap jenis dokumen (Pengajuan, Voucher,
// Tarik Dana, Deklarasi: 1 baris per BARANG, pola sama dgn export MR) +
// Pengembalian & Pembatalan - styling lewat exportStyledExcelWorkbook
// (lib/excel-export.ts) supaya seragam dgn export MR/PO/Barang.
//
// Filter berlaku di level PENGAJUAN (tanggal dibuat, company, departemen,
// site, status, eskalasi): seluruh turunan Pengajuan yang lolos filter ikut
// diekspor, jadi tiap baris di sheet mana pun selalu bisa dirunut ke
// Pengajuan di sheet Pengajuan/Ringkasan. Satu query nested (sama pola dgn
// fetchMyPengajuanWithChain), diambil bertahap lewat fetchAllRows.

import { createClient } from "@/lib/supabase/client";
import { fetchAllRows, exportStyledExcelWorkbook, StyledSheet } from "@/lib/excel-export";
import { extractPlainText } from "@/lib/rich-content";
import { formatDateFriendly } from "@/lib/utils";
import {
  getPendingPembatalan,
  pickCurrentDoc,
  sortDocsNewestFirst,
  toEmbedArray,
} from "@/lib/pcChain";
import {
  formatPcPayment,
  resolveSubVoucherPayment,
} from "@/lib/pcPayment";
import { getPcApprovalLevel } from "@/lib/pcApprovalFlow";
import { computePcOverallStatus } from "@/services/pettyCashDashboardService";
import {
  PettyCashDeklarasi,
  PettyCashPembatalan,
  PettyCashPengajuanApprover,
  PettyCashPengajuanItem,
  PettyCashPengajuanWithChain,
  PettyCashPengembalian,
  PettyCashSubVoucherWithChain,
  PettyCashVoucherWithChain,
} from "@/type";

const supabase = createClient();

export type PcExportSheetKey =
  | "ringkasan"
  | "pengajuan"
  | "voucher"
  | "tarikan"
  | "deklarasi"
  | "pengembalian"
  | "pembatalan";

export const PC_EXPORT_SHEETS: {
  key: PcExportSheetKey;
  label: string;
  description: string;
}[] = [
  {
    key: "ringkasan",
    label: "Ringkasan",
    description: "1 baris per Pengajuan: status utama, voucher, total ditarik/dibayar/dideklarasikan.",
  },
  {
    key: "pengajuan",
    label: "Pengajuan",
    description: "1 baris per barang.",
  },
  {
    key: "voucher",
    label: "Voucher",
    description: "1 baris per barang, termasuk metode pencairan & rekening.",
  },
  {
    key: "tarikan",
    label: "Tarik Dana",
    description: "1 baris per barang yang ditarik, info pembayaran Finance.",
  },
  {
    key: "deklarasi",
    label: "Deklarasi",
    description: "1 baris per barang (pemakaian riil).",
  },
  {
    key: "pengembalian",
    label: "Pengembalian Dana",
    description: "Sisa dana yang dikembalikan ke Finance.",
  },
  {
    key: "pembatalan",
    label: "Pembatalan",
    description: "Riwayat permintaan pembatalan Pengajuan.",
  },
];

export interface PcExportFilters {
  // "YYYY-MM-DD" (tanggal lokal) - tanggal Pengajuan DIBUAT.
  dateFrom: string | null;
  dateTo: string | null;
  // null = semua company yang boleh diakses (lihat allowedCompanies).
  company: string | null;
  department: string | null;
  site: string | null;
  status: string | null;
  eskalasiOnly: boolean;
}

export const EMPTY_PC_EXPORT_FILTERS: PcExportFilters = {
  dateFrom: null,
  dateTo: null,
  company: null,
  department: null,
  site: null,
  status: null,
  eskalasiOnly: false,
};

export const hasPcExportFilter = (f: PcExportFilters) =>
  !!(
    f.dateFrom ||
    f.dateTo ||
    f.company ||
    f.department ||
    f.site ||
    f.status ||
    f.eskalasiOnly
  );

// Tarikan ikut join pembayar & pengembaliannya; pengajuan ikut pembatalan.
const EXPORT_SELECT = `
  *, users_with_profiles:profiles!user_id(nama, email),
  petty_cash_budget(name),
  petty_cash_pembatalan(*, processed_by_profile:profiles!processed_by(nama)),
  petty_cash_voucher(*, petty_cash_budget(name),
    petty_cash_sub_voucher(*, paid_by_profile:profiles!paid_by(nama),
      petty_cash_deklarasi(*),
      petty_cash_pengembalian(*, processed_by_profile:profiles!processed_by(nama))))
`;

/** Batas lokal (bukan UTC) supaya "1 Okt" = mulai 00:00 jam device user. */
const localDayStart = (d: string) => new Date(`${d}T00:00:00`).toISOString();
const localDayEnd = (d: string) => new Date(`${d}T23:59:59.999`).toISOString();

/**
 * Ambil seluruh rantai Pengajuan sesuai filter. `allowedCompanies` null =
 * tanpa batas company (admin); selain itu dibatasi ke daftar itu (GA/
 * Finance: company sendiri, LOURDES semua - sama dgn antrian Finance).
 */
export const fetchPcExportChain = async (
  filters: PcExportFilters,
  allowedCompanies: string[] | null,
): Promise<PettyCashPengajuanWithChain[]> => {
  const buildQuery = () => {
    let query = supabase.from("petty_cash_pengajuan").select(EXPORT_SELECT);

    if (filters.dateFrom)
      query = query.gte("created_at", localDayStart(filters.dateFrom));
    if (filters.dateTo)
      query = query.lte("created_at", localDayEnd(filters.dateTo));
    if (filters.department) query = query.eq("department", filters.department);
    if (filters.site) query = query.eq("site", filters.site);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.eskalasiOnly) query = query.eq("is_eskalasi", true);

    if (filters.company) {
      query =
        allowedCompanies && !allowedCompanies.includes(filters.company)
          ? query.eq("id", -1)
          : query.eq("company_code", filters.company);
    } else if (allowedCompanies) {
      query = query.in("company_code", allowedCompanies);
    }

    return query
      .order("created_at", { ascending: false })
      .order("id", { ascending: true }); // urutan stabil antar halaman
  };

  // Halaman kecil - tiap baris membawa seluruh rantai turunannya.
  return fetchAllRows<PettyCashPengajuanWithChain>(buildQuery, 250);
};

// ==========================================
// Helper format baris
// ==========================================

const dateText = (d: string | Date | null | undefined) =>
  d ? formatDateFriendly(d) : "-";

const yesNo = (v: boolean | null | undefined) => (v ? "Ya" : "-");

const approvalProgress = (approvals: PettyCashPengajuanApprover[] | null) => {
  const list = approvals ?? [];
  if (list.length === 0) return "-";
  if (list.some((a) => a.status === "rejected")) return "Ditolak";
  const approved = list.filter((a) => a.status === "approved").length;
  return `${approved}/${list.length} disetujui`;
};

// Approver yang sedang giliran (pending pertama), atau penolak.
const approvalCurrent = (approvals: PettyCashPengajuanApprover[] | null) => {
  const list = approvals ?? [];
  const rejected = list.find((a) => a.status === "rejected");
  if (rejected) return `${rejected.nama} (menolak)`;
  const idx = list.findIndex((a) => a.status === "pending");
  if (idx === -1) return "-";
  return `${list[idx].nama} (${getPcApprovalLevel(list, idx)})`;
};

const itemColumns = (it: PettyCashPengajuanItem, idx: number) => ({
  "No Barang": idx + 1,
  "Nama Barang": it.part_name,
  "Company Barang": it.coa || "-",
  COA: it.category || "-",
  Qty: Number(it.qty) || 0,
  UoM: it.uom || "-",
  "Harga Satuan": Number(it.unit_price) || 0,
  Subtotal: Number(it.subtotal) || 0,
  "Catatan Barang": it.note || "-",
});

/** 1 baris per barang; dokumen tanpa barang tetap 1 baris. */
const perItem = (
  base: Record<string, unknown>,
  items: PettyCashPengajuanItem[] | null | undefined,
) => {
  const list = items ?? [];
  if (list.length === 0) return [{ ...base, "Nama Barang": "TIDAK ADA BARANG" }];
  return list.map((it, idx) => ({ ...base, ...itemColumns(it, idx) }));
};

const activeSubVouchers = (v: PettyCashVoucherWithChain | null) =>
  toEmbedArray(v?.petty_cash_sub_voucher).filter(
    (sv) => sv.status !== "Dibatalkan",
  );

const sum = (values: number[]) =>
  values.reduce((total, n) => total + (Number(n) || 0), 0);

const pembatalanLabel = (list: PettyCashPembatalan[] | null | undefined) => {
  const pending = getPendingPembatalan(list);
  if (pending) return "Menunggu Persetujuan";
  return sortDocsNewestFirst(list)[0]?.status ?? "-";
};

const ITEM_CURRENCY = ["Harga Satuan", "Subtotal"];

// ==========================================
// Builder tiap sheet
// ==========================================

const buildRingkasan = (chain: PettyCashPengajuanWithChain[]) =>
  chain.map((pj) => {
    const voucher = pickCurrentDoc(pj.petty_cash_voucher);
    const svs = activeSubVouchers(voucher);
    const paid = svs.filter((sv) => sv.status === "Selesai");
    const declared = svs.flatMap((sv) =>
      toEmbedArray(sv.petty_cash_deklarasi).filter(
        (d) => d.status === "Approved",
      ),
    );
    const returned = svs.flatMap((sv) =>
      toEmbedArray(sv.petty_cash_pengembalian).filter(
        (p) => p.status === "Selesai",
      ),
    );
    const totalDitarik = sum(svs.map((sv) => sv.amount));
    return {
      "Kode Pengajuan": pj.kode_pengajuan,
      "Tanggal Pengajuan": dateText(pj.created_at),
      Pemohon: pj.users_with_profiles?.nama || "-",
      "Pengguna Budget": pj.pengguna_budget_nama || pj.users_with_profiles?.nama || "-",
      Company: pj.company_code,
      Departemen: pj.department,
      Site: pj.site || "-",
      Budget: pj.petty_cash_budget?.name || "-",
      Eskalasi: yesNo(pj.is_eskalasi),
      "Status Pengajuan": pj.status,
      "Status Utama": computePcOverallStatus(pj).label,
      "Total Pengajuan": Number(pj.total_amount) || 0,
      "Kode Voucher": voucher?.kode_voucher || "-",
      "Status Voucher": voucher?.status || "-",
      "Metode Pencairan": voucher ? formatPcPayment(voucher, "-") : "-",
      "Total Voucher": Number(voucher?.total_amount) || 0,
      "Jumlah Tarikan": svs.length,
      "Total Ditarik": totalDitarik,
      "Total Dibayar": sum(paid.map((sv) => sv.amount)),
      "Total Deklarasi Disetujui": sum(declared.map((d) => d.total_amount)),
      "Total Dikembalikan": sum(returned.map((p) => p.amount)),
      "Sisa Belum Ditarik": voucher
        ? Math.max((Number(voucher.total_amount) || 0) - totalDitarik, 0)
        : 0,
      "Status Pembatalan": pembatalanLabel(pj.petty_cash_pembatalan),
    };
  });

const buildPengajuan = (chain: PettyCashPengajuanWithChain[]) =>
  chain.flatMap((pj) =>
    perItem(
      {
        "Kode Pengajuan": pj.kode_pengajuan,
        "Tanggal Dibuat": dateText(pj.created_at),
        "Tanggal Dibutuhkan": dateText(pj.needed_date),
        "Minggu ke-": pj.week_of_month ?? "-",
        Pemohon: pj.users_with_profiles?.nama || "-",
        "Pengguna Budget": pj.pengguna_budget_nama || "-",
        Company: pj.company_code,
        Departemen: pj.department,
        Site: pj.site || "-",
        Budget: pj.petty_cash_budget?.name || "-",
        Eskalasi: yesNo(pj.is_eskalasi),
        Status: pj.status,
        "Progres Approval": approvalProgress(pj.approvals),
        "Approver Saat Ini": approvalCurrent(pj.approvals),
        "Total Pengajuan": Number(pj.total_amount) || 0,
        Catatan: extractPlainText(pj.notes) || "-",
      },
      pj.items,
    ),
  );

type VoucherRow = {
  pj: PettyCashPengajuanWithChain;
  v: PettyCashVoucherWithChain;
};

const allVouchers = (chain: PettyCashPengajuanWithChain[]): VoucherRow[] =>
  chain.flatMap((pj) =>
    sortDocsNewestFirst(pj.petty_cash_voucher).map((v) => ({ pj, v })),
  );

const buildVoucher = (rows: VoucherRow[]) =>
  rows.flatMap(({ pj, v }) => {
    const totalDitarik = sum(activeSubVouchers(v).map((sv) => sv.amount));
    return perItem(
      {
        "Kode Voucher": v.kode_voucher,
        "Tanggal Dibuat": dateText(v.created_at),
        "Kode Pengajuan": pj.kode_pengajuan,
        Pemohon: pj.users_with_profiles?.nama || "-",
        Company: v.company_code,
        Departemen: v.department,
        Site: v.site || "-",
        Budget: v.petty_cash_budget?.name || "-",
        Eskalasi: yesNo(pj.is_eskalasi),
        Status: v.status,
        "Progres Approval": approvalProgress(v.approvals),
        "Approver Saat Ini": approvalCurrent(v.approvals),
        "Metode Pencairan": v.payment_method || "-",
        Bank: v.bank_name || "-",
        "No. Rekening": v.bank_account_number || "-",
        "Atas Nama": v.bank_account_holder_name || "-",
        "Total Voucher": Number(v.total_amount) || 0,
        "Total Ditarik": totalDitarik,
        "Sisa Belum Ditarik": Math.max((Number(v.total_amount) || 0) - totalDitarik, 0),
      },
      v.items,
    );
  });

type TarikanRow = VoucherRow & { sv: PettyCashSubVoucherWithChain };

const allTarikan = (rows: VoucherRow[]): TarikanRow[] =>
  rows.flatMap(({ pj, v }) =>
    toEmbedArray(v.petty_cash_sub_voucher).map((sv) => ({ pj, v, sv })),
  );

const buildTarikan = (rows: TarikanRow[]) =>
  rows.flatMap(({ pj, v, sv }) => {
    const payment = resolveSubVoucherPayment({ ...sv, petty_cash_voucher: v });
    const dek = pickCurrentDoc(sv.petty_cash_deklarasi);
    return perItem(
      {
        "Kode Tarikan": sv.kode_sub_voucher,
        "Tanggal Tarik": dateText(sv.created_at),
        "Kode Voucher": v.kode_voucher,
        "Kode Pengajuan": pj.kode_pengajuan,
        Pemohon: pj.users_with_profiles?.nama || "-",
        Company: v.company_code,
        Departemen: v.department,
        Site: v.site || "-",
        "Status Pembayaran": sv.status,
        "Metode Pencairan": payment.payment_method
          ? `${payment.payment_method}${payment.final ? "" : " (rencana)"}`
          : "-",
        Bank: payment.bank_name || "-",
        "No. Rekening": payment.bank_account_number || "-",
        "Atas Nama": payment.bank_account_holder_name || "-",
        "Tanggal Dibayar": dateText(sv.paid_at),
        "Dibayar Oleh": sv.paid_by_profile?.nama || "-",
        "Jumlah Bukti Bayar": (sv.payment_proof ?? []).length,
        "Nominal Tarikan": Number(sv.amount) || 0,
        "Kode Deklarasi": dek?.kode_deklarasi || "-",
        "Status Deklarasi": dek?.status || "Belum dideklarasikan",
      },
      sv.items,
    );
  });

const buildDeklarasi = (rows: TarikanRow[]) =>
  rows.flatMap(({ pj, v, sv }) =>
    sortDocsNewestFirst(sv.petty_cash_deklarasi).flatMap(
      (d: PettyCashDeklarasi) =>
        perItem(
          {
            "Kode Deklarasi": d.kode_deklarasi,
            "Tanggal Dibuat": dateText(d.created_at),
            "Kode Tarikan": sv.kode_sub_voucher,
            "Kode Voucher": v.kode_voucher,
            "Kode Pengajuan": pj.kode_pengajuan,
            Pemohon: pj.users_with_profiles?.nama || "-",
            Company: d.company_code,
            Departemen: d.department,
            Site: d.site || "-",
            Status: d.status,
            "Progres Approval": approvalProgress(d.approvals),
            "Approver Saat Ini": approvalCurrent(d.approvals),
            "Nominal Tarikan": Number(sv.amount) || 0,
            "Total Deklarasi": Number(d.total_amount) || 0,
            "Selisih (Tarikan - Deklarasi)":
              (Number(sv.amount) || 0) - (Number(d.total_amount) || 0),
            Catatan: extractPlainText(d.notes) || "-",
          },
          d.items,
        ),
    ),
  );

const buildPengembalian = (rows: TarikanRow[]) =>
  rows.flatMap(({ pj, v, sv }) =>
    sortDocsNewestFirst(sv.petty_cash_pengembalian as PettyCashPengembalian[]).map(
      (pg) => ({
        "Kode Pengembalian": pg.kode_pengembalian,
        "Tanggal Diajukan": dateText(pg.created_at),
        "Kode Tarikan": sv.kode_sub_voucher,
        "Kode Voucher": v.kode_voucher,
        "Kode Pengajuan": pj.kode_pengajuan,
        Pemohon: pj.users_with_profiles?.nama || "-",
        Company: v.company_code,
        Departemen: v.department,
        Nominal: Number(pg.amount) || 0,
        Status: pg.status,
        "Diproses Oleh": pg.processed_by_profile?.nama || "-",
        "Tanggal Diproses": dateText(pg.processed_at),
        "Alasan Ditolak": pg.reject_reason || "-",
        Catatan: pg.notes || "-",
      }),
    ),
  );

const buildPembatalan = (chain: PettyCashPengajuanWithChain[]) =>
  chain.flatMap((pj) =>
    sortDocsNewestFirst(pj.petty_cash_pembatalan).map((pb) => ({
      "Kode Pengajuan": pj.kode_pengajuan,
      "Tanggal Diajukan": dateText(pb.created_at),
      Pemohon: pj.users_with_profiles?.nama || "-",
      Company: pb.company_code,
      Departemen: pj.department,
      "Alasan Pemohon": pb.reason,
      Status: pb.status,
      "Diproses Oleh": pb.processed_by_profile?.nama || "-",
      "Tanggal Diproses": dateText(pb.processed_at),
      "Catatan Finance": pb.finance_note || "-",
      "Voucher Dibatalkan":
        (pb.detail?.vouchers ?? []).map((v) => v.kode).join(", ") || "-",
      "Tarikan Dibatalkan":
        (pb.detail?.sub_vouchers ?? []).map((sv) => sv.kode).join(", ") || "-",
      "Total Refund Budget": Number(pb.detail?.total_refunded) || 0,
    })),
  );

/** Rakit sheet-sheet yang dipilih dari data rantai (urutan mengikuti PC_EXPORT_SHEETS). */
export const buildPcExportSheets = (
  chain: PettyCashPengajuanWithChain[],
  keys: PcExportSheetKey[],
): StyledSheet[] => {
  const vouchers = allVouchers(chain);
  const tarikan = allTarikan(vouchers);

  const builders: Record<PcExportSheetKey, () => StyledSheet> = {
    ringkasan: () => ({
      name: "Ringkasan",
      data: buildRingkasan(chain),
      currencyColumns: [
        "Total Pengajuan",
        "Total Voucher",
        "Total Ditarik",
        "Total Dibayar",
        "Total Deklarasi Disetujui",
        "Total Dikembalikan",
        "Sisa Belum Ditarik",
      ],
    }),
    pengajuan: () => ({
      name: "Pengajuan",
      data: buildPengajuan(chain),
      currencyColumns: ["Total Pengajuan", ...ITEM_CURRENCY],
    }),
    voucher: () => ({
      name: "Voucher",
      data: buildVoucher(vouchers),
      currencyColumns: [
        "Total Voucher",
        "Total Ditarik",
        "Sisa Belum Ditarik",
        ...ITEM_CURRENCY,
      ],
    }),
    tarikan: () => ({
      name: "Tarik Dana",
      data: buildTarikan(tarikan),
      currencyColumns: ["Nominal Tarikan", ...ITEM_CURRENCY],
    }),
    deklarasi: () => ({
      name: "Deklarasi",
      data: buildDeklarasi(tarikan),
      currencyColumns: [
        "Nominal Tarikan",
        "Total Deklarasi",
        "Selisih (Tarikan - Deklarasi)",
        ...ITEM_CURRENCY,
      ],
    }),
    pengembalian: () => ({
      name: "Pengembalian Dana",
      data: buildPengembalian(tarikan),
      currencyColumns: ["Nominal"],
    }),
    pembatalan: () => ({
      name: "Pembatalan",
      data: buildPembatalan(chain),
      currencyColumns: ["Total Refund Budget"],
    }),
  };

  return PC_EXPORT_SHEETS.filter((s) => keys.includes(s.key)).map((s) =>
    builders[s.key](),
  );
};

/**
 * Ambil data + rakit + download. Return jumlah Pengajuan yang diekspor (0 =
 * tidak ada file yang diunduh).
 */
export const exportPettyCashExcel = async (
  filters: PcExportFilters,
  allowedCompanies: string[] | null,
  keys: PcExportSheetKey[],
): Promise<number> => {
  const chain = await fetchPcExportChain(filters, allowedCompanies);
  if (chain.length === 0) return 0;

  const today = new Date().toISOString().slice(0, 10);
  await exportStyledExcelWorkbook(
    buildPcExportSheets(chain, keys),
    `Rekap_Petty_Cash${hasPcExportFilter(filters) ? "_Filter" : "_Semua"}_${today}.xlsx`,
  );
  return chain.length;
};
