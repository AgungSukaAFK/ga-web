// src/services/pettyCashDashboardService.ts
//
// Logika "Status Utama" Petty Cash - lihat planning-pc.md Bagian 1 & 2.
// SEMUA fungsi di sini murni (tidak query Supabase, tidak "use client") -
// menerima data rantai yang SUDAH diambil lewat fetchMyPengajuanWithChain
// (services/pettyCashPengajuanService.ts) & mengubahnya jadi bentuk siap
// tampil untuk Dashboard Petty Cash
// (app/(With Sidebar)/petty-cash/PcDashboardClient.tsx) dan bisa dipakai
// ulang di halaman lain (mis. "Pengajuan Saya") supaya status turunannya
// konsisten di satu tempat, tidak dihitung dua cara berbeda.
//
// Status mentah per dokumen (In Approval/Approved/Rejected/Selesai/Menunggu
// Pembayaran, lihat type/enum.ts) TIDAK diubah di sini - fungsi-fungsi ini
// cuma MEMBACA status mentah lalu menyimpulkan satu "Status Utama" per
// rantai Pengajuan.

import { formatCurrency } from "@/lib/utils";
import {
  PettyCashPengajuanWithChain,
  PettyCashSubVoucherWithChain,
  PettyCashVoucherWithChain,
} from "@/type";
import {
  PC_OVERALL_STATUS_COLOR_DEFAULT,
  PC_OVERALL_STATUS_COLORS,
} from "@/type/enum";

export type PcOverallStatusKey =
  | "pengajuan_menunggu_approval"
  | "pengajuan_ditolak"
  | "menunggu_ajukan_voucher"
  | "voucher_menunggu_approval"
  | "voucher_ditolak"
  | "menunggu_tarik_dana"
  | "tarikan_menunggu_pembayaran"
  | "menunggu_ajukan_deklarasi"
  | "deklarasi_menunggu_approval"
  | "deklarasi_ditolak"
  | "sebagian_tuntas"
  | "tuntas";

// "action"   = giliran REQUESTER sendiri (oranye)
// "waiting"  = giliran orang lain - approver atau Finance/GA (kuning)
// "rejected" = jalan buntu di salah satu tahap (merah)
// "info"     = informasional, tidak wajib segera (biru)
// "done"     = tuntas, happy path selesai (emerald)
export type PcOverallStatusTone =
  | "action"
  | "waiting"
  | "rejected"
  | "info"
  | "done";

export interface PcOverallStatus {
  key: PcOverallStatusKey;
  label: string;
  tone: PcOverallStatusTone;
  /** Siapa yang harus bergerak sekarang - "Anda", "Approver", "Finance/GA", atau "-" kalau sudah final. */
  turn: string;
  badgeClass: string;
  /** Pecahan/keterangan tambahan, mis. "2 dari 3 tarikan" - dirender di samping label utama, JANGAN disembunyikan. */
  detail?: string;
}

const statusOf = (key: PcOverallStatusKey, extra: Partial<PcOverallStatus> = {}): PcOverallStatus => ({
  key,
  label: extra.label ?? key,
  tone: extra.tone ?? "waiting",
  turn: extra.turn ?? "-",
  badgeClass: PC_OVERALL_STATUS_COLORS[key] || PC_OVERALL_STATUS_COLOR_DEFAULT,
  detail: extra.detail,
});

/**
 * Hitung "Status Utama" satu rantai Pengajuan - lihat tabel prioritas di
 * planning-pc.md Bagian 1.2. Urutan prioritas kalau beberapa kondisi
 * kebetulan sama-sama benar (mis. 2 tarikan sudah dideklarasikan disetujui,
 * 1 masih menunggu dibayar): Ditolak > Giliran Anda (oranye) > Menunggu
 * orang lain (kuning) > Informasi (biru) > Tuntas (emerald). Giliran Anda
 * selalu menang supaya requester tidak pernah kelewat langkah yang jadi
 * tanggung jawabnya sendiri.
 */
