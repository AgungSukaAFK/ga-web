import type { Metadata } from "next";

// Noindex diwarisi dari app/layout.tsx.
export const metadata: Metadata = { title: "Menunggu Verifikasi Akun" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
