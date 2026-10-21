"use client";

// Aksi di sisi kanan top bar (layout "With Sidebar"): Inbox notifikasi,
// Chat Admin, pengaturan Tampilan, dan menu Profil. Bagian tengah: global
// search (./topbar-search.tsx). Profil user diambil sekali di
// TopbarProvider lalu dibagi ke semua bagian top bar.

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { AVATAR_UPDATED_EVENT } from "@/lib/avatar";
import { TopbarInbox } from "./topbar-inbox";
import { TopbarChatAdmin } from "./topbar-chat-admin";
import { TopbarAppearance } from "./topbar-appearance";
import { TopbarProfile } from "./topbar-profile";

export type TopbarProfileData = {
  id: string;
  email: string;
  nama: string | null;
  avatar_url: string | null;
  role: string | null;
  department: string | null;
};

function useTopbarProfile() {
  const [profile, setProfile] = useState<TopbarProfileData | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("nama, avatar_url, role, department")
        .eq("id", user.id)
        .single();
      setProfile({
        id: user.id,
        email: user.email ?? "",
        nama: data?.nama ?? null,
        avatar_url: data?.avatar_url ?? null,
        role: data?.role ?? null,
        department: data?.department ?? null,
      });
    })();
  }, []);

  useEffect(() => {
    const onAvatarUpdated = (e: Event) => {
      const url = (e as CustomEvent<string | null>).detail;
      setProfile((prev) => (prev ? { ...prev, avatar_url: url } : prev));
    };
    window.addEventListener(AVATAR_UPDATED_EVENT, onAvatarUpdated);
    return () =>
      window.removeEventListener(AVATAR_UPDATED_EVENT, onAvatarUpdated);
  }, []);

  return profile;
}

const TopbarProfileContext = createContext<TopbarProfileData | null>(null);

export function TopbarProvider({ children }: { children: ReactNode }) {
  const profile = useTopbarProfile();
  return (
    <TopbarProfileContext.Provider value={profile}>
      {children}
    </TopbarProfileContext.Provider>
  );
}

/** Profil user yang login (null selama masih dimuat). */
export function useTopbarProfileData() {
  return useContext(TopbarProfileContext);
}

export function TopbarActions() {
  const profile = useTopbarProfileData();

  return (
    <div className="flex items-center gap-1 sm:gap-0.5">
      <TopbarInbox profile={profile} />
      <TopbarChatAdmin profile={profile} />
      <TopbarAppearance />
      <div className="mx-1 h-5 w-px bg-border sm:mx-1.5" aria-hidden />
      <TopbarProfile profile={profile} />
    </div>
  );
}
