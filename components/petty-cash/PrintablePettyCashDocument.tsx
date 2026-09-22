// src/components/petty-cash/PrintablePettyCashDocument.tsx
//
// Dokumen cetak Petty Cash (Input Pengajuan/Pengajuan Voucher/Deklarasi) -
// sama format & mekanismenya dengan PrintablePO
// (purchase-order/[id]/page.tsx): pagination custom via
// PaginatedPrintDocument (ukur tinggi render dulu di context layar biasa,
// baru dipecah ke beberapa halaman A4 - lihat komentar di file itu utk
// alasan lengkapnya), kop company dari COMPANY_DETAILS
// (lib/companyDetails.ts), dan footer QR "Digital Validation" - TIDAK ada
// kolom tanda tangan basah, validasi murni lewat scan QR ke halaman publik
// /approval-pc-*/[id].

"use client";

import { QRCodeCanvas } from "qrcode.react";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginatedPrintDocument } from "@/app/(With Sidebar)/purchase-order/[id]/PaginatedPrintDocument";
import { getCompanyDetails } from "@/lib/companyDetails";
import { PettyCashPengajuanItem } from "@/type";
import { formatCurrency, formatDateFriendly } from "@/lib/utils";

interface PrintablePettyCashDocumentProps {
  docTitle: string; // "Input Pengajuan" | "Pengajuan Voucher" | "Deklarasi"
  kode: string;
  companyCode: string;
  createdAt: string | Date;
  requesterName?: string | null;
  department: string;
  site?: string | null;
  neededDate?: string | Date | null;
  weekOfMonth?: number | null;
  showNeededDate?: boolean;
  notes: string | null;
  items: PettyCashPengajuanItem[];
  totalAmount: number;
  qrUrl: string;
  printTrigger: boolean;
}

