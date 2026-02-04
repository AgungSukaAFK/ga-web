// src/app/(With Sidebar)/purchase-order/[id]/page.tsx

"use client";

import { use, useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Content } from "@/components/content";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CircleUser,
  Building,
  Tag,
  Calendar,
  DollarSign,
  Info,
  Truck,
  Building2,
  Link as LinkIcon,
  AlertTriangle,
  Check,
  X,
  Loader2,
  Paperclip,
  ExternalLink,
  Wallet,
  Eye,
  Edit as EditIcon,
  Printer,
  Zap,
  Layers,
  User,
  FileText,
  MapPin,
  Upload,
  HelpCircle,
  PackageCheck, // Ikon baru untuk Terima Barang
} from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { User as AuthUser } from "@supabase/supabase-js";
import {
  PurchaseOrderDetail,
  Approval,
  Order,
  Profile,
  Attachment,
  Discussion,
  POItem,
} from "@/type";
import {
  formatCurrency,
  formatDateFriendly,
  cn,
  formatDateWithTime,
  calculatePriority,
} from "@/lib/utils";
import {
  fetchPurchaseOrderById,
  closePoWithBast,
  markGoodsAsReceivedByGA, // IMPORT FUNGSI BARU
} from "@/services/purchaseOrderService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { DiscussionSection } from "../../material-request/[id]/discussion-component";
import { QRCodeCanvas } from "qrcode.react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { differenceInCalendarDays } from "date-fns";
import { MR_LEVELS } from "@/type/enum";

// ... (COMPANY_DETAILS, InfoItem, DetailPOSkeleton TETAP SAMA) ...
const COMPANY_DETAILS = {
  GMI: {
    name: "PT. Garuda Mart Indonesia",
    logo: "/gmi-logo.webp",
    address: "Sakura Regency Blok J5-8A, Jatiasih, Bekasi 17423 - Indonesia",
    phone: "(021) 824-073-09",
    email: "info@garudamart.com",
  },
  GIS: {
    name: "PT. Global Inti Sejati",
    logo: "/lourdes-logo.webp",
    address: "Jl. Alamat GIS No. 456, Bekasi, Indonesia",
    phone: "(021) 765-4321",
    email: "info@gis.co.id",
  },
  LOURDES: {
    name: "Lourdes Auto Parts",
    logo: "/lourdes-logo.webp",
    address: "Sakura Regency J5-8A, Jati Asih, Bekasi 17423",
    phone: "(+021) 82407309",
    email: "info@garudamart.com",
  },
  DEFAULT: {
    name: "Nama Perusahaan Default",
    logo: "/lourdes-logo.webp",
    address: "Alamat Default",
    phone: "Telepon Default",
    email: "email@default.com",
  },
};

const InfoItem = ({
  icon: Icon,
  label,
  value,
  isBlock = false,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  isBlock?: boolean;
}) => (
  <div
    className={cn(isBlock ? "flex flex-col gap-1" : "grid grid-cols-3 gap-x-2")}
  >
    <dt className="text-sm text-muted-foreground col-span-1 flex items-center gap-2">
      <Icon className="h-4 w-4" />
      {label}
    </dt>
    <dd className="text-sm font-semibold col-span-2 whitespace-pre-wrap">
      {value}
    </dd>
  </div>
);

const DetailPOSkeleton = () => (
  <>
    <div className="col-span-12">
      <Skeleton className="h-12 w-1/2" />
    </div>
    <Content className="col-span-12 lg:col-span-8">
      <Skeleton className="h-96 w-full" />
    </Content>
    <Content className="col-span-12 lg:col-span-4">
      <Skeleton className="h-96 w-full" />
    </Content>
  </>
);

