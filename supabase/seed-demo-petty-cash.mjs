// Seed data demo PETTY CASH (lengkap) untuk local dev - BUKAN untuk production!
//
// Mengisi seluruh modul Petty Cash dengan data yang konsisten satu sama lain:
// - 17 user demo bernama realistis lintas company (GMI/GIS) & site (Head
//   Office, Site Balikpapan, Site Tanjung Enim, Branch Palembang) - password
//   "demo123". Lihat DEMO_USERS di bawah utk daftar email-nya.
// - Template Approval (Pengajuan/Voucher/Deklarasi) + auto-rule per
//   departemen/site/company, termasuk semua departemen GMI Head Office milik
//   user dari seed-demo-users.mjs supaya mereka juga bisa langsung mencoba.
// - Budget per departemen+site+company beserta riwayat (initial, top-up
//   bulanan, potongan tiap Sub-Voucher), plus 1 budget lama nonaktif.
// - ~100 rantai Jul-Okt 2026: Input Pengajuan -> Pengajuan Voucher ->
//   Sub-Voucher (tarik dana bertahap) -> Deklarasi, dengan semua variasi
//   status (In Approval di berbagai step, Rejected + alasan, Approved,
//   Voucher Selesai, Menunggu Pembayaran, sisa voucher belum ditarik,
//   sub-voucher belum dideklarasikan, deklarasi lebih hemat/lebih mahal),
//   diskusi, riwayat revisi "Edit & Setujui", dan template pengajuan per user.
// - File struk/nota & bukti transfer (SVG) diunggah ke bucket lokal
//   `ga-web-attachments/demo-petty-cash/` supaya link lampiran bisa dibuka.
// - Harga terakhir katalog Petty Cash Barang diisi dari harga yang dipakai.
//
// PERHATIAN: SEMUA data transaksi & konfigurasi Petty Cash yang ada di DB
// lokal dihapus dulu (pengajuan, voucher, sub-voucher, deklarasi, budget,
// template approval & auto-rule, template pengajuan). Deterministik (seeded
// RNG) - aman dijalankan ulang, hasilnya sama.
//
// Jalankan (butuh `supabase start`; seed-demo-users.mjs opsional):
//   node supabase/seed-demo-petty-cash.mjs          # isi / isi ulang
//   node supabase/seed-demo-petty-cash.mjs --clean  # hapus data Petty Cash saja

import { execFileSync } from "node:child_process";

const DB_CONTAINER = "supabase_db_ga-web";
const API_URL = "http://127.0.0.1:54321";
const BUCKET = "ga-web-attachments";
const FILE_PREFIX = "demo-petty-cash";
const PASSWORD = "demo123";
// Service role key default local dev Supabase (sama di semua project lokal,
// bukan secret production) - dipakai kalau `supabase status` tidak bisa dibaca.
const DEFAULT_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// "Sekarang" versi demo - dokumen yang jadwal prosesnya lewat dari ini
// dibiarkan menggantung (In Approval / Menunggu Pembayaran / dst).
const NOW = Date.UTC(2026, 9, 2, 4, 0); // 2 Okt 2026 11:00 WIB
const START = Date.UTC(2026, 6, 1); // 1 Jul 2026

// ---------- DB helpers ----------
const query = (sql) => {
  const out = execFileSync(
    "docker",
    ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-At", "-c", `select coalesce(json_agg(t), '[]') from (${sql}) t`],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return JSON.parse(out.trim());
};

const run = (sql) => {
  execFileSync(
    "docker",
    ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-q", "-v", "ON_ERROR_STOP=1"],
    { input: sql, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["pipe", "inherit", "inherit"] },
  );
};

const sqlStr = (s) => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const sqlJson = (v) => (v == null ? "null" : `${sqlStr(JSON.stringify(v))}::jsonb`);
const sqlTs = (ms) => (ms == null ? "null" : sqlStr(new Date(ms).toISOString()));

const CLEAN_SQL = `
begin;
delete from public.petty_cash_deklarasi;
delete from public.petty_cash_sub_voucher;
delete from public.petty_cash_voucher;
delete from public.petty_cash_pengajuan;
delete from public.petty_cash_budget_history;
delete from public.petty_cash_budget;
delete from public.pc_approval_template_auto_rules;
delete from public.pc_approval_templates;
delete from public.petty_cash_pengajuan_template;
delete from public.petty_cash_admin_audit_log;
commit;
`;

// ---------- RNG ----------
let seed = 20261002;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;
const weighted = (pairs) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
  return pairs[pairs.length - 1][0];
};
const roundTo = (n, step) => Math.max(step, Math.round(n / step) * step);
const hashStr = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

const usedIds = new Set();
const newId = () => {
  let id;
  do id = int(1000000, 9999999);
  while (usedIds.has(id));
  usedIds.add(id);
  return id;
};

