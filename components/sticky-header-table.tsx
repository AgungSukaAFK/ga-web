"use client";

// Tabel yang header-nya tetap terlihat di bawah topbar saat halaman discroll.
// Tabel ada di dalam container `overflow-x-auto`, jadi `position: sticky` di
// <th> cuma menempel ke container itu. Karena itu header dirender di elemen
// sticky terpisah di luar container, tepat menimpa <thead> asli yang
// disembunyikan (tetap jadi acuan lebar kolom & dipakai saat print).
//
// Posisi vertikal sepenuhnya CSS supaya header tidak goyang saat scroll. JS
// cuma menyamakan lebar kolom & scroll horizontal.

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { Table, TableHeader } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Props = {
  // Isi <thead>, dirender dua kali (header sticky & <thead> asli).
  header: React.ReactNode;
  // <TableBody>.
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
};

export function StickyHeaderTable({
  header,
  children,
  className,
  containerClassName,
}: Props) {
  const stickyRef = useRef<HTMLDivElement>(null);
  const headScrollRef = useRef<HTMLDivElement>(null);
  const headTableRef = useRef<HTMLTableElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bodyTableRef = useRef<HTMLTableElement>(null);

  const syncLayout = useCallback(() => {
    const headScroll = headScrollRef.current;
    const headTable = headTableRef.current;
    const container = containerRef.current;
    const bodyTable = bodyTableRef.current;
    if (!headScroll || !headTable || !container || !bodyTable) return;

    headTable.style.width = `${bodyTable.getBoundingClientRect().width}px`;
    const headCells = headTable.tHead?.rows[0]?.cells;
    const bodyCells = bodyTable.tHead?.rows[0]?.cells;
    if (headCells && bodyCells) {
      Array.from(headCells).forEach((cell, i) => {
        const width = bodyCells[i]?.getBoundingClientRect().width;
        if (width) cell.style.width = `${width}px`;
      });
    }

    // Tarik tabel ke atas supaya header sticky menimpa <thead> asli. Jangan
    // pakai margin-bottom di elemen sticky: header jadi lewat dari akhir tabel.
    container.style.marginTop = `-${headScroll.offsetHeight}px`;
  }, []);

  // Tanpa deps: lebar kolom bisa berubah tiap data / urutan kolom berganti.
  useLayoutEffect(syncLayout);

  useEffect(() => {
    const sticky = stickyRef.current;
    const headScroll = headScrollRef.current;
    const bodyTable = bodyTableRef.current;
    const bodyScroll = bodyTable?.parentElement;
    if (!sticky || !headScroll || !bodyTable || !bodyScroll) return;

    const topbar = document.querySelector<HTMLElement>("[data-app-topbar]");
    const syncTop = () => {
      sticky.style.top = `${topbar?.offsetHeight ?? 0}px`;
    };
    syncTop();

    // Sinkron satu arah saja: kalau header ikut menulis balik ke tabel, event
    // yang telat satu frame menarik tabel mundur dan scroll-nya patah-patah.
    const syncHeadScroll = () => {
      headScroll.scrollLeft = bodyScroll.scrollLeft;
    };
    // Header overflow-hidden, jadi gestur di atasnya diteruskan ke tabel.
    const forwardWheel = (e: WheelEvent) => {
      bodyScroll.scrollLeft += e.deltaX || (e.shiftKey ? e.deltaY : 0);
    };
    syncHeadScroll();
    bodyScroll.addEventListener("scroll", syncHeadScroll, { passive: true });
    headScroll.addEventListener("wheel", forwardWheel, { passive: true });

    const observer = new ResizeObserver(() => {
      syncTop();
      syncLayout();
    });
    observer.observe(bodyTable);
    if (topbar) observer.observe(topbar);

    return () => {
      bodyScroll.removeEventListener("scroll", syncHeadScroll);
      headScroll.removeEventListener("wheel", forwardWheel);
      observer.disconnect();
    };
  }, [syncLayout]);

  return (
    <div>
      {/* pt-2 = jarak dari topbar. Background solid menutup baris yang lewat
          di celah itu; -mt-2 mengimbanginya saat header belum menempel. */}
      <div ref={stickyRef} className="no-print sticky z-30 -mt-2 bg-card pt-2">
        <div
          ref={headScrollRef}
          className="overflow-hidden rounded-t-md border-x border-t"
        >
          <table
            ref={headTableRef}
            className="table-fixed caption-bottom text-sm"
          >
            <TableHeader className="[&_th]:bg-muted">{header}</TableHeader>
          </table>
        </div>
      </div>
      <div
        ref={containerRef}
        className={cn("print:!mt-0", containerClassName)}
      >
        <Table ref={bodyTableRef} className={className}>
          <TableHeader className="[&_th]:invisible print:[&_th]:visible">
            {header}
          </TableHeader>
          {children}
        </Table>
      </div>
    </div>
  );
}
