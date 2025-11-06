"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  ThemeProvider as NextThemesProvider,
  ThemeProviderProps,
} from "next-themes";

// Definisikan tema aksen yang tersedia (sesuai CSS di globals.css)
export const accentThemes = [
  { name: "zinc", label: "Zinc (Default)" },
  { name: "blue", label: "Blue" },
  { name: "rose", label: "Rose" },
  { name: "green", label: "Green" },
];

type AccentTheme = (typeof accentThemes)[number]["name"];

interface CustomThemeContextType {
  accent: AccentTheme;
  setAccent: (accent: AccentTheme) => void;
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

  // Saat komponen dimuat, cek local storage untuk tema aksen yang disimpan
  useEffect(() => {
    const storedAccent = localStorage.getItem("accent-theme") as AccentTheme;
    if (storedAccent && accentThemes.find((t) => t.name === storedAccent)) {
      setAccent(storedAccent);
    }
  }, []);

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
    <CustomThemeContext.Provider value={{ accent, setAccent }}>
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
