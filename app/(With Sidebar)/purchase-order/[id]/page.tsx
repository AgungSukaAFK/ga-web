// src/app/(With Sidebar)/purchase-order/[id]/page.tsx

"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { fetchPurchaseOrderById } from "@/services/purchaseOrderService";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  CircleUser,
  Download,
  Edit,
  Printer,
  Repeat,
  Truck,
  Wallet,
} from "lucide-react";
import { AlertTriangle } from "lucide-react";
import { PurchaseOrderDetail } from "@/type";

export default function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: poIdString } = use(params);

  const [po, setPo] = useState<PurchaseOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const poId = parseInt(poIdString);
    if (isNaN(poId)) {
      toast.error("ID Purchase Order tidak valid.");
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchPurchaseOrderById(poId)
      .then((data) => setPo(data))
      .catch((err) => {
        toast.error("Gagal memuat detail PO", { description: err.message });
        setPo(null);
      })
      .finally(() => setLoading(false));
  }, [poIdString]);

  const handlePrintA4 = () => {
    window.print();
  };

  if (loading) {
    return (
      <>
        <Content className="col-span-12 lg:col-span-8">
          <Skeleton className="h-64 w-full" />
        </Content>
        <Content className="col-span-12 lg:col-span-4">
          <Skeleton className="h-64 w-full" />
        </Content>
      </>
    );
  }

  if (!po) {
    return (
      <Content className="col-span-12">
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
          <h1 className="text-2xl font-bold">Data PO Tidak Ditemukan</h1>
          <p className="text-muted-foreground">
            Purchase Order dengan ID ini mungkin telah dihapus atau tidak ada.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/purchase-order">Kembali ke Daftar PO</Link>
          </Button>
        </div>
      </Content>
    );
  }

  const subtotal = po.items.reduce((acc, item) => acc + item.total_price, 0);

  return (
    <>
      {/* ================================================================== */}
      {/* BAGIAN 1: TAMPILAN UNTUK LAYAR (MENGGUNAKAN <Content>) */}
      {/* ================================================================== */}
      <div className="col-span-12 no-print">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold">{po.kode_po}</h1>
            <p className="text-muted-foreground">
              {po.material_requests && (
                <>
                  Ref. MR:{" "}
                  <Link
                    href={`/material-request/${po.mr_id}`}
                    className="text-primary hover:underline"
                  >
                    {po.material_requests.kode_mr}
                  </Link>
                </>
              )}
              {po.repeated_from_po_id && (
                <>
                  Repeat dari:{" "}
                  <Link
                    href={`/purchase-order/${po.repeated_from_po_id}`}
                    className="text-primary hover:underline"
                  >
                    PO #{po.repeated_from_po_id}
                  </Link>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={po.status === "Draft" ? "secondary" : "outline"}>
              {po.status}
            </Badge>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/purchase-order/edit/${po.id}`}>
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/purchase-order/create?repeatPoId=${po.id}`}>
                  <Repeat className="mr-2 h-4 w-4" /> Repeat Order
                </Link>
              </Button>
              <Button onClick={handlePrintA4} variant="outline" size="sm">
                <Printer className="mr-2 h-4 w-4" /> Cetak A4
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Content
        title="Detail Item Pesanan"
        className="col-span-12 lg:col-span-8 no-print"
      >
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part Number</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Harga Satuan</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-mono text-xs">
                    {item.part_number}
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-right">
                    {item.qty} {item.uom}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.price)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.total_price)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Content>

      <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 no-print">
        <Content title="Vendor Utama & Pengiriman">
          <div className="space-y-3">
            <InfoItem
              icon={CircleUser}
              label="Vendor Utama"
              value={po.vendor_details?.name || "N/A"}
            />
            <InfoItem
              icon={CircleUser}
              label="Kontak Person"
              value={po.vendor_details?.contact_person || "N/A"}
            />
            <InfoItem
              icon={CircleUser}
              label="Alamat Vendor"
              value={po.vendor_details?.address || "N/A"}
            />
            <hr />
            <InfoItem
              icon={Truck}
              label="Alamat Pengiriman"
              value={po.shipping_address}
            />
            <InfoItem
              icon={Wallet}
              label="Payment Term"
              value={po.payment_term}
            />
          </div>
        </Content>
        <Content title="Ringkasan Biaya">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Diskon</span>
              <span>- {formatCurrency(po.discount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Pajak (PPN)</span>
              <span>+ {formatCurrency(po.tax)}</span>
            </div>
            <div className="flex justify-between">
              <span>Ongkos Kirim</span>
              <span>+ {formatCurrency(po.postage)}</span>
            </div>
            <hr className="my-2" />
            <div className="flex justify-between font-bold text-base">
              <span>Grand Total</span>
              <span>{formatCurrency(po.total_price)}</span>
            </div>
          </div>
        </Content>
      </div>

      <Content title="Catatan & Lampiran" className="col-span-12 no-print">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold mb-2">Catatan Internal</h4>
            <p className="text-sm text-muted-foreground">
              {po.notes || "Tidak ada catatan."}
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Lampiran PO</h4>
            {po.attachments && po.attachments.length > 0 ? (
              <ul className="space-y-2">
                {po.attachments.map((att, index) => (
                  <li key={index}>
                    <a
                      href={`https://xdkjqwpvmyqcggpwghyi.supabase.co/storage/v1/object/public/mr/${att.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Download className="h-4 w-4" />
                      <span>{att.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Tidak ada lampiran.
              </p>
            )}
          </div>
        </div>
      </Content>

      <div id="printable-po-a4" className="print-only col-span-12">
        <header className="flex justify-between items-start pb-4 border-b border-gray-300">
          <div>
            <h1 className="text-xl font-bold">Garuda Mart Indonesia</h1>
            <p className="text-xs">Sakura Regency Blok J5-8A</p>
            <p className="text-xs">Jatiasih, Bekasi 17423 - Indonesia</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-gray-800">PURCHASE ORDER</h2>
            <p className="mt-1">
              <b>No. PO:</b> {po.kode_po}
            </p>
            <p>
              <b>Tanggal:</b> {formatDate(po.created_at)}
            </p>
            {po.material_requests && (
              <p>
                <b>Ref. MR:</b> {po.material_requests.kode_mr}
              </p>
            )}
          </div>
        </header>

        <section className="grid grid-cols-2 gap-8 mt-6 text-xs">
          <div className="space-y-1">
            <h3 className="font-semibold text-gray-500 mb-1">VENDOR</h3>
            <p className="font-bold">{po.vendor_details?.name || "N/A"}</p>
            <p>{po.vendor_details?.contact_person}</p>
            <p className="whitespace-pre-wrap">{po.vendor_details?.address}</p>
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-gray-500 mb-1">KIRIM KE</h3>
            {/* <p className="font-bold">GMI Gudang Pusat</p> */}
            <p className="whitespace-pre-wrap">{po.shipping_address}</p>
          </div>
        </section>

        <section className="mt-8">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 w-8">No.</th>
                <th className="p-2 w-1/4">Part Number</th>
                <th className="p-2">Deskripsi Barang</th>
                <th className="p-2 text-right">Qty</th>
                <th className="p-2 text-right">Harga Satuan</th>
                <th className="p-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((item, index) => (
                <tr key={index} className="border-b border-gray-200">
                  <td className="p-2 align-top">{index + 1}</td>
                  <td className="p-2 align-top font-mono">
                    {item.part_number}
                  </td>
                  <td className="p-2 align-top">{item.name}</td>
                  <td className="p-2 text-right align-top">
                    {item.qty} {item.uom}
                  </td>
                  <td className="p-2 text-right align-top">
                    {formatCurrency(item.price)}
                  </td>
                  <td className="p-2 text-right align-top font-semibold">
                    {formatCurrency(item.total_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="flex justify-end mt-6">
          <div className="w-2/5 space-y-2 text-xs">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Diskon</span>
              <span>- {formatCurrency(po.discount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Pajak (PPN)</span>
              <span>+ {formatCurrency(po.tax)}</span>
            </div>
            <div className="flex justify-between">
              <span>Ongkos Kirim</span>
              <span>+ {formatCurrency(po.postage)}</span>
            </div>
            <hr className="my-1 border-t-2 border-black" />
            <div className="flex justify-between text-sm font-bold">
              <span>GRAND TOTAL</span>
              <span>{formatCurrency(po.total_price)}</span>
            </div>
          </div>
        </section>

        <footer className="mt-12 space-y-8 text-xs">
          <div>
            <h3 className="font-semibold">Catatan:</h3>
            <p>{po.notes || "Tidak ada catatan tambahan."}</p>
            <p className="mt-2">
              <b>Payment Term:</b> {po.payment_term}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 pt-24 text-center">
            <div>
              <p className="font-semibold">Dibuat oleh,</p>
              <div className="mt-20 border-b border-gray-400 pb-1">
                {po.users_with_profiles?.nama || ""}
              </div>
              <p className="text-[10px]">Purchasing Staff</p>
            </div>
            <div>
              <p className="font-semibold">Tanda Tangan & Stempel Vendor,</p>
              <div className="mt-20 border-b border-gray-400"></div>
              <p className="text-[10px]">({po.vendor_details?.name || ""})</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

const InfoItem = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) => (
  <div className="flex items-start gap-3">
    <Icon className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-sm whitespace-pre-wrap">{value}</p>
    </div>
  </div>
);
