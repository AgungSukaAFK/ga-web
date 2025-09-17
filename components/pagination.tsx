import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

// Tentukan props yang dibutuhkan untuk komponen pagination
interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  basePath: string; // Contoh: "/dashboard/barang"
}

export function PaginationComponent({
  currentPage,
  totalItems,
  itemsPerPage,
  basePath,
}: PaginationProps) {
  // Hitung total halaman berdasarkan total item
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Jika hanya ada satu halaman atau kurang, jangan tampilkan pagination
  if (totalPages <= 1) {
    return null;
  }

  // Tentukan halaman yang akan ditampilkan, dengan maksimal 5 halaman terlihat
  const visiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(visiblePages / 2));
  const endPage = Math.min(totalPages, startPage + visiblePages - 1);

  if (endPage - startPage + 1 < visiblePages) {
    startPage = Math.max(1, endPage - visiblePages + 1);
  }

  const pagesToRender = Array.from(
    { length: endPage - startPage + 1 },
    (_, i) => startPage + i
  );

  return (
    <Pagination>
      <PaginationContent>
        {/* Tombol Halaman Sebelumnya */}
        <PaginationItem>
          {currentPage > 1 ? (
            <PaginationPrevious href={`${basePath}?page=${currentPage - 1}`} />
          ) : (
            <PaginationPrevious href="#" aria-disabled="true" tabIndex={-1} />
          )}
        </PaginationItem>

        {/* Tampilkan Ellipsis di awal jika halaman tidak dimulai dari 1 */}
        {startPage > 1 && (
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        )}

        {/* Render nomor-nomor halaman */}
        {pagesToRender.map((page) => (
          <PaginationItem key={page}>
            <PaginationLink
              href={`${basePath}?page=${page}`}
              isActive={page === currentPage}
            >
              {page}
            </PaginationLink>
          </PaginationItem>
        ))}

        {/* Tampilkan Ellipsis di akhir jika belum sampai halaman terakhir */}
        {endPage < totalPages && (
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        )}

        {/* Tombol Halaman Berikutnya */}
        <PaginationItem>
          {currentPage < totalPages ? (
            <PaginationNext href={`${basePath}?page=${currentPage + 1}`} />
          ) : (
            <PaginationNext href="#" aria-disabled="true" tabIndex={-1} />
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
