// src/components/update-web/UpdatePostPreview.tsx
//
// Preview postingan Update Web di halaman buat/edit - tampilkan 2 wujud yang
// nanti dilihat user: kartu di halaman list (UpdatePostCard) & isi detail
// (UpdatePostArticle, sama persis dgn UpdatePostDetailDialog). Reaction &
// komentar tidak aktif di sini.

"use client";

import { JSONContent } from "@tiptap/react";
import { Badge } from "@/components/ui/badge";
import { UpdatePostCard } from "./UpdatePostCard";
import { UpdatePostArticle } from "./UpdatePostArticle";
import { UpdateWebPost } from "@/type/update-web";

interface UpdatePostPreviewProps {
  title: string;
  thumbnailUrl: string | null;
  highlights: string[];
  content: JSONContent | null;
  version: { major: number; minor: number; patch: number };
  authorName: string | null;
  createdAt: string | null;
}

export function UpdatePostPreview({
  title,
  thumbnailUrl,
  highlights,
  content,
  version,
  authorName,
  createdAt,
}: UpdatePostPreviewProps) {
  const versionLabel = `${version.major}.${version.minor}.${version.patch}`;
  const displayTitle = title.trim() || "(Belum ada judul)";
  const date = createdAt ?? new Date().toISOString();

  const fakePost: UpdateWebPost = {
    id: -1,
    version: versionLabel,
    version_major: version.major,
    version_minor: version.minor,
    version_patch: version.patch,
    title: displayTitle,
    thumbnail_url: thumbnailUrl,
    highlights,
    content: (content ?? {}) as Record<string, unknown>,
    discussions: [],
    created_by: null,
    created_at: date,
    updated_at: date,
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Kartu di daftar
        </p>
        <div className="pointer-events-none max-w-sm select-none">
          <UpdatePostCard
            post={fakePost}
            reactions={[]}
            isLatest
            onOpen={() => {}}
            onToggleReaction={() => {}}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Halaman detail
        </p>
        <div className="space-y-6 rounded-lg border p-6 shadow-sm">
          <div className="space-y-1.5">
            <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold">
              <Badge variant="secondary">v{versionLabel}</Badge>
              <Badge>Versi Saat Ini</Badge>
              <span>{displayTitle}</span>
            </h2>
            <p className="text-sm text-muted-foreground">
              Diposting{" "}
              {new Date(date).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              {authorName ? ` oleh ${authorName}` : ""}
            </p>
          </div>
          <UpdatePostArticle
            title={displayTitle}
            thumbnailUrl={thumbnailUrl}
            highlights={highlights}
            content={content}
          />
        </div>
      </div>
    </div>
  );
}
