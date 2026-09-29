// src/app/(With Sidebar)/update-web/page.tsx
//
// Halaman utama "Update Web" - changelog/pengumuman aplikasi internal. Semua
// user login bisa lihat daftar & buka detail (modal besar), komentar, & kasih
// reaction (+ konfetti emoji, lib/emoji-confetti.ts). Admin (profile.role ===
// "admin") dapat tombol "Buat Update" (/update-web/buat) + aksi Edit
// (/update-web/edit/[id]) / Hapus di dalam modal detail. Lihat supabase/update-web-setup.sql
// untuk skema & RLS, services/updateWebService.ts untuk semua query.

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useUpdateWebBadge } from "@/hooks/use-update-web-badge";
import { fireEmojiConfetti } from "@/lib/emoji-confetti";
import { UpdatePostCard } from "@/components/update-web/UpdatePostCard";
import { UpdatePostDetailDialog } from "@/components/update-web/UpdatePostDetailDialog";
import {
  fetchUpdateWebPostReactions,
  fetchUpdateWebPosts,
  setUpdateWebPostReaction,
} from "@/services/updateWebService";
import {
  UpdateWebPost,
  UpdateWebPostReactionSummary,
  UpdateWebReactionEmoji,
} from "@/type/update-web";

export default function UpdateWebPage() {
  const supabase = createClient();
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  // Tandai auth sudah selesai dicek - fetch reaction HARUS nunggu ini, kalau
  // tidak `reactedByMe` dihitung dgn userId null (semua false) & user bisa
  // kasih reaction dobel.
  const [userLoaded, setUserLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [posts, setPosts] = useState<UpdateWebPost[]>([]);
  const [reactionsByPost, setReactionsByPost] = useState<
    Map<number, UpdateWebPostReactionSummary[]>
  >(new Map());
  const [loading, setLoading] = useState(true);
  // Id request loadPosts terakhir - response dari request lama diabaikan biar
  // tidak menimpa state yang lebih baru (race saat balik dari halaman lain).
  const loadRequestId = useRef(0);

  const [selectedPost, setSelectedPost] = useState<UpdateWebPost | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Kunjungan ke halaman ini = "sudah dilihat" - bersihkan badge merah di
  // sidebar/dashboard (lihat hooks/use-update-web-badge.ts).
  const { loading: badgeLoading, markSeen } = useUpdateWebBadge(currentUserId);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUserId(user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, nama")
          .eq("id", user.id)
          .single();
        setIsAdmin(profile?.role === "admin");
        setCurrentUserName(profile?.nama ?? null);
      } finally {
        setUserLoaded(true);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (currentUserId && !badgeLoading) markSeen();
  }, [currentUserId, badgeLoading, markSeen]);

  const loadPosts = async (userId?: string | null) => {
    const requestId = ++loadRequestId.current;
    setLoading(true);
    try {
      const data = await fetchUpdateWebPosts();
      const reactions = await fetchUpdateWebPostReactions(
        data.map((p) => p.id),
        userId ?? currentUserId,
      );
      if (requestId !== loadRequestId.current) return;
      setPosts(data);
      setReactionsByPost(reactions);
    } catch (error: any) {
      if (requestId !== loadRequestId.current) return;
      toast.error("Gagal memuat Update Web", { description: error.message });
    } finally {
      if (requestId === loadRequestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (!userLoaded) return;
    loadPosts(currentUserId);
  }, [userLoaded, currentUserId]);

  const handleOpenDetail = (post: UpdateWebPost) => {
    setSelectedPost(post);
    setDetailOpen(true);
  };

  // 1 user cuma boleh 1 reaction aktif per post (lihat
  // supabase/update-web-v2-setup.sql) - klik emoji yang sama dgn reaction
  // sekarang = hapus, klik emoji lain = ganti (bukan nambah).
  const handleSetReaction = async (
    postId: number,
    emoji: UpdateWebReactionEmoji,
  ) => {
    if (!currentUserId) {
      toast.error("Anda harus login untuk memberi reaction.");
      return;
    }
    const me = { id: currentUserId, nama: currentUserName };
    const current = reactionsByPost.get(postId) ?? [];
    const previousEmoji = current.find((s) => s.reactedByMe)?.emoji ?? null;
    const nextEmoji = previousEmoji === emoji ? null : emoji;
    if (nextEmoji) fireEmojiConfetti(nextEmoji);

    // Optimistic update - reaction cuma milik user sendiri, jadi aman
    // langsung ubah state lokal tanpa refetch.
    setReactionsByPost((prev) => {
      const next = new Map(prev);
      let list = (next.get(postId) ?? []).map((s) => ({
        ...s,
        reactors: [...s.reactors],
      }));

      if (previousEmoji) {
        list = list
          .map((s) =>
            s.emoji === previousEmoji
              ? {
                  ...s,
                  count: s.count - 1,
                  reactedByMe: false,
                  reactors: s.reactors.filter((r) => r.id !== me.id),
                }
              : s,
          )
          .filter((s) => s.count > 0);
      }

      if (nextEmoji) {
        const existing = list.find((s) => s.emoji === nextEmoji);
        if (existing) {
          existing.count += 1;
          existing.reactedByMe = true;
          existing.reactors = [...existing.reactors, me];
        } else {
          list = [
            ...list,
            { emoji: nextEmoji, count: 1, reactedByMe: true, reactors: [me] },
          ];
        }
      }

      next.set(postId, list);
      return next;
    });

    try {
      await setUpdateWebPostReaction(postId, currentUserId, nextEmoji);
    } catch (error: any) {
      toast.error("Gagal menyimpan reaction", { description: error.message });
      loadPosts(currentUserId);
    }
  };

  const handlePostUpdated = (post: UpdateWebPost) => {
    setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
    setSelectedPost(post);
  };

  const handleDeleted = (postId: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  return (
    <Content
      title="Update Web"
      description="Daftar pembaruan & pengumuman aplikasi."
      cardAction={
        isAdmin ? (
          <Button asChild>
            <Link href="/update-web/buat">
              <Plus className="h-4 w-4" /> Buat Update
            </Link>
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
          {posts.map((post, index) => (
            <UpdatePostCard
              key={post.id}
              post={post}
              reactions={reactionsByPost.get(post.id) ?? []}
              isLatest={index === 0}
              onOpen={() => handleOpenDetail(post)}
              onToggleReaction={(emoji) => handleSetReaction(post.id, emoji)}
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
        isLatest={!!selectedPost && selectedPost.id === posts[0]?.id}
        onToggleReaction={(emoji) =>
          selectedPost && handleSetReaction(selectedPost.id, emoji)
        }
        isAdmin={isAdmin}
        currentUserId={currentUserId}
        onPostUpdated={handlePostUpdated}
        onEdit={(post) => router.push(`/update-web/edit/${post.id}`)}
        onDeleted={handleDeleted}
      />
    </Content>
  );
}
