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
import {
  FileText,
  Newspaper,
  Printer,
  Search,
  Loader2,
  CreditCard,
  Building2,
  User,
  Mail,
  MapPin,
  Plus,
  ArrowRight,
  MoreHorizontal,
  Eye,
  Edit,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Approval,
  POItem,
  Profile,
  PurchaseOrderListItem,
  StoredVendorDetails,
} from "@/type";
import * as XLSX from "xlsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LIMIT_OPTIONS } from "@/type/enum";

const STATUS_OPTIONS = [
  "Pending Validation",
  "Pending Approval",
  "Pending BAST",
  "Completed",
  "Rejected",
  "Draft",
  "Ordered",
];

const PAYMENT_TERM_OPTIONS = [
  { label: "Semua Jenis", value: "all" },
  { label: "Cash", value: "Cash" },
  { label: "Termin", value: "Termin" },
];

const PAYMENT_VALIDATOR_USER_ID = "06122d13-9918-40ac-9034-41e849c5c3e2";

// --- Komponen Modal Detail Vendor ---
function VendorDetailModal({
  isOpen,
  onClose,
  vendor,
}: {
  isOpen: boolean;
  onClose: () => void;
  vendor: StoredVendorDetails | null;
}) {
  if (!vendor) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Informasi Vendor
          </DialogTitle>
          <DialogDescription>
            Detail lengkap vendor yang dipilih.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Nama Vendor
            </label>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="font-semibold text-base">
                {vendor.nama_vendor}
              </span>
            </div>
            {vendor.kode_vendor && (
              <Badge variant="outline" className="w-fit mt-1">
                {vendor.kode_vendor}
              </Badge>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Kontak Person
            </label>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span>{vendor.contact_person || "-"}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Email
            </label>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <span>{vendor.email || "-"}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Alamat
            </label>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-primary mt-1" />
              <span className="whitespace-pre-wrap text-sm">
                {vendor.alamat || "-"}
              </span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PurchaseOrderPageContent() {
  const [dataPO, setDataPO] = useState<PurchaseOrderListItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [userProfile, setUserProfile] = useState<Profile | null>(null);

  // State untuk Modal Vendor
  const [selectedVendor, setSelectedVendor] =
    useState<StoredVendorDetails | null>(null);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const s = createClient();

  const currentPage = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || 25);
  const searchTerm = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "";
  const companyFilter = searchParams.get("company") || "";
  const minPrice = searchParams.get("min_price") || "";
  const maxPrice = searchParams.get("max_price") || "";
  const startDate = searchParams.get("start_date") || "";
  const endDate = searchParams.get("end_date") || "";
  const paymentFilter = searchParams.get("payment_status") || "";
  const paymentTermFilter = searchParams.get("payment_term_filter") || "";

  const [searchInput, setSearchInput] = useState(searchTerm);
  const [startDateInput, setStartDateInput] = useState(startDate);
  const [endDateInput, setEndDateInput] = useState(endDate);
  const [minPriceInput, setMinPriceInput] = useState(minPrice);
  const [maxPriceInput, setMaxPriceInput] = useState(maxPrice);

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
    [searchParams],
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

        const { data, count } = await fetchPurchaseOrders(
          currentPage,
          limit,
          searchTerm,
          profile?.company || null,
          statusFilter || null,
          minPrice || null,
          maxPrice || null,
          startDate || null,
          endDate || null,
          paymentFilter || null,
          paymentTermFilter || null,
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
  }, [
    currentPage,
    limit,
    searchTerm,
    s,
    statusFilter,
    companyFilter,
    minPrice,
    maxPrice,
    startDate,
    endDate,
    paymentFilter,
    paymentTermFilter,
  ]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== (searchTerm || "")) {
        startTransition(() => {
          router.push(
            `${pathname}?${createQueryString({ search: searchInput })}`,
          );
        });
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [searchInput, searchTerm, pathname, router, createQueryString]);

  const handleFilterChange = (
    updates: Record<string, string | number | undefined>,
  ) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString(updates)}`);
    });
  };

  const handleVendorClick = (vendorDetails: StoredVendorDetails) => {
    setSelectedVendor(vendorDetails);
    setIsVendorModalOpen(true);
  };

  const handleCreatePO = () => {
    // Navigasi langsung ke create page (mode Direct PO default, nanti user bisa link MR di sana)
    router.push("/purchase-order/create");
  };

  const handleDownloadExcel = async () => {
    if (!userProfile) return;
    setIsExporting(true);
    toast.info("Mempersiapkan data lengkap untuk diunduh...");

    try {
      let query = s.from("purchase_orders").select(
        `
            kode_po, status, total_price, company_code, created_at,
            items, approvals, payment_term, vendor_details,
            users_with_profiles!user_id (nama),
            material_requests!mr_id (
              kode_mr,
              users_with_profiles!userid (nama)
            )
          `,
      );

      if (searchTerm) {
        const { data: matchingMRs } = await s
          .from("material_requests")
          .select("id")
          .ilike("kode_mr", `%${searchTerm}%`);

        const matchingMrIds = matchingMRs ? matchingMRs.map((mr) => mr.id) : [];
        const searchTermLike = `"%${searchTerm}%"`;
        let orFilter = `kode_po.ilike.${searchTermLike},status.ilike.${searchTermLike}`;
        orFilter += `,vendor_details->>nama_vendor.ilike.${searchTermLike}`;
        orFilter += `,vendor_details->>kode_vendor.ilike.${searchTermLike}`;

        if (matchingMrIds.length > 0) {
          orFilter += `,mr_id.in.(${matchingMrIds.join(",")})`;
        }
        query = query.or(orFilter);
      }
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

      if (companyFilter) query = query.eq("company_code", companyFilter);
      if (userProfile.company && userProfile.company !== "LOURDES") {
        query = query.eq("company_code", userProfile.company);
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

      const formattedData = data.flatMap((po: any) => {
        const isPaid =
          (po.approvals as Approval[])?.some(
            (app) =>
              app.userid === PAYMENT_VALIDATOR_USER_ID &&
              app.status === "approved",
          ) ?? false;

        const basePoInfo = {
          "Kode PO": po.kode_po,
          "Ref. Kode MR": po.material_requests?.kode_mr || "N/A",
          Vendor: po.vendor_details?.nama_vendor || "N/A",
          "Requester MR":
            po.material_requests?.users_with_profiles?.nama || "N/A",
          Status: po.status,
          "Status Pembayaran": isPaid ? "Paid" : "Unpaid",
          "Jenis Pembayaran": po.payment_term || "N/A",
          "Total Harga PO": po.total_price,
          "Pembuat PO": po.users_with_profiles?.nama || "N/A",
          Perusahaan: po.company_code,
          "Tanggal Dibuat": formatDateFriendly(po.created_at),
        };

        if (Array.isArray(po.items) && po.items.length > 0) {
          return po.items.map((item: POItem) => ({
            ...basePoInfo,
            "Part Number": item.part_number,
            "Nama Item": item.name,
            Qty: item.qty,
            UoM: item.uom,
            "Harga Satuan": item.price,
            "Total Harga Item": item.total_price,
            "Vendor Item": item.vendor_name,
          }));
        } else {
          return [
            {
              ...basePoInfo,
              "Part Number": "N/A",
              "Nama Item": "N/A",
              Qty: 0,
              UoM: "N/A",
              "Harga Satuan": 0,
              "Total Harga Item": 0,
              "Vendor Item": "N/A",
            },
          ];
        }
      });

      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Purchase Orders");
      XLSX.writeFile(
        workbook,
        `Detail_Purchase_Orders_${new Date().toISOString().split("T")[0]}.xlsx`,
      );

      toast.success("Data PO detail berhasil diunduh!");
    } catch (error: any) {
      toast.error("Gagal mengunduh data", { description: error.message });
    } finally {
      setIsExporting(false);
    }
  };

  const canCreatePO =
    (userProfile?.role === "approver" &&
      userProfile?.department === "Purchasing") ||
    userProfile?.role === "admin";

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pending Approval":
        return <Badge variant="secondary">Pending Approval</Badge>;
      case "Pending Validation":
        return <Badge variant="secondary">Pending Validation</Badge>;
      case "Pending BAST":
        return <Badge className="bg-yellow-500 text-white">Pending BAST</Badge>;
      case "Completed":
        return <Badge className="bg-green-500 text-white">Completed</Badge>;
      case "Rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "Draft":
        return <Badge variant="outline">Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <Content
        title="Daftar Purchase Order"
        description="Kelola seluruh data Purchase Order (PO)"
        cardAction={
          canCreatePO && (
            <div className="flex gap-2">
              <Button onClick={() => setIsModalOpen(true)} variant="outline">
                <Search className="mr-2 h-4 w-4" /> Cari MR untuk PO
              </Button>
              <Button onClick={handleCreatePO}>
                <Plus className="mr-2 h-4 w-4" /> Buat PO Baru
              </Button>
            </div>
          )
        }
        className="col-span-12"
      >
        <div id="printable-area">
          <div className="flex flex-col gap-4 mb-6 no-print">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Cari Kode PO, Nama Vendor, Kode MR..."
                  className="pl-10"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <Button
                onClick={handleDownloadExcel}
                variant="outline"
                disabled={isExporting}
                className="w-full md:w-auto"
              >
                {isExporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Newspaper className="mr-2 h-4 w-4" />
                )}
                Download Excel (Detail)
              </Button>
            </div>

            <div className="p-4 border rounded-lg bg-muted/50">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Status PO</label>
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

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">
                    Status Pembayaran
                  </label>
                  <Select
                    onValueChange={(value) =>
                      handleFilterChange({
                        payment_status: value === "all" ? undefined : value,
                      })
                    }
                    defaultValue={paymentFilter || "all"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter pembayaran..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">
                    Jenis Pembayaran
                  </label>
                  <Select
                    onValueChange={(value) =>
                      handleFilterChange({
                        payment_term_filter:
                          value === "all" ? undefined : value,
                      })
                    }
                    defaultValue={paymentTermFilter || "all"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter jenis..." />
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

                {userProfile?.company === "LOURDES" && (
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
                        <SelectItem value="all">Semua Perusahaan</SelectItem>
                        <SelectItem value="GMI">GMI</SelectItem>
                        <SelectItem value="GIS">GIS</SelectItem>
                        <SelectItem value="LOURDES">LOURDES</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
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
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[1600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Kode PO</TableHead>
                  <TableHead>Ref. Kode MR</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Pembuat PO</TableHead>
                  <TableHead>Perusahaan</TableHead>
                  <TableHead>Status PO</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Total Harga</TableHead>
                  <TableHead>Tanggal Dibuat</TableHead>
                  <TableHead className="text-right no-print">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading || isPending ? (
                  Array.from({ length: limit }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={10}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : dataPO.length > 0 ? (
                  dataPO.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-medium">
                        <Button asChild variant="ghost">
                          <Link href={`/purchase-order/${po.id}`}>
                            {po.kode_po}
                          </Link>
                        </Button>
                      </TableCell>
                      <TableCell>
                        {po.material_requests?.kode_mr || "N/A"}
                      </TableCell>

                      <TableCell>
                        {po.vendor_details ? (
                          <button
                            onClick={() => handleVendorClick(po.vendor_details)}
                            className="text-primary hover:underline font-medium text-left"
                          >
                            {po.vendor_details.nama_vendor}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      <TableCell>
                        {po.users_with_profiles?.nama || "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {(po as any).company_code}
                        </Badge>
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
                          <Badge className="flex w-fit items-center gap-1 bg-green-100 text-green-800 border border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700">
                            <CreditCard className="h-3 w-3" />
                            Paid
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="w-fit">
                            Unpaid
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(po.total_price)}
                      </TableCell>
                      <TableCell>{formatDateFriendly(po.created_at)}</TableCell>
                      <TableCell className="text-right no-print">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/purchase-order/${po.id}`}
                                className="cursor-pointer"
                              >
                                <Eye className="mr-2 h-4 w-4" /> Lihat Detail
                              </Link>
                            </DropdownMenuItem>

                            {(po.status === "Draft" ||
                              po.status === "Rejected" ||
                              po.status.includes("Pending")) &&
                              canCreatePO && (
                                <>
                                  <DropdownMenuItem asChild>
                                    <Link
                                      href={`/purchase-order/edit/${po.id}`}
                                      className="cursor-pointer"
                                    >
                                      <Edit className="mr-2 h-4 w-4" /> Edit
                                    </Link>
                                  </DropdownMenuItem>
                                </>
                              )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center h-24">
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

      <VendorDetailModal
        isOpen={isVendorModalOpen}
        onClose={() => setIsVendorModalOpen(false)}
        vendor={selectedVendor}
      />
    </>
  );
}

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
