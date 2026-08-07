// Diagnostik READ-ONLY: kenapa item MR masih "Pending" (menunggu) padahal
// MR-nya lama. TIDAK PERNAH menulis apa-apa ke DB - cuma SELECT + laporan
// Excel, aman dijalankan langsung ke production tanpa risiko.
//
// Latar belakang: setelah migrate-legacy-mr-po.mjs (Aturan 1-9) dijalankan,
// masih banyak item MR lama yang statusnya "Pending". Aturan 4 di script
// migrasi seharusnya sudah menangani "item Pending yang ada PO cover-nya",
// tapi cuma jalan kalau match PERSIS: item.part_number harus ada, item.status
// harus literal string "Pending" (bukan field yang kosong/null), dan PO
// yang cover-nya ketemu lewat exact match part_number. Item lama yang tidak
// memenuhi salah satu syarat itu (mis. field status-nya memang belum pernah
// diisi sama sekali di data lama, part_number kosong, atau linknya cuma ada
// di `manual_po_links` bukan part_number langsung) akan LOLOS dari Aturan 4
// dan tetap kelihatan "Pending" terus meski sebenarnya ada PO-nya.
//
// Script ini mengelompokkan SEMUA item yang levelnya masih "Pending" (atau
// field status-nya kosong/null, yang di UI ditampilkan sebagai "Pending"
// lewat normalizeMrOrders) ke beberapa kategori penyebab, supaya kita tau
// pola aslinya di production sebelum bikin aturan migrasi baru.
//
// Cara pakai:
//   export SUPABASE_URL="https://xxxx.supabase.co"
//   export SUPABASE_SERVICE_ROLE_KEY="...."
//   node supabase/diagnose-pending-items.mjs

import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Set env var SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY dulu (jangan hardcode di file ini).",
  );
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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

