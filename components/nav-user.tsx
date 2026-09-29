import {
  ChevronsUpDown,
  ImageIcon,
  LogOut,
  SquareUserRound,
} from "lucide-react";

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
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MyAlertDialog } from "./dialog-confirm";
import { redirect } from "next/navigation";
import { getInitials } from "@/lib/avatar";
import { AvatarViewerDialog } from "./avatar-viewer-dialog";

export function NavUser({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
}) {
  const [logoutDialog, setLogoutDialog] = useState<boolean>(false);
  const [avatarViewer, setAvatarViewer] = useState(false);

  const { isMobile } = useSidebar();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    redirect("/auth/login");
  }

  return (
    <>
      <MyAlertDialog
        open={logoutDialog}
        onOpenChange={setLogoutDialog}
        onAction={handleLogout}
      ></MyAlertDialog>
      {user.avatar && (
        <AvatarViewerDialog
          open={avatarViewer}
          onOpenChange={setAvatarViewer}
          src={user.avatar}
          name={user.name !== "-" ? user.name : user.email}
        />
      )}

      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  {user.avatar && (
                    <AvatarImage
                      src={user.avatar}
                      alt={user.name}
                      className="object-cover"
                    />
                  )}
                  <AvatarFallback className="rounded-lg">
                    {getInitials(user.name !== "-" ? user.name : user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    {user.avatar && (
                      <AvatarImage
                        src={user.avatar}
                        alt={user.name}
                        className="object-cover"
                      />
                    )}
                    <AvatarFallback className="rounded-lg">
                      {getInitials(user.name !== "-" ? user.name : user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <SquareUserRound />
                  <a href="/profile" className="w-full">
                    My Profile
                  </a>
                </DropdownMenuItem>
                {user.avatar && (
                  <DropdownMenuItem onSelect={() => setAvatarViewer(true)}>
                    <ImageIcon />
                    Lihat Foto Profil
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLogoutDialog(true)}>
                <LogOut />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  );
}
