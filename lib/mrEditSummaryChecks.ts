// lib/mrEditSummaryChecks.ts
//
// Checklist panel ringkasan untuk halaman EDIT Material Request:
// - mr-management/edit/[id] (Edit MR admin)
// - material-request/[id] (mode edit inline: approver / revisi requester)
// Halaman edit tidak punya validasi wajib saat simpan, jadi data yang belum
// lengkap ditandai `suggested` (kelihatan, tidak memblok simpan).

import type { FormSummaryCheck } from "@/components/form-summary-panel";
import type { MaterialRequest } from "@/type";
import { extractPlainText } from "@/lib/rich-content";
import { formatCurrency, formatDateFriendly } from "@/lib/utils";
import { WAJIB_LAMPIRAN_KATEGORI } from "@/lib/constants/mr";

/** id elemen tujuan scroll - pasang di wrapper field/section halaman. */
export const MR_EDIT_TARGETS = {
  kategori: "mr-field-kategori",
  prioritas: "mr-field-prioritas",
  tujuan: "mr-field-tujuan",
  costCenter: "mr-field-cost-center",
  remarks: "mr-field-remarks",
  items: "mr-section-items",
  attachments: "mr-section-attachments",
  approvals: "mr-section-approvals",
  header: "mr-section-header",
} as const;

type Options = {
  /** Nama cost center yang sudah ditentukan (null = belum). Tidak diisi = baris disembunyikan. */
  costCenterLabel?: string | null;
  /** Tampilkan baris Jalur Approval. */
  includeApprovals?: boolean;
  /** Tampilkan baris Status & Level (admin). */
  includeStatus?: boolean;
};

export function buildMrEditChecks(
  mr: MaterialRequest,
  { costCenterLabel, includeApprovals, includeStatus }: Options = {},
): FormSummaryCheck[] {
  const orders = Array.isArray(mr.orders) ? mr.orders : [];
  const attachments = Array.isArray(mr.attachments) ? mr.attachments : [];
  const approvals = Array.isArray(mr.approvals) ? mr.approvals : [];
  const invalidOrderCount = orders.filter((o) => !o.barang_id).length;
  const totalCost = orders.reduce(
    (acc, o) => acc + (Number(o.qty) || 0) * (Number(o.estimasi_harga) || 0),
    0,
  );
  const remarksText = extractPlainText(mr.remarks);
  const lampiranWajib = WAJIB_LAMPIRAN_KATEGORI.includes(mr.kategori);
  const approvedCount = approvals.filter((a) => a.status === "approved").length;

  const checks: FormSummaryCheck[] = [];

  if (includeStatus) {
    checks.push({
      id: "status",
      label: "Status & level",
      status: "done",
      value: `${mr.status} · ${mr.level || "-"}`,
      targetId: MR_EDIT_TARGETS.header,
    });
  }

  checks.push(
    {
      id: "kategori",
      label: "Kategori",
      status: mr.kategori ? "done" : "suggested",
      value: mr.kategori || undefined,
      hint: mr.kategori ? undefined : "Belum dipilih",
      targetId: MR_EDIT_TARGETS.kategori,
    },
    {
      id: "prioritas",
      label: "Prioritas",
      status: mr.prioritas ? "done" : "suggested",
      value: mr.prioritas || undefined,
      hint: mr.due_date
        ? `Due date ${formatDateFriendly(mr.due_date)}`
        : "Due date belum ada",
      targetId: MR_EDIT_TARGETS.prioritas,
    },
    {
      id: "tujuan",
      label: "Tujuan pengiriman",
      status: mr.tujuan_site ? "done" : "suggested",
      value: mr.tujuan_site || undefined,
      hint: mr.tujuan_site ? undefined : "Belum dipilih",
      targetId: MR_EDIT_TARGETS.tujuan,
    },
  );

  if (costCenterLabel !== undefined) {
    checks.push({
      id: "cost-center",
      label: "Cost center",
      status: costCenterLabel ? "done" : "suggested",
      value: costCenterLabel || undefined,
      hint: costCenterLabel ? undefined : "Belum ditentukan",
      targetId: MR_EDIT_TARGETS.costCenter,
    });
  }

  checks.push(
    {
      id: "remarks",
      label: "Remarks",
      status: mr.remarks ? "done" : "suggested",
      value: remarksText || undefined,
      hint: mr.remarks ? undefined : "Tujuan & latar belakang kosong",
      targetId: MR_EDIT_TARGETS.remarks,
    },
    {
      id: "items",
      label: "Order item",
      status: orders.length > 0 && invalidOrderCount === 0 ? "done" : "suggested",
      value: orders.length > 0 ? `${orders.length} barang` : undefined,
      hint:
        orders.length === 0
          ? "Belum ada barang"
          : invalidOrderCount > 0
            ? `${invalidOrderCount} item bukan dari database`
            : undefined,
      targetId: MR_EDIT_TARGETS.items,
    },
    {
      id: "cost",
      label: "Estimasi biaya",
      status: totalCost > 0 ? "done" : "suggested",
      value: totalCost > 0 ? formatCurrency(totalCost) : undefined,
      hint: totalCost > 0 ? undefined : "Total estimasi masih Rp 0",
      targetId: MR_EDIT_TARGETS.items,
    },
    {
      id: "lampiran",
      label: "Lampiran",
      status:
        attachments.length > 0
          ? "done"
          : lampiranWajib
            ? "suggested"
            : "optional",
      value: attachments.length > 0 ? `${attachments.length} file` : undefined,
      hint:
        lampiranWajib && attachments.length === 0
          ? `Wajib untuk kategori ${mr.kategori}`
          : undefined,
      targetId: MR_EDIT_TARGETS.attachments,
    },
  );

  if (includeApprovals) {
    checks.push({
      id: "approvals",
      label: "Jalur approval",
      status: approvals.length > 0 ? "done" : "suggested",
      value:
        approvals.length > 0
          ? `${approvedCount}/${approvals.length} approved`
          : undefined,
      hint: approvals.length > 0 ? undefined : "Belum ditentukan",
      targetId: MR_EDIT_TARGETS.approvals,
    });
  }

  return checks;
}
