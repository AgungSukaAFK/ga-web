// src/components/update-web/UpdatePostCard.tsx
//
// Card ringkasan 1 postingan Update Web di halaman list - thumbnail, badge
// versi, judul, beberapa highlight pertama, jumlah komentar, & reaction bar.
// Klik card (selain area reaction) buka detail dialog (dikelola oleh caller).

"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";
import { UpdatePostReactions } from "./UpdatePostReactions";
import {
  UpdateWebPost,
  UpdateWebPostReactionSummary,
  UpdateWebReactionEmoji,
} from "@/type/update-web";

interface UpdatePostCardProps {
  post: UpdateWebPost;
  reactions: UpdateWebPostReactionSummary[];
  isLatest: boolean;
  onOpen: () => void;
  onToggleReaction: (emoji: UpdateWebReactionEmoji) => void;
}

export function UpdatePostCard({
  post,
  reactions,
  isLatest,
  onOpen,
  onToggleReaction,
}: UpdatePostCardProps) {
  const highlights = post.highlights ?? [];

  return (
    <Card
      className="cursor-pointer overflow-hidden py-0 transition-shadow hover:shadow-md"
      onClick={onOpen}
    >
      {post.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.thumbnail_url}
          alt={post.title}
          className="h-40 w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-40 w-full items-center justify-center bg-muted text-muted-foreground text-sm">
          Tidak ada thumbnail
        </div>
      )}
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">v{post.version}</Badge>
          {isLatest && <Badge>Versi Saat Ini</Badge>}
          <span className="text-xs text-muted-foreground">
            {new Date(post.created_at).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
        <h3 className="line-clamp-2 text-base font-semibold">{post.title}</h3>
        {highlights.length > 0 && (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {highlights.slice(0, 3).map((h, i) => (
              <li key={i} className="line-clamp-1 list-disc pl-0.5 marker:text-primary/60 list-inside">
                {h}
              </li>
            ))}
            {highlights.length > 3 && (
              <li className="text-xs italic">
                +{highlights.length - 3} lainnya
              </li>
            )}
          </ul>
        )}
        <div className="flex items-center justify-between pt-1">
          <UpdatePostReactions summaries={reactions} onSelect={onToggleReaction} />
          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <MessageSquare className="h-3.5 w-3.5" />
            {(post.discussions ?? []).length}
          </div>
        </div>
      </div>
    </Card>
  );
}
