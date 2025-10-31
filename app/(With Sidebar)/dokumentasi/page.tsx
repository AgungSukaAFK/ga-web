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
            Sesuai pembaruan terbaru, **Requester (Pembuat MR) tidak lagi
            memilih Cost Center**. Penentuan Cost Center kini menjadi tanggung
            jawab **General Affair (GA)** pada saat proses validasi. Estimasi
            Biaya MR juga sekarang dihitung otomatis berdasarkan total estimasi
            harga per item.
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
                    Klik menu "Material Request" lalu "Buat MR Baru".
                  </ListItem>
                  <ListItem>
                    Isi Kategori, Remarks (alasan), Due Date, dan Tujuan Site.
                  </ListItem>
                  <ListItem>
                    Klik "Tambah Order Item" untuk memasukkan barang yang
                    diminta.
                  </ListItem>
                  <ListItem>
                    **PENTING:** Setiap item **wajib** diisi{" "}
                    <strong>Estimasi Harga</strong>. Total Estimasi Biaya MR
                    akan terhitung otomatis (auto-sum).
                  </ListItem>
                  <ListItem>
                    Lampirkan file pendukung jika Kategori MR adalah "Replace",
                    "Fix & Repair", atau "Upgrade".
                  </ListItem>
                  <ListItem>
                    Klik "Buat Material Request". Status MR akan menjadi{" "}
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
                  <ListItem>GA membuka menu "Approval & Validation".</ListItem>
                  <ListItem>
                    GA memilih MR yang berstatus{" "}
                    <Badge variant="secondary">Pending Validation</Badge>.
                  </ListItem>
                  <ListItem>
                    **TUGAS WAJIB GA:** Memilih **Cost Center** yang akan
                    menanggung biaya MR ini. Sisa budget akan terlihat saat
                    pemilihan.
                  </ListItem>
                  <ListItem>
                    GA memilih "Template Approval" yang sesuai (misal: "Untuk
                    Dept. Produksi").
                  </ListItem>
                  <ListItem>
                    GA dapat menyesuaikan jalur approval (menambah/mengurangi
                    approver) jika perlu.
                  </ListItem>
                  <ListItem>
                    Klik "Validasi & Mulai Approval". Status MR berubah menjadi{" "}
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
                    "Approval & Validation".
                  </ListItem>
                  <ListItem>
                    Approver dapat menyetujui ("Approve") atau menolak
                    ("Reject") MR.
                  </ListItem>
                  <ListItem>
                    Requester dan Approver dapat menggunakan kolom **Diskusi**
                    untuk tanya jawab terkait MR tersebut.
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
                    , sistem akan otomatis **mengurangi**{" "}
                    <code>current_budget</code> pada Cost Center yang telah
                    dipilih GA.
                  </ListItem>
                  <ListItem>
                    Besar pengurangan budget = Total Estimasi Biaya MR.
                  </ListItem>
                  <ListItem>
                    Semua transaksi ini dicatat di "Cost Center Management"
                    (hanya bisa diakses Admin).
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
                  <ListItem>Purchasing membuka menu "Purchase Order".</ListItem>
                  <ListItem>
                    MR yang siap diproses akan muncul di daftar{" "}
                    <Badge className="bg-blue-500 text-white">Waiting PO</Badge>
                    .
                  </ListItem>
                  <ListItem>
                    Purchasing memilih MR dan mulai membuat PO baru.
                  </ListItem>
                  <ListItem>
                    Purchasing mencari barang di Master Data ("Barang") dan
                    memasukkan **harga beli final** dari vendor.
                  </ListItem>
                  <ListItem>
                    Mengisi detail Vendor, Payment Term, dan Pajak (PPN).
                  </ListItem>
                  <ListItem>
                    Klik "Ajukan". Status PO akan menjadi{" "}
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
                    GA membuka "Approval & Validation", memilih PO yang baru
                    dibuat.
                  </ListItem>
                  <ListItem>
                    GA menerapkan "Template Approval" yang sesuai (misal:
                    "Approval PO Finance").
                  </ListItem>
                  <ListItem>
                    Klik "Validasi". Status PO berubah menjadi{" "}
                    <Badge variant="secondary">Pending Approval</Badge>.
                  </ListItem>
                </ul>
              </Step>

              <Step
                icon={CheckCheck}
                title="3. Persetujuan PO (Oleh Approvers PO)"
              >
                Approver (biasanya Finance, Dept. Head terkait, atau Direksi)
                menyetujui PO.
                <ul className="mt-2 space-y-2 list-disc ml-6">
                  <ListItem>
                    Setelah semua approver setuju, status PO berubah menjadi{" "}
                    <Badge variant="secondary">Pending BAST</Badge>.
                  </ListItem>
                </ul>
              </Step>

              <Step icon={Truck} title="4. Konfirmasi BAST (Oleh Requester)">
                Setelah barang diterima di site, siklus ditutup oleh Requester
                awal.
                <ul className="mt-2 space-y-2 list-disc ml-6">
                  <ListItem>
                    **Requester (pembuat MR)** membuka halaman detail PO yang
                    statusnya <Badge variant="secondary">Pending BAST</Badge>.
                  </ListItem>
                  <ListItem>
                    Requester mengunggah file BAST (Berita Acara Serah Terima)
                    atau bukti penerimaan barang.
                  </ListItem>
                  <ListItem>
                    Secara otomatis, status PO akan berubah menjadi{" "}
                    <Badge variant="outline">Completed</Badge>.
                  </ListItem>
                  <ListItem>
                    Status MR yang terkait juga akan berubah menjadi{" "}
                    <Badge variant="outline">Completed</Badge>.
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
                  "Approval & Validation" dan memberikan persetujuan atau
                  penolakan tepat waktu.
                </p>
              </div>
              <div>
                <Badge>General Affair (GA)</Badge>
                <p className="mt-1 text-sm text-muted-foreground">
                  Bertindak sebagai **Validator Pusat**. Meninjau semua MR & PO,
                  menentukan **Cost Center** untuk setiap MR, dan menerapkan
                  jalur approval (template) untuk MR & PO.
                </p>
              </div>
              <div>
                <Badge>Purchasing</Badge>
                <p className="mt-1 text-sm text-muted-foreground">
                  Bertanggung jawab mengeksekusi MR yang berstatus "Waiting PO".
                  Membuat PO, memilih barang dari master data, menginput harga
                  final, dan mengelola data master barang.
                </p>
              </div>
              <div>
                <Badge variant="destructive">Admin</Badge>
                <p className="mt-1 text-sm text-muted-foreground">
                  **Super User**. Mengelola akun pengguna (User Management),
                  mengelola budget (Cost Center Management), dan memiliki hak
                  akses penuh untuk memperbaiki/mengedit semua data MR dan PO
                  jika terjadi kesalahan.
                </p>
              </div>
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
                T: Mengapa input "Estimasi Biaya" saya nonaktif (disabled)?
              </h5>
              <p className="text-sm text-muted-foreground -mt-2">
                J: Total Estimasi Biaya kini dihitung otomatis dari{" "}
                <strong>(Qty x Estimasi Harga)</strong> pada setiap item yang
                Anda tambahkan di "Order Items". Anda tidak perlu mengisinya
                secara manual.
              </p>

              <h5 className="font-semibold">
                T: Kapan budget Cost Center saya berkurang?
              </h5>
              <p className="text-sm text-muted-foreground -mt-2">
                J: Budget berkurang secara otomatis oleh sistem{" "}
                <strong>setelah semua approver menyetujui MR Anda</strong>,
                yaitu saat status MR berubah dari "Pending Approval" menjadi
                "Waiting PO".
              </p>

              <h5 className="font-semibold">
                T: Saya (GA) salah memilih Cost Center saat validasi. Bagaimana
                cara mengubahnya?
              </h5>
              <p className="text-sm text-muted-foreground -mt-2">
                J: Setelah divalidasi, GA tidak bisa mengubah Cost Center. Harap
                segera hubungi **Admin** untuk memperbaikinya melalui menu "MR
                Management".
              </p>

              <h5 className="font-semibold">
                T: Saya (Requester) tidak bisa menemukan tombol untuk upload
                BAST.
              </h5>
              <p className="text-sm text-muted-foreground -mt-2">
                J: Pastikan status PO sudah{" "}
                <Badge variant="secondary">Pending BAST</Badge>. Jika statusnya
                masih "Pending Approval", artinya PO tersebut belum disetujui
                oleh Finance/Direksi. Hanya Requester asli yang membuat MR yang
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
              <Badge variant="secondary">Pending BAST</Badge>
              <p className="text-xs text-muted-foreground">
                Hanya untuk PO. PO sudah disetujui penuh dan barang sedang dalam
                proses kirim. Menunggu konfirmasi penerimaan dari Requester.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCheck className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div>
              <Badge variant="outline">Completed</Badge>
              <p className="text-xs text-muted-foreground">
                Siklus selesai. Barang sudah diterima dan BAST telah diunggah.
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
