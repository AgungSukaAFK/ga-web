"use client";

import { useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ImagePlay, Loader2 } from "lucide-react";
import { searchGifs, type GifResult } from "@/services/gifService";

export function GifPicker({
  onSelect,
  disabled,
}: {
  onSelect: (url: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const handler = setTimeout(() => {
      searchGifs(query)
        .then((res) => {
          if (res.success) {
            setResults(res.results);
            setError(null);
          } else {
            setResults([]);
            setError(res.message);
          }
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handler);
  }, [query, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          title="Kirim GIF"
        >
          <ImagePlay className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-80 p-2">
        <Input
          autoFocus
          placeholder="Cari GIF..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-2"
        />
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Memuat GIF...
          </div>
        ) : error ? (
          <div className="px-2 py-4 text-xs text-center text-muted-foreground">
            {error}
          </div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-3 gap-1.5 max-h-64 overflow-y-auto">
            {results.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => {
                  onSelect(gif.url);
                  setOpen(false);
                  setQuery("");
                }}
                className="relative aspect-square overflow-hidden rounded-md border hover:opacity-80 transition-opacity"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={gif.previewUrl}
                  alt="GIF"
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        ) : (
          <div className="px-2 py-4 text-xs text-center text-muted-foreground">
            Tidak ada GIF ditemukan.
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
