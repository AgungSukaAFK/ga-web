// src/components/discussion-message-bubble.tsx
//
// Bubble chat buat 3 komponen diskusi (MR/PO, Petty Cash legacy, Petty Cash
// RPC-based) - pesan sendiri rata kanan, pesan orang lain rata kiri, lebar
// bubble ngikutin isi (bukan selalu full width) dengan batas maksimal 70%
// container di desktop, boleh sampai 100% di mobile.

import { Reply } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { DiscussionReplyRef } from "@/type";

interface DiscussionMessageBubbleProps {
  isMine: boolean;
  userId?: string | null;
  userName: string | null | undefined;
  timestamp: string;
  compact?: boolean;
  // Kutipan pesan yang dibalas (kalau pesan ini balasan) - klik = scroll ke
  // pesan asli lewat onReplyQuoteClick.
  replyTo?: DiscussionReplyRef;
  onReplyQuoteClick?: () => void;
  // Kalau diisi, muncul tombol "Balas" di bubble.
  onReply?: () => void;
  highlighted?: boolean;
  children: React.ReactNode;
}

export function DiscussionMessageBubble({
  isMine,
  userId,
  userName,
  timestamp,
  compact = false,
  replyTo,
  onReplyQuoteClick,
  onReply,
  highlighted = false,
  children,
}: DiscussionMessageBubbleProps) {
  return (
    <div
      className={cn(
        "group flex items-start gap-3",
        isMine && "flex-row-reverse",
      )}
    >
      <UserAvatar
        userId={userId}
        name={userName}
        className={cn(compact && "w-8 h-8")}
        fallbackClassName={compact ? "text-xs" : undefined}
      />
      <div
        className={cn(
          "w-fit max-w-full md:max-w-[70%] rounded-lg border p-3 transition-shadow",
          isMine ? "bg-primary/10 border-primary/20" : "bg-muted/50",
          compact ? "text-xs" : "text-sm",
          highlighted && "ring-2 ring-primary ring-offset-2",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-3",
            isMine && "flex-row-reverse",
          )}
        >
          <p className={cn("font-semibold", compact ? "text-xs" : "text-sm")}>
            {userName || "-"}
          </p>
          <p
            className={cn(
              "text-muted-foreground shrink-0",
              compact ? "text-[10px]" : "text-xs",
            )}
          >
            {new Date(timestamp).toLocaleString("id-ID")}
          </p>
        </div>
        {replyTo && (
          <button
            type="button"
            onClick={onReplyQuoteClick}
            className="mt-2 block w-full rounded border-l-2 border-primary/60 bg-background/60 px-2 py-1 text-left text-xs hover:bg-background"
          >
            <span className="font-semibold">{replyTo.user_name || "-"}</span>
            <span className="block truncate text-muted-foreground">
              {replyTo.excerpt || "(pesan)"}
            </span>
          </button>
        )}
        <div className="mt-1">{children}</div>
      </div>
      {onReply && (
        <button
          type="button"
          onClick={onReply}
          title="Balas"
          aria-label="Balas pesan"
          className="self-center rounded p-1 text-muted-foreground opacity-100 hover:bg-muted hover:text-foreground md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Reply className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
