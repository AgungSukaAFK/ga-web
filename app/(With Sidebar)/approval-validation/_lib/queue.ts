// app/(With Sidebar)/approval-validation/_lib/queue.ts
//
// Semua antrian di halaman Approval & Validation (validasi MR/PO, approval
// MR/PO, terima barang) dinormalisasi ke satu bentuk `QueueItem`, supaya
// pencarian, filter, sort, tabel, kartu mobile, dan dialog detail cukup
// ditulis sekali. Fungsi di sini murni (tanpa React / Supabase).

import type {
  Approval,
  Attachment,
  MaterialRequest,
  Order,
  POItem,
  PurchaseOrder,
} from "@/type";
import { extractPlainText } from "@/lib/rich-content";

export type QueueKind =
  | "mr-validation"
  | "po-validation"
  | "mr-approval"
  | "po-approval"
  | "po-receive";

export type Priority = "P0" | "P1" | "P2" | "P3" | "P4";
export const PRIORITIES: Priority[] = ["P0", "P1", "P2", "P3", "P4"];

export const PRIORITY_LABELS: Record<Priority, string> = {
  P0: "P0 · Sangat mendesak",
  P1: "P1 · Mendesak",
  P2: "P2 · Normal",
  P3: "P3 · Rendah",
  P4: "P4 · Sangat rendah",
};

export const KIND_META: Record<
  QueueKind,
  {
    label: string;
    short: string;
    docType: "MR" | "PO";
    actionLabel: string;
    /** Penjelasan singkat di atas tabel tab ini. */
    hint: string;
  }
> = {
  "mr-validation": {
    label: "Validasi MR",
    short: "Validasi",
    docType: "MR",
    actionLabel: "Validasi",
    hint: "MR baru yang perlu dicek GA lalu ditentukan alur approval-nya.",
  },
  "po-validation": {
    label: "Validasi PO",
    short: "Validasi",
    docType: "PO",
    actionLabel: "Validasi",
    hint: "PO baru yang perlu dicek GA lalu ditentukan alur approval-nya.",
  },
  "mr-approval": {
    label: "Approval MR",
    short: "Approval",
    docType: "MR",
    actionLabel: "Respon",
    hint: "MR yang sudah giliran Anda untuk disetujui atau ditolak.",
  },
  "po-approval": {
    label: "Approval PO",
    short: "Approval",
    docType: "PO",
    actionLabel: "Respon",
    hint: "PO yang sudah giliran Anda untuk disetujui atau ditolak (termasuk step Payment Validator).",
  },
  "po-receive": {
    label: "Terima Barang",
    short: "Terima",
    docType: "PO",
    actionLabel: "Terima",
    hint: "PO yang barangnya sudah boleh diterima GA di WH - lunas penuh, atau DP&BP skema Kirim Setelah DP.",
  },
};

/** Urutan tab di halaman. */
export const KIND_ORDER: QueueKind[] = [
  "mr-validation",
  "po-validation",
  "mr-approval",
  "po-approval",
  "po-receive",
];

export interface QueueLineItem {
  name: string;
  partNumber: string | null;
  qty: number;
  uom: string;
  price: number;
  total: number;
  note: string | null;
  vendor: string | null;
}

export interface QueueFlags {
  overdue: boolean;
  /** Jatuh tempo <= 3 hari lagi (belum lewat). */
  dueSoon: boolean;
  /** Estimasi MR melebihi sisa budget cost center. */
  overBudget: boolean;
  /** Sudah menunggu lebih dari STALE_DAYS hari. */
  stale: boolean;
  followups: number;
}

export interface QueueItem {
  key: string;
  kind: QueueKind;
  docType: "MR" | "PO";
  id: number | string;
  kode: string;
  status: string;
  createdAt: string;
  /** Kapan dokumen ini mulai menunggu di antrian user ini. */
  waitingSince: string;
  priority: Priority | null;
  dueDate: string | null;
  /** Selisih hari ke jatuh tempo (negatif = lewat). null = tanpa due date. */
  daysToDue: number | null;
  requester: string;
  department: string | null;
  company: string | null;
  site: string | null;
  kategori: string | null;
  amount: number;
  vendor: string | null;
  paymentTerm: string | null;
  refMr: { id: number | string; kode: string } | null;
  remarks: string;
  costCenter: { name: string; code: string | null; budget: number } | null;
  approvals: Approval[];
  /** Index step approval user ini (antrian approval saja). */
  myStepIndex: number;
  items: QueueLineItem[];
  attachments: Attachment[];
  flags: QueueFlags;
  /** Skor urgensi, makin besar makin mendesak (dipakai sort bawaan). */
  urgency: number;
  actionHref: string;
  detailHref: string;
  /** Teks gabungan untuk pencarian (lowercase). */
  searchText: string;
  // Rincian khusus PO (dialog detail).
  po?: {
    discount: number | null;
    tax: number | null;
    postage: number | null;
    pphAmount: number | null;
    notes: string | null;
    shippingAddress: string | null;
    currency: string;
    dpPaid: boolean | null;
    bpPaid: boolean | null;
  };
}

