import { COMPANY_DETAILS } from "@/lib/companyDetails";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";

// JSON-LD schema.org untuk landing page. Hanya berisi fakta yang memang ada
// di app - jangan tambah rating/harga/FAQ yang tidak tampil di halaman.
const DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: COMPANY_DETAILS.GMI.name,
      logo: `${SITE_URL}${COMPANY_DETAILS.GMI.logo}`,
      email: COMPANY_DETAILS.GMI.email,
      address: {
        "@type": "PostalAddress",
        streetAddress: "Sakura Regency Blok J5-8A, Jatiasih",
        addressLocality: "Bekasi",
        postalCode: "17423",
        addressCountry: "ID",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "id-ID",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#app`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, Android, iOS",
      inLanguage: "id-ID",
      screenshot: `${SITE_URL}/landing/dashboard-light.webp`,
      provider: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export function LandingStructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(DATA).replace(/</g, "\\u003c"),
      }}
    />
  );
}
