"use client";

import { Check, Type } from "lucide-react";
import { useCustomTheme } from "@/lib/theme-provider";
import { fontFamilies, fontSizes } from "@/lib/font-options";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export function FontSwitcher() {
  const { fontFamily, setFontFamily, fontSize, setFontSize } =
    useCustomTheme();
  const sizeIndex = Math.max(
    0,
    fontSizes.findIndex((s) => s.name === fontSize),
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" title="Font & ukuran teks">
          <Type className="text-muted-foreground" size={16} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Ukuran Font
          </span>
          <span className="text-xs font-semibold">
            {fontSizes[sizeIndex].label}
          </span>
        </div>
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5">
          <span className="text-xs text-muted-foreground">A</span>
          <Slider
            min={0}
            max={fontSizes.length - 1}
            step={1}
            value={[sizeIndex]}
            onValueChange={([i]) => setFontSize(fontSizes[i].name)}
            aria-label="Ukuran font"
          />
          <span className="text-lg leading-none text-muted-foreground">A</span>
          {/* Penanda tiap langkah, px-2 = setengah lebar thumb slider */}
          <div className="col-start-2 flex justify-between px-2">
            {fontSizes.map((s, i) => (
              <button
                key={s.name}
                type="button"
                onClick={() => setFontSize(s.name)}
                className="flex w-0 flex-col items-center gap-1"
              >
                <span
                  className={cn(
                    "h-1.5 w-px bg-border",
                    i === sizeIndex && "bg-primary",
                  )}
                />
                <span
                  className={cn(
                    "whitespace-nowrap text-[10px] leading-tight text-muted-foreground",
                    i === sizeIndex && "font-semibold text-foreground",
                  )}
                >
                  {s.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="my-3 h-px bg-border" />

        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Jenis Font
        </span>
        <div className="flex flex-col gap-0.5">
          {fontFamilies.map((f) => {
            const selected = fontFamily === f.name;
            return (
              <button
                key={f.name}
                type="button"
                onClick={() => setFontFamily(f.name)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                  selected && "bg-accent",
                )}
                style={{ fontFamily: f.preview }}
              >
                <span className="flex-1">{f.label}</span>
                {selected && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
