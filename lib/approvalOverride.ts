// src/lib/approvalOverride.ts
//
// Aturan bersama saat ADMIN mengubah status approver satu per satu lewat
// form admin (MR Management, PO Management, Kontrol Admin Petty Cash) -
// supaya workflow tetap jalan persis seperti approve/reject normal: status
// dokumen ikut dihitung ulang dari jalur approval-nya, bukan disimpan apa
// adanya. Fungsi di sini murni (tanpa DB) supaya bisa dipakai untuk preview
// status di form sekaligus validasi ulang di service saat simpan (lihat
// services/adminApprovalOverrideService.ts).
//
// Invarian jalur approval yang dijaga: approved* -> (rejected)? -> pending*
// - sama seperti hasil alur normal (approve berurutan, reject menghentikan
// alur). Approve melompati step yang masih pending tidak diizinkan.

import type { ApprovalAdminActor } from "@/type";

export type ApprovalStepStatus = "pending" | "approved" | "rejected";

export interface OverrideApprovalStep {
  userid: string;
  status: ApprovalStepStatus;
  nama?: string;
  processed_at?: string | null;
  processed_by_admin?: ApprovalAdminActor | null;
}

export interface ApprovalChange {
  index: number;
  from: ApprovalStepStatus;
  to: ApprovalStepStatus;
}

export type ApprovalOutcome = "empty" | "rejected" | "approved" | "in_progress";

/** Sama persis (urutan, approver, status) - dipakai cek "ada perubahan?" & konflik edit bersamaan. */
export const isSameApprovalChain = (
  a: OverrideApprovalStep[] | null | undefined,
  b: OverrideApprovalStep[] | null | undefined,
): boolean => {
  const x = a ?? [];
  const y = b ?? [];
  return (
    x.length === y.length &&
    x.every((step, i) => step.userid === y[i].userid && step.status === y[i].status)
  );
};

/** Perubahan status per step (index sama). Jumlah step tidak boleh berubah. */
export const getApprovalChanges = (
  baseline: OverrideApprovalStep[],
  next: OverrideApprovalStep[],
): ApprovalChange[] => {
  if (baseline.length !== next.length) {
    throw new Error("Jumlah step approval tidak boleh berubah dari form admin.");
  }
  return next
    .map((step, index) => ({
      index,
      from: baseline[index].status,
      to: step.status,
    }))
    .filter((c) => c.from !== c.to);
};

/**
 * True kalau ada step yang SUDAH diproses (approved/rejected) diubah lagi -
 * "mundur" dalam istilah form admin. Boleh hanya selama dokumen belum lanjut
 * ke tahap berikutnya (dicek per jenis dokumen di service).
 */
export const isApprovalRollback = (changes: ApprovalChange[]): boolean =>
  changes.some((c) => c.from !== "pending");

const stepLabel = (step: OverrideApprovalStep, index: number) =>
  step.nama ? `${step.nama} (step ${index + 1})` : `step ${index + 1}`;

/** Lempar error kalau jalur approval tidak berbentuk approved* -> (rejected)? -> pending*. */
export const assertSequentialApprovals = (
  approvals: OverrideApprovalStep[],
): void => {
  approvals.forEach((step, i) => {
    if (step.status === "pending") return;
    const blocker = approvals
      .slice(0, i)
      .findIndex((prev) => prev.status !== "approved");
    if (blocker === -1) return;
    const prev = approvals[blocker];
    throw new Error(
      prev.status === "rejected"
        ? `${stepLabel(prev, blocker)} sudah menolak - step sesudahnya harus tetap pending.`
        : `Approval harus berurutan: ${stepLabel(prev, blocker)} belum approved, ${stepLabel(step, i)} tidak bisa diproses lebih dahulu.`,
    );
  });
};

/** Index step yang sedang giliran (pending pertama, semua sebelumnya approved), -1 kalau tidak ada. */
export const getCurrentTurnIndex = (
  approvals: OverrideApprovalStep[] | null | undefined,
): number => {
  const list = approvals ?? [];
  const idx = list.findIndex((a) => a.status !== "approved");
  return idx !== -1 && list[idx].status === "pending" ? idx : -1;
};

/**
 * Admin memilih status "Rejected" tanpa menolak step mana pun: step yang sedang
 * giliran ikut ditolak, supaya jalur approval, notifikasi, & keterangannya sama
 * dengan penolakan biasa. Tidak berubah kalau tidak ada step yang giliran.
 */
export const rejectCurrentTurn = <T extends OverrideApprovalStep>(
  approvals: T[],
): T[] => {
  const turn = getCurrentTurnIndex(approvals);
  return approvals.map((step, i) =>
    i === turn ? { ...step, status: "rejected" as const } : step,
  );
};

export const deriveApprovalOutcome = (
  approvals: OverrideApprovalStep[] | null | undefined,
): ApprovalOutcome => {
  const list = approvals ?? [];
  if (list.length === 0) return "empty";
  if (list.some((a) => a.status === "rejected")) return "rejected";
  if (list.every((a) => a.status === "approved")) return "approved";
  return "in_progress";
};

/**
 * Stempel admin utk step yang diproses `actor`. Admin yang memang approver di
 * step itu memproses miliknya sendiri, jadi tidak perlu keterangan.
 */
