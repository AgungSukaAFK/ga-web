"use client";

import { forwardRef, type ComponentProps } from "react";
import { Slottable } from "@radix-ui/react-slot";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Tombol ikon bulat di top bar + badge angka opsional di pojok kanan atas.
// Di mobile visualnya 32px tapi area tap diperluas 2px tiap sisi (after:)
// -> 36px efektif; dipadukan gap-1 antar tombol supaya tidak salah tap.
// Badge pakai red-600 (bukan --destructive): putih di atasnya lolos AA
// (~4.8:1) dan tetap menonjol di dark mode.
export const TopbarIconButton = forwardRef<
  HTMLButtonElement,
  ComponentProps<typeof Button> & { badge?: number; label: string }
>(function TopbarIconButton(
  { badge, label, className, children, ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      aria-label={badge ? `${label} (${badge} baru)` : label}
      title={label}
      className={cn(
        "relative size-8 rounded-full after:absolute after:-inset-0.5 after:rounded-full sm:size-9 sm:after:hidden text-muted-foreground hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground",
        className,
      )}
      {...props}
    >
      {/* Slottable: dgn asChild, badge disisipkan ke dalam elemen child
          (mis. <Link>) - Slot hanya menerima satu child. */}
      {props.asChild ? <Slottable>{children}</Slottable> : children}
      {!!badge && badge > 0 && (
        <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-background">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Button>
  );
});
