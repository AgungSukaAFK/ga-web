// lib/discussion-reply.ts
//
// Helper fitur "balas pesan" di DiscussionPanel - bikin snapshot pesan yang
// dibalas (DiscussionReplyRef) & cocokkan balik ke pesan aslinya.

import { Discussion, DiscussionReplyRef } from "@/type";

const EXCERPT_MAX = 120;

export function buildReplyRef(chat: Discussion): DiscussionReplyRef {
  const text = (chat.message ?? "").replace(/\s+/g, " ").trim();
  let excerpt = text;
  if (!excerpt && chat.attachment?.type === "sticker") {
    excerpt = chat.attachment.emoji;
  } else if (!excerpt && chat.attachment?.type === "image") {
    excerpt = "[Gambar]";
  }
  if (excerpt.length > EXCERPT_MAX) {
    excerpt = `${excerpt.slice(0, EXCERPT_MAX).trimEnd()}…`;
  }
  return {
    user_id: chat.user_id,
    user_name: chat.user_name,
    timestamp: chat.timestamp,
    excerpt,
  };
}

// Timestamp dibandingkan sebagai waktu (bukan string) - entri dari RPC
// Postgres (`now()`) & dari client (`toISOString()`) formatnya beda.
export function isReplyTarget(chat: Discussion, ref: DiscussionReplyRef) {
  return (
    chat.user_id === ref.user_id &&
    new Date(chat.timestamp).getTime() === new Date(ref.timestamp).getTime()
  );
}
