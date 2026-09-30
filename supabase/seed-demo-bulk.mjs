// Seed data dummy TAMBAHAN (banyak) untuk local dev - buat screenshot
// dashboard, list MR/PO, history vendor, dll. BUKAN untuk production!
//
// Nambah: vendor baru, ~150 MR + PO-nya (Jan-Sep 2026, semua status),
// dan item request. Item sengaja dibeli berulang dari beberapa vendor
// dengan harga beda-beda supaya popover "History Vendor" terlihat ramai.
//
// Semua baris dummy pakai id 1000-1999 (MR/PO/item_requests) supaya
// gampang dibersihkan. Deterministik (seeded RNG) - aman dijalankan ulang
// (baris lama dihapus dulu).
//
// Jalankan (butuh `supabase start` + seed-demo-users.mjs sudah jalan):
//   node supabase/seed-demo-bulk.mjs          # isi / isi ulang
//   node supabase/seed-demo-bulk.mjs --clean  # hapus data dummy ini saja

import { execFileSync } from "node:child_process";

const DB_CONTAINER = "supabase_db_ga-web";
const ID_START = 1000;
const ID_END = 1999;
const MR_COUNT = 150;
const COMPANY = "GMI";

const query = (sql) => {
  const out = execFileSync(
    "docker",
    ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-At", "-c", `select coalesce(json_agg(t), '[]') from (${sql}) t`],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  return JSON.parse(out.trim());
};

const run = (sql) => {
  execFileSync(
    "docker",
    ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-q", "-v", "ON_ERROR_STOP=1"],
    { input: sql, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["pipe", "inherit", "inherit"] }
  );
};

const CLEAN_SQL = `
begin;
delete from public.purchase_orders where id between ${ID_START} and ${ID_END};
delete from public.cost_center_history where mr_id between ${ID_START} and ${ID_END};
delete from public.material_requests where id between ${ID_START} and ${ID_END};
delete from public.item_requests where id between ${ID_START} and ${ID_END};
update public.document_number_counters c
  set last_number = coalesce((
    select max((regexp_match(kode_mr, '/([0-9]+)$'))[1]::int) from public.material_requests
    where company_code = c.company_code), 0)
  where c.doc_type = 'MR' and c.company_code = '${COMPANY}' and c.year = 2026;
update public.document_number_counters c
  set last_number = coalesce((
    select max((regexp_match(kode_po, '/([0-9]+)$'))[1]::int) from public.purchase_orders
    where company_code = c.company_code), 0)
  where c.doc_type = 'PO' and c.company_code = '${COMPANY}' and c.year = 2026;
commit;
`;

// ---------- RNG ----------
let seed = 20260930;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const weighted = (pairs) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of pairs) if ((r -= w) < 0) return v;
  return pairs[pairs.length - 1][0];
};
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const roundTo = (n, step) => Math.max(step, Math.round(n / step) * step);
const sqlStr = (s) => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const sqlJson = (v, cast = "jsonb") => (v == null ? "null" : `${sqlStr(JSON.stringify(v))}::${cast}`);

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const NOW = new Date("2026-09-30T08:00:00Z");

// ---------- master data ----------
const NEW_VENDORS = [
  ["VDR-016", "PT Surya Teknik Abadi", "HO", "Bambang Wijaya", "Jl. Gatot Subroto No. 88, Jakarta"],
  ["VDR-017", "CV Mega Office Supply", "Branch", "Rina Marlina", "Jl. Ahmad Yani No. 21, Palembang"],
  ["VDR-018", "PT Global Komputindo", "HO", "Hendra Gunawan", "Jl. Mangga Dua Raya No. 5, Jakarta"],
  ["VDR-019", "Toko Berkah Elektronik", "Site", "Slamet Riyadi", "Jl. Pasar Baru No. 3, Tanjung Enim"],
  ["VDR-020", "PT Indo Safety Pratama", "HO", "Yuliana Sari", "Jl. Raya Bekasi Km 18, Bekasi"],
  ["VDR-021", "CV Sentosa Jaya Motor", "Branch", "Agus Salim", "Jl. MT Haryono No. 45, Balikpapan"],
  ["VDR-022", "PT Kimia Bersih Nusantara", "HO", "Lestari Handayani", "Jl. Daan Mogot No. 12, Tangerang"],
  ["VDR-023", "Bhinneka.com", "HO", "Customer Care", "Jl. Gunung Sahari No. 73C, Jakarta"],
  ["VDR-024", "Toko Maju Bersama", "Site", "Hasan Basri", "Jl. Lintas Sumatera No. 9, Muara Enim"],
  ["VDR-025", "PT Andalan Sparepart Utama", "Branch", "Joko Susilo", "Jl. Soekarno Hatta No. 101, Bandung"],
];

