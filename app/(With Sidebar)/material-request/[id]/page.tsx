// src/app/(With Sidebar)/material-request/[id]/page.tsx

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
  Building2,
  ExternalLink,
  Zap,
  Layers,
  HelpCircle,
  CheckCheck,
  Calendar as CalendarIcon,
  FileText,
  MapPin,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  Clock,
  XCircle,
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
  MrItemStatus,
} from "@/type";
import {
  formatCurrency,
  formatDateFriendly,
  cn,
  formatDateWithTime,
  calculatePriority,
} from "@/lib/utils";
import { DiscussionSection } from "./discussion-component";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox, ComboboxData } from "@/components/combobox";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  MR_LEVELS,
  MR_ITEM_STATUS_COLORS,
  MR_ITEM_STATUS_LABELS,
} from "@/type/enum";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { processMrApproval } from "@/services/approvalService";
import { fetchMaterialRequestById } from "@/services/mrService"; // Pastikan sudah ada di service

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

const dataUoM: ComboboxData = [
  { label: "Pcs", value: "Pcs" },
  { label: "Unit", value: "Unit" },
  { label: "Set", value: "Set" },
  { label: "Box", value: "Box" },
  { label: "Rim", value: "Rim" },
  { label: "Roll", value: "Roll" },
];

