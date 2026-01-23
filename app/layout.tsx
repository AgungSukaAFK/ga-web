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