export const computePcOverallStatus = (
  pengajuan: PettyCashPengajuanWithChain,
): PcOverallStatus => {
  if (pengajuan.status === "Rejected") {
    return statusOf("pengajuan_ditolak", {
      label: "Pengajuan Ditolak",
      tone: "rejected",
    });
  }
  if (pengajuan.status === "In Approval") {
    return statusOf("pengajuan_menunggu_approval", {
      label: "Menunggu Persetujuan Pengajuan",
      tone: "waiting",
      turn: "Approver",
    });
  }

  // pengajuan.status === "Approved" mulai dari sini.
  const voucher: PettyCashVoucherWithChain | null =
    pengajuan.petty_cash_voucher?.[0] ?? null;

  if (!voucher) {
    return statusOf("menunggu_ajukan_voucher", {
      label: "Menunggu Diajukan ke Voucher",
      tone: "action",
      turn: "Anda",
    });
  }

  if (voucher.status === "Rejected") {
    return statusOf("voucher_ditolak", {
      label: "Voucher Ditolak",
      tone: "rejected",
    });
  }
  if (voucher.status === "In Approval") {
    return statusOf("voucher_menunggu_approval", {
      label: "Menunggu Persetujuan Voucher",
      tone: "waiting",
      turn: "Approver",
    });
  }
  if (voucher.status === "Selesai") {
    return statusOf("tuntas", { label: "Tuntas", tone: "done" });
  }

  // voucher.status === "Approved" mulai dari sini - cek Sub-Voucher (tarikan).
  const subVouchers: PettyCashSubVoucherWithChain[] =
    voucher.petty_cash_sub_voucher ?? [];

  if (subVouchers.length === 0) {
    return statusOf("menunggu_tarik_dana", {
      label: "Menunggu Ditarik (Belum Ada Tarikan Dana)",
      tone: "action",
      turn: "Anda",
    });
  }

  const total = subVouchers.length;
  const fraction = (n: number) => `${n} dari ${total} tarikan`;

  const deklarasiDitolak = subVouchers.filter((sv) =>
    (sv.petty_cash_deklarasi ?? []).some((d) => d.status === "Rejected"),
  );
  if (deklarasiDitolak.length > 0) {
    return statusOf("deklarasi_ditolak", {
      label: "Deklarasi Ditolak, Perlu Tindak Lanjut",
      tone: "rejected",
      detail: fraction(deklarasiDitolak.length),
    });
  }

  const belumDiajukanDeklarasi = subVouchers.filter(
    (sv) =>
      sv.status === "Selesai" &&
      (!sv.petty_cash_deklarasi || sv.petty_cash_deklarasi.length === 0),
  );
  if (belumDiajukanDeklarasi.length > 0) {
    return statusOf("menunggu_ajukan_deklarasi", {
      label: "Menunggu Anda: Ajukan Deklarasi",
      tone: "action",
      turn: "Anda",
      detail: fraction(belumDiajukanDeklarasi.length),
    });
  }

  const belumDibayar = subVouchers.filter((sv) => sv.status !== "Selesai");
  if (belumDibayar.length > 0) {
    return statusOf("tarikan_menunggu_pembayaran", {
      label: "Tarikan Diproses, Menunggu Dibayar Finance",
      tone: "waiting",
      turn: "Finance/GA",
      detail: fraction(belumDibayar.length),
    });
  }

  const deklarasiMenunggu = subVouchers.filter((sv) =>
    (sv.petty_cash_deklarasi ?? []).some((d) => d.status === "In Approval"),
  );
  if (deklarasiMenunggu.length > 0) {
    return statusOf("deklarasi_menunggu_approval", {
      label: "Deklarasi Menunggu Persetujuan",
      tone: "waiting",
      turn: "Approver",
      detail: fraction(deklarasiMenunggu.length),
    });
  }

  // Semua Sub-Voucher yang ADA sudah tuntas (dibayar + Deklarasi Approved).
  // Voucher-nya sendiri baru naik ke "Selesai" lewat trigger DB begitu
  // totalnya menutup total_amount (lihat komentar PC_VOUCHER_STATUS_OPTIONS,
  // type/enum.ts) - selama masih ada sisa yang belum ditarik, ini tetap
  // "Approved" & requester BOLEH menarik lagi kapan saja.
  const totalDitarik = subVouchers.reduce((sum, sv) => sum + sv.amount, 0);
  const sisa = voucher.total_amount - totalDitarik;
  if (sisa > 0) {
    return statusOf("sebagian_tuntas", {
      label: "Sebagian Tuntas, Sisa Bisa Ditarik",
      tone: "info",
      turn: "Anda",
      detail: `Sisa ${formatCurrency(sisa)} belum ditarik`,
    });
  }

  return statusOf("sebagian_tuntas", {
    label: "Menunggu Voucher Ditandai Tuntas",
    tone: "info",
  });
};

