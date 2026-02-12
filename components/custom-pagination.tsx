// src/components/custom-pagination.tsx

import * as React from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface CustomPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
}

export function CustomPagination({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
}: CustomPaginationProps) {
  // --- Helper: Generate Array of Page Numbers ---
  const generatePagination = () => {
    // Jika total halaman sedikit, tampilkan semua
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPages - 2;

    const firstPageIndex = 1;
    const lastPageIndex = totalPages;

    // Case 1: No left dots, but right dots
    if (!shouldShowLeftDots && shouldShowRightDots) {
      const leftItemCount = 3 + 2 * siblingCount;
      const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
      return [...leftRange, "DOTS", lastPageIndex];
    }

    // Case 2: No right dots, but left dots
    if (shouldShowLeftDots && !shouldShowRightDots) {
      const rightItemCount = 3 + 2 * siblingCount;
      const rightRange = Array.from(
        { length: rightItemCount },
        (_, i) => totalPages - rightItemCount + i + 1,
      );
      return [firstPageIndex, "DOTS", ...rightRange];
    }

    // Case 3: Both dots
    if (shouldShowLeftDots && shouldShowRightDots) {
      const middleRange = Array.from(
        { length: rightSiblingIndex - leftSiblingIndex + 1 },
        (_, i) => leftSiblingIndex + i,
      );
      return [firstPageIndex, "DOTS", ...middleRange, "DOTS", lastPageIndex];
    }

    return [];
  };

  const pages = generatePagination();

  // --- Handlers ---
  const handlePageClick = (e: React.MouseEvent, page: number) => {
    e.preventDefault(); // Mencegah reload/navigasi href
    if (page > 0 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  if (totalPages <= 1) return null;

  return (
    <Pagination>
      <PaginationContent>
        {/* Tombol Previous */}
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={(e) => handlePageClick(e, currentPage - 1)}
            className={
              currentPage <= 1
                ? "pointer-events-none opacity-50"
                : "cursor-pointer"
            }
          />
        </PaginationItem>

        {/* Angka Halaman */}
        {pages.map((page, idx) => {
          if (page === "DOTS") {
            return (
              <PaginationItem key={`dots-${idx}`}>
                <PaginationEllipsis />
              </PaginationItem>
            );
          }

          return (
            <PaginationItem key={idx}>
              <PaginationLink
                href="#"
                isActive={page === currentPage}
                onClick={(e) => handlePageClick(e, Number(page))}
                className="cursor-pointer"
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          );
        })}

        {/* Tombol Next */}
        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={(e) => handlePageClick(e, currentPage + 1)}
            className={
              currentPage >= totalPages
                ? "pointer-events-none opacity-50"
                : "cursor-pointer"
            }
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
