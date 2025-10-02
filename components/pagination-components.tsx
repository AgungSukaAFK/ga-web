// src/components/pagination-component.tsx

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import Link from "next/link";

interface PaginationComponentProps {
  currentPage: number;
  totalPages: number;
  basePath: string;
  limit: number;
}

export function PaginationComponent({
  currentPage,
  totalPages,
  basePath,
  limit,
}: PaginationComponentProps) {
  if (totalPages <= 1) {
    return null;
  }

  const generatePageLink = (page: number) => {
    return `${basePath}?page=${page}&limit=${limit}`;
  };

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
        {currentPage > 1 && (
          <PaginationItem>
            <PaginationPrevious>
              <Link href={generatePageLink(currentPage - 1)}>Previous</Link>
            </PaginationPrevious>
          </PaginationItem>
        )}

        {startPage > 1 && (
          <>
            <PaginationItem>
              <PaginationLink>
                <Link href={generatePageLink(1)}>1</Link>
              </PaginationLink>
            </PaginationItem>
            {startPage > 2 && <PaginationEllipsis />}
          </>
        )}

        {pagesToRender.map((page) => (
          <PaginationItem key={page}>
            <PaginationLink isActive={page === currentPage}>
              <Link href={generatePageLink(page)}>{page}</Link>
            </PaginationLink>
          </PaginationItem>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <PaginationEllipsis />}
            <PaginationItem>
              <PaginationLink>
                <Link href={generatePageLink(totalPages)}>{totalPages}</Link>
              </PaginationLink>
            </PaginationItem>
          </>
        )}

        {currentPage < totalPages && (
          <PaginationItem>
            <PaginationNext>
              <Link href={generatePageLink(currentPage + 1)}>Next</Link>
            </PaginationNext>
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
}
