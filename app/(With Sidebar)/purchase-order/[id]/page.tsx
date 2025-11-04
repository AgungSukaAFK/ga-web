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
} from "@/lib/utils";
import { fetchPurchaseOrderById } from "@/services/purchaseOrderService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DiscussionSection } from "../../material-request/[id]/discussion-component";
import { QRCodeCanvas } from "qrcode.react"; // Pastikan ini diimpor
import Image from "next/image";

// --- Data Perusahaan ---
const COMPANY_DETAILS = {
  GMI: {
    name: "PT. Garuda Mart Indonesia",
    logo: "/gmi.jpg",
    address: "Sakura Regency Blok J5-8A, Jatiasih, Bekasi 17423 - Indonesia",
    phone: "(021) 824-073-09",
    email: "info@garudamart.com",
  },
  GIS: {
    name: "PT. Global Inti Sejati",
    logo: "/lourdes.png",
    address: "Jl. Alamat GIS No. 456, Bekasi, Indonesia",
    phone: "(021) 765-4321",
    email: "info@gis.co.id",
  },
  LOURDES: {
    name: "Lourdes Auto Parts",
    logo: "/lourdes.png",
    address: "Jl. Alamat Lourdes No. 789, Tangerang, Indonesia",
    phone: "(021) 111-2222",
    email: "info@lourdes.co.id",
  },
  DEFAULT: {
    name: "Nama Perusahaan Default",
    logo: "/lourdes.png",
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

// Komponen Skeleton untuk loading
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
  const poId = parseInt(params.id);
  const router = useRouter();
  const supabase = createClient();

  const [po, setPo] = useState<PurchaseOrderDetail | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState("");

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

  // --- Logika Approval ---

  const myApprovalIndex =
    po && currentUser && po.approvals
      ? po.approvals.findIndex(
          (a) => a.userid === currentUser.id && a.status === "pending"
        )
      : -1;

  const isMyTurnForApproval =
    myApprovalIndex !== -1 && po && po.approvals
      ? po.approvals
          .slice(0, myApprovalIndex)
          .every((a) => a.status === "approved")
      : false;

  const canEditPO = userProfile?.role === "approver";

  const handleApprovalAction = async (decision: "approved" | "rejected") => {
    if (!po || !currentUser || myApprovalIndex === -1) return;

    setActionLoading(true);

    const updatedApprovals = JSON.parse(JSON.stringify(po.approvals));
    updatedApprovals[myApprovalIndex].status = decision;
    updatedApprovals[myApprovalIndex].processed_at = new Date().toISOString();

    let newPoStatus = po.status;
    if (decision === "rejected") {
      newPoStatus = "Rejected";
    } else if (decision === "approved") {
      const isLastApproval = updatedApprovals.every(
        (app: Approval) => app.status === "approved"
      );
      if (isLastApproval) {
        newPoStatus = "Pending BAST";
      }
    }

    const { error } = await supabase
      .from("purchase_orders")
      .update({ approvals: updatedApprovals, status: newPoStatus })
      .eq("id", po.id);

    if (error) {
      toast.error("Aksi gagal", { description: error.message });
    } else {
      toast.success(
        `PO berhasil di-${decision === "approved" ? "setujui" : "tolak"}`
      );
      await fetchPoData();
    }
    setActionLoading(false);
  };

  // Komponen Tombol Aksi
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

  // --- Helper Badge Status ---
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
    status: "pending" | "approved" | "rejected"
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

  // REVISI: Fungsi cetak
  const handlePrint = () => {
    window.print();
  };

  // --- Render ---
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

  const currentTurnIndex = po.approvals?.findIndex(
    (app) => app.status === "pending"
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
    0
  );

  const companyKey = (po.company_code ||
    "DEFAULT") as keyof typeof COMPANY_DETAILS;
  const companyInfo = COMPANY_DETAILS[companyKey] || COMPANY_DETAILS.DEFAULT;

  return (
    <>
      {/* REVISI: Bungkus UI utama dengan no-print */}
      <div className="col-span-12 grid grid-cols-12 gap-6 no-print">
        <div className="col-span-12">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold">{po.kode_po}</h1>
              <p className="text-muted-foreground">Detail Purchase Order</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Tombol Cetak */}
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Cetak PO
              </Button>
              {canEditPO && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/purchase-order/edit/${po.id}`}>
                    <EditIcon className="mr-2 h-4 w-4" />
                    Edit PO
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
                <InfoItem icon={Info} label="Catatan PO" value={po.notes} />
              </div>
              <hr className="md:col-span-2" />
              <InfoItem
                icon={CircleUser}
                label="Vendor"
                value={po.vendor_details?.name || "N/A"}
              />
              <InfoItem
                icon={Info}
                label="Kontak Vendor"
                value={po.vendor_details?.contact_person || "N/A"}
              />
              <div className="md:col-span-2">
                <InfoItem
                  icon={Building2}
                  label="Alamat Vendor"
                  value={po.vendor_details?.address || "N/A"}
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
            <Content title={`Referensi dari ${po.material_requests.kode_mr}`}>
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
                  icon={DollarSign}
                  label="Estimasi Biaya MR"
                  value={formatCurrency(po.material_requests.cost_estimation)}
                />
                <InfoItem
                  icon={Building2}
                  label="Cost Center"
                  value={
                    po.material_requests.cost_center_id?.toString() ||
                    (po.material_requests as any).cost_center ||
                    "N/A"
                  }
                />
              </div>
            </Content>
          )}
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* --- Blok Tindakan --- */}
          <Content title="Tindakan">
            <ApprovalActions />
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
                        isMyTurn && "bg-primary/10 ring-2 ring-primary/50"
                      )}
                    >
                      <div>
                        <p className="font-semibold">{approver.nama}</p>
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
                        approver.status as "approved" | "rejected" | "pending"
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

          {/* --- Blok Lampiran PO --- */}
          <Content title="Lampiran PO">
            {poAttachments.length > 0 ? (
              <ul className="space-y-2">
                {poAttachments.map((file, index) => (
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
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Tidak ada lampiran.
              </p>
            )}
          </Content>

          {/* --- Blok Lampiran Finance --- */}
          <Content title="Lampiran Finance">
            {financeAttachments.length > 0 ? (
              <ul className="space-y-2">
                {financeAttachments.map((file, index) => (
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
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Tidak ada lampiran.
              </p>
            )}
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

      {/* --- Dialog Rincian Budget --- */}
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
              <span className="font-medium text-destructive">
                - {formatCurrency(po.discount)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Pajak (PPN)</span>
              <span className="font-medium">+ {formatCurrency(po.tax)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Ongkos Kirim</span>
              <span className="font-medium">
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

      {/* REVISI: Komponen Cetak PO (hanya terlihat saat print) */}
      <div className="print-only">
        <PrintablePO po={po} companyInfo={companyInfo} qrUrl={qrUrl} />
      </div>
    </>
  );
}

// REVISI: Komponen baru untuk layout cetak
const PrintablePO = ({
  po,
  companyInfo,
  qrUrl,
}: {
  po: PurchaseOrderDetail;
  companyInfo: (typeof COMPANY_DETAILS)["DEFAULT"];
  qrUrl: string;
}) => {
  const subtotal = po.items.reduce(
    (acc, item) => acc + item.price * item.qty,
    0
  );

  return (
    <div id="printable-po-a4" className="p-10 space-y-6">
      {/* 1. Header */}
      <header className="flex justify-between items-start border-b-4 border-black pb-4">
        <div className="flex items-center gap-4">
          <Image
            src={companyInfo.logo}
            alt="Logo Perusahaan"
            width={80}
            height={80}
          />
          <div>
            <h1 className="text-2xl font-bold">{companyInfo.name}</h1>
            <p className="text-xs">{companyInfo.address}</p>
            <p className="text-xs">
              {companyInfo.phone} | {companyInfo.email}
            </p>
          </div>
        </div>
        <div className="text-right">
          <h1 className="text-xl font-bold">PURCHASE ORDER</h1>
          <p className="font-mono text-sm mt-2">{po.kode_po}</p>
          <p className="text-sm">
            Tanggal: {formatDateFriendly(po.created_at)}
          </p>
        </div>
      </header>

      {/* 2. Info Vendor & Pengiriman */}
      <section className="grid grid-cols-2 gap-6">
        <div className="space-y-1 rounded border p-4">
          <h3 className="font-semibold">KEPADA YTH (VENDOR):</h3>
          <p className="text-sm font-bold">{po.vendor_details?.name}</p>
          <p className="text-xs">{po.vendor_details?.address}</p>
          <p className="text-xs">Kontak: {po.vendor_details?.contact_person}</p>
        </div>
        <div className="space-y-1 rounded border p-4">
          <h3 className="font-semibold">ALAMAT PENGIRIMAN:</h3>
          <p className="text-sm font-bold">{companyInfo.name}</p>
          <p className="text-xs">{po.shipping_address}</p>
          <p className="text-xs">
            Ref. MR: {po.material_requests?.kode_mr || "N/A"}
          </p>
        </div>
      </section>

      {/* 3. Tabel Item */}
      <section>
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-200">
              <TableHead className="text-black">No.</TableHead>
              <TableHead className="text-black">Nama Barang</TableHead>
              <TableHead className="text-black">Part Number</TableHead>
              <TableHead className="text-black text-center">Qty</TableHead>
              <TableHead className="text-black">UoM</TableHead>
              <TableHead className="text-black text-right">
                Harga Satuan
              </TableHead>
              <TableHead className="text-black text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {po.items.map((item, index) => (
              <TableRow key={index}>
                <TableCell>{index + 1}</TableCell>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="font-mono">{item.part_number}</TableCell>
                <TableCell className="text-center">{item.qty}</TableCell>
                <TableCell>{item.uom}</TableCell>
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
      </section>

      {/* 4. Total & Catatan */}
      <section className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <h3 className="font-semibold">Catatan:</h3>
          <p className="text-xs italic">{po.notes || "Tidak ada catatan."}</p>
          <h3 className="font-semibold pt-2">Payment Term:</h3>
          <p className="text-xs">{po.payment_term}</p>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-700">Subtotal:</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-700">Diskon:</span>
            <span className="font-medium">- {formatCurrency(po.discount)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-700">Pajak (PPN):</span>
            <span className="font-medium">+ {formatCurrency(po.tax)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-700">Ongkos Kirim:</span>
            <span className="font-medium">+ {formatCurrency(po.postage)}</span>
          </div>
          <div className="flex justify-between items-center text-base font-bold border-t border-black pt-2 mt-2">
            <span>Grand Total:</span>
            <span>{formatCurrency(po.total_price)}</span>
          </div>
        </div>
      </section>

      {/* 5. REVISI: QR Code di Tengah */}
      <section className="flex justify-center text-center pt-6">
        <div>
          <p className="text-sm font-semibold">Verifikasi Approval</p>
          {qrUrl ? (
            <div className="p-2 border rounded-md mt-2 inline-block">
              <QRCodeCanvas value={qrUrl} size={90} />
            </div>
          ) : (
            <Skeleton className="h-[98px] w-[98px]" />
          )}
          <p className="text-xs italic mt-1">
            Scan untuk melihat status approval
          </p>
          <p className="text-xs mt-2">
            (Dokumen ini dicetak secara digital dan sah tanpa tanda tangan)
          </p>
        </div>
      </section>
    </div>
  );
};

// Ini adalah satu-satunya default export
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
