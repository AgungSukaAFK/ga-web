// src/services/updateWebService.ts
//
// Service untuk fitur "Update Web" (changelog/pengumuman aplikasi internal) -
// lihat supabase/update-web-setup.sql & update-web-v2-setup.sql. Create pakai
// RPC (hitung versi atomic, lihat komentar create_update_web_post), edit/hapus
// pakai .update()/.delete() langsung (dilindungi RLS admin only). Reaction
// (1 emoji aktif per user per post, lihat update-web-v2-setup.sql) pakai
// delete-lalu-insert langsung (dilindungi RLS user_id = auth.uid()). Komentar
// pakai RPC yang sama persis polanya dengan services/pcDiscussionService.ts.

import { createClient } from "@/lib/supabase/client";
import { DiscussionSubmitPayload } from "@/type";
import {
  UpdateWebPost,
  UpdateWebPostReactionSummary,
  UpdateWebReactionEmoji,
} from "@/type/update-web";

const supabase = createClient();

export const fetchUpdateWebPosts = async (): Promise<UpdateWebPost[]> => {
  const { data, error } = await supabase
    .from("update_web_posts")
    .select("*, created_by_profile:profiles(nama, email)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as UpdateWebPost[];
};

// Dipakai buat refresh 1 post setelah kirim komentar (RPC add_update_web_post_discussion
// return void, jadi discussions terbaru harus di-refetch, bukan dibangun
// optimistic di client - pola sama seperti handlePostDiscussion di
// petty-cash/pengajuan/[id]/page.tsx yang re-load seluruh dokumen).
export const fetchUpdateWebPostById = async (
  id: number,
): Promise<UpdateWebPost> => {
  const { data, error } = await supabase
    .from("update_web_posts")
    .select("*, created_by_profile:profiles(nama, email)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as unknown as UpdateWebPost;
};

// Ambil semua reaction utk sekumpulan post sekaligus (1 query, join nama
// profil buat tooltip "siapa aja yang kasih reaction"), lalu diagregasi di JS
// jadi ringkasan per emoji per post - lebih simpel daripada bikin view/RPC
// agregasi baru, dan volume reaction internal app ini kecil. 1 user cuma
// mungkin muncul di TEPAT SATU emoji per post (lihat update-web-v2-setup.sql).
export const fetchUpdateWebPostReactions = async (
  postIds: number[],
  currentUserId?: string | null,
): Promise<Map<number, UpdateWebPostReactionSummary[]>> => {
  const result = new Map<number, UpdateWebPostReactionSummary[]>();
  if (postIds.length === 0) return result;

  const { data, error } = await supabase
    .from("update_web_post_reactions")
    .select("post_id, emoji, user:profiles(id, nama)")
    .in("post_id", postIds);
  if (error) throw error;

  const byPost = new Map<
    number,
    { emoji: string; id: string; nama: string | null }[]
  >();
  for (const row of (data ?? []) as any[]) {
    const list = byPost.get(row.post_id) ?? [];
    list.push({
      emoji: row.emoji,
      id: row.user?.id ?? "",
      nama: row.user?.nama ?? null,
    });
    byPost.set(row.post_id, list);
  }

  for (const [postId, rows] of byPost) {
    const counts = new Map<string, UpdateWebPostReactionSummary>();
    for (const row of rows) {
      const existing = counts.get(row.emoji);
      const reactor = { id: row.id, nama: row.nama };
      if (existing) {
        existing.count += 1;
        existing.reactors.push(reactor);
        if (row.id === currentUserId) existing.reactedByMe = true;
      } else {
        counts.set(row.emoji, {
          emoji: row.emoji,
          count: 1,
          reactedByMe: row.id === currentUserId,
          reactors: [reactor],
        });
      }
    }
    result.set(postId, Array.from(counts.values()));
  }

  return result;
};

// Post terbaru (dipakai buat hitung badge "ada update baru" - lihat
// hooks/use-update-web-badge.ts - & preview di widget Dashboard).
export const fetchLatestUpdateWebPost = async (): Promise<UpdateWebPost | null> => {
  const { data, error } = await supabase
    .from("update_web_posts")
    .select("*, created_by_profile:profiles(nama, email)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as UpdateWebPost) ?? null;
};

// "Sudah lihat sampai post mana" milik user yang login - null kalau belum
// pernah buka Update Web sama sekali.
export const fetchUpdateWebSeenState = async (
  userId: string,
): Promise<number | null> => {
  const { data, error } = await supabase
    .from("update_web_seen")
    .select("last_seen_post_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.last_seen_post_id ?? null;
};

export const markUpdateWebSeen = async (
  userId: string,
  postId: number,
): Promise<void> => {
  const { error } = await supabase.from("update_web_seen").upsert({
    user_id: userId,
    last_seen_post_id: postId,
    last_seen_at: new Date().toISOString(),
  });
  if (error) throw error;
};

export interface CreateUpdateWebPostPayload {
  title: string;
  thumbnail_url: string | null;
  highlights: string[];
  content: Record<string, unknown>;
  version?: string | null; // null/undefined = auto-increment patch
}

export const createUpdateWebPost = async (
  payload: CreateUpdateWebPostPayload,
): Promise<UpdateWebPost> => {
  const { data, error } = await supabase.rpc("create_update_web_post", {
    p_title: payload.title,
    p_thumbnail_url: payload.thumbnail_url,
    p_highlights: payload.highlights,
    p_content: payload.content,
    p_version: payload.version ?? null,
  });
  if (error) throw error;
  return data as UpdateWebPost;
};

export interface UpdateUpdateWebPostPayload {
  title: string;
  thumbnail_url: string | null;
  highlights: string[];
  content: Record<string, unknown>;
  version_major: number;
  version_minor: number;
  version_patch: number;
}

export const updateUpdateWebPost = async (
  id: number,
  payload: UpdateUpdateWebPostPayload,
): Promise<UpdateWebPost> => {
  const { data, error } = await supabase
    .from("update_web_posts")
    .update({
      title: payload.title,
      thumbnail_url: payload.thumbnail_url,
      highlights: payload.highlights,
      content: payload.content,
      version_major: payload.version_major,
      version_minor: payload.version_minor,
      version_patch: payload.version_patch,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as UpdateWebPost;
};

export const deleteUpdateWebPost = async (id: number): Promise<void> => {
  const { error } = await supabase
    .from("update_web_posts")
    .delete()
    .eq("id", id);
  if (error) throw error;
};

export const addUpdateWebPostDiscussion = async (
  id: number,
  payload: DiscussionSubmitPayload,
): Promise<void> => {
  const { error } = await supabase.rpc("add_update_web_post_discussion", {
    p_id: id,
    p_message: payload.message,
    p_content: payload.content ?? null,
    p_mentions: payload.mentions ?? [],
    p_attachment: payload.attachment ?? null,
    // Cuma dikirim kalau memang membalas - komentar biasa tetap jalan walau
    // migration discussion_reply_setup.sql belum diterapkan.
    ...(payload.reply_to ? { p_reply_to: payload.reply_to } : {}),
  });
  if (error) throw error;
};

// Set reaction milik user sendiri utk 1 post - `emoji` null berarti hapus
// reaction (tidak suka lagi). Selalu hapus dulu baris lama (kalau ada) baru
// insert yang baru - 1 user CUMA BOLEH punya 1 reaction aktif per post (lihat
// unique constraint (post_id,user_id) di update-web-v2-setup.sql), jadi
// ganti emoji = ganti baris, bukan nambah baris baru.
export const setUpdateWebPostReaction = async (
  postId: number,
  userId: string,
  emoji: UpdateWebReactionEmoji | null,
): Promise<void> => {
  const { error: deleteError } = await supabase
    .from("update_web_post_reactions")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", userId);
  if (deleteError) throw deleteError;

  if (emoji) {
    const { error: insertError } = await supabase
      .from("update_web_post_reactions")
      .insert({ post_id: postId, user_id: userId, emoji });
    if (insertError) throw insertError;
  }
};
