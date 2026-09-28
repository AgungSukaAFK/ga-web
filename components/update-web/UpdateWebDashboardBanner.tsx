// src/components/update-web/UpdateWebDashboardBanner.tsx
//
// Widget kecil di Dashboard yang "minta diklik" kalau ada postingan Update
// Web baru (belum dilihat, dalam 7 hari terakhir - lihat
// hooks/use-update-web-badge.ts, sumber "baru"-nya SAMA dgn badge merah di
// sidebar, supaya konsisten). Sengaja kecil (bukan full-width Content kayak
// panel lain di Dashboard) & animasinya cuma nge-"denyut" beberapa detik
// sekali (bukan kedip/geter terus-terusan) supaya menarik perhatian tanpa
// ganggu. Hilang otomatis begitu diklik (navigasi ke /update-web memicu
// markSeen lewat halaman itu sendiri) atau kalau sudah pernah dilihat/lewat
// 7 hari.

"use client";

import Link from "next/link";
import { Megaphone, ArrowRight } from "lucide-react";
import { useUpdateWebBadge } from "@/hooks/use-update-web-badge";

interface UpdateWebDashboardBannerProps {
  userId: string | null | undefined;
}

export function UpdateWebDashboardBanner({
  userId,
}: UpdateWebDashboardBannerProps) {
  const { latestPost, isNew, loading } = useUpdateWebBadge(userId);

  if (loading || !isNew || !latestPost) return null;

  return (
    <div className="col-span-12 sm:col-span-6 lg:col-span-4">
      <style>{`
        @keyframes update-web-banner-attention {
          0%, 88% { transform: rotate(0deg); }
          90% { transform: rotate(-8deg); }
          92% { transform: rotate(7deg); }
          94% { transform: rotate(-5deg); }
          96% { transform: rotate(3deg); }
          98%, 100% { transform: rotate(0deg); }
        }
        @keyframes update-web-banner-ring {
          0%, 85% { box-shadow: 0 0 0 0 rgba(99,102,241,0.35); }
          100% { box-shadow: 0 0 0 10px rgba(99,102,241,0); }
        }
        .update-web-banner-icon {
          animation: update-web-banner-attention 4s ease-in-out infinite;
        }
        .update-web-banner-ring {
          animation: update-web-banner-ring 2.4s ease-out infinite;
        }
      `}</style>
      <Link
        href="/update-web"
        className="update-web-banner-ring group flex items-center gap-3 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-3 transition-colors hover:border-primary/60 hover:from-primary/15"
      >
        <div className="update-web-banner-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Megaphone className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-primary">
            Ada update baru! v{latestPost.version}
          </p>
          <p className="truncate text-sm font-medium">{latestPost.title}</p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
