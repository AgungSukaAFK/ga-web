import { Fragment } from "react";
import { DiscussionMention } from "@/type";

// Escape karakter regex spesial biar nama user aman dipakai sebagai literal
// pattern (nama bisa mengandung ".", "(", dll).
function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function MessageWithMentions({
  text,
  mentions,
}: {
  text: string;
  mentions?: DiscussionMention[];
}) {
  if (!mentions || mentions.length === 0) return <>{text}</>;

  // Nama terpanjang duluan biar "Budi Santoso" ga kepotong jadi "Budi" doang.
  const tokens = [...mentions]
    .sort((a, b) => b.nama.length - a.nama.length)
    .map((m) => `@${m.nama}`);

  const uniqueTokens = Array.from(new Set(tokens));
  if (uniqueTokens.length === 0) return <>{text}</>;

  const regex = new RegExp(
    `(${uniqueTokens.map(escapeRegex).join("|")})`,
    "g",
  );
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        uniqueTokens.includes(part) ? (
          <span
            key={i}
            className="font-medium text-primary bg-primary/10 rounded px-1"
          >
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
