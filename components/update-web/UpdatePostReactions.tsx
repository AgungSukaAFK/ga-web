// src/components/update-web/UpdatePostReactions.tsx
//
// Baris reaction multi-emoji ala Slack/Discord untuk 1 postingan Update Web.
// Controlled - caller (list card / detail dialog) yang nyimpen state
// `summaries` & nanganin toggle lewat `onToggle` (services/updateWebService.ts
// toggleUpdateWebPostReaction), komponen ini cuma render + trigger callback.

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SmilePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  UPDATE_WEB_REACTION_EMOJIS,
  UpdateWebPostReactionSummary,
  UpdateWebReactionEmoji,
} from "@/type/update-web";

interface UpdatePostReactionsProps {
  summaries: UpdateWebPostReactionSummary[];
  onToggle: (emoji: UpdateWebReactionEmoji, currentlyReacted: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function UpdatePostReactions({
  summaries,
  onToggle,
  disabled,
  className,
}: UpdatePostReactionsProps) {
  const [open, setOpen] = useState(false);
  const visible = summaries.filter((s) => s.count > 0);

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {visible.map((s) => (
        <Button
          key={s.emoji}
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-7 gap-1 rounded-full px-2.5 text-xs",
            s.reactedByMe && "border-primary bg-primary/10",
          )}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(s.emoji as UpdateWebReactionEmoji, s.reactedByMe);
          }}
        >
          <span>{s.emoji}</span>
          <span className="text-muted-foreground">{s.count}</span>
        </Button>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            disabled={disabled}
            onClick={(e) => e.stopPropagation()}
          >
            <SmilePlus className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-1.5"
          align="start"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex gap-1">
            {UPDATE_WEB_REACTION_EMOJIS.map((emoji) => {
              const existing = summaries.find((s) => s.emoji === emoji);
              return (
                <Button
                  key={emoji}
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-8 w-8 text-base",
                    existing?.reactedByMe && "bg-accent",
                  )}
                  onClick={() => {
                    onToggle(emoji, existing?.reactedByMe ?? false);
                    setOpen(false);
                  }}
                >
                  {emoji}
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
