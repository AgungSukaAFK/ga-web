"use client";

// Pagination custom untuk dokumen cetak (PrintablePO/PrintableReceiveRecord/
// PrintableBAST) - browser TIDAK expose total jumlah halaman ke CSS print
// (beda dari software PDF khusus), jadi satu-satunya cara nampilin "Halaman
// X dari Y" yang akurat adalah kita hitung sendiri: render dulu semua baris
// di kontainer tersembunyi (di luar layar, TAPI tetap py-layout normal -
// bukan display:none - supaya getBoundingClientRect() bisa baca tinggi
// aslinya), lalu bagi baris-baris itu ke beberapa "halaman" berdasarkan
// tinggi asli yang terukur, baru render ulang sebagai beberapa blok
// id="printable-po-a4" terpisah (masing-masing punya kop+footer sendiri,
// dipisah page-break eksplisit) - bukan mengandalkan reflow otomatis
// browser lagi (itu sumber bug +1 halaman kosong yang sudah diperbaiki
// sebelumnya, lihat app/globals.css).
//
// PENTING: ukuran font/padding dokumen cetak SENGAJA tidak lagi digantung
// di `@media print` (globals.css) - harus jadi className biasa yang selalu
// aktif, supaya render pengukuran (yang terjadi di context layar biasa,
// BUKAN print) menghasilkan tinggi yang sama persis dengan hasil cetak
// sungguhan.

