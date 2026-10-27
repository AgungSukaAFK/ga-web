"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { NavigationProgress } from "@/components/navigation-progress";
import { TopbarActions, TopbarProvider } from "@/components/topbar/topbar";
import { TopbarSearch } from "@/components/topbar/topbar-search";
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
import { redirect, usePathname, useRouter } from "next/navigation";
import { Fragment, ReactNode, useEffect } from "react";
import { toast } from "@/lib/toast";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  function urlToBreadcrumb(pathname: string) {
    const parts = pathname.split("/").filter(Boolean);
    // 👉 skip kalau part terakhir adalah UUID
    const crumbs = parts.filter(
      (part, index) =>
        !(index === parts.length - 1 && /^[0-9a-fA-F-]{36}$/.test(part)),
    );

    return crumbs.map((part, index) => {
      const isLast = index === crumbs.length - 1;
      const isPage = isLast && crumbs.length === parts.length;
      const href = `/${parts.slice(0, index + 1).join("/")}`;

      const readablePart = decodeURIComponent(
        part.replace(/-/g, " ").replace(/\b\w/g, (s) => s.toUpperCase())
      );

      // Mobile: cukup crumb terakhir (dipotong kalau kepanjangan), crumb
      // sebelumnya baru muncul mulai md.
      return (
        <Fragment key={index}>
          <BreadcrumbItem
            className={isLast ? "min-w-0" : "hidden shrink-0 md:inline-flex"}
          >
            {isPage ? (
              <BreadcrumbPage className="truncate">{readablePart}</BreadcrumbPage>
            ) : (
              <BreadcrumbLink href={href} className="truncate">
                {readablePart}
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
          {!isLast && <BreadcrumbSeparator className="hidden md:block" />}
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
            // router.push (bukan redirect()) supaya halaman ini tetap ada di
            // history - redirect() di sisi klien bersifat replace.
            onClick: () => router.push("/profile"),
          },
        });
      }
    }

    fetch();
  }, []);

  return (
    <>
      <NavigationProgress />
      <SidebarProvider>
        {/* Pastikan AppSidebar menerima prop user dengan tipe yang sesuai */}
        <AppSidebar className="shadow-lg no-print" />
        <SidebarInset>
          {/* Pemisah bawah: border + garis gradien aksen (tanpa shadow).
              Blur dibuat ringan di mobile - repaint tiap scroll berat di
              HP kelas bawah. */}
          <TopbarProvider>
            <header data-app-topbar className="no-print sticky top-0 z-40 mb-4 flex shrink-0 flex-col border-b border-border/60 bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/75 md:backdrop-blur-xl md:backdrop-saturate-150 md:supports-[backdrop-filter]:bg-background/60 after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-gradient-to-r after:from-transparent after:via-primary/30 after:to-transparent">
              <div className="flex h-14 items-center gap-2 transition-[height] ease-linear md:h-16 md:group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                <div className="flex min-w-0 items-center gap-2 pl-3 md:pl-4">
                  <SidebarTrigger className="-ml-1 shrink-0" />
                  <Separator
                    orientation="vertical"
                    className="mr-1 data-[orientation=vertical]:h-4 md:mr-2"
                  />
                  <Breadcrumb className="min-w-0">
                    <BreadcrumbList className="flex-nowrap overflow-hidden">
                      <BreadcrumbItem className="hidden shrink-0 md:inline-flex">
                        <BreadcrumbLink href="/dashboard">
                          Garuda Procure
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator className="hidden md:block" />
                      {urlToBreadcrumb(pathname)}
                    </BreadcrumbList>
                  </Breadcrumb>
                </div>
                {/* Global search: field inline di tengah mulai lg, di bawahnya
                    jadi tombol ikon yg nempel di kiri deretan aksi. */}
                <div className="-mr-1 flex min-w-0 flex-1 justify-end lg:mr-0 lg:justify-center lg:px-2">
                  <TopbarSearch />
                </div>
                <div className="shrink-0 pr-2 md:pr-3">
                  <TopbarActions />
                </div>
              </div>
            </header>
          </TopbarProvider>
          <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 pt-0 break-words">
            <div className="grid grid-cols-12 items-start gap-4 md:gap-6 auto-rows-auto [&>*]:min-w-0">
              {children}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
