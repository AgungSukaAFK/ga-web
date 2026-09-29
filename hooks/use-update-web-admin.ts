// src/hooks/use-update-web-admin.ts
//
// Guard halaman admin Update Web (/update-web/buat & /update-web/edit/[id]) -
// ambil user login + cek profile.role === "admin". Non-admin dilempar balik
// ke /update-web (RLS di DB tetap jadi penjaga utama, ini cuma UX).

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export function useUpdateWebAdmin() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/update-web");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile?.role !== "admin") {
        toast.error("Hanya admin yang bisa membuat/mengedit Update Web.");
        router.replace("/update-web");
        return;
      }
      setUserId(user.id);
      setChecking(false);
    };
    check();
  }, [router]);

  return { userId, checking };
}