/** Satu titik di mini-stepper 4 tahap (Pengajuan - Voucher - Tarikan Dana - Deklarasi). */
export interface PcChainStep {
  key: "pengajuan" | "voucher" | "tarikan" | "deklarasi";
  label: string;
  state: "done" | "current" | "rejected" | "pending";
  detail?: string;
}

/**
 * Pecah satu rantai Pengajuan jadi 4 titik stepper - dipakai kartu
 * "Pengajuan Berjalan" di Dashboard (PcChainStepper.tsx). Beda dari
 * computePcOverallStatus (1 label ringkas) - ini utk visual progres per
 * tahap sekaligus.
 */
export const computeChainSteps = (
  pengajuan: PettyCashPengajuanWithChain,
): PcChainStep[] => {
  const voucher: PettyCashVoucherWithChain | null =
    pengajuan.petty_cash_voucher?.[0] ?? null;
  const subVouchers: PettyCashSubVoucherWithChain[] =
    voucher?.petty_cash_sub_voucher ?? [];

  const pengajuanStep: PcChainStep = {
    key: "pengajuan",
    label: "Pengajuan",
    state:
      pengajuan.status === "Rejected"
        ? "rejected"
        : pengajuan.status === "Approved"
          ? "done"
          : "current",
  };

  let voucherStep: PcChainStep;
  if (!voucher) {
    voucherStep = {
      key: "voucher",
      label: "Voucher",
      state: pengajuan.status === "Approved" ? "current" : "pending",
    };
  } else if (voucher.status === "Rejected") {
    voucherStep = { key: "voucher", label: "Voucher", state: "rejected" };
  } else if (voucher.status === "In Approval") {
    voucherStep = { key: "voucher", label: "Voucher", state: "current" };
  } else {
    // "Approved" atau "Selesai"
    voucherStep = { key: "voucher", label: "Voucher", state: "done" };
  }

  const voucherSiapTarik =
    !!voucher && (voucher.status === "Approved" || voucher.status === "Selesai");

  let tarikanStep: PcChainStep;
  if (!voucherSiapTarik) {
    tarikanStep = { key: "tarikan", label: "Tarikan Dana", state: "pending" };
  } else if (subVouchers.length === 0) {
    tarikanStep = { key: "tarikan", label: "Tarikan Dana", state: "current" };
  } else {
    const selesai = subVouchers.filter((sv) => sv.status === "Selesai").length;
    tarikanStep = {
      key: "tarikan",
      label: "Tarikan Dana",
      state: selesai === subVouchers.length ? "done" : "current",
      detail: `${selesai}/${subVouchers.length}`,
    };
  }

  let deklarasiStep: PcChainStep;
  if (subVouchers.length === 0) {
    deklarasiStep = { key: "deklarasi", label: "Deklarasi", state: "pending" };
  } else {
    const adaDeklarasi = subVouchers.filter(
      (sv) => (sv.petty_cash_deklarasi ?? []).length > 0,
    );
    const approved = subVouchers.filter((sv) =>
      (sv.petty_cash_deklarasi ?? []).some((d) => d.status === "Approved"),
    );
    const rejected = subVouchers.some((sv) =>
      (sv.petty_cash_deklarasi ?? []).some((d) => d.status === "Rejected"),
    );
    deklarasiStep = {
      key: "deklarasi",
      label: "Deklarasi",
      state: rejected
        ? "rejected"
        : approved.length === subVouchers.length
          ? "done"
          : adaDeklarasi.length > 0
            ? "current"
            : "pending",
      detail: `${approved.length}/${subVouchers.length}`,
    };
  }

  return [pengajuanStep, voucherStep, tarikanStep, deklarasiStep];
};

