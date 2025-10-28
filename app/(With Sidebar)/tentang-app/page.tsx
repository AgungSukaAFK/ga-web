// src/app/(With Sidebar)/tentang-app/page.tsx

"use client";

import { Content } from "@/components/content";
import Image from "next/image";

const NAMA_APLIKASI = "GMI Procure System";
const NAMA_PERUSAHAAN = "PT. Garuda Mart Indonesia / Global Inti Sejati";

export default function TentangAppPage() {
  return (
    <>
      <div className="col-span-12 lg:col-span-10 lg:col-start-2 xl:col-span-8 xl:col-start-3">
        <Content>
          {/* Header */}
          <div className="flex flex-col items-center gap-3 text-center mb-12">
            <div className="relative w-20 h-20 rounded-full overflow-hidden shadow-md ring-2 ring-muted-foreground/20">
              <Image
                src="/lourdes.png"
                alt="Logo Perusahaan"
                fill
                className="object-cover"
              />
            </div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
              Tentang {NAMA_APLIKASI}
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Solusi digital untuk mentransformasi alur kerja pengadaan barang
              di{" "}
              <span className="font-medium text-foreground">
                {NAMA_PERUSAHAAN}
              </span>
              .
            </p>
          </div>

          {/* Konten */}
          <div className="prose dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-h2:text-foreground prose-h3:text-foreground/90 prose-p:leading-relaxed prose-li:leading-relaxed">
            <h2>Latar Belakang: Masalah yang Kami Selesaikan</h2>
            <p>
              Proses pengadaan barang, mulai dari permintaan (Material
              Request/MR) hingga pemesanan (Purchase Order/PO), adalah salah
              satu alur kerja paling krusial di perusahaan. Secara tradisional,
              proses ini seringkali bergantung pada metode manual seperti
              formulir kertas, spreadsheet Excel, atau komunikasi email yang
              terfragmentasi.
            </p>
            <p>Metode manual ini memiliki beberapa kelemahan utama:</p>
            <ul className="space-y-3">
              <li>
                <strong>Kurang Transparan:</strong> Sulit bagi peminta
                (requester) untuk melacak status permintaan mereka. Pertanyaan
                seperti <em>&quot;MR saya sudah sampai mana?&quot;</em> atau{" "}
                <em>&quot;PO-nya sudah dibuat atau belum?&quot;</em> menjadi
                sangat umum dan memakan waktu.
              </li>
              <li>
                <strong>Lambat & Rawan Kesalahan:</strong> Proses persetujuan
                (approval) yang berjenjang menjadi lambat, rentan terhadap{" "}
                <em>human error</em> (dokumen hilang, salah ketik), dan sulit
                untuk diaudit.
              </li>
              <li>
                <strong>Tidak Terstandar:</strong> Alur persetujuan seringkali
                tidak konsisten. Setiap departemen atau lokasi mungkin memiliki
                cara yang berbeda, menyulitkan proses validasi dan audit.
              </li>
            </ul>
            <p>
              Keterlambatan dan kesalahan dalam proses pengadaan ini berdampak
              langsung pada efisiensi operasional perusahaan.
            </p>

            <hr className="my-10 border-muted" />

            <h2>Solusi: Apa yang Aplikasi Ini Lakukan?</h2>
            <p>
              <strong>{NAMA_APLIKASI}</strong> dikembangkan sebagai solusi
              digital terpusat untuk mengatasi tantangan tersebut. Aplikasi ini
              mengubah alur kerja yang kompleks menjadi proses yang terstruktur,
              transparan, dan akuntabel.
            </p>

            <h3>1. Alur Kerja yang Terstruktur & Otomatis</h3>
            <p>
              Aplikasi ini memformalkan seluruh proses pengadaan ke dalam lima
              tahap utama yang jelas:
            </p>
            <ol className="space-y-3">
              <li>
                <strong>Pengajuan MR:</strong> Requester membuat MR dengan data
                terstandar (termasuk Cost Center & Tujuan Site).
              </li>
              <li>
                <strong>Validasi GA:</strong> General Affair menerima MR,
                memvalidasinya, dan menerapkan <em>template approval</em> yang
                sesuai.
              </li>
              <li>
                <strong>Approval Berjenjang:</strong> MR/PO dikirim secara
                berurutan ke setiap approver. Notifikasi email memastikan tidak
                ada penundaan.
              </li>
              <li>
                <strong>Pembuatan PO:</strong> Tim Purchasing menerima MR yang
                sudah <code>Waiting PO</code>, mengonversinya menjadi PO resmi
                menggunakan master data barang.
              </li>
              <li>
                <strong>Konfirmasi BAST:</strong> Siklus ditutup saat requester
                asli mengunggah BAST sebagai bukti penerimaan barang, yang
                secara otomatis menyelesaikan MR dan PO terkait.
              </li>
            </ol>

            <h3>2. Transparansi Penuh</h3>
            <p>
              Tidak ada lagi kebingungan status. Setiap pengguna memiliki{" "}
              <em>dashboard</em> tugas (<code>Approval & Validation</code>) yang
              menunjukkan dengan tepat apa yang perlu mereka kerjakan. Requester
              dapat melacak progres MR mereka dari &quot;Pending
              Validation&quot; hingga &quot;Completed&quot;.
            </p>

            <h3>3. Akuntabilitas yang Jelas</h3>
            <p>
              Setiap langkah tercatat. Jalur approval yang diterapkan oleh GA
              terdokumentasi, dan proses persetujuan oleh setiap manajer
              tercatat. Fitur <em>&quot;Highlight Approver&quot;</em> dan{" "}
              <em>&quot;Mode Edit&quot;</em> untuk Purchasing memastikan setiap
              peran bertanggung jawab atas datanya masing-masing.
            </p>

            <h3>4. Sentralisasi Data</h3>
            <p>
              Semua dokumen, mulai dari permintaan item, lampiran pendukung,
              template approval, hingga BAST, tersimpan di satu tempat. Ini
              memudahkan pelacakan, audit, dan pembuatan laporan di masa depan.
            </p>
          </div>
        </Content>
      </div>
    </>
  );
}
