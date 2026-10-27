// src/components/petty-cash/PcGlossary.tsx
//
// Penjelasan singkat istilah Petty Cash (Voucher, Deklarasi, dst.) untuk
// requester non-finance - lihat planning-pc.md Bagian 3 "Tooltip istilah".
// Satu sumber teks, dipakai 2 cara: PcGlossaryButton (popover - bisa diketuk
// di HP) di header halaman, dan pcTermTitle (atribut `title`, muncul saat
// hover) di stepper & badge Status Utama Dashboard. Sengaja tanpa
// "use client" - helper teksnya juga dipakai komponen tanpa direktif itu,
// Popover-nya sendiri sudah client component.

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { PcOverallStatusKey } from "@/services/pettyCashDashboardService";
import { CircleHelp } from "lucide-react";

export type PcTermKey =
  | "pengajuan"
  | "voucher"
  | "tarikan"
  | "deklarasi"
  | "pengembalian";

// Urutan = urutan alur, supaya daftar di popover sekaligus menjelaskan
// urutan langkahnya.
export const PC_TERMS: Record<PcTermKey, { label: string; definition: string }> = {
  pengajuan: {
    label: "Pengajuan",
    definition:
      "Permintaan barang/dana Petty Cash beserta rinciannya. Disetujui approver dulu sebelum bisa dibuatkan Voucher.",
  },
  voucher: {
    label: "Voucher",
    definition:
      "Surat pencairan dana dari Pengajuan yang sudah disetujui. Setelah Voucher disetujui, dananya bisa ditarik bertahap.",
  },
  tarikan: {
    label: "Tarikan Dana (Sub-Voucher)",
    definition:
      "Pencairan sebagian dana Voucher sesuai barang yang akan dibeli. Dananya ditransfer/dibayar oleh Finance.",
  },
  deklarasi: {
    label: "Deklarasi",
    definition:
      "Laporan pemakaian riil dana tarikan, disertai bukti struk/nota. Totalnya tidak boleh melebihi nominal tarikan.",
  },
  pengembalian: {
    label: "Pengembalian Dana",
    definition:
      "Setoran sisa dana ke Finance kalau Deklarasi yang disetujui lebih kecil dari nominal tarikan.",
  },
};

/** Teks utk atribut `title` (hover) - "Voucher: Surat pencairan dana ...". */
export const pcTermTitle = (term: PcTermKey) =>
  `${PC_TERMS[term].label}: ${PC_TERMS[term].definition}`;

/** Istilah yang relevan dgn sebuah Status Utama (computePcOverallStatus). */
export const termForStatusKey = (key: PcOverallStatusKey): PcTermKey | null => {
  switch (key) {
    case "pengajuan_menunggu_approval":
    case "pengajuan_ditolak":
      return "pengajuan";
    case "menunggu_ajukan_voucher":
    case "voucher_menunggu_approval":
    case "voucher_ditolak":
      return "voucher";
    case "menunggu_tarik_dana":
    case "tarikan_menunggu_pembayaran":
      return "tarikan";
    case "menunggu_ajukan_deklarasi":
    case "deklarasi_menunggu_approval":
    case "deklarasi_ditolak":
      return "deklarasi";
    default:
      return null;
  }
};

/** `title` badge Status Utama - undefined kalau statusnya tidak terkait satu istilah. */
export const statusTermTitle = (key: PcOverallStatusKey): string | undefined => {
  const term = termForStatusKey(key);
  return term ? pcTermTitle(term) : undefined;
};

/** Tombol "Istilah" berisi semua istilah; `focus` disorot sbg istilah utama halaman itu. */
export function PcGlossaryButton({ focus }: { focus?: PcTermKey }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <CircleHelp className="h-4 w-4" />
          Istilah
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <p className="border-b px-3 py-2 text-sm font-semibold">
          Istilah Petty Cash
        </p>
        <dl className="flex flex-col divide-y">
          {(Object.keys(PC_TERMS) as PcTermKey[]).map((key) => (
            <div
              key={key}
              className={cn("px-3 py-2", key === focus && "bg-muted/60")}
            >
              <dt className="text-sm font-medium">{PC_TERMS[key].label}</dt>
              <dd className="text-xs text-muted-foreground">
                {PC_TERMS[key].definition}
              </dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