import {
  Fragment,
  ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

// 1mm = 96/25.4 px, referensi CSS absolute-unit standar (dipakai browser
// baik di layar maupun print - satu-satunya alasan pengukuran di layar
// biasa bisa dipercaya buat estimasi hasil cetak).
const MM_TO_PX = 96 / 25.4;
const A4_HEIGHT_MM = 297;
const PAGE_MARGIN_MM = 15; // samain sama @page margin di globals.css
const PAGE_CONTENT_HEIGHT_PX = (A4_HEIGHT_MM - PAGE_MARGIN_MM * 2) * MM_TO_PX;
// Cuma pakai ~90% dari budget teoretis - nyisain buffer buat perbedaan
// rendering kecil (sub-pixel font hinting dst) antara render pengukuran &
// cetak sungguhan, supaya gak pernah meluber ke halaman ekstra.
const SAFETY_RATIO = 0.9;

export interface PrintPage<T> {
  rows: T[];
  hasIntro: boolean;
  hasOutro: boolean;
}

interface UseMeasuredPaginationArgs<T> {
  rows: T[];
  enabled: boolean;
  hasIntro: boolean;
  hasOutro: boolean;
}

interface MeasureRefs {
  headerRef: React.RefObject<HTMLDivElement | null>;
  footerRef: React.RefObject<HTMLDivElement | null>;
  introRef: React.RefObject<HTMLDivElement | null>;
  outroRef: React.RefObject<HTMLDivElement | null>;
  rowRefs: React.MutableRefObject<(HTMLTableRowElement | null)[]>;
}

function useMeasuredPagination<T>({
  rows,
  enabled,
  hasIntro,
  hasOutro,
}: UseMeasuredPaginationArgs<T>): { pages: PrintPage<T>[] | null; refs: MeasureRefs } {
  const [pages, setPages] = useState<PrintPage<T>[] | null>(null);

  const headerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const outroRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  useLayoutEffect(() => {
    if (!enabled) {
      setPages(null);
      return;
    }

    const headerH = headerRef.current?.getBoundingClientRect().height ?? 0;
    const footerH = footerRef.current?.getBoundingClientRect().height ?? 0;
    const introH = hasIntro
      ? (introRef.current?.getBoundingClientRect().height ?? 0)
      : 0;
    const outroH = hasOutro
      ? (outroRef.current?.getBoundingClientRect().height ?? 0)
      : 0;
    const rowHeights = rows.map(
      (_, i) => rowRefs.current[i]?.getBoundingClientRect().height ?? 0,
    );

    const budget = PAGE_CONTENT_HEIGHT_PX * SAFETY_RATIO;
    // Minimal 30% dari budget - jaga-jaga kalau header/intro/footer-nya
    // sendiri gede banget (mis. logo tinggi), jangan sampai limit-nya
    // negatif dan bikin tiap baris dianggap "gak muat" (1 baris per
    // halaman - salah, tapi masih lebih aman daripada infinite loop).
    const firstPageBudget = Math.max(
      budget - headerH - footerH - introH,
      budget * 0.3,
    );
    const laterPageBudget = Math.max(budget - headerH - footerH, budget * 0.3);

    const buckets: { indices: number[]; height: number }[] = [];
    let current = { indices: [] as number[], height: 0 };
    let isFirstPage = true;

    rows.forEach((_, i) => {
      const rowH = rowHeights[i];
      const limit = isFirstPage ? firstPageBudget : laterPageBudget;
      if (current.indices.length > 0 && current.height + rowH > limit) {
        buckets.push(current);
        current = { indices: [], height: 0 };
        isFirstPage = false;
      }
      current.indices.push(i);
      current.height += rowH;
    });
    buckets.push(current);

    const lastIdx = buckets.length - 1;
    const lastBudget = lastIdx === 0 ? firstPageBudget : laterPageBudget;
    const remaining = lastBudget - buckets[lastIdx].height;
    const outroFitsOnLast = !hasOutro || remaining >= outroH;

    const result: PrintPage<T>[] = buckets.map((b, idx) => ({
      rows: b.indices.map((i) => rows[i]),
      hasIntro: idx === 0 && hasIntro,
      hasOutro: false,
    }));

    if (hasOutro) {
      if (outroFitsOnLast) {
        result[result.length - 1].hasOutro = true;
      } else {
        result.push({ rows: [], hasIntro: false, hasOutro: true });
      }
    }

    setPages(result);
    // Sengaja cuma gantung ke `enabled` - rows/intro/outro/header/footer
    // dibaca dari ref pas efek ini jalan (nilai render TERBARU, lewat
    // closure), bukan dijadikan dependency, karena kontennya JSX (objek
    // baru tiap render) - kalau dimasukin ke deps, efek ini jalan ulang
    // TIAP render lalu setPages bikin render baru lagi -> infinite loop.
  }, [enabled]);

  return { pages, refs: { headerRef, footerRef, introRef, outroRef, rowRefs } };
}

interface PaginatedPrintDocumentProps<T> {
  rows: T[];
  renderRow: (
    row: T,
    index: number,
    ref?: React.Ref<HTMLTableRowElement>,
  ) => ReactNode;
  renderTableHead: () => ReactNode;
  renderHeader: (ctx: { pageIndex: number; pageCount: number }) => ReactNode;
  renderFooter: (ctx: { pageIndex: number; pageCount: number }) => ReactNode;
  renderIntro?: () => ReactNode;
  renderOutro?: () => ReactNode;
  // Trigger pengukuran+pagination - biasanya `true` selama proses cetak
  // aktif (mis. isPrintingBast). Selama false, dokumen dirender apa
  // adanya (1 halaman, tanpa nomor halaman) sebagai fallback aman.
  enabled: boolean;
  tableClassName?: string;
}

export function PaginatedPrintDocument<T>({
  rows,
  renderRow,
  renderTableHead,
  renderHeader,
  renderFooter,
  renderIntro,
  renderOutro,
  enabled,
  tableClassName,
}: PaginatedPrintDocumentProps<T>) {
  const introNode = renderIntro?.();
  const outroNode = renderOutro?.();

  const { pages, refs } = useMeasuredPagination({
    rows,
    enabled,
    hasIntro: !!renderIntro,
    hasOutro: !!renderOutro,
  });

  // Ukuran font DIBAKUKAN di sini (bukan digantung ke @media print lagi -
  // lihat globals.css) supaya render pengukuran (di context layar biasa)
  // dan hasil cetak sungguhan PERSIS sama ukurannya - itu syarat utama
  // biar tinggi yang terukur representatif. Padding-nya 0 karena inset
  // dari tepi kertas sepenuhnya diurus @page margin (globals.css), bukan
  // padding elemen ini lagi.
  const pageClassName =
    "p-0 bg-white text-black font-sans text-[10pt] leading-normal min-h-[24cm] flex flex-col";

  return (
    <>
      {/* Kontainer pengukuran - di luar layar (left:-9999px) TAPI bukan
          display:none, jadi getBoundingClientRect() masih baca tinggi
          asli. Pakai className yang SAMA persis dengan halaman cetak
          sungguhan supaya tinggi yang terukur representatif. */}
      <div
        aria-hidden
        style={{ position: "fixed", top: 0, left: "-9999px", width: "210mm" }}
      >
        <div className={pageClassName}>
          <div ref={refs.headerRef}>
            {renderHeader({ pageIndex: 0, pageCount: 1 })}
          </div>
          {introNode && <div ref={refs.introRef}>{introNode}</div>}
          {outroNode && <div ref={refs.outroRef}>{outroNode}</div>}
          <div ref={refs.footerRef}>
            {renderFooter({ pageIndex: 0, pageCount: 1 })}
          </div>
          <table className={cn("w-full border-collapse text-xs", tableClassName)}>
            <tbody>
              {rows.map((row, i) =>
                renderRow(row, i, (el) => {
                  refs.rowRefs.current[i] = el;
                }),
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pages === null ? (
        // Belum terukur (atau enabled=false) - fallback 1 halaman apa
        // adanya, tanpa nomor halaman, supaya tetap ada yang tercetak
        // kalau pengukuran gagal/belum sempat jalan.
        <div id="printable-po-a4" className={pageClassName}>
          {renderHeader({ pageIndex: 0, pageCount: 1 })}
          {introNode}
          <table className={cn("w-full border-collapse text-xs", tableClassName)}>
            <thead>{renderTableHead()}</thead>
            <tbody>
              {rows.map((row, i) => (
                <Fragment key={i}>{renderRow(row, i)}</Fragment>
              ))}
            </tbody>
          </table>
          {outroNode}
          <div className="mt-auto">
            {renderFooter({ pageIndex: 0, pageCount: 1 })}
          </div>
        </div>
      ) : (
        pages.map((page, pageIndex) => {
          // Index baris harus GLOBAL (nomor urut 1..N nyambung lintas
          // halaman), bukan lokal per-halaman - hitung offset dari total
          // baris di semua halaman sebelumnya.
          const rowOffset = pages
            .slice(0, pageIndex)
            .reduce((sum, p) => sum + p.rows.length, 0);
          return (
            <div
              key={pageIndex}
              id="printable-po-a4"
              className={pageClassName}
              style={{
                breakAfter: pageIndex < pages.length - 1 ? "page" : "auto",
              }}
            >
              {renderHeader({ pageIndex, pageCount: pages.length })}
              {page.hasIntro && introNode}
              <table
                className={cn("w-full border-collapse text-xs", tableClassName)}
              >
                <thead>{renderTableHead()}</thead>
                <tbody>
                  {page.rows.map((row, i) => (
                    <Fragment key={i}>{renderRow(row, rowOffset + i)}</Fragment>
                  ))}
                </tbody>
              </table>
              {page.hasOutro && outroNode}
              <div className="mt-auto">
                {renderFooter({ pageIndex, pageCount: pages.length })}
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
