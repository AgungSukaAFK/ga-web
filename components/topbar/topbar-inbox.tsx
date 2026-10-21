"use client";

// Inbox di top bar: rangkuman semua notif (umum, Chat Admin, Update Web)
// dalam satu daftar quick access - logika penggabungan & batas umur/jumlah
// ada di ./use-inbox.ts. Daftar lengkap tetap di halaman masing-masing.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Headset,
  Inbox,
  type LucideIcon,
  Megaphone,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { cn, formatRelativeTime } from "@/lib/utils";
import { TopbarIconButton } from "./topbar-icon-button";
import {
  INBOX_MAX_AGE_DAYS,
  INBOX_MAX_ITEMS,
  type InboxItem,
  type InboxSource,
  useInbox,
} from "./use-inbox";
import type { TopbarProfileData } from "./topbar";

const SOURCES: Record<
  InboxSource,
  { label: string; icon: LucideIcon; badge: string }
> = {
  notification: { label: "Notifikasi", icon: Bell, badge: "bg-primary" },
  chat: { label: "Chat Admin", icon: Headset, badge: "bg-sky-600" },
  // amber-600 (bukan 500): ikon putih di atasnya butuh kontras >= 3:1.
  update: { label: "Update Web", icon: Megaphone, badge: "bg-amber-600" },
};

const FILTERS: { value: InboxSource | "all"; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "notification", label: "Notifikasi" },
  { value: "chat", label: "Chat" },
  { value: "update", label: "Update" },
];

function InboxRow({
  item,
  onOpen,
}: {
  item: InboxItem;
  onOpen: () => void;
}) {
  const src = SOURCES[item.source];
  const SrcIcon = src.icon;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "relative flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none",
        // Unread: tint tipis + garis aksen di kiri, supaya tetap beda dari
        // state hover.
        item.unread &&
          "bg-primary/[0.06] before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary",
      )}
    >
      {/* Avatar pelaku + ikon sumber; tanpa pelaku -> ikon sumber saja. */}
      <div className="relative mt-0.5 shrink-0">
        {item.actorId && item.actorName ? (
          <UserAvatar
            userId={item.actorId}
            name={item.actorName}
            src={item.actorAvatar ?? undefined}
            profileCard={false}
            className="size-8"
            fallbackClassName="text-[10px]"
          />
        ) : (
          <div
            className={cn(
              "flex size-8 items-center justify-center rounded-full text-white",
              src.badge,
            )}
          >
            <SrcIcon className="size-4" />
          </div>
        )}
        {item.actorId && item.actorName && (
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-white ring-2 ring-popover",
              src.badge,
            )}
          >
            <SrcIcon className="size-2.5" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p
            className={cn(
              "min-w-0 flex-1 truncate text-sm",
              item.unread ? "font-semibold" : "font-medium text-foreground/80",
            )}
          >
            {item.title}
          </p>
          {item.unread && (
            <span
              className="size-2 shrink-0 rounded-full bg-primary"
              aria-label="Belum dibaca"
            />
          )}
        </div>
        {item.message && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {item.message}
          </p>
        )}
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{src.label}</span>
          <span aria-hidden>·</span>
          <time dateTime={item.time}>{formatRelativeTime(item.time)}</time>
        </div>
      </div>
    </button>
  );
}

export function TopbarInbox({
  profile,
}: {
  profile: TopbarProfileData | null;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<InboxSource | "all">("all");
  const router = useRouter();
  const { items, unreadCount, markAllRead, onOpen } = useInbox(profile);

  const shown =
    filter === "all" ? items : items.filter((i) => i.source === filter);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) onOpen();
  };

  const openItem = (item: InboxItem) => {
    item.markRead();
    setOpen(false);
    router.push(item.href);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <TopbarIconButton label="Inbox" badge={unreadCount}>
          <Inbox />
        </TopbarIconButton>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={8}
        className="w-[min(24rem,calc(100vw-1rem))] overflow-hidden p-0"
      >
        <div className="space-y-2.5 border-b px-4 pb-2.5 pt-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Inbox</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                  {unreadCount} baru
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="-mr-2 h-7 gap-1 px-2 text-xs"
                onClick={markAllRead}
              >
                <CheckCheck className="size-3.5" />
                Tandai <span className="hidden sm:inline">semua</span> dibaca
              </Button>
            )}
          </div>
          <div className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FILTERS.map((f) => {
              const count = (
                f.value === "all"
                  ? items
                  : items.filter((i) => i.source === f.value)
              ).filter((i) => i.unread).length;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:bg-accent",
                    filter === f.value &&
                      "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                >
                  {f.label}
                  {count > 0 && (
                    <span className="text-[10px] font-semibold opacity-80">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
            <Inbox className="size-6 opacity-60" />
            Inbox kosong
          </div>
        ) : (
          <ul className="max-h-[min(26rem,calc(100dvh-14rem))] divide-y overflow-y-auto">
            {shown.map((item) => (
              <li key={item.key}>
                <InboxRow item={item} onOpen={() => openItem(item)} />
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-2 border-t px-4 py-2">
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {INBOX_MAX_AGE_DAYS} hari terakhir · maks. {INBOX_MAX_ITEMS} item
          </span>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="shrink-0 text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            Semua notifikasi
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
