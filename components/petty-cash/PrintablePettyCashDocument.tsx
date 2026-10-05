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
// Kolom tanda tangan (signatureMode "qr", default) berisi kode QR per slot (pembuat + tiap
// approver): QR mengarah ke halaman verifikasi /approval-pc-*/[id]?step=N,
// yang mengarahkan pemindai sesuai perannya (approver yang belum approve ->
// langsung ke halaman approval, dst - lihat usePcVerifyAccess). Mode "wet"
// mengganti QR dengan ruang kosong utk tanda tangan basah.

"use client";

import { QRCodeSVG } from "qrcode.react";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginatedPrintDocument } from "@/app/(With Sidebar)/purchase-order/[id]/PaginatedPrintDocument";
import { getCompanyDetails } from "@/lib/companyDetails";
import { extractPlainText } from "@/lib/rich-content";
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
  // Slot tanda tangan tambahan setelah approver (mis. "Dibayar Oleh"
  // Finance di Sub-Voucher yang tidak punya jalur approval sendiri).
  extraSignatures?: Omit<PcPrintSignature, "step">[];
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
const PRINT_CSS = `#printable-po-a4 .pcx-font-size-5-5pt{font-size:5.5pt}#printable-po-a4 .pcx-font-size-6-5pt{font-size:6.5pt}#printable-po-a4 .pcx-font-size-6pt{font-size:6pt}#printable-po-a4 .pcx-font-size-7-5pt{font-size:7.5pt}#printable-po-a4 .pcx-font-size-8pt{font-size:8pt}#printable-po-a4 .pcx-height-16mm{height:16mm}#printable-po-a4 .pcx-height-48px{height:48px}#printable-po-a4 .pcx-height-50px{height:50px}#printable-po-a4 .pcx-overflow-wrap-anywhere{overflow-wrap:anywhere}#printable-po-a4 .pcx-width-14{width:14%}#printable-po-a4 .pcx-width-15{width:15%}#printable-po-a4 .pcx-width-21{width:21%}#printable-po-a4 .pcx-width-29{width:29%}#printable-po-a4 .pcx-width-34{width:34%}#printable-po-a4 .pcx-width-42{width:42%}#printable-po-a4 .pcx-width-48px{width:48px}#printable-po-a4 .pcx-width-5{width:5%}#printable-po-a4 .pcx-width-6{width:6%}#printable-po-a4 .pcx-width-60{width:60%}#printable-po-a4 .pcx-width-7{width:7%}#printable-po-a4 .pcx-width-71{width:71%}#printable-po-a4 .pcx-width-85{width:85%}#printable-po-a4 .pcx-width-9{width:9%}#printable-po-a4 .pcx-width-90px{width:90px}#printable-po-a4 .pcx-total-row{background:#fef08a}#printable-po-a4 .pcx-row-gap-3{row-gap:0.75rem}#printable-po-a4 .pcx-pt-1px{padding-top:1px}`;

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

// Label slot approver mengikuti form kertas: approver pertama memeriksa,
// tengah mengetahui, terakhir menyetujui.
const approverLabel = (index: number, count: number, deklarasi: boolean) => {
  if (index === count - 1) return deklarasi ? "Approve" : "Disetujui Oleh";
  if (index === 0) return "Diperiksa Oleh";
  return "Diketahui Oleh";
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
  extraSignatures = [],
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
  const signatures: PcPrintSignature[] = [
    {
      label: isDeklarasi ? "Dibuat Oleh" : "Diajukan Oleh",
      name: requesterName || "-",
      subtitle: department,
      state: "done",
      date: createdAt,
      step: 0,
    },
    ...approverList.map((a, i) => ({
      label: approverLabel(i, approverList.length, isDeklarasi),
      name: a.nama,
      subtitle: a.department,
      state:
        a.status === "approved"
          ? ("done" as const)
          : a.status === "rejected"
            ? ("rejected" as const)
            : ("pending" as const),
      date: a.processed_at,
      step: i + 1,
    })),
    ...extraSignatures.map((s, i) => ({
      ...s,
      step: approverList.length + 1 + i,
    })),
  ];
  // Maks 5 slot per baris supaya QR & nama tetap terbaca di A4 portrait.
  const sigCols = Math.min(Math.max(signatures.length, 3), 5);

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
        <th className={`${headCell} pcx-width-29`}>Item</th>
        <th className={`${headCell} pcx-width-7`}>COA</th>
        <th className={`${headCell} pcx-width-7`}>Qty</th>
        <th className={`${headCell} pcx-width-9`}>Satuan</th>
        <th className={`${headCell} pcx-width-14`}>Harga (Rp)</th>
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

  // ---------- Tanda tangan (QR) ----------
  const renderSignatures = () => (
    <div
      className="grid gap-x-3 pcx-row-gap-3 mt-4 break-inside-avoid"
      style={{ gridTemplateColumns: `repeat(${sigCols}, minmax(0, 1fr))` }}
    >
      {signatures.map((s) =>
        isWet ? (
          // Format form kertas: label, ruang tanda tangan, garis, nama,
          // departemen.
          <div
            key={s.step}
            className="flex flex-col items-center text-center min-w-0"
          >
            <p className="pcx-font-size-6pt font-semibold leading-tight">
              {s.label}
            </p>
            <div className="pcx-height-16mm w-full" />
            <div className="pcx-width-85 border-b border-black" />
            <p className="mt-0.5 pcx-font-size-6pt font-semibold leading-tight pcx-overflow-wrap-anywhere">
              {clamp(s.name, PRINT_LIMIT.sigName)}
            </p>
            {s.subtitle && (
              <p className="pcx-font-size-5-5pt text-gray-700 leading-tight pcx-overflow-wrap-anywhere">
                {clamp(s.subtitle, PRINT_LIMIT.sigName)}
              </p>
            )}
          </div>
        ) : (
          <div
            key={s.step}
            className="flex flex-col items-center text-center min-w-0"
          >
            <p className="pcx-font-size-6pt font-semibold leading-tight">
              {s.label}
            </p>
            <div className="my-1 p-0.5 border border-gray-400">
              {qrUrl ? (
                <QRCodeSVG
                  value={buildStepUrl(qrUrl, s.step)}
                  size={48}
                  level="M"
                />
              ) : (
                <Skeleton className="pcx-height-48px pcx-width-48px" />
              )}
            </div>
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
            <div className="mt-0.5 pcx-width-85 border-b border-black" />
            <p className="mt-0.5 pcx-font-size-6pt font-semibold leading-tight pcx-overflow-wrap-anywhere">
              {clamp(s.name, PRINT_LIMIT.sigName)}
            </p>
            {s.subtitle && (
              <p className="pcx-font-size-5-5pt text-gray-700 leading-tight pcx-overflow-wrap-anywhere">
                {clamp(s.subtitle, PRINT_LIMIT.sigName)}
              </p>
            )}
          </div>
        ),
      )}
    </div>
  );

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
                    Subtotal COA {coa}
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
