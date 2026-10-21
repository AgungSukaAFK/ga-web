"use client";

// Satu tombol "Tampilan" di top bar yg menggabungkan Tema (terang/gelap),
// Warna Aksen, dan Font. Opsi & state-nya sama dgn ThemeSwitcher,
// AccentThemeSwitcher, dan FontSwitcher.
//
// Animasi: ganti mode -> tampilan baru menyebar dari tombol yg diklik;
// aksen & font -> cross-fade (lib/view-transition.ts). Penanda opsi
// terpilih punya view-transition-name sendiri (SelectedIndicator) supaya
// bergeser ke opsi baru, bukan sekadar pindah.

import * as React from "react";
import { Check, Palette } from "lucide-react";
import { useTheme } from "next-themes";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { THEME_OPTIONS } from "@/components/theme-switcher";
import { FontSettingsPanel } from "@/components/font-switcher";
import { accentThemes, useCustomTheme } from "@/lib/theme-provider";
import { cn } from "@/lib/utils";
import { originFromEvent, runViewTransition } from "@/lib/view-transition";
import { TopbarIconButton } from "./topbar-icon-button";

const companyThemes = accentThemes.filter((t) => t.group === "company");
const generalThemes = accentThemes.filter((t) => t.group === "general");

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

// Latar/border opsi terpilih, dirender terpisah dari isi tombol supaya bisa
// dianimasikan bergeser (view-transition-name harus unik: hanya opsi
// terpilih yg merendernya). Tombol induk wajib `relative isolate`.
function SelectedIndicator({
  name,
  className,
}: {
  name: string;
  className: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-10", className)}
      style={{ viewTransitionName: name }}
    />
  );
}

function ThemePanel() {
  const [mounted, setMounted] = React.useState(false);
  const { theme, setTheme } = useTheme();
  React.useEffect(() => setMounted(true), []);

  return (
    <>
      <SectionLabel>Mode Tampilan</SectionLabel>
      <div className="grid grid-cols-3 gap-1.5">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
          const selected = mounted && theme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={(e) =>
                runViewTransition(() => setTheme(value), {
                  origin: originFromEvent(e),
                })
              }
              className={cn(
                "relative isolate flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs transition-colors hover:bg-accent",
                selected && "font-semibold",
              )}
            >
              {selected && (
                <SelectedIndicator
                  name="appearance-mode"
                  className="rounded-lg border border-primary bg-primary/5"
                />
              )}
              <Icon
                className={cn(
                  "size-4",
                  selected ? "text-primary" : "text-muted-foreground",
                )}
              />
              {label}
            </button>
          );
        })}
      </div>
    </>
  );
}

function AccentPanel() {
  const { accent, setAccent } = useCustomTheme();

  return (
    <>
      <SectionLabel>Warna Perusahaan</SectionLabel>
      <div className="grid grid-cols-2 gap-1.5">
        {companyThemes.map((t) => {
          const selected = accent === t.name;
          return (
            <button
              key={t.name}
              type="button"
              onClick={() => setAccent(t.name)}
              className="relative isolate flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm transition-colors hover:bg-accent"
            >
              {selected && (
                <SelectedIndicator
                  name="appearance-accent"
                  className="rounded-lg border border-primary bg-primary/5"
                />
              )}
              <span
                className="size-5 shrink-0 rounded-full border"
                style={{ backgroundColor: t.color }}
              />
              <span className="font-semibold">{t.label}</span>
              {selected && <Check className="ml-auto size-4" />}
            </button>
          );
        })}
      </div>

      <div className="my-3 h-px bg-border" />

      <SectionLabel>Warna Umum</SectionLabel>
      <div className="grid grid-cols-4 gap-1">
        {generalThemes.map((t) => {
          const selected = accent === t.name;
          return (
            <button
              key={t.name}
              type="button"
              onClick={() => setAccent(t.name)}
              title={t.label}
              className="relative isolate flex flex-col items-center gap-1 rounded-md px-1 py-1.5 transition-colors hover:bg-accent"
            >
              {selected && (
                <SelectedIndicator
                  name="appearance-accent"
                  className="rounded-md bg-accent"
                />
              )}
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border",
                  selected && "ring-2 ring-offset-2 ring-offset-background",
                )}
                style={
                  {
                    backgroundColor: t.color,
                    "--tw-ring-color": t.color,
                  } as React.CSSProperties
                }
              >
                {selected && <Check className="size-3.5 text-white" />}
              </span>
              <span className="w-full truncate text-center text-[11px] leading-tight">
                {t.name === "zinc" ? "Default" : t.label}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

export function TopbarAppearance() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <TopbarIconButton label="Pengaturan tampilan">
          <Palette />
        </TopbarIconButton>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={8}
        className="max-h-[calc(100dvh-6rem)] w-[min(20rem,calc(100vw-1rem))] overflow-y-auto p-0"
      >
        <Tabs defaultValue="theme" className="gap-0">
          <div className="border-b p-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="theme">Tema</TabsTrigger>
              <TabsTrigger value="accent">Aksen</TabsTrigger>
              <TabsTrigger value="font">Font</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent
            value="theme"
            className="mt-0 p-3 animate-in fade-in-0 duration-200"
          >
            <ThemePanel />
          </TabsContent>
          <TabsContent
            value="accent"
            className="mt-0 p-3 animate-in fade-in-0 duration-200"
          >
            <AccentPanel />
          </TabsContent>
          <TabsContent
            value="font"
            className="mt-0 p-3 animate-in fade-in-0 duration-200"
          >
            <FontSettingsPanel />
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
