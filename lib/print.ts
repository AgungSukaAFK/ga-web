// src/lib/print.ts
//
// Nama file default "Save as PDF" di dialog cetak browser diambil dari
// document.title - kalau window.print() dipanggil langsung, semua hasil
// cetak ke-download sebagai "Garuda Procure.pdf" (title global di
// app/layout.tsx). Semua titik cetak (PO, BAST, Penerimaan Barang, dokumen
// Petty Cash, rekap MR) pakai printWithFileName() di bawah sebagai ganti
// window.print() supaya nama file-nya sesuai dokumen masing-masing.

/** Karakter yang tidak valid di nama file diganti "-" - kode dokumen pakai "/" (mis. GMI/PO/X/26/PUR/001). */
export const toPrintFileName = (name: string) =>
  name
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();

/**
 * window.print() dengan nama file PDF default `fileName` (tanpa ".pdf").
 * Title halaman dikembalikan di afterprint, BUKAN langsung sesudah
 * window.print() - tidak semua browser memblok di window.print() sampai
 * dialog ditutup, jadi kalau dikembalikan langsung nama file-nya bisa
 * keburu balik ke "Garuda Procure".
 */
export function printWithFileName(fileName: string) {
  const originalTitle = document.title;
  document.title = toPrintFileName(fileName) || originalTitle;
  window.addEventListener(
    "afterprint",
    () => {
      document.title = originalTitle;
    },
    { once: true },
  );
  window.print();
}
