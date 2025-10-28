// src/app/(With Sidebar)/purchase-order/validate/[id]/page.tsx

"use client";

import { use, useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PurchaseOrderDetail, Approval } from "@/type";
import { formatCurrency, formatDateFriendly, cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle,
  Clock,
  Download,
  Loader2,
  XCircle,
  CircleUser,
  Building,
  Tag,
  Calendar,
  DollarSign,
  Info,
  Truck,
  Building2,
  Link as LinkIcon,
  Wallet,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Combobox, ComboboxData } from "@/components/combobox";
import {
  fetchTemplateById,
  fetchTemplateList,
} from "@/services/approvalTemplateService";
import {
  fetchPurchaseOrderById,
  validatePurchaseOrder,
} from "@/services/purchaseOrderService";
import { Label } from "@/components/ui/label";
import Link from "next/link";

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
const ValidatePOSkeleton = () => (
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

function ValidatePOPageContent({ params }: { params: { id: string } }) {
  const router = useRouter();
  const poId = parseInt(params.id);

  const [po, setPo] = useState<PurchaseOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State untuk approval
  const [newApprovals, setNewApprovals] = useState<Approval[]>([]);
  const [templateList, setTemplateList] = useState<ComboboxData>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState("");

  const s = createClient();

  useEffect(() => {
    if (isNaN(poId)) {
      setError("ID Purchase Order tidak valid.");
      setLoading(false);
      return;
    }

    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const [poDataResult, templatesResult] = await Promise.all([
          fetchPurchaseOrderById(poId),
          fetchTemplateList(),
        ]);

        if (!poDataResult) throw new Error("Data PO tidak ditemukan.");
        if (poDataResult.status !== "Pending Validation") {
          setError("Purchase Order ini tidak lagi menunggu validasi.");
        }
        setPo(poDataResult);

        const templateOptions = templatesResult.map((t) => ({
          label: t.template_name,
          value: String(t.id),
        }));
        setTemplateList(templateOptions);
      } catch (err: any) {
        setError("Gagal memuat data: " + err.message);
        toast.error("Gagal memuat data", { description: err.message });
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [poId]);

  const handleTemplateChange = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) {
      setNewApprovals([]);
      return;
    }
    try {
      const template = await fetchTemplateById(Number(templateId));
      const approvalsFromTemplate = (template.approval_path as any[]).map(
        (app: any): Approval => ({
          ...app,
          status: "pending" as const,
          type: app.type || "",
        })
      );
      setNewApprovals(approvalsFromTemplate);
      toast.success(
        `Template "${template.template_name}" berhasil diterapkan.`
      );
    } catch (err: any) {
      toast.error("Gagal menerapkan template", { description: err.message });
    }
  };

  const removeApprover = (userId: string) =>
    setNewApprovals((prev) => prev.filter((a) => a.userid !== userId));

  const moveApprover = (index: number, direction: "up" | "down") => {
    const newArr = [...newApprovals];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newArr.length) return;
    [newArr[index], newArr[newIndex]] = [newArr[newIndex], newArr[index]];
    setNewApprovals(newArr);
  };

  const updateApproverType = (userId: string, type: string) => {
    setNewApprovals((prev) =>
      prev.map((app) => (app.userid === userId ? { ...app, type } : app))
    );
  };

  const handleValidate = async () => {
    if (!po || newApprovals.length === 0 || newApprovals.some((a) => !a.type)) {
      toast.error("Jalur approval belum lengkap atau PO tidak ditemukan.");
      return;
    }
    setActionLoading(true);
    const toastId = toast.loading("Memvalidasi PO...");

    try {
      await validatePurchaseOrder(poId, newApprovals);
    } catch (updateError: any) {
      setActionLoading(false);
      toast.error("Gagal memvalidasi PO", {
        id: toastId,
        description: updateError.message,
      });
      return;
    }

    try {
      const requesterEmail = (po as any).users_with_profiles?.email;
      const firstApprover = newApprovals[0];
      const emailPromises = [];

      if (requesterEmail) {
        emailPromises.push(
          fetch("/api/v1/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: requesterEmail,
              subject: `[VALIDATED] PO Anda (${po.kode_po}) telah divalidasi`,
              html: `<h1>Purchase Order Divalidasi</h1><p>Purchase Order Anda dengan kode <strong>${po.kode_po}</strong> telah divalidasi dan sekarang dalam proses persetujuan.</p><a href="${window.location.origin}/purchase-order/${po.id}">Lihat Detail PO</a>`,
            }),
          })
        );
      }

      if (firstApprover?.email) {
        emailPromises.push(
          fetch("/api/v1/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: firstApprover.email,
              subject: `[ACTION REQUIRED] Persetujuan PO Baru (${po.kode_po})`,
              html: `<h1>Tugas Persetujuan Baru</h1><p>Halo ${firstApprover.nama},</p><p>Anda memiliki Purchase Order baru dengan kode <strong>${po.kode_po}</strong> yang menunggu persetujuan Anda.</p><a href="${window.location.origin}/approval-validation">Buka Halaman Approval</a>`,
            }),
          })
        );
      }

      await Promise.all(emailPromises);
      toast.success("PO berhasil divalidasi dan notifikasi email terkirim!", {
        id: toastId,
      });
    } catch (emailError: any) {
      toast.warning("PO divalidasi, namun gagal mengirim notifikasi email.", {
        id: toastId,
        description: emailError.message,
      });
    } finally {
      setActionLoading(false);
      router.push("/approval-validation");
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Alasan penolakan wajib diisi.");
      return;
    }
    setActionLoading(true);
    const toastId = toast.loading("Menolak PO...");

    const { error } = await s
      .from("purchase_orders")
      .update({
        status: "Rejected",
        notes: `Ditolak oleh GA dengan alasan: ${rejectionReason}`,
      })
      .eq("id", poId);

    setActionLoading(false);
    if (error) {
      toast.error("Gagal menolak PO", {
        id: toastId,
        description: error.message,
      });
    } else {
      toast.success("PO telah ditolak.");
      router.push("/approval-validation");
    }
  };

  if (loading) return <ValidatePOSkeleton />;

  if (error || !po)
    return (
      <Content className="col-span-12">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <p className="mt-4">{error || "Data PO tidak ditemukan."}</p>
        </div>
      </Content>
    );

  if (po.status !== "Pending Validation") {
    return (
      <Content className="col-span-12">
        <div className="text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
          <h1 className="text-2xl font-bold mt-4">Sudah Ditindaklanjuti</h1>
          <p className="mt-2 text-muted-foreground">
            Purchase Order ini sudah tidak lagi menunggu validasi. Status saat
            ini: <strong>{po.status}</strong>
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/approval-validation">Kembali ke Daftar Validasi</Link>
          </Button>
        </div>
      </Content>
    );
  }

  const currentTurnIndex = newApprovals.findIndex(
    (app) => app.status === "pending"
  );
  const allPreviousApproved =
    currentTurnIndex === -1
      ? false
      : currentTurnIndex === 0 ||
        newApprovals
          .slice(0, currentTurnIndex)
          .every((app) => app.status === "approved");

  return (
    <>
      <div className="col-span-12">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold">Validasi Purchase Order</h1>
            <p className="text-muted-foreground">
              PO:{" "}
              <span className="font-semibold text-primary">{po.kode_po}</span>
            </p>
          </div>
          <Badge variant="secondary">{po.status}</Badge>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-7 flex flex-col gap-6">
        <Content title="Detail Pengajuan PO" size="sm">
          <div className="space-y-4">
            <InfoItem
              icon={CircleUser}
              label="Pembuat PO"
              value={po.users_with_profiles?.nama || "N/A"}
            />
            <InfoItem
              icon={Tag}
              label="Ref. MR"
              value={po.material_requests?.kode_mr || "Tidak ada"}
            />
            <InfoItem
              icon={Calendar}
              label="Tanggal Dibuat"
              value={formatDateFriendly(po.created_at)}
            />
            <InfoItem
              icon={DollarSign}
              label="Total Biaya"
              value={formatCurrency(po.total_price)}
            />
            <InfoItem
              icon={Wallet}
              label="Payment Term"
              value={po.payment_term}
            />
            <InfoItem
              icon={Truck}
              label="Tujuan Pengiriman"
              value={po.shipping_address}
            />
            <InfoItem
              icon={Info}
              label="Catatan PO"
              value={po.notes || "N/A"}
              isBlock
            />
          </div>
        </Content>

        <Content title="Item yang Dipesan (PO)" size="sm">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part Number</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Harga</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.items.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">
                      {item.part_number}
                    </TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>
                      {item.qty} {item.uom}
                    </TableCell>
                    <TableCell>{formatCurrency(item.price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Content>

        {po.material_requests && (
          <Content
            title={`Informasi Referensi dari ${po.material_requests.kode_mr}`}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <InfoItem
                icon={CircleUser}
                label="Pembuat MR"
                value={po.material_requests.users_with_profiles?.nama || "N/A"}
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
        )}
      </div>

      <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
        <Content
          title="Tentukan Jalur Approval"
          size="sm"
          cardAction={
            <Button asChild size={"sm"} variant={"outline"}>
              <Link target="_blank" href={"/approval-validation/templates"}>
                Kelola Template
              </Link>
            </Button>
          }
        >
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Gunakan Template</Label>
              <Combobox
                data={templateList}
                onChange={handleTemplateChange}
                defaultValue={selectedTemplateId}
                placeholder="Pilih template..."
              />
            </div>

            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {newApprovals.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center">
                        Pilih template untuk memulai.
                      </TableCell>
                    </TableRow>
                  )}
                  {newApprovals.map((app, i) => {
                    const isMyTurn =
                      currentTurnIndex === i &&
                      (currentTurnIndex === 0 || allPreviousApproved);
                    return (
                      <TableRow
                        key={app.userid}
                        className={cn(isMyTurn && "bg-primary/10")}
                      >
                        <TableCell
                          className="font-medium max-w-[150px] truncate"
                          title={app.nama}
                        >
                          <div className="flex items-center gap-2">
                            {isMyTurn && (
                              <Clock className="h-4 w-4 text-primary animate-pulse" />
                            )}
                            {app.nama}
                          </div>
                        </TableCell>
                        <TableCell className="w-40">
                          <Combobox
                            data={[
                              { label: "Mengetahui", value: "Mengetahui" },
                              { label: "Menyetujui", value: "Menyetujui" },
                            ]}
                            onChange={(value) =>
                              updateApproverType(app.userid, value)
                            }
                            defaultValue={app.type}
                            placeholder="Pilih..."
                          />
                        </TableCell>
                        <TableCell className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => moveApprover(i, "up")}
                            disabled={i === 0}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => moveApprover(i, "down")}
                            disabled={i === newApprovals.length - 1}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeApprover(app.userid)}
                          >
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <Button
              onClick={handleValidate}
              disabled={actionLoading}
              className="w-full"
            >
              {actionLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Validasi & Mulai Proses Approval
            </Button>
          </div>
        </Content>

        <Content title="Tolak Purchase Order" size="sm">
          <div className="space-y-4">
            <Textarea
              placeholder="Tuliskan alasan penolakan di sini..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoading}
              className="w-full"
            >
              {actionLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Tolak Purchase Order
            </Button>
          </div>
        </Content>
      </div>
    </>
  );
}

// Ini adalah satu-satunya default export
export default function ValidatePOPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  return (
    <Suspense
      fallback={
        <div className="col-span-12">
          <ValidatePOSkeleton />
        </div>
      }
    >
      <ValidatePOPageContent params={resolvedParams} />
    </Suspense>
  );
}
