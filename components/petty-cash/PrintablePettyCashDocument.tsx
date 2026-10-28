// src/components/petty-cash/PrintablePettyCashDocument.tsx
//
// Dokumen cetak Petty Cash (Input Pengajuan/Pengajuan Voucher/Sub-Voucher/
// Deklarasi) - A4 PORTRAIT, pagination custom via PaginatedPrintDocument
// (ukur tinggi render dulu di context layar biasa, baru dipecah ke beberapa
// halaman A4 - lihat komentar di file itu utk alasan lengkapnya), kop
// company dari COMPANY_DETAILS (lib/companyDetails.ts).
//
// Dua layout, mengikuti form kertas yang sudah dipakai GA/Finance:
// - variant "pengajuan" (default) - mirip "Form Pengajuan Kas/Bank Keluar":
//   blok info (No/Date/PIC/Divisi/Budget), tabel item, baris TOTAL kuning.
// - variant "deklarasi" - mirip "Form Deklarasi": Tanggal/Keterangan/FP No,
//   tabel Uang Masuk / Uang Keluar / Saldo berjalan, Total & Sisa Pemakaian.
//
// Kolom tanda tangan = tabel berbingkai, satu kolom per orang, header-nya
// dikelompokkan per level: Pengaju Budget (pembuat) | Pengguna Budget |
// Dicek Oleh | Disetujui Oleh | Dijalankan Oleh (level tiap approver, lihat
// PcApprovalLevel di type/index.ts & getPcApprovalLevel). Mode "qr"
// (default) berisi kode QR per slot: QR mengarah ke halaman verifikasi
// /approval-pc-*/[id]?step=N, yang mengarahkan pemindai sesuai perannya
// (approver yang belum approve -> langsung ke halaman approval, dst - lihat
// usePcVerifyAccess). Mode "wet" mengganti QR dengan ruang kosong utk tanda
// tangan basah. Pengguna Budget tidak ikut approval - slotnya tanpa QR,
// cuma nama.

"use client";

import { Fragment } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginatedPrintDocument } from "@/app/(With Sidebar)/purchase-order/[id]/PaginatedPrintDocument";
import { getCompanyDetails } from "@/lib/companyDetails";
import { extractPlainText } from "@/lib/rich-content";
import { getPcApprovalLevel } from "@/lib/pcApprovalFlow";
import { PcPenarikanSummary } from "@/lib/pcChain";
import { PettyCashPengajuanApprover, PettyCashPengajuanItem } from "@/type";

export interface PcPrintSignature {
  label: string;
  name: string;
  subtitle?: string | null;
  state: "done" | "pending" | "rejected";
  date?: string | Date | null;
  // Index slot di halaman verifikasi (?step=N) - 0 = pembuat.
  step: number;
}

// Satu kolom di tabel tanda tangan. `qrValue` null = slot tanpa QR
// (Pengguna Budget, yang tidak ikut approval).
interface SignatureSlot {
  key: string;
  label: string;
  name: string;
  subtitle?: string | null;
  state?: PcPrintSignature["state"];
  date?: string | Date | null;
  qrValue: string | null;
}

// Maks kolom per baris tabel tanda tangan supaya QR & nama tetap terbaca di
// A4 portrait (lebar isi 180mm -> ~30mm per kolom). Lebih dari itu
// dilanjutkan ke baris tabel berikutnya.
const SIG_MAX_COLS = 6;

