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

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type NotificationEventType =
  | "mention"
  | "mr_submitted"
  | "mr_validated"
  | "mr_approved_step"
  | "mr_fully_approved"
  | "mr_rejected"
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
  | "info";

export type NotificationResourceType =
  | "material_request"
  | "purchase_order"
  | "petty_cash";

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
// See: supabase/notifications-setup.sql

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
  // Notify first approver
  if (firstApproverId && firstApproverId !== actorId) {
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
 * Notify GA/Finance that a new Petty Cash was submitted.
 */
export async function notifyGAOnPCSubmit({
  actorId,
  companyCode,
  kodePC,
  pcId,
}: {
  actorId: string;
  companyCode: string;
  kodePC: string;
  pcId: string | number;
}): Promise<void> {
  const ids = await getGAAndFinanceUserIds(companyCode);
  const recipients = ids.filter((id) => id !== actorId);
  await sendNotifications(recipients, {
    actorId,
    type: "pc_submitted",
    title: "Petty Cash Baru Menunggu Validasi",
    message: `Petty Cash ${kodePC} baru masuk dan menunggu routing dari GA/Finance.`,
    link: `/petty-cash/${pcId}`,
    resourceId: String(pcId),
    resourceType: "petty_cash",
  });
}

/**
 * After GA routes Petty Cash → notify creator + first approver.
 */
export async function notifyOnPCRouted({
  actorId,
  creatorId,
  firstApproverId,
  kodePC,
  pcId,
}: {
  actorId: string;
  creatorId: string;
  firstApproverId?: string;
  kodePC: string;
  pcId: string | number;
}): Promise<void> {
  if (creatorId && creatorId !== actorId) {
    await sendNotification({
      userId: creatorId,
      actorId,
      type: "pc_routed",
      title: "Petty Cash Kamu Divalidasi",
      message: `Petty Cash ${kodePC} telah diarahkan ke jalur persetujuan.`,
      link: `/petty-cash/${pcId}`,
      resourceId: String(pcId),
      resourceType: "petty_cash",
    });
  }
  if (firstApproverId && firstApproverId !== actorId) {
    await sendNotification({
      userId: firstApproverId,
      actorId,
      type: "pc_routed",
      title: "Persetujuan Petty Cash Dibutuhkan",
      message: `Petty Cash ${kodePC} menunggu persetujuan Anda.`,
      link: `/petty-cash/${pcId}`,
      resourceId: String(pcId),
      resourceType: "petty_cash",
    });
  }
}

/**
 * After PC approve/reject step.
 */
export async function notifyOnPCApproval({
  actorId,
  creatorId,
  nextApproverId,
  decision,
  kodePC,
  pcId,
}: {
  actorId: string;
  creatorId: string;
  nextApproverId?: string;
  decision: "approved" | "rejected";
  kodePC: string;
  pcId: string | number;
}): Promise<void> {
  if (decision === "rejected") {
    if (creatorId && creatorId !== actorId) {
      await sendNotification({
        userId: creatorId,
        actorId,
        type: "pc_rejected",
        title: "Petty Cash Kamu Ditolak",
        message: `Petty Cash ${kodePC} telah ditolak.`,
        link: `/petty-cash/${pcId}`,
        resourceId: String(pcId),
        resourceType: "petty_cash",
      });
    }
    return;
  }

  if (nextApproverId) {
    await sendNotification({
      userId: nextApproverId,
      actorId,
      type: "pc_approved_step",
      title: "Persetujuan Petty Cash Dibutuhkan",
      message: `Petty Cash ${kodePC} kini menunggu persetujuan Anda.`,
      link: `/petty-cash/${pcId}`,
      resourceId: String(pcId),
      resourceType: "petty_cash",
    });
  } else {
    if (creatorId && creatorId !== actorId) {
      await sendNotification({
        userId: creatorId,
        actorId,
        type: "pc_fully_approved",
        title: "Petty Cash Kamu Disetujui",
        message: `Petty Cash ${kodePC} telah disetujui semua pihak.`,
        link: `/petty-cash/${pcId}`,
        resourceId: String(pcId),
        resourceType: "petty_cash",
      });
    }
  }
}
