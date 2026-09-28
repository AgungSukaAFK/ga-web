// src/type/update-web.ts
// Type untuk fitur "Update Web" (changelog/pengumuman aplikasi internal) -
// lihat supabase/update-web-setup.sql & services/updateWebService.ts.

import { Discussion } from "@/type";

export interface UpdateWebPost {
  id: number;
  version: string; // "1.4.2", generated column (lihat SQL)
  version_major: number;
  version_minor: number;
  version_patch: number;
  title: string;
  thumbnail_url: string | null;
  highlights: string[];
  content: Record<string, unknown>; // Tiptap JSON doc
  discussions?: Discussion[] | null;
  created_by: string | null;
  created_by_profile?: { nama: string | null; email: string | null } | null;
  created_at: string;
  updated_at: string;
}

// Set emoji tetap (dibatasi juga lewat check constraint di DB) - dipilih ala
// reaction quick-pick Slack/Discord sesuai permintaan user.
export const UPDATE_WEB_REACTION_EMOJIS = [
  "👍",
  "❤️",
  "🎉",
  "😂",
  "😮",
  "🙏",
] as const;

export type UpdateWebReactionEmoji =
  (typeof UPDATE_WEB_REACTION_EMOJIS)[number];

export interface UpdateWebPostReaction {
  post_id: number;
  user_id: string;
  emoji: UpdateWebReactionEmoji;
}

// Hasil agregasi reaction per post, dihitung di service layer (bukan view DB)
// dari daftar UpdateWebPostReaction mentah.
export interface UpdateWebPostReactionSummary {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}
