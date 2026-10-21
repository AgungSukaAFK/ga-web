"use client";

// Daftar percakapan Chat Admin (panel kiri) - dipakai bareng halaman user
// (/chat-admin) dan admin IT (/chat-admin-management).

import { format, isToday, isYesterday } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Headset, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import {
  isTicketUnread,
  SUPPORT_STATUS_CLASS,
  SUPPORT_STATUS_LABEL,
} from "@/services/supportChatService";
import { SupportTicket, SupportTicketStatus } from "@/type";

export function SupportStatusBadge({
  status,
  className,
}: {
  status: SupportTicketStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(SUPPORT_STATUS_CLASS[status], className)}
    >
      {SUPPORT_STATUS_LABEL[status]}
    </Badge>
  );
}

export function formatChatTime(value: string) {
  const d = new Date(value);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Kemarin";
  return format(d, "d MMM yy", { locale: localeId });
}

export function SupportTicketList({
  tickets,
  selectedId,
  onSelect,
  asAdmin,
  loading,
  adminNames,
  emptyText,
}: {
  tickets: SupportTicket[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  asAdmin: boolean;
  loading: boolean;
  adminNames?: Record<string, string | null>;
  emptyText: string;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <p className="px-4 py-12 text-center text-sm text-muted-foreground">
        {emptyText}
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {tickets.map((t) => {
        const unread = isTicketUnread(t, asAdmin);
        const active = t.id === selectedId;
        const handler = t.assigned_to ? adminNames?.[t.assigned_to] : null;
        return (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onSelect(t.id)}
              className={cn(
                "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/60",
                active && "bg-muted",
              )}
            >
              {asAdmin ? (
                <UserAvatar
                  userId={t.user_id}
                  name={t.user_nama}
                  className="h-9 w-9 shrink-0"
                  fallbackClassName="text-xs"
                  profileCard={false}
                />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Headset className="h-4 w-4" />
                </span>
              )}
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p
                    className={cn(
                      "truncate text-sm",
                      unread ? "font-semibold" : "font-medium",
                    )}
                  >
                    {asAdmin ? t.user_nama || "-" : t.subjek}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 text-xs",
                      unread ? "font-medium text-primary" : "text-muted-foreground",
                    )}
                  >
                    {formatChatTime(t.last_message_at)}
                  </span>
                </div>
                {asAdmin && (
                  <p className="truncate text-xs font-medium text-foreground/80">
                    {t.subjek}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <p
                    className={cn(
                      "min-w-0 flex-1 truncate text-xs",
                      unread ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {t.last_sender_is_admin && "Admin: "}
                    {t.last_message_preview}
                  </p>
                  {unread && (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-primary"
                      aria-label="Belum dibaca"
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <SupportStatusBadge
                    status={t.status}
                    className="px-1.5 py-0 text-[10px]"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    #{t.id} · {t.kategori}
                  </span>
                  {asAdmin && (
                    <span className="text-[10px] text-muted-foreground">
                      · {handler ? `Dipegang ${handler}` : "Belum diambil"}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
