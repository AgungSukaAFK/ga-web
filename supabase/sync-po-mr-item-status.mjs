// Migrasi: sinkronkan status/level item MR yang "ketinggalan" dari PO-nya.
//
// Latar belakang: po-status-migration.sql (Revisi 6 Agustus) & backfill
// receive_record utk PO lama (po-receive-record-setup.sql - ditandai
// receive_record.received_by_name = "Migrasi Data Lama (otomatis, asumsi
// full match)") nulis LANGSUNG ke kolom `purchase_orders` pakai SQL, TIDAK
// lewat fungsi JS `submitReceiveRecord()` (services/purchaseOrderService.ts)
// - jadi efek samping submitReceiveRecord yang harusnya update
// `material_requests.orders` (status item -> "Pending BAST"/"Processing",
// level -> "Open 5") gak pernah kejadian utk PO2 yang di-backfill itu. PO-nya
// sudah "Full Received"/"Partial Receive", tapi item MR yang di-cover-nya
// masih keliatan "Processing" - status MR pun ikut nyangkut, gak pernah naik
// ke "Pending Receive"/"Partial Receive"/"Full Received" yang seharusnya.
//
// Script ini nyari SEMUA PO status Full/Partial Receive yang punya
// receive_record, cocokin ke item MR by part_number (guard sama persis
// seperti submitReceiveRecord: item cuma disentuh kalau statusnya masih
// "PO Created"/"Processing"/"Pending BAST", dan levelnya belum lebih maju
// dari "Open 5"), lalu:
//   1. Update item.status/item.level di `material_requests.orders`.
//   2. Hitung ulang mr.status & mr.level (logic sama persis dgn
//      recalculateMrStatus/recalculateMrLevel di services/mrService.ts).
//
// Cara pakai (baca kredensial LANGSUNG dari .env di root project - PRODUKSI,
// bukan .env.development.local - supaya gak ketuker ke DB local):
//   node supabase/sync-po-mr-item-status.mjs                # DRY RUN, cuma laporan .xlsx
//   node supabase/sync-po-mr-item-status.mjs --apply         # beneran nulis ke DB

import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(filePath) {
  const out = {};
  const txt = fs.readFileSync(filePath, "utf8");
  for (const line of txt.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const rootEnvPath = path.join(__dirname, "..", ".env");
const fileEnv = fs.existsSync(rootEnvPath) ? loadEnvFile(rootEnvPath) : {};

// process.env menang kalau memang di-export manual, fallback ke .env root
// (produksi) kalau tidak.
const SUPABASE_URL = process.env.SUPABASE_URL || fileEnv.SUPABASE_URL;
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Tidak ketemu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (baik di env maupun di .env root project).",
  );
  process.exit(1);
}
console.log(`Target DB: ${SUPABASE_URL}\n`);
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const APPLY = process.argv.includes("--apply");

const LINKED_LEVELS = new Set(["Open 3A", "Open 3B", "Open 4", "Open 5", "Close"]);
const LEVEL_RANK = { "Open 1": 1, "Open 2": 2, "Open 3A": 3, "Open 3B": 3, "Open 4": 4, "Open 5": 5, Close: 6 };
const guardOk = (status) =>
  status === "PO Created" || status === "Processing" || status === "Pending BAST";

// --- persis recalculateMrStatus (services/mrService.ts) ---
function computeMrStatus(currentStatus, orders) {
  const PRE_PO_STATUSES = ["Pending Validation", "On Hold", "Pending Approval", "Rejected"];
  if (PRE_PO_STATUSES.includes(currentStatus)) return currentStatus;

  const relevant = orders.filter((i) => i.status !== "Cancelled");
  if (relevant.length === 0) return currentStatus;

  const allLinked = relevant.every(
    (i) =>
      i.status === "Pending BAST" ||
      i.status === "Completed" ||
      (!!i.level && LINKED_LEVELS.has(i.level)),
  );

  if (currentStatus === "Waiting PO") {
    return allLinked ? "On Process" : currentStatus;
  }

  const allCompleted = relevant.every((i) => i.status === "Completed");
  const someCompleted = relevant.some((i) => i.status === "Completed");
  return allCompleted
    ? "Full Received"
    : allLinked
      ? someCompleted
        ? "Partial Receive"
        : "Pending Receive"
      : "On Process";
}

// --- persis recalculateMrLevel (services/mrService.ts) ---
function computeMrLevel(currentLevel, orders) {
  const relevant = orders.filter((i) => i.status !== "Cancelled" && i.status !== "Replaced");
  if (relevant.length === 0) return currentLevel;
  const allClosed = relevant.every((i) => i.level === "Close");
  return allClosed ? "CLOSE" : "OPEN";
}

