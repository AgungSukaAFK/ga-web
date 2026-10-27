/**
 * lib/notifications/client.ts
 *
 * Client-side notification utility.
 * Scalable: designed to support multiple channels (in-app, WhatsApp, email, etc.)
 * in the future. Currently handles in-app (Supabase DB) notifications.
 *
 * ADDING A NEW CHANNEL:
 *   1. Add the channel handler in `dispatchToChannels`
 *   2. Feature-flag it with an env var or per-user setting
 */

import { createClient } from "@/lib/supabase/client";
import { GA_DEPARTMENTS } from "@/lib/constants/departments";
import { formatCurrency } from "@/lib/utils";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type NotificationEventType =
  | "mention"
  | "reply"
  | "mr_submitted"
  | "mr_validated"
  | "mr_approved_step"
  | "mr_fully_approved"
  | "mr_rejected"
  | "mr_held"
  | "po_submitted"
  | "po_validated"
  | "po_approved_step"
  | "po_fully_approved"
  | "po_rejected"
  | "pc_submitted"
  | "pc_routed"
  | "pc_approved_step"
  | "pc_fully_approved"
  | "pc_rejected"
  | "pc_payment_requested"
  | "pc_paid"
  | "pc_return_submitted"
  | "pc_return_confirmed"
  | "pc_return_rejected"
  | "mr_followup_requested"
  | "po_followup_requested"
  | "support_message"
  | "info";

export type NotificationResourceType =
  | "material_request"
  | "purchase_order"
  | "petty_cash"
  | "support_ticket";

export interface NotificationPayload {
  /** UUID of the user who should RECEIVE this notification */
  userId: string;
  /** UUID of the user who triggered this action (actor) */
  actorId?: string;
  type: NotificationEventType;
  title: string;
  message: string;
  link: string;
  resourceId?: string;
  resourceType?: NotificationResourceType;
}

// ─────────────────────────────────────────────
// Core send
// ─────────────────────────────────────────────
//
// All inserts go through the `create_notifications` Postgres RPC
// (SECURITY DEFINER). This is required because RLS blocks a client from
// inserting a notification row whose `user_id` is someone ELSE (the recipient).
// The RPC also forces `actor_id = auth.uid()`, so `actorId` in the payload is
// only kept for type-compatibility and is ignored server-side.
//
// See: supabase/migrations/0002_mr_po.sql (asal: notifications_setup.sql)

/** Shape of a single row passed to the create_notifications RPC. */
type NotificationRow = {
  user_id: string;
  type: NotificationEventType;
  title: string;
  message: string;
  link: string;
  resource_id?: string | null;
  resource_type?: NotificationResourceType | null;
};

/**
 * Dispatch notification rows via the RPC.
 * Never throws — a failed notification must not break the main user flow,
 * but errors ARE logged (the previous silent-swallow hid a total outage).
 */
async function dispatchNotifications(rows: NotificationRow[]): Promise<void> {
  if (rows.length === 0) return;
  try {
    const supabase = createClient();
    const { error } = await supabase.rpc("create_notifications", {
      p_notifications: rows,
    });
    if (error) {
      console.error("[Notification] RPC create_notifications failed:", error);
    }
  } catch (err) {
    console.error("[Notification] Failed to dispatch notifications:", err);
  }

  dispatchPushChannel(rows);
}

/**
 * Channel: Web Push (lihat lib/notifications/push.ts &
 * app/api/push/send/route.ts) - bikin notifikasi tetap masuk ke HP walau
 * browser/tab penerima sudah ditutup, beda dari in-app di atas yang cuma
 * kebaca kalau tab-nya lagi kebuka. Fire-and-forget lewat API route server
 * (VAPID private key wajib di server, tidak boleh di browser) -
 * grouped per (title, message, link) yang sama supaya notifikasi broadcast
 * ke banyak user (mis. sendNotifications) cukup 1 request, bukan N request.
 * Gagal di sini TIDAK BOLEH mengganggu notifikasi in-app yang sudah berhasil
 * di atas - makanya cuma di-log, tidak di-throw.
 */
