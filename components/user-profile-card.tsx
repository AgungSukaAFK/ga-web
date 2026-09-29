"use client";

// Kartu nama user yang muncul saat <UserAvatar userId=...> diklik: foto,
// nama, departemen, lokasi, perusahaan. Foto di kartu bisa diklik lagi untuk
// dibuka ukuran penuh lewat <AvatarViewerDialog>.
//
// Data profil diambil saat kartu pertama kali dibuka, lalu di-cache selama
// sesi tab (1 query per user, bukan per avatar yang tampil di list).

import { useEffect, useState } from "react";
import { Briefcase, Building2, MapPin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials } from "@/lib/avatar";
import { setCachedAvatar } from "@/lib/avatar-cache";
import { createClient } from "@/lib/supabase/client";

export type ProfileCardData = {
  nama: string | null;
  department: string | null;
  lokasi: string | null;
  company: string | null;
  avatar_url: string | null;
};

const COMPANY_LABELS: Record<string, string> = {
  GIS: "GIS (Global Inti Sejati)",
  GMI: "GMI (Garuda Mart Indonesia)",
  LOURDES: "LOURDES (Korporat)",
};

const cache = new Map<string, Promise<ProfileCardData | null>>();

function fetchProfile(userId: string): Promise<ProfileCardData | null> {
  let p = cache.get(userId);
  if (!p) {
    p = (async () => {
      const { data, error } = await createClient()
        .from("profiles")
        .select("nama, department, lokasi, company, avatar_url")
        .eq("id", userId)
        .maybeSingle();
      if (error) {
        // Jangan cache kegagalan, supaya bisa dicoba lagi saat dibuka ulang.
        cache.delete(userId);
        return null;
      }
      if (data) setCachedAvatar(userId, data.avatar_url || null);
      return data as ProfileCardData | null;
    })();
    cache.set(userId, p);
  }
  return p;
}

type Props = {
  userId: string;
  // Nama & foto yang sudah diketahui pemanggil, ditampilkan duluan sebelum
  // data profil selesai dimuat.
  name?: string | null;
  src?: string | null;
  onViewPhoto: (src: string, name: string | null) => void;
};

export function UserProfileCard({ userId, name, src, onViewPhoto }: Props) {
  const [profile, setProfile] = useState<ProfileCardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchProfile(userId).then((data) => {
      if (cancelled) return;
      setProfile(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const displayName = profile?.nama || name || null;
  const photo = profile ? profile.avatar_url : (src ?? null);

  const avatar = (
    <Avatar className="h-20 w-20 border-4 border-popover shadow-md">
      {photo && (
        <AvatarImage
          src={photo}
          alt={displayName || "Foto profil"}
          className="object-cover"
        />
      )}
      <AvatarFallback className="text-xl font-semibold">
        {getInitials(displayName)}
      </AvatarFallback>
    </Avatar>
  );

  const rows = [
    { icon: Building2, label: "Departemen", value: profile?.department },
    { icon: MapPin, label: "Lokasi", value: profile?.lokasi },
    {
      icon: Briefcase,
      label: "Perusahaan",
      value: profile?.company
        ? COMPANY_LABELS[profile.company] || profile.company
        : null,
    },
  ];

  return (
    <div className="overflow-hidden rounded-md">
      <div className="h-14 bg-gradient-to-r from-primary/70 to-primary/30" />
      <div className="-mt-10 flex flex-col items-center px-4 pb-4 text-center">
        {photo ? (
          <button
            type="button"
            onClick={() => onViewPhoto(photo, displayName)}
            className="rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Lihat foto profil"
          >
            {avatar}
          </button>
        ) : (
          avatar
        )}

        <p className="mt-2 w-full break-words text-base font-semibold leading-tight">
          {displayName || "-"}
        </p>

        <div className="mt-3 w-full space-y-2 border-t pt-3 text-left">
          {rows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-2.5 text-sm">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] leading-none text-muted-foreground">
                  {label}
                </p>
                {loading ? (
                  <Skeleton className="mt-1 h-4 w-32" />
                ) : (
                  <p className="mt-0.5 break-words font-medium">
                    {value || "-"}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
