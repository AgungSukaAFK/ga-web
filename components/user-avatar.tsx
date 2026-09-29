"use client";

// Avatar user dgn foto profil (kalau ada) + fallback inisial nama.
// - `src` diisi kalau URL-nya sudah di tangan (mis. profil sendiri).
// - Kalau tidak, cukup `userId`: URL dicari lewat lib/avatar-cache.ts
//   (batched + cached, aman dipakai di list panjang).

import { useEffect, useSyncExternalStore } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
};

export function UserAvatar({
  userId,
  name,
  src,
  className,
  fallbackClassName,
  style,
}: Props) {
  const cached = useUserAvatar(src === undefined ? userId : null);
  const url = src === undefined ? cached : src;

  return (
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
}