export function PrintablePettyCashDocument({
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
  notes,
  items,
  totalAmount,
  qrUrl,
  printTrigger,
}: PrintablePettyCashDocumentProps) {
  const companyInfo = getCompanyDetails(companyCode);
  const isMixedCoa = new Set(items.map((it) => it.coa ?? "-")).size > 1;

  const coaTotals = new Map<string, number>();
  for (const it of items) {
    const key = it.coa ?? "-";
    coaTotals.set(key, (coaTotals.get(key) ?? 0) + it.subtotal);
  }

  const renderHeader = () => (
    <header className="flex justify-between items-start border-b-2 border-black pb-6 mb-6">
      <div className="flex items-center gap-6 w-2/3">
        <div className="w-[120px] h-[70px] relative flex-shrink-0 flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={companyInfo.logo}
            alt="Logo"
            className="w-full h-full object-contain object-left"
          />
        </div>
        <div>
          <h1 className="text-xl font-black uppercase tracking-tight text-gray-900 leading-none">
            {companyInfo.name}
          </h1>
          <p className="text-xs text-gray-600 mt-1.5 leading-snug max-w-sm">
            {companyInfo.address}
          </p>
          <p className="text-xs font-medium text-gray-800 mt-1">
            {companyInfo.email} | {companyInfo.phone}
          </p>
        </div>
      </div>
      <div className="text-right w-1/3">
        <h2 className="text-xl font-black text-gray-800 tracking-wide uppercase">
          Petty Cash - {docTitle}
        </h2>
        <div className="mt-2">
          <p className="text-base font-bold text-gray-900">{kode}</p>
          <p className="text-xs text-gray-500">
            Tgl: {formatDateFriendly(createdAt)}
          </p>
        </div>
      </div>
    </header>
  );

  const renderIntro = () => (
    <section className="mb-8 border border-gray-300 rounded-sm">
      <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-300">
        <h3 className="font-bold text-[10px] uppercase tracking-wider text-gray-600">
          Informasi Pemohon
        </h3>
      </div>
      <div className="p-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
        <p>
          <span className="text-gray-500">Pemohon:</span>{" "}
          <span className="font-semibold text-gray-900">
            {requesterName || "-"}
          </span>
        </p>
        <p>
          <span className="text-gray-500">Departemen:</span>{" "}
          <span className="font-semibold text-gray-900">{department}</span>
        </p>
        <p>
          <span className="text-gray-500">Site:</span>{" "}
          <span className="font-semibold text-gray-900">{site || "-"}</span>
        </p>
        {showNeededDate && (
          <>
            <p>
              <span className="text-gray-500">Tanggal Dibutuhkan:</span>{" "}
              <span className="font-semibold text-gray-900">
                {neededDate ? formatDateFriendly(neededDate) : "-"}
              </span>
            </p>
            <p>
              <span className="text-gray-500">Minggu ke-:</span>{" "}
              <span className="font-semibold text-gray-900">
                {weekOfMonth ?? "-"}
              </span>
            </p>
          </>
        )}
      </div>
    </section>
  );

  const renderTableHead = () => (
    <tr className="bg-gray-50">
      <th className="py-2 px-2 text-left font-bold text-gray-700 w-[5%] border-b border-gray-300 whitespace-nowrap">
        No
      </th>
      <th className="py-2 px-2 text-left font-bold text-gray-700 w-[30%] border-b border-gray-300 whitespace-nowrap">
        Nama Barang
      </th>
      <th className="py-2 px-2 text-center font-bold text-gray-700 w-[10%] border-b border-gray-300 whitespace-nowrap">
        COA
      </th>
      <th className="py-2 px-2 text-center font-bold text-gray-700 w-[8%] border-b border-gray-300 whitespace-nowrap">
        Qty
      </th>
      <th className="py-2 px-2 text-center font-bold text-gray-700 w-[10%] border-b border-gray-300 whitespace-nowrap">
        Satuan
      </th>
      <th className="py-2 px-2 text-right font-bold text-gray-700 w-[15%] border-b border-gray-300 whitespace-nowrap">
        Harga (@)
      </th>
      <th className="py-2 px-2 text-right font-bold text-gray-700 w-[15%] border-b border-gray-300 whitespace-nowrap">
        Total
      </th>
    </tr>
  );

  const renderRow = (
    item: PettyCashPengajuanItem,
    index: number,
    ref?: React.Ref<HTMLTableRowElement>,
  ) => (
    <tr key={index} ref={ref} className="border-b border-gray-200 last:border-0">
      <td className="py-3 px-2 text-left align-top text-gray-600">
        {index + 1}
      </td>
      <td className="py-3 px-2 text-left align-top font-medium text-gray-900 break-words whitespace-normal">
        {item.part_name}
        {item.note && (
          <div className="text-[10px] text-gray-500 italic">{item.note}</div>
        )}
      </td>
      <td className="py-3 px-2 text-center align-top text-gray-700">
        {item.coa || "-"}
      </td>
      <td className="py-3 px-2 text-center align-top text-gray-900">
        {item.qty}
      </td>
      <td className="py-3 px-2 text-center align-top text-gray-600">
        {item.uom}
      </td>
      <td className="py-3 px-2 text-right align-top whitespace-nowrap text-gray-900">
        {formatCurrency(item.unit_price)}
      </td>
      <td className="py-3 px-2 text-right align-top whitespace-nowrap font-semibold text-gray-900 bg-gray-50">
        {formatCurrency(item.subtotal)}
      </td>
    </tr>
  );

  const renderOutro = () => (
    <section className="flex gap-10 break-inside-avoid items-start">
      <div className="flex-1 space-y-4">
        <div className="space-y-1">
          <h4 className="font-bold text-xs text-gray-900 uppercase border-b border-gray-300 pb-1 inline-block">
            Catatan:
          </h4>
          <p className="text-xs italic text-gray-600 whitespace-pre-wrap leading-relaxed pt-1">
            {notes || "Tidak ada catatan khusus."}
          </p>
        </div>
      </div>
      <div className="w-[40%]">
        <div className="space-y-2">
          {isMixedCoa &&
            Array.from(coaTotals.entries()).map(([coa, amount]) => (
              <div key={coa} className="flex justify-between text-xs">
                <span className="text-gray-600">Subtotal COA {coa}</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(amount)}
                </span>
              </div>
            ))}
          <div className="flex justify-between items-center bg-gray-900 text-white px-3 py-2 rounded-sm mt-1 print:bg-gray-200 print:text-black print:border print:border-black">
            <span className="font-bold text-xs uppercase tracking-wider">
              Grand Total
            </span>
            <span className="font-black text-base">
              {formatCurrency(totalAmount)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );

  const renderFooter = () => (
    <div className="pt-12 break-inside-avoid">
      <div className="border-t-2 border-black pt-4 flex flex-col items-center text-center">
        <div className="flex items-center gap-4 mb-2">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">
              Digital Validation
            </p>
            <p className="text-[9px] text-gray-400">Scan to verify</p>
          </div>
          {qrUrl ? (
            <div className="p-1 border border-gray-800 rounded-md">
              <QRCodeCanvas value={qrUrl} size={60} />
            </div>
          ) : (
            <Skeleton className="h-[60px] w-[60px]" />
          )}
          <div className="text-left">
            <p className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">
              Approved By System
            </p>
            <p className="text-[9px] text-gray-400">Garuda Procure System</p>
          </div>
        </div>
        <p className="text-[10px] text-gray-500 italic max-w-xl leading-tight">
          Dokumen ini diterbitkan secara elektronik oleh sistem Garuda Procure
          dan sah tanpa tanda tangan basah. Status persetujuan dapat
          diverifikasi melalui pemindaian kode QR di atas.
        </p>
      </div>
    </div>
  );

  return (
    <PaginatedPrintDocument
      rows={items}
      renderRow={renderRow}
      renderTableHead={renderTableHead}
      renderHeader={renderHeader}
      renderFooter={renderFooter}
      renderIntro={renderIntro}
      renderOutro={renderOutro}
      enabled={printTrigger}
      tableClassName="table-fixed"
    />
  );
}
