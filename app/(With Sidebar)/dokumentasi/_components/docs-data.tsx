// SEMUA ISI halaman Dokumentasi ada di sini (data, bukan layout) - kalau
// alur aplikasi berubah, cukup ubah file ini; komponen di folder ini yang
// mengurus tampilannya (stepper, diagram, kamus status, FAQ).

import {
  Banknote,
  CheckCheck,
  CircleDollarSign,
  ClipboardCheck,
  FileCheck,
  FilePlus,
  FileSearch,
  HandCoins,
  Lock,
  PackageCheck,
  Receipt,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { StatusPill, type RoleId, type StatusDomain } from "./primitives";
import type { VisualId } from "./step-visuals";

// ---------------------------------------------------------------------------
// STEPPER ALUR
// ---------------------------------------------------------------------------

export type FlowId = "mr" | "po" | "pc";

export type FlowStep = {
  title: string;
  /** Label pendek di indikator stepper. */
  short: string;
  icon: React.ElementType;
  actors: RoleId[];
  /** Menu yang dibuka di sidebar. */
  menu?: string;
  /** Satu kalimat inti - yang dibaca orang yang malas baca. */
  summary: React.ReactNode;
  /** Panduan teks lengkap. */
  details: React.ReactNode[];
  status?: { from?: string; to: string; domain?: StatusDomain };
  tip?: React.ReactNode;
  visual: VisualId;
};

export type Flow = {
  id: FlowId;
  anchor: string;
  title: string;
  subtitle: string;
  steps: FlowStep[];
};

const b = (s: string) => <strong className="text-foreground">{s}</strong>;

export const FLOWS: Record<FlowId, Flow> = {
  mr: {
    id: "mr",
    anchor: "alur-mr",
    title: "Alur Material Request (MR)",
    subtitle: "Dari permintaan barang sampai siap dibelikan Purchasing.",
    steps: [
      {
        title: "Buat MR",
        short: "Buat MR",
        icon: FilePlus,
        actors: ["requester"],
        menu: "Material Request → Buat MR Baru",
        summary: (
          <>
            Isi kebutuhan barang, pilih {b("Prioritas")}, dan isi{" "}
            {b("Estimasi Harga")} tiap barang. Totalnya dihitung otomatis.
          </>
        ),
        details: [
          <>Isi Kategori, Remarks (alasan), dan Tujuan Site.</>,
          <>
            Pilih {b("Prioritas P0–P4")}. Due Date (Target Pemakaian) terisi
            otomatis dari prioritas. Lihat bagian Prioritas di bawah.
          </>,
          <>
            Klik &quot;Tambah Order Item&quot;. Setiap barang {b("wajib")} diisi
            Estimasi Harga, dan Total Estimasi Biaya MR dijumlahkan otomatis.
          </>,
          <>
            Kategori &quot;Replace&quot;, &quot;Fix &amp; Repair&quot;, dan
            &quot;Upgrade&quot; wajib melampirkan file pendukung. File yang
            terlalu besar bisa dilampirkan sebagai {b("link")}.
          </>,
          <>Klik &quot;Buat Material Request&quot;.</>,
        ],
        status: { to: "Pending Validation" },
        tip: <>Cost Center tidak dipilih Requester, tapi ditentukan GA di langkah berikutnya.</>,
        visual: "mr-create",
      },
      {
        title: "Validasi oleh GA",
        short: "Validasi",
        icon: FileSearch,
        actors: ["ga"],
        menu: "Approval & Validation",
        summary: (
          <>
            GA memeriksa MR, {b("memilih Cost Center")} yang menanggung biaya,
            lalu memasang jalur approval.
          </>
        ),
        details: [
          <>Buka MR yang berstatus Pending Validation.</>,
          <>
            {b("Wajib:")} pilih Cost Center. Sisa budget-nya langsung terlihat
            saat memilih.
          </>,
          <>
            Pilih Template Approval yang sesuai. Kalau perlu, jalur approver
            bisa ditambah atau dikurangi.
          </>,
          <>
            Kalau MR belum lengkap, tahan dulu dengan {b("On Hold")}. Requester
            bisa memperbaiki lalu submit ulang.
          </>,
          <>Klik &quot;Validasi &amp; Mulai Approval&quot;.</>,
        ],
        status: { from: "Pending Validation", to: "Pending Approval" },
        tip: <>Salah pilih Cost Center? Setelah divalidasi hanya Admin yang bisa memperbaikinya (menu MR Management).</>,
        visual: "mr-validate",
      },
      {
        title: "Approval berjenjang",
        short: "Approval",
        icon: CheckCheck,
        actors: ["approver"],
        menu: "Approval & Validation",
        summary: (
          <>
            MR berjalan {b("berurutan")} ke setiap approver (Manager → GM →
            Direksi). Masing-masing memilih Approve atau Reject.
          </>
        ),
        details: [
          <>Approver hanya melihat MR ketika sudah tiba gilirannya.</>,
          <>Pilih Approve untuk meneruskan, atau Reject untuk menghentikan MR.</>,
          <>
            Gunakan kolom {b("Diskusi")} untuk tanya jawab dengan Requester.
            Bisa mention dan membalas komentar.
          </>,
          <>Setelah approver terakhir menyetujui, MR siap dibuatkan PO.</>,
        ],
        status: { from: "Pending Approval", to: "Waiting PO" },
        visual: "mr-approval",
      },
      {
        title: "Budget terpotong otomatis",
        short: "Budget",
        icon: CircleDollarSign,
        actors: ["system"],
        summary: (
          <>
            Begitu MR menjadi {b("Waiting PO")}, sistem otomatis memotong budget
            Cost Center sebesar Total Estimasi MR.
          </>
        ),
        details: [
          <>Pemotongan terjadi otomatis, tidak perlu klik apa pun.</>,
          <>Besar potongan = Total Estimasi Biaya MR.</>,
          <>
            Semua transaksi tercatat di Cost Center Management (Admin, GA, dan
            GM).
          </>,
        ],
        visual: "mr-budget",
      },
    ],
  },

  po: {
    id: "po",
    anchor: "alur-po",
    title: "Alur Purchase Order (PO)",
    subtitle: "Dari pembelian ke vendor sampai barang diterima Requester.",
    steps: [
      {
        title: "Buat PO",
        short: "Buat PO",
        icon: ShoppingCart,
        actors: ["purchasing"],
        menu: "Purchase Order",
        summary: (
          <>
            Purchasing memilih MR yang berstatus {b("Waiting PO")}, lalu mengisi
            vendor, harga final, payment term, dan pajak.
          </>
        ),
        details: [
          <>MR yang siap diproses muncul di daftar Waiting PO.</>,
          <>Cari barang di master data &quot;Barang&quot; dan isi harga beli final dari vendor.</>,
          <>
            Isi Vendor, Payment Term, dan PPN. Vendor {b("wajib")} sudah punya
            Tipe Vendor (HO/Branch/Site).
          </>,
          <>Klik &quot;Ajukan&quot;.</>,
        ],
        status: { to: "Pending Validation" },
        tip: <>Barang belum ada di master? Gunakan menu &quot;Request Barang Baru&quot;.</>,
        visual: "po-create",
      },
      {
        title: "Validasi oleh GA",
        short: "Validasi",
        icon: FileCheck,
        actors: ["ga"],
        menu: "Approval & Validation",
        summary: (
          <>
            GA memasang {b("Template Approval PO")}. Urutan step Receiver dan
            Payment Validator di template menentukan jalur pembayarannya.
          </>
        ),
        details: [
          <>Buka PO yang baru dibuat, lalu pilih Template Approval PO.</>,
          <>
            Pastikan urutannya sesuai metode bayar: {b("Cash")} = Payment
            Validator dulu, {b("Termin")} = Receiver dulu. Lihat bagian
            &quot;4 Jalur Pembayaran&quot;.
          </>,
          <>Klik &quot;Validasi&quot;.</>,
        ],
        status: { from: "Pending Validation", to: "Pending Approval" },
        visual: "po-validate",
      },
      {
        title: "Approval & pembayaran",
        short: "Approval",
        icon: Wallet,
        actors: ["approver", "finance"],
        menu: "Approval & Validation / detail PO",
        summary: (
          <>
            Approver menyetujui sesuai urutan. {b("Payment Validator")} wajib
            melampirkan bukti pembayaran saat approve.
          </>
        ),
        details: [
          <>Setiap approver menyetujui PO sesuai gilirannya di template.</>,
          <>
            Payment Validator {b("wajib")} melampirkan bukti pembayaran. File
            ini otomatis tersimpan sebagai lampiran Finance di PO.
          </>,
          <>
            PO dengan metode DP &amp; Pelunasan punya centang {b("DP")} dan{" "}
            {b("BP")} yang terpisah. Keduanya bisa diedit kapan saja lewat
            tombol &quot;Edit DP/BP&quot;.
          </>,
          <>
            Kalau pembayaran beres duluan → PO menjadi Pending Receive. Kalau
            barang diterima duluan → PO menjadi Pending Payment.
          </>,
        ],
        status: { from: "Pending Approval", to: "Pending Receive" },
        visual: "po-approval",
      },
      {
        title: "Terima barang (checklist)",
        short: "Terima",
        icon: ClipboardCheck,
        actors: ["receiver", "ga"],
        menu: "Detail PO → Terima Barang",
        summary: (
          <>
            Saat barang datang, Receiver/GA mengisi {b("checklist qty aktual")}{" "}
            dibandingkan qty di PO untuk setiap barang.
          </>
        ),
        details: [
          <>
            Checklist diisi lewat step approval &quot;Receiver&quot;, atau
            tombol &quot;Terima Barang&quot; manual oleh GA.
          </>,
          <>
            Semua qty pas → {b("Full Received")}. Ada yang kurang atau tidak
            datang → {b("Partial Receive")}.
          </>,
          <>
            Checklist bisa diedit ulang (&quot;Edit Penerimaan Barang&quot;)
            dan riwayatnya bisa dicetak (&quot;Cetak Riwayat Receive&quot;).
          </>,
          <>
            Untuk {b("vendor Site")}, checklist diisi Requester sendiri karena
            barang dikirim langsung ke site.
          </>,
        ],
        status: { from: "Pending Receive", to: "Full Received" },
        visual: "po-receive",
      },
      {
        title: "Kirim & konfirmasi Requester",
        short: "Konfirmasi",
        icon: PackageCheck,
        actors: ["ga", "requester"],
        menu: "Detail PO → Kirim ke Requester / Detail MR",
        summary: (
          <>
            GA mengirim barang ke Requester. Requester mengonfirmasi dengan{" "}
            {b("upload bukti")} atau {b("scan QR BAST")}.
          </>
        ),
        details: [
          <>
            GA klik &quot;Kirim ke Requester&quot; dan mengisi jenis
            pengiriman, ekspedisi, dan resi. Status barang menjadi Dalam
            Pengiriman.
          </>,
          <>
            {b("Cara 1:")} Requester membuka detail MR, lalu klik banner
            &quot;Konfirmasi Barang Diterima&quot; dan upload foto/file bukti.
          </>,
          <>
            {b("Cara 2:")} Scan QR di cetakan BAST (tombol &quot;Cetak
            BAST&quot; di detail PO). Bisa login, atau isi nama + Kode Global
            dari Admin, lalu foto barang langsung dari kamera.
          </>,
          <>
            Setelah dikonfirmasi, barang berstatus {b("Barang Diterima User")}.
            Status ini dipakai untuk laporan dan tidak mengubah status PO.
          </>,
        ],
        status: { from: "On Delivery", to: "Completed", domain: "item" },
        visual: "po-deliver",
      },
    ],
  },

  pc: {
    id: "pc",
    anchor: "petty-cash",
    title: "Alur Petty Cash (Kas Kecil)",
    subtitle:
      "Pengajuan → Voucher → Tarik Dana → Deklarasi. Setiap dokumen punya jalur approval sendiri.",
    steps: [
      {
        title: "Input Pengajuan",
        short: "Pengajuan",
        icon: FilePlus,
        actors: ["requester"],
        menu: "Petty Cash → Pengajuan Saya → Input Pengajuan",
        summary: (
          <>
            Pilih barang dari katalog Petty Cash (atau tambah manual), lalu
            submit. Jalur approval {b("dipasang otomatis")} sesuai departemen.
          </>
        ),
        details: [
          <>
            Sistem mengecek {b("3 syarat")} dulu: departemen punya Template
            Approval Pengajuan, punya Budget Petty Cash aktif, dan Anda tidak
            sedang punya tarikan dana yang belum dideklarasikan.
          </>,
          <>Pilih barang, isi tanggal dibutuhkan, dan lampiran (opsional).</>,
          <>Submit, lalu jalur approval diambil otomatis dari Template Approval Petty Cash.</>,
        ],
        status: { to: "In Approval", domain: "pc" },
        tip: <>Ditolak karena syarat? Hubungi GA/Admin untuk mengatur Template Approval atau Budget departemen Anda.</>,
        visual: "pc-input",
      },
      {
        title: "Approval Pengajuan",
        short: "Approval",
        icon: CheckCheck,
        actors: ["approver"],
        menu: "Petty Cash → Approval Petty Cash",
        summary: (
          <>
            Approver menyetujui {b("berurutan")}. Satu penolakan langsung
            menghentikan dokumen.
          </>
        ),
        details: [
          <>Approver terakhir setuju → Pengajuan menjadi Approved.</>,
          <>Ada yang menolak → langsung Rejected. Alasannya dicatat dan tidak diteruskan ke approver berikutnya.</>,
        ],
        status: { from: "In Approval", to: "Approved", domain: "pc" },
        visual: "pc-approval-pengajuan",
      },
      {
        title: "Pengajuan Voucher",
        short: "Voucher",
        icon: Lock,
        actors: ["requester"],
        menu: "Pengajuan Saya → Pengajuan Voucher",
        summary: (
          <>
            Buat Voucher dari Pengajuan yang sudah Approved. Isinya{" "}
            {b("disalin persis")} dan tidak bisa diedit.
          </>
        ),
        details: [
          <>Pilih Pengajuan berstatus Approved yang belum punya Voucher.</>,
          <>Barang, qty, harga, dan lampiran disalin apa adanya. 1 Pengajuan hanya bisa jadi 1 Voucher.</>,
          <>Voucher mendapat jalur approval baru yang terpisah (Template &quot;Approval Voucher&quot;).</>,
        ],
        status: { to: "In Approval", domain: "pc" },
        visual: "pc-voucher",
      },
      {
        title: "Approval Voucher",
        short: "Approval",
        icon: CheckCheck,
        actors: ["approver"],
        menu: "Petty Cash → Approval Petty Cash",
        summary: <>Voucher disetujui lewat jalurnya sendiri. Setelah Approved, dananya boleh ditarik.</>,
        details: [
          <>Jalur ini bukan lanjutan approval Pengajuan, melainkan jalur baru.</>,
          <>Approver bisa memakai &quot;Edit &amp; Setujui&quot; untuk mengoreksi lalu langsung approve.</>,
        ],
        status: { from: "In Approval", to: "Approved", domain: "pc" },
        visual: "pc-approval-voucher",
      },
      {
        title: "Tarik Dana (Sub-Voucher)",
        short: "Tarik Dana",
        icon: HandCoins,
        actors: ["requester"],
        menu: "Pengajuan Voucher → Voucher Saya → Tarik Dana",
        summary: (
          <>
            Tarik dana {b("bertahap")}: pilih barang dan qty yang mau ditarik.
            Setiap tarikan menjadi Sub-Voucher dengan kode sendiri.
          </>
        ),
        details: [
          <>Tarikan dipilih per barang/qty (boleh sebagian), bukan nominal bebas.</>,
          <>Satu Voucher bisa ditarik beberapa kali (SV1, SV2, …) sampai habis.</>,
          <>Tarikan baru belum berarti dana sudah diterima, karena masih menunggu Finance membayar.</>,
        ],
        status: { to: "Menunggu Pembayaran", domain: "pc" },
        visual: "pc-tarik",
      },
      {
        title: "Pembayaran oleh Finance",
        short: "Bayar",
        icon: Banknote,
        actors: ["finance"],
        menu: "Approval Petty Cash → Pembayaran Sub-Voucher",
        summary: (
          <>
            Finance mentransfer dana dan {b("wajib upload bukti transfer")}.
            Setelah itu tarikan selesai dan boleh dideklarasikan.
          </>
        ),
        details: [
          <>Dikerjakan approver dari departemen Finance (atau Admin).</>,
          <>Bukti transfer wajib dilampirkan.</>,
        ],
        status: { from: "Menunggu Pembayaran", to: "Selesai", domain: "pc" },
        visual: "pc-bayar",
      },
      {
        title: "Deklarasi",
        short: "Deklarasi",
        icon: Receipt,
        actors: ["requester", "approver"],
        menu: "Petty Cash → Deklarasi",
        summary: (
          <>
            Laporkan pemakaian riil {b("setiap tarikan")} beserta foto struk.
            Setelah semua tarikan dideklarasikan dan disetujui, Voucher menjadi
            Selesai.
          </>
        ),
        details: [
          <>Qty, harga, dan catatan boleh disesuaikan dengan struk asli. Nama barang dan UoM tetap mengikuti tarikannya.</>,
          <>Deklarasi punya jalur approval sendiri (Template &quot;Approval Deklarasi&quot;).</>,
          <>Selama masih ada tarikan yang belum dideklarasikan, Anda tidak bisa membuat Pengajuan baru.</>,
          <>Halaman Deklarasi sedang dirombak. Detailnya akan diperbarui di sini begitu rilis.</>,
        ],
        status: { to: "Selesai", domain: "pc" },
        visual: "pc-deklarasi",
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// PERAN - ringkasan "Tugas Anda"
// ---------------------------------------------------------------------------

export type RoleTask = {
  text: React.ReactNode;
  /** Lompat ke langkah stepper tertentu. */
  jump?: { flow: FlowId; step: number };
  /** Atau lompat ke anchor section. */
  anchor?: string;
};

export const PICKABLE_ROLES: RoleId[] = [
  "requester",
  "approver",
  "ga",
  "purchasing",
  "receiver",
  "finance",
  "admin",
];

export const ROLE_INFO: Record<
  Exclude<RoleId, "system">,
  { who: string; tasks: RoleTask[] }
> = {
  requester: {
    who: "Semua karyawan yang membutuhkan barang atau dana kas kecil.",
    tasks: [
      { text: "Buat MR: pilih prioritas dan isi estimasi harga tiap barang", jump: { flow: "mr", step: 0 } },
      { text: "Pantau status MR di menu \"MR Saya\"", anchor: "status" },
      { text: "Konfirmasi barang diterima (upload bukti / scan QR BAST)", jump: { flow: "po", step: 4 } },
      { text: "Petty Cash: Pengajuan → Voucher → Tarik Dana → Deklarasi", jump: { flow: "pc", step: 0 } },
    ],
  },
  approver: {
    who: "Manager, GM, Direksi, atau siapa pun yang ada di jalur approval.",
    tasks: [
      { text: "Cek antrian di menu \"Approval & Validation\"", jump: { flow: "mr", step: 2 } },
      { text: "Approve/Reject PO saat tiba giliran Anda", jump: { flow: "po", step: 2 } },
      { text: "Approve dokumen Petty Cash di \"Approval Petty Cash\"", jump: { flow: "pc", step: 1 } },
    ],
  },
  ga: {
    who: "General Affair, validator pusat untuk MR dan PO.",
    tasks: [
      { text: "Validasi MR: pilih Cost Center & Template Approval", jump: { flow: "mr", step: 1 } },
      { text: "Validasi PO: pasang template sesuai metode bayar", jump: { flow: "po", step: 1 } },
      { text: "Terima barang (checklist qty) & Kirim ke Requester", jump: { flow: "po", step: 3 } },
      { text: "Pahami rute penerimaan per Tipe Vendor", anchor: "penerimaan" },
    ],
  },
  purchasing: {
    who: "Tim Purchasing/Procurement yang mengeksekusi pembelian.",
    tasks: [
      { text: "Proses MR berstatus Waiting PO menjadi PO", jump: { flow: "po", step: 0 } },
      { text: "Pastikan vendor sudah punya Tipe Vendor (HO/Branch/Site)", anchor: "penerimaan" },
      { text: "Kelola master Barang & menu \"Permintaan Barang\"" },
    ],
  },
  receiver: {
    who: "Biasanya GA/Warehouse yang mengecek fisik barang.",
    tasks: [
      { text: "Isi checklist qty diterima vs qty PO", jump: { flow: "po", step: 3 } },
      { text: "Edit checklist selama masih Partial Receive", jump: { flow: "po", step: 3 } },
      { text: "Pahami kapan giliran Anda di tiap jalur pembayaran", anchor: "pembayaran" },
    ],
  },
  finance: {
    who: "Payment Validator PO & pembayar Sub-Voucher Petty Cash.",
    tasks: [
      { text: "Approve PO dengan bukti pembayaran (DP/BP bila ada)", jump: { flow: "po", step: 2 } },
      { text: "Pahami 4 jalur pembayaran PO", anchor: "pembayaran" },
      { text: "Bayar Sub-Voucher + upload bukti transfer", jump: { flow: "pc", step: 5 } },
    ],
  },
  admin: {
    who: "Super user dengan akses penuh untuk perbaikan data.",
    tasks: [
      { text: "Kelola akun (User Management) & budget (Cost Center Management)" },
      { text: "Koreksi MR/PO lewat MR Management / PO Management" },
      { text: "Benahi dokumen Petty Cash yang nyangkut di Management Petty Cash" },
      { text: "Atur Kode Global untuk scan QR penerimaan barang", jump: { flow: "po", step: 4 } },
    ],
  },
};

// ---------------------------------------------------------------------------
// GAMBARAN BESAR - perjalanan satu barang
// ---------------------------------------------------------------------------

export const JOURNEY: {
  label: string;
  icon: React.ElementType;
  role: RoleId;
  jump: { flow: FlowId; step: number };
}[] = [
  { label: "Buat MR", icon: FilePlus, role: "requester", jump: { flow: "mr", step: 0 } },
  { label: "Validasi MR", icon: FileSearch, role: "ga", jump: { flow: "mr", step: 1 } },
  { label: "Approval MR", icon: CheckCheck, role: "approver", jump: { flow: "mr", step: 2 } },
  { label: "Buat PO", icon: ShoppingCart, role: "purchasing", jump: { flow: "po", step: 0 } },
  { label: "Approval & Bayar", icon: Wallet, role: "finance", jump: { flow: "po", step: 2 } },
  { label: "Terima Barang", icon: ClipboardCheck, role: "receiver", jump: { flow: "po", step: 3 } },
  { label: "Konfirmasi User", icon: PackageCheck, role: "requester", jump: { flow: "po", step: 4 } },
];

// ---------------------------------------------------------------------------
// 4 JALUR PEMBAYARAN PO
// ---------------------------------------------------------------------------

export type PaymentVariant = {
  id: string;
  label: string;
  short: string;
  /** true = Payment Validator dulu, false = Receiver dulu. */
  payFirst: boolean;
  dpbp?: "after-dp" | "after-lunas";
  between: string;
  desc: React.ReactNode;
};

export const PAYMENT_VARIANTS: PaymentVariant[] = [
  {
    id: "cash",
    label: "Cash",
    short: "Bayar dulu, baru terima",
    payFirst: true,
    between: "Pending Receive",
    desc: (
      <>
        Payment Validator approve (dengan bukti bayar) → PO menjadi{" "}
        <StatusPill status="Pending Receive" /> → Receiver menerima barang dan
        mengisi checklist → langsung final.
      </>
    ),
  },
  {
    id: "termin",
    label: "Termin",
    short: "Terima dulu, bayar belakangan",
    payFirst: false,
    between: "Pending Payment",
    desc: (
      <>
        Receiver menerima barang dan mengisi checklist lebih dulu → PO menjadi{" "}
        <StatusPill status="Pending Payment" /> → Payment Validator approve →
        final sesuai hasil checklist sebelumnya.
      </>
    ),
  },
  {
    id: "dp-after-dp",
    label: "DP & Pelunasan",
    short: "Barang dikirim setelah DP",
    payFirst: false,
    dpbp: "after-dp",
    between: "Pending Payment",
    desc: (
      <>
        Urutannya sama seperti Termin (Receiver dulu). Vendor boleh mengirim
        begitu {b("DP")} lunas, dan {b("BP")} menyusul belakangan. Centang
        DP/BP bisa diedit kapan saja lewat &quot;Edit DP/BP&quot;.
      </>
    ),
  },
  {
    id: "dp-after-lunas",
    label: "DP & Pelunasan",
    short: "Barang dikirim setelah lunas",
    payFirst: true,
    dpbp: "after-lunas",
    between: "Pending Receive",
    desc: (
      <>
        Urutannya sama seperti Cash (Payment Validator dulu). Barang baru boleh
        dikirim dan diterima setelah {b("DP dan BP")} sama-sama lunas.
      </>
    ),
  },
];

// ---------------------------------------------------------------------------
// TIPE VENDOR
// ---------------------------------------------------------------------------

export const VENDOR_ROUTES: {
  id: string;
  label: string;
  stops: { label: string; role?: RoleId }[];
  desc: React.ReactNode;
}[] = [
  {
    id: "ho",
    label: "Vendor HO",
    stops: [
      { label: "Vendor" },
      { label: "GA Head Office", role: "ga" },
      { label: "Requester", role: "requester" },
    ],
    desc: (
      <>
        Barang dikirim ke Head Office. GA mengisi checklist &quot;Terima
        Barang&quot;, lalu klik &quot;Kirim ke Requester&quot;. Requester
        kemudian mengonfirmasi penerimaan. Ini alur standar.
      </>
    ),
  },
  {
    id: "branch",
    label: "Vendor Branch",
    stops: [
      { label: "Vendor" },
      { label: "GA Cabang/Site", role: "ga" },
      { label: "Requester", role: "requester" },
    ],
    desc: (
      <>
        Sama seperti HO, tapi yang menerima adalah GA di cabang/site tujuan MR.
        GA yang bertugas tetap ditentukan manual (step &quot;Receiver&quot;
        atau tombol &quot;Terima Barang&quot;), sistem tidak membatasi
        berdasarkan lokasi.
      </>
    ),
  },
  {
    id: "site",
    label: "Vendor Site",
    stops: [
      { label: "Vendor" },
      { label: "Requester di Site", role: "requester" },
    ],
    desc: (
      <>
        Barang dikirim langsung ke site, {b("tanpa proses terima GA")}. Begitu
        PO berstatus Pending Receive, tombol &quot;Konfirmasi Terima
        Barang&quot; muncul untuk Requester di detail PO. Requester mengisi
        checklist sendiri lalu langsung upload bukti.
      </>
    ),
  },
];

// ---------------------------------------------------------------------------
// PRIORITAS
// ---------------------------------------------------------------------------

export const PRIORITIES = [
  { code: "P0", name: "Emergency", days: 2, color: "bg-red-600" },
  { code: "P1", name: "High", days: 10, color: "bg-orange-500" },
  { code: "P2", name: "Medium", days: 15, color: "bg-yellow-500" },
  { code: "P3", name: "Low", days: 25, color: "bg-green-600" },
  { code: "P4", name: "Umum (default)", days: 30, color: "bg-gray-500" },
];

// ---------------------------------------------------------------------------
// KAMUS STATUS
// ---------------------------------------------------------------------------

export type StatusEntry = {
  status: string;
  label?: string;
  domain: StatusDomain;
  desc: string;
  /** Bagian dari jalur utama (ditampilkan sebagai rantai). */
  main?: boolean;
};

export const STATUS_GROUPS: {
  id: string;
  label: string;
  hint: string;
  entries: StatusEntry[];
}[] = [
  {
    id: "mr",
    label: "Dokumen MR",
    hint: "Status keseluruhan satu MR.",
    entries: [
      { status: "Pending Validation", domain: "doc", main: true, desc: "MR baru dibuat, sedang ditinjau dan ditentukan Cost Center-nya oleh GA." },
      { status: "Pending Approval", domain: "doc", main: true, desc: "Sedang dalam antrian persetujuan berjenjang sesuai template approval." },
      { status: "Waiting PO", domain: "doc", main: true, desc: "Sudah disetujui semua approver dan siap dibuatkan PO. Budget Cost Center terpotong di titik ini." },
      { status: "On Process", label: "PO Open", domain: "doc", main: true, desc: "Sebagian/semua barang sudah masuk PO, tapi belum semuanya diterima user." },
      { status: "Pending Receive", domain: "doc", main: true, desc: "Semua barang sudah ter-cover PO, tapi belum ada satu pun yang dikonfirmasi diterima user." },
      { status: "Partial Receive", domain: "doc", main: true, desc: "Sebagian barang sudah dikonfirmasi diterima user, tapi belum semuanya." },
      { status: "Full Received", domain: "doc", main: true, desc: "Semua barang sudah dikonfirmasi diterima user. Siklus MR selesai." },
      { status: "On Hold", domain: "doc", desc: "Ditahan GA (mis. menunggu info tambahan). Requester bisa memperbaiki lalu submit ulang." },
      { status: "Rejected", domain: "doc", desc: "Ditolak GA saat validasi atau oleh salah satu approver." },
    ],
  },
  {
    id: "item",
    label: "Barang di MR",
    hint: "Setiap barang di dalam MR punya status sendiri, karena bisa diproses lewat PO yang berbeda.",
    entries: [
      { status: "Pending", label: "Menunggu", domain: "item", main: true, desc: "Belum diproses Purchasing dan belum masuk PO mana pun." },
      { status: "Processing", label: "Proses PO", domain: "item", main: true, desc: "Sudah masuk PO dan menunggu pembayaran/pengiriman." },
      { status: "Dikirim Vendor", label: "Dikirim dari Vendor", domain: "item", main: true, desc: "Pembayaran sudah divalidasi dan vendor mulai mengirim, tapi belum diterima fisik." },
      { status: "Diterima GA", domain: "item", main: true, desc: "Sudah diterima dan di-checklist GA/Receiver, belum dikirim ke Requester." },
      { status: "On Delivery", label: "Dalam Pengiriman", domain: "item", main: true, desc: "Sedang dikirim ke Requester (atau langsung untuk vendor Site). Requester tinggal konfirmasi." },
      { status: "Completed", label: "Barang Diterima User", domain: "item", main: true, desc: "Requester sudah upload bukti/scan QR. Dipakai untuk laporan." },
      { status: "Pending BAST", label: "Pending Terima User", domain: "item", desc: "Status lama (data lama) dengan arti yang sama seperti Dalam Pengiriman: menunggu konfirmasi Requester." },
      { status: "Replaced", label: "Diganti", domain: "item", desc: "Barang disubstitusi dengan barang lain saat proses belanja." },
      { status: "Cancelled", label: "Dibatalkan", domain: "item", desc: "Dibatalkan, mis. PO-nya di-Reject dan tidak ada PO pengganti." },
    ],
  },
  {
    id: "po",
    label: "Dokumen PO",
    hint: "Status satu Purchase Order.",
    entries: [
      { status: "Pending Validation", domain: "doc", main: true, desc: "PO baru dibuat Purchasing dan menunggu GA memasang template approval." },
      { status: "Pending Approval", domain: "doc", main: true, desc: "Sedang dalam antrian persetujuan sesuai template." },
      { status: "Pending Payment", domain: "doc", main: true, desc: "Menunggu step pembayaran selesai. Bisa muncul sebelum atau sesudah barang diterima, tergantung jalur pembayarannya." },
      { status: "Pending Receive", domain: "doc", main: true, desc: "Approval & pembayaran beres, menunggu barang diterima dan di-checklist." },
      { status: "Partial Receive", domain: "doc", main: true, desc: "Barang sudah di-checklist tapi qty belum sesuai PO. Checklist bisa diedit ulang." },
      { status: "Full Received", domain: "doc", main: true, desc: "Semua barang diterima sesuai qty PO. Ini status akhir PO." },
      { status: "Rejected", domain: "doc", desc: "Ditolak salah satu approver PO." },
    ],
  },
  {
    id: "pc",
    label: "Petty Cash",
    hint: "Berlaku untuk Pengajuan, Voucher, Sub-Voucher, dan Deklarasi.",
    entries: [
      { status: "In Approval", domain: "pc", main: true, desc: "Sedang dalam antrian persetujuan (Pengajuan/Voucher/Deklarasi)." },
      { status: "Approved", domain: "pc", main: true, desc: "Disetujui semua approver. Pengajuan → siap dibuatkan Voucher, Voucher → dana boleh ditarik, Deklarasi → tarikan tuntas." },
      { status: "Menunggu Pembayaran", domain: "pc", main: true, desc: "Sub-Voucher (tarikan dana) baru dibuat, menunggu Finance mentransfer." },
      { status: "Selesai", domain: "pc", main: true, desc: "Sub-Voucher: sudah dibayar dan boleh dideklarasikan. Voucher: semua tarikan sudah dideklarasikan & disetujui." },
      { status: "Rejected", domain: "pc", desc: "Ditolak salah satu approver. Alasannya dicatat di riwayat diskusi." },
    ],
  },
];

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

export const FAQS: { q: string; a: React.ReactNode; tags: RoleId[] }[] = [
  {
    q: "Kenapa saya tidak bisa memilih Cost Center saat membuat MR?",
    a: <>Cost Center ditentukan GA saat validasi, bukan oleh Requester. Tujuannya supaya kontrol budget lebih rapi.</>,
    tags: ["requester"],
  },
  {
    q: "Kenapa input \"Estimasi Biaya\" tidak bisa diisi?",
    a: <>Karena dihitung otomatis dari {b("Qty × Estimasi Harga")} setiap barang di Order Items.</>,
    tags: ["requester"],
  },
  {
    q: "Kenapa Due Date terisi sendiri?",
    a: <>Due Date diisi otomatis dari Prioritas yang Anda pilih (P0 = 2 hari … P4 = 30 hari). Ganti prioritasnya kalau ingin due date yang berbeda.</>,
    tags: ["requester"],
  },
  {
    q: "Kapan budget Cost Center berkurang?",
    a: <>Setelah {b("semua approver menyetujui MR")}, yaitu saat status berubah dari Pending Approval menjadi Waiting PO.</>,
    tags: ["requester", "ga", "admin"],
  },
  {
    q: "Saya (GA) salah memilih Cost Center saat validasi. Bagaimana mengubahnya?",
    a: <>Setelah divalidasi, GA tidak bisa mengubahnya. Hubungi Admin untuk memperbaiki lewat menu MR Management.</>,
    tags: ["ga", "admin"],
  },
  {
    q: "Saya tidak menemukan tombol untuk konfirmasi barang diterima.",
    a: (
      <>
        Tombol baru muncul setelah barang dikirim GA ke Anda (status{" "}
        <StatusPill status="On Delivery" domain="item" label="Dalam Pengiriman" />
        ). Hanya Requester pembuat MR yang bisa mengonfirmasi. Untuk vendor
        Site, tombolnya ada di detail PO setelah PO berstatus Pending Receive.
      </>
    ),
    tags: ["requester"],
  },
  {
    q: "Saya scan QR BAST tapi diminta Kode Global. Kode itu dari mana?",
    a: <>Kode Global diatur Admin di menu &quot;Kode Global Terima Barang&quot;. Kalau Anda punya akun, cukup login dulu di tab lain lalu scan ulang QR, dan nama Anda terisi otomatis tanpa kode.</>,
    tags: ["requester", "admin"],
  },
  {
    q: "Kapan saya (Receiver/GA) bisa mulai isi checklist penerimaan?",
    a: <>Saat PO sudah Pending Receive (pembayaran beres duluan), atau saat tiba giliran step &quot;Receiver&quot; (jalur Termin/DP-setelah-DP). Tombol &quot;Terima Barang&quot; muncul di detail PO.</>,
    tags: ["receiver", "ga"],
  },
  {
    q: "Saya salah isi qty di checklist penerimaan. Bisa dibetulkan?",
    a: <>Bisa. Klik &quot;Edit Penerimaan Barang&quot; di detail PO dan isi ulang. Begitu semua qty sesuai PO, status otomatis menjadi Full Received.</>,
    tags: ["receiver", "ga"],
  },
  {
    q: "Saya (Payment Validator) salah centang DP/BP. Bisa diubah?",
    a: <>Bisa, kapan saja, lewat tombol &quot;Edit DP/BP&quot; di detail PO. Tombol ini selalu tersedia untuk Payment Validator PO tersebut dan Admin.</>,
    tags: ["finance"],
  },
  {
    q: "Kenapa saya tidak bisa membuat Pengajuan Petty Cash baru?",
    a: <>Ada 3 kemungkinan: departemen Anda belum punya Template Approval Pengajuan, belum punya Budget Petty Cash aktif, atau Anda masih punya tarikan dana (Sub-Voucher) yang belum dideklarasikan. Selesaikan Deklarasinya dulu, atau hubungi GA/Admin.</>,
    tags: ["requester"],
  },
  {
    q: "Tarik Dana sudah saya buat, kok dananya belum masuk?",
    a: <>Tarikan baru berstatus Menunggu Pembayaran. Dana masuk setelah Finance mentransfer dan mengubahnya menjadi Selesai.</>,
    tags: ["requester", "finance"],
  },
  {
    q: "Dokumen Petty Cash nyangkut (approver resign / salah klik). Harus bagaimana?",
    a: <>Admin bisa membenahi status dan jalur approval dokumen apa pun lewat menu Management Petty Cash, tanpa perlu mengulang dari awal.</>,
    tags: ["admin", "requester"],
  },
];

export const TOC = [
  { id: "mulai", label: "Mulai di sini" },
  { id: "gambaran", label: "Gambaran besar" },
  { id: "alur-mr", label: "Alur MR" },
  { id: "alur-po", label: "Alur PO" },
  { id: "pembayaran", label: "4 Jalur Pembayaran" },
  { id: "penerimaan", label: "Penerimaan Barang" },
  { id: "petty-cash", label: "Petty Cash" },
  { id: "prioritas", label: "Prioritas & Level" },
  { id: "status", label: "Kamus Status" },
  { id: "faq", label: "FAQ" },
];

