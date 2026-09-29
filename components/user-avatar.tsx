"use client";

// Avatar user dgn foto profil (kalau ada) + fallback inisial nama.
// - `src` diisi kalau URL-nya sudah di tangan (mis. profil sendiri).
// - Kalau tidak, cukup `userId`: URL dicari lewat lib/avatar-cache.ts
//   (batched + cached, aman dipakai di list panjang).
// - Kalau ada `userId`, avatar bisa diklik utk membuka kartu nama user
//   (components/user-profile-card.tsx). Matikan dgn `profileCard={false}`
//   kalau avatar sudah berada di dalam tombol lain.

import { useEffect, useState, useSyncExternalStore } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AvatarViewerDialog } from "@/components/avatar-viewer-dialog";
import { UserProfileCard } from "@/components/user-profile-card";
import { getInitials } from "@/lib/avatar";
import {
  getCachedAvatar,
  requestAvatar,
  subscribeAvatars,
} from "@/lib/avatar-cache";
import { cn } from "@/lib/utils";

export function useUserAvatar(userId?: string | null): string | null {
  const url = useSyncExternalStore(
    subscribeAvatars,
    () => (userId ? getCachedAvatar(userId) : undefined),
    () => undefined,
  );
  useEffect(() => {
    if (userId) requestAvatar(userId);
  }, [userId]);
  return url ?? null;
}

type Props = {
  userId?: string | null;
  name?: string | null;
  src?: string | null;
  className?: string;
  fallbackClassName?: string;
  style?: React.CSSProperties;
  profileCard?: boolean;
};

// Klik di dalam popover/dialog (portal) tetap bubble lewat React tree ke
// parent, mis. <TableRow onClick> di user management - jangan sampai ikut
// kepicu.
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export function UserAvatar({
  userId,
  name,
  src,
  className,
  fallbackClassName,
  style,
  profileCard = true,
}: Props) {
  const cached = useUserAvatar(src === undefined ? userId : null);
  const url = src === undefined ? cached : src;
  const [cardOpen, setCardOpen] = useState(false);
  const [viewer, setViewer] = useState<{
    src: string;
    name: string | null;
  } | null>(null);

  const avatar = (
    <Avatar className={cn("shrink-0", className)} style={style}>
      {url && (
        <AvatarImage
          src={url}
          alt={name || "Foto profil"}
          className="object-cover"
        />
      )}
      <AvatarFallback className={fallbackClassName}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );

  if (!userId || !profileCard) return avatar;

  return (
    <span className="contents" onClick={stop}>
      <Popover open={cardOpen} onOpenChange={setCardOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="shrink-0 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Lihat profil ${name || "user"}`}
            title={name ? `Lihat profil ${name}` : "Lihat profil"}
          >
            {avatar}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <UserProfileCard
            userId={userId}
            name={name}
            src={url}
            onViewPhoto={(photo, photoName) => {
              setCardOpen(false);
              setViewer({ src: photo, name: photoName });
            }}
          />
        </PopoverContent>
      </Popover>
      {viewer && (
        <AvatarViewerDialog
          open={!!viewer}
          onOpenChange={(open) => !open && setViewer(null)}
          src={viewer.src}
          name={viewer.name}
        />
      )}
    </span>
  );
}