// ---------- Waktu (semua ms UTC, jam kerja dihitung dalam WIB) ----------
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const WIB = 7 * HOUR;
const wib = (ms) => new Date(ms + WIB);
// Geser ke jam kerja terdekat (Senin-Jumat 08:00-17:00 WIB).
const biz = (ms) => {
  let d = wib(ms);
  for (let guard = 0; guard < 10; guard++) {
    const day = d.getUTCDay();
    const h = d.getUTCHours();
    if (day === 0 || day === 6 || h >= 17) {
      d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 8, int(0, 50)));
      continue;
    }
    if (h < 8) d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8, int(0, 50)));
    break;
  }
  return d.getTime() - WIB;
};
const after = (ms, minH, maxH) => biz(ms + (minH + rand() * (maxH - minH)) * HOUR);
const ymd = (ms) => wib(ms).toISOString().slice(0, 10);
const weekOfMonth = (ms) => Math.ceil(wib(ms).getUTCDate() / 7);
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const fmtRp = (n) => "Rp " + Math.round(n).toLocaleString("id-ID");
const fmtTgl = (ms) => {
  const d = wib(ms);
  return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

const DEPT_ABBR = {
  "General Affair": "GA",
  "HRGA-HSE": "HRGA-HSE",
  "Human Resources": "HR",
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
  Legal: "LEG",
};

// ---------- User demo ----------
// key dipakai internal di script ini (template, requester, pembayar).
const DEMO_USERS = [
  // Approver
  { key: "indah", email: "indah.novita@demo.com", nama: "Indah Novita Rahmawati Asni", role: "approver", department: "HRGA-HSE", company: "GIS", lokasi: "Head Office", nrp: "GIS-24017" },
  { key: "dimas", email: "dimas.andrea@demo.com", nama: "Dimas Andrea", role: "approver", department: "General Affair", company: "GMI", lokasi: "Head Office", nrp: "GMI-18004" },
  { key: "titi", email: "titi.supriatin@demo.com", nama: "Titi Supriatin", role: "approver", department: "Finance", company: "GMI", lokasi: "Head Office", nrp: "GMI-15011" },
  { key: "rina", email: "rina.kartika@demo.com", nama: "Rina Kartika", role: "approver", department: "Finance", company: "GIS", lokasi: "Head Office", nrp: "GIS-21009" },
  { key: "bernadetta", email: "bernadetta.arena@demo.com", nama: "Bernadetta Arena Purwitasari", role: "approver", department: "Boards of Director", company: "GMI", lokasi: "Head Office", nrp: "GMI-10001" },
  { key: "budi", email: "budi.hartono@demo.com", nama: "Budi Hartono", role: "approver", department: "Service", company: "GMI", lokasi: "Site Balikpapan", nrp: "GMI-19032" },
  { key: "yoga", email: "yoga.prasetyo@demo.com", nama: "Yoga Prasetyo", role: "approver", department: "Produksi", company: "GMI", lokasi: "Site Tanjung Enim", nrp: "GMI-20045" },
  { key: "hendra", email: "hendra.wijaya@demo.com", nama: "Hendra Wijaya", role: "approver", department: "Marketing", company: "GIS", lokasi: "Head Office", nrp: "GIS-19003" },
  { key: "galih", email: "galih.ramadhan@demo.com", nama: "Galih Ramadhan", role: "approver", department: "IT", company: "GMI", lokasi: "Head Office", nrp: "GMI-21018" },
  // Requester
  { key: "panji", email: "panji.redsi@demo.com", nama: "Panji Redsi", role: "requester", department: "HRGA-HSE", company: "GIS", lokasi: "Head Office", nrp: "GIS-25041" },
  { key: "nadia", email: "nadia.putri@demo.com", nama: "Nadia Putri Maharani", role: "requester", department: "General Affair", company: "GMI", lokasi: "Head Office", nrp: "GMI-23027" },
  { key: "dewi", email: "dewi.lestari@demo.com", nama: "Dewi Lestari", role: "requester", department: "Service", company: "GMI", lokasi: "Site Balikpapan", nrp: "GMI-22061" },
  { key: "rizky", email: "rizky.pratama@demo.com", nama: "Rizky Pratama", role: "requester", department: "Produksi", company: "GMI", lokasi: "Site Tanjung Enim", nrp: "GMI-24009" },
  { key: "sari", email: "sari.wulandari@demo.com", nama: "Sari Wulandari", role: "requester", department: "Marketing", company: "GIS", lokasi: "Head Office", nrp: "GIS-23014" },
  { key: "andi", email: "andi.saputra@demo.com", nama: "Andi Saputra", role: "requester", department: "Logistik", company: "GMI", lokasi: "Branch Palembang", nrp: "GMI-22088" },
  { key: "fajar", email: "fajar.nugroho@demo.com", nama: "Fajar Nugroho", role: "requester", department: "IT", company: "GMI", lokasi: "Head Office", nrp: "GMI-25003" },
  { key: "maya", email: "maya.anggraini@demo.com", nama: "Maya Anggraini", role: "requester", department: "Finance", company: "GMI", lokasi: "Head Office", nrp: "GMI-24052" },
];

// ---------- Template approval ----------
const TEMPLATES = [
  { key: "P_HRGA", type: "Approval Pengajuan", name: "Pengajuan HRGA-HSE GIS (SPV → Manager → Finance → BOD)", desc: "Jalur lengkap sesuai form kertas Kas/Bank Keluar.", path: ["indah", "dimas", "titi", "bernadetta"] },
  { key: "P_MKT", type: "Approval Pengajuan", name: "Pengajuan Marketing GIS (Manager → GA → Finance)", desc: "Pengajuan tim Marketing GIS.", path: ["hendra", "dimas", "titi"] },
  { key: "P_BPN", type: "Approval Pengajuan", name: "Pengajuan Site Balikpapan (Kepala Site → GA Manager)", desc: "Operasional tim service di site.", path: ["budi", "dimas"] },
  { key: "P_TJE", type: "Approval Pengajuan", name: "Pengajuan Site Tanjung Enim (Kepala Site → GA Manager)", desc: "Operasional produksi di site.", path: ["yoga", "dimas"] },
  { key: "P_IT", type: "Approval Pengajuan", name: "Pengajuan IT (IT Manager → GA Manager)", desc: "Kebutuhan perangkat & jaringan.", path: ["galih", "dimas"] },
  { key: "P_STD", type: "Approval Pengajuan", name: "Pengajuan Standar (GA Manager → Finance)", desc: "Default untuk departemen Head Office.", path: ["dimas", "titi"] },
  { key: "V_STD", type: "Approval Voucher", name: "Voucher Standar (GA Manager → Finance)", desc: "Validasi voucher GMI.", path: ["dimas", "titi"] },
  { key: "V_GIS", type: "Approval Voucher", name: "Voucher GIS (GA Manager → Finance → BOD)", desc: "Validasi voucher GIS sampai BOD.", path: ["dimas", "rina", "bernadetta"] },
  { key: "D_GIS", type: "Approval Deklarasi", name: "Deklarasi GIS (SPV HRGA → GA Manager → Finance)", desc: "Diperiksa, diketahui, approve.", path: ["indah", "dimas", "rina"] },
  { key: "D_BPN", type: "Approval Deklarasi", name: "Deklarasi Site Balikpapan (Kepala Site → GA → Finance)", desc: "Deklarasi pemakaian dana site.", path: ["budi", "dimas", "titi"] },
  { key: "D_TJE", type: "Approval Deklarasi", name: "Deklarasi Site Tanjung Enim (Kepala Site → GA → Finance)", desc: "Deklarasi pemakaian dana site.", path: ["yoga", "dimas", "titi"] },
  { key: "D_STD", type: "Approval Deklarasi", name: "Deklarasi Standar (GA Manager → Finance)", desc: "Default deklarasi Head Office.", path: ["dimas", "titi"] },
];

// Kombinasi departemen+site+company yang punya transaksi demo.
const COMBOS = [
  { requester: "panji", P: "P_HRGA", V: "V_GIS", D: "D_GIS", payer: "rina", weight: 16, budgetBase: 25_000_000 },
  { requester: "nadia", P: "P_STD", V: "V_STD", D: "D_STD", payer: "titi", weight: 16, budgetBase: 20_000_000 },
  { requester: "dewi", P: "P_BPN", V: "V_STD", D: "D_BPN", payer: "titi", weight: 15, budgetBase: 30_000_000 },
  { requester: "rizky", P: "P_TJE", V: "V_STD", D: "D_TJE", payer: "titi", weight: 11, budgetBase: 15_000_000 },
  { requester: "sari", P: "P_MKT", V: "V_GIS", D: "D_GIS", payer: "rina", weight: 11, budgetBase: 20_000_000 },
  { requester: "andi", P: "P_STD", V: "V_STD", D: "D_STD", payer: "titi", weight: 10, budgetBase: 12_000_000 },
  // Budget IT sengaja tipis - buat demo peringatan sisa budget menipis.
  { requester: "fajar", P: "P_IT", V: "V_STD", D: "D_STD", payer: "titi", weight: 7, budgetBase: 6_000_000, tight: true },
  { requester: "maya", P: "P_STD", V: "V_STD", D: "D_STD", payer: "titi", weight: 6, budgetBase: 5_000_000 },
];

// Departemen GMI Head Office milik user seed-demo-users.mjs - diberi
// auto-rule & budget juga supaya bisa langsung coba bikin pengajuan.
const GENERIC_HO_DEPTS = [
  "Human Resources", "General Affair", "HRGA-HSE", "Marketing", "Produksi", "K3", "Finance", "IT",
  "Logistik", "Purchasing", "Warehouse", "Service", "General Manager", "Executive Manager",
  "Boards of Director", "Legal",
];

// ---------- Harga & item ----------
const priceFor = (b) => {
  const n = b.part_name.toLowerCase();
  const u = (b.uom || "").toLowerCase();
  const h = hashStr(b.part_name);
  const range = (lo, hi, step = 500) => roundTo(lo + (h % 1000) / 1000 * (hi - lo), step);
  if (b.category === "BBM") {
    if (n.includes("alphard") || n.includes("zenix")) return range(350_000, 450_000, 5000);
    return u === "minggu" ? range(550_000, 900_000, 5000) : range(180_000, 320_000, 5000);
  }
  if (b.category === "E-Tol") return u === "minggu" ? range(200_000, 380_000, 5000) : range(60_000, 150_000, 5000);
  if (b.category === "Operasional") return n.includes("genset") ? 650_000 : range(70_000, 150_000, 5000);
  if (b.category === "Kebutuhan Dapur") {
    if (n.includes("mesin")) return 175_000;
    if (n.includes("dispenser")) return 125_000;
    if (n.includes("4l")) return 85_000;
    if (n.includes("gula")) return 18_500;
    if (n.includes("kopi")) return 26_000;
    if (n.includes("tea")) return 13_500;
    if (n.includes("plastik")) return range(18_000, 35_000);
    return range(8_000, 60_000);
  }
  // ATK
  if (u === "box" || n.includes("kertas")) return range(55_000, 260_000, 1000);
  if (u === "rim") return 58_000;
  if (u === "lusin") return range(24_000, 65_000);
  if (u === "set") return range(15_000, 45_000);
  return range(3_000, 38_000);
};

const MANUAL_ITEMS = {
  "HRGA-HSE": [
    ["Biaya Klaim Pembuatan SKS Keperluan Instalasi Kamera Mundur PAMA", "Paket", 150_000, "Operasional"],
    ["Medical Check Up Karyawan Baru", "Orang", 350_000, "Operasional"],
    ["Pembuatan ID Card Karyawan", "Pcs", 25_000, "ATK"],
    ["Konsumsi Training K3 & Induksi", "Paket", 450_000, "Kebutuhan Dapur"],
    ["APD Helm Safety", "Pcs", 85_000, "Operasional"],
  ],
  Service: [
    ["Uang BBM Tim Service (Cash ke Koordinator)", "Hari", 250_000, "BBM"],
    ["Sewa Mobil Pickup Harian", "Hari", 450_000, "Operasional"],
    ["Spare part kecil (baut, kabel ties, isolasi)", "Set", 85_000, "Operasional"],
    ["Penginapan Teknisi", "Malam", 350_000, "Operasional"],
    ["Uang Makan Teknisi Lembur", "Orang", 50_000, "Kebutuhan Dapur"],
  ],
  Produksi: [
    ["Sarung Tangan Kerja", "Lusin", 120_000, "Operasional"],
    ["Masker N95", "Box", 185_000, "Operasional"],
    ["Grease Pompa", "Kaleng", 95_000, "Operasional"],
    ["Konsumsi Shift Malam", "Paket", 300_000, "Kebutuhan Dapur"],
  ],
  Marketing: [
    ["Konsumsi Meeting Klien", "Paket", 650_000, "Kebutuhan Dapur"],
    ["Cetak Brosur A5 Full Color", "Rim", 450_000, "ATK"],
    ["Souvenir Klien (Tumbler)", "Pcs", 45_000, "Operasional"],
    ["Parkir & Tol Kunjungan Klien", "Hari", 85_000, "E-Tol"],
  ],
  Logistik: [
    ["Ongkos Kirim Ekspedisi", "Koli", 120_000, "Operasional"],
    ["Bongkar Muat (Kuli Angkut)", "Orang", 100_000, "Operasional"],
    ["Stretch Film Wrapping", "Roll", 75_000, "Operasional"],
  ],
  IT: [
    ["Kabel LAN Cat6", "Meter", 6_500, "Operasional"],
    ["Konektor RJ45", "Box", 95_000, "Operasional"],
    ["Mouse Wireless", "Pcs", 125_000, "ATK"],
    ["Refill Toner Printer", "Pcs", 175_000, "ATK"],
  ],
  "General Affair": [
    ["Jasa Servis AC", "Unit", 150_000, "Operasional"],
    ["Galon Air Mineral", "Galon", 22_000, "Kebutuhan Dapur"],
    ["Perbaikan Kran Toilet", "Paket", 175_000, "Operasional"],
    ["Jasa Fogging Kantor", "Paket", 600_000, "Operasional"],
  ],
  Finance: [
    ["Materai 10.000", "Lembar", 10_000, "ATK"],
    ["Map Ordner", "Pcs", 35_000, "ATK"],
    ["Biaya Admin Transfer Bank", "Transaksi", 6_500, "Operasional"],
  ],
};

// Kategori katalog yang wajar per departemen (bobot).
const DEPT_CATS = {
  "HRGA-HSE": [["ATK", 3], ["Kebutuhan Dapur", 3], ["manual", 3]],
  "General Affair": [["Kebutuhan Dapur", 4], ["ATK", 3], ["manual", 2], ["Operasional", 1]],
  Service: [["BBM", 4], ["E-Tol", 3], ["Operasional", 2], ["manual", 3]],
  Produksi: [["manual", 4], ["Kebutuhan Dapur", 2], ["ATK", 1], ["Operasional", 1]],
  Marketing: [["manual", 4], ["BBM", 1], ["E-Tol", 2], ["ATK", 1]],
  Logistik: [["BBM", 3], ["E-Tol", 2], ["Operasional", 2], ["manual", 3]],
  IT: [["manual", 5], ["ATK", 2]],
  Finance: [["ATK", 4], ["manual", 3]],
};

const QTY = { BBM: [1, 5], "E-Tol": [1, 5], Operasional: [1, 4], "Kebutuhan Dapur": [1, 6], ATK: [1, 10] };

const PURPOSE = {
  "HRGA-HSE": ["Kebutuhan ATK & pantry HRGA bulan ini", "Biaya administrasi karyawan baru", "Persiapan training K3 & induksi vendor", "Kebutuhan operasional HRGA HO"],
  "General Affair": ["Belanja rutin pantry & kebersihan kantor HO", "Restock ATK kantor Head Office", "Perawatan fasilitas kantor", "Kebutuhan GA minggu ini"],
  Service: ["BBM & e-Tol operasional tim service", "Mobilisasi teknisi ke lokasi customer", "Kebutuhan operasional site Balikpapan", "Perjalanan dinas teknisi"],
  Produksi: ["APD & consumable produksi site", "Konsumsi shift malam produksi", "Kebutuhan maintenance ringan"],
  Marketing: ["Kunjungan & meeting klien", "Materi promosi pameran", "Entertain calon customer"],
  Logistik: ["Pengiriman barang ke cabang", "BBM armada pengiriman", "Packing & bongkar muat"],
  IT: ["Perbaikan jaringan lantai 2", "Perangkat pendukung kerja karyawan baru", "Maintenance printer kantor"],
  Finance: ["Kebutuhan administrasi Finance", "Materai & dokumen tagihan"],
};

const REJECT_REASONS = [
  "Nominal terlalu besar untuk kebutuhan ini, mohon dipecah per minggu.",
  "Item ini seharusnya lewat MR/PO, bukan petty cash.",
  "Mohon lampirkan penawaran harga pembanding.",
  "Kebutuhan sudah tercover di pengajuan sebelumnya.",
  "Budget departemen bulan ini sudah dialokasikan, ajukan bulan depan.",
];
const CHAT = {
  question: [
    "Untuk item ini apakah bisa pakai stok GA dulu?",
    "Tolong dijelaskan dipakai untuk kegiatan apa ya.",
    "Apakah harga ini sudah harga terbaru?",
    "Ini untuk kebutuhan berapa lama?",
  ],
  answer: [
    "Stok GA sudah habis Pak, sudah saya cek kemarin.",
    "Untuk kebutuhan 2 minggu ke depan Bu.",
    "Sudah, sesuai nota toko langganan.",
    "Dipakai untuk kegiatan tim di lapangan minggu ini.",
  ],
  info: [
    "Noted, lanjut diproses ya.",
    "Oke, mohon struknya disimpan untuk deklarasi.",
    "Siap, terima kasih.",
  ],
  edit: [
    "Qty saya sesuaikan dengan kebutuhan riil ya.",
    "Harga saya koreksi sesuai harga katalog terbaru.",
    "Item yang dobel saya hapus.",
  ],
};

const STORES = ["Toko Sinar Jaya ATK", "Indomaret Point", "Alfamidi", "Toko Bangunan Makmur", "SPBU Pertamina 31.124", "CV Mitra Abadi", "Toko Serba Ada Sentosa", "Gramedia"];

const doc = (text) => ({ type: "doc", content: text.split("\n").map((t) => ({ type: "paragraph", content: t ? [{ type: "text", text: t }] : [] })) });
const richNotes = (text) => JSON.stringify(doc(text));

// ---------- SVG lampiran ----------
const files = []; // { path, svg }
const fileUrl = (path) => `${API_URL}/storage/v1/object/public/${BUCKET}/${path}`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const receiptSvg = ({ store, date, items, total, no }) => {
  const rows = items.slice(0, 12);
  const h = 230 + rows.length * 34;
  const lines = rows
    .map((it, i) => {
      const y = 150 + i * 34;
      return `<text x="24" y="${y}" font-size="13">${esc(it.part_name.slice(0, 30))}</text>
<text x="24" y="${y + 15}" font-size="11" fill="#555">${it.qty} x ${esc(it.unit_price.toLocaleString("id-ID"))}</text>
<text x="356" y="${y + 15}" font-size="13" text-anchor="end">${esc(it.subtotal.toLocaleString("id-ID"))}</text>`;
    })
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="${h}" viewBox="0 0 380 ${h}" font-family="Courier New, monospace">
<rect width="380" height="${h}" fill="#fffdf6"/>
<text x="190" y="40" font-size="17" font-weight="bold" text-anchor="middle">${esc(store)}</text>
<text x="190" y="62" font-size="11" text-anchor="middle" fill="#555">Jl. Raya No. ${(hashStr(store) % 200) + 1} - Telp (021) 55${hashStr(store) % 10000}</text>
<text x="24" y="98" font-size="12">No : ${esc(no)}</text>
<text x="24" y="116" font-size="12">Tgl: ${esc(date)}</text>
<line x1="20" y1="128" x2="360" y2="128" stroke="#333" stroke-dasharray="4 3"/>
${lines}
<line x1="20" y1="${h - 76}" x2="360" y2="${h - 76}" stroke="#333" stroke-dasharray="4 3"/>
<text x="24" y="${h - 50}" font-size="15" font-weight="bold">TOTAL</text>
<text x="356" y="${h - 50}" font-size="15" font-weight="bold" text-anchor="end">${esc(fmtRp(total))}</text>
<text x="190" y="${h - 20}" font-size="11" text-anchor="middle" fill="#555">*** TERIMA KASIH ***</text>
</svg>`;
};

const transferSvg = ({ fromName, toName, amount, date, ref, bank }) => `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="520" viewBox="0 0 420 520" font-family="Arial, sans-serif">
<rect width="420" height="520" fill="#f4f7fb"/>
<rect x="0" y="0" width="420" height="90" fill="#0b4f9c"/>
<text x="210" y="42" font-size="20" font-weight="bold" fill="#fff" text-anchor="middle">${esc(bank)}</text>
<text x="210" y="68" font-size="13" fill="#dbe8ff" text-anchor="middle">Bukti Transfer</text>
<circle cx="210" cy="140" r="30" fill="#18a058"/>
<path d="M196 140 l10 10 l18 -20" stroke="#fff" stroke-width="5" fill="none"/>
<text x="210" y="198" font-size="15" fill="#18a058" font-weight="bold" text-anchor="middle">Transfer Berhasil</text>
<text x="210" y="236" font-size="26" font-weight="bold" fill="#111" text-anchor="middle">${esc(fmtRp(amount))}</text>
<g font-size="13" fill="#444">
<text x="30" y="290">Tanggal</text><text x="390" y="290" text-anchor="end" fill="#111">${esc(date)}</text>
<text x="30" y="322">Dari</text><text x="390" y="322" text-anchor="end" fill="#111">${esc(fromName)}</text>
<text x="30" y="354">Ke</text><text x="390" y="354" text-anchor="end" fill="#111">${esc(toName)}</text>
<text x="30" y="386">Keterangan</text><text x="390" y="386" text-anchor="end" fill="#111">${esc(ref)}</text>
<text x="30" y="418">No. Referensi</text><text x="390" y="418" text-anchor="end" fill="#111">${hashStr(ref) % 900000000 + 100000000}</text>
</g>
<text x="210" y="490" font-size="11" fill="#888" text-anchor="middle">Dokumen demo - bukan bukti transaksi asli</text>
</svg>`;

const addFile = (path, svg) => {
  files.push({ path, svg });
  return fileUrl(path);
};

// ---------- Storage ----------
const storageFetch = (key, path, init = {}) =>
  fetch(`${API_URL}/storage/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...(init.headers || {}) },
  });

