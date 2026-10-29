// SEMUA ISI halaman Dokumentasi ada di sini (data, bukan layout) - kalau
// alur aplikasi berubah, cukup ubah file ini; komponen di folder ini yang
// mengurus tampilannya (stepper, diagram, kamus status, FAQ).

import {
  Ban,
  Banknote,
  CheckCheck,
  CircleDollarSign,
  ClipboardCheck,
  FileCheck,
  FilePlus,
  FileSearch,
  FileSpreadsheet,
  HandCoins,
  Landmark,
  Lock,
  PackageCheck,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Siren,
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
          <>
            MR yang belum bisa dibuatkan PO (belum disetujui, atau semua
            item-nya sudah ter-PO) tetap muncul di daftar tapi abu-abu, dengan
            keterangan syarat yang belum terpenuhi.
          </>,
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
            Jika pembayaran selesai lebih dahulu → PO menjadi Pending Receive.
            Jika barang diterima lebih dahulu → PO menjadi Pending Payment.
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
            Semua qty sesuai → {b("Full Received")}. Ada yang kurang atau
            tidak datang → {b("Partial Receive")}.
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
      "Pengajuan → Voucher → Tarik Dana → Pembayaran Finance → Deklarasi. Pengajuan, Voucher, dan Deklarasi masing-masing punya jalur approval sendiri.",
    steps: [
      {
        title: "Input Pengajuan",
        short: "Pengajuan",
        icon: FilePlus,
        actors: ["requester"],
        menu: "Petty Cash → Pengajuan Saya → Input Pengajuan",
        summary: (
          <>
            Pilih barang dari katalog Petty Cash (atau tambah manual), isi
            tanggal & minggu dibutuhkan, lalu submit. Jalur approval & budget{" "}
            {b("dipasang otomatis")} sesuai departemen, site, dan company Anda.
          </>
        ),
        details: [
          <>
            Sebelum form terbuka, sistem mengecek {b("3 syarat")}: (1)
            departemen/site/company Anda punya Template &quot;Approval
            Pengajuan&quot;, (2) punya Budget Petty Cash aktif, dan (3) Anda
            tidak sedang punya tarikan dana (Sub-Voucher) yang belum
            dideklarasikan. Kalau ada yang belum terpenuhi, alasannya tampil di
            layar.
          </>,
          <>
            {b("Pengecualian syarat 3")}: user departemen GA dan role Admin
            tetap boleh mengajukan walau tarikannya belum dideklarasikan.
            Pengajuannya otomatis ditandai {b("Eskalasi")} (lihat Aturan Khusus
            Petty Cash di bawah).
          </>,
          <>
            Isi {b("Tanggal Dibutuhkan")} (tidak boleh tanggal lewat) dan{" "}
            {b("Minggu ke-")} (minggu ini atau minggu depan di bulan berjalan).
          </>,
          <>
            {b("Pengguna Budget")} defaultnya Anda sendiri. Hilangkan centang
            &quot;Saya sendiri&quot; kalau dananya dipakai orang lain, misalnya
            GA mengajukan untuk kebutuhan user lain. Pengguna Budget tidak ikut
            approval, hanya tercantum di dokumen & cetakan.
          </>,
          <>
            Tambahkan barang dari katalog (COA otomatis mengikuti company) atau
            sebagai barang manual. Akun LOURDES wajib memilih company GMI/GIS
            dulu untuk seluruh pengajuan. Kebutuhan rutin bisa memakai{" "}
            {b("Template Pengajuan")} pribadi supaya tidak input ulang.
          </>,
          <>Lampiran (quotation, link produk, dll.) opsional, maksimal 5MB per file.</>,
        ],
        status: { to: "In Approval", domain: "pc" },
        tip: (
          <>
            Tidak bisa mengajukan karena syarat 1 atau 2? Hubungi GA/Admin
            untuk mengatur Template Approval atau Budget departemen Anda.
          </>
        ),
        visual: "pc-input",
      },
      {
        title: "Approval Pengajuan",
        short: "Approval",
        icon: CheckCheck,
        actors: ["approver"],
        menu: "Petty Cash → Approval Petty Cash (sesi Approval Pengajuan)",
        summary: (
          <>
            Approver menyetujui {b("berurutan")} sesuai level (Dicek →
            Disetujui → Dijalankan). Satu penolakan langsung menghentikan
            dokumen.
          </>
        ),
        details: [
          <>
            Dokumen hanya muncul di antrian approver yang {b("sedang giliran")}.
            Approver berikutnya baru melihatnya setelah approver sebelumnya
            menyetujui.
          </>,
          <>
            Tiga pilihan aksi: {b("Setujui Langsung")}, {b("Edit & Setujui")}{" "}
            (koreksi barang/qty/harga/tanggal/budget sekaligus approve; versi
            sebelum diedit tersimpan di Riwayat Revisi), atau {b("Tolak")}{" "}
            (alasan wajib, dicatat di riwayat diskusi).
          </>,
          <>Approver terakhir setuju → Pengajuan menjadi Approved dan siap dibuatkan Voucher.</>,
          <>
            Pengajuan yang ditolak bisa diajukan ulang dari halaman detailnya
            (tombol &quot;Ajukan Ulang&quot;). Isinya dimuat ulang dan dikirim
            sebagai Pengajuan baru.
          </>,
          <>Pengajuan bertanda Eskalasi tampil dengan badge merah di antrian supaya diprioritaskan.</>,
        ],
        status: { from: "In Approval", to: "Approved", domain: "pc" },
        visual: "pc-approval-pengajuan",
      },
      {
        title: "Pengajuan Voucher",
        short: "Voucher",
        icon: Lock,
        actors: ["requester"],
        menu: "Pengajuan Saya → Pengajuan Voucher (atau tombol Buat Voucher)",
        summary: (
          <>
            Buat Voucher dari Pengajuan yang sudah Approved. Barangnya{" "}
            {b("disalin persis")}; yang Anda pilih hanyalah{" "}
            {b("Metode Pencairan")}: Transfer, Cash, atau Overbook.
          </>
        ),
        details: [
          <>Pilih Pengajuan berstatus Approved yang belum punya Voucher aktif.</>,
          <>Barang, qty, harga, catatan, dan lampiran disalin apa adanya dan tidak bisa diubah di sini.</>,
          <>
            Pilih {b("Metode Pencairan")}. {b("Transfer")} = dana dikirim ke
            rekening Anda, jadi pilih rekening yang tersimpan di Profile (atau
            tambah rekening baru langsung dari dialog). {b("Cash")} = diambil
            tunai di Finance. {b("Overbook")} = pemindahbukuan antar rekening
            internal.
          </>,
          <>
            Metode ini berlaku untuk semua tarikan dari Voucher tersebut.
            Approver Voucher, GA, atau Finance masih bisa menggantinya (mis.
            ternyata harus Overbook).
          </>,
          <>
            Voucher mendapat jalur approval baru yang terpisah (Template
            &quot;Approval Voucher&quot;). Kalau Voucher ditolak, Anda bisa
            mengajukan ulang Voucher dari Pengajuan yang sama.
          </>,
        ],
        status: { to: "In Approval", domain: "pc" },
        visual: "pc-voucher",
      },
      {
        title: "Approval Voucher",
        short: "Approval",
        icon: CheckCheck,
        actors: ["approver"],
        menu: "Petty Cash → Approval Petty Cash (sesi Approval Voucher)",
        summary: (
          <>
            Voucher disetujui lewat jalurnya sendiri. Setelah Approved, dana
            boleh ditarik.
          </>
        ),
        details: [
          <>Jalur ini bukan lanjutan approval Pengajuan, melainkan jalur baru dari Template &quot;Approval Voucher&quot;.</>,
          <>
            Lewat {b("Edit & Setujui")}, approver bisa mengoreksi isi Voucher{" "}
            {b("termasuk Metode Pencairan & rekening tujuan")}, sekaligus
            approve. Perubahannya tercatat di Riwayat Revisi.
          </>,
          <>
            Di luar giliran approval, GA, Finance, Admin, atau siapa pun di
            jalur approval Voucher bisa memakai tombol{" "}
            {b("Ubah Metode Pencairan")} di halaman detail Voucher selama
            statusnya masih In Approval/Approved. Perubahannya tercatat di
            riwayat diskusi.
          </>,
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
            Tarik dana {b("bertahap")}: pilih barang dan qty yang ingin ditarik
            sekarang. Setiap tarikan menjadi Sub-Voucher dengan kode sendiri
            (SV1, SV2, …).
          </>
        ),
        details: [
          <>Tarikan dipilih per barang/qty (boleh sebagian), bukan nominal bebas. Sisanya bisa ditarik lain kali.</>,
          <>
            Nominal tarikan {b("langsung memotong Budget")} departemen. Tarikan
            ditolak kalau sisa budget tidak cukup.
          </>,
          <>Dialog Tarik Dana menampilkan metode pencairan yang akan dipakai Finance.</>,
          <>Tarikan baru belum berarti dana sudah diterima: statusnya Menunggu Pembayaran sampai Finance membayar.</>,
          <>Selama Pengajuan sedang diajukan pembatalan, Tarik Dana ditahan.</>,
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
            Finance mencairkan dana sesuai metode. Bukti {b("wajib")} untuk
            Transfer & Overbook, {b("opsional")} untuk Cash.
          </>
        ),
        details: [
          <>Dikerjakan approver dari departemen Finance (atau Admin), terbatas pada company-nya sendiri (Finance LOURDES melihat semua).</>,
          <>
            Antrian menampilkan metode pencairan dan {b("nomor rekening tujuan")}{" "}
            pilihan pemohon. Finance bisa mengoreksi metode/rekening sebelum
            menandai selesai; yang tercatat di tarikan adalah metode final ini.
          </>,
          <>
            Bukti pembayaran wajib dilampirkan untuk Transfer & Overbook. Untuk
            Cash boleh tanpa lampiran (mis. bukti serah terima menyusul).
          </>,
          <>Setelah ditandai selesai, pemohon mendapat notifikasi dan tarikan boleh dideklarasikan.</>,
          <>Tarikan yang Pengajuannya sedang diajukan pembatalan tidak bisa dibayar sampai permintaan pembatalannya diproses.</>,
        ],
        status: { from: "Menunggu Pembayaran", to: "Selesai", domain: "pc" },
        visual: "pc-bayar",
      },
      {
        title: "Deklarasi & Pengembalian Dana",
        short: "Deklarasi",
        icon: Receipt,
        actors: ["requester", "approver", "finance"],
        menu: "Petty Cash → Deklarasi",
        summary: (
          <>
            Laporkan pemakaian riil {b("setiap tarikan")} beserta foto struk.
            Approval Deklarasi {b("wajib melibatkan minimal 1 orang Finance")}.
            Sisa dana dikembalikan lewat Pengembalian Dana.
          </>
        ),
        details: [
          <>Pilih tarikan berstatus Selesai (sudah dibayar). Qty, harga, dan catatan boleh disesuaikan dengan struk asli; nama barang dan UoM tetap mengikuti tarikannya.</>,
          <>Total Deklarasi tidak boleh melebihi nominal tarikan.</>,
          <>
            Deklarasi punya jalur approval sendiri (Template &quot;Approval
            Deklarasi&quot;) yang {b("wajib berisi minimal 1 approver Finance")}.
            Template tanpa Finance tidak bisa disimpan, dan Deklarasi baru
            ditolak sampai template-nya dilengkapi GA/Admin.
          </>,
          <>
            Kalau Deklarasi disetujui lebih kecil dari nominal tarikan,
            kembalikan sisanya lewat {b("Pengembalian Dana")} di halaman
            Deklarasi (bukti setor wajib). Budget baru bertambah setelah
            Finance mengonfirmasi uangnya diterima.
          </>,
          <>Deklarasi yang ditolak bisa diajukan ulang untuk tarikan yang sama.</>,
          <>
            Setelah semua tarikan dideklarasikan & disetujui dan totalnya
            menutup nilai Voucher, Voucher dan Pengajuan otomatis menjadi
            Selesai.
          </>,
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
      { text: "Pilih metode pencairan (Transfer/Cash/Overbook) saat Buat Voucher", jump: { flow: "pc", step: 2 } },
      { text: "Batalkan Pengajuan Petty Cash yang tidak jadi dipakai", anchor: "aturan-pc" },
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
      { text: "Petty Cash: kelola Template Approval, Budget & Barang; ajukan Eskalasi bila mendesak", anchor: "aturan-pc" },
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
      { text: "Bayar tarikan Petty Cash sesuai metode (bukti wajib utk Transfer/Overbook)", jump: { flow: "pc", step: 5 } },
      { text: "Setujui/tolak permintaan pembatalan & konfirmasi pengembalian dana", anchor: "aturan-pc" },
      { text: "Jadi approver wajib di Approval Deklarasi Petty Cash", jump: { flow: "pc", step: 6 } },
      { text: "Download Excel semua dokumen Petty Cash", anchor: "aturan-pc" },
    ],
  },
  admin: {
    who: "Super user dengan akses penuh untuk perbaikan data.",
    tasks: [
      { text: "Kelola akun (User Management) & budget (Cost Center Management)" },
      { text: "Koreksi MR/PO lewat MR Management / PO Management" },
      { text: "Benahi dokumen Petty Cash yang tertahan di Management Petty Cash" },
      { text: "Download Excel semua dokumen Petty Cash (dengan filter)", anchor: "aturan-pc" },
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
// ATURAN KHUSUS PETTY CASH - jalur samping di luar stepper utama
// ---------------------------------------------------------------------------

export type PcRule = {
  id: string;
  title: string;
  icon: React.ElementType;
  /** Siapa yang terlibat. */
  roles: RoleId[];
  summary: React.ReactNode;
  points: React.ReactNode[];
};

export const PC_RULES: PcRule[] = [
  {
    id: "eskalasi",
    title: "Eskalasi (Pengajuan Mendesak)",
    icon: Siren,
    roles: ["ga", "admin"],
    summary: (
      <>
        Khusus user {b("departemen GA")} & {b("role Admin")}: boleh membuat
        Pengajuan baru walau masih punya tarikan yang belum dideklarasikan.
      </>
    ),
    points: [
      <>Kalau masih ada tarikan yang belum dideklarasikan, Pengajuan otomatis ditandai Eskalasi (centangnya terkunci).</>,
      <>GA/Admin juga boleh mencentang &quot;Tandai sebagai Eskalasi&quot; secara manual untuk kebutuhan mendesak lainnya.</>,
      <>Badge Eskalasi muncul di antrian approval, daftar dokumen, dan Excel, tapi {b("tidak ikut dicetak")}.</>,
      <>User departemen lain tetap wajib menyelesaikan Deklarasi dulu sebelum membuat Pengajuan baru.</>,
    ],
  },
  {
    id: "metode",
    title: "Metode Pencairan: Transfer, Cash, Overbook",
    icon: Landmark,
    roles: ["requester", "approver", "ga", "finance"],
    summary: (
      <>
        Dipilih pemohon saat {b("Buat Voucher")}, bisa diganti approver/GA/
        Finance, dan dicatat final oleh Finance saat membayar tarikan.
      </>
    ),
    points: [
      <>{b("Transfer")}: wajib pilih rekening tujuan dari rekening tersimpan pemohon (Profile → Rekening Bank). Nomor rekening tampil di antrian & form pembayaran Finance.</>,
      <>{b("Cash")}: diambil tunai. Bukti pembayaran opsional.</>,
      <>{b("Overbook")}: pemindahbukuan antar rekening internal. Bukti pembayaran wajib.</>,
      <>Ganti metode: approver Voucher lewat &quot;Edit &amp; Setujui&quot;; GA/Finance/Admin/approver lewat tombol &quot;Ubah Metode Pencairan&quot; di detail Voucher; Finance juga bisa mengoreksi di form pembayaran.</>,
      <>Metode final setiap tarikan tercatat di detail Sub-Voucher, cetakan Voucher/Sub-Voucher, dan Excel.</>,
    ],
  },
  {
    id: "pembatalan",
    title: "Pembatalan Pengajuan",
    icon: Ban,
    roles: ["requester", "finance"],
    summary: (
      <>
        Pemohon menekan {b("Ajukan Pembatalan")} (wajib alasan), lalu{" "}
        {b("Finance")} menyetujui atau menolak.
      </>
    ),
    points: [
      <>Tombolnya ada di detail Pengajuan dan di modal &quot;Pengajuan Saya&quot;, selama Pengajuan masih In Approval/Approved dan {b("belum ada tarikan yang dibayar Finance")}.</>,
      <>Selama menunggu Finance, Tarik Dana, pembayaran tarikan, dan pembuatan Voucher baru ditahan.</>,
      <>Finance memproses di Approval Petty Cash → sesi &quot;Permintaan Pembatalan&quot;, lengkap dengan pratinjau dampaknya.</>,
      <>Disetujui: Pengajuan, Voucher, dan tarikan yang belum dibayar menjadi {b("Dibatalkan")}, dan nominal tarikan itu otomatis dikembalikan ke Budget. Status Dibatalkan bersifat final.</>,
      <>Ditolak: alasan Finance tampil ke pemohon, Pengajuan berjalan seperti biasa, dan pemohon boleh mengajukan pembatalan lagi.</>,
      <>Dana yang sudah cair tidak bisa dibatalkan, tapi diselesaikan lewat Deklarasi + Pengembalian Dana.</>,
    ],
  },
  {
    id: "deklarasi-finance",
    title: "Approval Deklarasi Wajib Ada Finance",
    icon: ShieldCheck,
    roles: ["ga", "admin", "finance"],
    summary: (
      <>
        Template &quot;Approval Deklarasi&quot; harus berisi {b("minimal 1 approver dari departemen Finance")}.
      </>
    ),
    points: [
      <>Form Template Approval menolak menyimpan template Deklarasi tanpa approver Finance.</>,
      <>Template lama yang belum memenuhi diberi tanda &quot;Belum ada Finance&quot; di daftar template, dan Deklarasi baru dengan template itu ditolak sampai dilengkapi.</>,
    ],
  },
  {
    id: "excel",
    title: "Download Excel Semua Dokumen",
    icon: FileSpreadsheet,
    roles: ["admin", "ga", "finance"],
    summary: (
      <>
        Menu {b("Management Petty Cash")} → Download Excel. Satu file berisi
        beberapa sheet dengan styling yang sama seperti export MR/PO.
      </>
    ),
    points: [
      <>Sheet: Ringkasan (1 baris per Pengajuan + total ditarik/dibayar/dideklarasikan), Pengajuan, Voucher, Tarik Dana, Deklarasi (1 baris per barang), Pengembalian Dana, Pembatalan. Sheet bisa dipilih.</>,
      <>Filter: tanggal Pengajuan dibuat, company, status Pengajuan, departemen, site, dan &quot;hanya Eskalasi&quot;. Seluruh turunan Pengajuan yang lolos filter ikut diekspor.</>,
      <>GA & Finance melihat company sendiri (LOURDES semua). Admin melihat semua. Halaman Management untuk GA/Finance bersifat lihat saja.</>,
    ],
  },
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
      { status: "On Delivery", label: "Dalam Pengiriman", domain: "item", main: true, desc: "Sedang dikirim ke Requester (atau langsung untuk vendor Site). Requester cukup melakukan konfirmasi." },
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
      { status: "Pending Receive", domain: "doc", main: true, desc: "Approval & pembayaran selesai, menunggu barang diterima dan di-checklist." },
      { status: "Partial Receive", domain: "doc", main: true, desc: "Barang sudah di-checklist tapi qty belum sesuai PO. Checklist bisa diedit ulang." },
      { status: "Full Received", domain: "doc", main: true, desc: "Semua barang diterima sesuai qty PO. Ini status akhir PO." },
      { status: "Rejected", domain: "doc", desc: "Ditolak salah satu approver PO." },
    ],
  },
  {
    id: "pc",
    label: "Petty Cash",
    hint: "Pengajuan, Voucher, Sub-Voucher (tarikan dana), dan Deklarasi punya status masing-masing.",
    entries: [
      { status: "In Approval", domain: "pc", main: true, desc: "Pengajuan/Voucher/Deklarasi sedang dalam antrian persetujuan berurutan." },
      { status: "Approved", domain: "pc", main: true, desc: "Disetujui semua approver. Pengajuan → siap dibuatkan Voucher; Voucher → dana boleh ditarik; Deklarasi → tarikan itu tuntas." },
      { status: "Menunggu Pembayaran", domain: "pc", main: true, desc: "Sub-Voucher (tarikan dana) baru dibuat dan budget sudah terpotong. Menunggu Finance mencairkan dana." },
      { status: "Selesai", domain: "pc", main: true, desc: "Sub-Voucher: sudah dibayar Finance dan boleh dideklarasikan. Voucher & Pengajuan: semua tarikan sudah dideklarasikan, disetujui, dan menutup nilai Voucher." },
      { status: "Rejected", domain: "pc", desc: "Ditolak salah satu approver (alasan dicatat di riwayat diskusi). Pengajuan, Voucher, dan Deklarasi yang ditolak bisa diajukan ulang." },
      { status: "Dibatalkan", domain: "pc", desc: "Pembatalan disetujui Finance. Berlaku untuk Pengajuan, Voucher, dan tarikan yang belum dibayar (nominalnya sudah dikembalikan ke budget). Final, tidak bisa diproses lagi." },
      { status: "Menunggu Persetujuan", label: "Pembatalan: Menunggu Persetujuan", domain: "pc", desc: "Pemohon mengajukan pembatalan dan Finance belum memutuskan. Selama ini Tarik Dana & pembayaran ditahan." },
      { status: "Menunggu Konfirmasi", label: "Pengembalian: Menunggu Konfirmasi", domain: "pc", desc: "Pemohon mengembalikan sisa dana tarikan. Budget bertambah setelah Finance mengonfirmasi uangnya diterima." },
    ],
  },
];

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

export const FAQS: { q: string; a: React.ReactNode; tags: RoleId[] }[] = [
  {
    q: "Mengapa saya tidak bisa memilih Cost Center saat membuat MR?",
    a: <>Cost Center ditentukan GA saat validasi, bukan oleh Requester. Tujuannya supaya kontrol budget lebih rapi.</>,
    tags: ["requester"],
  },
  {
    q: "Mengapa input \"Estimasi Biaya\" tidak bisa diisi?",
    a: <>Karena dihitung otomatis dari {b("Qty × Estimasi Harga")} setiap barang di Order Items.</>,
    tags: ["requester"],
  },
  {
    q: "Mengapa Due Date terisi sendiri?",
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
    q: "Kapan saya (Receiver/GA) bisa mulai mengisi checklist penerimaan?",
    a: <>Saat PO sudah Pending Receive (pembayaran selesai lebih dahulu), atau saat tiba giliran step &quot;Receiver&quot; (jalur Termin/DP-setelah-DP). Tombol &quot;Terima Barang&quot; muncul di detail PO.</>,
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
    q: "Mengapa saya tidak bisa membuat Pengajuan Petty Cash baru?",
    a: <>Ada 3 kemungkinan: departemen Anda belum punya Template Approval Pengajuan, belum punya Budget Petty Cash aktif, atau Anda masih punya tarikan dana (Sub-Voucher) yang belum dideklarasikan. Selesaikan Deklarasinya dulu, atau hubungi GA/Admin. Khusus user GA & Admin, alasan ketiga tidak memblokir. Pengajuannya otomatis ditandai Eskalasi.</>,
    tags: ["requester", "ga", "admin"],
  },
  {
    q: "Apa itu Eskalasi dan siapa yang bisa memakainya?",
    a: <>Penanda Pengajuan mendesak, khusus user departemen GA dan role Admin. Muncul otomatis kalau GA/Admin mengajukan saat masih punya tarikan yang belum dideklarasikan, atau bisa dicentang manual. Badge-nya tampil di layar & Excel, tapi tidak dicetak.</>,
    tags: ["ga", "admin", "approver"],
  },
  {
    q: "Tarik Dana sudah saya buat, mengapa dananya belum masuk?",
    a: <>Tarikan baru berstatus Menunggu Pembayaran. Dana masuk setelah Finance mencairkannya sesuai metode (Transfer/Cash/Overbook) dan mengubahnya menjadi Selesai.</>,
    tags: ["requester", "finance"],
  },
  {
    q: "Rekening yang saya inginkan tidak muncul saat memilih Transfer.",
    a: <>Daftar rekening diambil dari Profile → Rekening Bank. Klik &quot;Tambah Rekening&quot; di dialog Buat Voucher (otomatis tersimpan ke Profile), lalu pilih rekening itu.</>,
    tags: ["requester"],
  },
  {
    q: "Metode pencairan di Voucher salah (mis. harusnya Overbook). Siapa yang bisa mengubah?",
    a: <>Approver Voucher (lewat Edit &amp; Setujui), atau GA/Finance/Admin/approver lewat tombol &quot;Ubah Metode Pencairan&quot; di detail Voucher selama Voucher masih In Approval/Approved. Finance juga bisa mengoreksinya saat membayar tarikan.</>,
    tags: ["approver", "ga", "finance"],
  },
  {
    q: "Apakah bukti pembayaran selalu wajib?",
    a: <>Wajib untuk Transfer dan Overbook. Untuk Cash boleh tanpa lampiran.</>,
    tags: ["finance"],
  },
  {
    q: "Pengajuan saya tidak jadi dipakai. Bagaimana membatalkannya?",
    a: <>Buka detail Pengajuan (atau modal di Pengajuan Saya) → Ajukan Pembatalan, lalu isi alasan. Finance yang menyetujui. Pembatalan hanya bisa selama belum ada tarikan yang dibayar Finance. Kalau dana sudah cair, selesaikan lewat Deklarasi lalu kembalikan sisanya lewat Pengembalian Dana.</>,
    tags: ["requester", "finance"],
  },
  {
    q: "Mengapa Deklarasi saya ditolak dengan pesan \"wajib memiliki approver Finance\"?",
    a: <>Template Approval Deklarasi untuk departemen Anda belum berisi approver dari departemen Finance. Minta GA/Admin menambahkan minimal 1 user Finance ke template tersebut, lalu ajukan Deklarasi lagi.</>,
    tags: ["requester", "ga", "admin"],
  },
  {
    q: "Bagaimana menarik rekap Petty Cash ke Excel?",
    a: <>Buka Management Petty Cash → Download Excel (Admin, GA, dan Finance). Atur filter (tanggal, company, status, departemen, site, Eskalasi) dan pilih sheet yang diperlukan. Semua turunan Pengajuan yang lolos filter ikut diekspor.</>,
    tags: ["admin", "ga", "finance"],
  },
  {
    q: "Dokumen Petty Cash tertahan (approver resign / salah klik). Apa yang harus dilakukan?",
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
  { id: "aturan-pc", label: "Aturan Petty Cash" },
  { id: "prioritas", label: "Prioritas & Level" },
  { id: "status", label: "Kamus Status" },
  { id: "faq", label: "FAQ" },
];

