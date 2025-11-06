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
  Building2,
  ExternalLink,
  Zap, // <-- REVISI: Ikon baru
  Layers, // <-- REVISI: Ikon baru
  HelpCircle, // <-- REVISI: Ikon baru
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
  DialogDescription, // <-- REVISI: Tambahan
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CurrencyInput } from "@/components/ui/currency-input";
import { fetchActiveCostCenters } from "@/services/mrService";
import { addDays } from "date-fns"; // <-- REVISI: Tambahan

// --- REVISI: Pindahkan data konstanta ke atas ---
const dataUoM: ComboboxData = [
  { label: "Pcs", value: "Pcs" },
  { label: "Unit", value: "Unit" },
  { label: "Set", value: "Set" },
  { label: "Box", value: "Box" },
  { label: "Rim", value: "Rim" },
  { label: "Roll", value: "Roll" },
];

const kategoriData: ComboboxData = [
  { label: "New Item", value: "New Item" },
  { label: "Replace Item", value: "Replace Item" },
  { label: "Fix & Repair", value: "Fix & Repair" },
  { label: "Upgrade", value: "Upgrade" },
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

const dataPrioritas: {
  label: string;
  value: MaterialRequest["prioritas"];
  days: number;
}[] = [
  { label: "P0 - Sangat Mendesak (2 Hari)", value: "P0", days: 2 },
  { label: "P1 - Mendesak (10 Hari)", value: "P1", days: 10 },
  { label: "P2 - Standar (15 Hari)", value: "P2", days: 15 },
  { label: "P3 - Rendah (20 Hari)", value: "P3", days: 20 },
  { label: "P4 - Sangat Rendah (30 Hari)", value: "P4", days: 30 },
];

const dataLevel: { label: string; value: string; group: string }[] = [
  { label: "OPEN 1: Menunggu PR WH", value: "OPEN 1", group: "OPEN" },
  { label: "OPEN 2: Menunggu PO SCM", value: "OPEN 2", group: "OPEN" },
  {
    label: "OPEN 3A: Menunggu Kirim (No Payment Issue)",
    value: "OPEN 3A",
    group: "OPEN",
  },
  {
    label: "OPEN 3B: Menunggu Kirim (Payment Issue)",
    value: "OPEN 3B",
    group: "OPEN",
  },
  {
    label: "OPEN 4: Vendor Kirim (Belum Tiba)",
    value: "OPEN 4",
    group: "OPEN",
  },
  {
    label: "OPEN 5: Tiba di WH (Belum Kirim ke Site)",
    value: "OPEN 5",
    group: "OPEN",
  },
  {
    label: "CLOSE 1: Kirim ke Site (Belum Diterima)",
    value: "CLOSE 1",
    group: "CLOSE",
  },
  {
    label: "CLOSE 2A: Diterima Site (Dokumen Belum Kirim)",
    value: "CLOSE 2A",
    group: "CLOSE",
  },
  {
    label: "CLOSE 2B: Diterima Site (Dokumen Terkirim)",
    value: "CLOSE 2B",
    group: "CLOSE",
  },
  {
    label: "CLOSE 3: Selesai (Update Sistem)",
    value: "CLOSE 3",
    group: "CLOSE",
  },
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

// Komponen InfoItem
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
// --- AKHIR DATA KONSTANTA ---

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
  const [costCenterList, setCostCenterList] = useState<ComboboxData>([]);

  // --- REVISI: State untuk dialog level ---
  const [isLevelInfoOpen, setIsLevelInfoOpen] = useState(false);
  // --- AKHIR REVISI ---

  const supabase = createClient();

  // Efek untuk auto-sum cost_estimation
  useEffect(() => {
    if (mr) {
      const total = mr.orders.reduce((acc, item) => {
        const qty = Number(item.qty) || 0;
        const price = Number(item.estimasi_harga) || 0;
        return acc + qty * price;
      }, 0);

      // Update state MR dan state tampilan
      setMr((prevMr) =>
        prevMr ? { ...prevMr, cost_estimation: String(total) } : null
      );
      setFormattedCost(formatCurrency(total));
    }
  }, [mr?.orders]);

  // --- REVISI: Tambahkan useEffect untuk auto-set Due Date ---
  useEffect(() => {
    if (mr) {
      const prioritasData = dataPrioritas.find((p) => p.value === mr.prioritas);
      if (prioritasData) {
        const calculatedDueDate = addDays(new Date(), prioritasData.days);
        if (
          !mr.due_date ||
          new Date(mr.due_date).toDateString() !==
            calculatedDueDate.toDateString()
        ) {
          setMr((prev) =>
            prev
              ? {
                  ...prev,
                  due_date: calculatedDueDate,
                }
              : null
          );
        }
      }
    }
  }, [mr?.prioritas]);
  // --- AKHIR REVISI ---

  const fetchMrData = async () => {
    if (isNaN(mrId)) {
      setError("ID Material Request tidak valid.");
      return null;
    }
    // --- REVISI: Ambil prioritas dan level ---
    const { data: mrData, error: mrError } = await supabase
      .from("material_requests")
      .select("*, users_with_profiles!userid(nama), prioritas, level")
      .eq("id", mrId)
      .single();
    // --- AKHIR REVISI ---

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

      let adminCompany = "";

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
        adminCompany = profile.company || "";
      } else {
        router.push("/auth/login");
        return;
      }

      await fetchMrData();

      try {
        const costCenters = await fetchActiveCostCenters(adminCompany);
        const costCenterOptions = costCenters.map((cc) => ({
          label: `${cc.name} (${formatCurrency(cc.current_budget)})`,
          value: cc.id.toString(),
        }));
        setCostCenterList(costCenterOptions);
      } catch (ccError: any) {
        toast.error("Gagal memuat data Cost Center", {
          description: ccError.message,
        });
      }

      setLoading(false);
    };
    initializePage();
  }, [mrId, router]);

  const handleSaveChanges = async () => {
    if (!mr) return;
    setActionLoading(true);
    const toastId = toast.loading("Menyimpan semua perubahan...");

    const { cost_center, users_with_profiles, ...restOfData } = mr as any;

    const updateData: Partial<MaterialRequest> = {
      ...restOfData,
      cost_estimation: String(mr.cost_estimation),
      cost_center_id: mr.cost_center_id,
      prioritas: mr.prioritas, // <-- REVISI: Pastikan terkirim
      level: mr.level, // <-- REVISI: Pastikan terkirim
    };

    const { error: updateError } = await supabase
      .from("material_requests")
      .update(updateData as any)
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
    field: "kategori" | "tujuan_site" | "cost_center_id",
    value: string
  ) => {
    if (!mr) return;
    if (field === "cost_center_id") {
      setMr({ ...mr, cost_center_id: value ? Number(value) : null });
    } else {
      setMr({ ...mr, [field]: value });
    }
  };

  // --- REVISI: Handler baru ---
  const handlePrioritasChange = (value: string) => {
    if (!mr) return;
    setMr({ ...mr, prioritas: value as any });
  };

  const handleLevelChange = (value: string) => {
    if (!mr) return;
    setMr({ ...mr, level: value as any });
  };
  // --- AKHIR REVISI ---

  const [openItemDialog, setOpenItemDialog] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  const [orderItem, setOrderItem] = useState<
    Omit<Order, "vendor" | "vendor_contact">
  >({
    name: "",
    qty: "1",
    uom: "Pcs",
    estimasi_harga: 0,
    url: "",
    note: "",
  });

  const handleOpenAddItemDialog = () => {
    setEditingItemIndex(null);
    setOrderItem({
      name: "",
      qty: "1",
      uom: "Pcs",
      estimasi_harga: 0,
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

    const itemToSave: Order = {
      ...orderItem,
      estimasi_harga: Number(orderItem.estimasi_harga) || 0,
    };

    const updatedOrders = [...mr.orders];
    if (editingItemIndex !== null) {
      updatedOrders[editingItemIndex] = itemToSave;
    } else {
      updatedOrders.push(itemToSave);
    }
    setMr({ ...mr, orders: updatedOrders });
    setOpenItemDialog(false);
  };

  const removeItem = (index: number) => {
    if (!mr) return;
    setMr({ ...mr, orders: mr.orders.filter((_, i) => i !== index) });
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    if (!mr) return;
    const updatedOrders = [...mr.orders];
    const item = { ...(updatedOrders[index] || {}) } as any;

    if (field === "estimasi_harga") {
      item.estimasi_harga = Number(value) || 0;
    } else {
      item[field] = value;
    }

    updatedOrders[index] = item;
    setMr({ ...mr, orders: updatedOrders });
  };

  const handleAttachmentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    // ... (Fungsi ini tetap sama)
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
    // ... (Fungsi ini tetap sama)
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
    updatedApprovals[index].processed_at = new Date().toISOString();
    setMr({ ...mr, approvals: updatedApprovals });
  };

  const handleMrStatusChange = (newStatus: MaterialRequest["status"]) => {
    if (!mr) return;
    setMr({ ...mr, status: newStatus });
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

            {/* --- REVISI: Tambahkan Prioritas --- */}
            <div className="space-y-1">
              <Label>Prioritas</Label>
              <Select
                onValueChange={handlePrioritasChange}
                defaultValue={mr.prioritas || ""}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih prioritas..." />
                </SelectTrigger>
                <SelectContent>
                  {dataPrioritas.map((p) => (
                    <SelectItem key={p.value} value={p.value!}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Due Date (Otomatis)</Label>
              <Input
                type="text"
                readOnly
                disabled
                value={formatDateFriendly(mr.due_date)}
                className="font-medium bg-muted/50"
              />
            </div>
            {/* --- AKHIR REVISI --- */}

            <div className="space-y-1">
              <Label htmlFor="cost_center_id">Cost Center</Label>
              <Combobox
                id="cost_center_id"
                data={costCenterList}
                onChange={(v) => handleComboboxChange("cost_center_id", v)}
                defaultValue={mr.cost_center_id?.toString() ?? ""}
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

            {/* --- REVISI: Tambahkan Level --- */}
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label>Level</Label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => setIsLevelInfoOpen(true)}
                >
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
              <Select
                onValueChange={handleLevelChange}
                defaultValue={mr.level || "OPEN 1"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih level..." />
                </SelectTrigger>
                <SelectContent>
                  {dataLevel.map((lvl) => (
                    <SelectItem key={lvl.value} value={lvl.value!}>
                      {lvl.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* --- AKHIR REVISI --- */}

            <div className="space-y-1">
              <Label htmlFor="cost_estimation">Estimasi Biaya (Otomatis)</Label>
              <Input
                id="cost_estimation"
                type="text"
                value={formattedCost}
                disabled
                readOnly
                className="font-bold"
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
                    <TableHead>Estimasi Harga</TableHead>
                    <TableHead>Total Estimasi</TableHead>
                    <TableHead>Catatan</TableHead>
                    <TableHead>Link</TableHead>
                    <TableHead className="w-[100px]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mr.orders.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          value={item.name}
                          onChange={(e) =>
                            handleItemChange(index, "name", e.target.value)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.qty}
                          onChange={(e) =>
                            handleItemChange(index, "qty", e.target.value)
                          }
                          type="number"
                        />
                      </TableCell>
                      <TableCell>
                        <Combobox
                          data={dataUoM}
                          onChange={(v) => handleItemChange(index, "uom", v)}
                          defaultValue={item.uom}
                        />
                      </TableCell>
                      <TableCell>
                        <CurrencyInput
                          value={item.estimasi_harga}
                          onValueChange={(value) =>
                            handleItemChange(index, "estimasi_harga", value)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(Number(item.qty) * item.estimasi_harga)}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.note}
                          onChange={(e) =>
                            handleItemChange(index, "note", e.target.value)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.url}
                          onChange={(e) =>
                            handleItemChange(index, "url", e.target.value)
                          }
                          type="url"
                        />
                      </TableCell>
                      <TableCell className="space-x-1">
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
                        colSpan={8}
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
              <Label htmlFor="estimasi_harga" className="text-right">
                Estimasi Harga
              </Label>
              <CurrencyInput
                id="estimasi_harga"
                className="col-span-3"
                value={orderItem.estimasi_harga}
                onValueChange={(value) =>
                  setOrderItem({ ...orderItem, estimasi_harga: value })
                }
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

      {/* --- REVISI: Dialog Info Level --- */}
      <Dialog open={isLevelInfoOpen} onOpenChange={setIsLevelInfoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keterangan Level Material Request</DialogTitle>
            <DialogDescription>
              Level ini melacak status fisik barang setelah MR disetujui.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <h4 className="font-semibold">
              Level OPEN (Barang Belum Diterima Site)
            </h4>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>
                <strong>OPEN 1:</strong> Bila belum dibuatkan PR nya dari team
                WH
              </li>
              <li>
                <strong>OPEN 2:</strong> Bila belum dibuatkan PO nya dari team
                SCM
              </li>
              <li>
                <strong>OPEN 3A:</strong> Bila barangnya belum dikirimkan dari
                vendor (No Payment Issue)
              </li>
              <li>
                <strong>OPEN 3B:</strong> Bila barangnya belum dikirimkan dari
                vendor (Ada Payment Issue)
              </li>
              <li>
                <strong>OPEN 4:</strong> Bila barang sudah dikirim dari Vendor
                tapi belum sampai di WH kita
              </li>
              <li>
                <strong>OPEN 5:</strong> Bila barang sudah ada di Warehouse GMI
                (Bpn/ HO), tapi belum dikirim oleh team WH ke site
              </li>
            </ul>
            <h4 className="font-semibold">
              Level CLOSE (Barang Sudah Diterima Site)
            </h4>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>
                <strong>CLOSE 1:</strong> Bila barang sudah dikirimkan oleh team
                WH tapi belum diterima oleh team admin WH Site
              </li>
              <li>
                <strong>CLOSE 2A:</strong> Bila barang sudah diterima admin WH
                Site tapi dokumen tanda terima belum dikirimkan ke HO.
              </li>
              <li>
                <strong>CLOSE 2B:</strong> Bila barang sudah diterima admin WH
                Site, serta dokumen tanda terima juga sudah dikirimkan ke HO.
              </li>
              <li>
                <strong>CLOSE 3:</strong> Bila proses CLOSE 2B sudah selesai dan
                data sudah diupdate di sistem monitoring.
              </li>
            </ul>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsLevelInfoOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const DetailMRSkeleton = () => (
  <>
    <div className="col-span-12">
      <Skeleton className="h-12 w-1/2" />
    </div>
    <Content className="col-span-12 lg:col-span-8">
      <Skeleton className="h-96 w-full" />
    </Content>
    <Content className="col-span-12 lg:col-span-4">
      <Skeleton className="h-64 w-full" />
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