async function cleanFiles(key) {
  for (;;) {
    const res = await storageFetch(key, `object/list/${BUCKET}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: `${FILE_PREFIX}/`, limit: 1000 }),
    });
    const list = res.ok ? await res.json() : [];
    // list prefix cuma 1 level - file kita semua di root folder demo.
    const names = list.filter((o) => o.id).map((o) => `${FILE_PREFIX}/${o.name}`);
    if (names.length === 0) return;
    await storageFetch(key, `object/${BUCKET}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: names }),
    });
  }
}

async function uploadFiles(key) {
  let i = 0;
  const worker = async () => {
    while (i < files.length) {
      const f = files[i++];
      const res = await storageFetch(key, `object/${BUCKET}/${f.path}`, {
        method: "POST",
        headers: { "Content-Type": "image/svg+xml", "x-upsert": "true" },
        body: f.svg,
      });
      if (!res.ok) throw new Error(`Upload ${f.path} gagal: ${res.status} ${await res.text()}`);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
}

// ---------- Auth ----------
function serviceRoleKey() {
  try {
    const out = execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const m = out.match(/^SERVICE_ROLE_KEY="?([^"\n]+)"?/m);
    if (m) return m[1];
  } catch {
    // CLI tidak tersedia - pakai default lokal.
  }
  return DEFAULT_SERVICE_ROLE_KEY;
}

async function ensureUsers(key) {
  for (const u of DEMO_USERS) {
    const res = await fetch(`${API_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: u.email, password: PASSWORD, email_confirm: true }),
    });
    if (!res.ok && res.status !== 422) {
      throw new Error(`Gagal membuat user ${u.email}: ${res.status} ${await res.text()}`);
    }
  }
  // Profil dibuat trigger handle_new_user - tinggal dilengkapi.
  run(
    "begin;\n" +
      DEMO_USERS.map(
        (u) => `update public.profiles set nama = ${sqlStr(u.nama)}, role = ${sqlStr(u.role)},
          department = ${sqlStr(u.department)}, company = ${sqlStr(u.company)}, lokasi = ${sqlStr(u.lokasi)},
          nrp = ${sqlStr(u.nrp)}, is_active = true where email = ${sqlStr(u.email)};`,
      ).join("\n") +
      "\ncommit;",
  );
  const rows = query(`select id, email from public.profiles where email in (${DEMO_USERS.map((u) => sqlStr(u.email)).join(",")})`);
  const byEmail = Object.fromEntries(rows.map((r) => [r.email, r.id]));
  const users = {};
  for (const u of DEMO_USERS) {
    if (!byEmail[u.email]) throw new Error(`Profil ${u.email} tidak ditemukan setelah dibuat.`);
    users[u.key] = { ...u, id: byEmail[u.email] };
  }
  return users;
}

// ---------- Generator ----------
function buildApprovals(path, users) {
  return path.map((k) => ({
    userid: users[k].id,
    nama: users[k].nama,
    department: users[k].department,
    role: users[k].role,
    status: "pending",
    processed_at: null,
  }));
}

// Jalankan rantai approval berurutan mulai `start`. Mengembalikan status
// akhir + waktu selesai; step yang jadwalnya lewat NOW dibiarkan pending.
// Dokumen 3 minggu terakhir sebagian sengaja "tertahan" di salah satu step
// supaya antrian approval di demo tidak kosong.
const RECENT = 21 * DAY;
const stalls = (start, prob) => start > NOW - RECENT && chance(prob);

function runChain(approvals, start, { rejectProb = 0.06, stallProb = 0.5, onApprove } = {}) {
  let t = start;
  const rejectAt = chance(rejectProb) ? int(0, approvals.length - 1) : -1;
  const stallAt = stalls(start, stallProb) ? int(0, approvals.length - 1) : -1;
  for (let i = 0; i < approvals.length; i++) {
    if (i === stallAt) return { status: "In Approval", doneAt: null, lastAt: t };
    const at = after(t, 1, 28);
    if (at > NOW) return { status: "In Approval", doneAt: null, lastAt: t };
    t = at;
    if (i === rejectAt) {
      approvals[i].status = "rejected";
      approvals[i].processed_at = new Date(t).toISOString();
      return { status: "Rejected", doneAt: t, lastAt: t, rejectedBy: i };
    }
    approvals[i].status = "approved";
    approvals[i].processed_at = new Date(t).toISOString();
    onApprove?.(i, t);
  }
  return { status: "Approved", doneAt: t, lastAt: t };
}

function main() {
  return (async () => {
    const key = serviceRoleKey();

    if (process.argv.includes("--clean")) {
      run(CLEAN_SQL);
      await cleanFiles(key);
      console.log("Data Petty Cash dihapus.");
      return;
    }

    console.log("1/5 Menyiapkan user demo...");
    const users = await ensureUsers(key);
    const admin = query("select id from public.profiles where role = 'admin' order by email limit 1")[0]?.id ?? users.dimas.id;

    const barang = query("select id, part_name, category, uom, coa from public.petty_cash_barang order by id");
    const barangByCat = {};
    for (const b of barang) {
      b.price = priceFor(b);
      (barangByCat[b.category] ||= []).push(b);
    }

    const sql = ["begin;", "set local session_replication_role = replica;"];
    sql.push(CLEAN_SQL.replace(/begin;|commit;/g, ""));

    // ----- Template & auto-rule -----
    const tplId = {};
    let tplTime = START - 20 * DAY;
    for (const t of TEMPLATES) {
      const id = newId();
      tplId[t.key] = id;
      tplTime += HOUR;
      sql.push(`insert into public.pc_approval_templates (id, template_name, description, approval_path, approval_type, created_at, updated_at, created_by, updated_by)
        overriding system value values (${id}, ${sqlStr(t.name)}, ${sqlStr(t.desc)}, ${sqlJson(buildApprovals(t.path, users))}, ${sqlStr(t.type)},
        ${sqlTs(tplTime)}, ${sqlTs(tplTime)}, ${sqlStr(admin)}, ${sqlStr(admin)});`);
    }
    const ruleKeys = new Set();
    const addRule = (dept, site, company, type, tpl) => {
      const k = [dept, site, company, type].join("|");
      if (ruleKeys.has(k)) return;
      ruleKeys.add(k);
      sql.push(`insert into public.pc_approval_template_auto_rules (id, template_id, department, site, company_code, approval_type, created_at)
        overriding system value values (${newId()}, ${tplId[tpl]}, ${sqlStr(dept)}, ${sqlStr(site)}, ${sqlStr(company)}, ${sqlStr(type)}, ${sqlTs(tplTime)});`);
    };
    for (const c of COMBOS) {
      const u = users[c.requester];
      addRule(u.department, u.lokasi, u.company, "Approval Pengajuan", c.P);
      addRule(u.department, u.lokasi, u.company, "Approval Voucher", c.V);
      addRule(u.department, u.lokasi, u.company, "Approval Deklarasi", c.D);
    }
    for (const dept of GENERIC_HO_DEPTS) {
      addRule(dept, "Head Office", "GMI", "Approval Pengajuan", "P_STD");
      addRule(dept, "Head Office", "GMI", "Approval Voucher", "V_STD");
      addRule(dept, "Head Office", "GMI", "Approval Deklarasi", "D_STD");
    }

    // ----- Budget (id dulu, saldo dihitung setelah sub-voucher terbentuk) -----
    const budgets = COMBOS.map((c) => {
      const u = users[c.requester];
      return {
        id: newId(),
        combo: c,
        department: u.department,
        site: u.lokasi,
        company: u.company,
        name: `Budget ${u.department} ${u.lokasi} (${u.company})`,
        deductions: [],
      };
    });
    const budgetOf = (c) => budgets.find((b) => b.combo === c);

    console.log("2/5 Membangun rantai Pengajuan → Voucher → Sub-Voucher → Deklarasi...");
    const pengajuanRows = [];
    const voucherRows = [];
    const subRows = [];
    const deklarasiRows = [];

    const makeItems = (dept, company) => {
      const n = weighted([[1, 2], [2, 4], [3, 4], [4, 3], [5, 2], [6, 1]]);
      const items = [];
      const used = new Set();
      for (let i = 0; i < n; i++) {
        const cat = weighted(DEPT_CATS[dept] || [["ATK", 1]]);
        let it;
        if (cat === "manual" || !barangByCat[cat]) {
          const [name, uom, price, category] = pick(MANUAL_ITEMS[dept] || MANUAL_ITEMS["General Affair"]);
          if (used.has(name)) continue;
          used.add(name);
          const qty = uom === "Meter" ? int(10, 60) : int(1, 4);
          it = { barang_id: null, part_name: name, category, uom, qty, unit_price: price };
        } else {
          const b = pick(barangByCat[cat]);
          if (used.has(b.part_name + cat)) continue;
          used.add(b.part_name + cat);
          const [lo, hi] = QTY[cat] || [1, 5];
          const label = cat === "E-Tol" ? `E-Tol ${b.part_name}` : cat === "BBM" ? `BBM ${b.part_name}` : b.part_name;
          it = { barang_id: b.id, part_name: label, category: cat, uom: b.uom, qty: int(lo, hi), unit_price: b.price, _barang: b };
        }
        const coaOptions = it._barang?.coa ?? ["GMI", "GIS"];
        it.coa = chance(0.85) && coaOptions.includes(company) ? company : pick(coaOptions);
        it.subtotal = it.qty * it.unit_price;
        it.note = chance(0.15) ? pick(["Untuk stok 2 minggu", "Urgent", "Harga sesuai nota toko", "Cash ke koordinator lapangan"]) : null;
        items.push(it);
      }
      return items.map(({ _barang, ...rest }) => rest);
    };
    const sumItems = (items) => items.reduce((s, it) => s + it.subtotal, 0);

    const addDiscussion = (list, user, message, at) => {
      list.push({ user_id: user.id, user_name: user.nama, message, content: doc(message), timestamp: new Date(at).toISOString() });
    };

    // Distribusi tanggal: makin ke Sep/Okt makin ramai.
    const TOTAL_PENGAJUAN = 120;
    const comboPairs = COMBOS.map((c) => [c, c.weight]);
    for (let n = 0; n < TOTAL_PENGAJUAN; n++) {
      const c = weighted(comboPairs);
      const u = users[c.requester];
      const frac = Math.pow(rand(), 0.6); // condong ke tanggal akhir
      let created = biz(START + frac * (NOW - START - 2 * HOUR));
      if (created > NOW) created = biz(NOW - int(20, 70) * HOUR);

      const items = makeItems(u.department, u.company);
      if (items.length === 0) continue;
      const neededAt = after(created, 24, 24 * 6);
      const purpose = pick(PURPOSE[u.department] || PURPOSE["General Affair"]);
      const pj = {
        id: newId(),
        user: u,
        combo: c,
        company: u.company,
        department: u.department,
        site: u.lokasi,
        created,
        needed_date: ymd(neededAt),
        week_of_month: weekOfMonth(neededAt),
        notes: richNotes(`${purpose}.${chance(0.4) ? "\nMohon diproses sebelum " + fmtTgl(neededAt) + "." : ""}`),
        items,
        attachments: [],
        discussions: [],
        revisions: [],
        approvals: buildApprovals(TEMPLATES.find((t) => t.key === c.P).path, users),
        budget_id: budgetOf(c).id,
      };
      if (chance(0.35)) {
        pj.attachments.push({
          name: `Penawaran-${pick(STORES).replace(/\s+/g, "-")}.svg`,
          url: addFile(`${FILE_PREFIX}/penawaran-${pj.id}.svg`, receiptSvg({ store: pick(STORES), date: fmtTgl(created), items, total: sumItems(items), no: `QUO-${pj.id}` })),
        });
      }

      // Diskusi tanya-jawab sebelum approval.
      if (chance(0.3)) {
        const asker = users[TEMPLATES.find((t) => t.key === c.P).path[0]];
        const t1 = after(created, 0.5, 6);
        if (t1 < NOW) {
          addDiscussion(pj.discussions, asker, pick(CHAT.question), t1);
          const t2 = after(t1, 0.3, 4);
          if (t2 < NOW) addDiscussion(pj.discussions, u, pick(CHAT.answer), t2);
        }
      }

      const editAtStep = chance(0.12) ? int(0, pj.approvals.length - 1) : -1;
      const res = runChain(pj.approvals, created, {
        rejectProb: 0.08,
        onApprove: (i, t) => {
          if (i !== editAtStep) return;
          // "Edit & Setujui" - snapshot versi sebelum diedit.
          const approver = DEMO_USERS.find((x) => x.email && users[x.key].id === pj.approvals[i].userid);
          const original = pj.items.map((it) => ({ ...it, qty: it.qty + int(1, 3), subtotal: (it.qty + 2) * it.unit_price }));
          original.forEach((it) => (it.subtotal = it.qty * it.unit_price));
          pj.revisions.push({
            revised_by: pj.approvals[i].userid,
            revised_by_name: pj.approvals[i].nama,
            revised_at: new Date(t).toISOString(),
            snapshot: { needed_date: pj.needed_date, week_of_month: pj.week_of_month, notes: pj.notes, items: original, attachments: pj.attachments },
          });
          addDiscussion(pj.discussions, users[approver.key], pick(CHAT.edit), t + 60_000);
        },
      });
      pj.status = res.status;
      pj.updated = res.lastAt;
      if (res.status === "Rejected") {
        const rej = pj.approvals[res.rejectedBy];
        pj.discussions.push({
          user_id: rej.userid,
          user_name: rej.nama,
          message: `[PENOLAKAN] Alasan: ${pick(REJECT_REASONS)}`,
          timestamp: new Date(res.doneAt + 60_000).toISOString(),
        });
      } else if (res.status === "Approved" && chance(0.25)) {
        addDiscussion(pj.discussions, users[TEMPLATES.find((t) => t.key === c.P).path.at(-1)], pick(CHAT.info), res.doneAt + 120_000);
      }
      pengajuanRows.push(pj);

      // ----- Voucher -----
      if (pj.status !== "Approved" || !chance(0.9)) continue;
      const vCreated = after(res.doneAt, 2, 40);
      if (vCreated > NOW) continue;
      const vc = {
        id: newId(),
        pengajuan: pj,
        user: u,
        combo: c,
        created: vCreated,
        items: pj.items.map((it) => ({ ...it })),
        total: sumItems(pj.items),
        approvals: buildApprovals(TEMPLATES.find((t) => t.key === c.V).path, users),
        discussions: [],
      };
      const vres = runChain(vc.approvals, vCreated, { rejectProb: 0.07 });
      vc.status = vres.status;
      vc.updated = vres.lastAt;
      if (vres.status === "Rejected") {
        const rej = vc.approvals[vres.rejectedBy];
        vc.discussions.push({ user_id: rej.userid, user_name: rej.nama, message: `[PENOLAKAN] Alasan: ${pick(REJECT_REASONS)}`, timestamp: new Date(vres.doneAt + 60_000).toISOString() });
      }
      voucherRows.push(vc);
      if (vc.status !== "Approved") continue;

      // ----- Sub-Voucher: rencana tarikan -----
      const remaining = vc.items.map((it) => it.qty);
      const plan = weighted([["full", 5], ["split2", 3], ["split3", 2]]);
      const draws = plan === "full" ? 1 : plan === "split2" ? 2 : 3;
      const stopEarly = draws > 1 && chance(0.3); // sisa voucher sengaja belum ditarik
      let tPrev = vres.doneAt;
      vc.subs = [];
      for (let d = 0; d < draws; d++) {
        if (stopEarly && d === draws - 1) break;
        const ts = after(tPrev, d === 0 ? 2 : 24, d === 0 ? 48 : 24 * 6);
        if (ts > NOW) break;
        tPrev = ts;
        const last = d === draws - 1;
        const subItems = [];
        vc.items.forEach((it, idx) => {
          if (remaining[idx] <= 0) return;
          let q;
          if (last) q = remaining[idx];
          else if (vc.items.length > 1 && chance(0.4)) q = 0; // item ditarik di tarikan lain
          else q = Math.max(1, Math.floor(remaining[idx] / (draws - d)));
          if (q <= 0) return;
          remaining[idx] -= q;
          subItems.push({
            item_index: idx, barang_id: it.barang_id, part_name: it.part_name, category: it.category, uom: it.uom,
            qty: q, unit_price: it.unit_price, subtotal: q * it.unit_price, note: it.note, coa: it.coa,
          });
        });
        if (subItems.length === 0) continue;
        const sv = {
          id: newId(),
          voucher: vc,
          user: u,
          created: ts,
          items: subItems,
          amount: sumItems(subItems),
          notes: d === 0 ? (last ? "Tarik penuh" : "Tarikan pertama") : `Tarikan ke-${d + 1}`,
          discussions: [],
        };
        const tp = after(ts, 2, 50);
        if (tp <= NOW && !stalls(ts, 0.35)) {
          const payer = users[c.payer];
          sv.status = "Selesai";
          sv.paid_at = tp;
          sv.paid_by = payer;
          sv.payment_proof = [{
            name: `Bukti-Transfer-${sv.id}.svg`,
            url: addFile(`${FILE_PREFIX}/transfer-${sv.id}.svg`, transferSvg({
              bank: u.company === "GIS" ? "Bank Mandiri" : "Bank BCA",
              fromName: u.company === "GIS" ? "PT Global Inti Sejati" : "PT Garuda Mart Indonesia",
              toName: u.nama, amount: sv.amount, date: fmtTgl(tp), ref: `Petty Cash ${sv.id}`,
            })),
          }];
        } else {
          sv.status = "Menunggu Pembayaran";
          sv.payment_proof = [];
          if (chance(0.5) && ts + 3 * HOUR < NOW) {
            addDiscussion(sv.discussions, u, "Mohon dibantu transfer hari ini ya, dananya dipakai besok.", ts + 3 * HOUR);
          }
        }
        budgetOf(c).deductions.push({ at: ts, amount: sv.amount, sv });
        subRows.push(sv);
        vc.subs.push(sv);

        // ----- Deklarasi -----
        if (sv.status !== "Selesai" || !chance(0.85) || stalls(sv.paid_at, 0.3)) continue;
        const td = after(sv.paid_at, 4, 96);
        if (td > NOW) continue;
        const dItems = sv.items.map(({ item_index, ...it }) => {
          const r = rand();
          let price = it.unit_price;
          let note = it.note;
          if (r < 0.3) {
            price = roundTo(it.unit_price * (0.85 + rand() * 0.1), 500);
            note = "Harga di struk lebih murah";
          } else if (r < 0.4) {
            price = roundTo(it.unit_price * (1.03 + rand() * 0.1), 500);
            note = "Harga naik dari rencana";
          }
          return { ...it, unit_price: price, subtotal: price * it.qty, note };
        });
        const dk = {
          id: newId(),
          sub: sv,
          voucher: vc,
          user: u,
          combo: c,
          created: td,
          items: dItems,
          total: sumItems(dItems),
          approvals: buildApprovals(TEMPLATES.find((t) => t.key === c.D).path, users),
          discussions: [],
          attachments: [],
        };
        const store = pick(STORES);
        dk.attachments.push({
          name: `Struk-${store.replace(/\s+/g, "-")}.svg`,
          url: addFile(`${FILE_PREFIX}/struk-${dk.id}.svg`, receiptSvg({ store, date: fmtTgl(td - int(1, 3) * DAY), items: dItems, total: dk.total, no: `INV/${dk.id}` })),
        });
        const selisih = sv.amount - dk.total;
        dk.notes = richNotes(
          `${purpose} - deklarasi pemakaian dana tarikan ${sv.notes.toLowerCase()}.` +
            (selisih > 0 ? `\nSisa dana ${fmtRp(selisih)} dikembalikan ke kas.` : selisih < 0 ? `\nKekurangan ${fmtRp(-selisih)} ditalangi dulu oleh PIC.` : ""),
        );
        const dres = runChain(dk.approvals, td, { rejectProb: 0.05 });
        dk.status = dres.status;
        dk.updated = dres.lastAt;
        if (dres.status === "Rejected") {
          const rej = dk.approvals[dres.rejectedBy];
          dk.discussions.push({ user_id: rej.userid, user_name: rej.nama, message: "[PENOLAKAN] Alasan: Struk tidak terbaca, mohon upload ulang foto struk yang jelas.", timestamp: new Date(dres.doneAt + 60_000).toISOString() });
        } else if (selisih < 0 && dres.status !== "In Approval") {
          addDiscussion(dk.discussions, users[TEMPLATES.find((t) => t.key === c.D).path.at(-1)], "Kelebihan pemakaian sudah dicek sesuai struk, OK.", dk.created + 5 * HOUR);
        }
        sv.deklarasi = dk;
        deklarasiRows.push(dk);
      }

      // Voucher otomatis "Selesai" (meniru trigger DB yang dimatikan saat seed).
      const drawn = vc.subs.reduce((s, x) => s + x.amount, 0);
      const allDone = vc.subs.length > 0 && vc.subs.every((x) => x.deklarasi?.status === "Approved");
      if (drawn >= vc.total && allDone) {
        vc.status = "Selesai";
        vc.updated = Math.max(...vc.subs.map((x) => x.deklarasi.updated));
      }
    }

    // ----- Penomoran (per company per jenis, urut created_at) -----
    const numberRows = (rows, prefix, kodeKey, company = (r) => r.user.company, dept = (r) => r.user.department) => {
      const counters = {};
      [...rows].sort((a, b) => a.created - b.created).forEach((r) => {
        const co = company(r);
        counters[co] = (counters[co] || 0) + 1;
        const d = wib(r.created);
        r[kodeKey] = `${co}/${prefix}/${ROMAN[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(-2)}/${DEPT_ABBR[dept(r)] || dept(r).slice(0, 3).toUpperCase()}/${counters[co]}`;
      });
    };
    numberRows(pengajuanRows, "PC-PJN", "kode");
    numberRows(voucherRows, "PC-VCR", "kode");
    numberRows(deklarasiRows, "PC-DKL", "kode");
    for (const vc of voucherRows) (vc.subs || []).forEach((sv, i) => (sv.kode = `${vc.kode}-SV${i + 1}`));

    // ----- Budget: saldo & riwayat -----
    console.log("3/5 Menghitung budget & riwayatnya...");
    const historyRows = [];
    const ga = users.dimas;
    for (const b of budgets) {
      const deds = b.deductions.sort((a, z) => a.at - z.at);
      const monthSpend = {};
      for (const d of deds) monthSpend[wib(d.at).getUTCMonth()] = (monthSpend[wib(d.at).getUTCMonth()] || 0) + d.amount;
      const months = [6, 7, 8, 9]; // Jul-Okt
      const factor = b.combo.tight ? 1.02 : 1.35;
      let balance = 0;
      let dIdx = 0;
      const events = [];
      for (const m of months) {
        const at = biz(Date.UTC(2026, m, 1, 1, 30));
        if (at > NOW) break;
        const need = Math.ceil(((monthSpend[m] || 0) * factor) / 500_000) * 500_000;
        if (m === 6) {
          const initial = Math.max(b.combo.budgetBase, need);
          events.push({ at, type: "initial", amount: initial, desc: `Budget awal ${b.name}` });
          balance = initial;
        } else {
          const topup = Math.max(0, need - balance);
          const amount = topup > 0 ? topup : b.combo.tight ? 0 : Math.round(b.combo.budgetBase * 0.2 / 500_000) * 500_000;
          if (amount > 0) {
            events.push({ at, type: "topup", amount, desc: `Top-up budget bulan ${BULAN[m]} 2026` });
            balance += amount;
          }
        }
        const monthEnd = Date.UTC(2026, m + 1, 1) - WIB;
        while (dIdx < deds.length && deds[dIdx].at < monthEnd) {
          const d = deds[dIdx++];
          events.push({ at: d.at, type: "deduction", amount: -d.amount, ref: d.sv, desc: null });
          balance -= d.amount;
        }
      }
      if (balance < 0) throw new Error(`Budget ${b.name} minus - cek perhitungan.`);
      let running = 0;
      for (const e of events) {
        const prev = running;
        running += e.amount;
        historyRows.push({
          budget_id: b.id,
          ref_type: e.type,
          ref_id: e.ref?.id ?? null,
          user_id: e.type === "deduction" ? e.ref.user.id : ga.id,
          change: e.amount,
          prev,
          next: running,
          desc: e.desc ?? `Tarikan Sub-Voucher ${e.ref.kode}`,
          at: e.at,
        });
      }
      b.initial = events[0]?.amount ?? b.combo.budgetBase;
      b.current = running;
      b.created = events[0]?.at ?? START;
    }

    // ----- SQL insert -----
    console.log("4/5 Menulis ke database...");
    for (const b of budgets) {
      sql.push(`insert into public.petty_cash_budget (id, name, department, site, company_code, initial_budget, current_budget, is_active, created_at, updated_at, created_by, updated_by)
        values (${b.id}, ${sqlStr(b.name)}, ${sqlStr(b.department)}, ${sqlStr(b.site)}, ${sqlStr(b.company)}, ${b.initial}, ${b.current}, true,
        ${sqlTs(b.created)}, ${sqlTs(NOW - 2 * HOUR)}, ${sqlStr(ga.id)}, ${sqlStr(ga.id)});`);
    }
    // Budget lama nonaktif (riwayat "deactivate").
    {
      const id = newId();
      const at = Date.UTC(2026, 5, 30, 9);
      sql.push(`insert into public.petty_cash_budget (id, name, department, site, company_code, initial_budget, current_budget, is_active, created_at, updated_at, created_by, updated_by)
        values (${id}, 'Budget Service Site Balikpapan Semester 1 (lama)', 'Service', 'Site Balikpapan', 'GMI', 18000000, 0, false,
        '2026-01-02T01:30:00Z', ${sqlTs(at)}, ${sqlStr(ga.id)}, ${sqlStr(ga.id)});`);
      historyRows.push(
        { budget_id: id, ref_type: "initial", ref_id: null, user_id: ga.id, change: 18_000_000, prev: 0, next: 18_000_000, desc: "Budget awal semester 1", at: Date.UTC(2026, 0, 2, 1, 30) },
        { budget_id: id, ref_type: "adjustment", ref_id: null, user_id: ga.id, change: -1_250_000, prev: 18_000_000, next: 16_750_000, desc: "Koreksi pencatatan manual sebelum sistem", at: Date.UTC(2026, 2, 3, 2) },
        { budget_id: id, ref_type: "deactivate", ref_id: null, user_id: ga.id, change: -16_750_000, prev: 16_750_000, next: 0, desc: "Budget semester 1 ditutup, diganti budget baru", at },
      );
    }
    // Budget kosong utk departemen GMI Head Office lain (user generik).
    const comboKeys = new Set(budgets.map((b) => `${b.department}|${b.site}|${b.company}`));
    for (const dept of GENERIC_HO_DEPTS) {
      if (comboKeys.has(`${dept}|Head Office|GMI`)) continue;
      const id = newId();
      const amount = (int(4, 12) * 1_000_000);
      const at = biz(Date.UTC(2026, 8, 1, 1, 30));
      sql.push(`insert into public.petty_cash_budget (id, name, department, site, company_code, initial_budget, current_budget, is_active, created_at, updated_at, created_by, updated_by)
        values (${id}, ${sqlStr(`Budget ${dept} Head Office (GMI)`)}, ${sqlStr(dept)}, 'Head Office', 'GMI', ${amount}, ${amount}, true,
        ${sqlTs(at)}, ${sqlTs(at)}, ${sqlStr(ga.id)}, ${sqlStr(ga.id)});`);
      historyRows.push({ budget_id: id, ref_type: "initial", ref_id: null, user_id: ga.id, change: amount, prev: 0, next: amount, desc: `Budget awal ${dept} Head Office`, at });
    }
    for (const h of historyRows) {
      sql.push(`insert into public.petty_cash_budget_history (budget_id, ref_type, ref_id, user_id, change_amount, previous_budget, new_budget, description, created_at)
        values (${h.budget_id}, ${sqlStr(h.ref_type)}, ${h.ref_id ?? "null"}, ${sqlStr(h.user_id)}, ${h.change}, ${h.prev}, ${h.next}, ${sqlStr(h.desc)}, ${sqlTs(h.at)});`);
    }

    for (const p of pengajuanRows) {
      sql.push(`insert into public.petty_cash_pengajuan (id, kode_pengajuan, user_id, company_code, department, needed_date, week_of_month, site, budget_id,
        notes, items, total_amount, attachments, status, approvals, discussions, revisions, created_at, created_by, updated_at, updated_by)
        values (${p.id}, ${sqlStr(p.kode)}, ${sqlStr(p.user.id)}, ${sqlStr(p.company)}, ${sqlStr(p.department)}, ${sqlStr(p.needed_date)}, ${p.week_of_month},
        ${sqlStr(p.site)}, ${p.budget_id}, ${sqlStr(p.notes)}, ${sqlJson(p.items)}, ${sumItems(p.items)}, ${sqlJson(p.attachments)}, ${sqlStr(p.status)},
        ${sqlJson(p.approvals)}, ${sqlJson(p.discussions)}, ${sqlJson(p.revisions)}, ${sqlTs(p.created)}, ${sqlStr(p.user.id)}, ${sqlTs(p.updated)}, ${sqlStr(p.user.id)});`);
    }
    for (const v of voucherRows) {
      const p = v.pengajuan;
      sql.push(`insert into public.petty_cash_voucher (id, kode_voucher, pengajuan_id, user_id, company_code, department, needed_date, week_of_month, site, budget_id,
        notes, items, total_amount, attachments, status, approvals, discussions, revisions, created_at, created_by, updated_at, updated_by)
        values (${v.id}, ${sqlStr(v.kode)}, ${p.id}, ${sqlStr(v.user.id)}, ${sqlStr(p.company)}, ${sqlStr(p.department)}, ${sqlStr(p.needed_date)}, ${p.week_of_month},
        ${sqlStr(p.site)}, ${p.budget_id}, ${sqlStr(p.notes)}, ${sqlJson(v.items)}, ${v.total}, ${sqlJson(p.attachments)}, ${sqlStr(v.status)},
        ${sqlJson(v.approvals)}, ${sqlJson(v.discussions)}, '[]'::jsonb, ${sqlTs(v.created)}, ${sqlStr(v.user.id)}, ${sqlTs(v.updated)}, ${sqlStr(v.user.id)});`);
    }
    for (const s of subRows) {
      sql.push(`insert into public.petty_cash_sub_voucher (id, kode_sub_voucher, voucher_id, user_id, amount, items, notes, status, payment_proof, paid_at, paid_by,
        discussions, created_at, created_by, updated_at, updated_by)
        values (${s.id}, ${sqlStr(s.kode)}, ${s.voucher.id}, ${sqlStr(s.user.id)}, ${s.amount}, ${sqlJson(s.items)}, ${sqlStr(s.notes)}, ${sqlStr(s.status)},
        ${sqlJson(s.payment_proof)}, ${sqlTs(s.paid_at ?? null)}, ${s.paid_by ? sqlStr(s.paid_by.id) : "null"}, ${sqlJson(s.discussions)},
        ${sqlTs(s.created)}, ${sqlStr(s.user.id)}, ${sqlTs(s.paid_at ?? s.created)}, ${sqlStr(s.paid_by?.id ?? s.user.id)});`);
    }
    for (const d of deklarasiRows) {
      const p = d.voucher.pengajuan;
      sql.push(`insert into public.petty_cash_deklarasi (id, kode_deklarasi, voucher_id, sub_voucher_id, user_id, company_code, department, week_of_month, site,
        notes, items, total_amount, attachments, status, approvals, discussions, revisions, created_at, created_by, updated_at, updated_by)
        values (${d.id}, ${sqlStr(d.kode)}, ${d.voucher.id}, ${d.sub.id}, ${sqlStr(d.user.id)}, ${sqlStr(p.company)}, ${sqlStr(p.department)}, ${p.week_of_month},
        ${sqlStr(p.site)}, ${sqlStr(d.notes)}, ${sqlJson(d.items)}, ${d.total}, ${sqlJson(d.attachments)}, ${sqlStr(d.status)},
        ${sqlJson(d.approvals)}, ${sqlJson(d.discussions)}, '[]'::jsonb, ${sqlTs(d.created)}, ${sqlStr(d.user.id)}, ${sqlTs(d.updated)}, ${sqlStr(d.user.id)});`);
    }

    // Template pengajuan pribadi (item siap pakai) - coa sengaja null.
    const tplItems = (dept, company) => makeItems(dept, company).map((it) => ({ ...it, coa: null }));
    const PERSONAL_TEMPLATES = [
      ["panji", "ATK & Pantry Bulanan HRGA"], ["panji", "Kebutuhan Induksi Karyawan Baru"],
      ["nadia", "Belanja Pantry Mingguan"], ["nadia", "Perlengkapan Kebersihan"],
      ["dewi", "BBM & E-Tol Tim Service"], ["andi", "Operasional Armada Mingguan"],
      ["sari", "Meeting Klien"], ["fajar", "Perangkat Jaringan"],
    ];
    for (const [k, name] of PERSONAL_TEMPLATES) {
      const u = users[k];
      sql.push(`insert into public.petty_cash_pengajuan_template (id, user_id, nama_template, items, created_at, updated_at)
        values (${newId()}, ${sqlStr(u.id)}, ${sqlStr(name)}, ${sqlJson(tplItems(u.department, u.company))}, ${sqlTs(START + int(1, 20) * DAY)}, ${sqlTs(START + 25 * DAY)});`);
    }

    // Harga terakhir katalog = harga yang dipakai di seed.
    const lastPrice = new Map();
    for (const p of [...pengajuanRows].sort((a, b) => a.created - b.created)) {
      for (const it of p.items) if (it.barang_id) lastPrice.set(it.barang_id, it.unit_price);
    }
    for (const b of barang) {
      sql.push(`update public.petty_cash_barang set last_purchase_price = ${lastPrice.get(b.id) ?? b.price} where id = ${b.id};`);
    }

    sql.push("commit;");
    run(sql.join("\n"));

    console.log(`5/5 Mengunggah ${files.length} file lampiran demo...`);
    await cleanFiles(key);
    await uploadFiles(key);

    const count = (rows, status) => rows.filter((r) => r.status === status).length;
    console.log(`
Selesai!
  Pengajuan  : ${pengajuanRows.length} (In Approval ${count(pengajuanRows, "In Approval")}, Approved ${count(pengajuanRows, "Approved")}, Rejected ${count(pengajuanRows, "Rejected")})
  Voucher    : ${voucherRows.length} (In Approval ${count(voucherRows, "In Approval")}, Approved ${count(voucherRows, "Approved")}, Selesai ${count(voucherRows, "Selesai")}, Rejected ${count(voucherRows, "Rejected")})
  Sub-Voucher: ${subRows.length} (Menunggu Pembayaran ${count(subRows, "Menunggu Pembayaran")}, Selesai ${count(subRows, "Selesai")})
  Deklarasi  : ${deklarasiRows.length} (In Approval ${count(deklarasiRows, "In Approval")}, Approved ${count(deklarasiRows, "Approved")}, Rejected ${count(deklarasiRows, "Rejected")})
  Budget     : ${budgets.length} aktif bertransaksi + ${GENERIC_HO_DEPTS.length - [...comboKeys].filter((k) => k.endsWith("|Head Office|GMI")).length} budget HO + 1 nonaktif
  Template   : ${TEMPLATES.length} template approval, ${ruleKeys.size} auto-rule, ${PERSONAL_TEMPLATES.length} template pengajuan

Login demo (password "${PASSWORD}"):
${DEMO_USERS.map((u) => `  ${u.email.padEnd(28)} ${u.role.padEnd(9)} ${u.department} - ${u.lokasi} (${u.company})`).join("\n")}`);
  })();
}

main().catch((err) => {
  console.error("Seed gagal:", err);
  process.exit(1);
});