/** Satu baris di panel "Perlu Tindakan Anda" - status utama bertone "action" + CTA siap pakai. */
export interface PcActionItem {
  pengajuan: PettyCashPengajuanWithChain;
  status: PcOverallStatus;
  ctaLabel: string;
  ctaHref: string;
}

/**
 * Saring rantai Pengajuan yang statusnya "giliran Anda" (tone "action") -
 * ini realisasi 3 "titik senyap" di planning-pc.md Bagian 1.3. CTA href
 * mengarah ke halaman yang memang menangani aksinya (lihat review-pc.md
 * bagian 4/6/7 untuk pemetaan halaman -> aksi).
 */
export const buildActionItems = (
  chain: PettyCashPengajuanWithChain[],
): PcActionItem[] => {
  const items: PcActionItem[] = [];
  for (const pengajuan of chain) {
    const status = computePcOverallStatus(pengajuan);
    if (status.tone !== "action") continue;

    let ctaLabel = "Lihat Detail";
    let ctaHref = `/petty-cash/pengajuan-saya?open=${pengajuan.id}`;
    if (status.key === "menunggu_ajukan_voucher") {
      ctaLabel = "Ajukan Voucher";
      ctaHref = "/petty-cash/pengajuan-voucher";
    } else if (status.key === "menunggu_tarik_dana") {
      ctaLabel = "Tarik Dana";
      ctaHref = "/petty-cash/pengajuan-voucher";
    } else if (status.key === "menunggu_ajukan_deklarasi") {
      ctaLabel = "Ajukan Deklarasi";
      ctaHref = "/petty-cash/deklarasi";
    }

    items.push({ pengajuan, status, ctaLabel, ctaHref });
  }
  return items;
};

/** Ringkasan hitungan status utama seluruh rantai - dipakai kartu ringkasan Dashboard. */
export interface PcOverallSummary {
  aktif: number;
  perluTindakanSaya: number;
  menungguOrangLain: number;
  tuntas: number;
  ditolak: number;
}

export const summarizeOverallStatus = (
  chain: PettyCashPengajuanWithChain[],
): PcOverallSummary => {
  const summary: PcOverallSummary = {
    aktif: 0,
    perluTindakanSaya: 0,
    menungguOrangLain: 0,
    tuntas: 0,
    ditolak: 0,
  };

  for (const pengajuan of chain) {
    const status = computePcOverallStatus(pengajuan);
    if (status.tone === "rejected") {
      summary.ditolak += 1;
      continue;
    }
    if (status.key === "tuntas") {
      summary.tuntas += 1;
      continue;
    }
    summary.aktif += 1;
    if (status.tone === "action") summary.perluTindakanSaya += 1;
    if (status.tone === "waiting") summary.menungguOrangLain += 1;
  }

  return summary;
};

/** Satu baris di feed "Aktivitas Terbaru" Dashboard - dirakit murni dari timestamp yang sudah ada di rantai, tanpa query tambahan. */
export interface PcActivityEvent {
  id: string;
  type: "pengajuan" | "voucher" | "tarikan" | "deklarasi";
  label: string;
  kode: string;
  timestamp: Date;
  href: string;
}

/**
 * Rakit feed aktivitas dari data rantai yang sudah ada (tidak query lagi).
 * Sengaja cuma ambil event yang MAKNANYA pasti dari timestamp yang tersedia
 * (dibuat, dibayar via `paid_at` yang memang field khusus itu, atau status
 * akhir Approved/Rejected via `updated_at`) - progres antar-approver di
 * tengah jalur approval (approvals[].processed_at) SENGAJA belum dipecah
 * jadi event sendiri di v1 ini supaya tidak salah label.
 */
