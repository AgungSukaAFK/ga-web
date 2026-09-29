// src/app/(With Sidebar)/tentang-app/page.tsx

"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Eye,
  FileSignature,
  Gauge,
  Package,
  PackageCheck,
  Send,
  ShieldCheck,
  Workflow,
  XCircle,
} from "lucide-react";

const NAMA_APLIKASI = "GMI Procure System";
const NAMA_PERUSAHAAN = "PT. Garuda Mart Indonesia / Global Inti Sejati";
const VERSI_APLIKASI = "Versi 1.0.0";

const STATS = [
  { icon: Workflow, value: "5", label: "Tahap Alur Kerja" },
  { icon: Gauge, value: "Real-time", label: "Tracking Status" },
  { icon: ShieldCheck, value: "Berjenjang", label: "Approval Terstruktur" },
  { icon: Boxes, value: "1", label: "Data Tersentralisasi" },
];

// Ukuran width/height = ukuran asli file, supaya aspek rasio logo terjaga.
const GRUP_PERUSAHAAN = [
  {
    nama: "Lourdes Auto Parts",
    desc: "Brand suku cadang otomotif yang menjadi wajah operasional sehari-hari, didukung oleh GMI dan GIS.",
    logo: "/lourdes-logo.webp",
    width: 1024,
    height: 392,
  },
  {
    nama: "PT. Garuda Mart Indonesia",
    desc: "GMI - entitas perusahaan yang pengadaan dan petty cash-nya dikelola melalui sistem ini.",
    logo: "/gmi-logo.webp",
    width: 150,
    height: 150,
  },
  {
    nama: "Global Inti Sejati",
    desc: "GIS - entitas perusahaan yang pengadaan dan petty cash-nya dikelola melalui sistem ini.",
    logo: "/gis-logo.webp",
    width: 1464,
    height: 1667,
  },
];

const MASALAH = [
  {
    icon: Eye,
    title: "Kurang Transparan",
    desc: 'Requester sulit melacak status permintaan. Pertanyaan "MR saya sudah sampai mana?" jadi sangat umum dan memakan waktu.',
  },
  {
    icon: Clock,
    title: "Lambat & Rawan Kesalahan",
    desc: "Persetujuan berjenjang berjalan lambat, rentan human error (dokumen hilang, salah ketik), dan sulit diaudit.",
  },
  {
    icon: AlertTriangle,
    title: "Tidak Terstandar",
    desc: "Tiap departemen atau lokasi punya cara berbeda, menyulitkan proses validasi dan audit.",
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
    desc: "Setiap pengguna punya dashboard tugas yang menunjukkan apa yang perlu dikerjakan, dan requester bisa melacak progres MR kapan saja.",
  },
  {
    icon: ShieldCheck,
    title: "Akuntabilitas yang Jelas",
    desc: "Setiap langkah tercatat - jalur approval, persetujuan tiap manajer, hingga fitur Highlight Approver dan Mode Edit untuk Purchasing.",
  },
  {
    icon: Boxes,
    title: "Sentralisasi Data",
    desc: "Permintaan item, lampiran, template approval, dan bukti penerimaan tersimpan di satu tempat, memudahkan pelacakan dan audit.",
  },
];

const TAHAPAN = [
  {
    icon: FileSignature,
    title: "Pengajuan MR",
    desc: "Requester membuat Material Request dengan data terstandar, termasuk estimasi harga tiap item.",
  },
  {
    icon: ClipboardCheck,
    title: "Validasi GA",
    desc: "General Affair menentukan Cost Center dan menerapkan template approval yang sesuai.",
  },
  {
    icon: Send,
    title: "Approval Berjenjang",
    desc: "MR/PO dikirim berurutan ke setiap approver, dengan notifikasi email agar tidak ada penundaan.",
  },
  {
    icon: Package,
    title: "Pembuatan PO",
    desc: 'Purchasing mengonversi MR berstatus "Waiting PO" menjadi PO resmi menggunakan master data barang.',
  },
  {
    icon: PackageCheck,
    title: "Penerimaan Barang",
    desc: "Requester mengunggah bukti penerimaan, yang otomatis menyelesaikan MR dan PO terkait.",
  },
];

function SectionHeading({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        {title}
      </h2>
      {desc && (
        <p className="mt-3 leading-relaxed text-muted-foreground">{desc}</p>
      )}
    </div>
  );
}

