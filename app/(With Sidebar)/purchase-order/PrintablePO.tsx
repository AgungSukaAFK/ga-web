// src/app/(With Sidebar)/purchase-order/PrintablePO.tsx
//
// Dokumen cetak Purchase Order (A4, multi halaman via PaginatedPrintDocument).
// Dipakai di detail PO (cetak resmi GMI/GIS) dan di Buat PO (cetak preview
// sebelum diajukan, `preview` = watermark PREVIEW + tanpa QR validasi).

"use client";

import { QRCodeCanvas } from "qrcode.react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDateFriendly } from "@/lib/utils";
import { extractPlainText } from "@/lib/rich-content";
import { COMPANY_DETAILS } from "@/lib/companyDetails";
import { POItem, PurchaseOrderDetail } from "@/type";
import { PaginatedPrintDocument } from "./[id]/PaginatedPrintDocument";

export type PrintVendorData = {
  name: string;
  address: string;
  contact: string;
  code: string;
};

/** Data vendor utk kop cetak dari `vendor_details` (format lama & baru). */
export const getPrintVendorData = (vendorDetails: unknown): PrintVendorData => {
  const details = vendorDetails as Record<string, string> | null | undefined;
  if (!details) return { name: "N/A", address: "N/A", contact: "N/A", code: "" };
  return {
    name: details.nama_vendor || details.name || "N/A",
    address: details.alamat || details.address || "N/A",
    contact: details.contact_person || details.cp || details.contact || "N/A",
    code: details.kode_vendor || "",
  };
};

