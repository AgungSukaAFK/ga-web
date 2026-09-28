// src/app/(With Sidebar)/update-web/page.tsx
//
// Halaman utama "Update Web" - changelog/pengumuman aplikasi internal. Semua
// user login bisa lihat daftar & buka detail (modal besar), komentar, & kasih
// reaction. Admin (profile.role === "admin") dapat tombol "Buat Update" +
// aksi Edit/Hapus di dalam modal detail. Lihat supabase/update-web-setup.sql
// untuk skema & RLS, services/updateWebService.ts untuk semua query.

"use client";

import { useEffect, useState } from "react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { UpdatePostCard } from "@/components/update-web/UpdatePostCard";
import { UpdatePostDetailDialog } from "@/components/update-web/UpdatePostDetailDialog";
import { UpdatePostFormDialog } from "@/components/update-web/UpdatePostFormDialog";
import {
  fetchUpdateWebPostReactions,
  fetchUpdateWebPosts,
  toggleUpdateWebPostReaction,
} from "@/services/updateWebService";
import {
  UpdateWebPost,
  UpdateWebPostReactionSummary,
  UpdateWebReactionEmoji,
} from "@/type/update-web";

export default function UpdateWebPage() {
  const supabase = createClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [posts, setPosts] = useState<UpdateWebPost[]>([]);
  const [reactionsByPost, setReactionsByPost] = useState<
    Map<number, UpdateWebPostReactionSummary[]>
  >(new Map());
  const [loading, setLoading] = useState(true);

  const [selectedPost, setSelectedPost] = useState<UpdateWebPost | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingPost, setEditingPost] = useState<UpdateWebPost | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      setIsAdmin(profile?.role === "admin");
    };
    loadUser();
  }, []);

  const loadPosts = async (userId?: string | null) => {
    setLoading(true);
    try {
      const data = await fetchUpdateWebPosts();
      setPosts(data);
      const reactions = await fetchUpdateWebPostReactions(
        data.map((p) => p.id),
        userId ?? currentUserId,
      );
      setReactionsByPost(reactions);
    } catch (error: any) {
      toast.error("Gagal memuat Update Web", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts(currentUserId);
  }, [currentUserId]);

  const handleOpenDetail = (post: UpdateWebPost) => {
    setSelectedPost(post);
    setDetailOpen(true);
  };

  const handleToggleReaction = async (
    postId: number,
    emoji: UpdateWebReactionEmoji,
    currentlyReacted: boolean,
  ) => {
    if (!currentUserId) {
      toast.error("Anda harus login untuk memberi reaction.");
      return;
    }
    // Optimistic update - reaction cuma milik user sendiri, jadi aman
    // langsung ubah state lokal tanpa refetch.
    setReactionsByPost((prev) => {
      const next = new Map(prev);
      const list = next.get(postId) ?? [];
      const existing = list.find((s) => s.emoji === emoji);
      let updatedList: UpdateWebPostReactionSummary[];
      if (existing) {
        updatedList = list
          .map((s) =>
            s.emoji === emoji
              ? {
                  ...s,
                  count: currentlyReacted ? s.count - 1 : s.count + 1,
                  reactedByMe: !currentlyReacted,
                }
              : s,
          )
          .filter((s) => s.count > 0);
      } else {
        updatedList = [...list, { emoji, count: 1, reactedByMe: true }];
      }
      next.set(postId, updatedList);
      return next;
    });

    try {
      await toggleUpdateWebPostReaction(
        postId,
        currentUserId,
        emoji,
        currentlyReacted,
      );
    } catch (error: any) {
      toast.error("Gagal menyimpan reaction", { description: error.message });
      loadPosts(currentUserId);
    }
  };

  const handlePostSaved = (post: UpdateWebPost) => {
    setPosts((prev) => {
      const exists = prev.some((p) => p.id === post.id);
      const merged = exists
        ? prev.map((p) => (p.id === post.id ? { ...p, ...post } : p))
        : [post, ...prev];
      return [...merged].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    });
  };

  const handlePostUpdated = (post: UpdateWebPost) => {
    setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
    setSelectedPost(post);
  };

  const handleDeleted = (postId: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const latestVersion =
    posts.length > 0
      ? {
          major: posts[0].version_major,
          minor: posts[0].version_minor,
          patch: posts[0].version_patch,
        }
      : null;

  return (
    <Content
      title="Update Web"
      description="Daftar pembaruan & pengumuman aplikasi."
      cardAction={
        isAdmin ? (
          <Button
            onClick={() => {
              setFormMode("create");
              setEditingPost(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Buat Update
          </Button>
        ) : undefined
      }
    >
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full rounded-xl" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
          <Megaphone className="h-10 w-10" />
          <p>Belum ada postingan update.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <UpdatePostCard
              key={post.id}
              post={post}
              reactions={reactionsByPost.get(post.id) ?? []}
              onOpen={() => handleOpenDetail(post)}
              onToggleReaction={(emoji, reacted) =>
                handleToggleReaction(post.id, emoji, reacted)
              }
            />
          ))}
        </div>
      )}

      <UpdatePostDetailDialog
        post={selectedPost}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        reactions={
          selectedPost ? reactionsByPost.get(selectedPost.id) ?? [] : []
        }
        onToggleReaction={(emoji, reacted) =>
          selectedPost && handleToggleReaction(selectedPost.id, emoji, reacted)
        }
        isAdmin={isAdmin}
        currentUserId={currentUserId}
        onPostUpdated={handlePostUpdated}
        onEdit={(post) => {
          setFormMode("edit");
          setEditingPost(post);
          setDetailOpen(false);
          setFormOpen(true);
        }}
        onDeleted={handleDeleted}
      />

      <UpdatePostFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initialPost={editingPost}
        latestVersion={latestVersion}
        onSaved={handlePostSaved}
      />
    </Content>
  );
}
