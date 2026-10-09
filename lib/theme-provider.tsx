"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  ThemeProvider as NextThemesProvider,
  ThemeProviderProps,
} from "next-themes";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  FONT_FAMILY_STORAGE_KEY,
  FONT_SIZE_STORAGE_KEY,
  fontFamilies,
  fontSizes,
  type FontFamily,
  type FontSize,
} from "@/lib/font-options";

// Definisikan tema aksen yang tersedia (sesuai CSS .theme-<name> di
// globals.css). `color` = warna primary mode terang, dipakai untuk preview
// swatch di AccentThemeSwitcher. `group: "company"` = warna khusus
// perusahaan, ditampilkan terpisah di atas.
export const accentThemes = [
  { name: "gmi", label: "GMI", color: "#242365", group: "company" },
  { name: "gis", label: "GIS", color: "rgb(23 88 49)", group: "company" },
  { name: "zinc", label: "Zinc (Default)", color: "hsl(240 5.9% 10%)", group: "general" },
  { name: "blue", label: "Blue", color: "hsl(217.2 91.2% 59.8%)", group: "general" },
  { name: "sky", label: "Sky", color: "hsl(200.4 98% 39.4%)", group: "general" },
  { name: "cyan", label: "Cyan", color: "hsl(191.6 91.4% 36.5%)", group: "general" },
  { name: "teal", label: "Teal", color: "hsl(174.7 83.9% 31.6%)", group: "general" },
  { name: "emerald", label: "Emerald", color: "hsl(161.4 93.5% 30.4%)", group: "general" },
  { name: "green", label: "Green", color: "hsl(142.1 76.2% 36.3%)", group: "general" },
  { name: "amber", label: "Amber", color: "hsl(37.7 92.1% 50.2%)", group: "general" },
  { name: "orange", label: "Orange", color: "hsl(20.5 90.2% 48.2%)", group: "general" },
  { name: "red", label: "Red", color: "hsl(0 72.2% 50.6%)", group: "general" },
  { name: "rose", label: "Rose", color: "hsl(346.8 77.2% 49.8%)", group: "general" },
  { name: "pink", label: "Pink", color: "hsl(333.3 71.4% 50.6%)", group: "general" },
  { name: "fuchsia", label: "Fuchsia", color: "hsl(292.2 84.1% 60.6%)", group: "general" },
  { name: "purple", label: "Purple", color: "hsl(271.5 81.3% 55.9%)", group: "general" },
  { name: "violet", label: "Violet", color: "hsl(262.1 83.3% 57.8%)", group: "general" },
  { name: "indigo", label: "Indigo", color: "hsl(243.4 75.4% 58.6%)", group: "general" },
] as const;

type AccentTheme = (typeof accentThemes)[number]["name"];

interface CustomThemeContextType {
  accent: AccentTheme;
  setAccent: (accent: AccentTheme) => void;
  fontFamily: FontFamily;
  setFontFamily: (font: FontFamily) => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
}

// Konteks untuk menyimpan tema aksen
const CustomThemeContext = createContext<CustomThemeContextType | undefined>(
  undefined
);

export function CustomThemeProvider({
  children,
  ...props
}: ThemeProviderProps) {
  const [accent, setAccent] = useState<AccentTheme>("zinc"); // Default ke zinc
  // null = belum dibaca dari localStorage, supaya nilai yang sudah dipasang
  // script anti-flash (lib/font-options.ts) tidak tertimpa default dulu.
  const [fontFamily, setFontFamily] = useState<FontFamily | null>(null);
  const [fontSize, setFontSize] = useState<FontSize | null>(null);

  // Saat komponen dimuat, cek local storage untuk tema aksen yang disimpan
  useEffect(() => {
    const storedAccent = localStorage.getItem("accent-theme") as AccentTheme;
    if (storedAccent && accentThemes.find((t) => t.name === storedAccent)) {
      setAccent(storedAccent);
    }

    const storedFont = localStorage.getItem(FONT_FAMILY_STORAGE_KEY);
    setFontFamily(
      fontFamilies.find((f) => f.name === storedFont)?.name ??
        DEFAULT_FONT_FAMILY,
    );
    const storedSize = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    setFontSize(
      fontSizes.find((s) => s.name === storedSize)?.name ?? DEFAULT_FONT_SIZE,
    );
  }, []);

  // Terapkan font & ukuran ke <html> (dipetakan di globals.css)
  useEffect(() => {
    if (!fontFamily) return;
    const root = window.document.documentElement;
    if (fontFamily === DEFAULT_FONT_FAMILY) delete root.dataset.font;
    else root.dataset.font = fontFamily;
    localStorage.setItem(FONT_FAMILY_STORAGE_KEY, fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    if (!fontSize) return;
    const root = window.document.documentElement;
    if (fontSize === DEFAULT_FONT_SIZE) delete root.dataset.fontSize;
    else root.dataset.fontSize = fontSize;
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, fontSize);
  }, [fontSize]);

  // Saat tema aksen berubah, terapkan kelas CSS ke tag <html>
  useEffect(() => {
    const root = window.document.documentElement;

    // Hapus semua kelas tema aksen yang lama
    accentThemes.forEach((theme) => {
      root.classList.remove(`theme-${theme.name}`);
    });

    // Tambahkan kelas tema aksen yang baru (kecuali jika 'zinc' default)
    if (accent !== "zinc") {
      root.classList.add(`theme-${accent}`);
    }

    // Simpan pilihan ke local storage
    localStorage.setItem("accent-theme", accent);
  }, [accent]);

  return (
    <CustomThemeContext.Provider
      value={{
        accent,
        setAccent,
        fontFamily: fontFamily ?? DEFAULT_FONT_FAMILY,
        setFontFamily,
        fontSize: fontSize ?? DEFAULT_FONT_SIZE,
        setFontSize,
      }}
    >
      <NextThemesProvider {...props}>{children}</NextThemesProvider>
    </CustomThemeContext.Provider>
  );
}

// Hook kustom untuk mempermudah penggunaan konteks tema aksen
export const useCustomTheme = () => {
  const context = useContext(CustomThemeContext);
  if (context === undefined) {
    throw new Error("useCustomTheme must be used within a CustomThemeProvider");
  }
  return context;
};