const DEPT_ABBR = {
  "Human Resources": "HR",
  "General Affair": "GA",
  "HRGA-HSE": "HRGA-HSE",
  Marketing: "MKT",
  Produksi: "PROD",
  K3: "HSE",
  Finance: "FIN",
  IT: "IT",
  Logistik: "LOG",
  Purchasing: "PUR",
  Warehouse: "WH",
  Service: "SVC",
  "General Manager": "GM",
  "Executive Manager": "EM",
  "Boards of Director": "BOD",
  Legal: "LGL",
};

// Barang yang cocok per kategori MR (prefix part_number).
const KATEGORI = [
  ["ATK", ["ATK"], 18],
  ["Kebutuhan Kantor", ["ATK", "GA"], 14],
  ["Consumable", ["GA"], 14],
  ["Safety Equipment", ["K3"], 12],
  ["Sparepart Mesin", ["SP"], 12],
  ["Maintenance", ["SP", "GA"], 8],
  ["Asset/Inventaris", ["IT"], 12],
  ["Jasa Service", ["SP", "IT"], 4],
];

// Vendor "langganan" per kelompok barang - tiap barang dibeli dari 3-5
// vendor supaya history vendor-nya bervariasi.
const VENDOR_POOL = {
  ATK: ["VDR-008", "VDR-017", "VDR-012", "VDR-013", "VDR-024", "VDR-001"],
  IT: ["VDR-018", "VDR-023", "VDR-012", "VDR-013", "VDR-019", "VDR-005"],
  GA: ["VDR-010", "VDR-022", "VDR-024", "VDR-004", "VDR-013", "VDR-001"],
  K3: ["VDR-007", "VDR-020", "VDR-012", "VDR-001", "VDR-004"],
  SP: ["VDR-003", "VDR-025", "VDR-021", "VDR-009", "VDR-011", "VDR-016", "VDR-014"],
};

