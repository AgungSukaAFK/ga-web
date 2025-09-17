"use client";
import useStore from "@/lib/zustand/store";
import { Button } from "./ui/button";

interface NavLink {
  name: string;
  href: string;
}

export default function MenuOpen() {
  const { setMenuOpen, isMenuOpen } = useStore();

  const navLinks: NavLink[] = [
    { name: "Fitur Utama", href: "#fitur" },
    { name: "Manfaat", href: "#manfaat" },
    { name: "Kontak", href: "#kontak" },
  ];

  return (
    <div
      className="md:hidden bg-background border-t border-border"
      hidden={!isMenuOpen}
    >
      <nav className="flex flex-col gap-4 p-4">
        {navLinks.map((link) => (
          <a
            key={link.name}
            href={link.href}
            className="text-muted-foreground hover:text-primary transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            {link.name}
          </a>
        ))}
        <div className="flex flex-col gap-2 pt-4 border-t border-border">
          <Button variant="ghost">Masuk</Button>
          <Button className="px-4 py-2">Coba Gratis</Button>
        </div>
      </nav>
    </div>
  );
}
