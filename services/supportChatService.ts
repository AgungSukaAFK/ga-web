// src/services/supportChatService.ts
//
// Service fitur Chat Admin (lihat supabase/migrations/0007_chat_admin.sql). Buat
// percakapan, ubah status, ambil/alihkan, dan tandai dibaca lewat RPC;
// kirim pesan pakai insert langsung (dijaga RLS, metadata tiket di-update
// trigger). Notifikasi in-app + push dikirim dari sini setelah pesan
// berhasil tersimpan.

import { createClient } from "@/lib/supabase/client";
import { sendNotification, sendNotifications } from "@/lib/notifications/client";
import { SupportMessage, SupportTicket, SupportTicketStatus } from "@/type";

const supabase = createClient();

export const SUPPORT_KATEGORI = [
  "Akun & Akses",
  "Kendala Aplikasi / Error",
  "Pertanyaan Penggunaan",
  "Permintaan Data",
  "Lainnya",
];

export const SUPPORT_STATUS_LABEL: Record<SupportTicketStatus, string> = {
  menunggu: "Menunggu Admin",
  dibalas: "Dibalas",
  selesai: "Selesai",
};

export const SUPPORT_STATUS_CLASS: Record<SupportTicketStatus, string> = {
  menunggu:
    "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300",
  dibalas: "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-300",
  selesai:
    "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export const chatAdminLink = (ticketId: number, asAdmin: boolean) =>
  `${asAdmin ? "/chat-admin-management" : "/chat-admin"}?t=${ticketId}`;

// Ada pesan baru dari pihak lawan yang belum dibaca sisi `asAdmin`.
export const isTicketUnread = (t: SupportTicket, asAdmin: boolean) =>
  asAdmin
    ? !t.last_sender_is_admin &&
      (!t.admin_last_read_at ||
        new Date(t.last_message_at) > new Date(t.admin_last_read_at))
    : t.last_sender_is_admin &&
      new Date(t.last_message_at) > new Date(t.user_last_read_at);

export interface SupportAttachmentInput {
  url: string;
  nama: string;
  tipe: string;
}

export interface ITAdmin {
  id: string;
  nama: string | null;
}

export const fetchITAdmins = async (): Promise<ITAdmin[]> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nama")
    .eq("role", "admin")
    .eq("department", "IT")
    .order("nama");
  if (error) throw error;
  return (data ?? []) as ITAdmin[];
};

