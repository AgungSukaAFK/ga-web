import { publicPageMetadata } from "@/lib/seo";

// page.tsx client component, jadi metadata ditaruh di layout. Canonical
// menyatukan semua varian /auth/login?next=... hasil redirect middleware.
export const metadata = publicPageMetadata({
  path: "/auth/login",
  title: "Masuk",
  description:
    "Masuk ke Garuda Procure dengan Email atau NRP untuk mengelola Material Request, Purchase Order, dan Petty Cash.",
});

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
