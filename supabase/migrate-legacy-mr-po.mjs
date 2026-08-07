// Migrasi data lama: rekonsiliasi status/link item MR <-> PO untuk data yang
// dibuat sebelum alur approval/receiving versi sekarang ada (lihat
// po-status-migration.sql untuk migrasi status PO-nya sendiri - jalankan itu
// DULU baru script ini, supaya guard "sudah dikelola sistem baru" di bawah
// akurat).
//
// TIDAK menyentuh MR/PO yang sudah punya `receive_record` (PO sudah lewat
// alur Receiver baru) atau item yang statusnya "Cancelled"/"Replaced" -
// dianggap final, tidak pernah di-otak-atik ulang.
//
// Aturan (dicek per-item, match by part_number antara mr.orders & po.items):
//   1. Item cuma di-cover PO yang "Rejected" (tidak ada PO lain yang cover)
//      -> item.status = "Cancelled".
//   2. Item di-cover PO "Rejected" TAPI juga di-cover PO lain yang aktif
//      -> item.po_refs ditambah kode PO yang aktif itu (status tidak diubah
//      di sini, biar aturan lain yang nentuin berdasarkan status PO aktifnya).
//   3. PO yang punya lampiran mengandung kata "inv"/"invoice" -> po.status
//      jadi "Pending Payment" (kalau belum lebih maju), item2 yang di-cover
//      PO itu -> "Pending BAST".
//   4. Item MR yang statusnya "Pending" (menunggu) - ATAU field status-nya
//      memang kosong/null (data lama yang belum pernah diisi statusnya sama
//      sekali, dianggap setara "Pending", lihat isPendingLike) - tapi ada PO
//      yang cover -> item di-link ke PO itu; kalau PO-nya bukan Rejected ->
//      item jadi "Pending BAST".
//   5. Item berstatus "PO Created" yang status_note-nya (catatan manual)
//      memuat kode PO -> item di-link ke PO tersebut (status tidak diubah).
//   6. MR yang status-nya (lama) "Completed" -> untuk tiap itemnya, kalau ada
//      PO yang cover & bukan Rejected -> item di-link + jadi "Pending BAST".
//   7. PO "Pending Approval" dengan payment_term mengandung "termin" -> po
//      jadi "Pending Payment", item2 yang di-cover -> di-link + jadi
//      "Pending BAST".
//   8. MR yang status-nya "Rejected" -> SEMUA item di MR itu jadi
//      "Cancelled", TANPA kecuali (termasuk yang sudah "Completed"/
//      "Replaced", DAN yang part_number-nya kosong sekalipun - aturan ini
//      TIDAK butuh part_number karena tidak melakukan matching ke PO,
//      cuma blanket-cancel berdasarkan status MR). Dijalankan PALING AWAL
//      (sebelum aturan 1-7) supaya aturan lain otomatis skip item-item ini
//      lewat guard NEVER_TOUCH.
//   9. PO yang status-nya "Full Received" (dari data lama, sebelum fitur
//      checklist Receiver ada) tapi belum punya `receive_record` -> dibuatkan
//      record asumsi qty diterima = qty PO (full match utk semua item),
//      supaya PO lama juga punya riwayat receive yang bisa dicetak/diedit,
//      konsisten dengan PO baru. `received_at` diisi waktu migrasi
//      dijalankan (bukan tanggal PO dibuat - qty aktual historisnya tidak
//      diketahui, ini backfill bukan rekonstruksi). Dijalankan PALING AKHIR.
//   10. Item TANPA part_number (jadi tidak bisa di-matching ke PO manapun -
//       Aturan 6 tidak bisa jalan buat ini) yang MR-nya berstatus lama
//       "Completed" -> item ikut ditandai "Completed", warisan langsung dari
//       status MR-nya (tidak ada PO/receive_record yang disentuh).
//   11. PO yang punya lampiran ber-type "po" atau "finance" (bukan
//       "invoice" - itu Aturan 3) tapi nama file-nya mirip invoice
//       (kemungkinan salah kategori pas upload dulu) -> MR-nya (status
//       keseluruhan, bukan cuma item) jadi "Completed", PO-nya jadi
//       "Pending Payment". Tidak menimpa MR yang sudah "Rejected".
//   12. MR yang statusnya "Completed" (termasuk yang baru saja di-set oleh
//       Aturan 11) -> SEMUA itemnya ikut jadi "Completed" juga, kecuali
//       yang sudah "Cancelled"/"Replaced". Catch-all, dijalankan PALING
//       AKHIR - menimpa hasil "Pending BAST" dari Aturan 6/10 kalau
//       MR-nya memang sudah selesai total.
//   13. Item TANPA part_number yang masih "Pending"/kosong tapi MR-nya
//       sudah punya PO -> coba link lewat NAMA item yang PERSIS SAMA
//       (bukan mirip-mirip) ke item di PO aktif milik MR yang sama; kalau
//       ketemu -> item di-link + jadi "Pending BAST". Item yang namanya
//       cuma mirip (bukan sama persis) SENGAJA tidak disentuh - lebih
//       aman daripada salah sambung ke barang yang keliru.
//   14. Status barang "PO Created" (sudah tidak dipakai lagi di aplikasi,
//       dilebur ke "Processing") -> item lama yang masih berstatus ini
//       di-convert jadi "Processing", dan `level`-nya dinaikkan ke "Open
//       3A" kalau belum sampai situ (supaya tetap ke-anggap "linked" oleh
//       recalculateMrStatus - lihat catatan di bawah).
//   15. MR tahun 2025 (kode_mr mengandung "/25/") yang statusnya masih
//       "Pending Approval" atau "On Process" -> di-force jadi "Completed".
//       Item-itemnya otomatis ikut ke-cascade "Completed" lewat Aturan 12
//       (dijalankan setelah aturan ini).
//
// Catatan: script ini TIDAK menjalankan recalculateMrStatus/
// recalculateMrLevel (services/mrService.ts) - fungsi yang MENGHITUNG ULANG
// `material_requests.status`/`level` DARI status item-itemnya, yang
// otomatis jalan tiap ada aksi normal lewat UI. Aturan 11 (set mr.status
// jadi "Completed" berdasarkan bukti lampiran invoice) & Aturan 12
// (sebaliknya - menurunkan status MR itu KE item-itemnya) BUKAN
// pengganti recalculate itu, cuma backfill terarah berdasarkan 2 sinyal
// spesifik di atas. `level` (field terpisah dari `status`) tetap tidak
// disentuh sama sekali oleh script ini - bilang aja kalau itu juga perlu
// dibetulkan.
//
// Cara pakai:
//   node supabase/migrate-legacy-mr-po.mjs                 # dry-run (default)
//   node supabase/migrate-legacy-mr-po.mjs --apply          # beneran nulis ke DB
//   node supabase/migrate-legacy-mr-po.mjs --rules=1,2,6    # cuma jalanin aturan tertentu (bisa digabung --apply)
//
// Kredensial diambil OTOMATIS dari file `.env` di root project (SUPABASE_URL
// & SUPABASE_SERVICE_ROLE_KEY - itu memang isinya kredensial PRODUCTION di
// repo ini, bukan local). Kalau mau target ke local Supabase (`supabase
// start`) sebagai gantinya, export manual dulu sebelum jalankan script -
// env var yang sudah di-export duluan TIDAK ditimpa oleh isi .env:
//   export SUPABASE_URL="http://127.0.0.1:54321"
//   export SUPABASE_SERVICE_ROLE_KEY="...local service_role key..."
//   node supabase/migrate-legacy-mr-po.mjs
//
// Tiap kali jalan (dry-run maupun --apply) selalu nulis laporan .xlsx yang
// sudah distyling ke supabase/migration-reports/ (di-gitignore, jangan pernah
// commit - isinya data production asli), isinya 6 sheet:
//   1. Ringkasan            - jumlah perubahan per aturan
//   2. Perubahan Item MR    - detail before/after tiap item MR yang berubah
//   3. Perubahan Status MR  - detail before/after tiap MR yang status
//                             keseluruhannya berubah (Aturan 11)
//   4. Perubahan Status PO  - detail before/after tiap PO yang berubah
//   5. Data MR Lengkap      - SEMUA MR (bukan cuma yang berubah), kolomnya
//                             sama persis dgn tombol "Download Excel" di
//                             halaman /material-request
//   6. Data PO Lengkap      - SEMUA PO, kolomnya sama persis dgn tombol
//                             "Download Excel" di halaman /purchase-order
// Sheet 5 & 6 merefleksikan state SETELAH semua aturan disimulasikan (bukan
// state sebelum migrasi) - dry-run maupun apply, itung-itungannya sama.
// SELALU baca laporan dry-run dulu,
// baru --apply.

