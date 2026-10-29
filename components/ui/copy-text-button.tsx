"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { writeClipboard } from "@/lib/clipboard";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

// Tombol ikon untuk menyalin teks pendek (mis. kode MR/PO). Setelah tersalin
// ikonnya jadi centang sebentar. Sengaja pakai `title`, bukan Tooltip Radix:
// di dalam Dialog tombol ini bisa jadi elemen pertama yang di-autofocus, dan
// Tooltip bakal langsung kebuka tiap dialog dibuka.
export function CopyTextButton({
  text,
  label = "Salin",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    // Jangan sampai ikut memicu onClick baris tabel / link di atasnya.
    e.stopPropagation();
    try {
      await writeClipboard(text);
    } catch {
      toast.error("Gagal menyalin ke clipboard");
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  const Icon = copied ? Check : Copy;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={copy}
      aria-label={copied ? "Tersalin" : label}
      title={copied ? "Tersalin" : label}
      className={cn(
        "size-8 shrink-0 text-muted-foreground hover:text-foreground",
        copied && "text-green-600 hover:text-green-600",
        className,
      )}
    >
      <Icon />
    </Button>
  );
}