const REMARKS = [
  "Kebutuhan rutin bulanan.",
  "Stok habis, mohon segera diproses.",
  "Kebutuhan mendesak untuk proyek berjalan.",
  "Penggantian barang rusak.",
  "Kebutuhan tambahan dari user lapangan.",
  "Untuk karyawan baru.",
  "Persiapan audit internal.",
  "Kebutuhan operasional site.",
  "Pengadaan sesuai budget kuartal.",
  "Permintaan dari kepala departemen.",
];
const DISCUSS = [
  "Mohon segera diproses, terima kasih.",
  "Sudah dicek stok gudang, memang kosong.",
  "Apakah bisa pakai merk lain yang setara?",
  "Boleh, asal spesifikasinya sama.",
  "Vendor sudah konfirmasi ready stock.",
  "Barang sudah sampai di GA, silakan diambil.",
  "Estimasi kirim 3-5 hari kerja.",
  "Tolong lampirkan foto barang yang rusak.",
];
const SITES = ["Head Office", "Head Office", "Head Office", "Site Tanjung Enim", "Site Balikpapan", "Branch Palembang"];
const SHIPPING = {
  "Head Office": "Head Office GMI, Jl. Industri No. 1",
  "Site Tanjung Enim": "Site Tanjung Enim, Jl. Lintas Sumatera Km 7",
  "Site Balikpapan": "Site Balikpapan, Jl. Mulawarman No. 30",
  "Branch Palembang": "Branch Palembang, Jl. Demang Lebar Daun No. 15",
};
const PAYMENT_TERMS = ["COD", "Net 14", "Net 30", "Full Payment", "DP 30% - Pelunasan 70%"];
const NEW_ITEM_REQ = [
  ["Kursi Kerja Ergonomis", "Asset/Inventaris", "Unit"],
  ["Headset USB Logitech H390", "Asset/Inventaris", "Unit"],
  ["Papan Tulis Whiteboard 120x240", "Kebutuhan Kantor", "Unit"],
  ["Toner HP 85A", "ATK", "Pcs"],
  ["Kacamata Safety Anti Fog", "Safety Equipment", "Pcs"],
  ["Earplug Busa", "Safety Equipment", "Box"],
  ["Filter Oli Hino Dutro", "Sparepart Mesin", "Pcs"],
  ["Grease Lithium 5kg", "Maintenance", "Pail"],
  ["Hand Sanitizer 5L", "Consumable", "Jerigen"],
  ["Router Mikrotik hAP ac2", "Asset/Inventaris", "Unit"],
  ["Label Printer Brother", "Asset/Inventaris", "Unit"],
  ["Lampu LED 18W", "Maintenance", "Pcs"],
  ["Teh Celup Sariwangi", "Consumable", "Box"],
  ["Kabel Roll 10m", "Kebutuhan Kantor", "Pcs"],
  ["Body Harness Full", "Safety Equipment", "Unit"],
  ["Webcam Logitech C270", "Asset/Inventaris", "Unit"],
  ["Cutter Besar Kenko", "ATK", "Pcs"],
  ["Dispenser Air Miyako", "Kebutuhan Kantor", "Unit"],
  ["Sealant Silikon", "Maintenance", "Pcs"],
  ["Baterai AA Alkaline", "ATK", "Pack"],
];

