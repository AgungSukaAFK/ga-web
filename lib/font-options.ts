// Opsi font & ukuran font yang bisa dipilih user (lihat FontSettings).
// Dipisah dari theme-provider.tsx (client module) supaya bisa dipakai juga
// di server component (layout.tsx) untuk script anti-flash.

// `preview` = font-family untuk contoh teks di menu. Penerapan ke seluruh
// app lewat html[data-font=<name>] di globals.css (variable dari lib/fonts.ts).
export const fontFamilies = [
  { name: "geist", label: "Geist (Default)", preview: "var(--font-geist-sans)" },
  { name: "inter", label: "Inter", preview: "var(--font-inter)" },
  { name: "jakarta", label: "Plus Jakarta Sans", preview: "var(--font-jakarta)" },
  { name: "poppins", label: "Poppins", preview: "var(--font-poppins)" },
  { name: "nunito", label: "Nunito", preview: "var(--font-nunito)" },
  { name: "roboto", label: "Roboto", preview: "var(--font-roboto)" },
  { name: "atkinson", label: "Atkinson Hyperlegible", preview: "var(--font-atkinson)" },
  { name: "system", label: "Font Sistem", preview: "system-ui, sans-serif" },
] as const;

// Ukuran dipasang sebagai font-size <html>, jadi semua ukuran berbasis rem
// (Tailwind) ikut membesar/mengecil.
export const fontSizes = [
  { name: "sm", label: "Kecil", scale: "87.5%" },
  { name: "md", label: "Menengah", scale: "100%" },
  { name: "lg", label: "Besar", scale: "112.5%" },
  { name: "xl", label: "Sangat Besar", scale: "125%" },
] as const;

export type FontFamily = (typeof fontFamilies)[number]["name"];
export type FontSize = (typeof fontSizes)[number]["name"];

export const DEFAULT_FONT_FAMILY: FontFamily = "geist";
export const DEFAULT_FONT_SIZE: FontSize = "md";
export const FONT_FAMILY_STORAGE_KEY = "font-family";
export const FONT_SIZE_STORAGE_KEY = "font-size";

// Dijalankan inline di <head> sebelum hydrate, supaya tidak ada kedipan
// font/ukuran default saat halaman pertama dimuat.
export const fontInitScript = `(function(){try{var d=document.documentElement;var f=localStorage.getItem(${JSON.stringify(
  FONT_FAMILY_STORAGE_KEY,
)});var s=localStorage.getItem(${JSON.stringify(
  FONT_SIZE_STORAGE_KEY,
)});if(f&&${JSON.stringify(fontFamilies.map((f) => f.name))}.indexOf(f)>-1)d.dataset.font=f;if(s&&${JSON.stringify(
  fontSizes.map((s) => s.name),
)}.indexOf(s)>-1)d.dataset.fontSize=s;}catch(e){}})();`;