import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

// Load `.env` (production) di root project sebagai fallback - tidak menimpa
// env var yang sudah di-export manual duluan (mis. buat testing ke local),
// lihat catatan "Cara pakai" di atas.
dotenv.config({ path: path.join(projectRoot, ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    `Tidak ketemu SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY - pastikan file .env di root project (${projectRoot}) ada dan berisi kedua var itu, atau export manual dulu.`,
  );
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const rulesArg = process.argv.find((a) => a.startsWith("--rules="));
const ONLY_RULES = rulesArg
  ? new Set(rulesArg.replace("--rules=", "").split(",").map((s) => s.trim()))
  : null;
const ruleEnabled = (n) => !ONLY_RULES || ONLY_RULES.has(String(n));

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const STATUS = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  // PO_CREATED sudah tidak pernah ditulis lagi oleh aplikasi (dilebur ke
  // PROCESSING) - dipertahankan di sini SEMATA-MATA supaya script ini masih
  // bisa kenalin & convert data lama yang masih berstatus ini (lihat
  // Aturan 14).
  PO_CREATED: "PO Created",
  PENDING_BAST: "Pending BAST",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REPLACED: "Replaced",
};
const NEVER_TOUCH = new Set([STATUS.CANCELLED, STATUS.REPLACED]);

// Data lama sering punya item yang field `status`-nya memang belum pernah
// diisi sama sekali (null/undefined/string kosong) - bukan literal
// "Pending". Di UI ini tampil sebagai "Pending" lewat default di
// normalizeMrOrders, jadi buat keperluan migrasi juga harus dianggap setara
// - dipakai di Aturan 4 (sebelumnya cuma cek `=== "Pending"` persis, jadi
// item yang field-nya kosong lolos tidak ke-cover meskipun ada PO aktif
// yang cover-nya - terbukti dari data production, 186 dari 190 kasus
// "ada PO aktif tapi tetap Pending" itu field status-nya kosong, bukan
// literal "Pending").
const isPendingLike = (status) =>
  status === STATUS.PENDING || status === null || status === undefined || status === "";

// Dipakai Aturan 3 & 11 - cek apakah nama file lampiran "mirip" invoice
// (case-insensitive substring "inv", mencakup "Invoice", "INV-001", dst).
const isInvoiceLikeName = (name) => /inv/i.test(name || "");

const PO_STATUS_FURTHER_ALONG = new Set([
  "Pending Payment",
  "Pending Receive",
  "Partial Receive",
  "Full Received",
  "Rejected",
]);

const RULE_DESCRIPTIONS = {
  1: "Item cuma di-cover PO Rejected (tidak ada PO lain) -> item jadi Cancelled",
  2: "Item di-cover PO Rejected TAPI juga PO lain yang aktif -> item di-link ke PO aktif itu",
  3: "PO ada lampiran mengandung 'inv'/'invoice' -> PO jadi Pending Payment, item terkait jadi Pending BAST",
  4: "Item masih 'Pending' & ada PO yang cover -> item di-link; kalau PO bukan Rejected -> jadi Pending BAST",
  5: "Item 'PO Created' yang catatan manualnya memuat kode PO -> item di-link ke PO tersebut",
  6: "MR berstatus lama 'Completed' -> item terkait (PO-nya bukan Rejected) di-link + jadi Pending BAST",
  7: "PO 'Pending Approval' dengan payment_term Termin -> PO jadi Pending Payment, item terkait di-link + jadi Pending BAST",
  8: "MR berstatus 'Rejected' -> SEMUA item di MR itu jadi Cancelled, tanpa kecuali (dijalankan paling awal)",
  9: "PO 'Full Received' yang belum punya receive_record -> dibuatkan record asumsi full match (dijalankan paling akhir)",
  10: "Item TANPA part_number yang MR-nya 'Completed' (lama) -> item ikut jadi Completed (warisan dari status MR)",
  11: "PO ada lampiran type po/finance dengan nama mirip invoice -> MR jadi Completed, PO jadi Pending Payment",
  12: "MR 'Completed' -> SEMUA itemnya ikut jadi Completed juga (catch-all, dijalankan paling akhir)",
  13: "Item tanpa part_number, nama PERSIS SAMA dengan item di PO aktif milik MR yang sama -> item di-link + jadi Pending BAST",
  14: "Status barang 'PO Created' (sudah tidak dipakai) -> jadi Processing, level dinaikkan ke Open 3A kalau belum sampai situ",
  15: "MR tahun 2025 (kode_mr mengandung '/25/') yang masih Pending Approval/On Process -> di-force jadi Completed",
};

// Reimplementasi kecil dari isPoPaid/getLastApprovedApprover di
// type/enum.ts - sengaja diduplikasi (bukan di-import) karena script ini
// plain Node .mjs (tanpa loader TS), supaya tetap bisa dijalankan langsung
// dengan `node`. Kalau logic aslinya berubah, sesuaikan juga di sini.
const PAYMENT_VALIDATOR_USER_ID = "06122d13-9918-40ac-9034-41e849c5c3e2";
const isPaymentValidatorApproval = (app) =>
  !!app &&
  (app.userid === PAYMENT_VALIDATOR_USER_ID ||
    app.type === "Payment Validator");
const isPoPaidCheck = (approvals) =>
  Array.isArray(approvals) &&
  approvals.some((a) => a.status === "approved" && isPaymentValidatorApproval(a));
const getLastApprovedApprover = (approvals) => {
  if (!Array.isArray(approvals)) return null;
  const approved = approvals.filter((a) => a.status === "approved");
  return approved.length > 0 ? approved[approved.length - 1] : null;
};
// Tanggal full-approve/reject dari approver "Bunga" - meniru persis logic
// export MR yang sudah ada (app/(With Sidebar)/material-request/page.tsx).
const BUNGA_USER_ID = "5dd1ac8e-ac88-4626-9540-e6f484e011c2";
const BUNGA_EMAIL = "bunga@garudamart.com";

// Warna chip per aturan (pastel, ARGB) - biar gampang di-scan mata pas
// review ratusan baris di Excel.
const RULE_COLORS = {
  1: "FFFFD6D6",
  2: "FFFFE8CC",
  3: "FFFFF3B0",
  4: "FFD6F5D6",
  5: "FFD6EFFF",
  6: "FFE6D6FF",
  7: "FFD6FFF6",
  8: "FFE0E0E0",
  9: "FFC8E6C9",
  10: "FFB2DFDB",
  11: "FFF8BBD0",
  12: "FFDCEDC8",
  13: "FFB3E5FC",
  14: "FFD7CCC8",
  15: "FFCFD8DC",
};

const HEADER_FILL = "FF1E3A5F";
const HEADER_FONT = "FFFFFFFF";
const BORDER_COLOR = "FFD1D5DB";
const STRIPE_FILL = "FFF3F4F6";
const THIN_BORDER = {
  top: { style: "thin", color: { argb: BORDER_COLOR } },
  left: { style: "thin", color: { argb: BORDER_COLOR } },
  bottom: { style: "thin", color: { argb: BORDER_COLOR } },
  right: { style: "thin", color: { argb: BORDER_COLOR } },
};

const AUTO_COL_MIN_WIDTH = 10;
const AUTO_COL_MAX_WIDTH = 42;

// Lebar kolom otomatis berdasarkan isi data (bukan cuma panjang header) -
// dipakai untuk sheet "Data MR/PO Lengkap" yang isinya bervariasi (nama
// barang panjang, remarks, dst) supaya kolomnya pas, sama seperti util
// exportStyledExcel di lib/excel-export.ts. `fallbackHeader` cuma dipakai
// kalau `rows` kosong (supaya sheet tetap punya minimal 1 kolom header).
function buildAutoColumns(rows, fallbackHeader) {
  const headers = Object.keys(rows[0] || { [fallbackHeader]: "" });
  return headers.map((header) => {
    const longest = Math.max(
      header.length,
      ...rows.map((row) => String(row[header] ?? "").length),
    );
    const width = Math.min(
      Math.max(longest + 2, AUTO_COL_MIN_WIDTH),
      AUTO_COL_MAX_WIDTH,
    );
    return { header, key: header, width };
  });
}

// Format angka (ribuan) utk kolom harga/currency + rata-tengah utk kolom
// kategorikal pendek (status, qty, dst) - dipanggil SETELAH styleSheetRows
// karena styleSheetRows nimpa `cell.alignment` tiap sel (lihat komentar di
// situ), jadi override alignment/numFmt yang lebih spesifik harus belakangan.
function applyColumnFormatting(worksheet, rowCount, currencyHeaders, centerHeaders) {
  worksheet.getRow(1).eachCell((headerCell, colNumber) => {
    const header = headerCell.value;
    const isCurrency = currencyHeaders.has(header);
    const isCenter = centerHeaders.has(header);
    if (!isCurrency && !isCenter) return;
    for (let r = 2; r <= rowCount + 1; r++) {
      const cell = worksheet.getRow(r).getCell(colNumber);
      if (isCurrency) {
        cell.numFmt = "#,##0";
        cell.alignment = { vertical: "middle", horizontal: "right" };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }
    }
  });
}

// PENTING: `worksheet.columns = ...` mereset ulang row 1 & mapping key->kolom
// sheet-nya - harus dipanggil SEBELUM addRows(), bukan sesudahnya (kalau
// sesudah, semua row yang sudah ditambah lewat object key ikut hilang).
function setupColumns(worksheet, columns) {
  worksheet.columns = columns;
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
}

function styleSheetRows(worksheet, columnCount, rowCount) {
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columnCount },
  };
  const headerRow = worksheet.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = THIN_BORDER;
  });
  for (let r = 2; r <= rowCount + 1; r++) {
    const row = worksheet.getRow(r);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: "middle", wrapText: true };
      if (r % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STRIPE_FILL } };
      }
    });
  }
}

