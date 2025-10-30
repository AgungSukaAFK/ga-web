// src/app/(With Sidebar)/mr-management/edit/[id]/page.tsx

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
  Download,
  Link as LinkIcon,
  AlertTriangle,
  Check,
  X,
  Loader2,
  Edit,
  Save,
  Plus,
  Trash2,
  Paperclip,
  Truck,
  CheckCheck,
  XCircle,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { User as AuthUser } from "@supabase/supabase-js";
import {
  MaterialRequest,
  Approval,
  Discussion,
  Order,
  Profile,
  Attachment,
} from "@/type";
import { formatCurrency, formatDateFriendly, cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox, ComboboxData } from "@/components/combobox";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// --- DEFINISI YANG HILANG DITAMBAHKAN DI SINI ---

// 1. Definisi Komponen InfoItem
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

// 2. Definisi Konstanta dataUoM
const dataUoM: ComboboxData = [
  { label: "Pcs", value: "Pcs" },
  { label: "Unit", value: "Unit" },
  { label: "Set", value: "Set" },
  { label: "Box", value: "Box" },
  { label: "Rim", value: "Rim" },
  { label: "Roll", value: "Roll" },
];

// --- AKHIR PENAMBAHAN DEFINISI ---

// Data lain yang dibutuhkan untuk edit
const kategoriData: ComboboxData = [
  { label: "New Item", value: "New Item" },
  { label: "Replace Item", value: "Replace Item" },
  { label: "Fix & Repair", value: "Fix & Repair" },
  { label: "Upgrade", value: "Upgrade" },
];
const dataCostCenter: ComboboxData = [
  { label: "APD", value: "APD" },
  { label: "Bangunan", value: "Bangunan" },
  { label: "Alat Berat", value: "Alat Berat" },
  { label: "Operasional Kantor", value: "Operasional Kantor" },
  { label: "Lainnya", value: "Lainnya" },
];
const dataLokasi: ComboboxData = [
  { label: "Head Office", value: "Head Office" },
  { label: "Tanjung Enim", value: "Tanjung Enim" },
  { label: "Balikpapan", value: "Balikpapan" },
  { label: "Site BA", value: "Site BA" },
  { label: "Site TAL", value: "Site TAL" },
  { label: "Site MIP", value: "Site MIP" },
  { label: "Site MIFA", value: "Site MIFA" },
  { label: "Site BIB", value: "Site BIB" },
  { label: "Site AMI", value: "Site AMI" },
  { label: "Site Tabang", value: "Site Tabang" },
];
const STATUS_OPTIONS: MaterialRequest["status"][] = [
  "Pending Validation",
  "Pending Approval",
  "Waiting PO",
  "Completed",
  "Rejected",
];
const APPROVAL_STATUS_OPTIONS: Approval["status"][] = [
  "pending",
  "approved",
  "rejected",
];

