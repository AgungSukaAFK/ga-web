"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Smile } from "lucide-react";

// Sticker bawaan berupa emoji besar (bukan file gambar) - dikirim langsung
// sebagai pesan begitu diklik, mirip sticker picker pada umumnya.
const STICKER_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Ekspresi",
    emojis: [
      "😀", "😂", "🤣", "😍", "😎", "🥳", "😭", "😡",
      "😱", "🤔", "🙄", "😴", "🤯", "🥶", "🤗", "😇",
    ],
  },
  {
    label: "Gestur",
    emojis: [
      "👍", "👎", "👏", "🙏", "💪", "🤝", "✌️", "🤞",
      "👌", "🫡", "🙌", "👋", "🤦", "🤷", "✅", "❌",
    ],
  },
  {
    label: "Lainnya",
    emojis: [
      "❤️", "🔥", "🎉", "💯", "⭐", "🚀", "💡", "☕",
      "😅", "😢", "🥲", "🤩", "🫶", "👀", "🎯", "⏰",
    ],
  },
];

export function EmojiStickerPicker({
  onSelect,
  disabled,
}: {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          title="Kirim sticker"
        >
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-72 p-2">
        <div className="max-h-64 overflow-y-auto space-y-2">
          {STICKER_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-xs text-muted-foreground px-1 mb-1">
                {group.label}
              </p>
              <div className="grid grid-cols-8 gap-1">
                {group.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onSelect(emoji);
                      setOpen(false);
                    }}
                    className="text-xl leading-none rounded-md p-1.5 hover:bg-accent transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
