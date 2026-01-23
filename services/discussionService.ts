"use server";

import { createClient } from "@/lib/supabase/server";
import { createNotification } from "./notificationService";

export async function postComment(
  resourceId: string,
  resourceType: "material_request" | "purchase_order",
  contentHtml: string,
  contentJson: any
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: "Unauthorized" };

  // 1. Simpan Komentar (Sesuaikan nama tabel Anda, misal 'comments' atau 'mr_discussions')
  // Asumsi tabel: comments (id, resource_id, resource_type, user_id, content)
  const { data: commentData, error } = await supabase
    .from("comments")
    .insert({
      resource_id: resourceId,
      resource_type: resourceType,
      user_id: user.id,
      content: contentHtml,
    })
    .select()
    .single();

  if (error) {
    console.error("Error posting comment:", error);
    return { success: false, message: "Gagal mengirim komentar" };
  }

  // 2. Parse Mention dari JSON Tiptap
  // Struktur Tiptap: { type: 'doc', content: [ { type: 'paragraph', content: [ { type: 'mention', attrs: { id, label } } ] } ] }
  const mentions = new Set<string>();

  // Fungsi rekursif untuk cari mention
  const findMentions = (node: any) => {
    if (node.type === "mention" && node.attrs?.id) {
      mentions.add(node.attrs.id);
    }
    if (node.content) {
      node.content.forEach((child: any) => findMentions(child));
    }
  };

  if (contentJson) {
    findMentions(contentJson);
  }

  // 3. Buat Notifikasi untuk setiap user yang di-mention
  const notificationPromises = Array.from(mentions).map((mentionedUserId) => {
    // Jangan notifikasi diri sendiri
    if (mentionedUserId === user.id) return Promise.resolve();

    return createNotification({
      userId: mentionedUserId,
      actorId: user.id,
      type: "mention",
      title: "Anda di-mention dalam diskusi",
      message: `Seseorang me-mention Anda di ${
        resourceType === "material_request" ? "MR" : "PO"
      }`,
      link:
        resourceType === "material_request"
          ? `/material-request/${resourceId}`
          : `/purchase-order/${resourceId}`, // Sesuaikan rute detail
      resourceId: resourceId,
      resourceType: resourceType,
    });
  });

  await Promise.all(notificationPromises);

  return { success: true };
}
