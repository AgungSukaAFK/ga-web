// src/components/update-web/UpdatePostReactions.tsx
//
// Baris reaction untuk 1 postingan Update Web - 1 user cuma boleh punya 1
// emoji aktif per post (lihat supabase/update-web-v2-setup.sql), jadi klik
// emoji lain otomatis GANTI reaction (bukan nambah), klik emoji yang sama
// dgn reaction sekarang = hapus. Controlled - caller (list card / detail
// dialog) yang nyimpen state `summaries` & nanganin perubahan lewat
// `onSelect` (services/updateWebService.ts setUpdateWebPostReaction),
// komponen ini cuma render + trigger callback. Hover pill nampilin nama-nama
// yang kasih reaction itu (Tooltip).

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SmilePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  UPDATE_WEB_REACTION_EMOJIS,
  UpdateWebPostReactionSummary,
  UpdateWebReactionEmoji,
} from "@/type/update-web";

interface UpdatePostReactionsProps {
  summaries: UpdateWebPostReactionSummary[];
  onSelect: (emoji: UpdateWebReactionEmoji) => void;
  disabled?: boolean;
  className?: string;
}

function reactorNamesLabel(summary: UpdateWebPostReactionSummary): string {
  const names = summary.reactors.map((r) => r.nama || "Seseorang");
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")}, dan ${names.length - 3} lainnya`;
}

export function UpdatePostReactions({
  summaries,
  onSelect,
  disabled,
  className,
}: UpdatePostReactionsProps) {
  const [open, setOpen] = useState(false);
  const visible = summaries.filter((s) => s.count > 0);

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {visible.map((s) => (
        <Tooltip key={s.emoji}>
          <TooltipTrigger asChild>
            <Button
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
                onSelect(s.emoji as UpdateWebReactionEmoji);
              }}
            >
              <span>{s.emoji}</span>
              <span className="text-muted-foreground">{s.count}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{reactorNamesLabel(s)}</TooltipContent>
        </Tooltip>
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
                    onSelect(emoji);
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
