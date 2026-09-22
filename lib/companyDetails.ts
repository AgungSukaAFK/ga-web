// src/lib/companyDetails.ts
//
// Data branding perusahaan (nama/logo/alamat/telepon/email) dipakai buat
// kop dokumen cetak - awalnya cuma didefinisikan di
// purchase-order/[id]/page.tsx (PrintablePO/PrintableBAST), diekstrak ke
// sini supaya dokumen cetak Petty Cash (PrintablePettyCashDocument,
// components/petty-cash/) bisa reuse tanpa mendefinisikan ulang data yang
// sama. Purchase Order tetap import dari sini (bukan lagi definisi lokal).

export const COMPANY_DETAILS = {
  GMI: {
    name: "PT. Garuda Mart Indonesia",
    logo: "/gmi-logo.webp",
    address: "Sakura Regency Blok J5-8A, Jatiasih, Bekasi 17423 - Indonesia",
    phone: "(021) 824-073-09",
    email: "info@garudamart.com",
  },
  GIS: {
    name: "PT. Global Inti Sejati",
    logo: "/gis-logo.webp",
    address:
      "Jl. Wibawa Mukti II No.88, RT.003/RW.001, Jatiluhur, Kec. Jatiasih, Kota Bks, Jawa Barat 17425",
    phone: "(021) 82-741-900 ",
    email: "info@globalinti.com",
  },
  LOURDES: {
    name: "Lourdes Auto Parts",
    logo: "/lourdes-logo.webp",
    address: "Sakura Regency J5-8A, Jati Asih, Bekasi 17423",
    phone: "(+021) 82407309",
    email: "info@garudamart.com",
  },
  DEFAULT: {
    name: "Nama Perusahaan Default",
    logo: "/lourdes-logo.webp",
    address: "Alamat Default",
    phone: "Telepon Default",
    email: "email@default.com",
  },
};

export type CompanyDetailsKey = keyof typeof COMPANY_DETAILS;

/** Ambil detail company dari kode bebas (mis. `company_code` dokumen) - jatuh ke DEFAULT kalau tidak dikenal. */
export const getCompanyDetails = (companyCode?: string | null) =>
  COMPANY_DETAILS[(companyCode as CompanyDetailsKey) || "DEFAULT"] ||
  COMPANY_DETAILS.DEFAULT;

// Tunggu logo benar-benar selesai di-decode browser sebelum window.print()
// dipanggil - preload di mount cuma menjamin BYTE-nya sudah di-cache, bukan
// berarti <img> yang baru di-mount di dokumen cetak sudah selesai decode +
// paint (itu proses async terpisah). Kalau window.print() kepanggil duluan,
// logo bisa nge-print blank/kosong. img.decode() resolve begitu bitmap-nya
// beneran siap ditampilkan, jadi jauh lebih pasti dibanding nebak jumlah
// frame (requestAnimationFrame) yang cukup.
export async function waitForLogoReady(src: string) {
  try {
    const img = new window.Image();
    img.src = src;
    if (img.decode) {
      await img.decode();
    } else if (!img.complete) {
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    }
  } catch {
    // Gagal decode (mis. src rusak) - biarkan window.print() tetap jalan,
    // lebih baik cetak tanpa logo daripada macet total.
  }
}
