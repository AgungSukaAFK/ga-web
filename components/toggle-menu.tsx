"use client";
import useStore from "@/lib/zustand/store";
import { Button } from "./ui/button";
import { Menu } from "lucide-react";

export default function ToggleMenu() {
  const { isMenuOpen, setMenuOpen } = useStore();

  return (
    <div className="md:hidden">
      <Button onClick={() => setMenuOpen(!isMenuOpen)} variant="ghost">
        <Menu className="h-6 w-6" />
        <span className="sr-only">Toggle menu</span>
      </Button>
    </div>
  );
}