export const getAdminStamp = (
  step: Pick<OverrideApprovalStep, "userid">,
  actor: ApprovalAdminActor,
): ApprovalAdminActor | null => (step.userid === actor.userid ? null : actor);

/**
 * processed_at & processed_by_admin diisi utk step yang baru diproses admin,
 * dikosongkan utk yang dikembalikan ke pending.
 */
export const stampProcessedAt = <T extends OverrideApprovalStep>(
  baseline: OverrideApprovalStep[],
  next: T[],
  actor: ApprovalAdminActor,
  now: string = new Date().toISOString(),
): T[] =>
  next.map((step, i) => {
    if (step.status === baseline[i]?.status) return step;
    return step.status === "pending"
      ? { ...step, processed_at: null, processed_by_admin: null }
      : {
          ...step,
          processed_at: now,
          processed_by_admin: getAdminStamp(step, actor),
        };
  });

/** "Admin Agung" - nama akun seperti "Administrator" tidak diberi awalan lagi. */
export const formatAdminName = (nama: string): string =>
  /admin/i.test(nama) ? nama : `Admin ${nama}`;

/**
 * Keterangan step yang diproses admin, mis. "Disetujui oleh Admin Agung, saat
 * proses persetujuan Budi". Sengaja netral: tidak menyiratkan approver step itu
 * dilangkahi. `null` kalau diproses approver sendiri.
 */
export const getAdminActionNote = (
  step: OverrideApprovalStep,
  stepLabel: string | undefined = step.nama,
): string | null => {
  const admin = step.processed_by_admin;
  if (!admin || step.status === "pending") return null;
  const verb = step.status === "approved" ? "Disetujui" : "Ditolak";
  return `${verb} oleh ${formatAdminName(admin.nama)}${stepLabel ? `, saat proses persetujuan ${stepLabel}` : ""}`;
};

/** Ringkasan perubahan untuk log aktivitas, mis. "Budi (step 2): pending -> approved". */
export const describeApprovalChanges = (
  next: OverrideApprovalStep[],
  changes: ApprovalChange[],
): string =>
  changes
    .map((c) => `${stepLabel(next[c.index], c.index)}: ${c.from} -> ${c.to}`)
    .join("; ");

/**
 * Status dokumen yang konsisten dengan jalur approval, utk dokumen yang
 * statusnya murni turunan approval selama fase approval (MR & Petty Cash).
 * `phaseStatuses` = status-status fase approval; status di luar itu (mis.
 * MR "On Process", Voucher "Selesai") tidak disentuh perubahan approval.
 */
export const resolveApprovalPhaseStatus = ({
  currentStatus,
  approvals,
  phaseStatuses,
  derive,
}: {
  currentStatus: string;
  approvals: OverrideApprovalStep[];
  phaseStatuses: readonly string[];
  derive: (outcome: ApprovalOutcome) => string | null;
}): string =>
  phaseStatuses.includes(currentStatus)
    ? (derive(deriveApprovalOutcome(approvals)) ?? currentStatus)
    : currentStatus;

// ==========================================
// MR & PETTY CASH - status murni turunan approval selama fase approval
// (lihat processMrApproval di services/approvalService.ts &
// approve*Step di services/pettyCash*Service.ts).
// ==========================================

export const MR_APPROVAL_PHASE_STATUSES = [
  "Pending Approval",
  "Waiting PO",
  "Rejected",
] as const;

// Status MR sebelum masuk proses PO - MR yang turun ke sini dari "Waiting
// PO" ke atas berarti dimundurkan (lihat planAdminMrApprovalUpdate).
export const MR_PRE_PO_STATUSES = [
  "Pending Validation",
  "On Hold",
  "Pending Approval",
  "Rejected",
] as const;

export const deriveMrStatus = (outcome: ApprovalOutcome): string | null =>
  outcome === "rejected"
    ? "Rejected"
    : outcome === "approved"
      ? "Waiting PO"
      : outcome === "in_progress"
        ? "Pending Approval"
        : null;

// "Selesai" (Voucher) sengaja di luar fase approval - itu status setelah
// semua tarikan dideklarasikan, bukan hasil approval.
export const PC_APPROVAL_PHASE_STATUSES = [
  "In Approval",
  "Approved",
  "Rejected",
] as const;

export const derivePcStatus = (outcome: ApprovalOutcome): string | null =>
  outcome === "rejected"
    ? "Rejected"
    : outcome === "approved"
      ? "Approved"
      : outcome === "in_progress"
        ? "In Approval"
        : null;

/**
 * Tolak status manual yang bertentangan dengan jalur approval - hanya utk
 * status fase approval; status di luar fase tetap bebas dipilih admin.
 */
export const assertStatusMatchesApprovals = ({
  docLabel,
  status,
  expectedStatus,
  phaseStatuses,
}: {
  docLabel: string;
  status: string;
  expectedStatus: string | null;
  phaseStatuses: readonly string[];
}): void => {
  if (expectedStatus === null || !phaseStatuses.includes(status)) return;
  if (status !== expectedStatus) {
    throw new Error(
      `Status ${docLabel} "${status}" tidak sesuai jalur approval - seharusnya "${expectedStatus}". Ubah status approver-nya, status dokumen akan menyesuaikan otomatis.`,
    );
  }
};