// ---------- main ----------
function main() {
  if (process.argv.includes("--clean")) {
    run(CLEAN_SQL);
    console.log("Data dummy bulk dihapus.");
    return;
  }

  // Vendor baru dulu (idempotent), lalu baca master data.
  run(
    NEW_VENDORS.map(
      ([kode, nama, tipe, pic, alamat]) =>
        `insert into public.vendors (kode_vendor, nama_vendor, tipe_vendor, pic_contact_person, alamat, email)
         values (${sqlStr(kode)}, ${sqlStr(nama)}, ${sqlStr(tipe)}, ${sqlStr(pic)}, ${sqlStr(alamat)}, ${sqlStr(`sales@${kode.toLowerCase()}.co.id`)})
         on conflict (kode_vendor) do nothing;`
    ).join("\n")
  );
  run(CLEAN_SQL);

  const vendors = Object.fromEntries(
    query("select id, kode_vendor, nama_vendor, tipe_vendor, pic_contact_person, alamat, email from public.vendors").map((v) => [v.kode_vendor, v])
  );
  const barang = query("select id, part_number, part_name, uom, last_purchase_price from public.barang order by id");
  const profiles = query("select id, role, department, email from public.profiles where email like '%@demo.com'");
  const costCenters = query("select id, code from public.cost_centers order by id");
  const counters = Object.fromEntries(
    query(`select doc_type, last_number from public.document_number_counters where company_code = '${COMPANY}' and year = 2026`).map((c) => [c.doc_type, c.last_number])
  );

  const requesters = profiles.filter((p) => p.role === "requester");
  const approverOf = (dept) => profiles.find((p) => p.role === "approver" && p.department === dept);
  const admins = profiles.filter((p) => p.role === "admin");
  const approval = (p, type, status, at) => ({
    nama: p.email,
    role: p.role,
    type,
    email: p.email,
    status,
    userid: p.id,
    department: p.department,
    processed_at: status === "pending" ? null : new Date(at).toISOString(),
  });

  const barangByPrefix = (prefix) => barang.filter((b) => b.part_number.startsWith(prefix + "-"));
  // Harga dasar per vendor per barang (tetap), + fluktuasi kecil per PO.
  const vendorFactor = {};
  const priceFor = (b, kodeVendor) => {
    const key = `${b.id}|${kodeVendor}`;
    vendorFactor[key] ??= 0.85 + rand() * 0.35;
    const base = Number(b.last_purchase_price) || 50000;
    return roundTo(base * vendorFactor[key] * (0.95 + rand() * 0.1), base >= 100000 ? 5000 : 500);
  };

  let mrNo = counters.MR ?? 0;
  let poNo = counters.PO ?? 0;
  let mrId = ID_START;
  let poId = ID_START;
  const mrRows = [];
  const poRows = [];

  const start = new Date("2026-01-05T01:00:00Z").getTime();
  const end = NOW.getTime() - 2 * DAY;
  const times = Array.from({ length: MR_COUNT }, () => {
    // Makin ke bulan terakhir makin padat.
    const t = Math.pow(rand(), 0.75);
    return start + t * (end - start) + int(0, 9) * HOUR;
  }).sort((a, b) => a - b);

  for (const createdMs of times) {
    const created = new Date(createdMs);
    const ageDays = (NOW.getTime() - createdMs) / DAY;
    const req = pick(requesters);
    const dept = req.department;
    const [kategori, prefixes] = weighted(KATEGORI.map((k) => [[k[0], k[1]], k[2]]));
    const pool = prefixes.flatMap(barangByPrefix);
    const items = shuffle(pool).slice(0, int(1, Math.min(5, pool.length)));

    // Status MR berdasar umur - yang lama kebanyakan sudah selesai.
    const status =
      ageDays > 75
        ? weighted([["Full Received", 85], ["Rejected", 6], ["Partial Receive", 5], ["Pending Receive", 4]])
        : ageDays > 30
        ? weighted([["Full Received", 45], ["Partial Receive", 18], ["Pending Receive", 17], ["On Process", 10], ["Rejected", 5], ["Waiting PO", 5]])
        : ageDays > 10
        ? weighted([["Pending Receive", 22], ["On Process", 25], ["Partial Receive", 10], ["Full Received", 10], ["Waiting PO", 18], ["Rejected", 5], ["Pending Approval", 10]])
        : weighted([["Pending Validation", 30], ["Pending Approval", 30], ["Waiting PO", 20], ["On Process", 12], ["Rejected", 8]]);

    const { level, itemStatus } = {
      "Pending Validation": { level: "OPEN 1", itemStatus: "Pending" },
      "Pending Approval": { level: "OPEN 1", itemStatus: "Pending" },
      Rejected: { level: "OPEN 1", itemStatus: "Cancelled" },
      "Waiting PO": { level: "OPEN 2", itemStatus: "Pending" },
      "On Process": { level: "OPEN 3A", itemStatus: "Processing" },
      "Pending Receive": { level: "OPEN 4", itemStatus: "Dikirim Vendor" },
      "Partial Receive": { level: "OPEN 5", itemStatus: "Diterima GA" },
      "Full Received": { level: "CLOSE 3", itemStatus: "Completed" },
    }[status];

    mrNo += 1;
    const id = mrId++;
    const kodeMr = `${COMPANY}/MR/${ROMAN[created.getUTCMonth()]}/26/${DEPT_ABBR[dept] ?? "HO"}/${mrNo}`;
    const site = pick(SITES);
    const cc = pick(costCenters);
    const hasPo = ["On Process", "Pending Receive", "Partial Receive", "Full Received"].includes(status);

    // Pecah item ke 1-2 PO (vendor beda) kalau item-nya banyak.
    const poGroups = [];
    if (hasPo) {
      const split = items.length >= 3 && rand() < 0.35 ? 2 : 1;
      const cut = Math.ceil(items.length / split);
      for (let g = 0; g < split; g++) poGroups.push(items.slice(g * cut, (g + 1) * cut));
    }
    const poKodes = poGroups.map(() => {
      poNo += 1;
      return poNo;
    });

    const orders = items.map((b) => {
      const gi = poGroups.findIndex((g) => g.includes(b));
      return {
        qty: String(int(1, b.uom === "Unit" ? 4 : 20)),
        uom: b.uom,
        url: "",
        name: b.part_name,
        note: "",
        level,
        status: itemStatus,
        po_refs: gi >= 0 ? [`__PO_${poKodes[gi]}__`] : [],
        barang_id: b.id,
        part_number: b.part_number,
        estimasi_harga: Number(b.last_purchase_price) || 50000,
      };
    });
    const costEst = orders.reduce((s, o) => s + Number(o.qty) * o.estimasi_harga, 0);

    const deptApprover = approverOf(dept) ?? approverOf("General Affair");
    const gm = approverOf("General Manager");
    const mrApprovals =
      status === "Pending Validation"
        ? [approval(deptApprover, "Menyetujui", "pending"), approval(gm, "Mengetahui", "pending")]
        : status === "Pending Approval"
        ? [approval(deptApprover, "Menyetujui", "approved", createdMs + HOUR), approval(gm, "Mengetahui", "pending")]
        : status === "Rejected"
        ? [approval(deptApprover, "Menyetujui", "approved", createdMs + HOUR), approval(gm, "Mengetahui", "rejected", createdMs + 5 * HOUR)]
        : [approval(deptApprover, "Menyetujui", "approved", createdMs + HOUR), approval(gm, "Mengetahui", "approved", createdMs + 3 * HOUR)];

    const discussions = Array.from({ length: int(0, 3) }, (_, i) => {
      const p = i % 2 === 0 ? req : pick(admins);
      return {
        message: pick(DISCUSS),
        user_id: p.id,
        timestamp: new Date(createdMs + (i + 1) * int(2, 20) * HOUR).toISOString(),
        user_name: p.email,
      };
    });

    // PO
    let lastReceivedMs = null;
    poGroups.forEach((group, gi) => {
      const pool = VENDOR_POOL[group[0].part_number.split("-")[0]];
      const v = vendors[pick(pool)] ?? vendors["VDR-001"];
      const poCreatedMs = createdMs + int(1, 6) * DAY + int(0, 8) * HOUR;
      const poStatus =
        status === "On Process"
          ? weighted([["Pending Validation", 3], ["Pending Approval", 4], ["Pending Payment", 3]])
          : status;
      const poItems = group.map((b) => {
        const o = orders.find((x) => x.barang_id === b.id);
        const price = priceFor(b, v.kode_vendor);
        const qty = Number(o.qty);
        return {
          qty,
          uom: b.uom,
          link: "",
          name: b.part_name,
          price,
          is_asset: b.part_number.startsWith("IT-") && b.uom === "Unit",
          barang_id: b.id,
          description: "",
          part_number: b.part_number,
          total_price: qty * price,
          vendor_name: v.nama_vendor,
        };
      });
      const subtotal = poItems.reduce((s, it) => s + it.total_price, 0);
      const postage = pick([0, 0, 15000, 25000, 30000, 50000, 75000]);
      const taxIncluded = rand() < 0.6;
      const tax = taxIncluded ? 0 : Math.round(subtotal * 0.11);

      const pur = approverOf("Purchasing");
      const fin = approverOf("Finance");
      const step = (i) => poCreatedMs + (i + 1) * int(1, 5) * HOUR;
      const poApprovals =
        poStatus === "Pending Validation"
          ? []
          : poStatus === "Pending Approval"
          ? [approval(pur, "Menyetujui", "pending"), approval(gm, "Payment Approval", "pending"), approval(fin, "Payment Validator", "pending")]
          : poStatus === "Pending Payment"
          ? [approval(pur, "Menyetujui", "approved", step(0)), approval(gm, "Payment Approval", "pending"), approval(fin, "Payment Validator", "pending")]
          : [approval(pur, "Menyetujui", "approved", step(0)), approval(gm, "Payment Approval", "approved", step(1)), approval(fin, "Payment Validator", "approved", step(2))];

      let receiveRecord = null;
      let fullReceivedAt = null;
      if (poStatus === "Partial Receive" || poStatus === "Full Received") {
        const recvMs = Math.min(poCreatedMs + int(3, 14) * DAY, NOW.getTime() - HOUR);
        const full = poStatus === "Full Received";
        receiveRecord = {
          items: poItems.map((it, i) => ({
            part_name: it.name,
            ordered_qty: it.qty,
            part_number: it.part_number,
            received_qty: full || i > 0 ? it.qty : Math.max(0, it.qty - int(1, it.qty)),
          })),
          received_at: new Date(recvMs).toISOString(),
          received_by: approverOf("Warehouse").id,
          is_full_match: full,
        };
        if (full) {
          fullReceivedAt = new Date(recvMs).toISOString();
          lastReceivedMs = Math.max(lastReceivedMs ?? 0, recvMs);
        }
      }

      poRows.push({
        id: poId++,
        kode_po: `${COMPANY}/PO/${ROMAN[new Date(poCreatedMs).getUTCMonth()]}/26/${DEPT_ABBR[dept] ?? "HO"}/${poKodes[gi]}`,
        placeholder: `__PO_${poKodes[gi]}__`,
        mr_id: id,
        user_id: pick(admins).id,
        status: poStatus,
        vendor_details: {
          email: v.email,
          alamat: v.alamat,
          vendor_id: v.id,
          kode_vendor: v.kode_vendor,
          nama_vendor: v.nama_vendor,
          tipe_vendor: v.tipe_vendor,
          contact_person: v.pic_contact_person,
        },
        items: poItems,
        tax,
        postage,
        total_price: subtotal + tax + postage,
        payment_term: pick(PAYMENT_TERMS),
        shipping_address: SHIPPING[site],
        notes: pick(REMARKS),
        created_at: new Date(poCreatedMs).toISOString(),
        approvals: poApprovals,
        receive_record: receiveRecord,
        tax_included: taxIncluded,
        ppn_rate: 11,
        full_received_at: fullReceivedAt,
      });
    });

    mrRows.push({
      id,
      userid: req.id,
      created_at: created.toISOString(),
      due_date: new Date(createdMs + int(7, 30) * DAY).toISOString().slice(0, 10),
      kode_mr: kodeMr,
      kategori,
      status,
      remarks: pick(REMARKS),
      cost_estimation: String(costEst),
      department: dept,
      orders,
      discussions,
      approvals: mrApprovals,
      cost_center: cc.code,
      cost_center_id: cc.id,
      tujuan_site: site,
      prioritas: weighted([["P0", 1], ["P1", 3], ["P2", 4], ["P3", 3], ["P4", 2]]),
      level,
      full_received_at: status === "Full Received" && lastReceivedMs ? new Date(lastReceivedMs).toISOString() : null,
    });
  }

  // Ganti placeholder po_refs dengan kode PO asli.
  const kodeByPlaceholder = Object.fromEntries(poRows.map((p) => [p.placeholder, p.kode_po]));
  for (const mr of mrRows)
    for (const o of mr.orders) o.po_refs = o.po_refs.map((r) => kodeByPlaceholder[r]);

  const itemReqRows = NEW_ITEM_REQ.map(([name, cat, uom], i) => {
    const req = pick(requesters);
    const createdMs = NOW.getTime() - int(1, 120) * DAY - int(0, 20) * HOUR;
    const status = weighted([["pending", 4], ["approved", 4], ["rejected", 2]]);
    const admin = pick(admins);
    return {
      id: ID_START + i,
      created_at: new Date(createdMs).toISOString(),
      requester_id: req.id,
      proposed_name: name,
      proposed_category: cat,
      proposed_uom: uom,
      description: `Diperlukan untuk kebutuhan operasional ${req.department}.`,
      status,
      admin_notes: status === "approved" ? "Sudah ditambahkan ke master barang." : status === "rejected" ? "Sudah ada barang serupa di master." : null,
      processed_by: status === "pending" ? null : admin.id,
      processed_at: status === "pending" ? null : new Date(createdMs + int(1, 3) * DAY).toISOString(),
    };
  });

  // ---------- SQL ----------
  const sql = ["begin;"];
  // Trigger budget cuma jalan di UPDATE status, insert aman.
  for (const m of mrRows) {
    sql.push(`insert into public.material_requests
      (id, userid, created_at, due_date, kode_mr, kategori, status, remarks, cost_estimation, department,
       orders, discussions, approvals, attachments, company_code, cost_center, tujuan_site, cost_center_id,
       prioritas, level, full_received_at)
      values (${m.id}, ${sqlStr(m.userid)}, ${sqlStr(m.created_at)}, ${sqlStr(m.due_date)}, ${sqlStr(m.kode_mr)},
       ${sqlStr(m.kategori)}, ${sqlStr(m.status)}, ${sqlStr(m.remarks)}, ${sqlStr(m.cost_estimation)}, ${sqlStr(m.department)},
       ${sqlJson(m.orders, "json")}, ${sqlJson(m.discussions, "json")}, ${sqlJson(m.approvals)}, '[]'::json,
       '${COMPANY}', ${sqlStr(m.cost_center)}, ${sqlStr(m.tujuan_site)}, ${m.cost_center_id},
       ${sqlStr(m.prioritas)}, ${sqlStr(m.level)}, ${sqlStr(m.full_received_at)});`);
  }
  for (const p of poRows) {
    sql.push(`insert into public.purchase_orders
      (id, kode_po, mr_id, user_id, status, vendor_details, items, currency, discount, tax, postage, total_price,
       payment_term, shipping_address, notes, attachments, created_at, updated_at, approvals, company_code,
       receive_record, tax_included, ppn_rate, full_received_at)
      values (${p.id}, ${sqlStr(p.kode_po)}, ${p.mr_id}, ${sqlStr(p.user_id)}, ${sqlStr(p.status)},
       ${sqlJson(p.vendor_details)}, ${sqlJson(p.items)}, 'IDR', 0, ${p.tax}, ${p.postage}, ${p.total_price},
       ${sqlStr(p.payment_term)}, ${sqlStr(p.shipping_address)}, ${sqlStr(p.notes)}, '[]'::jsonb,
       ${sqlStr(p.created_at)}, ${sqlStr(p.created_at)}, ${sqlJson(p.approvals)}, '${COMPANY}',
       ${sqlJson(p.receive_record)}, ${p.tax_included}, ${p.ppn_rate}, ${sqlStr(p.full_received_at)});`);
  }
  for (const r of itemReqRows) {
    sql.push(`insert into public.item_requests
      (id, created_at, requester_id, proposed_name, proposed_category, proposed_uom, description, status, admin_notes, processed_by, processed_at)
      values (${r.id}, ${sqlStr(r.created_at)}, ${sqlStr(r.requester_id)}, ${sqlStr(r.proposed_name)}, ${sqlStr(r.proposed_category)},
       ${sqlStr(r.proposed_uom)}, ${sqlStr(r.description)}, ${sqlStr(r.status)}, ${sqlStr(r.admin_notes)},
       ${sqlStr(r.processed_by)}, ${sqlStr(r.processed_at)});`);
  }
  // Counter nomor dokumen dinaikkan supaya MR/PO baru dari UI tidak bentrok.
  sql.push(`update public.document_number_counters set last_number = greatest(last_number, ${mrNo})
    where doc_type = 'MR' and company_code = '${COMPANY}' and year = 2026;`);
  sql.push(`update public.document_number_counters set last_number = greatest(last_number, ${poNo})
    where doc_type = 'PO' and company_code = '${COMPANY}' and year = 2026;`);
  sql.push("commit;");
  run(sql.join("\n"));

  console.log(
    `OK: ${NEW_VENDORS.length} vendor, ${mrRows.length} MR, ${poRows.length} PO, ${itemReqRows.length} item request ditambahkan.`
  );
}

main();
