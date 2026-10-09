import type { Metadata } from "next";
import { CustomThemeProvider } from "@/lib/theme-provider";
import { fontVariables } from "@/lib/fonts";
import { fontInitScript } from "@/lib/font-options";
import "./globals.css";
import { Toaster } from "sonner";
import { NotificationProvider } from "@/components/providers/NotificationProvider";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Garuda Procure",
  description: "Sistem Manajemen MR & PO - PT. Garuda Mart Indonesia",
  // manifest + icons dibutuhkan supaya "Add to Home Screen" di HP jalan
  // (syarat Web Push tetap masuk walau browser ditutup, terutama di
  // iOS/Safari - lihat lib/notifications/push.ts).
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    // iOS belum support SVG untuk apple-touch-icon, tetap pakai PNG
    apple: "/icons/icon-192.png",
  },
};

export const viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        {/* Terapkan font & ukuran font tersimpan sebelum render (anti-flash) */}
        <script dangerouslySetInnerHTML={{ __html: fontInitScript }} />
      </head>
      <body className="antialiased">
        {/* REVISI: Gunakan CustomThemeProvider */}
        <CustomThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          themes={["light", "dark", "soft-light", "soft-dark"]}
          disableTransitionOnChange
        >
          <NotificationProvider>{children}</NotificationProvider>
        </CustomThemeProvider>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
