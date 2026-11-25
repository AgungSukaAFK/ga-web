import type { MetadataRoute } from "next";
import { IS_INDEXABLE_DEPLOYMENT, SITE_URL } from "@/lib/seo";

// Halaman privat sengaja TIDAK di-disallow: crawler harus bisa membukanya
// untuk melihat noindex. URL yang di-disallow masih bisa muncul di Google
// (tanpa isi) kalau ada yang menautkannya.
export default function robots(): MetadataRoute.Robots {
  if (!IS_INDEXABLE_DEPLOYMENT) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
