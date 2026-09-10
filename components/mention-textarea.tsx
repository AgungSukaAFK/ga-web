"use client";

import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { searchUsersForMention } from "@/services/userService";
import { User, DiscussionMention } from "@/type";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface MentionTrigger {
  start: number;
  query: string;
}

// Cari trigger "@" aktif tepat sebelum posisi caret - "@" harus di awal teks
// atau didahului whitespace (biar email/teks lain ga ikut kepicu), dan belum
// ada spasi antara "@" dan caret (kalau udah ada spasi berarti user udah
// selesai ngetik kata lain, bukan lagi nyari mention).
function detectMentionTrigger(
  text: string,
  caret: number,
): MentionTrigger | null {
  const uptoCaret = text.slice(0, caret);
  const atIndex = uptoCaret.lastIndexOf("@");
  if (atIndex === -1) return null;

  const charBeforeAt = atIndex > 0 ? uptoCaret[atIndex - 1] : " ";
  if (atIndex !== 0 && !/\s/.test(charBeforeAt)) return null;

  const between = uptoCaret.slice(atIndex + 1);
  if (/\s/.test(between)) return null;

  return { start: atIndex, query: between };
}

interface MentionTextareaProps {
  value: string;
  onValueChange: (value: string) => void;
  onMentionAdd: (mention: DiscussionMention) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
}

export function MentionTextarea({
  value,
  onValueChange,
  onMentionAdd,
  placeholder,
  rows = 2,
  disabled,
  className,
}: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [triggerStart, setTriggerStart] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const open = triggerStart !== null;

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const handler = setTimeout(() => {
      searchUsersForMention(query)
        .then((data) => {
          setResults(data);
          setHighlightedIndex(0);
        })
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(handler);
  }, [query, open]);

  const closeMentionPopup = () => {
    setTriggerStart(null);
    setQuery("");
    setResults([]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onValueChange(newValue);

    const caret = e.target.selectionStart ?? newValue.length;
    const trigger = detectMentionTrigger(newValue, caret);
    if (trigger) {
      setTriggerStart(trigger.start);
      setQuery(trigger.query);
    } else {
      closeMentionPopup();
    }
  };

  const selectUser = (user: User) => {
    if (triggerStart === null || !textareaRef.current) return;
    const nama = user.nama || user.email || "User";
    const caret = textareaRef.current.selectionStart ?? value.length;
    const before = value.slice(0, triggerStart);
    const after = value.slice(caret);
    const insertion = `@${nama} `;
    const newValue = `${before}${insertion}${after}`;

    onValueChange(newValue);
    onMentionAdd({ id: user.id, nama });
    closeMentionPopup();

    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      const pos = before.length + insertion.length;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(pos, pos);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) =>
        results.length ? (i + 1) % results.length : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) =>
        results.length ? (i - 1 + results.length) % results.length : 0,
      );
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (results[highlightedIndex]) {
        e.preventDefault();
        selectUser(results[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeMentionPopup();
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) closeMentionPopup();
      }}
    >
      <PopoverAnchor asChild>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Delay dikit biar klik di item popup sempat kehandle duluan.
            setTimeout(closeMentionPopup, 150);
          }}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className={className}
        />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        side="top"
        className="w-72 p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Mencari user...
          </div>
        ) : results.length > 0 ? (
          <div className="max-h-56 overflow-y-auto">
            {results.map((user, index) => (
              <button
                key={user.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectUser(user)}
                className={cn(
                  "w-full text-left px-2.5 py-2 text-sm rounded-sm flex flex-col gap-0.5",
                  index === highlightedIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/60",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">
                    {user.nama || user.email}
                  </span>
                  {user.role && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {user.role}
                    </span>
                  )}
                </div>
                {user.email && (
                  <span className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="px-2.5 py-3 text-sm text-center text-muted-foreground">
            User tidak ditemukan.
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