function DetailPOPageContent({ params }: { params: { id: string } }) {
  // ... (State & useEffect dasar SAMA) ...
  const poId = parseInt(params.id);
  const router = useRouter();
  const supabase = createClient();

  const [po, setPo] = useState<PurchaseOrderDetail | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State Dialogs
  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false);
  const [isBastDialogOpen, setIsBastDialogOpen] = useState(false);
  const [isLevelInfoOpen, setIsLevelInfoOpen] = useState(false);

  const [qrUrl, setQrUrl] = useState("");
  const [bastFiles, setBastFiles] = useState<FileList | null>(null);
  const [uploadingBast, setUploadingBast] = useState(false);

  // ... (useEffect fetchPoData & initializePage SAMA) ...
  const fetchPoData = async () => {
    if (isNaN(poId)) {
      setError("ID Purchase Order tidak valid.");
      return null;
    }

    try {
      const data = await fetchPurchaseOrderById(poId);
      if (!data) throw new Error("Data PO tidak ditemukan.");

      const initialData = {
        ...data,
        attachments: Array.isArray(data.attachments) ? data.attachments : [],
        material_requests: data.material_requests
          ? {
              ...data.material_requests,
              discussions: Array.isArray(data.material_requests.discussions)
                ? data.material_requests.discussions
                : [],
            }
          : null,
        approvals: Array.isArray(data.approvals) ? data.approvals : [],
        items: Array.isArray(data.items) ? data.items : [],
      };
      setPo(initialData as any);
      return initialData;
    } catch (poError: any) {
      setError("Gagal memuat data PO.");
      toast.error("Gagal memuat data", { description: poError.message });
      return null;
    }
  };

  useEffect(() => {
    const initializePage = async () => {
      setLoading(true);
      setError(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user);

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setUserProfile(profile as Profile | null);
      }
      await fetchPoData();
      setLoading(false);

      setQrUrl(`${window.location.origin}/approval-po/${poId}`);
    };
    initializePage();
  }, [poId]);

  const getCostCenterName = () => {
    const cc = po?.material_requests?.cost_centers;
    if (Array.isArray(cc)) return cc[0]?.name || "-";
    if (cc && typeof cc === "object") return (cc as any).name || "-";
    return "-";
  };

  const getDaysRemaining = (dueDateString?: Date | string) => {
    if (!dueDateString) return "";
    const today = new Date();
    const target = new Date(dueDateString);
    const diff = differenceInCalendarDays(target, today);

    if (diff < 0) return `(Terlewat ${Math.abs(diff)} hari)`;
    if (diff === 0) return "(Hari ini)";
    return `(${diff} hari lagi)`;
  };

  const getVendorData = () => {
    const details = po?.vendor_details as any;
    if (!details)
      return {
        name: "N/A",
        address: "N/A",
        contact: "N/A",
        email: "N/A",
        code: "",
      };

    return {
      name: details.nama_vendor || details.name || "N/A",
      address: details.alamat || details.address || "N/A",
      contact: details.contact_person || "N/A",
      email: details.email || "N/A",
      code: details.kode_vendor || "",
    };
  };

  const vendorData = getVendorData();
  const myApprovalIndex =
    po && currentUser && po.approvals
      ? po.approvals.findIndex(
          (a) => a.userid === currentUser.id && a.status === "pending",
        )
      : -1;

  const isMyTurnForApproval =
    myApprovalIndex !== -1 && po && po.approvals
      ? po.approvals
          .slice(0, myApprovalIndex)
          .every((a) => a.status === "approved")
      : false;

  const canEditPO =
    userProfile?.role === "approver" || userProfile?.role === "admin";
  const isRequester = currentUser?.id === po?.material_requests?.userid;
  const showUploadBast = po?.status === "Pending BAST" && isRequester;

  // --- LOGIKA TOMBOL TERIMA BARANG (GA) ---
  const isGA =
    userProfile?.department === "General Affair" ||
    userProfile?.role === "admin";

  // Barang sudah dikirim (Pending BAST) tapi belum ditandai sampai (Level belum OPEN 5)
  const showGAReceiveButton =
    isGA &&
    po?.status === "Pending BAST" &&
    po?.material_requests?.level !== "OPEN 5" &&
    po?.material_requests?.level !== "CLOSE 1" &&
    !po?.material_requests?.level?.startsWith("CLOSE");

  const handleGAReceiveGoods = async () => {
    if (!po?.mr_id) return;

    if (
      !confirm(
        "Apakah Anda yakin barang sudah diterima di Warehouse? Status MR akan berubah menjadi OPEN 5.",
      )
    ) {
      return;
    }

    setActionLoading(true);
    const toastId = toast.loading("Memperbarui status MR...");

    try {
      await markGoodsAsReceivedByGA(po.mr_id);
      toast.success("Berhasil! Barang ditandai telah tiba di Warehouse.", {
        id: toastId,
      });
      await fetchPoData(); // Refresh data
    } catch (err: any) {
      toast.error("Gagal update status", {
        id: toastId,
        description: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  // ... (handleApprovalAction SAMA) ...
  const handleApprovalAction = async (decision: "approved" | "rejected") => {
    if (!po || !currentUser || myApprovalIndex === -1) return;

    setActionLoading(true);

    const updatedApprovals = JSON.parse(JSON.stringify(po.approvals));
    updatedApprovals[myApprovalIndex].status = decision;
    updatedApprovals[myApprovalIndex].processed_at = new Date().toISOString();

    let newPoStatus = po.status;
    let newMrStatus: string | null = null;

    if (decision === "rejected") {
      newPoStatus = "Rejected";
    } else if (decision === "approved") {
      const isLastApproval = updatedApprovals.every(
        (app: Approval) => app.status === "approved",
      );
      if (isLastApproval) {
        newPoStatus = "Pending BAST";
        newMrStatus = "Pending BAST";
      }
    }

    const { error: poError } = await supabase
      .from("purchase_orders")
      .update({ approvals: updatedApprovals, status: newPoStatus })
      .eq("id", po.id);

    if (poError) {
      toast.error("Aksi PO gagal", { description: poError.message });
      setActionLoading(false);
      return;
    }

    if (newMrStatus && po.mr_id) {
      const { error: mrError } = await supabase
        .from("material_requests")
        .update({ status: newMrStatus })
        .eq("id", po.mr_id);

      if (mrError) {
        toast.warning("PO Disetujui, tapi gagal update status MR", {
          description: mrError.message,
        });
      }
    }

    toast.success(
      `PO berhasil di-${decision === "approved" ? "setujui" : "tolak"}`,
    );
    await fetchPoData();
    setActionLoading(false);
  };

  const handleUploadBast = async () => {
    if (!bastFiles || bastFiles.length === 0) {
      toast.error("Pilih file BAST terlebih dahulu");
      return;
    }

    setUploadingBast(true);
    try {
      const uploadedAttachments: Attachment[] = [];

      for (let i = 0; i < bastFiles.length; i++) {
        const file = bastFiles[i];
        const filePath = `po/${po?.kode_po}/bast/${Date.now()}_${file.name}`;
        const { data, error } = await supabase.storage
          .from("mr")
          .upload(filePath, file);

        if (error) throw error;
        uploadedAttachments.push({
          name: file.name,
          url: data.path,
          type: "bast",
        });
      }

      const existingAttachments = po?.attachments || [];
      const finalAttachments = [...existingAttachments, ...uploadedAttachments];

      await closePoWithBast(poId, finalAttachments);

      toast.success("BAST berhasil diunggah, PO Selesai (Completed)");
      setIsBastDialogOpen(false);
      fetchPoData();
    } catch (error: any) {
      toast.error("Gagal upload BAST", { description: error.message });
    } finally {
      setUploadingBast(false);
    }
  };

  const ApprovalActions = () => {
    if (!po || !currentUser || po.status !== "Pending Approval") return null;
    if (myApprovalIndex === -1) return null;
    if (!isMyTurnForApproval)
      return (
        <p className="text-sm text-muted-foreground text-center">
          Menunggu persetujuan dari approver sebelumnya.
        </p>
      );

    return (
      <div className="flex gap-2">
        <Button
          className="w-full"
          onClick={() => handleApprovalAction("approved")}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}{" "}
          Setujui PO
        </Button>
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => handleApprovalAction("rejected")}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="mr-2 h-4 w-4" />
          )}{" "}
          Tolak PO
        </Button>
      </div>
    );
  };

  // ... (getStatusBadge & getApprovalStatusBadge SAMA) ...
  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "pending approval":
        return <Badge variant="secondary">Pending Approval</Badge>;
      case "pending validation":
        return <Badge variant="secondary">Pending Validation</Badge>;
      case "pending bast":
        return <Badge className="bg-yellow-500 text-white">Pending BAST</Badge>;
      case "completed":
        return <Badge className="bg-green-500 text-white">Completed</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge>{status || "N/A"}</Badge>;
    }
  };

  const getApprovalStatusBadge = (
    status: "pending" | "approved" | "rejected",
  ) => {
    switch (status) {
      case "approved":
        return (
          <Badge variant="outline" className="capitalize">
            {status}
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="capitalize">
            {status}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="capitalize">
            {status}
          </Badge>
        );
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <DetailPOSkeleton />;

  if (error || !po)
    return (
      <Content className="col-span-12">
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
          <h1 className="text-2xl font-bold">Data Tidak Ditemukan</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/purchase-order">Kembali ke Daftar PO</Link>
          </Button>
        </div>
      </Content>
    );

  const poAttachments =
    po.attachments?.filter((att) => !att.type || att.type === "po") || [];
  const financeAttachments =
    po.attachments?.filter((att) => att.type === "finance") || [];
  const bastAttachments =
    po.attachments?.filter((att) => att.type === "bast") || [];
  const currentTurnIndex = po.approvals?.findIndex(
    (app) => app.status === "pending",
  );
  const allPreviousApproved =
    currentTurnIndex === -1
      ? false
      : currentTurnIndex === 0 ||
        (po.approvals &&
          po.approvals.length > 0 &&
          po.approvals
            .slice(0, currentTurnIndex)
            .every((app) => app.status === "approved"));
  const subtotal = po.items.reduce(
    (acc, item) => acc + item.price * item.qty,
    0,
  );
  const companyKey = (po.company_code ||
    "DEFAULT") as keyof typeof COMPANY_DETAILS;
  const companyInfo = COMPANY_DETAILS[companyKey] || COMPANY_DETAILS.DEFAULT;
  const priorityText = getDaysRemaining(po.material_requests?.due_date);

  return (
    <>
      <div className="col-span-12 grid grid-cols-12 gap-6 no-print">
        <div className="col-span-12">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold">{po.kode_po}</h1>
              <p className="text-muted-foreground">Detail Purchase Order</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" /> Cetak PO
              </Button>
              {/* TOMBOL BARU: TERIMA BARANG DI WH (KHUSUS GA) */}
              {showGAReceiveButton && (
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={handleGAReceiveGoods}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PackageCheck className="mr-2 h-4 w-4" />
                  )}
                  Terima Barang di WH
                </Button>
              )}
              {showUploadBast && (
                <Button size="sm" onClick={() => setIsBastDialogOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" /> Upload BAST
                </Button>
              )}
              {canEditPO &&
                po.status !== "Completed" &&
                po.status !== "Rejected" && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/purchase-order/edit/${po.id}`}>
                      <EditIcon className="mr-2 h-4 w-4" /> Edit PO
                    </Link>
                  </Button>
                )}
              {getStatusBadge(po.status)}
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* --- Info Utama PO --- */}
          <Content title="Informasi Utama">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <InfoItem
                icon={CircleUser}
                label="Pembuat PO"
                value={po.users_with_profiles?.nama || "N/A"}
              />
              <InfoItem
                icon={Building}
                label="Perusahaan"
                value={po.company_code}
              />
              <InfoItem
                icon={Calendar}
                label="Tanggal Dibuat"
                value={formatDateFriendly(po.created_at)}
              />
              <InfoItem
                icon={DollarSign}
                label="Grand Total"
                value={
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {formatCurrency(po.total_price)}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setIsBudgetDialogOpen(true)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                }
              />
              <InfoItem
                icon={Tag}
                label="Ref. MR"
                value={
                  po.material_requests ? (
                    <Link
                      href={`/material-request/${po.material_requests.id}`}
                      className="text-primary hover:underline flex items-center gap-1"
                      target="_blank"
                    >
                      {po.material_requests.kode_mr}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : (
                    "Tidak ada"
                  )
                }
              />
              <InfoItem
                icon={Wallet}
                label="Payment Term"
                value={po.payment_term}
              />
              <InfoItem
                icon={Truck}
                label="Alamat Pengiriman"
                value={po.shipping_address}
              />
              <div className="md:col-span-2">
                <InfoItem
                  icon={Info}
                  label="Catatan PO"
                  value={po.notes || "N/A"}
                  isBlock
                />
              </div>
              <hr className="md:col-span-2" />
              <InfoItem
                icon={CircleUser}
                label="Vendor"
                value={
                  <div>
                    <span className="block font-medium">{vendorData.name}</span>
                    {vendorData.code && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {vendorData.code}
                      </span>
                    )}
                  </div>
                }
              />
              <InfoItem
                icon={Info}
                label="Kontak Vendor"
                value={
                  <div>
                    <div>{vendorData.contact}</div>
                    <div className="text-xs text-muted-foreground font-normal">
                      {vendorData.email}
                    </div>
                  </div>
                }
              />
              <div className="md:col-span-2">
                <InfoItem
                  icon={Building2}
                  label="Alamat Vendor"
                  value={vendorData.address}
                  isBlock
                />
              </div>
            </div>
          </Content>

          {/* --- Info Item PO --- */}
          <Content title="Order Items (PO)">
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Item</TableHead>
                    <TableHead>Part Number</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead className="text-right">Harga Satuan</TableHead>
                    <TableHead className="text-right">Total Harga</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {po.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.part_number}
                      </TableCell>
                      <TableCell>
                        {item.qty} {item.uom}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.price)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.total_price)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Content>

          {/* --- Info Referensi MR (jika ada) --- */}
          {po.material_requests && (
            <Content
              title={`Detail Referensi dari ${po.material_requests.kode_mr}`}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <InfoItem
                  icon={CircleUser}
                  label="Pembuat MR"
                  value={
                    po.material_requests.users_with_profiles?.nama || "N/A"
                  }
                />
                <InfoItem
                  icon={Building}
                  label="Departemen MR"
                  value={po.material_requests.department}
                />
                <InfoItem
                  icon={Tag}
                  label="Kategori MR"
                  value={po.material_requests.kategori}
                />
                <InfoItem
                  icon={DollarSign}
                  label="Estimasi Biaya MR"
                  value={formatCurrency(po.material_requests.cost_estimation)}
                />
                <InfoItem
                  icon={Building2}
                  label="Cost Center"
                  value={getCostCenterName()}
                />
                <InfoItem
                  icon={Truck}
                  label="Tujuan Site (MR)"
                  value={po.material_requests.tujuan_site || "N/A"}
                />
                <InfoItem
                  icon={Zap}
                  label="Prioritas MR"
                  value={
                    <div className="flex items-center gap-2">
                      <span>{po.material_requests.prioritas || "N/A"}</span>
                      {priorityText && (
                        <span className="text-xs font-normal text-muted-foreground">
                          {priorityText}
                        </span>
                      )}
                    </div>
                  }
                />
                <div className="grid grid-cols-3 gap-x-2">
                  <dt className="text-sm text-muted-foreground col-span-1 flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Level MR{" "}
                    <button
                      onClick={() => setIsLevelInfoOpen(true)}
                      className="text-muted-foreground hover:text-primary transition-colors"
                      title="Lihat Definisi Level"
                    >
                      <HelpCircle className="h-3 w-3" />
                    </button>
                  </dt>
                  <dd className="text-sm font-semibold col-span-2 whitespace-pre-wrap">
                    {po.material_requests.level || "N/A"}
                  </dd>
                </div>
                <div className="md:col-span-2">
                  <InfoItem
                    icon={Info}
                    label="Remarks MR"
                    value={po.material_requests.remarks}
                    isBlock
                  />
                </div>
              </div>
              <h4 className="font-semibold mt-6 mb-2">Item di MR:</h4>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Item</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead className="text-right">
                        Estimasi Harga
                      </TableHead>
                      <TableHead className="text-right">
                        Total Estimasi
                      </TableHead>
                      <TableHead>Link</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(po.material_requests.orders as Order[]).map(
                      (order, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {order.name}
                          </TableCell>
                          <TableCell>
                            {order.qty} {order.uom}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(order.estimasi_harga)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(
                              Number(order.qty) * order.estimasi_harga,
                            )}
                          </TableCell>
                          <TableCell>
                            {order.url && (
                              <Button asChild variant={"outline"} size="sm">
                                <Link
                                  href={order.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <LinkIcon className="h-3 w-3" />
                                </Link>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ),
                    )}
                  </TableBody>
                </Table>
              </div>
            </Content>
          )}
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* --- Blok Tindakan --- */}
          <Content title="Tindakan">
            <ApprovalActions />
            {po.status === "Completed" && (
              <div className="mt-2">
                <p className="text-sm text-green-600 font-medium mb-2 flex items-center gap-2">
                  <Check className="h-4 w-4" /> PO Selesai (Completed)
                </p>
              </div>
            )}
          </Content>

          {/* --- Blok Jalur Approval --- */}
          <Content title="Jalur Approval">
            {po.approvals && po.approvals.length > 0 ? (
              <ul className="space-y-2">
                {po.approvals.map((approver, index) => {
                  const isMyTurn =
                    currentTurnIndex === index &&
                    (currentTurnIndex === 0 || allPreviousApproved);
                  return (
                    <li
                      key={index}
                      className={cn(
                        "flex items-center justify-between gap-4 p-3 rounded-md transition-all",
                        isMyTurn && "bg-primary/10 ring-2 ring-primary/50",
                      )}
                    >
                      <div>
                        <p className="font-semibold">
                          {approver.nama}{" "}
                          <span className="ml-2">
                            <Badge variant={"outline"}>
                              {approver.department}
                            </Badge>
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {approver.type}
                        </p>
                        {approver.status !== "pending" &&
                          approver.processed_at && (
                            <p className="text-xs text-muted-foreground italic mt-1">
                              {formatDateWithTime(approver.processed_at)}
                            </p>
                          )}
                      </div>
                      {getApprovalStatusBadge(
                        approver.status as "approved" | "rejected" | "pending",
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                Jalur approval belum ditentukan oleh GA.
              </p>
            )}
          </Content>

          {/* --- Lampiran --- */}
          <Content title="Lampiran PO">
            <ul className="space-y-2">
              {poAttachments.length > 0 ? (
                poAttachments.map((file, index) => (
                  <li key={index}>
                    <Link
                      href={`https://xdkjqwpvmyqcggpwghyi.supabase.co/storage/v1/object/public/mr/${file.url}`}
                      target="_blank"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Paperclip className="h-4 w-4" />
                      <span>{file.name}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </Link>
                  </li>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Tidak ada lampiran.
                </p>
              )}
            </ul>
          </Content>

          <Content title="Lampiran Finance">
            <ul className="space-y-2">
              {financeAttachments.length > 0 ? (
                financeAttachments.map((file, index) => (
                  <li key={index}>
                    <Link
                      href={`https://xdkjqwpvmyqcggpwghyi.supabase.co/storage/v1/object/public/mr/${file.url}`}
                      target="_blank"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Paperclip className="h-4 w-4" />
                      <span>{file.name}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </Link>
                  </li>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Tidak ada lampiran.
                </p>
              )}
            </ul>
          </Content>

          <Content title="Lampiran BAST / Bukti Terima">
            <ul className="space-y-2">
              {bastAttachments.length > 0 ? (
                bastAttachments.map((file, index) => (
                  <li key={index}>
                    <Link
                      href={`https://xdkjqwpvmyqcggpwghyi.supabase.co/storage/v1/object/public/mr/${file.url}`}
                      target="_blank"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Check className="h-4 w-4 text-green-600" />
                      <span>{file.name}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </Link>
                  </li>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada BAST.</p>
              )}
            </ul>
          </Content>
        </div>

        {/* --- Blok Diskusi --- */}
        <div className="col-span-12">
          {po.material_requests ? (
            <DiscussionSection
              mrId={String(po.material_requests.id)}
              initialDiscussions={
                po.material_requests.discussions as Discussion[]
              }
            />
          ) : (
            <Content title="Diskusi">
              <p className="text-sm text-muted-foreground text-center">
                Diskusi hanya tersedia untuk PO yang terhubung ke Material
                Request.
              </p>
            </Content>
          )}
        </div>
      </div>

      {/* --- Dialogs --- */}
      <Dialog open={isBudgetDialogOpen} onOpenChange={setIsBudgetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rincian Biaya PO: {po.kode_po}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Diskon</span>
              <span className="font-medium text-destructive-foregrounde">
                - {formatCurrency(po.discount)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Pajak (PPN)</span>
              <span className="font-medium text-muted-foreground">
                + {formatCurrency(po.tax)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Ongkos Kirim</span>
              <span className="font-medium text-muted-foreground">
                + {formatCurrency(po.postage)}
              </span>
            </div>
            <hr className="my-2" />
            <div className="flex justify-between items-center text-lg font-bold">
              <span>Grand Total</span>
              <span>{formatCurrency(po.total_price)}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isBastDialogOpen} onOpenChange={setIsBastDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload BAST & Selesaikan PO</DialogTitle>
            <DialogDescription>
              Unggah Berita Acara Serah Terima (BAST) atau bukti penerimaan
              barang.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="bast-file">File BAST / Bukti Foto</Label>
            <Input
              id="bast-file"
              type="file"
              multiple
              onChange={(e) => setBastFiles(e.target.files)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBastDialogOpen(false)}
            >
              Batal
            </Button>
            <Button onClick={handleUploadBast} disabled={uploadingBast}>
              {uploadingBast && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}{" "}
              Upload & Selesaikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLevelInfoOpen} onOpenChange={setIsLevelInfoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definisi Level MR</DialogTitle>
            <DialogDescription>
              Penjelasan status level Material Request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div>
              <h4 className="font-semibold mb-2">OPEN</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {MR_LEVELS.filter((l) => l.group === "OPEN").map((l) => (
                  <li key={l.value}>
                    <span className="font-semibold">{l.value}:</span>{" "}
                    {l.description}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">CLOSE</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {MR_LEVELS.filter((l) => l.group === "CLOSE").map((l) => (
                  <li key={l.value}>
                    <span className="font-semibold">{l.value}:</span>{" "}
                    {l.description}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsLevelInfoOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Komponen Cetak PO --- */}
      <div className="print-only">
        <PrintablePO
          po={po}
          companyInfo={companyInfo}
          qrUrl={qrUrl}
          vendorData={vendorData}
        />
      </div>
    </>
  );
}

const PrintablePO = ({
  po,
  companyInfo,
  qrUrl,
  vendorData,
}: {
  po: PurchaseOrderDetail;
  companyInfo: (typeof COMPANY_DETAILS)["DEFAULT"];
  qrUrl: string;
  vendorData: { name: string; address: string; contact: string; code: string };
}) => {
  return (
    <div
      id="printable-po-a4"
      className="p-8 bg-white text-black font-sans text-sm leading-normal min-h-[29.7cm] flex flex-col relative"
    >
      <header className="flex justify-between items-start border-b-2 border-black pb-6 mb-6">
        <div className="flex items-center gap-6 w-2/3">
          <div className="w-[120px] relative flex-shrink-0 flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={companyInfo.logo}
              alt="Logo"
              className="object-contain max-w-full max-h-full object-left"
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

      <section className="mb-6">
        <table className="w-full border-collapse border-y-2 border-black table-fixed text-xs">
          <thead>
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
          </thead>
          <tbody>
            {po.items.map((item, index) => (
              <tr
                key={index}
                className="border-b border-gray-200 last:border-0"
              >
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
                  {formatCurrency(item.total_price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex gap-10 break-inside-avoid items-start">
        <div className="flex-1 space-y-4">
          <div className="space-y-1">
            <h4 className="font-bold text-xs text-gray-900 uppercase border-b border-gray-300 pb-1 inline-block">
              Catatan / Notes:
            </h4>
            <p className="text-xs italic text-gray-600 whitespace-pre-wrap leading-relaxed pt-1">
              {po.notes || "Tidak ada catatan khusus."}
            </p>
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-xs text-gray-900 uppercase border-b border-gray-300 pb-1 inline-block">
              Syarat Pembayaran (Payment Term):
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
                {formatCurrency(
                  po.items.reduce(
                    (acc, item) => acc + item.price * item.qty,
                    0,
                  ),
                )}
              </span>
            </div>
            {po.discount > 0 && (
              <div className="flex justify-between text-xs text-red-600">
                <span>Diskon</span>
                <span>- {formatCurrency(po.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Pajak (PPN)</span>
              <span className="font-medium text-gray-900">
                + {formatCurrency(po.tax)}
              </span>
            </div>
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

      <div className="mt-auto pt-12 break-inside-avoid">
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
          <p className="text-[9px] text-gray-400 mt-1">
            Dicetak oleh {po.users_with_profiles?.nama || "System"} pada{" "}
            {new Date().toLocaleString("id-ID")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default function DetailPOPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<DetailPOSkeleton />}>
      <DetailPOPageContent params={resolvedParams} />
    </Suspense>
  );
}
