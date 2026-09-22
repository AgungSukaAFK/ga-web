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

// ==========================================
// "EDIT & SETUJUI" - approver boleh mengedit seluruh field yang bisa diedit
// (items/needed_date/week_of_month/notes/attachments) SEKALIGUS approve step
// dia, dengan versi SEBELUM edit dicatat ke `revisions[]` supaya bisa
// dibandingkan lagi nanti (lihat PcDocumentRevision, type/index.ts).
// Digenerik-kan sama seperti PcApprovalStep di atas (tidak import tipe dari
// type/index.ts) supaya dipakai bareng oleh ketiga tahap Pengajuan/
// Voucher/Deklarasi tanpa perlu union/casting tipe item & attachment
// masing-masing - tiap service (pettyCashPengajuanService.ts dkk) yang
// menyuplai tipe konkretnya lewat generic TItem/TAttachment saat memanggil.
// ==========================================

export interface PcEditableFields<TItem = unknown, TAttachment = unknown> {
  needed_date?: string | Date;
  week_of_month?: number | null;
  notes: string | null;
  items: TItem[];
  attachments: TAttachment[];
}

export interface PcRevisionEntry<TItem = unknown, TAttachment = unknown> {
  revised_by: string;
  revised_by_name: string;
  revised_at: string;
  snapshot: PcEditableFields<TItem, TAttachment>;
}

export interface EditAndApproveResult<
  T extends PcApprovalStep,
  TItem = unknown,
  TAttachment = unknown,
> {
  approvals: T[];
  isLastApprover: boolean;
  status: "Approved" | "In Approval";
  revisions: PcRevisionEntry<TItem, TAttachment>[];
}

/**
 * Bangun patch update siap dikirim ke `.update()` utk "Edit & Setujui" -
 * null kalau bukan giliran `userId`. `current` adalah nilai field-field
 * yang bisa diedit SEBELUM diubah (buat disnapshot ke revisions), `edits`
 * adalah nilai baru yang mau diterapkan. Caller (services/pettyCash*
 * Service.ts) yang tetap bertanggung jawab menulis `edits` itu sendiri ke
 * kolom-kolom terkait plus menghitung ulang total_amount - fungsi ini cuma
 * ngurus bagian approval + revision history-nya.
 */
export const buildEditAndApproveUpdate = <
  T extends PcApprovalStep,
  TItem = unknown,
  TAttachment = unknown,
>(
  current: { approvals: T[]; revisions?: PcRevisionEntry<TItem, TAttachment>[] | null } & PcEditableFields<
    TItem,
    TAttachment
  >,
  userId: string,
  userName: string,
): EditAndApproveResult<T, TItem, TAttachment> | null => {
  const advanced = advanceApproval(current.approvals, userId);
  if (!advanced) return null;

  const previousVersion: PcRevisionEntry<TItem, TAttachment> = {
    revised_by: userId,
    revised_by_name: userName,
    revised_at: new Date().toISOString(),
    snapshot: {
      needed_date: current.needed_date,
      week_of_month: current.week_of_month,
      notes: current.notes,
      items: current.items,
      attachments: current.attachments,
    },
  };

  return {
    approvals: advanced.approvals,
    isLastApprover: advanced.isLastApprover,
    status: advanced.isLastApprover ? "Approved" : "In Approval",
    revisions: [...(current.revisions ?? []), previousVersion],
  };
};