interface PrintablePettyCashDocumentProps {
  variant?: "pengajuan" | "deklarasi";
  docTitle: string; // "Input Pengajuan" | "Pengajuan Voucher" | "Deklarasi" | ...
  kode: string;
  companyCode: string;
  createdAt: string | Date;
  requesterName?: string | null;
  department: string;
  site?: string | null;
  neededDate?: string | Date | null;
  weekOfMonth?: number | null;
  showNeededDate?: boolean;
  budgetName?: string | null;
  // Nomor dokumen terkait (mis. "Ref. Pengajuan") - tampil di blok info.
  references?: { label: string; value: string | null | undefined }[];
  notes: string | null;
  items: PettyCashPengajuanItem[];
  totalAmount: number;
  approvals?: PettyCashPengajuanApprover[] | null;
  // Basis URL QR utk slot approver - default `qrUrl`. Dipakai Sub-Voucher
  // yang mencantumkan approver Voucher induknya (QR-nya ke halaman
  // verifikasi Voucher, bukan Sub-Voucher).
  approvalsQrUrl?: string;
  // Pengguna Budget (lihat PettyCashPengajuan.pengguna_budget_*) - kosong
  // (dokumen lama) = requester sendiri.
  penggunaBudget?: { name?: string | null; subtitle?: string | null } | null;
  // Slot tanda tangan tambahan setelah approver (mis. Finance pembayar di
  // Sub-Voucher yang tidak punya jalur approval sendiri). `step` default
  // melanjutkan urutan approver.
  extraSignatures?: (Omit<PcPrintSignature, "step"> & { step?: number })[];
  // Khusus variant "pengajuan": ringkasan saldo & riwayat penarikan
  // (buildPcPenarikanSummary, lib/pcChain.ts) - ditampilkan ringkas di atas
  // kolom tanda tangan.
  penarikanSummary?: PcPenarikanSummary | null;
  // Khusus variant "deklarasi": dana yang diterima (nominal Sub-Voucher)
  // & nomor Form Pengajuan asalnya.
  cashReceived?: number | null;
  cashReceivedLabel?: string;
  fpNo?: string | null;
  qrUrl: string;
  // "qr" = kolom tanda tangan berisi QR verifikasi (default); "wet" = kolom
  // kosong utk tanda tangan basah, tanpa QR sama sekali.
  signatureMode?: "qr" | "wet";
  printTrigger: boolean;
}

type DeklarasiRow =
  | { kind: "in"; label: string; amount: number; saldo: number }
  | {
      kind: "out";
      item: PettyCashPengajuanItem;
      amount: number;
      saldo: number;
    };

// CSS dokumen cetak ditulis langsung (bukan kelas arbitrary Tailwind spt
// text-[6pt]/h-[16mm]) - kelas arbitrary baru cuma dibuatkan CSS-nya kalau
// Tailwind sempat scan ulang file ini; di dev server yang sudah lama jalan
// itu kadang tidak terjadi & hasil cetak jadi berantakan (font besar, ruang
// tanda tangan & garis hilang). Di-scope ke #printable-po-a4 (id halaman
// cetak PaginatedPrintDocument) supaya juga menang atas utilitas Tailwind
// bawaan (mis. text-xs di <table>).
const PRINT_CSS = `#printable-po-a4 .pcx-font-size-5-5pt{font-size:5.5pt}#printable-po-a4 .pcx-font-size-6-5pt{font-size:6.5pt}#printable-po-a4 .pcx-font-size-6pt{font-size:6pt}#printable-po-a4 .pcx-font-size-7-5pt{font-size:7.5pt}#printable-po-a4 .pcx-font-size-8pt{font-size:8pt}#printable-po-a4 .pcx-height-20mm{height:20mm}#printable-po-a4 .pcx-height-44px{height:44px}#printable-po-a4 .pcx-height-50px{height:50px}#printable-po-a4 .pcx-overflow-wrap-anywhere{overflow-wrap:anywhere}#printable-po-a4 .pcx-width-12{width:12%}#printable-po-a4 .pcx-width-14{width:14%}#printable-po-a4 .pcx-width-15{width:15%}#printable-po-a4 .pcx-width-21{width:21%}#printable-po-a4 .pcx-width-22{width:22%}#printable-po-a4 .pcx-width-34{width:34%}#printable-po-a4 .pcx-width-42{width:42%}#printable-po-a4 .pcx-width-44px{width:44px}#printable-po-a4 .pcx-width-5{width:5%}#printable-po-a4 .pcx-width-6{width:6%}#printable-po-a4 .pcx-width-60{width:60%}#printable-po-a4 .pcx-width-7{width:7%}#printable-po-a4 .pcx-width-71{width:71%}#printable-po-a4 .pcx-width-90px{width:90px}#printable-po-a4 .pcx-total-row{background:#fef08a}#printable-po-a4 .pcx-pt-1px{padding-top:1px}`;

