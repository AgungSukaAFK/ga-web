"use client";

// Menu profil di top bar - isinya sama dgn NavUser di bawah sidebar
// (My Profile, Lihat Foto Profil, Log out).

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageIcon, LogOut, SquareUserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { MyAlertDialog } from "@/components/dialog-confirm";
import { AvatarViewerDialog } from "@/components/avatar-viewer-dialog";
import { createClient } from "@/lib/supabase/client";
import { getInitials } from "@/lib/avatar";
import type { TopbarProfileData } from "./topbar";

function ProfileAvatar({
  profile,
  displayName,
  className,
}: {
  profile: TopbarProfileData;
  displayName: string;
  className?: string;
}) {
  return (
    <Avatar className={className}>
      {profile.avatar_url && (
        <AvatarImage
          src={profile.avatar_url}
          alt={displayName}
          className="object-cover"
        />
      )}
      <AvatarFallback className="text-xs">
        {getInitials(displayName)}
      </AvatarFallback>
    </Avatar>
  );
}

export function TopbarProfile({
  profile,
}: {
  profile: TopbarProfileData | null;
}) {
  const router = useRouter();
  const [logoutDialog, setLogoutDialog] = useState(false);
  const [avatarViewer, setAvatarViewer] = useState(false);

  if (!profile) return <Skeleton className="size-8 shrink-0 rounded-full sm:size-9" />;

  const displayName = profile.nama || profile.email;

  async function handleLogout() {
    await createClient().auth.signOut();
    router.push("/auth/login");
  }

  return (
    <>
      <MyAlertDialog
        open={logoutDialog}
        onOpenChange={setLogoutDialog}
        onAction={handleLogout}
      />
      {profile.avatar_url && (
        <AvatarViewerDialog
          open={avatarViewer}
          onOpenChange={setAvatarViewer}
          src={profile.avatar_url}
          name={displayName}
        />
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Menu profil"
            className="flex items-center gap-2 rounded-full p-0.5 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent lg:pr-2.5"
          >
            <ProfileAvatar
              profile={profile}
              displayName={displayName}
              className="size-8 sm:size-9"
            />
            <span className="hidden max-w-32 truncate text-sm font-medium lg:block">
              {profile.nama || "-"}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          collisionPadding={8}
          className="w-[min(15rem,calc(100vw-1rem))] rounded-lg"
        >
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <ProfileAvatar
                profile={profile}
                displayName={displayName}
                className="size-8 rounded-lg"
              />
              <div className="grid flex-1 leading-tight">
                <span className="truncate font-medium">
                  {profile.nama || "-"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {profile.email}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <SquareUserRound />
                My Profile
              </Link>
            </DropdownMenuItem>
            {profile.avatar_url && (
              <DropdownMenuItem onSelect={() => setAvatarViewer(true)}>
                <ImageIcon />
                Lihat Foto Profil
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:bg-destructive/10 focus:text-destructive [&_svg]:text-destructive dark:text-red-400 dark:focus:bg-red-950/40 dark:focus:text-red-300 dark:[&_svg]:text-red-400"
            onSelect={() => setLogoutDialog(true)}
          >
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
