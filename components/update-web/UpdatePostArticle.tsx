// src/components/update-web/UpdatePostArticle.tsx
//
// Isi utama 1 postingan Update Web (thumbnail 16:9, highlight, body Tiptap) -
// dipakai bareng oleh UpdatePostDetailDialog & preview di halaman buat/edit
// (UpdatePostPreview) supaya yang dilihat admin saat preview = persis yang
// nanti dilihat user.

"use client";

import { JSONContent } from "@tiptap/react";
import { UpdatePostContentView } from "@/components/tiptap/update-post-content-view";

interface UpdatePostArticleProps {
  title: string;
  thumbnailUrl: string | null;
  highlights: string[];
  content: JSONContent | Record<string, unknown> | null | undefined;
}

export function UpdatePostArticle({
  title,
  thumbnailUrl,
  highlights,
  content,
}: UpdatePostArticleProps) {
  return (
    <>
      {thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt={title}
          className="aspect-video w-full rounded-md object-cover"
        />
      )}

      {highlights.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {highlights.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      )}

      <UpdatePostContentView content={content} />
    </>
  );
}