const formatNumber = (value: number | null | undefined) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(
    Number(value) || 0,
  );

// Batas panjang teks di hasil cetak. Pagination memecah dokumen per BARIS
// tabel - satu baris/blok yang lebih tinggi dari satu halaman tidak bisa
// dipecah lagi & akan meluber, jadi teks ekstrem dipotong (isi lengkap tetap
// ada di sistem).
const PRINT_LIMIT = { itemName: 300, itemNote: 120, notes: 1500, info: 150, sigName: 80 };
const clamp = (text: string | null | undefined, max: number) => {
  if (!text) return text ?? "";
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
};

const formatRp = (value: number | null | undefined) =>
  `Rp ${formatNumber(value)}`;

const formatShortDate = (date?: string | Date | null) => {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
};

const buildStepUrl = (qrUrl: string, step: number) => {
  if (!qrUrl) return "";
  return `${qrUrl}${qrUrl.includes("?") ? "&" : "?"}step=${step}`;
};

export function PrintablePettyCashDocument({
  variant = "pengajuan",
  docTitle,
  kode,
  companyCode,
  createdAt,
  requesterName,
  department,
  site,
  neededDate,
  weekOfMonth,
  showNeededDate = true,
  budgetName,
  references = [],
  notes,
  items,
  totalAmount,
  approvals,
  approvalsQrUrl,
  penggunaBudget,
  extraSignatures = [],
  penarikanSummary,
  cashReceived,
  cashReceivedLabel = "Terima Uang",
  fpNo,
  qrUrl,
  signatureMode = "qr",
  printTrigger,
}: PrintablePettyCashDocumentProps) {
  const isWet = signatureMode === "wet";
  const isDeklarasi = variant === "deklarasi";
  const companyInfo = getCompanyDetails(companyCode);
  const fullNotes = extractPlainText(notes);
  const plainNotes =
    fullNotes.length > PRINT_LIMIT.notes
      ? `${clamp(fullNotes, PRINT_LIMIT.notes)} (selengkapnya di sistem)`
      : fullNotes;
  const isMixedCoa = new Set(items.map((it) => it.coa ?? "-")).size > 1;

  const coaTotals = new Map<string, number>();
  for (const it of items) {
    const key = it.coa ?? "-";
    coaTotals.set(key, (coaTotals.get(key) ?? 0) + it.subtotal);
  }

  const approverList = approvals ?? [];
  const signatures: SignatureSlot[] = [
    {
      key: "pengaju",
      label: "Pengaju Budget",
      name: requesterName || "-",
      subtitle: department,
      state: "done",
      date: createdAt,
      qrValue: buildStepUrl(qrUrl, 0),
    },
    {
      key: "pengguna",
      label: "Pengguna Budget",
      name: penggunaBudget?.name || requesterName || "-",
      subtitle: penggunaBudget?.name ? penggunaBudget.subtitle : department,
      qrValue: null,
    },
    ...approverList.map((a, i) => ({
      key: `approver-${i}`,
      label: getPcApprovalLevel(approverList, i),
      name: a.nama,
      subtitle: a.department,
      state:
        a.status === "approved"
          ? ("done" as const)
          : a.status === "rejected"
            ? ("rejected" as const)
            : ("pending" as const),
      date: a.processed_at,
      qrValue: buildStepUrl(approvalsQrUrl ?? qrUrl, i + 1),
    })),
    ...extraSignatures.map(({ step, ...s }, i) => ({
      ...s,
      key: `extra-${i}`,
      qrValue: buildStepUrl(qrUrl, step ?? approverList.length + 1 + i),
    })),
  ];

  // ---------- Baris tabel ----------
  const received = Number(cashReceived) || 0;
  const deklarasiRows: DeklarasiRow[] = [];
  if (isDeklarasi) {
    let saldo = 0;
    if (cashReceived != null) {
      saldo = received;
      deklarasiRows.push({
        kind: "in",
        label: cashReceivedLabel,
        amount: received,
        saldo,
      });
    }
    for (const item of items) {
      saldo -= item.subtotal;
      deklarasiRows.push({ kind: "out", item, amount: item.subtotal, saldo });
    }
  }

  const cell = "py-1 px-1 align-top border border-black pcx-overflow-wrap-anywhere";
  const headCell =
    "py-1 px-1 font-bold text-center border border-black bg-gray-100 uppercase pcx-font-size-5-5pt leading-tight";

  // ---------- Kop ----------
  const renderHeader = () => (
    <header className="mb-3">
      <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="pcx-width-90px pcx-height-50px flex-shrink-0 flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={companyInfo.logo}
              alt="Logo"
              className="w-full h-full object-contain object-left"
            />
          </div>
          <div className="min-w-0">
            <h1 className="pcx-font-size-8pt font-black uppercase tracking-tight leading-none">
              {companyInfo.name}
            </h1>
            <p className="pcx-font-size-5-5pt text-gray-600 mt-1 leading-snug">
              {companyInfo.address}
            </p>
            <p className="pcx-font-size-5-5pt text-gray-700">
              {companyInfo.email} | {companyInfo.phone}
            </p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="pcx-font-size-5-5pt text-gray-500 uppercase tracking-wider">
            Petty Cash
          </p>
          <p className="pcx-font-size-6-5pt font-bold whitespace-nowrap">{kode}</p>
        </div>
      </div>
      <div className="mt-2 text-center">
        <h2 className="inline-block border border-black bg-gray-100 px-6 py-1 pcx-font-size-7-5pt font-black uppercase tracking-wide">
          {isDeklarasi ? "Form Deklarasi" : "Form Pengajuan Kas/Bank Keluar"}
        </h2>
        <p className="pcx-font-size-5-5pt text-gray-600 mt-0.5">
          Petty Cash - {docTitle}
        </p>
      </div>
    </header>
  );

  const infoRow = (label: string, value: React.ReactNode) => (
    <div className="flex gap-1 min-w-0">
      <span className="pcx-width-42 flex-shrink-0 text-gray-600 uppercase pcx-font-size-5-5pt pcx-pt-1px">
        {label}
      </span>
      <span className="flex-shrink-0">:</span>
      <span className="font-semibold min-w-0 pcx-overflow-wrap-anywhere">
        {typeof value === "string" ? clamp(value, PRINT_LIMIT.info) || "-" : value || "-"}
      </span>
    </div>
  );

  // ---------- Blok info ----------
  const renderIntro = () =>
    isDeklarasi ? (
      <section className="mb-3 grid grid-cols-2 gap-x-6 gap-y-1 pcx-font-size-6pt">
        <div className="space-y-1">
          {infoRow("Tanggal", formatShortDate(createdAt))}
          {infoRow("FP No", fpNo)}
          {infoRow("No Deklarasi", kode)}
        </div>
        <div className="space-y-1">
          {infoRow("Dibuat Oleh", requesterName)}
          {infoRow("Divisi", department)}
          {infoRow("Site", site)}
          {references.map((r) => (
            <div key={r.label}>{infoRow(r.label, r.value)}</div>
          ))}
        </div>
        <div className="col-span-2">
          <div className="flex gap-1">
            <span className="pcx-width-21 flex-shrink-0 text-gray-600 uppercase pcx-font-size-5-5pt pcx-pt-1px">
              Keterangan
            </span>
            <span className="flex-shrink-0">:</span>
            <span className="font-semibold min-w-0 pcx-overflow-wrap-anywhere whitespace-pre-wrap">
              {plainNotes || "-"}
            </span>
          </div>
        </div>
      </section>
    ) : (
      <section className="mb-3 grid grid-cols-2 gap-x-6 gap-y-1 pcx-font-size-6pt">
        <div className="space-y-1">
          {infoRow("Nama PIC", requesterName)}
          {infoRow("Divisi Pengaju", department)}
          {infoRow("Site", site)}
          {infoRow("Alokasi Budget", budgetName)}
        </div>
        <div className="space-y-1">
          {infoRow("No", kode)}
          {infoRow("Date", formatShortDate(createdAt))}
          {showNeededDate &&
            infoRow(
              "Tgl Dibutuhkan",
              neededDate
                ? `${formatShortDate(neededDate)}${weekOfMonth ? ` (Minggu ke-${weekOfMonth})` : ""}`
                : null,
            )}
          {references.map((r) => (
            <div key={r.label}>{infoRow(r.label, r.value)}</div>
          ))}
        </div>
      </section>
    );

  // ---------- Tabel ----------
  const renderTableHead = () =>
    isDeklarasi ? (
      <tr>
        <th className={`${headCell} pcx-width-6`}>No</th>
        <th className={`${headCell} pcx-width-34`}>Keterangan</th>
        <th className={`${headCell} pcx-width-15`}>Uang Masuk (Rp)</th>
        <th className={`${headCell} pcx-width-15`}>Uang Keluar (Rp)</th>
        <th className={`${headCell} pcx-width-15`}>Saldo (Rp)</th>
        <th className={`${headCell} pcx-width-15`}>Note</th>
      </tr>
    ) : (
      <tr>
        <th className={`${headCell} pcx-width-5`}>No</th>
        <th className={`${headCell} pcx-width-22`}>Item</th>
        <th className={`${headCell} pcx-width-7`}>Company</th>
        <th className={`${headCell} pcx-width-12`}>COA</th>
        <th className={`${headCell} pcx-width-6`}>Qty</th>
        <th className={`${headCell} pcx-width-7`}>Satuan</th>
        <th className={`${headCell} pcx-width-12`}>Harga (Rp)</th>
        <th className={`${headCell} pcx-width-15`}>Jumlah (Rp)</th>
        <th className={`${headCell} pcx-width-14`}>Note</th>
      </tr>
    );

  const renderPengajuanRow = (
    item: PettyCashPengajuanItem,
    index: number,
    ref?: React.Ref<HTMLTableRowElement>,
  ) => (
    <tr key={index} ref={ref} className="break-inside-avoid">
      <td className={`${cell} text-center`}>{index + 1}</td>
      <td className={`${cell} font-medium`}>
        {clamp(item.part_name, PRINT_LIMIT.itemName)}
      </td>
      <td className={`${cell} text-center`}>{item.coa || "-"}</td>
      <td className={cell}>{item.category || "-"}</td>
      <td className={`${cell} text-center`}>{formatNumber(item.qty)}</td>
      <td className={`${cell} text-center pcx-overflow-wrap-anywhere`}>{item.uom || "-"}</td>
      <td className={`${cell} text-right whitespace-nowrap`}>
        {formatNumber(item.unit_price)}
      </td>
      <td className={`${cell} text-right whitespace-nowrap font-semibold`}>
        {formatNumber(item.subtotal)}
      </td>
      <td className={`${cell} pcx-font-size-5-5pt`}>
        {clamp(item.note, PRINT_LIMIT.itemNote)}
      </td>
    </tr>
  );

  const renderDeklarasiRow = (
    row: DeklarasiRow,
    index: number,
    ref?: React.Ref<HTMLTableRowElement>,
  ) => {
    const no = cashReceived != null ? index : index + 1;
    return (
      <tr key={index} ref={ref} className="break-inside-avoid">
        <td className={`${cell} text-center`}>
          {row.kind === "in" ? "" : no}
        </td>
        <td className={`${cell} pcx-overflow-wrap-anywhere`}>
          {row.kind === "in" ? (
            <span className="font-semibold">{row.label}</span>
          ) : (
            <>
              <span className="font-medium">
                {clamp(row.item.part_name, PRINT_LIMIT.itemName)}
              </span>
              <span className="pcx-font-size-5-5pt text-gray-600">
                {" "}
                ({formatNumber(row.item.qty)} {row.item.uom || ""} x{" "}
                {formatNumber(row.item.unit_price)})
              </span>
            </>
          )}
        </td>
        <td className={`${cell} text-right whitespace-nowrap`}>
          {row.kind === "in" ? formatNumber(row.amount) : ""}
        </td>
        <td className={`${cell} text-right whitespace-nowrap`}>
          {row.kind === "out" ? formatNumber(row.amount) : ""}
        </td>
        <td
          className={`${cell} text-right whitespace-nowrap font-semibold ${row.saldo < 0 ? "text-red-700" : ""}`}
        >
          {formatNumber(row.saldo)}
        </td>
        <td className={`${cell} pcx-font-size-5-5pt pcx-overflow-wrap-anywhere`}>
          {row.kind === "out" ? clamp(row.item.note, PRINT_LIMIT.itemNote) : ""}
        </td>
      </tr>
    );
  };

  // ---------- Tanda tangan ----------
  // Tabel berbingkai: baris 1 = label level (kolom berurutan dgn level sama
  // digabung jadi satu header), baris 2 = ruang tanda tangan / QR, baris 3 =
  // nama & departemen. Slot dibagi rata ke beberapa baris tabel kalau lebih
  // dari SIG_MAX_COLS.
  const sigRowCount = Math.ceil(signatures.length / SIG_MAX_COLS) || 1;
  const sigPerRow = Math.ceil(signatures.length / sigRowCount);
  const signatureRows: SignatureSlot[][] = [];
  for (let i = 0; i < signatures.length; i += sigPerRow) {
    signatureRows.push(signatures.slice(i, i + sigPerRow));
  }

  const groupByLabel = (row: SignatureSlot[]) =>
    row.reduce<{ label: string; span: number }[]>((groups, slot) => {
      const last = groups[groups.length - 1];
      if (last && last.label === slot.label) last.span += 1;
      else groups.push({ label: slot.label, span: 1 });
      return groups;
    }, []);

  const sigCell = "border border-black px-1 text-center align-middle";

  const renderSignSpace = (s: SignatureSlot) => {
    if (isWet) return null;
    if (s.qrValue === null) {
      return (
        <p className="pcx-font-size-5-5pt italic text-gray-400 leading-tight">
          Tanpa approval
        </p>
      );
    }
    return (
      <div className="flex flex-col items-center gap-0.5">
        {s.qrValue ? (
          <QRCodeSVG value={s.qrValue} size={44} level="M" />
        ) : (
          <Skeleton className="pcx-height-44px pcx-width-44px" />
        )}
        <p
          className={`pcx-font-size-5-5pt leading-tight font-semibold ${
            s.state === "done"
              ? "text-green-700"
              : s.state === "rejected"
                ? "text-red-700"
                : "text-gray-500"
          }`}
        >
          {s.state === "done"
            ? `✓ ${formatShortDate(s.date)}`
            : s.state === "rejected"
              ? "✕ Ditolak"
              : "Menunggu"}
        </p>
      </div>
    );
  };

  const renderSignatures = () => (
    <div className="mt-4 space-y-2 break-inside-avoid">
      {signatureRows.map((row, rowIndex) => (
        <table
          key={rowIndex}
          className="w-full table-fixed border-collapse pcx-font-size-6pt"
        >
          <colgroup>
            {row.map((s) => (
              <col key={s.key} style={{ width: `${100 / row.length}%` }} />
            ))}
          </colgroup>
          <tbody>
            <tr
              className="bg-gray-100"
              style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
            >
              {groupByLabel(row).map((g, i) => (
                <th
                  key={i}
                  colSpan={g.span}
                  className={`${sigCell} py-0.5 font-bold uppercase pcx-font-size-5-5pt tracking-wide leading-tight`}
                >
                  {g.label}
                </th>
              ))}
            </tr>
            <tr>
              {row.map((s) => (
                <td key={s.key} className={`${sigCell} pcx-height-20mm py-1`}>
                  {renderSignSpace(s)}
                </td>
              ))}
            </tr>
            <tr>
              {row.map((s) => (
                <td key={s.key} className={`${sigCell} py-0.5 align-top`}>
                  <p className="font-semibold leading-tight pcx-overflow-wrap-anywhere">
                    {clamp(s.name, PRINT_LIMIT.sigName)}
                  </p>
                  {s.subtitle && (
                    <p className="pcx-font-size-5-5pt text-gray-600 leading-tight pcx-overflow-wrap-anywhere">
                      {clamp(s.subtitle, PRINT_LIMIT.sigName)}
                    </p>
                  )}
                  {isWet && s.qrValue !== null && (
                    <p className="pcx-font-size-5-5pt text-gray-500 leading-tight text-left mt-0.5">
                      Tgl:
                    </p>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      ))}
    </div>
  );

  // ---------- Ringkasan saldo & riwayat penarikan (variant pengajuan) ----------
  // Sengaja ringkas: satu baris angka + satu baris daftar tarikan (inline,
  // bukan tabel per baris) supaya tidak memakan tempat walau tarikannya
  // banyak.
  const shortSvKode = (kode: string) => kode.match(/-(SV\d+)$/)?.[1] ?? kode;

  const renderPenarikanSummary = (summary: PcPenarikanSummary) => {
    const stat = (label: string, value: React.ReactNode, emphasize = false) => (
      <td
        className={`${cell} align-middle ${emphasize ? "pcx-total-row" : ""}`}
        style={
          emphasize
            ? { printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }
            : undefined
        }
      >
        <span className="block text-gray-600 uppercase pcx-font-size-5-5pt leading-tight">
          {label}
        </span>
        <span className="block font-bold whitespace-nowrap leading-tight">
          {value}
        </span>
      </td>
    );
    return (
      <table className="mt-2 w-full table-fixed border-collapse pcx-font-size-6pt">
        <tbody>
          <tr>
            {stat(`Nilai ${summary.basisLabel}`, formatRp(summary.nilai))}
            {stat(
              `Total Ditarik (${summary.penarikan.length}x)`,
              formatRp(summary.totalDitarik),
            )}
            {stat("Sisa Saldo", formatRp(summary.sisaSaldo), true)}
            {/* Nama budget tidak diulang - sudah ada di "Alokasi Budget". */}
            {stat(
              "Sisa Saldo Budget",
              summary.budgetRemaining != null
                ? formatRp(summary.budgetRemaining)
                : "-",
            )}
          </tr>
          <tr>
            <td colSpan={4} className={`${cell} pcx-font-size-5-5pt leading-snug`}>
              <span className="font-bold uppercase">Riwayat Penarikan</span>
              {summary.basisLabel === "Voucher" && summary.basisKode && (
                <span className="text-gray-600"> ({summary.basisKode})</span>
              )}
              <span className="font-bold">: </span>
              {summary.penarikan.length === 0 ? (
                <span className="italic text-gray-600">
                  Belum ada penarikan dana.
                </span>
              ) : (
                summary.penarikan.map((p, i) => (
                  <Fragment key={p.id}>
                    {/* Pemisah DI LUAR span nowrap - jadi titik patah baris
                        antar-tarikan. */}
                    {i > 0 && <span className="text-gray-400"> | </span>}
                    <span className="whitespace-nowrap">
                      <span className="font-semibold">
                        {i + 1}. {shortSvKode(p.kode)}
                      </span>{" "}
                      {formatShortDate(p.created_at)} - {formatRp(p.amount)}
                      <span className="text-gray-600">
                        {" "}
                        ({p.status === "Selesai" ? "Dibayar" : "Menunggu Bayar"})
                      </span>
                    </span>
                  </Fragment>
                ))
              )}
            </td>
          </tr>
        </tbody>
      </table>
    );
  };

  // ---------- Penutup ----------
  const totalPemakaian = items.reduce((sum, it) => sum + it.subtotal, 0);
  const sisa = received - totalPemakaian;

  const renderOutro = () =>
    isDeklarasi ? (
      <section className="break-inside-avoid">
        <div className="flex justify-end">
          <table className="pcx-width-60 border-collapse pcx-font-size-6pt -mt-px">
            <tbody>
              <tr>
                <td className={`${cell} text-right font-semibold w-1/2`}>
                  Total Pemakaian
                </td>
                <td className={`${cell} text-right font-bold whitespace-nowrap`}>
                  {formatRp(totalPemakaian)}
                </td>
              </tr>
              {cashReceived != null && (
                <tr>
                  <td className={`${cell} text-right font-semibold`}>
                    Sisa Pemakaian
                  </td>
                  <td
                    className={`${cell} text-right font-bold whitespace-nowrap ${sisa < 0 ? "text-red-700" : ""}`}
                  >
                    {formatRp(sisa)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {renderSignatures()}
      </section>
    ) : (
      <section className="break-inside-avoid">
        <table className="w-full border-collapse pcx-font-size-6pt -mt-px table-fixed">
          <tbody>
            {isMixedCoa &&
              Array.from(coaTotals.entries()).map(([coa, amount]) => (
                <tr key={coa}>
                  <td className={`${cell} text-right pcx-width-71`}>
                    Subtotal {coa}
                  </td>
                  <td className={`${cell} text-right whitespace-nowrap pcx-width-15`}>
                    {formatNumber(amount)}
                  </td>
                  <td className={cell} />
                </tr>
              ))}
            <tr
              className="pcx-total-row"
              style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
            >
              <td className={`${cell} text-right font-black uppercase pcx-width-71`}>
                Total
              </td>
              <td className={`${cell} text-right font-black whitespace-nowrap pcx-width-15`}>
                {formatRp(totalAmount)}
              </td>
              <td className={cell} />
            </tr>
          </tbody>
        </table>
        <div className="mt-2 pcx-font-size-5-5pt">
          <span className="font-bold uppercase">Catatan: </span>
          <span className="italic text-gray-700 whitespace-pre-wrap pcx-overflow-wrap-anywhere">
            {plainNotes || "Tidak ada catatan khusus."}
          </span>
        </div>
        {penarikanSummary && renderPenarikanSummary(penarikanSummary)}
        {renderSignatures()}
      </section>
    );

  const renderFooter = ({
    pageIndex,
    pageCount,
  }: {
    pageIndex: number;
    pageCount: number;
  }) => (
    <div className="pt-3">
      <div className="border-t border-gray-400 pt-1 flex justify-between gap-4 pcx-font-size-5-5pt text-gray-500 italic leading-tight">
        <p>
          {isWet
            ? "Dokumen ini dicetak dari sistem dan sah setelah ditandatangani oleh pihak-pihak di atas."
            : "Dokumen ini diterbitkan secara elektronik dan sah tanpa tanda tangan basah. Status persetujuan dapat diverifikasi dengan memindai kode QR pada kolom tanda tangan."}
        </p>
        <p className="whitespace-nowrap not-italic">
          {kode}
          {pageCount > 1 && ` | Hal. ${pageIndex + 1}/${pageCount}`}
        </p>
      </div>
    </div>
  );

  const common = {
    renderTableHead,
    renderHeader,
    renderFooter,
    renderIntro,
    renderOutro,
    enabled: printTrigger,
    tableClassName: "table-fixed pcx-font-size-6pt",
  };

  return (
    <>
      <style>{PRINT_CSS}</style>
      {isDeklarasi ? (
        <PaginatedPrintDocument
          {...common}
          rows={deklarasiRows}
          renderRow={renderDeklarasiRow}
        />
      ) : (
        <PaginatedPrintDocument
          {...common}
          rows={items}
          renderRow={renderPengajuanRow}
        />
      )}
    </>
  );
}
