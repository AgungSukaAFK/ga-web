// src/app/(With Sidebar)/purchase-order/[id]/page.tsx

"use client";

import { use, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
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
import {
  fetchPurchaseOrderById,
  closePoWithBast,
  updatePurchaseOrder, // Pastikan service ini ada
} from "@/services/purchaseOrderService";
import { formatCurrency, formatDateFriendly, cn } from "@/lib/utils";
import {
  CircleUser,
  Download,
  Edit,
  Printer,
  Truck,
  Wallet,
  AlertTriangle,
  Building,
  Tag,
  Calendar,
  DollarSign,
  Info,
  Building2,
  Link as LinkIcon,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  Check, // <-- Tambahkan
  X, // <-- Tambahkan
} from "lucide-react";
// REVISI: Tipe diimpor dengan alias untuk menghindari tabrakan
import { User as AuthUser } from "@supabase/supabase-js";
import {
  PurchaseOrderDetail,
  Approval,
  User as Profile,
  Attachment,
} from "@/type";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

// Komponen helper kecil untuk menampilkan info
const InfoItem = ({
  icon: Icon,
  label,
  value,
  isBlock = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
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
    <Content className="col-span-12 lg:col-span-7">
      <Skeleton className="h-96 w-full" />
    </Content>
    <Content className="col-span-12 lg:col-span-5">
      <Skeleton className="h-96 w-full" />
    </Content>
  </>
);

// ==================================================================
// KONTEN UTAMA HALAMAN (CLIENT COMPONENT)
// ==================================================================
function DetailPOPageContent({ params }: { params: { id: string } }) {
  const { id: poIdString } = params;

  const [po, setPo] = useState<PurchaseOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false); // State untuk tombol approval

  const supabase = createClient(); // Pindahkan inisialisasi ke atas

  // Fungsi untuk memuat data
  const loadData = async () => {
    const poId = parseInt(poIdString);
    if (isNaN(poId)) {
      toast.error("ID Purchase Order tidak valid.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user);

      const poData = await fetchPurchaseOrderById(poId);
      setPo(poData);
    } catch (err: any) {
      toast.error("Gagal memuat detail PO", { description: err.message });
      setPo(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [poIdString]);

  const handlePrintA4 = () => {
    window.print();
  };

  const handleBastUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !po) return;

    if (file.size > 5 * 1024 * 1024) {
      // 5MB limit
      toast.error("File BAST terlalu besar", {
        description: "Ukuran maksimal file adalah 5MB.",
      });
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading("Mengunggah BAST...");

    const supabase = createClient();
    const filePath = `po/${po.kode_po}/BAST_${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("mr") // Pastikan bucket 'mr' bisa diakses
      .upload(filePath, file);

    if (uploadError) {
      toast.error("Gagal mengunggah file BAST", {
        id: toastId,
        description: uploadError.message,
      });
      setIsUploading(false);
      return;
    }

    try {
      const newAttachment: Attachment = {
        name: file.name,
        url: uploadData.path,
      };
      const updatedAttachments = [...(po.attachments || []), newAttachment];

      // Update PO menjadi 'Completed'
      await closePoWithBast(po.id, updatedAttachments);

      // Update MR terkait menjadi 'Completed'
      if (po.mr_id) {
        const { error: mrError } = await supabase
          .from("material_requests")
          .update({ status: "Completed" })
          .eq("id", po.mr_id);
        if (mrError) throw mrError;
      }

      toast.success("BAST berhasil diunggah! MR & PO telah ditutup.", {
        id: toastId,
      });
      await loadData(); // Muat ulang data halaman
    } catch (error: any) {
      toast.error("Gagal memperbarui status", {
        id: toastId,
        description: error.message,
      });
    } finally {
      setIsUploading(false);
    }
  };

  // --- FUNGSI UNTUK AKSI APPROVAL ---
  const handleApprovalAction = async (decision: "approved" | "rejected") => {
    // Pastikan po dan approvals ada
    if (!po || !po.approvals || !currentUser) return;

    setActionLoading(true);
    const toastId = toast.loading(`Sedang memproses ${decision}...`);

    try {
      const approverIndex = po.approvals.findIndex(
        (app) => app.userid === currentUser.id
      );
      if (approverIndex === -1) {
        throw new Error("Anda tidak terdaftar dalam jalur approval PO ini.");
      }

      const updatedApprovals = JSON.parse(JSON.stringify(po.approvals));
      updatedApprovals[approverIndex].status = decision;

      let newPoStatus: PurchaseOrderDetail["status"] = po.status;
      if (decision === "rejected") {
        newPoStatus = "Rejected";
      } else if (decision === "approved") {
        // Cek apakah ini approver terakhir
        const isLastApproval = updatedApprovals.every(
          (app: Approval) => app.status === "approved"
        );
        if (isLastApproval) {
          newPoStatus = "Pending BAST"; // Status baru setelah semua approve
        }
      }

      // Kirim update ke service
      await updatePurchaseOrder(po.id, {
        approvals: updatedApprovals,
        status: newPoStatus,
      });

      toast.success(`PO berhasil di-${decision}!`, { id: toastId });
      await loadData(); // Muat ulang data untuk merefleksikan perubahan
    } catch (error: any) {
      toast.error("Aksi gagal", { id: toastId, description: error.message });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return <Badge variant="outline">Completed</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "pending bast":
        return <Badge variant="secondary">Pending BAST</Badge>;
      case "pending approval":
        return <Badge variant="secondary">Pending Approval</Badge>;
      case "pending validation":
        return <Badge variant="secondary">Pending Validation</Badge>;
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return <DetailPOSkeleton />;
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

  // Cek apakah user saat ini adalah requester asli dari MR terkait
  const isRequester = currentUser?.id === po.material_requests?.userid;

  // Logika untuk highlight approver (dengan null check)
  const currentTurnIndex = po.approvals?.findIndex(
    (app) => app.status === "pending"
  );
  const allPreviousApproved = !po.approvals
    ? false
    : currentTurnIndex === -1
    ? false
    : currentTurnIndex === 0 ||
      po.approvals
        .slice(0, currentTurnIndex)
        .every((app) => app.status === "approved");

  // --- KOMPONEN UNTUK TOMBOL AKSI ---
  const ApprovalActions = () => {
    // Pastikan po.approvals ada
    if (
      !po ||
      !po.approvals ||
      !currentUser ||
      po.status !== "Pending Approval"
    )
      return null;

    const myApprovalIndex = po.approvals.findIndex(
      (app) => app.userid === currentUser.id
    );
    if (
      myApprovalIndex === -1 ||
      po.approvals[myApprovalIndex].status !== "pending"
    ) {
      return null; // Bukan approver atau sudah bertindak
    }

    const isMyTurn =
      currentTurnIndex === myApprovalIndex && allPreviousApproved;
    if (!isMyTurn) {
      return (
        <p className="text-sm text-muted-foreground text-center">
          Menunggu persetujuan dari approver sebelumnya.
        </p>
      );
    }

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
          Setujui
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
          Tolak
        </Button>
      </div>
    );
  };

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
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {getStatusBadge(po.status)}
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/purchase-order/edit/${po.id}`}>
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </Link>
              </Button>
              <Button onClick={handlePrintA4} variant="outline" size="sm">
                <Printer className="mr-2 h-4 w-4" /> Cetak A4
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-7 flex flex-col gap-6 no-print">
        <Content title="Detail Item Pesanan (PO)">
          <div className="rounded-md border overflow-x-auto">
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
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(item.total_price)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Content>

        {po.material_requests && (
          <>
            <Content
              title={`Informasi Referensi dari ${po.material_requests.kode_mr}`}
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
                  value={po.material_requests.cost_center || "N/A"}
                />
                <InfoItem
                  icon={Truck}
                  label="Tujuan Site (MR)"
                  value={po.material_requests.tujuan_site || "N/A"}
                />
                <div className="md:col-span-2">
                  <InfoItem
                    icon={Info}
                    label="Remarks MR"
                    value={po.material_requests.remarks}
                    isBlock
                  />
                </div>
              </div>
            </Content>

            <Content title="Item Asli dari Material Request">
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Item</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Catatan</TableHead>
                      <TableHead>Link</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {po.material_requests.orders.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {item.name}
                        </TableCell>
                        <TableCell>
                          {item.qty} {item.uom}
                        </TableCell>
                        <TableCell>{item.vendor || "-"}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {item.note || "-"}
                        </TableCell>
                        <TableCell>
                          {item.url && (
                            <Button asChild variant={"outline"} size="sm">
                              <Link
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <LinkIcon className="h-3 w-3" />
                              </Link>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Content>
          </>
        )}
      </div>

      <div className="col-span-12 lg:col-span-5 flex flex-col gap-6 no-print">
        {po.status === "Pending Approval" && (
          <Content title="Tindakan Persetujuan">
            <ApprovalActions />
          </Content>
        )}

        {po.status === "Pending BAST" && isRequester && (
          <Content title="Konfirmasi Penerimaan (BAST)">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Silakan unggah dokumen Berita Acara Serah Terima (BAST) atau
                bukti penerimaan barang untuk menutup permintaan ini.
              </p>
              <div className="space-y-2">
                <Label htmlFor="bast-upload">Upload File BAST</Label>
                <Input
                  id="bast-upload"
                  type="file"
                  onChange={handleBastUpload}
                  disabled={isUploading}
                />
                {isUploading && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Mengunggah...
                  </div>
                )}
              </div>
            </div>
          </Content>
        )}

        <Content title="Jalur Approval PO">
          {po.approvals && po.approvals.length > 0 ? (
            <ul className="space-y-2">
              {po.approvals.map((approver, index) => {
                const isMyTurn =
                  currentTurnIndex === index && allPreviousApproved;
                return (
                  <li
                    key={index}
                    className={cn(
                      "flex items-center justify-between gap-4 p-3 rounded-md transition-all",
                      isMyTurn && "bg-primary/10 ring-2 ring-primary/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {approver.status === "approved" ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : approver.status === "rejected" ? (
                        <XCircle className="h-5 w-5 text-destructive" />
                      ) : (
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-semibold">{approver.nama}</p>
                        <p className="text-sm text-muted-foreground">
                          {approver.type}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        approver.status === "approved"
                          ? "outline"
                          : approver.status === "rejected"
                          ? "destructive"
                          : "secondary"
                      }
                      className="capitalize"
                    >
                      {approver.status}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground text-center">
              PO ini menunggu validasi dari GA.
            </p>
          )}
        </Content>

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

        <Content title="Catatan & Lampiran">
          <div>
            <h4 className="font-semibold mb-2">Catatan Internal</h4>
            <p className="text-sm text-muted-foreground">
              {po.notes || "Tidak ada catatan."}
            </p>
          </div>
          <hr className="my-4" />
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
        </Content>
      </div>

      {/* ================================================================== */}
      {/* BAGIAN 2: TAMPILAN KHUSUS UNTUK PRINT A4 (HILANG DI LAYAR) */}
      {/* ================================================================== */}
      <div id="printable-po-a4" className="print-only">
        <header className="flex justify-between items-start pb-4 border-b border-gray-300">
          <div>
            <h1 className="text-2xl font-bold">PT. Garuda Mart Indonesia</h1>
            <p className="text-xs">
              Sakura Regency, Kecamatan Jatiasih, Bekasi
            </p>
            <p className="text-xs">Provinsi Jawa Barat, Indonesia</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-gray-800">PURCHASE ORDER</h2>
            <p className="mt-1">
              <b>No. PO:</b> {po.kode_po}
            </p>
            <p>
              <b>Tanggal:</b> {formatDateFriendly(po.created_at)}
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
            <p className="font-bold">GMI Gudang Pusat</p>
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
              <p className="text-[10px]">
                ({po.vendor_details?.name || "Nama Jelas"})
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

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