async function main() {
  const { data: mrs, error: mrErr } = await supabase
    .from("material_requests")
    .select("id, kode_mr, status, level, orders");
  if (mrErr) throw mrErr;
  const mrById = new Map(mrs.map((m) => [m.id, { ...m, orders: Array.isArray(m.orders) ? [...m.orders.map((o) => ({ ...o }))] : [] }]));

  const { data: pos, error: poErr } = await supabase
    .from("purchase_orders")
    .select("id, kode_po, mr_id, status, receive_record")
    .in("status", ["Full Received", "Partial Receive"])
    .not("receive_record", "is", null);
  if (poErr) throw poErr;

  const itemChanges = []; // laporan per item
  const touchedMrIds = new Set();

  for (const po of pos) {
    if (!po.mr_id || !mrById.has(po.mr_id)) continue;
    const mr = mrById.get(po.mr_id);
    const rrItems = Array.isArray(po.receive_record?.items) ? po.receive_record.items : [];
    if (rrItems.length === 0) continue;
    const isBackfilled = (po.receive_record?.received_by_name || "").includes("Migrasi Data Lama");

    for (const rrItem of rrItems) {
      const idx = mr.orders.findIndex((o) => o.part_number === rrItem.part_number);
      if (idx === -1) continue;
      const order = mr.orders[idx];
      if (!guardOk(order.status)) continue;

      const targetStatus = rrItem.received_qty === rrItem.ordered_qty ? "Pending BAST" : "Processing";
      const targetLevel = "Open 5";

      if (order.status === targetStatus && order.level === targetLevel) continue;
      if ((LEVEL_RANK[order.level] || 0) > LEVEL_RANK[targetLevel]) continue;

      itemChanges.push({
        kode_mr: mr.kode_mr,
        mr_id: mr.id,
        kode_po: po.kode_po,
        po_status: po.status,
        migrated_backfill: isBackfilled,
        part_number: rrItem.part_number,
        part_name: rrItem.part_name,
        received_qty: rrItem.received_qty,
        ordered_qty: rrItem.ordered_qty,
        status_before: order.status,
        level_before: order.level || "(kosong)",
        status_after: targetStatus,
        level_after: targetLevel,
      });

      mr.orders[idx] = {
        ...order,
        status: targetStatus,
        level: targetLevel,
      };
      touchedMrIds.add(mr.id);
    }
  }

  const mrChanges = []; // laporan status/level MR
  for (const mrId of touchedMrIds) {
    const mr = mrById.get(mrId);
    const newStatus = computeMrStatus(mr.status, mr.orders);
    const newLevel = computeMrLevel(mr.level, mr.orders);
    if (newStatus !== mr.status || newLevel !== mr.level) {
      mrChanges.push({
        kode_mr: mr.kode_mr,
        mr_id: mr.id,
        status_before: mr.status,
        status_after: newStatus,
        level_before: mr.level,
        level_after: newLevel,
      });
    }
    mr._newStatus = newStatus;
    mr._newLevel = newLevel;
  }

  console.log(`Mode: ${APPLY ? "APPLY (nulis ke DB)" : "DRY RUN (belum nulis ke DB)"}`);
  console.log(`Item MR yang disinkronkan: ${itemChanges.length}`);
  console.log(`MR yang status/level-nya berubah: ${mrChanges.length}\n`);
  for (const c of itemChanges) {
    console.log(`${c.kode_mr} <- ${c.kode_po} | ${c.part_number}: ${c.status_before}/${c.level_before} -> ${c.status_after}/${c.level_after}`);
  }
  console.log();
  for (const c of mrChanges) {
    console.log(`${c.kode_mr}: status ${c.status_before} -> ${c.status_after}, level ${c.level_before} -> ${c.level_after}`);
  }

  if (APPLY) {
    for (const mrId of touchedMrIds) {
      const mr = mrById.get(mrId);
      const { error } = await supabase
        .from("material_requests")
        .update({ orders: mr.orders, status: mr._newStatus, level: mr._newLevel })
        .eq("id", mrId);
      if (error) console.error(`Gagal update MR ${mr.kode_mr}:`, error);
    }
    console.log("\nSELESAI - perubahan sudah ditulis ke DB.");
  } else {
    console.log("\nDRY RUN selesai - TIDAK ADA yang ditulis ke DB. Review laporan .xlsx, jalankan lagi dengan --apply kalau sudah yakin.");
  }

  // --- laporan Excel ---
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "sync-po-mr-item-status.mjs";
  workbook.created = new Date();

  const itemSheet = workbook.addWorksheet("Perubahan Item");
  itemSheet.columns = [
    { header: "Kode MR", key: "kode_mr", width: 22 },
    { header: "Kode PO", key: "kode_po", width: 22 },
    { header: "Status PO", key: "po_status", width: 16 },
    { header: "Dari Backfill Migrasi?", key: "migrated_backfill", width: 20 },
    { header: "Part Number", key: "part_number", width: 16 },
    { header: "Nama Barang", key: "part_name", width: 30 },
    { header: "Qty Diterima", key: "received_qty", width: 12 },
    { header: "Qty Order", key: "ordered_qty", width: 12 },
    { header: "Status Sebelum", key: "status_before", width: 16 },
    { header: "Level Sebelum", key: "level_before", width: 14 },
    { header: "Status Sesudah", key: "status_after", width: 16 },
    { header: "Level Sesudah", key: "level_after", width: 14 },
  ];
  itemSheet.addRows(itemChanges);
  itemSheet.getRow(1).font = { bold: true };

  const mrSheet = workbook.addWorksheet("Perubahan Status MR");
  mrSheet.columns = [
    { header: "Kode MR", key: "kode_mr", width: 22 },
    { header: "Status Sebelum", key: "status_before", width: 16 },
    { header: "Status Sesudah", key: "status_after", width: 16 },
    { header: "Level Sebelum", key: "level_before", width: 14 },
    { header: "Level Sesudah", key: "level_after", width: 14 },
  ];
  mrSheet.addRows(mrChanges);
  mrSheet.getRow(1).font = { bold: true };

  const reportDir = path.join(__dirname, "migration-reports");
  fs.mkdirSync(reportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(reportDir, `sync-po-mr-item-${APPLY ? "apply" : "dryrun"}-${stamp}.xlsx`);
  await workbook.xlsx.writeFile(filePath);
  console.log(`\nLaporan: ${filePath}`);
}

main().catch((err) => {
  console.error("Migrasi gagal:", err);
  process.exit(1);
});