function dispatchPushChannel(rows: NotificationRow[]): void {
  const groups = new Map<
    string,
    { userIds: string[]; title: string; message: string; link: string }
  >();

  for (const row of rows) {
    const key = `${row.title}|||${row.message}|||${row.link}`;
    const existing = groups.get(key);
    if (existing) {
      existing.userIds.push(row.user_id);
    } else {
      groups.set(key, {
        userIds: [row.user_id],
        title: row.title,
        message: row.message,
        link: row.link,
      });
    }
  }

  for (const group of groups.values()) {
    fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userIds: group.userIds,
        title: group.title,
        body: group.message,
        url: group.link,
      }),
    }).catch((err) => {
      console.error("[Notification] Push channel failed:", err);
    });
  }
}

/**
 * Send a single notification to one recipient.
 */
export async function sendNotification(
  payload: NotificationPayload,
): Promise<void> {
  await dispatchNotifications([
    {
      user_id: payload.userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      link: payload.link,
      resource_id: payload.resourceId ?? null,
      resource_type: payload.resourceType ?? null,
    },
  ]);
}

/**
 * Send the same notification event to multiple recipients at once.
 * Deduplicates by userId to avoid double-notifying the same person.
 */
export async function sendNotifications(
  recipients: string[],
  common: Omit<NotificationPayload, "userId">,
): Promise<void> {
  const unique = [...new Set(recipients)];
  if (unique.length === 0) return;

  await dispatchNotifications(
    unique.map((userId) => ({
      user_id: userId,
      type: common.type,
      title: common.title,
      message: common.message,
      link: common.link,
      resource_id: common.resourceId ?? null,
      resource_type: common.resourceType ?? null,
    })),
  );
}

// ─────────────────────────────────────────────
// Recipient resolvers
// ─────────────────────────────────────────────

/**
 * Returns the user IDs of all active GA (General Affair) staff for a given company.
 * Includes LOURDES users who are GA (they can manage all companies).
 */
export async function getGAUserIds(companyCode: string): Promise<string[]> {
  try {
    const supabase = createClient();
    const companyCodes =
      companyCode === "LOURDES" ? ["LOURDES"] : [companyCode, "LOURDES"];
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .in("department", GA_DEPARTMENTS as readonly string[])
      .in("company", companyCodes);
    return (data ?? []).map((p: { id: string }) => p.id);
  } catch {
    return [];
  }
}

/**
 * Returns user IDs for GA + Finance staff (used for Petty Cash notifications).
 */
