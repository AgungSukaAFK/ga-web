import Image from "next/image";
import { COMPANY_DETAILS } from "@/lib/companyDetails";
import { cn } from "@/lib/utils";

// Logo perusahaan pemilik dokumen (GMI/GIS) - bantu akun LOURDES, yang bisa
// lihat dokumen kedua perusahaan sekaligus, membedakan milik siapa sekilas
// pandang. Ukuran width/height = ukuran asli file, supaya aspek rasio terjaga.
// Versi landscape sudah punya stroke putih bawaan (gis-landscape,
// gmi-landscape-stroke), jadi tetap terbaca di dark mode tanpa latar putih.
const COMPANY_LOGOS = {
  GMI: {
    square: { src: "/gmi-logo.webp", width: 150, height: 150 },
    landscape: {
      src: "/gmi-landscape-stroke.webp",
      width: 1098,
      height: 148,
      // Rasio ~7:1 (jauh lebih lebar dari GIS) - dibuat lebih pendek
      // supaya bobot visual kedua logo kurang lebih setara.
      className: "max-h-10",
    },
  },
  GIS: {
    square: { src: "/gis-logo.webp", width: 1464, height: 1667 },
    landscape: {
      src: "/gis-landscape.webp",
      width: 1080,
      height: 261,
      className: "max-h-12",
    },
  },
} as const;

// Logo kotak belum punya stroke putih bawaan - outline putih tipis lewat
// drop-shadow 4 arah, supaya bagian hitam/navy-nya tetap terbaca di dark
// mode (di light mode outline putih ini tidak kelihatan).
const WHITE_OUTLINE =
  "[filter:drop-shadow(1px_0_0_#fff)_drop-shadow(-1px_0_0_#fff)_drop-shadow(0_1px_0_#fff)_drop-shadow(0_-1px_0_#fff)]";

type LogoCompany = keyof typeof COMPANY_LOGOS;

const isLogoCompany = (code?: string | null): code is LogoCompany =>
  !!code && code in COMPANY_LOGOS;

/**
 * Logo kotak saat ruang sempit (HP, tablet portrait, atau tablet landscape
 * yang kepotong sidebar), logo landscape saat lebar (laptop/tablet lebar).
 * Patokannya lebar area konten (>= 60rem ~ laptop 1280 + sidebar terbuka),
 * BUKAN lebar layar - jadi salah satu ancestor WAJIB punya class
 * `@container`. Taruh langsung di dalam baris flex: logo landscape cuma
 * mengisi sisa ruang kosong (flex-1 + contain-inline-size, jadi lebar
 * aslinya tidak ikut dihitung & tidak mendorong tombol di sebelahnya
 * sampai turun baris).
 *
 * Kode selain GMI/GIS (mis. LOURDES) tidak merender apa-apa.
 */
export function CompanyLogoBadge({
  companyCode,
  className,
}: {
  companyCode?: string | null;
  className?: string;
}) {
  if (!isLogoCompany(companyCode)) return null;

  const { square, landscape } = COMPANY_LOGOS[companyCode];
  const alt = `Logo ${COMPANY_DETAILS[companyCode].name}`;

  return (
    <>
      <Image
        src={square.src}
        alt={alt}
        width={square.width}
        height={square.height}
        className={cn(
          "size-11 shrink-0 object-contain md:size-14 @min-[60rem]:hidden",
          WHITE_OUTLINE,
          className,
        )}
      />
      <div
        className={cn(
          "hidden min-w-40 flex-1 items-center contain-inline-size @min-[60rem]:flex",
          className,
        )}
      >
        <Image
          src={landscape.src}
          alt={alt}
          width={landscape.width}
          height={landscape.height}
          className={cn("h-auto w-auto max-w-full", landscape.className)}
        />
      </div>
    </>
  );
}
