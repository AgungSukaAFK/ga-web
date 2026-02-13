// src/app/(With Sidebar)/po-management/PoManagementClient.tsx

"use client";

import { Content } from "@/components/content";
import { CustomPagination } from "@/components/custom-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Newspaper, Search, Edit, CreditCard } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import * as XLSX from "xlsx";
import { PurchaseOrderListItem, Profile, Approval } from "@/type";
import { formatCurrency, formatDateFriendly } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { LIMIT_OPTIONS, STATUS_OPTIONS } from "@/type/enum";

// --- CONSTANTS ---
const PAYMENT_TERM_OPTIONS = [
  { label: "Semua Jenis", value: "all" },
  { label: "Cash", value: "Cash" },
  { label: "Termin", value: "Termin" },
];

const PAYMENT_VALIDATOR_USER_ID = "06122d13-9918-40ac-9034-41e849c5c3e2";

export function PoManagementClientContent() {
  const s = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [poList, setPoList] = useState<PurchaseOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [isPending, startTransition] = useTransition();
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);

  // --- AMBIL PARAMS DARI URL ---
  const currentPage = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || 25);
  const searchTerm = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "";
  const companyFilter = searchParams.get("company") || "";

  // Filter Tambahan
  const minPrice = searchParams.get("min_price") || "";
  const maxPrice = searchParams.get("max_price") || "";
  const startDate = searchParams.get("start_date") || "";
  const endDate = searchParams.get("end_date") || "";
  const paymentFilter = searchParams.get("payment_status") || "";
  const paymentTermFilter = searchParams.get("payment_term_filter") || "";

  // --- LOCAL STATE UNTUK INPUT (Debounce/Apply Manual) ---
  const [searchInput, setSearchInput] = useState(searchTerm);
  const [startDateInput, setStartDateInput] = useState(startDate);
  const [endDateInput, setEndDateInput] = useState(endDate);
  const [minPriceInput, setMinPriceInput] = useState(minPrice);
  const [maxPriceInput, setMaxPriceInput] = useState(maxPrice);

  // --- HELPER UPDATE URL ---
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
      // Reset page ke 1 jika filter berubah (kecuali page itu sendiri)
      if (Object.keys(paramsToUpdate).some((k) => k !== "page")) {
        params.set("page", "1");
      }
      return params.toString();
    },
    [searchParams],
  );

  // --- HANDLERS ---
  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleFilterChange = (
    updates: Record<string, string | number | undefined>,
  ) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString(updates)}`);
    });
  };

  // Debounce Search Text
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== searchTerm) {
        startTransition(() => {
          router.push(
            `${pathname}?${createQueryString({ search: searchInput })}`,
          );
        });
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [searchInput, searchTerm, pathname, router, createQueryString]);

  // --- MAIN FETCH EFFECT ---
  useEffect(() => {
    async function fetchPOs() {
      setLoading(true);

      const {
        data: { user },
      } = await s.auth.getUser();
      if (!user) {
        toast.error("Sesi tidak valid.");
        router.push("/auth/login");
        return;
      }
      const { data: profileData } = await s
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!profileData || profileData.role !== "admin") {
        toast.error("Akses ditolak.");
        router.push("/dashboard");
        return;
      }
      setAdminProfile(profileData);

      const from = (currentPage - 1) * limit;
      const to = from + limit - 1;

      // Query Builder
      let query = s.from("purchase_orders").select(
        `
            id, kode_po, status, total_price, created_at, company_code, approvals, payment_term,
            users_with_profiles!user_id (nama),
            material_requests!mr_id (kode_mr)
          `,
        { count: "exact" },
      );

      // 1. Filter Search Text
      if (searchTerm)
        query = query.or(
          `kode_po.ilike.%${searchTerm}%,status.ilike.%${searchTerm}%,material_requests.kode_mr.ilike.%${searchTerm}%`,
        );

      // 2. Filter Status PO
      if (statusFilter) query = query.eq("status", statusFilter);

      // 3. Filter Harga & Tanggal
      if (minPrice) query = query.gte("total_price", Number(minPrice));
      if (maxPrice) query = query.lte("total_price", Number(maxPrice));
      if (startDate) query = query.gte("created_at", startDate);
      if (endDate) query = query.lte("created_at", `${endDate}T23:59:59.999Z`);

      // 4. Filter Payment (Paid/Unpaid) & Term
      const paymentApprovalObject = `[{"userid": "${PAYMENT_VALIDATOR_USER_ID}", "status": "approved"}]`;
      if (paymentFilter === "paid") {
        query = query.contains("approvals", paymentApprovalObject);
      } else if (paymentFilter === "unpaid") {
        query = query.not("approvals", "cs", paymentApprovalObject);
      }
      if (paymentTermFilter) {
        query = query.ilike("payment_term", `%${paymentTermFilter}%`);
      }

      // 5. Logic Filter Perusahaan (GMI/GIS/LOURDES Access)
      const userCompany = profileData.company;
      if (userCompany === "LOURDES") {
        if (companyFilter && companyFilter !== "all") {
          query = query.eq("company_code", companyFilter);
        }
      } else if (userCompany === "GMI") {
        if (companyFilter === "GMI") {
          query = query.eq("company_code", "GMI");
        } else if (companyFilter === "LOURDES") {
          query = query.eq("company_code", "LOURDES");
        } else {
          query = query.in("company_code", ["GMI", "LOURDES"]);
        }
      } else if (userCompany === "GIS") {
        if (companyFilter === "GIS") {
          query = query.eq("company_code", "GIS");
        } else if (companyFilter === "LOURDES") {
          query = query.eq("company_code", "LOURDES");
        } else {
          query = query.in("company_code", ["GIS", "LOURDES"]);
        }
      } else {
        if (userCompany) {
          query = query.eq("company_code", userCompany);
        }
      }

      // Execute
      query = query.order("created_at", { ascending: false }).range(from, to);

      const { data, error, count } = await query;

      if (error) {
        toast.error("Gagal mengambil data PO: " + error.message);
        setPoList([]);
      } else {
        const transformedData =
          data?.map((po) => ({
            ...po,
            users_with_profiles: Array.isArray(po.users_with_profiles)
              ? (po.users_with_profiles[0] ?? null)
              : po.users_with_profiles,
            material_requests: (() => {
              const mr = Array.isArray(po.material_requests)
                ? (po.material_requests[0] ?? null)
                : po.material_requests;
              return mr
                ? {
                    ...mr,
                    users_with_profiles: Array.isArray(po.users_with_profiles)
                      ? (po.users_with_profiles[0] ?? null)
                      : po.users_with_profiles,
                  }
                : null;
            })(),
          })) || [];
        setPoList(transformedData as PurchaseOrderListItem[]);
        setTotalItems(count || 0);
      }
      setLoading(false);
    }
    fetchPOs();
  }, [
    s,
    currentPage,
    limit,
    searchTerm,
    statusFilter,
    companyFilter,
    minPrice,
    maxPrice,
    startDate,
    endDate,
    paymentFilter,
    paymentTermFilter,
    router,
  ]);

  // --- EXCEL EXPORT ---
  const handleDownloadExcel = async () => {
    if (!adminProfile) return;
    setIsExporting(true);
    toast.info("Mempersiapkan data lengkap untuk diunduh...");

    try {
      let query = s.from("purchase_orders").select(`
            kode_po, status, total_price, company_code, created_at,
            users_with_profiles!user_id (nama),
            material_requests!mr_id (kode_mr),
            approvals, payment_term
        `);

      // Filter yang sama dengan View
      if (searchTerm)
        query = query.or(
          `kode_po.ilike.%${searchTerm}%,status.ilike.%${searchTerm}%,material_requests.kode_mr.ilike.%${searchTerm}%`,
        );
      if (statusFilter) query = query.eq("status", statusFilter);
      if (minPrice) query = query.gte("total_price", Number(minPrice));
      if (maxPrice) query = query.lte("total_price", Number(maxPrice));
      if (startDate) query = query.gte("created_at", startDate);
      if (endDate) query = query.lte("created_at", `${endDate}T23:59:59.999Z`);

      const paymentApprovalObject = `[{"userid": "${PAYMENT_VALIDATOR_USER_ID}", "status": "approved"}]`;
      if (paymentFilter === "paid") {
        query = query.contains("approvals", paymentApprovalObject);
      } else if (paymentFilter === "unpaid") {
        query = query.not("approvals", "cs", paymentApprovalObject);
      }
      if (paymentTermFilter) {
        query = query.ilike("payment_term", `%${paymentTermFilter}%`);
      }

      // Filter Company Logic
      const userCompany = adminProfile.company;
      if (userCompany === "LOURDES") {
        if (companyFilter && companyFilter !== "all")
          query = query.eq("company_code", companyFilter);
      } else if (userCompany === "GMI") {
        if (companyFilter === "GMI") query = query.eq("company_code", "GMI");
        else if (companyFilter === "LOURDES")
          query = query.eq("company_code", "LOURDES");
        else query = query.in("company_code", ["GMI", "LOURDES"]);
      } else if (userCompany === "GIS") {
        if (companyFilter === "GIS") query = query.eq("company_code", "GIS");
        else if (companyFilter === "LOURDES")
          query = query.eq("company_code", "LOURDES");
        else query = query.in("company_code", ["GIS", "LOURDES"]);
      } else {
        if (userCompany) query = query.eq("company_code", userCompany);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });
      if (error) throw error;

      if (!data || data.length === 0) {
        toast.warning("Tidak ada data PO untuk diekspor sesuai filter.");
        setIsExporting(false);
        return;
      }

      const formattedData = data.map((po: any) => {
        const isPaid =
          (po.approvals as Approval[])?.some(
            (app) =>
              app.userid === PAYMENT_VALIDATOR_USER_ID &&
              app.status === "approved",
          ) ?? false;

        return {
          "Kode PO": po.kode_po,
          "Ref. Kode MR": po.material_requests?.kode_mr || "N/A",
          Status: po.status,
          "Status Pembayaran": isPaid ? "Paid" : "Unpaid",
          "Jenis Pembayaran": po.payment_term || "N/A",
          "Total Harga": po.total_price,
          Pembuat: po.users_with_profiles?.nama || "N/A",
          Perusahaan: po.company_code,
          "Tanggal Dibuat": formatDateFriendly(po.created_at),
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Purchase Orders");
      XLSX.writeFile(
        workbook,
        `Admin_Purchase_Orders_${new Date().toISOString().split("T")[0]}.xlsx`,
      );
      toast.success("Data PO berhasil diunduh!");
    } catch (error: any) {
      toast.error("Gagal mengunduh data", { description: error.message });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Content
      title="Manajemen Purchase Order (Admin)"
      size="lg"
      className="col-span-12"
    >
      <div className="flex flex-col gap-4 mb-6">
        {/* --- Top Row: Search & Export --- */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Cari Kode PO, Ref MR, Status..."
              className="pl-10"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button
            onClick={handleDownloadExcel}
            disabled={isExporting || loading || isPending}
            className="w-full md:w-auto"
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Newspaper className="mr-2 h-4 w-4" />
            )}
            Download Excel
          </Button>
        </div>

        {/* --- Filter Section --- */}
        <div className="p-4 border rounded-lg bg-muted/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Status PO */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                onValueChange={(value) =>
                  handleFilterChange({
                    status: value === "all" ? undefined : value,
                  })
                }
                defaultValue={statusFilter || "all"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 2. Status Pembayaran */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Status Pembayaran</label>
              <Select
                onValueChange={(value) =>
                  handleFilterChange({
                    payment_status: value === "all" ? undefined : value,
                  })
                }
                defaultValue={paymentFilter || "all"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Paid / Unpaid" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 3. Jenis Pembayaran */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Jenis Pembayaran</label>
              <Select
                onValueChange={(value) =>
                  handleFilterChange({
                    payment_term_filter: value === "all" ? undefined : value,
                  })
                }
                defaultValue={paymentTermFilter || "all"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Cash / Termin" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERM_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 4. Filter Perusahaan (Dynamic) */}
            {(adminProfile?.company === "LOURDES" ||
              adminProfile?.company === "GMI" ||
              adminProfile?.company === "GIS") && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Perusahaan</label>
                <Select
                  onValueChange={(value) =>
                    handleFilterChange({
                      company: value === "all" ? undefined : value,
                    })
                  }
                  defaultValue={companyFilter || "all"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter perusahaan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua (Sesuai Akses)</SelectItem>
                    {/* LOURDES */}
                    {adminProfile.company === "LOURDES" && (
                      <>
                        <SelectItem value="GMI">GMI</SelectItem>
                        <SelectItem value="GIS">GIS</SelectItem>
                        <SelectItem value="LOURDES">LOURDES</SelectItem>
                      </>
                    )}
                    {/* GMI */}
                    {adminProfile.company === "GMI" && (
                      <>
                        <SelectItem value="GMI">GMI</SelectItem>
                        <SelectItem value="LOURDES">LOURDES</SelectItem>
                      </>
                    )}
                    {/* GIS */}
                    {adminProfile.company === "GIS" && (
                      <>
                        <SelectItem value="GIS">GIS</SelectItem>
                        <SelectItem value="LOURDES">LOURDES</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Row 2: Tanggal & Harga */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Dari Tanggal</label>
              <Input
                type="date"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Sampai Tanggal</label>
              <Input
                type="date"
                value={endDateInput}
                onChange={(e) => setEndDateInput(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Min Total Harga</label>
              <Input
                type="number"
                placeholder="Rp 0"
                value={minPriceInput}
                onChange={(e) => setMinPriceInput(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Max Total Harga</label>
              <Input
                type="number"
                placeholder="Rp 1.000.000"
                value={maxPriceInput}
                onChange={(e) => setMaxPriceInput(e.target.value)}
              />
            </div>
          </div>

          {/* Row 3: Button Terapkan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <div className="lg:col-span-3"></div>
            <div className="flex flex-col gap-2 justify-end">
              <Button
                className="w-full"
                onClick={() =>
                  handleFilterChange({
                    start_date: startDateInput || undefined,
                    end_date: endDateInput || undefined,
                    min_price: minPriceInput || undefined,
                    max_price: maxPriceInput || undefined,
                  })
                }
              >
                Terapkan Filter
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table className="min-w-[1200px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">No</TableHead>
              <TableHead>Kode PO</TableHead>
              <TableHead>Ref. Kode MR</TableHead>
              <TableHead>Pembuat</TableHead>
              <TableHead>Perusahaan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Total Harga</TableHead>
              <TableHead>Tanggal Dibuat</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || isPending ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center h-24">
                  <div className="flex justify-center items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Memuat data...
                  </div>
                </TableCell>
              </TableRow>
            ) : poList.length > 0 ? (
              poList.map((po, index) => (
                <TableRow key={po.id}>
                  <TableCell className="font-medium">
                    {(currentPage - 1) * limit + index + 1}
                  </TableCell>
                  <TableCell className="font-semibold">{po.kode_po}</TableCell>
                  <TableCell>
                    {po.material_requests?.kode_mr || "N/A"}
                  </TableCell>
                  <TableCell>{po.users_with_profiles?.nama || "N/A"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{po.company_code || "N/A"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{po.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {po.approvals?.some(
                      (app: Approval) =>
                        app.userid === PAYMENT_VALIDATOR_USER_ID &&
                        app.status === "approved",
                    ) ? (
                      <Badge className="flex w-fit items-center gap-1 bg-green-100 text-green-800 border border-green-300">
                        <CreditCard className="h-3 w-3" /> Paid
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="w-fit">
                        Unpaid
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatCurrency(po.total_price)}</TableCell>
                  <TableCell>{formatDateFriendly(po.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/po-management/edit/${po.id}`}>
                        <Edit className="mr-2 h-3 w-3" />
                        Edit/View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={10} className="text-center h-24">
                  Tidak ada Purchase Order yang ditemukan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-6 flex flex-col md:flex-row justify-between items-center gap-4">
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
          <span>dari {totalItems} PO.</span>
        </div>

        <CustomPagination
          currentPage={currentPage}
          totalPages={Math.ceil(totalItems / limit)}
          onPageChange={handlePageChange}
        />
      </div>
    </Content>
  );
}
