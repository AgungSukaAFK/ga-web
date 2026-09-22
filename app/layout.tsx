import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { CustomThemeProvider } from "@/lib/theme-provider";
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
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport = {
  themeColor: "#0f172a",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        {/* REVISI: Gunakan CustomThemeProvider */}
        <CustomThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NotificationProvider>{children}</NotificationProvider>
        </CustomThemeProvider>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
