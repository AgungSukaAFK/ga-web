// src/components/discussion-message-bubble.tsx
//
// Bubble chat buat 3 komponen diskusi (MR/PO, Petty Cash legacy, Petty Cash
// RPC-based) - pesan sendiri rata kanan, pesan orang lain rata kiri, lebar
// bubble ngikutin isi (bukan selalu full width) dengan batas maksimal 70%
// container di desktop, boleh sampai 100% di mobile.

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface DiscussionMessageBubbleProps {
  isMine: boolean;
  userName: string | null | undefined;
  timestamp: string;
  compact?: boolean;
  children: React.ReactNode;
}

export function DiscussionMessageBubble({
  isMine,
  userName,
  timestamp,
  compact = false,
  children,
}: DiscussionMessageBubbleProps) {
  return (
    <div className={cn("flex items-start gap-3", isMine && "flex-row-reverse")}>
      <Avatar className={cn("shrink-0", compact && "w-8 h-8")}>
        <AvatarFallback className={compact ? "text-xs" : undefined}>
          {(userName || "?").substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div
        className={cn(
          "w-fit max-w-full md:max-w-[70%] rounded-lg border p-3",
          isMine ? "bg-primary/10 border-primary/20" : "bg-muted/50",
          compact ? "text-xs" : "text-sm",
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
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}
