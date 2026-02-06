// src/services/logService.ts
import { createClient } from "@/lib/supabase/client";

export const logActivity = async (
  userId: string,
  actionType: string,
  resourceType: string,
  resourceId: string,
  description: string,
  metadata?: any,
) => {
  const supabase = createClient();
  const { error } = await supabase.from("activity_logs").insert([
    {
      user_id: userId,
      action_type: actionType,
      resource_type: resourceType,
      resource_id: resourceId,
      description: description,
      metadata: metadata || null,
    },
  ]);

  if (error) {
    console.error("Failed to log activity:", error);
  }
};

export const fetchActivityLogs = async (
  resourceType: string,
  resourceId: string,
) => {
  const supabase = createClient();
  // Join dengan tabel profiles untuk dapat nama user
  const { data, error } = await supabase
    .from("activity_logs")
    .select(
      `
      *,
      users_with_profiles:user_id (nama, email)
    `,
    ) // PASTIKAN ADA RELASI FOREIGN KEY users_with_profiles!
    .eq("resource_type", resourceType)
    .eq("resource_id", resourceId)
    .order("created_at", { ascending: false });

  if (error) {
    // Fallback jika relasi belum disetup dengan benar di DB (gunakan auth.users join manual)
    console.error("Error fetching logs:", error);
    return [];
  }
  return data;
};
