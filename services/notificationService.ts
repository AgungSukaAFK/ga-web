"use server";

import { createClient } from "@/lib/supabase/server";
import { Notification } from "@/type";

// 1. Ambil list notifikasi user (Server Side)
export async function getUserNotifications() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Unauthorized" };

  // Join ke tabel profiles untuk dapat nama actor (pengirim)
  const { data, error } = await supabase
    .from("notifications")
    .select(
      `
      *,
      actor:profiles!actor_id (
        name,
        avatar_url
      )
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }

  // Formatting data agar sesuai interface Notification
  return data.map((item: any) => ({
    ...item,
    actor_name: item.actor?.name || "System",
    actor_avatar: item.actor?.avatar_url || null,
  })) as Notification[];
}

// 2. Tandai notifikasi sudah dibaca
export async function markNotificationAsRead(notificationId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);

  if (error) {
    console.error("Error marking notification as read:", error);
    return { success: false };
  }
  return { success: true };
}

// 3. Tandai SEMUA notifikasi sudah dibaca
export async function markAllNotificationsAsRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false); // Hanya update yg belum dibaca

  if (error) console.error("Error mark all read:", error);
}

// 4. Create Notification (Bisa dipanggil dari Server Action lain)
export async function createNotification(params: {
  userId: string; // Penerima
  title: string;
  message: string;
  type: "mention" | "approval_mr" | "approval_po" | "info";
  link: string;
  resourceId?: string;
  resourceType?: "material_request" | "purchase_order";
  actorId?: string; // Pengirim
}) {
  const supabase = await createClient();

  const { error } = await supabase.from("notifications").insert({
    user_id: params.userId,
    actor_id: params.actorId,
    type: params.type,
    title: params.title,
    message: params.message,
    link: params.link,
    resource_id: params.resourceId,
    resource_type: params.resourceType,
    is_read: false,
  });

  if (error) {
    console.error("Failed to create notification:", error);
  }
}
