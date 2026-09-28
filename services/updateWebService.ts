// src/services/updateWebService.ts
//
// Service untuk fitur "Update Web" (changelog/pengumuman aplikasi internal) -
// lihat supabase/update-web-setup.sql. Create pakai RPC (hitung versi atomic,
// lihat komentar create_update_web_post), edit/hapus pakai .update()/.delete()
// langsung (dilindungi RLS admin only). Reaction pakai .insert()/.delete()
// langsung (dilindungi RLS user_id = auth.uid()). Komentar pakai RPC yang sama
// persis polanya dengan services/pcDiscussionService.ts.

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

// Ambil semua reaction utk sekumpulan post sekaligus (1 query), lalu
// diagregasi di JS jadi ringkasan per emoji per post - lebih simpel daripada
// bikin view/RPC agregasi baru, dan volume reaction internal app ini kecil.
export const fetchUpdateWebPostReactions = async (
  postIds: number[],
  currentUserId?: string | null,
): Promise<Map<number, UpdateWebPostReactionSummary[]>> => {
  const result = new Map<number, UpdateWebPostReactionSummary[]>();
  if (postIds.length === 0) return result;

  const { data, error } = await supabase
    .from("update_web_post_reactions")
    .select("post_id, user_id, emoji")
    .in("post_id", postIds);
  if (error) throw error;

  const byPost = new Map<number, { emoji: string; user_id: string }[]>();
  for (const row of data ?? []) {
    const list = byPost.get(row.post_id) ?? [];
    list.push({ emoji: row.emoji, user_id: row.user_id });
    byPost.set(row.post_id, list);
  }

  for (const [postId, rows] of byPost) {
    const counts = new Map<string, UpdateWebPostReactionSummary>();
    for (const row of rows) {
      const existing = counts.get(row.emoji);
      if (existing) {
        existing.count += 1;
        if (row.user_id === currentUserId) existing.reactedByMe = true;
      } else {
        counts.set(row.emoji, {
          emoji: row.emoji,
          count: 1,
          reactedByMe: row.user_id === currentUserId,
        });
      }
    }
    result.set(postId, Array.from(counts.values()));
  }

  return result;
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
  });
  if (error) throw error;
};

// Toggle reaction milik user sendiri - insert kalau belum ada, delete kalau
// sudah ada (unique constraint (post_id,user_id,emoji) mencegah dobel).
export const toggleUpdateWebPostReaction = async (
  postId: number,
  userId: string,
  emoji: UpdateWebReactionEmoji,
  currentlyReacted: boolean,
): Promise<void> => {
  if (currentlyReacted) {
    const { error } = await supabase
      .from("update_web_post_reactions")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId)
      .eq("emoji", emoji);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("update_web_post_reactions")
      .insert({ post_id: postId, user_id: userId, emoji });
    if (error) throw error;
  }
};