export const fetchSupportTickets = async (
  ownUserId?: string,
): Promise<SupportTicket[]> => {
  let query = supabase
    .from("support_tickets")
    .select("*")
    .order("last_message_at", { ascending: false });
  if (ownUserId) query = query.eq("user_id", ownUserId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SupportTicket[];
};

export const fetchSupportTicket = async (
  id: number,
): Promise<SupportTicket | null> => {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as SupportTicket | null;
};

export const fetchSupportMessages = async (
  ticketId: number,
): Promise<SupportMessage[]> => {
  const { data, error } = await supabase
    .from("support_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SupportMessage[];
};

const preview = (pesan: string, lampiran?: SupportAttachmentInput | null) => {
  const text = pesan.trim();
  if (text) return text.length > 120 ? `${text.slice(0, 120)}…` : text;
  return `📎 ${lampiran?.nama || "Lampiran"}`;
};

// Penerima notif pesan dari user: admin yang pegang percakapan, atau semua
// admin IT kalau belum ada yang ambil.
const adminRecipients = async (ticket: Pick<SupportTicket, "assigned_to">) => {
  if (ticket.assigned_to) return [ticket.assigned_to];
  try {
    return (await fetchITAdmins()).map((a) => a.id);
  } catch {
    return [];
  }
};

export const createSupportTicket = async ({
  kategori,
  subjek,
  pesan,
  lampiran,
  senderName,
}: {
  kategori: string;
  subjek: string;
  pesan: string;
  lampiran?: SupportAttachmentInput | null;
  senderName: string;
}): Promise<number> => {
  const { data, error } = await supabase.rpc("support_create_ticket", {
    p_kategori: kategori,
    p_subjek: subjek,
    p_pesan: pesan,
    p_lampiran_url: lampiran?.url ?? null,
    p_lampiran_nama: lampiran?.nama ?? null,
    p_lampiran_tipe: lampiran?.tipe ?? null,
  });
  if (error) throw error;
  const ticketId = Number(data);

  const recipients = await adminRecipients({ assigned_to: null });
  void sendNotifications(recipients, {
    type: "support_message",
    title: `Chat Admin baru: ${subjek}`,
    message: `${senderName}: ${preview(pesan, lampiran)}`,
    link: chatAdminLink(ticketId, true),
    resourceId: String(ticketId),
    resourceType: "support_ticket",
  });

  return ticketId;
};

export const sendSupportMessage = async ({
  ticket,
  senderId,
  senderName,
  asAdmin,
  pesan,
  lampiran,
}: {
  ticket: SupportTicket;
  senderId: string;
  senderName: string;
  asAdmin: boolean;
  pesan: string;
  lampiran?: SupportAttachmentInput | null;
}): Promise<SupportMessage> => {
  const { data, error } = await supabase
    .from("support_messages")
    .insert({
      ticket_id: ticket.id,
      sender_id: senderId,
      pesan,
      lampiran_url: lampiran?.url ?? null,
      lampiran_nama: lampiran?.nama ?? null,
      lampiran_tipe: lampiran?.tipe ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;

  // Notif cukup sekali per "giliran" - kalau pengirim yang sama kirim
  // beberapa pesan beruntun, pesan kedua dst tidak bikin notif lagi.
  const isNewTurn =
    ticket.status === "selesai" || ticket.last_sender_is_admin !== asAdmin;
  if (isNewTurn) {
    const recipients = asAdmin
      ? [ticket.user_id]
      : await adminRecipients(ticket);
    void sendNotifications(recipients, {
      type: "support_message",
      title: asAdmin
        ? `Balasan admin: ${ticket.subjek}`
        : `Pesan baru: ${ticket.subjek}`,
      message: `${senderName}: ${preview(pesan, lampiran)}`,
      link: chatAdminLink(ticket.id, !asAdmin),
      resourceId: String(ticket.id),
      resourceType: "support_ticket",
    });
  }

  return data as SupportMessage;
};

export const setSupportTicketStatus = async ({
  ticket,
  action,
  asAdmin,
  actorName,
}: {
  ticket: SupportTicket;
  action: "selesai" | "buka";
  asAdmin: boolean;
  actorName: string;
}) => {
  const { error } = await supabase.rpc("support_set_status", {
    p_ticket_id: ticket.id,
    p_action: action,
  });
  if (error) throw error;

  if (asAdmin && action === "selesai") {
    void sendNotification({
      userId: ticket.user_id,
      type: "support_message",
      title: `Percakapan selesai: ${ticket.subjek}`,
      message: `${actorName} menandai percakapan ini selesai. Balas lagi kalau masih ada kendala.`,
      link: chatAdminLink(ticket.id, false),
      resourceId: String(ticket.id),
      resourceType: "support_ticket",
    });
  }
};

export const assignSupportTicket = async (
  ticket: SupportTicket,
  adminId: string | null,
  actorId: string,
) => {
  const { error } = await supabase.rpc("support_assign", {
    p_ticket_id: ticket.id,
    p_admin_id: adminId,
  });
  if (error) throw error;

  if (adminId && adminId !== actorId) {
    void sendNotification({
      userId: adminId,
      type: "support_message",
      title: `Chat Admin dialihkan ke Anda`,
      message: `${ticket.user_nama || "User"}: ${ticket.subjek}`,
      link: chatAdminLink(ticket.id, true),
      resourceId: String(ticket.id),
      resourceType: "support_ticket",
    });
  }
};

export const markSupportTicketRead = async (ticketId: number) => {
  const { error } = await supabase.rpc("support_mark_read", {
    p_ticket_id: ticketId,
  });
  if (error) console.error("[ChatAdmin] mark read gagal:", error);
};

export const deleteSupportTicket = async (ticketId: number) => {
  const { error } = await supabase
    .from("support_tickets")
    .delete()
    .eq("id", ticketId);
  if (error) throw error;
};

export const fetchSupportBadgeCounts = async (): Promise<{
  user_unread: number;
  admin_waiting: number;
}> => {
  const { data, error } = await supabase.rpc("support_badge_counts");
  if (error) throw error;
  return {
    user_unread: Number(data?.user_unread ?? 0),
    admin_waiting: Number(data?.admin_waiting ?? 0),
  };
};