export const PrintablePO = ({
  po,
  companyInfo,
  qrUrl,
  vendorData,
  printTrigger,
  preview = false,
}: {
  po: PurchaseOrderDetail;
  companyInfo: (typeof COMPANY_DETAILS)["DEFAULT"];
  qrUrl: string;
  vendorData: PrintVendorData;
  printTrigger: boolean;
  /** Cetak pratinjau (PO belum diajukan): watermark PREVIEW & tanpa QR validasi. */
  preview?: boolean;
}) => {
  const printSubtotal = po.items.reduce(
    (acc, item) => acc + item.price * item.qty,
    0,
  );
  const printDpp = printSubtotal - (po.discount || 0);
  const printPpnRate =
    po.ppn_rate != null
      ? po.ppn_rate
      : printDpp > 0 && po.tax > 0
        ? Math.round((po.tax / printDpp) * 100)
        : null;
  // Info PPN yang sudah termasuk harga item - sekadar informasi di cetak,
  // TIDAK ditambahkan ke Grand Total (lihat catatan sama di halaman detail).
  const printIncludedTaxInfo =
    po.tax_included && printPpnRate != null
      ? printSubtotal * (printPpnRate / 100)
      : null;

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
          Purchase Order
        </h2>
        <div className="mt-2">
          <p className="text-base font-bold text-gray-900">{po.kode_po}</p>
          <p className="text-xs text-gray-500">
            Tgl: {formatDateFriendly(po.created_at)}
          </p>
        </div>
      </div>
    </header>
  );

  const renderIntro = () => (
    <section className="flex gap-6 mb-8">
      <div className="w-1/2 border border-gray-300 rounded-sm">
        <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-300">
          <h3 className="font-bold text-[10px] uppercase tracking-wider text-gray-600">
            Vendor (Supplier)
          </h3>
        </div>
        <div className="p-3">
          <p className="font-bold text-base text-gray-900">
            {vendorData.name}
          </p>
          {vendorData.code && (
            <p className="text-[10px] font-mono text-gray-500 mb-1">
              ID: {vendorData.code}
            </p>
          )}
          <p className="text-xs mt-1 text-gray-700 leading-relaxed whitespace-pre-line">
            {vendorData.address}
          </p>
          <div className="mt-3 pt-2 border-t border-dashed border-gray-200 flex flex-col gap-0.5">
            <p className="text-xs">
              <span className="text-gray-500">UP:</span> {vendorData.contact}
            </p>
          </div>
        </div>
      </div>
      <div className="w-1/2 border border-gray-300 rounded-sm">
        <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-300">
          <h3 className="font-bold text-[10px] uppercase tracking-wider text-gray-600">
            Kirim Ke (Ship To)
          </h3>
        </div>
        <div className="p-3">
          <p className="font-bold text-base text-gray-900">
            {companyInfo.name}
          </p>
          <p className="text-xs mt-1 text-gray-700 leading-relaxed whitespace-pre-line">
            {po.shipping_address}
          </p>
          <div className="mt-3 pt-2 border-t border-dashed border-gray-200">
            <p className="text-xs font-mono text-gray-500">
              Ref MR: {po.material_requests?.kode_mr || "-"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );

  const renderTableHead = () => (
    <tr className="bg-gray-50">
      <th className="py-2 px-2 text-left font-bold text-gray-700 w-[5%] border-b border-gray-300 whitespace-nowrap">
        No
      </th>
      <th className="py-2 px-2 text-left font-bold text-gray-700 w-[30%] border-b border-gray-300 whitespace-nowrap">
        Deskripsi Barang
      </th>
      <th className="py-2 px-2 text-left font-bold text-gray-700 w-[17%] border-b border-gray-300 whitespace-nowrap">
        Part Number
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
    item: POItem,
    index: number,
    ref?: React.Ref<HTMLTableRowElement>,
  ) => (
    <tr key={index} ref={ref} className="border-b border-gray-200 last:border-0">
      <td className="py-3 px-2 text-left align-top text-gray-600">
        {index + 1}
      </td>
      <td className="py-3 px-2 text-left align-top font-medium text-gray-900 break-words whitespace-normal">
        {item.name}
      </td>
      <td className="py-3 px-2 text-left align-top font-mono text-[10px] text-gray-600 break-all">
        {item.part_number}
      </td>
      <td className="py-3 px-2 text-center align-top text-gray-900">
        {item.qty}
      </td>
      <td className="py-3 px-2 text-center align-top text-gray-600">
        {item.uom}
      </td>
      <td className="py-3 px-2 text-right align-top whitespace-nowrap text-gray-900">
        {formatCurrency(item.price)}
      </td>
      <td className="py-3 px-2 text-right align-top whitespace-nowrap font-semibold text-gray-900 bg-gray-50">
        {formatCurrency(item.total_price || item.price * item.qty)}
      </td>
    </tr>
  );

  const renderOutro = () => (
    <section className="flex gap-10 break-inside-avoid items-start">
      <div className="flex-1 space-y-4">
        <div className="space-y-1">
          <h4 className="font-bold text-xs text-gray-900 uppercase border-b border-gray-300 pb-1 inline-block">
            Catatan / Notes:
          </h4>
          <p className="text-xs italic text-gray-600 whitespace-pre-wrap leading-relaxed pt-1">
            {extractPlainText(po.notes) || "Tidak ada catatan khusus."}
          </p>
        </div>
        <div className="space-y-1">
          <h4 className="font-bold text-xs text-gray-900 uppercase border-b border-gray-300 pb-1 inline-block">
            Syarat Pembayaran:
          </h4>
          <p className="text-xs font-medium text-gray-800 pt-1">
            {po.payment_term}
          </p>
        </div>
      </div>
      <div className="w-[40%]">
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium text-gray-900">
              {formatCurrency(printSubtotal)}
            </span>
          </div>
          {po.discount > 0 && (
            <div className="flex justify-between text-xs text-red-600">
              <span>Diskon</span>
              <span>- {formatCurrency(po.discount)}</span>
            </div>
          )}
          {(po.pph_amount || 0) > 0 && (
            <div className="flex justify-between text-xs text-red-600">
              <span>PPH ({po.pph_rate}%)</span>
              <span>- {formatCurrency(po.pph_amount || 0)}</span>
            </div>
          )}
          {po.tax > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">
                Pajak (PPN{printPpnRate ? ` ${printPpnRate}%` : ""})
              </span>
              <span className="font-medium text-gray-900">
                + {formatCurrency(po.tax)}
              </span>
            </div>
          )}
          {po.tax === 0 && po.tax_included && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">
                PPN
                {printPpnRate != null ? ` ${printPpnRate}%` : ""} (sudah
                termasuk harga)
              </span>
              <span className="font-medium text-gray-900">
                {printIncludedTaxInfo != null
                  ? formatCurrency(printIncludedTaxInfo)
                  : "-"}
              </span>
            </div>
          )}
          {po.tax === 0 && !po.tax_included && po.ppn_rate === 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">PPN</span>
              <span className="text-gray-600">
                Tidak ada (pembelian marketplace)
              </span>
            </div>
          )}
          <div className="flex justify-between text-xs pb-2 border-b border-gray-300">
            <span className="text-gray-600">Ongkos Kirim</span>
            <span className="font-medium text-gray-900">
              + {formatCurrency(po.postage)}
            </span>
          </div>
          <div className="flex justify-between items-center bg-gray-900 text-white px-3 py-2 rounded-sm mt-1 print:bg-gray-200 print:text-black print:border print:border-black">
            <span className="font-bold text-xs uppercase tracking-wider">
              Grand Total
            </span>
            <span className="font-black text-base">
              {formatCurrency(po.total_price)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );

  const renderFooter = ({
    pageIndex,
    pageCount,
  }: {
    pageIndex: number;
    pageCount: number;
  }) => (
    <div className="pt-12 break-inside-avoid">
      <div className="border-t-2 border-black pt-4 flex flex-col items-center text-center">
        {preview ? (
          <>
            <p className="text-[10px] font-bold uppercase text-gray-500 tracking-widest">
              Preview - Belum Diajukan
            </p>
            <p className="text-[10px] text-gray-500 italic max-w-xl leading-tight mt-1">
              Dokumen ini hanya pratinjau dari form Buat PO dan BUKAN dokumen
              resmi. Nomor PO, harga, dan isi lainnya masih bisa berubah sampai
              PO diajukan dan disetujui.
            </p>
          </>
        ) : (
          <>
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
          </>
        )}
        <p className="text-[9px] text-gray-400 mt-1">
          Dicetak oleh {po.users_with_profiles?.nama || "System"} pada{" "}
          {new Date().toLocaleString("id-ID")}
        </p>
        <p className="text-[9px] text-gray-400">
          Halaman {pageIndex + 1} dari {pageCount}
        </p>
      </div>
    </div>
  );

  return (
    <PaginatedPrintDocument
      rows={po.items}
      renderRow={renderRow}
      renderTableHead={renderTableHead}
      renderHeader={renderHeader}
      renderFooter={renderFooter}
      renderIntro={renderIntro}
      renderOutro={renderOutro}
      enabled={printTrigger}
      tableClassName="table-fixed border-y-2 border-black"
      watermark={preview ? "PREVIEW" : undefined}
    />
  );
};
