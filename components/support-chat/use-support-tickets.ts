"use client";

// Data bersama halaman Chat Admin: profil user login, daftar percakapan
// (milik sendiri / semua untuk admin IT) yang di-refresh realtime, dan
// percakapan terpilih yang disimpan di query `?t=<id>` (supaya link notif
// langsung membuka percakapannya).

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { fetchSupportTickets } from "@/services/supportChatService";
import { Profile, SupportTicket } from "@/type";

export function useSupportTickets(asAdmin: boolean) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = Number(searchParams.get("t")) || null;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setProfile(data);
      }
      setProfileLoading(false);
    })();
  }, []);

  const userId = profile?.id;

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      setTickets(await fetchSupportTickets(asAdmin ? undefined : userId));
    } catch (err: any) {
      toast.error("Gagal memuat percakapan", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [asAdmin, userId]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    refresh();

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;
      channel = supabase
        .channel(`support-tickets-${asAdmin ? "admin" : "user"}-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "support_tickets",
            ...(asAdmin ? {} : { filter: `user_id=eq.${userId}` }),
          },
          () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(refresh, 300);
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [asAdmin, userId, refresh]);

  const select = useCallback(
    (id: number | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set("t", String(id));
      else params.delete("t");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const selected = useMemo(
    () => tickets.find((t) => t.id === selectedId) ?? null,
    [tickets, selectedId],
  );

  return {
    profile,
    profileLoading,
    tickets,
    loading,
    refresh,
    selectedId,
    selected,
    select,
  };
}