export const STALE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const toNumber = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const asPriority = (p: unknown): Priority | null =>
  typeof p === "string" && (PRIORITIES as string[]).includes(p)
    ? (p as Priority)
    : null;

const startOfDay = (d: Date) => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
};

export const daysUntil = (date: string | null, now: number) => {
  if (!date) return null;
  const due = startOfDay(new Date(date));
  if (Number.isNaN(due.getTime())) return null;
  return Math.round(
    (due.getTime() - startOfDay(new Date(now)).getTime()) / DAY_MS,
  );
};

const vendorName = (po: PurchaseOrder): string | null => {
  const v = po.vendor_details as
    | (PurchaseOrder["vendor_details"] & { nama_vendor?: string })
    | null;
  return v?.nama_vendor || v?.name || null;
};

/**
 * Kapan antrian approval sampai ke user ini: waktu step sebelumnya selesai.
 * Step pertama -> tidak tercatat kapan divalidasi, pakai fallback.
 */
const approvalWaitingSince = (
  approvals: Approval[],
  myIndex: number,
  fallback: string,
) => {
  let latest: string | null = null;
  approvals.slice(0, Math.max(0, myIndex)).forEach((a) => {
    if (a.processed_at && (!latest || a.processed_at > latest))
      latest = a.processed_at;
  });
  return latest ?? fallback;
};

const latestProcessedAt = (approvals: Approval[], fallback: string) => {
  let latest: string | null = null;
  approvals.forEach((a) => {
    if (a.processed_at && (!latest || a.processed_at > latest))
      latest = a.processed_at;
  });
  return latest ?? fallback;
};

const mrLineItems = (orders: Order[] | null | undefined): QueueLineItem[] =>
  (orders || [])
    .filter((o) => o.status !== "Cancelled" && o.status !== "Replaced")
    .map((o) => {
      const qty = toNumber(o.qty);
      const price = toNumber(o.estimasi_harga);
      return {
        name: o.name,
        partNumber: o.part_number || null,
        qty,
        uom: o.uom,
        price,
        total: qty * price,
        note: o.note || null,
        vendor: null,
      };
    });

const poLineItems = (items: POItem[] | null | undefined): QueueLineItem[] =>
  (items || []).map((i) => ({
    name: i.name,
    partNumber: i.part_number || null,
    qty: toNumber(i.qty),
    uom: i.uom,
    price: toNumber(i.price),
    total: toNumber(i.total_price) || toNumber(i.qty) * toNumber(i.price),
    note: i.description || null,
    vendor: i.vendor_name || null,
  }));

// Data mentah sebelum flag, skor urgensi & teks pencarian dihitung.
type BaseInput = Omit<
  QueueItem,
  "flags" | "urgency" | "searchText" | "daysToDue"
> & { followups: number };