export const buildActivityFeed = (
  chain: PettyCashPengajuanWithChain[],
  limit = 10,
): PcActivityEvent[] => {
  const events: PcActivityEvent[] = [];

  for (const pengajuan of chain) {
    const pengajuanHref = `/petty-cash/pengajuan-saya?open=${pengajuan.id}`;
    events.push({
      id: `pengajuan-created-${pengajuan.id}`,
      type: "pengajuan",
      label: "Pengajuan diajukan",
      kode: pengajuan.kode_pengajuan,
      timestamp: new Date(pengajuan.created_at),
      href: pengajuanHref,
    });
    if (
      (pengajuan.status === "Approved" || pengajuan.status === "Rejected") &&
      pengajuan.updated_at &&
      String(pengajuan.updated_at) !== String(pengajuan.created_at)
    ) {
      events.push({
        id: `pengajuan-final-${pengajuan.id}`,
        type: "pengajuan",
        label:
          pengajuan.status === "Approved"
            ? "Pengajuan disetujui"
            : "Pengajuan ditolak",
        kode: pengajuan.kode_pengajuan,
        timestamp: new Date(pengajuan.updated_at),
        href: pengajuanHref,
      });
    }

    const voucher = pengajuan.petty_cash_voucher?.[0];
    if (!voucher) continue;

    events.push({
      id: `voucher-created-${voucher.id}`,
      type: "voucher",
      label: "Voucher diajukan",
      kode: voucher.kode_voucher,
      timestamp: new Date(voucher.created_at),
      href: pengajuanHref,
    });
    if (
      voucher.status !== "In Approval" &&
      voucher.updated_at &&
      String(voucher.updated_at) !== String(voucher.created_at)
    ) {
      events.push({
        id: `voucher-final-${voucher.id}`,
        type: "voucher",
        label:
          voucher.status === "Rejected"
            ? "Voucher ditolak"
            : voucher.status === "Selesai"
              ? "Voucher tuntas"
              : "Voucher disetujui",
        kode: voucher.kode_voucher,
        timestamp: new Date(voucher.updated_at),
        href: pengajuanHref,
      });
    }

    for (const sv of voucher.petty_cash_sub_voucher ?? []) {
      events.push({
        id: `sub-voucher-created-${sv.id}`,
        type: "tarikan",
        label: "Tarikan dana diajukan",
        kode: sv.kode_sub_voucher,
        timestamp: new Date(sv.created_at),
        href: pengajuanHref,
      });
      if (sv.status === "Selesai" && sv.paid_at) {
        events.push({
          id: `sub-voucher-paid-${sv.id}`,
          type: "tarikan",
          label: "Tarikan dana dibayar",
          kode: sv.kode_sub_voucher,
          timestamp: new Date(sv.paid_at),
          href: pengajuanHref,
        });
      }

      for (const d of sv.petty_cash_deklarasi ?? []) {
        events.push({
          id: `deklarasi-created-${d.id}`,
          type: "deklarasi",
          label: "Deklarasi diajukan",
          kode: d.kode_deklarasi,
          timestamp: new Date(d.created_at),
          href: pengajuanHref,
        });
        if (
          d.status !== "In Approval" &&
          d.updated_at &&
          String(d.updated_at) !== String(d.created_at)
        ) {
          events.push({
            id: `deklarasi-final-${d.id}`,
            type: "deklarasi",
            label:
              d.status === "Approved" ? "Deklarasi disetujui" : "Deklarasi ditolak",
            kode: d.kode_deklarasi,
            timestamp: new Date(d.updated_at),
            href: pengajuanHref,
          });
        }
      }
    }
  }

  return events
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);
};

/** Format relatif singkat ala "2 jam lalu" - tanpa dependency tambahan. */
export const formatRelativeTime = (date: Date): string => {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return "Baru saja";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 30) return `${diffDay} hari lalu`;
  const diffMonth = Math.round(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth} bulan lalu`;
  const diffYear = Math.round(diffMonth / 12);
  return `${diffYear} tahun lalu`;
};
