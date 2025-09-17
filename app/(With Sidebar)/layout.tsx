"use client";

import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { createClient } from "@/lib/supabase/client";
import { redirect, usePathname } from "next/navigation";
import { Fragment, ReactNode, useEffect } from "react";
import { toast } from "sonner";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  function urlToBreadcrumb(pathname: string) {
    const parts = pathname.split("/").filter(Boolean);

    return parts.map((part, index) => {
      const isLast = index === parts.length - 1;
      const href = `/${parts.slice(0, index + 1).join("/")}`;

      const readablePart = decodeURIComponent(
        part.replace(/-/g, " ").replace(/\b\w/g, (s) => s.toUpperCase())
      );

      // 👉 skip kalau part terakhir adalah UUID
      if (isLast && /^[0-9a-fA-F-]{36}$/.test(part)) {
        return null;
      }

      return (
        <Fragment key={index}>
          <BreadcrumbItem>
            {isLast ? (
              <BreadcrumbPage>{readablePart}</BreadcrumbPage>
            ) : (
              <BreadcrumbLink href={href}>{readablePart}</BreadcrumbLink>
            )}
          </BreadcrumbItem>
          {!isLast && <BreadcrumbSeparator />}
        </Fragment>
      );
    });
  }

  useEffect(() => {
    async function fetch() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        redirect("/auth/login");
      }
      const profileRes = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (!profileRes.data.nama) {
        toast.warning("Anda belum melengkapi informasi akun.", {
          action: {
            label: "Lengkapi Profil",
            onClick: () => {
              redirect("/profile");
            },
          },
        });
      }
    }

    fetch();
  }, []);

  return (
    <>
      <SidebarProvider>
        {/* Pastikan AppSidebar menerima prop user dengan tipe yang sesuai */}
        <AppSidebar className="shadow-lg" />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/dashboard">
                      Garuda Procure
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  {urlToBreadcrumb(usePathname())}
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <div className="grid grid-cols-12 items-start gap-4 md:gap-6 auto-rows-auto">
              {children}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
