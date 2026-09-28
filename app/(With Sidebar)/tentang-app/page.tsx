// src/app/(With Sidebar)/tentang-app/page.tsx

"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Boxes,
  ClipboardCheck,
  Clock,
  Eye,
  FileSignature,
  Gauge,
  Package,
  PackageCheck,
  Send,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

const NAMA_APLIKASI = "GMI Procure System";
const NAMA_PERUSAHAAN = "PT. Garuda Mart Indonesia / Global Inti Sejati";
const VERSI_APLIKASI = "Versi 1.0.0";

// Klik logo perusahaan sebanyak ini untuk memicu easter egg.
const EASTER_EGG_TARGET_CLICKS = 5;

const STATS = [
  { icon: Workflow, label: "5 Tahap Alur Kerja" },
  { icon: Gauge, label: "Tracking Real-time" },
  { icon: ShieldCheck, label: "Approval Berjenjang" },
  { icon: Boxes, label: "Data Tersentralisasi" },
];

const MASALAH = [
  {
    icon: Eye,
    title: "Kurang Transparan",
    desc: 'Sulit bagi peminta (requester) untuk melacak status permintaan mereka. Pertanyaan seperti "MR saya sudah sampai mana?" jadi sangat umum dan memakan waktu.',
  },
  {
    icon: Clock,
    title: "Lambat & Rawan Kesalahan",
    desc: "Proses persetujuan berjenjang menjadi lambat, rentan human error (dokumen hilang, salah ketik), dan sulit untuk diaudit.",
  },
  {
    icon: AlertTriangle,
    title: "Tidak Terstandar",
    desc: "Alur persetujuan tidak konsisten - tiap departemen atau lokasi punya cara berbeda, menyulitkan proses validasi dan audit.",
  },
];

const SOLUSI = [
  {
    icon: Workflow,
    title: "Alur Kerja Terstruktur & Otomatis",
    desc: "Seluruh proses pengadaan diformalkan ke dalam lima tahap utama yang jelas, dari pengajuan MR hingga konfirmasi penerimaan barang.",
  },
  {
    icon: Eye,
    title: "Transparansi Penuh",
    desc: "Setiap pengguna punya dashboard tugas yang menunjukkan dengan tepat apa yang perlu dikerjakan, dan requester bisa melacak progres MR mereka kapan saja.",
  },
  {
    icon: ShieldCheck,
    title: "Akuntabilitas yang Jelas",
    desc: "Setiap langkah tercatat - jalur approval, persetujuan tiap manajer, hingga fitur Highlight Approver dan Mode Edit untuk Purchasing.",
  },
  {
    icon: Boxes,
    title: "Sentralisasi Data",
    desc: "Semua dokumen (permintaan item, lampiran, template approval, bukti penerimaan) tersimpan di satu tempat, memudahkan pelacakan dan audit.",
  },
];

const TAHAPAN = [
  {
    icon: FileSignature,
    title: "Pengajuan MR",
    desc: "Requester membuat Material Request dengan data terstandar, termasuk estimasi harga tiap item yang diminta.",
  },
  {
    icon: ClipboardCheck,
    title: "Validasi GA",
    desc: "General Affair menerima MR, menentukan Cost Center, dan menerapkan template approval yang sesuai.",
  },
  {
    icon: Send,
    title: "Approval Berjenjang",
    desc: "MR/PO dikirim secara berurutan ke setiap approver - notifikasi email memastikan tidak ada penundaan.",
  },
  {
    icon: Package,
    title: "Pembuatan PO",
    desc: 'Tim Purchasing menerima MR yang sudah "Waiting PO" dan mengonversinya menjadi PO resmi menggunakan master data barang.',
  },
  {
    icon: PackageCheck,
    title: "Konfirmasi Penerimaan Barang",
    desc: "Siklus ditutup saat requester mengunggah bukti penerimaan barang, yang otomatis menyelesaikan MR dan PO terkait.",
  },
];

