// src/app/(With Sidebar)/notifications/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  CheckCheck,
  MessageSquare,
  CheckCircle2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { Content } from "@/components/content";
import { Notification } from "@/type";

const formatDate = (dateString: string) => {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
};

const NotifIcon = ({ type }: { type: Notification["type"] }) => {
  if (type === "mention")
    return (
      <div className="mt-1 rounded-full p-2 bg-orange-100 text-orange-600">
        <MessageSquare className="h-4 w-4" />
      </div>
    );
  if (type === "approval_mr" || type === "approval_po")
    return (
      <div className="mt-1 rounded-full p-2 bg-green-100 text-green-600">
        <CheckCircle2 className="h-4 w-4" />
      </div>
    );
  return (
    <div className="mt-1 rounded-full p-2 bg-blue-100 text-blue-600">
      <Info className="h-4 w-4" />
    </div>
  );
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("notifications")
          .select("*, actor:profiles!actor_id(nama)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;

        setNotifications(
          (data ?? []).map((item: any) => ({
            ...item,
            actor_name: item.actor?.nama || "System",
            actor_avatar: item.actor?.avatar_url || null,
          })),
        );
      } catch (error: any) {
        toast.error("Gagal memuat notifikasi", { description: error.message });
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  const handleItemClick = async (notif: Notification) => {
    if (!notif.is_read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)),
      );
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notif.id);
    }
    if (notif.link) router.push(notif.link);
  };

  const handleMarkAllRead = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      toast.success("Semua notifikasi ditandai sudah dibaca");
    } catch {
      toast.error("Gagal memproses permintaan");
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  return (
    <Content>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Notifikasi</h1>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {unreadCount} belum dibaca
            </Badge>
          )}
        </div>

        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Tandai semua dibaca
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mb-4 opacity-20" />
              <p className="font-medium">Tidak ada notifikasi.</p>
              <p className="text-sm mt-1">
                Anda akan mendapat notifikasi saat ada aktivitas baru.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`relative flex items-start gap-4 p-4 transition-colors cursor-pointer hover:bg-muted/50 ${
                    !notif.is_read ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                  }`}
                >
                  {!notif.is_read && (
                    <span className="absolute top-4 right-4 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                    </span>
                  )}

                  <NotifIcon type={notif.type} />

                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium leading-none truncate">
                        {notif.title}
                      </p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {formatDate(notif.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {notif.message}
                    </p>
                    {notif.actor_name && notif.actor_name !== "System" && (
                      <p className="text-xs text-muted-foreground">
                        dari{" "}
                        <span className="font-medium">{notif.actor_name}</span>
                      </p>
                    )}
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
