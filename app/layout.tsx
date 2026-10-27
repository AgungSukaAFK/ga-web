import type { Metadata } from "next";
import { CustomThemeProvider } from "@/lib/theme-provider";
import { PwaSupport } from "@/components/pwa/pwa-support";
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
  // Mode standalone di iOS (dibuka dari ikon home screen): judul di bawah
  // ikon + status bar biasa (konten mulai di bawah status bar, jadi header
  // sticky tidak perlu padding safe-area).
  appleWebApp: {
    capable: true,
    title: "Garuda Procure",
    statusBarStyle: "default",
  },
};

// Warna status bar HP / title bar PWA = background tema. Nilai di sini
// dipakai saat first paint (ikut tema sistem); setelah hydrate ditimpa
// <PwaSupport /> (ThemeColorSync) supaya ikut tema pilihan user.
export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#18181b" },
  ],
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
        {/* content flex-1: tombol Salin (lib/toast.tsx) & action rapat ke
            kanan, tidak mengambang di tengah */}
        <Toaster
          richColors
          closeButton
          position="bottom-right"
          toastOptions={{
            closeButtonAriaLabel: "Tutup",
            classNames: { content: "flex-1" },
          }}
        />
        <PwaSupport />
      </body>
    </html>
  );
}
