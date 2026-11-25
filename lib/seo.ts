// lib/seo.ts
//
// Sumber tunggal konfigurasi SEO (metadata, robots.txt, sitemap, JSON-LD).
//
// Prinsip: app internal, jadi DEFAULT-nya noindex (lihat app/layout.tsx).
// Halaman yang boleh muncul di Google harus opt-in lewat publicPageMetadata()
// dan didaftarkan di PUBLIC_PAGES (sitemap).

import type { Metadata } from "next";

// URL kanonik. JANGAN pakai VERCEL_URL: itu URL unik per deployment, bikin
// canonical & gambar share menunjuk ke deployment lama.
// VERCEL_PROJECT_PRODUCTION_URL = domain production project (diisi Vercel).
function resolveSiteUrl() {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "http://localhost:3000";
  return new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`).origin;
}

export const SITE_URL = resolveSiteUrl();
export const SITE_NAME = "Garuda Procure";
export const SITE_TITLE =
  "Garuda Procure: Sistem Pengadaan, PO & Petty Cash";
export const SITE_DESCRIPTION =
  "Sistem Material Request, Purchase Order & Petty Cash dengan approval berjenjang untuk Lourdes Auto Parts, PT. Garuda Mart Indonesia & PT. Global Inti Sejati.";

// Deployment preview Vercel tidak boleh ikut terindeks (konten duplikat).
export const IS_INDEXABLE_DEPLOYMENT =
  !process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production";

/** Path yang boleh diindeks - dipakai app/sitemap.ts. */
export const PUBLIC_PAGES = ["/", "/auth/login"];

export const OG_IMAGE = {
  url: "/og.jpg",
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "Garuda Procure: pengadaan & petty cash, rapi dalam satu sistem",
};

export const NOINDEX: Metadata["robots"] = { index: false, follow: false };

/** Metadata lengkap untuk halaman yang boleh diindeks. */
export function publicPageMetadata({
  path,
  title,
  absoluteTitle,
  description,
}: {
  path: string;
  title: string;
  /** true = judul dipakai apa adanya, tanpa akhiran "· Garuda Procure". */
  absoluteTitle?: boolean;
  description: string;
}): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} · ${SITE_NAME}`;
  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: path },
    robots: IS_INDEXABLE_DEPLOYMENT
      ? {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
          },
        }
      : NOINDEX,
    openGraph: {
      type: "website",
      locale: "id_ID",
      siteName: SITE_NAME,
      url: path,
      title: fullTitle,
      description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [OG_IMAGE],
    },
  };
}