export default function TentangAppPage() {
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [logoClicks, setLogoClicks] = useState(0);

  const handleLogoClick = () => {
    setLogoClicks((prev) => {
      const next = prev + 1;
      if (next >= EASTER_EGG_TARGET_CLICKS) {
        setShowEasterEgg(true);
        return 0;
      }
      return next;
    });
  };

  return (
    <>
      <div className="col-span-12 lg:col-span-10 lg:col-start-2 xl:col-span-8 xl:col-start-3 flex flex-col gap-6">
        {/* Header */}
        <Card>
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <button
              type="button"
              onClick={handleLogoClick}
              aria-label="Logo perusahaan"
              className="relative h-20 w-20 sm:h-24 sm:w-24 cursor-pointer rounded-full overflow-hidden shadow-md ring-2 ring-muted-foreground/20 transition-transform duration-150 hover:scale-105 active:scale-95"
            >
              <Image
                src="/lourdes.png"
                alt="Logo Perusahaan"
                fill
                className="object-cover pointer-events-none"
                priority
              />
            </button>
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
                Tentang {NAMA_APLIKASI}
              </h1>
              <p className="max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground">
                Solusi digital untuk mentransformasi alur kerja pengadaan
                barang di{" "}
                <span className="font-medium text-foreground">
                  {NAMA_PERUSAHAAN}
                </span>
                .
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Badge variant="secondary">{VERSI_APLIKASI}</Badge>
              <Badge variant="outline">Procurement</Badge>
              <Badge variant="outline">Petty Cash</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Ringkasan singkat */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STATS.map(({ icon: Icon, label }) => (
            <Card key={label} className="py-4">
              <CardContent className="flex flex-col items-center gap-2 px-4 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Latar belakang masalah */}
        <Card>
          <CardContent className="space-y-5">
            <div>
              <h2 className="text-2xl font-semibold">
                Latar Belakang: Masalah yang Kami Selesaikan
              </h2>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                Proses pengadaan barang, mulai dari permintaan (Material
                Request/MR) hingga pemesanan (Purchase Order/PO), adalah
                salah satu alur kerja paling krusial di perusahaan. Secara
                tradisional, proses ini seringkali bergantung pada metode
                manual seperti formulir kertas, spreadsheet Excel, atau
                komunikasi email yang terfragmentasi - dengan beberapa
                kelemahan utama:
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {MASALAH.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="space-y-2 rounded-lg border p-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {desc}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-sm leading-relaxed text-muted-foreground">
              Keterlambatan dan kesalahan dalam proses pengadaan ini
              berdampak langsung pada efisiensi operasional perusahaan.
            </p>
          </CardContent>
        </Card>

        {/* Solusi */}
        <Card>
          <CardContent className="space-y-5">
            <div>
              <h2 className="text-2xl font-semibold">
                Solusi: Apa yang Aplikasi Ini Lakukan?
              </h2>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                <strong className="text-foreground">{NAMA_APLIKASI}</strong>{" "}
                dikembangkan sebagai solusi digital terpusat untuk mengatasi
                tantangan tersebut, mengubah alur kerja yang kompleks menjadi
                proses yang terstruktur, transparan, dan akuntabel.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {SOLUSI.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-3 rounded-lg border p-4">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alur kerja */}
        <Card>
          <CardContent className="space-y-5">
            <h2 className="text-2xl font-semibold">5 Tahap Alur Kerja</h2>
            <div>
              {TAHAPAN.map(({ icon: Icon, title, desc }, i) => (
                <div key={title} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-sm">
                      <Icon className="h-4 w-4" />
                    </div>
                    {i < TAHAPAN.length - 1 && (
                      <div className="my-1 w-px flex-1 bg-border" />
                    )}
                  </div>
                  <div className={i < TAHAPAN.length - 1 ? "pb-6" : ""}>
                    <p className="text-sm font-semibold">
                      {i + 1}. {title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="pb-2 text-center text-xs text-muted-foreground">
          {NAMA_APLIKASI} · {VERSI_APLIKASI} · Dikembangkan untuk{" "}
          {NAMA_PERUSAHAAN}
        </p>
      </div>

      {/* Easter egg: muncul setelah logo perusahaan diklik 5x */}
      <Dialog open={showEasterEgg} onOpenChange={setShowEasterEgg}>
        <DialogContent
          showCloseButton
          className="max-w-sm overflow-hidden border-0 bg-transparent p-0 shadow-none sm:max-w-lg [&>button]:rounded-full [&>button]:bg-black/50 [&>button]:p-1 [&>button]:text-white [&>button]:opacity-100 [&>button]:hover:bg-black/70"
        >
          <DialogTitle className="sr-only">
            Easter Egg Ditemukan
          </DialogTitle>
          <DialogDescription className="sr-only">
            Anda menemukan easter egg tersembunyi dengan mengklik logo
            perusahaan sebanyak lima kali.
          </DialogDescription>
          <div className="relative">
            <Image
              src="/easter-egg.webp"
              alt="Easter egg"
              width={896}
              height={1195}
              className="h-auto w-full rounded-lg"
              priority
            />
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Easter Egg Ditemukan!
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
