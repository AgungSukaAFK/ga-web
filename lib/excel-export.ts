// lib/excel-export.ts
// Util bersama untuk export data ke Excel (.xlsx) dengan styling rapi
// (header tebal + warna, border, lebar kolom otomatis, freeze header).
// Dipakai oleh semua halaman "Download Excel" (MR, PO, Barang, User Management)
// supaya tampilannya konsisten.

import ExcelJS from "exceljs";

const HEADER_FILL = "FF1E3A5F"; // navy gelap
const HEADER_FONT = "FFFFFFFF"; // putih
const BORDER_COLOR = "FFD1D5DB"; // abu-abu terang
const STRIPE_FILL = "FFF3F4F6"; // abu-abu sangat terang (baris genap)

const thinBorder = {
  top: { style: "thin" as const, color: { argb: BORDER_COLOR } },
  left: { style: "thin" as const, color: { argb: BORDER_COLOR } },
  bottom: { style: "thin" as const, color: { argb: BORDER_COLOR } },
  right: { style: "thin" as const, color: { argb: BORDER_COLOR } },
};

const MAX_COL_WIDTH = 45;
const MIN_COL_WIDTH = 10;

/**
 * Export array of flat objects (hasil map/flatMap seperti yang sudah ada
 * di semua halaman "Download Excel") menjadi file .xlsx yang sudah distyling,
 * lalu langsung memicu download-nya di browser.
 */
export async function exportStyledExcel(
  data: Record<string, unknown>[],
  fileName: string,
  sheetName = "Sheet1",
) {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  worksheet.columns = headers.map((header) => {
    const longest = Math.max(
      header.length,
      ...data.map((row) => String(row[header] ?? "").length),
    );
    const width = Math.min(
      Math.max(longest + 2, MIN_COL_WIDTH),
      MAX_COL_WIDTH,
    );
    return { header, key: header, width };
  });

  data.forEach((row) => worksheet.addRow(row));

  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };

  const headerRow = worksheet.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT }, size: 11 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_FILL },
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = thinBorder;
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = thinBorder;
      cell.alignment = { vertical: "middle" };
      if (rowNumber % 2 === 0) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: STRIPE_FILL },
        };
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
