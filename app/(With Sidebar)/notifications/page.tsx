// src/app/(With Sidebar)/notifications/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCheck, Bell } from "lucide-react";
import { toast } from "sonner";
import {
  getUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/services/notificationService";
import { Content } from "@/components/content";

/**
 * Notification type
 */
interface Notification {
  id: string;
  title: string;
  message: string;
  link?: string;
  type: "mention" | "approval" | "approval_mr" | "approval_po" | "default";
  is_read: boolean;
  created_at: string;
}

// Helper format tanggal
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const supabase = createClient();

  // Load data notifikasi
  useEffect(() => {
    const initData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const data = await getUserNotifications();
        if (Array.isArray(data)) {
          setNotifications(data.filter(n => ["mention", "approval", "approval_mr", "approval_po", "default"].includes(n.type)) as Notification[]);
        } else {
          setNotifications([]);
        }
      } catch (error) {
        console.error("Error fetching notifications:", error);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [supabase]);

  // Klik satu notifikasi
  const handleItemClick = async (notif: Notification) => {
    try {
      if (!notif.is_read) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)),
        );

        await markNotificationAsRead(notif.id);
      }

      if (notif.link) {
        router.push(notif.link);
      }
    } catch (error) {
      console.error("Gagal update status notifikasi:", error);
    }
  };

  // Tandai semua dibaca
  const handleMarkAllRead = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

      await markAllNotificationsAsRead();
      toast.success("Semua notifikasi ditandai sudah dibaca");
      router.refresh();
    } catch (error) {
      toast.error("Gagal memproses permintaan");
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <Content>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifikasi</h1>
          <p className="text-muted-foreground">
            Lihat aktivitas terbaru yang berkaitan dengan Anda.
          </p>
        </div>

        {notifications.some((n) => !n.is_read) && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Tandai semua dibaca
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mb-4 opacity-20" />
              <p>Tidak ada notifikasi baru.</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`
                    relative flex items-start gap-4 p-4 transition-colors cursor-pointer
                    hover:bg-muted/50
                    ${!notif.is_read ? "bg-blue-50/50 dark:bg-blue-900/10" : ""}
                  `}
                >
                  {!notif.is_read && (
                    <span className="absolute top-4 right-4 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                    </span>
                  )}

                  <div
                    className={`mt-1 rounded-full p-2 ${
                      notif.type === "mention"
                        ? "bg-orange-100 text-orange-600"
                        : notif.type === "approval"
                          ? "bg-green-100 text-green-600"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    <Bell className="h-4 w-4" />
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium leading-none">
                        {notif.title}
                      </p>
                      <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                        {formatDate(notif.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {notif.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Content>
  );
}
