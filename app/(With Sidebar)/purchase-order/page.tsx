// src/app/(With Sidebar)/purchase-order/page.tsx

"use client";

import {
  Suspense,
  useEffect,
  useState,
  useTransition,
  useCallback,
} from "react";
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
import { fetchPurchaseOrders } from "@/services/purchaseOrderService";
import { PaginationComponent } from "@/components/pagination-components";
import { formatCurrency, formatDateFriendly } from "@/lib/utils";
import { CreatePOModal } from "./CreatePOModal";
import { FileText, Newspaper, Printer, Search, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Profile, PurchaseOrderListItem } from "@/type";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ITEMS_PER_PAGE = 10;
const LIMIT_OPTIONS = [10, 25, 50, 100];

// ==================================================================
// KOMPONEN ANAK YANG BERISI SEMUA LOGIKA
// ==================================================================
function PurchaseOrderPageContent() {
  const [dataPO, setDataPO] = useState<PurchaseOrderListItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [userProfile, setUserProfile] = useState<Profile | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const s = createClient();

  const page = searchParams.get("page") || "1";
  const search = searchParams.get("search");
  const limit = Number(searchParams.get("limit") || ITEMS_PER_PAGE);
  const currentPage = parseInt(page, 10);

  const [searchInput, setSearchInput] = useState(search || "");

  const createQueryString = useCallback(
    (paramsToUpdate: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(paramsToUpdate).forEach(([name, value]) => {
        if (
          value !== undefined &&
          value !== null &&
          String(value).trim() !== ""
        ) {
          params.set(name, String(value));
        } else {
          params.delete(name);
        }
      });
      if (Object.keys(paramsToUpdate).some((k) => k !== "page")) {
        params.set("page", "1");
      }
      return params.toString();
    },
    [searchParams]
  );

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      try {
        const {
          data: { user },
        } = await s.auth.getUser();
        let profile: Profile | null = null;
        if (user) {
          const { data: profileData } = await s
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();
          profile = profileData;
          setUserProfile(profile);
        }

        // REVISI: Kirim company_code dari profil user ke service
        const { data, count } = await fetchPurchaseOrders(
          currentPage,
          limit,
          search,
          profile?.company || null // Kirim company code (GMI, GIS, LOURDES, atau null)
        );
        setDataPO(data || []);
        setTotalItems(count || 0);
      } catch (err: any) {
        toast.error("Gagal memuat data PO", { description: err.message });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentPage, limit, search, s]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== (search || "")) {
        startTransition(() => {
          router.push(
            `${pathname}?${createQueryString({ search: searchInput })}`
          );
        });
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [searchInput, search, pathname, router, createQueryString]);

  const handleFilterChange = (
    updates: Record<string, string | number | undefined>
  ) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString(updates)}`);
    });
  };

  const handlePrint = () => window.print();

  const handleDownloadExcel = async () => {
    setIsExporting(true);
    toast.info("Mempersiapkan data lengkap untuk diunduh...");

    try {
      // REVISI: Kirim company_code dari profil user ke service
      const { data } = await fetchPurchaseOrders(
        1,
        totalItems || 1000,
        search,
        userProfile?.company || null
      );

      const formattedData = data.map((po: any) => ({
        "Kode PO": po.kode_po,
        "Ref. Kode MR": po.material_requests?.kode_mr || "N/A",
        Status: po.status,
        "Total Harga": po.total_price,
        Pembuat: po.users_with_profiles?.nama || "N/A",
        Perusahaan: po.company_code, // <-- Tampilkan company code
        "Tanggal Dibuat": formatDateFriendly(po.created_at),
      }));

      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Purchase Orders");
      XLSX.writeFile(
        workbook,
        `Purchase_Orders_${new Date().toISOString().split("T")[0]}.xlsx`
      );
    } catch (error: any) {
      toast.error("Gagal mengunduh data", { description: error.message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF();
    autoTable(doc, {
      head: [
        [
          "Kode PO",
          "Ref. Kode MR",
          "Status",
          "Total Harga",
          "Pembuat",
          "Tanggal Dibuat",
        ],
      ],
      body: dataPO.map((po) => [
        po.kode_po,
        po.material_requests?.kode_mr || "N/A",
        po.status,
        formatCurrency(po.total_price),
        po.users_with_profiles?.nama || "N/A",
        formatDateFriendly(po.created_at),
      ]),
    });
    doc.save(`Purchase_Orders_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const canCreatePO =
    userProfile?.role === "approver" &&
    userProfile?.department === "Purchasing";

  return (
    <>
      <Content
        title="Daftar Purchase Order"
        description="Kelola seluruh data Purchase Order (PO)"
        cardAction={
          canCreatePO && (
            <Button onClick={() => setIsModalOpen(true)}>
              Buat Purchase Order
            </Button>
          )
        }
        className="col-span-12"
      >
        <div id="printable-area">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4 no-print">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Cari Kode PO, MR, atau Status..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-auto"
              />
              <Button
                variant="outline"
                onClick={() => handleFilterChange({ search: searchInput })}
                disabled={isPending}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handlePrint} variant="outline">
                <Printer className="mr-2 h-4 w-4" /> Cetak
              </Button>
              <Button
                onClick={handleDownloadExcel}
                variant="outline"
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Newspaper className="mr-2 h-4 w-4" />
                )}
                Excel
              </Button>
              <Button onClick={handleDownloadPdf} variant="outline">
                <FileText className="mr-2 h-4 w-4" /> PDF
              </Button>
            </div>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Kode PO</TableHead>
                  <TableHead>Ref. Kode MR</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total Harga</TableHead>
                  <TableHead>Pembuat</TableHead>
                  <TableHead>Perusahaan</TableHead>
                  <TableHead>Tanggal Dibuat</TableHead>
                  <TableHead className="text-right no-print">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading || isPending ? (
                  Array.from({ length: limit }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8}>
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
                      <TableCell>
                        <Badge variant="outline">
                          {(po as any).company_code}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateFriendly(po.created_at)}</TableCell>
                      <TableCell className="text-right no-print">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/purchase-order/${po.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center h-24">
                      Tidak ada data ditemukan.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="mt-6 flex flex-col md:flex-row justify-between items-center gap-4 no-print">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Tampilkan</span>
            <Select
              value={String(limit)}
              onValueChange={(value) => handleFilterChange({ limit: value })}
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue placeholder={limit} />
              </SelectTrigger>
              <SelectContent>
                {LIMIT_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={String(opt)}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>dari {totalItems} hasil.</span>
          </div>
          <PaginationComponent
            currentPage={currentPage}
            totalPages={Math.ceil(totalItems / limit)}
            limit={limit}
            basePath={pathname}
          />
        </div>
      </Content>

      {canCreatePO && (
        <CreatePOModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
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
