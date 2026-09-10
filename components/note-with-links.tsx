"use client";

import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

// Deteksi URL "universal": http(s)://, www., atau domain telanjang
// (mis. drive.google.com/xyz, tokopedia.com, wa.me/62812...).
const URL_REGEX =
  /(https?:\/\/[^\s<>"'`]+)|(\bwww\.[^\s<>"'`]+)|(\b(?:[a-zA-Z0-9-]+\.)+(?:com|co|net|org|io|ai|id|info|biz|me|app|dev|xyz|link|click|shop|store|site|online|tech|live|tv|cc|ly|gl|gov|edu|mil|name|pro|vip|top|asia)(?:\/[^\s<>"'`]*)?)/gi;

// Tanda baca akhir kalimat yang sering ikut "kepencet" saat regex nangkep URL,
// mis. "...cek di drive.google.com/abc." -> titik terakhir bukan bagian link.
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"”’]+$/;

function normalizeHref(raw: string) {
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export function NoteWithLinks({
  text,
  className,
}: {
  text?: string | null;
  className?: string;
}) {
  if (!text) return null;

  const matches = Array.from(text.matchAll(URL_REGEX));
  if (matches.length === 0) {
    return <>{text}</>;
  }

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let linkIndex = 0;

  matches.forEach((match, i) => {
    const rawStart = match.index ?? 0;
    // Kalau match ini ke-cover sama match sebelumnya (kepotong trailing punctuation
    // yang ternyata jadi awal match berikutnya) skip saja.
    if (rawStart < cursor) return;

    let raw = match[0];
    const trailingMatch = raw.match(TRAILING_PUNCTUATION);
    if (trailingMatch) {
      raw = raw.slice(0, raw.length - trailingMatch[0].length);
    }
    if (!raw) return;

    if (rawStart > cursor) {
      nodes.push(text.slice(cursor, rawStart));
    }

    linkIndex += 1;
    nodes.push(
      <a
        key={`link-${i}`}
        href={normalizeHref(raw)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded border border-primary/30 bg-primary/5 text-primary text-[11px] font-medium not-italic align-middle hover:bg-primary/10 hover:underline"
      >
        <ExternalLink className="w-3 h-3" />
        Buka link terkait{matches.length > 1 ? ` ${linkIndex}` : ""}
      </a>,
    );

    cursor = rawStart + raw.length;
  });

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return <span className={cn(className)}>{nodes}</span>;
}