function AdminEditMRPageContent({ params }: { params: { id: string } }) {
  const mrId = parseInt(params.id);
  const router = useRouter();

  const [mr, setMr] = useState<MaterialRequest | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [formattedCost, setFormattedCost] = useState("Rp 0");

  const supabase = createClient();

  const fetchMrData = async () => {
    if (isNaN(mrId)) {
      setError("ID Material Request tidak valid.");
      return null;
    }
    const { data: mrData, error: mrError } = await supabase
      .from("material_requests")
      .select("*, users_with_profiles!userid(nama)")
      .eq("id", mrId)
      .single();

    if (mrError) {
      setError("Gagal memuat data MR.");
      toast.error("Gagal memuat data", { description: mrError.message });
      return null;
    } else {
      const initialData = {
        ...mrData,
        attachments: Array.isArray(mrData.attachments)
          ? mrData.attachments
          : [],
        discussions: Array.isArray(mrData.discussions)
          ? mrData.discussions
          : [],
        approvals: Array.isArray(mrData.approvals) ? mrData.approvals : [],
      };
      setMr(initialData as any);
      const initialCost = Number(initialData.cost_estimation) || 0;
      setFormattedCost(
        new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          minimumFractionDigits: 0,
        }).format(initialCost)
      );
      return initialData;
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

        if (!profile || profile.role !== "admin") {
          toast.error("Akses ditolak.");
          router.push("/dashboard");
          return;
        }
        setUserProfile(profile as Profile | null);
      } else {
        router.push("/auth/login");
        return;
      }

      await fetchMrData();
      setLoading(false);
    };
    initializePage();
  }, [mrId, router]);

  const handleSaveChanges = async () => {
    if (!mr) return;
    setActionLoading(true);
    const toastId = toast.loading("Menyimpan semua perubahan...");

    const updateData: Partial<MaterialRequest> = {
      kategori: mr.kategori,
      remarks: mr.remarks,
      cost_estimation: mr.cost_estimation,
      department: mr.department,
      cost_center: mr.cost_center,
      tujuan_site: mr.tujuan_site,
      due_date: mr.due_date,
      orders: mr.orders,
      approvals: mr.approvals,
      attachments: mr.attachments,
      status: mr.status,
    };

    const { error: updateError } = await supabase
      .from("material_requests")
      .update(updateData)
      .eq("id", mr.id);

    setActionLoading(false);
    if (updateError) {
      toast.error("Gagal menyimpan perubahan", {
        id: toastId,
        description: updateError.message,
      });
    } else {
      toast.success("Perubahan berhasil disimpan!", { id: toastId });
      await fetchMrData();
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (!mr) return;
    const { name, value } = e.target;
    setMr({ ...mr, [name]: value });
  };
  const handleComboboxChange = (
    field: keyof MaterialRequest,
    value: string
  ) => {
    if (!mr) return;
    setMr({ ...mr, [field]: value });
  };
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!mr) return;
    setMr({
      ...mr,
      due_date: e.target.value ? new Date(e.target.value) : undefined,
    });
  };
  const handleCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, "");
    const numericValue = parseInt(rawValue, 10) || 0;
    if (mr) setMr({ ...mr, cost_estimation: String(numericValue) });
    setFormattedCost(
      new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
      }).format(numericValue)
    );
  };

  const [openItemDialog, setOpenItemDialog] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [orderItem, setOrderItem] = useState<Order>({
    name: "",
    qty: "",
    uom: "",
    vendor: "",
    vendor_contact: "",
    url: "",
    note: "",
  });

  const handleOpenAddItemDialog = () => {
    setEditingItemIndex(null);
    setOrderItem({
      name: "",
      qty: "1",
      uom: "Pcs",
      vendor: "",
      vendor_contact: "",
      url: "",
      note: "",
    });
    setOpenItemDialog(true);
  };

  const handleOpenEditItemDialog = (index: number) => {
    if (!mr) return;
    setEditingItemIndex(index);
    setOrderItem(mr.orders[index]);
    setOpenItemDialog(true);
  };

  const handleSaveOrUpdateItem = () => {
    if (
      !orderItem.name.trim() ||
      !orderItem.qty.trim() ||
      !orderItem.uom.trim()
    ) {
      toast.error("Nama item, quantity, dan UoM harus diisi.");
      return;
    }
    if (!mr) return;

    const updatedOrders = [...mr.orders];
    if (editingItemIndex !== null) {
      updatedOrders[editingItemIndex] = orderItem;
    } else {
      updatedOrders.push(orderItem);
    }
    setMr({ ...mr, orders: updatedOrders });
    setOpenItemDialog(false);
  };

  const removeItem = (index: number) => {
    if (!mr) return;
    setMr({ ...mr, orders: mr.orders.filter((_, i) => i !== index) });
  };

  const handleAttachmentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !mr) return;

    setIsUploading(true);
    const toastId = toast.loading(`Mengunggah ${files.length} file...`);
    const uploadPromises = Array.from(files).map(async (file) => {
      const filePath = `${mr.kode_mr.replace(/\//g, "-")}/${Date.now()}_${
        file.name
      }`;
      const { data, error } = await supabase.storage
        .from("mr")
        .upload(filePath, file);
      if (error) return { error };
      return { data: { ...data, name: file.name }, error: null };
    });

    const results = await Promise.all(uploadPromises);
    const successfulUploads = results
      .filter((r) => !r.error)
      .map((r) => ({ url: r.data!.path, name: r.data!.name } as Attachment));

    if (successfulUploads.length > 0) {
      setMr((prevMr) =>
        prevMr
          ? {
              ...prevMr,
              attachments: [
                ...(Array.isArray(prevMr.attachments)
                  ? prevMr.attachments
                  : []),
                ...successfulUploads,
              ],
            }
          : null
      );
      toast.success(`${successfulUploads.length} file berhasil diunggah.`, {
        id: toastId,
      });
    }

    const failedUploads = results.filter((r) => r.error);
    if (failedUploads.length > 0) {
      toast.error(`Gagal mengunggah ${failedUploads.length} file.`, {
        id: toastId,
      });
    } else if (successfulUploads.length === 0) {
      toast.dismiss(toastId);
    }

    setIsUploading(false);
    e.target.value = "";
  };

  const removeAttachment = (indexToRemove: number) => {
    if (!mr || !Array.isArray(mr.attachments)) return;
    const attachmentToRemove = mr.attachments[indexToRemove];
    if (!attachmentToRemove) return;

    setMr((prevMr) =>
      prevMr
        ? {
            ...prevMr,
            attachments: prevMr.attachments.filter(
              (_, i) => i !== indexToRemove
            ),
          }
        : null
    );
    supabase.storage.from("mr").remove([attachmentToRemove.url]);
    toast.info(`Lampiran "${attachmentToRemove.name}" dihapus (sementara).`);
  };

  const handleApprovalStatusChange = (
    index: number,
    newStatus: Approval["status"]
  ) => {
    if (!mr) return;
    const updatedApprovals = [...mr.approvals];
    updatedApprovals[index].status = newStatus;
    setMr({ ...mr, approvals: updatedApprovals });
  };

  const handleMrStatusChange = (newStatus: MaterialRequest["status"]) => {
    if (!mr) return;
    setMr({ ...mr, status: newStatus });
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "approved":
        return <Badge variant="outline">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "pending approval":
        return <Badge variant="secondary">Pending Approval</Badge>;
      case "pending validation":
        return <Badge variant="secondary">Pending Validation</Badge>;
      case "waiting po":
        return <Badge className="bg-blue-500 text-white">Waiting PO</Badge>;
      case "completed":
        return <Badge className="bg-green-500 text-white">Completed</Badge>;
      default:
        return <Badge>{status || "N/A"}</Badge>;
    }
  };

  if (loading) return <DetailMRSkeleton />;
  if (error || !mr)
    return (
      <Content className="col-span-12">
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
          <h1 className="text-2xl font-bold">Data Tidak Ditemukan</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/mr-management">Kembali ke Daftar MR</Link>
          </Button>
        </div>
      </Content>
    );

  return (
    <>
      <div className="col-span-12">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">{mr.kode_mr}</h1>
            <p className="text-muted-foreground">
              Edit Material Request (Admin)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSaveChanges}
              disabled={actionLoading || isUploading}
            >
              {actionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Simpan Semua Perubahan
            </Button>
            <div className="flex items-center gap-1">
              <Label className="text-sm font-medium">Status MR:</Label>
              <Select value={mr.status} onValueChange={handleMrStatusChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Ubah Status MR..." />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-8 space-y-6">
        <Content title="Informasi Utama">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <InfoItem
              icon={CircleUser}
              label="Pembuat"
              value={(mr as any).users_with_profiles?.nama || "N/A"}
            />
            <InfoItem
              icon={Calendar}
              label="Tanggal Dibuat"
              value={formatDateFriendly(mr.created_at)}
            />

            <div className="space-y-1">
              <Label htmlFor="department">Departemen</Label>
              <p className="p-2 border rounded-md bg-muted/50 min-h-[36px] flex items-center">
                {mr.department || "-"}
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="kategori">Kategori</Label>
              <Combobox
                id="kategori"
                data={kategoriData}
                onChange={(v) => handleComboboxChange("kategori", v)}
                defaultValue={mr.kategori}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cost_center">Cost Center</Label>
              <Combobox
                id="cost_center"
                data={dataCostCenter}
                onChange={(v) => handleComboboxChange("cost_center", v)}
                defaultValue={mr.cost_center}
                placeholder="Pilih Cost Center..."
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tujuan_site">Tujuan (Site)</Label>
              <Combobox
                id="tujuan_site"
                data={dataLokasi}
                onChange={(v) => handleComboboxChange("tujuan_site", v)}
                defaultValue={mr.tujuan_site}
                placeholder="Pilih Tujuan Site..."
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={
                  mr.due_date
                    ? new Date(mr.due_date).toISOString().slice(0, 10)
                    : ""
                }
                onChange={handleDateChange}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cost_estimation">Estimasi Biaya</Label>
              <Input
                id="cost_estimation"
                type="text"
                value={formattedCost}
                onChange={handleCostChange}
              />
            </div>
            <div className="md:col-span-2 space-y-1">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                name="remarks"
                value={mr.remarks || ""}
                onChange={handleInputChange}
                rows={3}
              />
            </div>
          </div>
        </Content>

        <Content
          title="Order Items"
          cardAction={
            <Button
              variant="outline"
              onClick={handleOpenAddItemDialog}
              disabled={actionLoading || isUploading}
            >
              <Plus className="mr-2 h-4 w-4" /> Tambah Item
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[1000px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead className="w-[80px]">Qty</TableHead>
                    <TableHead className="w-[120px]">UoM</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Catatan</TableHead>
                    <TableHead>Link</TableHead>
                    <TableHead className="w-[100px]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mr.orders.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.qty}</TableCell>
                      <TableCell>{item.uom}</TableCell>
                      <TableCell>{item.vendor}</TableCell>
                      <TableCell className="max-w-[150px] truncate">
                        {item.note}
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
                      <TableCell className="space-x-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenEditItemDialog(index)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {mr.orders.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center h-24 text-muted-foreground"
                      >
                        Belum ada item.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </Content>

        <Content title="Lampiran">
          <div className="space-y-4">
            <Label htmlFor="attachments">Tambah Lampiran</Label>
            <Input
              id="attachments"
              type="file"
              multiple
              disabled={actionLoading || isUploading}
              onChange={handleAttachmentUpload}
            />
            {isUploading && (
              <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengunggah...
              </div>
            )}
            {Array.isArray(mr.attachments) && mr.attachments.length > 0 && (
              <ul className="space-y-2 mt-2">
                {mr.attachments.map((file, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded"
                  >
                    <a
                      href={`https://xdkjqwpvmyqcggpwghyi.supabase.co/storage/v1/object/public/mr/${file.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 truncate hover:underline text-primary"
                    >
                      <Paperclip className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{file.name}</span>
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeAttachment(index)}
                      disabled={actionLoading || isUploading}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {(!Array.isArray(mr.attachments) ||
              mr.attachments.length === 0) && (
              <p className="text-sm text-muted-foreground text-center pt-2">
                Belum ada lampiran.
              </p>
            )}
          </div>
        </Content>
      </div>

      <div className="col-span-12 lg:col-span-4 space-y-6">
        <Content title="Jalur Approval">
          {Array.isArray(mr.approvals) && mr.approvals.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Admin dapat mengubah status approval:
              </Label>
              {mr.approvals.map((approver, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-4 p-3 rounded-md border bg-card"
                >
                  <div>
                    <p className="font-semibold">{approver.nama}</p>
                    <p className="text-sm text-muted-foreground">
                      {approver.type}
                    </p>
                  </div>
                  <Select
                    value={approver.status}
                    onValueChange={(newStatus) =>
                      handleApprovalStatusChange(
                        index,
                        newStatus as Approval["status"]
                      )
                    }
                  >
                    <SelectTrigger className="w-[120px] capitalize">
                      <SelectValue placeholder="Status..." />
                    </SelectTrigger>
                    <SelectContent>
                      {APPROVAL_STATUS_OPTIONS.map((opt) => (
                        <SelectItem
                          key={opt}
                          value={opt}
                          className="capitalize"
                        >
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center">
              Jalur approval belum ditentukan.
            </p>
          )}
        </Content>
      </div>

      <Dialog open={openItemDialog} onOpenChange={setOpenItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItemIndex !== null
                ? "Edit Order Item"
                : "Tambah Order Item"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="itemNameDlg" className="text-right">
                Nama Item
              </Label>
              <Input
                id="itemNameDlg"
                className="col-span-3"
                value={orderItem.name}
                onChange={(e) =>
                  setOrderItem({ ...orderItem, name: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="itemUomDlg" className="text-right">
                UoM
              </Label>
              <div className="col-span-3">
                <Combobox
                  data={dataUoM}
                  onChange={(v) => setOrderItem({ ...orderItem, uom: v })}
                  defaultValue={orderItem.uom}
                  placeholder="Pilih UoM..."
                />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="itemQtyDlg" className="text-right">
                Quantity
              </Label>
              <Input
                id="itemQtyDlg"
                className="col-span-3"
                type="number"
                value={orderItem.qty}
                onChange={(e) =>
                  setOrderItem({ ...orderItem, qty: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="itemVendorDlg" className="text-right">
                Vendor
              </Label>
              <Input
                id="itemVendorDlg"
                className="col-span-3"
                value={orderItem.vendor}
                onChange={(e) =>
                  setOrderItem({ ...orderItem, vendor: e.target.value })
                }
                placeholder="(Opsional)"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="itemUrlDlg" className="text-right">
                Link Ref.
              </Label>
              <Input
                id="itemUrlDlg"
                type="url"
                className="col-span-3"
                value={orderItem.url}
                onChange={(e) =>
                  setOrderItem({ ...orderItem, url: e.target.value })
                }
                placeholder="(Opsional)"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="itemNoteDlg" className="text-right">
                Catatan
              </Label>
              <Textarea
                id="itemNoteDlg"
                className="col-span-3"
                value={orderItem.note}
                onChange={(e) =>
                  setOrderItem({ ...orderItem, note: e.target.value })
                }
                placeholder="(Opsional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveOrUpdateItem}>
              {editingItemIndex !== null ? "Simpan Perubahan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const DetailMRSkeleton = () => (
  <>
    <div className="col-span-12">
      {" "}
      <Skeleton className="h-12 w-1/2" />{" "}
    </div>
    <Content className="col-span-12 lg:col-span-8">
      {" "}
      <Skeleton className="h-96 w-full" />{" "}
    </Content>
    <Content className="col-span-12 lg:col-span-4">
      {" "}
      <Skeleton className="h-64 w-full" />{" "}
    </Content>
  </>
);

export default function AdminEditMRPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<DetailMRSkeleton />}>
      <AdminEditMRPageContent params={resolvedParams} />
    </Suspense>
  );
}
