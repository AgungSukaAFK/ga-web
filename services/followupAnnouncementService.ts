// src/services/followupAnnouncementService.ts
//
// Baca antrian Announcer Follow-up (tabel `followup_announcements`, lihat
// supabase/migrations/0016_followup_announcer.sql). Tabel ini read-only dari
// client - barisnya cuma ditulis trigger saat tombol Follow-up ditekan.

import { createClient } from "@/lib/supabase/client";
import { FollowupAnnouncement } from "@/type";

const supabase = createClient();

const COLUMNS =
  "id, resource_type, resource_id, kode, approver_id, approver_nama, approver_sapaan, approver_lokasi, requested_by, requested_by_nama, created_at";

/** Riwayat terbaru (urut lama -> baru) untuk isi awal layar announcer. */
export const fetchRecentAnnouncements = async (
  limit = 50,
): Promise<FollowupAnnouncement[]> => {
  const { data, error } = await supabase
    .from("followup_announcements")
    .select(COLUMNS)
    .order("id", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as FollowupAnnouncement[]).reverse();
};

/** Pengumuman dengan id > `afterId` (urut lama -> baru) - polling & catch-up. */
export const fetchAnnouncementsAfter = async (
  afterId: number,
  limit = 100,
): Promise<FollowupAnnouncement[]> => {
  const { data, error } = await supabase
    .from("followup_announcements")
    .select(COLUMNS)
    .gt("id", afterId)
    .order("id", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as FollowupAnnouncement[];
};
