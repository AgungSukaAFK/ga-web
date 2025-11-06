"use client";

import * as React from "react";
import { Check, Palette } from "lucide-react";
import { useCustomTheme, accentThemes } from "@/lib/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function AccentThemeSwitcher() {
  const { accent, setAccent } = useCustomTheme();

  // Map untuk preview warna di dropdown
  const themeColors: Record<string, string> = {
    zinc: "hsl(240 5.9% 10%)",
    blue: "hsl(217.2 91.2% 59.8%)",
    rose: "hsl(346.8 77.2% 49.8%)",
    green: "hsl(142.1 76.2% 36.3%)",
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <Palette className="text-muted-foreground" size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-content" align="start">
        {accentThemes.map((theme) => (
          <DropdownMenuItem
            key={theme.name}
            className="flex gap-2"
            onClick={() => setAccent(theme.name)}
          >
            <div
              className="h-4 w-4 rounded-full border"
              style={{ backgroundColor: themeColors[theme.name] }}
            />
            <span>{theme.label}</span>
            {accent === theme.name && <Check className="ml-auto h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
