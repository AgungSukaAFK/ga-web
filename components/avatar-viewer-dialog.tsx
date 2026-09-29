"use client";

// Lihat foto profil ukuran penuh (file tersimpan 512x512, lihat
// components/profile-avatar-dialog.tsx). Dipakai dari halaman /profile dan
// menu user di sidebar.

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  name?: string | null;
};

export function AvatarViewerDialog({ open, onOpenChange, src, name }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] gap-3 p-3 sm:max-w-sm">
        <DialogTitle className="px-1 pr-8 text-base">
          {name || "Foto Profil"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Foto profil ukuran penuh.
        </DialogDescription>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name ? `Foto profil ${name}` : "Foto profil"}
          className="aspect-square w-full rounded-lg bg-muted object-cover"
        />
      </DialogContent>
    </Dialog>
  );
}
