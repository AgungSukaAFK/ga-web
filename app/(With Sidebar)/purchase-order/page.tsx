// src/app/(With Sidebar)/purchase-order/page.tsx

"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  fetchPurchaseOrders,
  PurchaseOrderListItem,
} from "@/services/purchaseOrderService";
import { PaginationComponent } from "@/components/pagination-components";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CreatePOModal } from "./CreatePOModal";
import { FileText, Newspaper, Printer, Search } from "lucide-react";

const ITEMS_PER_PAGE = 10;

// ==================================================================
// KOMPONEN ANAK YANG BERISI SEMUA LOGIKA
// ==================================================================
function PurchaseOrderPageContent() {
  const [dataPO, setDataPO] = useState<PurchaseOrderListItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = searchParams.get("page") || "1";
  const search = searchParams.get("search");
  const currentPage = parseInt(page, 10);

  useEffect(() => {
    setLoading(true);
    // Inisialisasi input search dari URL saat komponen dimuat
    setSearchQuery(search || "");

    fetchPurchaseOrders(currentPage, ITEMS_PER_PAGE, search)
      .then(({ data, count }) => {
        setDataPO(data || []);
        setTotalItems(count || 0);
      })
      .catch((err) =>
        toast.error("Gagal memuat data PO", { description: err.message })
      )
      .finally(() => setLoading(false));
  }, [currentPage, search]);

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams);
    params.set("page", "1");
    if (searchQuery) {
      params.set("search", searchQuery);
    } else {
      params.delete("search");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handlePrint = () => window.print();
  const handleDownloadExcel = () => {
    /* ... (tidak berubah) ... */
  };
  const handleDownloadPdf = () => {
    /* ... (tidak berubah) ... */
  };

  return (
    <>
      <Content
        title="Daftar Purchase Order"
        description="Kelola seluruh data Purchase Order (PO)"
        cardAction={
          <Button onClick={() => setIsModalOpen(true)}>
            Buat Purchase Order
          </Button>
        }
      >
        <div id="printable-area">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Cari Kode PO, MR, atau Status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-auto"
              />
              <Button variant="outline" onClick={handleSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handlePrint} variant="outline">
                <Printer className="mr-2 h-4 w-4" /> Cetak
              </Button>
              <Button onClick={handleDownloadExcel} variant="outline">
                <Newspaper className="mr-2 h-4 w-4" /> Excel
              </Button>
              <Button onClick={handleDownloadPdf} variant="outline">
                <FileText className="mr-2 h-4 w-4" /> PDF
              </Button>
            </div>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode PO</TableHead>
                  <TableHead>Ref. Kode MR</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total Harga</TableHead>
                  <TableHead>Pembuat</TableHead>
                  <TableHead>Tanggal Dibuat</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : dataPO.length > 0 ? (
                  dataPO.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-medium">
                        {po.kode_po}
                      </TableCell>
                      <TableCell>
                        {po.material_requests?.kode_mr || "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{po.status}</Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(po.total_price)}</TableCell>
                      <TableCell>
                        {po.users_with_profiles?.nama || "N/A"}
                      </TableCell>
                      <TableCell>{formatDate(po.created_at)}</TableCell>
                      <TableCell>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/purchase-order/${po.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24">
                      Tidak ada data ditemukan.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="mt-4 flex justify-center">
          <PaginationComponent
            currentPage={currentPage}
            totalPages={Math.ceil(totalItems / ITEMS_PER_PAGE)}
            basePath="/purchase-order"
            limit={ITEMS_PER_PAGE}
          />
        </div>
      </Content>
      <CreatePOModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}

// ==================================================================
// KOMPONEN INDUK YANG MEMBUNGKUS DENGAN <Suspense>
// ==================================================================
export default function PurchaseOrderPage() {
  return (
    <Suspense
      fallback={
        <Content className="col-span-12">
          <Skeleton className="h-[60vh] w-full" />
        </Content>
      }
    >
      <PurchaseOrderPageContent />
    </Suspense>
  );
}