function styleSheet(worksheet, columns, rows) {
  worksheet.columns = columns;
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.addRows(rows);
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };
  const headerRow = worksheet.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = THIN_BORDER;
  });
  for (let r = 2; r <= rows.length + 1; r++) {
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

const CATEGORY_LABELS = {
  no_part_number: "Part number kosong - tidak bisa di-match ke PO manapun",
  no_covering_po: "Part number ada, tapi memang belum ada PO sama sekali yang cover (backlog asli)",
  covered_by_rejected_po_only: "Cuma di-cover PO yang Rejected (harusnya Cancelled - cek Aturan 1)",
  covered_by_active_po_but_stuck: "Ada PO AKTIF yang cover, tapi status tetap Pending (BUG - seharusnya kena Aturan 4)",
  has_manual_po_links_unmatched: "Ada manual_po_links tapi tidak ke-match otomatis by part_number",
  mr_not_yet_processed: "MR sendiri belum diproses (masih Pending Validation/Pending Approval)",
};

async function main() {
  const { data: mrs, error: mrErr } = await supabase
    .from("material_requests")
    .select("id, kode_mr, status, orders, created_at");
  if (mrErr) throw mrErr;

  const { data: pos, error: poErr } = await supabase
    .from("purchase_orders")
    .select("id, kode_po, mr_id, status, items");
  if (poErr) throw poErr;

  const posByMr = new Map();
  for (const po of pos) {
    if (po.mr_id == null) continue;
    if (!posByMr.has(po.mr_id)) posByMr.set(po.mr_id, []);
    posByMr.get(po.mr_id).push(po);
  }

  const rows = [];
  const categoryCounts = {};

  for (const mr of mrs) {
    const orders = Array.isArray(mr.orders) ? mr.orders : [];
    for (const item of orders) {
      const status = item.status;
      const isPending = status === "Pending" || status === null || status === undefined || status === "";
      if (!isPending) continue;

      const hasPartNumber = !!item.part_number;
      const covering = hasPartNumber
        ? (posByMr.get(mr.id) || []).filter(
            (po) =>
              Array.isArray(po.items) &&
              po.items.some((i) => i.part_number === item.part_number),
          )
        : [];
      const activeCovering = covering.filter((po) => po.status !== "Rejected");
      const hasManualLinks =
        Array.isArray(item.manual_po_links) && item.manual_po_links.length > 0;

      let category;
      if (!hasPartNumber) {
        category = "no_part_number";
      } else if (activeCovering.length > 0) {
        category = "covered_by_active_po_but_stuck";
      } else if (covering.length > 0) {
        category = "covered_by_rejected_po_only";
      } else if (hasManualLinks) {
        category = "has_manual_po_links_unmatched";
      } else if (
        mr.status === "Pending Validation" ||
        mr.status === "Pending Approval"
      ) {
        category = "mr_not_yet_processed";
      } else {
        category = "no_covering_po";
      }

      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      rows.push({
        kategori: CATEGORY_LABELS[category],
        kode_mr: mr.kode_mr,
        mr_status: mr.status,
        mr_created_at: mr.created_at,
        part_number: item.part_number || "(kosong)",
        nama_barang: item.name,
        status_raw: status === null || status === undefined ? "(field kosong/null)" : status === "" ? "(string kosong)" : status,
        jumlah_po_cover: covering.length,
        jumlah_po_aktif_cover: activeCovering.length,
        ada_manual_po_links: hasManualLinks ? "Ya" : "Tidak",
      });
    }
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "diagnose-pending-items.mjs";
  workbook.created = new Date();

  const ringkasan = workbook.addWorksheet("Ringkasan");
  ringkasan.columns = [
    { header: "Kategori Penyebab", key: "k", width: 70 },
    { header: "Jumlah Item", key: "v", width: 15 },
  ];
  ringkasan.getRow(1).font = { bold: true, color: { argb: HEADER_FONT } };
  ringkasan.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  ringkasan.getRow(1).eachCell((c) => (c.border = THIN_BORDER));
  Object.entries(CATEGORY_LABELS).forEach(([key, label]) => {
    const row = ringkasan.addRow({ k: label, v: categoryCounts[key] || 0 });
    row.eachCell((c) => (c.border = THIN_BORDER));
  });
  const totalRow = ringkasan.addRow({ k: "TOTAL item masih Pending", v: rows.length });
  totalRow.font = { bold: true };
  totalRow.eachCell((c) => (c.border = THIN_BORDER));

  const detailSheet = workbook.addWorksheet("Detail Item Pending");
  styleSheet(
    detailSheet,
    [
      { header: "Kategori Penyebab", key: "kategori", width: 55 },
      { header: "Kode MR", key: "kode_mr", width: 20 },
      { header: "Status MR", key: "mr_status", width: 16 },
      { header: "MR Dibuat", key: "mr_created_at", width: 20 },
      { header: "Part Number", key: "part_number", width: 18 },
      { header: "Nama Barang", key: "nama_barang", width: 28 },
      { header: "Status Item (raw)", key: "status_raw", width: 20 },
      { header: "Jml PO Cover", key: "jumlah_po_cover", width: 14 },
      { header: "Jml PO Aktif Cover", key: "jumlah_po_aktif_cover", width: 16 },
      { header: "Ada manual_po_links?", key: "ada_manual_po_links", width: 18 },
    ],
    rows.sort((a, b) => new Date(a.mr_created_at) - new Date(b.mr_created_at)),
  );

  const reportDir = path.join(__dirname, "migration-reports");
  fs.mkdirSync(reportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(reportDir, `diagnosa-pending-${stamp}.xlsx`);
  await workbook.xlsx.writeFile(filePath);

  console.log("=== DIAGNOSTIK ITEM PENDING (read-only, tidak nulis apa-apa) ===\n");
  console.table(
    Object.fromEntries(
      Object.entries(CATEGORY_LABELS).map(([key, label]) => [
        label,
        categoryCounts[key] || 0,
      ]),
    ),
  );
  console.log(`\nTotal item masih Pending: ${rows.length}`);
  console.log(`\nLaporan lengkap: ${filePath}`);
}

main().catch((err) => {
  console.error("Diagnostik gagal:", err);
  process.exit(1);
});
