"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Notification } from "@/type";

type NotificationContextType = {
  unreadCount: number;
  notifications: Notification[];
  refreshNotifications: () => void;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const supabase = createClient();
  const router = useRouter();

  const fetchNotifications = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Ambil notifikasi 20 terakhir
    const { data } = await supabase
      .from("notifications")
      .select(
        `
        *,
        actor:profiles!actor_id (name, avatar_url)
      `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      // Mapping agar sesuai tipe Notification
      const formattedData = data.map((item: any) => ({
        ...item,
        actor_name: item.actor?.name || "System",
        actor_avatar: item.actor?.avatar_url,
      })) as Notification[];

      setNotifications(formattedData);
      setUnreadCount(formattedData.filter((n) => !n.is_read).length);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Setup Realtime Subscription
    const setupRealtime = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel("realtime-notifications")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`, // Filter hanya untuk user ini
          },
          (payload) => {
            // Saat ada notifikasi baru
            const newNotif = payload.new as Notification;

            // Tambahkan ke state
            setNotifications((prev) => [newNotif, ...prev]);
            setUnreadCount((prev) => prev + 1);

            // Munculkan Toast
            toast.info(newNotif.title, {
              description: newNotif.message,
              action: {
                label: "Lihat",
                onClick: () => router.push(newNotif.link),
              },
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupRealtime();
  }, [router]);

  const markAsRead = async (id: string) => {
    // Optimistic Update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
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
      "useNotification must be used within a NotificationProvider"
    );
  }
  return context;
};