function finalize({ followups, ...base }: BaseInput, now: number): QueueItem {
  const daysToDue = daysUntil(base.dueDate, now);
  const waitedDays = (now - new Date(base.waitingSince).getTime()) / DAY_MS;
  const flags: QueueFlags = {
    overdue: daysToDue !== null && daysToDue < 0,
    dueSoon: daysToDue !== null && daysToDue >= 0 && daysToDue <= 3,
    overBudget:
      !!base.costCenter &&
      base.docType === "MR" &&
      base.amount > base.costCenter.budget,
    stale: waitedDays > STALE_DAYS,
    followups,
  };

  // Skor kasar: prioritas paling berat, lalu jatuh tempo, follow-up, lama
  // menunggu. Cuma dipakai sebagai urutan bawaan "Paling mendesak".
  const prioScore = base.priority
    ? (5 - PRIORITIES.indexOf(base.priority)) * 100
    : 50;
  const dueScore = flags.overdue ? 150 : flags.dueSoon ? 80 : 0;
  const urgency =
    prioScore +
    dueScore +
    Math.min(followups, 5) * 20 +
    Math.min(Math.max(waitedDays, 0), 30) * 3;

  const searchText = [
    base.kode,
    base.refMr?.kode,
    base.requester,
    base.department,
    base.company,
    base.site,
    base.kategori,
    base.vendor,
    base.costCenter?.name,
    base.costCenter?.code,
    base.remarks,
    base.status,
    ...base.items.map((i) => `${i.name} ${i.partNumber ?? ""}`),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return { ...base, daysToDue, flags, urgency, searchText };
}

export function fromMr(
  mr: MaterialRequest,
  kind: "mr-validation" | "mr-approval",
  userId: string,
  now: number,
): QueueItem {
  const approvals = (mr.approvals || []) as Approval[];
  const createdAt = String(mr.created_at);
  const myStepIndex =
    kind === "mr-approval"
      ? approvals.findIndex((a) => a.userid === userId && a.status === "pending")
      : -1;
  const cc = mr.cost_centers;
  const base: BaseInput = {
    key: `${kind}-${mr.id}`,
    kind,
    docType: "MR",
    id: mr.id,
    kode: mr.kode_mr,
    status: mr.status,
    createdAt,
    waitingSince:
      kind === "mr-approval"
        ? approvalWaitingSince(approvals, myStepIndex, createdAt)
        : createdAt,
    priority: asPriority(mr.prioritas),
    dueDate: mr.due_date ? String(mr.due_date) : null,
    requester: mr.users_with_profiles?.nama || "N/A",
    department: mr.department || null,
    company: mr.company_code || null,
    site: mr.tujuan_site || null,
    kategori: mr.kategori || null,
    amount: toNumber(mr.cost_estimation),
    vendor: null,
    paymentTerm: null,
    refMr: null,
    remarks: extractPlainText(mr.remarks) || "",
    costCenter: cc
      ? { name: cc.name, code: cc.code ?? null, budget: toNumber(cc.current_budget) }
      : null,
    approvals,
    myStepIndex,
    items: mrLineItems(mr.orders),
    attachments: mr.attachments || [],
    actionHref:
      kind === "mr-validation"
        ? `/material-request/validate/${mr.id}`
        : `/material-request/${mr.id}`,
    detailHref: `/material-request/${mr.id}`,
    followups: (mr.followup_requests || []).filter(
      (f) => kind !== "mr-approval" || f.approver_id === userId,
    ).length,
  };
  return finalize(base, now);
}

export function fromPo(
  po: PurchaseOrder,
  kind: "po-validation" | "po-approval" | "po-receive",
  userId: string,
  now: number,
): QueueItem {
  const approvals = (po.approvals || []) as Approval[];
  const mr = po.material_requests as
    | (Partial<MaterialRequest> & { id?: number | string; kode_mr?: string })
    | null
    | undefined;
  const myStepIndex =
    kind === "po-approval"
      ? approvals.findIndex((a) => a.userid === userId && a.status === "pending")
      : -1;
  const waitingSince =
    kind === "po-approval"
      ? approvalWaitingSince(approvals, myStepIndex, po.created_at)
      : kind === "po-receive"
        ? latestProcessedAt(approvals, po.updated_at || po.created_at)
        : po.created_at;

  const base: BaseInput = {
    key: `${kind}-${po.id}`,
    kind,
    docType: "PO",
    id: po.id,
    kode: po.kode_po,
    status: po.status,
    createdAt: po.created_at,
    waitingSince,
    priority: asPriority(mr?.prioritas),
    dueDate: mr?.due_date ? String(mr.due_date) : null,
    requester: po.users_with_profiles?.nama || "N/A",
    department: mr?.department || null,
    company: po.company_code || null,
    site: mr?.tujuan_site || null,
    kategori: mr?.kategori || null,
    amount: toNumber(po.total_price),
    vendor: vendorName(po),
    paymentTerm: po.payment_term,
    refMr:
      mr?.kode_mr && mr.id !== undefined
        ? { id: mr.id, kode: mr.kode_mr }
        : mr?.kode_mr
          ? { id: po.mr_id ?? "", kode: mr.kode_mr }
          : null,
    remarks: po.notes || "",
    costCenter: null,
    approvals,
    myStepIndex,
    items: poLineItems(po.items),
    attachments: po.attachments || [],
    actionHref:
      kind === "po-validation"
        ? `/purchase-order/validate/${po.id}`
        : `/purchase-order/${po.id}`,
    detailHref: `/purchase-order/${po.id}`,
    followups: (po.followup_requests || []).filter(
      (f) => kind !== "po-approval" || f.approver_id === userId,
    ).length,
    po: {
      discount: po.discount,
      tax: po.tax,
      postage: po.postage,
      pphAmount: po.pph_amount ?? null,
      notes: po.notes,
      shippingAddress: po.shipping_address,
      currency: po.currency || "IDR",
      dpPaid: po.dp_paid ?? null,
      bpPaid: po.bp_paid ?? null,
    },
  };
  return finalize(base, now);
}

// ---------------------------------------------------------------------------
// Filter, pencarian, sort
// ---------------------------------------------------------------------------

export type UrgencyFilter =
  | "urgent"
  | "overdue"
  | "due-soon"
  | "followup"
  | "over-budget"
  | "stale";

export const URGENCY_FILTERS: { value: UrgencyFilter; label: string }[] = [
  { value: "urgent", label: "Mendesak (P0/P1 atau lewat tempo)" },
  { value: "overdue", label: "Lewat jatuh tempo" },
  { value: "due-soon", label: "Jatuh tempo ≤ 3 hari" },
  { value: "followup", label: "Sudah di-follow-up" },
  { value: "over-budget", label: "Melebihi budget" },
  { value: "stale", label: `Menunggu > ${STALE_DAYS} hari` },
];

export const isUrgent = (i: QueueItem) =>
  i.priority === "P0" || i.priority === "P1" || i.flags.overdue;

export const matchesUrgency = (i: QueueItem, f: UrgencyFilter) => {
  switch (f) {
    case "urgent":
      return isUrgent(i);
    case "overdue":
      return i.flags.overdue;
    case "due-soon":
      return i.flags.dueSoon;
    case "followup":
      return i.flags.followups > 0;
    case "over-budget":
      return i.flags.overBudget;
    case "stale":
      return i.flags.stale;
  }
};

export interface QueueFilters {
  search: string;
  priority: string; // "" | Priority | "none"
  department: string;
  company: string;
  urgency: UrgencyFilter | "";
}

export function filterQueue(items: QueueItem[], f: QueueFilters) {
  const terms = f.search.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((i) => {
    if (f.priority) {
      if (f.priority === "none" ? i.priority !== null : i.priority !== f.priority)
        return false;
    }
    if (f.department && i.department !== f.department) return false;
    if (f.company && i.company !== f.company) return false;
    if (f.urgency && !matchesUrgency(i, f.urgency)) return false;
    return terms.every((t) => i.searchText.includes(t));
  });
}

export const SEARCH_FIELDS = [
  "Kode MR / PO",
  "Ref. MR",
  "Requester / pembuat",
  "Departemen",
  "Perusahaan",
  "Site",
  "Vendor",
  "Cost center",
  "Nama barang",
  "Part number",
  "Remarks / catatan",
];

export type SortKey = "kode" | "prioritas" | "due" | "nilai" | "menunggu";
export const DEFAULT_SORT = ""; // "" = paling mendesak dulu

export function sortQueue(items: QueueItem[], sort: string) {
  const [key, dir] = sort.split(".") as [SortKey, "asc" | "desc"];
  const mul = dir === "desc" ? -1 : 1;
  const prioRank = (p: Priority | null) =>
    p ? PRIORITIES.indexOf(p) : PRIORITIES.length;
  const copy = [...items];
  const byUrgency = (a: QueueItem, b: QueueItem) =>
    b.urgency - a.urgency ||
    new Date(a.waitingSince).getTime() - new Date(b.waitingSince).getTime();

  copy.sort((a, b) => {
    let r = 0;
    switch (key) {
      case "kode":
        r = a.kode.localeCompare(b.kode, "id", { numeric: true });
        break;
      case "prioritas":
        r = prioRank(a.priority) - prioRank(b.priority);
        break;
      case "due":
        // Tanpa due date selalu di bawah, apa pun arahnya.
        if (a.daysToDue === null || b.daysToDue === null)
          return (a.daysToDue === null ? 1 : 0) - (b.daysToDue === null ? 1 : 0);
        r = a.daysToDue - b.daysToDue;
        break;
      case "nilai":
        r = a.amount - b.amount;
        break;
      case "menunggu":
        // asc = paling lama menunggu dulu.
        r =
          new Date(a.waitingSince).getTime() -
          new Date(b.waitingSince).getTime();
        break;
      default:
        return byUrgency(a, b);
    }
    return r * mul || byUrgency(a, b);
  });
  return copy;
}

// ---------------------------------------------------------------------------
// Teks bantu
// ---------------------------------------------------------------------------

/** "Lewat 2 hari", "Hari ini", "3 hari lagi". */
export function dueLabel(daysToDue: number | null) {
  if (daysToDue === null) return null;
  if (daysToDue < 0) return `Lewat ${Math.abs(daysToDue)} hari`;
  if (daysToDue === 0) return "Hari ini";
  if (daysToDue === 1) return "Besok";
  return `${daysToDue} hari lagi`;
}

/** Durasi ringkas sejak `since`: "12 mnt", "5 jam", "3 hr 2 j". */
export function waitingLabel(since: string, now: number) {
  const ms = Math.max(0, now - new Date(since).getTime());
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return minutes < 1 ? "Baru saja" : `${minutes} mnt`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam`;
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH ? `${days} hr ${remH} j` : `${days} hari`;
}

export const approvalStepLabel = (a: Approval) => a.type || a.role || "Approver";
