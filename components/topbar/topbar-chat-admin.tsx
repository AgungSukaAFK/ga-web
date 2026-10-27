"use client";

// Shortcut Chat Admin di top bar - selalu dropdown, tidak langsung pindah
// halaman (user yg cuma penasaran dgn ikonnya tidak kehilangan isian form
// yg sedang diketik). User biasa: info singkat + tombol buka chat. Admin IT:
// chat sendiri + Inbox Chat Admin (antrian yg menunggu dibalas). Angka badge
// dari hooks/use-support-chat-badge.ts.

import Link from "next/link";
import { Headset, Inbox } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSupportChatBadge } from "@/hooks/use-support-chat-badge";
import { isITAdmin } from "@/lib/constants/departments";
import { TopbarIconButton } from "./topbar-icon-button";
import type { TopbarProfileData } from "./topbar";

function CountPill({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="ml-auto rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function TopbarChatAdmin({
  profile,
}: {
  profile: TopbarProfileData | null;
}) {
  const { userUnread, adminWaiting } = useSupportChatBadge(profile?.id);
  const isAdmin = isITAdmin(profile);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <TopbarIconButton
          label="Chat Admin"
          badge={isAdmin ? userUnread + adminWaiting : userUnread}
        >
          <Headset />
        </TopbarIconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={8}
        className="w-[min(16rem,calc(100vw-1rem))]"
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Chat Admin
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isAdmin ? (
          <>
            <DropdownMenuItem asChild>
              <Link href="/chat-admin-management">
                <Inbox />
                Inbox Chat Admin
                <CountPill count={adminWaiting} />
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/chat-admin">
                <Headset />
                Chat Saya
                <CountPill count={userUnread} />
              </Link>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              {userUnread > 0
                ? `Ada ${userUnread} balasan dari tim IT yang belum Anda baca.`
                : "Ada kendala atau pertanyaan mengenai aplikasi? Chat langsung dengan tim IT."}
            </p>
            <DropdownMenuItem asChild>
              <Link href="/chat-admin">
                <Headset />
                {userUnread > 0 ? "Lihat Balasan" : "Buka Chat Admin"}
                <CountPill count={userUnread} />
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
