// src/components/update-web/UpdatePostDetailDialog.tsx
//
// Modal detail besar 1 postingan Update Web - dibuka dari UpdatePostCard di
// halaman list. Ukuran & style mengikuti pola "large detail modal" yang
// sudah ada di purchase-order/page.tsx & MrManagementClient.tsx
// (max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[85vh] overflow-y-auto).
//
// Komentar pakai DiscussionPanel apa adanya (tidak dimodifikasi) - setelah
// submit, RPC add_update_web_post_discussion cuma return void, jadi post
// di-refetch ulang (pola sama seperti handlePostDiscussion di
// petty-cash/pengajuan/[id]/page.tsx), bukan optimistic append di client.

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DiscussionPanel } from "@/components/discussion-panel";
import { DiscussionSubmitPayload } from "@/type";
import { UpdatePostContentView } from "@/components/tiptap/update-post-content-view";
import { UpdatePostReactions } from "./UpdatePostReactions";
import {
  addUpdateWebPostDiscussion,
  deleteUpdateWebPost,
  fetchUpdateWebPostById,
} from "@/services/updateWebService";
import {
  UpdateWebPost,
  UpdateWebPostReactionSummary,
  UpdateWebReactionEmoji,
} from "@/type/update-web";

interface UpdatePostDetailDialogProps {
  post: UpdateWebPost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reactions: UpdateWebPostReactionSummary[];
  onToggleReaction: (emoji: UpdateWebReactionEmoji) => void;
  isLatest: boolean;
  isAdmin: boolean;
  currentUserId?: string | null;
  onPostUpdated: (post: UpdateWebPost) => void;
  onEdit: (post: UpdateWebPost) => void;
  onDeleted: (postId: number) => void;
}

export function UpdatePostDetailDialog({
  post,
  open,
  onOpenChange,
  reactions,
  onToggleReaction,
  isLatest,
  isAdmin,
  currentUserId,
  onPostUpdated,
  onEdit,
  onDeleted,
}: UpdatePostDetailDialogProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!post) return null;

  const handleSubmitDiscussion = async (payload: DiscussionSubmitPayload) => {
    await addUpdateWebPostDiscussion(post.id, payload);
    const refreshed = await fetchUpdateWebPostById(post.id);
    onPostUpdated(refreshed);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteUpdateWebPost(post.id);
      toast.success("Postingan berhasil dihapus.");
      setDeleteOpen(false);
      onOpenChange(false);
      onDeleted(post.id);
    } catch (error: any) {
      toast.error("Gagal menghapus postingan", {
        description: error.message,
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 pr-6 text-xl">
              <Badge variant="secondary">v{post.version}</Badge>
              {isLatest && <Badge>Versi Saat Ini</Badge>}
              <span>{post.title}</span>
            </DialogTitle>
            <DialogDescription>
              Diposting{" "}
              {new Date(post.created_at).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              {post.created_by_profile?.nama
                ? ` oleh ${post.created_by_profile.nama}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {isAdmin && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => onEdit(post)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Hapus
                </Button>
              </div>
            )}

            {post.thumbnail_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.thumbnail_url}
                alt={post.title}
                className="max-h-80 w-full rounded-md object-cover"
              />
            )}

            {post.highlights.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {post.highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            )}

            <UpdatePostContentView content={post.content} />

            <UpdatePostReactions summaries={reactions} onSelect={onToggleReaction} />

            <DiscussionPanel
              discussions={post.discussions}
              onSubmit={handleSubmitDiscussion}
              storagePathPrefix={`update-web/discussions/${post.id}`}
              currentUserId={currentUserId}
              title="Komentar"
              placeholder="Tulis komentar Anda..."
              emptyText="Belum ada komentar."
            />
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus postingan ini?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{post.title}&rdquo; (v{post.version}) akan dihapus permanen beserta
              seluruh komentar dan reaction-nya. Tindakan ini tidak bisa
              dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
