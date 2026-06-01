"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Notification as AppNotification } from "@/type";
import { unlockAudio, playSound } from "@/lib/notifications/sound";
import { loadNotifSettings } from "@/lib/notifications/settings";

type NotificationContextType = {
  unreadCount: number;
  notifications: AppNotification[];
  refreshNotifications: () => void;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

// Engine sound (unlockAudio, playSound) ada di @/lib/notifications/sound.
// Pengaturan user (on/off, volume, pilihan sound) di @/lib/notifications/settings.

// ─────────────────────────────────────────────
// Browser Push Notification
// ─────────────────────────────────────────────
function requestBrowserPermission() {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) {
    console.log("[Notif] Browser tidak mendukung Notification API");
    return;
  }
  if (Notification.permission === "default") {
    Notification.requestPermission().then((result) => {
      console.log("[Notif] hasil minta izin browser:", result);
    });
  } else {
    console.log("[Notif] izin browser saat ini:", Notification.permission);
  }
}

function showBrowserNotification(title: string, body: string, link: string) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) {
    console.log("[Notif] browser notif dilewati: API tidak didukung");
    return;
  }
  if (Notification.permission !== "granted") {
    console.log(
      "[Notif] browser notif dilewati: izin =",
      Notification.permission,
    );
    return;
  }

  try {
    const notif = new Notification(title, {
      body,
      icon: "/lourdes.png",
      badge: "/lourdes.png",
      tag: link, // deduplicate by link
    });

    notif.onclick = () => {
      window.focus();
      window.location.href = link;
      notif.close();
    };
    console.log("[Notif] browser notif ditampilkan");
  } catch (err) {
    console.warn("[Notif] gagal menampilkan browser notif:", err);
  }
}

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────
export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  // Client supabase distabilkan dengan useState supaya TIDAK dibuat ulang tiap
  // render. Kalau dibuat ulang, useEffect realtime akan teardown + subscribe
  // ulang tiap pindah halaman (CHANNEL_ERROR + delay) dan menyebabkan handler
  // terpicu berkali-kali (sound bertumpuk).
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  // Prevent sound/browser notif on initial page load
  const isInitialLoad = useRef(true);

  const fetchNotifications = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("notifications")
      .select(
        `
        *,
        actor:profiles!actor_id (nama)
      `,
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (data) {
      const formattedData = data.map((item: any) => ({
        ...item,
        actor_name: item.actor?.nama || "System",
      })) as AppNotification[];

      setNotifications(formattedData);
      setUnreadCount(formattedData.filter((n) => !n.is_read).length);
    }
  }, [supabase]);

  // Browser notification permission HARUS diminta dari gesture user
  // (klik/keydown), bukan saat mount — kalau di mount, browser menolak.
  useEffect(() => {
    const onFirstGesture = () => {
      requestBrowserPermission();
      unlockAudio();
      window.removeEventListener("click", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
    };
    window.addEventListener("click", onFirstGesture);
    window.addEventListener("keydown", onFirstGesture);
    return () => {
      window.removeEventListener("click", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
    };
  }, []);

  useEffect(() => {
    fetchNotifications().then(() => {
      // After the initial fetch, mark that initial load is done
      isInitialLoad.current = false;
    });

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtime = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      // PENTING: kirim JWT user ke koneksi realtime. Tanpa ini, websocket
      // konek sebagai anon → RLS memblokir semua event postgres_changes
      // (anon tidak boleh SELECT notif milik user) → notif tak pernah masuk
      // realtime, harus refresh dulu.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;

      channel = supabase
        .channel(`realtime-notifications-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          async (payload) => {
            const rawNotif = payload.new as AppNotification;

            // Fetch actor name for the new notification
            let actorName = "System";
            if (rawNotif.actor_id) {
              const { data: actorData } = await supabase
                .from("profiles")
                .select("nama")
                .eq("id", rawNotif.actor_id)
                .single();
              if (actorData?.nama) actorName = actorData.nama;
            }

            const newNotif: AppNotification = {
              ...rawNotif,
              actor_name: actorName,
            };

            // Update state
            setNotifications((prev) => [newNotif, ...prev.slice(0, 29)]);
            setUnreadCount((prev) => prev + 1);

            // Don't fire extra alerts on the initial batch
            if (isInitialLoad.current) return;

            // Hormati pengaturan user (default: semua nyala).
            const settings = loadNotifSettings();

            console.log("[Notif] new notif diterima:", {
              enabled: settings.enabled,
              sound: settings.sound,
              browser: settings.browser,
              browserPermission:
                typeof Notification !== "undefined"
                  ? Notification.permission
                  : "unsupported",
              docHidden: document.hidden,
            });

            // Master switch: kalau dimatikan, badge/list tetap update di atas,
            // tapi tidak ada alert (sound/browser/toast).
            if (!settings.enabled) return;

            // Sound
            if (settings.sound) {
              playSound(settings.soundType, settings.volume);
            }

            // Browser notification (OS-level)
            if (settings.browser) {
              showBrowserNotification(
                newNotif.title,
                newNotif.message ?? "",
                newNotif.link,
              );
            }

            // In-app toast
            toast.info(newNotif.title, {
              description: newNotif.message,
              action: {
                label: "Lihat",
                onClick: () => router.push(newNotif.link),
              },
            });
          },
        )
        .subscribe((status, err) => {
          // Diagnostik realtime — lihat di Console DevTools.
          // Harusnya "SUBSCRIBED". Kalau CHANNEL_ERROR / TIMED_OUT berarti
          // tabel belum masuk publication realtime atau Realtime project off.
          console.log("[Notif] realtime status:", status, err ?? "");
        });
    };

    setupRealtime();

    return () => {
      // teardown sinkron — cegah subscription menumpuk / sound dobel
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchNotifications, router, supabase]);

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        notifications,
        refreshNotifications: fetchNotifications,
        markAsRead,
        markAllRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotification must be used within a NotificationProvider",
    );
  }
  return context;
};