export default function TentangAppPage() {
  return (
    <div className="col-span-12 flex flex-col gap-16 pb-4 xl:col-span-10 xl:col-start-2">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-blue-800 px-6 py-10 text-white shadow-lg sm:px-10 sm:py-14">
        {/* Dekorasi latar */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:32px_32px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-blue-500/30 blur-3xl"
        />

        <div className="relative grid items-center gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-5 text-center lg:text-left">
            <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
              <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/15">
                {VERSI_APLIKASI}
              </Badge>
              <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/15">
                Procurement
              </Badge>
              <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/15">
                Petty Cash
              </Badge>
            </div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
              Pengadaan barang yang{" "}
              <span className="bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">
                terstruktur, transparan, dan akuntabel.
              </span>
            </h1>
            <p className="mx-auto max-w-xl text-base leading-relaxed text-blue-100/80 sm:text-lg lg:mx-0">
              <span className="font-semibold text-white">{NAMA_APLIKASI}</span>{" "}
              adalah solusi digital terpusat untuk alur kerja Material Request,
              Purchase Order, hingga Petty Cash di {NAMA_PERUSAHAAN}.
            </p>
          </div>

          <div className="mx-auto w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-white/20 sm:p-8">
            <Image
              src="/lourdes-logo.webp"
              alt="Logo Lourdes Auto Parts"
              width={1024}
              height={392}
              className="pointer-events-none h-auto w-full"
              priority
            />
          </div>
        </div>

        {/* Highlight */}
        <div className="relative mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATS.map(({ icon: Icon, value, label }) => (
            <div
              key={label}
              className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
            >
              <Icon className="h-5 w-5 text-cyan-300" />
              <p className="mt-3 text-lg font-bold sm:text-xl">{value}</p>
              <p className="text-xs text-blue-100/70 sm:text-sm">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Grup perusahaan */}
      <section className="space-y-8">
        <SectionHeading
          eyebrow="Grup Perusahaan"
          title="Dikembangkan untuk Lourdes, GMI & GIS"
          desc="Satu sistem yang digunakan bersama oleh seluruh entitas grup, dengan alur dan standar yang sama."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {GRUP_PERUSAHAAN.map(({ nama, desc, logo, width, height }) => (
            <div
              key={nama}
              className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
            >
              {/* Latar putih tetap putih di dark mode agar logo terbaca */}
              <div className="flex h-36 items-center justify-center border-b bg-white p-6">
                <Image
                  src={logo}
                  alt={`Logo ${nama}`}
                  width={width}
                  height={height}
                  className="h-full w-auto max-w-full object-contain transition-transform group-hover:scale-105"
                />
              </div>
              <div className="flex-1 p-5">
                <p className="font-semibold">{nama}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Masalah vs solusi */}
      <section className="space-y-8">
        <SectionHeading
          eyebrow="Latar Belakang"
          title="Dari proses manual ke satu sistem terpadu"
          desc="Pengadaan barang, dari Material Request (MR) hingga Purchase Order (PO), adalah salah satu alur kerja paling krusial di perusahaan. Sebelumnya proses ini bergantung pada formulir kertas, spreadsheet, dan email yang terfragmentasi."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-6 dark:border-rose-900/50 dark:bg-rose-950/20">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
              <XCircle className="h-5 w-5" />
              <p className="font-semibold">Sebelum</p>
            </div>
            <ul className="mt-5 space-y-5">
              {MASALAH.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {desc}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-6 dark:border-blue-900/50 dark:bg-blue-950/20">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <CheckCircle2 className="h-5 w-5" />
              <p className="font-semibold">Sesudah, dengan {NAMA_APLIKASI}</p>
            </div>
            <ul className="mt-5 space-y-5">
              {SOLUSI.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {desc}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Alur kerja */}
      <section className="space-y-8">
        <SectionHeading
          eyebrow="Cara Kerja"
          title="5 Tahap Alur Pengadaan"
          desc="Setiap MR bergerak melalui tahapan yang sama, sehingga semua pihak tahu posisi dan tanggung jawabnya."
        />
        <ol className="relative grid gap-4 lg:grid-cols-5">
          {/* Garis penghubung (desktop) */}
          <div
            aria-hidden
            className="absolute left-[10%] right-[10%] top-6 hidden h-px bg-gradient-to-r from-blue-500/0 via-blue-500/50 to-blue-500/0 lg:block"
          />
          {TAHAPAN.map(({ icon: Icon, title, desc }, i) => (
            <li
              key={title}
              className="relative flex gap-4 rounded-xl border bg-card p-5 shadow-sm lg:flex-col lg:items-center lg:border-0 lg:bg-transparent lg:p-0 lg:text-center lg:shadow-none"
            >
              <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-400 text-white shadow-md ring-4 ring-background">
                <Icon className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background text-[10px] font-bold text-blue-600 ring-1 ring-border dark:text-blue-400">
                  {i + 1}
                </span>
              </div>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {desc}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Penutup */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-10 text-center text-white shadow-lg sm:px-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl"
        />
        <div className="relative mx-auto max-w-2xl space-y-3">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Satu sistem, satu alur, satu sumber data.
          </h2>
          <p className="text-blue-50/90">
            Keterlambatan dan kesalahan dalam pengadaan berdampak langsung pada
            efisiensi operasional. {NAMA_APLIKASI} hadir agar setiap permintaan
            bergerak cepat, tercatat, dan bisa dipertanggungjawabkan.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-sm font-medium">
            <span>Ajukan</span>
            <ArrowRight className="h-4 w-4 opacity-70" />
            <span>Setujui</span>
            <ArrowRight className="h-4 w-4 opacity-70" />
            <span>Pesan</span>
            <ArrowRight className="h-4 w-4 opacity-70" />
            <span>Terima</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground">
        {NAMA_APLIKASI} · {VERSI_APLIKASI} · Dikembangkan untuk{" "}
        {NAMA_PERUSAHAAN}
      </p>
    </div>
  );
}
