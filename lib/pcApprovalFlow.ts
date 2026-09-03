// src/lib/pcApprovalFlow.ts
//
// Logic approval sekuensial yang dipakai bareng oleh Approval Pengajuan,
// Approval Voucher, dan (nanti) Approval Deklarasi Petty Cash - ketiganya
// punya bentuk `approvals` yang identik: array approver yang SEMUA mulai
// berstatus "pending" saat dokumen dibuat (approval_path template di-copy
// apa adanya, lihat createPettyCashPengajuan di pettyCashPengajuanService.ts).
// "Giliran" seseorang ditentukan saat baca, bukan disimpan - lihat
// isMyApprovalTurn.
//
// Diekstrak dari idiom yang sudah dipakai duluan di
// app/(With Sidebar)/petty-cash/[id]/page.tsx (myApprovalIndex/isMyTurn) -
// RLS UPDATE policy tabel-tabel ini (lihat
// supabase/petty-cash-pengajuan-approval-setup.sql) cuma menjamin "kamu ADA
// di approvals dengan status pending", BUKAN "sekarang giliran kamu" (semua
// approver mulai pending) - jadi urutan tetap wajib dicek di app lewat fungsi
// di sini sebelum mengizinkan approve/reject.

export interface PcApprovalStep {
  userid: string;
  status: "pending" | "approved" | "rejected";
  processed_at?: string | null;
}

/** Index step approval milik `userId` yang statusnya masih pending, -1 kalau tidak ada. */
export const getMyPendingApprovalIndex = <T extends PcApprovalStep>(
  approvals: T[] | null | undefined,
  userId: string,
): number =>
  (approvals ?? []).findIndex(
    (a) => a.userid === userId && a.status === "pending",
  );

/**
 * Apakah sekarang giliran `userId` approve/reject - step-nya pending DAN
 * semua step sebelumnya sudah approved.
 */
export const isMyApprovalTurn = <T extends PcApprovalStep>(
  approvals: T[] | null | undefined,
  userId: string,
): boolean => {
  const myIndex = getMyPendingApprovalIndex(approvals, userId);
  if (myIndex === -1) return false;
  return (approvals ?? [])
    .slice(0, myIndex)
    .every((a) => a.status === "approved");
};

export interface AdvanceApprovalResult<T extends PcApprovalStep> {
  approvals: T[];
  isLastApprover: boolean;
  nextApprover: T | null;
}

/**
 * Tandai step approval `userId` jadi "approved". Return null kalau bukan
 * gilirannya (dipanggil dari luar, panggil isMyApprovalTurn dulu buat
 * validasi sebelum proses/tampilkan tombol).
 */
export const advanceApproval = <T extends PcApprovalStep>(
  approvals: T[],
  userId: string,
): AdvanceApprovalResult<T> | null => {
  const myIndex = getMyPendingApprovalIndex(approvals, userId);
  if (myIndex === -1 || !isMyApprovalTurn(approvals, userId)) return null;

  const updated = [...approvals];
  updated[myIndex] = {
    ...updated[myIndex],
    status: "approved",
    processed_at: new Date().toISOString(),
  };

  const isLastApprover = myIndex === updated.length - 1;
  return {
    approvals: updated,
    isLastApprover,
    nextApprover: isLastApprover ? null : updated[myIndex + 1],
  };
};

/**
 * Tandai step approval `userId` jadi "rejected". Return null kalau bukan
 * gilirannya.
 */
export const rejectApproval = <T extends PcApprovalStep>(
  approvals: T[],
  userId: string,
): T[] | null => {
  const myIndex = getMyPendingApprovalIndex(approvals, userId);
  if (myIndex === -1 || !isMyApprovalTurn(approvals, userId)) return null;

  const updated = [...approvals];
  updated[myIndex] = {
    ...updated[myIndex],
    status: "rejected",
    processed_at: new Date().toISOString(),
  };
  return updated;
};