const formatDateFriendly = (date) => {
  if (!date) return "N/A";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const firstOrSelf = (v) => (Array.isArray(v) ? v[0] : v);

async function writeExcelReport({
  apply,
  onlyRules,
  itemChanges,
  poChanges,
  mrChanges,
  byRule,
  mrs,
  pos,
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "migrate-legacy-mr-po.mjs";
  workbook.created = new Date();

  // --- Sheet 1: Ringkasan ---
  const ringkasan = workbook.addWorksheet("Ringkasan");
  ringkasan.columns = [
    { header: "Info", key: "k", width: 22 },
    { header: "Nilai", key: "v", width: 70 },
  ];
  ringkasan.addRow({ k: "Mode", v: apply ? "APPLY (ditulis ke DB)" : "DRY RUN (belum ditulis ke DB)" });
  ringkasan.addRow({ k: "Waktu", v: new Date().toLocaleString("id-ID") });
  ringkasan.addRow({ k: "Aturan dijalankan", v: onlyRules ? [...onlyRules].join(", ") : "Semua (1-15)" });
  ringkasan.addRow({ k: "Total perubahan item MR", v: itemChanges.length });
  ringkasan.addRow({ k: "Total perubahan status PO", v: poChanges.length });
  ringkasan.getRow(1).font = { bold: true, color: { argb: HEADER_FONT } };
  ringkasan.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  ringkasan.getRow(1).eachCell((c) => (c.border = THIN_BORDER));
  for (let r = 2; r <= 6; r++) {
    ringkasan.getRow(r).eachCell((c) => (c.border = THIN_BORDER));
  }

  ringkasan.addRow([]);
  const perRuleHeaderRow = ringkasan.addRow({ k: "Aturan", v: "Deskripsi" });
  perRuleHeaderRow.getCell(1).value = "Aturan";
  ringkasan.getCell(`C${perRuleHeaderRow.number}`).value = "Jumlah Perubahan";
  perRuleHeaderRow.font = { bold: true, color: { argb: HEADER_FONT } };
  perRuleHeaderRow.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    c.border = THIN_BORDER;
  });
  ringkasan.getColumn(3).width = 18;

  for (let rule = 1; rule <= 15; rule++) {
    const row = ringkasan.addRow({
      k: rule,
      v: RULE_DESCRIPTIONS[rule],
    });
    row.getCell(3).value = byRule[String(rule)] || 0;
    row.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: RULE_COLORS[rule] },
    };
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    row.eachCell({ includeEmpty: true }, (c) => {
      c.border = THIN_BORDER;
      c.alignment = { ...c.alignment, vertical: "middle", wrapText: true };
    });
  }

  // --- Sheet 2: Perubahan Item MR ---
  const itemSheet = workbook.addWorksheet("Perubahan Item MR");
  const itemRows = itemChanges.length
    ? itemChanges
    : [{ rule: "-", kode_mr: "-", part_number: "-", field: "-", before: "(tidak ada perubahan)", after: "" }];
  setupColumns(itemSheet, [
    { header: "Aturan", key: "rule", width: 10 },
    { header: "Kode MR", key: "kode_mr", width: 20 },
    { header: "Part Number", key: "part_number", width: 20 },
    { header: "Field", key: "field", width: 14 },
    { header: "Sebelum", key: "before", width: 32 },
    { header: "Sesudah", key: "after", width: 32 },
  ]);
  itemSheet.addRows(
    itemRows.map((c) => ({
      rule: c.rule,
      kode_mr: c.kode_mr,
      part_number: c.part_number,
      field: c.field,
      before: Array.isArray(c.before) ? c.before.join(", ") : String(c.before ?? ""),
      after: Array.isArray(c.after) ? c.after.join(", ") : String(c.after ?? ""),
    })),
  );
  styleSheetRows(itemSheet, 6, itemRows.length);
  itemSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const ruleVal = String(row.getCell(1).value);
    if (RULE_COLORS[ruleVal]) {
      row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: RULE_COLORS[ruleVal] } };
    }
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  });

  // --- Sheet 3: Perubahan Status MR ---
  const mrStatusSheet = workbook.addWorksheet("Perubahan Status MR");
  const mrStatusRows = mrChanges.length
    ? mrChanges
    : [{ rule: "-", kode_mr: "-", field: "-", before: "(tidak ada perubahan)", after: "" }];
  setupColumns(mrStatusSheet, [
    { header: "Aturan", key: "rule", width: 10 },
    { header: "Kode MR", key: "kode_mr", width: 20 },
    { header: "Field", key: "field", width: 14 },
    { header: "Sebelum", key: "before", width: 22 },
    { header: "Sesudah", key: "after", width: 22 },
  ]);
  mrStatusSheet.addRows(
    mrStatusRows.map((c) => ({
      rule: c.rule,
      kode_mr: c.kode_mr,
      field: c.field,
      before: String(c.before ?? ""),
      after: String(c.after ?? ""),
    })),
  );
  styleSheetRows(mrStatusSheet, 5, mrStatusRows.length);
  mrStatusSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const ruleVal = String(row.getCell(1).value);
    if (RULE_COLORS[ruleVal]) {
      row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: RULE_COLORS[ruleVal] } };
    }
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  });

  // --- Sheet 4: Perubahan Status PO ---
  const poSheet = workbook.addWorksheet("Perubahan Status PO");
  const poRows = poChanges.length
    ? poChanges
    : [{ rule: "-", kode_po: "-", field: "-", before: "(tidak ada perubahan)", after: "" }];
  setupColumns(poSheet, [
    { header: "Aturan", key: "rule", width: 10 },
    { header: "Kode PO", key: "kode_po", width: 26 },
    { header: "Field", key: "field", width: 14 },
    { header: "Sebelum", key: "before", width: 26 },
    { header: "Sesudah", key: "after", width: 26 },
  ]);
  poSheet.addRows(
    poRows.map((c) => ({
      rule: c.rule,
      kode_po: c.kode_po,
      field: c.field,
      before: String(c.before ?? ""),
      after: String(c.after ?? ""),
    })),
  );
  styleSheetRows(poSheet, 5, poRows.length);
  poSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const ruleVal = String(row.getCell(1).value);
    if (RULE_COLORS[ruleVal]) {
      row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: RULE_COLORS[ruleVal] } };
    }
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  });

  // --- Sheet 5: Data MR Lengkap ---
  // Kolom persis sama dengan tombol "Download Excel" di halaman MR (lihat
  // baseMrInfo di app/(With Sidebar)/material-request/page.tsx) - SEMUA MR
  // (bukan cuma yang kena perubahan), merefleksikan state SETELAH ke-7
  // aturan disimulasikan (kalau --apply, ini persis yang ditulis ke DB).
  // Diurutkan terbaru -> terlama (created_at descending).
  const mrSheet = workbook.addWorksheet("Data MR Lengkap");
  const mrsSorted = [...mrs].sort(
    (a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0),
  );
  const mrRows = mrsSorted.flatMap((mr) => {
    let fullApproveDate = "-";
    let rejectDate = "-";
    if (Array.isArray(mr.approvals)) {
      const bungaApproval = mr.approvals.find(
        (a) => a.email === BUNGA_EMAIL || a.userid === BUNGA_USER_ID,
      );
      if (bungaApproval?.status === "approved" && bungaApproval.processed_at) {
        fullApproveDate = formatDateFriendly(bungaApproval.processed_at);
      } else if (
        bungaApproval?.status === "rejected" &&
        bungaApproval.processed_at
      ) {
        rejectDate = formatDateFriendly(bungaApproval.processed_at);
      }
    }
    const ccData = firstOrSelf(mr.cost_centers);
    const requesterData = firstOrSelf(mr.users_with_profiles);

    const baseMrInfo = {
      "Kode MR": mr.kode_mr,
      "Cost Center": ccData?.code || "-",
      Priority: mr.prioritas || "-",
      Level: mr.level,
      Kategori: mr.kategori,
      Departemen: mr.department,
      "Tujuan Site": mr.tujuan_site,
      Requester: requesterData?.nama || "N/A",
      "Status MR": mr.status,
      "Tanggal Full Approve": fullApproveDate,
      "Tanggal Approval Ditolak": rejectDate,
      Company: mr.company_code,
      "Tanggal Dibuat": formatDateFriendly(mr.created_at),
      "Due Date": formatDateFriendly(mr.due_date),
      "Total Estimasi": Number(mr.cost_estimation) || 0,
      Remarks: mr.remarks || "-",
    };

    const orders = Array.isArray(mr.orders) ? mr.orders : [];
    if (orders.length > 0) {
      return orders.map((item, idx) => ({
        ...baseMrInfo,
        "No Item": idx + 1,
        "Nama Barang": item.name,
        "Part Number": item.part_number || "-",
        Qty: Number(item.qty) || 0,
        UoM: item.uom,
        "Estimasi Harga": Number(item.estimasi_harga) || 0,
        "Total Harga Item":
          (Number(item.qty) || 0) * (Number(item.estimasi_harga) || 0),
        "Status Barang": item.status || "Pending",
        "No. PO": (item.po_refs || []).join(", ") || "-",
        "Catatan Item": item.note || item.status_note || "-",
        URL: item.url || "-",
      }));
    }
    return [{ ...baseMrInfo, "Nama Barang": "TIDAK ADA ITEM" }];
  });
  setupColumns(mrSheet, buildAutoColumns(mrRows, "Kode MR"));
  mrSheet.addRows(mrRows);
  styleSheetRows(mrSheet, mrSheet.columns.length, mrRows.length);
  applyColumnFormatting(
    mrSheet,
    mrRows.length,
    new Set(["Total Estimasi", "Estimasi Harga", "Total Harga Item"]),
    new Set(["No Item", "Priority", "Level", "Qty", "UoM", "Status MR", "Status Barang"]),
  );

  // --- Sheet 6: Data PO Lengkap ---
  // Kolom persis sama dengan tombol "Download Excel" di halaman PO (lihat
  // basePoInfo di app/(With Sidebar)/purchase-order/page.tsx) - SEMUA PO,
  // state setelah semua aturan disimulasikan. Diurutkan terbaru -> terlama.
  const poFullSheet = workbook.addWorksheet("Data PO Lengkap");
  const posSorted = [...pos].sort(
    (a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0),
  );
  const poRowsFull = posSorted.flatMap((po) => {
    const isPaid = isPoPaidCheck(po.approvals);
    const lastApprover = getLastApprovedApprover(po.approvals);
    const hasInvoice =
      Array.isArray(po.attachments) &&
      po.attachments.some((att) => att?.type === "invoice");

    const mrData = firstOrSelf(po.material_requests);
    const ccData = firstOrSelf(mrData?.cost_centers);
    const requesterData = firstOrSelf(mrData?.users_with_profiles);

    const basePoInfo = {
      "Kode PO": po.kode_po,
      "Ref. Kode MR": mrData?.kode_mr || "N/A",
      "Departemen MR": mrData?.department || "N/A",
      "Cost Center": ccData?.name || "N/A",
      Vendor: po.vendor_details?.nama_vendor || "N/A",
      "Requester MR": requesterData?.nama || "N/A",
      Status: po.status,
      "Status Pembayaran": isPaid ? "Paid" : "Unpaid",
      "Last Approve": lastApprover?.nama || "",
      DP: po.dp_paid ? "Dibayar" : "",
      BP: po.bp_paid ? "Dibayar" : "",
      Invoice: hasInvoice ? "Ada" : "Tidak Ada",
      "Jenis Pembayaran": po.payment_term || "N/A",
      "Total Harga PO": po.total_price,
      "Pembuat PO": firstOrSelf(po.users_with_profiles)?.nama || "N/A",
      Perusahaan: po.company_code,
      "Tanggal Dibuat": formatDateFriendly(po.created_at),
    };

    if (Array.isArray(po.items) && po.items.length > 0) {
      return po.items.map((item) => ({
        ...basePoInfo,
        "Part Number": item.part_number,
        "Nama Item": item.name,
        Qty: item.qty,
        UoM: item.uom,
        "Harga Satuan": item.price,
        "Total Harga Item": item.total_price,
        "Vendor Item": item.vendor_name,
      }));
    }
    return [
      {
        ...basePoInfo,
        "Part Number": "N/A",
        "Nama Item": "N/A",
        Qty: 0,
        UoM: "N/A",
        "Harga Satuan": 0,
        "Total Harga Item": 0,
        "Vendor Item": "N/A",
      },
    ];
  });
  setupColumns(poFullSheet, buildAutoColumns(poRowsFull, "Kode PO"));
  poFullSheet.addRows(poRowsFull);
  styleSheetRows(poFullSheet, poFullSheet.columns.length, poRowsFull.length);
  applyColumnFormatting(
    poFullSheet,
    poRowsFull.length,
    new Set(["Total Harga PO", "Harga Satuan", "Total Harga Item"]),
    new Set(["Qty", "UoM", "Status", "Status Pembayaran", "DP", "BP", "Invoice", "Jenis Pembayaran"]),
  );

  const reportDir = path.join(__dirname, "migration-reports");
  fs.mkdirSync(reportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `migrasi-mr-po-${apply ? "apply" : "dryrun"}-${stamp}.xlsx`;
  const filePath = path.join(reportDir, fileName);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

// Supabase/PostgREST punya limit default 1000 baris per response - query
// `.select()` biasa TANPA `.range()` bakal DIAM-DIAM cuma balikin 1000 baris
// pertama tanpa error, bukan seluruh tabel (kepakai/kena beneran di sini:
// production punya 1140 MR & 1177 PO, jadi query lama kehilangan 140 MR &
// 177 PO). Helper ini nge-loop pakai `.range()` sampai semua baris ke-ambil.
const PAGE_SIZE = 1000;
async function fetchAllRows(tableName, selectQuery) {
  const allRows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(tableName)
      .select(selectQuery)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allRows;
}

async function main() {
  // Kolom yang di-select sengaja dilebihkan dari yang dibutuhkan aturan
  // migrasi (id, kode_mr/po, status, orders/items, dst) - tambahan field di
  // bawah (kategori, cost_centers, users_with_profiles, dst) MURNI buat isi
  // sheet "Data MR Lengkap"/"Data PO Lengkap" di laporan Excel, supaya
  // kolomnya sama persis dengan tombol "Download Excel" di halaman MR/PO
  // (lihat baseMrInfo di app/(With Sidebar)/material-request/page.tsx dan
  // basePoInfo di app/(With Sidebar)/purchase-order/page.tsx).
  const mrs = await fetchAllRows(
    "material_requests",
    `id, kode_mr, kategori, department, status, remarks, cost_estimation,
     tujuan_site, company_code, created_at, due_date,
     prioritas, level, orders, approvals,
     users_with_profiles!userid(nama),
     cost_centers(code)`,
  );

  const pos = await fetchAllRows(
    "purchase_orders",
    `id, kode_po, status, total_price, company_code, created_at,
     items, approvals, payment_term, vendor_details,
     dp_paid, bp_paid, attachments, mr_id, receive_record,
     users_with_profiles!user_id(nama),
     material_requests!mr_id(
       kode_mr,
       department,
       cost_centers(name),
       users_with_profiles!userid(nama)
     )`,
  );

  console.log(`Data ke-ambil: ${mrs.length} MR, ${pos.length} PO.`);

  const mrState = new Map(
    mrs.map((mr) => [
      mr.id,
      { ...mr, orders: JSON.parse(JSON.stringify(mr.orders || [])) },
    ]),
  );
  const poState = new Map(pos.map((po) => [po.id, { ...po }]));

  const posByMr = new Map();
  for (const po of poState.values()) {
    if (po.mr_id == null) continue;
    if (!posByMr.has(po.mr_id)) posByMr.set(po.mr_id, []);
    posByMr.get(po.mr_id).push(po);
  }

  const itemChanges = [];
  const poChanges = [];
  const mrChanges = [];

  const coveringPos = (mrId, partNumber) =>
    (posByMr.get(mrId) || []).filter(
      (po) =>
        Array.isArray(po.items) &&
        po.items.some((i) => i.part_number === partNumber),
    );

  const setItemStatus = (mr, item, newStatus, rule) => {
    if (item.status === newStatus) return;
    itemChanges.push({
      rule,
      kode_mr: mr.kode_mr,
      mr_id: mr.id,
      part_number: item.part_number,
      field: "status",
      before: item.status ?? null,
      after: newStatus,
    });
    item.status = newStatus;
  };

  const setItemLevel = (mr, item, newLevel, rule) => {
    if (item.level === newLevel) return;
    itemChanges.push({
      rule,
      kode_mr: mr.kode_mr,
      mr_id: mr.id,
      part_number: item.part_number,
      field: "level",
      before: item.level ?? null,
      after: newLevel,
    });
    item.level = newLevel;
  };

  const linkPoRef = (mr, item, kodePo, rule) => {
    item.po_refs = Array.isArray(item.po_refs) ? item.po_refs : [];
    if (item.po_refs.includes(kodePo)) return;
    const before = [...item.po_refs];
    item.po_refs.push(kodePo);
    itemChanges.push({
      rule,
      kode_mr: mr.kode_mr,
      mr_id: mr.id,
      part_number: item.part_number,
      field: "po_refs",
      before,
      after: [...item.po_refs],
    });
  };

  const setPoStatus = (po, newStatus, rule) => {
    if (po.status === newStatus) return;
    poChanges.push({
      rule,
      kode_po: po.kode_po,
      po_id: po.id,
      field: "status",
      before: po.status,
      after: newStatus,
    });
    po.status = newStatus;
  };

  const setMrStatus = (mr, newStatus, rule) => {
    if (mr.status === newStatus) return;
    mrChanges.push({
      rule,
      kode_mr: mr.kode_mr,
      mr_id: mr.id,
      field: "status",
      before: mr.status,
      after: newStatus,
    });
    mr.status = newStatus;
  };

  // Backfill receive_record - dipakai Aturan 9. Beda dari setPoStatus/
  // setItemStatus, nilainya object (bukan string), jadi field "after" di
  // laporan Excel diringkas jadi teks (bukan [object Object]).
  const setPoReceiveRecord = (po, receiveRecord, rule) => {
    poChanges.push({
      rule,
      kode_po: po.kode_po,
      po_id: po.id,
      field: "receive_record",
      before: null,
      after: `Full match (${receiveRecord.items.length} item) - dibuat otomatis oleh migrasi`,
    });
    po.receive_record = receiveRecord;
  };

  // ---- Aturan 8 (dijalankan PALING AWAL) ----
  // MR Rejected -> semua itemnya jadi Cancelled, tanpa kecuali (bahkan yang
  // sudah Completed/Replaced - MR Rejected dianggap otoritatif). Ditaruh
  // paling awal supaya aturan 1-7 di bawah otomatis skip item-item ini
  // lewat guard NEVER_TOUCH begitu sudah jadi Cancelled.
  //
  // TIDAK butuh cek `item.part_number` (beda dari aturan lain) karena aturan
  // ini murni blanket-cancel berdasarkan status MR, tidak melakukan matching
  // ke PO manapun - guard part_number di sini sebelumnya cuma copy-paste
  // dari pola aturan lain dan salah, bikin 97 item (di production) yang
  // part_number-nya kosong lolos padahal MR-nya sudah Rejected.
  if (ruleEnabled(8)) {
    for (const mr of mrState.values()) {
      if (mr.status !== "Rejected") continue;
      for (const item of mr.orders) {
        setItemStatus(mr, item, STATUS.CANCELLED, "8");
      }
    }
  }

  // ---- Aturan 1 & 2 ----
  if (ruleEnabled(1) || ruleEnabled(2)) {
    for (const mr of mrState.values()) {
      for (const item of mr.orders) {
        if (!item.part_number || NEVER_TOUCH.has(item.status)) continue;
        const covering = coveringPos(mr.id, item.part_number);
        if (covering.length === 0) continue;
        const rejected = covering.filter((po) => po.status === "Rejected");
        const active = covering.filter((po) => po.status !== "Rejected");
        if (rejected.length === 0) continue;

        if (active.length === 0) {
          if (ruleEnabled(1) && item.status !== STATUS.COMPLETED) {
            setItemStatus(mr, item, STATUS.CANCELLED, "1");
          }
        } else if (ruleEnabled(2)) {
          for (const po of active) linkPoRef(mr, item, po.kode_po, "2");
        }
      }
    }
  }

  // ---- Aturan 3 ----
  if (ruleEnabled(3)) {
    for (const po of poState.values()) {
      const hasInvoice =
        Array.isArray(po.attachments) &&
        po.attachments.some(
          (a) => a?.type === "invoice" || isInvoiceLikeName(a?.name),
        );
      if (!hasInvoice || po.receive_record) continue;

      if (!PO_STATUS_FURTHER_ALONG.has(po.status)) {
        setPoStatus(po, "Pending Payment", "3");
      }
      if (po.mr_id == null || !Array.isArray(po.items)) continue;
      const mr = mrState.get(po.mr_id);
      if (!mr) continue;
      for (const poItem of po.items) {
        const item = mr.orders.find(
          (o) => o.part_number === poItem.part_number,
        );
        if (!item) continue;
        if (NEVER_TOUCH.has(item.status) || item.status === STATUS.COMPLETED)
          continue;
        setItemStatus(mr, item, STATUS.PENDING_BAST, "3");
      }
    }
  }

  // ---- Aturan 4 ----
  if (ruleEnabled(4)) {
    for (const mr of mrState.values()) {
      for (const item of mr.orders) {
        if (!item.part_number || !isPendingLike(item.status)) continue;
        const covering = coveringPos(mr.id, item.part_number);
        if (covering.length === 0) continue;
        for (const po of covering) linkPoRef(mr, item, po.kode_po, "4");
        const nonRejectedNew = covering.filter(
          (po) => po.status !== "Rejected" && !po.receive_record,
        );
        if (nonRejectedNew.length > 0) {
          setItemStatus(mr, item, STATUS.PENDING_BAST, "4");
        }
      }
    }
  }

  // ---- Aturan 13 ----
  // Item TANPA part_number (gap yang sama yang bikin Aturan 4 tidak bisa
  // matching) yang masih "Pending"/kosong tapi MR-nya SUDAH punya PO -> coba
  // link lewat NAMA item yang PERSIS SAMA (case-insensitive, trim) ke salah
  // satu item di PO AKTIF (bukan Rejected, belum ada receive_record) milik
  // MR yang sama. SENGAJA cuma exact-match nama, BUKAN fuzzy/mirip-mirip -
  // di data production banyak nama item MR vs nama item PO cuma "mirip"
  // (kata beda tapi barangnya kemungkinan sama, mis. "Kaos Tangan Safety"
  // vs "Safety Gloves Cut Resistant") atau malah BEDA barang sama sekali
  // (kebetulan satu MR sama dengan item lain yang sudah ada PO-nya) - itu
  // SENGAJA tidak di-link di sini (tetap Pending, perlu review manual),
  // lebih aman daripada salah sambung ke barang yang keliru.
  if (ruleEnabled(13)) {
    for (const mr of mrState.values()) {
      const posForMr = posByMr.get(mr.id) || [];
      if (posForMr.length === 0) continue;
      for (const item of mr.orders) {
        if (item.part_number || !isPendingLike(item.status)) continue;
        const itemNameNorm = (item.name || "").trim().toLowerCase();
        if (!itemNameNorm) continue;

        const matchingPos = posForMr.filter(
          (po) =>
            po.status !== "Rejected" &&
            !po.receive_record &&
            Array.isArray(po.items) &&
            po.items.some(
              (i) => (i.name || "").trim().toLowerCase() === itemNameNorm,
            ),
        );
        if (matchingPos.length === 0) continue;

        for (const po of matchingPos) linkPoRef(mr, item, po.kode_po, "13");
        setItemStatus(mr, item, STATUS.PENDING_BAST, "13");
      }
    }
  }

  // ---- Aturan 5 ----
  if (ruleEnabled(5)) {
    for (const mr of mrState.values()) {
      for (const item of mr.orders) {
        if (item.status !== STATUS.PO_CREATED) continue;
        const note = (item.status_note || "").toLowerCase();
        if (!note.trim()) continue;
        for (const po of poState.values()) {
          if (po.kode_po && note.includes(po.kode_po.toLowerCase())) {
            linkPoRef(mr, item, po.kode_po, "5");
          }
        }
      }
    }
  }

  // ---- Aturan 6 ----
  if (ruleEnabled(6)) {
    for (const mr of mrState.values()) {
      if (mr.status !== STATUS.COMPLETED) continue;
      for (const item of mr.orders) {
        if (!item.part_number || NEVER_TOUCH.has(item.status)) continue;
        const covering = coveringPos(mr.id, item.part_number);
        const nonRejectedNew = covering.filter(
          (po) => po.status !== "Rejected" && !po.receive_record,
        );
        if (nonRejectedNew.length === 0) continue;
        for (const po of nonRejectedNew) linkPoRef(mr, item, po.kode_po, "6");
        setItemStatus(mr, item, STATUS.PENDING_BAST, "6");
      }
    }
  }

  // ---- Aturan 7 ----
  if (ruleEnabled(7)) {
    for (const po of poState.values()) {
      if (po.status !== "Pending Approval") continue;
      if (!/termin/i.test(po.payment_term || "")) continue;
      if (po.receive_record) continue;

      setPoStatus(po, "Pending Payment", "7");
      if (po.mr_id == null || !Array.isArray(po.items)) continue;
      const mr = mrState.get(po.mr_id);
      if (!mr) continue;
      for (const poItem of po.items) {
        const item = mr.orders.find(
          (o) => o.part_number === poItem.part_number,
        );
        if (!item || NEVER_TOUCH.has(item.status)) continue;
        linkPoRef(mr, item, po.kode_po, "7");
        if (item.status !== STATUS.COMPLETED) {
          setItemStatus(mr, item, STATUS.PENDING_BAST, "7");
        }
      }
    }
  }

  // ---- Aturan 11 ----
  // PO yang punya lampiran ber-type "po" ATAU "finance" (bukan "invoice" -
  // itu sudah Aturan 3) tapi nama file-nya mirip invoice (kemungkinan dulu
  // salah kategori pas upload) -> MR-nya (status keseluruhan, bukan cuma
  // item) ditandai "Completed", dan PO-nya jadi "Pending Payment". Tidak
  // menimpa MR yang sudah "Rejected" (dianggap final/otoritatif, sama
  // seperti guard di Aturan 1/6/10).
  if (ruleEnabled(11)) {
    for (const po of poState.values()) {
      const hasMiscategorizedInvoice =
        Array.isArray(po.attachments) &&
        po.attachments.some(
          (a) =>
            (a?.type === "po" || a?.type === "finance") &&
            isInvoiceLikeName(a?.name),
        );
      if (!hasMiscategorizedInvoice || po.receive_record) continue;
      if (po.mr_id == null) continue;
      const mr = mrState.get(po.mr_id);
      if (!mr) continue;

      if (!PO_STATUS_FURTHER_ALONG.has(po.status)) {
        setPoStatus(po, "Pending Payment", "11");
      }
      if (mr.status !== "Rejected") {
        setMrStatus(mr, STATUS.COMPLETED, "11");
      }
    }
  }

  // ---- Aturan 9 (dijalankan PALING AKHIR - setelah status final dari
  // aturan 1-8/data lama diketahui) ----
  // PO yang status-nya "Full Received" (baik dari data lama sebelum fitur
  // checklist ada, maupun hasil po-status-migration.sql) tapi belum punya
  // `receive_record` sama sekali -> dibuatkan record asumsi qty diterima =
  // qty PO (full match), supaya PO lama juga punya riwayat receive yang
  // bisa dicetak/dilihat, konsisten dengan PO baru. `received_at` diisi
  // waktu migrasi ini dijalankan (BUKAN tanggal PO dibuat) karena qty
  // aktualnya tidak diketahui persis dari data lama - ini backfill, bukan
  // rekonstruksi riwayat asli.
  if (ruleEnabled(9)) {
    for (const po of poState.values()) {
      if (po.status !== "Full Received") continue;
      if (po.receive_record) continue;
      if (!Array.isArray(po.items) || po.items.length === 0) continue;

      const receiveRecord = {
        items: po.items
          .filter((item) => !!item.part_number)
          .map((item) => ({
            part_number: item.part_number,
            part_name: item.name,
            ordered_qty: item.qty,
            received_qty: item.qty,
          })),
        is_full_match: true,
        received_by: "",
        received_by_name: "Migrasi Data Lama (otomatis, asumsi full match)",
        received_at: new Date().toISOString(),
      };
      setPoReceiveRecord(po, receiveRecord, "9");
    }
  }

  // ---- Aturan 10 ----
  // Item TANPA part_number (jadi tidak bisa di-matching ke PO manapun lewat
  // aturan lain) yang MR-nya berstatus lama "Completed" -> ikut ditandai
  // "Completed" juga, warisan langsung dari status MR-nya (tidak ada PO/
  // receive_record yang disentuh, karena memang tidak ada cara link item
  // ini ke PO tanpa part_number). Konsisten dengan semangat Aturan 6, tapi
  // buat item yang part_number-nya kosong sehingga Aturan 6 tidak bisa jalan.
  if (ruleEnabled(10)) {
    for (const mr of mrState.values()) {
      if (mr.status !== STATUS.COMPLETED) continue;
      for (const item of mr.orders) {
        if (item.part_number || NEVER_TOUCH.has(item.status)) continue;
        setItemStatus(mr, item, STATUS.COMPLETED, "10");
      }
    }
  }

  // ---- Aturan 15 ----
  // MR tahun 2025 (kode_mr mengandung "/25/") yang statusnya masih
  // "Pending Approval" atau "On Process" (nyangkut, nggak pernah
  // dituntasin) -> di-force jadi "Completed". Ditaruh SEBELUM Aturan 12
  // supaya item-item di MR ini otomatis ikut ke-cascade jadi "Completed"
  // juga oleh Aturan 12 (bukan cuma yang statusnya "Pending" - semua item
  // non-final di MR ini, konsisten dengan semangat Aturan 12).
  if (ruleEnabled(15)) {
    for (const mr of mrState.values()) {
      if (!mr.kode_mr || !mr.kode_mr.includes("/25/")) continue;
      if (mr.status !== "Pending Approval" && mr.status !== "On Process") {
        continue;
      }
      setMrStatus(mr, STATUS.COMPLETED, "15");
    }
  }

  // ---- Aturan 12 (dijalankan PALING AKHIR - setelah aturan 11 & 15 di
  // atas, supaya MR yang BARU jadi Completed lewat aturan-aturan itu di run
  // yang sama ikut ke-cover juga) ----
  // MR yang statusnya "Completed" -> SEMUA itemnya harus ikut "selesai"
  // juga (Completed), kecuali yang sudah Cancelled/Replaced (final, tidak
  // pernah diubah lagi). Ini catch-all: kalau dokumen MR-nya sendiri sudah
  // dianggap kelar, tidak masuk akal ada item yang masih nyangkut di status
  // pertengahan (Pending/Processing/Pending BAST) - jadi menimpa/melengkapi
  // hasil Aturan 6/10 di atas (yang keduanya cuma set "Pending BAST", bukan
  // "Completed", untuk sebagian kasus).
  if (ruleEnabled(12)) {
    for (const mr of mrState.values()) {
      if (mr.status !== STATUS.COMPLETED) continue;
      for (const item of mr.orders) {
        if (NEVER_TOUCH.has(item.status)) continue;
        setItemStatus(mr, item, STATUS.COMPLETED, "12");
      }
    }
  }

  // ---- Aturan 14 ----
  // Status barang "PO Created" SUDAH TIDAK DIPAKAI LAGI di aplikasi (dilebur
  // ke "Processing" - lihat purchaseOrderService.ts/mrService.ts) - jadi
  // semua item lama yang masih "PO Created" di-convert jadi "Processing".
  // Karena "PO Created" DULU artinya "qty sudah penuh ke-cover PO" (beda
  // dari "Processing" yang berarti baru sebagian), sinyal itu dipindah ke
  // `level`: kalau level item ini belum sampai "Open 3A" (mis. masih "Open
  // 1"/"Open 2"/kosong - data lama yang levelnya juga belum sempat
  // ke-update), dinaikkan ke "Open 3A" supaya recalculateMrStatus tetap
  // mengenali item ini sebagai "sudah linked". Item yang levelnya SUDAH di
  // "Open 3A" atau lebih maju (3B/4/5/Close) TIDAK diturunkan lagi.
  const LEVEL_RANK = {
    "Open 1": 1,
    "Open 2": 2,
    "Open 3A": 3,
    "Open 3B": 3,
    "Open 4": 4,
    "Open 5": 5,
    Close: 6,
  };
  if (ruleEnabled(14)) {
    for (const mr of mrState.values()) {
      for (const item of mr.orders) {
        if (item.status !== STATUS.PO_CREATED) continue;
        setItemStatus(mr, item, STATUS.PROCESSING, "14");
        const currentRank = LEVEL_RANK[item.level] || 0;
        if (currentRank < LEVEL_RANK["Open 3A"]) {
          setItemLevel(mr, item, "Open 3A", "14");
        }
      }
    }
  }

  // ---- Laporan ----
  const byRule = {};
  for (const c of [...itemChanges, ...poChanges, ...mrChanges]) {
    byRule[c.rule] = (byRule[c.rule] || 0) + 1;
  }

  const reportPath = await writeExcelReport({
    apply: APPLY,
    onlyRules: ONLY_RULES,
    itemChanges,
    poChanges,
    mrChanges,
    byRule,
    mrs: [...mrState.values()],
    pos: [...poState.values()],
  });

  console.log(`\n=== ${APPLY ? "APPLY" : "DRY RUN"}${ONLY_RULES ? ` (rules: ${[...ONLY_RULES].join(",")})` : ""} ===`);
  console.log("Ringkasan perubahan per aturan:", byRule);
  console.log(
    `Total: ${itemChanges.length} perubahan item MR, ${mrChanges.length} perubahan status MR, ${poChanges.length} perubahan status PO.`,
  );
  console.log(`\nLaporan lengkap (styled): ${reportPath}`);

  if (!APPLY) {
    console.log(
      "\nDRY RUN selesai - TIDAK ADA yang ditulis ke DB. Buka file .xlsx di atas untuk review, lalu jalankan lagi dengan --apply kalau sudah yakin.",
    );
    return;
  }

  const changedMrIds = new Set([
    ...itemChanges.map((c) => c.mr_id),
    ...mrChanges.map((c) => c.mr_id),
  ]);
  for (const mrId of changedMrIds) {
    const mr = mrState.get(mrId);
    // Sama seperti PO di bawah: cuma kirim field yang benar-benar berubah
    // buat MR ini (item-nya lewat itemChanges, status-nya lewat mrChanges),
    // supaya MR yang cuma kena Aturan 11 (status doang, tanpa perubahan
    // item) tidak ikut nulis ulang `orders` yang sebenarnya tidak berubah.
    const mrHasItemChange = itemChanges.some((c) => c.mr_id === mrId);
    const mrHasStatusChange = mrChanges.some((c) => c.mr_id === mrId);
    const updatePayload = {};
    if (mrHasItemChange) updatePayload.orders = mr.orders;
    if (mrHasStatusChange) updatePayload.status = mr.status;

    const { error } = await supabase
      .from("material_requests")
      .update(updatePayload)
      .eq("id", mrId);
    if (error) console.error(`Gagal update MR ${mr.kode_mr}:`, error.message);
  }

  const changedPoIds = new Set(poChanges.map((c) => c.po_id));
  for (const poId of changedPoIds) {
    const po = poState.get(poId);
    // Cuma kirim field yang benar-benar berubah di PO ini (dicek dari
    // poChanges) - supaya PO yang cuma kena Aturan 9 (receive_record) tidak
    // ikut nulis ulang status yang sebenarnya tidak berubah, dan sebaliknya.
    const changedFields = new Set(
      poChanges.filter((c) => c.po_id === poId).map((c) => c.field),
    );
    const updatePayload = {};
    if (changedFields.has("status")) updatePayload.status = po.status;
    if (changedFields.has("receive_record"))
      updatePayload.receive_record = po.receive_record;

    const { error } = await supabase
      .from("purchase_orders")
      .update(updatePayload)
      .eq("id", poId);
    if (error) console.error(`Gagal update PO ${po.kode_po}:`, error.message);
  }

  console.log(
    `\nSelesai. ${changedMrIds.size} MR & ${changedPoIds.size} PO di-update.`,
  );
}

// Guard supaya main() cuma auto-jalan kalau file ini dieksekusi langsung
// (`node migrate-legacy-mr-po.mjs`), bukan pas di-import dari script lain
// (mis. buat testing writeExcelReport() secara terpisah).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("Migrasi gagal:", err);
    process.exit(1);
  });
}

export { writeExcelReport, RULE_DESCRIPTIONS, RULE_COLORS };
