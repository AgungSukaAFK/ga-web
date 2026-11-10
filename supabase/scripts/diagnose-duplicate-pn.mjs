// Diagnostik READ-ONLY: MR yang punya part_number kembar (barang sama
// diinput >1x) dan apakah status baris-barisnya ikut maju bareng secara
// salah (bug lama: penerimaan/kirim/konfirmasi dikunci per part_number,
// jadi satu baris diproses -> kembarannya ikut). TIDAK menulis apa pun ke DB.
//
// Cara pakai:
//   export SUPABASE_URL="https://xxxx.supabase.co"
//   export SUPABASE_SERVICE_ROLE_KEY="...."
//   node supabase/scripts/diagnose-duplicate-pn.mjs [output.json]

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Set env var SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY dulu.");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const outFile = process.argv[2];

// Status yang berarti barang sudah sampai GA atau lebih jauh.
const ADVANCED = ["Diterima GA", "On Delivery", "Pending BAST", "Completed"];
const INACTIVE_PO = ["Rejected", "Cancelled"];

const fetchAll = async (table, columns) => {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
};

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const mrs = await fetchAll("material_requests", "id, kode_mr, status, orders");
const pos = await fetchAll(
  "purchase_orders",
  "id, kode_po, mr_id, status, items, receive_record, goods_receipt",
);
const posByMr = new Map();
for (const po of pos) {
  if (!po.mr_id) continue;
  posByMr.set(po.mr_id, [...(posByMr.get(po.mr_id) || []), po]);
}

const report = [];
for (const mr of mrs) {
  const orders = Array.isArray(mr.orders) ? mr.orders : [];
  const groups = new Map();
  orders.forEach((o, index) => {
    if (!o?.part_number) return;
    groups.set(o.part_number, [...(groups.get(o.part_number) || []), index]);
  });
  for (const [pn, indices] of groups) {
    if (indices.length < 2) continue;
    const mrPos = (posByMr.get(mr.id) || []).filter(
      (po) => !INACTIVE_PO.includes(po.status),
    );
    const poLines = [];
    let orderedQty = 0;
    let gaReceivedQty = 0;
    let qrReceivedQty = 0;
    for (const po of mrPos) {
      const lines = (po.items || []).filter((i) => i.part_number === pn);
      const recs = (po.receive_record?.items || []).filter((i) => i.part_number === pn);
      const grs = (po.goods_receipt?.items || []).filter((i) => i.part_number === pn);
      if (!lines.length && !recs.length && !grs.length) continue;
      orderedQty += lines.reduce((s, l) => s + num(l.qty), 0);
      gaReceivedQty += recs.reduce((s, r) => s + num(r.received_qty), 0);
      qrReceivedQty += grs.reduce((s, g) => s + num(g.qty_received), 0);
      poLines.push({
        kode_po: po.kode_po,
        status: po.status,
        po_qty: lines.map((l) => num(l.qty)),
        received_qty: recs.map((r) => num(r.received_qty)),
        qr_received: grs.map((g) => num(g.qty_received)),
      });
    }
    const rows = indices.map((index) => {
      const o = orders[index];
      return {
        index,
        name: o.name,
        qty: num(o.qty),
        status: o.status || "Pending",
        level: o.level || null,
        po_refs: o.po_refs || [],
        qty_sent: o.delivery_info?.qty_sent ?? null,
        sent_at: o.delivery_info?.sent_at ?? null,
        requester_received: (o.requester_receipts || []).reduce(
          (s, r) => s + num(r.qty),
          0,
        ),
        bast_files: (o.bast_attachments || []).length,
      };
    });
    const advanced = rows.filter((r) => ADVANCED.includes(r.status));
    const advancedQty = advanced.reduce((s, r) => s + r.qty, 0);
    const stockQty = indices.reduce(
      (s, i) =>
        s + (orders[i].stock_fulfillments || []).reduce((a, f) => a + num(f.qty), 0),
      0,
    );
    const reasons = [];
    if (advanced.length >= 2 && gaReceivedQty + stockQty < advancedQty) {
      reasons.push(
        `${advanced.length} baris sudah maju (total ${advancedQty}) tapi qty diterima GA cuma ${gaReceivedQty}`,
      );
    }
    const sameDelivery = advanced.filter(
      (r) => r.sent_at && advanced.some((x) => x !== r && x.sent_at === r.sent_at),
    );
    if (sameDelivery.length >= 2 && orderedQty < advancedQty) {
      reasons.push("baris kembar terkirim di pengiriman yang sama melebihi qty PO");
    }
    report.push({
      kode_mr: mr.kode_mr,
      mr_id: mr.id,
      mr_status: mr.status,
      part_number: pn,
      suspicious: reasons.length > 0,
      reasons,
      total_mr_qty: rows.reduce((s, r) => s + r.qty, 0),
      po_ordered_qty: orderedQty,
      ga_received_qty: gaReceivedQty,
      qr_received_qty: qrReceivedQty,
      rows,
      pos: poLines,
    });
  }
}

const suspicious = report.filter((r) => r.suspicious);
console.log(`MR dgn PN kembar: ${new Set(report.map((r) => r.kode_mr)).size} MR, ${report.length} grup PN`);
console.log(`Grup yang dicurigai salah status: ${suspicious.length}`);
for (const r of report) {
  console.log(
    `\n${r.suspicious ? "[!]" : "   "} ${r.kode_mr} | ${r.part_number} | MR qty ${r.total_mr_qty}, PO ${r.po_ordered_qty}, diterima GA ${r.ga_received_qty}, QR ${r.qr_received_qty}`,
  );
  for (const reason of r.reasons) console.log(`      -> ${reason}`);
  for (const row of r.rows) {
    console.log(
      `      #${row.index} qty ${row.qty} | ${row.status} | ${row.level} | PO ${row.po_refs.join(",") || "-"} | kirim ${row.qty_sent ?? "-"} | konfirmasi ${row.requester_received} | bast ${row.bast_files}`,
    );
  }
  for (const p of r.pos) {
    console.log(
      `      ${p.kode_po} (${p.status}) qty PO [${p.po_qty}] diterima [${p.received_qty}] QR [${p.qr_received}]`,
    );
  }
}
if (outFile) {
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(`\nDetail JSON: ${outFile}`);
}