export async function getGAAndFinanceUserIds(
  companyCode: string,
): Promise<string[]> {
  try {
    const supabase = createClient();
    const companyCodes =
      companyCode === "LOURDES" ? ["LOURDES"] : [companyCode, "LOURDES"];
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .in("department", [...GA_DEPARTMENTS, "Finance"])
      .in("company", companyCodes);
    return (data ?? []).map((p: { id: string }) => p.id);
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────
// Domain helpers
// ─────────────────────────────────────────────

/**
 * Notify all GA members that a new MR has been submitted.
 */
export async function notifyGAOnMRSubmit({
  actorId,
  companyCode,
  kodeMR,
  mrId,
}: {
  actorId: string;
  companyCode: string;
  kodeMR: string;
  mrId: string | number;
}): Promise<void> {
  const gaIds = await getGAUserIds(companyCode);
  const recipients = gaIds.filter((id) => id !== actorId);
  await sendNotifications(recipients, {
    actorId,
    type: "mr_submitted",
    title: "MR Baru Menunggu Validasi",
    message: `Material Request ${kodeMR} baru masuk dan menunggu validasi GA.`,
    link: `/material-request/validate/${mrId}`,
    resourceId: String(mrId),
    resourceType: "material_request",
  });
}

/**
 * After GA validates an MR → notify creator + first pending approver.
 */
export async function notifyOnMRValidated({
  actorId,
  creatorId,
  firstApproverId,
  kodeMR,
  mrId,
}: {
  actorId: string;
  creatorId: string;
  firstApproverId?: string;
  kodeMR: string;
  mrId: string | number;
}): Promise<void> {
  // Notify creator
  if (creatorId && creatorId !== actorId) {
    await sendNotification({
      userId: creatorId,
      actorId,
      type: "mr_validated",
      title: "MR Kamu Divalidasi",
      message: `Material Request ${kodeMR} telah divalidasi oleh GA dan masuk proses persetujuan.`,
      link: `/material-request/${mrId}`,
      resourceId: String(mrId),
      resourceType: "material_request",
    });
  }
  // Notify first approver - termasuk kalau approver pertamanya adalah GA yang
  // baru saja memvalidasi sendiri (self-notify sengaja TIDAK di-skip di sini):
  // setelah validasi, halaman redirect ke /approval-validation, jadi tanpa
  // notifikasi ini GA tidak dapat pengingat kalau MR-nya sekarang menunggu
  // approval-nya sendiri.
  if (firstApproverId) {
    await sendNotification({
      userId: firstApproverId,
      actorId,
      type: "mr_validated",
      title: "Persetujuan MR Dibutuhkan",
      message: `Material Request ${kodeMR} menunggu persetujuan Anda.`,
      link: `/material-request/${mrId}`,
      resourceId: String(mrId),
      resourceType: "material_request",
    });
  }
}

/**
 * After GA holds an MR → notify creator with the correction instruction.
 */
export async function notifyOnMRHold({
  actorId,
  creatorId,
  kodeMR,
  mrId,
  instruction,
}: {
  actorId: string;
  creatorId: string;
  kodeMR: string;
  mrId: string | number;
  instruction: string;
}): Promise<void> {
  if (!creatorId || creatorId === actorId) return;
  await sendNotification({
    userId: creatorId,
    actorId,
    type: "mr_held",
    title: "MR Kamu Perlu Diperbaiki",
    message: `Material Request ${kodeMR} ditahan oleh GA. Arahan perbaikan: ${instruction}`,
    link: `/material-request/${mrId}`,
    resourceId: String(mrId),
    resourceType: "material_request",
  });
}

/**
 * After MR approve/reject step.
 */
export async function notifyOnMRApproval({
  actorId,
  creatorId,
  nextApproverId,
  decision,
  kodeMR,
  mrId,
}: {
  actorId: string;
  creatorId: string;
  nextApproverId?: string;
  decision: "approved" | "rejected";
  kodeMR: string;
  mrId: string | number;
}): Promise<void> {
  if (decision === "rejected") {
    if (creatorId && creatorId !== actorId) {
      await sendNotification({
        userId: creatorId,
        actorId,
        type: "mr_rejected",
        title: "MR Kamu Ditolak",
        message: `Material Request ${kodeMR} telah ditolak.`,
        link: `/material-request/${mrId}`,
        resourceId: String(mrId),
        resourceType: "material_request",
      });
    }
    return;
  }

  if (nextApproverId) {
    await sendNotification({
      userId: nextApproverId,
      actorId,
      type: "mr_approved_step",
      title: "Persetujuan MR Dibutuhkan",
      message: `Material Request ${kodeMR} kini menunggu persetujuan Anda.`,
      link: `/material-request/${mrId}`,
      resourceId: String(mrId),
      resourceType: "material_request",
    });
  } else {
    // Fully approved → notify creator
    if (creatorId && creatorId !== actorId) {
      await sendNotification({
        userId: creatorId,
        actorId,
        type: "mr_fully_approved",
        title: "MR Kamu Disetujui Sepenuhnya",
        message: `Material Request ${kodeMR} telah disetujui semua pihak dan masuk ke tahap selanjutnya.`,
        link: `/material-request/${mrId}`,
        resourceId: String(mrId),
        resourceType: "material_request",
      });
    }
  }
}

/**
 * Notify all GA that a new PO was submitted.
 */
export async function notifyGAOnPOSubmit({
  actorId,
  companyCode,
  kodePO,
  poId,
}: {
  actorId: string;
  companyCode: string;
  kodePO: string;
  poId: string | number;
}): Promise<void> {
  const gaIds = await getGAUserIds(companyCode);
  const recipients = gaIds.filter((id) => id !== actorId);
  await sendNotifications(recipients, {
    actorId,
    type: "po_submitted",
    title: "PO Baru Menunggu Validasi",
    message: `Purchase Order ${kodePO} baru masuk dan menunggu validasi GA.`,
    link: `/purchase-order/validate/${poId}`,
    resourceId: String(poId),
    resourceType: "purchase_order",
  });
}

/**
 * After GA validates PO → notify creator + first approver.
 */
export async function notifyOnPOValidated({
  actorId,
  creatorId,
  firstApproverId,
  kodePO,
  poId,
}: {
  actorId: string;
  creatorId: string;
  firstApproverId?: string;
  kodePO: string;
  poId: string | number;
}): Promise<void> {
  if (creatorId && creatorId !== actorId) {
    await sendNotification({
      userId: creatorId,
      actorId,
      type: "po_validated",
      title: "PO Kamu Divalidasi",
      message: `Purchase Order ${kodePO} telah divalidasi oleh GA dan masuk proses persetujuan.`,
      link: `/purchase-order/${poId}`,
      resourceId: String(poId),
      resourceType: "purchase_order",
    });
  }
  if (firstApproverId && firstApproverId !== actorId) {
    await sendNotification({
      userId: firstApproverId,
      actorId,
      type: "po_validated",
      title: "Persetujuan PO Dibutuhkan",
      message: `Purchase Order ${kodePO} menunggu persetujuan Anda.`,
      link: `/purchase-order/${poId}`,
      resourceId: String(poId),
      resourceType: "purchase_order",
    });
  }
}

/**
 * After PO approve/reject step.
 */
export async function notifyOnPOApproval({
  actorId,
  creatorId,
  nextApproverId,
  decision,
  kodePO,
  poId,
}: {
  actorId: string;
  creatorId: string;
  nextApproverId?: string;
  decision: "approved" | "rejected";
  kodePO: string;
  poId: string | number;
}): Promise<void> {
  if (decision === "rejected") {
    if (creatorId && creatorId !== actorId) {
      await sendNotification({
        userId: creatorId,
        actorId,
        type: "po_rejected",
        title: "PO Kamu Ditolak",
        message: `Purchase Order ${kodePO} telah ditolak.`,
        link: `/purchase-order/${poId}`,
        resourceId: String(poId),
        resourceType: "purchase_order",
      });
    }
    return;
  }

  if (nextApproverId) {
    await sendNotification({
      userId: nextApproverId,
      actorId,
      type: "po_approved_step",
      title: "Persetujuan PO Dibutuhkan",
      message: `Purchase Order ${kodePO} kini menunggu persetujuan Anda.`,
      link: `/purchase-order/${poId}`,
      resourceId: String(poId),
      resourceType: "purchase_order",
    });
  } else {
    if (creatorId && creatorId !== actorId) {
      await sendNotification({
        userId: creatorId,
        actorId,
        type: "po_fully_approved",
        title: "PO Kamu Disetujui Sepenuhnya",
        message: `Purchase Order ${kodePO} telah disetujui semua pihak.`,
        link: `/purchase-order/${poId}`,
        resourceId: String(poId),
        resourceType: "purchase_order",
      });
    }
  }
}

/**
 * Kirim nudge "Follow-up Approval" ke approver yang sedang jadi penentu
 * (blocking) di jalur approval MR/PO ini. Cuma notifikasi - tidak mengubah
 * status approval apapun. Bisa dipicu oleh siapa saja (requester, GA, user
 * lain yang buka halaman detailnya).
 */
export async function notifyOnApprovalFollowup({
  actorId,
  actorName,
  approverId,
  kode,
  resourceId,
  resourceType,
}: {
  actorId: string;
  actorName: string;
  approverId: string;
  kode: string;
  resourceId: string | number;
  resourceType: "material_request" | "purchase_order";
}): Promise<void> {
  const isMR = resourceType === "material_request";
  await sendNotification({
    userId: approverId,
    actorId,
    type: isMR ? "mr_followup_requested" : "po_followup_requested",
    title: "Follow-up Approval Diminta",
    message: `${actorName} meminta Anda segera memproses approval ${isMR ? "MR" : "PO"} ${kode}.`,
    link: isMR
      ? `/material-request/${resourceId}`
      : `/purchase-order/${resourceId}`,
    resourceId: String(resourceId),
    resourceType,
  });
}

// ─────────────────────────────────────────────
// Petty Cash - alur Pengajuan -> Voucher -> Tarikan Dana (Sub-Voucher) ->
// Deklarasi, plus Pengembalian Dana Lebih. Dipanggil dari
// services/pettyCash*Service.ts setelah tulis DB berhasil, fire-and-forget
// seperti MR/PO (gagal kirim notif tidak boleh menggagalkan aksinya).
// ─────────────────────────────────────────────

export type PcApprovalDocType = "pengajuan" | "voucher" | "deklarasi";

const PC_DOC_LABEL: Record<PcApprovalDocType, string> = {
  pengajuan: "Pengajuan",
  voucher: "Voucher",
  deklarasi: "Deklarasi",
};

const pcDocLink = (docType: PcApprovalDocType, docId: string | number) =>
  `/petty-cash/${docType}/${docId}`;

// Langkah requester berikutnya begitu dokumen disetujui penuh - link ke
// halaman tempat aksinya dilakukan, bukan cuma halaman detail.
const PC_NEXT_STEP: Record<
  PcApprovalDocType,
  { message: string; link: (docId: string | number) => string }
> = {
  pengajuan: {
    message: "Silakan ajukan Voucher-nya.",
    link: () => "/petty-cash/pengajuan-voucher",
  },
  voucher: {
    message: "Dana sudah bisa ditarik.",
    link: () => "/petty-cash/pengajuan-voucher",
  },
  deklarasi: {
    message: "Kalau ada sisa dana, kembalikan lewat halaman Deklarasi.",
    link: (docId) => pcDocLink("deklarasi", docId),
  },
};

// Ketiga dokumen boleh diajukan ulang setelah ditolak - link ke halaman
// tempat requester melakukannya (detail Pengajuan punya tombol "Ajukan
// Ulang"; Voucher & Deklarasi diajukan ulang dari halaman pembuatannya,
// yang juga menautkan alasan penolakannya).
const PC_RESUBMIT: Record<
  PcApprovalDocType,
  { message: string; link: (docId: string | number) => string }
> = {
  pengajuan: {
    message: "Lihat alasannya, lalu ajukan ulang dari halaman detail.",
    link: (docId) => pcDocLink("pengajuan", docId),
  },
  voucher: {
    message: "Lihat alasannya, lalu ajukan ulang Voucher.",
    link: () => "/petty-cash/pengajuan-voucher",
  },
  deklarasi: {
    message: "Lihat alasannya, lalu ajukan ulang Deklarasi.",
    link: () => "/petty-cash/deklarasi",
  },
};

/**
 * Pemanggil service tidak selalu punya id user login - ambil dari sesi
 * lokal (tanpa request jaringan). Dipakai buang penerima = pelaku: RPC
 * create_notifications sudah melewati diri sendiri, tapi channel push tidak.
 */
async function resolveActorId(actorId?: string): Promise<string | undefined> {
  if (actorId) return actorId;
  try {
    const { data } = await createClient().auth.getSession();
    return data.session?.user.id;
  } catch {
    return undefined;
  }
}

/**
 * Finance approver yang memproses pembayaran tarikan & konfirmasi
 * pengembalian utk `companyCode` - sama cakupannya dgn antrian di halaman
 * Approval Petty Cash (Finance company sendiri + Finance LOURDES).
 */
export async function getPcFinanceApproverIds(
  companyCode: string,
): Promise<string[]> {
  try {
    const supabase = createClient();
    const companyCodes =
      companyCode === "LOURDES" ? ["LOURDES"] : [companyCode, "LOURDES"];
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("department", "Finance")
      .eq("role", "approver")
      .in("company", companyCodes);
    return (data ?? []).map((p: { id: string }) => p.id);
  } catch {
    return [];
  }
}

/** Dokumen PC baru masuk jalur approval -> approver pertama. */
export async function notifyOnPcSubmitted({
  actorId,
  docType,
  docId,
  kode,
  firstApproverId,
}: {
  actorId?: string;
  docType: PcApprovalDocType;
  docId: string | number;
  kode: string;
  firstApproverId?: string;
}): Promise<void> {
  const actor = await resolveActorId(actorId);
  if (!firstApproverId || firstApproverId === actor) return;
  const label = PC_DOC_LABEL[docType];
  await sendNotification({
    userId: firstApproverId,
    actorId: actor,
    type: "pc_submitted",
    title: `Persetujuan ${label} Petty Cash Dibutuhkan`,
    message: `${label} ${kode} menunggu persetujuan Anda.`,
    link: pcDocLink(docType, docId),
    resourceId: String(docId),
    resourceType: "petty_cash",
  });
}

/**
 * Setelah approve/reject satu step -> approver berikutnya (kalau masih ada),
 * atau requester (disetujui penuh / ditolak).
 */
export async function notifyOnPcApproval({
  actorId,
  docType,
  docId,
  kode,
  creatorId,
  nextApproverId,
  decision,
}: {
  actorId?: string;
  docType: PcApprovalDocType;
  docId: string | number;
  kode: string;
  creatorId: string;
  nextApproverId?: string;
  decision: "approved" | "rejected";
}): Promise<void> {
  const actor = await resolveActorId(actorId);
  const label = PC_DOC_LABEL[docType];

  if (decision === "rejected") {
    if (!creatorId || creatorId === actor) return;
    const resubmit = PC_RESUBMIT[docType];
    await sendNotification({
      userId: creatorId,
      actorId: actor,
      type: "pc_rejected",
      title: `${label} Petty Cash Kamu Ditolak`,
      message: `${label} ${kode} ditolak. ${resubmit.message}`,
      link: resubmit.link(docId),
      resourceId: String(docId),
      resourceType: "petty_cash",
    });
    return;
  }

  if (nextApproverId) {
    if (nextApproverId === actor) return;
    await sendNotification({
      userId: nextApproverId,
      actorId: actor,
      type: "pc_approved_step",
      title: `Persetujuan ${label} Petty Cash Dibutuhkan`,
      message: `${label} ${kode} kini menunggu persetujuan Anda.`,
      link: pcDocLink(docType, docId),
      resourceId: String(docId),
      resourceType: "petty_cash",
    });
    return;
  }

  if (!creatorId || creatorId === actor) return;
  const next = PC_NEXT_STEP[docType];
  await sendNotification({
    userId: creatorId,
    actorId: actor,
    type: "pc_fully_approved",
    title: `${label} Petty Cash Kamu Disetujui`,
    message: `${label} ${kode} telah disetujui semua pihak. ${next.message}`,
    link: next.link(docId),
    resourceId: String(docId),
    resourceType: "petty_cash",
  });
}

/** Requester menarik dana -> Finance approver, tarikan menunggu dibayar. */
export async function notifyFinanceOnPcPaymentRequested({
  actorId,
  companyCode,
  subVoucherId,
  kode,
  amount,
}: {
  actorId?: string;
  companyCode: string;
  subVoucherId: string | number;
  kode: string;
  amount: number;
}): Promise<void> {
  const actor = await resolveActorId(actorId);
  const recipients = (await getPcFinanceApproverIds(companyCode)).filter(
    (id) => id !== actor,
  );
  await sendNotifications(recipients, {
    actorId: actor,
    type: "pc_payment_requested",
    title: "Tarikan Dana Petty Cash Menunggu Dibayar",
    message: `Tarikan ${kode} sebesar ${formatCurrency(amount)} menunggu pembayaran Finance.`,
    link: `/petty-cash/sub-voucher/${subVoucherId}`,
    resourceId: String(subVoucherId),
    resourceType: "petty_cash",
  });
}

/** Finance menandai tarikan selesai dibayar -> requester. */
export async function notifyOnPcPaid({
  actorId,
  requesterId,
  subVoucherId,
  kode,
  amount,
}: {
  actorId?: string;
  requesterId: string;
  subVoucherId: string | number;
  kode: string;
  amount: number;
}): Promise<void> {
  const actor = await resolveActorId(actorId);
  if (!requesterId || requesterId === actor) return;
  await sendNotification({
    userId: requesterId,
    actorId: actor,
    type: "pc_paid",
    title: "Dana Petty Cash Sudah Dibayar",
    message: `Tarikan ${kode} sebesar ${formatCurrency(amount)} sudah dibayar Finance. Ajukan Deklarasi setelah dana dipakai.`,
    link: "/petty-cash/deklarasi",
    resourceId: String(subVoucherId),
    resourceType: "petty_cash",
  });
}

/** Requester mengembalikan sisa dana -> Finance approver, menunggu konfirmasi. */
export async function notifyFinanceOnPcReturnSubmitted({
  actorId,
  companyCode,
  pengembalianId,
  kode,
  amount,
}: {
  actorId?: string;
  companyCode: string;
  pengembalianId: string | number;
  kode: string;
  amount: number;
}): Promise<void> {
  const actor = await resolveActorId(actorId);
  const recipients = (await getPcFinanceApproverIds(companyCode)).filter(
    (id) => id !== actor,
  );
  await sendNotifications(recipients, {
    actorId: actor,
    type: "pc_return_submitted",
    title: "Pengembalian Dana Petty Cash Menunggu Konfirmasi",
    message: `Pengembalian ${kode} sebesar ${formatCurrency(amount)} menunggu konfirmasi Finance.`,
    link: "/petty-cash/approval",
    resourceId: String(pengembalianId),
    resourceType: "petty_cash",
  });
}

/** Finance mengkonfirmasi / menolak pengembalian -> requester. */
export async function notifyOnPcReturnProcessed({
  actorId,
  requesterId,
  pengembalianId,
  kode,
  amount,
  decision,
  reason,
}: {
  actorId?: string;
  requesterId: string;
  pengembalianId: string | number;
  kode: string;
  amount: number;
  decision: "confirmed" | "rejected";
  reason?: string;
}): Promise<void> {
  const actor = await resolveActorId(actorId);
  if (!requesterId || requesterId === actor) return;
  const confirmed = decision === "confirmed";
  await sendNotification({
    userId: requesterId,
    actorId: actor,
    type: confirmed ? "pc_return_confirmed" : "pc_return_rejected",
    title: confirmed
      ? "Pengembalian Dana Dikonfirmasi"
      : "Pengembalian Dana Ditolak",
    message: confirmed
      ? `Pengembalian ${kode} sebesar ${formatCurrency(amount)} sudah diterima Finance.`
      : `Pengembalian ${kode} ditolak Finance${reason ? ` - alasan: ${reason}` : ""}. Silakan ajukan ulang.`,
    link: "/petty-cash/deklarasi",
    resourceId: String(pengembalianId),
    resourceType: "petty_cash",
  });
}
