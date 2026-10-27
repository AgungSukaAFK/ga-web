"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function LandingMobileNav({
  links,
  isLoggedIn,
}: {
  links: { name: string; href: string }[];
  isLoggedIn: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="size-5" />
          <span className="sr-only">Buka menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[85vw] max-w-sm">
        <SheetHeader>
          <SheetTitle>Garuda Procure</SheetTitle>
          <SheetDescription>
            Sistem Manajemen MR, PO &amp; Petty Cash
          </SheetDescription>
        </SheetHeader>
        <nav className="flex flex-col px-4">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="border-b py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.name}
            </a>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 p-4">
          {isLoggedIn ? (
            <Button asChild>
              <Link href="/dashboard">
                Buka Dashboard <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild>
                <Link href="/auth/login">Masuk</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/auth/sign-up">Daftar Akun</Link>
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