function DetailMRPageContent({ params }: { params: { id: string } }) {
  const mrId = parseInt(params.id);
  const router = useRouter();
  const supabase = createClient();

  const [mr, setMr] = useState<MaterialRequest | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formattedCost, setFormattedCost] = useState("Rp 0");

  const [costCenterName, setCostCenterName] = useState<string | null>(null);
  const [costCenterBudget, setCostCenterBudget] = useState<number | null>(null);

  const [isLevelInfoOpen, setIsLevelInfoOpen] = useState(false);
  const [isCloseMrAlertOpen, setIsCloseMrAlertOpen] = useState(false);
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

  // --- FETCH DATA ---
  const fetchMrData = async () => {
    if (isNaN(mrId)) {
      setError("ID Material Request tidak valid.");
      return null;
    }

    try {
      const data = await fetchMaterialRequestById(mrId);

      if (!data) throw new Error("Data tidak ditemukan");

      const initialData = {
        ...data,
        attachments: Array.isArray(data.attachments) ? data.attachments : [],
        discussions: Array.isArray(data.discussions) ? data.discussions : [],
        approvals: Array.isArray(data.approvals) ? data.approvals : [],
        orders: Array.isArray(data.orders) ? data.orders : [],
        due_date: data.due_date ? new Date(data.due_date) : undefined,
      };

      setMr(initialData as any);

      const ccData = data.cost_centers as any;
      setCostCenterName(ccData?.name || null);
      setCostCenterBudget(ccData?.current_budget ?? null);

      return initialData;
    } catch (err: any) {
      setError("Gagal memuat data MR.");
      toast.error("Gagal memuat data", { description: err.message });
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
      await fetchMrData();
      setLoading(false);
    };
    initializePage();
  }, [mrId]);

  // --- EFFECT: Calculate Total Cost ---
  useEffect(() => {
    if (mr) {
      const total = mr.orders.reduce((acc, item) => {
        const qty = Number(item.qty) || 0;
        const price = Number(item.estimasi_harga) || 0;
        return acc + qty * price;
      }, 0);
      setFormattedCost(formatCurrency(total));
    }
  }, [mr?.orders]);

  const myApprovalIndex =
    mr && currentUser && mr.approvals
      ? mr.approvals.findIndex(
          (a) => a.userid === currentUser.id && a.status === "pending",
        )
      : -1;

  const isMyTurnForApproval =
    myApprovalIndex !== -1 && mr
      ? mr.approvals
          .slice(0, myApprovalIndex)
          .every((a) => a.status === "approved")
      : false;

  const canEdit =
    userProfile?.role === "admin" ||
    userProfile?.role === "approver" ||
    (userProfile?.role === "requester" && mr?.status === "Pending Validation");

  // --- ACTIONS ---

  const handleSaveChanges = async () => {
    if (!mr) return;
    setActionLoading(true);
    const toastId = toast.loading("Menyimpan perubahan...");

    const totalCost = mr.orders.reduce((acc, item) => {
      return acc + (Number(item.qty) || 0) * (Number(item.estimasi_harga) || 0);
    }, 0);

    const { users_with_profiles, cost_centers, ...restOfData } = mr as any;

    const updateData = {
      ...restOfData,
      cost_estimation: String(totalCost),
      prioritas: mr.prioritas,
      due_date: mr.due_date,
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
      return false;
    } else {
      toast.success("Perubahan berhasil disimpan!", { id: toastId });
      setIsEditing(false);
      await fetchMrData();
      return true;
    }
  };

  const handleApprovalAction = async (decision: "approved" | "rejected") => {
    if (!mr || !currentUser) return;

    if (isEditing && decision === "approved") {
      const saveSuccess = await handleSaveChanges();
      if (!saveSuccess) {
        toast.error("Persetujuan dibatalkan karena gagal menyimpan perubahan.");
        return;
      }
    }

    setActionLoading(true);
    try {
      await processMrApproval(
        mr.id as any,
        currentUser.id,
        decision,
        mr.approvals,
      );

      toast.success(
        `MR berhasil di-${decision === "approved" ? "setujui" : "tolak"}`,
      );
      await fetchMrData();
      setIsEditing(false);
    } catch (err: any) {
      toast.error("Aksi gagal", { description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Apakah Anda yakin ingin menghapus MR ini?")) return;
    try {
      const { error } = await supabase
        .from("material_requests")
        .delete()
        .eq("id", mrId);

      if (error) throw error;

      toast.success("MR berhasil dihapus");
      router.push("/material-request");
    } catch (error: any) {
      toast.error("Gagal menghapus MR", { description: error.message });
    }
  };

  // --- ITEM MANAGEMENT (CRUD in Memory) ---

  const handleItemChange = (
    index: number,
    field: keyof Order,
    value: string | number,
  ) => {
    if (!mr) return;
    const newOrders = [...mr.orders];
    (newOrders[index] as any)[field] = value;
    setMr({ ...mr, orders: newOrders });
  };

  const [openItemDialog, setOpenItemDialog] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const [orderItem, setOrderItem] = useState<Partial<Order>>({
    name: "",
    qty: "1",
    uom: "Pcs",
    estimasi_harga: 0,
    url: "",
    note: "",
    status: "Pending",
    po_refs: [],
  });

  const handleOpenAddItemDialog = () => {
    setEditingIndex(null);
    setOrderItem({
      name: "",
      qty: "1",
      uom: "Pcs",
      estimasi_harga: 0,
      url: "",
      note: "",
      status: "Pending",
      po_refs: [],
    });
    setOpenItemDialog(true);
  };

  const handleOpenEditItemDialog = (index: number) => {
    if (!mr) return;
    setEditingIndex(index);
    setOrderItem({ ...mr.orders[index] });
    setOpenItemDialog(true);
  };

  const handleSaveOrUpdateItem = () => {
    if (
      !orderItem.name?.trim() ||
      !String(orderItem.qty).trim() ||
      !orderItem.uom?.trim()
    ) {
      toast.error("Nama item, quantity, dan UoM harus diisi.");
      return;
    }
    if (!mr) return;

    const itemToSave: Order = {
      name: orderItem.name || "",
      qty: String(orderItem.qty),
      uom: orderItem.uom || "Pcs",
      estimasi_harga: Number(orderItem.estimasi_harga) || 0,
      url: orderItem.url || "",
      note: orderItem.note || "",
      part_number: orderItem.part_number || null,
      barang_id: orderItem.barang_id || null,
      status: (orderItem.status as MrItemStatus) || "Pending",
      po_refs: orderItem.po_refs || [],
      status_note: orderItem.status_note || "",
    };

    const updatedOrders = [...mr.orders];
    if (editingIndex !== null) {
      updatedOrders[editingIndex] = itemToSave;
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

  // --- ATTACHMENT HANDLERS ---

  const handleAttachmentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
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
      .map((r) => ({ url: r.data!.path, name: r.data!.name }) as Attachment);
    if (successfulUploads.length === 0) {
      toast.error("Semua file gagal diunggah.", { id: toastId });
      setIsUploading(false);
      return;
    }
    const updatedAttachments = [
      ...(mr.attachments || []),
      ...successfulUploads,
    ];
    const { error: updateError } = await supabase
      .from("material_requests")
      .update({ attachments: updatedAttachments })
      .eq("id", mr.id);
    if (updateError) {
      toast.error("Gagal menyimpan data lampiran", {
        id: toastId,
        description: updateError.message,
      });
    } else {
      toast.success(
        `${successfulUploads.length} file berhasil diunggah & disimpan.`,
        { id: toastId },
      );
      await fetchMrData();
    }
    setIsUploading(false);
    e.target.value = "";
  };

  const removeAttachment = (indexToRemove: number) => {
    if (!mr || !Array.isArray(mr.attachments)) return;
    const attachmentToRemove = mr.attachments[indexToRemove];
    if (!attachmentToRemove) return;
    const updatedAttachments = mr.attachments.filter(
      (_, i) => i !== indexToRemove,
    );
    setMr({ ...mr, attachments: updatedAttachments });
    supabase.storage.from("mr").remove([attachmentToRemove.url]);
    supabase
      .from("material_requests")
      .update({ attachments: updatedAttachments })
      .eq("id", mr.id)
      .then(({ error }) => {
        if (error) {
          toast.error("Gagal menghapus lampiran dari DB");
          fetchMrData();
        } else {
          toast.success(
            `Lampiran "${attachmentToRemove.name}" berhasil dihapus.`,
          );
        }
      });
  };

  const handleConfirmCloseMR = async () => {
    if (!mr) return;
    setActionLoading(true);
    const toastId = toast.loading("Menutup MR dan PO terkait...");
    try {
      const { error: mrError } = await supabase
        .from("material_requests")
        .update({ status: "Completed" })
        .eq("id", mr.id);
      if (mrError) throw mrError;
      const { data: relatedPOs, error: poFetchError } = await supabase
        .from("purchase_orders")
        .select("id")
        .eq("mr_id", mr.id);
      if (poFetchError) throw poFetchError;
      if (relatedPOs && relatedPOs.length > 0) {
        const poIds = relatedPOs.map((po) => po.id);
        const { error: poUpdateError } = await supabase
          .from("purchase_orders")
          .update({ status: "Completed" })
          .in("id", poIds);
        if (poUpdateError) throw poUpdateError;
      }
      toast.success("MR dan PO terkait berhasil ditutup!", { id: toastId });
      await fetchMrData();
    } catch (error: any) {
      toast.error("Gagal menutup MR", {
        id: toastId,
        description: error.message,
      });
    } finally {
      setActionLoading(false);
      setIsCloseMrAlertOpen(false);
    }
  };

  const RequesterActions = () => {
    if (
      !mr ||
      !currentUser ||
      mr.userid !== currentUser.id ||
      mr.status !== "Pending BAST"
    ) {
      return null;
    }
    return (
      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="bast-upload">Unggah BAST / Bukti Terima Barang</Label>
          <Input
            id="bast-upload"
            type="file"
            multiple
            disabled={actionLoading || isUploading}
            onChange={handleAttachmentUpload}
            className="mt-1"
          />
          {isUploading && (
            <div className="flex items-center text-sm text-muted-foreground mt-2">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengunggah...
            </div>
          )}
        </div>
        <hr />
        <Button
          className="w-full"
          onClick={() => setIsCloseMrAlertOpen(true)}
          disabled={actionLoading || isUploading}
        >
          <CheckCheck className="mr-2 h-4 w-4" />
          Tutup MR (Konfirmasi Barang Lengkap)
        </Button>
      </div>
    );
  };

  const ApprovalActions = () => {
    const activeStatuses = [
      "Pending Approval",
      "Pending Validation",
      "On Process",
    ];

    if (!mr || !currentUser) return null;
    if (!activeStatuses.includes(mr.status)) return null;
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
      case "pending bast":
        return <Badge className="bg-yellow-500 text-white">Pending BAST</Badge>;
      case "completed":
        return <Badge className="bg-green-500 text-white">Completed</Badge>;
      case "po open":
      case "on process":
        return <Badge className="bg-cyan-500 text-white">PO Open</Badge>;
      default:
        return <Badge>{status || "N/A"}</Badge>;
    }
  };

  // --- FIXED: Menambahkan fungsi getApprovalStatusBadge yang sebelumnya hilang ---
  const getApprovalStatusBadge = (
    status: "pending" | "approved" | "rejected" | string,
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

  const getCostCenterName = () => {
    const cc = mr?.cost_centers;
    if (Array.isArray(cc) && cc.length > 0) return cc[0].name;
    if (cc && typeof cc === "object" && "name" in cc) return (cc as any).name;
    return "-";
  };

  if (loading) return <DetailMRSkeleton />;
  if (error || !mr)
    return <Content className="col-span-12">Data tidak ditemukan</Content>;

  const currentTurnIndex = mr.approvals.findIndex(
    (app) => app.status === "pending",
  );
  const allPreviousApproved =
    currentTurnIndex === -1
      ? false
      : currentTurnIndex === 0 ||
        mr.approvals
          .slice(0, currentTurnIndex)
          .every((app) => app.status === "approved");

  const isOwner = currentUser?.id === mr.userid;
  const canDelete =
    isOwner && (mr.status === "Pending Validation" || mr.status === "Draft");

  return (
    <>
      <div className="col-span-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">{mr.kode_mr}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-muted-foreground text-sm">
                Dibuat pada {formatDateFriendly(mr.created_at)}
              </span>
              {getStatusBadge(mr.status)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canDelete && (
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                Hapus MR
              </Button>
            )}
            {canEdit && !isEditing && mr.status === "Pending Approval" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Edit className="mr-2 h-4 w-4" /> Edit Rincian
              </Button>
            )}
            {isEditing && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    fetchMrData();
                  }}
                  disabled={actionLoading}
                >
                  Batal
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveChanges}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}{" "}
                  Simpan
                </Button>
              </>
            )}
            <Badge variant="outline">{mr.level || "OPEN 1"}</Badge>
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
              icon={Building}
              label="Departemen"
              value={mr.department}
            />
            <div className="space-y-1">
              <Label>Kategori</Label>
              {isEditing ? (
                <Combobox
                  data={kategoriData}
                  onChange={(v) => setMr({ ...mr, kategori: v })}
                  defaultValue={mr.kategori}
                  disabled={actionLoading}
                />
              ) : (
                <p className="p-2 border rounded-md bg-muted/50 min-h-[36px] flex items-center">
                  {mr.kategori}
                </p>
              )}
            </div>
            <InfoItem
              icon={Calendar}
              label="Tanggal Dibuat"
              value={formatDateFriendly(mr.created_at)}
            />

            <div className="space-y-1">
              <Label>Due Date (Target)</Label>
              {isEditing ? (
                <Popover
                  open={isDatePopoverOpen}
                  onOpenChange={setIsDatePopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !mr.due_date && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {mr.due_date ? (
                        format(new Date(mr.due_date), "PPP")
                      ) : (
                        <span>Pilih tanggal...</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={mr.due_date ? new Date(mr.due_date) : undefined}
                      onSelect={(date) => {
                        setMr({ ...mr, due_date: date });
                        setIsDatePopoverOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <p className="p-2 border rounded-md bg-muted/50 min-h-[36px] flex items-center">
                  {formatDateFriendly(mr.due_date)}
                </p>
              )}
            </div>

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
              {isEditing ? (
                <Select
                  onValueChange={(v) => setMr({ ...mr, level: v as any })}
                  defaultValue={mr.level || ""}
                  disabled={actionLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih level..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MR_LEVELS.map((lvl) => (
                      <SelectItem key={lvl.value} value={lvl.value}>
                        {lvl.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="p-2 border rounded-md bg-muted/50 min-h-[36px] flex items-center gap-2">
                  <Layers className="h-4 w-4" /> {mr.level || "N/A"}
                </p>
              )}
            </div>

            <InfoItem
              icon={Building2}
              label="Cost Center"
              value={
                costCenterName
                  ? userProfile?.role === "requester"
                    ? costCenterName
                    : `${costCenterName} (Sisa: ${formatCurrency(
                        costCenterBudget ?? 0,
                      )})`
                  : "Belum Ditentukan GA"
              }
            />

            <div className="space-y-1">
              <Label>Tujuan (Site)</Label>
              {isEditing ? (
                <Combobox
                  data={dataLokasi}
                  onChange={(v) => setMr({ ...mr, tujuan_site: v })}
                  defaultValue={mr.tujuan_site}
                  disabled={actionLoading}
                />
              ) : (
                <p className="p-2 border rounded-md bg-muted/50 min-h-[36px] flex items-center gap-2">
                  <Truck className="h-4 w-4" /> {mr.tujuan_site || "N/A"}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Total Estimasi Biaya (Otomatis)</Label>
              <Input
                readOnly
                disabled
                value={formattedCost}
                className="font-bold"
              />
            </div>
            <div className="md:col-span-2 space-y-1">
              <Label>Remarks</Label>
              {isEditing ? (
                <Textarea
                  value={mr.remarks}
                  onChange={(e) => setMr({ ...mr, remarks: e.target.value })}
                  disabled={actionLoading}
                  rows={3}
                />
              ) : (
                <p className="p-2 border rounded-md bg-muted/50 min-h-[36px] whitespace-pre-wrap">
                  {mr.remarks || "-"}
                </p>
              )}
            </div>
          </div>
        </Content>

        {/* --- ORDER ITEMS SECTION (REVISI: Menampilkan Status & Tracking PO) --- */}
        <Content
          title="Daftar Barang (Item Request)"
          cardAction={
            isEditing && (
              <Button
                variant="outline"
                onClick={handleOpenAddItemDialog}
                disabled={actionLoading}
              >
                <Plus className="mr-2 h-4 w-4" /> Tambah Item
              </Button>
            )
          }
        >
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%]">Nama Barang</TableHead>
                  <TableHead className="w-[80px]">Qty</TableHead>
                  <TableHead className="w-[120px]">UoM</TableHead>
                  <TableHead>Estimasi Harga</TableHead>
                  <TableHead>Total Estimasi</TableHead>
                  <TableHead>Link</TableHead>
                  {/* KOLOM BARU: Status & Tracking */}
                  <TableHead className="w-[200px]">Status & Tracking</TableHead>
                  {isEditing && (
                    <TableHead className="w-[100px]">Aksi</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {mr.orders && mr.orders.length > 0 ? (
                  mr.orders.map((item, index) => {
                    // Tentukan warna dan label status
                    const statusColor =
                      MR_ITEM_STATUS_COLORS[item.status || "Pending"] ||
                      "bg-gray-100";
                    const statusLabel =
                      MR_ITEM_STATUS_LABELS[item.status || "Pending"] ||
                      item.status;

                    return (
                      <TableRow key={index}>
                        <TableCell>
                          {isEditing ? (
                            <div className="space-y-1">
                              <Input
                                value={item.name}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "name",
                                    e.target.value,
                                  )
                                }
                                disabled={actionLoading}
                                placeholder="Nama Item"
                              />
                              <Input
                                value={item.part_number || ""}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "part_number",
                                    e.target.value,
                                  )
                                }
                                disabled={actionLoading}
                                placeholder="Part Number (Opsional)"
                                className="text-xs h-8"
                              />
                            </div>
                          ) : (
                            <div>
                              <div className="font-medium">{item.name}</div>
                              {item.part_number && (
                                <div className="text-xs text-muted-foreground font-mono mt-0.5">
                                  PN: {item.part_number}
                                </div>
                              )}
                              {item.note && (
                                <div className="text-xs text-muted-foreground mt-1 italic">
                                  &quot;{item.note}&quot;
                                </div>
                              )}
                              {/* Tampilkan Note Status jika ada (misal: alasan Cancel) */}
                              {item.status_note && (
                                <div className="text-xs text-amber-600 mt-1 italic flex items-start gap-1">
                                  <Info className="w-3 h-3 mt-0.5" />
                                  {item.status_note}
                                </div>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              value={item.qty}
                              onChange={(e) =>
                                handleItemChange(index, "qty", e.target.value)
                              }
                              className="w-20"
                              type="number"
                              disabled={actionLoading}
                            />
                          ) : (
                            item.qty
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              value={item.uom}
                              onChange={(e) =>
                                handleItemChange(index, "uom", e.target.value)
                              }
                              className="w-24"
                              disabled={actionLoading}
                            />
                          ) : (
                            item.uom
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <CurrencyInput
                              value={item.estimasi_harga}
                              onValueChange={(value) =>
                                handleItemChange(index, "estimasi_harga", value)
                              }
                              disabled={actionLoading}
                              className="w-32"
                            />
                          ) : (
                            formatCurrency(item.estimasi_harga)
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(
                            Number(item.qty) * item.estimasi_harga,
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              value={item.url}
                              onChange={(e) =>
                                handleItemChange(index, "url", e.target.value)
                              }
                              disabled={actionLoading}
                              type="url"
                              placeholder="URL Link"
                            />
                          ) : (
                            item.url && (
                              <Button asChild variant={"outline"} size="sm">
                                <Link
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <LinkIcon className="h-3 w-3" />
                                </Link>
                              </Button>
                            )
                          )}
                        </TableCell>

                        {/* CELL BARU: STATUS BADGE & PO REFS */}
                        <TableCell>
                          <div className="flex flex-col items-start gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "capitalize font-normal",
                                statusColor,
                              )}
                            >
                              {statusLabel}
                            </Badge>

                            {/* Link ke PO jika sudah ada */}
                            {item.po_refs && item.po_refs.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {item.po_refs.map((ref, idx) => (
                                  <Link
                                    key={idx}
                                    href={`/purchase-order?search=${encodeURIComponent(ref)}`}
                                    className="text-[10px] bg-secondary text-secondary-foreground px-2 py-0.5 rounded-sm hover:underline flex items-center gap-1"
                                    target="_blank"
                                  >
                                    <LinkIcon className="w-3 h-3" />
                                    {ref}
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {isEditing && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleOpenEditItemDialog(index)}
                                disabled={actionLoading}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => removeItem(index)}
                                disabled={actionLoading}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={isEditing ? 8 : 7}
                      className="text-center text-muted-foreground h-24"
                    >
                      Tidak ada barang.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Content>
      </div>

      <div className="col-span-12 lg:col-span-4 space-y-6">
        <Content title="Tindakan">
          <div className="flex flex-col gap-2">
            {!isEditing && <ApprovalActions />}
            {!isEditing && <RequesterActions />}
            {isEditing && (
              <p className="text-sm text-center text-muted-foreground">
                Simpan perubahan atau setujui untuk melanjutkan.
                <br />
                {isMyTurnForApproval && (
                  <strong>(Menyetujui akan menyimpan otomatis)</strong>
                )}
              </p>
            )}
          </div>
        </Content>

        <Content title="Jalur Approval">
          {mr.approvals.length > 0 ? (
            <ul className="space-y-2">
              {mr.approvals.map((approver, index) => {
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
        <Content title="Lampiran">
          {isEditing ? (
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                  Mengunggah...
                </div>
              )}
              {mr.attachments.length > 0 && (
                <ul className="space-y-2 mt-2">
                  {mr.attachments.map((file, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded"
                    >
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <Paperclip className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{file.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeAttachment(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (mr.attachments || []).length > 0 ? (
            <ul className="space-y-2">
              {(mr.attachments as Attachment[]).map((file, index) => (
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
            <p className="text-sm text-muted-foreground">Tidak ada lampiran.</p>
          )}
        </Content>
      </div>

      <div className="col-span-12">
        <DiscussionSection
          mrId={String(mr.id)}
          initialDiscussions={mr.discussions as Discussion[]}
        />
      </div>

      {/* Dialog Item (Updated with Part Number & Status Preservation) */}
      <Dialog open={openItemDialog} onOpenChange={setOpenItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? "Edit Order Item" : "Tambah Order Item"}
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
              <Label htmlFor="itemPnDlg" className="text-right">
                Part Number
              </Label>
              <Input
                id="itemPnDlg"
                className="col-span-3"
                value={orderItem.part_number || ""}
                onChange={(e) =>
                  setOrderItem({ ...orderItem, part_number: e.target.value })
                }
                placeholder="(Opsional)"
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
              {editingIndex !== null ? "Simpan Perubahan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Info Level */}
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
              {MR_LEVELS.filter((l) => l.group === "OPEN").map((level) => (
                <li key={level.value}>
                  <strong>{level.value}:</strong> {level.description}
                </li>
              ))}
            </ul>
            <h4 className="font-semibold">
              Level CLOSE (Barang Sudah Diterima Site)
            </h4>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              {MR_LEVELS.filter((l) => l.group === "CLOSE").map((level) => (
                <li key={level.value}>
                  <strong>{level.value}:</strong> {level.description}
                </li>
              ))}
            </ul>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsLevelInfoOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi Close MR */}
      <AlertDialog
        open={isCloseMrAlertOpen}
        onOpenChange={setIsCloseMrAlertOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Anda Yakin Ingin Menutup MR Ini?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini akan mengubah status MR dan semua PO terkait menjadi
              &quot;Completed&quot;. Pastikan semua barang sudah Anda terima
              dengan lengkap. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCloseMR}
              disabled={actionLoading}
              className={cn("bg-green-600 hover:bg-green-700 text-white")}
            >
              {actionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCheck className="mr-2 h-4 w-4" />
              )}
              Ya, Tutup MR
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const DetailMRSkeleton = () => (
  <>
    <div className="col-span-12">
      <Skeleton className="h-12 w-1/2" />
    </div>
    <Content className="col-span-12 lg:col-span-8">
      <Skeleton className="h-64 w-full" />
    </Content>
    <Content className="col-span-12 lg:col-span-4">
      <Skeleton className="h-64 w-full" />
    </Content>
  </>
);

export default function DetailMRPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<DetailMRSkeleton />}>
      <DetailMRPageContent params={resolvedParams} />
    </Suspense>
  );
}

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
    className={cn(
      isBlock ? "flex flex-col gap-1" : "grid grid-cols-3 gap-x-2 items-start",
    )}
  >
    <div className="text-sm text-muted-foreground col-span-1 flex items-center gap-2 mt-0.5">
      <Icon className="h-4 w-4 flex-shrink-0" />
      {label}
    </div>
    <div className="text-sm font-semibold col-span-2 whitespace-pre-wrap break-words">
      {value}
    </div>
  </div>
);
