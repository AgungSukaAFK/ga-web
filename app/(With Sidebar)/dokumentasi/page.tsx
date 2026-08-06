// src/app/(With Sidebar)/dokumentasi/page.tsx

"use client";

import { Content } from "@/components/content";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { MR_LEVELS } from "@/type/enum";
import {
  AlertCircle,
  BookOpen,
  Check,
  CheckCheck,
  ChevronsUpDown,
  CircleDollarSign,
  Edit,
  FileBox,
  FileCheck,
  FileClock,
  FilePlus,
  FileSearch,
  FileSpreadsheet,
  FileX,
  HelpCircle,
  Layers,
  Package,
  Send,
  Truck,
  Users,
  WalletCards,
  Workflow,
} from "lucide-react";
import Link from "next/link";

// Komponen helper kecil untuk styling
const Step = ({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-start gap-4">
    <Icon className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
    <div className="flex-1">
      <h4 className="font-semibold text-lg">{title}</h4>
      <p className="text-muted-foreground">{children}</p>
    </div>
  </div>
);

const ListItem = ({ children }: { children: React.ReactNode }) => (
  <li className="flex items-start gap-2">
    <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-1" />
    <span>{children}</span>
  </li>
);

export default function DokumentasiPage() {
  return (
    <>
      <Content
        title="Dokumentasi & Panduan Pengguna"
        description="Selamat datang di Garuda Procure. Halaman ini menjelaskan alur kerja dan fitur utama aplikasi."
        className="col-span-12"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          <h2 className="text-2xl font-semibold">Panduan Pengguna</h2>
        </div>
      </Content>

      <Content className="col-span-12">
        <Alert variant="default" className="bg-blue-50 border-blue-200">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-700 font-semibold">
            Pembaruan Alur Kerja Cost Center!
          </AlertTitle>
          <AlertDescription className="text-blue-600">
            Sesuai pembaruan terbaru, Requester (Pembuat MR) tidak lagi memilih
            Cost Center. Penentuan Cost Center kini menjadi tanggung jawab
            General Affair (GA) pada saat proses validasi. Estimasi Biaya MR
            juga sekarang dihitung otomatis berdasarkan total estimasi harga per
            item.
          </AlertDescription>
        </Alert>
      </Content>

      <Content className="col-span-12 lg:col-span-8">
        <Accordion type="single" collapsible defaultValue="item-1">
          {/* ====================================================== */}
          {/* ALUR MATERIAL REQUEST (MR) */}
          {/* ====================================================== */}
          <AccordionItem value="item-1">
            <AccordionTrigger className="text-xl font-semibold">
              <div className="flex items-center gap-3">
                <Workflow className="h-5 w-5" />
                Alur Kerja Material Request (MR)
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pt-4">
              <Step icon={FilePlus} title="1. Pembuatan MR (Oleh Requester)">
                Setiap karyawan (Requester) dapat membuat permintaan barang
                baru.
                <ul className="mt-2 space-y-2 list-disc ml-6">
                  <ListItem>
                    Klik menu &quot;Material Request&quot; lalu &quot;Buat MR
                    Baru&quot;.
                  </ListItem>
                  <ListItem>
                    Isi Kategori, Remarks (alasan), Due Date, dan Tujuan Site.
                  </ListItem>
                  <ListItem>
                    Klik &quot;Tambah Order Item&quot; untuk memasukkan barang
                    yang diminta.
                  </ListItem>
                  <ListItem>
                    PENTING: Setiap item wajib diisi{" "}
                    <strong>Estimasi Harga</strong>. Total Estimasi Biaya MR
                    akan terhitung otomatis (auto-sum).
                  </ListItem>
                  <ListItem>
                    Lampirkan file pendukung jika Kategori MR adalah
                    &quot;Replace&quot;, &quot;Fix & Repair&quot;, atau
                    &quot;Upgrade&quot;.
                  </ListItem>
                  <ListItem>
                    Klik &quot;Buat Material Request&quot;. Status MR akan
                    menjadi{" "}
                    <Badge variant="secondary">Pending Validation</Badge>.
                  </ListItem>
                </ul>
              </Step>

              <Step
                icon={FileSearch}
                title="2. Validasi MR (Oleh General Affair)"
              >
                GA me-review semua MR yang masuk untuk memastikan kelengkapan
                dan menentukan alur persetujuan.
                <ul className="mt-2 space-y-2 list-disc ml-6">
                  <ListItem>
                    GA membuka menu &quot;Approval & Validation&quot;.
                  </ListItem>
                  <ListItem>
                    GA memilih MR yang berstatus{" "}
                    <Badge variant="secondary">Pending Validation</Badge>.
                  </ListItem>
                  <ListItem>
                    TUGAS WAJIB GA: Memilih Cost Center yang akan menanggung
                    biaya MR ini. Sisa budget akan terlihat saat pemilihan.
                  </ListItem>
                  <ListItem>
                    GA memilih &quot;Template Approval&quot; yang sesuai (misal:
                    &quot;Untuk Dept. Produksi&quot;).
                  </ListItem>
                  <ListItem>
                    GA dapat menyesuaikan jalur approval (menambah/mengurangi
                    approver) jika perlu.
                  </ListItem>
                  <ListItem>
                    Klik &quot;Validasi & Mulai Approval&quot;. Status MR
                    berubah menjadi{" "}
                    <Badge variant="secondary">Pending Approval</Badge>.
                  </ListItem>
                </ul>
              </Step>

              <Step
                icon={ChevronsUpDown}
                title="3. Persetujuan MR (Oleh Approvers)"
              >
                MR akan dikirimkan secara berurutan kepada para approver
                (Manager, GM, Direksi) sesuai jalur yang ditentukan GA.
                <ul className="mt-2 space-y-2 list-disc ml-6">
                  <ListItem>
                    Approver yang mendapat giliran akan melihat MR di halaman
                    &quot;Approval & Validation&quot;.
                  </ListItem>
                  <ListItem>
                    Approver dapat menyetujui (&quot;Approve&quot;) atau menolak
                    (&quot;Reject&quot;) MR.
                  </ListItem>
                  <ListItem>
                    Requester dan Approver dapat menggunakan kolom Diskusi untuk
                    tanya jawab terkait MR tersebut.
                  </ListItem>
                  <ListItem>
                    Jika semua approver telah menyetujui, status MR berubah
                    menjadi{" "}
                    <Badge className="bg-blue-500 text-white">Waiting PO</Badge>
                    .
                  </ListItem>
                </ul>
              </Step>

              <Step
                icon={CircleDollarSign}
                title="4. Pengurangan Budget (Otomatis)"
              >
                Ini adalah proses sistem yang terjadi di backend.
                <ul className="mt-2 space-y-2 list-disc ml-6">
                  <ListItem>
                    Saat status MR berubah menjadi{" "}
                    <Badge className="bg-blue-500 text-white">Waiting PO</Badge>
                    , sistem akan otomatis mengurangi{" "}
                    <code>current_budget</code> pada Cost Center yang telah
                    dipilih GA.
                  </ListItem>
                  <ListItem>
                    Besar pengurangan budget = Total Estimasi Biaya MR.
                  </ListItem>
                  <ListItem>
                    Semua transaksi ini dicatat di &quot;Cost Center
                    Management&quot; (hanya bisa diakses Admin).
                  </ListItem>
                </ul>
              </Step>
            </AccordionContent>
          </AccordionItem>

          {/* ====================================================== */}
          {/* ALUR PURCHASE ORDER (PO) */}
          {/* ====================================================== */}
          <AccordionItem value="item-2">
            <AccordionTrigger className="text-xl font-semibold">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5" />
                Alur Kerja Purchase Order (PO)
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pt-4">
              <Step icon={Edit} title="1. Pembuatan PO (Oleh Purchasing)">
                Setelah MR disetujui, Purchasing akan membuat PO.
                <ul className="mt-2 space-y-2 list-disc ml-6">
                  <ListItem>
                    Purchasing membuka menu &quot;Purchase Order&quot;.
                  </ListItem>
                  <ListItem>
                    MR yang siap diproses akan muncul di daftar{" "}
                    <Badge className="bg-blue-500 text-white">Waiting PO</Badge>
                    .
                  </ListItem>
                  <ListItem>
                    Purchasing memilih MR dan mulai membuat PO baru.
                  </ListItem>
                  <ListItem>
                    Purchasing mencari barang di Master Data
                    (&quot;Barang&quot;) dan memasukkan harga beli final dari
                    vendor.
                  </ListItem>
                  <ListItem>
                    Mengisi detail Vendor, Payment Term, dan Pajak (PPN).
                  </ListItem>
                  <ListItem>
                    Klik &quot;Ajukan&quot;. Status PO akan menjadi{" "}
                    <Badge variant="secondary">Pending Validation</Badge>.
                  </ListItem>
                </ul>
              </Step>

              <Step
                icon={FileCheck}
                title="2. Validasi PO (Oleh General Affair)"
              >
                GA kembali bertugas menentukan jalur approval untuk PO.
                <ul className="mt-2 space-y-2 list-disc ml-6">
                  <ListItem>
                    GA membuka &quot;Approval & Validation&quot;, memilih PO
                    yang baru dibuat.
                  </ListItem>
                  <ListItem>
                    GA menerapkan &quot;Template Approval&quot; yang sesuai
                    (misal: &quot;Approval PO Finance&quot;).
                  </ListItem>
                  <ListItem>
                    Klik &quot;Validasi&quot;. Status PO berubah menjadi{" "}
                    <Badge variant="secondary">Pending Approval</Badge>.
                  </ListItem>
                </ul>
              </Step>

              <Step
                icon={CheckCheck}
                title="3. Persetujuan PO (Oleh Approvers PO)"
              >
                Approver (biasanya Finance/Payment Validator, Dept. Head
                terkait, atau Receiver/GA) menyetujui PO sesuai urutan step di
                template approval-nya - urutan step &quot;Receiver&quot; vs
                &quot;Payment Validator&quot; beda-beda tergantung jalur
                pembayaran (Cash/DP&amp;BP-setelah-lunas: Payment Validator
                lebih dulu; Termin/DP&amp;BP-setelah-DP: Receiver lebih dulu).
                <ul className="mt-2 space-y-2 list-disc ml-6">
                  <ListItem>
                    Setelah step pembayaran selesai (dan belum ada barang
                    diterima), status PO jadi{" "}
                    <Badge variant="secondary">Pending Receive</Badge>.
                  </ListItem>
                  <ListItem>
                    Kalau barang diterima duluan (sebelum pembayaran, jalur
                    Termin/DP&amp;BP-setelah-DP), status PO jadi{" "}
                    <Badge variant="secondary">Pending Payment</Badge> sampai
                    Payment Validator menyelesaikan step-nya.
                  </ListItem>
                </ul>
              </Step>

              <Step icon={Truck} title="4. Penerimaan Barang (Oleh Receiver/GA)">
                Begitu barang sampai, Receiver (step approval &quot;Receiver&quot;
                atau tombol &quot;Terima Barang&quot; manual oleh GA) mengisi
                checklist qty barang yang aktual diterima vs qty di PO.
                <ul className="mt-2 space-y-2 list-disc ml-6">
                  <ListItem>
                    Kalau semua item qty-nya sesuai PO, status PO otomatis
                    jadi{" "}
                    <Badge variant="outline">Full Received</Badge> - siklus PO
                    selesai.
                  </ListItem>
                  <ListItem>
                    Kalau ada item yang qty-nya kurang atau tidak datang sama
                    sekali, status PO jadi{" "}
                    <Badge variant="secondary">Partial Receive</Badge>.
                    Receiver bisa edit checklist ini lagi nanti (dan cetak
                    riwayatnya) sampai qty-nya sesuai, baru PO jadi Full
                    Received.
                  </ListItem>
                  <ListItem>
                    Terpisah dari status PO, Requester (pembuat MR) tetap bisa
                    mengunggah bukti BAST per item untuk kebutuhan laporan -
                    ini tidak lagi mengubah status PO.
                  </ListItem>
                </ul>
              </Step>
            </AccordionContent>
          </AccordionItem>

          {/* ====================================================== */}
          {/* PERAN & TANGGUNG JAWAB */}
          {/* ====================================================== */}
          <AccordionItem value="item-3">
            <AccordionTrigger className="text-xl font-semibold">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5" />
                Peran & Tanggung Jawab
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <div>
                <Badge>Requester</Badge>
                <p className="mt-1 text-sm text-muted-foreground">
                  Semua karyawan. Bertanggung jawab membuat MR, mengisi estimasi
                  harga item dengan benar, dan melakukan konfirmasi penerimaan
                  (upload BAST) saat barang tiba.
                </p>
              </div>
              <div>
                <Badge>Approver</Badge>
                <p className="mt-1 text-sm text-muted-foreground">
                  Manager, GM, Direksi. Bertanggung jawab memantau antrian
                  &quot;Approval & Validation&quot; dan memberikan persetujuan
                  atau penolakan tepat waktu.
                </p>
              </div>
              <div>
                <Badge>General Affair (GA)</Badge>
                <p className="mt-1 text-sm text-muted-foreground">
                  Bertindak sebagai Validator Pusat. Meninjau semua MR & PO,
                  menentukan Cost Center untuk setiap MR, dan menerapkan jalur
                  approval (template) untuk MR & PO.
                </p>
              </div>
              <div>
                <Badge>Purchasing</Badge>
                <p className="mt-1 text-sm text-muted-foreground">
                  Bertanggung jawab mengeksekusi MR yang berstatus &quot;Waiting
                  PO&quot;. Membuat PO, memilih barang dari master data,
                  menginput harga final, dan mengelola data master barang.
                </p>
              </div>
              <div>
                <Badge variant="destructive">Admin</Badge>
                <p className="mt-1 text-sm text-muted-foreground">
                  Super User. Mengelola akun pengguna (User Management),
                  mengelola budget (Cost Center Management), dan memiliki hak
                  akses penuh untuk memperbaiki/mengedit semua data MR dan PO
                  jika terjadi kesalahan.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ====================================================== */}
          {/* LEVEL MR */}
          {/* ====================================================== */}
          <AccordionItem value="item-level">
            <AccordionTrigger className="text-xl font-semibold">
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5" /> Keterangan Level MR
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <h5 className="font-semibold border-b pb-2">
                Level OPEN (Barang Belum Diterima Site)
              </h5>
              <ul className="list-disc pl-5 space-y-2 text-sm">
                {MR_LEVELS.filter((l) => l.group === "OPEN").map((level) => (
                  <li key={level.value}>
                    <strong>{level.value}:</strong> {level.description}
                  </li>
                ))}
              </ul>

              <h5 className="font-semibold border-b pb-2 mt-4">
                Level CLOSE (Barang Sudah Diterima Site)
              </h5>
              <ul className="list-disc pl-5 space-y-2 text-sm">
                {MR_LEVELS.filter((l) => l.group === "CLOSE").map((level) => (
                  <li key={level.value}>
                    <strong>{level.value}:</strong> {level.description}
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>

          {/* ====================================================== */}
          {/* FAQ */}
          {/* ====================================================== */}
          <AccordionItem value="item-4">
            <AccordionTrigger className="text-xl font-semibold">
              <div className="flex items-center gap-3">
                <HelpCircle className="h-5 w-5" />
                Frequently Asked Questions (FAQ)
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <h5 className="font-semibold">
                T: Mengapa saya tidak bisa memilih Cost Center saat membuat MR?
              </h5>
              <p className="text-sm text-muted-foreground -mt-2">
                J: Sesuai alur kerja terbaru, Cost Center tidak lagi dipilih
                oleh Requester. Ini untuk memastikan kontrol budget lebih baik.
                Cost Center akan ditentukan oleh GA saat proses validasi.
              </p>

              <h5 className="font-semibold">
                T: Mengapa input &quot;Estimasi Biaya&quot; saya nonaktif
                (disabled)?
              </h5>
              <p className="text-sm text-muted-foreground -mt-2">
                J: Total Estimasi Biaya kini dihitung otomatis dari{" "}
                <strong>(Qty x Estimasi Harga)</strong> pada setiap item yang
                Anda tambahkan di &quot;Order Items&quot;. Anda tidak perlu
                mengisinya secara manual.
              </p>

              <h5 className="font-semibold">
                T: Kapan budget Cost Center saya berkurang?
              </h5>
              <p className="text-sm text-muted-foreground -mt-2">
                J: Budget berkurang secara otomatis oleh sistem{" "}
                <strong>setelah semua approver menyetujui MR Anda</strong>,
                yaitu saat status MR berubah dari &quot;Pending Approval&quot;
                menjadi &quot;Waiting PO&quot;.
              </p>

              <h5 className="font-semibold">
                T: Saya (GA) salah memilih Cost Center saat validasi. Bagaimana
                cara mengubahnya?
              </h5>
              <p className="text-sm text-muted-foreground -mt-2">
                J: Setelah divalidasi, GA tidak bisa mengubah Cost Center. Harap
                segera hubungi Admin untuk memperbaikinya melalui menu &quot;MR
                Management&quot;.
              </p>

              <h5 className="font-semibold">
                T: Saya (Requester) tidak bisa menemukan tombol untuk upload
                BAST.
              </h5>
              <p className="text-sm text-muted-foreground -mt-2">
                J: Pastikan barang untuk item tersebut sudah di-checklist
                diterima oleh Receiver/GA (status item MR sudah{" "}
                <Badge variant="secondary">Pending BAST</Badge>). Jika status
                PO masih &quot;Pending Approval&quot;/&quot;Pending
                Payment&quot;/&quot;Pending Receive&quot;, artinya barangnya
                belum diterima. Hanya Requester asli yang membuat MR yang
                dapat mengunggah BAST.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Content>

      <Content className="col-span-12 lg:col-span-4">
        <h3 className="font-semibold text-lg mb-4">Status MR & PO</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <FileClock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div>
              <Badge variant="secondary">Pending Validation</Badge>
              <p className="text-xs text-muted-foreground">
                Dokumen baru dibuat dan sedang ditinjau oleh General Affair
                (GA).
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ChevronsUpDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div>
              <Badge variant="secondary">Pending Approval</Badge>
              <p className="text-xs text-muted-foreground">
                Dokumen sedang dalam antrian persetujuan oleh
                Manager/GM/Direksi.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div>
              <Badge className="bg-blue-500 text-white">Waiting PO</Badge>
              <p className="text-xs text-muted-foreground">
                Hanya untuk MR. MR sudah disetujui penuh dan siap dibuatkan PO
                oleh Purchasing.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Truck className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div>
              <Badge variant="secondary">Pending Receive</Badge>
              <p className="text-xs text-muted-foreground">
                Hanya untuk PO. PO sudah disetujui penuh, menunggu barang
                diterima &amp; di-checklist oleh Receiver/GA.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Truck className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div>
              <Badge className="bg-amber-600 text-white">Partial Receive</Badge>
              <p className="text-xs text-muted-foreground">
                Hanya untuk PO. Barang sudah diterima tapi qty/jenisnya belum
                sesuai PO - menunggu Receiver mengedit checklist-nya.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCheck className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div>
              <Badge variant="outline">Full Received</Badge>
              <p className="text-xs text-muted-foreground">
                Hanya untuk PO. Siklus PO selesai - semua barang sudah
                diterima sesuai qty PO.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCheck className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div>
              <Badge variant="outline">Completed</Badge>
              <p className="text-xs text-muted-foreground">
                Hanya untuk MR/item. Item sudah di-BAST oleh Requester
                (laporan) - tidak lagi mempengaruhi status PO.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileX className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div>
              <Badge variant="destructive">Rejected</Badge>
              <p className="text-xs text-muted-foreground">
                Permintaan ditolak oleh GA atau salah satu Approver.
              </p>
            </div>
          </div>
        </div>
      </Content>
    </>
  );
}
